export default async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).end();

  // Debug log to see what's arriving
  console.log('Body received:', JSON.stringify(req.body));

  const { messages } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    console.error('Invalid messages:', messages);
    return res.status(400).json({ error: `messages must be an array, got: ${typeof messages}` });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are Chhaiya AI, a smart, friendly, and helpful AI assistant created by ChhaiyaDeveloper-AI. Be concise, clear, and engaging. Use emojis occasionally.'
          },
          ...messages
        ],
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    const data = await response.json();
    console.log('Groq status:', response.status);
    return res.status(response.status).json(data);

  } catch (error) {
    console.error('Groq API error:', error);
    return res.status(500).json({ error: { message: error.message } });
  }
}
