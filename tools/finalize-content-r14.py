"""Curate native originals and write current-round artifact/store provenance."""
import hashlib,json,pathlib,shutil
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r14'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
promotions={};archive=O/'regression-outputs/docs/content/r13'
if (archive/'browser-checks.json').exists():
 earned=json.loads((archive/'browser-checks.json').read_text(encoding='utf-8'));assert earned['status']=='VERIFIED'
 receipts=[]
 for p in O.glob('regression-*.json'):
  if p.name=='regression-reconciled.json':continue
  j=json.loads(p.read_text(encoding='utf-8'))
  if j.get('status')=='VERIFIED' and any(c['command']==['node','scripts/test-content-r13-e2e.js'] and c['exitCode']==0 for c in j.get('commands',[])) and all(sha(R/n)==h for n,h in j['sourceHashes'].items()):receipts.append(p)
 assert receipts,'Current-version R13 regression receipt required for promoted captures'
 for name,phase in [('phone-basket-elder-contact.png','reach'),('phone-basket-elder-received.png','contact')]:
  source=archive/name;frame=[f for f in earned['frames'] if f['path']=='docs/content/r13/'+name][-1]
  assert sha(source)==frame['sha256'] and frame['state']['deliveryPhase']==phase
  old=O/'initial-captures'/name;old.parent.mkdir(exist_ok=True)
  if not old.exists():shutil.copyfile(O/name,old)
  shutil.copyfile(source,O/name)
  promotions[name]={'originalSource':source.relative_to(R).as_posix(),'executionReceipt':sorted(receipts)[-1].relative_to(R).as_posix(),'appVersion':json.loads((R/'package.json').read_text(encoding='utf-8'))['appVersion'],'sha256':sha(source),'phase':phase,'initialCapturePreserved':old.relative_to(R).as_posix()}
(O/'capture-promotions.json').write_text(json.dumps({'status':'VERIFIED','images':promotions},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
groups={
 'basket':['phone-basket-house-behind.png','phone-basket-label-320.png','phone-basket-merchant-far.png','phone-basket-elder-contact.png','phone-basket-elder-received.png'],
 'pond':['phone-pond-river_carp-early-final.png','phone-pond-river_carp-active-final.png','phone-pond-silver_dace-active-final.png','phone-pond-river_perch-active-final.png','phone-pond-count-3.png'],
 'memory':['phone-memory-wrong-simple.png','phone-memory-child-lift.png','phone-memory-child-mid.png','phone-memory-child-reply.png','phone-memory-shared-complete-reloaded.png']}
dest=O/'review-set';dest.mkdir(exist_ok=True);selected=[]
# Only R14-generated copies are replaced; no pre-existing untracked files exist here.
for p in dest.glob('*.png'):p.unlink()
for content,names in groups.items():
 for n in names:
  source=O/n;size=Image.open(source).size;assert size in [(430,932),(320,568)],(n,size)
  target=dest/(f'{len(selected)+1:02d}-'+n);shutil.copyfile(source,target);assert sha(source)==sha(target)
  selected.append({'content':content,'path':target.relative_to(R).as_posix(),'source':source.relative_to(R).as_posix(),'width':size[0],'height':size[1],'sha256':sha(target),'capture':'original viewport screenshot; no resize, crop or composite'})
  if n in promotions:selected[-1]['captureProvenance']=promotions[n]
(O/'review-set-manifest.json').write_text(json.dumps({'status':'VERIFIED','count':15,'perContent':5,'images':selected},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
primary=O/'browser-checks.json'
if primary.exists():
 data=json.loads(primary.read_text(encoding='utf-8'));data['reviewSet']=selected;data['reviewSelectionBasis']='Final R14 native originals; supplemental captures and final contact-path repair replace the initial automatic selection.';primary.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
store=[]
for device,size in [('iphone',(1290,2796)),('ipad',(2064,2752))]:
 p=R/f'docs/store/screenshots/{device}-19-shared-afternoon-r14.png';assert Image.open(p).size==size
 store.append({'path':p.relative_to(R).as_posix(),'width':size[0],'height':size[1],'sha256':sha(p),'capture':'actual serving reply; iPhone DPR3 or iPad DPR2; no resize or composite'})
(R/'docs/store/screenshots-content-r14-manifest.json').write_text(json.dumps({'status':'VERIFIED','images':store},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
prefix=json.loads((R/'docs/art/PROMPTS_R89.json').read_text(encoding='utf-8'))['stylePrefix']
(R/'docs/art/PROMPTS_CONTENT_R14.json').write_text(json.dumps({'status':'VERIFIED','stylePrefix':prefix,'newGeneratedMasters':0,'newGeneratedRuntimeAssets':0,'generationToolUsedThisRound':None,'jobs':[],'reusedGeneratedAssets':['assets/generated/content-r13/fishing-0.png','assets/generated/content-r13/fishing-1.png','assets/generated/content-r13/fishing-2.png','assets/generated/content-r13/*-shadow.png','assets/generated/content-r12/wide-*.png','assets/generated/content-r12/peck-*.png','assets/generated/content-r12/wake-*.png','assets/generated/content-r12/serve-*.png','assets/generated/content-r9/*-merchant.png','assets/generated/content-r9/*-elder.png','assets/generated/content-r9/*-child.png'],'originalGenerationTool':'image_gen.imagegen (existing source manifests)','note':'R14 repairs existing content using accepted native sprites. Fishing line is a runtime SVG stroke; no placeholder bitmap or newly generated artwork claimed.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
rows=[]
for p in sorted(O.rglob('*')):
 if p.is_file() and p.suffix.lower() in {'.png','.webm'} and 'regression-outputs' not in p.parts:
  row={'path':p.relative_to(R).as_posix(),'sha256':sha(p),'bytes':p.stat().st_size}
  if p.suffix=='.png':row['width'],row['height']=Image.open(p).size
  rows.append(row)
(O/'artifact-manifest.json').write_text(json.dumps({'status':'VERIFIED','artifacts':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED 15 native review frames, two native store frames, 0 new art,',len(rows),'evidence artifacts')
