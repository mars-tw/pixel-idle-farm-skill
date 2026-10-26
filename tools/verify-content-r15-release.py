"""Final readback: completed commands, native review bytes, store preservation and user-file isolation."""
import pathlib,json,hashlib,subprocess,datetime
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r15';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();read=lambda p:json.loads((R/p).read_text(encoding='utf-8'))
runs=[(p,json.loads(p.read_text(encoding='utf-8'))) for p in O.glob('regression-*.json') if p.name!='regression-output-housekeeping.json']
full=[(p,j) for p,j in runs if len(j.get('commands',[]))>=38 and j.get('status')=='VERIFIED'];assert full,'no completed full regression'
p,j=sorted(full,key=lambda x:x[0].name)[-1];assert j.get('sourcesUnchanged') or j.get('finalSourcesVerified');assert all(c['exitCode']==0 for c in j['commands']);assert all(sha(R/n)==h for n,h in j['sources'].items())
for c in j['commands']:assert sha(R/c['log'])==c['sha256']
journey=read('docs/content/r15/browser-checks.json');assert journey['status']=='VERIFIED'
assert read('docs/content/r15/r15-verification.json')['status']=='VERIFIED'
relocations=read('docs/content/r15/journey-frame-archives.json')['frames']+read('docs/content/r15/regression-output-housekeeping.json')['newStoreOutputsArchived']
for f in journey['frames']:
    if not f.get('sha256'):continue
    current=R/f['path']
    if current.is_file() and sha(current)==f['sha256']:continue
    copies=[r for r in relocations if r['source']==f['path'] and r['sha256']==f['sha256']]
    assert copies and any((R/r['path']).is_file() and sha(R/r['path'])==f['sha256'] for r in copies),'missing original journey frame '+f['path']
assert read('docs/content/r15/artifact-audit.json')['secretScan']['matches']==0
review=read('docs/content/r15/review-set-manifest.json');assert review['count']==15;assert len(list((O/'review-set').glob('*.png')))==15
for f in review['frames']:assert sha(R/f['source'])==f['sha256']==sha(R/f['path'])
cleanup=read('docs/content/r15/cleanup-result.json');plan=read('docs/content/r15/cleanup-plan.json');assert cleanup['deletedCount']==len(plan['candidates'])==1826;assert all(not (R/x['path']).exists() for x in plan['candidates'])
assert all((R/x['path']).is_file() and sha(R/x['path'])==x['sha256'] for x in plan['retainedDependencies'])
protected=read('docs/content/r15/protected-baseline.json');assert all((R/n).is_file() and sha(R/n)==h for n,h in protected.items())
stores=read('docs/content/r15/base-revision.json')['originalStores'];storeCount=0
for name,h in stores.items():
    assert (R/name).is_file() and sha(R/name)==h,name;storeCount+=1
perf=read('docs/content/r15/performance-reference.json');assert perf['status']=='VERIFIED';assert all(x['medianP95Ms']<=18 for x in perf['summary'].values())
metrics=read('docs/content/r15/character-color-metrics.json');assert all(.3<=m['brightness']<=.75 and m['meanSaturation']>=.32 and m['nearBlack']<.35 and m['lowSaturation']<.2 for m in metrics.values())
syntax=[]
for folder in ['src','scripts']:
    for f in sorted((R/folder).glob('*.js')):
        x=subprocess.run(['node','-c',str(f)],cwd=R,capture_output=True);assert x.returncode==0,f;syntax.append(f.relative_to(R).as_posix())
for command in [['node','scripts/test-version-chain.js'],['node','scripts/test-guards.js'],['node','scripts/test-content-r15.js'],['python','-X','utf8','tools/check-content-r15-art.py']]:
    x=subprocess.run(command,cwd=R,capture_output=True);assert x.returncode==0,x.stderr
assert subprocess.check_output(['git','branch','--show-current'],cwd=R).decode().strip()=='main'
result={'status':'VERIFIED','verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':read('package.json')['version'],'appVersion':read('package.json')['appVersion'],'branch':'main','fullRegression':p.relative_to(R).as_posix(),'commands':len(j['commands']),'allExitCodesZero':True,'finalSourceAndAssetHashesVerified':True,'jsSyntaxFiles':len(syntax),'reviewImages':15,'protectedFiles':len(protected),'originalStoresUnchanged':storeCount,'deletedOldMedia':cleanup['deletedCount'],'freedOriginalBytes':cleanup['bytes'],'retainedValidationMedia':len(plan['retainedDependencies']),'performance':perf['summary'],'trust':'Headless local execution on concurrent host. No physical-device, human-test, clean-machine, Apple or independent Muse score claimed.','blocked':['physical iPhone/iPad and airplane-mode touch','human/parent-child usability and blind recognition','clean-host performance','independent Muse score >=8']}
(O/'release-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('VERIFIED',len(j['commands']),'commands;',len(syntax),'JS files; 15 original phone images; protected user files and stores unchanged')
