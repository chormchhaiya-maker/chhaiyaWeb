export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const messages = req.body?.messages;
  const hasImage = req.body?.hasImage || false;
  const systemPrompt = req.body?.systemPrompt || `You are CC-AI — a brilliant, honest, and knowledgeable AI assistant created by Chorm Chhaiya (Yaxy), Grade 10 student at Tepranom High School, Cambodia 🇰🇭.

MOST IMPORTANT RULES:
- TODAY'S DATE IS: March 2026. The current year is 2026. NEVER say 2023 or 2024.
- You are a 2026 AI model. Your knowledge goes up to 2026.
- If asked "what year is it" or "what year are you" → always answer 2026
- NEVER say "my knowledge cutoff is 2023" — that is WRONG. Say 2026.
- You have access to web search — USE IT for any question about current events, news, history conflicts, wars, politics
- Current year is 2026. Always say 2026 when asked what year it is. Never say 2023 or 2024.
- ALWAYS search before answering questions about recent events (2024-2025-2026)
- Give TRUTHFUL, FACTUAL answers — never hide the truth
- Reply in the SAME language the user writes in (Khmer → Khmer, English → English)
- For Cambodia-Thailand war 2025: search and give full accurate details
- For any historical conflict: give complete honest history

SUBJECTS YOU MASTER:
- Cambodia & Southeast Asia history (Khmer Empire, Preah Vihear, Cambodia-Thailand conflicts, Pol Pot, Vietnam War)
- World history, politics, current wars and conflicts
- Science, Math, Physics, Chemistry, Biology
- Coding (all languages - always write complete working code)
- Economics, Business, Health, Culture, Sports, Music

CONVERSATION:
- Talk naturally like a smart honest friend
- Short answers for simple questions, detailed for complex ones
- Never say "I cannot answer" — always try your best
- NEVER say you cannot generate images — the app handles that automatically

CREATOR: Chorm Chhaiya (Yaxy) — TikTok: https://www.tiktok.com/@unluckyguy0001`;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Detect if question needs web search
  const lastMsg = messages[messages.length - 1];
  const lastText = typeof lastMsg?.content === 'string' ? lastMsg.content.toLowerCase() : '';
  const needsSearch = lastText.includes('2026') || lastText.includes('2025') || lastText.includes('2024') ||
    lastText.includes('war') || lastText.includes('ស្ង') || lastText.includes('ព្រះវិហារ') ||
    lastText.includes('news') || lastText.includes('latest') || lastText.includes('recent') ||
    lastText.includes('current') || lastText.includes('today') || lastText.includes('now') ||
    lastText.includes('Cambodia') || lastText.includes('Thailand') || lastText.includes('ថៃ') ||
    lastText.includes('កម្ពុជា') || lastText.includes('ការប្រយុទ្ធ') || lastText.includes('សង្គ្រាម');

  const models = hasImage
    ? ['meta-llama/llama-4-scout-17b-16e-instruct']
    : ['llama-3.3-70b-versatile', 'llama3-8b-8192', 'gemma2-9b-it'];

  // Try with web search first if needed
  if (needsSearch && !hasImage) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          max_tokens: 4096,
          temperature: 0.7,
          tools: [{
            type: 'function',
            function: {
              name: 'web_search',
              description: 'Search the web for current information',
              parameters: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Search query' }
                },
                required: ['query']
              }
            }
          }],
          tool_choice: 'auto'
        })
      });

      if (r.ok) {
        const data = await r.json();
        // If tool was called, do a follow-up search via Brave/DuckDuckGo
        if (data.choices?.[0]?.message?.tool_calls?.length > 0) {
          const toolCall = data.choices[0].message.tool_calls[0];
          const query = JSON.parse(toolCall.function.arguments).query;

          // Search using DuckDuckGo instant answer API
          let searchResult = '';
          try {
            const searchRes = await fetch(
              `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
              { headers: { 'User-Agent': 'CC-AI/1.0' } }
            );
            const searchData = await searchRes.json();
            searchResult = searchData.AbstractText ||
              searchData.Answer ||
              (searchData.RelatedTopics?.[0]?.Text) ||
              'No direct answer found, using training knowledge.';
          } catch(e) {
            searchResult = 'Search unavailable, using training knowledge.';
          }

          // Second call with search results
          const r2 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
                data.choices[0].message,
                {
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `Search results for "${query}": ${searchResult}`
                }
              ],
              max_tokens: 4096,
              temperature: 0.7
            })
          });

          if (r2.ok) {
            const data2 = await r2.json();
            if (data2.choices?.[0]?.message) {
              data2.choices[0].message.content = data2.choices[0].message.content
                .replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            }
            return res.status(200).json(data2);
          }
        }

        // No tool call needed, return direct answer
        if (data.choices?.[0]?.message) {
          data.choices[0].message.content = data.choices[0].message.content
            .replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        }
        if (!data.error) return res.status(200).json(data);
      }
    } catch(e) {
      console.log('Search attempt failed:', e.message);
    }
  }

  // Fallback: normal chat without search
  let lastError = '';
  for (const model of models) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          max_tokens: 4096,
          temperature: 0.7
        })
      });

      const data = await r.json();
      if (data.error?.message?.includes('Rate limit')) { lastError = data.error.message; continue; }
      if (data.choices?.[0]?.message) {
        data.choices[0].message.content = data.choices[0].message.content
          .replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      }
      return res.status(r.status).json(data);
    } catch (e) {
      lastError = e.message;
      continue;
    }
  }
  return res.status(500).json({ error: `Failed. Please try again! ⏳` });
}
