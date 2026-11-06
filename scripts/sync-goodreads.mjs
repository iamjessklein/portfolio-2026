// Rebuilds the data-driven parts of src/_data/books.json from a Goodreads export.
// Export: Goodreads > My Books > Import and export > Export Library,
// then save the file as src/_data/goodreads_library_export.csv and run:  npm run sync:goodreads
// Hand-written parts (profile, favorites, shelf blurbs) are left alone.
import { readFile, writeFile } from "node:fs/promises";

const CSV = new URL("../src/_data/goodreads_library_export.csv", import.meta.url);
const OUT = new URL("../src/_data/books.json", import.meta.url);

function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const clean = (s) => s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const noSeries = (t) => t.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/, "").trim();
const excerpt = (s, n = 230) => {
  s = clean(s); if (s.length <= n) return s;
  const cut = s.slice(0, n); return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\-–]+$/, "") + "…";
};

const rows = parseCsv(await readFile(CSV, "utf8"));
const shelf = (n) => rows.filter((r) => r["Exclusive Shelf"] === n);
const read = shelf("read"), toRead = shelf("to-read"), dnf = shelf("did-not-finish");
const rated = read.map((r) => +r["My Rating"]).filter((n) => n > 0);
const reviews = rows.filter((r) => clean(r["My Review"]));
const avg = (rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(2);

const tagCounts = {};
for (const r of rows) for (const t of r["Bookshelves"].split(",").map((s) => s.trim())) {
  if (t && !["read", "to-read", "currently-reading", "did-not-finish"].includes(t)) tagCounts[t] = (tagCounts[t] || 0) + 1;
}

const books = JSON.parse(await readFile(OUT, "utf8"));
books.stats = [
  { n: String(read.length), label: "books read" },
  { n: String(toRead.length), label: "waiting on the shelf" },
  { n: avg, label: "average rating" },
  { n: String(reviews.length), label: "reviews written" },
];
books.reading = shelf("currently-reading").map((r) => ({ title: noSeries(r.Title), author: r.Author }));
const blurb = (name) => (books.shelves.find((s) => s.name === name) || {}).blurb || "";
books.shelves = [
  { name: "Library", count: `${read.length} read`, blurb: `Books I’ve finished. ${rated.length} ratings so far, and ${reviews.length} written reviews.` },
  { name: "Antilibrary", count: `${toRead.length} to read`, blurb: blurb("Antilibrary") },
  ...(dnf.length ? [{ name: "Did not finish", count: String(dnf.length), blurb: blurb("Did not finish") }] : []),
];
books.tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
// Recent written reviews, newest first, as short excerpts linking back to Goodreads.
books.reviewed = reviews
  .sort((a, b) => (b["Date Read"] || b["Date Added"]).localeCompare(a["Date Read"] || a["Date Added"]))
  .slice(0, 8)
  .map((r) => ({
    title: noSeries(r.Title), author: r.Author, rating: +r["My Rating"],
    summary: excerpt(r["My Review"]), url: `https://www.goodreads.com/book/show/${r["Book Id"]}`,
  }));

await writeFile(OUT, JSON.stringify(books, null, 2) + "\n");
console.log(`[goodreads] ${read.length} read, ${toRead.length} to-read, ${reviews.length} reviews, ${books.reading.length} reading`);
