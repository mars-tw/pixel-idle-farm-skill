"""Hash-bound literal-only cache query repair; preserves all other source bytes."""
import pathlib,json,hashlib,shutil
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r13';old=b'content-r12-20261019-1';new=b'content-r13-20261019-1'
sha=lambda b:hashlib.sha256(b).hexdigest()
rows=[]
for name,expected in [('src/world-ui.js',2),('src/daily-ui.js',1)]:
    p=R/name;before=p.read_bytes();assert before.count(old)==expected,name
    after=before.replace(old,new);saved=O/'source-snapshots/cache-query-before'/name;saved.parent.mkdir(parents=True,exist_ok=True);saved.write_bytes(before)
    p.write_bytes(after);assert p.read_bytes()==before.replace(old,new)
    rows.append({'path':name,'beforeSha256':sha(before),'afterSha256':sha(after),'replacements':expected,'beforeSnapshot':saved.relative_to(R).as_posix()})
log=O/'release-readback.log'
if log.exists():shutil.copyfile(log,O/'release-readback-before-cache-fix.log')
(O/'version-query-delta.json').write_text(json.dumps({'status':'VERIFIED','kind':'literal cache version query only','from':old.decode(),'to':new.decode(),'files':rows,'affectedTests':['npm test','node scripts/test-r80-mobile.js','node scripts/test-r81-review.js','node scripts/test-content-r13-cache-offline.js']},indent=2)+'\n',encoding='utf-8')
print('VERIFIED exact three cache query replacements in two files, all other bytes unchanged')
