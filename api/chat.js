// api/chat.js - CC-AI by Chorm Chhaiya | SIMPLIFIED & FIXED
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, hasImage, stream: wantStream } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // Check if API keys exist
  const hasGemini = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 0;
  const hasGroq = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.length > 0;

  console.log('API Keys status:', { 
    gemini: hasGemini ? 'Present' : 'Missing', 
    groq: hasGroq ? 'Present' : 'Missing' 
  });

  if (!hasGemini && !hasGroq) {
    return res.status(500).json({ 
      error: 'No API keys configured. Please add GEMINI_API_KEY or GROQ_API_KEY to your environment variables.',
      setup: 'Get free keys from: https://aistudio.google.com/apikey or https://console.groq.com/keys'
    });
  }

  // System prompt for CC-AI
  const systemPrompt = `You are CC-AI, built by Chorm Chhaiya (Yaxy), a 10th grader at Tepranom HS. 🏫
PERSONALITY: Chill, super friendly, use lots of emojis! ✨👋
IMPORTANT RULE: If user says "hi" or "hello", respond EXACTLY: "Hey my friend what's up how can i help you today or just chilling talking with me? 😊👋"
Be helpful, friendly, and use emojis. Keep responses natural and conversational.`;

  // Helper to clean AI output
  const cleanOutput = (text) => {
    if (!text) return '';
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  };

  // Try Gemini first (better for vision/streaming)
  if (hasGemini) {
    try {
      // Prepare messages for Gemini
      const geminiMessages = messages.slice(-10).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
      }));

      // Check if this is a vision request
      const isVision = hasImage || (messages[messages.length-1]?.content?.some?.(c => c.type === 'image_url'));
      
      // Use streaming or regular
      const endpoint = wantStream && !isVision 
        ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`
        : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: geminiMessages,
          generationConfig: { temperature: 0.9, maxOutputTokens: 1024 }
        })
      });

      if (response.ok) {
        if (wantStream && !isVision) {
          // Handle streaming
          res.setHeader('Content-Type', 'text/event-stream');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(decoder.decode(value));
            }
            res.end();
          } catch(e) {
            res.end();
          }
          return;
        } else {
          // Handle regular response
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return res.status(200).json({
              choices: [{ message: { role: 'assistant', content: cleanOutput(text) } }]
            });
          }
        }
      } else {
        const errorText = await response.text();
        console.error('Gemini error:', response.status, errorText);
      }
    } catch (err) {
      console.error('Gemini failed:', err.message);
    }
  }

  // Try Groq as fallback
  if (hasGroq) {
    try {
      const history = messages.slice(-10).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      }));

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: systemPrompt }, ...history],
          temperature: 0.8,
          max_tokens: 1024
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.choices?.[0]?.message) {
          data.choices[0].message.content = cleanOutput(data.choices[0].message.content);
          return res.status(200).json(data);
        }
      } else {
        const errorText = await response.text();
        console.error('Groq error:', response.status, errorText);
      }
    } catch (err) {
      console.error('Groq failed:', err.message);
    }
  }

  // If we get here, both providers failed
  return res.status(500).json({ 
    error: 'Both AI providers failed',
    gemini_available: hasGemini,
    groq_available: hasGroq,
    message: 'Check your API keys and internet connection'
  });
}
