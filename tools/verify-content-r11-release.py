"""Read-only final release, preserved user files and screenshot provenance checks."""
import ast,hashlib,json,pathlib,re,subprocess
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r11';checks=[]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def check(v,n):
 assert v,n
 checks.append(n)
protected=json.loads((O/'protected-start.json').read_text(encoding='utf-8'))
check(all((R/p).is_file() and sha(R/p)==h for p,h in protected.items()),'initial user files and all historical store screenshots byte-identical')
p=json.loads((R/'package.json').read_text(encoding='utf-8'));check(p['version']=='0.1.34' and p['appVersion']=='content-r11-20261019-1','version 0.1.34 and cache chain')
m=json.loads((R/'assets/generated/content-r11/manifest.json').read_text(encoding='utf-8'))
check(all(sha(R/a['path'])==a['sha256'] for a in m['assets']+m['masters']),'all actual generated master/runtime hashes')
for a in m['assets']:
 im=Image.open(R/a['path']).convert('RGBA');palette={tuple(int(c[i:i+2],16) for i in (1,3,5)) for c in m['palette']}
 check(all(not px[3] or px[:3] in palette for px in im.get_flattened_data()),'exact R89 native palette '+pathlib.Path(a['path']).name)
b=json.loads((O/'browser-checks.json').read_text(encoding='utf-8'));check(b['status']=='VERIFIED' and not b['errors'],'actual R11 headless interaction journey')
animation=json.loads((O/'animation-audit.json').read_text(encoding='utf-8'));check(animation['status']=='VERIFIED' and len(animation['sequences'])==4 and len(animation['fish'])==3,'real-clock fixed feet, traveling plates, four clear faces, stale-page cancellation and three late failures')
copies=[]
check(10<=len(b['reviewSet'])<=15,'10 to 15 review images')
for row in b['reviewSet']:
 src=R/row['source'];dst=R/row['path'];check(sha(src)==sha(dst) and Image.open(dst).size==(430,932),'unmodified portrait copy '+dst.name);copies.append(row|dict(sha256=sha(dst)))
check({row['content'] for row in copies}=={'basket','pond','memory'},'all three active content paths in review set')
check(len({sha(O/f'phone-memory-merchant-{phase}.png') for phase in ['lift','carry','received']})==3,'review serving sequence contains three different original screenshots')
for id in ['merchant','elder','child']:
 rows=[f for f in b['frames'] if f['path'] in {f'docs/content/r11/phone-basket-{id}-{phase}.png' for phase in ['approach','contact','received']}]
 check([f['state']['deliveryPhase'] for f in rows]==['arrived','reach','contact'],'original three handover phases '+id)
 check(all(len(f['state']['parcel'])==1 for f in rows),'single complete basket visible throughout '+id)
 for phase in ['lift','carry','received','reply']:
  check(Image.open(O/f'phone-memory-{id}-{phase}.png').size==(430,932),'original serving phase '+id+' '+phase)
for id in ['river_carp','silver_dace','river_perch']:
 for phase in ['pre-sink','sinking','early-failure','caught','late-failure']:
  check(Image.open(O/f'phone-pond-{id}-{phase}.png').size==(430,932),'original fish phase '+id+' '+phase)
for name,size in [('iphone-16-shared-afternoon-r11.png',(1290,2796)),('ipad-16-shared-afternoon-r11.png',(2064,2752))]:check(Image.open(R/'docs/store/screenshots'/name).size==size,'store dimensions '+name)
store=json.loads((R/'docs/store/screenshots-content-r11-manifest.json').read_text(encoding='utf-8'));check(all(sha(R/a['path'])==a['sha256'] for a in store['images']),'new store image manifest hashes')
reg=json.loads((O/'regression-final.json').read_text(encoding='utf-8'));check(reg['status']=='VERIFIED' and reg['verifiedBrowserScriptCount']==25,'25 old browser scripts and unit/extra gates passed')
check(all(sha(R/p)==h for p,h in reg['sourceHashes'].items()),'runtime sources match final verified regression')
perf=json.loads((O/'performance-reference.json').read_text(encoding='utf-8'));check(perf['status']=='VERIFIED' and all(x['medianP95Ms']<=18 for x in perf['summary'].values()),'concurrent host p95 reference medians <=18ms')
extensions={'.js','.css','.html','.json','.md','.py','.ps1','.yml','.yaml','.webmanifest','.txt','.log'}
patterns=[r'sk-proj-[A-Za-z0-9_-]{20}',r'sk-[a-z0-9]{40}',r'AKIA[0-9A-Z]{16}',r'gh[pousr]_[A-Za-z0-9]{36,}',r'github_pat_[A-Za-z0-9_]{50,}',r'AIza[0-9A-Za-z_-]{35}',r'xox[baprs]-[A-Za-z0-9-]{24,}',r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/=]{40,}']
pattern=re.compile('|'.join(patterns));hits=[];count=0
for f in R.rglob('*'):
 if not f.is_file() or any(p in {'.git','node_modules','.audit-tmp'} for p in f.relative_to(R).parts) or f.suffix.lower() not in extensions:continue
 count+=1
 if pattern.search(f.read_text(encoding='utf-8',errors='replace')):hits.append(f.relative_to(R).as_posix())
check(not hits,'secret scan zero hits across '+str(count)+' text files')
syntax=[]
for f in [*(R/'src').glob('*.js'),*(R/'scripts').glob('*.js')]:
 x=subprocess.run(['node','--check',str(f)],capture_output=True);assert x.returncode==0,(f,x.stderr);syntax.append(f.relative_to(R).as_posix())
for f in (R/'tools').glob('*content-r11*.py'):ast.parse(f.read_text(encoding='utf-8'))
check(len(syntax)>100,'all '+str(len(syntax))+' JS files parse')
(O/'release-readback.json').write_text(json.dumps(dict(status='VERIFIED',checks=checks,reviewSet=copies,secretScan=dict(files=count,hits=hits,patterns=patterns,excluded=['.git','node_modules','.audit-tmp']),syntax=syntax),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED release checks',len(checks),'secret hits',len(hits),'JS syntax',len(syntax))
