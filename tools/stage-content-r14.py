"""Stage exact owned paths only; preserve the initial dirty index/worktree boundary."""
import hashlib,json,pathlib,re,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r14'
def git(*args):return subprocess.check_output(['git',*args],cwd=R).decode('utf-8').split('\0')
assert json.loads((O/'release-checks.json').read_text(encoding='utf-8'))['status']=='VERIFIED'
assert git('branch','--show-current')[0].strip()=='main','Remain on the authorized original branch'
baseline=json.loads((R/'.audit-tmp/content-r14-protection/inventory.json').read_text(encoding='utf-8'))
protected={p for p,r in baseline.items() if r['protected']}
existing={p for p in git('diff','--cached','--no-renames','--name-only','-z') if p}
if existing:
 prior=O/'staging-manifest.json';assert prior.exists(),'Existing staged work must not enter this commit'
 assert existing==set(json.loads(prior.read_text(encoding='utf-8'))['paths']) and not existing&protected,'Only resume this round exact staging manifest'
cleanup=json.loads((O/'cleanup-result.json').read_text(encoding='utf-8'));deleted={r['path'] for r in cleanup['candidates']}
root={'.gitattributes','index.html','sw.js','manifest.webmanifest','package.json','package-lock.json'}
test_files={'scripts/content-r8-water-test-helper.js'}|{f'scripts/test-content-r{i}-e2e.js' for i in [4,5,8,9,10,11,12,13]}|{'scripts/test-content-r13-cache-offline.js'}
owned=root|test_files|deleted|existing
for p in git('diff','--name-only','-z'):
 if not p or p in protected:continue
 assert p in owned or p.startswith('src/') and pathlib.Path(p).suffix in {'.js','.css'}, 'Unexpected tracked change '+p
 owned.add(p)
new_root={'docs/OPTIM_PLAN_CONTENT_R14.md','docs/CODEX_RESPONSE_CONTENT_R14.md','docs/art/PROMPTS_CONTENT_R14.json','docs/store/screenshots-content-r14-manifest.json','docs/store/screenshots/iphone-19-shared-afternoon-r14.png','docs/store/screenshots/ipad-19-shared-afternoon-r14.png'}
new_scripts={'scripts/'+n for n in ['content-r14-test-helper.js','native-evidence-capture.js','test-content-r14.js','test-content-r14-e2e.js','test-content-r14-visuals.js','measure-content-r14.js','run-content-r14-regression.py']}
new_tools={'tools/'+n for n in ['protect-content-r14.py','cleanup-content-r14.py','finalize-content-r14.py','verify-content-r14-release.py','report-content-r14.py','finish-content-r14.py','stage-content-r14.py']}
new_src={'src/content-r14.css'}
for p in git('ls-files','--others','--exclude-standard','-z'):
 if not p or p in protected:continue
 if p.startswith('docs/content/r14/') or p in new_root|new_scripts|new_tools|new_src:owned.add(p)
owned|={p for p in new_root|new_scripts|new_tools|new_src if (R/p).is_file()}
owned|={p.relative_to(R).as_posix() for p in O.rglob('*.log') if p.is_file()}
owned={p for p in owned if p not in protected and ((R/p).is_file() or p in deleted)}
manifest=O/'staging-manifest.json';owned.add(manifest.relative_to(R).as_posix())
paths=sorted(owned);manifest.write_text(json.dumps({'status':'PREPARED','paths':paths,'policy':'Every git add call receives explicit filenames; no initial dirty/untracked file is staged. No push or deployment.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for force in [False,True]:
 selected=[p for p in paths if p.endswith('.log')==force and ((R/p).is_file() or p not in existing)]
 for i in range(0,len(selected),30):
  result=subprocess.run(['git','add',*(['-f'] if force else []),'--',*selected[i:i+30]],cwd=R,capture_output=True)
  with (R/'.audit-tmp/r14-stage.log').open('ab') as log:log.write(result.stdout+result.stderr)
  if result.returncode:raise RuntimeError(result.stderr.decode('utf-8',errors='replace'))
staged={p for p in git('diff','--cached','--no-renames','--name-only','-z') if p};assert staged==set(paths),(staged-set(paths),set(paths)-staged)
assert not staged&protected
text_paths=[p for p in paths if (R/p).is_file() and not p.startswith('docs/content/r14/') and (pathlib.Path(p).suffix in {'.js','.css','.py','.json','.md','.webmanifest'} or p=='.gitattributes')]
for i in range(0,len(text_paths),30):subprocess.run(['git','diff','--cached','--check','--',*text_paths[i:i+30]],cwd=R,check=True)
record=json.loads(manifest.read_text(encoding='utf-8'));record['status']='VERIFIED';manifest.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');subprocess.run(['git','add','--',manifest.relative_to(R).as_posix()],cwd=R,check=True)
print('VERIFIED explicit staged paths',len(paths),'deletions',len(deleted),'protected originals excluded',len(protected))
if '--commit' in sys.argv:
 message='修正第十四輪餐籃圖層、池塘帳目與聚餐互動'
 subprocess.run(['git','-c','maintenance.auto=false','-c','gc.auto=0','commit','-qm',message],cwd=R,check=True)
 commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R).decode().strip()
 title=subprocess.check_output(['git','log','-1','--format=%s'],cwd=R).decode('utf-8').strip();assert title==message
 assert not [p for p in git('diff','--cached','--no-renames','--name-only','-z') if p]
 for p in protected:assert (R/p).is_file() and hashlib.sha256((R/p).read_bytes()).hexdigest()==baseline[p]['sha256'],p
 receipt={'status':'VERIFIED','commit':commit,'version':'0.1.37','protectedFiles':len(protected),'noPush':True}
 (R/'.audit-tmp/r14-commit.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
