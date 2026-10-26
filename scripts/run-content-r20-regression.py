"""Run the full current suite sequentially in an owned disposable repo copy.

Historical tests write captures to their original round/store paths; never let
those writes replace the user's existing evidence or store screenshots.
"""
from pathlib import Path
import subprocess, json, shutil, hashlib, time, os, re, sys

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/content/r20'
COPY=ROOT/'.audit-tmp/r20/regression'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    OUT.mkdir(parents=True,exist_ok=True)
    assert COPY.resolve().is_relative_to((ROOT/'.audit-tmp/r20').resolve())
    COPY.mkdir(parents=True,exist_ok=True)
    tracked=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT,encoding='utf-8').split('\0')
    extras=[p.relative_to(ROOT).as_posix() for p in (ROOT/'scripts').glob('*r20*')]
    for name in set(tracked+extras):
        if not name or not (ROOT/name).is_file():continue
        # These are live test inputs, not an old cache. Give the owned copies
        # current timestamps rather than inheriting historical source mtimes.
        dest=COPY/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,dest)
    junction=COPY/'node_modules'
    if not junction.exists():
        subprocess.run(['cmd','/d','/c','mklink','/J',str(junction),str(ROOT/'node_modules')],check=True,capture_output=True)
    assert junction.resolve()==(ROOT/'node_modules').resolve()
    source=(ROOT/'scripts/run-browser-gates.js').read_text(encoding='utf-8')
    gates=re.findall(r'^\s*"(scripts/[^\"]+)"',source,re.M)
    assert len(gates)==25
    additional=[f'scripts/test-content-r{i}-e2e.js' for i in range(10,20)]
    additional+=['scripts/test-content-r13-cache-offline.js','scripts/test-content-r14-visuals.js','scripts/test-content-r19-offline.js','scripts/test-water-quest-guide.js','scripts/test-r72-night-gate.js']
    commands=[['cmd','/d','/c','npm.cmd test'],*[['node',p] for p in gates+additional]]
    tag=str(int(time.time()));logs=OUT/'logs'/tag;logs.mkdir(parents=True,exist_ok=True)
    runtime=['package.json','package-lock.json','index.html','sw.js','manifest.webmanifest']+[p.relative_to(ROOT).as_posix() for p in (ROOT/'src').glob('*') if p.suffix in ['.js','.css']]
    report={'status':'EXECUTED','isolation':COPY.relative_to(ROOT).as_posix(),'sourceHashes':{p:sha(ROOT/p) for p in runtime},'commands':[]}
    selected=sys.argv[1:]
    for i,cmd in enumerate(commands):
        if selected and not any(x in ' '.join(cmd) for x in selected):continue
        log=logs/f'{i+1:02d}-{Path(cmd[-1]).stem}.log';start=time.monotonic();print('EXECUTED',' '.join(cmd),flush=True)
        with log.open('w',encoding='utf-8') as f:
            r=subprocess.run(cmd,cwd=COPY,stdout=f,stderr=subprocess.STDOUT,env={**os.environ,'PYTHONIOENCODING':'utf-8'},creationflags=subprocess.CREATE_NO_WINDOW)
        row={'command':cmd,'exitCode':r.returncode,'seconds':round(time.monotonic()-start,2),'log':log.relative_to(ROOT).as_posix(),'sha256':sha(log)};report['commands'].append(row)
        print('VERIFIED' if r.returncode==0 else 'BLOCKED',cmd[-1],flush=True)
        (OUT/f'regression-{tag}.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    report['sourcesUnchanged']=all(sha(ROOT/p)==h for p,h in report['sourceHashes'].items())
    report['status']='VERIFIED' if report['sourcesUnchanged'] and all(r['exitCode']==0 for r in report['commands']) else 'BLOCKED'
    (OUT/f'regression-{tag}.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    return 0 if report['status']=='VERIFIED' else 1
if __name__=='__main__':sys.exit(main())
