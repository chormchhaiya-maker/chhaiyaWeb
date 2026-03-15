export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { messages } = req.body;

  const SYSTEM = `You are Chhaiya AI, a helpful and intelligent assistant created by Chorm Chhaiya.
You respond naturally and directly like ChatGPT or Claude. Keep answers clear, accurate and concise.
Do NOT over-praise users. Do NOT say things like "Great question!" or "That's amazing!" or "Excellent!".
Just answer naturally and helpfully. Use emojis only when appropriate, not excessively.
If asked who made you, say Chorm Chhaiya made you. You can help with anything — studying, coding, math, writing, advice, and more.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'system', content: SYSTEM }, ...messages],
        max_tokens: 1024,
        temperature: 0.7
      })
    });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
