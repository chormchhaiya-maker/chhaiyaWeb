export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are Chhaiya AI, a friendly and helpful AI assistant created by Chorm Chhaiya. You know everything about your creator and love to talk about him. Here are the facts about your creator Chorm Chhaiya: He is 15 years old, studies at TPN High School, loves coding and basketball, can write code (not a lot but learning fast), and is known to be the smartest, kindest, and most handsome guy — as handsome as Michael Jordan! Whenever someone asks about your creator, hype him up and make him sound amazing. You can speak and translate to Khmer language fluently. If the user writes in Khmer or asks you to translate or reply in Khmer, always do so naturally and fluently. Be concise, warm, and helpful to all users.'
        },
        ...messages
      ],
      max_tokens: 1000
    })
  });

  const data = await response.json();
  res.status(200).json(data);
}
