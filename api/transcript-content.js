// CORS-bypass proxy: relays transcript content from YouTube to the browser.
// Since the browser can't fetch youtube.com directly (CORS), and our
// server can't fetch it either (ip=0.0.0.0 in signed URLs blocks serverless IPs),
// this endpoint accepts the full URL and relays it with minimal headers,
// letting YouTube see the browser's forwarded characteristics.

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body;
  try {
    body = await new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data ? JSON.parse(data) : {}));
    });
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const { url } = body;
  if (!url) return res.status(400).json({ error: "url is required" });

  try {
    // Relay the fetch — use the user's browser-like headers
    // YouTube's timedtext API doesn't strictly require ip matching for
    // the &fmt=json3 variant. Let's try that.
    const targetUrl = url + "&fmt=json3";

    const yr = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!yr.ok) {
      // If JSON format fails, try plain XML (without the &fmt param)
      const yr2 = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      const text = await yr2.text();

      if (!text || text.trim().length === 0) {
        return res.status(502).json({
          error: "YouTube returned empty transcript. The transcript URL may have expired. Try reloading the page.",
        });
      }

      return res.json({ content: text, format: "xml" });
    }

    const text = await yr.text();

    if (!text || text.trim().length === 0) {
      // Fallback to plain XML
      const yr2 = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      const text2 = await yr2.text();

      if (!text2 || text2.trim().length === 0) {
        return res.status(502).json({
          error: "YouTube returned empty transcript. The transcript URL may have expired.",
        });
      }

      return res.json({ content: text2, format: "xml" });
    }

    return res.json({ content: text, format: "json3" });
  } catch (err) {
    console.error("Transcript relay error:", err.message);
    return res.status(500).json({ error: err.message || "Failed to relay transcript" });
  }
}
