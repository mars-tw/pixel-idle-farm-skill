"""Run existing gates serially, preserve real exit codes, and bind final runtime bytes."""
import datetime,hashlib,json,os,pathlib,re,subprocess,sys,time
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r14';(O/'logs').mkdir(parents=True,exist_ok=True)
gate=(R/'scripts/run-browser-gates.js').read_text(encoding='utf-8').split('const SCRIPTS = [')[1].split('];')[0]
scripts=re.findall(r'^\s*"([^"]+)"',gate,re.M)
commands=[['npm.cmd','test']]+[['node',p] for p in scripts+['scripts/test-content-r10-e2e.js','scripts/test-content-r11-e2e.js','scripts/test-content-r12-e2e.js','scripts/test-content-r13-e2e.js','scripts/test-content-r13-cache-offline.js','scripts/test-water-quest-guide.js','scripts/test-r72-night-gate.js']]
runtime=['index.html','sw.js','manifest.webmanifest','package.json','package-lock.json']+[p.relative_to(R).as_posix() for p in (R/'src').glob('*') if p.suffix in ['.js','.css']]
sha=lambda p:hashlib.sha256((R/p).read_bytes()).hexdigest()
report={'status':'EXECUTED','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHashes':{p:sha(p) for p in runtime},'commands':[]}
only=next((s.split('=',1)[1] for s in sys.argv if s.startswith('--only=')),None)
if only and 'test-content-r2-e2e' in only:
 only+=',scripts/test-content-r4-e2e.js'
 # The final bounded pass also retries every failed command of the broad pass.
 # Keep failed receipts intact and retain every original assertion.
 for prior in O.glob('regression-*.json'):
  j=json.loads(prior.read_text(encoding='utf-8'))
  if len(j.get('commands',[]))<30:continue
  for c in j['commands']:
   if c['exitCode']:
    only+=','+('npm' if c['command'][0]=='npm.cmd' else c['command'][-1])
tag=str(int(time.time()))
def write(): (O/('regression-'+tag+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for cmd in commands:
 if only and not any(x in ' '.join(cmd) for x in only.split(',')):continue
 name='npm-test' if cmd[0]=='npm.cmd' else pathlib.Path(cmd[-1]).stem
 log=O/'logs'/(tag+'-'+name+'.log');start=time.monotonic();print('EXECUTED',name,flush=True)
 with log.open('w',encoding='utf-8') as f:
  p=subprocess.run(cmd,cwd=R,stdout=f,stderr=subprocess.STDOUT,env=os.environ|{'PYTHONIOENCODING':'utf-8'},creationflags=subprocess.CREATE_NO_WINDOW)
 report['commands'].append({'command':cmd,'exitCode':p.returncode,'seconds':round(time.monotonic()-start,2),'log':log.relative_to(R).as_posix(),'sha256':sha(log.relative_to(R).as_posix())});write();print('VERIFIED' if p.returncode==0 else 'BLOCKED',name,flush=True)
 # Keep collecting independent failures, never weaken the failed checks.
report['sourcesUnchanged']=all(sha(p)==h for p,h in report['sourceHashes'].items());report['status']='VERIFIED' if report['sourcesUnchanged'] and all(c['exitCode']==0 for c in report['commands']) else 'BLOCKED';report['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();write();print(report['status'],len(report['commands']),'commands',flush=True)
raise SystemExit(0 if report['status']=='VERIFIED' else 1)
