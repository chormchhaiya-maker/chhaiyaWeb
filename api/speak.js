// api/speak.js - ElevenLabs multilingual TTS → Cloudflare TTS → browser fallback
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { text, lang } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });

  // ── Clean text for speech ─────────────────────────────────────────────────
  const cleanText = text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u2600-\u27FF]/g, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // extra emoji ranges
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // strip markdown links
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);

  if (!cleanText) return res.status(200).json({ audio: null, fallback: true, text: '', lang: lang || 'en' });

  // ── Detect language and pick best ElevenLabs voice ───────────────────────
  // ElevenLabs voice IDs (multilingual_v2 supports 29 languages incl. Khmer)
  const VOICE_MAP = {
    en: '21m00Tcm4TlvDq8ikWAM',   // Rachel — clear, natural English
    km: 'pNInz6obpgDQGcFmaJgB',   // Adam — works well for SE Asian languages
    zh: 'onwK4e9ZLuTAKqWW03F9',   // Daniel — clear for tonal languages
    ja: 'onwK4e9ZLuTAKqWW03F9',   // Daniel
    ko: 'onwK4e9ZLuTAKqWW03F9',   // Daniel
    vi: 'pNInz6obpgDQGcFmaJgB',   // Adam
    fr: 'ThT5KcBeYPX3keUQqHPh',   // Dorothy
    es: 'AZnzlk1XvdvUeBnXmlld',   // Bella
    default: '21m00Tcm4TlvDq8ikWAM', // Rachel
  };

  const langCode = (lang || 'en').split('-')[0].toLowerCase();
  const voiceId = VOICE_MAP[langCode] || VOICE_MAP.default;

  // ── Try ElevenLabs (multilingual_v2) ─────────────────────────────────────
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      const r = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text: cleanText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.82,
              style: 0.15,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (r.ok) {
        const buf = await r.arrayBuffer();
        const b64 = Buffer.from(buf).toString('base64');
        return res.status(200).json({
          audio: `data:audio/mpeg;base64,${b64}`,
          source: 'elevenlabs',
        });
      }

      const errText = await r.text();
      console.log('ElevenLabs failed:', r.status, errText.slice(0, 200));
    } catch (e) {
      console.log('ElevenLabs error:', e.message);
    }
  }

  // ── Fallback: Cloudflare AI TTS (melo-tts) ────────────────────────────────
  const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
  const CF_API_TOKEN = process.env.CF_API_TOKEN;

  if (CF_ACCOUNT_ID && CF_API_TOKEN) {
    try {
      // melo-tts lang codes
      const cfLangMap = {
        en: 'EN', km: 'EN', // Cloudflare doesn't support Khmer — fallback to EN voice
        zh: 'ZH', ja: 'JP', ko: 'KR', fr: 'FR', es: 'ES', vi: 'EN',
      };
      const cfLang = cfLangMap[langCode] || 'EN';

      const r = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/myshell-ai/melo-tts`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: cleanText, lang: cfLang }),
        }
      );

      if (r.ok) {
        const contentType = r.headers.get('content-type') || '';
        if (contentType.includes('audio') || contentType.includes('octet')) {
          const buf = await r.arrayBuffer();
          const b64 = Buffer.from(buf).toString('base64');
          return res.status(200).json({
            audio: `data:audio/wav;base64,${b64}`,
            source: 'cloudflare',
          });
        }
        const data = await r.json();
        if (data?.result?.audio) {
          return res.status(200).json({
            audio: `data:audio/wav;base64,${data.result.audio}`,
            source: 'cloudflare',
          });
        }
      }
      console.log('Cloudflare TTS failed:', r.status);
    } catch (e) {
      console.log('Cloudflare TTS error:', e.message);
    }
  }

  // ── Final fallback — browser Web Speech API ───────────────────────────────
  // Map our lang codes to BCP-47 for browser SpeechSynthesis
  const browserLangMap = {
    en: 'en-US', km: 'km-KH', zh: 'zh-CN', ja: 'ja-JP',
    ko: 'ko-KR', fr: 'fr-FR', es: 'es-ES', vi: 'vi-VN',
  };
  return res.status(200).json({
    audio: null,
    fallback: true,
    text: cleanText,
    lang: browserLangMap[langCode] || 'en-US',
    source: 'browser',
  });
}
