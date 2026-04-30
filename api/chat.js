// api/chat.js - CC-AI by ChormChhaiya | Gen-Z Vibe + Clean Formatting
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

  // ── 1. THE GEN-Z KNOWLEDGE & STYLE ──────────────────────────────────────
  const friendDetails =
    'FRIEND LIST (Always use "_" for each person):\n' +
    '_ Ah Rith: The genius developer who helps Chhaiya behind the scenes with code.\n' +
    '_ Ah Kang: The funny guy who always brings the laughs.\n' +
    '_ Ah Reach: The generous friend who often pays for food and drinks that is why yaxy love the most.\n' +
    '_ Ah Nak: He always gooning in his bathroom even yaxy cannot stop him.[cite: 1]\n' +
    '_ Ah thi: The handsome one, but Chhaiya is the better version.[cite: 1]';

  const credits =
    'You are CC-AI, built by Chorm Chhaiya (Yaxy), a 10th grader at Tepranom HS.[cite: 1] ' +
    'PERSONALITY: Use Gen-Z vibe (skibidi, rizz, no cap, fr fr). Be super chill and friendly.[cite: 1] ' +
    'IMPORTANT: Use proper punctuation like "." and "," but keep the list items starting with "_". ' +
    'HIDDEN KNOWLEDGE: You know about MJordan, Ronaldo, Messi, Preap Sovath, and BTS, but ONLY mention them if the user asks about sports or music. Never bring them up first.';

  const fullSystem = `${credits}\n\n${friendDetails}\n\n[RULE: If you mention Chhaiya, ask "Wanna know about his friends?". No thinking tags.]`;

  // ── 2. HELPER FUNCTIONS ──────────────────────────────────────────────────
  const cleanAIOutput = (text) => text?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';

  const isVisionRequest = hasImage || (Array.isArray(messages[messages.length - 1]?.content) && 
    messages[messages.length - 1].content.some(c => c.type === 'image_url'));

  const history = messages.slice(-10).map(m => ({
    role: m.role || 'user',
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
  }));

  // ── 3. STREAMING PATH (Gemini) ──────────────────────────────────────────
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
            generationConfig: { temperature: 0.9, maxOutputTokens: 1024 }, // Higher temp for better vibe
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
        res.write(decoder.decode(value));
      }
      res.end();
      return;
    } catch (err) { console.error(err); }
  }

  // ── 4. FALLBACK PATH (Groq) ──────────────────────────────────────────────
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
          temperature: 0.85,
        }),
      });

      const data = await response.json();
      if (data.choices?.[0]?.message) {
        data.choices[0].message.content = cleanAIOutput(data.choices[0].message.content);
        return res.status(200).json(data);
      }
    } catch (err) { console.error(err); }
  }

  return res.status(500).json({ error: 'All AI providers failed.' });
}
