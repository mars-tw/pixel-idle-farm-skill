"""Final current-state proof; earlier failed attempts remain visible and are superseded explicitly."""
from pathlib import Path
import json,hashlib,re,datetime
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r16';W=R/'.audit-tmp/content-r16-baseline/workspace'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
gate=(R/'scripts/run-browser-gates.js').read_text(encoding='utf8').split('const SCRIPTS = [')[1].split('];')[0]
scripts=re.findall(r'^\s*"([^"]+)"',gate,re.M)
extra=['test-content-r10-e2e','test-content-r11-e2e','test-content-r12-e2e','test-content-r13-e2e','test-content-r14-e2e','test-content-r14-visuals','test-content-r13-cache-offline','test-water-quest-guide','test-r72-night-gate','test-content-r15-e2e','verify-content-r15']
expected=[['npm.cmd','test']]+[['node',p] for p in scripts]+[['node','scripts/'+p+'.js'] for p in extra]
latest={};attempts=[]
for p in sorted(O.glob('regression-*.json')):
 j=read(p)
 if not isinstance(j.get('commands'),list):continue
 assert j['afterCleanup']
 for c in j['commands']:
  assert sha(R/c['log'])==c['sha256'];key=' '.join(c['command']);latest[key]=c|{'receipt':p.relative_to(R).as_posix()};attempts.append(c|{'receipt':p.relative_to(R).as_posix()})
for c in expected:assert ' '.join(c) in latest and latest[' '.join(c)]['exitCode']==0,'missing green final command: '+' '.join(c)
for name in ['journey.json','journey-inventory.json']:
 j=read(O/name);assert j['status']=='VERIFIED' and not j['errors'],name
journey=read(O/'journey.json');assert all(x in journey['checks'] for x in ['timing and recognition both succeed in one real round','merchant actual distinct branch','elder actual distinct branch','three real choices before any serving'])
review=read(O/'review-set-manifest.json');assert review['count']==15 and len(list((O/'review-set').glob('*.png')))==15
for f in review['frames']:assert sha(R/f['path'])==sha(R/f['source'])==f['sha256']
perf=read(O/'performance-reference.json');assert perf['status']=='VERIFIED';assert all(g['medianP95Ms']<=18 for g in perf['summary'].values())
artifact=read(O/'artifact-audit.json');assert artifact['status']=='VERIFIED' and artifact['secretScan']['matches']==0
for p,h in artifact['sources'].items():assert sha(R/p)==h and sha(W/p)==h,p
protected=read(R/'.audit-tmp/content-r16-execution/protected.json')['protected'];assert all((R/p).is_file() and sha(R/p)==h for p,h in protected.items())
cleanup=read(O/'cleanup-result.json');assert cleanup['deletedCount']==len(read(O/'cleanup-plan.json')['candidates']) and all(not (R/f['path']).exists() for f in cleanup['files'])
current=[];receipts=[(p,read(p)) for p in O.glob('journey*.json') if read(p).get('status')=='VERIFIED']
for p in sorted(O.glob('*.png')):
 h=sha(p);rel=p.relative_to(R).as_posix();matching=[str(jp.relative_to(R)).replace('\\','/') for jp,j in receipts if any(f['path']==rel and f['sha256']==h for f in j.get('frames',[]))]
 assert matching,'no current native capture receipt: '+rel
 current.append({'path':rel,'sha256':h,'receipts':matching})
(O/'current-frame-index.json').write_text(json.dumps({'status':'VERIFIED','frames':current},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
result={'status':'VERIFIED','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':artifact['version'],'appVersion':read(R/'package.json')['appVersion'],'regressionCommands':len(expected),'commands':[latest[' '.join(c)] for c in expected],'supersededFailedAttempts':[c for c in attempts if c['exitCode']!=0],'nativeReviewFrames':15,'currentJourneyFrames':len(current),'secretMatches':0,'protectedFilesUnchanged':len(protected),'cleanupFiles':cleanup['deletedCount'],'cleanupBytes':cleanup['bytes'],'performanceReference':perf['summary'],'limits':['Independent Muse >=8 review','Physical iPhone/iPad','Human/parent-child blind recognition','Clean-machine performance']}
(O/'release-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print('VERIFIED',len(expected),'final commands, current evidence, isolation and cleanup')
