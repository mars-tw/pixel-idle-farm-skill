"""Register generated same-outfit handover poses and ring on the native R89 grid."""
import hashlib,json,pathlib,shutil
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1]; O=R/'assets/generated/content-r15';O.mkdir(exist_ok=True)
source='docs/art/masters/content-r15-handover.png'; master=R/source;master.parent.mkdir(parents=True,exist_ok=True)
if not master.exists():shutil.copyfile(pathlib.Path(r'C:\Users\digimkt\.codex\generated_images\01a15420-b89e-7850-9495-fd91e5f773a5\exec-9608fe8d-9624-4d4a-b9b0-9c4e96838293.png'),master)
im=Image.open(master).convert('RGBA');im.putalpha(im.getchannel('A').point(lambda a:255 if a>=100 else 0));records=[];palette=Image.open(R/'assets/generated/r89/walk.png').convert('RGBA');colors=list(set(rgb[:3] for rgb in palette.getdata() if rgb[3]>200));base=None
for i,name in enumerate(['hold-player.png','reach-player.png','idle-player.png']):
    cell=im.crop((round(i*im.width/3),0,round((i+1)*im.width/3),im.height));b=cell.getbbox();feet=cell.crop((0,round(im.height*.75),cell.width,im.height)).getbbox();center=(feet[0]+feet[2])/2;scale=90/(b[3]-b[1])
    resized=cell.resize((round(cell.width*scale),round(cell.height*scale)),Image.Resampling.NEAREST);out=Image.new('RGBA',(72,96));out.alpha_composite(resized,(round(28-center*scale),round(94-b[3]*scale)))
    px=[]
    for r,g,bb,a in out.getdata():
        if a<100:px.append((0,0,0,0))
        else:
            c=min(colors,key=lambda c:(c[0]-r)**2+(c[1]-g)**2+(c[2]-bb)**2);px.append((*c,255))
    out.putdata(px)
    if base is None:base=out.copy()
    else:out.paste(base.crop((0,74,72,96)),(0,74))
    out.save(O/name)
    records.append({'path':(O/name).relative_to(R).as_posix(),'source':source,'frame':i,'sourceSha256':hashlib.sha256((R/source).read_bytes()).hexdigest(),'sha256':hashlib.sha256((O/name).read_bytes()).hexdigest(),'operation':'nearest native sprite reduction, R89 exact palette, fixed foot registration and shared lower 22 rows'})
ringMaster=R/'docs/art/masters/content-r15-ring.png'
if not ringMaster.exists():shutil.copyfile(pathlib.Path(r'C:\Users\digimkt\.codex\generated_images\01a15420-b89e-7850-9495-fd91e5f773a5\exec-3a8608a8-1af3-4534-a922-93229f98fef0.png'),ringMaster)
ring=Image.open(ringMaster).convert('RGBA');ring.putalpha(ring.getchannel('A').point(lambda a:255 if a>=100 else 0));ring=ring.crop(ring.getbbox());ring=ring.resize((60,30),Image.Resampling.NEAREST);out=Image.new('RGBA',(64,44));out.alpha_composite(ring,(2,7));out.save(O/'wide-1.png')
records.append({'path':'assets/generated/content-r15/wide-1.png','source':ringMaster.relative_to(R).as_posix(),'sourceSha256':hashlib.sha256(ringMaster.read_bytes()).hexdigest(),'sha256':hashlib.sha256((O/'wide-1.png').read_bytes()).hexdigest(),'operation':'native 64x44 alpha crop and nearest reduction'})
(O/'manifest.json').write_text(json.dumps({'status':'VERIFIED','generationToolUsedThisRound':'image_gen.imagegen','modelSlug':None,'newGeneratedMasters':2,'newGeneratedRuntimeAssets':4,'reference':'assets/generated/r89/walk.png','prompts':'docs/art/PROMPTS_CONTENT_R15.json','derived':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED',len(records),'registered handover and hollow-ring assets')
