"""Run every current gate serially and preserve exact exit status and logs."""
import json, os, subprocess, time, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/content/r3';LOG=OUT/'logs';LOG.mkdir(parents=True,exist_ok=True)
env=dict(os.environ,PYTHONIOENCODING='utf-8')
scripts=re.findall(r'"(scripts/[^"\n]+\.js)"',(ROOT/'scripts/run-browser-gates.js').read_text(encoding='utf-8'))
commands=[('npm-test',['cmd','/d','/c','npm','test'])]+[(Path(s).stem,['node',s]) for s in scripts]+[
 ('test-water-quest-guide',['node','scripts/test-water-quest-guide.js']),
 ('test-r72-night-gate',['node','scripts/test-r72-night-gate.js']),
 ('performance-reference',['node','scripts/measure-content-r3.js'])]
results=[]
for name,cmd in commands:
    start=time.time();print('EXECUTED '+name,flush=True)
    with (LOG/(name+'.txt')).open('w',encoding='utf-8') as log:
        r=subprocess.run(cmd,cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
    row=dict(name=name,command=cmd,exitCode=r.returncode,seconds=round(time.time()-start,2),log='docs/content/r3/logs/'+name+'.txt')
    results.append(row)
    (OUT/'regression-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(('VERIFIED ' if r.returncode==0 else 'BLOCKED ')+name+' exit='+str(r.returncode),flush=True)
raise SystemExit(1 if any(r['exitCode'] for r in results) else 0)
