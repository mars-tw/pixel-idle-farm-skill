"""Run final evidence/measurement/readback sequentially with one owned browser/server."""
import pathlib,subprocess,json,hashlib,sys
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r13'
steps=[('node',['scripts/audit-content-r13-evidence.js'],'animation-audit-final.log'),('node',['scripts/test-content-r13-e2e.js','--offline-only'],'offline-final.log'),('node',['scripts/finalize-content-r13-evidence.js'],'evidence-final.log'),('node',['scripts/measure-content-r13.js'],'performance.log')]
if '--readback-only' in sys.argv:steps=[]
for cmd,args,name in steps:
    print('EXECUTED',cmd,*args,flush=True)
    with (O/name).open('w',encoding='utf-8') as f:r=subprocess.run([cmd,*args],cwd=R,stdout=f,stderr=subprocess.STDOUT)
    if r.returncode:print('BLOCKED',name,flush=True);sys.exit(r.returncode)
    print('VERIFIED',name,flush=True)
# Never overwrite a concurrently edited review or unrelated untracked file.
baseline=json.loads((R/'.audit-tmp/content-r13-protection/inventory.json').read_text(encoding='utf-8'))
owned={'docs/OPTIM_PLAN_CONTENT_R13.md','tools/protect-content-r13.py'}
scaffolds={n:(R/n).read_bytes() for n in owned}
for p,info in baseline.items():
    if not info['protected'] or p in owned or p=='docs/evidence/R68/source-manifest.json':continue
    f=R/p
    if not f.exists() or hashlib.sha256(f.read_bytes()).hexdigest()!=info['sha256']:
        raise RuntimeError('Concurrent protected file change left untouched: '+p)
with (O/'protection-final.log').open('w',encoding='utf-8') as f:
    r=subprocess.run(['python','tools/protect-content-r13.py','restore'],cwd=R,stdout=f,stderr=subprocess.STDOUT)
if r.returncode:sys.exit(r.returncode)
for name,data in scaffolds.items():(R/name).write_bytes(data)
extras=[]
import re
untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard','-z'],cwd=R).decode('utf-8').split('\0')
for name in untracked:
    if not name or name in baseline:continue
    is_regression_output=bool(re.match(r'^docs/content/r(?:[1-9]|1[0-2])/',name) or name.startswith('docs/evidence/'))
    source=R/name
    if not is_regression_output or source.suffix.lower() not in ['.png','.json','.webm','.log']:continue
    target=O/'regression-outputs'/name
    assert source.resolve().is_relative_to(R) and target.resolve().is_relative_to(O)
    target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists():target=target.with_name(target.stem+'-extra-'+hashlib.sha256(source.read_bytes()).hexdigest()[:8]+target.suffix)
    source.rename(target);extras.append({'source':name,'archived':target.relative_to(R).as_posix()})
protection=json.loads((O/'protected-readback.json').read_text(encoding='utf-8'));protection['newHistoricalTestOutputsArchived']=extras
originals=[];historical=set(protection['restoredHistoricalOutputs'])
for prior in O.glob('protected-readback-*.json'):
    historical.update(json.loads(prior.read_text(encoding='utf-8')).get('restoredHistoricalOutputs',[]))
for name in sorted((historical|{p for p,v in baseline.items() if v['protected']})-owned):
    actual=hashlib.sha256((R/name).read_bytes()).hexdigest();expected=baseline[name]['sha256'];assert actual==expected,name
    originals.append({'path':name,'baselineSha256':expected,'readbackSha256':actual})
protection['originalFileReadback']=originals
protection['protectedFiles']=sum(v['protected'] for n,v in baseline.items() if n not in owned)
protection['scaffoldsCreatedThisRound']=[{'path':n,'preparedSha256':baseline[n]['sha256'],'finalSha256':hashlib.sha256((R/n).read_bytes()).hexdigest()} for n in sorted(owned)]
(O/'protected-readback.json').write_text(json.dumps(protection,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
syntax=[]
for p in list((R/'src').glob('*.js'))+list((R/'scripts').glob('*.js')):
    r=subprocess.run(['node','-c',str(p)],cwd=R,capture_output=True)
    syntax.append({'file':p.relative_to(R).as_posix(),'exitCode':r.returncode})
assert all(r['exitCode']==0 for r in syntax)
(O/'syntax.json').write_text(json.dumps({'status':'VERIFIED','count':len(syntax),'files':syntax},indent=2)+'\n',encoding='utf-8')
for script,name in [('tools/verify-content-r13-release.py','release-readback.log'),('tools/write-content-r13-report.py','report.log')]:
    with (O/name).open('w',encoding='utf-8') as f:r=subprocess.run(['python',script],cwd=R,stdout=f,stderr=subprocess.STDOUT)
    if r.returncode:print('BLOCKED',name,flush=True);sys.exit(r.returncode)
    print('VERIFIED',name,flush=True)
print('VERIFIED final evidence, protected originals, release readback and report',flush=True)
