// api/chat.js - CC-AI by ChormChhaiya | Groq → Gemini → OpenRouter + Cloudflare Images
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

  // ── Clean AI output ───────────────────────────────────────────────────────
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

  // ── Upload image to Cloudflare Images (if base64 present) ────────────────
  // Returns a public URL string, or null if not applicable / fails
  const uploadToCloudflare = async (base64DataUrl) => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_IMAGES_TOKEN;
    if (!accountId || !apiToken || !base64DataUrl?.startsWith('data:')) return null;

    try {
      const [meta, b64] = base64DataUrl.split(',');
      const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpg';

      // Convert base64 to Blob
      const byteChars = atob(b64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: mimeType });

      const formData = new FormData();
      formData.append('file', blob, `upload.${ext}`);

      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiToken}` },
          body: formData,
        }
      );

      const cfData = await cfRes.json();
      if (cfData.success && cfData.result?.variants?.[0]) {
        return cfData.result.variants[0]; // public URL
      }
      console.error('Cloudflare Images upload failed:', JSON.stringify(cfData.errors));
      return null;
    } catch (err) {
      console.error('Cloudflare Images error:', err.message);
      return null;
    }
  };

  // ── Pre-process messages: upload base64 images to Cloudflare ─────────────
  // This converts inline base64 → public URL so all providers can use it
  const processedMessages = await Promise.all(
    messages.map(async (m) => {
      if (!Array.isArray(m.content)) return m;
      const newContent = await Promise.all(
        m.content.map(async (c) => {
          if (c.type === 'image_url' && c.image_url?.url?.startsWith('data:')) {
            const publicUrl = await uploadToCloudflare(c.image_url.url);
            if (publicUrl) {
              return { type: 'image_url', image_url: { url: publicUrl } };
            }
            // Keep original base64 if upload failed (Gemini can handle it)
          }
          return c;
        })
      );
      return { ...m, content: newContent };
    })
  );

  // ── Build message history (cap size) ─────────────────────────────────────
  const history = isVisionRequest
    ? processedMessages.slice(-5).map((m) => ({
        role: m.role,
        content: Array.isArray(m.content)
          ? m.content.map((c) =>
              c.type === 'image_url'
                ? c
                : { ...c, text: String(c.text || '').slice(0, 2000) }
            )
          : String(m.content).slice(0, 2000),
      }))
    : processedMessages.slice(-10).map((m) => ({
        role: m.role || 'user',
        content: String(m.content).slice(0, 3000),
      }));

  // ── Build system prompt ───────────────────────────────────────────────────
  const friendDetails =
    'FRIEND LIST (Only show if asked)(always use this line when ask):\n' +
    '_ Ah Kang: The funny guy who always brings the laughs.\n' +
    '_ Ah Reach: The one who yaxy loves the most and he always paying foods and drinks that why yaxy loves him the most.\n' +
    '_ Ah Nak: The only one who goon 100times/day like even yaxy can\'t stop him.\n' +
    '_ Ah Rith: who helps Chhaiya behind the work.\n' +
    '_ Ah thi: The only one who is the most handsome guy but chhaiya is better version.';

  const credits =
    'If asked about the creator, say: "Chhaiya (Chorm Chhaiya) or you can call him Yaxy is a 10th grader from Tepranom High School who built me, that is why I never forget him and always be a grateful AI talking with you right now." ' +
    'After the first time you mention Chhaiya, ask: "Wanna know about his friends?" ' +
    'DO NOT repeat this question if the user is already talking about something else.';

  const basePrompt =
    (systemPrompt || 'CC-AI by ChormChhaiya, G10 Tepranom HS Cambodia. 2026. Friendly.') +
    ' ' + credits +
    ' [RULE: Use proper punctuation like "." and ",". Only use "_" for the friend list. Do not be repetitive. No thinking tags.]';

  const knowledge =
    'KNOW:MJordan,PreapSovath,BTS,Ronaldo,Messi,TaylorSwift.MEMES:Brainrot,TungTungTungSahur,7x7=49,Ampersand,BratSummer,Skibidi,Ohio,Rizz,Sigma.';

  const fullSystem = isVisionRequest
    ? 'CC-AI vision assistant. Describe images precisely and helpfully.'
    : `${basePrompt} ${knowledge} ${friendDetails}`;

  // ─────────────────────────────────────────────────────────────────────────
  // STREAMING PATH — Gemini streaming (text only)
  // ─────────────────────────────────────────────────────────────────────────
  if (wantStream && !isVisionRequest && process.env.GEMINI_API_KEY) {
    let streamStarted = false;
    try {
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

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        throw new Error(`Gemini stream ${geminiRes.status}: ${errText}`);
      }

      // Only commit to SSE after we know the upstream is healthy
      streamStarted = true;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');

      const reader = geminiRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (chunk) {
              const clean = chunk.replace(/<think>[\s\S]*?<\/think>/g, '');
              if (clean) res.write(`data: ${JSON.stringify({ chunk: clean })}\n\n`);
            }
          } catch (_) {}
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
      return;
    } catch (streamErr) {
      console.error('Gemini stream error:', streamErr.message);
      // Only fall through if we haven't committed to SSE yet
      if (streamStarted) {
        try { res.write('data: [DONE]\n\n'); res.end(); } catch (_) {}
        return;
      }
      // else: fall through to non-streaming path below
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NON-STREAMING PATH
  // ─────────────────────────────────────────────────────────────────────────

  // ── GEMINI FIRST for vision (most reliable with images) ──────────────────
  if (isVisionRequest && process.env.GEMINI_API_KEY) {
    try {
      const geminiContents = history.map((m) => {
        if (Array.isArray(m.content)) {
          const parts = m.content.map((c) => {
            if (c.type === 'image_url') {
              const url = c.image_url?.url || '';
              if (url.startsWith('data:')) {
                const [meta, b64] = url.split(',');
                const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
                return { inlineData: { mimeType, data: b64 } };
              }
              // Public URL — use fileData (works with Cloudflare Images URLs)
              return { text: `[Image URL: ${url}]` };
            }
            return { text: String(c.text || '') };
          });
          return { role: m.role === 'assistant' ? 'model' : 'user', parts };
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
          choices: [{ message: { role: 'assistant', content: cleanAIOutput(text) } }],
        });
      }
      console.error('Gemini vision empty response:', JSON.stringify(data));
    } catch (err) {
      console.error('Gemini vision error:', err.message);
    }
  }

  // ── GROQ (text; vision as fallback only) ─────────────────────────────────
  if (process.env.GROQ_API_KEY) {
    const groqModels = isVisionRequest
      ? ['meta-llama/llama-4-scout-17b-16e-instruct'] // newer vision model
      : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

    for (const model of groqModels) {
      try {
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

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: fullSystem }, ...groqHistory],
            temperature: 0.75,
            max_tokens: 1024,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          console.error(`Groq ${model} error:`, data?.error?.message);
          continue;
        }
        let content = data.choices?.[0]?.message?.content;
        if (content) {
          data.choices[0].message.content = cleanAIOutput(content);
          return res.status(200).json(data);
        }
      } catch (err) {
        console.error(`Groq ${model} exception:`, err.message);
        continue;
      }
    }
  }

  // ── GEMINI (non-streaming text fallback) ──────────────────────────────────
  if (!isVisionRequest && process.env.GEMINI_API_KEY) {
    try {
      const geminiMessages = history.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content) }],
      }));

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return res.status(200).json({
          choices: [{ message: { role: 'assistant', content: cleanAIOutput(text) } }],
        });
      }
      console.error('Gemini text fallback empty:', JSON.stringify(data));
    } catch (err) {
      console.error('Gemini text fallback error:', err.message);
    }
  }

  // ── OPENROUTER (final fallback) ───────────────────────────────────────────
  if (process.env.OPENROUTER_API_KEY) {
    const openRouterModels = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemma-3-27b-it:free',
    ];
    for (const model of openRouterModels) {
      try {
        const orHistory = history.map((m) => ({
          role: m.role || 'user',
          content: Array.isArray(m.content)
            ? m.content.map((c) => c.text || '').join(' ')
            : String(m.content),
        }));

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: fullSystem }, ...orHistory],
            temperature: 0.75,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          console.error(`OpenRouter ${model} error:`, data?.error?.message);
          continue;
        }
        let content = data.choices?.[0]?.message?.content;
        if (content) {
          data.choices[0].message.content = cleanAIOutput(content);
          return res.status(200).json(data);
        }
      } catch (err) {
        console.error(`OpenRouter ${model} exception:`, err.message);
        continue;
      }
    }
  }

  return res.status(500).json({ error: 'All AI providers failed. Check server logs for details.' });
}
