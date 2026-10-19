"""Preserve baseline before tests that regenerate historical evidence."""
import hashlib,json,pathlib,shutil
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE=ROOT/'.audit-tmp/content-r8-baseline'
BASE.mkdir(parents=True,exist_ok=True)
if (BASE/'baseline.json').exists(): raise SystemExit('baseline already exists; preserved')
record={}
for top in ['docs','assets']:
 for f in (ROOT/top).rglob('*'):
  if not f.is_file():continue
  rel=f.relative_to(ROOT).as_posix()
  record[rel]=hashlib.sha256(f.read_bytes()).hexdigest()
  if top=='docs':
   dest=BASE/'files'/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dest)
for f in [*ROOT.glob('src/*'),*ROOT.glob('scripts/*'),*ROOT.glob('*')]:
 if f.is_file():record[f.relative_to(ROOT).as_posix()]=hashlib.sha256(f.read_bytes()).hexdigest()
(BASE/'baseline.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print('PREPARED baseline',len(record))
