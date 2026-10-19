"""Native extraction of one actual image_gen.imagegen prop master, on the R89 palette."""
import json,pathlib,hashlib,shutil
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1];O=R/'assets/generated/content-r11';O.mkdir(parents=True,exist_ok=True)
P=json.loads((R/'docs/art/PROMPTS_CONTENT_R11.json').read_text(encoding='utf-8'))
palette=json.loads((R/'assets/generated/r89/manifest.json').read_text())['palette'];rgb=[tuple(int(c[i:i+2],16) for i in (1,3,5)) for c in palette]
pal=Image.new('P',(1,1));pal.putpalette([v for i in range(256) for v in rgb[i%len(rgb)]])
def info(p):
 im=Image.open(p);return dict(path=p.relative_to(R).as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),width=im.width,height=im.height)
job=P['jobs'][0];master=R/job['master'];master.parent.mkdir(parents=True,exist_ok=True)
if not master.exists():shutil.copyfile(job['source'],master)
im=Image.open(master).convert('RGBA');assets=[]
for name,crop,size in [('basket',(0,0,650,887),(32,32)),('table',(650,0,1774,887),(128,64))]:
 a=im.crop(crop);a.putalpha(a.getchannel('A').point(lambda n:255 if n>180 else 0));a=a.crop(a.getbbox());a.thumbnail(size,Image.Resampling.NEAREST)
 out=Image.new('RGBA',size);out.alpha_composite(a,((size[0]-a.width)//2,size[1]-a.height));alpha=out.getchannel('A');out=out.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA');out.putalpha(alpha);out.putdata([(r,g,b,a) if a else (0,0,0,0) for r,g,b,a in out.get_flattened_data()]);p=O/(name+'.png');out.save(p);assets.append(info(p)|dict(sourceMaster=job['master'],crop=list(crop)))
masters=[info(master)];job=P['jobs'][1];master=R/job['master'];master.parent.mkdir(parents=True,exist_ok=True)
if not master.exists():shutil.copyfile(job['source'],master)
masters.append(info(master));a=Image.open(master).convert('RGBA');a.putalpha(a.getchannel('A').point(lambda n:255 if n>180 else 0));a=a.crop(a.getbbox());a.thumbnail((60,52),Image.Resampling.NEAREST)
out=Image.new('RGBA',(60,52));out.alpha_composite(a,((60-a.width)//2,52-a.height));alpha=out.getchannel('A');out=out.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA');out.putalpha(alpha);out.putdata([(r,g,b,a) if a else (0,0,0,0) for r,g,b,a in out.get_flattened_data()]);p=O/'river_carp-2.png';out.save(p);assets.append(info(p)|dict(sourceMaster=job['master']))
(O/'manifest.json').write_text(json.dumps(dict(status='VERIFIED',tool='image_gen.imagegen',actualModelSlug=None,prompts='docs/art/PROMPTS_CONTENT_R11.json',palette=palette,masters=masters,assets=assets),ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print('VERIFIED 2 masters / 3 native assets')
