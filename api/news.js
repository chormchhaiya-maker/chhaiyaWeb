// api/news.js — uses GNews.io (works on Vercel free plan)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const GNEWS_KEY = process.env.GNEWS_KEY;
  if (!GNEWS_KEY) {
    console.error('GNEWS_KEY missing!');
    return res.status(200).json({ articles: [], error: 'Missing GNEWS_KEY' });
  }

  // Get query from request, default to Cambodia-Thailand if empty
  let q = (req.query?.q || '').trim();
  if (!q || q.length < 3) q = 'Cambodia Thailand';

  // Detect Cambodia-Thailand topic
  const isCambodiaThaiQuery =
    /cambodia|thailand|khmer|preah vihear|ta moan|hun manet|hun sen|border/i.test(q);

  // Build smarter query
  const finalQuery = isCambodiaThaiQuery
    ? 'Cambodia Thailand border 2025'
    : q;

  // ============================================================
  // --- GNews API call ---
  // GNews free plan: 100 requests/day, works from Vercel servers
  // ============================================================
  const params = new URLSearchParams({
    q: finalQuery,
    lang: 'en',
    country: 'any',
    max: '10',
    sortby: 'publishedAt',
    token: GNEWS_KEY,
  });

  try {
    const url = `https://gnews.io/api/v4/search?${params.toString()}`;
    const r = await fetch(url);

    if (!r.ok) {
      const errText = await r.text();
      console.error('GNews error:', r.status, errText);
      return res.status(200).json({ articles: [], error: `GNews returned ${r.status}` });
    }

    const data = await r.json();

    // Normalize to same shape as before so chat.js needs no changes
    const articles = (data.articles || []).map(a => ({
      title: a.title,
      description: a.description,
      url: a.url,
      publishedAt: a.publishedAt,
      source: { name: a.source?.name || 'Unknown' },
    }));

    return res.status(200).json({
      articles,
      totalResults: data.totalArticles || 0,
      query: finalQuery,
    });

  } catch (e) {
    console.error('GNews fetch exception:', e.message);
    return res.status(200).json({ articles: [], error: e.message });
  }
}
