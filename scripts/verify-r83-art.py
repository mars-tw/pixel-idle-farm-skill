"""Read-back receipts, alpha/palette validation and delivery size. No art generation."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,subprocess,colorsys
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'docs/evidence/r83-art';E.mkdir(parents=True,exist_ok=True)
BASELINE='8a4cc45'  # R82 parent: keep the size receipt stable after this release is committed.
def main():
    m=json.loads((ROOT/'assets/generated/r83/manifest.json').read_text(encoding='utf-8'));palette={tuple(bytes.fromhex(c[1:])) for c in m['palette']};checks=[]
    for r in m['records']:
        p=ROOT/r['path'];im=Image.open(p).convert('RGBA');colors=list(im.getdata());vis=[v for v in colors if v[3]]
        assert im.size==tuple(r['size']) and vis
        assert all(c[:3] in palette for c in vis),r['path']+' palette'
        assert all(c[3] in [0,255] for c in colors),r['path']+' binary alpha'
        assert all(c==(0,0,0,0) for c in colors if not c[3]),r['path']+' transparent RGB'
        mask=None
        if im.getchannel('A').getextrema()[0]==0:
            folder=E/'masks';folder.mkdir(exist_ok=True);target=folder/(p.stem+'-alpha.png');im.getchannel('A').save(target)
            mask=dict(path=target.relative_to(ROOT).as_posix(),sha256=hashlib.sha256(target.read_bytes()).hexdigest())
        checks.append(dict(path=r['path'],size=list(im.size),binaryAlpha=True,commonPalette=True,cleanTransparentRGB=True,alphaMask=mask))
    atlas=json.loads((ROOT/'assets/generated/r83/atlas.json').read_text())['overrides']
    assert sum(len(atlas[s]['frames']) for s in ['crops','crops2','crops3','crops4'])==75
    runtime=[p for p in (ROOT/'assets/generated/r83').rglob('*') if p.is_file()]+[p for p in (ROOT/'assets/heirloom/r83').rglob('*') if p.is_file()]+[ROOT/'src/art-r83.css']
    tracked=['src/atlas.js','src/ui.js','src/world-ui.js','src/heirloom.js','src/heirloom-ui.js','src/daily-ui.js','src/art-r82.css','index.html','sw.js','manifest.webmanifest','assets/manifest.json','assets/heirloom/manifest.json']
    changed=sum((ROOT/p).stat().st_size-len(subprocess.check_output(['git','show',BASELINE+':'+p],cwd=ROOT)) for p in tracked)
    size=dict(generatedImageBytes=m['runtimeBytes'],newRuntimeFilesBytes=sum(p.stat().st_size for p in runtime),modifiedRuntimeDeltaBytes=changed,totalRuntimeIncreaseBytes=sum(p.stat().st_size for p in runtime)+changed,masterBytes=sum(r['bytes'] for r in m['masters']),webScope='Existing CI copies src/assets and runtime entry files; docs, masters and comparison captures are excluded.',nativePackage='BLOCKED: no IPA/AAB rebuilt')
    (E/'package-size.json').write_text(json.dumps(size,indent=2)+'\n',encoding='utf-8')
    hero=Image.open(ROOT/'assets/generated/r83/walk.png').crop((0,0,48,64));box=hero.getchannel('A').getbbox();visible_width=(box[2]-box[0])*96/48
    assert visible_width>=40
    (E/'pixel-readback.json').write_text(json.dumps(dict(status='VERIFIED',images=checks,cropFrames=75,mainCharacter=dict(nativeVisibleBox=list(box),phone390RootWidth=96,phone390VisibleWidth=visible_width)),indent=2)+'\n',encoding='utf-8')
    gates=[]
    for file,cols,rows,w,h in [('walk.png',6,4,48,64),('actions.png',6,4,48,64),('tend.png',6,4,48,64),('npcs.png',4,4,48,64),('portraits.png',3,2,80,80)]:
        sheet=Image.open(ROOT/'assets/generated/r83'/file).convert('RGBA')
        for row in range(rows):
            for col in range(cols):
                px=[p for p in sheet.crop((col*w,row*h,(col+1)*w,(row+1)*h)).getdata() if p[3]]
                ys=[(.2126*r+.7152*g+.0722*b)/255 for r,g,b,a in px];ss=[colorsys.rgb_to_hsv(r/255,g/255,b/255)[1] for r,g,b,a in px]
                values=dict(file=file,row=row,col=col,brightness=sum(ys)/len(ys),nearBlackFraction=sum(y<.1 for y in ys)/len(ys),saturation=sum(ss)/len(ss),lowSaturationFraction=sum(s<.2 for s in ss)/len(ss))
                values['gatePass']=.3<=values['brightness']<=.75 and values['nearBlackFraction']<.35 and values['saturation']>=.32 and values['lowSaturationFraction']<.2
                assert values['gatePass'],values;gates.append(values)
    (E/'character-gates.json').write_text(json.dumps(dict(status='VERIFIED',frames=len(gates),gates=gates),indent=2)+'\n',encoding='utf-8')
    # Native review board keeps real pixels and all direction poses.
    contact=Image.new('RGB',(640,256),'#fff6e3')
    for i,name in enumerate(['farmer-face-64.png','grey-0.png','grey-1.png','grey-2.png','grandma-0.png','grandma-1.png','grandma-2.png','app-icon-64.png']):
        im=Image.open(ROOT/'assets/generated/r83'/name).convert('RGBA');im.thumbnail((64,64),Image.Resampling.NEAREST);contact.paste(im,((i%8)*80,4),im)
    walk=Image.open(ROOT/'assets/generated/r83/walk.png').convert('RGBA')
    for row in range(4):
        im=walk.crop((0,row*64,48,(row+1)*64));contact.paste(im,(row*80,100),im)
    contact.save(E/'native-64-review.png')
    farm=Image.open(ROOT/'docs/store/screenshots/iphone-02-sunlight.png');farm.resize((64,round(farm.height*64/farm.width)),Image.Resampling.BOX).save(E/'farm-whole-64.png')
    overview=Image.new('RGB',(780,900),'#fff6e3');draw=ImageDraw.Draw(overview)
    for row,phase in enumerate(['before','after']):
        top=row*450;draw.text((8,top+4),'R82 before' if row==0 else 'R83 after',fill='#3e2f23')
        for col,scene in enumerate(['welcome','farm','daily','basket']):
            path=ROOT/f'docs/art/compare/r83/{phase}/390x844-{scene}.png'
            im=Image.open(path).convert('RGB').resize((195,422),Image.Resampling.BOX);overview.paste(im,(col*195,top+24))
    overview.save(ROOT/'docs/art/compare/r83/overview.webp',lossless=True,method=6)
    means=[]
    for name in ['sun-on.png','sun-off.png']:
        im=Image.open(E/name).convert('RGB');means.append(sum(.2126*r+.7152*g+.0722*b for r,g,b in im.getdata())/(im.width*im.height*255))
    increase=means[0]/means[1]-1;assert increase>=.15
    (E/'sun-brightness.json').write_text(json.dumps(dict(status='VERIFIED',sunOnMeanBrightness=means[0],sunOffMeanBrightness=means[1],relativeIncrease=increase,method='Same actual headless scene and central 76 percent of illuminated tile; off capture hides only leaf light overlay and crop light filter. Labeled visual fixture.'),indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(status='VERIFIED',images=len(checks),cropFrames=75,size=size),indent=2))
if __name__=='__main__':main()
