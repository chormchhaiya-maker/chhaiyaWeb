// api/chat.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, systemPrompt, hasImage } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages required' });
  }

  const lastMsg = messages[messages.length - 1];
  const isVisionRequest = hasImage || 
    (Array.isArray(lastMsg?.content) && lastMsg.content.some(c => c.type === 'image_url'));

  // Simple history
  const history = isVisionRequest 
    ? messages.slice(-3).map(m => ({ role: m.role, content: String(m.content).slice(0, 1000) }))
    : messages.slice(-5).map(m => ({ role: m.role || 'user', content: String(m.content).slice(0, 1000) }));

  // System prompt with ALL coding languages
  const basePrompt = systemPrompt || 'You are CC-AI by ChormChhaiya, G10 Tepranom HS Cambodia. 2026. Friendly, helpful coding assistant.';
  
  const codingKnowledge = `CODE FORMAT: Always wrap code in triple backticks with language tag like \`\`\`html, \`\`\`css, \`\`\`javascript, \`\`\`python, \`\`\`lua, \`\`\`react. 
HTML: semantic tags, CSS animations, flexbox/grid.
CSS: modern styling, responsive, animations @keyframes.
JavaScript: const/let, arrow functions, async/await, DOM.
Python: snake_case, list comprehensions, f-strings, type hints.
React: functional components, hooks (useState, useEffect).
Lua/Roblox: local variables, events, RemoteEvents, memory safety.
Always provide complete working examples with comments.`;
  
  const generalKnowledge = `CELEBS: MJordan, PreapSovath, BTS, Ronaldo, Messi, TaylorSwift. MEMES: Brainrot, TungTungTungSahur, 7x7=49, Ampersand, BratSummer, Skibidi, Ohio, Rizz, Sigma. CAMBODIA: JulAug2025 border clash Thailand, PreahVihear, HunManetPM.`;

  const fullSystem = isVisionRequest 
    ? 'CC-AI vision. Describe images, read text.'
    : `${basePrompt} ${generalKnowledge} ${codingKnowledge}`;

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Missing GROQ_API_KEY' });
  }

  // Working models only
  const models = isVisionRequest 
    ? ['meta-llama/llama-4-scout-17b-16e-instruct']
    : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen/qwen3-32b'];

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
          max_completion_tokens: 4000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`${model} error: ${error}`);
        continue;
      }

      const data = await response.json();
      if (data.choices?.[0]?.message?.content) {
        return res.status(200).json(data);
      }
    } catch (err) {
      console.error(`${model} failed:`, err.message);
    }
  }

  return res.status(400).json({ error: 'All models failed' });
}
