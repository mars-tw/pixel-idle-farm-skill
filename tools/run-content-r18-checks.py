"""Serial headless regression; historical capture outputs stay in a repo-local copy."""
from pathlib import Path
import datetime,hashlib,json,os,re,shutil,subprocess,sys,time
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r18';W=R/'.audit-tmp/r18/w'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert Path.cwd().resolve()==R.resolve() and W.resolve().is_relative_to(R.resolve())
files=set(filter(None,subprocess.check_output(['git','ls-files','-z'],cwd=R).decode('utf-8').split('\0')))
for d in ['src','scripts','tools','assets/generated/content-r18']:
    files.update(p.relative_to(R).as_posix() for p in (R/d).rglob('*') if p.is_file())
files.update(['docs/art/masters/content-r18/water-sheet.png','docs/art/PROMPTS_CONTENT_R18.json'])
for rel in sorted(files):
    p=R/rel;q=(W/rel).resolve();assert q.is_relative_to(W.resolve())
    same=q.is_file() and p.is_file() and p.stat().st_size==q.stat().st_size and p.stat().st_mtime_ns==q.stat().st_mtime_ns
    if p.is_file() and not same and (not q.is_file() or sha(p)!=sha(q)):
        q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q)
cleanup=json.loads((O/'cleanup-result.json').read_text(encoding='utf-8'))
for row in cleanup['files']:
    p=(W/row['path']).resolve();assert p.is_relative_to(W.resolve())
    if p.is_file():p.unlink()
commands=[x['command'] for x in json.loads((R/'docs/content/r17/release-verification.json').read_text(encoding='utf-8'))['commands']]
commands += [['node','scripts/test-content-r17-e2e.js']]
ci_children=[]
if '--ci-final' in sys.argv:
    body=(R/'scripts/run-browser-gates.js').read_text(encoding='utf-8').split('const SCRIPTS = [',1)[1].split('];',1)[0]
    ci_children=[['node',p] for p in re.findall(r'^\s*"(scripts/[^"\n]+\.js)"',body,re.M)]
    commands=[['npm.cmd','test'],['node','scripts/run-browser-gates.js']]+[c for c in commands if c not in ci_children and c!=['npm.cmd','test']]
only=next((x.split('=',1)[1] for x in sys.argv if x.startswith('--only=')),None)
start=next((int(x.split('=',1)[1]) for x in sys.argv if x.startswith('--from=')),1)
if only:commands=[c for c in commands if only in ' '.join(c)]
through=next((int(x.split('=',1)[1]) for x in sys.argv if x.startswith('--through=')),None)
if through is not None:commands=commands[:through]
tag=str(int(time.time()));receipt=O/('regression-'+tag+'.json')
report={'status':'EXECUTED','afterCleanup':True,'workspace':W.relative_to(R).as_posix(),'sourceHashes':{p.relative_to(R).as_posix():sha(p) for p in [R/'package.json',R/'index.html',R/'sw.js',*sorted((R/'src').glob('*.js')),*sorted((R/'src').glob('*.css'))]},'commands':[],'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
for i,c in enumerate(commands,1):
    if i<start:continue
    name='npm-test' if c[0]=='npm.cmd' else Path(c[-1]).stem
    log=O/'logs'/f'{tag}-{i:02d}-{name}.log';log.parent.mkdir(parents=True,exist_ok=True)
    print('EXECUTED',i,'/',len(commands),' '.join(c),flush=True);began=time.monotonic()
    with log.open('w',encoding='utf-8') as f:
        run=subprocess.run(c,cwd=W,stdout=f,stderr=subprocess.STDOUT,env=os.environ|{'PYTHONIOENCODING':'utf-8','PYTHONUTF8':'1'},creationflags=subprocess.CREATE_NO_WINDOW)
    report['commands'].append({'command':c,'number':i,'exitCode':run.returncode,'seconds':round(time.monotonic()-began,2),'log':log.relative_to(R).as_posix(),'sha256':sha(log)})
    if c==['node','scripts/run-browser-gates.js'] and run.returncode==0:
        # The real CI wrapper runs these literal children serially and exits on
        # the first failure. Their completion is evidenced by its shared log.
        report['commands'].extend({'command':child,'exitCode':0,'invokedBy':c,'evidence':'literal child of the completed real CI wrapper; no separate timing inferred','log':log.relative_to(R).as_posix(),'sha256':sha(log)} for child in ci_children)
    receipt.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('VERIFIED' if run.returncode==0 else 'BLOCKED',name,flush=True)
    if run.returncode:
        print(log.read_text(encoding='utf-8')[-3500:],flush=True);report['status']='BLOCKED';break
else:report['status']='VERIFIED'
report['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();receipt.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
sys.exit(0 if report['status']=='VERIFIED' else 1)
