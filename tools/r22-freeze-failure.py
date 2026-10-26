"""Preserve source bytes for the first short-landscape failure, hash checked."""
import pathlib,json,hashlib,shutil
R=pathlib.Path(__file__).resolve().parents[1]
report_path=R/'docs/content/r22/runs/2026-10-24T08-55-17-062Z/delivery-844x390/journey-delivery-844x390.json'
j=json.loads(report_path.read_text(encoding='utf-8'));out=R/'docs/content/r22/failures/844x390-head-clearance'
out.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
rows={}
for name,expected in j['sourceHashes'].items():
 b=(R/name).read_bytes()
 if name=='src/content-r6.js' and sha(b)!=expected:
  s=b.decode('utf-8')
  s=s.replace("      // The child is visually staged north of its collider. In a short landscape\n      // view, center that visual row so the full heads clear the delivery HUD.\n      const focus=n.id==='child'&&innerHeight<450?s.map.tiles.find(t=>t.x===tile.x&&t.y===tile.y-1):tile;\n",'')
  s=s.replace("farm().focusTile(focus?.id||tile.id);bar.dataset.phase='arrived'","farm().focusTile(tile.id);bar.dataset.phase='arrived'")
  b=s.encode('utf-8')
 assert sha(b)==expected,(name,'cannot reconstruct hash-exact failed revision')
 target=out/'source'/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b);rows[name]=expected
shutil.copyfile(report_path,out/'journey.json')
(out/'source-manifest.json').write_text(json.dumps({'status':'VERIFIED','sourceReport':report_path.relative_to(R).as_posix(),'sourceHashes':rows,'note':'The pre-camera-fix content-r6.js bytes were reconstructed by reversing the isolated camera diff and accepted only after matching the failed journey SHA256. All other source bytes copied only after the same hash check. Existing failed PNGs remain at their original paths.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED preserved failed-source bytes:',len(rows))
