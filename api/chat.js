
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

  const needsSearch =
    /2024|2025|2026|today|latest|recent|current|news|now|war|fight|attack|election|president|happen|update/i.test(lastMsg) ||
    /cambodia.*thai|thai.*cambodia|កម្ពុជា|ថៃ|សង្គ្រាម|ព្រះវិហារ|conflict|border/i.test(lastMsg);

  let searchContext = '';

  if (needsSearch) {
    try {
      const query = messages[messages.length-1]?.content || '';

      // 🔍 SEARCH API
      const searchRes = await fetch(
        `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: typeof query === 'string' ? query.slice(0, 200) : 'world news' })
        }
      );

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.summary) {
          searchContext += '\n\n[WEB SEARCH RESULTS]: ' + searchData.summary;
        }
      }
    } catch(e) { console.log('Search failed:', e.message); }

    // 📰 NEWS API (NEW 🔥)
    try {
      const newsRes = await fetch(
        `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/news`
      );

      if (newsRes.ok) {
        const newsData = await newsRes.json();

        if (newsData.articles) {
          const formattedNews = newsData.articles
            .map((a, i) => `${i + 1}. ${a.title}`)
            .join("\n");

          searchContext += "\n\n[LATEST NEWS]:\n" + formattedNews;
        }
      }
    } catch (e) {
      console.log("News fetch failed:", e.message);
    }
  }

  const basePrompt = userSystemPrompt || `You are CC-AI, a smart honest AI assistant.

TODAY IS 2026.
Never say you don’t have real-time info.
If [WEB SEARCH RESULTS] or [LATEST NEWS] exist, ALWAYS use them.

Answer clearly and naturally.`;

  const systemPrompt = basePrompt + searchContext;

  async function tryGroq(model) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${process.env.GROQ_API_KEY}\`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        temperature: 0.7,
        max_tokens: 4096
      })
    });

    const data = await r.json();
    if (data.choices?.[0]?.message?.content) {
      return data;
    }
    throw new Error("Groq failed");
  }

  try {
    return res.status(200).json(await tryGroq('llama-3.3-70b-versatile'));
  } catch (e) {
    console.log("AI failed:", e.message);
  }

  return res.status(200).json({
    choices: [{
      message: {
        role: 'assistant',
        content: '⚠️ AI error, try again later.'
      }
    }]
  });
}
```
