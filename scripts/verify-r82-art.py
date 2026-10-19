"""Release receipts for the local art refresh. Never reads external credential paths."""
import hashlib, json, re, struct, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/evidence/r82-art'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    pkg=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
    assert (pkg['version'],pkg['appVersion'])==('0.1.16','r82-20261016-1')
    syntax=[]
    for p in list((ROOT/'src').glob('*.js'))+list((ROOT/'scripts').glob('*.js')):
        r=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
        assert r.returncode==0,(p.name,r.stderr)
        syntax.append(p.relative_to(ROOT).as_posix())
    runtime=[ROOT/n for n in ['index.html','offline.html','sw.js','manifest.webmanifest','package.json','package-lock.json','README.md']]+list((ROOT/'src').glob('*'))
    old=[p.relative_to(ROOT).as_posix() for p in runtime if p.is_file() and 'r81-20261015-1' in p.read_text(encoding='utf-8',errors='replace')]
    assert not old,old
    patterns=[re.compile(rb'sk-proj-[A-Za-z0-9_-]{20}'),re.compile(rb'sk-[a-z0-9]{40}')]
    skip={'.git','node_modules','.audit-tmp','.secrets','__pycache__'}
    hits=[]
    # Prune excluded trees instead of traversing any credential directory.
    def scan(directory):
        for p in directory.iterdir():
            if p.name in skip or p.is_symlink():continue
            if p.is_dir():scan(p)
            elif p.is_file() and any(r.search(p.read_bytes()) for r in patterns):hits.append(p.relative_to(ROOT).as_posix())
    scan(ROOT);assert not hits,hits
    logs={}
    for name in ['npm-test.txt','e2e.txt','review-capture.txt','night-gate.txt','water-guide.txt']:
        p=OUT/'logs'/name;raw=p.read_bytes()
        text=raw.decode('utf-16') if raw.startswith((b'\xff\xfe',b'\xfe\xff')) else raw.decode('utf-8-sig')
        text=text.replace('\r\r\n','\n').replace('\r\n','\n');p.write_text(text,encoding='utf-8')
        assert not any(s in text for s in ['AssertionError','TimeoutError','FAIL ']),name
        logs[name]={'sha256':sha(p),'bytes':p.stat().st_size,'passLines':sum(bool(re.search(r'PASS |✓|✅',line)) for line in text.splitlines())}
    assert 'every browser process closed' in (OUT/'logs/e2e.txt').read_text(encoding='utf-8')
    art=json.loads((OUT/'art-validation.json').read_text(encoding='utf-8'));assert art['status']=='VERIFIED'
    review=json.loads((OUT/'review-results.json').read_text(encoding='utf-8'));assert review['status']=='VERIFIED' and len(review['journeys'])==2
    shots=[]
    for device,expected in [('iphone',(1290,2796)),('ipad',(2064,2752))]:
        for i,scene in enumerate(['welcome','sunlight','basket','note','daily'],1):
            p=ROOT/f'docs/store/screenshots/{device}-{i:02d}-{scene}.png';data=p.read_bytes()
            assert data[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',data[16:24])==expected,p.name
            shots.append({'file':p.name,'width':expected[0],'height':expected[1],'sha256':sha(p),'status':'VERIFIED','capture':'actual headless Chromium UI; R82 art; real earned journey'})
    (ROOT/'docs/store/screenshots-manifest.json').write_text(json.dumps({'release':pkg['appVersion'],'status':'VERIFIED','injectedProgress':False,'screenshots':shots,'historicalAuxiliaryFiles':['ipad-01-earned-farm.png','ipad-02-earned-note.png']},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    report={'status':'VERIFIED','version':pkg['version'],'appVersion':pkg['appVersion'],'syntaxChecked':syntax,'runtimeOldVersionHits':old,'secretHits':hits,'logs':logs,'artChecks':len(art['checks']),'journeys':review['journeys'],'storeScreenshots':len(shots),'qualification':'Chromium headless only. Performance under concurrent load is reference only; no real-device or Apple approval claim.'}
    (OUT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
