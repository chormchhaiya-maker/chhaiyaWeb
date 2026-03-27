// api/test-news.js — TEMPORARY DEBUG FILE, delete after testing
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const query = encodeURIComponent('Cambodia Thailand border');
    const url = `https://news.google.com/rss/search?q=${query}&hl=en&gl=US&ceid=US:en`;

    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CC-AI/1.0)' }
    });

    const xml = await r.text();

    // Simple parse — count items and grab first title
    const items = xml.match(/<item>/g) || [];
    const firstTitle = xml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
                       xml.match(/<title>(.*?)<\/title>/g)?.[1] || 'none';

    return res.status(200).json({
      status: r.ok ? 'OK' : 'FAILED',
      httpStatus: r.status,
      articleCount: items.length,
      firstTitle,
      rssWorking: items.length > 0
    });
  } catch (e) {
    return res.status(200).json({ status: 'EXCEPTION', error: e.message });
  }
}
