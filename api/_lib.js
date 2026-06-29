// Shared utilities for Vercel serverless functions

const _env = typeof process !== "undefined" ? process.env : {};
const _key = _env["OPENROUTER" + "_API_KEY"] || "";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export function parseBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// Fetch transcript using YouTube's timedtext API
export async function fetchTranscript(videoId) {
  // Try fetching the video page to get caption track info
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const res = await fetch(videoUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const html = await res.text();

  // Extract captionTracks from the page
  const captionMatch = html.match(/"captionTracks":(\[.*?\])/);
  if (!captionMatch) {
    throw new Error("This video has no captions or subtitles available.");
  }

  let tracks;
  try {
    tracks = JSON.parse(captionMatch[1]);
  } catch {
    throw new Error("Could not parse caption tracks.");
  }

  if (!tracks || tracks.length === 0) {
    throw new Error("No caption tracks found for this video.");
  }

  // Prefer English, otherwise use the first track
  const track =
    tracks.find((t) => t.languageCode?.startsWith("en")) || tracks[0];

  const transcriptRes = await fetch(track.baseUrl);
  const transcriptXml = await transcriptRes.text();

  // Parse XML transcript
  const segments = [];
  const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/g;
  let match;
  while ((match = regex.exec(transcriptXml)) !== null) {
    const start = parseFloat(match[1]);
    const duration = parseFloat(match[2]);
    const text = decodeXmlEntities(match[3])
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
    if (text) segments.push({ text, start, duration });
  }

  if (segments.length === 0) {
    throw new Error("Transcript was empty.");
  }

  return segments;
}

function decodeXmlEntities(text) {
  return text
    .replace(/&amp;amp;/g, "&")
    .replace(/&amp;#39;/g, "'")
    .replace(/&amp;quot;/g, '"');
}

export function formatTranscript(segments, maxChars = 50000) {
  let result = "";
  for (const s of segments) {
    const ts = formatTime(s.start);
    const line = `[${ts}] ${s.text}\n`;
    if (result.length + line.length > maxChars) break;
    result += line;
  }
  return result;
}

export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function callAI(messages, model = "openai/gpt-5.2-mini") {
  if (!_key) throw new Error("API key not configured");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${_key}`,
      "HTTP-Referer": "https://yt-studio.vercel.app",
      "X-Title": "YT Studio",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI request failed: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}
