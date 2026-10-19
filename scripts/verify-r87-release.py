"""Sequential local verification; all browsers/servers are owned by individual scripts."""
from pathlib import Path
import subprocess,json,time,os,sys
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/evidence/r87-art';LOGS=OUT/'logs'
COMMANDS=[('npm-test',['cmd.exe','/d','/c','npm','test']),('e2e',['cmd.exe','/d','/c','npm','run','test:e2e']),('night',['node','scripts/test-r72-night-gate.js']),('water-guide',['node','scripts/test-water-quest-guide.js']),('compare',['node','scripts/capture-r87-art.js']),('store',['node','scripts/capture-r87-store.js']),('art',['node','scripts/test-r87-art.js'])]
def main():
 LOGS.mkdir(parents=True,exist_ok=True);saved=OUT/'final-checks.json';rows=[]
 if '--resume' in sys.argv and saved.exists():
  for r in json.loads(saved.read_text(encoding='utf-8'))['checks']:
   if r['exitCode']:break
   rows.append(r)
 done={r['name'] for r in rows};env={**os.environ,'PYTHONIOENCODING':'utf-8'}
 for name,cmd in COMMANDS:
  if name in done:continue
  start=time.time();log=LOGS/(name+'.txt')
  with log.open('wb') as f:r=subprocess.run(cmd,cwd=ROOT,env=env,stdout=f,stderr=subprocess.STDOUT)
  rows.append(dict(name=name,command=cmd,exitCode=r.returncode,seconds=round(time.time()-start,2),log=log.relative_to(ROOT).as_posix()));saved.write_text(json.dumps(dict(status='EXECUTED' if not r.returncode else 'BLOCKED',checks=rows),indent=2)+'\n',encoding='utf-8');print(name+': '+str(r.returncode),flush=True)
  if r.returncode:raise SystemExit(r.returncode)
 saved.write_text(json.dumps(dict(status='VERIFIED',checks=rows),indent=2)+'\n',encoding='utf-8')
 print('VERIFIED all sequential commands',flush=True)
if __name__=='__main__':main()
