"""Sequential headless regression in an isolated copy; never rewrite the user's evidence."""
from pathlib import Path
import subprocess,json,hashlib,os,re,shutil,time,sys,datetime
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r16';W=R/'.audit-tmp/content-r16-baseline/workspace'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
if '--sync' in sys.argv:
 assert (W/'index.html').is_file() and W.resolve().is_relative_to(R.resolve())
 names=set(x for x in subprocess.check_output(['git','ls-files','-z'],cwd=R).decode('utf8').split('\0') if x)
 for d in ['src','scripts','tools','assets/generated/content-r16','docs/content/r16']:
  names.update(p.relative_to(R).as_posix() for p in (R/d).rglob('*') if p.is_file())
 names.update(['docs/art/masters/content-r16-sharing.png','docs/art/PROMPTS_CONTENT_R16.json'])
 for n in names:
  p=R/n;t=W/n
  if p.is_file():
   if not t.is_file() or sha(p)!=sha(t):t.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,t)
  elif t.is_file():t.unlink()
 cleanup=O/'cleanup-result.json'
 if cleanup.is_file():
  for row in json.loads(cleanup.read_text(encoding='utf8'))['files']:
   p=(W/row['path']).resolve();assert p.is_relative_to(W.resolve())
   if p.is_file():p.unlink()
 print('VERIFIED isolated copy synchronized');sys.exit(0)
gate=(R/'scripts/run-browser-gates.js').read_text(encoding='utf8').split('const SCRIPTS = [')[1].split('];')[0]
scripts=re.findall(r'^\s*"([^"]+)"',gate,re.M)
extra=['test-content-r10-e2e','test-content-r11-e2e','test-content-r12-e2e','test-content-r13-e2e','test-content-r14-e2e','test-content-r14-visuals','test-content-r13-cache-offline','test-water-quest-guide','test-r72-night-gate','test-content-r15-e2e','verify-content-r15']
commands=[['npm.cmd','test']]+[['node',p] for p in scripts]+[['node','scripts/'+p+'.js'] for p in extra]
only=next((x.split('=',1)[1].split(',') for x in sys.argv if x.startswith('--only=')),None)
if only:commands=[c for c in commands if any(t in ' '.join(c) for t in only)]
tag=str(int(time.time()));receipt=O/('regression-'+tag+'.json');report={'status':'EXECUTED','afterCleanup':(O/'cleanup-result.json').exists(),'workspace':str(W.relative_to(R)),'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commands':[]}
for cmd in commands:
 name='npm-test' if cmd[0]=='npm.cmd' else Path(cmd[1]).stem;log=O/'logs'/(tag+'-'+name+'.log');log.parent.mkdir(parents=True,exist_ok=True);print('EXECUTED',name,flush=True);start=time.monotonic()
 with log.open('w',encoding='utf8') as f:run=subprocess.run(cmd,cwd=W,stdout=f,stderr=subprocess.STDOUT,env=os.environ|{'PYTHONIOENCODING':'utf-8','PYTHONUTF8':'1'},creationflags=subprocess.CREATE_NO_WINDOW)
 report['commands'].append({'command':cmd,'exitCode':run.returncode,'seconds':round(time.monotonic()-start,2),'log':log.relative_to(R).as_posix(),'sha256':sha(log)});write(receipt,report);print('VERIFIED' if run.returncode==0 else 'BLOCKED',name,flush=True)
report['status']='VERIFIED' if all(c['exitCode']==0 for c in report['commands']) else 'BLOCKED';report['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();write(receipt,report);print(report['status'],len(commands),'commands',flush=True);sys.exit(0 if report['status']=='VERIFIED' else 1)
