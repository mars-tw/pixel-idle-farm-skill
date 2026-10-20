"""Explicit tracked-file allowlist; never remove a pre-existing untracked file."""
import pathlib,subprocess,json,hashlib,re,sys
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r15';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
if '--apply' not in sys.argv:
    tracked=subprocess.check_output(['git','ls-files','-z'],cwd=R).decode().split('\0');protected=json.loads((O/'protected-baseline.json').read_text(encoding='utf-8'))
    old=json.loads((R/'docs/content/r14/cleanup-plan.json').read_text(encoding='utf-8'));keep={x['path']:x['consumers'] for x in old['retainedDependencies']};keep.update({p:['tools/process-r68-visuals.py'] for p in old.get('retainedAfterFailedDependencyCheck',[])})
    scripts=[(p.relative_to(R).as_posix(),p.read_text(encoding='utf-8',errors='replace')) for d in ['scripts','tools'] for p in (R/d).rglob('*') if p.suffix in ['.js','.py'] and 'cleanup-content-r15' not in p.name]
    candidates=[];retained=[]
    for name in tracked:
        p=R/name
        if not name or p.suffix.lower() not in ['.png','.webp','.jpg','.jpeg','.gif','.mp4','.webm'] or not p.is_file():continue
        match=re.match(r'docs/content/r(\d+)/',name)
        if not ((match and int(match[1])<15) or name.startswith('docs/evidence/')):continue
        assert p.resolve().is_relative_to(R.resolve())
        consumers=keep.get(name,[])
        if name in protected:consumers+=['pre-existing uncommitted file: protected']
        # Exact input references and prior audited dynamic dependencies stay intact.
        consumers+= [n for n,t in scripts if name in t and not re.search(r'(capture|prepare|restore|archive|run-|cleanup)',pathlib.Path(n).name)]
        row={'path':name,'bytes':p.stat().st_size,'sha256':sha(p)}
        if consumers:row['consumers']=sorted(set(consumers));retained.append(row)
        else:candidates.append(row)
    (O/'cleanup-plan.json').write_text(json.dumps({'status':'PREPARED','repo':str(R),'deleteCount':len(candidates),'bytes':sum(x['bytes'] for x in candidates),'candidates':candidates,'retainedDependencies':retained,'policy':'Only tracked superseded media; preserve all original dirty/untracked files, stores, markdown and known verification inputs.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('PREPARED',len(candidates),sum(x['bytes'] for x in candidates),'bytes;',len(retained),'dependencies retained')
else:
    plan=json.loads((O/'cleanup-plan.json').read_text(encoding='utf-8'));deleted=[]
    for row in plan['candidates']:
        p=(R/row['path']).resolve();assert p.is_relative_to(R.resolve());assert row['path'].startswith(('docs/content/','docs/evidence/'))
        if p.exists():assert sha(p)==row['sha256'],row['path'];p.unlink();deleted.append(row)
    (O/'cleanup-result.json').write_text(json.dumps({'status':'VERIFIED','deletedCount':len(deleted),'bytes':sum(x['bytes'] for x in deleted),'files':deleted,'allAbsent':all(not (R/x['path']).exists() for x in plan['candidates'])},ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('VERIFIED deleted',len(deleted),sum(x['bytes'] for x in deleted),'bytes')
