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
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
  });
}

// ─── Transcript Extraction ────────────────────────────────────────────

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Extract balanced JSON from string.
 */
function extractBalancedJson(text, startPos) {
  const open = text[startPos];
  const close = open === "[" ? "]" : "}";
  let depth = 0, inString = false, escape = false;

  for (let i = startPos; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return text.substring(startPos, i + 1); }
  }
  return null;
}

/**
 * Fetch the YouTube page and extract caption track metadata (URLs only).
 * The actual transcript download happens CLIENT-SIDE from the browser,
 * because YouTube blocks serverless IPs from accessing transcript content.
 */
export async function fetchAllTranscripts(videoId) {
  // Fetch YouTube watch page
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9,ar;q=0.8,zh;q=0.7,es;q=0.6,fr;q=0.5",
    },
  });

  const html = await res.text();

  // Extract captionTracks from the page
  const captionIdx = html.indexOf('"captionTracks":');
  if (captionIdx < 0) {
    // No captionTracks in HTML — video truly has no captions
    // Try oembed to see if we can at least get video info
    throw new Error(
      "This video has no captions or subtitles available. The creator has not enabled captions for this video."
    );
  }

  const openBracket = html.indexOf("[", captionIdx);
  if (openBracket < 0) {
    throw new Error("Could not parse caption data from YouTube page.");
  }

  const balanced = extractBalancedJson(html, openBracket);
  if (!balanced) {
    throw new Error("Could not extract caption tracks from YouTube page.");
  }

  let tracksJson;
  try {
    tracksJson = JSON.parse(balanced);
  } catch {
    throw new Error("Could not parse caption track data.");
  }

  if (!Array.isArray(tracksJson) || tracksJson.length === 0) {
    throw new Error("No caption tracks found for this video.");
  }

  // Return track metadata + URLs for client-side fetching
  const tracks = tracksJson.map((t) => ({
    languageCode: t.languageCode || "unknown",
    languageName:
      t.name?.simpleText || t.name?.runs?.[0]?.text || t.languageCode || "Unknown",
    kind: t.kind || "unknown",
    isTranslatable: t.isTranslatable || false,
    // These URLs must be fetched from the USER'S browser, not from the server
    transcriptUrl: t.baseUrl,
    translationLanguages: (t.translationLanguages || []).map((tl) => ({
      languageCode: tl.languageCode,
      languageName:
        tl.languageName?.simpleText || tl.languageCode || "Unknown",
    })),
  }));

  return { tracks, source: "youtube_page_urls" };
}

/**
 * Legacy: fetch a single transcript's segments (server-side attempt).
 * Returns empty segments — actual fetching happens client-side now.
 */
export async function fetchTranscript(videoId) {
  const { tracks } = await fetchAllTranscripts(videoId);
  return tracks[0]?.transcriptUrl || "";
}

// ─── Transcript Formatting ────────────────────────────────────────────

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
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── AI Translation ────────────────────────────────────────────────────

export async function translateTranscript(segments, targetLanguage) {
  if (!_key) throw new Error("API key not configured");

  const fullText = segments.map((s) => s.text).join(" ");
  const maxChunkChars = 8000;

  if (fullText.length <= maxChunkChars) {
    return await translateChunk(fullText, targetLanguage);
  }

  const chunks = [];
  let currentChunk = "";
  for (const s of segments) {
    if (currentChunk.length + s.text.length + 1 > maxChunkChars) {
      chunks.push(currentChunk.trim());
      currentChunk = s.text;
    } else {
      currentChunk += (currentChunk ? " " : "") + s.text;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  const translatedParts = await Promise.all(
    chunks.map((chunk) => translateChunk(chunk, targetLanguage))
  );
  return translatedParts.join(" [–––] ");
}

async function translateChunk(text, targetLanguage) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${_key}`,
      "HTTP-Referer": "https://yt-studio.vercel.app",
      "X-Title": "YT Studio",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.2-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the following text to ${targetLanguage}. Preserve ALL meaning, tone, and nuance. Return ONLY the translated text — no explanations, no notes, no quotation marks.`,
        },
        { role: "user", content: text },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) throw new Error(`Translation failed: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// ─── AI Chat ───────────────────────────────────────────────────────────

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
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 4000 }),
  });

  if (!res.ok) throw new Error(`AI request failed: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}
