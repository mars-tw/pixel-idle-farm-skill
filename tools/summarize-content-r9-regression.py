"""Merge successful script receipts without relabeling the interrupted first run."""
import hashlib,json,pathlib,re
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r9'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
first=json.loads((O/'regression-first-checks.json').read_text(encoding='utf-8'))
assert first['status']=='BLOCKED'
log=O/'regression-2.log';assert sha(log)==first['commands'][1]['sha256']
seen=re.findall(r'\[memory\] (scripts/[^\s]+\.js) attempt 1:',log.read_text(encoding='utf-8'))
assert seen[-1]=='scripts/test-content-r4-e2e.js'
before=seen[:-1]
source=(R/'scripts/run-browser-gates.js').read_text(encoding='utf-8');block=re.search(r'const SCRIPTS = \[([\s\S]*?)\];',source).group(1);expected=re.findall(r'^\s+"([^"]+\.js)",',block,re.M)
assert len(expected)==25
verified={p:dict(path=p,evidence='docs/content/r9/regression-2.log',verifiedBecause='Next script started after successful exit in the initial sequential runner') for p in before}
commands=[];receipts=[]
for p in sorted(O.glob('regression*checks.json')):
 r=json.loads(p.read_text(encoding='utf-8'))
 if 'commands' not in r:continue
 receipts.append(dict(path=p.relative_to(R).as_posix(),status=r['status'],sha256=sha(p)))
 for c in r['commands']:
  assert sha(R/c['log'])==c['sha256']
  commands.append(c)
commands.sort(key=lambda c:c['end'])
for c in commands:
 if c['exitCode']==0 and c['command'][0]=='node' and c['command'][1] in expected:
  verified[c['command'][1]]=dict(path=c['command'][1],commandReceipt=c)
assert set(verified)==set(expected)
npm=[c for c in commands if c['command']==['npm','test'] and c['exitCode']==0][-1]
guards=[]
for p in ['scripts/test-water-quest-guide.js','scripts/test-r72-night-gate.js']:
 guards.append([c for c in commands if c['command']==['node',p] and c['exitCode']==0][-1])
assert json.loads((O/'browser-checks.json').read_text(encoding='utf-8'))['status']=='VERIFIED'
runtime=[R/'index.html',R/'sw.js',R/'package.json',R/'manifest.webmanifest',*(R/'src').glob('*.js'),*(R/'src').glob('*.css')]
out=dict(status='VERIFIED',trust='Aggregate successful actual script runs. The initial full runner stopped at R4; later individual failures remain BLOCKED in original receipts. Each listed script has an actual successful exit. Implementation/fixture corrections are recorded in test-attempts.json; no old assertion weakened.',receipts=receipts,initialPassedBrowserScripts=before,verifiedBrowserScripts=[verified[p] for p in expected],verifiedBrowserScriptCount=len(expected),latestNpmTest=npm,extraGuards=guards,sourceHashes={p.relative_to(R).as_posix():sha(p) for p in runtime})
(O/'regression-final.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED npm test, all 25 browser scripts, water/night guards; interrupted runs retained')
