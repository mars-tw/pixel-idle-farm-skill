"""Remove this round's owned regression copy after the full suite completes."""
from pathlib import Path
import json,os,shutil,hashlib
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r20';target=R/'.audit-tmp/r20/regression'
assert Path.cwd().resolve()==R.resolve()
assert target.is_dir() and not target.is_symlink() and not target.is_junction()
assert target.resolve()==(R/'.audit-tmp/r20/regression').absolute()
assert target.resolve().is_relative_to((R/'.audit-tmp/r20').resolve())
receipts=[json.loads(p.read_text(encoding='utf-8')) for p in sorted(O.glob('regression-[0-9]*.json'),key=lambda p:p.stat().st_mtime)]
assert receipts and receipts[-1]['status']=='VERIFIED'
junction=target/'node_modules';modules=R/'node_modules'
assert junction.is_junction() and junction.resolve()==modules.resolve()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
reference=modules/'playwright/package.json';before=sha(reference)
files=[]
for base,dirs,names in os.walk(target,followlinks=False):
    for name in list(dirs):
        p=Path(base)/name
        if p.is_junction() or p.is_symlink():
            assert p==junction;dirs.remove(name)
    for name in names:
        p=Path(base)/name;assert not p.is_symlink() and p.resolve().is_relative_to(target.resolve())
        files.append({'path':p.relative_to(target).as_posix(),'bytes':p.stat().st_size})
plan={'status':'PREPARED','target':str(target.resolve()),'junction':str(junction),'junctionTarget':str(junction.resolve()),'files':len(files),'bytes':sum(p['bytes'] for p in files),'referenceHash':before}
(O/'temporary-copy-cleanup-plan.json').write_text(json.dumps(plan,indent=2),encoding='utf-8')
os.rmdir(junction) # Remove the checked junction itself, without traversing it.
assert not junction.exists() and sha(reference)==before
shutil.rmtree(target)
assert not target.exists() and sha(reference)==before
(O/'temporary-copy-cleanup-result.json').write_text(json.dumps({**plan,'status':'VERIFIED','targetAbsent':True,'nodeModulesReferenceUnchanged':True},indent=2),encoding='utf-8')
print('VERIFIED owned temporary copy removed:',len(files),'files,',plan['bytes'],'bytes')
