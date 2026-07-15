import { Link } from "react-router-dom";
import { Play, Sparkles, MessageCircle, Scissors } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-ink-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-ink-900 flex items-center justify-center">
              <Play className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-semibold text-lg">YT Studio</span>
          </div>
          <Link to="/studio" className="btn-primary text-sm">
            Try it free →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="badge bg-ink-100 text-ink-600 mb-6">
          <Sparkles className="w-3 h-3" />
          Free tool — no account needed
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
          Watch. Chat. Summarize.
          <br />
          <span className="text-ink-400">Create viral shorts.</span>
        </h1>
        <p className="text-lg text-ink-500 mb-8 max-w-2xl mx-auto">
          Paste any YouTube link. Chat with the video like ChatGPT, get instant
          summaries, and generate viral short-form content — all in one clean tool.
        </p>
        <Link to="/studio" className="btn-primary text-base px-8 py-3">
          Get started — it's free
        </Link>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Play, title: "Watch & Download", desc: "Stream or download any video, including audio-only mode." },
            { icon: MessageCircle, title: "Chat with video", desc: "Ask any question about the video. AI answers with timestamps." },
            { icon: Sparkles, title: "Instant summaries", desc: "Get brief, detailed, or bullet-point summaries in seconds." },
            { icon: Scissors, title: "Viral shorts", desc: "AI finds the best clips, writes scripts, captions & hashtags." },
          ].map((f, i) => (
            <div key={i} className="card p-6 hover:border-ink-300 transition-colors">
              <f.icon className="w-5 h-5 text-ink-900 mb-3" />
              <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
              <p className="text-sm text-ink-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-ink-100">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-ink-400">
          <span>YT Studio</span>
          <span>Powered by AI</span>
        </div>
      </footer>
    </div>
  );
}
