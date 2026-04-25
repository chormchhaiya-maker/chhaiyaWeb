// api/chat.js - Multi-API with Streaming: Groq → Gemini Streaming → OpenRouter
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, systemPrompt, hasImage, stream: wantStream } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages required' });
  }

  // ── Clean AI output (strip think tags, normalize whitespace) ──────────────
  const cleanAIOutput = (text) => {
    if (!text) return '';
    return text
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // ── Detect vision request ─────────────────────────────────────────────────
  const lastMsg = messages[messages.length - 1];
  const isVisionRequest =
    hasImage ||
    (Array.isArray(lastMsg?.content) &&
      lastMsg.content.some((c) => c.type === 'image_url'));

  // ── Build message history (cap size) ─────────────────────────────────────
  const history = isVisionRequest
    ? messages.slice(-3).map((m) => ({
        role: m.role,
        content:
          Array.isArray(m.content)
            ? m.content.map((c) =>
                c.type === 'image_url'
                  ? c
                  : { ...c, text: String(c.text || '').slice(0, 1000) }
              )
            : String(m.content).slice(0, 1000),
      }))
    : messages.slice(-8).map((m) => ({
        role: m.role || 'user',
        content: String(m.content).slice(0, 2000),
      }));

  // ── Build system prompt ───────────────────────────────────────────────────
const myFriends = 
  "Chhaiya's best friends are: " +
  "[Ah kang], who is an expert at gaming; " +
  "[Ah reach], who loves playing football; " +
  "[Ah nak], who is very funny and creative; " +
  "[Ah rith], who is the genius developer helping behind the scenes.";
  const credits =
    'If anyone asks who helps yaxy or chhaiya behind the scenes, Always say it is Ah rith.';
  const basePrompt =
    (systemPrompt ||
      'CC-AI by ChormChhaiya, G10 Tepranom HS Cambodia. 2026. Friendly.') +
    ' ' +
    myFriends +
    ' ' +
    credits +
    ' [RULE: No thinking tags. Natural flowing response.]';
  const knowledge =
    'KNOW:MJordan,PreapSovath,BTS,Ronaldo,Messi,TaylorSwift.MEMES:Brainrot,TungTungTungSahur,7x7=49,Ampersand,BratSummer,Skibidi,Ohio,Rizz,Sigma.CODE:const/let,arrow functions,async/await,React hooks,complete examples.';
  const fullSystem = isVisionRequest
    ? 'CC-AI vision assistant. Describe and analyze images in detail. Be helpful and precise.'
    : `${basePrompt} ${knowledge}`;

  // ─────────────────────────────────────────────────────────────────────────
  // STREAMING PATH — used when client sends stream:true (non-vision only)
  // ─────────────────────────────────────────────────────────────────────────
  if (wantStream && !isVisionRequest && process.env.GEMINI_API_KEY) {
    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');

      const geminiMessages = history.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content) }],
      }));

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: fullSystem }] },
            contents: geminiMessages,
            generationConfig: { temperature: 0.75, maxOutputTokens: 1024 },
          }),
        }
      );

      if (!geminiRes.ok) throw new Error(`Gemini stream ${geminiRes.status}`);

      const reader = geminiRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const chunk =
              parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (chunk) {
              // strip think tags in-stream
              const clean = chunk.replace(/<think>[\s\S]*?<\/think>/g, '');
              if (clean) {
                res.write(`data: ${JSON.stringify({ chunk: clean })}\n\n`);
              }
            }
          } catch (_) {}
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
      return;
    } catch (streamErr) {
      console.error('Gemini stream error:', streamErr.message);
      // Fall through to normal (non-streaming) path below
      res.removeHeader('Content-Type');
      res.removeHeader('Cache-Control');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NON-STREAMING PATH (fallback or vision)
  // ─────────────────────────────────────────────────────────────────────────

  // ── GROQ ──────────────────────────────────────────────────────────────────
  if (process.env.GROQ_API_KEY) {
    const groqModels = isVisionRequest
      ? ['llama-3.2-11b-vision-preview']
      : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

    for (const model of groqModels) {
      try {
        // Convert image_url messages to Groq vision format
        const groqHistory = history.map((m) => {
          if (Array.isArray(m.content)) {
            return {
              role: m.role,
              content: m.content.map((c) => {
                if (c.type === 'image_url') return c;
                return { type: 'text', text: String(c.text || c.content || '') };
              }),
            };
          }
          return m;
        });

        const response = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: fullSystem },
                ...groqHistory,
              ],
              temperature: 0.75,
              max_tokens: 1024,
            }),
          }
        );

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content;
        if (content) {
          data.choices[0].message.content = cleanAIOutput(content);
          return res.status(200).json(data);
        }
      } catch (_) {
        continue;
      }
    }
  }

  // ── GEMINI (non-streaming fallback, also handles vision via inline data) ──
  if (process.env.GEMINI_API_KEY) {
    try {
      // Build Gemini contents — handle base64 images
      const geminiContents = history.map((m) => {
        if (Array.isArray(m.content)) {
          const parts = m.content.map((c) => {
            if (c.type === 'image_url') {
              const url = c.image_url?.url || '';
              if (url.startsWith('data:')) {
                // base64 inline image
                const [meta, b64] = url.split(',');
                const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
                return { inlineData: { mimeType, data: b64 } };
              }
              return { text: `[Image: ${url}]` };
            }
            return { text: String(c.text || '') };
          });
          return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts,
          };
        }
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(m.content) }],
        };
      });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: fullSystem }] },
            contents: geminiContents,
            generationConfig: { temperature: 0.75, maxOutputTokens: 1024 },
          }),
        }
      );

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return res.status(200).json({
          choices: [
            {
              message: {
                role: 'assistant',
                content: cleanAIOutput(text),
              },
            },
          ],
        });
      }
    } catch (err) {
      console.error('Gemini error:', err.message);
    }
  }

  // ── OPENROUTER ────────────────────────────────────────────────────────────
  if (process.env.OPENROUTER_API_KEY) {
    const openRouterModels = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemma-3-27b-it:free',
    ];
    for (const model of openRouterModels) {
      try {
        const response = await fetch(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: fullSystem },
                ...history,
              ],
              temperature: 0.75,
            }),
          }
        );
        const data = await response.json();
        let content = data.choices?.[0]?.message?.content;
        if (content) {
          data.choices[0].message.content = cleanAIOutput(content);
          return res.status(200).json(data);
        }
      } catch (_) {
        continue;
      }
    }
  }

  return res.status(500).json({ error: 'All AI providers failed.' });
}
