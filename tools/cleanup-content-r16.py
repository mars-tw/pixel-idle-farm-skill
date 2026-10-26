"""Tracked superseded evidence only; validated absolute paths, hashes and protected inputs."""
from pathlib import Path
import subprocess,json,hashlib,re,sys
R=Path(__file__).resolve().parents[1];O=R/'docs/content/r16';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads((R/p).read_text(encoding='utf8'))
def write(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
assert R.resolve()==Path.cwd().resolve()
if '--apply' not in sys.argv:
 protected=read('.audit-tmp/content-r16-execution/protected.json')['protected'];prior=read('docs/content/r15/cleanup-plan.json')
 keep={x['path']:x['consumers'] for x in prior['retainedDependencies']}
 # Historical release verifiers read the original main journey and the review bytes.
 for file in ['browser-checks.json','review-set-manifest.json','journey-frame-archives.json','regression-output-housekeeping.json']:
  data=read('docs/content/r15/'+file)
  def walk(x):
   if isinstance(x,dict):
    for k,v in x.items():
     if k in ['path','source'] and isinstance(v,str) and v.startswith(('docs/content/','docs/evidence/')):keep.setdefault(v,[]).append('tools/verify-content-r15-release.py via '+file)
     else:walk(v)
   elif isinstance(x,list):
    for v in x:walk(v)
  walk(data)
 texts=[(p.relative_to(R).as_posix(),p.read_text(encoding='utf8',errors='replace')) for d in ['scripts','tools'] for p in (R/d).glob('*') if p.suffix in ['.js','.py'] and p.name!='cleanup-content-r16.py']
 candidates=[];retained=[]
 for n in subprocess.check_output(['git','ls-files','-z'],cwd=R).decode('utf8').split('\0'):
  p=(R/n).resolve();m=re.match(r'docs/content/r(\d+)/',n)
  if not n or not p.is_file() or p.suffix.lower() not in ['.png','.webp','.jpg','.jpeg','.gif','.mp4','.webm'] or not ((m and int(m[1])<16) or n.startswith('docs/evidence/')):continue
  assert p.is_relative_to(R.resolve());reasons=list(keep.get(n,[]))
  if n in protected:reasons.append('existing dirty/untracked file: preserve unchanged')
  reasons += [f for f,t in texts if n in t and not re.search(r'(capture|prepare|restore|archive|run-|cleanup|implement|finalize|report|write-|finish|close-)',Path(f).name)]
  row={'path':n,'bytes':p.stat().st_size,'sha256':sha(p)}
  if reasons:row['consumers']=sorted(set(reasons));retained.append(row)
  else:candidates.append(row)
 write(O/'cleanup-plan.json',{'status':'PREPARED','repo':str(R),'deleteCount':len(candidates),'bytes':sum(x['bytes'] for x in candidates),'candidates':candidates,'retainedDependencies':retained,'policy':'Only tracked replaced media. Keep original untracked/dirty, store, markdown, validation inputs and historical release readbacks.'})
 print('PREPARED',len(candidates),'files',sum(x['bytes'] for x in candidates),'bytes;',len(retained),'validation inputs retained')
else:
 plan=read('docs/content/r16/cleanup-plan.json');deleted=[];tracked=set(subprocess.check_output(['git','ls-files','-z'],cwd=R).decode('utf8').split('\0'))
 for row in plan['candidates']:
  p=(R/row['path']).resolve();assert p.is_relative_to(R.resolve()) and row['path'] in tracked and row['path'].startswith(('docs/content/','docs/evidence/'))
  assert p.is_file() and sha(p)==row['sha256'],row['path'];p.unlink();deleted.append(row)
 write(O/'cleanup-result.json',{'status':'VERIFIED','deletedCount':len(deleted),'bytes':sum(x['bytes'] for x in deleted),'files':deleted,'allAbsent':all(not (R/x['path']).exists() for x in deleted)})
 print('VERIFIED removed',len(deleted),'files',sum(x['bytes'] for x in deleted),'bytes')
