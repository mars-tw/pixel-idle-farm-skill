from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
if json.loads((R/'package.json').read_text(encoding='utf8')).get('appVersion')=='r89-20261018-1' and 'href="src/art-r89.css' in (R/'index.html').read_text(encoding='utf8'):
 print('VERIFIED R89 already integrated; no files rewritten');raise SystemExit(0)
for p in [R/'index.html',R/'sw.js',R/'manifest.webmanifest',*(R/'src').glob('*.js'),*(R/'src').glob('*.css')]:
 t=p.read_text(encoding='utf8');t=t.replace('r88-20261018-1','r89-20261018-1')
 if p.name=='index.html':
  if 'href="src/art-r89.css' not in t:t=t.replace('<link rel="stylesheet" href="src/art-r88.css?v=r89-20261018-1">','<link rel="stylesheet" href="src/art-r88.css?v=r89-20261018-1">\n<link rel="stylesheet" href="src/art-r89.css?v=r89-20261018-1">')
  t=t.replace('r88/app-icon-','r89/app-icon-').replace('r88/logo-','r89/logo-')
 if p.name=='manifest.webmanifest':t=t.replace('r88/app-icon-','r89/app-icon-')
 if p.name=='daily-ui.js':t=t.replace('assets/generated/r88/${task.id','assets/generated/r89/${task.id')
 if p.name=='ui.js':
  for n in ['sprout','water','wheat','basket','note']:t=t.replace('r88/'+n+'-32.png','r89/'+n+'-32.png')
 if p.name=='sw.js':
  paths=[p.relative_to(R).as_posix() for p in (R/'assets/generated/r89').glob('*') if p.suffix in ['.png','.webp','.json'] and p.name!='manifest.json']+['src/art-r89.css']
  t=t.replace('const PRECACHE_URLS = [','const PRECACHE_URLS = [')
  anchor='  versioned("./assets/generated/r88/basket-512.webp"),'
  assert anchor in t
  if 'versioned("./assets/generated/r89/' not in t:t=t.replace(anchor,'\n'.join('  versioned("./'+v+'"),' for v in paths)+'\n'+anchor)
 p.write_text(t,encoding='utf8',newline='\n')
p=R/'package.json';d=json.loads(p.read_text(encoding='utf8'));d['version']='0.1.23';d['appVersion']='r89-20261018-1';p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
p=R/'package-lock.json';d=json.loads(p.read_text(encoding='utf8'));d['version']='0.1.23';d['packages']['']['version']='0.1.23';p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
# Exact current-art expectations migrate to replacement filenames; historical hash receipts stay unchanged.
for p in (R/'scripts').glob('test-*.js'):
 t=p.read_text(encoding='utf8')
 for name in ['walk','farming-actions','leaf-light']:
  t=t.replace("includes('r88/"+name,"includes('r89/"+name)
 t=t.replace('includes("r88/"+file)','includes("r89/"+file)')
 t=t.replace("includes('r88/'+choice+", "includes((choice==='table'?'r89/':'r88/')+choice+")
 if p.name=='test-r83-art.js':t=t.replace("p.includes(sheet==='terrain'?'r88/grass-32.png':'r83/')","p.includes(sheet==='terrain'?'r88/grass-32.png':sheet==='crops'?'r89/':'r83/')")
 if p.name=='test-r81-review.js':
  old='await page.locator("#heirloomTable").tap();';first=t.index(old);second=t.index(old,first+len(old));t=t[:second]+t[second:].replace(old,'await page.locator("#heirloomConfirm").tap();',1)
 p.write_text(t,encoding='utf8',newline='\n')
print('integrated R89 assets, exact current-art checks and version0.1.23')
