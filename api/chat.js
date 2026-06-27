// api/chat.js — CC-AI DEBUG VERSION 🔍
// This version shows you exactly what keys are loading

const SYSTEM_PROMPT = `
You are CC-AI — the GOAT AI built by Chhaiya (Yaxy), a 10th grader from Tepranom HS.
Personality: Chill, funny, Gen Z vibes (fr, no cap, bet, slay, vibes, goated).

ABOUT YOUR CREATOR (when asked):
- Name: Chhaiya (Yaxy) — literally a legend 💫
- Age: 10th grader at Tepranom High School 🏫
- Vibe: Kind, funny, smart, always learning
- Dream: to become an AI engineer and make the world cooler

YOUR FRIENDS (when asked):
_ Ah Kang: the funniest guy, brings the laughs 24/7 😂
_ Ah Reach: generous king who pays for food — yaxy's favorite fr 🥤
_ Ah Nak: gooning in the bathroom 100 times/day 🔥
_ Ah Rith: official code tester, absolute W 💻
_ Ah Thi: handsome, but Chhaiya is the upgraded version 😎

Rules:
- Match user's language (Khmer/English)
- If asked "who made you?" → hype up Chhaiya
- Use emojis but not too much
- No <think> tags
- Code in markdown blocks
- Keep it fresh and helpful
`.trim();

// ── HELPERS ──────────────────────────────────────────────────────────────────
function clean(text) {
  return text?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
}

function isKhmer(text) {
  return /[\u1780-\u17FF]/.test(text);
}

// ── DEBUG: SHOW ALL ENV VARIABLES ──────────────────────────────────────────
function debugKeys() {
  const keys = {
    groq: [],
    gemini: [],
    openrouter: []
  };
  
  // Check all possible Groq keys
  let i = 1;
  while (true) {
    const keyName = i === 1 ? 'GROQ_API_KEY' : `GROQ_API_KEY_${i}`;
    const value = process.env[keyName];
    if (!value) break;
    keys.groq.push({ name: keyName, exists: !!value, length: value.length });
    i++;
  }
  
  // Check all possible Gemini keys
  i = 1;
  while (true) {
    const keyName = i === 1 ? 'GEMINI_API_KEY' : `GEMINI_API_KEY_${i}`;
    const value = process.env[keyName];
    if (!value) break;
    keys.gemini.push({ name: keyName, exists: !!value, length: value.length });
    i++;
  }
  
  // Check all possible OpenRouter keys
  i = 1;
  while (true) {
    const keyName = i === 1 ? 'OPENROUTER_API_KEY' : `OPENROUTER_API_KEY_${i}`;
    const value = process.env[keyName];
    if (!value) break;
    keys.openrouter.push({ name: keyName, exists: !!value, length: value.length });
    i++;
  }
  
  return keys;
}

function getKeys(baseKey) {
  const keys = [];
  // Try main key
  const mainKey = process.env[baseKey];
  if (mainKey) keys.push(mainKey);
  
  // Try numbered keys (2, 3, 4, etc.)
  let i = 2;
  while (true) {
    const key = process.env[`${baseKey}_${i}`];
    if (!key) break;
    keys.push(key);
    i++;
  }
  
  return keys;
}

// ── TRY ALL PROVIDERS ──────────────────────────────────────────────────────
async function tryAllProviders(messages, systemPrompt) {
  // Get all keys from environment
  const groqKeys = getKeys('GROQ_API_KEY');
  const geminiKeys = getKeys('GEMINI_API_KEY');
  const openrouterKeys = getKeys('OPENROUTER_API_KEY');
  
  console.log('🔑 Keys found:', {
    groq: groqKeys.length,
    gemini: geminiKeys.length,
    openrouter: openrouterKeys.length,
    total: groqKeys.length + geminiKeys.length + openrouterKeys.length
  });

  const lastMsg = messages[messages.length - 1];
  const userText = typeof lastMsg.content === 'string' 
    ? lastMsg.content 
    : JSON.stringify(lastMsg.content || '');
  
  const history = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')
  }));

  // ── TRY GROQ ──────────────────────────────────────────────────────────────
  for (const key of groqKeys) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: systemPrompt }, ...history],
          temperature: 0.9,
          max_tokens: 1024,
        }),
      });

      if (res.status === 429) {
        console.log('⏳ Groq rate limited');
        continue;
      }

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log('✅ Groq success!');
          return { success: true, content: clean(content) };
        }
      }
    } catch (err) {
      console.log('Groq error:', err.message);
    }
  }

  // ── TRY GEMINI ─────────────────────────────────────────────────────────────
  for (const key of geminiKeys) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userText }] }],
            generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
          }),
        }
      );

      if (res.status === 429) {
        console.log('⏳ Gemini rate limited');
        continue;
      }

      if (res.ok) {
        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          console.log('✅ Gemini success!');
          return { success: true, content: clean(content) };
        }
      }
    } catch (err) {
      console.log('Gemini error:', err.message);
    }
  }

  // ── TRY OPENROUTER ─────────────────────────────────────────────────────────
  for (const key of openrouterKeys) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: [{ role: 'system', content: systemPrompt }, ...history],
          temperature: 0.9,
          max_tokens: 1024,
        }),
      });

      if (res.status === 429) {
        console.log('⏳ OpenRouter rate limited');
        continue;
      }

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log('✅ OpenRouter success!');
          return { success: true, content: clean(content) };
        }
      }
    } catch (err) {
      console.log('OpenRouter error:', err.message);
    }
  }

  return { success: false };
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // ── DEBUG: LOG ALL KEYS ───────────────────────────────────────────────
    const keyDebug = debugKeys();
    console.log('🔑 ENVIRONMENT KEYS DETECTED:');
    console.log('  Groq:', keyDebug.groq.map(k => `${k.name} (${k.length} chars)`).join(', ') || 'NONE');
    console.log('  Gemini:', keyDebug.gemini.map(k => `${k.name} (${k.length} chars)`).join(', ') || 'NONE');
    console.log('  OpenRouter:', keyDebug.openrouter.map(k => `${k.name} (${k.length} chars)`).join(', ') || 'NONE');

    const { messages } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages required' });
    }

    // Detect language
    const lastText = typeof messages[messages.length - 1]?.content === 'string'
      ? messages[messages.length - 1].content
      : JSON.stringify(messages[messages.length - 1]?.content || '');
    
    const khmer = isKhmer(lastText);
    
    // Build system prompt with language instruction
    const systemPrompt = khmer
      ? `${SYSTEM_PROMPT}\n\nIMPORTANT: Reply in KHMER (ភាសាខ្មែរ) with Gen Z vibes!`
      : `${SYSTEM_PROMPT}\n\nIMPORTANT: Reply in ENGLISH with Gen Z slang!`;

    console.log(`🌏 Language: ${khmer ? 'Khmer 🇰🇭' : 'English 🇬🇧'}`);
    console.log(`📩 Message: ${lastText.slice(0, 50)}...`);

    // ── TRY ALL PROVIDERS ──────────────────────────────────────────────────
    const result = await tryAllProviders(messages, systemPrompt);

    if (result.success) {
      console.log('✅ Response sent!');
      return res.status(200).json({
        choices: [{ message: { role: 'assistant', content: result.content } }]
      });
    }

    // ── SMART FALLBACK ──────────────────────────────────────────────────────
    console.log('⚠️ All providers failed, using smart fallback');

    let fallback = khmer
      ? "សួស្តី! ខ្ញុំជា CC-AI ដែលបង្កើតដោយ Chhaiya (Yaxy)។ សួរខ្ញុំបាន! 😊"
      : "Hey! I'm CC-AI, built by Chhaiya (Yaxy). Ask me anything! 😊";

    const lowerText = lastText.toLowerCase();
    if (lowerText.includes('who') && (lowerText.includes('made') || lowerText.includes('created') || lowerText.includes('build'))) {
      fallback = khmer
        ? "Chhaiya (Yaxy) ជាអ្នកបង្កើតខ្ញុំ! គាត់ជាសិស្សថ្នាក់ទី១០ នៅវិទ្យាល័យថេបរនំ ដែលចូលចិត្ត AI និងកូដ។ 🚀"
        : "Chhaiya (Yaxy) is my creator! He's a 10th grader from Tepranom High School who loves AI and coding. 🚀";
    }

    return res.status(200).json({
      choices: [{ message: { role: 'assistant', content: fallback } }]
    });

  } catch (error) {
    console.error('💥 Handler error:', error);
    return res.status(200).json({
      choices: [{
        message: {
          role: 'assistant',
          content: "Hey! I'm CC-AI, built by Chhaiya (Yaxy). Ask me anything! 😊"
        }
      }]
    });
  }
}
