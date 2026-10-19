"""Final asset/pixel/source/store readback. Human recognition is not automated."""
from pathlib import Path
from PIL import Image,ImageChops
import json,hashlib,subprocess,re
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/evidence/r85-art';BASELINE='6145ae3'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 m=json.loads((ROOT/'assets/generated/r85/manifest.json').read_text(encoding='utf-8'));palette={tuple(bytes.fromhex(c[1:])) for c in m['palette']};rows=[]
 assert len(m['masters'])==9 and len(m['records'])==26
 for r in m['masters']+m['records']:assert sha(ROOT/r['path'])==r['sha256'],r['path']
 for r in m['records']:
  im=Image.open(ROOT/r['path']).convert('RGBA');assert list(im.size)==r['size'];px=list(im.getdata());assert all(p[3] in (0,255) for p in px),r['path'];assert all(tuple(p[:3]) in palette for p in px if p[3]),r['path'];assert all(p[:3]==(0,0,0) for p in px if not p[3]),r['path'];rows.append(dict(path=r['path'],sha256=r['sha256'],binaryAlpha=True,palette=True,clearTransparentRGB=True))
 for n in ['walk.png','actions.png','farming-actions.png','miri-0.png','miri-1.png','miri-2.png']:assert m['qualityMetrics']['assets/generated/r85/'+n]['gatePass'],n
 a=Image.open(OUT/'light-on.png').convert('RGB');b=Image.open(OUT/'light-off.png').convert('RGB');assert a.size==b.size
 da=list(a.getdata());db=list(b.getdata());delta=[(.2126*(p[0]-q[0])+.7152*(p[1]-q[1])+.0722*(p[2]-q[2])) for p,q in zip(da,db)];changed=sum(v>5 for v in delta)/len(delta);mean=sum(delta)/len(delta);assert changed>.22 and mean>5,dict(changed=changed,mean=mean)
 pixel=dict(scope='Same live scene, broad light bounds; on/off actual rendered screenshots, character remains opaque.',changedLuminanceFraction=changed,meanLuminanceIncrease255=mean,humanRecognitionPassed=False)
 shots=[]
 journey=json.loads((OUT/'store-journey.json').read_text(encoding='utf-8'));assert journey['status']=='VERIFIED' and not journey['progressInjected']
 for platform,size in [('iphone',(1290,2796)),('ipad',(2064,2752))]:
  for suffix in ['01-welcome','02-sunlight','03-basket','04-note','05-daily']:
   p=ROOT/f'docs/store/screenshots/{platform}-{suffix}.png';assert Image.open(p).size==size;expected=next(r['sha256'] for r in journey['screenshots'] if r['path'].endswith('/'+p.name));assert sha(p)==expected,p;shots.append(dict(file=p.name,width=size[0],height=size[1],sha256=sha(p),status='VERIFIED',capture='R85 actual headless Chromium UI, real clock and inputs; no progress/clock/sun injection. 02 captures watering; 05 earned wheat seals.'))
 (ROOT/'docs/store/screenshots-manifest.json').write_text(json.dumps(dict(release='r85-20261017-1',status='VERIFIED',injectedProgress=False,screenshots=shots,journeyEvidence='docs/evidence/r85-art/store-journey.json'),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 board=Image.new('RGB',(780,3376),'#fff6e3')
 for y,name in enumerate(['welcome','farm','daily','basket']):
  for x,phase in enumerate(['before','after']):board.paste(Image.open(ROOT/f'docs/art/compare/r85/{phase}/390x844-{name}.png'),(390*x,844*y))
 board.save(ROOT/'docs/art/compare/r85/overview.webp',lossless=True,method=6)
 for phase in ['before','after']:Image.open(ROOT/f'docs/art/compare/r85/{phase}/390x844-farm.png').resize((64,139),Image.Resampling.NEAREST).save(OUT/f'farm-{phase}-64.png')
 headSizes={}
 for row in subprocess.check_output(['git','ls-tree','-r','-l','-z',BASELINE],cwd=ROOT).decode('utf-8').split('\0'):
  if not row:continue
  info,name=row.split('\t',1);parts=info.split()
  if parts[3].isdigit():headSizes[name]=int(parts[3])
 runtime=[p for p in ROOT.rglob('*') if p.is_file() and (p.relative_to(ROOT).parts[0] in ['src','assets'] or p.name in ['index.html','sw.js','manifest.webmanifest','package.json'])];now=sum(p.stat().st_size for p in runtime);old=sum(headSizes.get(p.relative_to(ROOT).as_posix(),0) for p in runtime)
 size=dict(scope='Web runtime only; docs and native IPA/AAB excluded',baselineCommit=BASELINE,beforeBytes=old,afterBytes=now,deltaBytes=now-old,newImageBytes=m['runtimeBytes']);(OUT/'package-size.json').write_text(json.dumps(size,indent=2)+'\n',encoding='utf-8')
 syntax=[]
 for p in list((ROOT/'src').glob('*.js'))+list((ROOT/'scripts').glob('*.js')):
  r=subprocess.run(['node','--check',str(p)],cwd=ROOT,capture_output=True);assert not r.returncode,(p,r.stderr);syntax.append(p.relative_to(ROOT).as_posix())
 pattern=re.compile(rb'sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}');hits=[]
 for p in ROOT.rglob('*'):
  if not p.is_file() or any(v in p.relative_to(ROOT).parts for v in ['.git','node_modules','.audit-tmp','.secrets']):continue
  if p.suffix.lower() not in ['.js','.json','.html','.css','.md','.txt','.yml','.yaml','.py','.ps1','.webmanifest']:continue
  if pattern.search(p.read_bytes()):hits.append(p.relative_to(ROOT).as_posix())
 assert not hits,hits
 for p in runtime:
  if p.suffix in ['.js','.css','.html','.webmanifest'] or p.name=='package.json':assert 'r84-20261016-1' not in p.read_text(encoding='utf-8'),p
 r=subprocess.run(['git','diff','--check'],cwd=ROOT,capture_output=True);assert not r.returncode,r.stdout
 final=json.loads((OUT/'final-checks.json').read_text(encoding='utf-8'));assert {r['name'] for r in final['checks']}=={'npm-test','e2e','night','water-guide','compare'};assert all(r['exitCode']==0 for r in final['checks']);assert json.loads((OUT/'art-validation.json').read_text(encoding='utf-8'))['status']=='VERIFIED';assert json.loads((ROOT/'package-lock.json').read_text())['version']=='0.1.19'
 data=dict(status='VERIFIED',version='0.1.19',appVersion='r85-20261017-1',headless=True,localOnly=True,checks=final['checks'],assetRows=rows,pixels=pixel,storeScreenshots=shots,syntaxFiles=len(syntax),secretScanMatches=0,oldRuntimeVersionMatches=0,package=size,characterDoubleGates=6,qualityExceptions={p:v for p,v in m['qualityMetrics'].items() if not v['gatePass']},qualityExceptionReason='Album/paper and cream note are non-character surfaces; raw failing values retained.',limitations=['No timed human recognition study or independent 8/10 rescore.','No native iOS/Android/Safari device proof.','Concurrent-load rAF performance is reference only.'])
 (OUT/'verification.json').write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8');final['status']='VERIFIED';(OUT/'final-checks.json').write_text(json.dumps(final,indent=2)+'\n',encoding='utf-8');print('VERIFIED assets, light pixels, 10 store images, syntax, version, secret scan')
if __name__=='__main__':main()
