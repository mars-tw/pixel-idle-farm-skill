"""Preserve generated source and apply the existing R89 palette at world-sprite density."""
import hashlib, json, shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
jobs = json.loads((ROOT/'docs/art/PROMPTS_CONTENT_R4.json').read_text(encoding='utf-8'))
palette = json.loads((ROOT/'assets/generated/r89/manifest.json').read_text(encoding='utf-8'))['palette']
colors = [tuple(bytes.fromhex(c[1:])) for c in palette]
pal = Image.new('P', (1, 1))
pal.putpalette([v for c in colors for v in c] + list(colors[0]) * (256-len(colors)))
out = ROOT/'assets/generated/content-r4'
out.mkdir(parents=True, exist_ok=True)
def record(p):
    im = Image.open(p)
    return dict(path=p.relative_to(ROOT).as_posix(), width=im.width, height=im.height, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
masters, assets = [], []
for job in jobs['jobs']:
    master = ROOT/job['master']
    master.parent.mkdir(parents=True, exist_ok=True)
    if not master.exists(): shutil.copyfile(job['source'], master)
    im = Image.open(master).convert('RGB').resize((256, 128), Image.Resampling.NEAREST)
    im = im.quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB').resize((512, 256), Image.Resampling.NEAREST)
    assert set(im.getdata()).issubset(set(colors))
    dest = out/(job['id']+'.webp')
    im.save(dest, lossless=True)
    masters.append(record(master)); assets.append(record(dest))
manifest = dict(status='VERIFIED', tool='image_gen.imagegen', actualModelSlug=None, palette=palette, masters=masters, assets=assets,
    references=[record(ROOT/'assets/generated/content-r3/child.webp')], prompts='docs/art/PROMPTS_CONTENT_R4.json',
    processing='Generated full-body sprite dioramas, 256x128 native sampling, exact R89 palette, nearest 2x to512x256. No edits to world poses or physics.')
(out/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
print('VERIFIED', len(assets), 'new generated sprite dioramas')
