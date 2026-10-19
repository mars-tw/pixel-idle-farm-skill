"""Retain this run's historical-path test outputs, restore exact starting bytes."""
from pathlib import Path
import hashlib,json,shutil
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'.audit-tmp/r84-evidence-baseline';OUT=ROOT/'docs/evidence/r84-art'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    index=json.loads((BASE/'index.json').read_text(encoding='utf-8'))
    saved=OUT/'regression-index.json'
    retained=json.loads(saved.read_text(encoding='utf-8'))['records'] if saved.exists() else []
    rows={r['original']:r for r in retained}
    for row in index:
        rel=Path(row['path']);assert rel.parts[:2]==('docs','evidence') and '..' not in rel.parts
        original=BASE/rel;target=ROOT/rel;assert sha(original)==row['sha256']
        if target.exists() and sha(target)!=row['sha256']:
            dest=OUT/'regression'/rel.relative_to('docs/evidence');dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,dest)
            rows[row['path']]=dict(original=row['path'],archived=dest.relative_to(ROOT).as_posix(),currentRunSha256=sha(dest),restoredStartingSha256=row['sha256'])
            shutil.copy2(original,target);assert sha(target)==row['sha256']
    (OUT/'regression-index.json').write_text(json.dumps(dict(status='VERIFIED',note='Restored exact starting bytes, including pre-existing user changes. Non-ASCII clean-start HEAD receipts are retained. No untracked files removed.',records=list(rows.values())),indent=2)+'\n',encoding='utf-8');print('VERIFIED archived and restored '+str(len(rows))+' historical evidence files')
if __name__=='__main__':main()
