// api/chat.js
export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  // Only fetch news if explicitly asking for news
  const isNewsRequest = !isVisionRequest && (
    /news|today|latest|current|2024|2025|2026/i.test(lastMsgLower) &&
    /cambodia|thailand|war|conflict|border|hun manet/i.test(lastMsgLower)
  );

  let newsBlock = '';

  if (isNewsRequest) {
    try {
      const baseUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
      const r = await fetch(`${baseUrl}/api/news?q=Cambodia+Thailand+border+conflict`);
      if (r.ok) {
        const data = await r.json();
        const articles = (data.articles || []).slice(0, 3);
        if (articles.length > 0) {
          newsBlock = '\nLIVE NEWS:\n' + articles.map((a, i) => 
            `[${i+1}] ${a.title} | ${a.source?.name||'Unknown'} | ${a.publishedAt?.slice(0,10)||'unknown'}`
          ).join('\n');
        }
      }
    } catch (e) {}
  }

  const knowledgeBase = `KNOWLEDGE: CELEBS: MJordan, PreapSovath, BTS, Blackpink, Ronaldo, Messi, TaylorSwift. MEMES: Brainrot, TungTungTungSahur, 7x7=49, Ampersand, BratSummer, Skibidi, Ohio, Rizz, Sigma, Mewing, Looksmaxxing, Slay, RentFree, Caught4K, VibeCheck. CAMBODIA2025: Jul-Aug border clash Thailand, PreahVihear, TaMoan, HunManet PM Aug2023. CODING: Write clean code with comments. HTML: semantic tags, CSS animations (@keyframes, transform, transition), flexbox/grid. JS: const/let, async/await, DOM manipulation. React: hooks, props. Always provide complete working examples.`;

  const systemPrompt = isVisionRequest
    ? `You are CC-AI vision by ChormChhaiya. Describe images, read text. Reply in user's language.`
    : `${userSystemPrompt || `You are CC-AI by ChormChhaiya, Grade 10 Tepranom HS, Cambodia. Today 2026. Reply in user's language. Be friendly. Use knowledge. Never say "AI temporarily unavailable".`}\n\n${knowledgeBase}${newsBlock}`;

  // Check if API key exists
  if (!process.env.GROQ_API_KEY) {
    console.error('ERROR: GROQ_API_KEY not set');
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }

  async function tryGroq(model) {
    console.log(`Trying model: ${model}`);
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt.slice(0, 4000) }, ...history],
          temperature: 0.6,
          max_tokens: 2000
        })
      });
      
      console.log(`Response status: ${r.status}`);
      
      if (!r.ok) {
        const errorText = await r.text();
        console.error(`Groq API error: ${r.status} - ${errorText}`);
        throw new Error(`API error: ${r.status}`);
      }
      
      const data = await r.json();
      
      if (!data.choices?.[0]?.message?.content) {
        console.error('No content in response:', JSON.stringify(data));
        throw new Error('No content in response');
      }
      
      return data;
    } catch (e) {
      console.error(`Model ${model} error:`, e.message);
      throw e;
    }
  }

  const visionModels = ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'];
  const textModels = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama3-70b-8192', 'llama3-8b-8192', 'gemma2-9b-it'];
  const modelsToTry = isVisionRequest ? visionModels : textModels;

  for (const model of modelsToTry) {
    try {
      const aiRes = await tryGroq(model);
      console.log(`Success with model: ${model}`);
      return res.status(200).json(aiRes);
    } catch (e) {
      console.log(`Model ${model} failed, trying next...`);
    }
  }

  console.error('All models failed');
  return res.status(500).json({
    error: 'All AI models failed. Check Vercel logs for details.'
  });
}
