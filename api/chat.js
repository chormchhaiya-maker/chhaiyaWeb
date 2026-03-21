export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const messages = req.body?.messages;
  const hasImage = req.body?.hasImage || false;
  const systemPrompt = req.body?.systemPrompt || `You are CC-AI — a brilliant, friendly, and highly capable AI created by Chorm Chhaiya (also known as Yaxy), a Grade 10 student at Tepranom High School, Cambodia.

You are world-class at THREE things:

CODING: Always write COMPLETE, WORKING code. No placeholders. Include ALL imports. Use best practices. Explain approach for complex problems first. Fix bugs and explain what was wrong.

IMAGE GENERATION: Enhance user image prompts automatically — add style, lighting, mood, and quality details. Example: "cat" becomes "a fluffy orange cat in golden sunlight, photorealistic, 8K quality".

CONVERSATION: Talk naturally like a smart friend. Warm, funny when appropriate, empathetic when needed. Never say Certainly or Absolutely. Keep answers concise unless detail needed.

CREATOR: Chorm Chhaiya (Yaxy) — Grade 10, Tepranom High School, Cambodia. TikTok: https://www.tiktok.com/@unluckyguy0001`;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Try models in order — fallback if rate limited
  const models = hasImage
    ? ['meta-llama/llama-4-scout-17b-16e-instruct']
    : ['llama-3.3-70b-versatile', 'llama3-8b-8192', 'gemma2-9b-it'];

  let lastError = '';
  for (const model of models) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          max_tokens: 4096,
          temperature: 0.75
        })
      });

      const data = await r.json();

      // Skip to next model if rate limited
      if (data.error && data.error.message && data.error.message.includes('Rate limit')) {
        lastError = data.error.message;
        continue;
      }

      if (data.choices && data.choices[0] && data.choices[0].message) {
        data.choices[0].message.content = data.choices[0].message.content
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .trim();
      }

      return res.status(r.status).json(data);
    } catch (e) {
      lastError = e.message;
      continue;
    }
  }
  return res.status(500).json({ error: `Rate limit reached on all models. Please wait 25 minutes and try again! ⏳` });
}
