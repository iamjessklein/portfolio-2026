#!/bin/bash
# Usage: bash scripts/make-sheet.sh [out.xlsx]   (needs python3 + openpyxl, from the repo root)
node -e 'import("./src/_data/writing.js").then(m=>{const w=m.default();const o=[];for(const g of w.groups)for(const p of g.posts)o.push({g:g.name,slug:g.slug||null,d:p.date,iso:p.iso||null,t:p.title,s:p.src,u:p.url});console.log(JSON.stringify(o))})' > /tmp/garden-posts.json
python3 scripts/make-sheet.py /tmp/garden-posts.json "${1:-garden-content.xlsx}"
