"""Local release readback. Never read credentials or any directory outside this repo."""
import hashlib, json, math, re, struct, subprocess
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/content/r3'
def read(name): return json.loads((ROOT/name).read_text(encoding='utf-8'))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
pkg=read('package.json');assert pkg['version']=='0.1.26' and pkg['appVersion']=='content-r3-20261019-1'
subprocess.run(['node','scripts/test-version-chain.js'],cwd=ROOT,check=True)
for p in [ROOT/'index.html',ROOT/'sw.js',ROOT/'manifest.webmanifest',*list((ROOT/'src').glob('*.js')),*list((ROOT/'src').glob('*.css'))]:
    assert 'content-r2-20261019-1' not in p.read_text(encoding='utf-8'),p
m=read('assets/generated/content-r3/manifest.json');colors={tuple(bytes.fromhex(c[1:])) for c in m['palette']}
for record in m['masters']+m['assets']+m['references']:assert sha(ROOT/record['path'])==record['sha256'],record['path']
for record in m['assets']:
    im=Image.open(ROOT/record['path']).convert('RGB');assert set(im.getdata()).issubset(colors)
    # Runtime pixels are exact 2x2 native clusters, not smoothing or painterly resampling.
    assert im.tobytes()==im.resize((256,128),Image.Resampling.NEAREST).resize((512,256),Image.Resampling.NEAREST).tobytes()
screens=[]
for p in sorted(OUT.glob('*.png')):
    w,h=struct.unpack('>II',p.read_bytes()[16:24]);assert (w,h) in [(320,568),(430,932),(390,844),(844,390),(768,1024),(1366,600),(1366,768)],(p,w,h)
    screens.append(dict(path=p.relative_to(ROOT).as_posix(),width=w,height=h,sha256=sha(p)))
for name,size in [('iphone-09-neighbor-memory.png',(1290,2796)),('ipad-09-neighbor-memory.png',(2064,2752))]:
    p=ROOT/'docs/store/screenshots'/name;assert Image.open(p).size==size
    screens.append(dict(path=p.relative_to(ROOT).as_posix(),width=size[0],height=size[1],sha256=sha(p)))
store=dict(status='VERIFIED',version=pkg['appVersion'],source='Real browser screenshots, earned nine-delivery state; chapter/dock and starting ingredients fixture disclosed in browser-checks.json. No resizing, crop, overlay or composite.',screenshots=[r for r in screens if r['path'].startswith('docs/store/')])
(ROOT/'docs/store/screenshots-content-r3-manifest.json').write_text(json.dumps(store,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
browser=read('docs/content/r3/browser-checks.json');assert browser['status']=='VERIFIED' and not browser['errors']
assert sum('recall hides stale farm speech behind paper' in c for c in browser['checks'])==3
for row in browser['frames']:
    match=re.search(r'phone-recall-(merchant|elder|child)-(context|entry)\.png$',row['path'])
    if match: assert row['state']['resident']==match[1],row['path']
walking=[r['state'] for r in browser['frames'] if 'phone-delivery-walking-' in r['path']]
assert len(walking)==3 and len({r['sprite'] for r in walking})>=2
assert all(r['bread']==10 for r in walking)
for n in ['merchant','elder','child','river_carp','silver_dace','river_perch']:
    for phase in ['missing','restored']:assert (OUT/f'phone-art-{n}-{phase}.png').is_file()
for n in ['merchant','elder','child']:
    for phase in ['first','wrong','matched']:assert (OUT/f'phone-memory-{n}-{phase}.png').is_file()
    for phase in ['context','entry']:assert (OUT/f'phone-recall-{n}-{phase}.png').is_file()
results=read('docs/content/r3/regression-checks.json');assert all(r['exitCode']==0 for r in results),[(r['name'],r['exitCode']) for r in results if r['exitCode']]
assert all(next(r for r in results if r['name']==name)['log'].endswith('-final-synchronized.txt') for name in ['test-content-r1-e2e','test-content-r2-e2e','test-content-r3-e2e'])
perf=read('docs/content/r3/performance-reference.json');assert perf['status']=='VERIFIED' and len(perf['samples'])==12
for sample in perf['samples']:
    raw=sorted(r['dt'] for r in sample['rawRaf'][5:]);assert len(raw)>=100
    actual=round(raw[math.ceil(len(raw)*.95)-1],2)
    assert actual==sample['p95Ms'] and actual<=18 and sample['isPhysicalDevice'] is False
patterns=[re.compile(rb'sk-proj-[A-Za-z0-9_-]{20,}'),re.compile(rb'sk-[a-z0-9]{40}'),re.compile(rb'ghp_[A-Za-z0-9]{36}'),re.compile(rb'AIza[0-9A-Za-z_-]{35}')]
hits=[];scanned=0
files=subprocess.check_output(['rg','--files','--hidden','-g','!.git','-g','!node_modules','-g','!.audit-tmp'],cwd=ROOT).decode('utf-8').splitlines()
for name in files:
    p=ROOT/name
    if p.suffix.lower() not in {'.js','.json','.md','.txt','.html','.css','.py','.yml','.yaml','.ps1','.toml'}:continue
    assert '.secrets' not in p.parts
    data=p.read_bytes();scanned+=1
    if any(pattern.search(data) for pattern in patterns):hits.append(name)
assert not hits, 'Secret-like tokens found in files: '+repr(hits)
history=read('docs/content/r3/historical-readback.json');assert history['status']=='VERIFIED'
receipt=dict(status='VERIFIED',version=pkg['version'],appVersion=pkg['appVersion'],sourceHashes={p:sha(ROOT/p) for p in ['src/content-r1.js','src/content-r1.css','src/adventure.js','src/ui.js','sw.js']},
    generatedArtCount=len(m['assets']),browserCheckCount=len(browser['checks']),regressionCommands=len(results),screenshots=screens,performanceReference='12 concurrent-host samples verified from raw rAF, not physical device or clean-machine proof',secretScan=dict(status='VERIFIED',filesScanned=scanned,hits=0),historicalFilesPreserved=history['preserved'],
    limitations=['Human blind test, player recall, physical device/clean-machine perf and Muse independent score remain BLOCKED.'])
(OUT/'release-readback.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED version, assets, native screenshots,',len(results),'commands,',len(browser['checks']),'browser checks, secret hits=0, historical preservation')
