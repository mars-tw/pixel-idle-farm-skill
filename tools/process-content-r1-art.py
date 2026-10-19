"""Crop generated artwork at native R89 story density; never synthesize artwork."""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PROMPTS = ROOT / 'docs/art/PROMPTS_CONTENT_R1.json'
job = json.loads(PROMPTS.read_text(encoding='utf-8'))['jobs'][0]
master = ROOT / job['master']
master.parent.mkdir(parents=True, exist_ok=True)
if not master.exists():
    shutil.copyfile(job['source'], master)
im = Image.open(master).convert('RGB')
palette = json.loads((ROOT / 'assets/generated/r89/manifest.json').read_text(encoding='utf-8'))['palette']
colors = [tuple(bytes.fromhex(c[1:])) for c in palette]
pal = Image.new('P', (1,1))
pal.putpalette([v for c in colors for v in c] + list(colors[0]) * (256-len(colors)))
out = ROOT / 'assets/generated/content-r1'
out.mkdir(parents=True, exist_ok=True)
for i, name in enumerate(['merchant', 'elder', 'child', 'pond']):
    crop = (0, round(im.height * i / 4), im.width, round(im.height * (i+1) / 4))
    native = im.crop(crop).resize((512,256), Image.Resampling.NEAREST)
    native = native.quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB')
    native.save(out / (name + '.webp'), lossless=True)
pond = Image.open(out / 'pond.webp')
pond.crop((120,90,235,155)).resize((460,260), Image.Resampling.NEAREST).save(out / 'water.webp', lossless=True)
# The isolated bobber uses actual generated red/cream pixels. Water becomes alpha,
# preserving its silhouette; this is an object, not character locomotion.
bobber = pond.crop((261,102,280,141)).convert('RGBA')
for y in range(bobber.height):
    for x in range(bobber.width):
        r,g,b,a = bobber.getpixel((x,y))
        keep = (r > g * 1.15 and r > b * 1.2) or (r > 190 and g > 155 and b < g and abs(x-9) < 5 and y < 30)
        if not keep:
            bobber.putpixel((x,y),(0,0,0,0))
bobber.resize((32,48), Image.Resampling.NEAREST).save(out / 'bobber.png')
def record(path):
    image = Image.open(path)
    return {'path':path.relative_to(ROOT).as_posix(), 'width':image.width, 'height':image.height, 'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
manifest = {'status':'VERIFIED','tool':'image_gen.imagegen','actualModelSlug':None,'master':record(master),'palette':palette,
    'promptManifest':'docs/art/PROMPTS_CONTENT_R1.json','processing':'native512x256 nearest-neighbor crops; exact R89 palette with no added dither; water detail crop; bobber RGBA color isolation',
    'references':[record(ROOT / p) for p in job['references']],
    'assets':[record(p) for p in sorted(out.glob('*')) if p.suffix in ('.png','.webp')]}
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
for asset in manifest['assets']:
    rgba = Image.open(ROOT / asset['path']).convert('RGBA')
    assert all(a == 0 or (r,g,b) in colors for r,g,b,a in rgba.getdata()), asset['path']
print('VERIFIED generated master', im.size, 'runtime assets', len(manifest['assets']))
