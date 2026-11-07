// Combines hand-curated writing groups, posts synced from Medium, and the old Blogspot archive.
//  - Medium: a synced post that matches a curated one by title supplies its real URL; a new post goes where
//    mediumMap.json says (byTitle, byUrl, then Medium tag), else to "New on Medium".
//  - Old blog: oldBlog.tsv holds every post as date|title|path|group, where group is a project slug
//    (a file in src/notes) or a patch id (see PATCHES). Edit the last column to move a post.
import { readFileSync, readdirSync } from "node:fs";
import curated from "./writingCurated.json" with { type: "json" };
import medium from "./medium.json" with { type: "json" };
import map from "./mediumMap.json" with { type: "json" };

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const OLD = curated.oldBlog.replace(/\/$/, "");

// Writing patches that aren't projects (yet).
const PATCHES = {
  "wikipedia-and-wikimedia-design": { name: "Wikipedia and Wikimedia design", blurb: "Design work and thinking from inside Wikimedia." },
  "around-new-york": { name: "Around New York", blurb: "Local life, close to home." },
  "notes-to-self": { name: "Notes to self", blurb: "Looser pieces about energy, parties and other things that stuck." },
  "more-from-mozilla": { name: "More from Mozilla", blurb: "Design sprints, prototypes and notes from my years at Mozilla that sit outside a single project." },
  "parsons-and-my-thesis": { name: "Parsons and my thesis", blurb: "A sketchbook-style blog from 2008 to 2010: character design, animation, research and my thesis project." },
  "everything-else": { name: "Everything else", blurb: "Odds and ends." },
};
// Blurbs for project groups whose project page has no summary.
const BLURBS = {
  "hackasaurus-code-tinkering-to-mastery": "Hack jams, training missions and hackable comics for young people learning the web.",
  "mozilla-webmaker": "Designing tools that teach people to make things for the web.",
  "hive-learning-network-with-mozilla": "Hive NYC, Hive Labs, and prototypes for a network of educators.",
  "rockaway-hack-jams-after-hurricane-sandy": "Helping my home neighborhood after the storm.",
};

// Project pages: title, stage and order come straight from each note's front matter.
function projects() {
  const dir = new URL("../notes/", import.meta.url);
  const out = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".html"))) {
    const fm = (readFileSync(new URL(f, dir), "utf8").match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
    const get = (k) => ((fm.match(new RegExp(`^${k}:\\s*(.*)$`, "m")) || [])[1] || "").trim().replace(/^"|"$/g, "");
    const body = readFileSync(new URL(f, dir), "utf8").replace(/^---\n[\s\S]*?\n---\n?/, "");
    const filled = !/still to be written|needs watering|needs tending/i.test(body) && body.replace(/<[^>]+>/g, "").trim().length >= 100;
    out[f.replace(/\.html$/, "")] = { title: get("title"), summary: get("summary"), stage: get("stage"), order: (filled ? 0 : 500) + (+get("order") || 99) };
  }
  return out;
}

export default function () {
  const proj = projects();
  const groups = structuredClone(curated.groups)
    .filter((g) => g.name !== "Waiting to be sorted" && g.name !== "Hackjams and civic hacking");
  groups.forEach((g) => { g.posts = g.posts.filter((p) => !(p.src === "Blogspot" && p.url.endsWith("/"))); });
  const used = new Set();

  // Find or create a group by project slug or patch id.
  const patchByName = Object.fromEntries(Object.entries(PATCHES).map(([id, p]) => [p.name, id]));
  const groupFor = (id) => {
    let g = groups.find((x) => x.slug === id || (PATCHES[id] && x.name === PATCHES[id].name));
    if (g) return g;
    if (proj[id]) g = { slug: id, stage: proj[id].stage, name: proj[id].title, blurb: proj[id].summary || BLURBS[id] || "", posts: [] };
    else if (PATCHES[id]) g = { ...PATCHES[id], posts: [] };
    else g = { ...PATCHES["everything-else"], posts: [] };
    groups.push(g);
    return g;
  };
  // Keep project groups in step with their pages (a title or stage edited in a note shows up here).
  groups.forEach((g) => { if (g.slug && proj[g.slug]) { g.name = proj[g.slug].title; g.stage = proj[g.slug].stage; } });

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
  const unsorted = [];
  for (const m of medium.posts) {
    if (used.has(m.url)) continue;
    const post = { date: m.date, title: m.title, src: "Medium", url: m.url };
    const id = (map.byTitle || {})[m.title] || map.byUrl[m.url] || (() => { const c = m.categories.find((k) => map.byCategory[k]); return c && map.byCategory[c]; })();
    const target = id && groups.find((g) => g.slug === id || g.name === id || (PATCHES[id] && g.name === PATCHES[id].name));
    if (target) target.posts.unshift(post); else unsorted.push(post);
  }
  if (unsorted.length) groups.push({ name: "New on Medium", blurb: "Recent posts that haven’t found a project yet.", posts: unsorted });

  // 2b. Manual moves of any Medium post by title (set from the spreadsheet).
  for (const [title, id] of Object.entries(map.byTitle || {})) {
    for (const g of [...groups]) {
      const i = g.posts.findIndex((p) => p.src.startsWith("Medium") && norm(p.title) === norm(title));
      if (i === -1) continue;
      const to = groupFor(id);
      if (to !== g) to.posts.push(...g.posts.splice(i, 1));
    }
  }

  // 3. The old blog.
  const rows = readFileSync(new URL("./oldBlog.tsv", import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => {
    const [iso, title, path, id] = l.split("|");
    return { iso, title: title || "(untitled)", path, id };
  });
  const yearCounts = {};
  for (const r of rows) {
    yearCounts[r.iso.slice(0, 4)] = (yearCounts[r.iso.slice(0, 4)] || 0) + 1;
    groupFor(r.id).posts.push({ date: label(r.iso), iso: r.iso, title: r.title, src: "Blogspot", url: OLD + r.path });
  }

  // Newest first inside a group; projects first (by their order on the garden page), then patches.
  for (const g of groups) g.posts.sort((a, b) => (b.iso || "").localeCompare(a.iso || ""));
  const rank = (g) => (g.slug && proj[g.slug] ? proj[g.slug].order : 1000);
  const final = groups.filter((g) => g.posts.length || g.slug).sort((a, b) => rank(a) - rank(b));

  // Every post in one list for the "sort by date" view: newest first, grouped by year, tagged with its project.
  const stamp = (p) => {
    if (p.iso) return p.iso;
    const t = Date.parse(p.date);
    return Number.isNaN(t) ? "0000-00-00" : new Date(t).toISOString().slice(0, 10);
  };
  const flat = final.flatMap((g) => g.posts.map((p) => ({ ...p, key: stamp(p), project: g.name, slug: g.slug || "" })));
  flat.sort((a, b) => b.key.localeCompare(a.key));
  const byYear = [];
  for (const p of flat) {
    const year = p.key.slice(0, 4) === "0000" ? "Undated" : p.key.slice(0, 4);
    let y = byYear[byYear.length - 1];
    if (!y || y.year !== year) { y = { year, posts: [] }; byYear.push(y); }
    y.posts.push(p);
  }
  return { ...curated, groups: final, byYear, total: flat.length };
}
