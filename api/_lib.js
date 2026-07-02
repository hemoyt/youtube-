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

// ─── Transcript Extraction ────────────────────────────────────────────

/**
 * Extract a balanced JSON object/array from a string starting at a given position.
 * Counts opening/closing brackets to handle deeply nested structures.
 *
 * @param {string} text - The full text to search in
 * @param {number} startPos - Position of the opening bracket `[` or `{`
 * @returns {string|null} - The balanced JSON substring, or null
 */
function extractBalancedJson(text, startPos) {
  const open = text[startPos];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startPos; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }

    if (ch === '"' && !escape) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) {
        return text.substring(startPos, i + 1);
      }
    }
  }

  return null;
}

/**
 * Fetch ALL available transcripts for a YouTube video.
 * Tries multiple methods in order:
 *   1. YouTube page HTML → captionTracks (primary)
 *   2. youtube-transcript.io API (fallback 1)
 *   3. youtubetranscript.com API (fallback 2)
 *
 * Returns: { tracks: [{ languageCode, languageName, kind, segments }], source: string }
 */
export async function fetchAllTranscripts(videoId) {
  // ── Method 1: Parse YouTube watch page ──────────────────────────
  try {
    const res = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9,ar;q=0.8,zh;q=0.7,es;q=0.6,fr;q=0.5",
        },
      }
    );

    const html = await res.text();

    // Extract playerCaptionsTracklistRenderer which contains captionTracks
    // YouTube embeds it as: "captionTracks":[ ...nested objects... ]
    const captionIdx = html.indexOf('"captionTracks":');
    if (captionIdx === -1) {
      throw new Error("NO_CAPTION_TRACKS_IN_HTML");
    }

    // Find the opening [ after "captionTracks":
    const openBracket = html.indexOf("[", captionIdx);
    if (openBracket === -1) {
      throw new Error("NO_OPENING_BRACKET");
    }

    const balanced = extractBalancedJson(html, openBracket);
    if (!balanced) {
      throw new Error("UNBALANCED_JSON");
    }

    let tracksJson;
    try {
      tracksJson = JSON.parse(balanced);
    } catch (e) {
      throw new Error("JSON_PARSE_FAILED: " + e.message);
    }

    if (!Array.isArray(tracksJson) || tracksJson.length === 0) {
      throw new Error("NO_TRACKS_IN_JSON");
    }

    // Fetch each track's transcript XML in parallel
    const tracks = await Promise.all(
      tracksJson.map(async (t, i) => {
        try {
          const tRes = await fetch(t.baseUrl);
          const xml = await tRes.text();
          const segments = parseTranscriptXml(xml);
          const langName = t.name?.simpleText || t.name?.runs?.[0]?.text || t.languageCode || `Track ${i + 1}`;
          return {
            languageCode: t.languageCode || "unknown",
            languageName: langName,
            kind: t.kind || "unknown", // "asr" = auto-generated, "standard" = manual
            isTranslatable: t.isTranslatable || false,
            segments,
          };
        } catch {
          // Silently skip tracks that fail to fetch
          return null;
        }
      })
    );

    const validTracks = tracks.filter(Boolean);
    if (validTracks.length === 0) {
      throw new Error("ALL_TRACKS_FAILED");
    }

    return { tracks: validTracks, source: "youtube_page" };
  } catch (e) {
    console.warn("Method 1 (YouTube page) failed:", e.message);
  }

  // ── Method 2: youtube-transcript.io API ─────────────────────────
  try {
    const res = await fetch(
      `https://youtube-transcript.io/api/transcript?video_id=${videoId}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.transcript && data.transcript.length > 0) {
        return {
          tracks: [
            {
              languageCode: "auto",
              languageName: "Auto-detected",
              kind: "asr",
              isTranslatable: false,
              segments: data.transcript.map((s) => ({
                text: s.text || s.snippet || "",
                start: parseFloat(s.start || s.offset || 0),
                duration: parseFloat(s.dur || s.duration || 0),
              })),
            },
          ],
          source: "youtube-transcript.io",
        };
      }
    }
  } catch (e) {
    console.warn("Method 2 (youtube-transcript.io) failed:", e.message);
  }

  // ── Method 3: youtubetranscript.com API ────────────────────────
  try {
    const res = await fetch(
      `https://youtubetranscript.com/?server_vid2=${videoId}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (res.ok) {
      const xml = await res.text();
      const segments = parseTranscriptXml(xml);
      if (segments.length > 0) {
        return {
          tracks: [
            {
              languageCode: "auto",
              languageName: "Auto-detected",
              kind: "unknown",
              isTranslatable: false,
              segments,
            },
          ],
          source: "youtubetranscript.com",
        };
      }
    }
  } catch (e) {
    console.warn("Method 3 (youtubetranscript.com) failed:", e.message);
  }

  throw new Error(
    "Could not fetch transcript for this video. The video may have no captions, or captions are disabled by the creator."
  );
}

/**
 * Legacy: fetch a single transcript (returns first available track's segments).
 * Kept for backward compatibility with other API endpoints.
 */
export async function fetchTranscript(videoId) {
  const { tracks } = await fetchAllTranscripts(videoId);
  // Return the primary track (prefer English auto or manual, then first)
  const enTrack =
    tracks.find((t) => t.languageCode === "en" && t.kind !== "asr") ||
    tracks.find((t) => t.languageCode === "en") ||
    tracks[0];
  return enTrack.segments;
}

/**
 * Parse YouTube's XML transcript format into segments.
 */
function parseTranscriptXml(xml) {
  const segments = [];
  const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
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
  return segments;
}

function decodeXmlEntities(text) {
  return text
    .replace(/&amp;amp;/g, "&")
    .replace(/&amp;#39;/g, "'")
    .replace(/&amp;quot;/g, '"');
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

  // Build full text
  const fullText = segments.map((s) => s.text).join(" ");

  // If too long, chunk it
  const maxChunkChars = 8000;
  if (fullText.length <= maxChunkChars) {
    return await translateChunk(fullText, targetLanguage);
  }

  // Chunk by segments
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

  // Translate each chunk in parallel
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
          content: `You are a professional translator. Translate the following text to ${targetLanguage}. 
Preserve ALL meaning, tone, and nuance. Return ONLY the translated text — no explanations, no notes, no quotation marks around the output.
If the text is already in ${targetLanguage}, return it unchanged.`,
        },
        { role: "user", content: text },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Translation failed: ${err}`);
  }

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
