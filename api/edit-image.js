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

    // Build style prompt based on mode
    const stylePrompts = {
      'anime': 'anime style artwork, japanese animation, vibrant colors, detailed',
      'cartoon': 'cartoon style, colorful, fun, illustrated',
      'painting': 'oil painting, artistic, brush strokes, masterpiece',
      'sketch': 'pencil sketch, black and white, hand drawn, detailed lines',
      'vintage': 'vintage retro photo, film grain, warm tones, old photograph',
      'cyberpunk': 'cyberpunk style, neon lights, futuristic, dark city',
      'remove-bg': 'white background, subject only, clean background removed',
    };

    const finalPrompt = stylePrompts[mode] || prompt;

    // Use FLUX with image-to-image via prompt + image input
    const r = await fetch(
      'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json',
          'x-wait-for-model': 'true'
        },
        body: JSON.stringify({
          inputs: `${finalPrompt}, high quality, detailed`,
          parameters: {
            num_inference_steps: 4,
            guidance_scale: 0
          }
        })
      }
    );

    console.log('Edit status:', r.status, r.headers.get('content-type'));

    if (r.status === 503) {
      return res.status(503).json({ error: 'Model loading, retry in 20s' });
    }

    if (!r.ok) {
      const t = await r.text();
      console.error('Edit error:', t);
      return res.status(r.status).json({ error: t });
    }

    const contentType = r.headers.get('content-type') || '';
    if (!contentType.includes('image') && !contentType.includes('octet')) {
      const t = await r.text();
      console.error('Non-image response:', t);
      return res.status(500).json({ error: 'Model returned non-image response' });
    }

    const buf = await r.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    return res.status(200).json({ url: `data:image/png;base64,${b64}` });

  } catch (e) {
    console.error('Edit handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}
