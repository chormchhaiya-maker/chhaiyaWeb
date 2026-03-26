// api/news.js
import axios from "axios";

export default async function handler(req, res) {
  const API_KEY =process.env.NEWSAPI_KEY;
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=5&apiKey=${API_KEY}`;

  try {
    const response = await axios.get(url);
    const articles = response.data.articles.map(article => ({
      title: article.title,
      description: article.description,
      url: article.url
    }));

    res.status(200).json({ articles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch news" });
  }
}
