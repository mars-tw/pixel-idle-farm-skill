"""Current R18 release proof, raw phone review selection and preservation gate."""
from pathlib import Path
import hashlib,json,re,shutil,struct,subprocess,sys,datetime
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r18'
# R19 supersedes only the screenshots; historical reports and receipts remain.
if (R/'docs/content/r19/release-verification.json').is_file():
    sys.exit(subprocess.call([sys.executable,str(R/'tools/verify-content-r19-release.py')],cwd=R))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads((R/p).read_text(encoding='utf-8'))
def save(p,j):p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert Path.cwd().resolve()==R.resolve()
initial=load('.audit-tmp/r18/initial.json')
for group in ['protected','store']:
    assert all((R/p).is_file() and sha(R/p)==h for p,h in initial[group].items()),group
journey=load('docs/content/r18/journey.json');assert journey['status']=='VERIFIED'
assert all(sha(R/p)==h for p,h in journey['sourceHashes'].items()),'runtime changed after native R18 journey'
assert len(journey['handAudits'])==4 and all(x['maxGap']<=2 and x['opaqueFailures']==0 and len(x['gaits'])>=3 for x in journey['handAudits'])
assert len(journey['deliveryGeometry'])==6 and all(x['overlap']<=.2 and x['visible'] and x['originalHidden'] for x in journey['deliveryGeometry'])
assert len(journey['guideAudits'])==3 and all(x['delta']<30 and x['labelInside'] for x in journey['guideAudits'])
latest={};owners={}
for p in sorted(O.glob('regression-*.json'),key=lambda p:p.stat().st_mtime):
    receipt=json.loads(p.read_text(encoding='utf-8'))
    for c in receipt.get('commands',[]):latest[tuple(c['command'])]=c;owners[tuple(c['command'])]=receipt
expected={tuple(x['command']) for x in load('docs/content/r17/release-verification.json')['commands']}|{('node','scripts/test-content-r17-e2e.js'),('node','scripts/run-browser-gates.js')}
assert expected<=latest.keys() and all(latest[c]['exitCode']==0 for c in expected),[(c,latest.get(c,{}).get('exitCode')) for c in expected if latest.get(c,{}).get('exitCode')!=0]
for c in latest.values():assert sha(R/c['log'])==c['sha256']
compat=load('docs/content/r18/journal-compatibility-patch.json');ci=load(compat['ciReceipt'])
declared={x['path'] for x in compat['onlyRuntimeChangesAfterCi']};assert declared=={'src/content-r6.js','src/content-r17.css','src/ui.js','src/content-r17.js'}
assert {p for p,h in ci['sourceHashes'].items() if sha(R/p)!=h}==declared
for row in compat['onlyRuntimeChangesAfterCi']:
    assert row['beforeSha256']==ci['sourceHashes'][row['path']] and row['afterSha256']==sha(R/row['path'])
# The failing journal contract is exercised by the supplemental content tests;
# require all of them and the unit suite on the final fixed source, in addition
# to the unchanged CI wrapper result and the complete native R18 journey.
for c in expected:
    if c==('node','scripts/run-browser-gates.js') or 'invokedBy' in latest[c]:continue
    assert all(sha(R/p)==h for p,h in owners[c]['sourceHashes'].items()),c
compat['status']='VERIFIED';compat['validation']='Original assertions retained; complete supplemental content tests and npm rerun on these exact final runtime bytes, plus all R18 native UI journeys.';save(O/'journal-compatibility-patch.json',compat)
selection=[
 ('basket','phone-basket-merchant-far.png'),('basket','phone-basket-merchant-near.png'),('basket','phone-basket-elder-received.png'),('basket','phone-basket-child-reach.png'),('basket','phone-basket-child-received.png'),
 ('pond','phone-pond-river_carp-active-1.png'),('pond','phone-pond-river_carp-active-2.png'),('pond','phone-pond-silver_dace-active-1.png'),('pond','phone-pond-river_perch-active-1.png'),('pond','phone-pond-river_perch-reveal.png'),
 ('memory','phone-memory-child-mid.png'),('memory','phone-memory-child-walking.png'),('memory','phone-memory-child-reaction.png'),('memory','phone-journal-first.png'),('memory','phone-journal-last.png')]
review=O/'review-set';review.mkdir(exist_ok=True);records=[]
native={x['file']:x['sha256'] for x in journey['frames']}
for i,(kind,name) in enumerate(selection,1):
    source=O/name;rel=source.relative_to(R).as_posix();assert sha(source)==native[rel]
    assert struct.unpack('>II',source.read_bytes()[16:24])==(430,932)
    dest=review/f'{i:02d}-{name}';shutil.copyfile(source,dest);assert sha(dest)==sha(source)
    records.append({'category':kind,'path':dest.relative_to(R).as_posix(),'source':rel,'sha256':sha(dest),'width':430,'height':932})
assert len(list(review.glob('*.png')))==15
save(O/'review-set-manifest.json',{'status':'VERIFIED','records':records,'limit':'15 direct raw phone copies; complete sequences remain in the native source folder. No composites or extra annotations.'})
cleanup=load('docs/content/r18/cleanup-result.json');assert cleanup['status']=='VERIFIED' and cleanup['allAbsent'] and all(not (R/x['path']).exists() for x in cleanup['files'])
perf=load('docs/content/r18/performance-reference.json');assert perf['status']=='VERIFIED' and all(x['medianP95Ms']<=18 for x in perf['summary'].values())
assert len(perf['samples'])==18 and len(perf['summary'])==6 and all(len(x['runsP95Ms'])==3 for x in perf['summary'].values())
assert perf['sourceHashes']==journey['sourceHashes'],'performance and native journeys must use the same final runtime'
for family,size in [('iphone',(1290,2796)),('ipad',(2064,2752))]:
    p=R/f'docs/store/screenshots/{family}-23-river-wake-r18.png';assert struct.unpack('>II',p.read_bytes()[16:24])==size
art=load('assets/generated/content-r18/manifest.json');assert art['tool']=='image_gen.imagegen' and art['palette']==load('assets/generated/r89/manifest.json')['palette']
assert sha(R/art['master'])==art['masterSha256'] and all(sha(R/f['file'])==f['sha256'] for f in art['frames'])
syntax=[]
for base in ['src','scripts']:
    for p in sorted((R/base).glob('*.js')):
        check=subprocess.run(['node','--check',str(p)],cwd=R,capture_output=True,creationflags=subprocess.CREATE_NO_WINDOW);assert check.returncode==0,p;syntax.append(p.relative_to(R).as_posix())
pattern=re.compile(rb'sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}');hits=[];scanned=0
suffixes={'.js','.css','.html','.json','.md','.txt','.log','.py','.yml','.yaml','.webmanifest','.toml','.sh'}
for folder in [R,R/'src',R/'scripts',R/'tools',R/'docs',R/'assets']:
    candidates=folder.glob('*') if folder==R else folder.rglob('*')
    for p in candidates:
        if not p.is_file() or p.suffix.lower() not in suffixes:continue
        scanned+=1
        if pattern.search(p.read_bytes()):hits.append(p.relative_to(R).as_posix())
assert not hits,hits
package=load('package.json');assert package['version']=='0.1.41' and package['appVersion']=='content-r18-20261021-1'
assert all('content-r17-20261020-1' not in (R/p).read_text(encoding='utf-8') for p in journey['sourceHashes'] if p.endswith(('.js','.css','.html','.webmanifest')))
result={'status':'VERIFIED','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':package['version'],'appVersion':package['appVersion'],'sourceHashes':journey['sourceHashes'],'commands':[latest[c] for c in sorted(expected)],'regressionCommands':len(expected),'nativeFrames':len(native),'reviewSet':records,'newArt':{'masters':1,'runtimeFrames':12,'tool':'image_gen.imagegen'},'protectedFilesUnchanged':len(initial['protected']),'existingStoreFilesUnchanged':len(initial['store']),'cleanup':{'deleted':cleanup['deletedCount'],'bytes':cleanup['bytes'],'retainedDependencies':cleanup['retainedDependencyCount']},'handAudits':journey['handAudits'],'performanceReference':perf['summary'],'syntaxFiles':len(syntax),'secretScan':{'files':scanned,'hits':hits},'limitations':{'museScore':'BLOCKED: needs independent review; no score invented','physicalDevices':'BLOCKED: requires actual devices/tester','parentChildPlaytest':'BLOCKED: requires participants','cleanPerformance':'BLOCKED: concurrent shared host','reviewCap':'15 balanced phone images cannot also contain the 12 fish stages plus 9 plate stages, 6 basket exchanges and 2 notebook pages. Full native sequences are retained separately; not claimed to fit the review cap.'}}
save(O/'release-verification.json',result)
save(O/'current-frame-index.json',{'status':'VERIFIED','frames':journey['frames'],'sourceHashes':journey['sourceHashes']})
print('VERIFIED',len(expected),'regression commands;',len(native),'native frames; 15 review photos; secrets 0; protected',len(initial['protected']))
