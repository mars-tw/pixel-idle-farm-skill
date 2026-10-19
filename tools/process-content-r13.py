"""Export generated atlases and explicitly requested alpha-derived fish silhouettes."""
import json, pathlib, shutil, hashlib
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1]
P=json.loads((R/'docs/art/PROMPTS_CONTENT_R13.json').read_text(encoding='utf-8'))
O=R/'assets/generated/content-r13'; O.mkdir(parents=True,exist_ok=True)
palette=json.loads((R/'assets/generated/content-r11/manifest.json').read_text(encoding='utf-8'))['palette']
pal=Image.new('P',(1,1)); colors=[tuple(bytes.fromhex(c[1:])) for c in palette]
pal.putpalette(sum((list(c) for c in colors),[])+[0]*(768-3*len(colors)))
def info(p):
    im=Image.open(p); return dict(path=p.relative_to(R).as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),width=im.width,height=im.height)
def export(im,p):
    alpha=im.getchannel('A').point(lambda a:255 if a>185 else 0)
    out=im.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA'); out.putalpha(alpha)
    out.putdata([(r,g,b,a) if a else (0,0,0,0) for r,g,b,a in out.get_flattened_data()]); out.save(p); return out
masters=[]; assets=[]; derived=[]
for j in P['jobs']:
    m=R/j['master'];m.parent.mkdir(parents=True,exist_ok=True)
    if not m.exists(): shutil.copyfile(j['source'],m)
    masters.append(info(m)); im=Image.open(m).convert('RGBA')
    if j['id']=='actors':
        for col in range(3):
            box=(col*im.width//3,0,(col+1)*im.width//3,im.height//2)
            a=im.crop(box).resize((96,96),Image.Resampling.NEAREST)
            p=O/f'fishing-{col}.png'; export(a,p);assets.append(info(p)|dict(sourceMaster=j['master'],crop=box))
        for col,id in enumerate(['merchant','elder','child']):
            box=(col*im.width//3,im.height//2,(col+1)*im.width//3,im.height)
            # Accepted sit sprites already have empty hands on their laps. Reuse them
            # exactly: newly generated faces would drift from the existing residents.
            source=f'assets/generated/content-r9/sit-{id}.png';p=O/f'wait-{id}.png';shutil.copyfile(R/source,p)
            derived.append(info(p)|dict(source=source,sourceSha256=hashlib.sha256((R/source).read_bytes()).hexdigest(),exactCopy=True,fixedLowerRows=18))
    else:
        # The R89 1536x1024 ground spans 30x20 logical tiles including fringe.
        # This 3x20-tile river uses the same square native-pixel grid at runtime.
        p=O/'creek.png';export(im.resize((154,1024),Image.Resampling.NEAREST),p);assets.append(info(p)|dict(sourceMaster=j['master'],pixelGrid='R89 1536x1024 over 30x20 tiles; creek 3x20 tiles'))
for id in ['river_carp','silver_dace','river_perch']:
    source=f'assets/generated/content-r8/{id}-3.png';im=Image.open(R/source).convert('RGBA')
    # The same colored fish supplies the notebook, in-water shadow and mini replay.
    color=O/f'{id}-color.png';im.save(color)
    silhouette=Image.new('RGBA',im.size,(41,61,70,0));silhouette.putalpha(im.getchannel('A'));silhouette.putdata([(r,g,b,a) if a else (0,0,0,0) for r,g,b,a in silhouette.get_flattened_data()]);shadow=O/f'{id}-shadow.png';silhouette.save(shadow)
    for p in [color,shadow]:derived.append(info(p)|dict(source=source,sourceSha256=hashlib.sha256((R/source).read_bytes()).hexdigest(),alphaUnchanged=True))
(O/'manifest.json').write_text(json.dumps(dict(status='VERIFIED',tool='image_gen.imagegen',actualModelSlug=None,prompts='docs/art/PROMPTS_CONTENT_R13.json',palette=palette,masters=masters,assets=assets,derived=derived),ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print('VERIFIED',len(masters),'masters /',len(assets),'generated native assets /',len(derived),'derived or reused assets')
