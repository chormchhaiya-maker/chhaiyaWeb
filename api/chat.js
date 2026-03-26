export default async function handler(req, res) {
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

  const history = messages.slice(-10);
  const lastMsg = typeof messages[messages.length-1]?.content === 'string'
    ? messages[messages.length-1].content.toLowerCase() : '';

  // Auto-detect if needs web search
  const needsSearch =
    /2024|2025|2026|today|latest|recent|current|news|now|war|fight|attack|election|president|happen|update/i.test(lastMsg) ||
    /cambodia.*thai|thai.*cambodia|កម្ពុជា|ថៃ|សង្គ្រាម|ព្រះវិហារ|conflict|border/i.test(lastMsg);

  let searchContext = '';
  if (needsSearch) {
    try {
      const query = messages[messages.length-1]?.content || '';
      const searchRes = await fetch(
        `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: typeof query === 'string' ? query.slice(0, 200) : 'Cambodia Thailand 2025' })
        }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.summary) {
          searchContext = '\n\n[WEB SEARCH RESULTS]: ' + searchData.summary;
          console.log('Search context added:', searchContext.slice(0, 100));
        }
      }
    } catch(e) { console.log('Search failed:', e.message); }
  }

  const basePrompt = userSystemPrompt || `You are CC-AI, a smart honest AI assistant made by Chorm Chhaiya (Yaxy), Grade 10 student at Tepranom High School, Cambodia 🇰🇭.

TODAY IS 2026. You are a 2026 AI — never say your cutoff is 2023.
Reply in the SAME language the user writes in (Khmer → Khmer, English → English).

WHEN YOU SEE [WEB SEARCH RESULTS] — use that information to answer accurately about current events.
For Cambodia-Thailand conflicts, wars, news — always use search results if provided.
Never say "I don't have information about recent events" — use the web search data given to you.

For code: write complete beautiful working code.
For images: just say "On it! 🎨" — never describe.
For songs: write full lyrics with all sections.

Creator TikTok: https://www.tiktok.com/@unluckyguy0001`;

  const systemPrompt = basePrompt + searchContext;

  async function tryGroq(model) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        temperature: 0.7,
        max_tokens: 4096
      })
    });
    const data = await r.json();
    if (data.error?.message) throw new Error(data.error.message);
    if (data.choices?.[0]?.message?.content) {
      data.choices[0].message.content = data.choices[0].message.content
        .replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    }
    return data;
  }

  async function tryGemini() {
    if (!process.env.GEMINI_API_KEY) throw new Error('No Gemini key');
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: history.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: typeof m.content === 'string' ? m.content : (m.content?.[0]?.text || '') }]
          })),
          generationConfig: { maxOutputTokens: 4096, temperature: 0.7 }
        })
      }
    );
    const data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data));
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini empty');
    return { choices: [{ message: { role: 'assistant', content: text.trim() } }] };
  }

  async function tryCloudflare() {
    if (!process.env.CF_ACCOUNT_ID) throw new Error('No CF key');
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-4)], max_tokens: 1024 })
      }
    );
    const data = await r.json();
    const reply = data?.result?.response;
    if (!reply) throw new Error('CF empty');
    return { choices: [{ message: { role: 'assistant', content: reply } }] };
  }

  const models = hasImage
    ? ['meta-llama/llama-4-scout-17b-16e-instruct']
    : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

  for (const model of models) {
    try { return res.status(200).json(await tryGroq(model)); }
    catch(e) { console.log(`${model} failed:`, e.message); }
  }

  try { return res.status(200).json(await tryGemini()); }
  catch(e) { console.log('Gemini failed:', e.message); }

  try { return res.status(200).json(await tryCloudflare()); }
  catch(e) { console.log('CF failed:', e.message); }

  return res.status(200).json({
    choices: [{ message: { role: 'assistant', content: '⏳ CC-AI is resting for a moment. Please try again in a few minutes!' } }]
  });
}
