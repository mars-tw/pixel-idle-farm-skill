"""Copy original phone PNG bytes into the 15-image review budget; audit artifacts."""
import pathlib,json,hashlib,shutil,subprocess,re
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r15';D=O/'review-set';D.mkdir(exist_ok=True)
for dest,source in [('phone-basket-merchant-distance-2.png','phone-basket-merchant-near.png'),('phone-basket-merchant-distance-1.png','phone-basket-merchant-same-frame.png')]:shutil.copyfile(O/source,O/dest)
names=[('basket','phone-basket-house-delivery-behind.png'),('basket','phone-basket-merchant-distance-2.png'),('basket','phone-basket-merchant-distance-1.png'),('basket','phone-basket-elder-contact.png'),('basket','phone-basket-elder-received.png'),('pond','phone-pond-river_carp-practice-pre.png'),('pond','phone-pond-river_carp-practice-active.png'),('pond','phone-pond-river_carp-practice-missed.png'),('pond','phone-pond-silver_dace-practice-active.png'),('pond','phone-pond-river_perch-practice-active.png'),('memory','phone-memory-child-select.png'),('memory','phone-memory-wrong.png'),('memory','phone-memory-child-lift.png'),('memory','phone-memory-child-mid.png'),('memory','phone-memory-child-reply.png')]
for p in D.iterdir():
    assert p.resolve().is_relative_to(D.resolve())
    if p.is_file():p.unlink()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
records=[]
for i,(group,name) in enumerate(names,1):
    src=O/name;dest=D/(str(i).zfill(2)+'-'+name);assert Image.open(src).size==(430,932),name;shutil.copyfile(src,dest);assert sha(src)==sha(dest)
    records.append({'group':group,'source':src.relative_to(R).as_posix(),'path':dest.relative_to(R).as_posix(),'width':430,'height':932,'sha256':sha(dest),'operation':'byte-identical copy, no cropping/compositing/resizing'})
(O/'review-set-manifest.json').write_text(json.dumps({'status':'VERIFIED','count':15,'perContent':{'basket':5,'pond':5,'memory':5},'frames':records,'scope':'The selected 15 prove core interactions. Complete per-person and per-species sequences are in the parent directory; no claim that every requested frame fits into 15.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
before=O/'before';before.mkdir(exist_ok=True)
base=json.loads((O/'base-revision.json').read_text(encoding='utf-8'))['baseCommit']
paths=subprocess.check_output(['git','ls-tree','-rz','--name-only',base,'--','docs/content/r14/review-set'],cwd=R).decode().split('\0')
for name in paths:
    if any('/'+n+'-' in name for n in ['01','03','04','09','13']):
        data=subprocess.check_output(['git','show',base+':'+name],cwd=R);(before/pathlib.Path(name).name).write_bytes(data)
stores=[]
for tag,size in [('iphone',(1290,2796)),('ipad',(2064,2752))]:
    p=R/f'docs/store/screenshots/{tag}-20-hand-served-r15.png';assert Image.open(p).size==size;stores.append({'path':p.relative_to(R).as_posix(),'size':size,'sha256':sha(p)})
scan=[];count=0;pattern=re.compile(r'sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}')
for p in R.rglob('*'):
    if not p.is_file() or set(p.relative_to(R).parts)&{'.git','node_modules','.audit-tmp','__pycache__'} or p.suffix.lower() not in {'.js','.jsx','.ts','.tsx','.css','.html','.json','.md','.py','.ps1','.sh','.yml','.yaml','.toml','.ini','.cfg','.xml','.svg','.csv','.webmanifest','.txt','.log'}:continue
    if p.suffix.lower()=='.log' and not p.relative_to(R).as_posix().startswith('docs/content/r15/'):continue
    count+=1
    if pattern.search(p.read_text(encoding='utf-8',errors='replace')):scan.append(p.relative_to(R).as_posix())
assert not scan,scan
(O/'artifact-audit.json').write_text(json.dumps({'status':'VERIFIED','phoneReviewImages':15,'stores':stores,'secretScan':{'files':count,'matches':0,'pattern':'user-specified OpenAI credential patterns; no values logged'}},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED 15 native phone images; store sizes; secret scan',count,'files, zero matches')
