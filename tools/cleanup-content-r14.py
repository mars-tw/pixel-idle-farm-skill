"""Delete only tracked superseded media, after checking exact repo bounds and consumers."""
import hashlib,json,pathlib,re,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r14';MEDIA={'.png','.jpg','.jpeg','.webp','.webm','.mp4','.gif'}
baseline=json.loads((R/'.audit-tmp/content-r14-protection/inventory.json').read_text(encoding='utf-8'))
tracked=subprocess.check_output(['git','ls-files','-z'],cwd=R).decode('utf-8').split('\0')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def eligible(p):
 return re.match(r'docs/content/r(?:[1-9]|1[0-3])/',p) or p.startswith('docs/evidence/')
if sys.argv[1]=='plan':
 consumers={};referenced={}
 for p in ['docs/evidence/R62_polish/overall-after.png','docs/evidence/R62_polish/palette-r62.png']:
  referenced[p]=['tools/process-r68-visuals.py:REFERENCE_FILES (npm test)']
 # Retain media consumed by historical hash/visual validators. Their Markdown
 # reports remain valid historical records; archive copies are not their inputs.
 for root in [R/'scripts',R/'tools']:
  for f in root.rglob('*'):
   if f.suffix not in {'.js','.py'} or f.name=='cleanup-content-r14.py':continue
   t=f.read_text(encoding='utf-8',errors='replace')
   if not any(x in f.name for x in ['test','verify','audit']):continue
   for prefix in re.findall(r'docs/(?:content/r\d+|evidence/[A-Za-z0-9_-]+)',t):
    if any(x in t for x in ['Image.open','readFileSync','read_bytes','getImageData','createHash']):consumers.setdefault(prefix,set()).add(f.relative_to(R).as_posix())
 # Explicit media references in source or receipts protect exact files, including
 # nested paths. A historic report alone does not protect replaceable screenshots.
 for f in list((R/'scripts').glob('*.js'))+list((R/'tools').glob('*.py')):
  t=f.read_text(encoding='utf-8',errors='replace')
  for p in re.findall(r'docs/(?:content|evidence)/[A-Za-z0-9_./-]+\.(?:png|webp|webm|mp4|jpg)',t):referenced.setdefault(p,[]).append(f.relative_to(R).as_posix())
 rows=[];kept=[]
 for p in tracked:
  if not p or pathlib.Path(p).suffix.lower() not in MEDIA or not eligible(p) or not (R/p).is_file():continue
  target=(R/p).resolve();assert target.is_relative_to(R) and target.is_relative_to(R/'docs')
  reasons=[]
  if baseline.get(p,{}).get('protected'):reasons.append('pre-existing dirty work')
  if p in referenced:reasons.extend(referenced[p])
  archive=any(part in {'regression','regression-outputs','regression-backups'} for part in pathlib.Path(p).parts)
  if not archive:
   reasons.extend(c for prefix,cs in consumers.items() if p.startswith(prefix+'/') for c in cs)
  if reasons:kept.append({'path':p,'bytes':target.stat().st_size,'consumers':sorted(set(reasons))})
  else:rows.append({'path':p,'bytes':target.stat().st_size,'sha256':sha(target),'reason':'superseded evidence; no retained test/validation consumer'})
 result={'status':'PREPARED','repo':str(R),'candidates':rows,'retainedDependencies':kept,'deleteCount':len(rows),'bytes':sum(r['bytes'] for r in rows),'policy':'tracked media only; all original untracked files, Markdown reports, current R14 evidence and every store screenshot preserved'}
 (O/'cleanup-plan.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('PREPARED',len(rows),'media;',result['bytes'],'bytes;',len(kept),'retained dependencies')
elif sys.argv[1]=='apply':
 result=json.loads((O/'cleanup-plan.json').read_text(encoding='utf-8'));assert pathlib.Path(result['repo']).resolve()==R
 for row in result['candidates']:
  p=(R/row['path']).resolve();assert p.is_relative_to(R/'docs') and eligible(row['path']) and p.suffix.lower() in MEDIA and row['path'] in tracked
  assert not baseline.get(row['path'],{}).get('protected');assert sha(p)==row['sha256'];p.unlink()
 assert all(not (R/row['path']).exists() for row in result['candidates'])
 result['status']='EXECUTED';(O/'cleanup-result.json').write_text(json.dumps({k:v for k,v in result.items() if k!='retainedDependencies'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('EXECUTED deleted',result['deleteCount'],'files;',result['bytes'],'bytes freed')
