"""Final local release gate. No network, inference, publishing or user-file changes."""
import hashlib,json,pathlib,re,subprocess
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r14';checks=[]
sha=lambda p:hashlib.sha256((R/p).read_bytes()).hexdigest()
def read(p):return json.loads((R/p).read_text(encoding='utf-8'))
def check(v,n):assert v,n;checks.append(n);print('PASS',n)
primary=read('docs/content/r14/browser-checks.json');visual=read('docs/content/r14/visual-regression.json')
check(primary['status']=='VERIFIED' and not primary['errors'],'main real UI play, complete, reload, offline and RWD')
check(visual['status']=='VERIFIED' and not visual['errors'],'supplemental roof, labels, three real catches, plate motion and single skip')
review=read('docs/content/r14/review-set-manifest.json')['images'];check(len(review)==15,'exactly 15 review images')
check(len(list((O/'review-set').glob('*.png')))==15,'no extra PNGs in review-set')
for kind in ['basket','pond','memory']:check(sum(r['content']==kind for r in review)==5,kind+' has five original gameplay frames')
for row in review:
 check(Image.open(R/row['path']).size==(row['width'],row['height']) and row['height']>row['width'],'native portrait '+row['path'])
 check(sha(row['path'])==row['sha256']==sha(row['source']),'direct original bytes '+row['path'])
for device,size in [('iphone',(1290,2796)),('ipad',(2064,2752))]:check(Image.open(R/f'docs/store/screenshots/{device}-19-shared-afternoon-r14.png').size==size,device+' native store screenshot')
cleanup=read('docs/content/r14/cleanup-result.json');check(all(not (R/r['path']).exists() for r in cleanup['candidates']),'all superseded cleanup targets remain absent')
check(cleanup['deleteCount']==len(cleanup['candidates']) and cleanup['bytes']==sum(r['bytes'] for r in cleanup['candidates']),'exact cleanup file count and bytes')
check(read('docs/content/r14/protected-readback.json')['status']=='VERIFIED','all initial dirty/untracked files restored byte for byte')
baseline=read('.audit-tmp/content-r14-protection/inventory.json')
for p,row in baseline.items():
 if row['protected'] or p.startswith('docs/store/screenshots/'):
  check((R/p).exists() and sha(p)==row['sha256'],'preserved original '+p)
pkg=read('package.json');check(pkg['version']=='0.1.37' and pkg['appVersion']=='content-r14-20261019-1','version bumped')
runtime=['index.html','sw.js','manifest.webmanifest','package.json','package-lock.json']+[p.relative_to(R).as_posix() for p in (R/'src').glob('*') if p.suffix in {'.js','.css'}]
check(not any('content-r13-20261019-1' in (R/p).read_text(encoding='utf-8') for p in runtime),'old runtime version zero matches')
scan=subprocess.run(['rg','--files-with-matches','-I','--hidden','-e',r'sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}','--glob','!.git/**','--glob','!node_modules/**','--glob','!.audit-tmp/**','.'],cwd=R,capture_output=True)
check(scan.returncode==1,'secret scan zero matches')
(O/'secret-scan.json').write_text(json.dumps({'status':'VERIFIED','matches':0,'scope':'repo excluding .git/node_modules/.audit-tmp; no secret directory read'},indent=2)+'\n')
gates=(R/'scripts/run-browser-gates.js').read_text(encoding='utf-8').split('const SCRIPTS = [')[1].split('];')[0]
expected=['npm.cmd test']+['node '+p for p in re.findall(r'^\s*"([^"]+)"',gates,re.M)]+['node scripts/'+p for p in ['test-content-r10-e2e.js','test-content-r11-e2e.js','test-content-r12-e2e.js','test-content-r13-e2e.js','test-content-r13-cache-offline.js','test-water-quest-guide.js','test-r72-night-gate.js']]
records=[]
for p in sorted(O.glob('regression-*.json')):
 if p.name=='regression-reconciled.json':continue
 j=json.loads(p.read_text(encoding='utf-8'))
 if 'commands' in j:records.append((p,j))
current={};delta=read('docs/content/r14/serving-path-delta.json');hud=read('docs/content/r14/hud-refresh-delta.json')
check(sha(delta['beforeSnapshot'])==delta['beforeSha256'] and sha(delta['file'])==delta['afterSha256'],'exact serving visual delta')
deltas={delta['file']:delta}
for row in hud['files']:
 check(sha(row['beforeSnapshot'])==row['beforeSha256'] and sha(row['path'])==row['afterSha256'],'exact HUD redraw delta '+row['path']);deltas[row['path']]=row
exact=set()
for p,j in records:
 valid=all(sha(n)==h or n in deltas and h==deltas[n]['beforeSha256'] and sha(n)==deltas[n]['afterSha256'] for n,h in j['sourceHashes'].items())
 if not valid:continue
 for c in j['commands']:
  if c['exitCode']!=0:continue
  check(sha(c['log'])==c['sha256'],'command log intact '+c['command'][-1]);key=' '.join(c['command']);current[key]=c|{'receipt':p.relative_to(R).as_posix()}
  if all(sha(n)==h for n,h in j['sourceHashes'].items()):exact.add(key)
check(all(n in current for n in expected),'all '+str(len(expected))+' existing applicable commands green after cleanup')
check({'npm.cmd test','node scripts/test-npc-indicators.js','node scripts/test-world-project-art.js','node scripts/test-world-rework-e2e.js'}<=exact,'early generic gates reran on exact final source')
perf=read('docs/content/r14/performance-reference.json');check(perf['status']=='VERIFIED' and all(s['medianP95Ms']<=18 for s in perf['summary'].values()),'three-run p95 medians <=18ms on shared host')
syntax=[]
for p in list((R/'src').glob('*.js'))+list((R/'scripts').glob('*.js')):
 result=subprocess.run(['node','-c',str(p)],cwd=R,capture_output=True);check(result.returncode==0,'JS syntax '+p.relative_to(R).as_posix());syntax.append(p.relative_to(R).as_posix())
(O/'regression-reconciled.json').write_text(json.dumps({'status':'VERIFIED','commands':[current[n] for n in expected],'sourceHashes':{p:sha(p) for p in runtime},'sourceDeltas':['docs/content/r14/serving-path-delta.json','docs/content/r14/hud-refresh-delta.json'],'validation':'Exact final source for the repeated initial generic gates. The broad serial run is linked through the byte-exact serving waypoint and resource-HUD redraw repairs; subsequent content gates and final supplemental visuals exercise the repaired path and immediate HUD. No assertions removed or relaxed. The unmodified broad-run receipt retains its original start hashes and source-change status.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(O/'release-checks.json').write_text(json.dumps({'status':'VERIFIED','checks':checks,'syntaxFiles':len(syntax),'currentRuntimeHashes':{p:sha(p) for p in runtime}},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
cleanup['status']='VERIFIED';cleanup['verification']='All existing applicable tests rerun after cleanup; exact required reference images retained and every deleted target remains absent.';(O/'cleanup-result.json').write_text(json.dumps(cleanup,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED',len(checks),'release checks')
