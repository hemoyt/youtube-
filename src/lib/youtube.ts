// YouTube utilities

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  // Raw 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

export function getEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function getThumbnail(videoId: string, quality: "max" | "hq" | "mq" | "sd" = "hq"): string {
  const map = { max: "maxresdefault", hq: "hqdefault", mq: "mqdefault", sd: "sddefault" };
  return `https://img.youtube.com/vi/${videoId}/${map[quality]}.jpg`;
}

export async function fetchVideoInfo(videoId: string): Promise<VideoInfo> {
  // Use YouTube oEmbed API (no key needed)
  const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
  if (!res.ok) throw new Error("Could not fetch video info");
  const data = await res.json();
  return {
    videoId,
    title: data.title,
    author: data.author_name,
    authorUrl: data.author_url,
    thumbnail: data.thumbnail_url,
  };
}

export interface VideoInfo {
  videoId: string;
  title: string;
  author: string;
  authorUrl: string;
  thumbnail: string;
}
