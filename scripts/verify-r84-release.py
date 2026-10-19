"""Final R84 local-only checks. One test process and one headless server at a time."""
from pathlib import Path
from PIL import Image
import subprocess,json,re,hashlib,time,sys
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/evidence/r84-art';LOGS=OUT/'logs'
COMMANDS=[('npm-test',['cmd.exe','/d','/c','npm','test']),('e2e',['cmd.exe','/d','/c','npm','run','test:e2e']),('night',['node','scripts/test-r72-night-gate.js']),('water-guide',['node','scripts/test-water-quest-guide.js']),('compare',['node','scripts/capture-r84-art.js']),('readback',['python','-W','ignore::DeprecationWarning','scripts/verify-r84-art.py'])]
def main():
    LOGS.mkdir(parents=True,exist_ok=True);rows=[];commands=COMMANDS
    if '--resume' in sys.argv:
        previous=json.loads((OUT/'final-checks.json').read_text(encoding='utf-8'))['checks']
        for row in previous:
            if row['exitCode']:break
            rows.append(row)
        done={row['name'] for row in rows}
        commands=[command for command in COMMANDS if command[0] not in done]
        # Final targeted readbacks cover the presentation fixes after the complete CI pass.
        extra=[('world-final',['node','scripts/test-world-rework-e2e.js']),('store-final',['node','scripts/test-r81-review.js','--journey-only']),('art-final',['node','scripts/test-r84-art.js'])]
        commands=[c for c in commands if c[0] not in ['compare','readback']]+[c for c in extra if c[0] not in done]+[c for c in commands if c[0] in ['compare','readback']]
    for label,cmd in commands:
        start=time.time();log=LOGS/(label+'.txt')
        with log.open('wb') as f:r=subprocess.run(cmd,cwd=ROOT,stdout=f,stderr=subprocess.STDOUT)
        rows.append(dict(name=label,command=cmd,exitCode=r.returncode,seconds=round(time.time()-start,2),log=log.relative_to(ROOT).as_posix()))
        print(label+': '+str(r.returncode),flush=True)
        (OUT/'final-checks.json').write_text(json.dumps(dict(status='EXECUTED' if not r.returncode else 'BLOCKED',checks=rows),indent=2)+'\n',encoding='utf-8')
        if r.returncode:raise RuntimeError(label+' failed; see '+str(log))
    syntax=[]
    for p in list((ROOT/'src').glob('*.js'))+list((ROOT/'scripts').glob('*.js')):
        r=subprocess.run(['node','--check',str(p)],cwd=ROOT,capture_output=True);assert r.returncode==0,(p,r.stderr);syntax.append(p.relative_to(ROOT).as_posix())
    pattern=re.compile(rb'sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}');hits=[]
    for p in ROOT.rglob('*'):
        if not p.is_file() or any(v in p.relative_to(ROOT).parts for v in ['.git','node_modules','.audit-tmp','.secrets']):continue
        if p.suffix.lower() not in ['.js','.json','.html','.css','.md','.txt','.yml','.yaml','.py','.ps1','.webmanifest']:continue
        if pattern.search(p.read_bytes()):hits.append(p.relative_to(ROOT).as_posix())
    assert not hits,'secret scan: '+str(hits)
    old='r83-20261016-1'; runtime=[ROOT/p for p in ['index.html','sw.js','manifest.webmanifest','package.json']]+list((ROOT/'src').glob('*'))
    assert all(old not in p.read_text(encoding='utf-8') for p in runtime if p.is_file()),'old runtime version remains'
    shots=[]
    for platform,size in [('iphone',(1290,2796)),('ipad',(2064,2752))]:
        for suffix in ['01-welcome','02-sunlight','03-basket','04-note','05-daily']:
            p=ROOT/f'docs/store/screenshots/{platform}-{suffix}.png';im=Image.open(p);assert im.size==size,(p,im.size);shots.append(dict(path=p.relative_to(ROOT).as_posix(),size=list(im.size),sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
    r=subprocess.run(['git','diff','--check'],cwd=ROOT,capture_output=True);assert r.returncode==0,r.stdout
    package=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
    result=dict(status='VERIFIED',headless=True,localOnly=True,version=package['version'],appVersion=package['appVersion'],checks=rows,syntax=syntax,secretScan=dict(matches=0,scope='repo text; excludes .git/node_modules/.audit-tmp/.secrets; no external credentials read'),oldRuntimeVersionMatches=0,storeScreenshots=shots,limitations=['Concurrent load performance is reference only.','No native build/device or independent 8/10 rescore.'])
    (OUT/'verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');(OUT/'final-checks.json').write_text(json.dumps(dict(status='VERIFIED',checks=rows),indent=2)+'\n',encoding='utf-8');print('VERIFIED final checks',flush=True)
if __name__=='__main__':main()
