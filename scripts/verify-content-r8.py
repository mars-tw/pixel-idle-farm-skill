"""Serial headless regression with baseline restoration; never touches initial untracked sources."""
import datetime,hashlib,json,pathlib,re,shutil,subprocess,os,sys,time
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'docs/content/r8';(OUT/'logs').mkdir(parents=True,exist_ok=True)
BASE=ROOT/'.audit-tmp/content-r8-baseline';original=json.loads((BASE/'baseline.json').read_text(encoding='utf-8'))
scripts=re.findall(r'"(scripts/[^"\n]+\.js)"',(ROOT/'scripts/run-browser-gates.js').read_text(encoding='utf-8'))
commands=[['npm.cmd','test']]+[['node',s] for s in scripts]+[['node','scripts/test-water-quest-guide.js'],['node','scripts/test-r72-night-gate.js']]
report={'status':'EXECUTED','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'protocol':'serial; each script owns one headless browser/server; restore original docs after archiving regenerated outputs','commands':[]}
if '--resume' in sys.argv:
 old=json.loads((OUT/'regression-checks.json').read_text(encoding='utf-8'))
 for c in old['commands']:
  if c['exitCode']:break
  report['commands'].append(c)
 report['priorAttempt']=old
def write(): (OUT/'regression-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
try:
 for i,cmd in enumerate(commands[len(report['commands']):],len(report['commands'])):
  name='npm-test' if cmd[0]=='npm.cmd' else pathlib.Path(cmd[-1]).stem;log=OUT/'logs'/(name+'.txt');start=time.monotonic()
  with log.open('w',encoding='utf-8') as f:p=subprocess.run(cmd,cwd=ROOT,stdout=f,stderr=subprocess.STDOUT,env=os.environ|{'PYTHONIOENCODING':'utf-8'})
  report['commands'].append({'command':cmd,'exitCode':p.returncode,'seconds':round(time.monotonic()-start,2),'log':log.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(log.read_bytes()).hexdigest()});write()
  print(i+1,len(commands),name,'VERIFIED' if p.returncode==0 else 'BLOCKED',flush=True)
  if p.returncode:break
 report['status']='VERIFIED' if len(report['commands'])==len(commands) and all(c['exitCode']==0 for c in report['commands']) else 'BLOCKED'
finally:
 restored=[]
 for name,h in original.items():
  if not name.startswith('docs/') or name.startswith('docs/content/r8/') or name=='docs/OPTIM_PLAN_CONTENT_R8.md':continue
  f=ROOT/name
  if not f.exists() or hashlib.sha256(f.read_bytes()).hexdigest()!=h:
   if f.exists():
    archive=OUT/'regression'/name;archive.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,archive)
   f.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(BASE/'files'/name,f);assert hashlib.sha256(f.read_bytes()).hexdigest()==h;restored.append(name)
 report['restoredHistoricalFiles']=restored;report['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();write();print(report['status'],'restored',len(restored),'historical docs',flush=True)
raise SystemExit(0 if report['status']=='VERIFIED' else 1)
