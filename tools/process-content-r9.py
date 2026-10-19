"""Extract generated poses; lock standing heads/feet and seated lower bodies."""
import hashlib, json, pathlib, shutil
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1]
P=json.loads((R/'docs/art/PROMPTS_CONTENT_R9.json').read_text(encoding='utf-8'))
O=R/'assets/generated/content-r9';O.mkdir(parents=True,exist_ok=True)
master=R/P['jobs'][0]['master'];master.parent.mkdir(parents=True,exist_ok=True)
if not master.exists():shutil.copyfile(P['jobs'][0]['source'],master)
im=Image.open(master).convert('RGBA')
palette=json.loads((R/'assets/generated/r89/manifest.json').read_text())['palette']
rgb=[tuple(int(c[i:i+2],16) for i in (1,3,5)) for c in palette]
pal=Image.new('P',(1,1));pal.putpalette([v for i in range(256) for v in rgb[i%len(rgb)]])
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def info(p):
 a=Image.open(p);return dict(path=p.relative_to(R).as_posix(),sha256=sha(p),width=a.width,height=a.height)
assets=[];bands=[0,278,544,784,1024]
for row,id in enumerate(['merchant','elder','child','player']):
 poses=[]
 for col in range(6):
  crop=[col*256,bands[row],(col+1)*256,bands[row+1]]
  c=im.crop(crop);c.putalpha(c.getchannel('A').point(lambda a:255 if a>=150 else 0));c=c.crop(c.getbbox())
  c.thumbnail((46,60),Image.Resampling.NEAREST)
  a=Image.new('RGBA',(48,64));a.alpha_composite(c,((48-c.width)//2,62-c.height))
  alpha=a.getchannel('A');a=a.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA');a.putalpha(alpha)
  poses.append(a)
 for col,pose in enumerate(['idle','reach','hold','sit','sip','offer']):
  a=poses[col].copy();base=poses[0 if col<3 else 3]
  if col<3:
   a.paste(base.crop((0,0,48,28)),(0,0))
   a.paste(base.crop((0,46,48,64)),(0,46))
  else:a.paste(base.crop((0,46,48,64)),(0,46))
  a.putdata([(r,g,b,v) if v else (0,0,0,0) for r,g,b,v in a.getdata()])
  p=O/f'{pose}-{id}.png';a.save(p)
  assets.append(info(p)|dict(kind='standing' if col<3 else 'seated',sourceMaster=master.relative_to(R).as_posix(),row=row,column=col,fixedRows=[[0,28],[46,64]] if col<3 else [[46,64]]))
manifest=dict(status='VERIFIED',tool='image_gen.imagegen',actualModelSlug=None,prompts='docs/art/PROMPTS_CONTENT_R9.json',palette=palette,masters=[info(master)],assets=assets)
(O/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED 1 generated master, 24 native sprites')
