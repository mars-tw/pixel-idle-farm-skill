"""Crop generated art to native pixels; retain original RGBA and exact provenance."""
import hashlib,json,pathlib,shutil
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/generated/content-r8';OUT.mkdir(parents=True,exist_ok=True)
jobs=json.loads((ROOT/'docs/art/PROMPTS_CONTENT_R8.json').read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
masters=[];assets=[]
def entry(p,**extra):
 im=Image.open(p);return dict(path=p.relative_to(ROOT).as_posix(),sha256=sha(p),width=im.width,height=im.height,**extra)
for j in jobs['jobs']:
 p=ROOT/j['master'];p.parent.mkdir(parents=True,exist_ok=True)
 if pathlib.Path(j['source']).exists():shutil.copy2(j['source'],p)
 elif not p.exists():raise FileNotFoundError('Both original generation and retained master are missing: '+j['id'])
 masters.append(entry(p,tool=jobs['tool']))
def save(im,name,source,box=None,**extra):
 # Drop near-invisible diffuse alpha; keep opaque clustered pixels and true alpha.
 im=im.convert('RGBA');px=im.load()
 for y in range(im.height):
  for x in range(im.width):
   r,g,b,a=px[x,y];px[x,y]=(r,g,b,255) if a>=70 else (0,0,0,0)
 p=OUT/name;im.save(p);assets.append(entry(p,source=source.relative_to(ROOT).as_posix(),sourceSha256=sha(source),crop=box,**extra))
fish=ROOT/jobs['jobs'][0]['master'];im=Image.open(fish)
for row,id in enumerate(['river_carp','silver_dace','river_perch']):
 for col in range(4):
  box=[col*384,round(row*1024/3),(col+1)*384,round((row+1)*1024/3)]
  part=im.crop(box).resize((128,112),Image.Resampling.NEAREST)
  save(part,f'{id}-{col}.png',fish,box,kind='fish-portrait' if col==3 else 'water-frame')
token=ROOT/jobs['jobs'][1]['master'];im=Image.open(token)
for col,id in enumerate(['merchant','elder','child']):
 box=[col*724,0,(col+1)*724,724]
 save(im.crop(box).resize((64,64),Image.Resampling.NEAREST),f'token-{id}.png',token,box,kind='keepsake')
for id in ['merchant','elder','child']:
 idle=ROOT/f'assets/generated/content-r7/sit-{id}.png';eat=ROOT/f'assets/generated/content-r7/eat-{id}.png'
 a=Image.open(idle).convert('RGBA');b=Image.open(eat).convert('RGBA')
 b.paste(a.crop((0,42,48,64)),(0,42))
 p=OUT/f'gesture-{id}.png';b.save(p)
 assets.append(entry(p,source=eat.relative_to(ROOT).as_posix(),sourceSha256=sha(eat),fixedLowerBodySource=idle.relative_to(ROOT).as_posix(),fixedLowerBodySha256=sha(idle),fixedRows=[42,64],kind='articulated-pose-derivative'))
manifest=dict(round='content-r8',tool=jobs['tool'],actualModelSlug=None,prompts='docs/art/PROMPTS_CONTENT_R8.json',palette=json.loads((ROOT/'assets/generated/r89/manifest.json').read_text(encoding='utf-8'))['palette'],masters=masters,assets=assets,generatedOutputs=15,retainedDerivatives=3)
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED',len(masters),'masters',len(assets),'runtime assets')
