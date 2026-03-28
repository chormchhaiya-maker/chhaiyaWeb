// api/music.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const encoded = encodeURIComponent(prompt);

  // ============================================================
  // TRY 1: Pollinations.ai — completely free, no key needed
  // Try multiple endpoint formats (they change sometimes)
  // ============================================================
  const pollinationUrls = [
    `https://audio.pollinations.ai/${encoded}`,
    `https://pollinations.ai/audio/${encoded}`,
    `https://audio.pollinations.ai/prompt/${encoded}`,
  ];

  for (const url of pollinationUrls) {
    try {
      console.log('Trying Pollinations:', url);
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CC-AI/1.0)' },
        signal: AbortSignal.timeout(30000)
      });
      console.log('Pollinations status:', r.status, r.headers.get('content-type'));

      if (r.ok) {
        const contentType = r.headers.get('content-type') || 'audio/mpeg';
        if (contentType.includes('audio') || contentType.includes('octet-stream')) {
          const buf = await r.arrayBuffer();
          if (buf.byteLength > 1000) {
            const b64 = Buffer.from(buf).toString('base64');
            return res.status(200).json({
              url: `data:${contentType};base64,${b64}`,
              source: 'pollinations'
            });
          }
        }
      }
    } catch (e) {
      console.log('Pollinations attempt failed:', e.message);
    }
  }

  // ============================================================
  // TRY 2: Hugging Face MusicGen (free, needs HF_TOKEN)
  // Get free token at huggingface.co → Settings → Access Tokens
  // Add HF_TOKEN to Vercel environment variables
  // ============================================================
  const HF_TOKEN = process.env.HF_TOKEN;

  if (HF_TOKEN) {
    const hfModels = [
      'facebook/musicgen-small',
      'facebook/musicgen-medium',
    ];

    for (const model of hfModels) {
      try {
        console.log('Trying HF model:', model);
        const r = await fetch(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${HF_TOKEN}`,
              'Content-Type': 'application/json',
              'X-Wait-For-Model': 'true',
            },
            body: JSON.stringify({ inputs: prompt }),
            signal: AbortSignal.timeout(60000)
          }
        );

        console.log('HF status:', r.status, r.headers.get('content-type'));

        if (r.ok) {
          const contentType = r.headers.get('content-type') || '';
          if (contentType.includes('audio') || contentType.includes('octet-stream')) {
            const buf = await r.arrayBuffer();
            if (buf.byteLength > 1000) {
              const b64 = Buffer.from(buf).toString('base64');
              const audioType = contentType.includes('flac') ? 'audio/flac' : 'audio/wav';
              return res.status(200).json({
                url: `data:${audioType};base64,${b64}`,
                source: model
              });
            }
          }
        }

        if (r.status === 503) {
          console.log('HF model loading, trying next...');
          continue;
        }

      } catch (e) {
        console.log('HF model failed:', e.message);
      }
    }
  }

  // ============================================================
  // TRY 3: Mubert free API (no key needed)
  // ============================================================
  try {
    console.log('Trying Mubert...');
    const r = await fetch('https://api-b2b.mubert.com/v2/RecordTrackTTM', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'RecordTrackTTM',
        params: {
          pat: 'free',
          prompt,
          duration: 30,
          format: 'mp3',
          intensity: 'medium',
          mode: 'track'
        }
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (r.ok) {
      const data = await r.json();
      const trackUrl = data?.data?.tasks?.[0]?.download_link || data?.data?.url;
      if (trackUrl) {
        // Fetch and convert to base64
        const audioRes = await fetch(trackUrl);
        if (audioRes.ok) {
          const buf = await audioRes.arrayBuffer();
          const b64 = Buffer.from(buf).toString('base64');
          return res.status(200).json({ url: `data:audio/mp3;base64,${b64}`, source: 'mubert' });
        }
      }
    }
  } catch (e) {
    console.log('Mubert failed:', e.message);
  }

  // ============================================================
  // ALL FAILED
  // ============================================================
  return res.status(500).json({
    error: HF_TOKEN
      ? '❌ All music services are temporarily unavailable. Please try again in a moment.'
      : '❌ Music generation failed. To enable backup music generation, add HF_TOKEN to your Vercel environment variables (free at huggingface.co).'
  });
}
