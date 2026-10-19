"""R89 imagegen masters -> controlled native pixels; no synthetic motion."""
from pathlib import Path
from PIL import Image,ImageOps,ImageFilter
import importlib.util,json,hashlib,shutil
from collections import deque
R=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('p85',R/'tools/process-r85-art.py');P=importlib.util.module_from_spec(spec);spec.loader.exec_module(P)
P.OUT=R/'assets/generated/r89';P.OUT.mkdir(parents=True,exist_ok=True);P.records=[]
D=json.loads((R/'docs/art/PROMPTS_R89.json').read_text(encoding='utf8'));S={j['id']:R/j['master'] for j in D['jobs']}
palette=json.loads((R/'assets/generated/r88/manifest.json').read_text())['palette']+['#395847','#799C54','#B5C56C','#DCE69A','#F3D68C','#293D46']
colors=[tuple(bytes.fromhex(c[1:])) for c in palette];P.pal.putpalette([v for c in colors for v in c]+list(colors[0])*(256-len(colors)))
def zero(im):
 im=im.convert('RGBA');im.paste((0,0,0,0),mask=im.getchannel('A').point(lambda a:255 if a==0 else 0));return im
def save(im,name,source):return P.save(zero(im),name,source)
def exterior(im):
 im=im.convert('RGBA');pix=im.load();q=deque([(x,y) for x in range(im.width) for y in [0,im.height-1]]+[(x,y) for y in range(im.height) for x in [0,im.width-1]]);seen=set()
 while q:
  x,y=q.popleft()
  if (x,y) in seen or not(0<=x<im.width and 0<=y<im.height):continue
  seen.add((x,y));r,g,b,a=pix[x,y]
  if r>215 and g>200 and b>160 and max(r,g,b)-min(r,g,b)<80:
   pix[x,y]=(0,0,0,0);q.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
 return zero(im)
sheet=Image.open(S['character'])
for i in range(3):save(P.fit(exterior(sheet.crop((round(i*sheet.width/3),round(sheet.height*.635),round((i+1)*sheet.width/3),sheet.height))),(80,80)),f'miri-{i}.png','character expression'+str(i))
garden=P.grade(Image.open(S['garden']).resize((1536,1024),Image.Resampling.BOX));save(garden,'garden-1536.webp','garden; one continuous painting, native density matched to48px actors, no tiled crops')
objects=Image.open(S['objects']).convert('RGBA');icons=Image.open(S['icons']).convert('RGBA')
for i,name in enumerate(['wheat','basket','water','note','hat','sprout']):save(P.fit(P.cell(icons,i%3,i//3,3,2),(32,32)),name+'-32.png','icons cell'+str(i))
baskets=[P.fit(P.cell(objects,i,1,3,2),(24,24)) for i in range(3)]
for i,im in enumerate(baskets):save(im,'creel-'+str(i)+'.png','objects basket '+str(i))
for i,name in enumerate(['sprout','grow','ripe']):
 im=P.fit(P.cell(objects,i,0,3,2),(48,48));size=[28,37,46][i];small=im.resize((size,size),Image.Resampling.NEAREST);out=Image.new('RGBA',(48,48));out.paste(small,((48-size)//2,48-size));save(out,f'wheat-{name}-48.png','objects growth '+str(i))
panel=Image.open(S['panel']);save(Image.blend(panel.crop((panel.width//3,panel.height//3,panel.width*2//3,panel.height*2//3)).convert('RGB').resize((128,128),Image.Resampling.BOX),Image.new('RGB',(128,128),'#fff6e3'),.82),'paper-128.png','panel quiet center')
save(P.grade(panel.crop((8,panel.height//5,panel.width//12,panel.height*4//5)).resize((8,128),Image.Resampling.BOX)),'binding-8.png','panel cloth spine')
save(P.fit(Image.open(S['logo']),(320,112)),'logo-320.png','logo exactly four characters')
app=P.grade(Image.open(S['app']).resize((64,64),Image.Resampling.BOX))
for n in [64,192,512]:save(app.resize((n,n),Image.Resampling.NEAREST),f'app-icon-{n}.png','app')
save(P.grade(Image.open(S['story']).resize((512,256),Image.Resampling.BOX)),'table-result-512.webp','story; three real chairs, small basket')
story=Image.open(S['story']);save(P.grade(story.crop((round(story.width*.30),round(story.height*.39),round(story.width*.57),round(story.height*.99))).resize((256,280),Image.Resampling.BOX)),'chair-detail-256.webp','story; exact existing third-chair crop, no new illustration')
# Actual continuous alpha is preserved on the luminous overlay and projected leaf mask.
light=Image.open(S['light']).convert('RGBA').resize((384,256),Image.Resampling.BOX);save(light,'sunshaft-384.png','light; true RGBA upper-right rays')
save(light.crop((0,142,325,256)).resize((192,96),Image.Resampling.BOX),'leaf-light.png','light ground pool crop; no generated dots')
old=Image.open(R/'assets/generated/r88/canopy-shadow.png').convert('RGBA');save(old,'canopy-shadow.png','retained R88 actual leaf mask')
# Remove the disconnected chin fragment from the retained portrait, keep largest alpha component.
from collections import deque
face=Image.open(R/'assets/generated/r84/grey-2.png').convert('RGBA');a=face.getchannel('A');pts={(x,y) for y in range(face.height) for x in range(face.width) if a.getpixel((x,y))>0};groups=[]
while pts:
 first=pts.pop();g={first};q=deque([first])
 while q:
  x,y=q.popleft()
  for n in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
   if n in pts:pts.remove(n);g.add(n);q.append(n)
 groups.append(g)
keep=max(groups,key=len)
for y in range(face.height):
 for x in range(face.width):
  if (x,y) not in keep:face.putpixel((x,y),(0,0,0,0))
save(face,'grey-2.png','retained R84 portrait; only disconnected alpha scraps removed')
prior=json.loads((R/'assets/generated/r88/atlas.json').read_text())['overrides'];atlas={'overrides':{}};receipts=[]
# New generated open creel, mapped to the backpack region in each existing true pose.
# Keep every arm, leg and tool pose intact. Only basket pixels may change alpha.
for kind,w,rows in [('walk',48,4),('farming-actions',72,8)]:
 src=Image.open(R/f'assets/generated/r88/{kind}.png').convert('RGBA');im=src.copy();outside=0
 for row in range(rows):
  direction=row%4
  boxes=({1:(27,21,45,40),2:(3,21,21,40),3:(12,21,36,42)} if kind=='walk' else {1:(43,22,66,44),2:(7,22,29,44),3:(23,23,50,45)})
  if direction not in boxes:continue
  x0,y0,x1,y1=boxes[direction];b=baskets[1 if direction!=3 else 2].resize((x1-x0,y1-y0),Image.Resampling.NEAREST)
  if direction==2:b=ImageOps.mirror(b)
  for col in range(6):
   for y in range(y0,y1):
    for x in range(x0,x1):
     xy=(col*w+x,row*64+y);r,g,bl,a=src.getpixel(xy);v=b.getpixel((x-x0,y-y0))
     # Only original warm basket/cloth pixels, not hands/shirt/green overalls.
     if a and r>g*1.13 and r>bl*1.4 and y<y1 and v[3]:im.putpixel(xy,(*v[:3],a))
 beforelegs=b''.join(src.crop((c*w,r*64+48,(c+1)*w,(r+1)*64)).tobytes() for r in range(rows) for c in range(6))
 afterlegs=b''.join(im.crop((c*w,r*64+48,(c+1)*w,(r+1)*64)).tobytes() for r in range(rows) for c in range(6))
 assert beforelegs==afterlegs and im.getchannel('A').tobytes()==src.getchannel('A').tobytes()
 dest=save(P.grade(im),kind+'.png','R88 true poses + generated R89 creel pixels only');receipts.append(dict(sheet=kind,frames=rows*6,identicalAlphaToR88=True,lowerLegsUnchanged=True))
 key='walk' if kind=='walk' else 'actions';v=prior[key]
 atlas['overrides'][key]={**v,'image':dest,'frames':{k:({**f,'image':dest} if kind=='farming-actions' and str(f.get('image','')).endswith('farming-actions.png') else f) for k,f in v['frames'].items()}}
 if kind=='walk':atlas['overrides'][key]['frames']={k:{**f,'image':dest} for k,f in v['frames'].items()}
# Retain seed and mature-stage identity; replace wheat only at the same stage IDs.
base=json.loads((R/'assets/generated/r83/atlas.json').read_text())['overrides']['crops'];cf={}
for k in base['frames']:
 if k.startswith('wheat_'):
  phase=k.split('_')[-1];name={'sprout':'sprout','young':'grow','ready':'ripe'}.get(phase)
  if name:cf[k]=dict(x=0,y=0,w=48,h=48,anchor=[.5,1],image=f'assets/generated/r89/wheat-{name}-48.png',meta=dict(w=48,h=48))
atlas['overrides']['crops']={**base,'frames':cf}
(P.OUT/'atlas.json').write_text(json.dumps(atlas,indent=2)+'\n',encoding='utf8',newline='\n')
metrics={v['path']:P.metric(Image.open(R/v['path'])) for v in P.records if any(s in v['path'] for s in ['walk.png','farming-actions.png','miri-'])}
masters=[dict(path=j['master'],sha256=P.sha(R/j['master']),bytes=(R/j['master']).stat().st_size) for j in D['jobs']]
manifest=dict(status='EXECUTED',generator=D['tool'],actualModelSlug=None,palette=palette,masters=masters,records=P.records,actorReceipts=receipts,qualityMetrics=metrics,runtimeBytes=sum(v['bytes'] for v in P.records),postprocessing='RGBA alpha retained; invisible RGB zero; native pixel palette pass; no limb or impact changes; old licenses retained')
(P.OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n');print(json.dumps(dict(masters=len(masters),images=len(P.records),metrics=metrics)))
