"""Serial local gates and auditable restoration of historical test-output files."""
import datetime, hashlib, json, pathlib, re, shutil, subprocess, time
import sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/content/r7'
(OUT/'logs').mkdir(parents=True,exist_ok=True)
base=ROOT/'.audit-tmp/content-r7-baseline'
original=json.loads((base/'baseline.json').read_text(encoding='utf-8'))
allowed=set(json.loads((ROOT/'.audit-tmp/content-r7-owned.json').read_text(encoding='utf-8')))
browser=re.findall(r'"(scripts/[^"\n]+\.js)"',(ROOT/'scripts/run-browser-gates.js').read_text(encoding='utf-8'))
commands=[['npm.cmd','test']]+[['node',script] for script in browser]+[['node','scripts/test-water-quest-guide.js'],['node','scripts/test-r72-night-gate.js']]
report={'status':'EXECUTED','startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'protocol':'one headless browser script and server at a time; no external service, no visible window','commands':[]}
if '--resume' in sys.argv:
    previous=json.loads((OUT/'regression-checks.json').read_text(encoding='utf-8'))
    for item in previous['commands']:
        if item['exitCode']:break
        report['commands'].append(item)
    report['previousAttempts']=[p.relative_to(ROOT).as_posix() for p in sorted(OUT.glob('regression-attempt*.json'))]
    report['previousRestoredHistoricalFiles']=previous.get('restoredHistoricalFiles',[])
    report['resumedAt']=report['startedAt']
start=len(report['commands'])
(OUT/'regression-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
try:
    for i,cmd in enumerate(commands[start:],start):
        name='npm-test' if cmd[0]=='npm.cmd' else pathlib.Path(cmd[-1]).stem
        log=OUT/'logs'/(name+'.txt')
        started=time.monotonic()
        with log.open('w',encoding='utf-8',newline='\n') as f:
            proc=subprocess.run(cmd,cwd=ROOT,stdout=f,stderr=subprocess.STDOUT,encoding='utf-8',env=__import__('os').environ|{'PYTHONIOENCODING':'utf-8'})
        item={'command':cmd,'exitCode':proc.returncode,'seconds':round(time.monotonic()-started,3),'log':log.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(log.read_bytes()).hexdigest()}
        report['commands'].append(item)
        (OUT/'regression-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(i+1,len(commands),name,'VERIFIED' if proc.returncode==0 else 'BLOCKED',flush=True)
        if proc.returncode:break
    report['status']='VERIFIED' if len(report['commands'])==len(commands) and all(x['exitCode']==0 for x in report['commands']) else 'BLOCKED'
finally:
    allowed=set(json.loads((ROOT/'.audit-tmp/content-r7-owned.json').read_text(encoding='utf-8')))
    restored=[]
    for name,expected in original.items():
        if name in allowed:continue
        target=ROOT/name
        if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest()!=expected:
            if target.exists():
                archive=OUT/'regression'/name
                archive.parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(target,archive)
            target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(base/'files'/name,target)
            assert hashlib.sha256(target.read_bytes()).hexdigest()==expected
            restored.append(name)
    report['restoredHistoricalFiles']=restored
    report['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    (OUT/'regression-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(report['status'],'restored',len(restored),'baseline files',flush=True)
raise SystemExit(0 if report['status']=='VERIFIED' else 1)
