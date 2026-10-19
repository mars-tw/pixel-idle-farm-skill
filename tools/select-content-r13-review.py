"""Select fifteen native originals; preserve the earlier owned selection intact."""
import pathlib,json,hashlib,shutil
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r13';D=O/'review-set'
baseline=json.loads((R/'.audit-tmp/content-r13-protection/inventory.json').read_text(encoding='utf-8'))
archive=O/'review-set-before-final-selection';archive.mkdir(exist_ok=True)
for p in D.glob('*.png'):
    assert p.relative_to(R).as_posix() not in baseline
    q=archive/p.name
    if q.exists():q=q.with_name(q.stem+'-'+hashlib.sha256(p.read_bytes()).hexdigest()[:8]+q.suffix)
    assert p.resolve().is_relative_to(O) and q.resolve().is_relative_to(O);p.rename(q)
files=[('basket','phone-basket-merchant-walking-2.png'),('basket','phone-basket-elder-walking-2.png'),('basket','phone-basket-elder-contact.png'),('basket','phone-basket-elder-received.png'),('basket','phone-basket-child-walking-2.png'),('basket','phone-basket-merchant-received.png'),('pond','phone-pond-river_carp-locked.png'),('pond','phone-pond-river_carp-sinking-final.png'),('pond','phone-pond-silver_dace-sinking-final.png'),('pond','phone-pond-river_perch-sinking-final.png'),('pond','phone-pond-learned-three-replay.png'),('memory','phone-memory-wrong-next-final.png'),('memory','phone-memory-corrected-child-mid-slide.png'),('memory','phone-memory-corrected-child-received-final.png'),('memory','phone-memory-corrected-complete-reloaded.png')]
rows=[]
for i,(content,name) in enumerate(files,1):
    src=O/name;assert Image.open(src).size==(430,932);dest=D/f'{i:02d}-{name}';shutil.copyfile(src,dest)
    rows.append({'content':content,'source':src.relative_to(R).as_posix(),'path':dest.relative_to(R).as_posix(),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
p=O/'browser-checks.json';report=json.loads(p.read_text(encoding='utf-8'));report['reviewSet']=rows;report['finalReviewAllocation']={'basket':6,'pond':5,'memory':4};report['selectionReason']='Retains all three walking middle frames, full elder exchange and visible repaired river; picnic completion itself includes the paid refill receipt.';p.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED fifteen direct native copies: basket6 / pond5 / memory4; prior selection preserved')
