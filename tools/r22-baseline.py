"""Freeze R22 before bytes and protected files; never rewrite historical evidence."""
import hashlib, json, pathlib, shutil, subprocess
R=pathlib.Path(__file__).resolve().parents[1]
O=R/'docs/content/r22'
allowed=['src/content-r6.js','src/content-r17.js','src/content-r17.css','src/ui.js','package.json','package-lock.json','index.html','manifest.webmanifest','sw.js','scripts/test-content-r20-e2e.js','scripts/guard-validation-writes.js','scripts/run-browser-gates.js']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
if (O/'baseline.json').exists(): raise SystemExit('Existing baseline is immutable')
O.mkdir(parents=True,exist_ok=True)
before={}
for name in allowed:
 p=R/name; target=O/'before'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
 before[name]={'sha256':sha(p),'bytes':p.stat().st_size,'snapshot':target.relative_to(R).as_posix()}
protected={}
roots=['assets','docs/content/r21','docs/store']
for name in roots:
 for p in (R/name).rglob('*'):
  if p.is_file():protected[p.relative_to(R).as_posix()]={'sha256':sha(p),'bytes':p.stat().st_size}
for name in ['docs/OPTIM_PLAN_CONTENT_R21.md','docs/CODEX_RESPONSE_CONTENT_R21.md']:
 p=R/name;protected[name]={'sha256':sha(p),'bytes':p.stat().st_size}
dirty=subprocess.check_output(['git','status','--porcelain=v1','-z','--untracked-files=all'],cwd=R)
(O/'dirty-before.bin').write_bytes(dirty)
status=[x.decode('utf-8','replace') for x in dirty.split(b'\0') if x]
(O/'dirty-before.json').write_text(json.dumps(status,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
baseline={'status':'FROZEN','head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),'version':'0.1.44','appVersion':'content-r21-20261024-1','allowedBefore':before,'protected':protected,'dirtyCount':len(status),'dirtySha256':hashlib.sha256(dirty).hexdigest(),'counterexamples':{'label':'docs/content/r21/review-set/04-phone-basket-elder-near.png','journal':['docs/content/r21/review-set/14-phone-journal-first.png','docs/content/r21/review-set/15-phone-journal-invite-child-reloaded.png'],'remainingSour':'1 packed + 1 refill - 2 servings = 0','arrow':'docs/content/r21/review-set/06-phone-basket-child-received.png'}}
(O/'baseline.json').write_text(json.dumps(baseline,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'FROZEN','allowed':len(before),'protected':len(protected),'dirtyCount':len(status)}))
