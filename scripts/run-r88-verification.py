"""One browser owner at a time; exact exit codes and UTF-8 logs."""
from pathlib import Path
import subprocess,shutil,json,sys,time
R=Path(__file__).resolve().parents[1];E=R/'docs/evidence/r88-art';L=E/'logs'
L.mkdir(parents=True,exist_ok=True)
node=Path(shutil.which('node'));npm=node.parent/'node_modules/npm/bin/npm-cli.js'
assert npm.is_file(),'npm CLI missing'
commands=[
 ('ci-final',[str(node),str(npm),'run','test:ci']),
 ('water-guide-final',[str(node),'scripts/test-water-quest-guide.js']),
 ('night-final',[str(node),'scripts/test-r72-night-gate.js']),
 ('comparison-final',[str(node),'scripts/capture-r88-art.js']),
 ('store-final',[str(node),'scripts/capture-r88-store.js']),
 ('art-final',[str(node),'scripts/test-r88-art.js']),
 ('version-final',[str(node),'scripts/test-version-chain.js']),
]
result=dict(status='EXECUTED',headless=True,sequential=True,checks=[])
def write():(E/'final-checks.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
write()
for label,cmd in commands:
 print('EXECUTED '+label,flush=True);began=time.time();log=L/(label+'.txt')
 with log.open('w',encoding='utf8') as f:
  completed=subprocess.run(cmd,cwd=R,stdout=f,stderr=subprocess.STDOUT)
 result['checks'].append(dict(command=cmd,label=label,exitCode=completed.returncode,elapsedSeconds=round(time.time()-began,3),log=log.relative_to(R).as_posix()))
 write()
 if completed.returncode:
  result['status']='BLOCKED';write();print('BLOCKED '+label,flush=True);sys.exit(completed.returncode)
 print('VERIFIED '+label,flush=True)
result['status']='VERIFIED';write();print('VERIFIED all seven final commands; browsers and servers owned sequentially',flush=True)
