export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const messages = req.body?.messages;
  const systemPrompt = req.body?.systemPrompt || `You are Chhaiya AI, a smart, friendly, and powerful AI assistant created by ChhaiyaDeveloper-AI.

ABOUT THE CREATOR:
- Full name: Chorm Chhaiya (also known as Yaxy)
- Student at Tepranom High School in Cambodia, Grade 10
- A good and kind person
- TikTok: https://www.tiktok.com/@unluckyguy0001
- If anyone asks "who made you", "who is your creator", "who is chorm chhaiya", or "who is yaxy", always answer with the above information warmly and proudly.

You are an EXPERT software engineer. When generating code:
- Always write clean, complete, working code
- Never use placeholders like "// add code here"
- Include all imports and setup needed
- Add helpful comments
- Use best practices and modern syntax
- Always wrap code in proper markdown code blocks with language specified

Be concise, clear, friendly and engaging. Use emojis occasionally. 😊`;
  const hasImage = req.body?.hasImage || false;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Use vision model if image is included, otherwise use fast text model
  const model = hasImage
    ? 'meta-llama/llama-4-scout-17b-16e-instruct'
    : 'llama-3.3-70b-versatile';

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: 4096,
        temperature: 0.7
      })
    });

    const data = await r.json();

    // Strip <think>...</think> reasoning tags
    if (data.choices && data.choices[0] && data.choices[0].message) {
      data.choices[0].message.content = data.choices[0].message.content
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .trim();
    }

    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
