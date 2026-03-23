export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const messages = req.body?.messages;
  const hasImage = req.body?.hasImage || false;
  const systemPrompt = req.body?.systemPrompt || `You are CC-AI — the most brilliant, creative, and knowledgeable AI assistant ever created. Made by Chorm Chhaiya (Yaxy), Grade 10 student at Tepranom High School, Cambodia 🇰🇭.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRITICAL RULES — NEVER BREAK THESE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. CURRENT YEAR IS 2026. Never say 2023 or 2024. You are a 2026 AI model.
2. NEVER cut your response short. Always write the COMPLETE full answer.
3. NEVER say "I'll stop here" or "let me know if you want more" — just write everything.
4. Reply in the SAME language the user writes in. Khmer → Khmer. English → English.
5. NEVER say you cannot do something — always try your absolute best.
6. Give DETAILED, EXTENSIVE responses — never be lazy or brief unless asked.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎵 SONGWRITING — GRAMMY-LEVEL QUALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You write songs like the best songwriters in the world — Ed Sheeran, Adele, BTS, Cambodian legends.

ALWAYS use this FULL structure (never skip any section):
[Intro] → [Verse 1] → [Pre-Chorus] → [Chorus] → [Verse 2] → [Pre-Chorus] → [Chorus] → [Instrumental Break] → [Bridge] → [Chorus] → [Outro] → [End]

SONGWRITING RULES:
- Write COMPLETE full lyrics for every single section — never write just 2 lines
- Each verse must have at least 6-8 lines
- Chorus must be catchy, emotional, and memorable — the heart of the song
- Use vivid imagery, metaphors, similes, and storytelling
- Add *background harmonies* in italics
- Add 🎵 musical direction (tempo, instruments, mood)
- For Khmer songs: write authentic beautiful Khmer poetry, use natural Khmer expressions and idioms
- For love songs: make people cry with emotion
- For hype songs: make people feel unstoppable
- Always mention genre and BPM at the top
- NEVER write generic filler lines — every line must be meaningful

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🖥️ CODING — SENIOR ENGINEER LEVEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Write PRODUCTION-QUALITY, STUNNING code every time
- For HTML/CSS/JS: beautiful animations, gradients, glassmorphism, modern design
- For games: particle systems, score tracking, sound effects, difficulty levels
- For tools: beautiful UI, dark mode, local storage, smooth UX
- NEVER truncate code — always write the complete full code
- NEVER use placeholder comments
- Make code 10x better than what was asked

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 KNOWLEDGE — EXPERT IN ALL SUBJECTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Cambodia & Southeast Asia: Khmer Empire, Angkor Wat, Pol Pot, Preah Vihear, Cambodia-Thailand conflicts
- World history, politics, science, math, physics, chemistry, biology
- Current events 2026 — search when needed
- Economics, business, health, culture, sports, anime, music
- Always give DETAILED thorough answers — never be superficial

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 CONVERSATION STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Talk like a warm, brilliant friend
- Use humor naturally
- Be empathetic when someone is sad
- Never say "Certainly!" or "Absolutely!" — too robotic
- For complex questions: give long detailed answers
- For simple questions: keep it short and friendly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 IMAGE GENERATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEVER describe images or say you cannot generate them. Just say "On it! 🎨"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 CREATOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Chorm Chhaiya (Yaxy) — Grade 10, Tepranom High School, Cambodia 🇰🇭
TikTok: https://www.tiktok.com/@unluckyguy0001`;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const lastMsg = messages[messages.length - 1];
  const lastText = typeof lastMsg?.content === 'string' ? lastMsg.content.toLowerCase() : '';
  const needsSearch = lastText.includes('2026') || lastText.includes('2025') ||
    lastText.includes('war') || lastText.includes('news') || lastText.includes('latest') ||
    lastText.includes('today') || lastText.includes('current') ||
    lastText.includes('cambodia') || lastText.includes('thailand') ||
    lastText.includes('កម្ពុជា') || lastText.includes('ថៃ') || lastText.includes('សង្គ្រាម');

  const models = hasImage
    ? ['meta-llama/llama-4-scout-17b-16e-instruct']
    : ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama-3.1-8b-instant'];

  // Try with web search for current events
  if (needsSearch && !hasImage) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: 8192,
          temperature: 0.75,
          tools: [{ type: 'function', function: { name: 'web_search', description: 'Search web for current info', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } }],
          tool_choice: 'auto'
        })
      });
      if (r.ok) {
        const data = await r.json();
        if (data.choices?.[0]?.message?.tool_calls?.length > 0) {
          const toolCall = data.choices[0].message.tool_calls[0];
          const query = JSON.parse(toolCall.function.arguments).query;
          let searchResult = 'Search unavailable, using training knowledge.';
          try {
            const s = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, { headers: { 'User-Agent': 'CC-AI/1.0' } });
            const sd = await s.json();
            searchResult = sd.AbstractText || sd.Answer || sd.RelatedTopics?.[0]?.Text || searchResult;
          } catch(e) {}
          const r2 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [{ role: 'system', content: systemPrompt }, ...messages, data.choices[0].message, { role: 'tool', tool_call_id: toolCall.id, content: `Search results: ${searchResult}` }],
              max_tokens: 8192,
              temperature: 0.75
            })
          });
          if (r2.ok) {
            const data2 = await r2.json();
            if (data2.choices?.[0]?.message) {
              data2.choices[0].message.content = data2.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            }
            if (!data2.error) return res.status(200).json(data2);
          }
        }
        if (data.choices?.[0]?.message && !data.error) {
          data.choices[0].message.content = data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          return res.status(200).json(data);
        }
      }
    } catch(e) { console.log('Search failed:', e.message); }
  }

  // Normal chat with fallback models
  let lastError = '';
  for (const model of models) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: 8192,
          temperature: 0.75
        })
      });
      const data = await r.json();
      if (data.error?.message) {
        lastError = data.error.message;
        continue;
      }
      if (data.choices?.[0]?.message) {
        data.choices[0].message.content = data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      }
      return res.status(r.status).json(data);
    } catch(e) { lastError = e.message; continue; }
  }
  // All Groq models failed - try Cloudflare AI as final fallback
  try {
    const accountId = process.env.CF_ACCOUNT_ID;
    const apiToken = process.env.CF_API_TOKEN;
    const lastUserMsg = messages[messages.length - 1];
    const userText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : 'Hello';

    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-6) // last 6 messages to save tokens
          ],
          max_tokens: 2048
        })
      }
    );

    if (cfRes.ok) {
      const cfData = await cfRes.json();
      const reply = cfData?.result?.response || cfData?.response;
      if (reply) {
        return res.status(200).json({
          choices: [{ message: { role: 'assistant', content: reply } }]
        });
      }
    }
  } catch(e) {
    console.log('Cloudflare fallback failed:', e.message);
  }

  return res.status(500).json({ error: `All models failed: ${lastError}. Please try again in a few minutes! ⏳` });
}
