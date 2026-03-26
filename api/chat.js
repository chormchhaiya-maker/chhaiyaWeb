// api/chat.js
export default async function handler(req, res) {
  // --- CORS headers ---
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

  // --- Keep last 10 messages and trim ---
  const history = messages.slice(-10).map(m => ({
    role: m.role || 'user',
    content: String(m.content).slice(0, 1000)
  }));

  const lastMsg = String(messages[messages.length - 1]?.content || '').toLowerCase();

  // --- Determine if search/news is needed ---
  const needsSearch =
    /2024|2025|2026|today|latest|recent|current|news|now|war|fight|attack|election|president|happen|update/i.test(lastMsg) ||
    /cambodia.*thai|thai.*cambodia|កម្ពុជា|ថៃ|សង្គ្រាម|ព្រះវិហារ|conflict|border/i.test(lastMsg);

  let searchContext = '';

  // --- Determine search query ---
  let searchQuery = needsSearch ? messages[messages.length-1]?.content || '' : '';

  // --- Fetch news with query ---
  try {
    const newsRes = await fetch(
      `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/news?q=${encodeURIComponent(searchQuery)}`
    );
    if (newsRes.ok) {
      const newsData = await newsRes.json();
      if (newsData.articles?.length) {
        const formattedNews = newsData.articles
          .map((a,i)=>`${i+1}. ${a.title}${a.description ? ' — ' + a.description : ''}`)
          .join('\n');
        searchContext += '\n\n[LATEST NEWS]:\n' + formattedNews;
      }
    }
  } catch(e) {
    console.log('News fetch failed:', e.message);
  }

  // --- Optional: add web search here if you have a search API ---
  // try { ... fetch /api/search ... append to searchContext ... } catch(e) { ... }

  // --- System prompt ---
  const basePrompt = userSystemPrompt || `You are CC-AI, a smart honest AI assistant.
TODAY IS 2026.
You have access to [LATEST NEWS] and [WEB SEARCH RESULTS].
Always include them when relevant.
If there are no results for a specific question, provide historical context, summary, or educated explanation based on known public information.
Answer clearly and naturally.`;

  const systemPrompt = basePrompt + searchContext;

  // --- Check AI API key ---
  if (!process.env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY missing!');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  // --- AI call function ---
  async function tryGroq(model) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    const data = await r.json();
    if (data.choices?.[0]?.message?.content) return data;
    throw new Error('Groq returned no choices');
  }

  // --- Try AI call ---
  try {
    const aiRes = await tryGroq('llama-3.3-70b-versatile');
    return res.status(200).json(aiRes);
  } catch (e) {
    console.log('AI call failed:', e.message);
  }

  // --- Fallback response ---
  return res.status(200).json({
    choices: [{
      message: {
        role: 'assistant',
        content: '⚠️ AI error, try again later.'
      }
    }]
  });
}
