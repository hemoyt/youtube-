import { setCors, parseBody, fetchTranscript } from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = await parseBody(req);
  const { videoId } = body;

  if (!videoId) return res.status(400).json({ error: "videoId is required" });

  try {
    const segments = await fetchTranscript(videoId);
    res.json({ segments });
  } catch (err) {
    console.error("Transcript error:", err.message);
    res.status(500).json({ error: err.message || "Failed to fetch transcript" });
  }
}
