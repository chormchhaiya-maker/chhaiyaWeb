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
    /2024|2025|2026|today|latest|recent|current|now/i.test(lastMsgLower) ||
    /news|war|fight|attack|conflict|election|president|protest|crisis|border|military/i.test(lastMsgLower) ||
    /cambodia|thailand|preah vihear|ta moan|hun manet|hun sen/i.test(lastMsgLower) ||
    /who is|tell me about|do you know|celebrity|famous|jordan|drake|messi|ronaldo|bts|taylor/i.test(lastMsgLower)
  );

  const isCambodiaThaiTopic = /cambodia|thailand|preah vihear|ta moan|hun manet/i.test(lastMsgLower);

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
        return [];
      }
    };

    const queries = [searchQuery];
    if (isCambodiaThaiTopic) queries.push('Cambodia Thailand border conflict');

    const results = await Promise.all(queries.map(fetchNews));
    const seen = new Set();
    liveArticles = results.flat().filter(a => {
      if (!a.title || seen.has(a.title)) return false;
      seen.add(a.title);
      return true;
    }).slice(0, 5);
  }

  let newsBlock = '';

  if (liveArticles.length > 0) {
    const formatted = liveArticles.map((a, i) => {
      const date = a.publishedAt ? a.publishedAt.slice(0, 10) : 'unknown';
      return `[${i + 1}] ${a.title} | ${a.source?.name || 'Unknown'} | ${date} | ${a.url}`;
    }).join('\n');
    newsBlock = `\nLIVE NEWS:\n${formatted}`;
  }

  const knowledgeBase = `KNOWLEDGE:
CELEBS: Michael Jordan (basketball GOAT), Preap Sovath (King of Khmer music), Meas Soksophea (Khmer singer), BTS (K-pop), Blackpink (Lisa is Thai), Ronaldo (CR7), Messi (8 Ballon d'Or), Taylor Swift, Drake.
TIKTOK MEMES: Brainrot=being so deep in TikTok your brain feels like it's rotting from chaotic content. Tung Tung Tung Sahur=Indonesian meme with guy hitting drum waking people for sahur (pre-dawn meal during Ramadan), went viral for catchy sound. 7x7=49=woman finds equation attractive. Ampersand (&)=symbol people find weirdly attractive. Hear me out=confessing attraction to weird things. Brat summer=Charli XCX lime green messy vibe. Very mindful demure=modest trend. Roman Empire=asking men how often they think about it. Girl dinner=random snacks as meal. Rat girl summer=embracing chaos. Skibidi=Gen Alpha nonsense humor. Ohio=weird cringe situations. Rizz=charisma. Sigma=lone wolf. Mewing=jawline exercise. Looksmaxxing=improving looks (soft=non-surgical, hard=surgical). Mogging=dominating in looks. Ate no crumbs=flawless. It's giving=describing vibe. Slay=amazing job. Gatekeep=keeping exclusive. Rent free=can't stop thinking. Caught 4K=clear evidence. Understood assignment=perfect execution. Vibe check=assessing energy. Main character energy=protagonist mindset. No thoughts head empty=mindless. Feral=wild. Material girl=luxury lover. Unalive=death euphemism. Bussin'=really good.
CAMBODIA 2025: July-August military clashes with Thailand at Preah Vihear/Ta Moan temples. Artillery exchanged, casualties, civilians displaced. Worst since 2008-2011. ASEAN ceasefire called. Hun Manet PM since Aug 2023.
CODING: Write clean, working code with comments. Always use proper indentation. Explain what the code does. For JavaScript: use const/let not var, use async/await for async code, handle errors with try-catch. For Python: use snake_case, list comprehensions when clean, f-strings for formatting. For HTML/CSS: use semantic tags, flexbox/grid for layout, responsive design. For React: use functional components, hooks (useState, useEffect), props destructuring. Always validate inputs. Never leave placeholder code.`;

  const visionSystemPrompt = `You are CC-AI, vision AI by Chorm Chhaiya (Yaxy). Describe images clearly. Read/transcribe any text. Answer questions about images. Reply in user's language.`;

  const textSystemPrompt = userSystemPrompt || `You are CC-AI, friendly AI by Chorm Chhaiya (Yaxy), Grade 10 at Tepranom High School, Cambodia. Today is 2026. Reply in user's language. Talk like a friend. Use knowledge provided. If unsure, say "I don't have info on that specifically, but..." and share what you know. Never say "AI temporarily unavailable". When writing code: provide complete working examples, add comments explaining key parts, use best practices, test your logic mentally before responding.`;

  const systemPrompt = isVisionRequest
    ? visionSystemPrompt
    : `${textSystemPrompt}\n\n${knowledgeBase}${newsBlock}`;

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing GROQ_API_KEY' });
  }

  async function tryGroq(model) {
    const maxSystemLen = 8000;
    const trimmedSystem = systemPrompt.length > maxSystemLen
      ? systemPrompt.slice(0, maxSystemLen) + '...'
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
    throw new Error(`No choices: ${data.error?.message || JSON.stringify(data.error)}`);
  }

  const visionModels = ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'];
  const textModels = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama3-70b-8192', 'llama3-8b-8192', 'gemma2-9b-it'];
  const modelsToTry = isVisionRequest ? visionModels : textModels;

  for (const model of modelsToTry) {
    try {
      const aiRes = await tryGroq(model);
      return res.status(200).json(aiRes);
    } catch (e) {
      console.log(`${model} failed:`, e.message);
    }
  }

  if (isVisionRequest) {
    for (const model of textModels) {
      try {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'Vision unavailable. Tell user to try again later.' },
              { role: 'user', content: lastMsgText || 'Image sent' }
            ],
            temperature: 0.5,
            max_tokens: 100
          })
        });
        const data = await r.json();
        if (data.choices?.[0]?.message?.content) return res.status(200).json(data);
      } catch (e) {}
    }
  }

  return res.status(200).json({
    choices: [{ message: { role: 'assistant', content: '⚠️ AI temporarily unavailable. Please try again.' } }]
  });
}
