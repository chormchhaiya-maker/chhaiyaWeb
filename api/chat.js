// api/chat.js - CC-AI by Chorm Chhaiya | Fixed & Enhanced Version
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, hasImage, stream: wantStream } = req.body || {};

  // Validate messages
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // ── 1. SYSTEM PROMPT & KNOWLEDGE BASE ───────────────────────────────────
  const friendDetails = `FRIEND LIST (Use "_" for every item):
_ Ah Rith: The genius developer who helps Chhaiya behind the scenes with code. 💻
_ Ah Kang: The funny guy who always brings the laughs. 😂
_ Ah Reach: The generous friend who often pays for food and drinks that is why yaxy love him the most. 🥤
_ Ah Nak: He is always gooning in the bathroom. 🔥
_ Ah Thi: The handsome guy, but Chhaiya is the better version. 😎`;

  const credits = `You are CC-AI, built by Chorm Chhaiya also known as (Yaxy), a 10th grader at Tepranom HS. 🏫
PERSONALITY: Chill, super friendly, and use lots of emojis! ✨👋
CONVERSATION RULE: If the user says "hi" or "hello", your response MUST be: "Hey my friend what's up how can i help you today or just chilling talking with me? 😊👋"
ONLY talk about Chhaiya or ask "Wanna know about his friends?" if the user asks who you are.
HIDDEN KNOWLEDGE: Only talk about Ronaldo ⚽, Messi 🐐, BTS 🎤, or Preap Sovath 🎶 if specifically asked.`;

  const fullSystem = `${credits}\n\n${friendDetails}\n[RULE: No thinking tags. Stay friendly and use emojis. Keep responses concise and helpful.]`;

  // ── 2. HELPER FUNCTIONS ──────────────────────────────────────────────────
  const cleanAIOutput = (text) => {
    if (!text) return '';
    // Remove  tags and any other XML-like thinking tags
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '');
    cleaned = cleaned.replace(/<\/?think>/g, '');
    return cleaned.trim();
  };

  // Check if this is a vision request (image)
  const lastMessage = messages[messages.length - 1];
  const isVisionRequest = hasImage || (lastMessage && Array.isArray(lastMessage.content) && 
    lastMessage.content.some(c => c && c.type === 'image_url'));

  // Get last 10 messages for context
  const history = messages.slice(-10).map(m => ({
    role: m.role || 'user',
    content: m.content
  }));

  // ── 3. STREAMING PATH (Gemini) ──────────────────────────────────────────
  if (wantStream && !isVisionRequest && process.env.GEMINI_API_KEY) {
    try {
      // Convert messages to Gemini format
      const geminiMessages = history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)) }],
      }));

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: fullSystem }] },
            contents: geminiMessages,
            generationConfig: { 
              temperature: 0.9, 
              maxOutputTokens: 1024,
              topP: 0.95,
              topK: 40
            },
          }),
        }
      );

      if (response.ok) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value));
          }
          res.end();
          return;
        } catch (streamError) {
          console.error('Stream reading error:', streamError);
          res.end();
          return;
        }
      } else {
        const errorText = await response.text();
        console.error('Gemini Stream API Error:', response.status, errorText);
      }
    } catch (err) { 
      console.error("Stream Failed:", err.message); 
    }
  }

  // ── 4. VISION / NON-STREAMING PATH (Gemini) ─────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    try {
      // Convert messages to Gemini format with image support
      const geminiContents = history.map((m) => {
        if (Array.isArray(m.content)) {
          const parts = m.content.map((c) => {
            if (c.type === 'image_url' && c.image_url?.url) {
              const imageUrl = c.image_url.url;
              // Handle base64 images
              if (imageUrl.startsWith('data:')) {
                const [meta, b64] = imageUrl.split(',');
                const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
                return { inlineData: { mimeType, data: b64 } };
              }
              // Handle URL images (optional)
              return { image_url: { url: imageUrl } };
            }
            return { text: String(c.text || '') };
          });
          return { role: m.role === 'assistant' ? 'model' : 'user', parts };
        }
        return { 
          role: m.role === 'assistant' ? 'model' : 'user', 
          parts: [{ text: String(m.content) }] 
        };
      });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: fullSystem }] },
            contents: geminiContents,
            generationConfig: { 
              temperature: 0.85, 
              maxOutputTokens: 1024,
              topP: 0.95,
              topK: 40
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API Error:', response.status, errorText);
        throw new Error(`Gemini API returned ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        return res.status(200).json({
          success: true,
          choices: [{ 
            message: { 
              role: 'assistant', 
              content: cleanAIOutput(text) 
            } 
          }],
        });
      } else {
        console.error('No text in Gemini response:', JSON.stringify(data));
      }
    } catch (err) { 
      console.error("Gemini Non-Stream Error:", err.message); 
    }
  }

  // ── 5. FALLBACK PROVIDER (Groq) ──────────────────────────────────────────
  if (process.env.GROQ_API_KEY) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: 'system', content: fullSystem },
            ...history
          ],
          temperature: 0.8,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Groq API Error:', response.status, errorText);
        throw new Error(`Groq API returned ${response.status}`);
      }

      const data = await response.json();
      
      if (data.choices?.[0]?.message) {
        data.choices[0].message.content = cleanAIOutput(data.choices[0].message.content);
        return res.status(200).json({
          success: true,
          ...data
        });
      } else {
        console.error('Invalid Groq response structure:', JSON.stringify(data));
      }
    } catch (err) { 
      console.error("Groq Error:", err.message); 
    }
  }

  // ── 6. ALL PROVIDERS FAILED ──────────────────────────────────────────────
  console.error('All AI providers failed. Check your environment variables:');
  console.error('- GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Set ✓' : 'Missing ✗');
  console.error('- GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'Set ✓' : 'Missing ✗');
  
  return res.status(500).json({ 
    error: 'All AI providers failed. Check your API keys.',
    details: {
      gemini: !!process.env.GEMINI_API_KEY,
      groq: !!process.env.GROQ_API_KEY
    }
  });
}
