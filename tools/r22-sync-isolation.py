"""Sync reviewed R22 changes between sequential owned-copy validation runs."""
import datetime,hashlib,json,pathlib,shutil
R=pathlib.Path(__file__).resolve().parents[1];M=R/'docs/content/r22/isolation/20261024T085928182483Z.json';m=json.loads(M.read_text(encoding='utf-8'));D=pathlib.Path(m['ownedRoot'])
assert D.parent==R.parent and D.name.startswith('.r22-farm-') and D.is_dir()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
allowed={'scripts/test-content-r20-e2e.js','scripts/test-content-r22.js','src/content-r22.css'}
allowed.update(json.loads((R/'docs/content/r22/baseline.json').read_text(encoding='utf-8'))['allowedBefore'])
allowed.update(json.loads((R/'docs/content/r22/baseline-supplement.json').read_text(encoding='utf-8')))
supplement=R/'docs/content/r22/baseline-active-url-supplement.json'
if supplement.exists():allowed.update(json.loads(supplement.read_text(encoding='utf-8'))['files'])
names=set(m['sourceHashes'])
for folder in ['scripts','tools']:
 for p in (R/folder).glob('*r22*'):
  if p.is_file() and p.suffix in ('.js','.py'):names.add(p.relative_to(R).as_posix())
allowed.update(name for name in names if name.startswith(('tools/r22-','scripts/r22-','scripts/test-content-r22')))
changed=[name for name in sorted(names) if not (D/name).is_file() or sha(R/name)!=sha(D/name)]
assert set(changed)<=allowed,changed
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');O=R/'docs/content/r22/isolation/sync'/stamp;O.mkdir(parents=True)
rows={}
for name in changed:
 target=O/'before'/name;target.parent.mkdir(parents=True,exist_ok=True)
 prior=sha(D/name) if (D/name).is_file() else None
 if prior:shutil.copyfile(D/name,target)
 rows[name]={'before':prior,'after':sha(R/name)};(D/name).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(R/name,D/name);assert sha(D/name)==rows[name]['after']
(O/'sync.json').write_text(json.dumps({'status':'VERIFIED','ownedRoot':str(D),'reason':'Reviewed test corrections and authorized active embedded-URL version synchronization before the required current-source regression','files':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'VERIFIED','synchronized':changed,'receipt':str(O.relative_to(R))},ensure_ascii=False))
