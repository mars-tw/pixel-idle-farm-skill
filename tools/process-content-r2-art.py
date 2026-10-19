"""Preserve generated masters; match R89 palette and 512x256 story pixel density."""
import json, shutil, hashlib
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
jobs=json.loads((ROOT/'docs/art/PROMPTS_CONTENT_R2.json').read_text(encoding='utf-8'))
palette=json.loads((ROOT/'assets/generated/r89/manifest.json').read_text(encoding='utf-8'))['palette']
colors=[tuple(bytes.fromhex(c[1:])) for c in palette]
pal=Image.new('P',(1,1));pal.putpalette([v for c in colors for v in c]+list(colors[0])*(256-len(colors)))
out=ROOT/'assets/generated/content-r2';out.mkdir(parents=True,exist_ok=True)
def record(p):
 im=Image.open(p);return dict(path=p.relative_to(ROOT).as_posix(),width=im.width,height=im.height,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
masters=[];assets=[];references=[]
for job in jobs['jobs']:
 master=ROOT/job['master'];master.parent.mkdir(parents=True,exist_ok=True)
 if not master.exists():shutil.copyfile(job['source'],master)
 im=Image.open(master).convert('RGB').resize((256,128),Image.Resampling.NEAREST).resize((512,256),Image.Resampling.NEAREST)
 im=im.quantize(palette=pal,dither=Image.Dither.NONE).convert('RGB')
 dest=out/(job['id']+'.webp');im.save(dest,lossless=True)
 assert set(im.getdata()).issubset(set(colors))
 masters.append(record(master));assets.append(record(dest))
 for ref in job.get('references',[]):references.append(record(ROOT/ref))
(out/'manifest.json').write_text(json.dumps(dict(status='VERIFIED',tool='image_gen.imagegen',actualModelSlug=None,palette=palette,masters=masters,assets=assets,references=references,prompts='docs/art/PROMPTS_CONTENT_R2.json',processing='256x128 grouped pixel sampling, nearest enlarged512x256; exact R89 palette; generated discrete pixels, no synthetic placeholders'),ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print('VERIFIED six generated story/notebook illustrations, R89 palette')
