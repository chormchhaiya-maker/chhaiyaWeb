export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

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
          prompt: prompt,
          num_steps: 8
        })
      }
    );

    console.log('CF status:', r.status, r.headers.get('content-type'));

    if (!r.ok) {
      const t = await r.text();
      console.error('CF error:', t);
      return res.status(r.status).json({ error: t });
    }

    const buf = await r.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    return res.status(200).json({ url: `data:image/png;base64,${b64}` });

  } catch (e) {
    console.error('Error:', e);
    return res.status(500).json({ error: e.message });
  }
}
