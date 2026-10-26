"""Remove only hash-approved tracked superseded captures; never untracked media."""
from pathlib import Path
import hashlib,json,re,subprocess,sys
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r19';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert Path.cwd().resolve()==R.resolve()
initial=json.loads((R/'.audit-tmp/r19/initial.json').read_text(encoding='utf-8'))
tracked=set(filter(None,subprocess.check_output(['git','ls-files','-z']).decode('utf-8').split('\0')))
planfile=O/'cleanup-plan.json'
if '--apply' not in sys.argv:
    retained=json.loads((R/'docs/content/r18/cleanup-plan.json').read_text(encoding='utf-8'))['retainedDependencies']
    keep={x['path']:x['consumers'] for x in retained}
    files=[]
    for rel in sorted(tracked):
        p=R/rel
        if not p.is_file() or p.suffix.lower() not in ['.png','.jpg','.jpeg','.webp','.gif','.mp4','.webm']:continue
        if not (re.match(r'docs/content/r(?:[1-9]|1[0-8])/',rel) or rel.startswith('docs/evidence/')):continue
        if rel in initial['protected'] or rel in keep:continue
        files.append({'path':rel,'sha256':sha(p),'bytes':p.stat().st_size,'replacement':'docs/content/r19/','reason':'Superseded capture output. Historical scripts recreate their own output in an isolated copy; active source/provenance inputs retained.'})
    plan={'status':'PREPARED','files':files,'count':len(files),'bytes':sum(x['bytes'] for x in files),'retainedDependencies':[x for x in retained if (R/x['path']).is_file()],'scope':'Only tracked obsolete captures; historical verifier inputs, source art, all Markdown, JSON, untracked files and stores retained.'}
    planfile.write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('PREPARED',plan['count'],plan['bytes']);sys.exit()
plan=json.loads(planfile.read_text(encoding='utf-8'))
for x in plan['files']:
    p=(R/x['path']).resolve();assert p.is_relative_to((R/'docs').resolve()) and x['path'] in tracked and x['path'] not in initial['protected'] and p.is_file() and sha(p)==x['sha256']
for x in plan['files']:(R/x['path']).unlink()
result={'status':'VERIFIED','deletedCount':len(plan['files']),'bytes':plan['bytes'],'files':plan['files'],'retainedDependencyCount':len(plan['retainedDependencies'])}
assert all(not (R/x['path']).exists() for x in plan['files'])
(O/'cleanup-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('VERIFIED',len(plan['files']),plan['bytes'])
