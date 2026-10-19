"""Reconcile real successful retries; retain every original failed receipt and log."""
import pathlib,json,hashlib,datetime
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r12';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipts=[]
for p in O.glob('regression-*.json'):
 if p.name=='regression-reconciled.json':continue
 d=json.loads(p.read_text(encoding='utf-8'))
 if 'endedAt' not in d:continue
 if not all((R/f).is_file() and sha(R/f)==h for f,h in d['sourceHashes'].items()):continue
 receipts.append((p,d))
receipts.sort(key=lambda x:x[1]['startedAt'])
full=[r for r in receipts if len(r[1]['commands'])==30];assert full,'Need a full final-source regression run'
base=full[-1][1];expected=[tuple(c['command']) for c in base['commands']];assert len(set(expected))==30
latest={};provenance=[]
for p,d in receipts:
 assert d['sourceHashes']==base['sourceHashes']
 for c in d['commands']:latest[tuple(c['command'])]=c
 provenance.append(dict(path=p.relative_to(R).as_posix(),sha256=sha(p),status=d['status']))
commands=[latest[k] for k in expected]
assert all(c['exitCode']==0 and sha(R/c['log'])==c['sha256'] for c in commands),'A latest command still failed or has an invalid log'
result=dict(status='VERIFIED',startedAt=base['startedAt'],endedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceHashes=base['sourceHashes'],sourcesUnchanged=True,commands=commands,receipts=provenance,continuation='Original failures retained; only real final-source command retries replace earlier outcomes.')
(O/'regression-reconciled.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED all 30 distinct current-source commands; original attempts retained')
