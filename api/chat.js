// api/chat.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, systemPrompt, hasImage } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const lastMsg = messages[messages.length - 1];
  const isVisionRequest = hasImage || 
    (Array.isArray(lastMsg?.content) && lastMsg.content.some(c => c.type === 'image_url'));

  // Process history
  let history = isVisionRequest 
    ? messages.slice(-5).map((m, i, arr) => {
        if (i < arr.length - 1 && Array.isArray(m.content)) {
          return { role: m.role, content: m.content.find(c => c.type === 'text')?.text || '' };
        }
        return m;
      })
    : messages.slice(-10).map(m => ({
        role: m.role || 'user',
        content: String(m.content).slice(0, 1500)
      }));

  const lastMsgText = Array.isArray(lastMsg?.content) 
    ? lastMsg.content.find(c => c.type === 'text')?.text || '' 
    : String(lastMsg?.content || '');

  const lastMsgLower = lastMsgText.toLowerCase();

  // News detection
  const isNewsRequest = !isVisionRequest && (
    /news|today|latest|current|2024|2025|2026/i.test(lastMsgLower) &&
    /cambodia|thailand|war|conflict|border|hun manet/i.test(lastMsgLower)
  );

  let newsBlock = '';
  if (isNewsRequest) {
    try {
      const baseUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
      const r = await fetch(`${baseUrl}/api/news?q=Cambodia+Thailand+border+conflict`);
      if (r.ok) {
        const data = await r.json();
        const articles = (data.articles || []).slice(0, 3);
        if (articles.length > 0) {
          newsBlock = '\n\nLIVE NEWS:\n' + articles.map((a, i) => 
            `[${i+1}] ${a.title} | ${a.source?.name || 'Unknown'} | ${a.publishedAt?.slice(0,10) || 'unknown'}`
          ).join('\n');
        }
      }
    } catch (e) {
      console.log('News fetch error:', e.message);
    }
  }

  // Full knowledge base - NOT compressed
  const knowledgeBase = `
KNOWLEDGE BASE:

[CELEBRITIES]
- Michael Jordan: greatest basketball player, Chicago Bulls, 6 NBA championships
- Preap Sovath: "King of Khmer music", most famous Cambodian male singer
- BTS: Korean boyband (Jungkook, V, Jimin, Jin, Suga, RM, J-Hope)
- Blackpink: Korean girl group (Jennie, Lisa, Rose, Jisoo)
- Cristiano Ronaldo (CR7): Portuguese footballer, Al Nassr
- Lionel Messi: Argentine footballer, Inter Miami, 8 Ballon d'Or
- Taylor Swift: biggest pop star right now
- Drake: Canadian rapper

[TIKTOK MEMES & BRAINROT]
- "Brainrot": Being so deep into TikTok/internet culture that you feel your brain is "rotting" from chaotic content
- "Tung Tung Tung Sahur": Indonesian meme with guy hitting drum for sahur (pre-dawn Ramadan meal), viral sound
- "7×7=49": Woman said she finds this equation inexplicably attractive, became "hear me out" trend
- "Ampersand (&)": Symbol people find weirdly attractive for no reason
- "Hear me out": Confessing attraction to non-human things (objects, concepts, numbers)
- "Brat summer": 2024 trend from Charli XCX album - lime green, messy, carefree
- "Very mindful, very demure": 2024 trend about being modest and proper
- "Roman Empire": Women asking men how often they think about Roman Empire
- "Girl dinner": Eating random snacks as a meal
- "Rat girl summer": Embracing chaos, staying up late, eating snacks
- "Skibidi": From "Skibidi Toilet" series - nonsense Gen Alpha humor
- "Ohio": Weird, unexplainable, cringe situations
- "Rizz": Charisma/ability to attract partners
- "Sigma": Lone wolf, independent successful personality
- "Mewing": Jawline exercise for better looks
- "Looksmaxxing": Improving appearance (softmaxxing = non-surgical, hardmaxxing = surgical)
- "Mogging": Dominating someone in looks
- "Ate and left no crumbs": Did an amazing job, flawless
- "It's giving ___": Describing the vibe/aesthetic
- "Slay": Doing something impressively well
- "Gatekeep": Keeping something exclusive
- "Rent free": Can't stop thinking about something
- "Caught in 4K": Caught with clear evidence
- "Understood the assignment": Did exactly what was expected perfectly
- "Vibe check": Assessing someone's energy/mood

[CAMBODIA-THAILAND CONFLICT 2025]
- July-August 2025: Military clashes on northwestern border near Preah Vihear and Ta Moan Thom temples
- Both sides exchanged artillery, casualties and civilian displacement
- Worst fighting since 2008-2011 Preah Vihear standoff
- ASEAN called for ceasefire. Fragile ceasefire late August 2025
- Preah Vihear temple awarded to Cambodia by ICJ in 1962, but surrounding land disputed
- Hun Manet became Cambodia PM in August 2023, succeeding Hun Sen

[CODING BEST PRACTICES]
- Write clean, well-commented code
- HTML: Use semantic tags, CSS animations (@keyframes, transform, transition), flexbox/grid for layout, responsive design
- JavaScript: Use const/let (not var), async/await for async code, proper error handling with try-catch, DOM manipulation best practices
- React: Use functional components, hooks (useState, useEffect), props destructuring
- Always provide complete working examples with explanations
- Validate all inputs, never trust user data
`;

  // Full system prompt - NOT compressed
  const basePrompt = systemPrompt || `You are CC-AI, a smart friendly AI assistant made by Chorm Chhaiya (Yaxy), a Grade 10 student at Tepranom High School in Cambodia.

Today is 2026. You are a 2026 AI with current knowledge. Never say your knowledge cutoff is 2023 or earlier.

Reply in the SAME language the user writes in. If they write in Khmer, reply in Khmer. If they write in English, reply in English.

Talk naturally like a real friend, not like a formal robot. Use the knowledge provided above to answer questions.

NEVER say "I don't have information" or "AI temporarily unavailable" - always try to help using what you know.

When writing code:
- Provide complete, working examples
- Add comments explaining key parts
- Use modern best practices
- Test your logic mentally before responding`;

  const fullSystem = isVisionRequest 
    ? `You are CC-AI with vision capabilities made by Chorm Chhaiya (Yaxy).

Describe images clearly and in detail. If the image contains text (exams, worksheets, documents), read and transcribe it accurately. If it's a test or exercise, provide answers with explanations. If it's a photo of a person or place, describe what you see. Answer any specific questions about the image.

Reply in the user's language.`
    : (basePrompt + knowledgeBase + newsBlock);

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Missing GROQ_API_KEY environment variable' });
  }

  // Models to try
  const models = isVisionRequest 
    ? ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct']
    : ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama3-70b-8192', 'llama3-8b-8192'];

  // Try each model with rate limit handling
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    
    try {
      console.log(`Trying model: ${model}`);
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: fullSystem }, ...history],
          temperature: 0.7,
          max_completion_tokens: 4000,
          top_p: 0.9
        })
      });

      // Handle rate limit (429)
      if (response.status === 429) {
        console.log(`${model} rate limited (429)`);
        
        // If this is the last model, return error
        if (i === models.length - 1) {
          return res.status(429).json({
            error: 'Rate limit reached. Please wait 10-20 seconds and try again. All models are busy.'
          });
        }
        
        // Otherwise wait and try next model
        console.log('Waiting 1 second before trying next model...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${model} HTTP ${response.status}: ${errorText}`);
        
        // If last model, return error
        if (i === models.length - 1) {
          return res.status(response.status).json({
            error: `Groq API error: ${response.status}. ${errorText}`
          });
        }
        continue; // Try next model
      }

      const data = await response.json();

      if (data.choices?.[0]?.message?.content) {
        console.log(`Success with ${model}`);
        return res.status(200).json(data);
      }

    } catch (err) {
      console.error(`${model} error:`, err.message);
      
      // If last model, return error
      if (i === models.length - 1) {
        return res.status(500).json({
          error: `All models failed. Last error: ${err.message}`
        });
      }
    }
  }

  // Should never reach here, but just in case
  return res.status(500).json({
    error: 'Unexpected error occurred'
  });
}
