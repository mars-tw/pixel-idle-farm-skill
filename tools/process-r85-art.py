"""Extract imagegen masters; no procedural replacement art. Shared palette and true alpha."""
from pathlib import Path
from PIL import Image,ImageOps,ImageFilter
import json,hashlib,colorsys
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/generated/r85';E=ROOT/'docs/evidence/r85-art'
PROMPTS=json.loads((ROOT/'docs/art/PROMPTS_R85.json').read_text(encoding='utf-8'))
S={j['id']:ROOT/j['master'] for j in PROMPTS['jobs']}
palette=json.loads((ROOT/'assets/generated/r84/manifest.json').read_text(encoding='utf-8'))['palette']
colors=[tuple(bytes.fromhex(c[1:])) for c in palette];pal=Image.new('P',(1,1));pal.putpalette([v for c in colors for v in c]+list(colors[0])*(256-len(colors)))
records=[];overrides={};receipts=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def grade(im):
 im=im.convert('RGBA');a=im.getchannel('A').point(lambda v:255 if v>=128 else 0)
 out=im.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA');out.putalpha(a);out.paste((0,0,0,0),mask=ImageOps.invert(a));return out
def cell(im,c,r,cols,rows):return im.crop((round(c*im.width/cols),round(r*im.height/rows),round((c+1)*im.width/cols),round((r+1)*im.height/rows)))
def fit(im,size,scale=None):
 im=im.convert('RGBA');b=im.getchannel('A').point(lambda v:255 if v>=128 else 0).getbbox();assert b,'empty source';cut=im.crop(b)
 scale=scale or min((size[0]-4)/cut.width,(size[1]-4)/cut.height);cut=cut.resize((max(1,round(cut.width*scale)),max(1,round(cut.height*scale))),Image.Resampling.BOX)
 canvas=Image.new('RGBA',size);canvas.paste(cut,((size[0]-cut.width)//2,size[1]-cut.height-2));return grade(canvas)
def save(im,name,source):
 p=OUT/name;p.parent.mkdir(parents=True,exist_ok=True)
 if p.suffix=='.webp':im.convert('RGB').save(p,lossless=True,method=6)
 else:im.save(p,optimize=True)
 records.append(dict(path=p.relative_to(ROOT).as_posix(),source=source,size=list(im.size),bytes=p.stat().st_size,sha256=sha(p)));return p.relative_to(ROOT).as_posix()
def metric(im):
 px=[p for p in im.convert('RGBA').getdata() if p[3]];ys=[(.2126*r+.7152*g+.0722*b)/255 for r,g,b,a in px];ss=[colorsys.rgb_to_hsv(r/255,g/255,b/255)[1] for r,g,b,a in px]
 m=dict(brightness=sum(ys)/len(ys),nearBlackFraction=sum(y<.1 for y in ys)/len(ys),saturation=sum(ss)/len(ss),lowSaturationFraction=sum(s<.2 for s in ss)/len(ss));m['gatePass']=.3<=m['brightness']<=.75 and m['nearBlackFraction']<.35 and m['saturation']>=.32 and m['lowSaturationFraction']<.2;return m
def packed(name,rows,names):
 im=Image.open(S[name]).convert('RGBA');a=im.getchannel('A').point(lambda v:255 if v>=128 else 0)
 # The generator's outer gutters are not uniform. Locate transparent gutters rather
 # than slicing blindly through hats/boots at nominal cell boundaries.
 yc=[0]
 for row in range(1,rows):
  ideal=round(row*im.height/rows);radius=round(im.height/rows*.18)
  candidates=range(max(yc[-1]+20,ideal-radius),min(im.height,ideal+radius))
  yc.append(min(candidates,key=lambda y:(sum(v>0 for v in a.crop((0,y,im.width,y+1)).getdata()),abs(y-ideal))))
 yc.append(im.height);cells=[]
 for row in range(rows):
  strip=im.crop((0,yc[row],im.width,yc[row+1]));mask=strip.getchannel('A').point(lambda v:255 if v>=128 else 0);xc=[0]
  for col in range(1,6):
   ideal=round(col*im.width/6);radius=round(im.width/6*.38)
   candidates=range(max(xc[-1]+20,ideal-radius),min(im.width,ideal+radius))
   xc.append(min(candidates,key=lambda x:(sum(v>0 for v in mask.crop((x,0,x+1,strip.height)).getdata()),abs(x-ideal))))
  xc.append(im.width)
  cells.extend(strip.crop((xc[c],0,xc[c+1],strip.height)) for c in range(6))
 # The generated left-water row turns right after its leading pose. Normalize those
 # five limb poses, then mirror all six for right; never synthesize motion from one pose.
 if name=='actions':
  for c in range(1,6):cells[1*6+c]=ImageOps.mirror(cells[1*6+c])
  for c in range(6):cells[2*6+c]=ImageOps.mirror(cells[1*6+c])
 boxes=[c.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox() for c in cells]
 scale=min(44/max(b[2]-b[0] for b in boxes),60/max(b[3]-b[1] for b in boxes));sheet=Image.new('RGBA',(288,rows*64));frames={};native=[]
 for i,im in enumerate(cells):
  fr=fit(im,(48,64),scale);sheet.paste(fr,(i%6*48,i//6*64));native.append(fr);frames[names[i]]=dict(x=i%6*48,y=i//6*64,w=48,h=64,anchor=[.5,.97])
 for row in range(rows):
  seq=native[row*6:row*6+6];a=seq[0].crop((0,32,48,64));b=seq[1].crop((0,32,48,64));receipts.append(dict(sheet=name,row=row,lowerBodyChangedFraction=sum(x!=y for x,y in zip(a.getdata(),b.getdata()))/1536,hashes=[hashlib.sha256(v.tobytes()).hexdigest() for v in seq]))
 p=save(sheet,name+'.png',name);return dict(image=p,meta=dict(w=sheet.width,h=sheet.height),frames=frames),native
def main():
 OUT.mkdir(parents=True,exist_ok=True);E.mkdir(parents=True,exist_ok=True)
 reference=Image.open(S['sheet']).convert('RGBA')
 for i in range(3):
  face=reference.crop((round(i*reference.width/3),round(reference.height*.65),round((i+1)*reference.width/3),reference.height));px=face.load()
  # Reference-sheet cream is a deliberate matte; remove only its connected exterior.
  from collections import deque
  todo=deque([(x,y) for x in range(face.width) for y in [0,face.height-1]]+[(x,y) for y in range(face.height) for x in [0,face.width-1]]);seen=set()
  while todo:
   x,y=todo.popleft()
   if (x,y) in seen or x<0 or y<0 or x>=face.width or y>=face.height:continue
   seen.add((x,y));r,g,b,a=px[x,y]
   if r>205 and g>195 and b>155 and max(r,g,b)-min(r,g,b)<90:
    px[x,y]=(0,0,0,0);todo.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
  save(fit(face,(80,80)),f'miri-{i}.png','sheet')
 dirs=['down','left','right','up'];walk,native=packed('walk',4,[f'walk_{d}_{c:02}' for d in dirs for c in range(6)]);overrides['walk']=walk
 actions,aframes=packed('actions',8,[f'{a}_{d}_{c:02}' for a in ['water','tend'] for d in dirs for c in range(6)])
 old=json.loads((ROOT/'assets/generated/r83/atlas.json').read_text())['overrides']['actions'];sheet=Image.open(ROOT/old['image']).convert('RGBA')
 for name,f in old['frames'].items():
  base,d,ix=name.rsplit('_',2);ix=int(ix)
  if base not in ['water','sow','harvest','collect','use']:continue
  direction='right' if d=='side' else d;row=dirs.index(direction)+(0 if base=='water' else 4)
  seq=[0,1,2,3,4,5] if base=='water' else [0,1,2,3,4,5]
  sheet.paste(aframes[row*6+seq[ix]],(f['x'],f['y']))
 old['image']=save(grade(sheet),'farming-actions.png','actions + retained v4 axe/build');overrides['actions']=old
 # World and story both share the same palette and nearest-neighbor clusters.
 story=Image.open(S['story'])
 for i,name in enumerate(['welcome','basket','table-result','doorstep-result']):
  fr=grade(ImageOps.fit(cell(story,i%2,i//2,2,2),(128,64),method=Image.Resampling.BOX)).resize((384,192),Image.Resampling.NEAREST);save(fr,name+'-384.webp','story')
 panel=grade(Image.open(S['panel']).resize((128,128),Image.Resampling.BOX));save(panel,'album-128.png','panel');save(panel.crop((38,35,118,115)).resize((128,128),Image.Resampling.NEAREST),'paper-128.png','panel')
 icons=Image.open(S['icons'])
 for i,name in enumerate(['stamp','wheat','basket','water','sun','note','bow','cups']):save(fit(cell(icons,i%4,i//4,4,2),(32,32)),name+'-32.png','icons')
 save(fit(Image.open(S['logo']),(320,112)),'logo-320.png','logo')
 app=grade(Image.open(S['app']).resize((64,64),Image.Resampling.BOX))
 for n in [64,192,512]:save(app.resize((n,n),Image.Resampling.NEAREST),f'app-icon-{n}.png','app')
 materials=Image.open(S['terrain']);tiles=[]
 for r in range(2):
  for c in range(3):
   groundNative=cell(materials,c,r,3,2).convert('RGBA').resize((16,16),Image.Resampling.BOX)
   if c==0 or (r==0 and c==1):groundNative=Image.blend(groundNative,groundNative.filter(ImageFilter.GaussianBlur(7)),.78)
   tiles.append(grade(groundNative).resize((32,32),Image.Resampling.NEAREST))
 old=json.loads((ROOT/'assets/generated/r84/atlas.json').read_text())['overrides']['terrain'];original=Image.open(ROOT/old['image']).convert('RGBA');terrain=original.copy()
 for name,f in old['frames'].items():
  if not name.startswith(('grass','path','soil','water')):continue
  idx=0 if name.startswith('grass') else 1 if name.startswith('path') else 4 if name.startswith('soil_wet') else 2 if name.startswith('soil') else 5
  tile=tiles[idx].copy()
  if idx and not name.endswith('_c'):
   ref=original.crop((f['x'],f['y'],f['x']+32,f['y']+32));mask=Image.new('L',(32,32));mask.putdata([255 if g>r*1.03 and g>b*1.08 else 0 for r,g,b,a in ref.getdata()]);tile.paste(tiles[0],mask=mask)
  terrain.paste(tile,(f['x'],f['y']))
 overrides['terrain']={**old,'image':save(grade(terrain),'terrain.png','terrain')}
 # A generated basket replaces the map keepsake; the original porch remains licensed.
 icon=Image.open(OUT/'basket-32.png');props=Image.open(ROOT/'assets/generated/r84/keepsakes.png').convert('RGBA');props.paste(icon.resize((96,96),Image.Resampling.NEAREST),(0,0));keep=json.loads((ROOT/'assets/generated/r84/atlas.json').read_text())['overrides']['keepsakes'];overrides['keepsakes']={**keep,'image':save(props,'keepsakes.png','icons + retained R84 porch/shadows')}
 (OUT/'atlas.json').write_text(json.dumps(dict(overrides=overrides),indent=2)+'\n',encoding='utf-8',newline='\n')
 board=Image.new('RGBA',(192,64),(255,246,227,255))
 for i,row in enumerate([0,2,3]):board.paste(native[row*6],(i*64+8,0),native[row*6])
 board.convert('RGB').save(E/'character-three-views-64.png');native[12].resize((64,85),Image.Resampling.NEAREST).save(E/'character-side-64.png')
 contact=Image.new('RGBA',(288,64*3),(255,246,227,255));contact.paste(Image.open(OUT/'walk.png'),(0,0));contact.crop((0,0,288,192)).convert('RGB').save(E/'walk-poses.png')
 data=dict(status='EXECUTED',generator='image_gen.imagegen',actualModelSlug=None,modelNote=PROMPTS['modelNote'],palette=palette,masters=[dict(path=j['master'],bytes=S[j['id']].stat().st_size,sha256=sha(S[j['id']])) for j in PROMPTS['jobs']],records=records,frameReceipts=receipts,qualityMetrics={r['path']:metric(Image.open(ROOT/r['path'])) for r in records},runtimeBytes=sum(r['bytes'] for r in records),pipeline='True alpha preserved, binary alpha at native size, clear transparent RGB, shared 68-color palette; BOX native reduction + nearest-neighbor; lossless WebP scenes. Atlas crop/mirror only; no synthesized character motion.')
 (OUT/'manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n');print(json.dumps(dict(masters=len(data['masters']),runtimeImages=len(records),bytes=data['runtimeBytes'],characterGates={r['path']:data['qualityMetrics'][r['path']] for r in records if 'walk.png' in r['path'] or 'farming-actions' in r['path']}),indent=2))
if __name__=='__main__':main()
