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

// Fetch transcript via our API endpoint
export async function fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
  const res = await fetch(`${API_BASE}/transcript`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to fetch transcript" }));
    throw new Error(err.error || "Failed to fetch transcript");
  }
  const data = await res.json();
  return data.segments;
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
