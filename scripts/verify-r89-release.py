"""Current readback, source masks, original-size store images, byte counts and secret scan."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,subprocess,re,shutil
R=Path(__file__).resolve().parents[1];E=R/'docs/evidence/r89-art';A=R/'assets/generated/r89'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
m=json.loads((A/'manifest.json').read_text(encoding='utf8'));assert len(m['masters'])==9 and m['actualModelSlug'] is None
for v in m['masters']+m['records']:assert sha(R/v['path'])==v['sha256'],v['path']
alpha=[]
for v in m['records']:
 p=R/v['path'];im=Image.open(p).convert('RGBA');assert list(im.size)==v['size'];px=list(im.getdata());assert all((r,g,b)==(0,0,0) for r,g,b,a in px if a==0)
 cutout=p.suffix=='.png' and not any(s in p.name for s in ['app-icon','paper','binding','light','sunshaft','shadow'])
 corners=[im.getpixel(c)[3] for c in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]]
 if cutout:assert corners==[0]*4,(p,corners)
 alpha.append(dict(path=v['path'],size=v['size'],occupancy=sum(a>0 for r,g,b,a in px)/len(px),corners=corners,cutout=cutout))
assert all(v['gatePass'] for v in m['qualityMetrics'].values()) and all(v['identicalAlphaToR88'] and v['lowerLegsUnchanged'] for v in m['actorReceipts'])
# The built-in tool supplies actual alpha: preserve it, also export mask/opaque/RGBA audit derivatives.
post=[];P=R/'docs/art/masters/r89/postprocess';P.mkdir(parents=True,exist_ok=True)
for row in m['masters']:
 p=R/row['path'];im=Image.open(p).convert('RGBA')
 if im.getchannel('A').getextrema()[0]!=0:continue
 im.paste((0,0,0,0),mask=im.getchannel('A').point(lambda a:255 if a==0 else 0))
 destinations=[(P/(p.stem+'-alpha-mask.png'),im.getchannel('A')),(P/(p.stem+'-rgba-master.png'),im)]
 opaque=Image.new('RGBA',im.size,'#fff6e3');opaque.alpha_composite(im);destinations.append((P/(p.stem+'-opaque-master.webp'),opaque.convert('RGB')))
 for dest,img in destinations:
  if dest.suffix=='.webp':img.save(dest,lossless=True,method=6)
  else:img.save(dest,optimize=True)
  post.append(dict(path=dest.relative_to(R).as_posix(),sha256=sha(dest),bytes=dest.stat().st_size))
m['postprocessArtifacts']=post;write(A/'manifest.json',m)
checks=json.loads((E/'final-checks.json').read_text(encoding='utf8'));assert checks['status']=='VERIFIED' and all(v['exitCode']==0 for v in checks['checks'])
art=json.loads((E/'art-validation.json').read_text(encoding='utf8'));assert art['status']=='VERIFIED' and art['checks']>=120
journey=json.loads((E/'store-journey.json').read_text(encoding='utf8'));assert journey['status']=='VERIFIED' and all(v['elapsedMs']<180000 and not v['progressInjected'] for v in journey['journeys'])
names=['01-welcome','02-sunlight','03-harvest','04-basket','05-note','06-daily'];store=[];after=R/'docs/art/compare/r89/after/store';after.mkdir(parents=True,exist_ok=True)
for device in ['iphone','ipad']:
 for name in names:
  p=R/'docs/store/screenshots'/f'{device}-{name}.png';im=Image.open(p);assert im.size==((1290,2796) if device=='iphone' else (2064,2752));fixture=name=='02-sunlight'
  if not fixture:
   record=next(v for v in journey['screenshots'] if v['candidateStorePath']==p.relative_to(R).as_posix());assert record['sha256']==sha(p)
  store.append(dict(path=p.relative_to(R).as_posix(),size=list(im.size),sha256=sha(p),bytes=p.stat().st_size,fixture=fixture,capture='Exact same-age visual QA fixture, real water frame3 without callback; no earned progress claimed' if fixture else 'Continuous real-clock input journey; no progress/clock injection'));shutil.copy2(p,after/p.name)
 # Every figure/number is from the same journey, with a clearly disclosed same-time image02 substitution.
 trace=[v for v in journey['screenshots'] if v['candidateStorePath'].split('/')[-1].startswith(device+'-')]
 welcome=next(v['visual'] for v in trace if v['candidateStorePath'].endswith('01-welcome.png'));harvest=next(v['visual'] for v in trace if v['candidateStorePath'].endswith('03-harvest.png'));basket=next(v['visual'] for v in trace if v['candidateStorePath'].endswith('04-basket.png'));note=next(v['visual'] for v in trace if v['candidateStorePath'].endswith('05-note.png'))
 assert welcome['coins']>=harvest['coins'] and basket['storage']['wheat']-note['storage']['wheat']==2
 assert note['delivered'] and not basket['delivered']
for device in ['iphone','ipad']:
 p=R/'docs/store/screenshots'/f'{device}-detail-porch.png';im=Image.open(p);assert im.size==((1290,2796) if device=='iphone' else (2064,2752));receipt=next(v for v in journey['screenshots'] if v['candidateStorePath']==p.relative_to(R).as_posix());assert receipt['sha256']==sha(p) and receipt['visual']['delivered'];store.append(dict(path=p.relative_to(R).as_posix(),size=list(im.size),sha256=sha(p),bytes=p.stat().st_size,fixture=False,supplementary=True,capture='Same real journey after delivery; additional proof of full NPC silhouettes and contact shadows'));shutil.copy2(p,after/p.name)
write(R/'docs/store/screenshots-manifest.json',dict(status='VERIFIED',round='R89 / art8',version='0.1.23',appVersion='r89-20261018-1',headless=True,nativeDevice=False,order=names,screenshots=store,storyScreenshots=12,supplementaryPorchScreenshots=2,realPlayScreenshots=12,visualFixtureScreenshots=2,note='Main six-image chronology per device; two supplemental existing-porch screenshots show unobstructed NPCs. Prior names and additional historical screenshots excluded; originals archived in compare/r89/before/store.'))
# Retire only individually named tracked predecessors, after proving the original archive equals git HEAD at start.
base=json.loads((E/'start.json').read_text(encoding='utf8'))['commit'];retired=[]
for device in ['iphone','ipad']:
 for name in ['03-basket','04-note','05-daily','06-porch', 'porch-detail']:
  p=R/'docs/store/screenshots'/f'{device}-{name}.png'
  if not p.exists():continue
  rel=p.relative_to(R).as_posix();tracked=subprocess.run(['git','ls-files','--error-unmatch','--',rel],cwd=R,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
  if not tracked:continue
  saved=R/'docs/art/compare/r89/before/store'/p.name;original=subprocess.check_output(['git','show',f'{base}:{rel}'],cwd=R);assert saved.is_file() and sha(saved)==hashlib.sha256(original).hexdigest();assert p.resolve().parent==(R/'docs/store/screenshots').resolve();p.unlink();retired.append(rel)
write(E/'retired-store-files.json',dict(status='VERIFIED',trackedOnly=True,originalsPreserved=True,paths=retired))
# Additional newly generated porch captures belong to evidence, not the numbered six-image set.
for device in ['iphone','ipad']:
 p=R/'docs/store/screenshots'/f'{device}-porch-detail.png'
 if p.is_file():
  saved=E/'store-real'/p.name;assert saved.is_file() and sha(saved)==sha(p);p.unlink()
 # Historical gates may create a former sixth composition. It did not exist at start.
 p=R/'docs/store/screenshots'/f'{device}-06-same-age.png'
 if p.is_file() and not (R/'docs/art/compare/r89/before/store'/p.name).exists():
  saved=E/'regression/docs/store/screenshots'/p.name;saved.parent.mkdir(parents=True,exist_ok=True);shutil.move(str(p),str(saved))
walk=Image.open(A/'walk.png').convert('RGBA');views=Image.new('RGBA',(192,86),'#fff6e3')
for i,row in enumerate([0,2,3]):
 im=walk.crop((0,row*64,48,(row+1)*64)).resize((64,85),Image.Resampling.NEAREST);views.alpha_composite(im,(i*64,0))
views.save(E/'character-three-views-64.png')
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16);canvas=Image.new('RGB',(780,1920),'#fff6e3');draw=ImageDraw.Draw(canvas)
for row,name in enumerate(['welcome','farm','basket','daily']):
 for col,phase in enumerate(['before','after']):
  im=Image.open(R/f'docs/art/compare/r89/{phase}/390x844-{name}.png').convert('RGB');im.thumbnail((370,440));canvas.paste(im,(col*390+(390-im.width)//2,row*480+32));draw.text((col*390+12,row*480+8),phase.upper()+' / '+name,font=font,fill='#3e2f23')
canvas.save(R/'docs/art/compare/r89/overview.webp',quality=90,method=6)
film=Image.new('RGB',(6*215,466),'#fff6e3')
for i,name in enumerate(names):film.paste(Image.open(R/'docs/store/screenshots'/f'iphone-{name}.png').convert('RGB').resize((215,466),Image.Resampling.LANCZOS),(215*i,0))
film.save(E/'store-six-preview.webp',quality=92)
def runtime(p):return p.parts[0] in ['src','assets'] or p.as_posix() in ['index.html','offline.html','manifest.webmanifest','sw.js','LICENSE','CREDITS.md']
before=0
for row in subprocess.check_output(['git','ls-tree','-r','-l','-z',base],cwd=R).split(b'\0'):
 if row:
  meta,name=row.split(b'\t',1)
  if runtime(Path(name.decode('utf8'))):before+=int(meta.split()[-1])
afterbytes=sum(p.stat().st_size for d in ['assets','src'] for p in (R/d).rglob('*') if p.is_file())+sum((R/p).stat().st_size for p in ['index.html','offline.html','manifest.webmanifest','sw.js','LICENSE','CREDITS.md'])
package=dict(baseCommit=base,beforeBytes=before,afterBytes=afterbytes,deltaBytes=afterbytes-before,newImageBytes=m['runtimeBytes'],scope='Existing web runtime allowlist; original masters/evidence excluded',nativePackageMeasured=False);write(E/'package-size.json',package)
perfpath=E/'regression/docs/evidence/r79/r79-fun-e2e.json';assert perfpath.is_file();perf=json.loads(perfpath.read_text(encoding='utf8'))['perf'];assert all(v['medianP95Ms']<=18 for v in perf.values());write(E/'performance.json',dict(status='VERIFIED',measurements=perf,source=perfpath.relative_to(R).as_posix(),sourceSha256=sha(perfpath),trust='Shared concurrent host, reference only; no native device claim'))
for p in [*(R/'src').glob('*.js'),*(R/'scripts').glob('*.js')]:subprocess.run(['node','--check',str(p)],check=True,cwd=R,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
live=[R/'index.html',R/'sw.js',R/'manifest.webmanifest',*(R/'src').glob('*.js'),*(R/'src').glob('*.css')];assert all('r88-20261018-1' not in p.read_text(encoding='utf8') for p in live)
patterns=[re.compile(rb'sk-proj-[A-Za-z0-9_-]{20}'),re.compile(rb'sk-[a-z0-9]{40}')];scanned=0;matches=0
for p in R.rglob('*'):
 if not p.is_file() or any(v in p.relative_to(R).parts for v in ['.git','node_modules','.audit-tmp','__pycache__','baseline']):continue
 data=p.read_bytes();scanned+=1
 if data.startswith((b'\xff\xfe',b'\xfe\xff')):data=data.decode('utf16').encode('utf8')
 matches+=sum(len(q.findall(data)) for q in patterns)
assert matches==0,'Secret scan must be zero; values never printed'
write(E/'verification.json',dict(status='VERIFIED',masters=9,images=len(m['records']),sourceDerivatives=len(post),generator=m['generator'],actualModelSlug=None,alpha=alpha,storeCount=14,storyStoreCount=12,secretScan=dict(matches=matches,files=scanned),runtimeOldVersionMatches=0,javascriptSyntax=True,package=package,limitations=['Independent Muse8/10 rescore unperformed','Human timed recognition unperformed','Native iOS/Android hardware QA unperformed']))
print(json.dumps(dict(status='VERIFIED',masters=9,images=len(m['records']),store=14,secretMatches=matches,deltaBytes=package['deltaBytes'])))
