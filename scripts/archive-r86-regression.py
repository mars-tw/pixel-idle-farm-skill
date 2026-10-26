"""Archive current test receipts, restore exact starting bytes incl. user changes."""
from pathlib import Path
import hashlib,json,shutil
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'.audit-tmp/r86-evidence-baseline';OUT=ROOT/'docs/evidence/r86-art'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 index=json.loads((BASE/'index.json').read_text(encoding='utf-8'));saved=OUT/'regression-index.json';old=json.loads(saved.read_text(encoding='utf-8'))['records'] if saved.exists() else [];rows={r['original']:r for r in old}
 for r in index:
  rel=Path(r['path']);assert rel.parts[:2]==('docs','evidence') and '..' not in rel.parts
  original=BASE/rel;target=ROOT/rel;assert sha(original)==r['sha256']
  if target.exists() and sha(target)!=r['sha256']:
   dest=OUT/'regression'/rel.relative_to('docs/evidence');dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,dest);rows[r['path']]=dict(original=r['path'],archived=dest.relative_to(ROOT).as_posix(),currentRunSha256=sha(dest),restoredStartingSha256=r['sha256']);shutil.copy2(original,target);assert sha(target)==r['sha256']
 saved.write_text(json.dumps(dict(status='VERIFIED',records=list(rows.values()),noUntrackedFilesDeleted=True,startingUserChangesPreserved=True),indent=2)+'\n',encoding='utf-8');print('VERIFIED archived/restored '+str(len(rows))+' historical evidence files')
if __name__=='__main__':main()
