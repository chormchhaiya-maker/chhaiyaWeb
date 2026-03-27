// api/chat.js
export default async function handler(req, res) {
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

  const history = messages.slice(-10).map(m => ({
    role: m.role || 'user',
    content: String(m.content).slice(0, 1500)
  }));

  const lastMsg = String(messages[messages.length - 1]?.content || '');
  const lastMsgLower = lastMsg.toLowerCase();

  // ============================================================
  // SMART QUERY EXTRACTION
  // ============================================================
  function extractSearchQuery(text) {
    if (/cambodia.*thai|thai.*cambodia|ព្រះវិហារ|preah vihear|ta moan/i.test(text) ||
        /សង្គ្រាម|border.*conflict|conflict.*border/i.test(text)) {
      return 'Cambodia Thailand border conflict';
    }

    const khmerMap = {
      'សង្គ្រាម': 'war conflict', 'ព្រះវិហារ': 'Preah Vihear',
      'កម្ពុជា': 'Cambodia', 'ថៃ': 'Thailand', 'ព័ត៌មាន': 'news',
      'យោធា': 'military', 'ព្រំដែន': 'border', 'ការវាយប្រហារ': 'attack',
      'រដ្ឋាភិបាល': 'government', 'ការបោះឆ្នោត': 'election',
    };

    let translated = text;
    for (const [kh, en] of Object.entries(khmerMap)) {
      translated = translated.replace(new RegExp(kh, 'g'), en);
    }

    const stopWords = /\b(what|is|are|the|a|an|do|did|does|has|have|how|why|when|where|who|tell|me|about|please|can|you|i|my|was|were|be|been|of|in|on|at|to|for|with|by|from|and|or|but|so|if|not|no)\b/g;
    const cleaned = translated.replace(stopWords, ' ').replace(/\s+/g, ' ').trim();
    const words = cleaned.split(' ').filter(w => w.length > 2).slice(0, 6);
    return words.length > 0 ? words.join(' ') : text.slice(0, 80);
  }

  // ============================================================
  // DETECT if news search needed
  // ============================================================
  const needsSearch =
    /2024|2025|2026|today|latest|recent|current|now|this year|this week/i.test(lastMsgLower) ||
    /news|update|happen|war|fight|attack|conflict|election|president|minister|protest|crisis|border|military|army|soldier|shoot|kill|dead|peace|deal|treaty/i.test(lastMsgLower) ||
    /cambodia|thailand|khmer|phnom penh|bangkok|preah vihear|ta moan|hun manet|hun sen/i.test(lastMsgLower) ||
    /[\u1780-\u17FF]/.test(lastMsg);

  const isCambodiaThaiTopic =
    /cambodia|thailand|khmer|preah vihear|ta moan|border|hun manet|hun sen/i.test(lastMsgLower) ||
    /កម្ពុជា|ថៃ|ព្រះវិហារ|សង្គ្រាម|ព្រំដែន/.test(lastMsg);

  // ============================================================
  // FETCH LIVE NEWS
  // ============================================================
  let liveArticles = [];

  if (needsSearch) {
    const baseUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const searchQuery = extractSearchQuery(lastMsg);

    const fetchNews = async (query) => {
      try {
        const r = await fetch(`${baseUrl}/api/news?q=${encodeURIComponent(query)}`);
        if (!r.ok) return [];
        const data = await r.json();
        return data.articles || [];
      } catch (e) {
        console.log('News fetch error:', e.message);
        return [];
      }
    };

    const queries = [searchQuery];
    if (isCambodiaThaiTopic && searchQuery !== 'Cambodia Thailand border conflict') {
      queries.push('Cambodia Thailand border conflict');
    }

    const results = await Promise.all(queries.map(fetchNews));

    // Deduplicate
    const seen = new Set();
    liveArticles = results.flat().filter(a => {
      if (!a.title || seen.has(a.title)) return false;
      seen.add(a.title);
      return true;
    }).slice(0, 8);
  }

  // ============================================================
  // FORMAT LIVE ARTICLES — with source, date, URL
  // This is what the AI will directly read and quote from
  // ============================================================
  let newsBlock = '';

  if (liveArticles.length > 0) {
    const formatted = liveArticles.map((a, i) => {
      const date = a.publishedAt ? a.publishedAt.slice(0, 10) : 'unknown date';
      const source = a.source?.name || 'Unknown source';
      const url = a.url || '';
      const desc = a.description ? `\n   Summary: ${a.description.slice(0, 250)}` : '';
      return `[Article ${i + 1}]
   Title: ${a.title}
   Source: ${source}
   Date: ${date}
   URL: ${url}${desc}`;
    }).join('\n\n');

    newsBlock = `\n\n============================
LIVE NEWS ARTICLES (fetched right now):
============================
${formatted}
============================
IMPORTANT: You MUST use these articles in your answer. For each relevant article you cite, you MUST show:
- The article title or key fact
- Source name in bold (e.g. **Reuters**)
- Date (e.g. 2025-08-14)
- The full URL as a clickable link
Format example:
📰 **Reuters** | 2025-08-14
"Cambodia and Thailand exchange fire near Preah Vihear"
🔗 https://reuters.com/article/...
============================`;
  } else {
    newsBlock = `\n\n[LIVE NEWS]: No live articles fetched right now. Use the background knowledge below and clearly tell the user you are using background knowledge, not live news.`;
  }

  // ============================================================
  // CAMBODIA-THAILAND BACKGROUND KNOWLEDGE (always injected)
  // ============================================================
  const cambodiaThaiBackground = isCambodiaThaiTopic ? `
============================
CAMBODIA-THAILAND BACKGROUND KNOWLEDGE:
============================
- In July–August 2025, serious military clashes broke out between Cambodia and Thailand along their northwestern border, near the Preah Vihear and Ta Moan Thom temple areas.
- Both sides exchanged artillery and gunfire, resulting in casualties and displacement of civilians.
- The fighting was the most serious armed clash since the 2008–2011 Preah Vihear standoff.
- ASEAN called for an immediate ceasefire. A fragile ceasefire was brokered in late August 2025.
- Thailand blamed Cambodia for initiating; Cambodia denied this.
- The Preah Vihear temple was awarded to Cambodia by the ICJ in 1962, but surrounding land remains disputed.
- Hun Manet became Cambodia's PM in August 2023, succeeding Hun Sen.
============================
NOTE: If live articles above are available, prioritize them over this background knowledge for specific facts.
============================` : '';

  // ============================================================
  // SYSTEM PROMPT
  // ============================================================
  const basePrompt = userSystemPrompt || `You are CC-AI, a smart and honest AI assistant. Today's date is 2026.

LANGUAGE RULE:
- If the user writes in Khmer (ភាសាខ្មែរ), reply fully in Khmer.
- If the user writes in English, reply in English.
- If mixed, match the dominant language.

CRITICAL ANSWER RULES:
1. When LIVE NEWS ARTICLES are provided, you MUST use them. Do NOT ignore them.
2. For every news article you reference, ALWAYS show:
   - Source name in bold (e.g. **BBC**, **Reuters**)
   - Date (e.g. 2025-08-03)
   - Full URL as a link on its own line starting with 🔗
3. Present multiple articles if available — give the user a full picture.
4. NEVER say "I don't have information" or "check a news source" — you have the articles, present them.
5. After citing articles, add a short summary paragraph of what they collectively say.
6. If only background knowledge is available (no live articles), say clearly: "Based on my background knowledge (not live news):" before answering.`;

  const systemPrompt = basePrompt + cambodiaThaiBackground + newsBlock;

  // ============================================================
  // GROQ AI CALL
  // ============================================================
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing GROQ_API_KEY' });
  }

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
        temperature: 0.5,
        max_tokens: 2000
      })
    });
    const data = await r.json();
    if (data.choices?.[0]?.message?.content) return data;
    throw new Error(`No choices from ${model}`);
  }

  for (const model of ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'mixtral-8x7b-32768']) {
    try {
      return res.status(200).json(await tryGroq(model));
    } catch (e) {
      console.log(`Model ${model} failed:`, e.message);
    }
  }

  return res.status(200).json({
    choices: [{ message: { role: 'assistant', content: '⚠️ AI temporarily unavailable. Please try again.' } }]
  });
}
