"""Turns the edited old-blog-sorter.xlsx back into src/_data/oldBlog.tsv.
Usage: python3 scripts/sheet-to-tsv.py path/to/old-blog-sorter.xlsx
Needs: pip install openpyxl. Project names map to one-letter codes (see CODES); any new name is added as a new group."""
import sys
from openpyxl import load_workbook
CODES = {'Open Badges with Mozilla':'B','Hackasaurus':'H','Mozilla Webmaker':'W','Hive Learning Network with Mozilla':'V',
         'Rockaway Hack Jams After Hurricane Sandy':'R','More from Mozilla':'M','Parsons and my thesis':'P','Everything else':'E'}
BASE = 'https://jessicaklein.blogspot.com'
ws = load_workbook(sys.argv[1], data_only=True)['Posts']
out = []
for date, title, project, link in ws.iter_rows(min_row=2, values_only=True):
    if not link: continue
    code = CODES.get(project)
    if code is None:
        print('Unknown project, left as E:', project, '->', title); code = 'E'
    out.append('|'.join([str(date), str(title or ''), link.replace(BASE, ''), code]))
open('src/_data/oldBlog.tsv', 'w').write('\n'.join(out) + '\n')
print(len(out), 'posts written')
