# YT Studio

Paste a YouTube link. Watch, chat, summarize, and create viral shorts from any video.

## Features

- 🎬 **Watch** any YouTube video with embedded player
- 💬 **Chat** with the video — ask any question, get AI answers with timestamps
- 📝 **Summarize** — brief, detailed, bullet points, or key takeaways
- ✂️ **Viral Shorts** — AI finds the best clips, writes scripts, captions, hashtags & thumbnail ideas
- 📥 **Download** video or audio-only

## Tech Stack

- React + Vite + TypeScript
- Tailwind CSS (clean minimal design)
- Vercel Serverless Functions (API)
- OpenRouter for AI (GPT-4o-mini)
- YouTube timedtext API for transcripts

## Setup

1. Clone the repo
2. `npm install`
3. Copy `.env.example` to `.env` and add your OpenRouter API key
4. `npm run dev` — starts the Vite dev server (port 3000) and a local API server (port 3001) together
5. Deploy to Vercel — set `OPENROUTER_API_KEY` in Vercel env vars

`npm run dev` reads `.env` via `api-server.js` (a local stand-in for Vercel's serverless functions, used only in development). In production on Vercel, the files in `api/` run as real serverless functions instead.

## License

MIT
