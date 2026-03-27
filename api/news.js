// api/news.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
  if (!NEWSAPI_KEY) {
    console.error('NEWSAPI_KEY missing!');
    return res.status(500).json({ error: 'Server misconfigured: missing NEWSAPI_KEY' });
  }

  // Get query from request, default to Cambodia-Thailand if empty
  let q = (req.query?.q || '').trim();
  if (!q || q.length < 3) {
    q = 'Cambodia Thailand';
  }

  // Boost Cambodia-Thailand queries with extra keywords for better coverage
  const isCambodiaThaiQuery =
    /cambodia|thailand|khmer|preah vihear|ta moan|hun manet|hun sen/i.test(q);

  // NewsAPI supports AND with spaces, OR with OR keyword
  const finalQuery = isCambodiaThaiQuery
    ? `${q} OR "Cambodia Thailand" OR "Preah Vihear" OR "Ta Moan"`
    : q;

  // ============================================================
  // --- Fetch from NewsAPI.org ---
  // ============================================================
  const params = new URLSearchParams({
    q: finalQuery,
    language: 'en',          // English articles (best coverage)
    sortBy: 'publishedAt',   // Most recent first
    pageSize: '10',
    apiKey: NEWSAPI_KEY,
  });

  // For Cambodia-Thailand: search from 2025-01-01 onwards to get 2025 events
  if (isCambodiaThaiQuery) {
    params.set('from', '2025-01-01');
  }

  try {
    const apiUrl = `https://newsapi.org/v2/everything?${params.toString()}`;
    const newsRes = await fetch(apiUrl, {
      headers: { 'User-Agent': 'CC-AI/1.0' }
    });

    if (!newsRes.ok) {
      const errText = await newsRes.text();
      console.error('NewsAPI error:', newsRes.status, errText);
      return res.status(200).json({ articles: [], error: `NewsAPI returned ${newsRes.status}` });
    }

    const data = await newsRes.json();

    if (data.status !== 'ok') {
      console.error('NewsAPI bad status:', data);
      return res.status(200).json({ articles: [], error: data.message || 'NewsAPI error' });
    }

    // Filter out articles with "[Removed]" titles (deleted articles)
    const clean = (data.articles || []).filter(
      a => a.title && a.title !== '[Removed]' && a.url && !a.url.includes('removed')
    );

    // Return cleaned articles
    return res.status(200).json({
      articles: clean,
      totalResults: data.totalResults || 0,
      query: finalQuery
    });

  } catch (e) {
    console.error('NewsAPI fetch exception:', e.message);
    return res.status(200).json({ articles: [], error: e.message });
  }
}
