"""Stage explicit task paths only, preserving the initial dirty workspace."""
from pathlib import Path
import hashlib,json,subprocess,sys
R=Path(__file__).resolve().parents[1]
assert Path.cwd().resolve()==R.resolve()
run=lambda *a:subprocess.check_output(['git',*a],cwd=R).decode('utf-8').strip()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
initial=json.loads((R/'.audit-tmp/r18/initial.json').read_text(encoding='utf-8'))
release=json.loads((R/'docs/content/r18/release-verification.json').read_text(encoding='utf-8'))
assert release['status']=='VERIFIED' and run('branch','--show-current')=='main'
assert all(sha(R/p)==h for p,h in release['sourceHashes'].items())
assert all((R/p).is_file() and sha(R/p)==h for p,h in initial['protected'].items())
already_staged=set(filter(None,run('diff','--cached','--name-only').splitlines()))
changed=set(filter(None,run('diff','--name-only').splitlines()))-set(initial['protected'])
allowed={'.gitattributes','index.html','manifest.webmanifest','package.json','package-lock.json','sw.js','tools/process-r68-visuals.py','tools/finalize-content-r17.py','scripts/content-r8-water-test-helper.js','scripts/test-content-r13-cache-offline.js'}
allowed.update(p.relative_to(R).as_posix() for p in (R/'src').glob('*') if p.suffix in ['.js','.css'])
allowed.update(x['path'] for x in json.loads((R/'docs/content/r18/cleanup-result.json').read_text(encoding='utf-8'))['files'])
new=['docs/OPTIM_PLAN_CONTENT_R18.md','docs/CODEX_RESPONSE_CONTENT_R18.md','docs/art/PROMPTS_CONTENT_R18.json','docs/art/masters/content-r18/water-sheet.png','scripts/test-content-r18.js','scripts/test-content-r18-e2e.js','scripts/measure-content-r18.js','tools/process-content-r18-art.py','tools/cleanup-content-r18.py','tools/run-content-r18-checks.py','tools/verify-content-r18-release.py','tools/stage-content-r18.py','docs/store/screenshots/iphone-23-river-wake-r18.png','docs/store/screenshots/ipad-23-river-wake-r18.png']
for folder in ['assets/generated/content-r18','docs/content/r18']:
    new.extend(p.relative_to(R).as_posix() for p in (R/folder).rglob('*') if p.is_file())
known=allowed|set(new)
assert changed<=known,sorted(changed-known)
assert already_staged<=known,'unrelated staged work must stay separate'
paths=sorted(changed|already_staged|set(new));assert not (set(paths)&set(initial['protected']))
for forced in [False,True]:
    named=[p for p in paths if (p.startswith('docs/content/r18/logs/') and p.endswith('.log'))==forced and ((R/p).exists() or p not in already_staged)]
    for i in range(0,len(named),40):
        result=subprocess.run(['git','add',*(['-f'] if forced else []),'--',*named[i:i+40]],cwd=R,capture_output=True,text=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW)
        assert result.returncode==0,result.stderr
staged=set(filter(None,run('diff','--cached','--name-only').splitlines()));assert staged==set(paths)
assert 'docs/evidence/R68/source-manifest.json' not in staged
(R/'.audit-tmp/r18/staged.json').write_text(json.dumps({'status':'VERIFIED','paths':paths},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED explicit paths staged:',len(paths))
