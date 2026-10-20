"""Serial browser ownership; exact exits, logs, final source hashes and restored historical output."""
import pathlib,subprocess,json,hashlib,datetime,os,re,sys,time
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r15';(O/'logs').mkdir(exist_ok=True)
gate=(R/'scripts/run-browser-gates.js').read_text(encoding='utf-8').split('const SCRIPTS = [')[1].split('];')[0]
scripts=re.findall(r'^\s*"([^"]+)"',gate,re.M)
extra=['scripts/test-content-r10-e2e.js','scripts/test-content-r11-e2e.js','scripts/test-content-r12-e2e.js','scripts/test-content-r13-e2e.js','scripts/test-content-r14-e2e.js','scripts/test-content-r14-visuals.js','scripts/test-content-r13-cache-offline.js','scripts/test-water-quest-guide.js','scripts/test-r72-night-gate.js']
commands=[['npm.cmd','test']]+[['node',p] for p in scripts+extra]+[['node','scripts/test-content-r15-e2e.js','--quick'],['node','scripts/verify-content-r15.js'],['node','scripts/measure-content-r15.js']]
only=next((a.split('=',1)[1].split(',') for a in sys.argv if a.startswith('--only=')),None)
if only:commands=[c for c in commands if any(s in ' '.join(c) for s in only)]
source=['index.html','sw.js','manifest.webmanifest','package.json','package-lock.json']+[p.relative_to(R).as_posix() for p in (R/'src').glob('*') if p.suffix in ['.css','.js']]
source += [p.relative_to(R).as_posix() for p in (R/'assets/generated/content-r15').glob('*') if p.is_file()]
sha=lambda p:hashlib.sha256((R/p).read_bytes()).hexdigest()
report={'status':'EXECUTED','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'afterCleanup':True,'sources':{p:sha(p) for p in source},'commands':[]};tag=str(int(time.time()));dest=O/('regression-'+tag+'.json')
def save():dest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for cmd in commands:
    name='npm-test' if cmd[0]=='npm.cmd' else pathlib.Path(cmd[1]).stem;log=O/'logs'/(tag+'-'+name+'.log');start=time.monotonic();print('EXECUTED',name,flush=True)
    with log.open('w',encoding='utf-8') as f:p=subprocess.run(cmd,cwd=R,stdout=f,stderr=subprocess.STDOUT,env=os.environ|{'PYTHONIOENCODING':'utf-8','PYTHONUTF8':'1'},creationflags=subprocess.CREATE_NO_WINDOW)
    report['commands'].append({'command':cmd,'exitCode':p.returncode,'seconds':round(time.monotonic()-start,2),'log':log.relative_to(R).as_posix(),'sha256':sha(log.relative_to(R).as_posix())});save();print('VERIFIED' if p.returncode==0 else 'BLOCKED',name,flush=True)
report['sourcesUnchanged']=all(sha(p)==h for p,h in report['sources'].items());report['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();report['status']='VERIFIED' if report['sourcesUnchanged'] and all(c['exitCode']==0 for c in report['commands']) else 'BLOCKED';save();print(report['status'],len(report['commands']),'commands',flush=True)
sys.exit(0 if report['status']=='VERIFIED' else 1)
