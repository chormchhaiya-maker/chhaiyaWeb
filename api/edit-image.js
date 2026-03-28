// api/edit-image.js
// Multi-model chain: tries 4 different models for best result
// Order: CF img2img → HF InstantStyle → HF SDXL img2img → CF flux fallback

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

  // ============================================================
  // STYLE PROMPTS
  // ============================================================
  const stylePrompts = {
    'anime':      'anime art style, studio ghibli, vibrant colors, highly detailed, same person same face same pose',
    'cartoon':    'cartoon illustration style, pixar disney style, colorful, same person same face same pose',
    'painting':   'oil painting masterpiece, fine art, detailed brush strokes, same person same face same pose',
    'sketch':     'detailed pencil sketch, black and white, fine line art, same person same face same pose',
    'vintage':    'vintage retro photo, film grain, sepia warm tones, 1970s style, same person same face',
    'cyberpunk':  'cyberpunk neon style, futuristic, blade runner aesthetic, same person same face same pose',
    'remove-bg':  'same person same face, pure white background, professional studio portrait, no background',
  };

  const styleBase = stylePrompts[mode] || '';
  const finalPrompt = styleBase ? `${styleBase}, ${prompt}` : prompt;

  // Extract clean base64
  let cleanBase64 = imageBase64;
  if (imageBase64.startsWith('data:')) {
    cleanBase64 = imageBase64.split(',')[1];
  }

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  const hfToken = process.env.HF_TOKEN; // Add this to Vercel env vars

  // ============================================================
  // MODEL 1: Cloudflare stable-diffusion-v1-5-img2img
  // Fast, free, keeps some structure of original
  // ============================================================
  if (accountId && apiToken) {
    try {
      console.log('Trying CF img2img...');
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
            image: cleanBase64,
            strength: 0.65,
            num_inference_steps: 20,
            guidance_scale: 7.5
          })
        }
      );
      console.log('CF img2img status:', r.status);
      if (r.ok) {
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await r.json();
          const img = data?.result?.image || data?.image;
          if (img) return res.status(200).json({ url: `data:image/png;base64,${img}`, model: 'cf-sd-img2img' });
        } else {
          const buf = await r.arrayBuffer();
          if (buf.byteLength > 5000) {
            const b64 = Buffer.from(buf).toString('base64');
            return res.status(200).json({ url: `data:image/png;base64,${b64}`, model: 'cf-sd-img2img' });
          }
        }
      }
    } catch (e) { console.log('CF img2img failed:', e.message); }

    // ============================================================
    // MODEL 2: Cloudflare dreamshaper-8-lcm (img2img)
    // ============================================================
    try {
      console.log('Trying CF dreamshaper...');
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
            strength: 0.65,
            num_inference_steps: 8,
          })
        }
      );
      console.log('CF dreamshaper status:', r.status);
      if (r.ok) {
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await r.json();
          const img = data?.result?.image || data?.image;
          if (img) return res.status(200).json({ url: `data:image/png;base64,${img}`, model: 'cf-dreamshaper' });
        } else {
          const buf = await r.arrayBuffer();
          if (buf.byteLength > 5000) {
            const b64 = Buffer.from(buf).toString('base64');
            return res.status(200).json({ url: `data:image/png;base64,${b64}`, model: 'cf-dreamshaper' });
          }
        }
      }
    } catch (e) { console.log('CF dreamshaper failed:', e.message); }
  }

  // ============================================================
  // MODEL 3: Hugging Face — SDXL img2img (better quality)
  // Needs HF_TOKEN in Vercel env vars (free account works)
  // Sign up at huggingface.co → Settings → Access Tokens
  // ============================================================
  if (hfToken) {
    try {
      console.log('Trying HF SDXL img2img...');

      // Convert base64 to blob for HF API
      const imageBuffer = Buffer.from(cleanBase64, 'base64');

      // Use HF Inference API with SDXL img2img
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      formData.append('inputs', blob);

      const r = await fetch(
        'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-refiner-1.0',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hfToken}`,
            'X-Wait-For-Model': 'true',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: cleanBase64,
            parameters: {
              prompt: finalPrompt,
              strength: 0.6,
              num_inference_steps: 20,
              guidance_scale: 7.5,
            }
          })
        }
      );
      console.log('HF SDXL status:', r.status);
      if (r.ok) {
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('image')) {
          const buf = await r.arrayBuffer();
          if (buf.byteLength > 5000) {
            const b64 = Buffer.from(buf).toString('base64');
            return res.status(200).json({ url: `data:image/png;base64,${b64}`, model: 'hf-sdxl' });
          }
        }
      }
    } catch (e) { console.log('HF SDXL failed:', e.message); }

    // ============================================================
    // MODEL 4: Hugging Face — stable-diffusion-2-1 img2img
    // More reliable, slightly lower quality
    // ============================================================
    try {
      console.log('Trying HF SD2.1 img2img...');
      const r = await fetch(
        'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hfToken}`,
            'X-Wait-For-Model': 'true',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: finalPrompt,
            parameters: {
              image: cleanBase64,
              strength: 0.6,
              num_inference_steps: 20,
            }
          })
        }
      );
      console.log('HF SD2.1 status:', r.status);
      if (r.ok) {
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('image')) {
          const buf = await r.arrayBuffer();
          if (buf.byteLength > 5000) {
            const b64 = Buffer.from(buf).toString('base64');
            return res.status(200).json({ url: `data:image/png;base64,${b64}`, model: 'hf-sd21' });
          }
        }
      }
    } catch (e) { console.log('HF SD2.1 failed:', e.message); }

    // ============================================================
    // MODEL 5: Hugging Face — img2img with ip-adapter (face preserving)
    // Best for keeping the same person's face
    // ============================================================
    try {
      console.log('Trying HF img2img face-preserving...');
      const r = await fetch(
        'https://api-inference.huggingface.co/models/h94/IP-Adapter-FaceID',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hfToken}`,
            'X-Wait-For-Model': 'true',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: {
              prompt: finalPrompt,
              image: cleanBase64,
            }
          })
        }
      );
      console.log('HF IP-Adapter status:', r.status);
      if (r.ok) {
        const buf = await r.arrayBuffer();
        if (buf.byteLength > 5000) {
          const b64 = Buffer.from(buf).toString('base64');
          return res.status(200).json({ url: `data:image/png;base64,${b64}`, model: 'hf-ip-adapter' });
        }
      }
    } catch (e) { console.log('HF IP-Adapter failed:', e.message); }
  }

  // ============================================================
  // FINAL FALLBACK: Cloudflare text-to-image (flux)
  // At least generates something with the right style
  // ============================================================
  if (accountId && apiToken) {
    try {
      console.log('Falling back to CF flux text2img...');
      const r = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: finalPrompt + ', portrait, high quality, detailed',
            num_steps: 8
          })
        }
      );
      if (r.ok) {
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await r.json();
          const img = data?.result?.image || data?.image || data?.result;
          if (img && typeof img === 'string') {
            return res.status(200).json({ url: `data:image/png;base64,${img}`, model: 'cf-flux-fallback' });
          }
        }
        const buf = await r.arrayBuffer();
        if (buf.byteLength > 5000) {
          const b64 = Buffer.from(buf).toString('base64');
          return res.status(200).json({ url: `data:image/png;base64,${b64}`, model: 'cf-flux-fallback' });
        }
      }
    } catch (e) { console.log('CF flux fallback failed:', e.message); }
  }

  return res.status(500).json({ error: 'All image editing models failed. Please try again.' });
}
