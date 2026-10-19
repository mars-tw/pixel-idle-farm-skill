"""Deterministic native pixel export from generated RGBA masters; never paint art."""
import json,pathlib,shutil,hashlib
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1];P=json.loads((R/'docs/art/PROMPTS_CONTENT_R12.json').read_text(encoding='utf-8'));O=R/'assets/generated/content-r12';O.mkdir(parents=True,exist_ok=True)
palette=json.loads((R/'assets/generated/content-r11/manifest.json').read_text(encoding='utf-8'))['palette'];colors=[tuple(bytes.fromhex(c.lstrip('#'))) for c in palette]
pal=Image.new('P',(1,1));pal.putpalette(sum((list(c) for c in colors),[])+[0]*(768-3*len(colors)))
def export(im,p):
 alpha=im.getchannel('A').point(lambda a:255 if a>185 else 0);im=im.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA');im.putalpha(alpha);im.putdata([(r,g,b,a) if a else (0,0,0,0) for r,g,b,a in im.get_flattened_data()]);im.save(p)
def info(p):
 im=Image.open(p);return dict(path=p.relative_to(R).as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),width=im.width,height=im.height)
masters=[];assets=[]
for j in P['jobs']:
 p=R/j['master'];p.parent.mkdir(parents=True,exist_ok=True)
 if not p.exists():shutil.copyfile(j['source'],p)
 masters.append(info(p));im=Image.open(p).convert('RGBA')
 if j['id']=='water':
  for row,kind in enumerate(['wide','peck','wake']):
   for col in range(3):
    box=(col*im.width//3,row*im.height//3,(col+1)*im.width//3,(row+1)*im.height//3)
    a=im.crop(box).resize((64,44),Image.Resampling.NEAREST);p=O/(kind+'-'+str(col)+'.png');export(a,p);assets.append(info(p)|dict(sourceMaster=j['master'],crop=list(box)))
 else:
  base=Image.open(R/'assets/generated/content-r9/sit-player.png').convert('RGBA')
  for col,pose in enumerate(['lift','push','rest']):
   box=(col*im.width//3,0,(col+1)*im.width//3,im.height);a=im.crop(box);mask=a.getchannel('A').point(lambda v:255 if v>185 else 0);a.putalpha(mask);a=a.crop(a.getbbox());a.thumbnail((48,64),Image.Resampling.NEAREST);out=Image.new('RGBA',(48,64));out.alpha_composite(a,((48-a.width)//2,64-a.height));p=O/('serve-'+pose+'.png');export(out,p)
   out=Image.open(p);out.paste(base.crop((0,46,48,64)),(0,46));out.save(p);assets.append(info(p)|dict(sourceMaster=j['master'],crop=list(box),fixedLowerRows=18,lowerSource='assets/generated/content-r9/sit-player.png'))
(O/'manifest.json').write_text(json.dumps(dict(status='VERIFIED',tool='image_gen.imagegen',actualModelSlug=None,prompts='docs/art/PROMPTS_CONTENT_R12.json',palette=palette,masters=masters,assets=assets),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED',len(masters),'masters /',len(assets),'native assets')
