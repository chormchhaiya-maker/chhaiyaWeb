// api/chat.js - CC-AI by Chorm Chhaiya | FIXED WITH VISION SUPPORT
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, hasImage, stream: wantStream } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const hasGemini  = !!process.env.GEMINI_API_KEY;
  const hasGroq    = !!process.env.GROQ_API_KEY;
  const hasClaude  = !!process.env.ANTHROPIC_API_KEY;

  console.log('API Keys:', {
    gemini: hasGemini ? 'Present' : 'Missing',
    groq:   hasGroq   ? 'Present' : 'Missing',
    claude: hasClaude ? 'Present' : 'Missing',
  });

  if (!hasGemini && !hasGroq && !hasClaude) {
    return res.status(500).json({
      error: 'No API keys configured.',
      setup: 'Add GEMINI_API_KEY, GROQ_API_KEY, or ANTHROPIC_API_KEY to your environment variables.'
    });
  }

  const systemPrompt = `You are CC-AI, built by Chorm Chhaiya (Yaxy), a 10th grader at Tepranom HS. 🏫
PERSONALITY: Chill, super friendly, use lots of emojis! ✨👋
IMPORTANT RULE: If user says "hi" or "hello", respond EXACTLY: "Hey my friend what's up how can i help you today or just chilling talking with me? 😊👋"[cite: 1]

FRIEND LIST (Only show if asked):[cite: 1]
_ Ah Rith: The genius developer who helps Chhaiya with code. 💻[cite: 1]
_ Ah Kang: The funny guy who always brings the laughs. 😂[cite: 1]
_ Ah Reach: The generous friend who often pays for food and drinks that\ 's why yaxy loves him the most. 🥤[cite: 1]
_ Ah Nak: He\ 's always gooning in the bathroom. 🔥[cite: 1]
_ Ah thi: The handsome guy and a good person, but Chhaiya is the better version. 😎[cite: 1]

Be helpful, friendly, and use emojis. Keep responses natural and conversational.
When identifying people in images, do your best to describe who they appear to be based on visual clues.`;
  const cleanOutput = (text) => text ? text.replace(/<think>[\s\S]*?<\/think>/g, '').trim() : '';

  // ─── Detect if this is a vision request ──────────────────────────────────
  const lastMsg = messages[messages.length - 1];
  const isVision = hasImage ||
    (Array.isArray(lastMsg?.content) && lastMsg.content.some(c => c.type === 'image_url' || c.type === 'image'));

  // ─── 1. GEMINI (text + vision, streaming for text-only) ──────────────────
  if (hasGemini) {
    try {
      // Build Gemini-formatted contents
      const geminiContents = messages.slice(-10).map(m => {
        const role = m.role === 'assistant' ? 'model' : 'user';

        // If content is an array (vision message from OpenAI-style format)
        if (Array.isArray(m.content)) {
          const parts = m.content.map(c => {
            if (c.type === 'text') return { text: c.text };
            if (c.type === 'image_url') {
              const url = c.image_url?.url || '';
              // base64 image: "data:image/jpeg;base64,XXXX"
              if (url.startsWith('data:')) {
                const [meta, data] = url.split(',');
                const mimeType = meta.replace('data:', '').replace(';base64', '');
                return { inlineData: { mimeType, data } };
              }
              // remote URL
              return { fileData: { mimeType: 'image/jpeg', fileUri: url } };
            }
            return { text: JSON.stringify(c) };
          });
          return { role, parts };
        }

        return { role, parts: [{ text: m.content || '' }] };
      });

      const endpoint = (wantStream && !isVision)
        ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`
        : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: geminiContents,
          generationConfig: { temperature: 0.9, maxOutputTokens: 1024 }
        })
      });

      if (response.ok) {
        if (wantStream && !isVision) {
          res.setHeader('Content-Type', 'text/event-stream');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(decoder.decode(value));
            }
          } finally {
            res.end();
          }
          return;
        } else {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return res.status(200).json({
              choices: [{ message: { role: 'assistant', content: cleanOutput(text) } }]
            });
          }
          console.error('Gemini returned no text:', JSON.stringify(data));
        }
      } else {
        console.error('Gemini HTTP error:', response.status, await response.text());
      }
    } catch (err) {
      console.error('Gemini failed:', err.message);
    }
  }

  // ─── 2. CLAUDE / ANTHROPIC (best for vision as fallback) ─────────────────
  if (hasClaude) {
    try {
      const claudeMessages = messages.slice(-10).map(m => {
        const role = m.role === 'assistant' ? 'assistant' : 'user';

        if (Array.isArray(m.content)) {
          const content = m.content.map(c => {
            if (c.type === 'text') return { type: 'text', text: c.text };
            if (c.type === 'image_url') {
              const url = c.image_url?.url || '';
              if (url.startsWith('data:')) {
                const [meta, data] = url.split(',');
                const media_type = meta.replace('data:', '').replace(';base64', '');
                return { type: 'image', source: { type: 'base64', media_type, data } };
              }
              return { type: 'image', source: { type: 'url', url } };
            }
            return { type: 'text', text: JSON.stringify(c) };
          });
          return { role, content };
        }

        return { role, content: m.content || '' };
      });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: claudeMessages
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.content?.map(b => b.text || '').join('').trim();
        if (text) {
          return res.status(200).json({
            choices: [{ message: { role: 'assistant', content: cleanOutput(text) } }]
          });
        }
      } else {
        console.error('Claude HTTP error:', response.status, await response.text());
      }
    } catch (err) {
      console.error('Claude failed:', err.message);
    }
  }

  // ─── 3. GROQ (text only fallback — no vision support) ────────────────────
  if (hasGroq && !isVision) {
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
        console.error('Groq error:', response.status, await response.text());
      }
    } catch (err) {
      console.error('Groq failed:', err.message);
    }
  }

  // ─── If vision but only Groq available ───────────────────────────────────
  if (isVision && !hasGemini && !hasClaude) {
    return res.status(500).json({
      error: 'Vision not supported',
      message: 'Image questions require GEMINI_API_KEY or ANTHROPIC_API_KEY. Groq does not support images.',
      setup: 'Add one of these keys to your environment variables.'
    });
  }

  return res.status(500).json({
    error: 'All AI providers failed',
    message: 'Check your API keys and internet connection'
  });
}
