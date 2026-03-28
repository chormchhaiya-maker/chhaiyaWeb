// api/edit-image.js
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

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    return res.status(500).json({ error: 'Missing CF_ACCOUNT_ID or CF_API_TOKEN' });
  }

  // ============================================================
  // STYLE PROMPTS — describe what the OUTPUT should look like
  // These work WITH the original image content
  // ============================================================
  const stylePrompts = {
    'anime':      'anime art style, japanese animation, vibrant colors, highly detailed, studio ghibli style, keep the same person and pose',
    'cartoon':    'cartoon style, colorful fun illustration, pixar style, keep the same person and pose',
    'painting':   'oil painting masterpiece, artistic brush strokes, renaissance style, keep the same person and pose',
    'sketch':     'pencil sketch, black and white, hand drawn detailed line art, keep the same person and pose',
    'vintage':    'vintage retro photograph, film grain, warm sepia tones, 1970s style, keep the same person',
    'cyberpunk':  'cyberpunk style, neon lights, futuristic, blade runner aesthetic, keep the same person and pose',
    'remove-bg':  'same person, pure white background, professional studio photo, no background',
  };

  // Build the final prompt — combine style + user's custom request
  const styleBase = stylePrompts[mode] || '';
  const finalPrompt = styleBase
    ? `${styleBase}, ${prompt}`
    : prompt;

  // ============================================================
  // EXTRACT CLEAN BASE64 from data URL
  // Cloudflare img2img needs raw base64, not "data:image/png;base64,..."
  // ============================================================
  let cleanBase64 = imageBase64;
  if (imageBase64.startsWith('data:')) {
    cleanBase64 = imageBase64.split(',')[1];
  }

  // ============================================================
  // TRY 1: Cloudflare img2img model (edits your actual photo)
  // @cf/runwayml/stable-diffusion-v1-5-img2img
  // ============================================================
  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/runwayml/stable-diffusion-v1-5-img2img`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          image: cleanBase64,        // <-- your original photo
          strength: 0.75,            // 0 = keep original, 1 = full change. 0.75 = good balance
          num_inference_steps: 20,
          guidance_scale: 7.5
        })
      }
    );

    console.log('CF img2img status:', r.status, r.headers.get('content-type'));

    if (r.ok) {
      const contentType = r.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await r.json();
        const imgData = data?.result?.image || data?.image || data?.result;
        if (imgData && typeof imgData === 'string') {
          return res.status(200).json({ url: `data:image/png;base64,${imgData}` });
        }
      }

      // Binary response
      const buf = await r.arrayBuffer();
      if (buf.byteLength > 1000) {
        const b64 = Buffer.from(buf).toString('base64');
        return res.status(200).json({ url: `data:image/png;base64,${b64}` });
      }
    }

    const errText = await r.text().catch(() => 'unknown error');
    console.log('img2img failed:', r.status, errText);

  } catch (e) {
    console.log('img2img exception:', e.message);
  }

  // ============================================================
  // TRY 2: Cloudflare dreamshaper (another img2img model)
  // ============================================================
  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/lykon/dreamshaper-8-lcm`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          image: cleanBase64,
          strength: 0.7,
          num_inference_steps: 8,
        })
      }
    );

    console.log('CF dreamshaper status:', r.status);

    if (r.ok) {
      const contentType = r.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await r.json();
        const imgData = data?.result?.image || data?.image;
        if (imgData) return res.status(200).json({ url: `data:image/png;base64,${imgData}` });
      }
      const buf = await r.arrayBuffer();
      if (buf.byteLength > 1000) {
        const b64 = Buffer.from(buf).toString('base64');
        return res.status(200).json({ url: `data:image/png;base64,${b64}` });
      }
    }
  } catch (e) {
    console.log('dreamshaper exception:', e.message);
  }

  // ============================================================
  // FALLBACK: Generate a new image based on prompt + describe original
  // At least make the prompt include what the user wanted
  // ============================================================
  try {
    console.log('Falling back to text-to-image generation');
    const fallbackPrompt = `${finalPrompt}, portrait, high quality, detailed`;

    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: fallbackPrompt,
          num_steps: 8
        })
      }
    );

    if (r.ok) {
      const contentType = r.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await r.json();
        const imgData = data?.result?.image || data?.image || data?.result;
        if (imgData && typeof imgData === 'string') {
          return res.status(200).json({
            url: `data:image/png;base64,${imgData}`,
            warning: 'Used generation fallback — original photo could not be edited directly'
          });
        }
      }
      const buf = await r.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      return res.status(200).json({ url: `data:image/png;base64,${b64}` });
    }

    const t = await r.text();
    return res.status(500).json({ error: `All models failed. Last error: ${t}` });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
