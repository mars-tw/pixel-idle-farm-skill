"""Archive regression outputs, restore every pre-existing file byte-for-byte."""
import hashlib,json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'.audit-tmp/content-r2-baseline';OUT=ROOT/'docs/content/r2'
records=json.loads((BASE/'files.json').read_text(encoding='utf-8'));changed=[]
for name,sha in records.items():
 p=ROOT/name;backup=BASE/'files'/name
 if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=sha:
  assert name.startswith(('docs/evidence/','docs/store/','docs/content/r1/','assets/generated/r68/')), 'Unexpected concurrent edit; preserve it: '+name
  if p.is_file():
   dest=OUT/'regression'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
  p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(backup,p);changed.append(name)
 assert hashlib.sha256(p.read_bytes()).hexdigest()==sha,name
generated=[]
for folder in ['docs/evidence','docs/store/screenshots','docs/content/r1']:
 for p in list((ROOT/folder).rglob('*')):
  if not p.is_file():continue
  name=p.relative_to(ROOT).as_posix()
  if name in records or p.name in ['iphone-08-neighbor-story.png','ipad-08-neighbor-story.png']:continue
  dest=OUT/'regression'/name
  assert p.resolve().is_relative_to(ROOT.resolve()) and dest.resolve().is_relative_to(OUT.resolve())
  assert not dest.exists(),dest
  sha=hashlib.sha256(p.read_bytes()).hexdigest();dest.parent.mkdir(parents=True,exist_ok=True);shutil.move(str(p),str(dest))
  assert hashlib.sha256(dest.read_bytes()).hexdigest()==sha
  generated.append(dict(path=name,archived=dest.relative_to(ROOT).as_posix(),sha256=sha))
(OUT/'historical-readback.json').write_text(json.dumps(dict(status='VERIFIED',preserved=len(records),archivedAndRestored=changed,generatedArtifactsArchived=generated,initialStatus=(BASE/'initial-status.txt').read_text(encoding='utf-8')),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED preserved',len(records),'original files including pre-existing untracked/dirty files; archived',len(changed))
