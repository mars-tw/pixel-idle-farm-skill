"""Archive this run's legacy test outputs, restoring the exact initial user bytes."""
from pathlib import Path
import json,hashlib,shutil,subprocess
R=Path(__file__).resolve().parents[1];E=R/'docs/evidence/r88-art';B=R/'.audit-tmp/r88-baseline'
rows=json.loads((E/'baseline-index.json').read_text(encoding='utf8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
changed=[]
for row in rows:
 p=R/row['path'];backup=B/row['path'];assert backup.is_file() and sha(backup)==row['sha256']
 if p.is_file() and sha(p)!=row['sha256']:
  target=E/'regression'/row['path'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
  changed.append(dict(path=row['path'],currentEvidence=target.relative_to(R).as_posix(),currentSha256=sha(target),restoredSha256=row['sha256']))
  shutil.copy2(backup,p)
 assert p.is_file() and sha(p)==row['sha256'],'original evidence must be restored byte for byte'
base=json.loads((E/'start.json').read_text(encoding='utf8'))['commit'];retired=[]
for device in ['iphone','ipad']:
 rel=f'docs/store/screenshots/{device}-06-same-age.png';p=R/rel
 # Only explicitly named tracked predecessor files. Existing untracked files are never removed.
 subprocess.run(['git','ls-files','--error-unmatch','--',rel],cwd=R,check=True,stdout=subprocess.PIPE)
 saved=R/'docs/art/compare/r88/before/store'/p.name
 original=subprocess.check_output(['git','show',f'{base}:{rel}'],cwd=R)
 assert saved.is_file() and hashlib.sha256(original).hexdigest()==sha(saved)
 assert p.resolve().is_relative_to((R/'docs/store/screenshots').resolve())
 if p.exists():p.unlink()
 retired.append(dict(previousPath=rel,archive=saved.relative_to(R).as_posix(),sha256=sha(saved),replacement=f'docs/store/screenshots/{device}-06-porch.png'))
(E/'regression-index.json').write_text(json.dumps(dict(status='VERIFIED',initialFilesVerified=len(rows),changedFiles=len(changed),restored=True,records=changed,retiredStoreImages=retired),indent=2)+'\n',encoding='utf8')
print(json.dumps(dict(status='VERIFIED',initialFiles=len(rows),archived=len(changed),retired=len(retired))))
