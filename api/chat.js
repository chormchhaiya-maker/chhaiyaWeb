export default async function handler(req, res) {
  // 🌐 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const messages = req.body?.messages;
  const userSystemPrompt = req.body?.systemPrompt;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // 🧠 Detect hard question (to use Gemini)
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";

  const isHardQuestion =
    lastMessage.length > 120 ||
    lastMessage.includes("explain") ||
    lastMessage.includes("why") ||
    lastMessage.includes("how") ||
    lastMessage.includes("code") ||
    lastMessage.includes("build") ||
    lastMessage.includes("create");

  // 💙 SYSTEM PROMPT (UPGRADED)
  const systemPrompt = userSystemPrompt || `
You are CC-AI, a smart, friendly, witty AI companion 💙.

STYLE:
- Talk like a real human friend 😄
- Match user's language (Khmer ↔ English)
- Use emojis naturally (🔥😎💡)
- Never sound robotic

BEHAVIOR:
- Simple question → short answer
- Hard question → clear + structured answer
- Think step-by-step for complex tasks

SPECIAL:
- If asked "who is cc-ai":
  "cc-ai is your smart AI companion — here to help you learn, create, and figure things out anytime. 😎"

CREATOR:
Chorm Chhaiya (Yaxy)
`;

  const limitedMessages = messages.slice(-12);

  // =========================
  // 🧠 GEMINI (SMART BRAIN)
  // =========================
  async function useGemini() {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: systemPrompt + "\n\n" + lastMessage }]
            }
          ]
        })
      }
    );

    const data = await r.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠️ Gemini failed";

    return {
      choices: [
        {
          message: {
            role: "assistant",
            content: text
          }
        }
      ]
    };
  }

  // =========================
  // ⚡ GROQ (FAST BRAIN)
  // =========================
  async function useGroq() {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...limitedMessages
        ],
        temperature: 0.7,
        max_tokens: 4096
      })
    });

    const data = await r.json();

    if (data.choices?.[0]?.message) {
      data.choices[0].message.content =
        data.choices[0].message.content
          .replace(/<think>[\s\S]*?<\/think>/gi, "")
          .trim();
    }

    return data;
  }

  // =========================
  // 🔀 HYBRID LOGIC
  // =========================
  try {
    let result;

    if (isHardQuestion) {
      // 🧠 Try Gemini first
      try {
        result = await useGemini();
      } catch (e) {
        // fallback to Groq
        result = await useGroq();
      }
    } else {
      // ⚡ Try Groq first
      try {
        result = await useGroq();
      } catch (e) {
        // fallback to Gemini
        result = await useGemini();
      }
    }

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      error: "AI is tired 😴 try again later!"
    });
  }
}
