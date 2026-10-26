"""Delete only hashed, tracked, superseded media in this repository."""
from pathlib import Path
import subprocess,json,hashlib,sys,re
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r20';O.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
planfile=O/'cleanup-plan.json'
if '--apply' not in sys.argv:
    retained=json.loads((R/'docs/content/r19/cleanup-plan.json').read_text(encoding='utf-8'))['retainedDependencies']
    keep={x['path'] for x in retained};files=[]
    for rel in subprocess.check_output(['git','ls-files','-z'],cwd=R,encoding='utf-8').split('\0'):
        p=R/rel
        if not p.is_file() or p.suffix.lower() not in ['.png','.jpg','.jpeg','.webp','.mp4','.webm','.gif']:continue
        if not (re.match(r'docs/content/r(?:[1-9]|1[0-9])/',rel) or rel.startswith('docs/evidence/')):continue
        if rel in keep:continue
        if rel.startswith('docs/content/r19/') and '/review-set/' not in rel:
            retained.append({'path':rel,'bytes':p.stat().st_size,'sha256':sha(p),'consumers':['tools/verify-content-r19-release.py via journey.json / offline-delivery-serving.json'],'reason':'Historical release verifier input. Only regenerated review-set outputs are retired.'})
            keep.add(rel);continue
        files.append({'path':rel,'bytes':p.stat().st_size,'sha256':sha(p),'replacement':'docs/content/r20/','reason':'Superseded capture, not a retained verifier/source input.'})
    plan={'status':'PREPARED','scope':'Tracked old media only. Previous verifier exceptions, store, art sources, Markdown/JSON and initial untracked files retained.','files':files,'count':len(files),'bytes':sum(x['bytes'] for x in files),'retainedDependencies':[x for x in retained if (R/x['path']).is_file()]}
    planfile.write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8');print('PREPARED',plan['count'],plan['bytes']);sys.exit(0)
plan=json.loads(planfile.read_text(encoding='utf-8'))
for x in plan['files']:
    p=(R/x['path']).resolve();assert p.is_relative_to(R.resolve()) and p.is_relative_to((R/'docs').resolve())
    subprocess.run(['git','ls-files','--error-unmatch','--',x['path']],cwd=R,stdout=subprocess.DEVNULL,check=True)
    assert p.is_file() and sha(p)==x['sha256']
for x in plan['files']:(R/x['path']).unlink()
result={'status':'VERIFIED','deletedCount':len(plan['files']),'bytes':plan['bytes'],'allAbsent':all(not (R/x['path']).exists() for x in plan['files']),'files':plan['files'],'retainedDependencyCount':len(plan['retainedDependencies'])}
(O/'cleanup-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print('VERIFIED',result['deletedCount'],result['bytes'])
