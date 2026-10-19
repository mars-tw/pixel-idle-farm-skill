"""Archive actual outputs of historical gates; restore the exact initial user evidence."""
from pathlib import Path
import json,hashlib,shutil
R=Path(__file__).resolve().parents[1];E=R/'docs/evidence/r89-art';B=R/'.audit-tmp/r89-baseline'
rows=json.loads((E/'baseline-index.json').read_text(encoding='utf8'));changed=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for row in rows:
 p=R/row['path'];backup=B/row['path'];assert backup.is_file() and sha(backup)==row['sha256']
 if p.is_file() and sha(p)!=row['sha256']:
  target=E/'regression'/row['path'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target);changed.append(dict(path=row['path'],evidence=target.relative_to(R).as_posix(),sha256=sha(target),restoredSha256=row['sha256']));shutil.copy2(backup,p)
 assert p.is_file() and sha(p)==row['sha256']
(E/'regression-index.json').write_text(json.dumps(dict(status='VERIFIED',initialFiles=len(rows),changed=changed,restored=True),indent=2)+'\n',encoding='utf8');print('restored exact initial evidence bytes; archived '+str(len(changed)))
