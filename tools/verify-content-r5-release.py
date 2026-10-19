"""Read back the actual R5 journey, serial gates, source snapshot and native artifacts."""
import hashlib
import json
from pathlib import Path
import re
import statistics
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/content/r5'
COPY = ROOT / '.audit-tmp/content-r5-validation'

def read(name):
    return json.loads((OUT / name).read_text(encoding='utf-8'))

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

gates = read('regression-checks.json')
assert len(gates) == 4 and all(x['exitCode'] == 0 for x in gates)
browser = read('browser-checks.json')
assert browser['status'] == 'VERIFIED' and len(browser['checks']) == 126 and not browser['errors']
log = (OUT / 'logs/browser-gates.txt').read_text(encoding='utf-8')
assert log.count('[memory] scripts/') == 21 and 'every browser process closed' in log
assert 'R79 SUMMARY {"passed":44,"failed":0}' in log
assert 'R75 SUMMARY {"passed":370,"failed":0}' in log
history = read('historical-readback.json')
assert history['status'] == 'VERIFIED' and not history['changed']
protected = read('protected-files.json')
assert all((ROOT/n).is_file() and sha(ROOT/n) == h for n, h in protected.items())

runtime = [*sorted((ROOT/'src').glob('*.js')), *sorted((ROOT/'src').glob('*.css')),
           *sorted((ROOT/'scripts').glob('test-*.js')), ROOT/'scripts/run-browser-gates.js',
           *[ROOT/p for p in ['index.html','sw.js','manifest.webmanifest','package.json','package-lock.json']],
           *sorted((ROOT/'assets/generated/content-r5').glob('*'))]
hashes = {}
for p in runtime:
    name = p.relative_to(ROOT).as_posix()
    assert p.read_bytes() == (COPY/name).read_bytes(), name
    hashes[name] = sha(p)
pkg = json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
lock = json.loads((ROOT/'package-lock.json').read_text(encoding='utf-8'))
assert pkg['version'] == lock['version'] == lock['packages']['']['version'] == '0.1.28'
assert pkg['appVersion'] == 'content-r5-20261019-1'
assert all('content-r4-20261019-1' not in p.read_text(encoding='utf-8') for p in runtime if p.suffix in ['.js','.css','.html','.webmanifest'])
assert not subprocess.check_output(['git','diff','--name-only','--','scripts/test-*.js'],cwd=ROOT).strip()

art = json.loads((ROOT/'assets/generated/content-r5/manifest.json').read_text(encoding='utf-8'))
for row in art['assets'] + art['masters'] + art['references']:
    assert sha(ROOT/row['path']) == row['sha256'], row['path']
assert art['tool'] == 'image_gen.imagegen' and len(art['assets']) == 2
shots = read('screenshot-readback.json')
assert len(shots['reviewSet']) == len(list((OUT/'review-set').iterdir())) == 15
for row in shots['reviewSet'] + shots['store'] + shots['before']:
    p = ROOT / row['path']
    assert sha(p) == row['sha256'], row['path']
    if 'width' in row:
        assert Image.open(p).size == (row['width'], row['height'])
for row in shots['reviewSet']:
    assert (ROOT/row['source']).read_bytes() == (ROOT/row['path']).read_bytes()
    assert row['height'] > row['width']
assert all(sum(x['content'] == k for x in shots['reviewSet']) == 5 for k in ['basket','pond','memory'])
assert not subprocess.check_output(['git','diff','--name-only','--','docs/store/screenshots'],cwd=ROOT).strip()

syntax = read('syntax-checks.json')
assert syntax['status'] == 'VERIFIED' and len(syntax['files']) == 95
files = set()
for args in [[], ['--others','--exclude-standard']]:
    files.update(subprocess.check_output(['git','ls-files','-z',*args],cwd=ROOT).decode().split('\0'))
regex = re.compile(r'sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}')
scanned, hits = 0, []
for name in sorted(files):
    p = ROOT/name
    if not name or not p.is_file() or p.suffix.lower() not in ['.js','.css','.html','.json','.webmanifest','.md','.txt','.py','.ps1','.yml','.yaml','.sh']:
        continue
    scanned += 1
    for line, value in enumerate(p.read_text(encoding='utf-8',errors='replace').splitlines(),1):
        if regex.search(value):
            hits.append(dict(path=name,line=line))
assert not hits, hits
(OUT/'secret-scan.json').write_text(json.dumps(dict(status='VERIFIED',scannedTextFiles=scanned,hitCount=0,hits=[],excluded=['.git','node_modules','.audit-tmp'],method='Required key-signature expressions; no matched values emitted.'),indent=2)+'\n',encoding='utf-8')

perf = read('performance-reference.json')
assert perf['status'] == 'VERIFIED' and len(perf['samples']) == 12
groups = []
for scene in ['sunpatch','pond']:
    for viewport in ['1366x768','390x844']:
        xs = [x['p95Ms'] for x in perf['samples'] if x['scene']==scene and x['viewport']==viewport]
        assert len(xs) == 3
        groups.append(dict(scene=scene,viewport=viewport,p95Ms=xs,medianMs=statistics.median(xs)))
receipt = dict(status='VERIFIED',scope='Local functional release and artifact readback, no independent rating or physical-device claim.',
               version=pkg['version'],appVersion=pkg['appVersion'],baseCommit='9965109',
               browserChecks=len(browser['checks']),browserGateScripts=21,jsSyntaxFiles=95,
               generatedArt=2,reviewPortraits=15,storeImages=2,secretHits=0,protectedFiles=len(protected),
               validatedSnapshotMatchesRuntime=True,runtimeHashes=hashes,
               performance=groups,allReferenceRunsGate=perf['referenceGate'],
               medianReferenceGate='VERIFIED' if all(x['medianMs']<=18 for x in groups) else 'BLOCKED',
               blocked=['physical phone/iPad','human/family playtest','clean dedicated-host performance','independent Muse score >=8'],
               tests=gates)
(OUT/'release-readback.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED local release readback:21 browser scripts,126 new checks,95 JS,15 portraits,2 store,2 art,0 secret hits')
print('VERIFIED protected historical files',len(protected))
print('Performance reference',json.dumps(groups),'all-runs='+perf['referenceGate'])
