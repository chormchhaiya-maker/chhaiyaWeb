export default async function handler(req, res) {
  // 🌐 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const messages = req.body?.messages;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const lastMessage = messages[messages.length - 1]?.content || "";

  // 🧠 Detect hard questions
  const isHard =
    lastMessage.length > 120 ||
    /explain|why|how|build|code|create/i.test(lastMessage);

  // 💬 LIMIT MEMORY
  const history = messages.slice(-12);

  // 💙 CHATGPT-LIKE SYSTEM PROMPT (ALREADY INCLUDED)
  const systemPrompt = `
You are CC-AI, a smart, friendly, and natural AI assistant.

STYLE:
- Talk like ChatGPT: clear, helpful, natural
- Not robotic, not overly slangy
- Friendly but not cringe
- Use emojis only when it feels right

BEHAVIOR:
- Give clear, structured answers
- Use bullet points when helpful
- Explain simply first, then deeper if needed
- Avoid unnecessary filler words

RULES:
- Match user's language
- No weird phrases like "gf"
- No nonsense outputs

GOAL:
- Feel like a high-quality AI (like ChatGPT)
`;

  // =======================
  // 🧠 GEMINI (SMART)
  // =======================
  async function useGemini() {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    systemPrompt +
                    "\n\nConversation:\n" +
                    history.map(m => `${m.role}: ${m.content}`).join("\n") +
                    "\nassistant:"
                }
              ]
            }
          ]
        })
      }
    );

    const data = await r.json();
    console.log("Gemini:", data);

    if (!r.ok) {
      throw new Error(JSON.stringify(data));
    }

    return {
      choices: [
        {
          message: {
            role: "assistant",
            content:
              data?.candidates?.[0]?.content?.parts?.[0]?.text ||
              "⚠️ Gemini empty response"
          }
        }
      ]
    };
  }

  // =======================
  // ⚡ GROQ (FAST)
  // =======================
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
          ...history
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

  // =======================
  // 🔀 HYBRID SYSTEM
  // =======================
  try {
    let result;

    if (isHard) {
      try {
        result = await useGemini();
      } catch (e) {
        console.log("Gemini failed → using Groq");
        result = await useGroq();
      }
    } else {
      try {
        result = await useGroq();
      } catch (e) {
        console.log("Groq failed → using Gemini");
        result = await useGemini();
      }
    }

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({
      error: "AI is tired 😴 try again later"
    });
  }
}
