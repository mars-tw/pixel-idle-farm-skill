"""Accept actual successful receipts only, with unchanged runtime and log hashes."""
import json,pathlib,re,hashlib
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r11';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
text=(R/'scripts/run-browser-gates.js').read_text(encoding='utf-8');scripts=re.findall(r'^\s*"(scripts/[^"\n]+\.js)",?',text,re.M)
required=['npm test','node scripts/test-content-r10-e2e.js',*['node '+s for s in scripts],'node scripts/test-water-quest-guide.js','node scripts/test-r72-night-gate.js']
found={};receipts=[]
for f in sorted(O.glob('regression-20*.json')):
 j=json.loads(f.read_text(encoding='utf-8'));receipts.append(dict(path=f.relative_to(R).as_posix(),status=j['status'],sha256=sha(f)))
 for c in j['commands']:
  if c['exitCode']!=0:continue
  assert sha(R/c['log'])==c['sha256'],c['log']
  assert all(sha(R/p)==h for p,h in j['sourceHashes'].items()),'runtime changed since '+str(f)
  found[' '.join(c['command'])]=c|dict(receipt=f.relative_to(R).as_posix())
missing=[c for c in required if c not in found]
report=dict(status='VERIFIED' if not missing else 'BLOCKED',verifiedBrowserScriptCount=sum('node '+s in found for s in scripts),requiredCommands=required,missing=missing,receipts=receipts,commands=[found[c] for c in required if c in found])
last=json.loads(sorted(O.glob('regression-20*.json'))[-1].read_text(encoding='utf-8'));report['sourceHashes']=last['sourceHashes']
(O/'regression-final.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(report['status'],'browser scripts',report['verifiedBrowserScriptCount'],'required',len(scripts),'missing',missing)
assert not missing,missing
