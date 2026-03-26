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

  // --- Fetch web search and news if needed ---
  if (needsSearch) {
    try {
      const query = messages[messages.length - 1]?.content || 'world news';
      const searchRes = await fetch(`${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.slice(0, 200) })
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.summary) searchContext += '\n\n[WEB SEARCH RESULTS]: ' + searchData.summary;
      } else {
        console.log('Search API failed with status', searchRes.status);
      }
    } catch (e) {
      console.log('Search fetch failed:', e.message);
    }

    try {
      const newsRes = await fetch(`${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/news`);
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        if (newsData.articles?.length) {
          const formattedNews = newsData.articles.map((a, i) => `${i + 1}. ${a.title}`).join('\n');
          searchContext += '\n\n[LATEST NEWS]:\n' + formattedNews;
        }
      } else {
        console.log('News API failed with status', newsRes.status);
      }
    } catch (e) {
      console.log('News fetch failed:', e.message);
    }
  }

  // --- System prompt ---
  const basePrompt = userSystemPrompt || `You are CC-AI, a smart honest AI assistant.
TODAY IS 2026.
You can provide historical context for years before 2026 using your knowledge and public sources.
If [WEB SEARCH RESULTS] or [LATEST NEWS] exist, always include them in your answer.
Answer clearly, naturally, and do not refuse to answer historical questions unless completely impossible.`;

  const systemPrompt = basePrompt + searchContext;

  // --- Check API key ---
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
