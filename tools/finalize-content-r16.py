"""Native evidence selection and scoped readback. No publishing or inference."""
from pathlib import Path
from PIL import Image
import json,hashlib,shutil,subprocess,re,datetime
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r16';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
names=[('basket','phone-basket-farmhouse-behind.png'),('basket','phone-basket-merchant-far.png'),('basket','phone-basket-merchant-mid.png'),('basket','phone-basket-merchant-near.png'),('basket','phone-basket-elder-received.png'),('pond','phone-pond-river_carp-active.png'),('pond','phone-pond-river_carp-reveal.png'),('pond','phone-pond-perfect-correct.png'),('pond','phone-pond-silver_dace-active.png'),('pond','phone-pond-river_perch-active.png'),('memory','phone-memory-table-unselected.png'),('memory','phone-memory-table-selected.png'),('memory','phone-memory-child-mid.png'),('memory','phone-memory-child-received.png'),('memory','phone-memory-invite-reply.png')]
review=O/'review-set';review.mkdir(exist_ok=True);rows=[]
previous=O/'review-set-manifest.json'
if previous.is_file():
 desired={f'{i:02d}-'+name for i,(_,name) in enumerate(names,1)}
 protected=json.loads((R/'.audit-tmp/content-r16-execution/protected.json').read_text(encoding='utf8'))['protected']
 for row in json.loads(previous.read_text(encoding='utf8'))['frames']:
  p=(R/row['path']).resolve()
  if p.parent==review.resolve() and p.name not in desired and p.is_file():
   assert row['path'] not in protected and sha(p)==row['sha256'];p.unlink()
for i,(kind,name) in enumerate(names,1):
 p=O/name;dest=review/(f'{i:02d}-'+name);im=Image.open(p);assert im.size==(430,932),(name,im.size);shutil.copyfile(p,dest)
 rows.append({'content':kind,'source':p.relative_to(R).as_posix(),'path':dest.relative_to(R).as_posix(),'sha256':sha(p),'width':430,'height':932})
assert len(list(review.glob('*.png')))==15
write(O/'review-set-manifest.json',{'status':'VERIFIED','count':15,'policy':'Five per content. Original device bytes only; no rescaling, contact sheets or annotations. Full acceptance images remain one level above.','frames':rows})
def blank_squares(p):
 # Pure white and uniform pale cream panels >20x20 in the scene, excluding the
 # intentional carry HUD (top 74) and touch controls (below 750). Catches old seed panels.
 im=Image.open(p).convert('RGB');w,h=im.size;pixels=im.load();heights=[0]*w;found=[]
 for y in range(74,min(750,h)):
  run=0;last=None
  for x in range(w):
   c=pixels[x,y];qual=min(c)>=210 and max(c)-min(c)<50
   heights[x]=heights[x]+1 if qual else 0
   if heights[x]>20:run+=1
   else:run=1 if heights[x]>20 else 0
   last=c
   if run>20 and all(hi-lo<=6 for lo,hi in im.crop((x-20,y-20,x+1,y+1)).getextrema()):found.append([x-20,y-20,list(c)]);return found
 return found
positive=R/'docs/content/r15/review-set/03-phone-basket-merchant-distance-1.png'
assert positive.is_file() and blank_squares(positive),'known R15 seed-panel defect must be detected'
white=[]
for id in ['merchant','elder','child']:
 for phase in ['far','mid','near']:
  p=O/f'phone-basket-{id}-{phase}.png';hits=blank_squares(p);white.append({'path':p.relative_to(R).as_posix(),'uniformPaleSquaresOver20px':hits});assert not hits,(p,hits)
write(O/'scene-blank-guard.json',{'status':'VERIFIED','scope':'Nine actual distant/middle/near delivery world images; intentional carry status HUD and touch controls excluded. Pale or white rectangles larger than 20x20, <=6 RGB channel variation to include the R15 blank paper texture.','positiveControl':{'path':positive.relative_to(R).as_posix(),'sha256':sha(positive),'detected':blank_squares(positive)},'images':white,'hits':sum(len(x['uniformPaleSquaresOver20px']) for x in white)})
for device,size in [('iphone',(1290,2796)),('ipad',(2064,2752))]:assert Image.open(R/f'docs/store/screenshots/{device}-21-shared-invitation-r16.png').size==size
protected=json.loads((R/'.audit-tmp/content-r16-execution/protected.json').read_text(encoding='utf8'))['protected'];changed=[p for p,h in protected.items() if not (R/p).is_file() or sha(R/p)!=h];assert not changed,changed
runtime=['index.html','sw.js','manifest.webmanifest','package.json','package-lock.json']+[p.relative_to(R).as_posix() for p in (R/'src').glob('*') if p.suffix in ['.js','.css']]
assert not any('content-r15-20261019-1' in (R/p).read_text(encoding='utf8') for p in runtime)
scan=subprocess.run(['rg','--files-with-matches','-I','--hidden','-e',r'sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}','--glob','!.git/**','--glob','!node_modules/**','--glob','!.audit-tmp/**','.'],cwd=R,capture_output=True);assert scan.returncode==1,'secret scan hit or error; values never printed'
syntax=[]
for folder in ['src','scripts']:
 for p in (R/folder).glob('*.js'):
  r=subprocess.run(['node','-c',str(p)],capture_output=True);assert r.returncode==0,p;syntax.append(p.relative_to(R).as_posix())
write(O/'artifact-audit.json',{'status':'VERIFIED','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'protectedFiles':len(protected),'protectedUnchanged':True,'secretScan':{'matches':0,'scope':'repo except .git,node_modules,.audit-tmp; no credential directory read'},'syntaxChecks':len(syntax),'sources':{p:sha(R/p) for p in runtime},'version':json.loads((R/'package.json').read_text(encoding='utf8'))['version'],'reviewFrames':len(rows),'sceneBlankHits':0})
print('VERIFIED 15 native review frames, zero blank blocks/secrets, protected files unchanged, syntax',len(syntax))
