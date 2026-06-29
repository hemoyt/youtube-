import { setCors, parseBody, callAI } from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = await parseBody(req);
  const { transcriptContext, type } = body;

  if (!transcriptContext) return res.status(400).json({ error: "transcriptContext is required" });

  const prompts = {
    brief: "Provide a brief 3-5 sentence summary of this video.",
    detailed: "Provide a detailed summary of this video. Include the main topic, key points, important details, and conclusions. Organize with clear paragraphs.",
    bullet: "Summarize this video as a list of key bullet points. Include 8-15 points covering the most important information.",
    takeaways: "Extract the top 5 key takeaways from this video. For each takeaway, explain why it matters and how the viewer can apply it.",
  };

  const prompt = prompts[type] || prompts.brief;

  try {
    const messages = [
      {
        role: "system",
        content: "You are an expert content summarizer. Create clear, accurate, and well-structured summaries. Detect the language of the transcript and respond in the same language.",
      },
      {
        role: "user",
        content: `${prompt}\n\nVIDEO TRANSCRIPT:\n${transcriptContext}`,
      },
    ];

    const response = await callAI(messages);
    res.json({ response });
  } catch (err) {
    console.error("Summary error:", err.message);
    res.status(500).json({ error: err.message || "Summary failed" });
  }
}
