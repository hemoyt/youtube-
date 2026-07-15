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

function mapCaptionTracks(tracksJson) {
  return tracksJson.map((t) => ({
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
}

/**
 * Fetch the YouTube watch page and extract caption track metadata from the
 * embedded player response. Returns null (not an error) if no caption data
 * is present in the page — that can mean the video genuinely has none, OR
 * that YouTube served a cookie-consent interstitial instead of the real
 * page (common for datacenter IPs, like cloud hosts). The CONSENT cookie
 * below answers that prompt so the real page comes back.
 */
async function fetchCaptionsFromWatchPage(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9,ar;q=0.8,zh;q=0.7,es;q=0.6,fr;q=0.5",
      "Cookie": "CONSENT=YES+1",
    },
  });

  const html = await res.text();

  const captionIdx = html.indexOf('"captionTracks":');
  if (captionIdx < 0) return null;

  const openBracket = html.indexOf("[", captionIdx);
  if (openBracket < 0) return null;

  const balanced = extractBalancedJson(html, openBracket);
  if (!balanced) return null;

  let tracksJson;
  try {
    tracksJson = JSON.parse(balanced);
  } catch {
    return null;
  }

  if (!Array.isArray(tracksJson) || tracksJson.length === 0) return null;

  return mapCaptionTracks(tracksJson);
}

/**
 * Fetch caption track metadata (URLs only) for a video. Retries once on
 * failure — YouTube occasionally serves a transient interstitial that
 * clears up on a second request.
 */
export async function fetchAllTranscripts(videoId) {
  const attempt1 = await fetchCaptionsFromWatchPage(videoId).catch(() => null);
  if (attempt1) return { tracks: attempt1, source: "youtube_page_urls" };

  const attempt2 = await fetchCaptionsFromWatchPage(videoId).catch(() => null);
  if (attempt2) return { tracks: attempt2, source: "youtube_page_urls" };

  throw new Error(
    "Couldn't retrieve captions for this video. Either it has none, or YouTube is temporarily blocking this request — try again in a moment, or try a different video."
  );
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
      model: "~openai/gpt-mini-latest",
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

export async function callAI(messages, model = "~openai/gpt-mini-latest") {
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
