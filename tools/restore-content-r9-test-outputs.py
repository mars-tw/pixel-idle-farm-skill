"""Restore only generated historical test outputs, preserving every initial user byte."""
import datetime,hashlib,json,pathlib,re,subprocess,shutil
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r9';B=R/'.audit-tmp/r9-protected';D=R/'.audit-tmp/r9-regression-outputs'/datetime.datetime.now().strftime('%Y%m%dT%H%M%S%f')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
protected=json.loads((O/'protected-start.json').read_text(encoding='utf-8'));rows=[]
def archive(p):
 src=(R/p).resolve();dest=(D/p).resolve()
 assert src.is_relative_to(R) and dest.is_relative_to(D) and src.is_file()
 dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dest);return sha(dest)
for p,h in protected.items():
 f=R/p
 if not f.exists() or sha(f)!=h:
  backup=B/p;assert sha(backup)==h
  assert p.startswith(('docs/store/screenshots/','docs/evidence/','docs/playtest/')) or re.match(r'docs/content/r[1-8]/',p),'Unexpected user file changed: '+p
  assert f.suffix.lower() in {'.json','.png','.webp','.log'},'Unexpected non-generated user file changed: '+p
  old=archive(p) if f.exists() else None;f.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(backup,f);rows.append(dict(path=p,generatedSha256=old,restoredSha256=h,source='initial protected backup'))
changed=subprocess.check_output(['git','diff','--name-only','-z'],cwd=R).decode('utf-8').split('\0')
for p in filter(None,changed):
 if p in protected:continue
 historical=(p.startswith('docs/') and not p.startswith(('docs/content/r9/','docs/art/masters/content-r9/')) and p not in {'docs/CODEX_RESPONSE_CONTENT_R9.md','docs/OPTIM_PLAN_CONTENT_R9.md','docs/art/PROMPTS_CONTENT_R9.json'}) or (p.startswith('assets/') and not p.startswith('assets/generated/content-r9/'))
 if not historical:continue
 old=archive(p) if (R/p).exists() else None;original=subprocess.check_output(['git','show','HEAD:'+p],cwd=R);(R/p).parent.mkdir(parents=True,exist_ok=True);(R/p).write_bytes(original);rows.append(dict(path=p,generatedSha256=old,restoredSha256=sha(R/p),source='unchanged HEAD before this round'))
untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard','-z'],cwd=R).decode('utf-8').split('\0')
for p in filter(None,untracked):
 if p in protected or p in {'docs/store/screenshots/iphone-15-shared-afternoon-r9.png','docs/store/screenshots/ipad-15-shared-afternoon-r9.png'}:continue
 if not (re.match(r'docs/content/r[1-8]/',p) or p.startswith(('docs/evidence/','docs/store/screenshots/'))):continue
 src=(R/p).resolve();dest=(D/'new-outputs'/p).resolve()
 if src.suffix.lower() not in {'.png','.webp','.json','.log'}:continue
 assert src.is_relative_to(R) and dest.is_relative_to(D) and src.is_file() and not dest.exists()
 h=sha(src);dest.parent.mkdir(parents=True,exist_ok=True);shutil.move(str(src),str(dest));assert sha(dest)==h
 rows.append(dict(path=p,generatedSha256=h,archivePath=dest.relative_to(R).as_posix(),source='new output of historical regression, moved aside; not an initial user file'))
assert all(sha(R/p)==h for p,h in protected.items())
(O/'generated-output-archive.json').write_text(json.dumps(dict(status='VERIFIED',archiveRoot=D.relative_to(R).as_posix(),restored=rows,protectedCount=len(protected)),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED',len(rows),'historical/protected test outputs archived and restored;',len(protected),'initial files preserved')
