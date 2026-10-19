"""Read back generated assets and export auditable comparison boards."""
from pathlib import Path
from PIL import Image
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'docs/evidence/r84-art'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    m=json.loads((ROOT/'assets/generated/r84/manifest.json').read_text(encoding='utf-8'));palette={tuple(bytes.fromhex(c[1:])) for c in m['palette']};rows=[]
    assert len(m['masters'])==9 and len(m['records'])==29
    for r in m['masters']+m['records']:assert sha(ROOT/r['path'])==r['sha256'],r['path']
    for r in m['records']:
        im=Image.open(ROOT/r['path']).convert('RGBA');assert list(im.size)==r['size'];px=list(im.getdata())
        assert all(tuple(p[:3]) in palette for p in px if p[3]),r['path']
        assert all(p[3] in [0,255] for p in px),r['path']
        assert all(p[:3]==(0,0,0) for p in px if p[3]==0),r['path']
        cut=not any(v in r['path'] for v in ['result.webp','panel-192','paper-128','app-icon','terrain.png'])
        if cut:assert all(im.getpixel(p)[3]==0 for p in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]),r['path']
        rows.append(dict(path=r['path'],sha256=r['sha256'],binaryAlpha=True,transparentRGBClear=True,palette=True,cutout=cut))
    portraits=[r for r in m['records'] if any('/'+who+'-' in r['path'] for who in ['miri','grey','grandma'])]
    assert len(portraits)==9 and all(m['qualityMetrics'][r['path']]['gatePass'] for r in portraits)
    walk=Image.open(ROOT/'assets/generated/r83/walk.png').convert('RGBA');sheet=Image.new('RGBA',(192,128),'#fff6e3')
    for i,row in enumerate([0,1,3]):
        fr=walk.crop((0,row*64,48,(row+1)*64));sheet.paste(fr,(i*64+8,0),fr)
        assert set(fr.getchannel('A').getdata())<={0,255}
    sheet.convert('RGB').save(E/'character-three-views.png')
    fr=walk.crop((0,0,48,64));native=Image.new('RGBA',(64,64));native.paste(fr,(8,0));native.save(E/'character-64.png')
    for phase in ['before','after']:
        p=ROOT/f'docs/art/compare/r84/{phase}/390x844-farm.png'
        Image.open(p).resize((64,139),Image.Resampling.NEAREST).save(E/f'farm-{phase}-64.png')
    board=Image.new('RGB',(780,844*4),'#fff6e3')
    for y,name in enumerate(['welcome','farm','daily','basket']):
        for x,phase in enumerate(['before','after']):board.paste(Image.open(ROOT/f'docs/art/compare/r84/{phase}/390x844-{name}.png'),(390*x,844*y))
    board.save(ROOT/'docs/art/compare/r84/overview.webp',lossless=True,method=6)
    names=subprocess.check_output(['git','ls-files'],cwd=ROOT,encoding='utf-8').splitlines();runtime=[p for p in ROOT.rglob('*') if p.is_file() and (p.relative_to(ROOT).parts[0] in ['src','assets'] or p.name in ['index.html','sw.js','manifest.webmanifest','package.json'])]
    old=0;now=sum(p.stat().st_size for p in runtime)
    for p in runtime:
        rel=p.relative_to(ROOT).as_posix()
        if rel in names:
            r=subprocess.run(['git','cat-file','-s','HEAD:'+rel],cwd=ROOT,capture_output=True,text=True)
            if not r.returncode:old+=int(r.stdout)
    (E/'package-size.json').write_text(json.dumps(dict(scope='Web runtime src/assets + index/sw/manifest/package; excludes docs and native packaging',beforeBytes=old,afterBytes=now,deltaBytes=now-old,newImageBytes=m['runtimeBytes']),indent=2)+'\n',encoding='utf-8')
    result=dict(status='VERIFIED',masterCount=9,runtimeImageCount=29,records=rows,characterDoubleGatePassed=9,qualityExceptions={p:v for p,v in m['qualityMetrics'].items() if not v['gatePass']},qualityExceptionReason='Cream paper and white porcelain are intentionally low-saturation surfaces, not character art. Raw failures are retained, never labeled double-gate pass.',limitations=['64px images are available for human recognition review; no timed human study was performed.'])
    (E/'pixel-readback.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print('VERIFIED 9 masters, 29 images, 9 character double gates, shared palette and alpha')
if __name__=='__main__':main()
