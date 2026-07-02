import { setCors, parseBody, translateTranscript } from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = await parseBody(req);
  const { segments, targetLanguage } = body;

  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: "segments array is required" });
  }
  if (!targetLanguage) {
    return res.status(400).json({ error: "targetLanguage is required (e.g. 'Arabic', 'Spanish', 'Chinese')" });
  }

  try {
    const translatedText = await translateTranscript(segments, targetLanguage);

    res.json({
      translatedText,
      targetLanguage,
      sourceSegmentCount: segments.length,
    });
  } catch (err) {
    console.error("Translation error:", err.message);
    res.status(500).json({ error: err.message || "Translation failed" });
  }
}
