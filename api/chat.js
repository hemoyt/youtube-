import { setCors, parseBody, callAI } from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = await parseBody(req);
  const { messages, transcriptContext } = body;

  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: "messages array is required" });
  if (!transcriptContext) return res.status(400).json({ error: "transcriptContext is required" });

  try {
    const systemPrompt = `You are an AI assistant that helps users understand YouTube videos. 
You have access to the video's transcript with timestamps. 
Answer questions about the video content accurately and in detail.
When referencing specific parts, include the timestamp.
Detect the user's language and respond in the same language they use.

VIDEO TRANSCRIPT:
${transcriptContext}`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const response = await callAI(aiMessages);
    res.json({ response });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: err.message || "Chat failed" });
  }
}
