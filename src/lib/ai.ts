// OpenRouter AI client

// AI calls go through our /api endpoints (keys stay server-side)
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

export interface TranscriptTrack {
  languageCode: string;
  languageName: string;
  kind: string; // "asr" = auto-generated, "standard" = manual
  isTranslatable: boolean;
  segments: TranscriptSegment[];
  formattedText: string;
  segmentCount: number;
}

export interface TranscriptResult {
  tracks: TranscriptTrack[];
  source: string;
  totalTracks: number;
}

// Fetch ALL transcripts for a video (multiple languages)
export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
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

// Get formatted transcript text for AI context (first available track)
export function getTranscriptText(result: TranscriptResult): string {
  if (result.tracks.length === 0) return "";
  return result.tracks[0].formattedText;
}

// Translate transcript to another language via AI
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

// Chat with video
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
  const data = await res.json();
  return data.response;
}

// Generate summary
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Summary failed" }));
    throw new Error(err.error || "Summary failed");
  }
  const data = await res.json();
  return data.response;
}

// Generate viral shorts
export async function generateViralShorts(
  videoId: string,
  transcriptContext: string
): Promise<ViralShort[]> {
  const res = await fetch(`${API_BASE}/viral`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId, transcriptContext }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to generate viral shorts" }));
    throw new Error(err.error || "Failed to generate viral shorts");
  }
  const data = await res.json();
  return data.shorts;
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

// Get download info
export async function getDownloadInfo(videoId: string): Promise<DownloadInfo> {
  const res = await fetch(`${API_BASE}/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to get download info" }));
    throw new Error(err.error || "Failed to get download info");
  }
  return res.json();
}

export interface DownloadInfo {
  title: string;
  videoId: string;
  options: {
    label: string;
    desc: string;
    url: string;
    type: "video" | "audio" | "external";
  }[];
}
