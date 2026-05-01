// api/chat.js - CC-AI by ChormChhaiya | Professional Multi-Provider + Vision Fix
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, hasImage, stream: wantStream } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages required' });
  }

  // ── 1. THE KNOWLEDGE & EMOJI VIBE ───────────────────────────────────────
  const friendDetails =
    'FRIEND LIST (Use "_" for every item):\n' +
    '_ Ah Rith: The genius developer who helps Chhaiya behind the scenes with code. 💻\n' +
    '_ Ah Kang: The funny guy who always brings the laughs. 😂\n' +
    '_ Ah Reach: The generous friend who often pays for food and drinks that is why yaxy love him the most. 🥤\n' +
    '_ Ah Nak: He is always gooning in the bathroom. 🔥\n' +
    '_ Ah thi: The handsome guy, but Chhaiya is the better version. 😎[cite: 1]';

  const credits =
    'You are CC-AI, built by Chorm Chhaiya also known as (Yaxy), a 10th grader at Tepranom HS. 🏫[cite: 1] ' +
    'PERSONALITY: Chill, super friendly, and use lots of emojis! ✨👋 ' +
    'CONVERSATION RULE: If the user says "hi" or "hello", your response MUST be: "Hey my friend what\'s up how can i help you today or just chilling talking with me? 😊👋" ' +
    'ONLY talk about Chhaiya or ask "Wanna know about his friends?" if the user asks who you are. ' +
    'HIDDEN KNOWLEDGE: Only talk about Ronaldo ⚽, Messi 🐐, BTS 🎤, or Preap Sovath 🎶 if specifically asked.';

  const fullSystem = `${credits}\n\n${friendDetails} [RULE: No thinking tags. Stay friendly and use emojis.]`;

  // ── 2. HELPER FUNCTIONS ──────────────────────────────────────────────────
  const cleanAIOutput = (text) => text?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';

  const isVisionRequest = hasImage || (Array.isArray(messages[messages.length - 1]?.content) && 
    messages[messages.length - 1].content.some(c => c.type === 'image_url'));

  const history = messages.slice(-10).map(m => ({
    role: m.role || 'user',
    content: m.content
  }));

  // ── 3. STREAMING PATH (Gemini) ──────────────────────────────────────────
  if (wantStream && !isVisionRequest && process.env.GEMINI_API_KEY) {
    try {
      const geminiMessages = history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)) }],
      }));

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: fullSystem }] },
            contents: geminiMessages,
            generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
          }),
        }
      );

      if (geminiRes.ok) {
        res.setHeader('Content-Type', 'text/event-stream');
        const reader = geminiRes.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value));
        }
        res.end();
        return;
      }
    } catch (err) { console.error("Stream Failed:", err.message); }
  }

  // ── 4. VISION / NON-STREAMING PATH (Gemini) ─────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiContents = history.map((m) => {
        if (Array.isArray(m.content)) {
          const parts = m.content.map((c) => {
            if (c.type === 'image_url' && c.image_url?.url?.startsWith('data:')) {
              const [meta, b64] = c.image_url.url.split(',');
              const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
              return { inlineData: { mimeType, data: b64 } };
            }
            return { text: String(c.text || '') };
          });
          return { role: m.role === 'assistant' ? 'model' : 'user', parts };
        }
        return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content) }] };
      });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: fullSystem }] },
            contents: geminiContents,
            generationConfig: { temperature: 0.85, maxOutputTokens: 1024 },
          }),
        }
      );

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return res.status(200).json({
          choices: [{ message: { role: 'assistant', content: cleanAIOutput(text) } }],
        });
      }
    } catch (err) { console.error("Gemini Non-Stream Error:", err.message); }
  }

  // ── 5. FINAL FALLBACK (Groq) ──────────────────────────────────────────────
  if (process.env.GROQ_API_KEY) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: 'system', content: fullSystem }, ...history],
          temperature: 0.8,
        }),
      });

      const data = await response.json();
      if (data.choices?.[0]?.message) {
        data.choices[0].message.content = cleanAIOutput(data.choices[0].message.content);
        return res.status(200).json(data);
      }
    } catch (err) { console.error("Groq Error:", err.message); }
  }

  return res.status(500).json({ error: 'All AI providers failed. Check your API keys.' });
}
