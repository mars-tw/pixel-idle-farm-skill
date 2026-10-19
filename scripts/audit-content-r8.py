"""Final local readback. No credentials, external calls, or publication."""
import hashlib,json,pathlib,re,subprocess,shutil
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'docs/content/r8';BASE=ROOT/'.audit-tmp/content-r8-baseline'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
report={'status':'EXECUTED','checks':[]}
def check(v,n):
 if not v:raise AssertionError(n)
 report['checks'].append(n)
try:
 for f in [*ROOT.glob('src/*.js'),*ROOT.glob('scripts/*.js'),ROOT/'sw.js']:
  p=subprocess.run(['node','-c',str(f)],cwd=ROOT,capture_output=True);check(p.returncode==0,'syntax '+f.relative_to(ROOT).as_posix())
 report['jsSyntaxFiles']=len(report['checks'])
 texts=[];hits=[];pattern=re.compile(r'sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}')
 for f in ROOT.rglob('*'):
  rel=f.relative_to(ROOT)
  if any(p in {'.git','node_modules','.audit-tmp','__pycache__'} for p in rel.parts) or not f.is_file() or not f.resolve().is_relative_to(ROOT):continue
  if f.suffix.lower() in {'.js','.json','.css','.html','.md','.txt','.log','.py','.yml','.yaml','.webmanifest','.xml','.toml'} or f.name.startswith('.env'):texts.append(f)
 for f in texts:
  if pattern.search(f.read_text(encoding='utf-8',errors='replace')):hits.append(f.relative_to(ROOT).as_posix())
 report['secretScan']={'files':len(texts),'hits':hits};check(not hits,'secret scan zero hits; project text only')
 m=json.loads((ROOT/'assets/generated/content-r8/manifest.json').read_text(encoding='utf-8'))
 for a in m['assets']+m['masters']:check(sha(ROOT/a['path'])==a['sha256'],'asset hash '+a['path'])
 for id in ['merchant','elder','child']:
  a=Image.open(ROOT/f'assets/generated/content-r7/sit-{id}.png').convert('RGBA');b=Image.open(ROOT/f'assets/generated/content-r8/gesture-{id}.png').convert('RGBA')
  check(a.crop((0,42,48,64)).tobytes()==b.crop((0,42,48,64)).tobytes(),id+' feet and lower body pixel-identical')
  check(a.crop((0,0,48,42)).tobytes()!=b.crop((0,0,48,42)).tobytes(),id+' actual upper-body pixels change')
 browser=json.loads((OUT/'browser-checks.json').read_text(encoding='utf-8'));check(browser['status']=='VERIFIED','R8 real-clock actual UI journeys verified')
 reg=json.loads((OUT/'regression-checks.json').read_text(encoding='utf-8'));check(reg['status']=='VERIFIED','all serial regression commands passed')
 for c in reg['commands']:check(sha(ROOT/c['log'])==c['sha256'],'regression log hash '+c['log'])
 correction=json.loads((OUT/'gathering-correction-checks.json').read_text(encoding='utf-8'));check(correction['status']=='VERIFIED' and len(correction['commands'])==4,'shared-layout correction passed npm and full R6/R7/R8 journeys')
 for c in correction['commands']:check(c['exitCode']==0 and sha(ROOT/c['log'])==c['sha256'],'correction log hash '+c['log'])
 relations=browser['sceneRelations'];base=relations['completion']
 for name in ['farm','reopened']:
  actual=relations[name];check(len(base)==len(actual)==6 and all(a['who']==b['who'] and abs(a['x']-b['x'])<.002 and abs(a['y']-b['y'])<.002 for a,b in zip(base,actual)),'six table relationships unchanged in '+name)
 report['correctiveCommands']=len(correction['commands']);report['sceneRelations']=relations
 release=json.loads((OUT/'release-unit-check.json').read_text(encoding='utf-8'));check(release['exitCode']==0 and sha(ROOT/release['log'])==release['sha256'],'final release npm test passed with exact log')
 perf=json.loads((OUT/'performance-reference.json').read_text(encoding='utf-8'));check(perf['status']=='VERIFIED','concurrent-load performance reference within 18ms');report['performance']=perf['summary']
 shots=[]
 for f in sorted(OUT.glob('*.png')):
  im=Image.open(f)
  if f.name.startswith('phone-'):check(im.size==(430,932),'native phone '+f.name)
  shots.append({'path':f.relative_to(ROOT).as_posix(),'width':im.width,'height':im.height,'sha256':sha(f)})
 report['screenshots']=shots;review=browser['reviewSet'];check(len(review)==15,'exactly fifteen review screenshots')
 check(all(sum(r['content']==kind for r in review)==5 for kind in ['basket','pond','memory']),'review allocation exactly 5/5/5')
 check(len(list((OUT/'review-set').glob('*.png')))==15,'review folder has only fifteen PNGs')
 report['reviewSet']=[]
 for i,r in enumerate(review,1):
  check(pathlib.Path(r['path']).name.startswith(f'{i:02}-'),'review ordering '+str(i));check(sha(ROOT/r['path'])==sha(ROOT/r['source']),'review is unmodified original '+str(i));check(Image.open(ROOT/r['path']).size==(430,932),'review phone pixels '+str(i));report['reviewSet'].append(r|{'sha256':sha(ROOT/r['path'])})
 for name,size in [('iphone-14-living-table-r8.png',(1290,2796)),('ipad-14-living-table-r8.png',(2064,2752))]:check(Image.open(ROOT/'docs/store/screenshots'/name).size==size,'store exact dimensions '+name)
 original=json.loads((BASE/'baseline.json').read_text(encoding='utf-8'))
 changed=[]
 for name,h in original.items():
  if name.startswith('docs/') and name!='docs/OPTIM_PLAN_CONTENT_R8.md':check((ROOT/name).exists() and sha(ROOT/name)==h,'historical doc unchanged '+name)
  if (ROOT/name).exists() and sha(ROOT/name)!=h:changed.append(name)
 report['changedBaselinePaths']=changed
 # No basket animation changes permitted this round.
 before=subprocess.run(['git','show','HEAD:src/content-r6.js'],cwd=ROOT,capture_output=True,check=True).stdout.decode('utf-8')
 current=(ROOT/'src/content-r6.js').read_text(encoding='utf-8')
 def carry(s):return s[s.index('  function carry('):s.index('  function response(')]
 check(carry(before)==carry(current),'basket carry function preserved byte-for-byte as requested')
 check(not any('content-r7-20261019-1' in f.read_text(encoding='utf-8') for f in [ROOT/'index.html',ROOT/'sw.js',ROOT/'manifest.webmanifest',*ROOT.glob('src/*.js'),*ROOT.glob('src/*.css')]),'zero stale previous runtime version strings')
 report['baselineCount']=len(original);report['browserChecks']=len(browser['checks']);report['regressionCommands']=len(reg['commands']);report['status']='VERIFIED'
except Exception as e:report['status']='BLOCKED';report['failure']=str(e);raise
finally:(OUT/'release-readback.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(report['status'],report.get('failure',''),len(report['checks']),'checks')
