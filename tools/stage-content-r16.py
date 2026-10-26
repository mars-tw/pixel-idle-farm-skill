"""Stage only the named R16 changes and audited removals. Never stage initial user changes."""
from pathlib import Path
import subprocess,json,hashlib
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r16'
def git(*args):return subprocess.check_output(['git',*args],cwd=R)
def names(*args):return {p for p in git(*args).decode('utf8').split('\0') if p}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
initial=json.loads((R/'.audit-tmp/content-r16-execution/protected.json').read_text(encoding='utf8'))
assert Path.cwd().resolve()==R.resolve() and git('branch','--show-current').decode().strip()=='main'
assert git('rev-parse','HEAD').decode().strip()==initial['head'],'base commit changed; inspect before staging'
assert not names('diff','--cached','--name-only','-z'),'preserve an existing index; inspect before staging'
assert all((R/p).is_file() and sha(R/p)==h for p,h in initial['protected'].items())
assert json.loads((O/'release-verification.json').read_text(encoding='utf8'))['status']=='VERIFIED'
deleted={r['path'] for r in json.loads((O/'cleanup-result.json').read_text(encoding='utf8'))['files']}
allowed={
 'CREDITS.md','index.html','manifest.webmanifest','package.json','package-lock.json','sw.js',
 'docs/OPTIM_PLAN_CONTENT_R16.md','docs/CODEX_RESPONSE_CONTENT_R16.md',
 'src/adventure.js','src/content-r1.js','src/content-r6.js','src/content-r8.js','src/ui.js','src/daily-ui.js','src/world-ui.js',
 'scripts/test-r81-review.js','scripts/test-content-r13-cache-offline.js','scripts/test-content-r14-visuals.js','scripts/verify-content-r15.js',
}
owned=set()
for p in names('diff','--name-only','-z'):
 if p in initial['protected']:continue
 if p in deleted:assert not (R/p).exists();owned.add(p)
 elif p in allowed:owned.add(p)
 elif p.startswith('src/') and p.endswith('.css'):
  old=git('show','HEAD:'+p).decode('utf8').replace('\r\n','\n');new=(R/p).read_text(encoding='utf8')
  assert old.replace('content-r15-20261019-1','content-r16-20261020-1')==new,p;owned.add(p)
 else:raise AssertionError('unexpected tracked change: '+p)
new_exact={
 'src/content-r16.js','src/content-r16.css','scripts/test-content-r16.js','scripts/test-content-r16-e2e.js','scripts/measure-content-r16.js',
 'tools/cleanup-content-r16.py','tools/verify-content-r16.py','tools/finalize-content-r16.py','tools/close-content-r16.py','tools/stage-content-r16.py',
 'docs/art/PROMPTS_CONTENT_R16.json','docs/art/masters/content-r16-sharing.png',
 'docs/store/screenshots/iphone-21-shared-invitation-r16.png','docs/store/screenshots/ipad-21-shared-invitation-r16.png',
}
for p in names('ls-files','--others','--exclude-standard','-z')-set(initial['protected']):
 if p in new_exact or p.startswith(('docs/content/r16/','assets/generated/content-r16/')):owned.add(p)
assert new_exact<=owned,'required new deliverable missing from explicit stage set'
ordered=sorted(owned)
for i in range(0,len(ordered),50):subprocess.run(['git','add','--',*ordered[i:i+50]],cwd=R,check=True)
assert names('diff','--cached','--name-only','-z')==owned
result={'status':'VERIFIED','base':initial['head'],'paths':ordered,'count':len(ordered),'initialUserChangesExcluded':len(initial['protected'])}
(R/'.audit-tmp/content-r16-execution/staged-paths.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('VERIFIED explicit staged paths',len(ordered),'initial user files excluded',len(initial['protected']))
