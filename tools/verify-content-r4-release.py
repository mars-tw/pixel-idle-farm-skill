"""Read back current source, native artifacts, test receipts and baseline preservation."""
import hashlib,json,math,re,subprocess
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/content/r4'
def read(p):return json.loads((ROOT/p).read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
pkg=read('package.json');assert pkg['version']=='0.1.27' and pkg['appVersion']=='content-r4-20261019-1'
for p in ['index.html','sw.js','manifest.webmanifest',*[str(p.relative_to(ROOT)) for p in (ROOT/'src').glob('*') if p.suffix in ['.js','.css']]]:
 assert 'content-r3-20261019-1' not in (ROOT/p).read_text(encoding='utf-8'),p
art=read('assets/generated/content-r4/manifest.json');assert len(art['assets'])==2 and art['tool']=='image_gen.imagegen'
palette={tuple(bytes.fromhex(c[1:])) for c in art['palette']}
for a in art['masters']+art['assets']+art['references']:assert sha(ROOT/a['path'])==a['sha256'],a['path']
for a in art['assets']:
 im=Image.open(ROOT/a['path']);assert im.size==(512,256);assert set(im.convert('RGB').get_flattened_data()).issubset(palette)
browser=read('docs/content/r4/browser-checks.json');assert browser['status']=='VERIFIED' and not browser['errors']
new_art=read('docs/content/r4/art-checks.json');assert new_art['status']=='VERIFIED' and len(new_art['checks'])>=7
walking=[f['state'] for f in browser['frames'] if 'phone-delivery-walking-' in f['path']]
assert len(walking)==3 and len({f['sprite'] for f in walking})>=2 and all(f['bread']==10 for f in walking)
cancel=[f['state']['bread'] for f in browser['frames'] if 'phone-delivery-cancel-' in f['path']]
assert cancel==[10,10]
screens=[]
for rel in browser['screenshots']:
 p=ROOT/rel;w,h=Image.open(p).size
 if rel.startswith('docs/content/r4/phone-'):assert w in (320,390,430,768) and h>w,(rel,w,h)
 screens.append(dict(path=rel,width=w,height=h,sha256=sha(p)))
for fish in ['river_carp','silver_dace','river_perch']:
 for name in [f'phone-water-{fish}-pre-sink-masked.png',f'phone-water-{fish}-submerging.png',f'phone-water-{fish}-masked.png',f'phone-pond-{fish}-caught-again.png',f'phone-cooldown-{fish}-ready.png']:
  assert (OUT/name).is_file(),name
 assert any(f'{fish} full30s cooldown elapsed' in c for c in browser['checks'])
for who in ['merchant','elder','child']:
 for name in [f'phone-recall-{who}-context.png',f'phone-taste-{who}-matched.png',f'phone-story-{who}-first.png']:
  assert (OUT/name).is_file(),name
 for result in ['first','wrong','matched']:assert (OUT/f'phone-memory-{who}-{result}.png').is_file()
for name,size in [('iphone-10-remembered-gift.png',(1290,2796)),('ipad-10-remembered-gift.png',(2064,2752))]:
 p=ROOT/'docs/store/screenshots'/name;assert Image.open(p).size==size
results=read('docs/content/r4/regression-checks.json');assert all(c['exitCode']==0 for c in results),results
syntax=read('docs/content/r4/syntax-checks.json');assert syntax['status']=='VERIFIED' and all(f['exitCode']==0 for f in syntax['files'])
log=(OUT/'logs/browser-gates.txt').read_text(encoding='utf-8');assert 'every browser process closed' in log and 'test-content-r4-e2e.js' in log
perf=read('docs/content/r4/performance-reference.json');assert perf['status']=='VERIFIED' and len(perf['samples'])==12
for s in perf['samples']:
 raw=sorted(r['dt'] for r in s['rawRaf'][5:]);assert len(raw)>=100
 assert round(raw[math.ceil(len(raw)*.95)-1],2)==s['p95Ms']
for scene in ['sunpatch','pond']:
 for view in ['1366x768','390x844']:
  samples=[s['p95Ms'] for s in perf['samples'] if s['scene']==scene and s['viewport']==view];assert len(samples)==3 and sorted(samples)[1]<=18,(scene,view,samples)
patterns=[re.compile(rb'sk-proj-[A-Za-z0-9_-]{20,}'),re.compile(rb'sk-[a-z0-9]{40}'),re.compile(rb'ghp_[A-Za-z0-9]{36}'),re.compile(rb'AIza[0-9A-Za-z_-]{35}')]
hits=[];scanned=0
files=subprocess.check_output(['rg','--files','--hidden','-g','!.git','-g','!node_modules','-g','!.audit-tmp'],cwd=ROOT).decode('utf-8').splitlines()
for name in files:
 p=ROOT/name
 if p.suffix.lower() not in {'.js','.json','.md','.txt','.html','.css','.py','.yml','.yaml','.ps1','.toml'}:continue
 assert '.secrets' not in p.parts
 scanned+=1
 if any(pat.search(p.read_bytes()) for pat in patterns):hits.append(name)
assert not hits,'Secret-like tokens in: '+repr(hits)
history=read('docs/content/r4/historical-readback.json');assert history['status']=='VERIFIED'
baseline=json.loads((ROOT/'.audit-tmp/content-r4-baseline/files.json').read_text(encoding='utf-8'))
for name,digest in baseline.items():assert sha(ROOT/name)==digest,name
store=dict(status='VERIFIED',version=pkg['appVersion'],source='Actual earned nine-delivery save, real browser capture at DPR3/DPR2. No crop, resize, overlay or composite. Midgame prerequisites and starting ingredients are disclosed in browser-checks.json.',screenshots=[s for s in screens if s['path'].startswith('docs/store/')])
(ROOT/'docs/store/screenshots-content-r4-manifest.json').write_text(json.dumps(store,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
receipt=dict(status='VERIFIED',version=pkg['version'],appVersion=pkg['appVersion'],generatedArtCount=2,browserCheckCount=len(browser['checks']),regressionCommands=len(results),screenshots=screens,secretScan=dict(status='VERIFIED',filesScanned=scanned,hits=0),historicalFilesPreserved=len(baseline),sourceHashes={p:sha(ROOT/p) for p in ['src/content-r1.js','src/content-r1.css','src/adventure.js','sw.js']},performanceMedianGate='VERIFIED',performanceAllRunsGate=perf['referenceGate'],performanceOutliers=[dict(scene=s['scene'],viewport=s['viewport'],run=s['run'],p95Ms=s['p95Ms']) for s in perf['samples'] if s['p95Ms']>18],limits=['Concurrent-host performance only; physical devices, clean-machine results, human playtests and Muse independent rescore remain BLOCKED. One desktop pond run measured33.3ms; do not claim all individual runs<=18ms.'])
(OUT/'release-readback.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED native screenshots,',len(browser['checks']),'browser checks, all gates, source hashes, zero secret hits and',len(baseline),'baseline files')
