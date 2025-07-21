import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

app.get("/parse", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    // Headers per simulare un browser reale
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    };

    const html = await fetch(url, { headers }).then((r) => r.text());

    // Funzione migliorata per estrarre meta tag
    const getMeta = (prop) => {
      // Prova diversi formati di meta tag
      const patterns = [
        new RegExp(
          `<meta[^>]+property=["']${prop}["'][^>]+content=["'](.*?)["'][^>]*>`,
          "i"
        ),
        new RegExp(
          `<meta[^>]+name=["']${prop}["'][^>]+content=["'](.*?)["'][^>]*>`,
          "i"
        ),
        new RegExp(
          `<meta[^>]+content=["'](.*?)["'][^>]+(?:property|name)=["']${prop}["'][^>]*>`,
          "i"
        ),
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return match[1];
      }
      return null;
    };

    // Estrai immagine con più fallback
    let image = getMeta("og:image");

    if (!image) {
      // Prova altre proprietà per l'immagine
      image = getMeta("twitter:image") || getMeta("twitter:image:src");
    }

    if (!image) {
      // Cerca immagini nel contenuto con pattern più flessibili
      const imgPatterns = [
        /<img[^>]+src=["'](https:\/\/[^"']+?\.(?:jpe?g|png|webp|gif))["'][^>]*>/gi,
        /<img[^>]+data-src=["'](https:\/\/[^"']+?\.(?:jpe?g|png|webp|gif))["'][^>]*>/gi,
        /background-image:\s*url\(["']?(https:\/\/[^"']+?\.(?:jpe?g|png|webp|gif))["']?\)/gi,
      ];

      for (const pattern of imgPatterns) {
        const matches = html.match(pattern);
        if (matches && matches.length > 0) {
          // Prendi la prima immagine che sembra essere di buona qualità (dimensione ragionevole nell'URL)
          for (const match of matches) {
            const imgUrl = match.match(
              /(https:\/\/[^"']+?\.(?:jpe?g|png|webp|gif))/i
            )?.[1];
            if (
              imgUrl &&
              !imgUrl.includes("icon") &&
              !imgUrl.includes("logo")
            ) {
              image = imgUrl;
              break;
            }
          }
          if (image) break;
        }
      }
    }

    // Estrai titolo con più fallback
    let title = getMeta("og:title") || getMeta("twitter:title");

    if (!title) {
      // Prova diversi pattern per il titolo
      const titlePatterns = [
        /<title[^>]*>(.*?)<\/title>/i,
        /<h1[^>]*>(.*?)<\/h1>/i,
        /class=["'][^"']*title[^"']*["'][^>]*>(.*?)</i,
      ];

      for (const pattern of titlePatterns) {
        const match = html.match(pattern);
        if (match && match[1].trim()) {
          title = match[1].replace(/<[^>]*>/g, "").trim();
          break;
        }
      }
    }

    // Pulisci il titolo da entità HTML
    if (title) {
      title = title
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .trim();
    }

    title = title || "Prodotto senza nome";

    console.log("Parsed data:", { url, title, image });

    res.json({
      image,
      title,
      success: true,
      debug: {
        hasOgImage: !!getMeta("og:image"),
        hasOgTitle: !!getMeta("og:title"),
        htmlLength: html.length,
      },
    });
  } catch (err) {
    console.error("Parser error:", err.message);
    res.status(500).json({
      error: "Fetch failed",
      details: err.message,
      success: false,
    });
  }
});

// Endpoint per debug che restituisce tutto l'HTML (attento alla dimensione!)
app.get("/debug-html", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    const html = await fetch(url, { headers }).then((r) => r.text());

    // Restituisci solo i primi 5000 caratteri per debug
    res.json({
      htmlPreview: html.substring(0, 5000),
      fullLength: html.length,
      containsOgImage: html.includes("og:image"),
      containsOgTitle: html.includes("og:title"),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
