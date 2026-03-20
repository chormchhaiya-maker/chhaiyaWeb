export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  try {
    const r = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'grok-2-image-1212',
        prompt: prompt,
        n: 1,
        response_format: 'b64_json'
      })
    });

    console.log('xAI status:', r.status);

    if (!r.ok) {
      const t = await r.text();
      console.error('xAI error:', t);
      return res.status(r.status).json({ error: t });
    }

    const data = await r.json();
    const b64 = data.data[0].b64_json;
    return res.status(200).json({ url: `data:image/png;base64,${b64}` });

  } catch (e) {
    console.error('Error:', e);
    return res.status(500).json({ error: e.message });
  }
}
