"""Only processes this round's generated art; never rewrites historical evidence."""
import hashlib, json, pathlib, shutil
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/generated/content-r6'
MASTERS = ROOT / 'docs/art/masters/content-r6'
OUT.mkdir(parents=True, exist_ok=True)
MASTERS.mkdir(parents=True, exist_ok=True)
prompts = json.loads((ROOT / 'docs/art/PROMPTS_CONTENT_R6.json').read_text(encoding='utf-8'))
palette = json.loads((ROOT / 'assets/generated/r89/manifest.json').read_text())['palette']
pal = Image.new('P', (1, 1))
colors = [int(c[i:i+2], 16) for c in palette for i in (1, 3, 5)]
pal.putpalette((colors + [0] * 768)[:768])
assets, masters = [], []

def receipt(p):
    im = Image.open(p)
    return dict(path=p.relative_to(ROOT).as_posix(), sha256=hashlib.sha256(p.read_bytes()).hexdigest(), width=im.width, height=im.height)

def save(im, name, native, final, transparent=False):
    if transparent:
        im = im.convert('RGBA')
        im.putalpha(im.getchannel('A').point(lambda a:255 if a>=100 else 0))
        box = im.getbbox()
        if box: im = im.crop(box)
        im.thumbnail((native[0]-4, native[1]-4), Image.Resampling.LANCZOS)
        stage=Image.new('RGBA', native)
        stage.alpha_composite(im, ((native[0]-im.width)//2, native[1]-im.height-2))
        im=stage
    else: im=im.convert('RGBA').resize(native, Image.Resampling.LANCZOS)
    alpha=im.getchannel('A').point(lambda a:255 if a>=100 else 0)
    im=im.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA')
    im.putalpha(alpha)
    # Zero hidden RGB and keep the same exact palette at native density.
    im.putdata([(r,g,b,a) if a else (0,0,0,0) for r,g,b,a in im.getdata()])
    im=im.resize(final,Image.Resampling.NEAREST)
    target=OUT/name
    if target.suffix=='.webp': im.save(target,lossless=True)
    else: im.save(target)
    assets.append(receipt(target))

for job in prompts['jobs']:
    master=MASTERS/(job['id']+'.png')
    shutil.copyfile(job['source'],master)
    masters.append(receipt(master))
    im=Image.open(master).convert('RGBA')
    if job['id']=='baskets':
        for k,name in enumerate(['plain','sweet','sour','hot']):
            x=k%2;y=k//2
            save(im.crop((im.width*x//2,im.height*y//2,im.width*(x+1)//2,im.height*(y+1)//2)), 'basket-'+name+'.png',(64,64),(128,128),True)
    elif job['id']=='gathering': save(im,'gathering.webp',(256,128),(512,256))
    elif job['id']=='receive':
        for y,name in enumerate(['merchant','elder','child']):
            for x in range(3):
                save(im.crop((im.width*x//3,im.height*y//3,im.width*(x+1)//3,im.height*(y+1)//3)),f'receive-{name}-{x}.png',(48,64),(96,128),True)
    elif job['id']=='tokens':
        for k,name in enumerate(['merchant','elder','child']):
            bounds=[0,512,940,1536]
            save(im.crop((0,round(im.height*bounds[k]/1536),im.width,round(im.height*bounds[k+1]/1536))),'token-'+name+'.png',(64,64),(128,128),True)

(OUT/'manifest.json').write_text(json.dumps(dict(status='VERIFIED',tool=prompts['tool'],actualModelSlug=None,prompts='docs/art/PROMPTS_CONTENT_R6.json',palette=palette,masters=masters,assets=assets),ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print('VERIFIED',len(masters),'generated masters;',len(assets),'runtime sprites, exact R89 palette')
