export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  try {
    // Use Pollinations audio API - completely free
    const encoded = encodeURIComponent(prompt);
    const url = `https://audio.pollinations.ai/${encoded}`;
    
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    console.log('Music status:', r.status, r.headers.get('content-type'));

    if (!r.ok) {
      return res.status(r.status).json({ error: `Music generation failed: ${r.status}` });
    }

    const buf = await r.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    const contentType = r.headers.get('content-type') || 'audio/mpeg';
    return res.status(200).json({ url: `data:${contentType};base64,${b64}` });

  } catch (e) {
    console.error('Music error:', e);
    return res.status(500).json({ error: e.message });
  }
}
