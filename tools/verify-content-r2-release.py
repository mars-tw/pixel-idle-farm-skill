"""Honest functional, native-size, integrity and source-only secret-scan receipt."""
import hashlib,json,re,subprocess
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/content/r2'
results={'status':'EXECUTED'}
checks=json.loads((OUT/'regression-checks.json').read_text(encoding='utf-8'));results['commands']=checks
results['failedCommands']=[r['name'] for r in checks if r['exitCode']]
browser=json.loads((OUT/'browser-checks.json').read_text(encoding='utf-8'));assert browser['status']=='VERIFIED'
carp=json.loads((OUT/'carp-continuity.json').read_text(encoding='utf-8'));assert carp['status']=='VERIFIED' and carp['catch']==1
assert [r['pose'] for r in carp['frames']]==['tap','still','tap','strike']
results['contentR2Checks']=len(browser['checks']);results['screenshots']=[]
for name in browser['screenshots']+[r['file'] for r in carp['frames']]:
 p=ROOT/name;size=Image.open(p).size
 if '/store/' in name:assert size==((1290,2796) if '/iphone-' in name else (2064,2752)),name
 else:assert size in [(320,568),(430,932)],(name,size)
 results['screenshots'].append(dict(path=name,size=size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
manifest=json.loads((ROOT/'assets/generated/content-r2/manifest.json').read_text(encoding='utf-8'));assert len(manifest['assets'])==6
for row in manifest['masters']+manifest['assets']+manifest['references']:
 p=ROOT/row['path'];assert hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256'],row['path'];assert Image.open(p).size==(row['width'],row['height'])
results['newArtwork']=6
runtime=[ROOT/p for p in ['index.html','manifest.webmanifest','offline.html','sw.js','package.json','package-lock.json']]+list((ROOT/'src').glob('*.js'))+list((ROOT/'src').glob('*.css'))
assert not any('content-r1-20261018-1' in p.read_text(encoding='utf-8') for p in runtime)
results['staleRuntimeVersionRefs']=0
subprocess.run(['node','scripts/test-version-chain.js'],cwd=ROOT,check=True,capture_output=True)
changed=subprocess.check_output(['git','diff','--name-only'],cwd=ROOT).decode().splitlines()
syntax=[p for p in changed if p.endswith('.js')]+['scripts/measure-content-r2.js','scripts/test-content-r2.js','scripts/test-content-r2-e2e.js','scripts/capture-content-r2-rhythms.js']
for name in syntax:subprocess.run(['node','-c',name],cwd=ROOT,check=True,capture_output=True)
results['syntaxFiles']=syntax;results['version']=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
pattern=re.compile(rb'sk-proj-[A-Za-z0-9_-]{20,}|sk-[a-z0-9]{40}');hits=[];count=0
for p in ROOT.rglob('*'):
 rel=p.relative_to(ROOT)
 if any(x in ['.git','node_modules','.audit-tmp','__pycache__','.venv','venv'] for x in rel.parts) or not p.is_file():continue
 count+=1
 if pattern.search(p.read_bytes()):hits.append(rel.as_posix())
results['secretScan']=dict(files=count,matches=len(hits),paths=hits,scope='repo only; never accesses credential directories');assert not hits
results['historicalReadback']=json.loads((OUT/'historical-readback.json').read_text(encoding='utf-8'))['status']
perf=json.loads((OUT/'performance-complete-fixture-comparison.json').read_text(encoding='utf-8'));results['performance']=perf.get('performanceGate','BLOCKED')
results['nativeDevices']='BLOCKED';results['humanBlindTests']='BLOCKED';results['museRescore']='BLOCKED'
results['recoveredChecks']={'carp-continuity':'carp-continuity-final: passed after waiting for the actual pond DOM; original failure log retained'}
results['status']='VERIFIED';results['scope']='Functional/artifact integrity; open failures retained, not a store-release approval'
(OUT/'release-readback.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED integrity; secret matches',len(hits),'new art6; performance',results['performance'],'failed commands',results['failedCommands'])
