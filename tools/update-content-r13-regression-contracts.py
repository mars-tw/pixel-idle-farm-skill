"""Keep old regression assertions, moving eating coverage to after actual service."""
from pathlib import Path
R=Path(__file__).resolve().parents[1]
p=R/'scripts/test-content-r9-e2e.js';s=p.read_text(encoding='utf-8')
a=s.index('for(let i=1;i<=3;i++)');b=s.index('const sharedFrames',a);old=s[a:b]
wait_start=old.index('await p.waitForFunction(pose=>');wait_end=old.index('await snap(p,`phone-memory-shared-',wait_start)
cycle=old[wait_start:wait_end]
prefix=old[:wait_start];quote=old[old.index("check((await p.locator('.gather-shared')",wait_end):]
new=prefix+"check(await p.locator('.gather-stage [data-fed=true]').count()===i,'only actual served guests may eat '+i);check(await p.locator('.gather-stage [data-fed=false]').evaluateAll(es=>es.every(e=>e.dataset.upperPose==='wait')),'unserved guests keep waiting pose '+i);"+quote
new+="for(let i=1;i<=3;i++){"+cycle+"await snap(p,`phone-memory-shared-${i}.png`);}"
s=s[:a]+new+s[b:];p.write_text(s,encoding='utf-8')
p=R/'scripts/test-content-r12-e2e.js';s=p.read_text(encoding='utf-8')
needle='async function servePortion(p,id,taste,label,capture=true){\n'
assert needle in s
s=s.replace(needle,needle+''' // R13: the fourth physical dish must have a paid source before it is selectable.
 if(await p.locator(`[data-serve-taste="${taste}"]`).isDisabled()){
  const before=await p.evaluate(taste=>({requirements:AdventureAPI.gatheringPortions(__farm.state(),Date.now()).find(p=>p.taste===taste).requirements}),taste);
  await p.locator(`[data-refill="${taste}"]`).click();
  const after=await p.evaluate(taste=>AdventureAPI.gatheringPortions(__farm.state(),Date.now()).find(p=>p.taste===taste),taste);
  check(after.remaining===1&&after.requirements.every((r,i)=>r.current===before.requirements[i].current-before.requirements[i].required),'fourth portion refilled with exact displayed ingredients');
 }
''')
p.write_text(s,encoding='utf-8')
print('PREPARED equally strict R9 fed-state and R12 paid-refill regression coverage')
