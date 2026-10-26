"""Keep old behavior assertions, measure the new world exchange in world pixels."""
from pathlib import Path
R=Path(__file__).resolve().parents[1]
for i in range(10,16):
 p=R/f'scripts/test-content-r{i}-e2e.js';s=p.read_text(encoding='utf8');needle='async function snap(p,name,store=false){';assert needle in s,p
 setup="await p.evaluate(()=>{window.__r17WorldRect=e=>{const w=e.closest('#mapWorld');if(!w)return null;const r=e.getBoundingClientRect(),b=w.getBoundingClientRect(),scale=b.width/w.offsetWidth;return {x:(r.x-b.x)/scale,y:(r.y-b.y)/scale,width:r.width/scale,height:r.height/scale,bottom:(r.bottom-b.y)/scale};};});"
 s=s.replace(needle,needle+'\n '+setup,1)
 assert 'rect:e.getBoundingClientRect().toJSON()' in s;s=s.replace('rect:e.getBoundingClientRect().toJSON()','rect:e.getBoundingClientRect().toJSON(),worldRect:window.__r17WorldRect(e)')
 assert 'f.state.parcel[0].rect.width===66' in s;s=s.replace('f.state.parcel[0].rect.width===66','f.state.parcel[0].worldRect?.width===32&&f.state.parcel[0].worldRect?.height===32')
 s=s.replace('x[actor].rect.height-xs[0][actor].rect.height','x[actor].worldRect.height-xs[0][actor].worldRect.height').replace('x[actor].rect.bottom-xs[0][actor].rect.bottom','x[actor].worldRect.bottom-xs[0][actor].worldRect.bottom')
 s=s.replace("id+' fixed sprite height and feet '","id+' fixed native sprite height and world feet through camera movement '")
 p.write_text(s,encoding='utf8')
p=R/'scripts/test-content-r14-visuals.js';s=p.read_text(encoding='utf8');assert "getComputedStyle(e).zIndex==='9'" in s;s=s.replace("getComputedStyle(e).zIndex==='9'","getComputedStyle(e).zIndex==='11'").replace('full moving plate is above shared label','moving plate uses its exact foreground layer and avoids shared label');p.write_text(s,encoding='utf8')
p=R/'tools/stage-content-r17.py';s=p.read_text(encoding='utf8');where=" 'scripts/test-content-r7-e2e.js'";assert where in s
s=s.replace(where," "+','.join(repr(f'scripts/test-content-r{i}-e2e.js') for i in range(10,16))+",'scripts/test-content-r14-visuals.js',\n"+where)
s=s.replace("'tools/run-content-r17-checks.py'","'tools/update-content-r17-test-contracts.py','tools/run-content-r17-checks.py'")
p.write_text(s,encoding='utf8')
print('EXECUTED exact world-size and world-foot contracts; other assertions retained')
