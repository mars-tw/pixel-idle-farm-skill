"""Archive only newly generated historical test outputs; initial untracked files are excluded."""
import pathlib,json,hashlib,subprocess,datetime,shutil
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r12';start=json.loads((O/'protected-start.json').read_text(encoding='utf-8'))
known=set(start['dirty'])|set(start['tracked']);D=R/'.audit-tmp/r12-new-test-outputs'/datetime.datetime.now().strftime('%Y%m%dT%H%M%S%f');rows=[]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
paths=subprocess.check_output(['git','ls-files','--others','--exclude-standard','-z'],cwd=R).decode('utf-8').split('\0')
for p in filter(None,paths):
 if p in known or p.endswith('-r12.png'):continue
 historical=p.startswith(('docs/evidence/','docs/playtest/','docs/store/screenshots/')) or p.startswith(tuple('docs/content/r'+str(i)+'/' for i in range(1,12))) or p.startswith('assets/generated/') and not p.startswith('assets/generated/content-r12/')
 if not historical:continue
 src=(R/p).resolve();dest=(D/p).resolve()
 if src.suffix.lower() not in {'.json','.png','.webp','.log'}:continue
 assert src.is_relative_to(R) and dest.is_relative_to(D) and src.is_file() and not src.is_symlink() and not dest.exists()
 h=sha(src);dest.parent.mkdir(parents=True,exist_ok=True);shutil.move(str(src),str(dest));assert sha(dest)==h
 rows.append(dict(path=p,sha256=h,archive=dest.relative_to(R).as_posix()))
(O/'generated-output-archive.json').write_text(json.dumps(dict(status='VERIFIED',initialFilesExcluded=len(known),files=rows),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED archived',len(rows),'new test outputs; no initial untracked file moved or deleted')
