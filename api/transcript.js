import { setCors, parseBody, fetchAllTranscripts } from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = await parseBody(req);
  const { videoId } = body;

  if (!videoId) return res.status(400).json({ error: "videoId is required" });

  try {
    // Returns track metadata with transcriptUrl for EACH track.
    // The browser fetches the actual transcript XML from those URLs
    // (YouTube blocks serverless IPs, but allows requests from real browsers).
    const result = await fetchAllTranscripts(videoId);

    res.json({
      tracks: result.tracks.map((t) => ({
        languageCode: t.languageCode,
        languageName: t.languageName,
        kind: t.kind,
        isTranslatable: t.isTranslatable,
        transcriptUrl: t.transcriptUrl,
        translationLanguages: t.translationLanguages,
      })),
      source: result.source,
      totalTracks: result.tracks.length,
    });
  } catch (err) {
    console.error("Transcript error:", err.message);
    res.status(500).json({ error: err.message || "Failed to fetch transcript" });
  }
}
