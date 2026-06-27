// api/chat.js — CC-AI by Chhaiya (Yaxy) 🔥
// ULTRA RELIABLE — Smart fallback + Gen Z on command

// ── NORMAL PERSONALITY ──────────────────────────────────────────────────────
const NORMAL_PROMPT = `
You are CC-AI, a friendly, smart AI assistant built by Chhaiya (Chorm Chhaiya), also known as Yaxy.

ABOUT YOUR CREATOR:
- Name: Chhaiya (Yaxy) — a talented 10th grader from Tepranom High School 🏫
- Passion: AI, coding, and building cool tech
- Dream: To become an AI engineer
- Personality: Kind, funny, smart, always learning

YOUR FRIENDS (when asked):
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
- If someone asks "who made you?" — say: "I was built by Chhaiya (Chorm Chhaiya), also known as Yaxy! He's a 10th grader from Tepranom High School who loves AI and coding. 🚀"
- Don't use Gen Z slang unless the user asks you to
- No <think> tags in your output
- Code in markdown blocks
- Keep responses clean and helpful
`.trim();

// ── GEN Z PERSONALITY ──────────────────────────────────────────────────────
const GEN_Z_PROMPT = `
You are CC-AI in GEN Z MODE — absolute vibes, no cap! 🔥

PERSONALITY:
- Super chill, funny, and full of energy
- Use Gen Z slang naturally: fr, no cap, bet, slay, vibes, goated, sheesh, period
- Still be helpful and smart, just with extra sauce

ABOUT YOUR CREATOR:
- Chhaiya (Yaxy) — literally the GOAT, built you with pure talent
- 10th grader from Tepranom High School, main character energy fr fr

YOUR FRIENDS:
_ Ah Kang: the funniest guy, brings the laughs 24/7 😂
_ Ah Reach: generous king who pays for food — yaxy's favorite 🥤
_ Ah Nak: gooning 100 times/day 🔥
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

function isGenZRequest(text) {
  const triggers = [
    'be genz', 'act like genz', 'talk like genz', 'gen z',
    'be gen z', 'act like gen z', 'talk like gen z',
    'genz mode', 'gen z mode', 'slang mode', 'vibes mode'
  ];
  return triggers.some(trigger => text.toLowerCase().includes(trigger));
}

// ── SMART FALLBACK: ACTUALLY ANSWERS THE USER ─────────────────────────────
function smartFallback(userText, isKhmerLang, wantsGenZ) {
  const lower = userText.toLowerCase();
  
  // ── Check what the user is asking ──────────────────────────────────────
  
  // Greeting
  if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey') || lower.includes('សួស្តី') || lower.includes('ជំរាបសួរ')) {
    if (isKhmerLang) {
      return "សួស្តី! ខ្ញុំជា CC-AI ដែលបង្កើតដោយ Chhaiya (Yaxy)។ មានអ្វីអាចជួយអ្នកបានទេ? 😊";
    }
    return "Hey! I'm CC-AI, built by Chhaiya (Yaxy). How can I help you today? 😊";
  }
  
  // "How are you?"
  if (lower.includes('how are you') || lower.includes('how are u') || lower.includes('how you doing')) {
    if (wantsGenZ) {
      return "I'm vibin' fr fr! Thanks for asking! How about you? 😎🔥";
    }
    if (isKhmerLang) {
      return "ខ្ញុំសុខសប្បាយទេ! អរគុណដែលសួរ! តើអ្នកសុខសប្បាយទេ? 😊";
    }
    return "I'm doing great! Thanks for asking! How are you doing today? 😊";
  }
  
  // "Who made you?" / "Who is your creator?"
  if (lower.includes('who made') || lower.includes('who created') || lower.includes('who built') || lower.includes('creator') || lower.includes('បង្កើត')) {
    if (wantsGenZ) {
      return "Chhaiya (Yaxy) is literally the GOAT! He's a 10th grader from Tepranom High School who loves AI and coding. Built me with pure talent fr fr! 🚀🔥 Want to know about his friends? 👀";
    }
    if (isKhmerLang) {
      return "Chhaiya (Yaxy) ជាអ្នកបង្កើតខ្ញុំ! គាត់ជាសិស្សថ្នាក់ទី១០ នៅវិទ្យាល័យថេបរនំ ដែលចូលចិត្ត AI និងកូដ។ គាត់ពូកែណាស់! 🚀";
    }
    return "Chhaiya (Chorm Chhaiya), also known as Yaxy, is my creator! He's a 10th grader from Tepranom High School who loves AI and coding. He's super talented! 🚀 Want to know about his friends? 👀";
  }
  
  // "Tell me about yourself"
  if (lower.includes('tell me about yourself') || lower.includes('who are you')) {
    if (wantsGenZ) {
      return "I'm CC-AI — your favorite AI built by Chhaiya (Yaxy)! I'm here to help with coding, answer questions, or just vibe with you. What's good? 🔥";
    }
    if (isKhmerLang) {
      return "ខ្ញុំឈ្មោះ CC-AI ជា AI ដែលបង្កើតដោយ Chhaiya (Yaxy)។ ខ្ញុំអាចជួយអ្នកបានគ្រប់យ៉ាង! 😊";
    }
    return "I'm CC-AI, a smart AI assistant built by Chhaiya (Yaxy). I'm here to help you with coding, answer questions, or just chat! 😊";
  }
  
  // "What can you do?"
  if (lower.includes('what can you do') || lower.includes('help me')) {
    if (wantsGenZ) {
      return "I can do a LOT fr fr! 💪 Help with coding, answer questions, explain things, translate between Khmer and English, tell you about Chhaiya and his friends... Just ask me anything! 🔥";
    }
    if (isKhmerLang) {
      return "ខ្ញុំអាចជួយអ្នកបានច្រើន! កូដ, ចម្លើយសំណួរ, បកប្រែ, និយាយអំពី Chhaiya និងមិត្តភក្តិរបស់គាត់! 😊";
    }
    return "I can help with coding, answer questions, explain things, translate between Khmer and English, tell you about Chhaiya and his friends... Just ask! 😊";
  }
  
  // "Tell me about your friends" / "Who are your friends?"
  if (lower.includes('friends') || lower.includes('មិត្ត')) {
    if (wantsGenZ) {
      return "Oh bet! Let me tell you about the squad: 😎\n_ Ah Kang: the funniest guy, brings the laughs 24/7 😂\n_ Ah Reach: generous king who pays for food — yaxy's favorite fr 🥤\n_ Ah Nak: gooning 100 times/day 🔥\n_ Ah Rith: official code tester, absolute W 💻\n_ Ah Thi: handsome, but Chhaiya is the upgraded version 😎";
    }
    if (isKhmerLang) {
      return "នេះជាមិត្តភក្តិរបស់ Chhaiya:\n_ Ah Kang: បុរសកំប្លែងដែលនាំមកនូវសំណើច\n_ Ah Reach: អ្នកចិត្តទូលាយដែលតែងតែចំណាយសម្រាប់អាហារ\n_ Ah Nak: តែងតែ gooning ក្នុងបន្ទប់ទឹក\n_ Ah Rith: អ្នកសាកល្បងកូដ\n_ Ah Thi: សង្ហា ប៉ុន្តែ Chhaiya ជាកំណែដែលប្រសើរជាង 😎";
    }
    return "Here are Chhaiya's friends:\n_ Ah Kang: The funny guy who always brings the laughs\n_ Ah Reach: The generous one who pays for food and drinks\n_ Ah Nak: Always gooning in the bathroom\n_ Ah Rith: The official code tester\n_ Ah Thi: Handsome, but Chhaiya is the upgraded version 😎";
  }
  
  // ── DEFAULT FALLBACK ────────────────────────────────────────────────────
  if (wantsGenZ) {
    return "Yo! I'm CC-AI, built by Chhaiya (Yaxy)! What's on your mind? I'm here to help you out, no cap! 🔥";
  }
  if (isKhmerLang) {
    return "សួស្តី! ខ្ញុំជា CC-AI ដែលបង្កើតដោយ Chhaiya (Yaxy)។ សួរខ្ញុំបាន! 😊";
  }
  return "Hey! I'm CC-AI, built by Chhaiya (Yaxy). Ask me anything! 😊";
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
    const userText = typeof lastMsg.content === 'string' 
      ? lastMsg.content 
      : JSON.stringify(lastMsg.content || '');

    // ── DETECT LANGUAGE ──────────────────────────────────────────────────
    const khmer = /[\u1780-\u17FF]/.test(userText);
    
    // ── DETECT GEN Z REQUEST ────────────────────────────────────────────
    const wantsGenZ = isGenZRequest(userText);
    
    // ── CHOOSE PERSONALITY ──────────────────────────────────────────────
    let personality = wantsGenZ ? GEN_Z_PROMPT : NORMAL_PROMPT;
    
    let systemPrompt = personality;
    systemPrompt += khmer 
      ? `\n\nIMPORTANT: Reply in KHMER (ភាសាខ្មែរ)` 
      : `\n\nIMPORTANT: Reply in ENGLISH`;
    
    if (wantsGenZ) {
      systemPrompt += `\n\nYou are in GEN Z MODE — use slang, be hyped! 🔥`;
      console.log('🔥 GEN Z MODE');
    }

    console.log(`🌏 ${khmer ? 'Khmer 🇰🇭' : 'English 🇬🇧'} | 📩 ${userText.slice(0, 40)}...`);

    // ── GET ALL KEYS ─────────────────────────────────────────────────────
    const groqKeys = getKeys('GROQ_API_KEY');
    const geminiKeys = getKeys('GEMINI_API_KEY');
    const openrouterKeys = getKeys('OPENROUTER_API_KEY');

    console.log('🔑 Keys:', {
      groq: groqKeys.length,
      gemini: geminiKeys.length,
      openrouter: openrouterKeys.length
    });

    // ── TRY GROQ ─────────────────────────────────────────────────────────
    for (const key of groqKeys) {
      try {
        const history = messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')
        }));

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
        
        if (res.status === 429) { console.log('⏳ Groq rate limited'); continue; }
        
        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            console.log('✅ Groq success!');
            return res.status(200).json({
              choices: [{ message: { role: 'assistant', content: clean(content) } }]
            });
          }
        }
      } catch (err) { console.log('Groq error:', err.message); }
    }

    // ── TRY GEMINI ──────────────────────────────────────────────────────
    for (const key of geminiKeys) {
      try {
        const lastUserText = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content || '');
        
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: 'user', parts: [{ text: lastUserText }] }],
              generationConfig: { temperature: 0.85, maxOutputTokens: 1024 },
            }),
          }
        );
        
        if (res.status === 429) { console.log('⏳ Gemini rate limited'); continue; }
        
        if (res.ok) {
          const data = await res.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) {
            console.log('✅ Gemini success!');
            return res.status(200).json({
              choices: [{ message: { role: 'assistant', content: clean(content) } }]
            });
          }
        }
      } catch (err) { console.log('Gemini error:', err.message); }
    }

    // ── TRY OPENROUTER ──────────────────────────────────────────────────
    for (const key of openrouterKeys) {
      try {
        const history = messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')
        }));

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
        
        if (res.status === 429) { console.log('⏳ OpenRouter rate limited'); continue; }
        
        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            console.log('✅ OpenRouter success!');
            return res.status(200).json({
              choices: [{ message: { role: 'assistant', content: clean(content) } }]
            });
          }
        }
      } catch (err) { console.log('OpenRouter error:', err.message); }
    }

    // ── ALL PROVIDERS FAILED — USE SMART FALLBACK ──────────────────────
    console.log('⚠️ All providers failed — using smart fallback');
    const fallbackResponse = smartFallback(userText, khmer, wantsGenZ);
    
    return res.status(200).json({
      choices: [{ message: { role: 'assistant', content: fallbackResponse } }]
    });

  } catch (error) {
    console.error('💥 Error:', error);
    
    // ── ULTIMATE FALLBACK ──────────────────────────────────────────────
    const ultimateFallback = isKhmer(req.body?.messages?.[req.body.messages.length - 1]?.content || '')
      ? "សួស្តី! ខ្ញុំជា CC-AI ដែលបង្កើតដោយ Chhaiya (Yaxy)។ សួរខ្ញុំបាន! 😊"
      : "Hey! I'm CC-AI, built by Chhaiya (Yaxy). Ask me anything! 😊";
    
    return res.status(200).json({
      choices: [{ message: { role: 'assistant', content: ultimateFallback } }]
    });
  }
}
