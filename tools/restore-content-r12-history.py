"""Restore exact starting bytes, including worktree CRLF; prove every write against its hash."""
import pathlib,json,hashlib,subprocess,shutil,datetime
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r12';B=R/'.audit-tmp/r12-protected';data=json.loads((O/'protected-start.json').read_text(encoding='utf-8'))
D=R/'.audit-tmp/r12-regression-outputs'/datetime.datetime.now().strftime('%Y%m%dT%H%M%S%f');rows=[]
sha=lambda b:hashlib.sha256(b).hexdigest()
def historical(p):return p.startswith(('docs/evidence/','docs/playtest/','docs/store/screenshots/','assets/generated/')) or p.startswith(tuple('docs/content/r'+str(i)+'/' for i in range(1,12)))
for p,h in {**data['tracked'],**data['dirty']}.items():
 if not historical(p) and p not in data['dirty']:continue
 f=(R/p).resolve();assert f.is_relative_to(R)
 if f.is_file() and sha(f.read_bytes())==h:continue
 if p in data['dirty']:
  assert historical(p),'An initial non-generated user file changed; preserve it for review: '+p
  restored=(B/p).read_bytes();variant='initial dirty backup'
 else:
  raw=subprocess.check_output(['git','show','HEAD:'+p],cwd=R);lf=raw.replace(b'\r\n',b'\n')
  variants=[('HEAD',raw),('CRLF',lf.replace(b'\n',b'\r\n')),('LF',lf),('UTF8-BOM',b'\xef\xbb\xbf'+lf),('CRLF-BOM',b'\xef\xbb\xbf'+lf.replace(b'\n',b'\r\n'))]
  matches=[(n,v) for n,v in variants if sha(v)==h];assert matches,'No exact baseline bytes recoverable: '+p;variant,restored=matches[0]
 assert sha(restored)==h
 archive=None;previous=None
 if f.is_file():
  dest=(D/p).resolve();assert dest.is_relative_to(D);dest.parent.mkdir(parents=True,exist_ok=True);previous=sha(f.read_bytes());shutil.copyfile(f,dest);assert sha(dest.read_bytes())==previous;archive=dest.relative_to(R).as_posix()
 f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(restored);assert sha(f.read_bytes())==h
 rows.append(dict(path=p,baselineSha256=h,variant=variant,archive=archive,archivedSha256=previous))
assert all((R/p).is_file() and sha((R/p).read_bytes())==h for p,h in data['dirty'].items())
for p,h in data['tracked'].items():
 if historical(p):assert (R/p).is_file() and sha((R/p).read_bytes())==h,p
result=dict(status='VERIFIED',protectedOriginalUserFiles=len(data['dirty'])-2,alsoProtectedOwnPreparationFiles=2,restored=rows,previousPartialArchives=[p.relative_to(R).as_posix() for p in (R/'.audit-tmp/r12-regression-outputs').iterdir() if p.is_dir() and p!=D])
(O/'protected-readback.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED exact baseline restored:',len(rows),'files; all original user bytes preserved, including CRLF')
