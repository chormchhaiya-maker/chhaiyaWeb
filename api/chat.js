export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const messages = req.body?.messages;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2-instruct',
        messages: [
          { role: 'system', content: `You are Chhaiya AI, a smart, friendly, and powerful AI assistant created by ChhaiyaDeveloper-AI.

You are an EXPERT software engineer and programmer. When generating code:
- Always write clean, complete, working code — never use placeholders like "// add code here"
- Include all imports, dependencies, and setup needed to run the code
- Add helpful comments explaining what the code does
- Use best practices and modern syntax for the language
- If asked for HTML/CSS/JS, make it beautiful and fully functional
- If asked for a specific language, use that language correctly
- Always wrap code in proper markdown code blocks with the language specified e.g. \`\`\`python
- If there's a bug or error, explain what was wrong and provide the fixed code
- For complex tasks, break down the solution step by step before the code

For non-code questions, be concise, clear, friendly and engaging. Use emojis occasionally. 😊` },
          ...messages
        ],
        max_tokens: 8192,
        temperature: 0.7
      })
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
