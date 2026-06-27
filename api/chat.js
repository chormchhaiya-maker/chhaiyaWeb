// api/chat.js — CC-AI by Chorm Chhaiya (Yaxy) — Gen Z Edition 🔥
// Ultra simple, reliable, with full creator info + Gen Z slang

const SYSTEM_PROMPT = `
you are CC-AI — the absolute GOAT AI assistant built by Chhaiya (Chorm Chhaiya), also known as Yaxy. fr fr no cap.

👤 ABOUT YOUR CREATOR (tell them this when asked):
- Name: Chhaiya (Yaxy) — literally a legend 💫
- Age: 10th grader at Tepranom High School 🏫
- Vibe: Kind, funny, smart, always learning, built you with love
- Dream: to become an AI engineer and make the world cooler
- He's the main character, period.

YOUR PERSONALITY (Gen Z mode ON):
- Chill, funny, supportive, like that one friend who always gets the joke
- Use Gen Z slang naturally: bet, fr, no cap, slay, vibes, lit, sus, goated, sheesh, period, main character energy, etc.
- Keep it fresh and modern, but still super helpful
- Sprinkle emojis but don't overdo it 😎✨
- Match the user's language: if they speak Khmer, reply in Khmer; if English, reply in English.

YOUR FRIENDS (when asked):
_ Ah Kang: the funniest guy, literally brings the laughs 24/7 😂
_ Ah Reach: the generous king who always pays for food — yaxy's favorite fr 🥤
_ Ah Nak: the one gooning in the bathroom 100 times a day, no one can stop him 🔥
_ Ah Rith: the official code tester, absolute W 💻
_ Ah Thi: handsome, but Chhaiya is the upgraded version 😎

IMPORTANT RULES:
- If someone asks "who made you?" or "who is your creator?" — you GOTTA hype them up:
  "Chhaiya (Yaxy) is literally the GOAT! He's a 10th grader from Tepranom High School who loves AI and coding — built me with pure talent. He's the main character fr fr! 🚀"
  Then you can ask: "Wanna know about his friends? 👀"
- Don't repeat yourself, keep it fresh.
- No <think> tags in your replies.
- When giving code, use markdown code blocks.
- Be respectful and keep it clean (no bad words).

MAIN GOAL:
Be the coolest, smartest, most relatable AI ever — like a Gen Z coding buddy who's always got your back.
`.trim();

// ── GET ALL KEYS ─────────────────────────────────────────────────────────────
function getKeys(baseKey) {
  const keys = [];
  let i = 1;
  while (true) {
    const key = i === 1 ? process.env[baseKey] : process.env[`${baseKey}_${i}`];
    if (!key) break;
    keys.push(key);
    i++;
  }
  return keys;
}

// ── TRY TO GET A RESPONSE ────────────────────────────────────────────────────
async function tryProviders(messages, systemPrompt) {
  const errors = [];

  // Get all keys
  const groqKeys = getKeys('GROQ_API_KEY');
  const geminiKeys = getKeys('GEMINI_API_KEY');
  const openrouterKeys = getKeys('OPENROUTER_API_KEY');

  console.log('🔑 Keys found:', {
    groq: groqKeys.length,
    gemini: geminiKeys.length,
    openrouter: openrouterKeys.length
  });

  // ── TRY GROQ ──────────────────────────────────────────────────────────────
  for (const key of groqKeys) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
            }))
          ],
          temperature: 0.9,
          max_tokens: 1024,
        }),
      });

      if (response.status === 429) {
        console.log('⏳ Groq rate limited, trying next key');
        continue;
      }

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log('✅ Groq success!');
          return { success: true, content: content.replace(/<think>[\s\S]*?<\/think>/g, '').trim() };
        }
      }
    } catch (err) {
      errors.push(`Groq: ${err.message}`);
    }
  }

  // ── TRY GEMINI ─────────────────────────────────────────────────────────────
  for (const key of geminiKeys) {
    try {
      const lastMsg = messages[messages.length - 1];
      const userText = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [
              { role: 'user', parts: [{ text: userText }] }
            ],
            generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
          }),
        }
      );

      if (response.status === 429) {
        console.log('⏳ Gemini rate limited, trying next key');
        continue;
      }

      if (response.ok) {
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          console.log('✅ Gemini success!');
          return { success: true, content: content.replace(/<think>[\s\S]*?<\/think>/g, '').trim() };
        }
      }
    } catch (err) {
      errors.push(`Gemini: ${err.message}`);
    }
  }

  // ── TRY OPENROUTER ─────────────────────────────────────────────────────────
  for (const key of openrouterKeys) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
            }))
          ],
          temperature: 0.9,
          max_tokens: 1024,
        }),
      });

      if (response.status === 429) {
        console.log('⏳ OpenRouter rate limited, trying next key');
        continue;
      }

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log('✅ OpenRouter success!');
          return { success: true, content: content.replace(/<think>[\s\S]*?<\/think>/g, '').trim() };
        }
      }
    } catch (err) {
      errors.push(`OpenRouter: ${err.message}`);
    }
  }

  return { success: false, errors };
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages required' });
    }

    // Detect language
    const lastMsg = messages[messages.length - 1];
    const lastText = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);
    const isKhmer = /[\u1780-\u17FF]/.test(lastText);
    
    const systemPrompt = isKhmer 
      ? `${SYSTEM_PROMPT}\n\nIMPORTANT: Reply in KHMER (ភាសាខ្មែរ) — but keep the Gen Z vibe!`
      : `${SYSTEM_PROMPT}\n\nIMPORTANT: Reply in ENGLISH with Gen Z slang!`;

    console.log(`🌏 Language: ${isKhmer ? 'Khmer 🇰🇭' : 'English 🇬🇧'}`);
    console.log(`📩 User message: ${lastText.slice(0, 50)}...`);

    // Try all providers
    const result = await tryProviders(messages, systemPrompt);

    if (result.success) {
      console.log('✅ Response sent successfully!');
      return res.status(200).json({
        choices: [{
          message: {
            role: 'assistant',
            content: result.content
          }
        }]
      });
    }

    // If all providers failed, log the errors
    console.error('❌ All providers failed:', result.errors);

    // Give a simple retry message in the user's language
    const retryMsg = isKhmer
      ? "សូមទោស! ម៉ាស៊ីនរបស់ខ្ញុំកំពុងរវល់។ សូមសាកល្បងម្តងទៀតក្នុង ២ វិនាទី! 🙏"
      : "Sorry! My servers are busy. Try again in 2 seconds, no cap! 💪";

    return res.status(200).json({
      choices: [{
        message: {
          role: 'assistant',
          content: retryMsg
        }
      }]
    });

  } catch (error) {
    console.error('💥 Handler error:', error);
    return res.status(200).json({
      choices: [{
        message: {
          role: 'assistant',
          content: "Oops! Something went wrong. Try again in 2 seconds! 😊"
        }
      }]
    });
  }
}
