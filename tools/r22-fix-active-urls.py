"""Freeze then synchronize the remaining active embedded version queries."""
import hashlib,json,pathlib,shutil,zipfile
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r22';old=b'content-r21-20261024-1';new=b'content-r22-20261024-1';sha=lambda b:hashlib.sha256(b).hexdigest()
receipt=O/'full-commands/2026-10-24T09-05-16-219Z-full-npm-e2e/receipt.json';j=json.loads(receipt.read_text(encoding='utf-8'))
archive=receipt.parent/'tested-source-before-active-url-fix-attempt2.zip'
assert not archive.exists()
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for name,expected in j['sourceHashes'].items():
  b=(R/name).read_bytes()
  if name=='scripts/test-content-r22.js' and sha(b)!=expected:
   text=b.decode('utf-8');start=text.index('const currentVersion=');end=text.index("console.log('VERIFIED R22",start);b=(text[:start]+text[end:]).encode('utf-8')
  assert sha(b)==expected,(name,'full failed revision drift');z.writestr(name,b)
with zipfile.ZipFile(archive) as z:
 assert all(sha(z.read(name))==expected for name,expected in j['sourceHashes'].items())
supplement={}
for p in (R/'src').iterdir():
 if p.suffix not in ('.js','.css') or old not in p.read_bytes():continue
 name=p.relative_to(R).as_posix();target=O/'before'/name;assert not target.exists(),name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
 b=p.read_bytes();supplement[name]={'sha256':sha(b),'bytes':len(b),'snapshot':target.relative_to(R).as_posix(),'scope':'Only active embedded query/fallback version-string synchronization'}
 p.write_bytes(b.replace(old,new))
assert len(supplement)==13,len(supplement)
(O/'baseline-active-url-supplement.json').write_text(json.dumps({'authorization':'Root standing authorization for required activequery/version-chain literal updates; scope notified after actual offline failure','files':supplement,'failedFullSourceArchive':str(archive),'failedFullSourceArchiveSha256':sha(archive.read_bytes())},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'EXECUTED','updatedFiles':list(supplement),'failedSourceCount':len(j['sourceHashes'])},ensure_ascii=False))
