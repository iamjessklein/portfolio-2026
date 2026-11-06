// Pulls recent posts from Medium's RSS feed into src/_data/medium.json.
// Medium only serves the latest ~10 posts, so new posts are merged into the
// committed file and older ones are kept. Safe to run offline: on any failure
// it leaves medium.json untouched and exits 0 so the build still works.
//
//   node scripts/sync-medium.mjs
//   MEDIUM_FEED_FILE=./sample.xml node scripts/sync-medium.mjs   (for testing)
import { readFile, writeFile } from "node:fs/promises";

const FEED = process.env.MEDIUM_FEED_URL || "https://medium.com/feed/@iamjessklein";
const OUT = new URL("../src/_data/medium.json", import.meta.url);

const decode = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
   .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
};
const monthYear = (d) => d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export function parseFeed(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    const link = tag(item, "link").split("?")[0];
    const date = new Date(tag(item, "pubDate"));
    const categories = [...item.matchAll(/<category>([\s\S]*?)<\/category>/g)].map((m) => decode(m[1]).toLowerCase());
    return {
      title: tag(item, "title"),
      url: link,
      iso: isNaN(date) ? "" : date.toISOString(),
      date: isNaN(date) ? "" : monthYear(date),
      categories,
    };
  }).filter((p) => p.title && p.url);
}

async function main() {
  let existing = { posts: [] };
  try { existing = JSON.parse(await readFile(OUT, "utf8")); } catch {}

  let xml;
  try {
    if (process.env.MEDIUM_FEED_FILE) xml = await readFile(process.env.MEDIUM_FEED_FILE, "utf8");
    else {
      const res = await fetch(FEED, { headers: { "user-agent": "jessicaklein.com build" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      xml = await res.text();
    }
  } catch (err) {
    console.warn(`[medium] feed not fetched (${err.message}); keeping existing medium.json`);
    return;
  }

  const fresh = parseFeed(xml);
  if (!fresh.length) { console.warn("[medium] feed had no items; keeping existing medium.json"); return; }

  const byUrl = new Map(existing.posts.map((p) => [p.url, p]));
  let added = 0;
  for (const p of fresh) { if (!byUrl.has(p.url)) added++; byUrl.set(p.url, p); }
  const posts = [...byUrl.values()].sort((a, b) => (b.iso || "").localeCompare(a.iso || ""));
  const next = JSON.stringify({ posts }, null, 2) + "\n";
  if (next !== JSON.stringify(existing, null, 2) + "\n") await writeFile(OUT, next);
  console.log(`[medium] ${fresh.length} in feed, ${added} new, ${posts.length} stored`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
