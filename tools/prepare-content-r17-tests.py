"""Upgrade the R17-only journey to capture every fishing result and notebook readback."""
from pathlib import Path
R=Path(__file__).resolve().parents[1];p=R/'scripts/test-content-r17-e2e.js';s=p.read_text(encoding='utf8')
a=s.index(' const{ctx,p}=await session(fishSave);try{await p.evaluate',s.index('async function fishing()'))
b=s.index('async function auditMovingPlate',a)
s=s[:a]+r''' const{ctx,p}=await session(fishSave);try{
 await p.evaluate(()=>FarmWorld.visitSite('fishing_dock'));await p.locator('#worldFishNotes').click();const before=await resources(p);
 for(const[id,roll]of kinds)for(const[timing,correct]of [['perfect',true],['perfect',false],['early',true],['early',false],['late',true],['late',false]]){
  await p.evaluate(r=>Math.random=()=>r,roll);await p.locator('#pondPractice').click();
  check(!/河鯉|銀鯽|溪鱸/.test((await p.locator('.practice-rule,.practice-cue,.practice-reveal').allTextContents()).join('')),id+' answer not exposed before choosing');
  if(timing==='perfect'&&correct)await snap(p,`phone-pond-${id}-pre.png`);
  if(timing==='early')await p.locator('.practice-reel').click();
  else if(timing==='late')await p.locator('.blind-practice[data-result=late]').waitFor();
  else{await p.waitForFunction(()=>document.querySelector('.blind-practice .pond-stage')?.dataset.reel==='active',null,{polling:'raf'});if(correct)await snap(p,`phone-pond-${id}-active.png`);await p.locator('.practice-reel').click();}
  check(await p.locator('.blind-practice').getAttribute('data-result')===timing,id+' actual reel phase '+timing);
  check(await p.locator('.practice-guesses button:visible').count()===3,id+' three unselected fish choices');
  check(await p.locator('.practice-guesses button').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=44&&!e.hasAttribute('data-correct')&&!e.hasAttribute('aria-pressed'))),id+' neutral fish choices at least 44px');
  if(timing==='perfect'&&correct)await snap(p,`phone-pond-${id}-guess.png`);
  const guess=correct?id:kinds.find(k=>k[0]!==id)[0];await p.locator(`[data-guess=${guess}]`).click();
  const text=await p.locator('.blind-practice').innerText();
  check((text.match(/本竿/g)||[]).length===1&&!(/錯過/.test(text)&&/認對了/.test(text)),id+' '+timing+'/'+correct+' exactly one coherent result');
  check(await p.locator('.blind-practice').getAttribute('data-success')===String(timing==='perfect'&&correct),id+' overall result agrees with timing and choice');
  await snap(p,`phone-pond-${id}-${timing}-${correct?'correct':'wrong'}.png`);
  if(timing==='perfect'&&correct)await snap(p,`phone-pond-${id}-reveal.png`);
  check(await resources(p)===before,id+' practice changes no inventory or notes');await p.locator('.stop-note-replay').click();
 }
 await p.reload();await ready(p);check(await resources(p)===before,'all 18 result branches preserve the actual saved resources');
 }finally{await ctx.close();}}
''' +s[b:]
# A proper notebook page is distinct from the invitation dialog.
old="await snap(p,'phone-memory-invite-reply.png');check(await resources(p)===supply"
new="await snap(p,'phone-memory-invite-reply.png');await p.locator('#inviteBack').click();await snap(p,'phone-memory-invite-journal.png');await p.locator('#gatherInvite').click();check(await resources(p)===supply"
assert old in s;s=s.replace(old,new)
old="await snap(p,'phone-memory-invite-reloaded.png');complete=await saved(p);"
new="await snap(p,'phone-memory-invite-reloaded.png');await p.locator('#inviteBack').click();check((await p.locator('.invitation-journal').innerText()).includes('圖圖'), 'actual notebook contains the persisted invited person');await snap(p,'phone-memory-invite-journal-reloaded.png');complete=await saved(p);"
assert old in s;s=s.replace(old,new)
p.write_text(s,encoding='utf8')
print('VERIFIED R17 capture script prepared')
