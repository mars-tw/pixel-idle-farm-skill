"""Stage only explicit R17 paths; preserve the user's initial index and files."""
from pathlib import Path
import hashlib,json,subprocess
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r17'
def git(*args):return subprocess.check_output(['git',*args],cwd=R)
def names(*args):return set(filter(None,git(*args).decode('utf8').split('\0')))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
initial=json.loads((R/'.audit-tmp/content-r17/protected.json').read_text(encoding='utf8'))
assert Path.cwd().resolve()==R.resolve() and git('branch','--show-current').decode().strip()=='main'
assert git('rev-parse','HEAD').decode().strip()==initial['head']
assert not names('diff','--cached','--name-only','-z'),'an existing index must not be changed'
assert all((R/p).is_file() and sha(R/p)==h for p,h in initial['protected'].items())
release=json.loads((O/'release-verification.json').read_text(encoding='utf8'));assert release['status']=='VERIFIED'
explicit={
 '.gitattributes','index.html','manifest.webmanifest','package.json','package-lock.json','sw.js',
 'src/ui.js','src/content-r1.js','src/content-r6.js','src/content-r8.js','src/content-r16.js','src/daily-ui.js','src/world-ui.js',
 'scripts/test-content-r10-e2e.js','scripts/test-content-r11-e2e.js','scripts/test-content-r12-e2e.js','scripts/test-content-r13-e2e.js','scripts/test-content-r14-e2e.js','scripts/test-content-r15-e2e.js','scripts/test-content-r14-visuals.js','scripts/verify-content-r15.js',
 'scripts/test-content-r7-e2e.js','scripts/test-content-r16-e2e.js','docs/OPTIM_PLAN_CONTENT_R17.md','docs/CODEX_RESPONSE_CONTENT_R17.md',
 'src/content-r17.js','src/content-r17.css','scripts/test-content-r17.js','scripts/test-content-r17-e2e.js','scripts/measure-content-r17.js','scripts/capture-content-r17-delivery.js',
 'tools/update-content-r17-test-contracts.py','tools/run-content-r17-checks.py','tools/run-content-r17-journeys.py','tools/prepare-content-r17-tests.py','tools/cleanup-content-r17.py','tools/finalize-content-r17.py','tools/stage-content-r17.py',
 'docs/art/PROMPTS_CONTENT_R17.json','docs/store/screenshots/iphone-22-shared-afternoon-r17.png','docs/store/screenshots/ipad-22-shared-afternoon-r17.png',
}
owned=set()
for p in names('diff','--name-only','-z'):
 if p in initial['protected']:continue
 if p in explicit:owned.add(p)
 elif p.startswith('src/') and p.endswith('.css'):
  old=git('show','HEAD:'+p).decode('utf8').replace('\r\n','\n');new=(R/p).read_text(encoding='utf8')
  assert old.replace('content-r16-20261020-1','content-r17-20261020-1')==new,p;owned.add(p)
 else:raise AssertionError('unexpected tracked change: '+p)
for p in names('ls-files','--others','--exclude-standard','-z')-set(initial['protected']):
 if p in explicit or p.startswith('docs/content/r17/'):owned.add(p)
 else:raise AssertionError('unexpected new path: '+p)
assert explicit<=owned,'a named deliverable is missing'
ordered=sorted(owned)
for i in range(0,len(ordered),40):subprocess.run(['git','add','--',*ordered[i:i+40]],cwd=R,check=True)
assert names('diff','--cached','--name-only','-z')==owned
(R/'.audit-tmp/content-r17/staged-paths.json').write_text(json.dumps({'status':'VERIFIED','count':len(owned),'paths':ordered,'base':initial['head'],'initialUserFilesExcluded':len(initial['protected'])},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('VERIFIED staged explicit paths',len(ordered),'user files excluded',len(initial['protected']))
