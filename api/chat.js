// api/chat.js - Multi-API Fallback: Groq → Gemini → OpenRouter
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

  const history = isVisionRequest
    ? messages.slice(-3).map(m => ({ role: m.role, content: String(m.content).slice(0, 1000) }))
    : messages.slice(-5).map(m => ({ role: m.role || 'user', content: String(m.content).slice(0, 1000) }));

  const basePrompt = systemPrompt || 'CC-AI by ChormChhaiya, G10 Tepranom HS Cambodia. 2026. Friendly.';
  const knowledge = 'KNOW:MJordan,PreapSovath,BTS,Ronaldo,Messi,TaylorSwift.MEMES:Brainrot,TungTungTungSahur,7x7=49,Ampersand,BratSummer,Skibidi,Ohio,Rizz,Sigma.CODE:const/let,arrow functions,async/await,React hooks,complete examples.';
  const fullSystem = isVisionRequest ? 'CC-AI vision. Describe images.' : `${basePrompt} ${knowledge}`;

  // ============================================
  // 1️⃣ GROQ (Fastest — try first)
  // ============================================
  if (process.env.GROQ_API_KEY) {
    const groqModels = isVisionRequest
      ? ['meta-llama/llama-4-scout-17b-16e-instruct']
      : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen/qwen3-32b'];

    for (const model of groqModels) {
      try {
        console.log(`[Groq] Trying ${model}...`);
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

        if (!response.ok) {
          const err = await response.text();
          console.error(`[Groq] ${model} error:`, err);
          continue;
        }

        const data = await response.json();
        if (data.choices?.[0]?.message?.content) {
          console.log(`[Groq] ✅ Success: ${model}`);
          return res.status(200).json(data);
        }
      } catch (err) {
        console.error(`[Groq] ${model} failed:`, err.message);
      }
    }
    console.log('[Groq] All models failed, switching to Gemini...');
  }

  // ============================================
  // 2️⃣ GEMINI (Smart — fallback #1)
  // ============================================
  if (process.env.GEMINI_API_KEY) {
    const geminiModels = isVisionRequest
      ? ['gemini-2.0-flash']
      : ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

    for (const model of geminiModels) {
      try {
        console.log(`[Gemini] Trying ${model}...`);

        // Convert messages to Gemini format
        const geminiHistory = history.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
        }));

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: fullSystem }] },
              contents: geminiHistory,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 3000
              }
            })
          }
        );

        if (!response.ok) {
          const err = await response.text();
          console.error(`[Gemini] ${model} error:`, err);
          continue;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          console.log(`[Gemini] ✅ Success: ${model}`);
          // Return in same format as Groq/OpenAI so frontend doesn't need changes
          return res.status(200).json({
            choices: [{ message: { role: 'assistant', content: text } }]
          });
        }
      } catch (err) {
        console.error(`[Gemini] ${model} failed:`, err.message);
      }
    }
    console.log('[Gemini] All models failed, switching to OpenRouter...');
  }

  // ============================================
  // 3️⃣ OPENROUTER (50+ models — fallback #2)
  // ============================================
  if (process.env.OPENROUTER_API_KEY) {
    const openRouterModels = isVisionRequest
      ? ['meta-llama/llama-4-scout']
      : [
          'meta-llama/llama-3.3-70b-instruct:free',
          'mistralai/mistral-7b-instruct:free',
          'google/gemma-3-27b-it:free',
          'deepseek/deepseek-chat:free'
        ];

    for (const model of openRouterModels) {
      try {
        console.log(`[OpenRouter] Trying ${model}...`);
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://chhaiya-web.vercel.app',
            'X-Title': 'CC-AI'
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: fullSystem }, ...history],
            temperature: 0.7,
            max_tokens: 3000
          })
        });

        if (!response.ok) {
          const err = await response.text();
          console.error(`[OpenRouter] ${model} error:`, err);
          continue;
        }

        const data = await response.json();
        if (data.choices?.[0]?.message?.content) {
          console.log(`[OpenRouter] ✅ Success: ${model}`);
          return res.status(200).json(data);
        }
      } catch (err) {
        console.error(`[OpenRouter] ${model} failed:`, err.message);
      }
    }
    console.log('[OpenRouter] All models failed.');
  }

  // ============================================
  // ❌ All APIs failed
  // ============================================
  return res.status(500).json({ error: 'All AI providers failed. Please try again later.' });
}
