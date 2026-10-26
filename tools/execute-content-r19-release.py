"""One headless browser owner at a time, native journey then performance then CI."""
from pathlib import Path
import hashlib,json,os,subprocess,sys,time
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r19';(O/'logs').mkdir(exist_ok=True)
commands=[['node','scripts/test-content-r19-e2e.js'],['node','scripts/measure-content-r19.js'],[sys.executable,'tools/run-content-r19-checks.py']]
rows=[];tag=str(int(time.time()))
prior=O/'execution-receipts.json'
if prior.is_file():
    import shutil
    shutil.copyfile(prior,O/f'execution-attempt-{tag}.json')
for i,c in enumerate(commands,1):
    log=O/'logs'/f'release-{tag}-{i}.txt';start=time.monotonic();print('EXECUTED',' '.join(c),flush=True)
    with log.open('w',encoding='utf-8') as f:run=subprocess.run(c,cwd=R,stdout=f,stderr=subprocess.STDOUT,env=os.environ|{'PYTHONUTF8':'1','PYTHONIOENCODING':'utf-8'},creationflags=subprocess.CREATE_NO_WINDOW)
    rows.append({'command':c,'exitCode':run.returncode,'seconds':round(time.monotonic()-start,2),'log':log.relative_to(R).as_posix(),'sha256':hashlib.sha256(log.read_bytes()).hexdigest()})
    (O/'execution-receipts.json').write_text(json.dumps({'status':'EXECUTED' if run.returncode==0 else 'BLOCKED','commands':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('VERIFIED' if run.returncode==0 else 'BLOCKED',' '.join(c),flush=True)
    if run.returncode:print(log.read_text(encoding='utf-8')[-2400:],flush=True);sys.exit(run.returncode)
(O/'execution-receipts.json').write_text(json.dumps({'status':'VERIFIED','commands':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
