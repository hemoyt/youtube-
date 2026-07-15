// Local dev server that mounts the Vercel serverless functions from /api
// so `npm run dev` works end-to-end without deploying to Vercel first.
// Vite proxies /api/* to this server (see vite.config.ts).
import express from "express";

try {
  process.loadEnvFile(); // reads .env — Vercel does this automatically in production
} catch {
  // no .env file — fine if OPENROUTER_API_KEY is set some other way
}

const app = express();

const routes = ["transcript", "transcript-content", "translate", "chat", "summary", "viral", "download"];

for (const route of routes) {
  const { default: handler } = await import(`./api/${route}.js`);
  app.all(`/api/${route}`, (req, res) => handler(req, res));
}

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`API dev server running on http://localhost:${PORT}`);
});
