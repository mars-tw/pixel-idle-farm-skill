"""Extract generated art, never draw replacement art. Retain v4 contracts and sources."""
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance
import json, hashlib, colorsys

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/generated/r83'
E=ROOT/'docs/evidence/r83-art'
P=json.loads((ROOT/'docs/art/PROMPTS_R83.json').read_text(encoding='utf-8'))
S={j['id']:j['master'] for j in P['jobs']}
PALETTE=json.loads((ROOT/'assets/generated/r68/manifest.json').read_text())['palette']
pal=Image.new('P',(1,1)); rgb=[tuple(bytes.fromhex(c[1:])) for c in PALETTE]
pal.putpalette([v for c in rgb for v in c]+list(rgb[0])*(256-len(rgb)))
records=[]; overrides={}; quality={}; frame_receipts=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def grade(im):
    im=im.convert('RGBA'); alpha=im.getchannel('A').point(lambda v:255 if v>=128 else 0)
    out=im.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA')
    out.putalpha(alpha);out.paste((0,0,0,0),mask=ImageOps.invert(alpha));return out
def source(k):return Image.open(ROOT/S[k]).convert('RGBA')
def cell(im,c,r,cols,rows):return im.crop((round(c*im.width/cols),round(r*im.height/rows),round((c+1)*im.width/cols),round((r+1)*im.height/rows)))
def matte(im):
    im=im.copy().convert('RGBA');px=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=px[x,y]
            if r>g+55 and b>g+55 and r>125 and b>125:px[x,y]=(0,0,0,0)
    return im
def save(im,name,source_id):
    path=OUT/name;path.parent.mkdir(parents=True,exist_ok=True)
    if path.suffix=='.webp':im.convert('RGB').save(path,lossless=True,method=6)
    else:im.save(path,optimize=True)
    records.append(dict(path=path.relative_to(ROOT).as_posix(),source=source_id,size=list(im.size),bytes=path.stat().st_size,sha256=sha(path)))
    return path.relative_to(ROOT).as_posix()
def metric(im):
    px=[p for p in im.convert('RGBA').getdata() if p[3]>0]
    y=[(.2126*r+.7152*g+.0722*b)/255 for r,g,b,a in px]; s=[colorsys.rgb_to_hsv(r/255,g/255,b/255)[1] for r,g,b,a in px]
    m=dict(brightness=sum(y)/len(y),nearBlackFraction=sum(v<.1 for v in y)/len(y),saturation=sum(s)/len(s),lowSaturationFraction=sum(v<.2 for v in s)/len(s))
    m['gatePass']=.3<=m['brightness']<=.75 and m['nearBlackFraction']<.35 and m['saturation']>=.32 and m['lowSaturationFraction']<.2
    return m
def fit_cut(im,size,scale=None,baseline=None):
    box=im.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()
    if not box:raise ValueError('empty cutout')
    cut=im.crop(box)
    factor=scale if scale else min((size[0]-4)/cut.width,(size[1]-4)/cut.height)
    cut=cut.resize((max(1,round(cut.width*factor)),max(1,round(cut.height*factor))),Image.Resampling.BOX)
    canvas=Image.new('RGBA',size);canvas.paste(cut,((size[0]-cut.width)//2,(baseline if baseline is not None else size[1]-2)-cut.height))
    return grade(canvas)
def packed(k,cols,rows,w,h,names,character=False,row_order=None):
    im=source(k);cells=[matte(cell(im,c,r,cols,rows)) if k!='Walk' else cell(im,c,r,cols,rows) for r in range(rows) for c in range(cols)]
    scale=None
    if character or k.startswith('Crops'):
        boxes=[v.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox() for v in cells]
        scale=min((w-4)/max(b[2]-b[0] for b in boxes),(h-5)/max(b[3]-b[1] for b in boxes))
    frames={};sheet=Image.new('RGBA',(cols*w,rows*h));native=[]
    for i,v in enumerate(cells):
        fr=fit_cut(v,(w,h),scale,h-2);sheet.paste(fr,((i%cols)*w,(i//cols)*h));native.append(fr)
        name=names[i];frames[name]=dict(x=i%cols*w,y=i//cols*h,w=w,h=h,anchor=[.5,.97 if not character else .86])
    path=save(sheet,k.lower()+'.png',S[k]);quality[k]=metric(sheet)
    if character:
        for row in range(rows):
            crop=(0,h//2,w,h); a=native[row*cols].crop(crop);b=native[row*cols+1].crop(crop)
            changed=sum(x!=y for x,y in zip(a.getdata(),b.getdata()))/(w*h/2)
            frame_receipts.append(dict(sheet=k,row=row,lowerBodyChangedFraction=changed,hashes=[hashlib.sha256(native[row*cols+c].tobytes()).hexdigest() for c in range(cols)]))
    return dict(image=path,meta=dict(w=sheet.width,h=sheet.height),frames=frames),native

def main():
    OUT.mkdir(parents=True,exist_ok=True);E.mkdir(parents=True,exist_ok=True)
    dirs=['down','left','right','up']
    walk,native=packed('Walk',6,4,48,64,[f'walk_{d}_{c:02}' for d in dirs for c in range(6)],True)
    overrides['walk']=walk
    npcs,_=packed('Npcs',4,4,48,64,[f'{who}_{pose}' for who in ['mayor','merchant','elder','child'] for pose in ['idle_a','idle_b','talk_a','talk_b']]);overrides['npcs']=npcs
    water,water_frames=packed('Actions',6,4,48,64,[f'water_{d}_{c:02}' for d in dirs for c in range(6)],True)
    tend,tend_frames=packed('Tend',6,4,48,64,[f'tend_{d}_{c:02}' for d in ['down','right','left','up'] for c in range(6)],True)
    # Retain original axe/build clothing until corresponding new tool poses exist.
    original=json.loads((ROOT/'assets/generated/v4/miri-actions-48x64.json').read_text())
    action=Image.open(ROOT/original['image']).convert('RGBA'); action_frames=original['frames']
    for name,f in action_frames.items():
        base,d,ix=name.rsplit('_',2);ix=int(ix)
        if base not in ['water','sow','harvest','collect','use']:continue
        direction='right' if d=='side' else d
        if base=='water':src=water_frames[dirs.index(direction)*6+[0,1,2,2,4,5][ix]]
        else:
            order=['down','right','left','up']; seq=[0,1,2,2,1,0] if base in ['sow','use'] else [0,1,3,4,5,0]
            src=tend_frames[order.index(direction)*6+seq[ix]]
        action.paste(src,(f['x'],f['y']))
    original['image']=save(grade(action),'farming-actions.png',S['Actions']+' + '+S['Tend']+' + retained v4 axe/build');overrides['actions']=original
    crops,_=packed('Crops',5,6,48,48,[f'{n}_{stage}' for n in ['wheat','carrot','tomato','corn','strawberry','pumpkin'] for stage in ['seed','sprout','young','mature','ready']]);overrides['crops']=crops
    stages=['seed','sprout','young','mature','ready']
    late,_=packed('CropsLate',5,9,48,48,[f'{n}_{stage}' for n in ['bell_pepper','potato','grapes','melon','eggplant_proposal','broccoli_proposal','blueberry_proposal','sunflower','cabbage_proposal'] for stage in stages])
    season,_=packed('CropsSeason',5,4,48,48,[f'{n}_{stage}' for n in ['pea','sweet_potato','winter_kale','radish'] for stage in stages])
    overrides['crops2']=dict(image=late['image'],meta=late['meta'],frames={k:v for k,v in late['frames'].items() if k.split('_')[0] in ['bell','potato','grapes','melon']})
    overrides['crops3']=dict(image=season['image'],meta=season['meta'],frames={k:v for k,v in season['frames'].items() if not k.startswith('radish')})
    # Mixed-source crops4 uses per-frame overrides with explicit image metadata.
    overrides['crops4']=dict(image=season['image'],meta=season['meta'],frames={k:v for k,v in season['frames'].items() if k.startswith('radish')})
    overrides['crops4']['frames'].update({k:{**v,'image':late['image'],'meta':late['meta']} for k,v in late['frames'].items() if k.startswith('sunflower')})
    world,_=packed('World',4,3,96,96,['farmhouse','barn','greenhouse','chicken_coop','oak','oak_autumn','bush_big','stump','order_board','mailbox','well','market_stall'])
    for key,names in {'buildings':['farmhouse','barn','chicken_coop','shop'],'structures':['greenhouse','oak','oak_spring','oak_autumn','bush_big','bush_big_spring','bush_big_autumn','market_stall'],'props':['stump','order_board','mailbox','well']}.items():
        frames={}
        for name in names:
            base=name.removesuffix('_spring')
            if base=='shop':base='market_stall'
            if base=='bush_big_autumn':base='bush_big'
            frames[name]=world['frames'][base]
        overrides[key]=dict(image=world['image'],meta=world['meta'],frames=frames)
    # New generated materials inherit existing autotile silhouettes/edge topology.
    material=source('Terrain');tiles=[grade(ImageEnhance.Brightness(cell(material,c,r,3,2)).enhance(1.10 if c==0 else 1.03).resize((16,16),Image.Resampling.BOX).resize((32,32),Image.Resampling.NEAREST)) for r in range(2) for c in range(3)]
    old=json.loads((ROOT/'assets/generated/v4/terrain-organic-32.json').read_text());oldim=Image.open(ROOT/old['image']).convert('RGBA');sheet=oldim.copy()
    for name,f in old['frames'].items():
        if not name.startswith(('grass','path','soil','water')):continue
        idx=0 if name.startswith('grass') else 1 if name.startswith('path') else 4 if name.startswith('soil_wet') else 2 if name.startswith('soil') else 5
        generated=tiles[idx].copy()
        if idx and not name.endswith('_c'):
            reference=oldim.crop((f['x'],f['y'],f['x']+32,f['y']+32));mask=Image.new('L',(32,32));mask.putdata([255 if (g>r*1.03 and g>b*1.08) else 0 for r,g,b,a in reference.getdata()]);generated.paste(tiles[0],mask=mask)
        sheet.paste(generated,(f['x'],f['y']))
    old['image']=save(grade(sheet),'terrain.png',S['Terrain']);overrides['terrain']=old
    _,portraits=packed('Portraits',3,2,80,80,[f'{who}-{i}' for who in ['grey','grandma'] for i in range(3)])
    for i,im in enumerate(portraits):save(im,('grey' if i<3 else 'grandma')+f'-{i%3}.png',S['Portraits'])
    face=fit_cut(native[0].crop((0,0,48,36)),(64,64));save(face,'farmer-face-64.png',S['Walk']);quality['FarmerFace']=metric(face)
    for key in ['Welcome','Basket','Door','Table']:
        save(grade(ImageOps.fit(source(key),(192,96),method=Image.Resampling.BOX).resize((384,192),Image.Resampling.NEAREST)),key.lower()+('-r82.webp' if key in ['Door','Table'] else '-384.webp'),S[key])
    panel=grade(source('Panel').resize((192,192),Image.Resampling.BOX));save(panel,'panel-192.png',S['Panel']);save(panel.crop((32,32,160,160)),'paper-128.png',S['Panel'])
    _,icons=packed('Icons',4,2,32,32,['basket','note','wheat','stamp','water','seed','sun','tea'])
    for n,im in zip(['basket','note','wheat','stamp','water','seed','sun','tea'],icons):save(im,n+'-32.png',S['Icons'])
    save(fit_cut(matte(source('Logo')),(320,112)),'logo-320.png',S['Logo'])
    app=grade(source('App').resize((128,128),Image.Resampling.BOX))
    for size in [64,192,512]:save(app.resize((size,size),Image.Resampling.NEAREST),f'app-icon-{size}.png',S['App'])
    # Story image paths retain compatibility with the R82 executable check.
    for key in ['Table','Door']:
        oldname='table' if key=='Table' else 'doorstep'; dest=ROOT/f'assets/heirloom/r83/{oldname}-r82.webp';dest.parent.mkdir(parents=True,exist_ok=True)
        im=grade(ImageOps.fit(source(key),(192,96),method=Image.Resampling.BOX).resize((384,192),Image.Resampling.NEAREST));im.convert('RGB').save(dest,lossless=True,method=6)
        records.append(dict(path=dest.relative_to(ROOT).as_posix(),source=S[key],size=[384,192],bytes=dest.stat().st_size,sha256=sha(dest)))
    (OUT/'atlas.json').write_text(json.dumps(dict(overrides=overrides),indent=2)+'\n',encoding='utf-8',newline='\n')
    contact=Image.new('RGBA',(384,256),'#fff6e3')
    for r in range(4):
        for c in range(6):contact.paste(native[r*6+c],(c*64,r*64))
    contact.convert('RGB').save(E/'walk-contact.png');app.resize((64,64),Image.Resampling.NEAREST).save(E/'app-64.png')
    manifest=dict(status='EXECUTED',generator=P['generator'],actualModelSlug=None,palette=PALETTE,pipeline='Generated image -> real alpha or magenta color key -> stable baseline/cell scale -> BOX native downsample -> shared 66-color palette -> binary alpha and transparent RGB cleanup -> PNG/lossless WebP. Existing autotile silhouettes retained; no procedural replacement art.',masters=[dict(path=p,sha256=sha(ROOT/p),bytes=(ROOT/p).stat().st_size) for p in S.values()],records=records,qualityMetrics=quality,frameReceipts=frame_receipts,runtimeBytes=sum(r['bytes'] for r in records),limitations=['Male Kai clothing retained.','Axe/build/fishing/basket handoff specific poses retained from v4; not claimed redrawn.','Winter-specific trees and other late structures retained.','Four unused crop proposals are present in the source sheet only; not added to gameplay.'])
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n');print(json.dumps(dict(exports=len(records),bytes=manifest['runtimeBytes'],quality=quality,frames=frame_receipts),indent=2))
if __name__=='__main__':main()
