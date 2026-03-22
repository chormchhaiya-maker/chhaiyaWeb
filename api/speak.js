export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { text, lang } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });

  try {
    // Use ElevenLabs eleven_multilingual_v2 - supports Khmer and 28 languages
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
          text: text.slice(0, 500),
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.3,
            use_speaker_boost: true
          }
        })
      }
    );

    console.log('ElevenLabs status:', r.status, 'lang:', lang);

    if (!r.ok) {
      const t = await r.text();
      console.error('ElevenLabs error:', t);
      return res.status(r.status).json({ error: t });
    }

    const buf = await r.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    return res.status(200).json({ audio: `data:audio/mpeg;base64,${b64}` });

  } catch (e) {
    console.error('Speak error:', e);
    return res.status(500).json({ error: e.message });
  }
}
