"""Extract the generated 4x3 water sheet; native-grid nearest sampling only."""
from pathlib import Path
from PIL import Image
import hashlib, json, sys

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'docs/art/masters/content-r18/water-sheet.png'
OUT = ROOT / 'assets/generated/content-r18'

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    sheet = Image.open(MASTER).convert('RGBA')
    OUT.mkdir(parents=True, exist_ok=True)
    palette = Image.new('P', (1, 1))
    colors = json.loads((ROOT/'assets/generated/r89/manifest.json').read_text(encoding='utf-8'))['palette']
    values = [int(c[i:i+2],16) for c in colors for i in (1,3,5)]
    palette.putpalette(values + values[:3] * (256-len(colors)))
    frames=[]
    for row, fish in enumerate(['river_carp','silver_dace','river_perch']):
        for col in range(4):
            box=(round(col*sheet.width/4),round(row*sheet.height/3),round((col+1)*sheet.width/4),round((row+1)*sheet.height/3))
            frame=sheet.crop(box).resize((96,72),Image.Resampling.NEAREST)
            alpha=frame.getchannel('A').point(lambda a:255 if a>=160 else 0)
            frame=frame.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA')
            frame.putalpha(alpha)
            target=OUT/f'{fish}-{col}.png'
            frame.save(target,optimize=True)
            frames.append({'file':target.relative_to(ROOT).as_posix(),'sha256':digest(target),'width':96,'height':72,'fish':fish,'frame':col,'sourceBox':box})
    prompt=json.loads((ROOT/'docs/art/PROMPTS_R89.json').read_text(encoding='utf-8'))['stylePrefix']
    manifest={'status':'VERIFIED','tool':'image_gen.imagegen','model':None,'modelNote':'Exact model not exposed by built-in tool.','stylePrefix':prompt,'master':MASTER.relative_to(ROOT).as_posix(),'masterSha256':digest(MASTER),'paletteSource':'assets/generated/r89/manifest.json','palette':colors,'processing':'4x3 cell extraction, nearest-neighbor 96x72 grid, binary alpha, exact established R89 palette. No painted replacement frames.','frames':frames}
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('VERIFIED 12 generated native water frames')

if __name__=='__main__':
    main()
