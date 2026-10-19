"""One headless browser script at a time; retain failures and exact exit codes."""
from pathlib import Path
import subprocess,shutil,json,time,sys
R=Path(__file__).resolve().parents[1];E=R/'docs/evidence/r89-art';L=E/'logs';L.mkdir(parents=True,exist_ok=True)
node=Path(shutil.which('node'));npm=node.parent/'node_modules/npm/bin/npm-cli.js'
commands=[('ci',[str(node),str(npm),'run','test:ci']),('water-guide',[str(node),'scripts/test-water-quest-guide.js']),('night',[str(node),'scripts/test-r72-night-gate.js']),('npc-after-layout',[str(node),'scripts/test-npc-indicators.js']),('comparison',[str(node),'scripts/capture-r89-art.js']),('store',[str(node),'scripts/capture-r89-store.js']),('legacy-art-after-layout',[str(node),'scripts/test-r88-art.js']),('art',[str(node),'scripts/test-r89-art.js']),('version',[str(node),'scripts/test-version-chain.js'])]
result=dict(status='EXECUTED',headless=True,sequential=True,checks=[])
if '--layout-only' in sys.argv:
 result=json.loads((E/'final-checks.json').read_text(encoding='utf8'));assert result['status']=='VERIFIED';result['status']='EXECUTED'
 commands=[v for v in commands if v[0] in ['npc-after-layout','legacy-art-after-layout','art','comparison','store','version']]
def write():(E/'final-checks.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
write()
for label,cmd in commands:
 print('EXECUTED '+label,flush=True);began=time.time();log=L/(label+'.txt')
 with log.open('w',encoding='utf8') as f:c=subprocess.run(cmd,cwd=R,stdout=f,stderr=subprocess.STDOUT)
 result['checks'].append(dict(command=cmd,label=label,exitCode=c.returncode,elapsedSeconds=round(time.time()-began,3),log=log.relative_to(R).as_posix()));write()
 if c.returncode:result['status']='BLOCKED';write();print('BLOCKED '+label,flush=True);sys.exit(c.returncode)
 print('VERIFIED '+label,flush=True)
result['status']='VERIFIED';write()
