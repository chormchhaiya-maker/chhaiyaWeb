// api/chat.js
export default async function handler(req, res) {
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
        const articles = (data.articles || []).slice(0, 2);
        if (articles.length > 0) {
          newsBlock = '\nNEWS:' + articles.map((a, i) => 
            `[${i+1}]${a.title}|${a.source?.name||'?'}`
          ).join('');
        }
      }
    } catch (e) {}
  }

  // ULTRA COMPACT system prompt - under 500 chars
  const systemPrompt = isVisionRequest
    ? 'CC-AI vision by ChormChhaiya. Describe images, read text.'
    : `${userSystemPrompt || 'CC-AI by ChormChhaiya, G10 Tepranom HS, Cambodia. 2026. Friendly, helpful. Never say unavailable.'} KNOW:MJordan,PreapSovath,BTS,Ronaldo,Messi,TaylorSwift.Brainrot,TungTungTungSahur,7x7=49,Ampersand,BratSummer,Skibidi,Ohio,Rizz,Sigma,Mewing,Looksmaxxing,Slay.CAMBODIA:JulAug2025 border clash Thailand,PreahVihear,HunManetPM.CODE:clean,comments,HTML/CSS/JS,React,hooks,complete examples.${newsBlock}`;

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }

  async function tryGroq(model) {
    try {
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
          max_completion_tokens: 4000,  // CHANGED from max_tokens
          top_p: 0.9
        })
      });
      
      if (!r.ok) {
        const error = await r.text();
        console.error(`${model} HTTP ${r.status}: ${error}`);
        throw new Error(`HTTP ${r.status}`);
      }
      
      const data = await r.json();
      
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Empty response');
      }
      
      return data;
    } catch (e) {
      console.log(`${model} failed: ${e.message}`);
      return null;
    }
  }

  if (isVisionRequest) {
    const visionModels = [
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'meta-llama/llama-4-maverick-17b-128e-instruct'
    ];
    
    for (const model of visionModels) {
      const result = await tryGroq(model);
      if (result) return res.status(200).json(result);
    }
  }

  const textModels = [
    'llama-3.3-70b-versatile',  // 131K context, 32K output
    'llama-3.1-70b-versatile',
    'llama3-70b-8192'
  ];

  for (const model of textModels) {
    const result = await tryGroq(model);
    if (result) {
      console.log(`Success: ${model}`);
      return res.status(200).json(result);
    }
  }

  return res.status(503).json({
    error: 'All AI models busy. Try again.'
  });
}
