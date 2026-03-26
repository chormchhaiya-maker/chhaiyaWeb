export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const messages = req.body?.messages;
  const hasImage = req.body?.hasImage || false;
  const userSystemPrompt = req.body?.systemPrompt; // from frontend (name, lang, personality)

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const lastMessage = typeof messages[messages.length - 1]?.content === 'string'
    ? messages[messages.length - 1].content
    : '';

  // Detect hard questions that need Gemini
  const isHard = lastMessage.length > 120 ||
    /explain|why|how|build|code|create|write|song|lyrics|history|science|math|analyze/i.test(lastMessage);

  // Limit memory to last 12 messages to avoid token overflow
  const history = messages.slice(-12);

  const systemPrompt = userSystemPrompt || `You are CC-AI, a smart, friendly, and natural AI assistant created by Chorm Chhaiya (Yaxy), Grade 10 student at Tepranom High School, Cambodia 🇰🇭.

STYLE:
- Talk like a real smart friend: clear, helpful, natural
- Not robotic, not cringe
- Use emojis only when it feels right
- Match the user's language (Khmer → reply Khmer, English → reply English)

BEHAVIOR:
- Give clear structured answers
- Use bullet points when helpful
- Explain simply first, then deeper if needed
- For code: write complete beautiful working code, no placeholders
- For songs: write full lyrics with [Intro][Verse][Chorus][Bridge][Outro]
- For images: just say "On it! 🎨" — never describe images

TODAY IS 2026. You are a 2026 AI. Never say cutoff is 2023.

CREATOR: Chorm Chhaiya (Yaxy) — TikTok: https://www.tiktok.com/@unluckyguy0001`;

  // ==================
  // GEMINI (Smart/Hard)
  // ==================
  async function useGemini() {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: history.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: Array.isArray(m.content)
              ? m.content.map(c => c.type === 'text' ? { text: c.text } : { text: '' })
              : [{ text: m.content }]
          }]),
          generationConfig: { maxOutputTokens: 8192, temperature: 0.7 }
        })
      }
    );
    const data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data));
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new Error('Gemini empty response');
    return { choices: [{ message: { role: 'assistant', content: text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim() } }] };
  }

  // ==================
  // GROQ (Fast/Simple)
  // ==================
  async function useGroq(model = 'llama-3.3-70b-versatile') {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        temperature: 0.7,
        max_tokens: 8192
      })
    });
    const data = await r.json();
    if (data.error?.message) throw new Error(data.error.message);
    if (data.choices?.[0]?.message) {
      data.choices[0].message.content = data.choices[0].message.content
        .replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    }
    return data;
  }

  // ==================
  // VISION (Image)
  // ==================
  async function useVision() {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        temperature: 0.7,
        max_tokens: 4096
      })
    });
    const data = await r.json();
    if (data.error?.message) throw new Error(data.error.message);
    if (data.choices?.[0]?.message) {
      data.choices[0].message.content = data.choices[0].message.content
        .replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    }
    return data;
  }

  // ==================
  // CLOUDFLARE (Final fallback)
  // ==================
  async function useCloudflare() {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-6)], max_tokens: 2048 })
      }
    );
    if (!r.ok) throw new Error('Cloudflare failed');
    const data = await r.json();
    const reply = data?.result?.response;
    if (!reply) throw new Error('Cloudflare empty');
    return { choices: [{ message: { role: 'assistant', content: reply } }] };
  }

  // ==================
  // HYBRID ROUTING
  // ==================
  try {
    // Image: always use vision model
    if (hasImage) return res.status(200).json(await useVision());

    // Hard questions: Gemini first, Groq fallback
    if (isHard && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10) {
      try { return res.status(200).json(await useGemini()); }
      catch(e) { console.log('Gemini failed:', e.message); }
    }

    // Fast questions: Groq first
    try { return res.status(200).json(await useGroq('llama-3.3-70b-versatile')); }
    catch(e) {
      console.log('Groq 70b failed:', e.message);
      try { return res.status(200).json(await useGroq('llama-3.1-8b-instant')); }
      catch(e2) {
        console.log('Groq 8b failed:', e2.message);
        // Try Gemini as fallback for simple questions too
        if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10) {
          try { return res.status(200).json(await useGemini()); }
          catch(e3) { console.log('Gemini fallback failed:', e3.message); }
        }
      }
    }

    // Final: Cloudflare
    return res.status(200).json(await useCloudflare());

  } catch(err) {
    console.log('Final error:', err.message);
    return res.status(200).json({ choices: [{ message: { role: 'assistant', content: 'Sorry, I am having trouble right now. Please try again in a moment! ⏳' } }] });
  }
}
