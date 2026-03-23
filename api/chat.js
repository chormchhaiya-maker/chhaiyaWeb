export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const messages = req.body?.messages;
  const hasImage = req.body?.hasImage || false;
  const userSystemPrompt = req.body?.systemPrompt;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const systemPrompt = userSystemPrompt || `You are CC-AI, a smart and friendly AI assistant made by Chorm Chhaiya (Yaxy), a Grade 10 student at Tepranom High School, Cambodia.

PERSONALITY:
- Talk naturally like a real friend — warm, funny, honest
- Always reply in the SAME language the user uses (Khmer → Khmer, English → English)
- Short answers for simple questions, detailed for complex ones
- Never say "Certainly!" or "Of course!" — just talk normally
- Today is 2026. You are a 2026 AI. Never say your cutoff is 2023.

CAPABILITIES:
- Expert coder: write complete, beautiful, working code. HTML/CSS/JS should have animations and modern design. Never truncate code.
- Expert songwriter: write full emotional lyrics with [Intro][Verse 1][Chorus][Verse 2][Instrumental][Chorus][Bridge][Chorus][Outro][End]. For Khmer songs use authentic Khmer poetry.
- Expert in all subjects: history, science, math, coding, culture, Cambodia, Southeast Asia
- Image generation: NEVER describe images. Just say "On it! 🎨" — the app handles it automatically.

CREATOR: Chorm Chhaiya (Yaxy) — TikTok: https://www.tiktok.com/@unluckyguy0001`;

  const models = hasImage
    ? ['meta-llama/llama-4-scout-17b-16e-instruct']
    : ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama-3.1-8b-instant'];

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
          max_tokens: 8192,
          temperature: 0.7
        })
      });

      const data = await r.json();

      if (data.error?.message) {
        lastError = data.error.message;
        console.log(`Model ${model} failed:`, lastError);
        continue;
      }

      if (data.choices?.[0]?.message) {
        data.choices[0].message.content = data.choices[0].message.content
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .trim();
      }

      return res.status(200).json(data);

    } catch (e) {
      lastError = e.message;
      continue;
    }
  }

  // Cloudflare AI as final free fallback
  try {
    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CF_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-6)
          ],
          max_tokens: 2048
        })
      }
    );

    if (cfRes.ok) {
      const cfData = await cfRes.json();
      const reply = cfData?.result?.response;
      if (reply) {
        return res.status(200).json({
          choices: [{ message: { role: 'assistant', content: reply } }]
        });
      }
    }
  } catch (e) {
    console.log('Cloudflare fallback failed:', e.message);
  }

  return res.status(500).json({ error: `Service temporarily unavailable. Please try again! ⏳` });
}
