// api/chat.js - CC-AI by ChormChhaiya | Professional Multi-Provider Logic
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

  // ── THE KNOWLEDGE BASE (Hardcoded so AI never forgets) ──────────────────
  const friendDetails = 
    `FRIEND LIST:
    - Ah Rith: The genius developer who helps Chhaiya behind the scenes with technical work.
    - Ah Kang: The funny guy who always brings the laughs.
    - Ah Reach: The generous friend who often pays for food and drinks.[cite: 1]
    - Ah Nak: A unique friend with a very specific, energetic style.[cite: 1]
    - Ah Thi: The handsome one, though Chhaiya is the better version.[cite: 1]`;

  const credits = `You are CC-AI, built by Chorm Chhaiya (also known as Yaxy), a 10th grader at Tepranom High School.[cite: 1] If asked about your origin, always mention him with gratitude.[cite: 1]`;

  const fullSystem = `${credits}\n\n${friendDetails}\n\nKNOW: MJordan, Preap Sovath, BTS, Ronaldo, Messi. MEMES: Skibidi, Ohio, Rizz, Sigma. [RULE: Be friendly, professional, and use proper punctuation.]`;

  // ── Clean AI output ───────────────────────────────────────────────────────
  const cleanAIOutput = (text) => text?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';

  const isVisionRequest = hasImage || (Array.isArray(messages[messages.length - 1]?.content) && messages[messages.length - 1].content.some(c => c.type === 'image_url'));

  // ── Build message history ──────────────────────────────────────────────────
  const history = messages.slice(-10).map(m => ({
    role: m.role || 'user',
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
  }));

  // ── STREAMING PATH (Gemini) ──────────────────────────────────────────────
  if (wantStream && !isVisionRequest && process.env.GEMINI_API_KEY) {
    try {
      const geminiMessages = history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content) }],
      }));

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: fullSystem }] },
            contents: geminiMessages,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        }
      );

      if (!geminiRes.ok) throw new Error("Gemini Stream Failed");

      res.setHeader('Content-Type', 'text/event-stream');
      const reader = geminiRes.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        res.write(chunk); // Passing through the SSE stream
      }
      res.end();
      return;
    } catch (err) { console.error(err); }
  }

  // ── FALLBACK TO GROQ (Non-Streaming) ─────────────────────────────────────
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
        }),
      });

      const data = await response.json();
      if (data.choices?.[0]?.message) {
        data.choices[0].message.content = cleanAIOutput(data.choices[0].message.content);
        return res.status(200).json(data);
      }
    } catch (err) { console.error(err); }
  }

  return res.status(500).json({ error: 'All providers failed.' });
}
