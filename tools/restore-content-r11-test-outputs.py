"""Archive only generated regression outputs; restore starting user bytes and historical evidence."""
import datetime,hashlib,json,pathlib,subprocess,shutil
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r11';B=R/'.audit-tmp/r11-protected';D=R/'.audit-tmp/r11-regression-outputs'/datetime.datetime.now().strftime('%Y%m%dT%H%M%S%f')
protected=json.loads((O/'protected-start.json').read_text(encoding='utf-8'));rows=[]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def archive(p):
 src=(R/p).resolve();dest=(D/p).resolve();assert src.is_relative_to(R) and dest.is_relative_to(D);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dest);return sha(dest)
for p,h in protected.items():
 f=R/p
 if not f.exists() or sha(f)!=h:
  assert sha(B/p)==h
  if f.exists():archive(p)
  f.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(B/p,f);rows.append(dict(path=p,source='initial bytes'))
changed=subprocess.check_output(['git','diff','--name-only','-z'],cwd=R).decode('utf-8').split('\0')
for p in filter(None,changed):
 if p in protected:continue
 historical=p.startswith(tuple('docs/content/r'+str(i)+'/' for i in range(1,11))) or p.startswith(('docs/evidence/','docs/playtest/')) or p.startswith('docs/store/screenshots/') and not p.endswith('-r11.png') or p.startswith('assets/generated/') and not p.startswith('assets/generated/content-r11/')
 if not historical:continue
 archive(p);(R/p).write_bytes(subprocess.check_output(['git','show','HEAD:'+p],cwd=R));rows.append(dict(path=p,source='historical HEAD'))
untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard','-z'],cwd=R).decode('utf-8').split('\0')
for p in filter(None,untracked):
 if p in protected or p.endswith('-r11.png'):continue
 historical=p.startswith(tuple('docs/content/r'+str(i)+'/' for i in range(1,11))) or p.startswith(('docs/evidence/','docs/store/screenshots/'))
 if not historical:continue
 src=(R/p).resolve();dest=(D/'new-outputs'/p).resolve()
 if src.suffix.lower() not in {'.json','.png','.webp','.log'}:continue
 assert src.is_relative_to(R) and dest.is_relative_to(D) and src.is_file() and not dest.exists()
 h=sha(src);dest.parent.mkdir(parents=True,exist_ok=True);shutil.move(str(src),str(dest));assert sha(dest)==h
 rows.append(dict(path=p,source='new generated output; not an initial user file',archivePath=dest.relative_to(R).as_posix(),sha256=h))
assert all((R/p).is_file() and sha(R/p)==h for p,h in protected.items())
(O/'generated-output-archive.json').write_text(json.dumps(dict(status='VERIFIED',protectedCount=len(protected),archiveRoot=D.relative_to(R).as_posix(),restored=rows),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED protected',len(protected),'restored',len(rows))
