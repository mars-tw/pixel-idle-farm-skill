"""Recheck the late shared-layout correction, retaining all prior gates and failures."""
import datetime,hashlib,json,pathlib,shutil,subprocess,os,time
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'docs/content/r8';BASE=ROOT/'.audit-tmp/content-r8-baseline'
original=json.loads((BASE/'baseline.json').read_text(encoding='utf-8'))
commands=[['npm.cmd','test']]+[['node',f'scripts/test-content-r{n}-e2e.js'] for n in [6,7,8]]
report={'status':'EXECUTED','scope':'Shared native 340x285 meal layout replaces container-relative percentage geometry; actual table/person/keepsake relations compared across completion, farm and reopened scene. Prior 27 full gates retained.','commands':[],'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
def write():(OUT/'gathering-correction-checks.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
write()
try:
 for cmd in commands:
  name='npm-test' if cmd[0]=='npm.cmd' else pathlib.Path(cmd[-1]).stem;log=OUT/'logs'/('gathering-correction-'+name+'.txt');t=time.monotonic()
  with log.open('w',encoding='utf-8') as f:p=subprocess.run(cmd,cwd=ROOT,stdout=f,stderr=subprocess.STDOUT,env=os.environ|{'PYTHONIOENCODING':'utf-8'})
  report['commands'].append({'command':cmd,'exitCode':p.returncode,'seconds':round(time.monotonic()-t,2),'log':log.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(log.read_bytes()).hexdigest()});write();print(name,'VERIFIED' if p.returncode==0 else 'BLOCKED',flush=True)
  if p.returncode:break
 report['status']='VERIFIED' if len(report['commands'])==4 and all(c['exitCode']==0 for c in report['commands']) else 'BLOCKED'
finally:
 restored=[]
 for name,h in original.items():
  if not name.startswith('docs/') or name.startswith('docs/content/r8/') or name=='docs/OPTIM_PLAN_CONTENT_R8.md':continue
  f=ROOT/name
  if not f.exists() or hashlib.sha256(f.read_bytes()).hexdigest()!=h:
   if f.exists():
    dest=OUT/'gathering-correction-regression'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dest)
   f.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(BASE/'files'/name,f);assert hashlib.sha256(f.read_bytes()).hexdigest()==h;restored.append(name)
 report['restoredHistoricalFiles']=restored;report['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();write();print(report['status'],len(restored),'historical files restored',flush=True)
raise SystemExit(0 if report['status']=='VERIFIED' else 1)
