// api/test-news.js
// TEMPORARY DEBUG FILE — delete after testing
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const GNEWS_KEY = process.env.GNEWS_KEY;

  if (!GNEWS_KEY) {
    return res.status(200).json({ status: 'ERROR', reason: 'GNEWS_KEY is missing from env vars' });
  }

  try {
    const url = `https://gnews.io/api/v4/search?q=Cambodia+Thailand+border+2025&lang=en&max=3&sortby=publishedAt&token=${GNEWS_KEY}`;
    const r = await fetch(url);
    const data = await r.json();

    return res.status(200).json({
      status: r.ok ? 'OK' : 'FETCH_FAILED',
      httpStatus: r.status,
      totalArticles: data.totalArticles || 0,
      articleCount: data.articles?.length || 0,
      firstArticle: data.articles?.[0] || null,
      rawError: data.errors || null,
    });
  } catch (e) {
    return res.status(200).json({ status: 'EXCEPTION', error: e.message });
  }
}
