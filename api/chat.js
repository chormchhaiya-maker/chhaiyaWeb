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

  // ============================================================
  // VISION vs TEXT routing
  // If the message contains an image, use vision model
  // ============================================================
  const lastMsg = messages[messages.length - 1];
  const isVisionRequest = hasImage ||
    (Array.isArray(lastMsg?.content) &&
     lastMsg.content.some(c => c.type === 'image_url'));

  // ============================================================
  // HISTORY — trim and handle image content properly
  // For vision: only keep last message with image (Groq vision limit)
  // For text: keep last 10 messages
  // ============================================================
  let history;

  if (isVisionRequest) {
    // For vision requests: send only the last message to stay within limits
    // Strip images from older messages to avoid token overflow
    history = messages.slice(-5).map((m, i, arr) => {
      if (i < arr.length - 1 && Array.isArray(m.content)) {
        // Remove image from older messages, keep only text
        const textOnly = m.content.find(c => c.type === 'text')?.text || '';
        return { role: m.role, content: textOnly };
      }
      // For the last message, validate image format
      if (Array.isArray(m.content)) {
        const parts = m.content.map(c => {
          if (c.type === 'image_url') {
            // Ensure base64 image is properly formatted
            const url = c.image_url?.url || '';
            if (url.startsWith('data:')) {
              return {
                type: 'image_url',
                image_url: { url }
              };
            }
          }
          return c;
        });
        return { role: m.role, content: parts };
      }
      return { role: m.role, content: String(m.content).slice(0, 2000) };
    });
  } else {
    // Normal text chat
    history = messages.slice(-10).map(m => ({
      role: m.role || 'user',
      content: String(m.content).slice(0, 1500)
    }));
  }

  const lastMsgText = (() => {
    if (Array.isArray(lastMsg?.content)) {
      return lastMsg.content.find(c => c.type === 'text')?.text || '';
    }
    return String(lastMsg?.content || '');
  })();
  const lastMsgLower = lastMsgText.toLowerCase();

  // ============================================================
  // SMART QUERY EXTRACTION (for news search)
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
  // DETECT if news search needed (skip for image requests)
  // ============================================================
  const needsSearch = !isVisionRequest && (
    /2024|2025|2026|today|latest|recent|current|now|this year|this week/i.test(lastMsgLower) ||
    /news|update|happen|war|fight|attack|conflict|election|president|minister|protest|crisis|border|military|army|soldier|shoot|kill|dead|peace|deal|treaty/i.test(lastMsgLower) ||
    /cambodia|thailand|khmer|phnom penh|bangkok|preah vihear|ta moan|hun manet|hun sen/i.test(lastMsgLower) ||
    /who is|who are|tell me about|do you know|you know|singer|actor|actress|footballer|player|celebrity|famous|rapper|artist|chico|jordan|beyonce|drake|messi|ronaldo|bts|blackpink|taylor|lebron|elon/i.test(lastMsgLower) ||
    /[ក-៿]/.test(lastMsgText)
  );

  const isCambodiaThaiTopic =
    /cambodia|thailand|khmer|preah vihear|ta moan|border|hun manet|hun sen/i.test(lastMsgLower) ||
    /កម្ពុជា|ថៃ|ព្រះវិហារ|សង្គ្រាម|ព្រំដែន/.test(lastMsgText);

  // ============================================================
  // FETCH LIVE NEWS (only for text chat)
  // ============================================================
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

  // ============================================================
  // FORMAT LIVE ARTICLES for system prompt
  // ============================================================
  let newsBlock = '';

  if (liveArticles.length > 0) {
    const formatted = liveArticles.map((a, i) => {
      const date = a.publishedAt ? a.publishedAt.slice(0, 10) : 'unknown date';
      const source = a.source?.name || 'Unknown source';
      const url = a.url || '';
      const desc = a.description ? `\n   Summary: ${a.description.slice(0, 200)}` : '';
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
IMPORTANT: Use these articles in your answer. For each article you cite, show:
- Source in bold (e.g. **Reuters**)
- Date (e.g. 2025-08-14)
- URL as a link on its own line starting with 🔗
============================`;
  }

  // ============================================================
  // CAMBODIA-THAILAND BACKGROUND KNOWLEDGE
  // ============================================================
  // Add Khmer celebrity knowledge always
  const khmerCelebKnowledge = `
============================
FAMOUS PEOPLE KNOWLEDGE:
- Michael Jordan: greatest basketball player ever, Chicago Bulls, 6 NBA championships, Air Jordan shoes
- Chico: could refer to Chico fashion brand (Cambodia), Chico the singer, or other. Ask user to clarify if unsure.
- Preap Sovath: most famous Cambodian male singer, known as "King of Khmer music"
- Meas Soksophea: famous Cambodian female singer
- Elon Musk: CEO of Tesla and SpaceX, owns X (Twitter), richest person
- BTS: Korean boyband (Jungkook, V, Jimin, Jin, Suga, RM, J-Hope)
- Blackpink: Korean girl group (Jennie, Lisa, Rose, Jisoo) — Lisa is Thai
- Cristiano Ronaldo (CR7): Portuguese footballer, plays in Saudi Arabia (Al Nassr)
- Lionel Messi: Argentine footballer, plays for Inter Miami, 8 Ballon d'Or
- LeBron James: NBA superstar, Los Angeles Lakers
- Taylor Swift: biggest pop star in the world right now
- Drake: Canadian rapper, one of best-selling artists ever
- If you don't know a specific person → say "bong min deng nas, but let me tell you what I know!" and share related info. NEVER say "AI temporarily unavailable".
============================`;

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
============================` : '';

  // ============================================================
  // SYSTEM PROMPT
  // ============================================================
  const visionSystemPrompt = `You are CC-AI, a smart AI assistant with vision capabilities made by Chorm Chhaiya (Yaxy).

When given an image:
- Describe it clearly and in detail
- If it contains text (exam, worksheet, document, sign), READ and TRANSCRIBE all the text accurately
- If it's a test or exercise, provide the ANSWERS with explanations
- If it's a photo of a person or place, describe what you see
- If the user asks a specific question about the image, answer that question directly

Reply in the SAME language the user writes in. If they write in Khmer, reply in Khmer.`;

  const textSystemPrompt = userSystemPrompt || `You are CC-AI, a smart friendly AI made by Chorm Chhaiya (Yaxy), Grade 10 student at Tepranom High School, Cambodia.

Today is 2026. You are a 2026 AI. Never say cutoff is 2023.
Reply in the SAME language the user writes in.
Talk naturally like a real friend.
NEVER say "I don't have information" — use the news articles provided.`;

  const systemPrompt = isVisionRequest
    ? visionSystemPrompt
    : (textSystemPrompt + khmerCelebKnowledge + cambodiaThaiBackground + newsBlock);

  // ============================================================
  // GROQ API CALL
  // ============================================================
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing GROQ_API_KEY' });
  }

  async function tryGroq(model) {
    // Trim system prompt if too long (prevents token limit errors)
    const maxSystemLen = 6000;
    const trimmedSystem = systemPrompt.length > maxSystemLen
      ? systemPrompt.slice(0, maxSystemLen) + '\n[...trimmed for length]'
      : systemPrompt;

    // Also trim history messages
    const trimmedHistory = history.map(m => {
      if (typeof m.content === 'string' && m.content.length > 2000) {
        return { ...m, content: m.content.slice(0, 2000) + '...' };
      }
      return m;
    });

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: trimmedSystem }, ...trimmedHistory],
        temperature: 0.6,
        max_tokens: 1500
      })
    });
    const data = await r.json();
    if (data.choices?.[0]?.message?.content) return data;
    // Log specific error for debugging
    const errMsg = data.error?.message || JSON.stringify(data.error || '');
    throw new Error(`No choices from ${model}: ${errMsg}`);
  }

  // Vision models (support images) vs text models
  const visionModels = [
    'meta-llama/llama-4-scout-17b-16e-instruct', // Groq's best vision model
    'meta-llama/llama-4-maverick-17b-128e-instruct', // fallback vision
  ];

  const textModels = [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama3-70b-8192',
    'llama3-8b-8192',
    'gemma2-9b-it',
    'mixtral-8x7b-32768'
  ];

  const modelsToTry = isVisionRequest ? visionModels : textModels;

  for (const model of modelsToTry) {
    try {
      const aiRes = await tryGroq(model);
      console.log(`Used model: ${model}, vision: ${isVisionRequest}`);
      return res.status(200).json(aiRes);
    } catch (e) {
      console.log(`Model ${model} failed:`, e.message);
    }
  }

  // If vision models all failed, try text models with description fallback
  if (isVisionRequest) {
    console.log('Vision models failed, falling back to text with notice');
    for (const model of textModels) {
      try {
        const fallbackHistory = [{
          role: 'user',
          content: lastMsgText || 'The user sent an image but vision is temporarily unavailable.'
        }];
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'You are CC-AI. Vision is temporarily unavailable. Tell the user politely that image reading is temporarily down and to try again in a moment.' },
              ...fallbackHistory
            ],
            temperature: 0.5,
            max_tokens: 200
          })
        });
        const data = await r.json();
        if (data.choices?.[0]?.message?.content) return res.status(200).json(data);
      } catch (e) {
        console.log(`Fallback model ${model} failed:`, e.message);
      }
    }
  }

  return res.status(200).json({
    choices: [{ message: { role: 'assistant', content: '⚠️ AI temporarily unavailable. Please try again.' } }]
  });
}
