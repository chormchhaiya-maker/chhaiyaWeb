// api/news.js — uses free RSS feeds (no API key, works on Vercel)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let q = (req.query?.q || '').trim();
  if (!q || q.length < 3) q = 'Cambodia Thailand';

  const isCambodiaThaiQuery =
    /cambodia|thailand|khmer|preah vihear|ta moan|hun manet|hun sen|border/i.test(q);

  // Use targeted query for Cambodia-Thailand topics
  const searchTerm = isCambodiaThaiQuery
    ? 'Cambodia Thailand border'
    : q;

  // ============================================================
  // FREE RSS SOURCES — no API key needed, Vercel allowed
  // Google News RSS + Reuters RSS + BBC RSS
  // ============================================================
  const encodedQuery = encodeURIComponent(searchTerm);

  const rssSources = [
    // Google News RSS (free, no key, returns real articles)
    `https://news.google.com/rss/search?q=${encodedQuery}&hl=en&gl=US&ceid=US:en`,
    // Reuters via Google News RSS
    `https://news.google.com/rss/search?q=${encodedQuery}+site:reuters.com&hl=en`,
    // BBC via Google News RSS
    `https://news.google.com/rss/search?q=${encodedQuery}+site:bbc.com&hl=en`,
  ];

  // ============================================================
  // PARSE RSS XML helper
  // ============================================================
  function parseRSS(xml) {
    const articles = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const item = match[1];

      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                     item.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || '';

      const description = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                           item.match(/<description>(.*?)<\/description>/))?.[1]
                           ?.replace(/<[^>]+>/g, '')?.trim()?.slice(0, 300) || '';

      const link = (item.match(/<link>(.*?)<\/link>/) ||
                    item.match(/<guid[^>]*>(.*?)<\/guid>/))?.[1]?.trim() || '';

      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || '';

      const source = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1]?.trim() ||
                     (link.includes('reuters') ? 'Reuters' :
                      link.includes('bbc') ? 'BBC' :
                      link.includes('cnn') ? 'CNN' :
                      link.includes('aljazeera') ? 'Al Jazeera' : 'News');

      if (title && title !== '' && !title.includes('[Removed]')) {
        articles.push({
          title,
          description,
          url: link,
          publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          source: { name: source }
        });
      }
    }
    return articles;
  }

  // ============================================================
  // FETCH ALL RSS SOURCES IN PARALLEL
  // ============================================================
  const fetchRSS = async (url) => {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CC-AI/1.0)' }
      });
      if (!r.ok) return [];
      const text = await r.text();
      return parseRSS(text);
    } catch (e) {
      console.log('RSS fetch failed:', url, e.message);
      return [];
    }
  };

  const results = await Promise.all(rssSources.map(fetchRSS));

  // Deduplicate by title
  const seen = new Set();
  const allArticles = results.flat().filter(a => {
    if (!a.title || seen.has(a.title)) return false;
    seen.add(a.title);
    return true;
  });

  // Sort by date, newest first
  allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  return res.status(200).json({
    articles: allArticles.slice(0, 10),
    totalResults: allArticles.length,
    query: searchTerm,
    source: 'rss'
  });
}
