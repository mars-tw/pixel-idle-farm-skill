"""Verify exact final sources, receipts, raw review copies and user-file preservation."""
from pathlib import Path
import hashlib,json,re,shutil,struct,subprocess,sys,datetime
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r19';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads((R/p).read_text(encoding='utf-8'))
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert Path.cwd().resolve()==R.resolve()
initial=load('.audit-tmp/r19/initial.json')
for group in ['protected','store']:
    assert all((R/p).is_file() and sha(R/p)==h for p,h in initial[group].items()),group
j=load('docs/content/r19/journey.json');assert j['status']=='VERIFIED'
assert all(sha(R/p)==h for p,h in j['sourceHashes'].items()),'runtime changed after journey'
assert len(j['basketAudits'])==15 and all(x['parcels']==1 and x['originalHidden'] and len(x['actors'])==2 and not x['markerOverlaps'] for x in j['basketAudits'])
assert len(j['deliveryGeometry'])==6 and all(x['overlap']<=.2 and x['feet']<1 and x['visible'] for x in j['deliveryGeometry'])
assert len(j['guideAudits'])==3 and all(x['delta']<30 and x['labelInside'] for x in j['guideAudits'])
assert len(j['handAudits'])==4 and all(x['samples']>=30 and x['maxGap']<=2 and x['opaqueFailures']==0 and len(x['gaits'])>=3 for x in j['handAudits'])
selection=[('basket','phone-basket-merchant-far.png'),('basket','phone-basket-merchant-reach.png'),('basket','phone-basket-merchant-received.png'),('basket','phone-basket-elder-received.png'),('basket','phone-basket-child-received.png'),('pond','phone-pond-river_carp-active-1.png'),('pond','phone-pond-river_carp-guess.png'),('pond','phone-pond-river_carp-reveal.png'),('pond','phone-pond-silver_dace-early-correct.png'),('pond','phone-pond-river_perch-late-correct.png'),('pond','phone-pond-river_perch-perfect-wrong.png'),('memory','phone-memory-child-left.png'),('memory','phone-memory-child-right.png'),('memory','phone-memory-child-reaction.png'),('memory','phone-journal-last.png')]
native={x['file']:x['sha256'] for x in j['frames']};review=O/'review-set';review.mkdir(exist_ok=True);records=[]
for i,(category,name) in enumerate(selection,1):
    source=O/name;assert sha(source)==native[source.relative_to(R).as_posix()];assert struct.unpack('>II',source.read_bytes()[16:24])==(430,932)
    target=review/f'{i:02d}-{name}';shutil.copyfile(source,target);assert sha(source)==sha(target)
    records.append({'category':category,'path':target.relative_to(R).as_posix(),'source':source.relative_to(R).as_posix(),'sha256':sha(target),'width':430,'height':932})
assert len(list(review.glob('*.png')))==15
save(O/'review-set-manifest.json',{'status':'VERIFIED','records':records,'distribution':{'basket':5,'pond':6,'memory':4},'reason':'Fishing explicitly requires activity, guess, success and three distinct failures (6 raw images); exact 5/5/5 cannot meet that. Native per-person and four-frame sequences remain in r19. No composites.'})
latest={};owners={}
for p in sorted(O.glob('regression-*.json'),key=lambda p:p.stat().st_mtime):
    receipt=json.loads(p.read_text(encoding='utf-8'))
    for c in receipt['commands']:latest[tuple(c['command'])]=c;owners[tuple(c['command'])]=receipt
expected={tuple(c['command']) for c in load('docs/content/r18/release-verification.json')['commands']}|{('npm.cmd','run','test:r79'),('node','scripts/test-content-r18-e2e.js')}
assert expected<=latest.keys(),expected-latest.keys()
for c in expected:
    assert latest[c]['exitCode']==0,(c,latest[c]['exitCode'])
    assert sha(R/latest[c]['log'])==latest[c]['sha256']
    assert all(sha(R/p)==h for p,h in owners[c]['sourceHashes'].items()),c
perf=load('docs/content/r19/performance-reference.json');assert perf['status']=='VERIFIED'
assert perf['sourceHashes']==j['sourceHashes'] and len(perf['samples'])==18 and all(v['medianP95Ms']<=18 for v in perf['summary'].values())
offline=load('docs/content/r19/offline-delivery-serving.json');assert offline['status']=='VERIFIED' and offline['sourceHashes']==j['sourceHashes']
execution=load('docs/content/r19/execution-receipts.json');assert execution['status']=='VERIFIED'
for c in execution['commands']:assert c['exitCode']==0 and sha(R/c['log'])==c['sha256']
cleanup=load('docs/content/r19/cleanup-result.json');assert cleanup['status']=='VERIFIED' and all(not (R/x['path']).exists() for x in cleanup['files'])
for platform,size in [('iphone',(1290,2796)),('ipad',(2064,2752))]:
    p=R/f'docs/store/screenshots/{platform}-24-neighbor-hands-r19.png';assert struct.unpack('>II',p.read_bytes()[16:24])==size
art=load('assets/generated/content-r19/manifest.json');assert art['tool']=='image_gen.imagegen' and len(art['frames'])==16
for p,h in art['masters'].items():assert sha(R/p)==h
for a in art['frames']:assert sha(R/a['file'])==a['sha256']
syntax=[]
for folder in ['src','scripts']:
    for p in sorted((R/folder).glob('*.js')):
        run=subprocess.run(['node','--check',str(p)],capture_output=True,creationflags=subprocess.CREATE_NO_WINDOW);assert run.returncode==0,p;syntax.append(p.relative_to(R).as_posix())
hits=[];scanned=0;pattern=re.compile(rb'sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}')
for folder in [R,R/'src',R/'scripts',R/'tools',R/'docs',R/'assets']:
    for p in (folder.glob('*') if folder==R else folder.rglob('*')):
        if not p.is_file() or p.suffix.lower() not in {'.md','.txt','.log','.js','.css','.py','.json','.html','.yml','.yaml','.webmanifest','.toml','.sh'}:continue
        scanned+=1
        if pattern.search(p.read_bytes()):hits.append(p.relative_to(R).as_posix())
assert not hits,hits
package=load('package.json');assert package['version']=='0.1.42' and package['appVersion']=='content-r19-20261021-1'
save(O/'release-verification.json',{'status':'VERIFIED','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':package['version'],'appVersion':package['appVersion'],'sourceHashes':j['sourceHashes'],'regressionCommands':len(expected),'commands':[latest[c] for c in sorted(expected)],'nativeFrames':len(native),'reviewSet':records,'newArt':{'masters':3,'runtimeFrames':16,'tool':art['tool']},'protectedFilesUnchanged':len(initial['protected']),'existingStoreFilesUnchanged':len(initial['store']),'cleanup':{'deleted':cleanup['deletedCount'],'bytes':cleanup['bytes'],'retainedDependencies':cleanup['retainedDependencyCount']},'performanceReference':perf['summary'],'syntaxFiles':len(syntax),'secretScan':{'files':scanned,'hits':hits},'limitations':{'museScore':'BLOCKED: independent review required','physicalDevices':'BLOCKED: actual devices and testers required','parentChildPlaytest':'BLOCKED: participants required','cleanPerformance':'BLOCKED: concurrent shared host only','reviewCap':'15 raw photos cannot contain every complete sequence; distribution 5/6/4 prioritizes the explicit six fishing states.'}})
print('VERIFIED',len(expected),'regression commands;',len(native),'native images; protected',len(initial['protected']),'; secrets 0')
