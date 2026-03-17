// api/chat.js   ← replace everything with this
export default async function handler(req, res) {
  const key = process.env.XAI_API_KEY?.trim();   // trim removes accidental spaces

  if (!key) {
    return res.status(500).json({ error: "KEY_MISSING_ON_VERCEL" });
  }

  if (!key.startsWith("xai-")) {
    return res.status(500).json({ error: "KEY_WRONG_FORMAT" });
  }

  try {
    const grokRes = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "grok-4",
        messages: req.body.messages,
        temperature: 0.7,
        max_tokens: 800
      })
    });

    const data = await grokRes.json();

    if (!grokRes.ok) {
      console.error("xAI real error:", data);
      return res.status(500).json({
        error: "Grok rejected the request",
        xai_status: grokRes.status,
        xai_details: data.error?.message || data
      });
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
