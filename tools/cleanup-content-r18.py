"""Delete only tracked superseded R16/R17 media, with a hash-bound plan."""
from pathlib import Path
import hashlib,json,re,subprocess,sys
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r18'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert Path.cwd().resolve()==R.resolve()
protected=json.loads((R/'.audit-tmp/r18/initial.json').read_text(encoding='utf-8'))
tracked=set(filter(None,subprocess.check_output(['git','ls-files','-z'],cwd=R).decode('utf-8').split('\0')))
planfile=O/'cleanup-plan.json'
if '--apply' not in sys.argv:
    candidates=[]
    for rel in sorted(tracked):
        if not re.match(r'docs/content/r(?:16|17)/',rel):continue
        p=R/rel
        if not p.is_file() or p.suffix.lower() not in ['.png','.webp','.jpg','.jpeg','.gif','.mp4','.webm']:continue
        assert rel not in protected['protected'] and rel not in protected['store']
        candidates.append({'path':rel,'bytes':p.stat().st_size,'sha256':sha(p),'replacement':'docs/content/r18/','consumerReview':'R16/R17 browser scripts write these captures before reading them; they are outputs, not seed inputs. All JSON saves and reports retained. Historical R17 finalizer now verifies current R18 evidence.'})
    older=json.loads((R/'docs/content/r17/cleanup-plan.json').read_text(encoding='utf-8'))['retainedDependencies']
    retained=[x for x in older if not re.match(r'docs/content/r(?:16|17)/',x['path']) and (R/x['path']).is_file()]
    plan={'status':'PREPARED','scope':'Tracked superseded R16/R17 captures only; older source/provenance media remain explicit verification inputs. Never remove untracked files, Markdown, JSON or store screenshots.','files':candidates,'count':len(candidates),'bytes':sum(x['bytes'] for x in candidates),'retainedDependencies':retained}
    planfile.write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('PREPARED',plan['count'],plan['bytes']);sys.exit(0)
plan=json.loads(planfile.read_text(encoding='utf-8'))
for row in plan['files']:
    rel=row['path'];p=(R/rel).resolve()
    assert p.is_relative_to(R.resolve()) and re.match(r'docs/content/r(?:16|17)/',rel) and rel in tracked
    assert rel not in protected['protected'] and rel not in protected['store'] and p.is_file() and sha(p)==row['sha256']
for row in plan['files']:(R/row['path']).unlink()
result={'status':'VERIFIED','deletedCount':plan['count'],'bytes':plan['bytes'],'allAbsent':all(not (R/x['path']).exists() for x in plan['files']),'files':plan['files'],'retainedDependencyCount':len(plan['retainedDependencies'])}
(O/'cleanup-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert result['allAbsent'];print('VERIFIED',result['deletedCount'],'files removed;',result['bytes'],'bytes released from working tree')
