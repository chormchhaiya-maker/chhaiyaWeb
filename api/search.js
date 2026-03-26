export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { query } = req.body || {};
  if (!query) return res.status(400).json({ error: 'query required' });

  let results = [];

  // 1. Try DuckDuckGo Instant Answers (free, no key)
  try {
    const r = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { 'User-Agent': 'CC-AI/1.0' } }
    );
    const data = await r.json();
    if (data.AbstractText) results.push(data.AbstractText);
    if (data.Answer) results.push(data.Answer);
    if (data.RelatedTopics?.length) {
      data.RelatedTopics.slice(0, 3).forEach(t => { if (t.Text) results.push(t.Text); });
    }
  } catch(e) { console.log('DDG failed:', e.message); }

  // 2. Try Wikipedia API (free, no key needed)
  try {
    const wikiQuery = encodeURIComponent(query.slice(0, 100));
    const r = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiQuery}`,
      { headers: { 'User-Agent': 'CC-AI/1.0' } }
    );
    if (r.ok) {
      const data = await r.json();
      if (data.extract) results.push('Wikipedia: ' + data.extract.slice(0, 300));
    }
  } catch(e) { console.log('Wikipedia failed:', e.message); }

  // 3. Try Wikipedia Search (for news/current events)
  try {
    const r = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3&origin=*`,
      { headers: { 'User-Agent': 'CC-AI/1.0' } }
    );
    if (r.ok) {
      const data = await r.json();
      data.query?.search?.forEach(item => {
        const clean = item.snippet.replace(/<[^>]+>/g, '');
        results.push(item.title + ': ' + clean);
      });
    }
  } catch(e) { console.log('Wiki search failed:', e.message); }

  if (results.length === 0) {
    return res.status(200).json({ results: [], summary: '' });
  }

  return res.status(200).json({
    results,
    summary: results.slice(0, 4).join(' | ').slice(0, 1500)
  });
}
