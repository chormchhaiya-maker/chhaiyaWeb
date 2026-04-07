// api/chat.js - USE ONLY CONFIRMED WORKING MODELS
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

  // Compact system prompt
  const basePrompt = systemPrompt || 'CC-AI by ChormChhaiya, G10 Tepranom HS Cambodia. 2026. Friendly.';
  
  const knowledge = 'KNOW:MJordan,PreapSovath,BTS,Ronaldo,Messi,TaylorSwift.MEMES:Brainrot,TungTungTungSahur,7x7=49,Ampersand,BratSummer,Skibidi,Ohio,Rizz,Sigma.CODE:const/let,arrow functions,async/await,React hooks,complete examples.';
  
  const fullSystem = isVisionRequest 
    ? 'CC-AI vision.Describe images.'
    : `${basePrompt} ${knowledge}`;

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Missing GROQ_API_KEY' });
  }

  // ONLY USE CONFIRMED WORKING MODELS (from Groq docs)
  const models = isVisionRequest 
    ? ['meta-llama/llama-4-scout-17b-16e-instruct']
    : [
        'llama-3.3-70b-versatile',  // ✅ Confirmed working
        'llama-3.1-8b-instant',     // ✅ Confirmed working  
        'qwen/qwen3-32b'            // ✅ Confirmed working
      ];

  for (const model of models) {
    try {
      console.log(`Trying ${model}...`);
      
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
          max_completion_tokens: 3000
        })
      });

      console.log(`Status: ${response.status}`);

      if (!response.ok) {
        const error = await response.text();
        console.error(`Error: ${error}`);
        continue; // Try next model
      }

      const data = await response.json();
      if (data.choices?.[0]?.message?.content) {
        console.log(`Success: ${model}`);
        return res.status(200).json(data);
      }
    } catch (err) {
      console.error(`${model} failed:`, err.message);
    }
  }

  return res.status(400).json({ error: 'All models failed. Check logs.' });
}
