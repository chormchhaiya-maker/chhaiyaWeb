// api/music.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    return res.status(500).json({ error: 'HF_TOKEN not set in Vercel environment variables.' });
  }

  // ============================================================
  // NEW HF URL: router.huggingface.co (old api-inference is dead)
  // ============================================================
  const models = [
    'facebook/musicgen-small',
    'facebook/musicgen-medium',
  ];

  for (const model of models) {
    try {
      console.log('Trying:', model);
      const r = await fetch(
        `https://router.huggingface.co/hf-inference/models/${model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: prompt }),
          signal: AbortSignal.timeout(90000)
        }
      );

      console.log(model, 'status:', r.status, r.headers.get('content-type'));

      if (r.status === 503) {
        console.log('Model loading, trying next...');
        continue;
      }

      if (r.status === 401) {
        return res.status(500).json({ error: '❌ HF_TOKEN is invalid or expired. Please create a new token at huggingface.co → Settings → Access Tokens and update it in Vercel.' });
      }

      if (!r.ok) {
        const err = await r.text().catch(() => '');
        console.log('Failed:', err);
        continue;
      }

      const contentType = r.headers.get('content-type') || '';
      if (contentType.includes('audio') || contentType.includes('octet-stream')) {
        const buf = await r.arrayBuffer();
        if (buf.byteLength > 1000) {
          const b64 = Buffer.from(buf).toString('base64');
          const audioType = contentType.includes('flac') ? 'audio/flac' : 'audio/wav';
          return res.status(200).json({ url: `data:${audioType};base64,${b64}` });
        }
      }

    } catch (e) {
      console.log(model, 'exception:', e.message);
    }
  }

  return res.status(500).json({
    error: '❌ Music generation failed. Your HF_TOKEN may be invalid — please create a new one at huggingface.co → Settings → Access Tokens, then update it in Vercel environment variables.'
  });
}
