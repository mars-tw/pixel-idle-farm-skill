import pathlib,subprocess,json,sys,shutil,os
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r13';env={**os.environ,'PYTHONIOENCODING':'utf-8'}
for name in ['performance-reference.json','animation-audit.json','final-evidence.json','protected-readback.json']:
    source=O/name;backup=O/(source.stem+'-before-river-grid.json')
    if source.exists() and not backup.exists():shutil.copyfile(source,backup)
steps=[('node',['scripts/audit-content-r13-evidence.js'],'animation-audit-river-grid.log'),('node',['scripts/test-content-r13-e2e.js','--offline-only'],'offline-river-grid.log'),('node',['scripts/finalize-content-r13-evidence.js'],'evidence-river-grid.log'),('node',['scripts/test-content-r13-cache-offline.js'],'cache-offline-final.log'),('node',['scripts/measure-content-r13.js'],'performance-final.log'),('python',['tools/select-content-r13-review.py'],'review-selection.log'),('python',['tools/close-content-r13.py','--readback-only'],'closeout-final.log')]
for cmd,args,name in steps:
    print('EXECUTED',cmd,*args,flush=True)
    with (O/name).open('w',encoding='utf-8') as f:r=subprocess.run([cmd,*args],cwd=R,env=env,stdout=f,stderr=subprocess.STDOUT)
    if r.returncode:print('BLOCKED',name,flush=True);sys.exit(r.returncode)
    print('VERIFIED',name,flush=True)
print('VERIFIED final render, current source receipts, selection and report',flush=True)
