export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { imageBase64, prompt, mode } = req.body || {};
  if (!imageBase64 || !prompt) {
    return res.status(400).json({ error: 'imageBase64 and prompt required' });
  }

  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    let hfModel = 'timbrooks/instruct-pix2pix';
    let body = {};

    if (mode === 'remove-bg') {
      // Remove background
      hfModel = 'briaai/RMBG-1.4';
      body = { inputs: base64Data };
    } else {
      // Style transfer, filters, outfit color, background change — all use pix2pix
      const promptMap = {
        'anime': `convert to anime art style, ${prompt}`,
        'cartoon': `convert to cartoon style, ${prompt}`,
        'painting': `convert to oil painting art style, ${prompt}`,
        'sketch': `convert to pencil sketch style, ${prompt}`,
        'vintage': `apply vintage retro filter, ${prompt}`,
        'cyberpunk': `apply cyberpunk neon filter, ${prompt}`,
      };
      const finalPrompt = promptMap[mode] || prompt;
      body = {
        inputs: finalPrompt,
        parameters: {
          image: base64Data,
          num_inference_steps: 20,
          image_guidance_scale: 1.5,
          guidance_scale: 7.5
        }
      };
    }

    const r = await fetch(
      `https://router.huggingface.co/hf-inference/models/${hfModel}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json',
          'x-wait-for-model': 'true'
        },
        body: JSON.stringify(body)
      }
    );

    if (r.status === 503) return res.status(503).json({ error: 'Model loading, retry in 20s' });
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: t });
    }

    const buf = await r.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    return res.status(200).json({ url: `data:image/png;base64,${b64}` });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
