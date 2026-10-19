"""Stage only the verified R12 file allowlist, using explicit file paths in small batches."""
import pathlib,json,hashlib,subprocess
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r12'
def git(*args):return subprocess.check_output(['git',*args],cwd=R).decode('utf-8').split('\0')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
initial=json.loads((O/'protected-start.json').read_text(encoding='utf-8'));release=json.loads((O/'release-readback.json').read_text(encoding='utf-8'))
assert release['status']=='VERIFIED'
assert all(sha(R/p)==h for p,h in release['sourceHashes'].items())
assert all((R/p).is_file() and sha(R/p)==h for p,h in initial['dirty'].items())
assert subprocess.check_output(['git','branch','--show-current'],cwd=R).decode().strip()=='main'
exact={'index.html','sw.js','manifest.webmanifest','package.json','package-lock.json','scripts/content-r8-water-test-helper.js','scripts/test-content-r9-e2e.js','scripts/test-content-r10-e2e.js','scripts/test-content-r11-e2e.js','docs/OPTIM_PLAN_CONTENT_R12.md','docs/CODEX_RESPONSE_CONTENT_R12.md','docs/art/PROMPTS_CONTENT_R12.json','docs/store/screenshots-content-r12-manifest.json','docs/store/screenshots/iphone-17-shared-afternoon-r12.png','docs/store/screenshots/ipad-17-shared-afternoon-r12.png'}
exact.update('scripts/'+n for n in ['test-content-r12.js','test-content-r12-e2e.js','audit-content-r12-evidence.js','measure-content-r12.js','run-content-r12-regression.js','run-content-r12-final.js'])
exact.add('scripts/test-content-r7-e2e.js')
exact.update('tools/'+n for n in ['process-content-r12.py','protect-content-r12.py','verify-content-r12-release.py','write-content-r12-report.py','stage-content-r12.py'])
exact.add('tools/reconcile-content-r12-regression.py')
exact.add('tools/archive-content-r12-test-outputs.py')
exact.add('tools/restore-content-r12-history.py')
def allowed(p):return p in exact or p.startswith(('assets/generated/content-r12/','docs/art/masters/content-r12/','docs/content/r12/')) or p.startswith('src/') and pathlib.Path(p).suffix in {'.js','.css'}
paths=set(filter(None,git('diff','--name-only','-z')+git('ls-files','--others','--exclude-standard','-z')))
candidates=[];unexpected=[]
for p in sorted(paths):
 if p in initial['dirty'] and p not in {'docs/OPTIM_PLAN_CONTENT_R12.md','tools/protect-content-r12.py'}:continue
 if not allowed(p):unexpected.append(p);continue
 f=(R/p).resolve();assert f.is_relative_to(R) and f.is_file(),p;candidates.append(p)
assert not unexpected,'Unexpected new output needs review/archive: '+repr(unexpected)
assert not list(filter(None,git('diff','--cached','--name-only','-z'))),'Preserve existing staged work; do not mix commits'
manifest='docs/content/r12/staging-manifest.json'
rows=[dict(path=p,sha256=sha(R/p)) for p in candidates if p!=manifest]
(R/manifest).write_text(json.dumps(dict(status='VERIFIED',files=rows,preservedOriginalFiles=len(initial['dirty'])-2),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if manifest not in candidates:candidates.append(manifest)
for i in range(0,len(candidates),50):subprocess.run(['git','add','--',*candidates[i:i+50]],cwd=R,capture_output=True,check=True)
assert set(filter(None,git('diff','--cached','--name-only','-z')))==set(candidates)
print('VERIFIED explicitly staged',len(candidates),'R12 files; original user changes excluded')
