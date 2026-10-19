"""Mechanical art export: shared palette, native pixels, alpha masks and receipts.
No drawing or substitute generated art. Source images come from image_gen.imagegen.
"""
from pathlib import Path
from PIL import Image, ImageOps
import colorsys, hashlib, json

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "docs/art"
OUT = ROOT / "assets/generated/r82"
EVIDENCE = ROOT / "docs/evidence/r82-art"
PALETTE = json.loads((ROOT / "assets/generated/r68/manifest.json").read_text(encoding="utf-8"))["palette"]
RGB = [tuple(bytes.fromhex(c.lstrip("#"))) for c in PALETTE]
PAL = Image.new("P", (1, 1))
PAL.putpalette([x for c in RGB for x in c] + list(RGB[0]) * (256-len(RGB)))
records = []

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def grade(im):
    rgba = im.convert("RGBA")
    rgb = rgba.convert("RGB").quantize(palette=PAL, dither=Image.Dither.NONE).convert("RGBA")
    rgb.putalpha(rgba.getchannel("A").point(lambda a: 255 if a >= 128 else 0))
    rgb.paste((0,0,0,0), mask=ImageOps.invert(rgb.getchannel("A")))
    return rgb

def cutout(im, size):
    im = im.convert("RGBA")
    if im.getchannel("A").getextrema()[0] != 0:
        raise ValueError("Source has no real transparency; requires explicit matte extraction")
    box = im.getchannel("A").point(lambda a:255 if a>=128 else 0).getbbox()
    if not box: raise ValueError("Empty generated image")
    im = im.crop(box)
    target = Image.new("RGBA",size)
    im.thumbnail((size[0]-4,size[1]-4),Image.Resampling.BOX)
    target.paste(im,((size[0]-im.width)//2,(size[1]-im.height)//2))
    return grade(target)

def save(im, path, source):
    path.parent.mkdir(parents=True,exist_ok=True)
    if path.suffix == ".webp": im.convert("RGB").save(path,lossless=True,method=6)
    else: im.save(path,optimize=True)
    records.append({"path":path.relative_to(ROOT).as_posix(),"source":source,"size":list(im.size),"bytes":path.stat().st_size,"sha256":digest(path)})

def metrics(im):
    p=[c for c in im.convert("RGBA").getdata() if c[3]>=128]
    ys=[(.2126*r+.7152*g+.0722*b)/255 for r,g,b,a in p]
    ss=[colorsys.rgb_to_hsv(r/255,g/255,b/255)[1] for r,g,b,a in p]
    row={"brightness":sum(ys)/len(p),"nearBlackFraction":sum(y<.1 for y in ys)/len(p),"saturation":sum(ss)/len(p),"lowSaturationFraction":sum(s<.2 for s in ss)/len(p)}
    row["gatePass"]=.30<=row["brightness"]<=.75 and row["nearBlackFraction"]<.35 and row["saturation"]>=.32 and row["lowSaturationFraction"]<.20
    return row

def main():
    OUT.mkdir(parents=True,exist_ok=True); EVIDENCE.mkdir(parents=True,exist_ok=True)
    prompts=json.loads((ART/"PROMPTS.json").read_text(encoding="utf-8"))
    sources={j["id"]:j["master"] for j in prompts["jobs"]}
    quality={}
    for key,name in [("Welcome","welcome-384.webp"),("Table","table-r82.webp"),("Door","doorstep-r82.webp")]:
        source=sources[key]; im=Image.open(ROOT/source).convert("RGB")
        im=grade(ImageOps.fit(im,(384,192),method=Image.Resampling.BOX))
        dest=ROOT/"assets/heirloom"/name if key!="Welcome" else OUT/name
        save(im,dest,source)
    source=sources["Paper"]
    im=grade(Image.open(ROOT/source).resize((192,192),Image.Resampling.BOX))
    # Use the calm central paper as the repeatable material; trim is supplied by CSS.
    save(im.crop((24,24,168,168)).resize((192,192),Image.Resampling.NEAREST),OUT/"paper-192.png",source)
    for key,name,size in [("Farmer","farmer-96.png",(96,96)),("Logo","logo-320.png",(320,128))]:
        source=sources[key]; im=cutout(Image.open(ROOT/source),size)
        save(im,OUT/name,source)
        mask=EVIDENCE/(key.lower()+"-mask.png"); im.getchannel("A").save(mask)
        quality[key]={**metrics(im),"alphaOccupancy":sum(a>0 for a in im.getchannel("A").getdata())/(im.width*im.height),"maskSha256":digest(mask),"cornersTransparent":all(im.getpixel(p)[3]==0 for p in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)])}
        if key=="Farmer":
            save(im.resize((64,64),Image.Resampling.NEAREST),EVIDENCE/"farmer-64.png",source)
            face=cutout(im.crop((12,0,90,58)),(64,64))
            save(face,OUT/"farmer-face-64.png",source)
            quality["FarmerFace"]=metrics(face)
    source=sources["Icons"]; im=Image.open(ROOT/source).convert("RGBA")
    sheet=Image.new("RGBA",(128,64))
    for i,name in enumerate(["basket","note","wheat","stamp","water","seed","sun","tea"]):
        x,y=i%4,i//4
        cell=im.crop((round(x*im.width/4),round(y*im.height/2),round((x+1)*im.width/4),round((y+1)*im.height/2)))
        native=cutout(cell,(32,32)); sheet.paste(native,(x*32,y*32))
        save(native,OUT/(name+"-32.png"),source)
    save(sheet,OUT/"icons-128.png",source)
    source=sources["App"]; im=grade(ImageOps.fit(Image.open(ROOT/source).convert("RGB"),(128,128),method=Image.Resampling.BOX)).convert("RGB")
    for n in [48,192,512]:save(im.resize((n,n),Image.Resampling.NEAREST),OUT/("app-icon-"+str(n)+".png"),source)
    contact=Image.new("RGB",(576,256),"#fff6e3")
    for x,name in enumerate(["welcome-384.webp","farmer-96.png","icons-128.png"]):
        pic=Image.open(OUT/name).convert("RGBA");pic.thumbnail((192,192),Image.Resampling.NEAREST);contact.paste(pic,(x*192,20),pic)
    contact.save(EVIDENCE/"native-contact.png")
    manifest={"status":"EXECUTED","date":"2026-10-16","generator":"image_gen.imagegen","actualModelSlug":None,"modelNote":"Exact model slug is not exposed by the built-in tool; no claim of a specific gpt-image version.","paletteSource":"assets/generated/r68/manifest.json","palette":PALETTE,"pipeline":"Generated raster -> source alpha preserved -> bounding box with 2px gutters -> BOX native reduction -> shared 66-color palette without dither -> binary alpha -> nearest neighbor display. Backgrounds use lossless WebP; cutouts real RGBA PNG.","records":records,"qualityMetrics":quality,"runtimeBytes":sum(r["bytes"] for r in records if r["path"].startswith("assets/")),"masters":[{"path":p,"sha256":digest(ROOT/p),"bytes":(ROOT/p).stat().st_size} for p in sources.values()]}
    (OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8",newline="\n")
    print(json.dumps({"runtimeBytes":manifest["runtimeBytes"],"exports":len(records),"quality":quality},indent=2))

if __name__=="__main__": main()
