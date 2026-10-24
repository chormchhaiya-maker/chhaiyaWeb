// api/image.js — CC-AI image generation (Cloudflare Workers AI, FLUX.1 schnell)
// FIX: the model rejects "num_steps". The correct setting is "steps" (maximum 8).

const MODEL = '@cf/black-forest-labs/flux-1-schnell';

// Turn Cloudflare's error JSON into a short message for the user
function friendlyError(rawText) {
  try {
    const err = JSON.parse(rawText)?.errors?.[0];
    if (err?.code === 3030) {
      return 'That prompt was blocked by the image safety filter. Try different words.';
    }
    if (err?.message) return err.message;
  } catch (_) {}
  return 'Image generation failed. Please try again.';
}

// Cloudflare usually returns JPEG; detect the real type from the first bytes
function mimeFromBase64(b64) {
  if (b64.startsWith('iVBOR')) return 'image/png';
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt required' });
  }

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  if (!accountId || !apiToken) {
    console.error('Missing CF_ACCOUNT_ID or CF_API_TOKEN environment variable');
    return res.status(500).json({ error: 'Image service is not configured.' });
  }

  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim().slice(0, 2048), // model limit: 2048 characters
          steps: 8,                              // model limit: 8
        }),
      }
    );

    console.log('CF status:', r.status);

    if (!r.ok) {
      const t = await r.text();
      console.error('CF error:', t); // full details stay in the Vercel logs
      return res.status(r.status).json({ error: friendlyError(t) });
    }

    const contentType = r.headers.get('content-type') || '';

    // Normal case: JSON like { result: { image: '<base64>' }, success: true }
    if (contentType.includes('application/json')) {
      const data = await r.json();
      const imgData = data?.result?.image || data?.image || data?.result;
      if (imgData && typeof imgData === 'string') {
        return res.status(200).json({ url: `data:${mimeFromBase64(imgData)};base64,${imgData}` });
      }
      console.error('No image in response:', JSON.stringify(data).slice(0, 500));
      return res.status(500).json({ error: 'No image was returned. Please try again.' });
    }

    // Fallback: raw binary image
    const buf = Buffer.from(await r.arrayBuffer());
    const b64 = buf.toString('base64');
    return res.status(200).json({ url: `data:${mimeFromBase64(b64)};base64,${b64}` });
  } catch (e) {
    console.error('Error:', e);
    return res.status(500).json({ error: 'Image generation failed. Please try again.' });
  }
}
