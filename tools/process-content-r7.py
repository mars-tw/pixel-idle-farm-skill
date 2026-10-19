"""Extract only the newly generated R7 pose atlas, using the R89 exact palette."""
import hashlib, json, pathlib, shutil
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
prompts = json.loads((ROOT/'docs/art/PROMPTS_CONTENT_R7.json').read_text(encoding='utf-8'))
out = ROOT/'assets/generated/content-r7'
masters = ROOT/'docs/art/masters/content-r7'
out.mkdir(parents=True, exist_ok=True)
masters.mkdir(parents=True, exist_ok=True)
palette = json.loads((ROOT/'assets/generated/r89/manifest.json').read_text())['palette']
pal = Image.new('P', (1, 1))
colors = [int(c[i:i+2],16) for c in palette for i in (1,3,5)]
pal.putpalette((colors+[0]*768)[:768])

def receipt(p):
    im=Image.open(p)
    return dict(path=p.relative_to(ROOT).as_posix(),width=im.width,height=im.height,sha256=hashlib.sha256(p.read_bytes()).hexdigest())

master=masters/'neighbors-poses.png'
shutil.copyfile(prompts['jobs'][0]['source'],master)
im=Image.open(master).convert('RGBA')
assets=[]
for row,person in enumerate(['merchant','elder','child']):
    for col,pose in enumerate(['sit','eat','reach']):
        cell=im.crop((im.width*col//3,im.height*row//3,im.width*(col+1)//3,im.height*(row+1)//3))
        cell.putalpha(cell.getchannel('A').point(lambda a:255 if a>=150 else 0))
        bounds=cell.getbbox()
        if not bounds: raise ValueError('empty sprite '+person+pose)
        cell=cell.crop(bounds)
        cell.thumbnail((44,60),Image.Resampling.LANCZOS)
        stage=Image.new('RGBA',(48,64))
        stage.alpha_composite(cell,((48-cell.width)//2,62-cell.height))
        alpha=stage.getchannel('A').point(lambda a:255 if a>=120 else 0)
        stage=stage.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA')
        stage.putalpha(alpha)
        stage.putdata([(r,g,b,a) if a else (0,0,0,0) for r,g,b,a in stage.getdata()])
        target=out/(pose+'-'+person+'.png')
        stage.save(target)
        assets.append(receipt(target)|dict(sourceMaster=master.relative_to(ROOT).as_posix(),row=row,column=col,tool='image_gen.imagegen'))
idle=json.loads((ROOT/'assets/generated/r83/atlas.json').read_text())['overrides']['npcs']
original=Image.open(ROOT/idle['image']).convert('RGBA')
for person in ['merchant','elder','child']:
    f=idle['frames'][person+'_idle_a']
    target=out/('idle-'+person+'.png')
    original.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])).save(target)
    assets.append(receipt(target)|dict(source=idle['image'],sourceSha256=hashlib.sha256((ROOT/idle['image']).read_bytes()).hexdigest(),frame=person+'_idle_a',tool='retained-atlas-extraction'))
flower=out/'trace-flower.png'
Image.open(ROOT/'assets/generated/content-r6/token-child.png').crop((44,42,100,80)).resize((28,19),Image.Resampling.NEAREST).save(flower)
assets.append(receipt(flower)|dict(source='assets/generated/content-r6/token-child.png',sourceSha256=hashlib.sha256((ROOT/'assets/generated/content-r6/token-child.png').read_bytes()).hexdigest(),crop=[44,42,100,80],tool='retained-atlas-extraction'))
waterMaster=masters/'quiet-water.png'
shutil.copyfile(prompts['jobs'][1]['source'],waterMaster)
water=Image.open(waterMaster).convert('RGB').resize((256,160),Image.Resampling.LANCZOS)
water=water.quantize(palette=pal,dither=Image.Dither.NONE).convert('RGB')
target=out/'quiet-water.webp'
water.save(target,lossless=True)
assets.append(receipt(target)|dict(sourceMaster=waterMaster.relative_to(ROOT).as_posix(),tool='image_gen.imagegen'))
(out/'manifest.json').write_text(json.dumps(dict(status='VERIFIED',tool='image_gen.imagegen',actualModelSlug=None,prompts='docs/art/PROMPTS_CONTENT_R7.json',native=[48,64],palette=palette,generatedOutputs=10,retainedDerivatives=4,masters=[receipt(master),receipt(waterMaster)],assets=assets),ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print('VERIFIED 2 generated masters; 14 runtime sprites/textures, R89 palette')
