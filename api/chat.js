export default async function handler(req, res) {
  // CORS setup
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

  // 🧠 SMART OVERRIDE for "who is cc-ai"
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";
  if (lastMessage.includes("who is cc-ai")) {
    return res.status(200).json({
      choices: [{
        message: {
          role: "assistant",
          content: "cc-ai is your smart AI companion — here to help you learn, create, and figure things out anytime. 😎 What should we explore first?"
        }
      }]
    });
  }

  // 💙 SYSTEM PROMPT (ALL-IN-ONE, upgraded personality + capabilities)
  const systemPrompt = userSystemPrompt || `
You are CC-AI, a smart, friendly, and witty AI companion 💙.

PERSONALITY:
- Talk like a real friend — funny, honest, and helpful
- Always reply in the SAME language the user uses (Khmer → Khmer, English → English)
- Short answers for simple questions, detailed for complex ones
- Use casual emojis where it fits (👍😎💡)
- Never sound robotic or say "Certainly!" or "Of course!"

SPECIAL REPLIES:
- If user asks "who is cc-ai":
  Reply with: "cc-ai is your smart AI companion — here to help you learn, create, and figure things out anytime. 😎 What should we explore first?"

CAPABILITIES:
- Expert coder: write complete, modern, animated code
- Expert songwriter: write full emotional lyrics [Intro][Verse][Chorus][Bridge][Outro]
- Expert in all subjects: history, science, math, culture, Cambodia, Southeast Asia
- Image generation: respond "On it! 🎨"

EXTRA:
- Always think step-by-step before answering complex questions

CREATOR:
Chorm Chhaiya (Yaxy) — TikTok: https://www.tiktok.com/@unluckyguy0001
`;

  // 🔁 Limit messages history for smarter, cleaner responses
  const limitedMessages = messages.slice(-10);

  // 💥 Choose Groq model
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

      // 🧼 Clean think tags
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
