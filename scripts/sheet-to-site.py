"""Applies an edited garden-content.xlsx to the site's files.
Usage (from the repo root): python3 scripts/sheet-to-site.py path/to/garden-content.xlsx
  Projects tab -> front matter of src/notes/<page>.html (title, summary, stage, garden, order, topics)
  Posts tab    -> src/_data/oldBlog.tsv (old blog posts) and src/_data/mediumMap.json (Medium posts, by title)
Needs: pip install openpyxl"""
import sys, re, json
from openpyxl import load_workbook

PATCH_IDS = {'Wikipedia and Wikimedia design': 'wikipedia-and-wikimedia-design', 'Around New York': 'around-new-york',
             'Notes to self': 'notes-to-self', 'More from Mozilla': 'more-from-mozilla',
             'Parsons and my thesis': 'parsons-and-my-thesis', 'Everything else': 'everything-else'}
BASE = 'https://jessicaklein.blogspot.com'
wb = load_workbook(sys.argv[1], data_only=True)
q = lambda s: json.dumps(s, ensure_ascii=False)

# Projects -> note front matter
name_to_slug = {}
for title, stage, garden, summary, topics, order, _n, slug in wb['Projects'].iter_rows(min_row=2, values_only=True):
    if not slug: continue
    name_to_slug[title] = slug
    path = f'src/notes/{slug}.html'
    text = open(path).read()
    body = re.sub(r'^---\n.*?\n---\n', '', text, count=1, flags=re.S)
    tlist = [t.strip() for t in str(topics or '').split(',') if t.strip()]
    fm = ['---', 'layout: note.njk', f'title: {q(title)}']
    if summary: fm.append(f'summary: {q(summary)}')
    fm += [f'stage: {q(stage)}', f'garden: {q(garden)}', f'order: {int(order)}', f'topics: {json.dumps(tlist, ensure_ascii=False)}', '---', '']
    open(path, 'w').write('\n'.join(fm) + body)

# Posts -> oldBlog.tsv + mediumMap.byTitle
old = {}
for l in open('src/_data/oldBlog.tsv').read().split('\n'):
    if l:
        iso, t, p, _ = l.split('|'); old[p] = (iso, t)
tsv, by_title, problems = [], {}, []
for date, title, source, project, _s, _g, link in wb['Posts'].iter_rows(min_row=2, values_only=True):
    if not title: continue
    pid = name_to_slug.get(project) or PATCH_IDS.get(project)
    if not pid:
        problems.append(f'{title}: unknown project "{project}"'); pid = 'everything-else'
    if source == 'Medium':
        by_title[title] = pid
    else:
        path = link.replace(BASE, '')
        iso, t = old[path]
        tsv.append('|'.join([iso, t, path, pid]))
tsv.sort(key=lambda l: l.split('|')[0], reverse=True)
open('src/_data/oldBlog.tsv', 'w').write('\n'.join(tsv) + '\n')
mm = json.load(open('src/_data/mediumMap.json')); mm['byTitle'] = by_title
open('src/_data/mediumMap.json', 'w').write(json.dumps(mm, indent=2, ensure_ascii=False) + '\n')
print(len(name_to_slug), 'projects,', len(tsv), 'old blog posts,', len(by_title), 'Medium posts updated')
for p in problems: print('PROBLEM', p)
