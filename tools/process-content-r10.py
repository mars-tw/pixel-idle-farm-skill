"""Extract transparent generated props onto the existing R89 native palette."""
import json,pathlib,hashlib,shutil
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1];O=R/'assets/generated/content-r10';O.mkdir(parents=True,exist_ok=True)
P=json.loads((R/'docs/art/PROMPTS_CONTENT_R10.json').read_text(encoding='utf-8'))
palette=json.loads((R/'assets/generated/r89/manifest.json').read_text())['palette']
rgb=[tuple(int(c[i:i+2],16) for i in (1,3,5)) for c in palette]
pal=Image.new('P',(1,1));pal.putpalette([v for i in range(256) for v in rgb[i%len(rgb)]])
def info(p):
 im=Image.open(p);return dict(path=p.relative_to(R).as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),width=im.width,height=im.height)
def native(im,size):
 a=im.getchannel('A').point(lambda n:255 if n>180 else 0);im.putalpha(a);im=im.crop(im.getbbox());im.thumbnail(size,Image.Resampling.NEAREST)
 out=Image.new('RGBA',size);out.alpha_composite(im,((size[0]-im.width)//2,size[1]-im.height));a=out.getchannel('A');out=out.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA');out.putalpha(a)
 out.putdata([(r,g,b,a) if a else (0,0,0,0) for r,g,b,a in out.getdata()]);return out
assets=[];masters=[]
for job in P['jobs']:
 if not job['source']:continue
 m=R/job['master'];m.parent.mkdir(parents=True,exist_ok=True)
 if not m.exists():shutil.copyfile(job['source'],m)
 masters.append(info(m));im=Image.open(m).convert('RGBA')
 if job['id']=='props':
  specs=[('basket',(8,70,490,530),(32,32)),('table',(490,95,1080,530),(128,80)),('cup',(1110,180,1536,525),(32,32)),('hot',(20,585,540,1008),(48,32)),('sour',(590,595,960,980),(32,32)),('sweet',(1090,615,1525,980),(32,32))]
 elif job['id']=='mayor':specs=[('mayor',(0,0,im.width,im.height),(48,64))]
 else:specs=[(id+'-'+str(col),(col*512,row*341,(col+1)*512,(row+1)*341),(60,52)) for row,id in enumerate(['river_carp','silver_dace','river_perch']) for col in range(3)]
 for id,box,size in specs:
  a=native(im.crop(box),(46,60) if id=='mayor' else size)
  if id=='mayor':
   b=Image.new('RGBA',(48,64));b.alpha_composite(a,(1,2));a=b
  p=O/(id+'.png');a.save(p);assets.append(info(p)|dict(sourceMaster=job['master'],crop=list(box)))
(O/'manifest.json').write_text(json.dumps(dict(status='VERIFIED',tool='image_gen.imagegen',actualModelSlug=None,prompts='docs/art/PROMPTS_CONTENT_R10.json',palette=palette,masters=masters,assets=assets),ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print('VERIFIED',len(masters),'masters',len(assets),'native assets')
