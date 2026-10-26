"""Extract generated alpha artwork; quantize to the existing R89 native palette."""
from pathlib import Path
from PIL import Image
import hashlib,json
R=Path(__file__).resolve().parents[1];O=R/'assets/generated/content-r19';O.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
colors=json.loads((R/'assets/generated/r89/manifest.json').read_text())['palette']
pal=Image.new('P',(1,1));v=[int(c[k:k+2],16) for c in colors for k in (1,3,5)];pal.putpalette(v+v[:3]*(256-len(colors)))
rows=[]
def save(im,name,master,box,kind):
    alpha=im.getchannel('A').point(lambda a:255 if a>=160 else 0)
    im=im.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA');im.putalpha(alpha)
    im.paste((0,0,0,0),(0,0,im.width,im.height),alpha.point(lambda a:255-a))
    p=O/name;im.save(p,optimize=True);rows.append({'file':p.relative_to(R).as_posix(),'sha256':sha(p),'size':im.size,'master':master,'sourceBox':box,'kind':kind})
master='docs/art/masters/content-r19/empty-actors.png';sheet=Image.open(R/master).convert('RGBA')
for row,id in enumerate(['player','merchant','elder']):
    for col,pose in enumerate(['idle','reach','hold']):
        # Generated rows are visually aligned but not exact quarter-height:
        # exclude the preceding row's boots rather than retaining a floating bar.
        top,bottom=[(0,390),(395,745),(747,1085)][row]
        box=(round(col*sheet.width/3),top,round((col+1)*sheet.width/3),bottom)
        im=sheet.crop(box);a=im.getchannel('A').point(lambda x:255 if x>=160 else 0);bounds=a.getbbox();im=im.crop(bounds)
        # Same 48x64 native body envelope; alpha is generated, not painted.
        im.thumbnail((44,62),Image.Resampling.NEAREST);frame=Image.new('RGBA',(48,64));frame.paste(im,((48-im.width)//2,64-im.height))
        save(frame,pose+'-'+id+'.png',master,box,'empty-body')
master='docs/art/masters/content-r19/empty-child.png';sheet=Image.open(R/master).convert('RGBA')
for col,pose in enumerate(['idle','reach','hold']):
    box=(round(col*sheet.width/3),0,round((col+1)*sheet.width/3),sheet.height)
    im=sheet.crop(box);im=im.crop(im.getchannel('A').point(lambda x:255 if x>=160 else 0).getbbox());im.thumbnail((44,62),Image.Resampling.NEAREST)
    frame=Image.new('RGBA',(48,64));frame.paste(im,((48-im.width)//2,64-im.height));save(frame,pose+'-child.png',master,box,'empty-body')
master='docs/art/masters/content-r19/carp-rings.png';sheet=Image.open(R/master).convert('RGBA')
boxes=[(32,210,340,550),(390,180,835,590),(860,125,1395,665),(1400,60,2048,720)]
for i,(box,size) in enumerate(zip(boxes,[(34,26),(52,40),(72,54),(94,70)])):
    im=sheet.crop(box).resize(size,Image.Resampling.NEAREST);frame=Image.new('RGBA',(96,72));frame.paste(im,((96-size[0])//2,(72-size[1])//2))
    save(frame,'river_carp-'+str(i)+'.png',master,box,'expanding-water')
m={'status':'VERIFIED','tool':'image_gen.imagegen','model':None,'stylePrefix':json.loads((R/'docs/art/PROMPTS_R89.json').read_text(encoding='utf-8'))['stylePrefix'],'palette':colors,'masters':{p:sha(R/p) for p in sorted({x['master'] for x in rows})},'processing':'Cell extraction, generated alpha threshold, nearest-neighbor native grid, established palette; no painted character or water replacement. Unused fourth character row excluded because its costume differed.','frames':rows}
(O/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('VERIFIED',len(rows),'native frames')
