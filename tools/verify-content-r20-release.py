"""Audit the release receipts, preserved inputs and native review set."""
from pathlib import Path
import json,hashlib,struct,shutil,subprocess,re,datetime,sys
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r20'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
load=lambda p:json.loads((R/p).read_text(encoding='utf-8'))
def write(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
initial=load('.audit-tmp/r20/baseline.json');journey=load('docs/content/r20/journey.json')
assert journey['status']=='VERIFIED'
assert all(sha(R/p)==h for p,h in journey['sourceHashes'].items())
assert len(journey['waterPixelAudits'])==8 and len(journey['waterMotionAudits'])==3
assert all(sha(R/p)==x['sha256'] for p,x in initial['untracked'].items()),'initial untracked files changed'
store={p:x for p,x in initial['tracked'].items() if p.startswith('docs/store/screenshots/')}
assert all(sha(R/p)==x['sha256'] for p,x in store.items()),'existing store files changed'
cleanup=load('docs/content/r20/cleanup-result.json');assert cleanup['status']=='VERIFIED' and cleanup['allAbsent']
assert all(not (R/x['path']).exists() for x in cleanup['files'])
native={x['file']:x['sha256'] for x in journey['frames']}
assert all(sha(R/p)==h for p,h in native.items()),'capture bytes changed after journey'
selection=[('basket','phone-basket-merchant-reach.png'),('basket','phone-basket-merchant-received.png'),('basket','phone-basket-elder-reach.png'),('basket','phone-basket-elder-received.png'),('basket','phone-basket-child-received.png'),('pond','phone-pond-river_carp-cycle-2.png'),('pond','phone-pond-river_carp-cycle-3.png'),('pond','phone-pond-river_carp-guess.png'),('pond','phone-pond-silver_dace-reveal.png'),('pond','phone-pond-river_perch-reveal.png'),('memory','phone-memory-child-lift.png'),('memory','phone-memory-child-mid.png'),('memory','phone-memory-child-received.png'),('memory','phone-memory-child-reaction.png'),('memory','phone-journal-last.png')]
review=O/'review-set';review.mkdir(exist_ok=True);records=[]
for i,(category,name) in enumerate(selection,1):
    source=O/name;assert sha(source)==native[source.relative_to(R).as_posix()]
    assert struct.unpack('>II',source.read_bytes()[16:24])==(430,932)
    target=review/f'{i:02d}-{name}';shutil.copyfile(source,target);assert sha(target)==sha(source)
    records.append({'category':category,'path':target.relative_to(R).as_posix(),'source':source.relative_to(R).as_posix(),'sha256':sha(target),'size':[430,932]})
assert len(list(review.glob('*.png')))==15
write(O/'review-set-manifest.json',{'status':'VERIFIED','distribution':{'basket':5,'pond':5,'memory':5},'records':records,'note':'Direct byte copies of native captures. All three species guess/reveal pairs also available in the same round; the 15-picture cap cannot include every branch.'})
if '--curate' in sys.argv:
    print('VERIFIED 15 native review copies, 5/5/5');sys.exit(0)
inspection=load('docs/content/r20/review-inspection.json')
assert inspection['status']=='VERIFIED' and len(inspection['records'])==15
for row,record in zip(inspection['records'],records):
    assert all(row[k]==record[k] for k in ['path','source','sha256']) and row['inspection']=='VERIFIED'
    assert re.search(r'[\u4e00-\u9fff]',row['result'])
report=(R/'docs/CODEX_RESPONSE_CONTENT_R20.md').read_text(encoding='utf-8')
assert '陽光農場' in report and not re.search(r'\?{3}',report)
for link in re.findall(r'\]\(([^)]+)\)',report):
    assert (R/'docs'/link).is_file(),link
latest={};owners={};failed=[]
for p in sorted(O.glob('regression-[0-9]*.json'),key=lambda p:p.stat().st_mtime):
    r=json.loads(p.read_text(encoding='utf-8'))
    for row in r['commands']:
        key=tuple(row['command']);latest[key]=row;owners[key]=r
        if row['exitCode']!=0:failed.append(row)
gates=re.findall(r'^\s*"(scripts/[^\"]+)"',(R/'scripts/run-browser-gates.js').read_text(encoding='utf-8'),re.M)
extra=[f'scripts/test-content-r{i}-e2e.js' for i in range(10,20)]+['scripts/test-content-r13-cache-offline.js','scripts/test-content-r14-visuals.js','scripts/test-content-r19-offline.js','scripts/test-water-quest-guide.js','scripts/test-r72-night-gate.js']
expected={('cmd','/d','/c','npm.cmd test')}|{('node',p) for p in gates+extra}
assert len(expected)==41 and expected==latest.keys(),expected-latest.keys()
receipts=[latest[k] for k in sorted(expected)]
for key in expected:
    row=latest[key];assert row['exitCode']==0 and sha(R/row['log'])==row['sha256'],row
    assert all(sha(R/p)==h for p,h in owners[key]['sourceHashes'].items()),'regression used different sources'
for r in [load('docs/content/r20/performance-reference.json'),load('docs/content/r20/offline-delivery-serving.json')]:
    assert r['status']=='VERIFIED';assert all(sha(R/p)==h for p,h in r['sourceHashes'].items())
syntax=[]
for directory in ['src','scripts']:
    for p in (R/directory).glob('*.js'):
        subprocess.run(['node','--check',str(p)],check=True,capture_output=True,creationflags=subprocess.CREATE_NO_WINDOW);syntax.append(p.relative_to(R).as_posix())
secret=re.compile(rb'sk-proj-[A-Za-z0-9_-]{20,}|sk-[a-z0-9]{40}')
scanned=0;hits=[]
visible=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=R,encoding='utf-8').split('\0')
names=set(initial['tracked'])|set(visible)|{p.relative_to(R).as_posix() for d in ['src','scripts','tools','docs/content/r20'] for p in (R/d).rglob('*') if p.is_file()}
for name in names:
    p=R/name
    if not p.is_file() or p.suffix.lower() in ['.png','.webp','.jpg','.jpeg','.mp4','.webm','.ogg','.wav','.m4a']:continue
    scanned+=1
    if secret.search(p.read_bytes()):hits.append(name)
assert not hits,hits
json.loads((R/'art-config.json').read_text(encoding='utf-8'));json.loads((R/'assets/manifest.json').read_text(encoding='utf-8'))
assert subprocess.check_output(['git','status','--short','--','docs/evidence/R68/source-manifest.json'],cwd=R)==b''
assert not subprocess.check_output(['git','diff','--numstat','--','docs/evidence/R68/source-manifest.json'],cwd=R)
result={'status':'VERIFIED','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.1.43','appVersion':'content-r20-20261021-1','sourceHashes':journey['sourceHashes'],'journeyChecks':len(journey['checks']),'frames':len(journey['frames']),'waterPixelAudits':journey['waterPixelAudits'],'waterMotionAudits':journey['waterMotionAudits'],'reviewSet':records,'regressionCommands':len(receipts),'commands':receipts,'syntaxFiles':len(syntax),'secretScan':{'files':scanned,'hits':hits},'preservedUntracked':len(initial['untracked']),'preservedStoreFiles':len(store),'cleanup':{'deletedCount':cleanup['deletedCount'],'bytes':cleanup['bytes'],'retainedDependencies':cleanup['retainedDependencyCount']},'newArt':0,'limitations':['Independent Muse >=8 review pending','Physical iPhone/iPad and parent-child testing need devices/participants','Shared-host performance is reference only','Other four Muse recommendations deferred by the line-specific scope']}
result['priorFailedCommands']=failed
write(O/'release-verification.json',result);print('VERIFIED release:',len(receipts),'regressions,',len(journey['checks']),'journey checks,',len(syntax),'syntax files, zero secret hits')
