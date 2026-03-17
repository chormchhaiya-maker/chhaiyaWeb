// pages/api/image.js   ← or app/api/image/route.js (Next.js App Router)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
    return res.status(400).json({ error: 'Please provide a good prompt (at least 5 characters)' });
  }

  try {
    const response = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-image",   // Best quality & speed
        prompt: prompt.trim(),
        n: 1,
        response_format: "url"
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('xAI Error:', errorData);
      return res.status(500).json({ 
        error: 'xAI API Error', 
        details: errorData.slice(0, 300) 
      });
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;

    if (!imageUrl) {
      return res.status(500).json({ error: 'No image URL received from Grok Imagine' });
    }

    // Return URL (fast & efficient)
    return res.status(200).json({ 
      url: imageUrl,
      prompt: prompt 
    });

  } catch (err) {
    console.error('Image generation failed:', err);
    return res.status(500).json({ 
      error: 'Server error while generating image',
      message: err.message 
    });
  }
}
