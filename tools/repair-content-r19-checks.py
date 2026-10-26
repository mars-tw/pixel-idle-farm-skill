"""Re-run failed parent gates, preserve original failures, then verify offline art."""
from pathlib import Path
import hashlib,json,os,shutil,subprocess,sys,time
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r19';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
latest={}
for p in sorted(O.glob('regression-*.json'),key=lambda p:p.stat().st_mtime):
    for c in json.loads(p.read_text(encoding='utf-8'))['commands']:
        if 'invokedBy' not in c:latest[tuple(c['command'])]=c
failed=[c for c,r in latest.items() if r['exitCode']!=0]
original=json.loads((O/'execution-receipts.json').read_text(encoding='utf-8'));tag=str(int(time.time()));prior=O/f'execution-before-repair-{tag}.json';shutil.copyfile(O/'execution-receipts.json',prior)
assert original['commands'][0]['exitCode']==0 and original['commands'][1]['exitCode']==0
rows=original['commands'][:2]
commands=[[sys.executable,'tools/run-content-r19-checks.py','--only='+c[-1]] for c in failed]
commands.append(['node','scripts/test-content-r19-offline.js'])
report={'status':'EXECUTED','priorAttempt':prior.relative_to(R).as_posix(),'repairScope':[list(c) for c in failed],'commands':rows}
for i,c in enumerate(commands,1):
    log=O/'logs'/f'repair-{tag}-{i}.txt';print('EXECUTED',' '.join(c),flush=True);start=time.monotonic()
    with log.open('w',encoding='utf-8') as f:run=subprocess.run(c,cwd=R,stdout=f,stderr=subprocess.STDOUT,env=os.environ|{'PYTHONUTF8':'1','PYTHONIOENCODING':'utf-8'},creationflags=subprocess.CREATE_NO_WINDOW)
    rows.append({'command':c,'exitCode':run.returncode,'seconds':round(time.monotonic()-start,2),'log':log.relative_to(R).as_posix(),'sha256':sha(log)})
    report['status']='EXECUTED' if run.returncode==0 else 'BLOCKED';(O/'execution-receipts.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('VERIFIED' if run.returncode==0 else 'BLOCKED',' '.join(c),flush=True)
    if run.returncode:print(log.read_text(encoding='utf-8')[-2400:],flush=True);sys.exit(run.returncode)
report['status']='VERIFIED';(O/'execution-receipts.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
