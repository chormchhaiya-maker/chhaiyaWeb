// api/chat.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const messages = req.body?.messages;
  const userSystemPrompt = req.body?.systemPrompt;
  const hasImage = req.body?.hasImage || false;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const lastMsg = messages[messages.length - 1];
  const isVisionRequest = hasImage ||
    (Array.isArray(lastMsg?.content) && lastMsg.content.some(c => c.type === 'image_url'));

  let history;
  if (isVisionRequest) {
    history = messages.slice(-5).map((m, i, arr) => {
      if (i < arr.length - 1 && Array.isArray(m.content)) {
        const textOnly = m.content.find(c => c.type === 'text')?.text || '';
        return { role: m.role, content: textOnly };
      }
      if (Array.isArray(m.content)) {
        const parts = m.content.map(c => {
          if (c.type === 'image_url') {
            const url = c.image_url?.url || '';
            if (url.startsWith('data:')) return { type: 'image_url', image_url: { url } };
          }
          return c;
        });
        return { role: m.role, content: parts };
      }
      return { role: m.role, content: String(m.content).slice(0, 2000) };
    });
  } else {
    history = messages.slice(-10).map(m => ({
      role: m.role || 'user',
      content: String(m.content).slice(0, 1500)
    }));
  }

  const lastMsgText = Array.isArray(lastMsg?.content) 
    ? (lastMsg.content.find(c => c.type === 'text')?.text || '') 
    : String(lastMsg?.content || '');

  const lastMsgLower = lastMsgText.toLowerCase();

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

  const needsSearch = !isVisionRequest && (
    /2024|2025|2026|today|latest|recent|current|now|this year|this week/i.test(lastMsgLower) ||
    /news|update|happen|war|fight|attack|conflict|election|president|minister|protest|crisis|border|military|army|soldier|shoot|kill|dead|peace|deal|treaty/i.test(lastMsgLower) ||
    /cambodia|thailand|khmer|phnom penh|bangkok|preah vihear|ta moan|hun manet|hun sen/i.test(lastMsgLower) ||
    /who is|who are|tell me about|do you know|you know|singer|actor|actress|footballer|player|celebrity|famous|rapper|artist|chico|jordan|beyonce|drake|messi|ronaldo|bts|blackpink|taylor|lebron|elon/i.test(lastMsgLower) ||
    /[ក-៿]/.test(lastMsgText)
  );

  const isCambodiaThaiTopic = /cambodia|thailand|khmer|preah vihear|ta moan|border|hun manet|hun sen/i.test(lastMsgLower) ||
    /កម្ពុជា|ថៃ|ព្រះវិហារ|សង្គ្រាម|ព្រំដែន/.test(lastMsgText);

  let liveArticles = [];
  if (needsSearch) {
    const baseUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const searchQuery = extractSearchQuery(lastMsgText);

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
    const seen = new Set();
    liveArticles = results.flat().filter(a => {
      if (!a.title || seen.has(a.title)) return false;
      seen.add(a.title);
      return true;
    }).slice(0, 8);
  }

  let newsBlock = '';
  if (liveArticles.length > 0) {
    const formatted = liveArticles.map((a, i) => {
      const date = a.publishedAt ? a.publishedAt.slice(0, 10) : 'unknown date';
      const source = a.source?.name || 'Unknown source';
      const url = a.url || '';
      const desc = a.description ? `\n   Summary: ${a.description.slice(0, 200)}` : '';
      return `[Article ${i + 1}]\n   Title: ${a.title}\n   Source: ${source}\n   Date: ${date}\n   URL: ${url}${desc}`;
    }).join('\n\n');

    newsBlock = `\n\n============================\nLIVE NEWS ARTICLES (fetched right now):\n============================\n${formatted}\n============================\nIMPORTANT: Use these articles in your answer. For each article you cite, show:\n- Source in bold (e.g. **Reuters**)\n- Date (e.g. 2025-08-14)\n- URL as a link on its own line starting with 🔗\n============================`;
  }

  const khmerCelebKnowledge = `... (same as your original) ...`;   // keep your original khmerCelebKnowledge here

  const cambodiaThaiBackground = isCambodiaThaiTopic ? `... (same as your original) ...` : '';

  const tiktokMemesKnowledge = `
============================
TIKTOK MEMES & BRAINROT KNOWLEDGE (Updated 2026)
============================
You are very online and know all current TikTok memes. Use them naturally.

Key memes:
- 7×7=49 → Viral "hear me out" meme. People call it attractive, cozy, peak mogger. Treat it like a hot celebrity.
- Sigma, Rizz, Gyatt, Skibidi, Ohio, Mogging, etc.
- "Hear me out", "The worst thing she can say is no", Skeleton banging shield, etc.

When user talks about memes, reply hype and fun.`;

  const visionSystemPrompt = `You are CC-AI... (your original vision prompt)`;

  const textSystemPrompt = userSystemPrompt || `You are CC-AI... (your original text prompt)`;

  const systemPrompt = isVisionRequest
    ? visionSystemPrompt
    : (textSystemPrompt + tiktokMemesKnowledge + khmerCelebKnowledge + cambodiaThaiBackground + newsBlock);

  // === GROQ part (exactly same as your original) ===
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing GROQ_API_KEY' });
  }

  // ... paste the rest of your original tryGroq, models, loop, fallback, final return here ...
}
