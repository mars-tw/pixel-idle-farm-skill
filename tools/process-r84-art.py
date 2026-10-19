"""Post-process imagegen output. No synthesized replacement artwork."""
from pathlib import Path
from PIL import Image, ImageOps
import json, hashlib, colorsys

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/generated/r84'; M=ROOT/'docs/art/masters/r84'; E=ROOT/'docs/evidence/r84-art'
palette=json.loads((ROOT/'assets/generated/r83/manifest.json').read_text(encoding='utf-8'))['palette']
palette+=['#88A84B','#719143'] # Quiet generated grass midtones; the existing 66 colors remain a subset.
colors=[tuple(bytes.fromhex(c[1:])) for c in palette]
pal=Image.new('P',(1,1));pal.putpalette([v for c in colors for v in c]+list(colors[0])*(256-len(colors)))
records=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def grade(im):
    im=im.convert('RGBA'); alpha=im.getchannel('A').point(lambda a:255 if a>=128 else 0)
    result=im.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA')
    result.putalpha(alpha);result.paste((0,0,0,0),mask=ImageOps.invert(alpha));return result
def save(im,name,source):
    p=OUT/name;p.parent.mkdir(parents=True,exist_ok=True)
    if p.suffix=='.webp':im.convert('RGB').save(p,lossless=True,method=6)
    else:im.save(p,optimize=True)
    records.append(dict(path=p.relative_to(ROOT).as_posix(),source=source,size=list(im.size),bytes=p.stat().st_size,sha256=sha(p)))
    return p.relative_to(ROOT).as_posix()
def fit(im,size):
    im=im.convert('RGBA');box=im.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()
    if not box:raise ValueError('Empty image')
    cut=im.crop(box);cut.thumbnail((size[0]-4,size[1]-4),Image.Resampling.BOX)
    canvas=Image.new('RGBA',size);canvas.paste(cut,((size[0]-cut.width)//2,size[1]-cut.height-2));return grade(canvas)
def cell(im,col,row,cols,rows):return im.crop((round(col*im.width/cols),round(row*im.height/rows),round((col+1)*im.width/cols),round((row+1)*im.height/rows)))
def metrics(im):
    px=[p for p in im.convert('RGBA').getdata() if p[3]]
    ys=[(.2126*r+.7152*g+.0722*b)/255 for r,g,b,a in px];ss=[colorsys.rgb_to_hsv(r/255,g/255,b/255)[1] for r,g,b,a in px]
    r=dict(brightness=sum(ys)/len(ys),nearBlackFraction=sum(v<.1 for v in ys)/len(ys),saturation=sum(ss)/len(ss),lowSaturationFraction=sum(v<.2 for v in ss)/len(ss))
    r['gatePass']=.3<=r['brightness']<=.75 and r['nearBlackFraction']<.35 and r['saturation']>=.32 and r['lowSaturationFraction']<.2
    return r
def main():
    OUT.mkdir(parents=True,exist_ok=True);E.mkdir(parents=True,exist_ok=True)
    im=Image.open(M/'props.png').convert('RGBA');sheet=Image.new('RGBA',(192,192));frames={}
    for i,name in enumerate(['basket_full','porch','basket_empty','canopy']):
        fr=fit(cell(im,i%2,i//2,2,2),(96,96));sheet.paste(fr,(i%2*96,i//2*96));frames[name]=dict(x=i%2*96,y=i//2*96,w=96,h=96,anchor=[.5,1])
    props=save(sheet,'keepsakes.png','props');overrides={'keepsakes':dict(image=props,meta=dict(w=192,h=192),frames=frames)}
    im=Image.open(M/'portraits.png');contact=Image.new('RGB',(240,240),'#fff6e3')
    for row,who in enumerate(['miri','grey','grandma']):
        for col in range(3):
            fr=fit(cell(im,col,row,3,3),(80,80));save(fr,f'{who}-{col}.png','portraits');contact.paste(fr,(col*80,row*80),fr)
    contact.save(E/'expressions-80.png')
    im=Image.open(M/'result.png');story=grade(ImageOps.fit(im,(192,96),method=Image.Resampling.BOX).resize((384,192),Image.Resampling.NEAREST))
    save(story,'table-result.webp','result')
    # Doorstep gets its own generated composition rather than a crop of the table result.
    im=Image.open(M/'doorstep.png');door=grade(ImageOps.fit(im,(192,96),method=Image.Resampling.BOX).resize((384,192),Image.Resampling.NEAREST));save(door,'doorstep-result.webp','doorstep')
    for name,im in [('table',story),('doorstep',door)]:
        p=ROOT/f'assets/heirloom/r84/{name}-result.webp';p.parent.mkdir(parents=True,exist_ok=True);im.convert('RGB').save(p,lossless=True,method=6)
        records.append(dict(path=p.relative_to(ROOT).as_posix(),source=name+'-result',size=list(im.size),bytes=p.stat().st_size,sha256=sha(p)))
    panel=grade(Image.open(M/'panel.png').resize((192,192),Image.Resampling.BOX));save(panel,'panel-192.png','panel');save(panel.crop((40,40,168,168)),'paper-128.png','panel')
    icons=Image.open(M/'icons.png');native=[]
    for i,name in enumerate(['menu','face','cups','wheat','basket','water','note','sun']):
        fr=fit(cell(icons,i%4,i//4,4,2),(32,32));save(fr,name+'-32.png','icons');native.append(fr)
    iconcontact=Image.new('RGBA',(256,32),'#fff6e3')
    for i,fr in enumerate(native):iconcontact.paste(fr,(i*32,0),fr)
    iconcontact.convert('RGB').save(E/'icons-32.png')
    save(fit(Image.open(M/'logo.png'),(320,112)),'logo-320.png','logo')
    app=grade(Image.open(M/'app.png').resize((128,128),Image.Resampling.BOX))
    for size in [64,192,512]:save(app.resize((size,size),Image.Resampling.NEAREST),f'app-icon-{size}.png','app')
    # Quiet generated terrain replaces the source material while retaining edge masks.
    materials=Image.open(M/'terrain.png');tiles=[]
    for r in range(2):
        for c in range(3):
            native=cell(materials,c,r,3,2).resize((16,16),Image.Resampling.BOX)
            tiles.append(grade(native.resize((32,32),Image.Resampling.NEAREST)))
    old=json.loads((ROOT/'assets/generated/r83/atlas.json').read_text())['overrides']['terrain'];original=Image.open(ROOT/old['image']).convert('RGBA');terrain=original.copy()
    for name,f in old['frames'].items():
        if not name.startswith(('grass','path','soil','water')):continue
        idx=0 if name.startswith('grass') else 1 if name.startswith('path') else 4 if name.startswith('soil_wet') else 2 if name.startswith('soil') else 5
        tile=tiles[idx].copy()
        if idx and not name.endswith('_c'):
            ref=original.crop((f['x'],f['y'],f['x']+32,f['y']+32));mask=Image.new('L',(32,32));mask.putdata([255 if g>r*1.03 and g>b*1.08 else 0 for r,g,b,a in ref.getdata()]);tile.paste(tiles[0],mask=mask)
        terrain.paste(tile,(f['x'],f['y']))
    terrain_path=save(grade(terrain),'terrain.png','terrain');overrides['terrain']={**old,'image':terrain_path}
    (OUT/'atlas.json').write_text(json.dumps(dict(overrides=overrides),indent=2)+'\n',encoding='utf-8',newline='\n')
    quality={};alpha=[]
    for record in records:
        im=Image.open(ROOT/record['path']).convert('RGBA');quality[record['path']]=metrics(im)
        a=im.getchannel('A');alpha.append(dict(path=record['path'],corners=[a.getpixel(p) for p in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]],partial=sum(0<p<255 for p in a.getdata()),bbox=a.getbbox(),outsidePalette=sum(tuple(p[:3]) not in colors for p in im.getdata() if p[3])))
    data=dict(status='EXECUTED',generator='image_gen.imagegen',actualModelSlug=None,modelNote='Built-in tool does not expose a model slug; no inferred GPT model ID.',palette=palette,masters=[dict(path=p.relative_to(ROOT).as_posix(),sha256=sha(p),bytes=p.stat().st_size) for p in sorted(M.glob('*.png'))],records=records,qualityMetrics=quality,alpha=alpha,runtimeBytes=sum(r['bytes'] for r in records),pipeline='Generated art; preserve true alpha, threshold at native size, shared 68-color palette (retaining the prior 66 colors), clear transparent RGB, BOX native resize, nearest-neighbor; opaque backgrounds lossless WebP. No programmatic substitute artwork.')
    (OUT/'manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n');print(json.dumps(dict(records=len(records),runtimeBytes=data['runtimeBytes'],failedQuality=[p for p,m in quality.items() if not m['gatePass']]),indent=2))
if __name__=='__main__':main()
