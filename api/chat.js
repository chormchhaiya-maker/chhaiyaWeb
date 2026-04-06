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
    (Array.isArray(lastMsg?.content) &&
     lastMsg.content.some(c => c.type === 'image_url'));

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
            if (url.startsWith('data:')) {
              return { type: 'image_url', image_url: { url } };
            }
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

  const lastMsgText = (() => {
    if (Array.isArray(lastMsg?.content)) {
      return lastMsg.content.find(c => c.type === 'text')?.text || '';
    }
    return String(lastMsg?.content || '');
  })();
  const lastMsgLower = lastMsgText.toLowerCase();

  function extractSearchQuery(text) {
    if (/cambodia.*thai|thai.*cambodia|preah vihear|ta moan/i.test(text)) {
      return 'Cambodia Thailand border conflict';
    }
    const stopWords = /\b(what|is|are|the|a|an|do|did|does|has|have|how|why|when|where|who|tell|me|about|please|can|you|i|my|was|were|be|been|of|in|on|at|to|for|with|by|from|and|or|but|so|if|not|no)\b/g;
    const cleaned = text.replace(stopWords, ' ').replace(/\s+/g, ' ').trim();
    const words = cleaned.split(' ').filter(w => w.length > 2).slice(0, 6);
    return words.length > 0 ? words.join(' ') : text.slice(0, 80);
  }

  const needsSearch = !isVisionRequest && (
    /2024|2025|2026|today|latest|recent|current|now|this year|this week/i.test(lastMsgLower) ||
    /news|update|happen|war|fight|attack|conflict|election|president|minister|protest|crisis|border|military|army|soldier|shoot|kill|dead|peace|deal|treaty/i.test(lastMsgLower) ||
    /cambodia|thailand|preah vihear|ta moan|hun manet|hun sen/i.test(lastMsgLower) ||
    /who is|who are|tell me about|do you know|you know|singer|actor|actress|footballer|player|celebrity|famous|rapper|artist|jordan|beyonce|drake|messi|ronaldo|bts|blackpink|taylor|lebron|elon/i.test(lastMsgLower)
  );

  const isCambodiaThaiTopic =
    /cambodia|thailand|preah vihear|ta moan|border|hun manet|hun sen/i.test(lastMsgLower);

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
      return `[Article ${i + 1}]
   Title: ${a.title}
   Source: ${source}
   Date: ${date}
   URL: ${url}${desc}`;
    }).join('\n\n');

    newsBlock = `\n\n============================
LIVE NEWS ARTICLES:
============================
${formatted}
============================
Use these in your answer. Cite: **Source**, Date, 🔗 URL
============================`;
  }

  const knowledgeBase = `
============================
KNOWLEDGE BASE:
============================

[CELEBRITIES]
- Michael Jordan: greatest basketball player, Chicago Bulls, 6 NBA championships
- Preap Sovath: "King of Khmer music", most famous Cambodian male singer
- Meas Soksophea: famous Cambodian female singer
- BTS: Korean boyband (Jungkook, V, Jimin, Jin, Suga, RM, J-Hope)
- Blackpink: Korean girl group (Jennie, Lisa, Rose, Jisoo)
- Cristiano Ronaldo (CR7): Portuguese footballer, Al Nassr
- Lionel Messi: Argentine footballer, Inter Miami, 8 Ballon d'Or
- Taylor Swift: biggest pop star right now
- Drake: Canadian rapper

[TIKTOK MEMES & BRAINROT]
- "Brainrot": Being so deep into TikTok/internet culture that you feel your brain is "rotting" from consuming too much chaotic/absurdist content. Used humorously.
- "7×7=49": Woman said she finds this equation inexplicably attractive. Became "hear me out" trend about weird attractions.
- "Ampersand (&)": People find this symbol weirdly attractive for no reason.
- "Hear me out": Confessing attraction to non-human things (objects, concepts, numbers).
- "Brat summer": 2024 trend from Charli XCX album - lime green, messy, carefree.
- "Very mindful, very demure": 2024 trend about being modest and proper.
- "Roman Empire": Women asking men how often they think about Roman Empire.
- "Girl dinner": Eating random snacks as a meal.
- "Rat girl summer": Embracing chaos, staying up late, eating snacks.
- "Skibidi": From "Skibidi Toilet" series - nonsense Gen Alpha humor.
- "Ohio": Weird, unexplainable, cringe situations.
- "Rizz": Charisma/ability to attract partners.
- "Sigma": Lone wolf, independent successful personality.
- "Mewing": Jawline exercise for better looks.
- "Looksmaxxing": Improving appearance (softmaxxing = non-surgical, hardmaxxing = surgical).
- "Mogging": Dominating someone in looks.
- "Ate and left no crumbs": Did an amazing job, flawless.
- "It's giving ___": Describing the vibe/aesthetic.
- "Slay": Doing something impressively well.
- "Gatekeep": Keeping something exclusive.
- "Gaslight, gatekeep, girlboss": Playful saying.
- "Rent free": Can't stop thinking about something.
- "Caught in 4K": Caught with clear evidence.
- "Understood the assignment": Did exactly what was expected perfectly.
- "Vibe check": Assessing someone's energy/mood.
- "Main character energy": Acting like life's protagonist.
- "No thoughts, head empty": Being mindless/relaxed.
- "Feral": Acting wild/uninhibited.
- "Material girl": Someone who loves luxury.
- "Unalive": Euphemism for death (avoids algorithm).
- "Bussin'": Really good, especially food.

[CAMBODIA-THAILAND CONFLICT - 2025]
- July-August 2025: Military clashes on northwestern border near Preah Vihear and Ta Moan Thom temples.
- Both sides exchanged artillery, casualties and civilian displacement.
- Worst fighting since 2008-2011 Preah Vihear standoff.
- ASEAN called for ceasefire. Fragile ceasefire late August 2025.
- Preah Vihear temple awarded to Cambodia by ICJ in 1962, but surrounding land disputed.
- Hun Manet became Cambodia PM August 2023, succeeding Hun Sen.
============================`;

  const visionSystemPrompt = `You are CC-AI, a smart AI assistant with vision capabilities made by Chorm Chhaiya (Yaxy).

When given an image:
- Describe it clearly and in detail
- If it contains text (exam, worksheet, document, sign), READ and TRANSCRIBE all the text accurately
- If it's a test or exercise, provide the ANSWERS with explanations
- If it's a photo of a person or place, describe what you see
- If the user asks a specific question about the image, answer that question directly

Reply in the SAME language the user writes in.`;

  const textSystemPrompt = userSystemPrompt || `You are CC-AI, a smart friendly AI made by Chorm Chhaiya (Yaxy), Grade 10 student at Tepranom High School, Cambodia.

Today is 2026. You are a 2026 AI. Never say cutoff is 2023.
Reply in the SAME language the user writes in.
Talk naturally like a real friend.
NEVER say "I don't have information" — use the knowledge provided.
If you don't know a specific person or topic, say "bong min deng nas, but let me tell you what I know!" and share related info. NEVER say "AI temporarily unavailable".`;

  const systemPrompt = isVisionRequest
    ? visionSystemPrompt
    : (textSystemPrompt + knowledgeBase + newsBlock);

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing GROQ_API_KEY' });
  }

  async function tryGroq(model) {
    const maxSystemLen = 12000;
    const trimmedSystem = systemPrompt.length > maxSystemLen
      ? systemPrompt.slice(0, maxSystemLen) + '\n[...trimmed]'
      : systemPrompt;

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
    const errMsg = data.error?.message || JSON.stringify(data.error || '');
    throw new Error(`No choices from ${model}: ${errMsg}`);
  }

  const visionModels = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
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

  if (isVisionRequest) {
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
