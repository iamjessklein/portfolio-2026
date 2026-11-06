// Combines hand-curated writing groups, posts synced from Medium, and the old Blogspot archive.
//  - Medium: a synced post that matches a curated one by title supplies its real URL; new posts go to
//    the group named in mediumMap.json (by URL, then by Medium tag), else to "New on Medium".
//  - Old blog: oldBlog.tsv holds every post (date|title|path|group code). Edit the last column to move one.
import { readFileSync } from "node:fs";
import curated from "./writingCurated.json" with { type: "json" };
import medium from "./medium.json" with { type: "json" };
import map from "./mediumMap.json" with { type: "json" };

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const OLD = curated.oldBlog.replace(/\/$/, "");

// Where each old-blog group code lands. `slug` ties a group to a project page; the rest are unplanted patches.
const OLD_GROUPS = {
  B: { find: "open-badges-with-mozilla" },
  H: { slug: "hackasaurus-code-tinkering-to-mastery", stage: "evergreen", name: "Hackasaurus", blurb: "Hack jams, training missions and hackable comics for young people learning the web." },
  W: { slug: "mozilla-webmaker", stage: "evergreen", name: "Mozilla Webmaker", blurb: "Designing tools that teach people to make things for the web." },
  V: { slug: "hive-learning-network-with-mozilla", stage: "evergreen", name: "Hive Learning Network with Mozilla", blurb: "Hive NYC, Hive Labs, and prototypes for a network of educators." },
  R: { slug: "rockaway-hack-jams-after-hurricane-sandy", stage: "evergreen", name: "Rockaway Hack Jams After Hurricane Sandy", blurb: "Helping my home neighborhood after the storm." },
  M: { name: "More from Mozilla", blurb: "Design sprints, prototypes and notes from my years at Mozilla that sit outside a single project." },
  P: { name: "Parsons and my thesis", blurb: "A sketchbook-style blog from 2008 to 2010: character design, animation, research and my thesis project." },
  E: { name: "Everything else", blurb: "Odds and ends." },
};
const ORDER = ["open-badges-with-mozilla", "mobile-editing-on-wikipedia", "hackasaurus-code-tinkering-to-mastery", "mozilla-webmaker", "hive-learning-network-with-mozilla", "rockaway-hack-jams-after-hurricane-sandy"];

export default function () {
  // Drop curated placeholders that the real archive replaces.
  const groups = structuredClone(curated.groups)
    .filter((g) => g.name !== "Waiting to be sorted" && g.name !== "Hackjams and civic hacking");
  groups.forEach((g) => { g.posts = g.posts.filter((p) => !(p.src === "Old blog" && p.url.endsWith("/"))); });
  const used = new Set();

  // 1. Real URLs for curated Medium posts.
  for (const g of groups) {
    for (const p of g.posts) {
      if (!p.src.startsWith("Medium")) continue;
      const m = medium.posts.find((x) => {
        const a = norm(x.title), b = norm(p.title);
        return a === b || a.startsWith(b) || b.startsWith(a);
      });
      if (m) { p.url = m.url; used.add(m.url); }
    }
  }

  // 2. New Medium posts.
  const find = (name) => groups.find((g) => g.name === name || g.slug === name);
  const unsorted = [];
  for (const m of medium.posts) {
    if (used.has(m.url)) continue;
    const post = { date: m.date, title: m.title, src: "Medium", url: m.url };
    let target = map.byUrl[m.url] && find(map.byUrl[m.url]);
    if (!target) {
      const cat = m.categories.find((c) => map.byCategory[c]);
      target = cat && find(map.byCategory[cat]);
    }
    if (target) target.posts.unshift(post); else unsorted.push(post);
  }
  if (unsorted.length) groups.push({ name: "New on Medium", blurb: "Recent posts that haven’t found a project yet.", posts: unsorted });

  // 3. The old blog.
  const rows = readFileSync(new URL("./oldBlog.tsv", import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => {
    const [iso, title, path, code] = l.split("|");
    return { iso, title: title || "(untitled)", path, code };
  });
  const yearCounts = {};
  for (const r of rows) {
    yearCounts[r.iso.slice(0, 4)] = (yearCounts[r.iso.slice(0, 4)] || 0) + 1;
    const meta = OLD_GROUPS[r.code] || OLD_GROUPS.E;
    let g = meta.find ? find(meta.find) : groups.find((x) => x.name === meta.name);
    if (!g) { g = { ...meta, posts: [] }; groups.push(g); }
    g.posts.push({ date: label(r.iso), iso: r.iso, title: r.title, src: "Old blog", url: OLD + r.path });
  }

  // Newest first within a group (undated Medium entries keep their place), then planted projects first.
  for (const g of groups) g.posts.sort((a, b) => (b.iso || "").localeCompare(a.iso || "") || 0);
  const rank = (g) => { const i = ORDER.indexOf(g.slug); return i === -1 ? 100 : i; };
  groups.sort((a, b) => rank(a) - rank(b));

  const years = Object.entries(yearCounts).sort((a, b) => b[0] - a[0]).map(([year, count]) => ({ year: +year, count }));
  return { ...curated, groups, years };
}
