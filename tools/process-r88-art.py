"""Generated pixels only: palette, native-size crops, true-alpha cleanup and receipts."""
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter
import importlib.util, json, hashlib

R=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('r85',R/'tools/process-r85-art.py')
P=importlib.util.module_from_spec(spec);spec.loader.exec_module(P)
P.OUT=R/'assets/generated/r88';P.OUT.mkdir(parents=True,exist_ok=True);P.records=[]
D=json.loads((R/'docs/art/PROMPTS_R88.json').read_text(encoding='utf8'))
S={j['id']:R/j['master'] for j in D['jobs']}
palette=json.loads((R/'assets/generated/r87/manifest.json').read_text(encoding='utf8'))['palette']
palette+=['#536979','#45596B','#BBCB80','#E4D373','#9DA95D','#FFF1B5']
P.palette=palette;colors=[tuple(bytes.fromhex(c[1:])) for c in palette]
P.pal.putpalette([v for c in colors for v in c]+list(colors[0])*(256-len(colors)))

def save(im,name,source):return P.save(im,name,source)
def zero(im):
 im=im.convert('RGBA');a=im.getchannel('A');im.paste((0,0,0,0),mask=a.point(lambda v:255 if v==0 else 0));return im
def cutout(im):
 return P.grade(im)
def exterior(im):
 # Only connected cream exterior; interior shirt and eye whites stay intact.
 from collections import deque
 im=im.convert('RGBA');pix=im.load();q=deque([(x,y) for x in range(im.width) for y in [0,im.height-1]]+[(x,y) for y in range(im.height) for x in [0,im.width-1]]);seen=set()
 while q:
  x,y=q.popleft()
  if (x,y) in seen or not(0<=x<im.width and 0<=y<im.height):continue
  seen.add((x,y));r,g,b,a=pix[x,y]
  if r>215 and g>200 and b>160 and max(r,g,b)-min(r,g,b)<80:
   pix[x,y]=(0,0,0,0);q.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
 return zero(im)

garden=P.grade(Image.open(S['garden']).resize((384,384),Image.Resampling.BOX))
save(garden,'garden-384.webp','garden; shared palette native384')
save(P.grade(Image.open(S['garden']).crop((400,400,680,680)).resize((32,32),Image.Resampling.BOX)),'grass-32.png','garden central grass crop')
pathtex=P.grade(Image.open(S['garden']).crop((1020,180,1190,350)).resize((32,32),Image.Resampling.BOX))
save(pathtex,'path-32.png','garden stepping-stone path crop')
objects=Image.open(S['objects']).convert('RGBA')
for i,name in enumerate(['soil-dry','soil-wet','soil-moist','bucket','fence','flowers']):
 save(P.fit(P.cell(objects,i%3,i//3,3,2),(64,64)),name+'-64.png','objects; generated 3x2 cell '+str(i))
icons=Image.open(S['icons'])
for i,name in enumerate(['wheat','basket','water','note','hat','sprout']):
 save(P.fit(P.cell(icons,i%3,i//3,3,2),(32,32)),name+'-32.png','icons')
sheet=Image.open(S['character'])
for i in range(3):
 fr=sheet.crop((round(i*sheet.width/3),round(sheet.height*.635),round((i+1)*sheet.width/3),sheet.height))
 save(P.fit(exterior(fr),(80,80)),f'miri-{i}.png','character expression '+str(i))
paper=Image.open(S['panel'])
quiet=paper.crop((paper.width//3,paper.height//3,paper.width*2//3,paper.height*2//3)).convert('RGB').resize((128,128),Image.Resampling.BOX)
quiet=Image.blend(quiet,Image.new('RGB',quiet.size,'#fff6e3'),.9)
save(quiet.convert('RGBA'),'paper-128.png','panel quiet center,90percent cream grade; material keeps subtle tonal range')
save(P.grade(paper.resize((256,256),Image.Resampling.BOX)),'album-256.png','panel complete frame')
save(P.grade(paper.crop((5,paper.height//4,paper.width//12,paper.height*3//4)).resize((8,128),Image.Resampling.BOX)),'binding-8.png','panel binding')
save(P.fit(Image.open(S['logo']),(320,112)),'logo-320.png','logo corrected transparent revision; no wrong subtitle')
app=P.grade(Image.open(S['app']).resize((64,64),Image.Resampling.BOX))
for n in [64,192,512]:save(app.resize((n,n),Image.Resampling.NEAREST),f'app-icon-{n}.png','app')
# Keep only bright generated pools; suppress the broad dim glow so the soil remains readable.
light=Image.open(S['light']).convert('RGBA').resize((192,128),Image.Resampling.BOX)
pixels=[]
for r,g,b,a in light.getdata():
 alpha=round(a*max(0,min(1,(.2126*r+.7152*g+.0722*b-135)/95))*.82)
 pixels.append((255,218,112,alpha) if alpha else (0,0,0,0))
light.putdata(pixels);save(zero(light),'leaf-light.png','light; source luminance and alpha, no procedural light dots')
# Cool broad canopy, from actual prior generated leaf mask, not a flat green veil.
old=Image.open(R/'assets/generated/r87/canopy-shadow.png').convert('RGBA')
a=old.getchannel('A').filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(.7)).point(lambda v:min(130,round(v*1.3)))
shadow=Image.new('RGBA',old.size,(60,79,116,0));shadow.putalpha(a);save(zero(shadow),'canopy-shadow.png','R87 generated canopy, expanded leaf clusters and cool hue')
# Extend terrain contract without changing collision/autotile IDs. Raised bed occupies each existing tile.
old=json.loads((R/'assets/generated/r87/atlas.json').read_text())['overrides']['terrain']
terrain=Image.open(R/old['image']).convert('RGBA');frames={}
for name,f in old['frames'].items():
 if name.startswith('soil_'):
  frames[name]=dict(x=0,y=0,w=64,h=64,anchor=[.5,1],image='assets/generated/r88/'+('soil-wet' if 'wet' in name else 'soil-dry')+'-64.png',meta=dict(w=64,h=64))
 if name.startswith('path_'):
  frames[name]=dict(x=0,y=0,w=32,h=32,anchor=[.5,1],image='assets/generated/r88/path-32.png',meta=dict(w=32,h=32))
 if name.startswith('grass_'):
  frames[name]=dict(x=0,y=0,w=32,h=32,anchor=[.5,1],image='assets/generated/r88/grass-32.png',meta=dict(w=32,h=32))
 # Existing sheets remain available, retaining all licenses and late-game variants.
atlas={'overrides':{'terrain':{**old,'frames':frames}}}
atlas['overrides']['keepsakes']=dict(image='assets/generated/r88/bucket-64.png',meta=dict(w=64,h=64),frames={
 'garden_'+name:dict(x=0,y=0,w=64,h=64,anchor=[.5,1],image=f'assets/generated/r88/{name}-64.png',meta=dict(w=64,h=64)) for name in ['bucket','fence','flowers']})
# Preserve every existing limb pose and alpha silhouette. Grade the wicker body
# separately from its already-generated checked cloth so it reads as a basket.
prior=json.loads((R/'assets/generated/r87/atlas.json').read_text())['overrides']
actor_receipts=[]
weave=P.grade(exterior(sheet.crop((455,265,630,440))).resize((24,24),Image.Resampling.BOX))
for kind,width,rows in [('walk',48,4),('farming-actions',72,8)]:
 im=Image.open(R/f'assets/generated/r87/{kind}.png').convert('RGBA');before=im.getchannel('A').tobytes()
 for row in range(rows):
  direction=row%4
  if kind=='walk':boxes={1:(27,20,45,39),2:(3,20,21,39),3:(12,20,36,40)}
  else:boxes={1:(43,21,66,43),2:(7,21,29,43),3:(23,22,50,44)}
  if direction not in boxes:continue
  x0,y0,x1,y1=boxes[direction]
  cloth=weave.resize((x1-x0,y1-y0),Image.Resampling.NEAREST)
  for col in range(6):
   for y in range(y0,y1):
    for x in range(x0,x1):
     xy=(col*width+x,row*64+y);r,g,b,a=im.getpixel(xy)
     if not a or not(r>g*1.12 and r>b*1.2):continue
     tr,tg,tb,ta=cloth.getpixel((x-x0,y-y0))
     if ta:im.putpixel(xy,(tr,tg,tb,a))
 im=P.grade(im);assert im.getchannel('A').tobytes()==before
 dest=save(im,kind+'.png','R87 generated true limb poses; R88 character sheet wicker/cloth pixels mapped inside original basket color mask only')
 actor_receipts.append(dict(sheet=kind,identicalAlphaToR87=True,frames=rows*6,gate=P.metric(im)))
 if kind=='walk':atlas['overrides']['walk']={**prior['walk'],'image':dest}
 else:
  action=prior['actions'];af={}
  for key,f in action['frames'].items():
   af[key]={**f,'image':dest} if str(f.get('image','')).endswith('/farming-actions.png') else {**f,'image':f.get('image',action['image']),'meta':f.get('meta',action['meta'])}
  atlas['overrides']['actions']={**action,'frames':af}
# Re-extract retained narrative from its original generated master at twice the
# old native density. This restores faces without inventing a new story image.
story=Image.open(R/'docs/art/masters/r85/story.png')
for i,name in enumerate(['welcome','basket','table-result','doorstep-result']):
 native=P.grade(ImageOps.fit(P.cell(story,i%2,i//2,2,2),(256,128),method=Image.Resampling.BOX))
 save(native.resize((512,256),Image.Resampling.NEAREST),name+'-512.webp','R85 original generated story; native256 rather than128')
(P.OUT/'atlas.json').write_text(json.dumps(atlas,indent=2)+'\n',encoding='utf8',newline='\n')
masters=[dict(path=j['master'],sha256=P.sha(S[j['id']]),bytes=S[j['id']].stat().st_size) for j in D['jobs']]
metrics={v['path']:P.metric(Image.open(R/v['path'])) for v in P.records}
manifest=dict(status='EXECUTED',generator=D['tool'],actualModelSlug=None,modelNote=D['modelNote'],palette=palette,masters=masters,records=P.records,qualityMetrics=metrics,actorReceipts=actor_receipts,runtimeBytes=sum(v['bytes'] for v in P.records),retainedAnimation='R87 real four-direction six-pose walk and farming actions; unchanged physics, limb poses, alpha and impact timing',pipeline='Native nearest-neighbor output; palette on bitmap sprites; real tool alpha threshold with zero transparent RGB; continuous alpha only lighting. Garden lossless WebP384. All old licenses retained.')
(P.OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
print(json.dumps({'masters':len(masters),'images':len(P.records),'bytes':manifest['runtimeBytes'],'portraits':{k:v for k,v in metrics.items() if 'miri-' in k}},indent=2))
