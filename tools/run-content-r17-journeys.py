"""One headless browser/server owner at a time; retain exact command exit codes."""
from pathlib import Path
import datetime,hashlib,json,os,subprocess,sys
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r17'
ENV=os.environ|{'PYTHONIOENCODING':'utf-8','PYTHONUTF8':'1'}
steps=[('fishing',['node','scripts/test-content-r17-e2e.js','--only=fishing']),('inventory',['node','scripts/test-content-r17-e2e.js','--only=inventory']),('decisions',['node','scripts/test-content-r17-e2e.js','--only=decisions']),('invitations',['node','scripts/test-content-r17-e2e.js','--only=invitations']),('layouts',['node','scripts/test-content-r17-e2e.js','--only=layouts']),('stores',['node','scripts/test-content-r17-e2e.js','--only=stores']),('offline',['node','scripts/test-content-r17-e2e.js','--only=offline']),('performance',['node','scripts/measure-content-r17.js'])]
final='--final-only' in sys.argv
if final:steps=[('gathering-final',['node','scripts/test-content-r17-e2e.js','--only=gathering'])]+[(tag,cmd) for tag,cmd in steps if tag in ['layouts','stores','offline','performance']]
receipt=O/('journey-final-commands.json' if final else 'journey-commands.json')
report={'status':'EXECUTED','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commands':[]}
for tag,command in steps:
 log=O/'logs'/(tag+'.log');log.parent.mkdir(parents=True,exist_ok=True);print('EXECUTED',tag,flush=True)
 with log.open('w',encoding='utf8') as f:run=subprocess.run(command,cwd=R,env=ENV,stdout=f,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
 report['commands'].append({'tag':tag,'command':command,'exitCode':run.returncode,'log':log.relative_to(R).as_posix(),'sha256':hashlib.sha256(log.read_bytes()).hexdigest()})
 print('VERIFIED' if not run.returncode else 'BLOCKED',tag,flush=True)
 if run.returncode:print(log.read_text(encoding='utf8')[-2200:],flush=True)
 receipt.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
report['status']='VERIFIED' if all(x['exitCode']==0 for x in report['commands']) else 'BLOCKED';report['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();receipt.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
sys.exit(0 if report['status']=='VERIFIED' else 1)
