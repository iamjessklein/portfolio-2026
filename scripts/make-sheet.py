"""Builds garden-content.xlsx (projects + writing posts) from the site's current data.
Usage: node -e 'import("./src/_data/writing.js").then(m=>{...})' is wrapped by make-sheet.sh; run: bash scripts/make-sheet.sh [out.xlsx]"""
import json, re, glob, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation

out = sys.argv[2] if len(sys.argv) > 2 else 'garden-content.xlsx'
posts = json.load(open(sys.argv[1]))
F = 'Arial'

def front(path):
    fm = re.match(r'---\n(.*?)\n---\n', open(path).read(), re.S).group(1)
    d = {}
    for line in fm.split('\n'):
        k, _, v = line.partition(':'); d[k.strip()] = v.strip()
    s = lambda k: d.get(k, '').strip('"')
    topics = ', '.join(json.loads(d['topics'])) if d.get('topics', '').startswith('[') else ''
    return dict(title=s('title'), summary=s('summary'), stage=s('stage'), garden=s('garden'), order=int(s('order') or 99), topics=topics)

projects = []
for f in glob.glob('src/notes/*.html'):
    d = front(f); d['slug'] = f.split('/')[-1][:-5]; projects.append(d)
projects.sort(key=lambda p: p['order'])

PATCH_NAMES = ['Wikipedia and Wikimedia design', 'Around New York', 'Notes to self', 'More from Mozilla', 'Parsons and my thesis', 'Everything else']
head = PatternFill('solid', fgColor='3F5A2E'); edit = PatternFill('solid', fgColor='FFF7C2')
def header(ws, cols):
    ws.append(cols)
    for c in ws[1]:
        c.font = Font(name=F, bold=True, color='FFFFFF'); c.fill = head; c.alignment = Alignment(vertical='center')
    ws.row_dimensions[1].height = 22; ws.freeze_panes = 'A2'

wb = Workbook()
rm = wb.active; rm.title = 'Read me'
lines = ['Garden content',
 '',
 'Projects tab: one row per project in the garden. Edit the yellow cells: Title, Stage, Garden, Summary, Topics, Show order.',
 'Stage: seedling (just planted), budding (growing), evergreen (established). Garden: community (with a team) or balcony (on my own).',
 'Topics: separate with commas. Show order: 1 appears first on the garden page.',
 '',
 'Posts tab: one row per piece of writing (old blog and Medium). Change the Project (yellow, dropdown) to move a post.',
 'Stage and Garden on the Posts tab fill in from the project, so you do not edit them there.',
 '"Not planted yet" means that patch of writing is not a project page yet.',
 '',
 'When you are done, attach this file in the chat and say "update the site from the sheet".']
for i, t in enumerate(lines, 1):
    rm.cell(i, 1, t).font = Font(name=F, size=14 if i == 1 else 11, bold=(i == 1))
rm.column_dimensions['A'].width = 120

pj = wb.create_sheet('Projects')
header(pj, ['Title', 'Stage', 'Garden', 'Summary', 'Topics', 'Show order', 'Posts', 'Page'])
for p in projects:
    pj.append([p['title'], p['stage'], p['garden'], p['summary'], p['topics'], p['order'], None, p['slug']])
n = len(projects) + 1
for r in range(2, n + 1):
    for c in range(1, 9): pj.cell(r, c).font = Font(name=F, size=10)
    for c in range(1, 7): pj.cell(r, c).fill = edit
    pj.cell(r, 7, f'=COUNTIF(Posts!$D$2:$D$9999,A{r})')
    pj.cell(r, 8).font = Font(name=F, size=9, color='808080')
for col, w in zip('ABCDEFGH', [44, 12, 12, 60, 38, 11, 8, 40]): pj.column_dimensions[col].width = w
dv1 = DataValidation(type='list', formula1='"seedling,budding,evergreen"', allow_blank=False); dv1.add(f'B2:B{n}')
dv2 = DataValidation(type='list', formula1='"community,balcony"', allow_blank=False); dv2.add(f'C2:C{n}')
pj.add_data_validation(dv1); pj.add_data_validation(dv2)

lst = wb.create_sheet('Lists')
lst.cell(1, 1, 'Project choices (follows the Projects tab, then patches of writing)').font = Font(name=F, bold=True)
for i in range(len(projects)):
    lst.cell(i + 2, 1, f'=Projects!A{i + 2}').font = Font(name=F, size=10)
for j, nme in enumerate(PATCH_NAMES):
    lst.cell(len(projects) + 2 + j, 1, nme).font = Font(name=F, size=10)
lastc = len(projects) + 1 + len(PATCH_NAMES)
lst.column_dimensions['A'].width = 60

ps = wb.create_sheet('Posts', 2)
header(ps, ['Date', 'Title', 'Source', 'Project', 'Stage', 'Garden', 'Link'])
posts.sort(key=lambda p: (p['iso'] or '0000'), reverse=True)
for p in posts:
    ps.append([p['d'], p['t'], 'Medium' if p['s'].startswith('Medium') else 'Blogspot', p['g'], None, None, p['u']])
m = len(posts) + 1
for r in range(2, m + 1):
    ps.cell(r, 5, f'=IFERROR(INDEX(Projects!$B$2:$B${n},MATCH(D{r},Projects!$A$2:$A${n},0)),"Not planted yet")')
    ps.cell(r, 6, f'=IFERROR(INDEX(Projects!$C$2:$C${n},MATCH(D{r},Projects!$A$2:$A${n},0)),"")')
    for c in range(1, 8): ps.cell(r, c).font = Font(name=F, size=10)
    ps.cell(r, 4).fill = edit
    ps.cell(r, 7).font = Font(name=F, size=10, color='0000FF', underline='single'); ps.cell(r, 7).hyperlink = ps.cell(r, 7).value
for col, w in zip('ABCDEFG', [11, 64, 10, 42, 13, 12, 56]): ps.column_dimensions[col].width = w
dv3 = DataValidation(type='list', formula1=f'=Lists!$A$2:$A${lastc}', allow_blank=False, showErrorMessage=True, errorTitle='Pick a project', error='Choose a project from the list.')
ps.add_data_validation(dv3); dv3.add(f'D2:D{m}')
ps.auto_filter.ref = f'A1:G{m}'
wb.save(out); print('saved', out, len(projects), 'projects', len(posts), 'posts')
