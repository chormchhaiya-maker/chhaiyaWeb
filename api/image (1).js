export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json',
          'x-wait-for-model': 'true'
        },
        body: JSON.stringify({ inputs: prompt })
      }
    );

    // Log for debugging in Vercel logs
    console.log('HF status:', response.status);
    console.log('HF content-type:', response.headers.get('content-type'));

    if (!response.ok) {
      const text = await response.text();
      console.error('HF error body:', text);
      return res.status(response.status).json({ error: text });
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return res.status(200).json({ url: `data:image/png;base64,${base64}` });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
