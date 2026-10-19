"""After the full sequential suite ends, export the final river grid, retry strict gates, close out."""
import json,pathlib,subprocess,sys,os
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r13'
receipts=[]
for p in O.glob('regression-*.json'):
    if 'raw' in p.name or 'reconciled' in p.name:continue
    j=json.loads(p.read_text(encoding='utf-8'))
    if len(j.get('commands',[]))==31:receipts.append((p,j))
assert receipts,'Full 31-command suite must finish before this script opens another browser'
p,full=sorted(receipts)[-1];assert full['status'] in ['VERIFIED','BLOCKED'] and full.get('sourcesUnchanged')
env={**os.environ,'PYTHONIOENCODING':'utf-8'}
with (O/'native-art-final.log').open('w',encoding='utf-8') as f:r=subprocess.run(['python','tools/process-content-r13.py'],cwd=R,env=env,stdout=f,stderr=subprocess.STDOUT)
if r.returncode:sys.exit(r.returncode)
failed=[pathlib.Path(c['command'][-1]).name for c in full['commands'] if c['exitCode'] and c['command'][0]=='node']
selection=['npm',*failed]
print('EXECUTED strict final retries:',','.join(selection),flush=True)
r=subprocess.run(['node','scripts/run-content-r13-regression.js','--only='+','.join(selection)],cwd=R,env=env)
if r.returncode:sys.exit(r.returncode)
r=subprocess.run(['python','tools/close-content-r13.py'],cwd=R,env=env)
sys.exit(r.returncode)
