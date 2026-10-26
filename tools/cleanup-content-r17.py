"""Remove only tracked, superseded media after a hash-bound reviewable plan."""
from pathlib import Path
import hashlib,json,re,subprocess,sys
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r17'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads((R/p).read_text(encoding='utf8'))
def save(p,j):p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
assert Path.cwd().resolve()==R.resolve()
tracked=set(filter(None,subprocess.check_output(['git','ls-files','-z']).decode('utf8').split('\0')))
protected=load('.audit-tmp/content-r17/protected.json')['protected']
if '--apply' not in sys.argv:
 keep={x['path']:[c for c in x['consumers'] if not re.search(r'(?:^|/)(?:restore-|prepare-|capture-|run-)',c)] for x in load('docs/content/r16/cleanup-plan.json')['retainedDependencies']}
 # A historical output-restoration utility is a producer, not a test consumer.
 # Still retain any file named in an initial-workspace protection receipt.
 for receipt in (R/'docs/content').glob('r*/protected*.json'):
  def protected_paths(v):
   if isinstance(v,dict):
    for k,x in v.items():
     if k in tracked:keep.setdefault(k,[]).append('historical initial-file verifier via '+receipt.relative_to(R).as_posix())
     if k=='path' and isinstance(x,str) and x in tracked:keep.setdefault(x,[]).append('historical initial-file verifier via '+receipt.relative_to(R).as_posix())
     protected_paths(x)
   elif isinstance(v,list):
    for x in v:protected_paths(x)
  protected_paths(json.loads(receipt.read_text(encoding='utf8')))
 # The historical release verifier validates the original bytes indexed by these receipts.
 for filename in ['current-frame-index.json','review-set-manifest.json','journey.json','journey-gathering.json','journey-inventory.json','journey-offline.json','store-preservation.json']:
  path=R/'docs/content/r16'/filename
  if not path.is_file():continue
  def walk(v):
   if isinstance(v,dict):
    for k,x in v.items():
     if k in ['path','source'] and isinstance(x,str) and (R/x).is_file():keep.setdefault(x,[]).append('tools/verify-content-r16.py via '+filename)
     else:walk(x)
   elif isinstance(v,list):
    for x in v:walk(x)
  walk(json.loads(path.read_text(encoding='utf8')))
 texts=[(p.relative_to(R).as_posix(),p.read_text(encoding='utf8',errors='replace')) for base in ['scripts','tools'] for p in (R/base).glob('*') if p.suffix in ['.js','.py'] and p.name!='cleanup-content-r17.py']
 candidates=[];retained=[]
 for n in sorted(tracked):
  p=R/n;m=re.match(r'docs/content/r(\d+)/',n)
  if not p.is_file() or p.suffix.lower() not in ['.png','.webp','.jpg','.jpeg','.gif','.mp4','.webm'] or not ((m and int(m[1])<17) or n.startswith('docs/evidence/')):continue
  reasons=list(keep.get(n,[]))
  if n in protected:reasons.append('existing user dirty/untracked file')
  reasons += [f for f,t in texts if n in t and (Path(f).name.startswith(('test-','verify-','check-','audit-')))]
  row={'path':n,'bytes':p.stat().st_size,'sha256':sha(p)}
  if reasons:row['consumers']=sorted(set(reasons));retained.append(row)
  else:candidates.append(row)
 save(O/'cleanup-plan.json',{'status':'PREPARED','repo':str(R),'deleteCount':len(candidates),'bytes':sum(x['bytes'] for x in candidates),'candidates':candidates,'retainedDependencies':retained,'policy':'Only tracked superseded media; preserve all Markdown, store, original user changes and media consumed by tests or release verification.'})
 print('PREPARED',len(candidates),'files',sum(x['bytes'] for x in candidates),'bytes;',len(retained),'validation inputs retained')
else:
 plan=load('docs/content/r17/cleanup-plan.json');deleted=[]
 for row in plan['candidates']:
  p=(R/row['path']).resolve();assert p.is_relative_to(R.resolve()) and row['path'] in tracked and row['path'] not in protected
  assert row['path'].startswith(('docs/content/','docs/evidence/')) and p.is_file() and sha(p)==row['sha256'],row['path']
  p.unlink();deleted.append(row)
 assert all(not(R/x['path']).exists() for x in deleted)
 save(O/'cleanup-result.json',{'status':'VERIFIED','deletedCount':len(deleted),'bytes':sum(x['bytes'] for x in deleted),'allAbsent':True,'files':deleted})
 print('VERIFIED deleted',len(deleted),'files;',sum(x['bytes'] for x in deleted),'bytes')
