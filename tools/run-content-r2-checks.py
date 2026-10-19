"""Run unchanged gates serially; keep all failures and never weaken performance checks."""
import json, os, subprocess, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/content/r2';LOG=OUT/'logs';LOG.mkdir(parents=True,exist_ok=True)
env=dict(os.environ,PYTHONIOENCODING='utf-8')
scripts=['test-npc-indicators','test-world-project-art','test-world-rework-e2e','test-r79-fun-e2e','test-r80-mobile','test-r81-review','test-rwd-matrix','test-controls-reachability']+[f'test-r{n}-art' for n in range(82,90)]+['test-content-r1-e2e','test-water-quest-guide','test-r72-night-gate']
commands=[('npm-test',['cmd','/d','/c','npm','test']),('content-r2-unit',['node','scripts/test-content-r2.js']),('content-r2-browser',['node','scripts/test-content-r2-e2e.js'])]+[(s,['node','scripts/'+s+'.js']) for s in scripts]+[('performance-compare',['node','scripts/measure-content-r2.js'])]
results=[]
for name,cmd in commands:
 start=time.time();print('EXECUTED '+name,flush=True)
 with (LOG/(name+'.txt')).open('w',encoding='utf-8') as log:
  r=subprocess.run(cmd,cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
 row=dict(name=name,command=cmd,exitCode=r.returncode,seconds=round(time.time()-start,2),log='docs/content/r2/logs/'+name+'.txt');results.append(row)
 (OUT/'regression-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(('VERIFIED ' if r.returncode==0 else 'BLOCKED ')+name+' exit='+str(r.returncode),flush=True)
raise SystemExit(1 if any(r['exitCode'] for r in results) else 0)
