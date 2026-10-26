"""Remove only this round's completed isolated test copy, after unlinking its junction."""
from pathlib import Path
import hashlib,json,os,shutil
R=Path(__file__).resolve().parents[1];W=R/'.audit-tmp/r19/regression';O=R/'docs/content/r19'
assert Path.cwd().resolve()==R.resolve() and W.resolve()==(R/'.audit-tmp/r19/regression').absolute()
assert W.resolve().is_relative_to((R/'.audit-tmp/r19').resolve()) and W.is_dir() and not W.is_junction()
assert json.loads((O/'release-verification.json').read_text(encoding='utf-8'))['status']=='VERIFIED'
assert json.loads((O/'execution-receipts.json').read_text(encoding='utf-8'))['status']=='VERIFIED'
modules=W/'node_modules';assert modules.is_junction() and modules.resolve()==(R/'node_modules').resolve()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
proof={p:sha(R/p) for p in ['node_modules/playwright/package.json','node_modules/playwright/index.js','node_modules/playwright-core/package.json']}
count=0;size=0
for base,dirs,files in os.walk(W,followlinks=False):
    for name in list(dirs):
        p=Path(base)/name
        if p.is_junction() or p.is_symlink():assert p==modules;dirs.remove(name)
    for name in files:
        p=Path(base)/name;assert not p.is_symlink() and p.resolve().is_relative_to(W.resolve());count+=1;size+=p.stat().st_size
plan={'status':'PREPARED','target':W.relative_to(R).as_posix(),'junction':'node_modules only, verified target '+str(modules.resolve()),'files':count,'bytes':size,'packageHashes':proof}
(O/'temporary-copy-cleanup-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Non-recursive junction removal happens first. rmtree can now reach only the
# verified workspace copy, never the shared package directory.
os.rmdir(modules)
assert not modules.exists() and all(sha(R/p)==h for p,h in proof.items())
shutil.rmtree(W)
assert not W.exists() and all(sha(R/p)==h for p,h in proof.items())
plan['status']='VERIFIED';plan['allAbsent']=True
(O/'temporary-copy-cleanup-result.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED isolated copy removed:',count,'files,',size,'bytes; shared Playwright packages preserved')
