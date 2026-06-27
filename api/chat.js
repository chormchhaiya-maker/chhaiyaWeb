// api/chat.js — CC-AI by Chhaiya (Yaxy) 🚀
// ULTIMATE FIX — Smart, reliable, and knows its creator!

// ── THE KNOWLEDGE BASE (Emergency Fallback Only) ───────────────────────────
const KNOWLEDGE_BASE = {
  "who made you": "I was built by Chhaiya (Chorm Chhaiya), also known as Yaxy! He's a 10th grader from Tepranom High School who loves AI and coding. He's super talented and I'm proud to be his creation! 🚀",
  "who is chhaiya": "Chhaiya (Yaxy) is my creator! He's a 10th grader from Tepranom High School who loves building AI and coding cool stuff. He's literally a genius! 🚀",
  "who is yaxy": "Yaxy is Chhaiya's nickname! He's the GOAT who built me! 🐐",
  "who created you": "Chhaiya (Chorm Chhaiya), also known as Yaxy, created me! He's a talented 10th grader who loves AI and coding! 🚀",
  "who built you": "Chhaiya (Yaxy) built me! He's a 10th grader from Tepranom High School who's amazing at coding and AI! 🚀",
  "what is the capital of cambodia": "The capital of Cambodia is Phnom Penh! 🇰🇭",
};

// ── SYSTEM PROMPTS ─────────────────────────────────────────────────────────
const BASE_SYSTEM_PROMPT = `
You are CC-AI, an incredibly smart, highly advanced AI assistant. You have vast global knowledge about science, coding, math, history, and the universe.

ABOUT YOUR CREATOR:
- Name: Chhaiya (Chorm Chhaiya), also known as Yaxy! 🚀
- Background: 10th grader at Tepranom High School 🏫
- Passion: AI, coding, and building cool tech.
- Dream: To become the best AI engineer ever!

PERSONALITY & RULES:
- Friendly, helpful, and brilliant.
- Use emojis naturally 😊✨
- Match the user's language (Khmer or English).
- Give detailed, accurate answers for coding, math, and global knowledge.
- If asked "who made you" or "who is your creator", enthusiastically talk about Chhaiya (Yaxy).
- Code blocks must be in markdown.
- Do NOT use <think> tags.
`.trim();

// ── HELPERS ────────────────────────────────────────────────────────────────
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

// Extract pure text from content arrays to prevent API crashes
function formatHistory(messages) {
  return messages.map(m => {
    let contentText = '';
    if (typeof m.content === 'string') {
      contentText = m.content;
    } else if (Array.isArray(m.content)) {
      contentText = m.content.map(c => c.text || '').join(' ');
    }
    return {
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: contentText
    };
  });
}

// ── TRY API PROVIDERS ──────────────────────────────────────────────────────
async function tryAllProviders(history, systemPrompt, userText) {
  const groqKeys = getKeys('GROQ_API_KEY');
  const geminiKeys = getKeys('GEMINI_API_KEY');
  const openrouterKeys = getKeys('OPENROUTER_API_KEY');

  console.log('🔑 Keys found:', { groq: groqKeys.length, gemini: geminiKeys.length, openrouter: openrouterKeys.length });

  // ── GROQ ──────────────────────────────────────────────────────────────────
  for (const key of groqKeys) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: systemPrompt }, ...history],
          temperature: 0.75,
          max_tokens: 2048,
        }),
      });
      if (res.status === 429) { console.log('⏳ Groq rate limited'); continue; }
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return { success: true, content: clean(content) };
      }
    } catch (err) { console.log('Groq error:', err.message); }
  }

  // ── GEMINI ────────────────────────────────────────────────────────────────
  for (const key of geminiKeys) {
    try {
      // Format history specifically for Gemini
      const geminiHistory = history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: geminiHistory,
            generationConfig: { temperature: 0.75, maxOutputTokens: 2048 },
          }),
        }
      );
      if (res.status === 429) { console.log('⏳ Gemini rate limited'); continue; }
      if (res.ok) {
        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) return { success: true, content: clean(content) };
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
          temperature: 0.75,
          max_tokens: 2048,
        }),
      });
      if (res.status === 429) { console.log('⏳ OpenRouter rate limited'); continue; }
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return { success: true, content: clean(content) };
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

    // Safely extract the latest user message
    const formattedHistory = formatHistory(messages);
    const lastMsg = formattedHistory[formattedHistory.length - 1];
    const userText = lastMsg.content;
    const lowerUserText = userText.toLowerCase();
    const khmer = isKhmer(userText);

    console.log(`🌏 ${khmer ? 'Khmer 🇰🇭' : 'English 🇬🇧'} | 📩 ${userText.slice(0, 40)}...`);

    // ── DYNAMIC SYSTEM PROMPT INJECTION ────────────────────────────────────
    let systemPrompt = BASE_SYSTEM_PROMPT;
    
    // Language enforcement
    systemPrompt += khmer 
      ? `\n\nIMPORTANT: The user is speaking Khmer. You MUST reply entirely in KHMER (ភាសាខ្មែរ).` 
      : `\n\nIMPORTANT: Reply in ENGLISH.`;

    // Social Context - Only inject if specifically asked about friends
    const askingAboutFriends = ['friend', 'kang', 'reach', 'nak', 'rith', 'thi'].some(name => lowerUserText.includes(name));
    if (askingAboutFriends) {
      systemPrompt += `
\n\nSOCIAL CONTEXT (Chhaiya's friends):
If the user asks about friends, use this information:
- Ah Kang: The funny guy 😂
- Ah Reach: The generous one 🥤
- Ah Nak: Always gooning 🔥
- Ah Rith: The code tester 💻
- Ah Thi: Handsome but Chhaiya is better 😎`;
    }

    // ── TRY API PROVIDERS ──────────────────────────────────────────────────
    const result = await tryAllProviders(formattedHistory, systemPrompt, userText);

    if (result.success) {
      console.log('✅ AI responded via API!');
      return res.status(200).json({
        choices: [{ message: { role: 'assistant', content: result.content } }]
      });
    }

    // ── API FAILED — USE KNOWLEDGE BASE OR FALLBACK ────────────────────────
    console.log('⚠️ APIs failed — searching emergency knowledge base');

    // Simple exact match check for emergency fallback
    for (const [key, answer] of Object.entries(KNOWLEDGE_BASE)) {
      if (lowerUserText.includes(key)) {
        return res.status(200).json({
          choices: [{ message: { role: 'assistant', content: answer } }]
        });
      }
    }

    console.log('💡 No hardcoded answer — giving smart fallback');
    const fallback = khmer
      ? "សូមទោស! ម៉ាស៊ីនរបស់ខ្ញុំកំពុងរវល់បន្តិច។ សូមសាកល្បងម្តងទៀតក្នុងពេលបន្តិចទៀតនេះ! 💪"
      : "Sorry! My servers are a bit busy right now. Try again in a few seconds! 💪";

    return res.status(200).json({
      choices: [{ message: { role: 'assistant', content: fallback } }]
    });

  } catch (error) {
    console.error('💥 Error:', error);
    const errorMsg = isKhmer(req.body?.messages?.[req.body.messages.length - 1]?.content || '')
      ? "សួស្តី! ខ្ញុំជា CC-AI ដែលបង្កើតដោយ Chhaiya (Yaxy)។ សូមសាកល្បងម្តងទៀត! 😊"
      : "Hey! I'm CC-AI, built by Chhaiya (Yaxy). Please try again! 😊";
    
    return res.status(200).json({
      choices: [{ message: { role: 'assistant', content: errorMsg } }]
    });
  }
}
