import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

app.get("/parse", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const html = await fetch(url).then((r) => r.text());

    const getMeta = (prop) => {
      const regex = new RegExp(
        `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["'](.*?)["']`,
        "i"
      );
      return html.match(regex)?.[1] || null;
    };

    const ogImage = getMeta("og:image");
    const fallbackImg =
      html.match(
        /<img[^>]+src=["'](https:\/\/[^"']+?\.(?:jpe?g|png|webp))["']/i
      )?.[1] || null;
    const image = ogImage || fallbackImg;

    const title =
      getMeta("og:title") ||
      html.match(/<title>(.*?)<\/title>/i)?.[1] ||
      "Unnamed product";

    res.json({ image, title });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fetch failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
