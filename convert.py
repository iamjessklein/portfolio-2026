#!/usr/bin/env python3
"""
Convert a Notion "Markdown & CSV" export of jessicaklein.com into:

  content/            clean markdown + YAML frontmatter (Astro-ready)
  site/               plain static HTML that mirrors the current Notion layout

Usage:
    python3 convert.py "path/to/unzipped/Private & Shared" out/

Requires: pip install markdown
"""

import csv
import html
import os
import re
import shutil
import sys
import unicodedata
from pathlib import Path
from urllib.parse import unquote

import markdown

HASH_RE = re.compile(r"\s+[0-9a-f]{32}(?=\.\w+$|$)")
IMG_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
LINK_RE = re.compile(r"(?<!!)\[([^\]]*)\]\(([^)]+)\)")

VIDEO_EXT = {".mov", ".mp4", ".webm"}
DOC_EXT = {".pdf"}


def slugify(text):
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode()
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", text)


def strip_hash(name):
    """'Open Design Kit 27afb74d...md' -> 'Open Design Kit'"""
    stem = Path(name).stem
    return HASH_RE.sub("", stem).strip()


def clean_asset_name(name):
    """Notion mangles names: '1_nf7fVhAcW6to2tHgfy6krw2x.webp'. Keep it, just tidy."""
    name = unquote(name)
    name = HASH_RE.sub("", name)
    name = re.sub(r"[^\w.\-]+", "-", name).strip("-")
    return name.lower()


def renumber_lists(md):
    """Notion exports every ordered item as '1.'. Renumber consecutive runs."""
    out, n = [], 0
    for line in md.split("\n"):
        m = re.match(r"^(\s*)1\.\s+(.*)$", line)
        if m:
            n += 1
            out.append(f"{m.group(1)}{n}. {m.group(2)}")
        else:
            if line.strip() and not line.startswith(" "):
                n = 0
            out.append(line)
    return "\n".join(out)


def clean_markdown(md):
    md = md.replace("\r\n", "\n")
    lines = md.split("\n")
    # drop the H1 (title lives in frontmatter) and the 'Design values:' metadata line
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
    lines = [l for l in lines if not re.match(r"^Design values:\s*", l)]
    md = "\n".join(lines)
    md = md.replace("****", "")              # stray bold artifacts
    md = re.sub(r"^# (?=\S)", "## ", md, flags=re.M)   # page title is the only H1
    md = re.sub(r"\n{3,}", "\n\n", md)       # collapse blank runs
    md = renumber_lists(md)
    return md.strip()


def load_index(csv_path):
    """Return {title: {'values':…, 'featured':bool, 'personal':bool}} from the database CSV."""
    index = {}
    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            raw = (row.get("Name") or "").strip()
            if not raw:
                continue                      # the empty 'New page' row
            personal = raw.rstrip().endswith("*")
            title = raw.rstrip().rstrip("*").strip()
            index[title] = {
                "values": (row.get("Design values") or "").strip(),
                "featured": (row.get("Featured?") or "").strip().lower() == "yes",
                "personal": personal,
            }
    return index


def match_title(file_title, index):
    """Notion filenames lose punctuation ('change.org' -> 'change org'). Match loosely."""
    norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
    target = norm(file_title)
    for title, meta in index.items():
        if norm(title) == target:
            return title, meta
    for title, meta in index.items():
        if norm(title).startswith(target[:20]):
            return title, meta
    return file_title, {"values": "", "featured": False, "personal": False}


def process_project(md_path, index, out_content, out_assets, report):
    file_title = strip_hash(md_path.name)
    raw = md_path.read_text(encoding="utf-8")
    if len(raw.split()) < 5:
        report["skipped"].append(file_title)
        return None

    title, meta = match_title(file_title, index)
    slug = slugify(title)
    body = clean_markdown(raw)

    asset_dir = md_path.parent / md_path.stem
    dest_dir = out_assets / slug
    heavy = []

    def rewrite(match, is_image):
        alt, target = match.group(1), match.group(2)
        if target.startswith(("http://", "https://", "mailto:", "#")):
            return match.group(0)
        src = md_path.parent / unquote(target)
        if not src.exists():
            report["missing"].append(f"{slug}: {unquote(target)}")
            return match.group(0)
        dest_dir.mkdir(parents=True, exist_ok=True)
        new_name = clean_asset_name(src.name)
        shutil.copy2(src, dest_dir / new_name)
        size_mb = src.stat().st_size / 1_048_576
        if size_mb > 2:
            heavy.append((new_name, round(size_mb, 1)))
        rel = f"/assets/{slug}/{new_name}"
        ext = src.suffix.lower()
        if ext in VIDEO_EXT:
            return f'<video src="{rel}" controls playsinline></video>'
        if ext in DOC_EXT and is_image:
            return f"[{alt or new_name}]({rel})"
        return f"![{alt}]({rel})" if is_image else f"[{alt}]({rel})"

    body = IMG_RE.sub(lambda m: rewrite(m, True), body)
    body = LINK_RE.sub(lambda m: rewrite(m, False), body)

    fm = [
        "---",
        f'title: "{title}"',
        f'slug: "{slug}"',
        f'designValue: "{meta["values"]}"',
        f'featured: {str(meta["featured"]).lower()}',
        f'personal: {str(meta["personal"]).lower()}',
        "---",
        "",
    ]
    (out_content / f"{slug}.md").write_text("\n".join(fm) + body + "\n", encoding="utf-8")

    for name, mb in heavy:
        report["heavy"].append(f"{slug}/{name} ({mb} MB)")

    return {"title": title, "slug": slug, "body": body, **meta}


CSS = """
:root {
  --ink: #1e1e1c;
  --muted: #6f6e6a;
  --rule: #e6e4de;
  --learning: #fce9dd;
  --community: #dff0e6;
  --experimentation: #dfeaf7;
  --measure: 46rem;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 4rem 1.5rem 6rem;
  font-family: ui-monospace, "SFMono-Regular", "Menlo", "Consolas", monospace;
  font-size: 15px;
  line-height: 1.75;
  color: var(--ink);
  background: #fff;
}
main { max-width: var(--measure); margin: 0 auto; }
h1 { font-size: 2.25rem; letter-spacing: -0.02em; margin: 0 0 1.25rem; }
h2 { font-size: 1.25rem; margin: 2.5rem 0 0.75rem; }
h3 { font-size: 1rem; margin: 2rem 0 0.5rem; }
p, li { max-width: 40rem; }
a { color: inherit; text-underline-offset: 3px; }
mark { background: var(--learning); color: inherit; padding: 0 0.15em; }
mark.community { background: var(--community); }
mark.experimentation { background: var(--experimentation); }
.tagline { margin: 0 0 3rem; }
.tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; }
.tab {
  font: inherit; cursor: pointer; border: 0; border-radius: 999px;
  padding: 0.35rem 0.9rem; background: transparent; color: var(--muted);
}
.tab[aria-selected="true"] { background: #f1efe9; color: var(--ink); }
.tab:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
ul.projects { list-style: none; padding: 0; margin: 0 0 2rem; }
ul.projects li { margin: 0.35rem 0; }
ul.projects a { text-decoration: none; }
ul.projects a:hover { text-decoration: underline; }
.legend { color: var(--muted); margin: 0 0 2.5rem; }
hr { border: 0; border-top: 1px solid var(--rule); margin: 3rem 0; }
details summary { cursor: pointer; font-weight: 500; }
details[open] summary { margin-bottom: 1rem; }
img, video { max-width: 100%; height: auto; display: block; margin: 1.5rem 0; }
.back { display: inline-block; margin-bottom: 2.5rem; color: var(--muted); text-decoration: none; }
.back:hover { text-decoration: underline; }
.meta { color: var(--muted); margin: 0 0 2.5rem; }
@media (max-width: 40rem) { body { padding: 2.5rem 1.25rem 4rem; } h1 { font-size: 1.75rem; } }
"""

TABS_JS = """
const tabs = document.querySelectorAll('.tab');
const items = document.querySelectorAll('ul.projects li');
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(o => o.setAttribute('aria-selected', String(o === t)));
  const showAll = t.dataset.view === 'all';
  items.forEach(li => {
    li.hidden = !showAll && li.dataset.featured !== 'true';
  });
}));
"""


def page(title, body, depth=0):
    up = "../" * depth
    body = body.replace('src="/assets/', f'src="{up}assets/')
    body = body.replace('href="/assets/', f'href="{up}assets/')
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<link rel="stylesheet" href="{up}style.css">
</head>
<body>
<main>
{body}
</main>
</body>
</html>
"""


def build_site(projects, home_md, out_site, out_assets):
    (out_site / "style.css").write_text(CSS.strip() + "\n", encoding="utf-8")
    if out_assets.exists():
        shutil.copytree(out_assets, out_site / "assets", dirs_exist_ok=True)

    md = markdown.Markdown(extensions=["extra", "sane_lists"])

    rows = []
    for p in projects:
        star = " *" if p["personal"] else ""
        hidden = "" if p["featured"] else " hidden"
        rows.append(
            f'  <li data-featured="{str(p["featured"]).lower()}"{hidden}>'
            f'<a href="projects/{p["slug"]}.html">{html.escape(p["title"])}{star}</a></li>'
        )

    about = md.convert(home_md) if home_md else ""
    md.reset()

    home = f"""<h1>Jess Klein</h1>
<p class="tagline">My design fosters <mark>learning</mark>, <mark class="community">community</mark>, and <mark class="experimentation">experimentation</mark>.</p>

<div class="tabs" role="tablist">
  <button class="tab" role="tab" data-view="featured" aria-selected="true">Featured</button>
  <button class="tab" role="tab" data-view="all" aria-selected="false">All projects</button>
</div>

<ul class="projects">
{chr(10).join(rows)}
</ul>

<p class="legend">* = personal project</p>

<hr>

<details open>
  <summary>About me.</summary>
{about}
</details>

<script>{TABS_JS}</script>
"""
    (out_site / "index.html").write_text(page("Jess Klein", home), encoding="utf-8")

    proj_dir = out_site / "projects"
    proj_dir.mkdir(parents=True, exist_ok=True)
    for p in projects:
        meta = []
        if p["values"]:
            meta.append(html.escape(p["values"]))
        if p["personal"]:
            meta.append("personal project")
        meta_html = f'<p class="meta">{" &middot; ".join(meta)}</p>' if meta else ""
        body = md.convert(p["body"])
        md.reset()
        inner = (
            f'<a class="back" href="../index.html">&larr; Jess Klein</a>\n'
            f'<h1>{html.escape(p["title"])}</h1>\n{meta_html}\n{body}'
        )
        (proj_dir / f"{p['slug']}.html").write_text(
            page(f'{p["title"]} — Jess Klein', inner, depth=1), encoding="utf-8"
        )


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    root = Path(sys.argv[1]).expanduser()
    out = Path(sys.argv[2]).expanduser()

    home_file = next(root.glob("Jess Klein *.md"), None)
    inner = root / "Jess Klein"
    projects_dir = inner / "Projects Home"
    csv_path = next(inner.glob("Projects Home *_all.csv"), None) or next(
        inner.glob("Projects Home *.csv"), None
    )
    if not projects_dir.is_dir() or not csv_path:
        print(f"Could not find the projects database under {root}")
        sys.exit(1)

    out_content = out / "content" / "projects"
    out_assets = out / "assets"
    out_site = out / "site"
    for d in (out_content, out_assets, out_site):
        d.mkdir(parents=True, exist_ok=True)

    index = load_index(csv_path)
    report = {"skipped": [], "missing": [], "heavy": []}

    projects = []
    for md_path in sorted(projects_dir.glob("*.md")):
        result = process_project(md_path, index, out_content, out_assets, report)
        if result:
            projects.append(result)

    order = list(index.keys())
    projects.sort(key=lambda p: order.index(p["title"]) if p["title"] in order else 99)

    home_md = ""
    if home_file:
        raw = home_file.read_text(encoding="utf-8")
        m = re.search(r"- \*\*About me\.\*\*\n(.*)", raw, re.S)
        if m:
            home_md = "\n".join(l[4:] if l.startswith("    ") else l
                                for l in m.group(1).split("\n")).strip()
            def fix(match):
                src = root / unquote(match.group(2))
                if not src.exists():
                    return match.group(0)
                (out_site / "assets").mkdir(parents=True, exist_ok=True)
                name = clean_asset_name(src.name)
                shutil.copy2(src, out_assets / name)
                return f"![{match.group(1)}](/assets/{name})"
            home_md = IMG_RE.sub(fix, home_md)

    build_site(projects, home_md, out_site, out_assets)

    print(f"\n{len(projects)} projects converted "
          f"({sum(1 for p in projects if p['featured'])} featured, "
          f"{sum(1 for p in projects if p['personal'])} personal)")
    print(f"  markdown -> {out_content}")
    print(f"  html     -> {out_site}")
    for label, items in report.items():
        if items:
            print(f"\n{label}:")
            for i in items:
                print(f"  - {i}")


if __name__ == "__main__":
    main()
