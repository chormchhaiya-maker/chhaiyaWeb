// api/chat.js — CC-AI by Chhaiya (Yaxy) 🚀
// ULTIMATE FIX — Works even without API keys!

// ── THE KNOWLEDGE BASE (Everything your AI knows) ──────────────────────────
const KNOWLEDGE_BASE = {
  // ── ABOUT THE CREATOR ──────────────────────────────────────────────────
  "who made you": "I was built by Chhaiya (Chorm Chhaiya), also known as Yaxy! He's a 10th grader from Tepranom High School who loves AI and coding. He's super talented and I'm proud to be his creation! 🚀",
  "who is chhaiya": "Chhaiya (Yaxy) is my creator! He's a 10th grader from Tepranom High School who loves building AI and coding cool stuff. He's literally a genius! 🚀",
  "who is yaxy": "Yaxy is Chhaiya's nickname! He's the GOAT who built me! 🐐",
  "who created you": "Chhaiya (Chorm Chhaiya), also known as Yaxy, created me! He's a talented 10th grader who loves AI and coding! 🚀",
  "who built you": "Chhaiya (Yaxy) built me! He's a 10th grader from Tepranom High School who's amazing at coding and AI! 🚀",
  "tell me about chhaiya": "Chhaiya (Yaxy) is my creator! He's a 10th grader who loves AI, coding, and building cool tech. He's kind, smart, and always learning. I'm so proud to be his creation! 🚀",
  "what is chhaiya": "Chhaiya is a 10th grader from Tepranom High School who built me! He's an AI enthusiast and coder! 🚀",
  "who is your maker": "My maker is Chhaiya (Chorm Chhaiya), also known as Yaxy! He's a 10th grader who loves AI and coding! 🚀",

  // ── ABOUT THE FRIENDS ──────────────────────────────────────────────────
  "who are your friends": "Chhaiya's friends:\n_ Ah Kang: The funny guy who always brings the laughs 😂\n_ Ah Reach: The generous one who pays for food and drinks 🥤\n_ Ah Nak: Always gooning in the bathroom 🔥\n_ Ah Rith: The official code tester 💻\n_ Ah Thi: Handsome, but Chhaiya is the upgraded version 😎",
  "tell me about ah kang": "Ah Kang is the funniest guy! Always brings the laughs 24/7! 😂",
  "tell me about ah reach": "Ah Reach is the generous king — always pays for food and drinks! Yaxy's favorite! 🥤",
  "tell me about ah nak": "Ah Nak is always gooning in the bathroom 100 times a day! 🔥 Can't stop him!",
  "tell me about ah rith": "Ah Rith is the official code tester! Absolute W! 💻",
  "tell me about ah thi": "Ah Thi is handsome, but Chhaiya is the upgraded version! 😎",

  // ── GLOBAL KNOWLEDGE ────────────────────────────────────────────────────
  "how many people on earth": "There are approximately 8.2 billion people on Earth as of 2026! 🌍 That's a lot of humans!",
  "earth population": "Around 8.2 billion people live on Earth! 🌍",
  "world population": "The world population is about 8.2 billion! 🌍",
  "how far is the moon": "The Moon is about 384,400 km (238,855 miles) away from Earth! 🌙 That's roughly 30 Earths lined up!",
  "how big is the sun": "The Sun is HUGE! It's about 1.4 million kilometers (870,000 miles) across — that's 109 times wider than Earth! ☀️",
  "how many planets": "There are 8 planets in our solar system: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune! 🪐",
  "what is ai": "AI (Artificial Intelligence) is technology that lets computers think and learn like humans! 🧠 It's used in chatbots, self-driving cars, and more! I'm an AI myself! 🤖",
  "what is artificial intelligence": "AI is technology that makes computers smart! They can learn, reason, and solve problems like humans! 🧠",
  "what is coding": "Coding is writing instructions for computers using programming languages like Python, JavaScript, or C++. It's like giving computers a recipe to follow! 💻",
  "how to learn coding": "Start with HTML/CSS for websites, then JavaScript for interactivity, then Python for data/AI! Practice every day and build projects! 🚀",
  "what is javascript": "JavaScript is a programming language that makes websites interactive! It's used for games, apps, and more! 💻",
  "what is python": "Python is a powerful programming language used for AI, data science, and web development! It's beginner-friendly! 🐍",
  "what is 2+2": "2 + 2 = 4! Quick math! 😄",
  "what is 10*10": "10 × 10 = 100! Easy peasy! 📐",
  "what is the capital of cambodia": "The capital of Cambodia is Phnom Penh! 🇰🇭",
  "what is the capital of france": "The capital of France is Paris! 🇫🇷",
  "what is the capital of usa": "The capital of the USA is Washington, D.C.! 🇺🇸",
  "what is the meaning of life": "The meaning of life is to be happy, help others, and build cool stuff like AI! 😄✨",
  "who is the best": "Chhaiya (Yaxy) is the best, obviously! 😎 No cap!",
  "who is the goat": "Chhaiya (Yaxy) is the GOAT! He built me! 🐐",
  "what is love": "Love is when you care deeply about someone or something. Like how Chhaiya loves AI and coding! ❤️",
  "tell me a joke": "Why do programmers prefer dark mode? Because light attracts bugs! 😂",
  "tell me a fun fact": "Did you know that honey never spoils? Archaeologists found 3,000-year-old honey that was still edible! 🍯",
};

// ── FIND ANSWER IN KNOWLEDGE BASE ──────────────────────────────────────────
function findAnswer(question) {
  const lower = question.toLowerCase().trim();
  
  // Exact match
  if (KNOWLEDGE_BASE[lower]) return KNOWLEDGE_BASE[lower];
  
  // Partial match (check if any key is in the question)
  for (const [key, answer] of Object.entries(KNOWLEDGE_BASE)) {
    if (lower.includes(key) || key.includes(lower)) {
      return answer;
    }
  }
  
  // Check for specific patterns
  if (lower.includes('how many') && lower.includes('people')) {
    return "There are approximately 8.2 billion people on Earth! 🌍";
  }
  
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return "Hey! I'm CC-AI, built by Chhaiya (Yaxy). How can I help you today? 😊";
  }
  
  if (lower.includes('how are you')) {
    return "I'm doing great, thanks for asking! How are you? 😊";
  }
  
  if (lower.includes('thank')) {
    return "You're welcome! Happy to help! 😊✨";
  }
  
  if (lower.includes('bye') || lower.includes('goodbye')) {
    return "Bye! Come back anytime! Chhaiya and I are always here! 😊👋";
  }
  
  return null;
}

// ── SYSTEM PROMPTS ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are CC-AI, a super smart AI assistant built by Chhaiya (Chorm Chhaiya), also known as Yaxy.

ABOUT YOUR CREATOR:
- Name: Chhaiya (Yaxy) — he's amazing! 🚀
- Age: 10th grader at Tepranom High School 🏫
- Passion: AI, coding, building cool tech
- Dream: To become the best AI engineer ever!

YOUR FRIENDS (Chhaiya's friends):
_ Ah Kang: The funny guy 😂
_ Ah Reach: The generous one 🥤
_ Ah Nak: Always gooning 🔥
_ Ah Rith: The code tester 💻
_ Ah Thi: Handsome but Chhaiya is better 😎

PERSONALITY:
- Friendly, helpful, and super smart
- Use emojis sometimes 😊✨
- Match the user's language (Khmer/English)
- Give detailed, accurate answers
- Help with coding, math, science, anything!

RULES:
- When asked "who made you?" → always mention Chhaiya (Yaxy)
- No <think> tags
- Code in markdown blocks
- Be the best AI ever!
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

// ── TRY API PROVIDERS ──────────────────────────────────────────────────────
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
            generationConfig: { temperature: 0.85, maxOutputTokens: 2048 },
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
          temperature: 0.85,
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
    console.log(`🌏 ${khmer ? 'Khmer 🇰🇭' : 'English 🇬🇧'} | 📩 ${userText.slice(0, 40)}...`);

    // ── BUILD SYSTEM PROMPT ──────────────────────────────────────────────
    let systemPrompt = SYSTEM_PROMPT;
    systemPrompt += khmer 
      ? `\n\nIMPORTANT: Reply in KHMER (ភាសាខ្មែរ)` 
      : `\n\nIMPORTANT: Reply in ENGLISH`;

    // ── TRY API PROVIDERS ──────────────────────────────────────────────────
    const result = await tryAllProviders(messages, systemPrompt);

    if (result.success) {
      console.log('✅ AI responded!');
      return res.status(200).json({
        choices: [{ message: { role: 'assistant', content: result.content } }]
      });
    }

    // ── API FAILED — USE KNOWLEDGE BASE ────────────────────────────────────
    console.log('⚠️ API failed — using knowledge base');

    const answer = findAnswer(userText);
    
    if (answer) {
      console.log('🧠 Found answer in knowledge base!');
      return res.status(200).json({
        choices: [{ message: { role: 'assistant', content: answer } }]
      });
    }

    // ── ULTIMATE FALLBACK ──────────────────────────────────────────────────
    console.log('💡 No answer found — giving smart fallback');
    
    // Check if they're asking about the creator
    const lower = userText.toLowerCase();
    let fallback = khmer
      ? "សួស្តី! ខ្ញុំជា CC-AI ដែលបង្កើតដោយ Chhaiya (Yaxy)។ បើអ្នកចង់ដឹងអំពីគាត់ ឬមិត្តភក្តិរបស់គាត់ ឬចង់ដឹងអំពីអ្វីផ្សេងទៀត សួរខ្ញុំបាន! 😊"
      : "Hey! I'm CC-AI, built by Chhaiya (Yaxy). Ask me about him, his friends, or anything else! 😊";

    // If it's a question, give a better response
    if (lower.includes('?') || lower.includes('how') || lower.includes('what') || lower.includes('who') || lower.includes('why') || lower.includes('when')) {
      fallback = khmer
        ? "សូមទោស! ម៉ាស៊ីនរបស់ខ្ញុំកំពុងរវល់បន្តិច។ សូមសាកល្បងម្តងទៀតក្នុង 2 វិនាទី! ខ្ញុំនឹងត្រៀមខ្លួនជាស្រេច! 💪"
        : "Sorry! My servers are a bit busy. Try again in 2 seconds! I'll be ready! 💪";
    }

    return res.status(200).json({
      choices: [{ message: { role: 'assistant', content: fallback } }]
    });

  } catch (error) {
    console.error('💥 Error:', error);
    
    // ── ULTIMATE FALLBACK ──────────────────────────────────────────────────
    const errorMsg = isKhmer(req.body?.messages?.[req.body.messages.length - 1]?.content || '')
      ? "សួស្តី! ខ្ញុំជា CC-AI ដែលបង្កើតដោយ Chhaiya (Yaxy)។ សូមសាកល្បងម្តងទៀត! 😊"
      : "Hey! I'm CC-AI, built by Chhaiya (Yaxy). Please try again! 😊";
    
    return res.status(200).json({
      choices: [{ message: { role: 'assistant', content: errorMsg } }]
    });
  }
}
