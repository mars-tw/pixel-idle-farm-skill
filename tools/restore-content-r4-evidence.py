"""Archive this run's regenerated evidence, restore every baseline file byte for byte."""
import hashlib, json, shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'.audit-tmp/content-r4-baseline';OUT=ROOT/'docs/content/r4'
records=json.loads((BASE/'files.json').read_text(encoding='utf-8'))
changed=[p.relative_to(OUT/'regression').as_posix() for p in (OUT/'regression').rglob('*') if p.is_file() and p.relative_to(OUT/'regression').as_posix() in records] if (OUT/'regression').exists() else []
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
for name,digest in records.items():
    p=ROOT/name;backup=BASE/'files'/name
    assert p.resolve().is_relative_to(ROOT.resolve()) and backup.resolve().is_relative_to(BASE.resolve())
    if not p.is_file() or sha(p)!=digest:
        assert name.startswith(('docs/evidence/','docs/store/','docs/content/r1/','docs/content/r2/','docs/content/r3/','assets/generated/r68/')),name
        if p.is_file():
            dest=OUT/'regression'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
        p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(backup,p)
        if name not in changed:changed.append(name)
    assert sha(p)==digest,name
generated=[]
for folder in ['docs/evidence','docs/store/screenshots','docs/content/r1','docs/content/r2','docs/content/r3']:
    for p in list((ROOT/folder).rglob('*')):
        if not p.is_file(): continue
        name=p.relative_to(ROOT).as_posix()
        if name in records or p.name in ['iphone-10-remembered-gift.png','ipad-10-remembered-gift.png']: continue
        dest=OUT/'regression'/name
        assert p.resolve().is_relative_to(ROOT.resolve()) and dest.resolve().is_relative_to(OUT.resolve())
        assert not dest.exists(),dest
        digest=sha(p);dest.parent.mkdir(parents=True,exist_ok=True);shutil.move(str(p),str(dest))
        assert sha(dest)==digest
        generated.append(dict(path=name,archived=dest.relative_to(ROOT).as_posix(),sha256=digest))
receipt=dict(status='VERIFIED',preserved=len(records),archivedAndRestored=changed,newTestOutputsArchived=generated,
    initialStatus=(BASE/'initial-status.txt').read_text(encoding='utf-8'))
(OUT/'historical-readback.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED preserved',len(records),'files, archived/restored',len(changed),'generated',len(generated))
