export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  // Try multiple models in order until one works
  const models = [
    'stabilityai/stable-diffusion-2-1',
    'runwayml/stable-diffusion-v1-5',
    'CompVis/stable-diffusion-v1-4',
  ];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HF_API_KEY}`,
            'Content-Type': 'application/json',
            'x-wait-for-model': 'true'   // wait instead of 503
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              width: 512,
              height: 512,
              num_inference_steps: 20,
              guidance_scale: 7.5
            }
          })
        }
      );

      console.log(`Model ${model} status: ${response.status}`);

      if (!response.ok) {
        const text = await response.text();
        console.error(`Model ${model} failed:`, text);
        continue; // try next model
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('image')) {
        const text = await response.text();
        console.error(`Model ${model} returned non-image:`, text);
        continue;
      }

      const imageBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;

      return res.status(200).json({ url: dataUrl, model });

    } catch (err) {
      console.error(`Model ${model} threw:`, err.message);
      continue;
    }
  }

  // All models failed
  return res.status(500).json({ error: 'All models failed. Please try again in a moment.' });
}
