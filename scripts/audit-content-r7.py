"""Release readback without credentials, network calls, or external writes."""
import hashlib,json,pathlib,re,subprocess
from PIL import Image

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/content/r7'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
report={'status':'EXECUTED','checks':[]}
def check(value,name):
    if not value:raise AssertionError(name)
    report['checks'].append(name)
try:
    syntax=[]
    for f in sorted([*ROOT.glob('src/*.js'),*ROOT.glob('scripts/*.js'),ROOT/'sw.js']):
        p=subprocess.run(['node','-c',str(f)],cwd=ROOT,capture_output=True)
        check(p.returncode==0,'syntax '+f.relative_to(ROOT).as_posix())
        syntax.append(f.relative_to(ROOT).as_posix())
    report['jsSyntaxFiles']=len(syntax)
    stale=[]
    for f in [ROOT/x for x in ['index.html','sw.js','manifest.webmanifest','package.json','package-lock.json']]+list(ROOT.glob('src/*.js'))+list(ROOT.glob('src/*.css')):
        if 'content-r6-20261019-1' in f.read_text(encoding='utf-8'):stale.append(f.relative_to(ROOT).as_posix())
    check(not stale,'zero stale runtime version strings')
    report['staleRuntime']=stale
    pattern=re.compile(r'sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}')
    hits=[];scanned=0
    for f in ROOT.rglob('*'):
        rel=f.relative_to(ROOT)
        if any(x in {'.git','node_modules','.audit-tmp'} for x in rel.parts) or not f.is_file() or f.suffix.lower() not in {'.js','.json','.css','.html','.md','.txt','.py','.yml','.yaml','.webmanifest','.xml','.toml'}:continue
        if not f.resolve().is_relative_to(ROOT):continue
        scanned+=1
        if pattern.search(f.read_text(encoding='utf-8',errors='replace')):hits.append(rel.as_posix())
    report['secretScan']={'files':scanned,'hits':hits}
    check(not hits,'secret scan zero hits; repo files only')
    browser=json.loads((OUT/'browser-checks.json').read_text(encoding='utf-8'))
    check(browser['status']=='VERIFIED','R7 actual UI journeys verified')
    review=browser['reviewSet'];check(len(review)==15,'exactly fifteen review screenshots')
    check(all(sum(r['content']==kind for r in review)==5 for kind in ['basket','pond','memory']),'review allocation 5/5/5')
    shots=[]
    for f in sorted(OUT.glob('*.png')):
        im=Image.open(f)
        if f.name.startswith('phone-'):check(im.height>im.width,'portrait '+f.name)
        shots.append({'path':f.relative_to(ROOT).as_posix(),'width':im.width,'height':im.height,'sha256':digest(f)})
    for i,r in enumerate(review,1):
        check(pathlib.Path(r['path']).name.startswith(f'{i:02}-'),'ordered review '+str(i))
        check(digest(ROOT/r['path'])==digest(ROOT/r['source']),'unmodified original copy '+str(i))
        im=Image.open(ROOT/r['path']);check(im.height>im.width,'review portrait '+str(i))
        r.update(width=im.width,height=im.height,sha256=digest(ROOT/r['path']))
    store=[]
    for prefix,size in [('iphone',(1290,2796)),('ipad',(2064,2752))]:
        f=ROOT/'docs/store/screenshots'/f'{prefix}-13-farm-table-r7.png'
        check(Image.open(f).size==size,'native store resolution '+prefix)
        store.append({'path':f.relative_to(ROOT).as_posix(),'width':size[0],'height':size[1],'sha256':digest(f)})
    report['screenshots']=shots;report['reviewSet']=review;report['store']=store
    original=json.loads((ROOT/'.audit-tmp/content-r7-baseline/baseline.json').read_text(encoding='utf-8'))
    owned=set(json.loads((ROOT/'.audit-tmp/content-r7-owned.json').read_text(encoding='utf-8')))
    changed=[name for name,sha in original.items() if name not in owned and (not (ROOT/name).is_file() or digest(ROOT/name)!=sha)]
    report['baseline']={'files':len(original),'ownedExistingFiles':sorted(owned),'unrelatedChanges':changed}
    check(not changed,'all original unrelated files preserved byte-for-byte')
    reg=json.loads((OUT/'regression-checks.json').read_text(encoding='utf-8'));check(reg['status']=='VERIFIED','all serial regression gates verified')
    report['regressionCommands']=len(reg['commands'])
    report['browserChecks']=len(browser['checks'])
    report['status']='VERIFIED'
except Exception as e:
    report['status']='BLOCKED';report['failure']=str(e)
finally:
    (OUT/'release-readback.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(report['status'],report.get('failure',''),len(report['checks']),'checks')
raise SystemExit(0 if report['status']=='VERIFIED' else 1)
