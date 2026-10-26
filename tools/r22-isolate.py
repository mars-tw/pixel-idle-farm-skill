"""Create a fresh owned full-regression copy. No cleanup, restore, or deletion."""
import datetime,hashlib,json,pathlib,shutil,subprocess
R=pathlib.Path(__file__).resolve().parents[1];stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
D=R.parent/('.r22-farm-'+stamp)
assert D.parent==R.parent and D.name.startswith('.r22-farm-') and not D.exists()
def ignored(directory,names):
 p=pathlib.Path(directory)
 excluded={'.git','node_modules','.audit-tmp','tmp','artifacts'}
 if p==R/'docs/content':excluded.add('r22')
 return [n for n in names if n in excluded or (p==R and n.startswith('.audit-'))]
shutil.copytree(R,D,ignore=ignored)
def quote(s):return "'"+str(s).replace("'","''")+"'"
subprocess.run(['powershell','-NoProfile','-Command','New-Item -ItemType Junction -Path '+quote(D/'node_modules')+' -Value '+quote(R/'node_modules')+' | Out-Null'],check=True,capture_output=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
names=['package.json','package-lock.json','index.html','manifest.webmanifest','sw.js']
for folder in ['src','scripts','tools']:
 names.extend(p.relative_to(R).as_posix() for p in (R/folder).iterdir() if p.is_file() and p.suffix in ('.js','.css','.py'))
hashes={name:sha(R/name) for name in names}
assert all(sha(D/name)==expected for name,expected in hashes.items())
receipt={'status':'VERIFIED','originalRoot':str(R),'ownedRoot':str(D),'createdAt':stamp,'sourceHashes':hashes,'nodeModulesJunction':str(R/'node_modules'),'policy':'All historical writers run only in this fresh owned copy. Existing project .git/node_modules/audit/tmp/artifacts and R22 evidence were excluded from copying; runtime assets, historical fixtures/evidence, source and test files were copied. No directory removed.'}
O=R/'docs/content/r22/isolation';O.mkdir(parents=True,exist_ok=True);(O/(stamp+'.json')).write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'VERIFIED','ownedRoot':str(D),'sourceFiles':len(hashes)},ensure_ascii=False))
