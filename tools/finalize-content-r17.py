"""Read actual receipts, preserve native review bytes, and verify the local release."""
from pathlib import Path
import ast,datetime,hashlib,json,os,re,shutil,struct,subprocess
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r17'
# R18 replaces the historical screen evidence. Validate the current release
# instead of reopening retired PNGs against an already superseded source hash.
if (R/'docs/content/r18/release-verification.json').is_file():
 import sys
 print('R17 media superseded: verifying the R18 replacement evidence.',flush=True)
 sys.exit(subprocess.call([sys.executable,str(R/'tools/verify-content-r18-release.py')],cwd=R))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads((R/p).read_text(encoding='utf8'))
def save(p,j):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
assert Path.cwd().resolve()==R.resolve()
initial=load('.audit-tmp/content-r17/protected.json')
assert all((R/p).is_file() and sha(R/p)==h for p,h in initial['protected'].items())
assert all((R/p).is_file() and sha(R/p)==h for p,h in initial['store'].items())
journeys=['journey-delivery-final.json','journey-fishing.json','journey-gathering.json','journey-inventory.json','journey-decisions.json','journey-invitations.json','journey-layouts.json','journey-stores.json','journey-offline.json','journey-commands.json','journey-final-rechecks.json','journey-final-commands.json']
for p in journeys:assert load('docs/content/r17/'+p)['status']=='VERIFIED',p
reg=load('docs/content/r17/regression.json');latest={tuple(x['command']):x for x in reg['commands']}
for p in sorted(O.glob('regression-*.json'),key=lambda p:p.stat().st_mtime):
 if p.name.startswith('regression-attempt'):continue
 for x in json.loads(p.read_text(encoding='utf8'))['commands']:latest[tuple(x['command'])]=x
assert len(latest)>=38 and all(x['exitCode']==0 for x in latest.values()),[(c,x['exitCode']) for c,x in latest.items() if x['exitCode']]
expected=set(re.findall(r'"(scripts/[^"\n]+\.js)"',(R/'scripts/run-browser-gates.js').read_text(encoding='utf8')))
assert expected<={c[-1] for c in latest},'a current CI browser gate was omitted'
for p in ['art-config.json','assets/manifest.json']:json.loads((R/p).read_text(encoding='utf8'))
prior=load('docs/content/r17/regression-tail.json');assert prior['fromOriginalCommand']==18
priorResults={tuple(x['command']):x['exitCode'] for x in prior['commands']}
assert priorResults[('npm.cmd','test')]==0 and all(priorResults[('node',f'scripts/test-content-r{i}-e2e.js')]==0 for i in range(1,11))
tail=load('docs/content/r17/regression-after-shared.json');assert tail['fromOriginalCommand']==27 and len(tail['commands'])==13
assert all(x['exitCode']==0 for x in tail['commands'] if x['command']!=['node','scripts/verify-content-r15.js'])
fresh=load('docs/content/r17/regression-verify-content-r15.json');assert fresh['status']=='VERIFIED' and len(fresh['commands'])==1 and fresh['commands'][0]['command']==['node','scripts/verify-content-r15.js']
unit=load('docs/content/r17/regression-npm.json');assert unit['status']=='VERIFIED' and unit['commands'][0]['command']==['npm.cmd','test'] and unit['commands'][0]['exitCode']==0
assert unit['sourceHashes']==fresh['sourceHashes']
assert all(fresh['sourceHashes'][p]==h for p,h in tail['sourceHashes'].items() if p!='src/ui.js')
assert all(sha(R/p)==h for p,h in fresh['sourceHashes'].items()),'source changed after the final roof/delivery recheck'
patch=load('docs/content/r17/runtime-patch-verification.json');changed={x['path'] for x in patch['files']};assert changed=={'src/content-r17.css','src/content-r6.js','src/content-r17.js','src/ui.js'}
for row in patch['files']:
 assert hashlib.sha256(row['beforeUtf8'].encode('utf8')).hexdigest()==row['beforeSha256'] and hashlib.sha256(row['afterUtf8'].encode('utf8')).hexdigest()==row['afterSha256']
 for phase,receipt in [('before',reg),('after',fresh)]:
  value=row[phase+'Utf8'];expected=receipt['sourceHashes'][row['path']]
  encodings=[name for name,text in [('LF',value),('CRLF',value.replace('\n','\r\n'))] if hashlib.sha256(text.encode('utf8')).hexdigest()==expected]
  assert len(encodings)==1,'runtime text differs beyond declared UTF-8 line ending conversion: '+row['path']
  row[phase+'RawSha256']=expected;row[phase+'RawLineEnding']=encodings[0]
 row['sha256Encoding']='beforeSha256/afterSha256 verify the UTF-8 LF text stored here; RawSha256 additionally verifies the exact tested Windows file bytes (LF or CRLF). No other transformation is permitted.'
assert all(fresh['sourceHashes'][p]==h for p,h in reg['sourceHashes'].items() if p not in changed),'undeclared runtime delta between validation batches'
assert prior['sourceHashes']['src/content-r6.js']==tail['sourceHashes']['src/content-r6.js']
assert prior['sourceHashes']['src/content-r17.js']==reg['sourceHashes']['src/content-r17.js']
assert prior['sourceHashes']['src/content-r17.css']==load('docs/content/r17/table-cup-patch.json')['afterSha256']
patch['status']='VERIFIED';patch['validation']='Complete 38-command collection; current-foot npm/R1-R10 rechecks; final npm/R10-R16/table/visual/offline rechecks after restoring the original shared center. Every latest command passed, all other runtime source hashes identical.';save(O/'runtime-patch-verification.json',patch)
cup=load('docs/content/r17/table-cup-patch.json');cup['status']='VERIFIED';cup['validation']='runtime-patch-verification.json';save(O/'table-cup-patch.json',cup)
perf=load('docs/content/r17/performance-reference.json');assert perf['status']=='VERIFIED' and all(x['medianP95Ms']<=18 for x in perf['summary'].values())
cleanup=load('docs/content/r17/cleanup-result.json');assert cleanup['status']=='VERIFIED' and cleanup['allAbsent']
kept=load('docs/content/r17/cleanup-plan.json')['retainedDependencies'];assert all((R/x['path']).is_file() and sha(R/x['path'])==x['sha256'] for x in kept)
selection=[
 ('basket','phone-basket-merchant-mid.png'),('basket','phone-basket-merchant-near.png'),('basket','phone-basket-merchant-reach.png'),('basket','phone-basket-merchant-received.png'),('basket','phone-basket-elder-received.png'),
 ('pond','phone-pond-river_carp-active.png'),('pond','phone-pond-river_carp-guess.png'),('pond','phone-pond-river_carp-reveal.png'),('pond','phone-pond-river_carp-perfect-wrong.png'),('pond','phone-pond-river_carp-late-correct.png'),
 ('memory','phone-memory-wrong.png'),('memory','phone-memory-child-lift.png'),('memory','phone-memory-child-mid.png'),('memory','phone-memory-child-received.png'),('memory','phone-memory-invite-journal-reloaded.png')]
review=[]
reviewDir=O/'review-set';archiveDir=R/'.audit-tmp/content-r17/review-prototypes'
prototypeNames=['01-phone-basket-elder-far.png','02-phone-basket-elder-mid.png','03-phone-basket-elder-near.png','04-phone-basket-elder-reach.png']
housekeeping=load('docs/content/r17/review-set-housekeeping.json') if (O/'review-set-housekeeping.json').exists() else {'status':'PREPARED','archived':[],'spaceFreedBytes':0}
for name in prototypeNames:
 p=(reviewDir/name).resolve()
 if not p.exists():continue
 assert p.is_relative_to(reviewDir.resolve()) and p.relative_to(R).as_posix() not in initial['protected']
 dest=(archiveDir/name).resolve();assert dest.is_relative_to(archiveDir.resolve()) and not dest.exists()
 dest.parent.mkdir(parents=True,exist_ok=True);h=sha(p);size=p.stat().st_size;shutil.move(str(p),str(dest));assert sha(dest)==h
 housekeeping['archived'].append({'source':p.relative_to(R).as_posix(),'localArchive':dest.relative_to(R).as_posix(),'sha256':h,'bytes':size,'reason':'This task-created prototype selection was superseded by the direct regression scenes; no initial user file was moved or removed.'})
housekeeping['status']='VERIFIED';housekeeping['archivedCount']=len(housekeeping['archived']);save(O/'review-set-housekeeping.json',housekeeping)
for i,(kind,name) in enumerate(selection,1):
 source=O/name;dest=O/'review-set'/f'{i:02d}-{name}';dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,dest)
 assert struct.unpack('>II',dest.read_bytes()[16:24])==(430,932) and sha(source)==sha(dest)
 review.append({'content':kind,'source':source.relative_to(R).as_posix(),'path':dest.relative_to(R).as_posix(),'sha256':sha(dest),'size':[430,932]})
assert len(list(reviewDir.glob('*.png')))==15
save(O/'review-set-manifest.json',{'status':'VERIFIED','count':15,'perContent':{'basket':5,'pond':5,'memory':5},'policy':'Native portrait viewport bytes; no resizing, composites, text overlays or clock changes. 12-14 are the same actual portion. The result branches 08-10 are separate rounds. Other required species/residents remain in the full evidence directory.','frames':review})
frames=[]
for p in sorted(O.glob('*.png')):
 b=p.read_bytes();frames.append({'path':p.relative_to(R).as_posix(),'size':list(struct.unpack('>II',b[16:24])),'sha256':sha(p)})
save(O/'current-frame-index.json',{'status':'VERIFIED','frames':frames})
stores=[]
for name,size in [('iphone-22-shared-afternoon-r17.png',(1290,2796)),('ipad-22-shared-afternoon-r17.png',(2064,2752))]:
 p=R/'docs/store/screenshots'/name;assert struct.unpack('>II',p.read_bytes()[16:24])==size;stores.append({'path':p.relative_to(R).as_posix(),'size':size,'sha256':sha(p)})
save(O/'store-preservation.json',{'status':'VERIFIED','preservedCount':len(initial['store']),'preserved':initial['store'],'added':stores})
reused=[]
for directory in ['content-r9','content-r10','content-r12','content-r13','content-r15']:
 for p in sorted((R/'assets/generated'/directory).glob('*.png')):
  reused.append({'path':p.relative_to(R).as_posix(),'sha256':sha(p)})
save(R/'docs/art/PROMPTS_CONTENT_R17.json',{'status':'VERIFIED','generationToolUsedThisRound':None,'newGeneratedMasters':0,'newGeneratedRuntimeAssets':0,'reason':'Only repair existing interactions. Reuse the existing R89 palette, seamless ground, articulated handover/tea poses, food plates and ripple art. No image-generation call was made.','styleReference':'docs/art/ART_DIRECTION.md','existingAssetInventory':reused})
extensions={'.js','.css','.html','.json','.md','.py','.ps1','.yml','.yaml','.webmanifest','.txt','.log'}
patterns=[r'sk-proj-[A-Za-z0-9_-]{20}',r'sk-[a-z0-9]{40}',r'AKIA[0-9A-Z]{16}',r'gh[pousr]_[A-Za-z0-9]{36,}',r'github_pat_[A-Za-z0-9_]{50,}',r'AIza[0-9A-Za-z_-]{35}',r'xox[baprs]-[A-Za-z0-9-]{24,}',r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/=]{40,}']
pattern=re.compile('|'.join(patterns));hits=[];scanned=0
for base,dirs,files in os.walk(R):
 dirs[:]=[d for d in dirs if d not in {'.git','node_modules','.audit-tmp'}]
 for name in files:
  p=Path(base)/name
  if p.suffix.lower() not in extensions:continue
  scanned+=1
  if pattern.search(p.read_text(encoding='utf8',errors='replace')):hits.append(p.relative_to(R).as_posix())
assert not hits,'secret-pattern matches: paths only '+repr(hits)
syntax=[]
for p in [*sorted((R/'src').glob('*.js')),*sorted((R/'scripts').glob('*.js'))]:
 run=subprocess.run(['node','--check',str(p)],capture_output=True,creationflags=subprocess.CREATE_NO_WINDOW);assert run.returncode==0,p;syntax.append(p.relative_to(R).as_posix())
for p in (R/'tools').glob('*content-r17*.py'):ast.parse(p.read_text(encoding='utf8'))
runtime=[R/'index.html',R/'sw.js',R/'manifest.webmanifest',R/'package.json',R/'package-lock.json',*list((R/'src').glob('*'))]
assert not any('content-r16-20261020-1' in p.read_text(encoding='utf8') for p in runtime if p.is_file())
subprocess.run(['node','scripts/test-version-chain.js'],cwd=R,check=True,creationflags=subprocess.CREATE_NO_WINDOW)
release={'status':'VERIFIED','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.1.40','appVersion':'content-r17-20261020-1','commands':list(latest.values()),'regressionCommands':len(latest),'journeys':journeys,'reviewSet':review,'nativeFrames':len(frames),'existingStoreFilesUnchanged':len(initial['store']),'protectedFilesUnchanged':len(initial['protected']),'secretScan':{'scanned':scanned,'hits':hits},'syntax':syntax,'cleanupDeletedFiles':cleanup['deletedCount'],'cleanupBytes':cleanup['bytes'],'retainedValidationMedia':len(kept),'performanceReference':perf['summary'],'limits':{'physicalDevices':'BLOCKED: requires actual iPhone/iPad and a tester','parentChildPlaytest':'BLOCKED: requires participants','museIndependentScore':'BLOCKED: requires a fresh Muse review of review-set; no self-issued 8 score','cleanMachinePerformance':'BLOCKED: shared concurrent host'}}
save(O/'release-verification.json',release)
print('VERIFIED',len(latest),'regression commands;',len(frames),'native frames; 15 review PNGs;',scanned,'text files; secrets 0; protected',len(initial['protected']))
