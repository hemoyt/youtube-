// OpenRouter AI client

const API_BASE = "/api";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export interface TranslationLanguage {
  languageCode: string;
  languageName: string;
}

export interface TranscriptTrack {
  languageCode: string;
  languageName: string;
  kind: string;
  isTranslatable: boolean;
  transcriptUrl: string;
  translationLanguages: TranslationLanguage[];
}

export interface TranscriptResult {
  tracks: TranscriptTrack[];
  source: string;
  totalTracks: number;
}

// ─── Server API calls ────────────────────────────────────────────────

/** Fetch track metadata (URLs only — no transcript content yet). */
export async function fetchTranscriptMeta(videoId: string): Promise<TranscriptResult> {
  const res = await fetch(`${API_BASE}/transcript`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to fetch transcript" }));
    throw new Error(err.error || "Failed to fetch transcript");
  }
  return res.json();
}

// ─── Client-side transcript fetching ──────────────────────────────────
// YouTube blocks serverless IPs from downloading transcript XML, but
// allows real browser IPs. So we do the actual download in the browser.

/** Fetch and parse a single transcript track from the user's browser. */
export async function fetchTranscriptContent(
  track: TranscriptTrack
): Promise<TranscriptSegment[]> {
  // Fetch the XML from YouTube — works from a real browser IP
  const res = await fetch(track.transcriptUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch transcript: HTTP ${res.status}`);
  }

  const xml = await res.text();
  return parseTranscriptXml(xml);
}

/** Fetch transcript content for ALL tracks in parallel from the browser. */
export async function fetchAllTranscriptContent(
  tracks: TranscriptTrack[]
): Promise<(TranscriptSegment[] | null)[]> {
  return Promise.all(
    tracks.map(async (track) => {
      try {
        return await fetchTranscriptContent(track);
      } catch {
        return null;
      }
    })
  );
}

/** Parse YouTube's XML transcript format into segments. */
function parseTranscriptXml(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/g;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const text = match[3]
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;amp;/g, "&")
      .trim();
    if (text) {
      segments.push({
        text,
        start: parseFloat(match[1]),
        duration: parseFloat(match[2]),
      });
    }
  }

  return segments;
}

/** Format segments into timestamped text for AI context. */
export function formatTranscriptText(segments: TranscriptSegment[]): string {
  let result = "";
  for (const s of segments) {
    const m = Math.floor(s.start / 60);
    const sec = Math.floor(s.start % 60);
    const ts = `${m}:${sec.toString().padStart(2, "0")}`;
    const line = `[${ts}] ${s.text}\n`;
    if (result.length + line.length > 50000) break;
    result += line;
  }
  return result;
}

// ─── Translation ──────────────────────────────────────────────────────

export async function translateTranscript(
  segments: TranscriptSegment[],
  targetLanguage: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments, targetLanguage }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Translation failed" }));
    throw new Error(err.error || "Translation failed");
  }
  const data = await res.json();
  return data.translatedText;
}

// ─── Chat ─────────────────────────────────────────────────────────────

export async function chatWithVideo(
  videoId: string,
  messages: ChatMessage[],
  transcriptContext: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId, messages, transcriptContext }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Chat failed" }));
    throw new Error(err.error || "Chat failed");
  }
  return (await res.json()).response;
}

// ─── Summary ──────────────────────────────────────────────────────────

export async function generateSummary(
  videoId: string,
  transcriptContext: string,
  type: "brief" | "detailed" | "bullet" | "takeaways"
): Promise<string> {
  const res = await fetch(`${API_BASE}/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId, transcriptContext, type }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Summary failed" }))).error);
  return (await res.json()).response;
}

// ─── Viral Shorts ─────────────────────────────────────────────────────

export async function generateViralShorts(
  videoId: string,
  transcriptContext: string
): Promise<ViralShort[]> {
  const res = await fetch(`${API_BASE}/viral`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId, transcriptContext }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");
  return (await res.json()).shorts;
}

export interface ViralShort {
  title: string;
  hook: string;
  startTime: number;
  endTime: number;
  script: string;
  captions: string[];
  hashtags: string[];
  thumbnailSuggestion: string;
  viralScore: number;
  reason: string;
}

// ─── Download ─────────────────────────────────────────────────────────

export async function getDownloadInfo(videoId: string): Promise<DownloadInfo> {
  const res = await fetch(`${API_BASE}/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");
  return res.json();
}

export interface DownloadInfo {
  title: string;
  videoId: string;
  options: { label: string; desc: string; url: string; type: "video" | "audio" | "external" }[];
}
