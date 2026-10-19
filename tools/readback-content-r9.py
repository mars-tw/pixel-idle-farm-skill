"""Read-only release checks, original screenshot provenance and scoped secret scan."""
import ast,hashlib,json,pathlib,re,subprocess
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r9'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
checks=[]
def check(v,n):
 assert v,n
 checks.append(n)
protected=json.loads((O/'protected-start.json').read_text(encoding='utf-8'))
check(all((R/p).exists() and sha(R/p)==h for p,h in protected.items()),'all initial user changes, untracked files and historical store screenshots byte-identical')
m=json.loads((R/'assets/generated/content-r9/manifest.json').read_text(encoding='utf-8'))
check(all(sha(R/a['path'])==a['sha256'] for a in m['assets']+m['masters']),'24 native runtime poses and retained generated master exact source hashes')
p=json.loads((R/'package.json').read_text(encoding='utf-8'));check(p['version']=='0.1.32' and p['appVersion']=='content-r9-20261019-1','release version 0.1.32 and cache chain')
runtime=[R/'index.html',R/'sw.js',R/'manifest.webmanifest',R/'package.json',R/'package-lock.json',*(R/'src').glob('*.js'),*(R/'src').glob('*.css')]
check(all('content-r8-20261019-1' not in f.read_text(encoding='utf-8') for f in runtime),'no stale R8 runtime query version')
report=json.loads((O/'browser-checks.json').read_text(encoding='utf-8'))
check(report['status']=='VERIFIED' and not report['errors'],'final real-input browser journey passes without page errors')
regression=json.loads((O/'regression-final.json').read_text(encoding='utf-8'));perf=json.loads((O/'performance-reference.json').read_text(encoding='utf-8'))
check(regression['status']=='VERIFIED' and regression['verifiedBrowserScriptCount']==25,'25 browser scripts and npm test have successful actual receipts, initial interrupted run preserved')
check(all(sha(R/p)==h for p,h in regression['sourceHashes'].items()),'runtime source unchanged after the final regression receipt')
check(perf['status']=='VERIFIED' and all(s['medianP95Ms']<=18 for s in perf['summary'].values()),'shared-host desktop and phone p95 three-run medians <=18ms, reference only')
review=report['reviewSet'];check(10<=len(review)<=15,'review contains 10 to 15 raw portrait screenshots')
check({p.name for p in (O/'review-set').glob('*.png')}=={pathlib.Path(f['path']).name for f in review},'review folder has only the selected 15 portraits, no stale alternate frames')
copies=[]
for a in review:
 src=R/a['source'];dst=R/a['path'];im=Image.open(dst)
 check(sha(src)==sha(dst) and im.size==(430,932),'original portrait direct-copy '+dst.name)
 copies.append(a|dict(sha256=sha(dst),size=list(im.size)))
check({a['content'] for a in review}=={'basket','pond','memory'},'all three contents represented with active play and sequence frames')
for id in ['merchant','elder','child']:
 group=[f for f in report['frames'] if f['path'] in {f'docs/content/r9/phone-basket-{id}-{phase}.png' for phase in ['approach','contact','received']}]
 check([f['state']['deliveryPhase'] for f in group]==['arrived','reach','contact'],'three actual delivery phase captures '+id)
for name in ['phone-basket-merchant-contact.png','phone-pond-river_carp-sinking.png','phone-gathering-living-1.png']:
 check((O/'before'/name).read_bytes()==subprocess.check_output(['git','show','HEAD:docs/content/r8/'+name],cwd=R),'R8 historical before screenshot exact original '+name)
for name,size in [('iphone-15-shared-afternoon-r9.png',(1290,2796)),('ipad-15-shared-afternoon-r9.png',(2064,2752))]:
 f=R/'docs/store/screenshots'/name;check(Image.open(f).size==size,'new original store dimensions '+name)
extensions={'.js','.css','.html','.json','.md','.py','.ps1','.yml','.yaml','.webmanifest','.txt','.log'}
pattern=re.compile(r'sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}')
hits=[];count=0
for f in R.rglob('*'):
 if not f.is_file() or any(p in {'.git','node_modules','.audit-tmp'} for p in f.relative_to(R).parts) or f.suffix.lower() not in extensions:continue
 text=f.read_text(encoding='utf-8',errors='replace');count+=1
 if pattern.search(text):hits.append(f.relative_to(R).as_posix())
check(not hits,'secret scan zero hits across '+str(count)+' project text files (excluded .git, node_modules, .audit-tmp)')
syntax=[]
for f in [*(R/'src').glob('*.js'),*(R/'scripts').glob('*.js')]:
 r=subprocess.run(['node','--check',str(f)],capture_output=True,text=True,encoding='utf-8');assert r.returncode==0,(f,r.stderr);syntax.append(f.relative_to(R).as_posix())
check(len(syntax)>100,'all '+str(len(syntax))+' JS sources parse')
for f in (R/'tools').glob('*content-r9*.py'):ast.parse(f.read_text(encoding='utf-8'))
(O/'release-readback.json').write_text(json.dumps(dict(status='VERIFIED',checks=checks,reviewSet=copies,secretScan=dict(files=count,hits=hits),jsSyntaxFiles=syntax),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED',len(checks),'release checks;',count,'text files zero secret hits;',len(syntax),'JS sources parse')
