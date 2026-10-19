"""Read back generated art, source contracts, release delta and final store files."""
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
import json,hashlib,re,subprocess,shutil
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'docs/evidence/r87-art';BASE='565bb46'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def runtime(p):return p.parts[0] in ['src','assets'] or p.as_posix() in ['index.html','offline.html','manifest.webmanifest','sw.js','LICENSE','CREDITS.md']
def main():
    m=json.loads((ROOT/'assets/generated/r87/manifest.json').read_text(encoding='utf-8'));alpha=[]
    assert len(m['masters'])==10 and len(m['records'])==23 and len(m['palette'])==74
    assert all(v['gatePass'] for k,v in m['qualityMetrics'].items() if any(n in k for n in ['walk.png','actions.png','miri-']))
    for r in m['records']:
        p=ROOT/r['path'];im=Image.open(p).convert('RGBA');assert sha(p)==r['sha256']
        assert im.size==tuple(r['size']);a=im.getchannel('A');pixels=list(im.getdata())
        assert all((r,g,b)==(0,0,0) for r,g,b,v in pixels if v==0),'transparent RGB '+str(p)
        corners=[a.getpixel(v) for v in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]]
        cutout=any(t in p.name for t in ['walk','actions','miri-','stamp-','logo-','drop-','apple-tree','wheat-32','basket-32','water-32','note-32','hat-32','sprout-32'])
        if cutout:assert corners==[0,0,0,0],'transparent corners '+str(p)
        alpha.append(dict(path=r['path'],occupancy=sum(v[3]>0 for v in pixels)/len(pixels),partial=sum(0<v[3]<255 for v in pixels),corners=corners,cutout=cutout))
    store=[]
    for p in sorted((ROOT/'docs/store/screenshots').glob('*.png')):
        if not re.fullmatch(r'(iphone|ipad)-(01-welcome|02-sunlight|03-basket|04-note|05-daily|06-same-age)\.png',p.name):continue
        im=Image.open(p);size=(1290,2796) if p.name.startswith('iphone-') else (2064,2752)
        assert im.size==size,(p,im.size);fixture='06-same-age' in p.name or '02-sunlight' in p.name
        store.append(dict(file=p.name,width=im.width,height=im.height,path=p.relative_to(ROOT).as_posix(),size=list(im.size),bytes=p.stat().st_size,sha256=sha(p),status='VERIFIED',fixture=fixture,injectedProgress=fixture,capture='Explicit exact-age visual QA fixture, actual game renderer; not earned play' if fixture else 'R87 headless Chromium, real clock and earned play; camera focus only'))
    assert len(store)==12
    pairs=ROOT/'docs/art/compare/r87/after/store';pairs.mkdir(parents=True,exist_ok=True)
    for row in store:shutil.copy2(ROOT/row['path'],pairs/row['file'])
    (ROOT/'docs/store/screenshots-manifest.json').write_text(json.dumps(dict(status='VERIFIED',release='r87-20261018-1',round='R87',version='0.1.21',appVersion='r87-20261018-1',headless=True,nativeDevice=False,injectedProgress=True,containsVisualFixtures=True,realPlayScreenshots=8,realPlay='01/03/04/05: real clock and actual inputs; no injected progress',fixture='02 and06: explicitly labeled same-age visual fixtures;02 pauses actual water frame3;06 actual walk, not earned-play evidence; see per-image flag',screenshots=store,historicalAuxiliaryFiles=['ipad-01-earned-farm.png','ipad-02-earned-note.png']),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    before=0
    for entry in subprocess.check_output(['git','ls-tree','-r','-l','-z',BASE],cwd=ROOT).split(b'\0'):
        if not entry:continue
        meta,rel=entry.split(b'\t',1)
        if runtime(Path(rel.decode('utf-8'))):before+=int(meta.split()[-1])
    after=sum(p.stat().st_size for d in ['assets','src'] for p in (ROOT/d).rglob('*') if p.is_file())+sum((ROOT/p).stat().st_size for p in ['index.html','offline.html','manifest.webmanifest','sw.js','LICENSE','CREDITS.md'])
    package=dict(status='VERIFIED',method='Existing GitHub workflow runtime allowlist: root runtime + src + assets; compare starting commit with current on-disk bytes',baseCommit=BASE,beforeBytes=before,afterBytes=after,deltaBytes=after-before,newImageBytes=m['runtimeBytes'],nativePackageMeasured=False,docsExcluded=True)
    (E/'package-size.json').write_text(json.dumps(package,indent=2)+'\n',encoding='utf-8')
    perf_source=E/'regression/r79/r79-fun-e2e.json'
    if not perf_source.exists():perf_source=ROOT/'docs/evidence/r79/r79-fun-e2e.json'
    perf=json.loads(perf_source.read_text(encoding='utf-8'))['perf']
    assert all(row['medianP95Ms']<=18 for row in perf.values())
    (E/'performance.json').write_text(json.dumps(dict(status='VERIFIED',source=perf_source.relative_to(ROOT).as_posix(),sourceSha256=sha(perf_source),measurements=perf,trust='Concurrent machine load; reference only, not native-device shipment proof'),indent=2)+'\n',encoding='utf-8')
    old='r86-20261018-1';files=[ROOT/'index.html',ROOT/'sw.js',ROOT/'manifest.webmanifest',*(ROOT/'src').glob('*.js'),*(ROOT/'src').glob('*.css')]
    assert all(old not in p.read_text(encoding='utf-8') for p in files)
    for p in [*(ROOT/'src').glob('*.js'),*(ROOT/'scripts').glob('*.js')]:subprocess.run(['node','--check',str(p)],check=True,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    patterns=[re.compile(rb'sk-proj-[A-Za-z0-9_-]{20}'),re.compile(rb'sk-[a-z0-9]{40}')];matches=0;scanned=0
    for p in ROOT.rglob('*'):
        if not p.is_file() or any(x in p.relative_to(ROOT).parts for x in ['.git','node_modules','.audit-tmp','__pycache__']):continue
        scanned+=1;data=p.read_bytes()
        if data.startswith((b'\xff\xfe',b'\xfe\xff')):data=data.decode('utf-16').encode('utf-8')
        matches+=sum(len(q.findall(data)) for q in patterns)
    assert matches==0,'secret scan must be zero; matched values are never printed'
    checks=json.loads((E/'final-checks.json').read_text(encoding='utf-8'))
    assert len(checks['checks'])==7 and all(c['exitCode']==0 for c in checks['checks'])
    checks['status']='VERIFIED';(E/'final-checks.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
    # Readable before/after contact sheet; original PNGs remain unmodified.
    font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16);canvas=Image.new('RGB',(780,4*480),'#fff6e3');draw=ImageDraw.Draw(canvas)
    for row,name in enumerate(['welcome','farm','basket','daily']):
        for col,phase in enumerate(['before','after']):
            im=Image.open(ROOT/f'docs/art/compare/r87/{phase}/390x844-{name}.png').convert('RGB');im.thumbnail((370,440));canvas.paste(im,(col*390+(390-im.width)//2,row*480+32));draw.text((col*390+12,row*480+8),phase.upper()+' / '+name,font=font,fill='#3e2f23')
    canvas.save(ROOT/'docs/art/compare/r87/overview.webp',quality=90,method=6)
    result=dict(status='VERIFIED',masters=len(m['masters']),runtimeImages=len(m['records']),alpha=alpha,characterDoubleGates={k:v['gatePass'] for k,v in m['qualityMetrics'].items() if any(n in k for n in ['walk.png','actions.png','miri-'])},storeCount=len(store),secretScan=dict(matches=matches,files=scanned,scope='repo only, no secrets directory access'),runtimeOldVersionMatches=0,javascriptSyntax=True,package=package,limitations=['No independent score; 8/10 target awaits rescore','No human 3-second or 5-second recognition test','No native iOS/Android device validation'])
    (E/'verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(dict(status='VERIFIED',storeCount=len(store),deltaBytes=after-before,secretMatches=matches,images=len(m['records']))))
if __name__=='__main__':main()
