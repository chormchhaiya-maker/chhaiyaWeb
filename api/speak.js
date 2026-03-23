export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { text, lang } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });

  const cleanText = text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u2600-\u27FF]/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);

  // Try ElevenLabs first
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      const voiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel
      const r = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          body: JSON.stringify({
            text: cleanText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.8 }
          })
        }
      );

      if (r.ok) {
        const buf = await r.arrayBuffer();
        const b64 = Buffer.from(buf).toString('base64');
        return res.status(200).json({ audio: `data:audio/mpeg;base64,${b64}`, source: 'elevenlabs' });
      }

      const errText = await r.text();
      console.log('ElevenLabs failed:', r.status, errText);
    } catch (e) {
      console.log('ElevenLabs error:', e.message);
    }
  }

  // Fallback: Cloudflare AI TTS
  try {
    const accountId = process.env.CF_ACCOUNT_ID;
    const apiToken = process.env.CF_API_TOKEN;

    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/myshell-ai/melo-tts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: cleanText, lang: lang || 'en' })
      }
    );

    if (r.ok) {
      const contentType = r.headers.get('content-type') || '';
      if (contentType.includes('audio') || contentType.includes('octet')) {
        const buf = await r.arrayBuffer();
        const b64 = Buffer.from(buf).toString('base64');
        return res.status(200).json({ audio: `data:audio/mpeg;base64,${b64}`, source: 'cloudflare' });
      }
      const data = await r.json();
      if (data?.result?.audio) {
        return res.status(200).json({ audio: `data:audio/mpeg;base64,${data.result.audio}`, source: 'cloudflare' });
      }
    }
    console.log('Cloudflare TTS failed:', r.status);
  } catch (e) {
    console.log('Cloudflare TTS error:', e.message);
  }

  // Final fallback — tell browser to use its own speech
  return res.status(200).json({ audio: null, fallback: true, text: cleanText, lang: lang || 'en' });
}
