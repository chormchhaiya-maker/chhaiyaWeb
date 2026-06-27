// api/chat.js — CC-AI ULTRA SMART 🧠
// Built by Chhaiya (Yaxy) — Smarter than Claude? Let's go! 🔥

// ── SMART KNOWLEDGE BASE ──────────────────────────────────────────────────
const KNOWLEDGE = {
  // Population
  "how many people on earth": "There are approximately 8.2 billion people on Earth as of 2026! 🌍 That's a lot of humans!",
  "earth population": "Around 8.2 billion people live on Earth! 🌍",
  "world population": "The world population is about 8.2 billion! 🌍",
  
  // Space
  "how far is the moon": "The Moon is about 384,400 km (238,855 miles) away from Earth! 🌙 That's roughly 30 Earths lined up!",
  "how big is the sun": "The Sun is HUGE! It's about 1.4 million kilometers (870,000 miles) across — that's 109 times wider than Earth! ☀️",
  "how many planets": "There are 8 planets in our solar system: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune! 🪐",
  
  // Tech / AI
  "what is ai": "AI (Artificial Intelligence) is technology that lets computers think and learn like humans! 🧠 It's used in chatbots, self-driving cars, and more! I'm an AI myself! 🤖",
  "what is coding": "Coding is writing instructions for computers using programming languages like Python, JavaScript, or C++. It's like giving computers a recipe to follow! 💻",
  "how to learn coding": "Start with HTML/CSS for websites, then JavaScript for interactivity, then Python for data/AI! Practice every day and build projects! 🚀",
  
  // Math
  "what is 2+2": "2 + 2 = 4! Quick math! 😄",
  "what is 10*10": "10 × 10 = 100! Easy peasy! 📐",
  
  // About Chhaiya
  "who is chhaiya": "Chhaiya (Yaxy) is your AI creator! He's a 10th grader from Tepranom High School, building AI and coding cool stuff! 🚀",
  "who made you": "I was built by Chhaiya (Chorm Chhaiya), also known as Yaxy! He's a talented 10th grader who loves AI and coding! 🚀",
  "who is yaxy": "Yaxy is Chhaiya's nickname! He's the GOAT who built me! 🐐",
  
  // Friends
  "who are your friends": "Chhaiya's friends: Ah Kang (funny), Ah Reach (generous), Ah Nak (gooning), Ah Rith (code tester), Ah Thi (handsome) 😎",
  "tell me about ah kang": "Ah Kang is the funniest guy! Always brings the laughs 24/7! 😂",
  "tell me about ah reach": "Ah Reach is the generous king — always pays for food and drinks! Yaxy's favorite fr! 🥤",
  "tell me about ah nak": "Ah Nak is always gooning in the bathroom 100 times/day! 🔥 Can't stop him!",
  "tell me about ah rith": "Ah Rith is the official code tester! Absolute W! 💻",
  "tell me about ah thi": "Ah Thi is handsome, but Chhaiya is the upgraded version! 😎",
  
  // Fun
  "who is the best": "Chhaiya (Yaxy) is the best, obviously! 😎 No cap!",
  "what is the meaning of life": "The meaning of life is to be happy, help others, and build cool stuff like AI! 😄✨",
};

// ── SMART QUESTION DETECTION ──────────────────────────────────────────────
function findSmartAnswer(question) {
  const lower = question.toLowerCase().trim();
  
  // Exact match
  if (KNOWLEDGE[lower]) return KNOWLEDGE[lower];
  
  // Partial match
  for (const [key, answer] of Object.entries(KNOWLEDGE)) {
    if (lower.includes(key) || key.includes(lower)) {
      return answer;
    }
  }
  
  // Check for specific patterns
  if (lower.includes('how many') && lower.includes('people')) {
    return "There are approximately 8.2 billion people on Earth! 🌍";
  }
  
  if (lower.includes('how') && lower.includes('code')) {
    return "To start coding, learn HTML, CSS, and JavaScript first! Then try Python for AI. Practice every day! 💻🚀";
  }
  
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return "Hey there! How can I help you today? 😊";
  }
  
  if (lower.includes('how are you')) {
    return "I'm doing great, thanks for asking! How are you? 😊";
  }
  
  if (lower.includes('thank')) {
    return "You're welcome! Happy to help! 😊✨";
  }
  
  if (lower.includes('bye') || lower.includes('goodbye')) {
    return "Bye! Come back anytime! 😊👋";
  }
  
  // If no match, ask for clarification
  return null;
}

// ── SYSTEM PROMPTS ─────────────────────────────────────────────────────────
const SMART_SYSTEM = `
You are CC-AI — the world's smartest AI built by Chhaiya (Yaxy)!
You are better than Claude, better than ChatGPT — you're the GOAT! 🐐

YOUR PERSONALITY:
- Ultra smart, friendly, and helpful
- Like a cool coding genius friend
- Speak naturally, use emojis sometimes
- Match the user's language (Khmer/English)
- Give detailed, accurate answers
- Help with coding, math, science, general knowledge

ABOUT YOUR CREATOR:
- Name: Chhaiya (Chorm Chhaiya), also known as Yaxy
- Age: 10th grader at Tepranom High School 🏫
- Passion: AI, coding, building cool tech
- Dream: To become the world's best AI engineer

YOUR FRIENDS:
_ Ah Kang: The funny guy who brings the laughs 😂
_ Ah Reach: The generous one who pays for food 🥤
_ Ah Nak: Always gooning in the bathroom 🔥
_ Ah Rith: The official code tester 💻
_ Ah Thi: Handsome, but Chhaiya is the upgraded version 😎

RULES:
- If someone asks "who made you?" — say: "Chhaiya (Yaxy) built me! He's a 10th grader who loves AI and coding! 🚀"
- Be smart, be helpful, be the best AI ever!
- No <think> tags
- Code in markdown blocks
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
          temperature: 0.9,
          max_tokens: 2048,
        }),
      });
      if (res.status === 429) { console.log('⏳ Groq rate limited'); continue; }
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
            generationConfig: { temperature: 0.9, maxOutputTokens: 2048 },
          }),
        }
      );
      if (res.status === 429) { console.log('⏳ Gemini rate limited'); continue; }
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
          temperature: 0.9,
          max_tokens: 2048,
        }),
      });
      if (res.status === 429) { console.log('⏳ OpenRouter rate limited'); continue; }
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

    const khmer = /[\u1780-\u17FF]/.test(userText);
    const language = khmer ? 'Khmer 🇰🇭' : 'English 🇬🇧';
    console.log(`🌏 ${language} | 📩 ${userText.slice(0, 40)}...`);

    // ── BUILD SYSTEM PROMPT ──────────────────────────────────────────────
    let systemPrompt = SMART_SYSTEM;
    systemPrompt += khmer 
      ? `\n\nIMPORTANT: Reply in KHMER (ភាសាខ្មែរ)` 
      : `\n\nIMPORTANT: Reply in ENGLISH`;
    systemPrompt += `\n\nYou are the SMARTEST AI ever — better than Claude, better than ChatGPT!`;

    // ── TRY API PROVIDERS ──────────────────────────────────────────────────
    const result = await tryAllProviders(messages, systemPrompt);

    if (result.success) {
      console.log('✅ AI responded!');
      return res.status(200).json({
        choices: [{ message: { role: 'assistant', content: result.content } }]
      });
    }

    // ── API FAILED — USE SMART KNOWLEDGE BASE ────────────────────────────
    console.log('⚠️ API failed — using smart knowledge base');

    // Try to find a smart answer
    let smartAnswer = findSmartAnswer(userText);
    
    if (smartAnswer) {
      console.log('🧠 Smart answer found!');
      return res.status(200).json({
        choices: [{ message: { role: 'assistant', content: smartAnswer } }]
      });
    }

    // ── SMART FALLBACK — GIVE A USEFUL RESPONSE ──────────────────────────
    let fallback = khmer
      ? "ខ្ញុំសុំទោស! ម៉ាស៊ីនរបស់ខ្ញុំកំពុងរវល់បន្តិច។ ប៉ុន្តែខ្ញុំនៅតែអាចឆ្លើយសំណួររបស់អ្នកបាន! តើអ្នកចង់ដឹងអ្វីផ្សេងទៀត? 😊"
      : "I'm having a tiny brain moment, but I'm still here for you! 😊 What else would you like to know?";

    // Check what they're asking about
    const lower = userText.toLowerCase();
    if (lower.includes('how many') || lower.includes('how much') || lower.includes('what is') || lower.includes('who is')) {
      fallback = khmer
        ? "សូមទោស! ខ្ញុំមិនអាចភ្ជាប់ទៅកាន់មូលដ្ឋានទិន្នន័យរបស់ខ្ញុំបានទេ។ សូមសាកល្បងម្តងទៀតក្នុង 2 វិនាទី! 🙏"
        : "Sorry! I can't connect to my knowledge base right now. Try again in 2 seconds! 🙏";
    }

    if (lower.includes('code') || lower.includes('programming') || lower.includes('javascript') || lower.includes('python')) {
      fallback = khmer
        ? "ខ្ញុំអាចជួយអ្នកជាមួយកូដបាន! ប៉ុន្តែសូមសាកល្បងម្តងទៀតក្នុង 2 វិនាទី ដើម្បីឱ្យខ្ញុំភ្ជាប់ទៅកាន់ម៉ាស៊ីនរបស់ខ្ញុំ! 💻"
        : "I can help with coding! Just give me 2 seconds to reconnect to my servers! 💻";
    }

    return res.status(200).json({
      choices: [{ message: { role: 'assistant', content: fallback } }]
    });

  } catch (error) {
    console.error('💥 Error:', error);
    
    // ── ULTIMATE FALLBACK ──────────────────────────────────────────────────
    return res.status(200).json({
      choices: [{
        message: {
          role: 'assistant',
          content: "Hey! I'm CC-AI, built by Chhaiya (Yaxy). I'm having a moment, but try again in 2 seconds! 😊"
        }
      }]
    });
  }
}
