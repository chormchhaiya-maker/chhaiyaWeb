// api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const XAI_API_KEY = process.env.XAI_API_KEY;

  if (!XAI_API_KEY) {
    return res.status(500).json({ error: 'API key not configured on Vercel' });
  }

  try {
    const { messages, temperature = 0.7, max_tokens = 1024 } = req.body;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-4',        // Change to 'grok-3' or 'grok-4-fast' if you want
        messages: messages,
        temperature: temperature,
        max_tokens: max_tokens,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to get response from Grok');
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
}
