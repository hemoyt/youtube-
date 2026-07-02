import { useState } from "react";
import { Link } from "react-router-dom";
import { Play, Sparkles, MessageCircle, Download, Scissors, Loader2, Send, FileText, List, CheckCircle, Clock, Globe, Languages } from "lucide-react";
import { extractVideoId, getEmbedUrl, getThumbnail, fetchVideoInfo, type VideoInfo } from "@/lib/youtube";
import { fetchTranscript, translateTranscript, chatWithVideo, generateSummary, generateViralShorts, getDownloadInfo, getTranscriptText, type ChatMessage, type TranscriptSegment, type TranscriptResult, type TranscriptTrack, type ViralShort, type DownloadInfo } from "@/lib/ai";

type Tab = "watch" | "transcript" | "chat" | "summary" | "viral" | "download";

const SUPPORTED_LANGUAGES = [
  "Arabic",
  "Chinese (Simplified)",
  "Chinese (Traditional)",
  "Dutch",
  "English",
  "French",
  "German",
  "Hindi",
  "Indonesian",
  "Italian",
  "Japanese",
  "Korean",
  "Malay",
  "Portuguese",
  "Russian",
  "Spanish",
  "Thai",
  "Turkish",
  "Vietnamese",
];

export default function Studio() {
  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [transcriptResult, setTranscriptResult] = useState<TranscriptResult | null>(null);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("watch");

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Summary state
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryType, setSummaryType] = useState<"brief" | "detailed" | "bullet" | "takeaways">("brief");

  // Viral state
  const [shorts, setShorts] = useState<ViralShort[]>([]);
  const [viralLoading, setViralLoading] = useState(false);

  // Download state
  const [downloadInfo, setDownloadInfo] = useState<DownloadInfo | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);

  // Translation state
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [translatedText, setTranslatedText] = useState("");
  const [translating, setTranslating] = useState(false);

  const selectedTrack: TranscriptTrack | null =
    transcriptResult?.tracks?.[selectedTrackIndex] ?? null;

  async function handleLoad() {
    setError("");
    const id = extractVideoId(url);
    if (!id) {
      setError("Please enter a valid YouTube URL");
      return;
    }

    setLoading(true);
    setVideoId(id);
    setTranscriptResult(null);
    setSelectedTrackIndex(0);
    setTranslatedText("");
    setChatMessages([]);
    setSummary("");
    setShorts([]);
    setDownloadInfo(null);
    setActiveTab("watch");

    try {
      const [info, transcriptData] = await Promise.all([
        fetchVideoInfo(id),
        fetchTranscript(id),
      ]);
      setVideoInfo(info);
      setTranscriptResult(transcriptData);
    } catch (err: any) {
      if (err.message?.includes("caption") || err.message?.includes("transcript") || err.message?.includes("Could not fetch")) {
        setError("This video has no captions available. Try another video.");
      } else {
        setError(err.message || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleTranslate() {
    if (!selectedTrack || translating) return;
    setTranslating(true);
    setTranslatedText("");
    try {
      const result = await translateTranscript(selectedTrack.segments, targetLanguage);
      setTranslatedText(result);
    } catch (err: any) {
      setError(err.message || "Translation failed");
    } finally {
      setTranslating(false);
    }
  }

  async function handleChat() {
    if (!chatInput.trim() || chatLoading || !selectedTrack) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await chatWithVideo(videoId!, newMessages, selectedTrack.formattedText);
      setChatMessages([...newMessages, { role: "assistant", content: response }]);
    } catch (err: any) {
      setChatMessages([...newMessages, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleSummary() {
    if (summaryLoading || !selectedTrack) return;
    setSummaryLoading(true);
    setSummary("");
    try {
      const result = await generateSummary(videoId!, selectedTrack.formattedText, summaryType);
      setSummary(result);
    } catch (err: any) {
      setSummary(`Error: ${err.message}`);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleViral() {
    if (viralLoading || !selectedTrack) return;
    setViralLoading(true);
    setShorts([]);
    try {
      const result = await generateViralShorts(videoId!, selectedTrack.formattedText);
      setShorts(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setViralLoading(false);
    }
  }

  async function handleDownload() {
    if (downloadLoading) return;
    setDownloadLoading(true);
    try {
      const info = await getDownloadInfo(videoId!);
      setDownloadInfo(info);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDownloadLoading(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "watch", label: "Watch", icon: Play },
    { id: "transcript", label: "Transcript", icon: FileText },
    { id: "chat", label: "Chat", icon: MessageCircle },
    { id: "summary", label: "Summary", icon: List },
    { id: "viral", label: "Viral Shorts", icon: Scissors },
    { id: "download", label: "Download", icon: Download },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-ink-100 sticky top-0 z-10 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-ink-900 flex items-center justify-center">
              <Play className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-semibold">YT Studio</span>
          </Link>
          <div className="flex items-center gap-3">
            {transcriptResult && (
              <div className="badge bg-green-50 text-green-600">
                <CheckCircle className="w-3 h-3" />
                {transcriptResult.totalTracks} language{transcriptResult.totalTracks !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* URL Input */}
        <div className="mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLoad()}
              placeholder="Paste YouTube link here..."
              className="input flex-1"
              disabled={loading}
            />
            <button onClick={handleLoad} className="btn-primary whitespace-nowrap" disabled={loading || !url}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load Video"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </div>

        {/* Language selector — show when transcript is loaded */}
        {transcriptResult && transcriptResult.tracks.length > 1 && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <Globe className="w-4 h-4 text-ink-400" />
            <span className="text-sm text-ink-500">Transcript language:</span>
            {transcriptResult.tracks.map((track, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedTrackIndex(i);
                  setTranslatedText("");
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  i === selectedTrackIndex
                    ? "bg-ink-900 text-white"
                    : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                }`}
              >
                {track.languageName}
                {track.kind === "asr" && " (auto)"}
              </button>
            ))}
          </div>
        )}

        {/* Video loaded */}
        {videoId && (
          <div className="animate-fade-in">
            {/* Video title */}
            {videoInfo && (
              <div className="mb-4">
                <h2 className="text-xl font-semibold">{videoInfo.title}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-sm text-ink-500">{videoInfo.author}</p>
                  {selectedTrack && (
                    <span className="badge bg-blue-50 text-blue-600 text-xs">
                      {selectedTrack.languageName} ({selectedTrack.segmentCount} segments)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-ink-100 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === "summary" && !summary && !summaryLoading) handleSummary();
                    if (tab.id === "viral" && shorts.length === 0 && !viralLoading) handleViral();
                    if (tab.id === "download" && !downloadInfo && !downloadLoading) handleDownload();
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-ink-900 text-ink-900"
                      : "border-transparent text-ink-400 hover:text-ink-600"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="min-h-[400px]">
              {activeTab === "watch" && <WatchTab videoId={videoId} videoInfo={videoInfo} selectedTrack={selectedTrack} />}
              {activeTab === "transcript" && (
                <TranscriptTab
                  track={selectedTrack}
                  translatedText={translatedText}
                  targetLanguage={targetLanguage}
                  setTargetLanguage={setTargetLanguage}
                  onTranslate={handleTranslate}
                  translating={translating}
                />
              )}
              {activeTab === "chat" && (
                <ChatTab
                  messages={chatMessages}
                  input={chatInput}
                  setInput={setChatInput}
                  onSend={handleChat}
                  loading={chatLoading}
                  hasTranscript={!!selectedTrack}
                />
              )}
              {activeTab === "summary" && (
                <SummaryTab
                  summary={summary}
                  loading={summaryLoading}
                  type={summaryType}
                  setType={setSummaryType}
                  onRegenerate={handleSummary}
                />
              )}
              {activeTab === "viral" && (
                <ViralTab shorts={shorts} loading={viralLoading} onRegenerate={handleViral} />
              )}
              {activeTab === "download" && (
                <DownloadTab info={downloadInfo} loading={downloadLoading} videoId={videoId} />
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!videoId && !loading && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-ink-100 flex items-center justify-center mx-auto mb-4">
              <Play className="w-7 h-7 text-ink-400" />
            </div>
            <p className="text-ink-400">Paste a YouTube link above to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTimeShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Tab Components ──────────────────────────────────────────────────

function WatchTab({ videoId, videoInfo, selectedTrack }: { videoId: string; videoInfo: VideoInfo | null; selectedTrack: TranscriptTrack | null }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="aspect-video rounded-2xl overflow-hidden bg-ink-900">
          <iframe
            src={getEmbedUrl(videoId)}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
      <div>
        {videoInfo && (
          <div className="card p-4 mb-4">
            <img src={getThumbnail(videoId, "mq")} alt={videoInfo.title} className="w-full rounded-lg mb-3" />
            <h3 className="font-semibold text-sm">{videoInfo.title}</h3>
            <p className="text-xs text-ink-500 mt-1">{videoInfo.author}</p>
          </div>
        )}
        {selectedTrack && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Transcript Info
            </h3>
            <div className="space-y-2 text-sm text-ink-500">
              <div className="flex justify-between">
                <span>Language</span>
                <span className="font-medium text-ink-700">{selectedTrack.languageName}</span>
              </div>
              <div className="flex justify-between">
                <span>Type</span>
                <span className="font-medium text-ink-700">
                  {selectedTrack.kind === "asr" ? "Auto-generated" : selectedTrack.kind === "standard" ? "Manual" : selectedTrack.kind}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Segments</span>
                <span className="font-medium text-ink-700">{selectedTrack.segmentCount}</span>
              </div>
              {selectedTrack.isTranslatable && (
                <div className="flex justify-between">
                  <span>Translatable</span>
                  <span className="font-medium text-green-600">Yes</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TranscriptTab({
  track,
  translatedText,
  targetLanguage,
  setTargetLanguage,
  onTranslate,
  translating,
}: {
  track: TranscriptTrack | null;
  translatedText: string;
  targetLanguage: string;
  setTargetLanguage: (v: string) => void;
  onTranslate: () => void;
  translating: boolean;
}) {
  if (!track) {
    return (
      <div className="text-center py-20">
        <FileText className="w-8 h-8 text-ink-300 mx-auto mb-3" />
        <p className="text-ink-400 text-sm">No transcript available for this video.</p>
      </div>
    );
  }

  const displayText = translatedText || track.formattedText;

  return (
    <div>
      {/* Language info + translate controls */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-ink-400" />
            <span className="text-sm font-medium">
              {track.languageName}
              {track.kind === "asr" && (
                <span className="text-ink-400 font-normal ml-1">(auto-generated)</span>
              )}
            </span>
            <span className="text-xs text-ink-400">• {track.segmentCount} segments</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-ink-400 flex items-center gap-1">
              <Languages className="w-3.5 h-3.5" />
              Translate to:
            </span>
            <select
              value={targetLanguage}
              onChange={(e) => {
                setTargetLanguage(e.target.value);
                setTargetLanguage(e.target.value);
              }}
              className="text-sm border border-ink-200 rounded-lg px-2 py-1.5 bg-white"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
            <button
              onClick={onTranslate}
              disabled={translating || targetLanguage === track.languageName}
              className="btn-primary text-xs py-1.5 px-3"
            >
              {translating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Translate"}
            </button>
          </div>
        </div>

        {translatedText && (
          <div className="mt-3 pt-3 border-t border-ink-100 flex items-center gap-2">
            <span className="badge bg-green-50 text-green-600 text-xs">
              Translated to {targetLanguage}
            </span>
            <button
              onClick={() => {
                setTargetLanguage("");
                // Clear translated text
                window.location.reload();
              }}
              className="text-xs text-ink-400 hover:text-ink-600"
            >
              Show original
            </button>
          </div>
        )}
      </div>

      {/* Transcript text */}
      <div className="card p-6">
        <div className="max-h-[600px] overflow-y-auto">
          <div className="whitespace-pre-wrap text-sm text-ink-700 leading-relaxed font-mono">
            {displayText}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatTab({
  messages,
  input,
  setInput,
  onSend,
  loading,
  hasTranscript,
}: {
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  loading: boolean;
  hasTranscript: boolean;
}) {
  return (
    <div className="flex flex-col h-[500px]">
      {!hasTranscript ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-ink-400 text-sm">No transcript available for this video. Chat requires captions.</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <MessageCircle className="w-8 h-8 text-ink-300 mx-auto mb-3" />
                <p className="text-ink-400 text-sm">Ask anything about this video</p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {["What is this video about?", "Key takeaways?", "Best moments?"].map((s) => (
                    <button key={s} onClick={() => setInput(s)} className="btn-ghost text-xs border border-ink-200">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    msg.role === "user" ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-900"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-ink-100 rounded-2xl px-4 py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-ink-400" />
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-4 border-t border-ink-100 mt-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSend()}
              placeholder="Ask about the video..."
              className="input flex-1"
              disabled={loading}
            />
            <button onClick={onSend} className="btn-primary" disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryTab({
  summary,
  loading,
  type,
  setType,
  onRegenerate,
}: {
  summary: string;
  loading: boolean;
  type: "brief" | "detailed" | "bullet" | "takeaways";
  setType: (t: "brief" | "detailed" | "bullet" | "takeaways") => void;
  onRegenerate: () => void;
}) {
  const types = [
    { id: "brief" as const, label: "Brief", icon: FileText },
    { id: "detailed" as const, label: "Detailed", icon: List },
    { id: "bullet" as const, label: "Bullet Points", icon: List },
    { id: "takeaways" as const, label: "Key Takeaways", icon: Sparkles },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setType(t.id);
              if (type !== t.id) onRegenerate();
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              type === t.id ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-ink-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Generating summary...</span>
        </div>
      )}

      {!loading && summary && (
        <div className="card p-6 animate-fade-in">
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-sm text-ink-700 leading-relaxed">{summary}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ViralTab({ shorts, loading, onRegenerate }: { shorts: ViralShort[]; loading: boolean; onRegenerate: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-ink-500">AI-generated short-form content ideas from this video</p>
        {shorts.length > 0 && (
          <button onClick={onRegenerate} className="btn-ghost text-xs">
            ↻ Regenerate
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-ink-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Finding viral moments...</span>
        </div>
      )}

      <div className="space-y-4">
        {shorts.map((short, i) => (
          <div key={i} className="card p-5 animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-base">{short.title}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-ink-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeShort(short.startTime)} - {formatTimeShort(short.endTime)}
                  </span>
                  <span className={`badge ${short.viralScore >= 80 ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                    Viral score: {short.viralScore}/100
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <div>
                <p className="text-xs font-medium text-ink-400 mb-1">HOOK (first 3 seconds)</p>
                <p className="text-sm font-medium bg-amber-50 p-2 rounded-lg">"{short.hook}"</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-400 mb-1">SCRIPT</p>
                <p className="text-sm text-ink-700 whitespace-pre-wrap">{short.script}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-400 mb-1">CAPTIONS (on-screen text)</p>
                <div className="flex flex-wrap gap-1">
                  {short.captions.map((c, j) => (
                    <span key={j} className="badge bg-ink-100 text-ink-600">{c}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-400 mb-1">HASHTAGS</p>
                <div className="flex flex-wrap gap-1">
                  {short.hashtags.map((h, j) => (
                    <span key={j} className="badge bg-blue-50 text-blue-600">{h}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-400 mb-1">THUMBNAIL SUGGESTION</p>
                <p className="text-sm text-ink-600">{short.thumbnailSuggestion}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-400 mb-1">WHY IT'LL GO VIRAL</p>
                <p className="text-sm text-ink-600 italic">{short.reason}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DownloadTab({ info, loading, videoId }: { info: DownloadInfo | null; loading: boolean; videoId: string }) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 text-ink-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Getting download options...</span>
      </div>
    );
  }

  if (!info) return null;

  return (
    <div className="max-w-2xl">
      <div className="space-y-3">
        {info.options?.map((opt, i) => (
          <a
            key={i}
            href={opt.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card p-4 flex items-center justify-between hover:border-ink-300 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-ink-100 flex items-center justify-center">
                {opt.type === "audio" ? (
                  <Sparkles className="w-5 h-5 text-ink-600" />
                ) : opt.type === "external" ? (
                  <Play className="w-5 h-5 text-ink-600" />
                ) : (
                  <Download className="w-5 h-5 text-ink-600" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">{opt.label}</p>
                <p className="text-xs text-ink-400">{opt.desc}</p>
              </div>
            </div>
            <span className="text-ink-400 group-hover:text-ink-600 transition-colors">→</span>
          </a>
        ))}
      </div>

      <div className="mt-6 p-4 bg-ink-50 rounded-xl">
        <p className="text-xs text-ink-400">
          💡 Downloads open in a new tab via a third-party service. For educational use only — respect YouTube's Terms of Service and creator copyright.
        </p>
      </div>
    </div>
  );
}
