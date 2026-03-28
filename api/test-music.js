// api/test-music.js — TEMPORARY DEBUG FILE, delete after testing
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const HF_TOKEN = process.env.HF_TOKEN;

  if (!HF_TOKEN) {
    return res.status(200).json({ status: 'ERROR', reason: 'HF_TOKEN is missing from env vars' });
  }

  const results = {};

  // Test 1: Pollinations
  try {
    const r = await fetch('https://audio.pollinations.ai/lofi', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    results.pollinations = { status: r.status, contentType: r.headers.get('content-type') };
  } catch(e) {
    results.pollinations = { error: e.message };
  }

  // Test 2: HF token valid
  try {
    const r = await fetch('https://huggingface.co/api/whoami', {
      headers: { 'Authorization': `Bearer ${HF_TOKEN}` },
      signal: AbortSignal.timeout(10000)
    });
    const data = await r.json();
    results.hf_token = { status: r.status, valid: r.ok, user: data?.name || 'unknown' };
  } catch(e) {
    results.hf_token = { error: e.message };
  }

  // Test 3: MusicGen model status
  try {
    const r = await fetch(
      'https://api-inference.huggingface.co/models/facebook/musicgen-small',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'test lofi music' }),
        signal: AbortSignal.timeout(15000)
      }
    );
    const ct = r.headers.get('content-type') || '';
    let body = '';
    if (ct.includes('json')) {
      const data = await r.json();
      body = JSON.stringify(data).slice(0, 200);
    }
    results.musicgen = {
      status: r.status,
      contentType: ct,
      body,
      isAudio: ct.includes('audio'),
      isLoading: r.status === 503
    };
  } catch(e) {
    results.musicgen = { error: e.message };
  }

  return res.status(200).json({ hf_token_set: true, results });
}
