// api/chat.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, systemPrompt, hasImage } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const lastMsg = messages[messages.length - 1];
  const isVisionRequest = hasImage || 
    (Array.isArray(lastMsg?.content) && lastMsg.content.some(c => c.type === 'image_url'));

  // History
  let history = isVisionRequest 
    ? messages.slice(-5).map((m, i, arr) => {
        if (i < arr.length - 1 && Array.isArray(m.content)) {
          return { role: m.role, content: m.content.find(c => c.type === 'text')?.text || '' };
        }
        return m;
      })
    : messages.slice(-10).map(m => ({
        role: m.role || 'user',
        content: String(m.content).slice(0, 1400)
      }));

  const lastMsgText = Array.isArray(lastMsg?.content) 
    ? lastMsg.content.find(c => c.type === 'text')?.text || '' 
    : String(lastMsg?.content || '');

  const lastMsgLower = lastMsgText.toLowerCase();

  // Simple news check
  const needsNews = !isVisionRequest && (
    /news|latest|today|2026|update|war|conflict|border|cambodia|thailand|hun|preah|skibidi|sigma|rizz|7x7/i.test(lastMsgLower)
  );

  let newsBlock = '';
  if (needsNews) {
    try {
      const baseUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
      const q = lastMsgLower.includes('cambodia') || lastMsgLower.includes('thailand') 
        ? 'Cambodia Thailand border' 
        : lastMsgText.slice(0, 60);

      const r = await fetch(`${baseUrl}/api/news?q=${encodeURIComponent(q)}`);
      if (r.ok) {
        const data = await r.json();
        const articles = (data.articles || []).slice(0, 5);
        if (articles.length > 0) {
          newsBlock = `\n\nLIVE NEWS:\n` + articles.map((a, i) => 
            `[${i+1}] ${a.title} - ${a.source?.name || ''} ${a.url ? '🔗 ' + a.url : ''}`
          ).join('\n');
        }
      }
    } catch (e) {
      console.log('News error:', e.message);
    }
  }

  // TikTok Memes Knowledge (short but strong)
  const memesKnowledge = `
TIKTOK MEMES 2026:
- 7×7=49: Viral "hear me out" meme. People say it's attractive/cozy/mogger. Reply fun like "bro 7×7=49 is peak rizz fr 😂"
- Brainrot: sigma, rizz, gyatt, skibidi, ohio, mog, "hear me out", "worst thing she can say is no"
Use memes naturally when it fits, explain if user confused, stay fun and not cringe.`;

  // System Prompt
  const basePrompt = systemPrompt || `You are CC-AI, friendly AI by Chorm Chhaiya (Yaxy) from Cambodia. Today is 2026. Reply in same language as user. Talk like a real friend.`;

  const fullSystem = isVisionRequest 
    ? `You are CC-AI with vision. Describe images clearly, read text if any, answer questions about the image.` 
    : (basePrompt + memesKnowledge + newsBlock);

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Missing GROQ_API_KEY' });
  }

  // Try Groq
  const models = isVisionRequest 
    ? ['llama-4-scout-17b-16e-instruct', 'llama-4-maverick-17b-128e-instruct']
    : ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama3-70b-8192'];

  for (const model of models) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: fullSystem }, ...history],
          temperature: 0.7,
          max_tokens: 1200
        })
      });

      const data = await response.json();

      if (data.choices?.[0]?.message?.content) {
        return res.status(200).json(data);
      }
    } catch (err) {
      console.log(`Model ${model} failed:`, err.message);
    }
  }

  // Fallback
  return res.status(200).json({
    choices: [{ 
      message: { 
        role: 'assistant', 
        content: '⚠️ AI is taking too long. Please try again in a moment.' 
      } 
    }]
  });
}
