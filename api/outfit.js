export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt, imageBase64, mode } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  // Build a detailed fashion prompt
  const fashionPrompt = mode === 'outfit_only'
    ? `Fashion photography, professional model wearing ${prompt}, full body shot, studio lighting, white background, high quality, photorealistic, 8K`
    : `A person wearing ${prompt}, fashion photography, studio lighting, professional photo, high quality, photorealistic, detailed fabric texture, 8K resolution`;

  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: fashionPrompt,
          num_steps: 8
        })
      }
    );

    console.log('Outfit gen status:', r.status);

    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: t });
    }

    const contentType = r.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await r.json();
      const imgData = data?.result?.image || data?.image;
      if (imgData) return res.status(200).json({ url: `data:image/png;base64,${imgData}` });
      return res.status(500).json({ error: 'No image returned' });
    }

    const buf = await r.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    return res.status(200).json({ url: `data:image/png;base64,${b64}` });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
