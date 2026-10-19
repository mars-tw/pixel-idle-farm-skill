"""R87 generated source -> shared native pixels. No drawn stand-in assets."""
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter, ImageEnhance
from collections import deque
import importlib.util,json,hashlib
ROOT=Path(__file__).resolve().parents[1]
def module(name,file):
 s=importlib.util.spec_from_file_location(name,ROOT/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
P=module('r85','tools/process-r85-art.py');Q=module('r86','tools/process-r86-art.py')
OUT=ROOT/'assets/generated/r87';E=ROOT/'docs/evidence/r87-art';P.OUT=OUT;P.records=[]
DATA=json.loads((ROOT/'docs/art/PROMPTS_R87.json').read_text(encoding='utf8'));S={j['id']:ROOT/j['master'] for j in DATA['jobs']}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(im,name,src):return P.save(im,name,src)
def clean(im):
 im=im.convert('RGBA');a=im.getchannel('A').point(lambda v:255 if v>=128 else 0);im.putalpha(a);im.paste((0,0,0,0),mask=ImageOps.invert(a));return im
def exterior(im):
 im=im.convert('RGBA');px=im.load();todo=deque([(x,y) for x in range(im.width) for y in [0,im.height-1]]+[(x,y) for y in range(im.height) for x in [0,im.width-1]]);seen=set()
 while todo:
  x,y=todo.popleft()
  if (x,y) in seen or not(0<=x<im.width and 0<=y<im.height):continue
  seen.add((x,y));r,g,b,a=px[x,y]
  if r>205 and g>195 and b>155 and max(r,g,b)-min(r,g,b)<90:
   px[x,y]=(0,0,0,0);todo.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
 return im
def trim_fragments(im):
 im=clean(im);a=im.getchannel('A');px=a.load();seen=set();groups=[]
 for y in range(im.height):
  for x in range(im.width):
   if (x,y) in seen or not px[x,y]:continue
   todo=[(x,y)];group=[];seen.add((x,y))
   while todo:
    cx,cy=todo.pop();group.append((cx,cy))
    for nx,ny in [(cx-1,cy),(cx+1,cy),(cx,cy-1),(cx,cy+1)]:
     if 0<=nx<im.width and 0<=ny<im.height and (nx,ny) not in seen and px[nx,ny]:seen.add((nx,ny));todo.append((nx,ny))
   groups.append(group)
 limit=max(map(len,groups))*.012
 for group in groups:
  if len(group)<limit:
   for xy in group:im.putpixel(xy,(0,0,0,0))
 return im
def main():
 OUT.mkdir(parents=True,exist_ok=True);E.mkdir(parents=True,exist_ok=True);overrides={};receipts=[];framesBy={}
 # Actual generated poses, left/right full-row normalization only.
 for name,rows in [('walk',4),('actions',8)]:
  source=clean(Image.open(S[name]));source=source.crop(source.getbbox())
  cells=Q.slices(source,4 if name=='walk' else 7)
  if name=='walk':cells=cells[:6]+cells[12:18]+cells[6:12]+cells[18:24]
  else:
   # Generator returned seven rows: harvest-right missing. Mirror six complete
   # left limb poses, retain generated back row; never stretch an assumed 8-row grid.
   cells=cells[:36]+[ImageOps.mirror(v) for v in cells[30:36]]+cells[36:42]
  cells=[trim_fragments(v) for v in cells];boxes=[im.getbbox() for im in cells]
  width=48 if name=='walk' else 72
  scales=[min((width-4)/max(b[2]-b[0] for b in boxes[r*6:r*6+6]),60/(boxes[r*6][3]-boxes[r*6][1])) for r in range(rows)]
  seq=[P.fit(v,(width,64),scales[i//6]) for i,v in enumerate(cells)];framesBy[name]=seq;sheet=Image.new('RGBA',(width*6,rows*64))
  for i,v in enumerate(seq):sheet.paste(v,(i%6*width,i//6*64))
  save(sheet,name+'.png',name)
  for row in range(rows):
   group=seq[row*6:row*6+6];masks=[v.getchannel('A').tobytes() for v in group]
   receipts.append(dict(sheet=name,row=row,hashes=[hashlib.sha256(v.tobytes()).hexdigest() for v in group],alphaDifferences=[sum(a!=b for a,b in zip(masks[i],masks[i+1]))/(width*64) for i in range(5)],lowerBodyChangedFraction=sum(a!=b for a,b in zip(group[0].crop((0,32,width,64)).tobytes(),group[1].crop((0,32,width,64)).tobytes()))/(width*32*4)))
  sheet.resize((576,rows*128),Image.Resampling.NEAREST).save(E/(name+'-poses.png'))
  if name=='walk':overrides['walk']=dict(image='assets/generated/r87/walk.png',meta=dict(w=288,h=256),frames={f'walk_{d}_{c:02}':dict(x=c*48,y=r*64,w=48,h=64,anchor=[.5,.97]) for r,d in enumerate(['down','left','right','up']) for c in range(6)})
  else:
   old=json.loads((ROOT/'assets/generated/r86/atlas.json').read_text())['overrides']['actions'];actionPath=save(sheet,'farming-actions.png','actions; 72x64 visual canvas keeps limb reach without shrinking body')
   for key,f in old['frames'].items():
    base,d,ix=key.rsplit('_',2)
    if base not in ['water','sow','harvest','collect','use']:continue
    row=['down','left','right','up'].index('right' if d=='side' else d)+(0 if base=='water' else 4)
    old['frames'][key]=dict(x=int(ix)*72,y=row*64,w=72,h=64,anchor=[.5,.97],image=actionPath,meta=dict(w=432,h=512))
   overrides['actions']=old
 reference=Image.open(S['sheet'])
 for i in range(3):save(P.fit(exterior(reference.crop((round(i*reference.width/3),round(reference.height*.65),round((i+1)*reference.width/3),reference.height))),(80,80)),f'miri-{i}.png','sheet')
 board=Image.new('RGBA',(192,86),(255,246,227,255))
 for i,row in enumerate([0,2,3]):
  v=framesBy['walk'][row*6].resize((64,85),Image.Resampling.NEAREST);board.paste(v,(i*64,0),v)
 board.convert('RGB').save(E/'character-three-views-64.png')
 # Generated low-noise terrain; keep exact original autotile frame contracts.
 old=json.loads((ROOT/'assets/generated/r85/atlas.json').read_text())['overrides']['terrain'];terrain=Image.open(ROOT/old['image']).convert('RGBA');master=Image.open(S['terrain'])
 # Compress generated grass contrast before native16 pass, so a repeating ground
 # doesn't compete with faces or leaves. These are graded source pixels, not drawn dots.
 grassColors=['#788F50','#7B9352','#7E9755','#819B58','#849F5B','#87A35E']
 P.palette.extend(c for c in grassColors if c not in P.palette)
 colors=[tuple(bytes.fromhex(c[1:])) for c in P.palette];P.pal.putpalette([v for c in colors for v in c]+list(colors[0])*(256-len(colors)))
 tiles=[]
 for i in range(4):
  fr=P.cell(master,i%2,i//2,2,2).convert('RGB').resize((16,16),Image.Resampling.BOX)
  fr=ImageEnhance.Contrast(fr).enhance(.6);fr=Image.blend(fr,Image.new('RGB',fr.size,'#7E9755'),.3)
  tiles.append(P.grade(fr).resize((32,32),Image.Resampling.NEAREST))
 for key,f in old['frames'].items():
  if key.startswith('grass_'):terrain.paste(tiles[sum(map(ord,key))%4],(f['x'],f['y']))
 overrides['terrain']={**old,'image':save(terrain,'terrain.png','terrain; retained soil/path/water R85')}
 # Apple tree replaces the actual existing fruit-tree frame, no new world object.
 tree=P.fit(Image.open(S['tree']),(96,112));treePath=save(tree,'apple-tree.png','tree')
 structures=json.loads((ROOT/'assets/generated/r83/atlas.json').read_text())['overrides']['structures']
 # Runtime fruit trees come from structures2; exact frame ids read from maps.
 manifest=json.loads((ROOT/'assets/generated/v4/manifest.json').read_text(encoding='utf8'))
 for key,spec in manifest['sheets'].items():
  mp=json.loads((ROOT/spec['map']).read_text(encoding='utf8'))
  names=[n for n in mp['frames'] if n.startswith('fruit_tree') or (key=='structures' and n in ['oak','oak_spring'])]
  if names:overrides[key]=dict(image=treePath,meta=dict(w=96,h=112),frames={n:dict(x=0,y=0,w=96,h=112,anchor=[.5,.97]) for n in names})
 # Projection preserves soft alpha only at penumbra, actual leaf luminance drives mask.
 leaf=Image.open(S['leaf']).convert('RGBA').resize((192,128),Image.Resampling.BOX)
 light=Image.new('RGBA',leaf.size);shadow=Image.new('RGBA',leaf.size);lp=[];sp=[]
 for r,g,b,a in leaf.getdata():
  y=(.2126*r+.7152*g+.0722*b)/255
  la=min(235,round((a/255)**.5*max(0,(y-.24)/.5)*230));sa=round(a*max(0,(.72-y)/.72)*.68)
  lp.append((255,231,155,la) if la else (0,0,0,0));sp.append((40,61,36,sa) if sa else (0,0,0,0))
 light.putdata(lp);shadow.putdata(sp);save(light,'leaf-light.png','leaf luminance');save(shadow,'canopy-shadow.png','leaf inverse luminance');save(Image.alpha_composite(shadow,light),'leaf-ground.png','leaf combined masks')
 # Quiet paper center and inset binding derived from generated texture.
 panel=Image.open(S['panel']);paper=P.grade(panel.crop((panel.width//3,panel.height//4,panel.width*3//4,panel.height*3//4)).resize((128,128),Image.Resampling.BOX));save(paper,'paper-128.png','panel')
 # Find the highest red contrast vertical strip, retaining generated weave pixels.
 small=P.grade(panel.resize((128,128),Image.Resampling.BOX));scores=[sum(1 for r,g,b,a in small.crop((x,0,x+1,128)).getdata() if r>g*1.25 and r>b*1.35) for x in range(45)];x=max(range(4,40),key=lambda c:sum(scores[c-4:c+4]));save(small.crop((x-4,0,x+4,128)),'binding-8.png','panel woven strip')
 icons=clean(Image.open(S['icons']))
 for i,n in enumerate(['wheat','basket','water','note','hat','sprout']):save(P.fit(P.cell(icons,i%3,i//3,3,2),(32,32)),n+'-32.png','icons')
 save(P.fit(Image.open(S['logo']),(320,112)),'logo-320.png','logo')
 app=P.grade(Image.open(S['app']).resize((64,64),Image.Resampling.BOX))
 for n in [64,192,512]:save(app.resize((n,n),Image.Resampling.NEAREST),f'app-icon-{n}.png','app')
 (OUT/'atlas.json').write_text(json.dumps(dict(overrides=overrides),indent=2)+'\n',encoding='utf8',newline='\n')
 result=dict(status='EXECUTED',generator=DATA['tool'],actualModelSlug=None,modelNote=DATA['modelNote'],palette=P.palette,masters=[dict(path=j['master'],sha256=sha(S[j['id']]),bytes=S[j['id']].stat().st_size) for j in DATA['jobs']],records=P.records,frameReceipts=receipts,qualityMetrics={r['path']:P.metric(Image.open(ROOT/r['path'])) for r in P.records},runtimeBytes=sum(r['bytes'] for r in P.records),pipeline='Tool true alpha -> threshold and zero transparent RGB; connected exterior cream mask for portraits. Shared 74 colors, native48x64 walk and72x64 action, actual six limb poses, complete-row reordering/mirroring. Generated leaf luminance masks preserve penumbra. Original soil/path, axe/build and licenses retained.')
 (OUT/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n');print(json.dumps(dict(masters=len(result['masters']),runtimeImages=len(P.records),bytes=result['runtimeBytes'],actorGates={k:v for k,v in result['qualityMetrics'].items() if any(n in k for n in ['walk.png','actions.png','miri-'])}),indent=2))
if __name__=='__main__':main()
