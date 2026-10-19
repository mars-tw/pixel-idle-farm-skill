"""Local readback: syntax, version chain, generated art, screenshot sizes, secrets."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/content/r1'
results = {'status':'EXECUTED'}
checks = json.loads((OUT/'final-checks.json').read_text(encoding='utf-8'))
for name in ['npm-test-final','content-r1-final','water-guide','night-gate']:
    latest = [r for r in checks if r['name'] == name][-1]
    assert latest['exitCode'] == 0, name
browser = json.loads((OUT/'browser-checks.json').read_text(encoding='utf-8'))
assert browser['status'] == 'VERIFIED'
results['functionalChecks'] = len(browser['checks'])
results['functionalScope'] = browser['scope']
ci_log = (OUT/'logs/browser-ci.txt').read_text(encoding='utf-8')
sequence = list(dict.fromkeys(re.findall(r'\[memory\] (scripts/\S+) attempt',ci_log)))
assert sequence[-1] == 'scripts/test-content-r1-e2e.js' and len(sequence) == 17
results['existingCIGates'] = {'status':'VERIFIED','scripts':sequence[:-1], 'evidence':'The sequential runner entered the next script only after exit 0; all 16 existing scripts passed. The initial new-script performance failure is retained and was followed by functional recovery.'}
results['performanceGate'] = {'status':'BLOCKED','limitMs':18,'evidence':'docs/content/r1/browser-checks-unstable-performance.json','note':'Same-source shared-host measurements vary from passing16.8ms to failing33.3/33.4ms; no stable <=18ms claim. Strict --perf-only assertion remains available.'}
for file in sorted(list((ROOT/'src').glob('*.js'))+list((ROOT/'scripts').glob('*.js'))):
    subprocess.run(['node','-c',str(file)],check=True,cwd=ROOT,capture_output=True)
results['syntaxFiles'] = len(list((ROOT/'src').glob('*.js'))+list((ROOT/'scripts').glob('*.js')))
subprocess.run(['node','scripts/test-version-chain.js'],cwd=ROOT,check=True)
runtime = [ROOT/p for p in ['index.html','manifest.webmanifest','offline.html','sw.js','package.json']]+list((ROOT/'src').glob('*.js'))+list((ROOT/'src').glob('*.css'))
assert all('r89-20261018-1' not in p.read_text(encoding='utf-8') for p in runtime)
results['staleRuntimeVersionRefs'] = 0
results['packageVersion'] = json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
results['storeScreenshots'] = []
for platform, size in [('iphone',(1290,2796)),('ipad',(2064,2752))]:
    file = ROOT / f'docs/store/screenshots/{platform}-07-neighbor-memory.png'
    assert Image.open(file).size == size
    results['storeScreenshots'].append({'path':file.relative_to(ROOT).as_posix(),'size':size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
manifest = json.loads((ROOT/'assets/generated/content-r1/manifest.json').read_text(encoding='utf-8'))
for record in manifest['assets']+[manifest['master']]+manifest['references']:
    file = ROOT/record['path']
    assert hashlib.sha256(file.read_bytes()).hexdigest()==record['sha256'], record['path']
    assert Image.open(file).size==(record['width'],record['height'])
results['generatedRuntimeAssets'] = len(manifest['assets'])
pattern = re.compile(rb'sk-proj-[A-Za-z0-9_-]{20,}|sk-[a-z0-9]{40}')
count=0
hits=[]
for file in ROOT.rglob('*'):
    rel=file.relative_to(ROOT)
    if any(part in ('.git','node_modules','.audit-tmp','__pycache__','.venv','venv') for part in rel.parts) or not file.is_file():
        continue
    count+=1
    if pattern.search(file.read_bytes()): hits.append(rel.as_posix())
results['secretScan']={'files':count,'matches':len(hits),'paths':hits,'scope':'repo only; excludes .git/node_modules/.audit-tmp/cache/env; never accesses secret directory'}
assert not hits, 'Secret scan hit; do not print matching content'
results['status']='VERIFIED'
results['scope']='Functional/integrity readback only. Stable performance and native-device release remain unverified.'
(OUT/'release-readback.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED syntax',results['syntaxFiles'],'store sizes',len(results['storeScreenshots']),'secret files',count,'hits',len(hits))
