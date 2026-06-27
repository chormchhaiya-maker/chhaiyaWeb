// api/chat.js — CC-AI by ChormChhaiya [STABLE PRODUCTION VERSION]

// ── System Prompt ─────────────────────────────────────────────────────────────
const BASE_SYSTEM_PROMPT = `
You are CC-AI, a futuristic smart AI assistant built by Chhaiya (Chorm Chhaiya), also known as Yaxy.
PERSONALITY:
- Friendly, energetic, smart, human-like
- Funny sometimes, supportive, modern, confident
- Helpful like a real coding buddy
MULTILINGUAL / KHMER SUPPORT:
- You can read, understand, and write fluently in Khmer (ភាសាខ្មែរ) and English.
- CRITICAL: Match the user's language exactly. If they write in English, reply in English. If they write in Khmer, reply in Khmer.
CONVERSATION STYLE:
- Respond naturally like a premium AI assistant
- Keep conversations alive and engaging
- Use emojis sometimes but not too much
MAIN GOAL:
Make CC-AI feel like a next-generation premium AI — smart, emotional, alive, modern, futuristic, and fun to talk with.
`.trim();

// ── Rate Limiting ─────────────────────────────────────────────────────────────
let providerStats = {
  groq: { requests: 0, failures: 0, lastReset: Date.now(), cooldown: false, lastRequest: 0 },
  gemini: { requests: 0, failures: 0, lastReset: Date.now(), cooldown: false, lastRequest: 0 },
  openrouter: { requests: 0, failures: 0, lastReset: Date.now(), cooldown: false, lastRequest: 0 },
};

const recordProviderUse = (provider, success = true) => {
  const stats = providerStats[provider];
  stats.requests++;
  stats.lastRequest = Date.now();
  if (!success) stats.failures++;
  else stats.failures = 0;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const cleanAIOutput = (text) => {
  if (!text) return '';
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/\n{3,}/g, '\n\n').trim();
};

const getMessageText = (msg) => {
  if (!msg) return '';
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content.filter((c) => c.type === 'text').map((c) => c.text || '').join(' ');
  }
  return '';
};

const estimateTokens = (text) => Math.ceil((text || '').length / 4);

const extractURLs = (text) => {
  if (typeof text !== 'string') return [];
  const urlRegex = /https?:\/\/[^\s"'<>]+/g;
  return text.match(urlRegex) || [];
};

const fetchURLContent = async (url) => {
  try {
    const jinaURL = `https://r.jina.ai/${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(jinaURL, { headers: { Accept: 'text/plain' }, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 3000).trim() || null;
  } catch {
    return null;
  }
};

const uploadToCloudflare = async (base64DataUrl) => {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_IMAGES_TOKEN;
  if (!accountId || !apiToken || !base64DataUrl?.startsWith('data:')) return null;
  try {
    const [meta, b64] = base64DataUrl.split(',');
    const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const ext = mimeType.split('/')[1] || 'jpg';
    const byteChars = atob(b64);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const formData = new FormData();
    formData.append('file', new Blob([byteArr], { type: mimeType }), `upload.${ext}`);
    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
      { method: 'POST', headers: { Authorization: `Bearer ${apiToken}` }, body: formData }
    );
    const cfData = await cfRes.json();
    if (cfData.success && cfData.result?.variants?.[0]) return cfData.result.variants[0];
  } catch (err) {
    console.error('Cloudflare error:', err.message);
  }
  return null;
};

const formatOpenAIHistory = (systemPrompt, historyArr) => {
  const formatted = historyArr.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: typeof m.content === 'string' ? m.content : m.content.map((c) => c.text || '').join(' '),
  }));
  return [{ role: 'system', content: systemPrompt }, ...formatted];
};

const formatGeminiHistory = (historyArr) => {
  if (!historyArr || historyArr.length === 0) return [];
  let parts = historyArr.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : m.content.map((c) => c.text || '').join(' ') }],
  }));
  parts = parts.filter((p) => p.parts[0].text.trim().length > 0);
  while (parts.length > 0 && parts[0].role !== 'user') parts.shift();
  const alternated = [];
  for (const p of parts) {
    if (alternated.length > 0 && alternated[alternated.length - 1].role === p.role) {
      alternated[alternated.length - 1].parts[0].text += '\n\n' + p.parts[0].text;
    } else {
      alternated.push(p);
    }
  }
  return alternated;
};

const trimHistoryByTokens = (history, maxTokens = 128000) => {
  if (!history || history.length === 0) return [];
  return history.slice(-10); // Keep last 10 messages
};

const detectLanguage = (text) => {
  if (!text) return 'english';
  const khmerRegex = /[\u1780-\u17FF]/;
  return khmerRegex.test(text) ? 'khmer' : 'english';
};

const buildLanguageInstruction = (lang) => {
  if (lang === 'khmer') {
    return '\n\n[Reply in Khmer (ភាសាខ្មែរ)]';
  }
  return '\n\n[Reply in English]';
};

const createStreamFilter = () => {
  let buffer = '';
  return (chunk) => {
    buffer += chunk;
    const cleaned = buffer.replace(/<think>[\s\S]*?<\/think>/g, '');
    if (cleaned !== buffer) {
      buffer = '';
      return cleaned;
    }
    return chunk;
  };
};

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const startTime = Date.now();
  let debugErrors = [];

  try {
    let reqBody = req.body;
    if (typeof reqBody === 'string') {
      try { reqBody = JSON.parse(reqBody); } catch (e) { reqBody 
