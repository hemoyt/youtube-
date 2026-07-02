import { setCors, parseBody, fetchAllTranscripts, formatTranscript } from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = await parseBody(req);
  const { videoId } = body;

  if (!videoId) return res.status(400).json({ error: "videoId is required" });

  try {
    const result = await fetchAllTranscripts(videoId);

    // Return ALL tracks with their metadata and formatted text
    const tracks = result.tracks.map((t) => ({
      languageCode: t.languageCode,
      languageName: t.languageName,
      kind: t.kind,
      isTranslatable: t.isTranslatable,
      segments: t.segments,
      formattedText: formatTranscript(t.segments),
      segmentCount: t.segments.length,
    }));

    res.json({
      tracks,
      source: result.source,
      totalTracks: tracks.length,
    });
  } catch (err) {
    console.error("Transcript error:", err.message);
    res.status(500).json({ error: err.message || "Failed to fetch transcript" });
  }
}
