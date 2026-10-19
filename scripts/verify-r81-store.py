"""Deterministic local release evidence, without opening windows or reading credentials."""
import hashlib, json, re, struct, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/evidence/r81-store'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    # Windows PowerShell redirects native stdout as UTF-16. Preserve its exact
    # text while making this round's evidence readable as UTF-8 across systems.
    for log in OUT.glob('*.txt'):
        if log.name == 'verification-log.txt': continue
        raw=log.read_bytes()
        text=raw.decode('utf-16') if raw.startswith((b'\xff\xfe',b'\xfe\xff')) else raw.decode('utf-8-sig')
        log.write_text(text.replace('\r\r\n','\n').replace('\r\n','\n'),encoding='utf-8',newline='\n')
    pkg=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
    assert pkg['version']=='0.1.15' and pkg['appVersion']=='r81-20261015-1'
    runtime=[ROOT/n for n in ['index.html','offline.html','sw.js','manifest.webmanifest','package.json','package-lock.json']]+list((ROOT/'src').glob('*'))
    old=[p.relative_to(ROOT).as_posix() for p in runtime if p.is_file() and 'r80-20261015-1' in p.read_text(encoding='utf-8',errors='replace')]
    assert not old, old
    syntax=[]
    for p in list((ROOT/'src').glob('*.js'))+list((ROOT/'scripts').glob('*.js')):
        r=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
        assert r.returncode==0,(str(p),r.stderr)
        syntax.append(p.relative_to(ROOT).as_posix())
    patterns=[re.compile(rb'sk-proj-[A-Za-z0-9_-]{20}'),re.compile(rb'sk-[a-z0-9]{40}')]
    hits=[]
    skip={'.git','node_modules','.audit-tmp','.secrets','__pycache__'}
    for p in ROOT.rglob('*'):
        if not p.is_file() or any(part in skip for part in p.relative_to(ROOT).parts):continue
        data=p.read_bytes()
        if any(pattern.search(data) for pattern in patterns):hits.append(p.relative_to(ROOT).as_posix())
    assert not hits,hits
    review=json.loads((OUT/'review-results.json').read_text(encoding='utf-8'))
    assert review['status']=='VERIFIED',review.get('error')
    assert len(review['journeys'])==2
    shots=[]
    for p in sorted((ROOT/'docs/store/screenshots').glob('*.png')):
        data=p.read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n'
        w,h=struct.unpack('>II',data[16:24])
        expected=(1290,2796) if p.name.startswith('iphone-') else (2064,2752)
        assert (w,h)==expected,(p.name,w,h)
        shots.append({'file':p.name,'width':w,'height':h,'sha256':sha(p),'status':'VERIFIED','capture':'actual headless Chromium UI'})
    required={f'{device}-{n:02d}-{scene}.png' for device in ['iphone','ipad'] for n,scene in enumerate(['welcome','sunlight','basket','note','daily'],1)}
    assert required <= {x['file'] for x in shots}
    (ROOT/'docs/store/screenshots-manifest.json').write_text(json.dumps({'status':'VERIFIED','injectedProgress':False,'screenshots':shots},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    logs={}
    for name in ['npm-test.txt','e2e.txt','night-gate.txt','water-guide.txt']:
        p=OUT/name;assert p.exists(),name
        text=p.read_text(encoding='utf-8-sig',errors='replace')
        assert 'AssertionError' not in text and 'TimeoutError' not in text and 'FAIL ' not in text,name
        logs[name]={'sha256':sha(p),'bytes':p.stat().st_size,'passLines':sum(1 for line in text.splitlines() if re.search(r'PASS |✓|✅',line))}
    assert 'every browser process closed' in (OUT/'e2e.txt').read_text(encoding='utf-8-sig',errors='replace')
    report={'status':'VERIFIED','packageVersion':pkg['version'],'appVersion':pkg['appVersion'],'runtimeOldVersionHits':old,'syntaxChecked':syntax,'secretHits':hits,'secretScope':'repository excluding .git, node_modules, .audit-tmp, .secrets and Python cache; no credential directory accessed','reviewChecks':len(review['checks']),'journeys':review['journeys'],'logs':logs,'screenshots':len(shots),'performanceQualification':'並發載量測，僅供參考；不認定閒置機器出貨效能閘通過','art':'BLOCKED: dedicated note illustrations and basket/rod poses; no new raster generation or asserted model slug'}
    (OUT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (OUT/'verification-log.txt').write_text('VERIFIED: release evidence checks completed.\n'+json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
