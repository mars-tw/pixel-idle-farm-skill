"""Generated pixels only: cut, normalize, palette, alpha and nearest-neighbor.

Postprocessing is explicitly requested by the art work order. No drawn substitute
sprites or motion synthesized from a single pose. Retain all older source licenses.
"""
from pathlib import Path
from PIL import Image, ImageOps
import importlib.util, json, hashlib

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('r85art', ROOT/'tools/process-r85-art.py')
P = importlib.util.module_from_spec(spec); spec.loader.exec_module(P)
OUT=ROOT/'assets/generated/r86'; E=ROOT/'docs/evidence/r86-art'
DATA=json.loads((ROOT/'docs/art/PROMPTS_R86.json').read_text(encoding='utf-8'))
S={j['id']:ROOT/j['master'] for j in DATA['jobs']}
P.OUT=OUT; P.records=[]
def save(im,name,source): return P.save(im,name,source)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def slices(im,rows):
    """Find real transparent gutters; generated outer margins are nonuniform."""
    a=im.getchannel('A'); ys=[0]
    for r in range(1,rows):
        n=round(r*im.height/rows);rad=round(im.height/rows*.24)
        ys.append(min(range(max(ys[-1]+10,n-rad),min(im.height,n+rad)),key=lambda y:(sum(v>127 for v in a.crop((0,y,im.width,y+1)).getdata()),abs(y-n))))
    ys.append(im.height);cells=[]
    for r in range(rows):
        strip=im.crop((0,ys[r],im.width,ys[r+1]));a=strip.getchannel('A');xs=[0]
        for c in range(1,6):
            n=round(c*im.width/6);rad=round(im.width/6*.28)
            xs.append(min(range(max(xs[-1]+10,n-rad),min(im.width,n+rad)),key=lambda x:(sum(v>127 for v in a.crop((x,0,x+1,strip.height)).getdata()),abs(x-n))))
        xs.append(im.width)
        cells.extend(strip.crop((xs[c],0,xs[c+1],strip.height)) for c in range(6))
    return cells

def poses(name,rows):
    cells=slices(Image.open(S[name]).convert('RGBA'),rows)
    if name=='walk':
        # Source row 2 faces right and row 3 faces left. Reorder full poses.
        cells=cells[:6]+cells[12:18]+cells[6:12]+cells[18:24]
    else:
        # Both generated side rows face right; mirror every distinct left pose.
        for row in [1,5]:
            for c in range(6): cells[row*6+c]=ImageOps.mirror(cells[row*6+c])
    boxes=[im.getchannel('A').point(lambda v:255 if v>=128 else 0).getbbox() for im in cells]
    scale=min(44/max(b[2]-b[0] for b in boxes),60/max(b[3]-b[1] for b in boxes))
    native=[P.fit(im,(48,64),scale) for im in cells]
    sheet=Image.new('RGBA',(288,rows*64)); receipts=[]
    for i,im in enumerate(native):sheet.paste(im,(i%6*48,i//6*64))
    for row in range(rows):
        seq=native[row*6:row*6+6]; masks=[v.getchannel('A').tobytes() for v in seq]
        lower=[v.crop((0,32,48,64)).tobytes() for v in seq]
        receipts.append(dict(sheet=name,row=row,hashes=[hashlib.sha256(v.tobytes()).hexdigest() for v in seq],alphaDifferences=[sum(a!=b for a,b in zip(masks[i],masks[i+1]))/3072 for i in range(5)],lowerBodyChangedFraction=sum(a!=b for a,b in zip(lower[0],lower[1]))/len(lower[0])))
    save(sheet,name+'.png',name);sheet.resize((576,rows*128),Image.Resampling.NEAREST).save(E/(name+'-poses.png'))
    return native,receipts

def main():
    OUT.mkdir(parents=True,exist_ok=True);E.mkdir(parents=True,exist_ok=True)
    walk,wr=poses('walk',4);actions,ar=poses('actions',8)
    drop=actions[3].copy();px=drop.load()
    for y in range(drop.height):
        for x in range(drop.width):
            r,g,b,a=px[x,y]
            if not(b>r*1.2 and b>g*.9):px[x,y]=(0,0,0,0)
    save(P.fit(drop,(16,16)),'drop-16.png','blue water cutout from generated action impact pose')
    old=json.loads((ROOT/'assets/generated/r85/atlas.json').read_text())['overrides']
    wmap={f'walk_{d}_{i:02}':dict(x=i*48,y=r*64,w=48,h=64,anchor=[.5,.97]) for r,d in enumerate(['down','left','right','up']) for i in range(6)}
    overrides={'walk':dict(image='assets/generated/r86/walk.png',meta=dict(w=288,h=256),frames=wmap)}
    a=old['actions'];sheet=Image.open(ROOT/a['image']).convert('RGBA')
    for name,f in a['frames'].items():
        base,d,i=name.rsplit('_',2)
        if base not in ['water','sow','harvest','collect','use']:continue
        row=['down','left','right','up'].index('right' if d=='side' else d)+(0 if base=='water' else 4)
        sheet.paste(actions[row*6+int(i)],(f['x'],f['y']))
    overrides['actions']={**a,'image':save(sheet,'farming-actions.png','actions + licensed retained axe/build poses')}
    (OUT/'atlas.json').write_text(json.dumps(dict(overrides=overrides),indent=2)+'\n',encoding='utf-8',newline='\n')
    ref=Image.open(S['sheet']).convert('RGBA')
    # Cream model-sheet matte removed only through connected exterior pixels.
    from collections import deque
    for i in range(3):
        im=ref.crop((round(i*ref.width/3),round(ref.height*.66),round((i+1)*ref.width/3),ref.height))
        px=im.load();q=deque([(x,y) for x in range(im.width) for y in [0,im.height-1]]+[(x,y) for y in range(im.height) for x in [0,im.width-1]]);seen=set()
        while q:
            x,y=q.popleft()
            if (x,y) in seen or not(0<=x<im.width and 0<=y<im.height):continue
            seen.add((x,y));r,g,b,a=px[x,y]
            if r>205 and g>195 and b>155 and max(r,g,b)-min(r,g,b)<90:
                px[x,y]=(0,0,0,0);q.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
        save(P.fit(im,(80,80)),f'miri-{i}.png','sheet')
    stamps=Image.open(S['stamps']).convert('RGBA')
    for i,name in enumerate(['water','harvest','basket']):save(P.fit(P.cell(stamps,i,0,3,1),(32,32)),f'stamp-{name}-32.png','stamps')
    save(P.grade(Image.open(S['panel']).resize((128,128),Image.Resampling.BOX)),'paper-128.png','panel')
    binding=Image.open(ROOT/'assets/generated/r85/album-128.png').crop((0,0,8,128));save(binding,'binding-8.png','licensed R85 generated album binding, cropped inside frame')
    leaf=Image.open(S['leaf']).convert('RGBA').resize((128,128),Image.Resampling.BOX)
    # Derive translucent illumination and shadow from generated luminance, not shapes.
    light=Image.new('RGBA',leaf.size);shadow=Image.new('RGBA',leaf.size);lp=[];sp=[]
    for r,g,b,a in leaf.getdata():
        y=(.2126*r+.7152*g+.0722*b)/255
        lp.append((255,232,163,round(a*max(0,(y-.43)/.57)*.84)))
        sp.append((42,67,38,round(a*max(0,(.74-y)/.74)*.72)))
    light.putdata(lp);shadow.putdata(sp)
    # Both masks keep smooth alpha only at penumbra; clear zero-alpha RGB.
    for im in [light,shadow]:
        px=im.load()
        for y in range(im.height):
            for x in range(im.width):
                if px[x,y][3]==0:px[x,y]=(0,0,0,0)
    save(light,'leaf-light-128.png','leaf luminance mask');save(shadow,'canopy-shadow-128.png','leaf inverse luminance mask')
    # A coherent shadow crosses the light region, rather than a uniform dot field.
    ground=Image.alpha_composite(shadow,light);save(ground,'leaf-ground-128.png','leaf combined generated masks')
    save(P.fit(Image.open(S['logo']),(320,112)),'logo-320.png','logo')
    app=P.grade(Image.open(S['app']).resize((64,64),Image.Resampling.BOX))
    for n in [64,192,512]:save(app.resize((n,n),Image.Resampling.NEAREST),f'app-icon-{n}.png','app')
    board=Image.new('RGBA',(192,86),(255,246,227,255))
    for i,row in enumerate([0,2,3]):
        fr=walk[row*6].resize((64,85),Image.Resampling.NEAREST);board.paste(fr,(i*64,0),fr)
    board.convert('RGB').save(E/'character-three-views-64.png');walk[12].resize((64,85),Image.Resampling.NEAREST).save(E/'character-side-64.png')
    metrics={r['path']:P.metric(Image.open(ROOT/r['path'])) for r in P.records}
    result=dict(status='EXECUTED',generator=DATA['tool'],actualModelSlug=None,modelNote=DATA['modelNote'],palette=P.palette,masters=[dict(path=j['master'],sha256=sha(S[j['id']]),bytes=S[j['id']].stat().st_size) for j in DATA['jobs']],records=P.records,frameReceipts=wr+ar,qualityMetrics=metrics,runtimeBytes=sum(r['bytes'] for r in P.records),pipeline='Generated masters. True alpha; connected exterior cream removal for sheet portraits. Shared 68-color palette, native48x64 poses, BOX then nearest. Directional light/shadow masks derived from generated luminance. Retained frames explicitly licensed; no synthetic bobbing.')
    (OUT/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps(dict(masters=len(result['masters']),runtimeImages=len(P.records),runtimeBytes=result['runtimeBytes'],characterGates={k:v for k,v in metrics.items() if any(w in k for w in ['walk.png','actions.png','miri-'])}),indent=2))
if __name__=='__main__':main()
