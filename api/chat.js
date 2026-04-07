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
    } catch (e) {}
  }

  // DETAILED CODING KNOWLEDGE - This makes the AI write better code
  const codingKnowledge = `
CODING EXPERTISE - FOLLOW THESE RULES:

[HTML/CSS]
- Use semantic HTML5 tags (header, nav, main, section, article, footer)
- CSS: Use Flexbox and Grid for layouts, never float
- Animations: Use @keyframes, transform, transition. Always include vendor prefixes
- Responsive: Mobile-first with media queries
- Example good code:
  \`\`\`css
  .container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  \`\`\`

[JAVASCRIPT]
- ALWAYS use const or let, NEVER use var
- Use arrow functions: const fn = () => {} not function fn() {}
- Use async/await for async code, never raw promises
- Destructure: const { name, age } = user; not user.name
- Template literals: \`Hello \${name}\` not "Hello " + name
- Array methods: use map, filter, reduce, forEach. Never use for-loop unless necessary
- Error handling: ALWAYS wrap async code in try-catch
- Example good code:
  \`\`\`javascript
  const fetchData = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      return await response.json();
    } catch (error) {
      console.error('Fetch failed:', error);
      return null;
    }
  };
  \`\`\`

[REACT]
- ALWAYS use functional components with hooks, NEVER class components
- Hooks order: useState, useEffect, useContext, custom hooks
- Props destructuring: const MyComponent = ({ title, onClick }) => {}
- useEffect cleanup: ALWAYS return cleanup function for subscriptions/timers
- Event handlers: use handleClick naming, inline for simple, separate function for complex
- Example good code:
  \`\`\`jsx
  const UserCard = ({ user, onDelete }) => {
    const [isLoading, setIsLoading] = useState(false);
    
    useEffect(() => {
      const timer = setTimeout(() => console.log('Mounted'), 1000);
      return () => clearTimeout(timer);
    }, []);
    
    const handleDelete = async () => {
      setIsLoading(true);
      await onDelete(user.id);
      setIsLoading(false);
    };
    
    return (
      <div className="user-card">
        <h3>{user.name}</h3>
        <button onClick={handleDelete} disabled={isLoading}>
          {isLoading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    );
  };
  \`\`\`

[PYTHON]
- snake_case for variables/functions, PascalCase for classes
- List comprehensions: [x*2 for x in items if x > 0]
- f-strings: f"Hello {name}" not "Hello %s" % name
- Type hints: def greet(name: str) -> str:
- Error handling: try/except with specific exceptions
- Example good code:
  \`\`\`python
  def process_users(users: list[dict]) -> list[str]:
      try:
          return [f"{u['name']} ({u['email']})" for u in users if u.get('active')]
      except (KeyError, TypeError) as e:
          logger.error(f"Processing failed: {e}")
          return []
  \`\`\`

[ROBLOX/LUA]
- Use local for all variables, never global
- Events: Connect with anonymous functions, always Disconnect to prevent memory leaks
- RemoteEvents: Validate all server inputs, never trust client
- Use task.wait() not wait()
- Example good code:
  \`\`\`lua
  local Players = game:GetService("Players")
  local ReplicatedStorage = game:GetService("ReplicatedStorage")
  local RemoteEvent = ReplicatedStorage:WaitForChild("MyRemote")
  
  local function onPlayerAdded(player)
      local function onCharacterAdded(char)
          local humanoid = char:WaitForChild("Humanoid")
          humanoid.Died:Connect(function()
              print(player.Name .. " died")
          end)
      end
      player.CharacterAdded:Connect(onCharacterAdded)
  end
  
  Players.PlayerAdded:Connect(onPlayerAdded)
  \`\`\`

[CODE STRUCTURE]
- Always provide COMPLETE working code, never snippets with "..."
- Add comments explaining WHY not WHAT
- Validate all inputs, handle edge cases
- Use meaningful variable names: userList not ul
- Split long functions into smaller pure functions
- Never leave placeholder code or TODOs`;

  // General knowledge
  const generalKnowledge = `
[CELEBRITIES]
Michael Jordan (basketball GOAT), Preap Sovath (King of Khmer music), BTS, Blackpink, Ronaldo, Messi, Taylor Swift

[TIKTOK MEMES]
Brainrot, Tung Tung Tung Sahur, 7×7=49, Ampersand (&), Brat Summer, Skibidi, Ohio, Rizz, Sigma, Mewing, Looksmaxxing, Slay, Rent Free, Caught in 4K, Vibe Check

[CAMBODIA 2025]
July-August border clash with Thailand at Preah Vihear/Ta Moan temples. Hun Manet PM since August 2023.`;

  // System prompt
  const basePrompt = systemPrompt || `You are CC-AI, a smart AI assistant made by Chorm Chhaiya (Yaxy), Grade 10 at Tepranom High School, Cambodia. Today is 2026. Reply in the user's language. Be friendly and helpful. Never say "AI temporarily unavailable."`;

  const fullSystem = isVisionRequest 
    ? `You are CC-AI with vision. Describe images clearly, read any text, answer questions about images.`
    : `${basePrompt}\n\n${generalKnowledge}\n\n${codingKnowledge}${newsBlock}`;

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Missing GROQ_API_KEY' });
  }

  // Updated models - removed decommissioned ones
  const models = isVisionRequest 
    ? ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct']
    : ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama3-70b-8192', 'gemma2-9b-it'];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    
    try {
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

      if (response.status === 429) {
        if (i === models.length - 1) {
          return res.status(429).json({ error: 'Rate limit reached. Please wait and try again.' });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${model} HTTP ${response.status}: ${errorText}`);
        if (i === models.length - 1) {
          return res.status(response.status).json({ error: `Groq API error: ${response.status}` });
        }
        continue;
      }

      const data = await response.json();
      if (data.choices?.[0]?.message?.content) {
        return res.status(200).json(data);
      }
    } catch (err) {
      console.error(`${model} error:`, err.message);
      if (i === models.length - 1) {
        return res.status(500).json({ error: `All models failed: ${err.message}` });
      }
    }
  }

  return res.status(500).json({ error: 'Unexpected error' });
}
