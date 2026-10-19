"""Archive only outputs newly produced by this run, plus retain original R7 comparisons."""
import hashlib,json,pathlib,shutil
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'docs/content/r8';BASE=ROOT/'.audit-tmp/content-r8-baseline'
original=json.loads((BASE/'baseline.json').read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def within(p):
 p=p.resolve();assert p.is_relative_to(ROOT);return p
archived=[];restored=[]
for rel,h in original.items():
 if not rel.startswith('docs/') or rel.startswith('docs/content/r8/') or rel=='docs/OPTIM_PLAN_CONTENT_R8.md':continue
 f=ROOT/rel
 if not f.exists() or sha(f)!=h:
  if f.exists():
   dest=OUT/'release-generated'/rel;within(f);within(dest);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dest)
  within(f);f.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(BASE/'files'/rel,f);assert sha(f)==h;restored.append(rel)
for top in [*(f'docs/content/r{n}' for n in range(1,8)),'docs/evidence','docs/store/screenshots']:
 for f in list((ROOT/top).rglob('*')):
  if not f.is_file():continue
  rel=f.relative_to(ROOT).as_posix()
  if rel in original or f.name in ['iphone-14-living-table-r8.png','ipad-14-living-table-r8.png']:continue
  dest=OUT/'regression-generated'/rel;within(f);within(dest);dest.parent.mkdir(parents=True,exist_ok=True)
  if dest.exists():dest=dest.with_name(dest.stem+'-repeat-'+sha(f)[:8]+dest.suffix)
  assert not dest.exists()
  record={'source':rel,'archive':dest.relative_to(ROOT).as_posix(),'sha256':sha(f)}
  shutil.move(f,dest)
  archived.append(record)
before=[]
for name in ['phone-pond-river_perch-sinking.png','phone-memory-elder-farm-object.png','phone-gathering-farm-seated.png']:
 rel='docs/content/r7/'+name;source=BASE/'files'/rel;dest=OUT/'before'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
 before.append({'source':rel,'path':dest.relative_to(ROOT).as_posix(),'sha256':sha(dest),'trust':'Historical R7 original retained at task start. Not a fresh old-version run.'})
for name in ['setup-content-r8.py','update-content-r8-art-tests.py','update-content-r8-asset-routes.py','finalize-content-r8-copy.py']:
 f=ROOT/'scripts'/name
 if f.exists():
  assert f.relative_to(ROOT).as_posix() not in original
  dest=ROOT/'.audit-tmp/content-r8-build'/name;within(f);within(dest);dest.parent.mkdir(parents=True,exist_ok=True);shutil.move(f,dest)
(OUT/'generated-output-archive.json').write_text(json.dumps({'status':'VERIFIED','archived':archived,'restoredAfterReleaseUnit':restored,'before':before},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED archived',len(archived),'new test outputs; three historical before images retained')
