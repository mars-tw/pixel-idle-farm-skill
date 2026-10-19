"""Bounded asset/version integration. Historical art/receipts are immutable."""
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
if json.loads((R/'package.json').read_text(encoding='utf8')).get('appVersion')=='r87-20261018-1':
 print('VERIFIED R87 integration already present; no duplicate cache entries written')
 raise SystemExit(0)
for p in [R/'index.html',R/'manifest.webmanifest',R/'sw.js',*list((R/'src').glob('*.js')),*list((R/'src').glob('*.css'))]:
 s=p.read_text(encoding='utf8').replace('r86-20261018-1','r87-20261018-1')
 if p.name=='index.html':
  s=s.replace('<link rel="stylesheet" href="src/art-r86.css?v=r87-20261018-1">','<link rel="stylesheet" href="src/art-r86.css?v=r87-20261018-1">\n<link rel="stylesheet" href="src/art-r87.css?v=r87-20261018-1">')
  s=s.replace('r86/app-icon-','r87/app-icon-').replace('r86/logo-','r87/logo-')
 if p.name=='manifest.webmanifest':s=s.replace('r86/app-icon-','r87/app-icon-')
 if p.name in ['world-ui.js','daily-ui.js']:s=s.replace('r86/miri-','r87/miri-').replace("tab==='today'?'r86':'r84'","tab==='today'?'r87':'r84'")
 if p.name=='daily-ui.js':
  s=s.replace("el('dailyToday').textContent=tab==='today'?st.date+' 農務':'今日印章冊';","el('dailyToday').textContent='今日農務';")
  s=s.replace('assets/generated/r85/${task.id', 'assets/generated/r87/${task.id').replace('assets/generated/r85/basket-32.png','assets/generated/r87/basket-32.png')
 if p.name=='heirloom-ui.js':s=s.replace('assets/generated/r85/wheat-32.png','assets/generated/r87/wheat-32.png')
 if p.name=='sw.js':
  files=[p.relative_to(R).as_posix() for p in (R/'assets/generated/r87').glob('*') if p.name!='manifest.json']+['src/art-r87.css']
  s=s.replace('const CORE_ASSETS = [','const CORE_ASSETS = [\n'+''.join('  versioned("./'+f+'"),\n' for f in files))
 p.write_text(s,encoding='utf8',newline='\n')
p=R/'package.json';d=json.loads(p.read_text(encoding='utf8'));d['version']='0.1.21';d['appVersion']='r87-20261018-1';p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
for name in ['package-lock.json']:
 p=R/name
 if p.exists():
  d=json.loads(p.read_text(encoding='utf8'));d['version']='0.1.21'
  if '' in d.get('packages',{}):d['packages']['']['version']='0.1.21'
  p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
p=R/'docs/art/PROMPTS.json';d=json.loads(p.read_text(encoding='utf8'));d['currentRound']='R87';d['currentPrompts']='docs/art/PROMPTS_R87.json';p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('EXECUTED R87 asset and 0.1.21 version integration')
