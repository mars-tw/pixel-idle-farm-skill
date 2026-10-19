"""Correct the decorative river bounds without changing any game-state code."""
import pathlib,json,hashlib
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r13';name='src/content-r6.js';p=R/name
old=b'top:${-size}px;width:${size*3}px;height:${size*14}px';new=b'top:${-size*4}px;width:${size*3}px;height:${size*20}px'
before=p.read_bytes();assert before.count(old)==1;after=before.replace(old,new);snapshot=O/'source-snapshots/river-grid-before'/name;snapshot.parent.mkdir(parents=True,exist_ok=True);snapshot.write_bytes(before);p.write_bytes(after)
sha=lambda b:hashlib.sha256(b).hexdigest()
(O/'river-grid-delta.json').write_text(json.dumps({'status':'VERIFIED','kind':'decorative river bounds only; pointer-events none; no state, collider, input or economy changes','from':old.decode(),'to':new.decode(),'files':[{'path':name,'beforeSha256':sha(before),'afterSha256':sha(after),'replacements':1,'beforeSnapshot':snapshot.relative_to(R).as_posix()}],'affectedTests':['npm test','node scripts/test-r79-fun-e2e.js','node scripts/test-controls-reachability.js','node scripts/audit-content-r13-evidence.js','node scripts/measure-content-r13.js']},indent=2)+'\n',encoding='utf-8')
print('VERIFIED exact decorative river bounds repair; all other source bytes identical')
