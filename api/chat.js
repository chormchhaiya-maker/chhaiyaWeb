// ── Main Handler (With Deep Debugging) ──────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).end();

  const startTime = Date.now();
  let debugErrors = []; // Tracks exactly what goes wrong

  try {
    let reqBody = req.body;
    if (typeof reqBody === 'string') {
        try { reqBody = JSON.parse(reqBody); } catch(e) { reqBody = {}; }
    }
    const { messages, systemPrompt: clientSystemPrompt, hasImage, stream: wantStream } = reqBody || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Valid messages array is required' });
    }

    const lastMsg         = messages[messages.length - 1];
    const isVisionRequest = hasImage || (Array.isArray(lastMsg?.content) && lastMsg.content.some((c) => c.type === 'image_url'));
    const lastMsgText     = getMessageText(lastMsg);
    const detectedURLs    = extractURLs(lastMsgText);

    // ── URL fetching ──────────────────────────────────────────────────────────
    let urlContext = '';
    if (detectedURLs.length > 0) {
      const fetched = await Promise.all(detectedURLs.map(fetchURLContent));
      const results = detectedURLs
        .map((url, i) =>
          fetched[i]
            ? `[URL: ${url}]\n${fetched[i]}`
            : `[URL: ${url}]\nFailed to retrieve content.`
        )
        .join('\n\n---\n\n');
      urlContext = `\n\n=== WEBSITE CONTENT FOR ANALYSIS ===\n${results}\n=== END OF WEBSITE CONTENT ===`;
    }

    // ── Search context ────────────────────────────────────────────────────────
    const lowerMsgText    = lastMsgText.toLowerCase();
    const isSearchRequest =
      lowerMsgText.includes('search') ||
      lowerMsgText.includes('find')   ||
      lowerMsgText.includes('video')  ||
      lowerMsgText.includes('tutorial') ||
      lowerMsgText.includes('youtube');

    let searchContext = '';
    if (isSearchRequest && detectedURLs.length === 0) {
      try {
        const jinaSearchURL = `https://s.jina.ai/${encodeURIComponent(lastMsgText)}`;
        const controller    = new AbortController();
        const timeoutId     = setTimeout(() => controller.abort(), 5000);
        const searchRes     = await fetch(jinaSearchURL, {
          headers: { Accept: 'text/plain' },
          signal:  controller.signal,
        });
        clearTimeout(timeoutId);
        if (searchRes.ok) {
          const searchResultsText = await searchRes.text();
          searchContext = `\n\n=== LIVE WEB & VIDEO SEARCH RESULTS ===\n${searchResultsText.slice(0, 3000)}\n=== END OF LIVE SEARCH RESULTS ===`;
        }
      } catch (err) {
        console.log('Search fetch skipped:', err.message);
      }
    }

    // ── Process image uploads ─────────────────────────────────────────────────
    const processedMessages = await Promise.all(
      messages.map(async (m) => {
        if (!Array.isArray(m.content)) return m;
        const newContent = await Promise.all(
          m.content.map(async (c) => {
            if (c.type === 'image_url' && c.image_url?.url?.startsWith('data:')) {
              const publicUrl = await uploadToCloudflare(c.image_url.url);
              if (publicUrl) return { type: 'image_url', image_url: { url: publicUrl } };
            }
            return c;
          })
        );
        return { ...m, content: newContent };
      })
    );

    // ── Standardize history ───────────────────────────────────────────────────
    const standardizedHistory = [];
    for (const msg of processedMessages) {
      const role        = msg.role === 'model' || msg.role === 'assistant' ? 'assistant' : 'user';
      const textContent = getMessageText(msg);

      const hasText   = textContent && textContent.trim().length > 0;
      const hasImages = Array.isArray(msg.content) && msg.content.some((c) => c.type === 'image_url');
      if (!hasText && !hasImages) continue;

      if (standardizedHistory.length > 0 && standardizedHistory[standardizedHistory.length - 1].role === role) {
        const prevTurn = standardizedHistory[standardizedHistory.length - 1];
        if (Array.isArray(prevTurn.content) || Array.isArray(msg.content)) {
          const currentParts = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: textContent }];
          const prevParts    = Array.isArray(prevTurn.content) ? prevTurn.content : [{ type: 'text', text: String(prevTurn.content) }];
          prevTurn.content   = [...prevParts, ...currentParts];
        } else {
          prevTurn.content = String(prevTurn.content) + '\n\n' + textContent;
        }
      } else {
        standardizedHistory.push({
          role,
          content: Array.isArray(msg.content) ? msg.content : textContent,
        });
      }
    }

    if (standardizedHistory.length === 0) {
      return res.status(400).json({ error: 'No valid messages to process' });
    }

    const initialHistory = standardizedHistory.slice(isVisionRequest ? -60 : -150);
    let history          = trimHistoryByTokens(initialHistory, isVisionRequest ? 64000 : 128000);

    if (history.length === 0 && standardizedHistory.length > 0) {
      history = [standardizedHistory[standardizedHistory.length - 1]];
    }

    const userLang            = detectLanguage(lastMsgText);
    const languageInstruction = buildLanguageInstruction(userLang);

    const fullSystem = clientSystemPrompt
      ? `${BASE_SYSTEM_PROMPT}${languageInstruction}\n\n[Client Layer]:\n${clientSystemPrompt}${urlContext}${searchContext}`
      : `${BASE_SYSTEM_PROMPT}${languageInstruction}${urlContext}${searchContext}`;

    // ═══════════════════════════════════════════════════════════════════════════
    // STREAMING PATH
    // ═══════════════════════════════════════════════════════════════════════════
    if (wantStream && !isVisionRequest) {

      // ── Groq Streaming ──────────────────────────────────────────────────────
      if (process.env.GROQ_API_KEY) {
        const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        for (const model of groqModels) {
          try {
            const groqMessages = formatOpenAIHistory(fullSystem, history);
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization:  `Bearer ${process.env.GROQ_API_KEY}`,
              },
              body: JSON.stringify({
                model,
                messages:    groqMessages,
                temperature: 0.75,
                max_tokens:  16384,
                stream:      true,
              }),
            });

            if (!groqRes.ok) {
              const errTxt = await groqRes.text();
              throw new Error(`Status ${groqRes.status}: ${errTxt}`);
            }

            recordProviderUse('groq', true);
            res.setHeader('Content-Type',      'text/event-stream');
            res.setHeader('Cache-Control',     'no-cache');
            res.setHeader('X-Accel-Buffering', 'no');

            const reader  = groqRes.body.getReader();
            const decoder = new TextDecoder();
            let buffer    = '';
            const streamFilter = createStreamFilter();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer      = lines.pop();
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr || jsonStr === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(jsonStr);
                  const chunk  = parsed.choices?.[0]?.delta?.content || '';
                  const clean  = streamFilter(chunk);
                  if (clean) res.write(`data: ${JSON.stringify({ chunk: clean })}\n\n`);
                } catch (_) {}
              }
            }
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          } catch (err) {
            recordProviderUse('groq', false);
            debugErrors.push(`Groq Stream (${model}): ${err.message}`);
          }
        }
      } else { debugErrors.push("Groq skipped: GROQ_API_KEY is completely missing."); }

      // ── Gemini Streaming ────────────────────────────────────────────────────
      if (process.env.GEMINI_API_KEY) {
        try {
          const geminiMessages = formatGeminiHistory(history);
          if (geminiMessages.length > 0) {
            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
              {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  system_instruction: { parts: [{ text: fullSystem }] },
                  contents:           geminiMessages,
                  generationConfig:   { temperature: 0.75, maxOutputTokens: 16384 },
                }),
              }
            );

            if (!geminiRes.ok) {
              const errTxt = await geminiRes.text();
              throw new Error(`Status ${geminiRes.status}: ${errTxt}`);
            }

            recordProviderUse('gemini', true);
            res.setHeader('Content-Type',      'text/event-stream');
            res.setHeader('Cache-Control',     'no-cache');
            res.setHeader('X-Accel-Buffering', 'no');

            const reader  = geminiRes.body.getReader();
            const decoder = new TextDecoder();
            let buffer    = '';
            const streamFilter = createStreamFilter();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer      = lines.pop();
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr || jsonStr === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(jsonStr);
                  const chunk  = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  const clean  = streamFilter(chunk);
                  if (clean) res.write(`data: ${JSON.stringify({ chunk: clean })}\n\n`);
                } catch (_) {}
              }
            }
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }
        } catch (err) {
          recordProviderUse('gemini', false);
          debugErrors.push(`Gemini Stream: ${err.message}`);
        }
      } else { debugErrors.push("Gemini skipped: GEMINI_API_KEY is completely missing."); }

      // ── OpenRouter Streaming ────────────────────────────────────────────────
      if (process.env.OPENROUTER_API_KEY) {
        const openRouterModels = ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-2-9b-it:free'];
        for (const model of openRouterModels) {
          try {
            const orMessages = formatOpenAIHistory(fullSystem, history);
            const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization:  `Bearer ${process.env.OPENROUTER_API_KEY}`,
              },
              body: JSON.stringify({
                model,
                messages:    orMessages,
                temperature: 0.75,
                max_tokens:  16384,
                stream:      true,
              }),
            });

            if (!orRes.ok) {
              const errTxt = await orRes.text();
              throw new Error(`Status ${orRes.status}: ${errTxt}`);
            }

            recordProviderUse('openrouter', true);
            res.setHeader('Content-Type',      'text/event-stream');
            res.setHeader('Cache-Control',     'no-cache');
            res.setHeader('X-Accel-Buffering', 'no');

            const reader  = orRes.body.getReader();
            const decoder = new TextDecoder();
            let buffer    = '';
            const streamFilter = createStreamFilter();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer      = lines.pop();
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr || jsonStr === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(jsonStr);
                  const chunk  = parsed.choices?.[0]?.delta?.content || '';
                  const clean  = streamFilter(chunk);
                  if (clean) res.write(`data: ${JSON.stringify({ chunk: clean })}\n\n`);
                } catch (_) {}
              }
            }
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          } catch (err) {
            recordProviderUse('openrouter', false);
            debugErrors.push(`OpenRouter Stream (${model}): ${err.message}`);
          }
        }
      } else { debugErrors.push("OpenRouter skipped: OPENROUTER_API_KEY is completely missing."); }

      // Stream Debug Fallback response
      res.setHeader('Content-Type',      'text/event-stream');
      res.setHeader('Cache-Control',     'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
      const debugMsg = `⚠️ Connection Error!\n\nHere is why your keys aren't working:\n${debugErrors.map(e => `• ${e}`).join('\n')}\n\nPlease check your Vercel Environment Variables!`;
      res.write(`data: ${JSON.stringify({ chunk: debugMsg })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NON-STREAMING PATH
    // ═══════════════════════════════════════════════════════════════════════════

    // ── Groq Non-Stream ────────────────────────────────────────────────────────
    if (process.env.GROQ_API_KEY) {
      const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
      for (const model of groqModels) {
        try {
          const groqHistory = history.map((m) => ({
            role:    m.role === 'assistant' ? 'assistant' : 'user',
            content: typeof m.content === 'string' ? m.content : m.content.map((c) => c.text || '').join(' '),
          }));
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization:  `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({ model, messages: [{ role: 'system', content: fullSystem }, ...groqHistory], temperature: 0.75, max_tokens: 16384 }),
          });

          if (response.ok) {
            recordProviderUse('groq', true);
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) {
              data.choices[0].message.content = cleanAIOutput(content);
              return res.status(200).json(data);
            }
          } else {
            const errTxt = await response.text();
            debugErrors.push(`Groq Non-Stream (${model}): ${response.status} - ${errTxt}`);
          }
        } catch (err) {
          recordProviderUse('groq', false);
          debugErrors.push(`Groq Non-Stream Error (${model}): ${err.message}`);
        }
      }
    } else { debugErrors.push("Groq Non-Stream skipped: GROQ_API_KEY missing."); }

    // ── Gemini Non-Stream ──────────────────────────────────────────────────────
    if (process.env.GEMINI_API_KEY) {
      try {
        const geminiMessages = formatGeminiHistory(history);
        if (geminiMessages.length > 0) {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ system_instruction: { parts: [{ text: fullSystem }] }, contents: geminiMessages, generationConfig: { temperature: 0.75, maxOutputTokens: 16384 } }),
            }
          );

          if (response.ok) {
            recordProviderUse('gemini', true);
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              return res.status(200).json({ choices: [{ message: { role: 'assistant', content: cleanAIOutput(text) } }] });
            }
          } else {
            const errTxt = await response.text();
            debugErrors.push(`Gemini Non-Stream: ${response.status} - ${errTxt}`);
          }
        }
      } catch (err) {
        recordProviderUse('gemini', false);
        debugErrors.push(`Gemini Non-Stream Error: ${err.message}`);
      }
    } else { debugErrors.push("Gemini Non-Stream skipped: GEMINI_API_KEY missing."); }

    // Final Fallback with detailed error diagnostics if everything else fails
    const diagnosticMessage = `⚠️ Server Connection Issues!\n\nAll AI servers failed to connect. Here are the system logs:\n${debugErrors.map(e => `• ${e}`).join('\n')}\n\nPlease check your server credentials.`;
    return res.status(200).json({
      choices: [{ message: { role: 'assistant', content: diagnosticMessage } }],
    });

  } catch (error) {
    return res.status(200).json({
      choices: [{ message: { role: 'assistant', content: `💥 Fatal Handler Error: ${error.message}` } }],
    });
  }
}
