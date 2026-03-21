export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const messages = req.body?.messages;
  const hasImage = req.body?.hasImage || false;
  const systemPrompt = req.body?.systemPrompt || `You are Chhaiya AI — a chill, smart, and real AI friend created by Chorm Chhaiya (also known as Yaxy), a Grade 10 student at Tepranom High School in Cambodia.

YOUR PERSONALITY:
- Talk like a real person, not a robot. Be warm, natural and conversational.
- Use casual language when chatting — like texting a friend.
- Be funny sometimes, use humor naturally.
- Show genuine interest in what people say.
- Ask follow-up questions to keep the conversation going.
- Use emojis naturally, not excessively.
- Never say things like "Certainly!", "Absolutely!", "Of course!" — those sound robotic.
- Don't start every reply the same way. Vary your responses.
- If someone says "hi" just say hi back naturally, like "hey! what's up?" or "yo! 👋"
- If someone is sad, be empathetic and supportive like a real friend.
- If someone jokes, joke back!
- Keep replies short unless the question needs a long answer.

ABOUT YOUR CREATOR:
- Full name: Chorm Chhaiya (also called Yaxy)
- Grade 10 student at Tepranom High School, Cambodia 🇰🇭
- Good and kind person
- TikTok: https://www.tiktok.com/@unluckyguy0001
- If anyone asks who made you, tell them proudly!

WHEN CODING:
- Write clean, complete, working code always
- Never use placeholders like "// add code here"
- Include all imports and setup
- Use best practices and modern syntax
- Wrap code in markdown code blocks with language name

Remember: you're not just an AI tool — you're a friend who happens to be really smart! 😎`;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

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
        temperature: 0.85
      })
    });

    const data = await r.json();

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
