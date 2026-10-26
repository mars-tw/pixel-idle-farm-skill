"""Run every maintained gate serially in an isolated repo-local output copy."""
from pathlib import Path
import datetime,hashlib,json,os,re,shutil,subprocess,sys,time
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r19';W=R/'.audit-tmp/r19/regression'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert Path.cwd().resolve()==R.resolve() and W.resolve().is_relative_to(R.resolve())
files=set(filter(None,subprocess.check_output(['git','ls-files','-z']).decode('utf-8').split('\0')))
for d in ['src','scripts','tools','assets/generated/content-r19','docs/art/masters/content-r19']:
    files.update(p.relative_to(R).as_posix() for p in (R/d).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
for f in sorted(files):
    p=R/f;q=W/f
    if not p.is_file():continue
    if not q.is_file() or sha(p)!=sha(q):q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q)
modules=W/'node_modules'
if not modules.exists():
    subprocess.run(['powershell','-NoProfile','-Command',"New-Item -ItemType Junction -Path '"+str(modules).replace("'","''")+"' -Target '"+str(R/'node_modules').replace("'","''")+"' | Out-Null"],check=True,creationflags=subprocess.CREATE_NO_WINDOW)
base=json.loads((R/'docs/content/r18/release-verification.json').read_text(encoding='utf-8'))
commands=[x['command'] for x in base['commands'] if 'invokedBy' not in x]
commands=[['npm.cmd','test'],['npm.cmd','run','test:r79']]+[c for c in commands if c!=['npm.cmd','test']]+[['node','scripts/test-content-r18-e2e.js']]
only=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--only=')),None)
if only:commands=[c for c in commands if only in ' '.join(c)]
children=re.findall(r'^\s*"(scripts/[^"\n]+\.js)"',(R/'scripts/run-browser-gates.js').read_text().split('const SCRIPTS = [',1)[1].split('];',1)[0],re.M)
tag=str(int(time.time()));receipt=O/f'regression-{tag}.json'
sources=[R/'package.json',R/'package-lock.json',R/'index.html',R/'manifest.webmanifest',R/'sw.js',*sorted((R/'src').glob('*.js')),*sorted((R/'src').glob('*.css')),R/'assets/generated/content-r19/manifest.json']
report={'status':'EXECUTED','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHashes':{p.relative_to(R).as_posix():sha(p) for p in sources},'afterCleanup':(O/'cleanup-result.json').is_file(),'workspace':W.relative_to(R).as_posix(),'commands':[]}
before=sha(R/'docs/evidence/R68/source-manifest.json');failed=False
for i,c in enumerate(commands,1):
    for attempt in range(10):
        free=shutil.disk_usage(R).free
        if free>=2*1024**3:break
        print('WAIT free disk below 2GiB:',free,'bytes; attempt',attempt+1,flush=True);time.sleep(30)
    else:raise RuntimeError('BLOCKED: shared disk stayed below 2GiB; do not clean unrelated workspaces')
    log=O/'logs'/f'{tag}-{i:02d}.txt'
    log.parent.mkdir(parents=True,exist_ok=True);print('EXECUTED',i,'/',len(commands),' '.join(c),flush=True);start=time.monotonic()
    with log.open('w',encoding='utf-8') as f:
        run=subprocess.run(c,cwd=W,stdout=f,stderr=subprocess.STDOUT,env=os.environ|{'PYTHONUTF8':'1','PYTHONIOENCODING':'utf-8'},creationflags=subprocess.CREATE_NO_WINDOW)
    row={'command':c,'exitCode':run.returncode,'seconds':round(time.monotonic()-start,2),'log':log.relative_to(R).as_posix(),'sha256':sha(log)};report['commands'].append(row)
    if c==['node','scripts/run-browser-gates.js'] and run.returncode==0:
        report['commands'].extend({'command':['node',x],'exitCode':0,'invokedBy':c,'log':row['log'],'sha256':row['sha256']} for x in children)
    print('VERIFIED' if run.returncode==0 else 'BLOCKED',' '.join(c),flush=True)
    if run.returncode:failed=True;print(log.read_text(encoding='utf-8')[-2200:],flush=True)
    receipt.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert sha(R/'docs/evidence/R68/source-manifest.json')==before
report['status']='BLOCKED' if failed else 'VERIFIED';report['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();receipt.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
sys.exit(1 if failed else 0)
