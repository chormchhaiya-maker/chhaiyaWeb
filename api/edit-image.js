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

  // Style prompts for each mode
  const stylePrompts = {
    'anime': 'anime art style, japanese animation, vibrant colors, highly detailed, studio ghibli style',
    'cartoon': 'cartoon style, colorful, fun illustration, pixar style',
    'painting': 'oil painting, artistic masterpiece, brush strokes, renaissance style',
    'sketch': 'pencil sketch, black and white, hand drawn, detailed line art',
    'vintage': 'vintage retro photograph, film grain, warm sepia tones, 1970s style',
    'cyberpunk': 'cyberpunk style, neon lights, futuristic city, blade runner aesthetic',
    'remove-bg': 'subject on pure white background, professional photo, no background',
  };

  const finalPrompt = stylePrompts[mode] || prompt;

  try {
    const accountId = process.env.CF_ACCOUNT_ID;
    const apiToken = process.env.CF_API_TOKEN;

    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          num_steps: 8
        })
      }
    );

    console.log('CF edit status:', r.status, r.headers.get('content-type'));

    if (!r.ok) {
      const t = await r.text();
      console.error('CF edit error:', t);
      return res.status(r.status).json({ error: t });
    }

    const contentType = r.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await r.json();
      const imgData = data?.result?.image || data?.image || data?.result;
      if (imgData && typeof imgData === 'string') {
        return res.status(200).json({ url: `data:image/png;base64,${imgData}` });
      }
      return res.status(500).json({ error: 'No image in response' });
    }

    const buf = await r.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    return res.status(200).json({ url: `data:image/png;base64,${b64}` });

  } catch (e) {
    console.error('Edit error:', e);
    return res.status(500).json({ error: e.message });
  }
}
