"""Stage only the explicit R13 release paths, never the user's pre-existing dirty files."""
import pathlib,subprocess,json
R=pathlib.Path(__file__).resolve().parents[1]
paths=['index.html','manifest.webmanifest','package.json','package-lock.json','sw.js','src/adventure.js','src/ui.js','src/world-ui.js','src/daily-ui.js','src/art-r82.css','src/art-r83.css','src/art-r84.css','src/art-r85.css','src/art-r86.css','src/content-r1.css','src/content-r1.js','src/content-r6.css','src/content-r6.js','src/content-r8.js','src/content-r10.css','src/content-r11.css','src/content-r12.css','src/content-r13.css','scripts/content-r8-water-test-helper.js','scripts/test-content-r6.js','scripts/test-content-r8-e2e.js','scripts/test-content-r9-e2e.js','scripts/test-content-r12-e2e.js','scripts/test-content-r13.js','scripts/test-content-r13-e2e.js','scripts/audit-content-r13-evidence.js','scripts/finalize-content-r13-evidence.js','scripts/measure-content-r13.js','scripts/run-content-r13-regression.js','scripts/test-content-r13-cache-offline.js','tools/protect-content-r13.py','tools/process-content-r13.py','tools/implement-content-r13.py','tools/prepare-content-r13-tests.py','tools/prepare-content-r13-audit.py','tools/update-content-r13-regression-contracts.py','tools/update-content-r13-r8-coverage.py','tools/verify-content-r13-release.py','tools/write-content-r13-report.py','tools/close-content-r13.py','tools/finish-content-r13.py','tools/finalize-content-r13-plan.py','tools/repair-content-r13-cache-queries.py','tools/repair-content-r13-river-grid.py','tools/select-content-r13-review.py','tools/refresh-content-r13-render-evidence.py','tools/stage-content-r13.py','docs/OPTIM_PLAN_CONTENT_R13.md','docs/CODEX_RESPONSE_CONTENT_R13.md','docs/art/PROMPTS_CONTENT_R13.json','docs/art/masters/content-r13','assets/generated/content-r13','docs/content/r13','docs/store/screenshots-content-r13-manifest.json','docs/store/screenshots/iphone-18-shared-afternoon-r13.png','docs/store/screenshots/ipad-18-shared-afternoon-r13.png']
baseline=json.loads((R/'.audit-tmp/content-r13-protection/inventory.json').read_text(encoding='utf-8'))
owned={'docs/OPTIM_PLAN_CONTENT_R13.md','tools/protect-content-r13.py'}
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=R).strip(),'Existing staging must be kept separate'
for p in paths:
    assert (R/p).exists(),p
    assert not any(v['protected'] and n not in owned and (n==p or n.startswith(p+'/')) for n,v in baseline.items()),p
subprocess.run(['git','add','--',*paths],cwd=R,check=True)
staged=subprocess.check_output(['git','diff','--cached','--name-only','-z'],cwd=R).decode('utf-8').split('\0')
assert all(any(n==p or n.startswith(p+'/') for p in paths) for n in staged if n)
assert not any(n in baseline and baseline[n]['protected'] and n not in owned for n in staged if n)
(R/'docs/content/r13/staged-paths.json').write_text(json.dumps({'status':'VERIFIED','explicitPathspecs':paths,'stagedFiles':[n for n in staged if n]},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
subprocess.run(['git','add','--','docs/content/r13/staged-paths.json'],cwd=R,check=True)
print('VERIFIED explicit staging:',len([n for n in staged if n]),'files; pre-existing user changes excluded')
