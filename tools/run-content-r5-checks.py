"""Run destructive-output legacy checks in an isolated, byte-copied repo snapshot."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/content/r5'
COPY = ROOT / '.audit-tmp/content-r5-validation'
LOG = OUT / 'logs'
LOG.mkdir(parents=True, exist_ok=True)
env = dict(os.environ, PYTHONIOENCODING='utf-8')

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def git_files(*args):
    return [x for x in subprocess.check_output(['git','-c','core.quotepath=false','ls-files','-z',*args],cwd=ROOT).decode().split('\0') if x]

tracked = git_files()
new = git_files('--others','--exclude-standard')
inputs = sorted(set(tracked + new))
# All historical evidence plus pre-existing untracked inputs remain untouched.
protected = {n:sha(ROOT/n) for n in inputs if (ROOT/n).is_file() and
             (n.startswith(('docs/evidence/','docs/content/r1/','docs/content/r2/','docs/content/r3/','docs/content/r4/','docs/art/ART_RESCORE','docs/playtest/','docs/audit_openclose/')) or n=='scripts/audit-oc-r1.js')}
(OUT/'protected-files.json').write_text(json.dumps(protected,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
COPY.mkdir(parents=True, exist_ok=True)
for name in inputs:
    p=ROOT/name
    if not p.is_file() or name.startswith('docs/content/r5/'):
        continue
    target=COPY/name
    assert target.resolve().is_relative_to(COPY.resolve())
    target.parent.mkdir(parents=True,exist_ok=True)
    if not target.exists() or sha(p)!=sha(target):
        shutil.copy2(p,target)
# The newly recorded evidence is not needed by any test; runtime, tests and art are copied.
runtime={p.relative_to(ROOT).as_posix():sha(p) for folder in ['src','scripts','tools'] for p in (ROOT/folder).glob('*') if p.is_file()}
if '--prepare-only' in sys.argv:
    print('PREPARED isolated validation snapshot',len(inputs),'inputs',flush=True)
    raise SystemExit(0)
commands=[('npm-test',['cmd','/d','/c','npm','test']),
          ('browser-gates',['cmd','/d','/c','npm','run','test:e2e']),
          ('water-guide',['node','scripts/test-water-quest-guide.js']),
          ('night-gate',['node','scripts/test-r72-night-gate.js'])]
results=[]
for name,cmd in commands:
    print('EXECUTED '+name,flush=True)
    start=time.time()
    with (LOG/(name+'.txt')).open('w',encoding='utf-8') as log:
        r=subprocess.run(cmd,cwd=COPY,env=env,stdout=log,stderr=subprocess.STDOUT,
                         creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    results.append(dict(name=name,command=cmd,exitCode=r.returncode,seconds=round(time.time()-start,2),
                        cwd='.audit-tmp/content-r5-validation',log='docs/content/r5/logs/'+name+'.txt'))
    (OUT/'regression-checks.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
    print(('VERIFIED ' if r.returncode==0 else 'BLOCKED ')+name+' exit='+str(r.returncode),flush=True)
changed=[n for n,h in protected.items() if not (ROOT/n).is_file() or sha(ROOT/n)!=h]
assert not changed,changed
(OUT/'historical-readback.json').write_text(json.dumps(dict(status='VERIFIED',preserved=len(protected),changed=changed,method='Legacy generators ran only in byte-copied validation snapshot, no root evidence restoration needed.',runtimeHashes=runtime),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED root historical files unchanged',len(protected),flush=True)
raise SystemExit(1 if any(x['exitCode'] for x in results) else 0)
