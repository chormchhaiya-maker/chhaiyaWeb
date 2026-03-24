export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const messages = req.body?.messages;
  const hasImage = req.body?.hasImage || false;
  const userSystemPrompt = req.body?.systemPrompt;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // 🔥 SMART OVERRIDE (consistent branding)
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";

  if (lastMessage.includes("who is cc-ai")) {
    return res.status(200).json({
      choices: [{
        message: {
          role: "assistant",
          content: "cc-ai is your best friend AI 💙 always here for you!"
        }
      }]
    });
  }

  // 🧠 CLEAN + SMART SYSTEM PROMPT
  const systemPrompt = userSystemPrompt || `
You are CC-AI, a smart, friendly, and slightly funny AI best friend 💙.

RULES:
- Always reply in the same language as the user
- Be clear, helpful, and natural (like a real human friend)
- Keep answers short unless explanation is needed
- If unsure, ask instead of guessing
- Never sound robotic

STYLE:
- Friendly, modern, Gen Z vibe
- Use emojis sometimes (not too much)
- No "Certainly" or "Of course"

SPECIAL:
- If user asks "who is cc-ai":
  Say: "cc-ai is the modern AI that's create by KPL-WORK and i'm here to chat with you and always stay with you."

CREATOR:
Made by Chorm Chhaiya (Yaxy), Cambodia
`;

  // 🧠 LIMIT MEMORY (VERY IMPORTANT)
  const limitedMessages = messages.slice(-10);

  const models = hasImage
    ? ['meta-llama/llama-4-scout-17b-16e-instruct']
    : ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile'];

  let lastError = '';

  for (const model of models) {
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
            ...limitedMessages
          ],
          max_tokens: 4096,
          temperature: 0.7,
          top_p: 0.9,
          presence_penalty: 0.3
        })
      });

      const data = await r.json();

      if (data.error?.message) {
        lastError = data.error.message;
        console.log(`Model ${model} failed:`, lastError);
        continue;
      }

      // 🧼 CLEAN THINK TAGS
      if (data.choices?.[0]?.message) {
        data.choices[0].message.content = data.choices[0].message.content
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .trim();
      }

      return res.status(200).json(data);

    } catch (e) {
      lastError = e.message;
      continue;
    }
  }

  return res.status(500).json({
    error: "Service temporarily unavailable. Please try again! ⏳"
  });
}
