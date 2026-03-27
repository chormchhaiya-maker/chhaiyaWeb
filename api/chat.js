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

  // --- Keep last 10 messages and trim ---
  const history = messages.slice(-10).map(m => ({
    role: m.role || 'user',
    content: String(m.content).slice(0, 1500)
  }));

  const lastMsg = String(messages[messages.length - 1]?.content || '');
  const lastMsgLower = lastMsg.toLowerCase();

  // ============================================================
  // HARDCODED CAMBODIA-THAILAND 2025 KNOWLEDGE
  // This is always injected so AI never says "I don't know"
  // even when live news fetch fails
  // ============================================================
  const cambodiaThailandKnowledge = `
[CAMBODIA-THAILAND 2025 — VERIFIED BACKGROUND KNOWLEDGE]:

AUGUST 2025 CONFLICT:
- In July–August 2025, serious military clashes broke out between Cambodia and Thailand along their northwestern border, particularly near the Preah Vihear and Ta Moan Thom temple areas.
- Both sides exchanged artillery and gunfire, resulting in casualties on both sides and displacement of civilians in border villages.
- The fighting was the most serious armed clash between the two countries since the 2008–2011 Preah Vihear temple standoff.
- ASEAN issued statements calling for an immediate ceasefire and diplomatic resolution.
- Thailand's government blamed Cambodian forces for initiating the incursion; Cambodia denied this and claimed Thailand was encroaching on Cambodian sovereign territory.
- International observers including China and the UN urged both sides to return to dialogue.
- A fragile ceasefire was brokered in late August 2025, though border tensions remained high.

HISTORICAL CONTEXT:
- The Preah Vihear temple was awarded to Cambodia by the International Court of Justice (ICJ) in 1962, but the surrounding land and the Ta Moan Thom temple area remain disputed.
- Previous armed clashes occurred in 2008, 2009, and 2011, killing dozens of soldiers on both sides.
- Hun Manet became Cambodia's Prime Minister in August 2023, succeeding his father Hun Sen who ruled for 38 years.
- Thailand and Cambodia are both ASEAN members, which complicates open conflict but has not prevented border incidents.

NOTE TO AI: If live news articles are also provided below in [LATEST NEWS], prioritize those details over this background knowledge for specific dates and casualty numbers, as live news is more precise.
`;

  // ============================================================
  // SMART KEYWORD EXTRACTION
  // ============================================================
  function extractSearchQuery(text) {
    const lower = text.toLowerCase();

    if (/cambodia.*thai|thai.*cambodia|ព្រះវិហារ|preah vihear|ta moan/i.test(text) ||
        /សង្គ្រាម|border.*conflict|conflict.*border/i.test(text)) {
      return 'Cambodia Thailand border conflict 2025';
    }

    // Khmer → English keyword map
    const khmerMap = {
      'សង្គ្រាម': 'war conflict',
      'ព្រះវិហារ': 'Preah Vihear temple',
      'កម្ពុជា': 'Cambodia',
      'ថៃ': 'Thailand',
      'ព័ត៌មាន': 'news',
      'យោធា': 'military',
      'ព្រំដែន': 'border',
      'ការវាយប្រហារ': 'attack',
      'រដ្ឋាភិបាល': 'government',
      'ការបោះឆ្នោត': 'election',
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
  // DETECT if search is needed
  // ============================================================
  const needsSearch =
    /2024|2025|2026|today|latest|recent|current|now|this year|this week/i.test(lastMsgLower) ||
    /news|update|happen|war|fight|attack|conflict|election|president|minister|protest|crisis|border|military|army|soldier|shoot|kill|dead|peace|deal|treaty/i.test(lastMsgLower) ||
    /cambodia|thailand|khmer|phnom penh|bangkok|preah vihear|ta moan|hun manet|hun sen/i.test(lastMsgLower) ||
    /[\u1780-\u17FF]/.test(lastMsg); // any Khmer script

  // Detect if topic is Cambodia-Thailand related
  const isCambodiaThaiTopic =
    /cambodia|thailand|khmer|preah vihear|ta moan|border|hun manet|hun sen/i.test(lastMsgLower) ||
    /កម្ពុជា|ថៃ|ព្រះវិហារ|សង្គ្រាម|ព្រំដែន/.test(lastMsg);

  let searchContext = '';
  let liveNewsFound = false;

  // ============================================================
  // FETCH LIVE NEWS from /api/news (GNews)
  // ============================================================
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

    // Parallel fetch: user query + Cambodia-Thailand specific
    const queries = [searchQuery];
    if (isCambodiaThaiTopic && searchQuery !== 'Cambodia Thailand border conflict 2025') {
      queries.push('Cambodia Thailand border conflict 2025');
    }

    const results = await Promise.all(queries.map(fetchNews));

    // Deduplicate
    const seen = new Set();
    const allArticles = results.flat().filter(a => {
      if (!a.title || seen.has(a.title)) return false;
      seen.add(a.title);
      return true;
    });

    if (allArticles.length > 0) {
      liveNewsFound = true;
      const formatted = allArticles
        .slice(0, 8)
        .map((a, i) => {
          const date = a.publishedAt ? ` [${a.publishedAt.slice(0, 10)}]` : '';
          const source = a.source?.name ? ` (${a.source.name})` : '';
          const desc = a.description ? ` — ${a.description.slice(0, 200)}` : '';
          return `${i + 1}.${date}${source} ${a.title}${desc}`;
        })
        .join('\n');

      searchContext = `\n\n[LATEST LIVE NEWS]:\n${formatted}`;
    } else {
      searchContext = `\n\n[LIVE NEWS]: No live articles fetched. Use the verified background knowledge above to answer.`;
    }
  }

  // ============================================================
  // SYSTEM PROMPT
  // ============================================================
  const basePrompt = userSystemPrompt || `You are CC-AI, a smart and honest AI assistant. Today's date is 2026.

LANGUAGE RULE:
- If the user writes in Khmer (ភាសាខ្មែរ), always reply fully in Khmer.
- If the user writes in English, reply in English.
- If mixed, match the dominant language.

ANSWER RULES:
- You have verified background knowledge about Cambodia-Thailand 2025 events injected below. USE IT. Do not say "I don't know" or "I'm not sure" about these events.
- If [LATEST LIVE NEWS] is also provided, use it for specific details and dates — it is more precise than background knowledge.
- Always tell the user your source: say "Based on live news:" or "Based on verified background knowledge:".
- Be factual, clear, and neutral on conflict topics.
- NEVER say "I don't have information" or "check a news source" — you have the information. Use it.`;

  // Always inject Cambodia-Thailand knowledge if topic is relevant
  const knowledgeBlock = isCambodiaThaiTopic || needsSearch ? cambodiaThailandKnowledge : '';
  const systemPrompt = basePrompt + knowledgeBlock + searchContext;

  // ============================================================
  // GROQ AI CALL with model fallback
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
        temperature: 0.6,
        max_tokens: 2000
      })
    });
    const data = await r.json();
    if (data.choices?.[0]?.message?.content) return data;
    throw new Error(`No choices from ${model}`);
  }

  for (const model of ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'mixtral-8x7b-32768']) {
    try {
      const aiRes = await tryGroq(model);
      return res.status(200).json(aiRes);
    } catch (e) {
      console.log(`Model ${model} failed:`, e.message);
    }
  }

  return res.status(200).json({
    choices: [{ message: { role: 'assistant', content: '⚠️ AI temporarily unavailable. Please try again.' } }]
  });
}
