"""Local release readback: original-size evidence, real receipts, source and user bytes."""
import pathlib,json,hashlib,re,subprocess
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r12';rows=[]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def check(v,n):
 assert v,n
 rows.append(n)
def read(p):return json.loads((R/p).read_text(encoding='utf-8'))
report=read('docs/content/r12/browser-checks.json');audit=read('docs/content/r12/animation-audit.json')
check(report['status']=='VERIFIED' and not report['errors'],'R12 real-clock UI play, complete, reload, offline and layouts')
check(audit['status']=='VERIFIED','R12 independent deterministic animation/impact/late/unlock audit')
for id in ['merchant','elder','child']:
 for state in ['approach','contact','received']:
  check(Image.open(O/f'phone-basket-{id}-{state}.png').size==(430,932),f'{id} basket {state} original size')
 for state in ['lift','carry','received','reply']:
  check(Image.open(O/f'phone-memory-{id}-{state}.png').size==(430,932),f'{id} serving {state} original size')
for id in ['river_carp','silver_dace','river_perch']:
 for state in ['pre-sink','sinking','early-failure','late-failure','caught','note-reloaded']:
  check(Image.open(O/f'phone-pond-{id}-{state}.png').size==(430,932),f'{id} fish {state} original size')
review=[]
check(len(list((O/'review-set').glob('*.png')))==15,'exactly 15 portrait PNG review frames')
for r in report['reviewSet']:
 p=R/r['path'];s=R/r['source'];check(Image.open(p).size==(430,932) and sha(p)==sha(s),'review original bytes '+p.name);review.append(dict(**r,sha256=sha(p)))
pond_counts=[]
for row in [r for r in report['reviewSet'] if r['content']=='pond']:
 frame=[f for f in report['frames'] if f['path']==row['source']][-1]
 check(frame.get('sha256')==sha(R/row['source']),'pond capture receipt bound to original PNG '+row['source'])
 pond_counts.append(sum(frame['state']['catch'].values()))
check(pond_counts==[0,0,1,1,2,2],'review pond order is one continuous save, with no backwards catch or note progression')
store=[]
for device,size in [('iphone',(1290,2796)),('ipad',(2064,2752))]:
 path=f'docs/store/screenshots/{device}-17-shared-afternoon-r12.png';check(Image.open(R/path).size==size,device+' real store screenshot size');store.append(dict(path=path,width=size[0],height=size[1],sha256=sha(R/path),source='Real headless UI serving reply, DPR3 iPhone / DPR2 iPad, no resize or compositing'))
(R/'docs/store/screenshots-content-r12-manifest.json').write_text(json.dumps(dict(status='VERIFIED',screenshots=store),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
m=read('assets/generated/content-r12/manifest.json');check(m['tool']=='image_gen.imagegen' and len(m['assets'])==12 and len(m['masters'])==2,'actual generation tool and complete asset inventory')
for a in m['assets']+m['masters']:check(sha(R/a['path'])==a['sha256'],'generated source hash '+a['path'])
base=Image.open(R/'assets/generated/content-r9/sit-player.png').convert('RGBA').crop((0,46,48,64)).tobytes()
for pose in ['lift','push','rest']:check(Image.open(R/f'assets/generated/content-r12/serve-{pose}.png').convert('RGBA').crop((0,46,48,64)).tobytes()==base,'fixed lower 18 native rows '+pose)
bobber=Image.open(R/'assets/generated/content-r1/bobber.png').convert('RGBA').crop((0,0,32,32)).getbbox();check((bobber[2]-bobber[0])*1.5>=16,'half-submerged visible float pixels >=16px at 430, beyond CSS box size')
protected=read('docs/content/r12/protected-start.json')
for p,h in protected['dirty'].items():check((R/p).is_file() and sha(R/p)==h,'preserved initial user bytes '+p)
for p,h in protected['tracked'].items():
 if p.startswith('docs/store/screenshots/'):check(sha(R/p)==h,'preserved previous store image '+p)
regressions=sorted(O.glob('regression-*.json'));current=None
for p in regressions:
 x=json.loads(p.read_text(encoding='utf-8'))
 if x.get('status')=='VERIFIED' and len(x.get('commands',[]))>=30 and all(sha(R/f)==h for f,h in x['sourceHashes'].items()):current=(p,x)
check(current is not None,'all 30 current-source regression commands succeeded')
for command in current[1]['commands']:check(command['exitCode']==0 and sha(R/command['log'])==command['sha256'],'successful unchanged log '+str(command['command']))
perf=read('docs/content/r12/performance-reference.json');check(perf['status']=='VERIFIED' and all(s['medianP95Ms']<=18 for s in perf['summary'].values()),'shared-host reference p95 median <=18ms, all four scenes/viewports')
syntax=[]
for p in list((R/'src').glob('*.js'))+list((R/'scripts').glob('*.js')):
 r=subprocess.run(['node','--check',str(p)],cwd=R,capture_output=True);assert r.returncode==0,str(p);syntax.append(p.relative_to(R).as_posix())
files=subprocess.check_output(['git','ls-files','-co','--exclude-standard','-z'],cwd=R).decode('utf-8').split('\0');hits=[]
for f in set(files):
 p=R/f
 if not f or not p.is_file() or f.startswith(('.audit-tmp/','node_modules/','.git/')):continue
 if p.suffix.lower() not in {'.js','.json','.md','.html','.css','.py','.yml','.yaml','.txt','.log','.webmanifest'}:continue
 if re.search(rb'sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}',p.read_bytes()):hits.append(f)
check(not hits,'secret scan zero hits; secrets directory never read')
pkg=read('package.json');check(pkg['version']=='0.1.35' and pkg['appVersion']=='content-r12-20261019-1','version bump')
runtime=['index.html','sw.js','manifest.webmanifest','package.json','package-lock.json']+[p.relative_to(R).as_posix() for p in (R/'src').iterdir() if p.suffix in {'.js','.css'}]
check(all(b'content-r11-20261019-1' not in (R/p).read_bytes() and b'0.1.34' not in (R/p).read_bytes() for p in runtime),'old runtime and package version strings are absent')
result=dict(status='VERIFIED',version=pkg['version'],appVersion=pkg['appVersion'],checks=rows,reviewSet=review,regression=current[0].relative_to(R).as_posix(),syntax=syntax,secretHits=0,sourceHashes={p:sha(R/p) for p in runtime},performance=perf['summary'],boundaries=['Physical devices, parent-child play, clean-host performance and Muse >=8 remain BLOCKED pending external verification.'])
(O/'release-readback.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED',len(rows),'readbacks;',len(syntax),'JS syntax; 15 original review frames; zero secret hits')
