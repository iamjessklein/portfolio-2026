// Combines the hand-curated writing groups with posts synced from Medium.
//  - A synced post that matches a curated post by title just supplies its real URL.
//  - A new post goes to the group named in mediumMap.json (by URL, then by Medium tag).
//  - Anything still unplaced collects in an unplanted "New on Medium" group.
import curated from "./writingCurated.json" with { type: "json" };
import medium from "./medium.json" with { type: "json" };
import map from "./mediumMap.json" with { type: "json" };

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export default function () {
  const groups = structuredClone(curated.groups);
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

  // 2. New posts.
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
  if (unsorted.length) {
    groups.splice(groups.length - 1, 0, {
      name: "New on Medium",
      blurb: "Recent posts that haven’t found a project yet.",
      posts: unsorted,
    });
  }
  return { ...curated, groups };
}
