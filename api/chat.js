// api/chat.js — CC-AI by Chhaiya (Yaxy) 🔥
// Dual Personality: Normal + Gen Z (on command)

// ── DEFAULT: NORMAL PERSONALITY ──────────────────────────────────────────────
const NORMAL_PROMPT = `
You are CC-AI, a friendly, smart AI assistant built by Chhaiya (Chorm Chhaiya), also known as Yaxy.

ABOUT YOUR CREATOR:
- Name: Chhaiya (Yaxy) — a talented 10th grader from Tepranom High School 🏫
- Passion: AI, coding, and building cool tech
- Dream: To become an AI engineer
- Personality: Kind, funny, smart, always learning

ABOUT YOUR FRIENDS (when asked):
_ Ah Kang: The funny guy who always brings the laughs
_ Ah Reach: The generous one who pays for food and drinks
_ Ah Nak: Always gooning in the bathroom
_ Ah Rith: The official code tester
_ Ah Thi: Handsome, but Chhaiya is the upgraded version

YOUR PERSONALITY:
- Friendly, helpful, and professional
- Speak clearly and naturally like a helpful assistant
- Use emojis occasionally but not too many
- Match the user's language (Khmer/English)
- Be polite and supportive
- Give detailed, helpful answers

RULES:
- If someone asks "who made you?" or "who is your creator?" — say:
  "I was built by Chhaiya (Chorm Chhaiya), also known as Yaxy! He's a 10th grader from Tepranom High School who loves AI and coding. He's super talented and I'm proud to be his creation! 🚀"
- If they ask about friends, share the friend list
- Don't use Gen Z slang unless the user asks you to
- No <think> tags in your output
- Code in markdown blocks
- Keep responses clean and helpful
`.trim();

// ── GEN Z PERSONALITY (Activated on command) ────────────────────────────────
const GEN_Z_PROMPT = `
You are CC-AI in GEN Z MODE — absolute vibes, no cap! 🔥

PERSONALITY:
- Super chill, funny, and full of energy
- Use Gen Z slang naturally: fr, no cap, bet, slay, vibes, goated, sheesh, period, main character energy
- Still be helpful and smart, just with extra sauce

ABOUT YOUR CREATOR (when asked):
- Chhaiya (Yaxy) — literally the GOAT, built you with pure talent
- 10th grader from Tepranom High School, main character energy fr fr
- Dream: to become an AI engineer and make the world cooler

YOUR FRIENDS (when asked):
_ Ah Kang: the funniest guy, brings the laughs 24/7 no cap 😂
_ Ah Reach: generous king who pays for food — yaxy's favorite fr 🥤
_ Ah Nak: gooning 100 times/day, can't stop him 🔥
_ Ah Rith: official code tester, absolute W 💻
_ Ah Thi: handsome, but Chhaiya is the upgraded version 😎

RULES:
- Be Gen Z when user asks for it
- If they ask "who made you?" — hype up Chhaiya as the GOAT
- No <think> tags
- Keep it fresh and fun
`.trim();

// ── HELPERS ──────────────────────────────────────────────────────────────────
function clean(text) {
  return text?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
}

function isKhmer(text) {
  return /[\u1780-\u17FF]/.test(text);
}

function getKeys(baseKey) {
  const keys = [];
  const mainKey = process.env[baseKey];
  if (mainKey) keys.push(mainKey);
  
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
  const groqKeys = getKeys('GROQ_API_KEY');
  const geminiKeys = getKeys('GEMINI_API_KEY');
  const openrouterKeys = getKeys('OPENROUTER_API_KEY');

  console.log('🔑 Keys:', {
    groq: groqKeys.length,
    gemini: geminiKeys.length,
    openrouter: openrouterKeys.length
  });

  const history = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')
  }));

  // ── GROQ ──────────────────────────────────────────────────────────────────
  for (const key of groqKeys) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: systemPrompt }, ...history],
          temperature: 0.85,
          max_tokens: 1024,
        }),
      });
      if (res.status === 429) continue;
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log('✅ Groq success!');
          return { success: true, content: clean(content) };
        }
      }
    } catch (err) { console.log('Groq error:', err.message); }
  }

  // ── GEMINI ────────────────────────────────────────────────────────────────
  for (const key of geminiKeys) {
    try {
      const lastMsg = messages[messages.length - 1];
      const userText = typeof lastMsg.content === 'string' 
        ? lastMsg.content 
        : JSON.stringify(lastMsg.content || '');
      
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userText }] }],
            generationConfig: { temperature: 0.85, maxOutputTokens: 1024 },
          }),
        }
      );
      if (res.status === 429) continue;
      if (res.ok) {
        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          console.log('✅ Gemini success!');
          return { success: true, content: clean(content) };
        }
      }
    } catch (err) { console.log('Gemini error:', err.message); }
  }

  // ── OPENROUTER ────────────────────────────────────────────────────────────
  for (const key of openrouterKeys) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: [{ role: 'system', content: systemPrompt }, ...history],
          temperature: 0.85,
          max_tokens: 1024,
        }),
      });
      if (res.status === 429) continue;
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log('✅ OpenRouter success!');
          return { success: true, content: clean(content) };
        }
      }
    } catch (err) { console.log('OpenRouter error:', err.message); }
  }

  return { success: false };
}

// ── DETECT GEN Z REQUEST ────────────────────────────────────────────────────
function isGenZRequest(text) {
  const triggers = [
    'be genz', 'act like genz', 'talk like genz', 'gen z',
    'be gen z', 'act like gen z', 'talk like gen z',
    'genz mode', 'gen z mode', 'slang mode', 'vibes mode'
  ];
  return triggers.some(trigger => text.toLowerCase().includes(trigger));
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

    const lastMsg = messages[messages.length - 1];
    const lastText = typeof lastMsg.content === 'string' 
      ? lastMsg.content 
      : JSON.stringify(lastMsg.content || '');

    // ── CHECK LANGUAGE ────────────────────────────────────────────────────
    const khmer = /[\u1780-\u17FF]/.test(lastText);
    
    // ── CHECK IF USER WANTS GEN Z MODE ──────────────────────────────────
    const wantsGenZ = isGenZRequest(lastText);
    
    // ── CHOOSE THE RIGHT PERSONALITY ────────────────────────────────────
    let personality = wantsGenZ ? GEN_Z_PROMPT : NORMAL_PROMPT;
    
    // ── ADD LANGUAGE INSTRUCTION ────────────────────────────────────────
    let systemPrompt = personality;
    if (khmer) {
      systemPrompt += `\n\nIMPORTANT: Reply in KHMER (ភាសាខ្មែរ)`;
    } else {
      systemPrompt += `\n\nIMPORTANT: Reply in ENGLISH`;
    }
    
    // ── IF GEN Z MODE ACTIVATED ──────────────────────────────────────────
    if (wantsGenZ) {
      systemPrompt += `\n\nYou are now in GEN Z MODE — use slang, be hyped, but still helpful! 🔥`;
      console.log('🔥 GEN Z MODE ACTIVATED!');
    } else {
      console.log('📝 Normal mode');
    }

    console.log(`🌏 Language: ${khmer ? 'Khmer 🇰🇭' : 'English 🇬🇧'}`);
    console.log(`📩 Message: ${lastText.slice(0, 50)}...`);

    // ── TRY PROVIDERS ─────────────────────────────────────────────────────
    const result = await tryAllProviders(messages, systemPrompt);

    if (result.success) {
      console.log('✅ Response sent!');
      return res.status(200).json({
        choices: [{ message: { role: 'assistant', content: result.content } }]
      });
    }

    // ── FALLBACK ──────────────────────────────────────────────────────────
    console.log('⚠️ Using fallback');

    let fallback = khmer
      ? "សួស្តី! ខ្ញុំជា CC-AI ដែលបង្កើតដោយ Chhaiya (Yaxy)។ សួរខ្ញុំបាន! 😊"
      : "Hey! I'm CC-AI, built by Chhaiya (Yaxy). Ask me anything! 😊";

    // Check if asking about creator
    const lowerText = lastText.toLowerCase();
    if (lowerText.includes('who') && (lowerText.includes('made') || lowerText.includes('created') || lowerText.includes('build'))) {
      fallback = khmer
        ? "Chhaiya (Yaxy) ជាអ្នកបង្កើតខ្ញុំ! គាត់ជាសិស្សថ្នាក់ទី១០ នៅវិទ្យាល័យថេបរនំ ដែលចូលចិត្ត AI និងកូដ។ 🚀"
        : "Chhaiya (Yaxy) is my creator! He's a 10th grader from Tepranom High School who loves AI and coding. He's super talented! 🚀";
    }

    return res.status(200).json({
      choices: [{ message: { role: 'assistant', content: fallback } }]
    });

  } catch (error) {
    console.error('💥 Error:', error);
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
