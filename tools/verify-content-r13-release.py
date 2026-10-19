"""Verify native artifacts, final test receipts, offline provenance and protected files."""
import pathlib,json,hashlib,subprocess,re
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r13';checks=[]
def read(p):return json.loads((R/p).read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256((R/p).read_bytes()).hexdigest()
def check(v,n):
    assert v,n;checks.append(n);print('PASS',n)
primary=read('docs/content/r13/browser-checks.json');check(primary['status']=='VERIFIED','main real UI journey verified')
for name in ['animation-audit','final-evidence','performance-reference','protected-readback','syntax','cache-offline']:
    check(read(f'docs/content/r13/{name}.json')['status']=='VERIFIED',name)
receipts=[]
for p in sorted(O.glob('regression-*.json')):
    if p.name=='regression-reconciled.json':continue
    j=json.loads(p.read_text(encoding='utf-8'))
    if 'commands' in j:receipts.append((p,j))
delta=read('docs/content/r13/version-query-delta.json');check(delta['status']=='VERIFIED' and delta['from']=='content-r12-20261019-1' and delta['to']=='content-r13-20261019-1','literal cache-query delta declares exact versions')
check({r['path'] for r in delta['files']}=={'src/world-ui.js','src/daily-ui.js'},'only welcome and journal cache queries differ')
mapped={}
for row in delta['files']:
    before=(R/row['beforeSnapshot']).read_bytes();after=(R/row['path']).read_bytes()
    check(hashlib.sha256(before).hexdigest()==row['beforeSha256'] and hashlib.sha256(after).hexdigest()==row['afterSha256'],'cache-query snapshot hashes '+row['path'])
    check(before.count(delta['from'].encode())==row['replacements'] and before.replace(delta['from'].encode(),delta['to'].encode())==after,'all other bytes unchanged '+row['path'])
    mapped[row['path']]=row|{'document':'docs/content/r13/version-query-delta.json'}
river=read('docs/content/r13/river-grid-delta.json');check(river['status']=='VERIFIED' and len(river['files'])==1 and river['files'][0]['path']=='src/content-r6.js','only the decorative river bounds receive the visual follow-up')
check(river['from']=='top:${-size}px;width:${size*3}px;height:${size*14}px' and river['to']=='top:${-size*4}px;width:${size*3}px;height:${size*20}px','river delta is exactly the two decorative bounds literals')
for row in river['files']:
    before=(R/row['beforeSnapshot']).read_bytes();after=(R/row['path']).read_bytes()
    check(hashlib.sha256(before).hexdigest()==row['beforeSha256'] and hashlib.sha256(after).hexdigest()==row['afterSha256'],'river source snapshot hashes')
    check(before.count(river['from'].encode())==1 and before.replace(river['from'].encode(),river['to'].encode())==after,'all state, collider, input and economy code byte-identical')
    mapped[row['path']]=row|{'document':'docs/content/r13/river-grid-delta.json'}
current={};exact_commands=set();cache_exact_commands=set()
for p,j in receipts:
    exact=all(sha(n)==h for n,h in j['sourceHashes'].items())
    valid=all(sha(n)==h or n in mapped and h==mapped[n]['beforeSha256'] and sha(n)==mapped[n]['afterSha256'] for n,h in j['sourceHashes'].items())
    if valid:
        for c in j['commands']:
            if c['exitCode']==0:
                used=sorted({mapped[n]['document'] for n,h in j['sourceHashes'].items() if sha(n)!=h})
                check(sha(c['log'])==c['sha256'],'command log hash '+c['command'][-1]);key=' '.join(c['command']);current[key]=c|{'originalReceipt':p.relative_to(R).as_posix(),'sourceDeltas':used}
                if exact:exact_commands.add(key)
                if all(j['sourceHashes'].get(n)==sha(n) for n in ['src/world-ui.js','src/daily-ui.js']):cache_exact_commands.add(key)
check({'npm test','node scripts/test-r80-mobile.js','node scripts/test-r81-review.js'}<=cache_exact_commands,'cache-query affected existing gates reran with exact final URL bytes')
check({'npm test','node scripts/test-r79-fun-e2e.js','node scripts/test-controls-reachability.js'}<=exact_commands,'river rendering and control gates reran on exact final source')
check(all(sha(n)==h for n,h in read('docs/content/r13/cache-offline.json')['sourceHashes'].items()),'cold welcome and journal offline test binds final source')
gate=(R/'scripts/run-browser-gates.js').read_text(encoding='utf-8').split('const SCRIPTS = [')[1].split('];')[0]
names=re.findall(r'^\s*"([^"]+)"',gate,re.M)
expected=['npm test']+['node '+p for p in names+['scripts/test-content-r10-e2e.js','scripts/test-content-r11-e2e.js','scripts/test-content-r12-e2e.js','scripts/test-water-quest-guide.js','scripts/test-r72-night-gate.js']]
check(all(n in current for n in expected),'all '+str(len(expected))+' final-source regression commands passed')
(O/'regression-reconciled.json').write_text(json.dumps({'status':'VERIFIED','commands':[current[n] for n in expected],'sourceHashes':{n:sha(n) for n in receipts[-1][1]['sourceHashes']},'sourceDeltas':['docs/content/r13/version-query-delta.json','docs/content/r13/river-grid-delta.json'],'validation':'All assertions retained. Earlier green commands bind only through byte-exact three-URL query replacements and two decorative river-bound literals. All other source bytes match; affected existing gates, fresh bounds screenshots and offline entries reran on final bytes.','originalReceipts':[p.relative_to(R).as_posix() for p,j in receipts]},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
rows=primary['reviewSet'];check(len(rows)==15,'exactly fifteen review images')
check(len(list((O/'review-set').glob('*.png')))==15,'no additional review PNGs')
for kind,count in [('basket',6),('pond',5),('memory',4)]:check(sum(r['content']==kind for r in rows)==count,kind+' has exactly '+str(count)+' native review frames')
for row in rows:
    check(Image.open(R/row['path']).size==(430,932),row['path']+' native 430x932')
    check(sha(row['path'])==sha(row['source']),row['path']+' direct source copy')
for n,size in [('iphone',(1290,2796)),('ipad',(2064,2752))]:
    check(Image.open(R/f'docs/store/screenshots/{n}-18-shared-afternoon-r13.png').size==size,n+' native store size')
m=read('assets/generated/content-r13/manifest.json');check(m['tool']=='image_gen.imagegen' and len(m['assets'])==4 and len(m['derived'])==9,'actual generated and reused art counts')
for a in m['assets']+m['derived']+m['masters']:check(sha(a['path'])==a['sha256'],'asset hash '+a['path'])
pkg=read('package.json');check(pkg['version']=='0.1.36' and pkg['appVersion']=='content-r13-20261019-1','version bumped')
old='content-r12-20261019-1';runtime=['index.html','sw.js','manifest.webmanifest','package.json','package-lock.json']+[p.relative_to(R).as_posix() for p in (R/'src').glob('*') if p.suffix in ['.js','.css']]
check(not any(old in (R/p).read_text(encoding='utf-8') for p in runtime),'old runtime cache version zero matches')
scan=subprocess.run(['rg','--files-with-matches','-I','--hidden','-e',r'sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}','--glob','!.git/**','--glob','!node_modules/**','--glob','!.audit-tmp/**','.'],cwd=R,capture_output=True,text=True,encoding='utf-8')
check(scan.returncode==1,'secret scan zero matches');(O/'secret-scan.json').write_text(json.dumps({'status':'VERIFIED','matches':0,'scope':'repo text, excluding .git/node_modules/.audit-tmp; no secret directory accessed'},indent=2)+'\n',encoding='utf-8')
artifacts=[]
for root in [O,R/'assets/generated/content-r13',R/'docs/art/masters/content-r13']:
    for p in sorted(root.rglob('*')):
        if 'regression-outputs' in p.relative_to(R).parts:continue
        if p.is_file() and p.suffix.lower() in ['.png','.webm']:
            row={'path':p.relative_to(R).as_posix(),'sha256':sha(p.relative_to(R)),'bytes':p.stat().st_size}
            if p.suffix=='.png':row['width'],row['height']=Image.open(p).size
            artifacts.append(row)
check(all(r.get('width')==430 and r.get('height')==932 for r in artifacts if pathlib.Path(r['path']).name.startswith('phone-')),'all phone evidence remains native portrait')
(O/'artifact-manifest.json').write_text(json.dumps({'status':'VERIFIED','note':'Current file hashes after actual final-source recaptures; original journey receipts retain their earlier hashes and are preserved. No resize/crop/composite of review screenshots.','artifacts':artifacts},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(O/'release-readback.json').write_text(json.dumps({'status':'VERIFIED','checks':checks,'regressionCommands':len(expected),'nativeReviewImages':15,'generatedNativeAssets':4,'derivedAssets':9,'phoneEvidence':sum(pathlib.Path(r['path']).name.startswith('phone-') for r in artifacts)},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED R13 release readback',len(checks),'checks')
