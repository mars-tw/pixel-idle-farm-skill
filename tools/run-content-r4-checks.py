"""Run serial gates, retaining every attempt and command receipt in this round."""
import json, os, subprocess, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/content/r4';LOG=OUT/'logs';LOG.mkdir(parents=True,exist_ok=True)
env=dict(os.environ,PYTHONIOENCODING='utf-8')
commands=[('npm-test',['cmd','/d','/c','npm','test']),
 ('browser-gates',['cmd','/d','/c','npm','run','test:e2e']),
 ('test-water-quest-guide',['node','scripts/test-water-quest-guide.js']),
 ('test-r72-night-gate',['node','scripts/test-r72-night-gate.js']),
 ('performance-reference',['node','scripts/measure-content-r4.js']),
 ('new-art-fallback',['node','scripts/test-content-r4-assets.js'])]
results=[]
for name,cmd in commands:
 start=time.time();print('EXECUTED '+name,flush=True)
 with (LOG/(name+'.txt')).open('w',encoding='utf-8') as log:
  result=subprocess.run(cmd,cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
 results.append(dict(name=name,command=cmd,exitCode=result.returncode,seconds=round(time.time()-start,2),log='docs/content/r4/logs/'+name+'.txt'))
 (OUT/'regression-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(('VERIFIED ' if result.returncode==0 else 'BLOCKED ')+name+' exit='+str(result.returncode),flush=True)
raise SystemExit(1 if any(r['exitCode'] for r in results) else 0)
