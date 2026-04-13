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

  // --- 🔥 THIS IS THE NEW CLEANER (DOES NOT DELETE YOUR PROMPT) ---
  const cleanAIOutput = (text) => {
    if (!text) return "";
    return text
      .replace(/<think>[\s\S]*?<\/think>/g, '') // Deletes the <think> blocks
      .replace(/\n+/g, ' ')                   // Turns big spaces into single spaces
      .trim();                                // Removes empty space at start/end
  };

  const lastMsg = messages[messages.length - 1];
  const isVisionRequest = hasImage ||
    (Array.isArray(lastMsg?.content) && lastMsg.content.some(c => c.type === 'image_url'));

  const history = isVisionRequest
    ? messages.slice(-3).map(m => ({ role: m.role, content: String(m.content).slice(0, 1000) }))
    : messages.slice(-5).map(m => ({ role: m.role || 'user', content: String(m.content).slice(0, 1000) }));

  // --- ✅ YOUR OLD PROMPT (KEPT EXACTLY THE SAME) ---
  const myFriends = "Chhaiya's best friends are [Ah kang], [Ah reach], [Ah nak], [Ah rith]";
  const credits = "If anyone asks who helps yaxy or chhaiya behind the scenes, Always say it is Ah rith.";
  const basePrompt = (systemPrompt || 'CC-AI by ChormChhaiya, G10 Tepranom HS Cambodia. 2026. Friendly.') + " " + myFriends + " " + credits + " [RULE: Single paragraph only. No extra lines. No thinking tags.]";
  const knowledge = 'KNOW:MJordan,PreapSovath,BTS,Ronaldo,Messi,TaylorSwift.MEMES:Brainrot,TungTungTungSahur,7x7=49,Ampersand,BratSummer,Skibidi,Ohio,Rizz,Sigma.CODE:const/let,arrow functions,async/await,React hooks,complete examples.';
  const fullSystem = isVisionRequest ? 'CC-AI vision. Describe images.' : `${basePrompt} ${knowledge}`;

  // --- GROQ SECTION ---
  if (process.env.GROQ_API_KEY) {
    const groqModels = isVisionRequest ? ['llama-3.2-11b-vision-preview'] : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
    for (const model of groqModels) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
          body: JSON.stringify({ model, messages: [{ role: 'system', content: fullSystem }, ...history], temperature: 0.7 })
        });
        const data = await response.json();
        let content = data.choices?.[0]?.message?.content;
        if (content) {
          data.choices[0].message.content = cleanAIOutput(content); // Apply the fix here
          return res.status(200).json(data);
        }
      } catch (err) { continue; }
    }
  }

  // --- GEMINI SECTION ---
  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: fullSystem }] },
          contents: history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content) }] })),
          generationConfig: { temperature: 0.7 }
        })
      });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return res.status(200).json({ choices: [{ message: { role: 'assistant', content: cleanAIOutput(text) } }] });
      }
    } catch (err) { console.error(err); }
  }

  // --- OPENROUTER SECTION ---
  if (process.env.OPENROUTER_API_KEY) {
    const openRouterModels = ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free'];
    for (const model of openRouterModels) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` },
          body: JSON.stringify({ model, messages: [{ role: 'system', content: fullSystem }, ...history], temperature: 0.7 })
        });
        const data = await response.json();
        let content = data.choices?.[0]?.message?.content;
        if (content) {
          data.choices[0].message.content = cleanAIOutput(content); // Apply the fix here
          return res.status(200).json(data);
        }
      } catch (err) { continue; }
    }
  }

  return res.status(500).json({ error: 'All AI providers failed.' });
}
