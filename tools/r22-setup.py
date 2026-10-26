"""Apply exact active version and obsolete expectation updates after freezing."""
import hashlib,json,pathlib,shutil
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r22'
supplement={}
for name in ['scripts/test-content-r17.js','scripts/test-content-r17-e2e.js']:
 p=R/name;target=O/'before'/name;target.parent.mkdir(parents=True,exist_ok=True)
 if target.exists():raise SystemExit('Supplement snapshot already exists')
 shutil.copyfile(p,target);supplement[name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'snapshot':target.relative_to(R).as_posix()}
(O/'baseline-supplement.json').write_text(json.dumps(supplement,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def replace(name,old,new,minimum=1):
 p=R/name;b=p.read_bytes();old=old.encode();new=new.encode();assert b.count(old)>=minimum,(name,old);p.write_bytes(b.replace(old,new))
for name in ['package.json','package-lock.json']:replace(name,'0.1.44','0.1.45')
for name in ['package.json','index.html','manifest.webmanifest','sw.js','src/ui.js']:replace(name,'content-r21-20261024-1','content-r22-20261024-1')
replace('index.html','<link rel="stylesheet" href="src/content-r21.css?v=content-r22-20261024-1">','<link rel="stylesheet" href="src/content-r21.css?v=content-r22-20261024-1">\n<link rel="stylesheet" href="src/content-r22.css?v=content-r22-20261024-1">')
replace('sw.js','  versioned("./src/content-r21.css"),','  versioned("./src/content-r21.css"),\n  versioned("./src/content-r22.css"),')
replace('package.json','    "test:content:r21":','    "test:content:r22": "node scripts/test-content-r22.js && node scripts/test-content-r22-e2e.js",\n    "test:content:r21":')
replace('scripts/guard-validation-writes.js','  "node scripts/test-content-r21.js",','  "node scripts/test-content-r21.js",\n  "node scripts/test-content-r22.js",')
replace('scripts/run-browser-gates.js','  "scripts/test-content-r21-e2e.js",','  "scripts/test-content-r22-e2e.js",')
replace('scripts/test-content-r17.js',"assert(R.received('圖圖','甜味胡蘿蔔點心').includes('先喝一口茶'));", "assert(R.received('圖圖','甜味胡蘿蔔點心').includes('接到手邊'));assert.doesNotMatch(R.received('圖圖','甜味胡蘿蔔點心'),/喝茶|喝一口茶|高高舉手/);")
replace('scripts/test-content-r17-e2e.js',"(await p.locator('.gather-shared').innerText()).includes('先喝一口茶')", "(await p.locator('.gather-shared').innerText()).includes('接到手邊')&&!/喝茶|喝一口茶|高高舉手/.test(await p.locator('.gather-shared').innerText())")
replace('scripts/test-content-r17-e2e.js',"id+' tea gesture, caption and persistent dessert agree'", "id+' received plate caption and persistent dessert agree'")
print('Applied active R22 version chain and two corrected received-text expectations')
