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
    content: String(m.content).slice(0, 1500)
  }));

  const lastMsg = String(messages[messages.length - 1]?.content || '');
  const lastMsgLower = lastMsg.toLowerCase();

  // ============================================================
  // --- SMART KEYWORD EXTRACTION for better search queries ---
  // ============================================================
  function extractSearchQuery(text) {
    const lower = text.toLowerCase();

    // Cambodia–Thailand specific topics → always use targeted query
    if (/cambodia.*thai|thai.*cambodia|កម្ពុជា.*ថៃ|ថៃ.*កម្ពុជា/i.test(text) ||
        /ព្រះវិហារ|preah vihear|ta moan|เขาพระวิหาร/i.test(text) ||
        /សង្គ្រាម|border.*conflict|conflict.*border/i.test(text)) {
      return 'Cambodia Thailand border conflict 2025';
    }

    // Khmer keywords → translate to English search terms
    const khmerMap = {
      'សង្គ្រាម': 'war conflict',
      'ព្រះវិហារ': 'Preah Vihear temple',
      'កម្ពុជា': 'Cambodia',
      'ថៃ': 'Thailand',
      'ព័ត៌មាន': 'news',
      'ប្រទេស': 'country',
      'យោធា': 'military',
      'ព្រំដែន': 'border',
      'ការវាយប្រហារ': 'attack',
      'ឯករាជ្យ': 'independence',
      'រដ្ឋាភិបាល': 'government',
      'ការបោះឆ្នោត': 'election',
    };

    let translated = text;
    for (const [kh, en] of Object.entries(khmerMap)) {
      translated = translated.replace(new RegExp(kh, 'g'), en);
    }

    // Strip filler words, keep key nouns (max 6 words)
    const stopWords = /\b(what|is|are|the|a|an|do|did|does|has|have|how|why|when|where|who|tell|me|about|please|can|you|i|my|was|were|be|been|being|of|in|on|at|to|for|with|by|from|up|as|it|its|that|this|these|those|and|or|but|so|if|than|then|not|no|yes)\b/g;
    const cleaned = translated.replace(stopWords, ' ').replace(/\s+/g, ' ').trim();
    const words = cleaned.split(' ').filter(w => w.length > 2).slice(0, 6);
    return words.length > 0 ? words.join(' ') : text.slice(0, 80);
  }

  // ============================================================
  // --- DETECT if search is needed (broader detection) ---
  // ============================================================
  const needsSearch =
    // Time-related
    /2024|2025|2026|today|latest|recent|current|now|this year|this week|this month/i.test(lastMsgLower) ||
    // News/event topics
    /news|update|happen|war|fight|attack|conflict|election|president|minister|protest|crisis|border|military|army|soldier|shoot|kill|dead|died|peace|deal|treaty|sanction/i.test(lastMsgLower) ||
    // Cambodia/Thailand specific (English)
    /cambodia|thailand|khmer|phnom penh|bangkok|preah vihear|ta moan|hun manet|hun sen/i.test(lastMsgLower) ||
    // Khmer script (any Khmer text likely needs context)
    /[\u1780-\u17FF]/.test(lastMsg);

  let searchContext = '';

  // ============================================================
  // --- FETCH NEWS (parallel: topic query + Cambodia-Thailand) ---
  // ============================================================
  const baseUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
  const searchQuery = extractSearchQuery(lastMsg);

  // Always fetch Cambodia-Thailand news as background context
  const isCambodiaThaiTopic =
    /cambodia.*thai|thai.*cambodia|ព្រះវិហារ|preah vihear|ta moan|border.*conflict|សង្គ្រាម/i.test(lastMsg) ||
    /cambodia|thailand|khmer/i.test(lastMsgLower);

  const fetchNews = async (query) => {
    try {
      const r = await fetch(`${baseUrl}/api/news?q=${encodeURIComponent(query)}`);
      if (!r.ok) return [];
      const data = await r.json();
      return data.articles || [];
    } catch (e) {
      console.log('News fetch failed for query:', query, e.message);
      return [];
    }
  };

  if (needsSearch) {
    // Run fetches in parallel for speed
    const queries = [searchQuery];
    if (isCambodiaThaiTopic && searchQuery !== 'Cambodia Thailand border conflict 2025') {
      queries.push('Cambodia Thailand border conflict 2025');
    }

    const results = await Promise.all(queries.map(fetchNews));

    // Deduplicate articles by title
    const seen = new Set();
    const allArticles = results.flat().filter(a => {
      if (!a.title || seen.has(a.title)) return false;
      seen.add(a.title);
      return true;
    });

    if (allArticles.length > 0) {
      const formatted = allArticles
        .slice(0, 8) // max 8 articles to keep prompt tight
        .map((a, i) => {
          const date = a.publishedAt ? ` [${a.publishedAt.slice(0, 10)}]` : '';
          const source = a.source?.name ? ` (${a.source.name})` : '';
          const desc = a.description ? ` — ${a.description.slice(0, 200)}` : '';
          return `${i + 1}.${date}${source} ${a.title}${desc}`;
        })
        .join('\n');

      searchContext = `\n\n[LATEST NEWS — fetched live]:\n${formatted}`;
    } else {
      // No live news found — tell AI to use its knowledge
      searchContext = `\n\n[NEWS FETCH]: No live articles found. Use your training knowledge about this topic and clearly state your knowledge may not include events after early 2025.`;
    }
  }

  // ============================================================
  // --- SYSTEM PROMPT (with Cambodia-Thailand background) ---
  // ============================================================
  const basePrompt = userSystemPrompt || `You are CC-AI, a smart and honest AI assistant. Today's date is 2026.

LANGUAGE RULE:
- If the user writes in Khmer (ភាសាខ្មែរ), always reply in Khmer.
- If the user writes in English, reply in English.
- If mixed, match the dominant language.

NEWS & CURRENT EVENTS:
- You have access to [LATEST NEWS] injected below. Always use it when answering about recent events.
- If no news is available, use your training knowledge and be transparent about your knowledge cutoff.

CAMBODIA–THAILAND BACKGROUND KNOWLEDGE (use when relevant):
- In 2025, tensions rose between Cambodia and Thailand over the Preah Vihear / Ta Moan temple border areas.
- The Preah Vihear temple dispute has a long history — the ICJ ruled in Cambodia's favor in 1962, but border demarcation remains contested.
- Hun Manet became Cambodia's Prime Minister in 2023, succeeding his father Hun Sen.
- Any armed clashes, diplomatic talks, or ceasefire agreements after early 2025 should be sourced from [LATEST NEWS] below.

ANSWER STYLE:
- Be clear, factual, and direct.
- For sensitive conflict topics, present facts neutrally without taking sides.
- Always mention your source (news article or training knowledge).`;

  const systemPrompt = basePrompt + searchContext;

  // ============================================================
  // --- GROQ AI CALL with model fallback ---
  // ============================================================
  if (!process.env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY missing!');
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
        temperature: 0.6,
        max_tokens: 2000
      })
    });
    const data = await r.json();
    if (data.choices?.[0]?.message?.content) return data;
    throw new Error(`Groq model ${model} returned no choices: ${JSON.stringify(data)}`);
  }

  // Try primary model, then fallback
  for (const model of ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'mixtral-8x7b-32768']) {
    try {
      const aiRes = await tryGroq(model);
      return res.status(200).json(aiRes);
    } catch (e) {
      console.log(`Model ${model} failed:`, e.message);
    }
  }

  // --- Final fallback ---
  return res.status(200).json({
    choices: [{
      message: {
        role: 'assistant',
        content: '⚠️ AI is temporarily unavailable. Please try again in a moment.'
      }
    }]
  });
}
