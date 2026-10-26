"""Stage only the explicit R19 ownership list after release verification."""
from pathlib import Path
import hashlib,json,subprocess
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r19';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert Path.cwd().resolve()==R.resolve()
release=json.loads((O/'release-verification.json').read_text(encoding='utf-8'));assert release['status']=='VERIFIED'
assert all(sha(R/p)==h for p,h in release['sourceHashes'].items())
initial=json.loads((R/'.audit-tmp/r19/initial.json').read_text(encoding='utf-8'))
assert all((R/p).is_file() and sha(R/p)==h for p,h in initial['protected'].items())
assert not subprocess.check_output(['git','diff','--cached','--no-renames','--name-only','-z']), 'Existing staged work must be preserved'
fixed={'.gitattributes','index.html','manifest.webmanifest','package-lock.json','package.json','sw.js','scripts/test-content-r18-e2e.js','scripts/test-content-r17-e2e.js','scripts/test-content-r14-visuals.js','scripts/verify-content-r15.js','scripts/content-r8-water-test-helper.js','tools/process-r68-visuals.py','tools/verify-content-r18-release.py'}
fixed.update(p.relative_to(R).as_posix() for p in (R/'src').glob('*') if p.suffix in ['.js','.css'])
changed=set(filter(None,subprocess.check_output(['git','diff','--name-only','-z']).decode('utf-8').split('\0')))
cleanup=json.loads((O/'cleanup-result.json').read_text(encoding='utf-8'));deleted={x['path'] for x in cleanup['files']}
owned=(changed & fixed)|deleted|{'docs/OPTIM_PLAN_CONTENT_R19.md','docs/CODEX_RESPONSE_CONTENT_R19.md','docs/art/PROMPTS_CONTENT_R19.json','docs/art/PROMPTS_CONTENT_R19_CHILD.json','docs/store/screenshots/iphone-24-neighbor-hands-r19.png','docs/store/screenshots/ipad-24-neighbor-hands-r19.png'}
owned.update('scripts/'+p for p in ['guard-validation-writes.js','test-content-r19.js','test-content-r19-e2e.js','test-content-r19-offline.js','measure-content-r19.js'])
owned.update('tools/'+p for p in ['cleanup-content-r19.py','cleanup-content-r19-workspace.py','execute-content-r19-release.py','process-content-r19-art.py','run-content-r19-checks.py','repair-content-r19-checks.py','verify-content-r19-release.py','stage-content-r19.py'])
for folder in ['docs/content/r19','docs/art/masters/content-r19','assets/generated/content-r19']:
    owned.update(p.relative_to(R).as_posix() for p in (R/folder).rglob('*') if p.is_file())
assert not (owned & initial['protected'].keys())
assert changed <= owned|initial['protected'].keys(),changed-owned-initial['protected'].keys()
paths=sorted(owned)
for i in range(0,len(paths),80):subprocess.run(['git','add','--',*paths[i:i+80]],check=True)
staged=set(filter(None,subprocess.check_output(['git','diff','--cached','--no-renames','--name-only','-z']).decode('utf-8').split('\0')))
assert staged==owned,(staged-owned,owned-staged)
assert not (staged & initial['protected'].keys()) and 'docs/evidence/R68/source-manifest.json' not in staged
subprocess.run(['git','diff','--cached','--check'],check=True)
print('VERIFIED explicitly staged',len(staged),'owned R19 paths; pre-existing user work excluded')
