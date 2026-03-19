export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            width: 512,
            height: 512,
            num_inference_steps: 25,
            guidance_scale: 7.5
          }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json();
      // Model might be loading, tell frontend to retry
      if (response.status === 503) {
        return res.status(503).json({ error: 'Model is loading, please retry in 20 seconds', loading: true });
      }
      return res.status(response.status).json({ error: err.error || 'HuggingFace error' });
    }

    // Response is raw image bytes
    const imageBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    res.status(200).json({ url: dataUrl });

  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
