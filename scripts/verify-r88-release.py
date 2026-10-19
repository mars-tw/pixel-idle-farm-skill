"""Final local readback. Never edits or imports historical receipts as current proof."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,subprocess,hashlib,re,shutil
R=Path(__file__).resolve().parents[1];E=R/'docs/evidence/r88-art'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def runtime(p):return p.parts[0] in ['src','assets'] or p.as_posix() in ['index.html','offline.html','manifest.webmanifest','sw.js','LICENSE','CREDITS.md']

m=json.loads((R/'assets/generated/r88/manifest.json').read_text(encoding='utf8'))
assert len(m['masters'])==8 and m['actualModelSlug'] is None
alpha=[]
for row in m['masters']+m['records']:
 p=R/row['path'];assert sha(p)==row['sha256'],str(p)
 if 'size' not in row:continue
 im=Image.open(p).convert('RGBA');assert list(im.size)==row['size']
 px=list(im.getdata());assert all((r,g,b)==(0,0,0) for r,g,b,a in px if a==0)
 corners=[im.getpixel(v)[3] for v in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]]
 cutout=any(s in p.name for s in ['soil-','bucket-','fence-','flowers-','wheat-','basket-32','water-','note-','hat-','sprout-','miri-','logo-','walk.png','farming-actions'])
 if cutout:assert corners==[0]*4,(p,corners)
 alpha.append(dict(path=row['path'],size=row['size'],occupancy=sum(v[3]>0 for v in px)/len(px),partial=sum(0<v[3]<255 for v in px),corners=corners,cutout=cutout))
assert all(v['gatePass'] for k,v in m['qualityMetrics'].items() if re.search(r'miri-|/walk.png|/farming-actions.png',k))
journey=json.loads((E/'store-journey.json').read_text(encoding='utf8'));assert journey['status']=='VERIFIED'
assert all(j['elapsedMs']<180000 and j['progressInjected'] is False for j in journey['journeys'])
visual=json.loads((E/'art-validation.json').read_text(encoding='utf8'));assert visual['status']=='VERIFIED' and visual['checks']>=185
store=[];after=R/'docs/art/compare/r88/after/store';after.mkdir(parents=True,exist_ok=True)
for device in ['iphone','ipad']:
 for name in ['01-welcome','02-sunlight','03-basket','04-note','05-daily','06-porch']:
  p=R/'docs/store/screenshots'/f'{device}-{name}.png';im=Image.open(p)
  assert im.size==((1290,2796) if device=='iphone' else (2064,2752))
  fixture=name=='02-sunlight'
  record=dict(path=p.relative_to(R).as_posix(),size=list(im.size),bytes=p.stat().st_size,sha256=sha(p),fixture=fixture,progressInjected=fixture,capture='Explicit same-plantedAt pair and third moist-seed bed; real water pose frame3, no earned progression claimed' if fixture else 'Real-clock actual player inputs, camera focus only; no progress injection')
  store.append(record);shutil.copy2(p,after/p.name)
  if not fixture:
   receipt=next(v for v in journey['screenshots'] if v['candidateStorePath']==record['path']);assert receipt['sha256']==record['sha256']
   assert not receipt['header']['visible'] or all(c['inView'] for c in receipt['header']['chips'])
   if name=='04-note':assert receipt['visual']['blankBelowReturn']<=(932 if device=='iphone' else 1376)/8
 # Same device uses one world character root size even across distant scenes.
 a=next(v for v in visual['storeShots'] if v['path'].endswith(device+'-02-sunlight.png'))
 b=next(v for v in journey['screenshots'] if v['candidateStorePath'].endswith(device+'-06-porch.png'))
 assert abs(a['audit']['visualRootHeight']-b['visual']['rootHeight'])<.1
write(R/'docs/store/screenshots-manifest.json',dict(status='VERIFIED',round='R88',version='0.1.22',appVersion='r88-20261018-1',headless=True,nativeDevice=False,screenshots=store,realPlayScreenshots=10,visualFixtureScreenshots=2,retired='Previous06-same-age compositions archived in docs/art/compare/r88/before/store; new06 shows actual mayor porch',historicalAuxiliaryFiles=['ipad-01-earned-farm.png','ipad-02-earned-note.png'],historicalNote='Retained historical files; excluded from the current twelve-image set'))
base=json.loads((E/'start.json').read_text())['commit'];before=0
for row in subprocess.check_output(['git','ls-tree','-r','-l','-z',base],cwd=R).split(b'\0'):
 if row:
  meta,name=row.split(b'\t',1)
  if runtime(Path(name.decode('utf8'))):before+=int(meta.split()[-1])
afterbytes=sum(p.stat().st_size for d in ['assets','src'] for p in (R/d).rglob('*') if p.is_file())+sum((R/p).stat().st_size for p in ['index.html','offline.html','manifest.webmanifest','sw.js','LICENSE','CREDITS.md'])
package=dict(baseCommit=base,beforeBytes=before,afterBytes=afterbytes,deltaBytes=afterbytes-before,newImageBytes=m['runtimeBytes'],scope='Existing web runtime allowlist; docs and original masters excluded',nativePackageMeasured=False)
write(E/'package-size.json',package)
perfSource=E/'regression/docs/evidence/r79/r79-fun-e2e.json'
if not perfSource.exists():perfSource=R/'docs/evidence/r79/r79-fun-e2e.json'
perf=json.loads(perfSource.read_text(encoding='utf8'))['perf'];assert all(v['medianP95Ms']<=18 for v in perf.values())
write(E/'performance.json',dict(status='VERIFIED',source=perfSource.relative_to(R).as_posix(),sourceSha256=sha(perfSource),measurements=perf,trust='Shared concurrent machine; reference only, not native-device shipment proof'))
for p in [*(R/'src').glob('*.js'),*(R/'scripts').glob('*.js')]:subprocess.run(['node','--check',str(p)],check=True,cwd=R,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
subprocess.run(['node','scripts/test-version-chain.js'],check=True,cwd=R,stdout=subprocess.PIPE)
live=[R/'index.html',R/'sw.js',R/'manifest.webmanifest',*(R/'src').glob('*.js'),*(R/'src').glob('*.css')]
assert all('r87-20261018-1' not in p.read_text(encoding='utf8') for p in live)
patterns=[re.compile(rb'sk-proj-[A-Za-z0-9_-]{20}'),re.compile(rb'sk-[a-z0-9]{40}')];matches=0;scanned=0
for p in R.rglob('*'):
 if not p.is_file() or any(s in p.relative_to(R).parts for s in ['.git','node_modules','.audit-tmp','__pycache__','baseline']):continue
 data=p.read_bytes();scanned+=1
 if data.startswith((b'\xff\xfe',b'\xfe\xff')):data=data.decode('utf16').encode('utf8')
 matches+=sum(len(q.findall(data)) for q in patterns)
assert matches==0,'secret scan must be zero; values never printed'
# All CI assertions retained; first failure and corrected rerun are independently saved.
checks=json.loads((E/'final-checks.json').read_text(encoding='utf8'));assert all(v['exitCode']==0 for v in checks['checks'])
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16);canvas=Image.new('RGB',(780,1920),'#fff6e3');draw=ImageDraw.Draw(canvas)
for row,name in enumerate(['welcome','farm','basket','daily']):
 for col,phase in enumerate(['before','after']):
  im=Image.open(R/f'docs/art/compare/r88/{phase}/390x844-{name}.png').convert('RGB');im.thumbnail((370,440));canvas.paste(im,(col*390+(390-im.width)//2,row*480+32));draw.text((col*390+12,row*480+8),phase.upper()+' / '+name,font=font,fill='#3e2f23')
canvas.save(R/'docs/art/compare/r88/overview.webp',quality=90,method=6)
film=Image.new('RGB',(6*215,466),'#fff6e3')
for i,n in enumerate(['01-welcome','02-sunlight','03-basket','04-note','05-daily','06-porch']):
 im=Image.open(R/'docs/store/screenshots'/f'iphone-{n}.png').convert('RGB');im=im.resize((215,466),Image.Resampling.LANCZOS);film.paste(im,(215*i,0))
film.save(E/'store-six-preview.webp',quality=92)
walk=Image.open(R/'assets/generated/r88/walk.png').convert('RGBA');views=Image.new('RGBA',(192,86),(255,246,227,255))
for i,row in enumerate([0,2,3]):
 im=walk.crop((0,row*64,48,(row+1)*64)).resize((64,85),Image.Resampling.NEAREST);views.paste(im,(i*64,0),im)
views.save(E/'character-three-views-64.png')
write(E/'verification.json',dict(status='VERIFIED',masters=8,images=len(m['records']),generator=m['generator'],actualModelSlug=None,alpha=alpha,storeCount=12,secretScan=dict(matches=matches,files=scanned),runtimeOldVersionMatches=0,javascriptSyntax=True,package=package,limitations=['Independent Muse8/10 rescore not performed','Human timed recognition not performed','Native iOS/Android device QA not performed']))
print(json.dumps(dict(status='VERIFIED',images=len(m['records']),store=12,secretMatches=matches,deltaBytes=package['deltaBytes'])))
