from pathlib import Path
R=Path(__file__).resolve().parents[1]
p=R/'scripts/test-content-r13.js';s=p.read_text(encoding='utf-8').replace("['silver_dace',.5,1950]","['silver_dace',.5,2400]");p.write_text(s,encoding='utf-8')
p=R/'scripts/test-content-r12-e2e.js';s=p.read_text(encoding='utf-8')
s=s.replace('docs/content/r12','docs/content/r13').replace('r12-seeded','r13-seeded').replace('-17-shared-afternoon-r12','-18-shared-afternoon-r13')
s=s.replace('async function snap(p,name,store=false){','''async function snap(p,name,store=false){
 if(/^phone-memory-.*-(lift|carry|received)\\.png$/.test(name)){
  const geometry=await p.evaluate(()=>{const t=document.querySelector('.gather-shared').getBoundingClientRect(),b=document.querySelector('.content-footer').getBoundingClientRect(),stage=document.querySelector('.gather-stage').getBoundingClientRect();return{gap:b.top-t.bottom,tableTop:stage.top};});
  check(geometry.gap<=60,name+' subtitle to controls blank gap <=60px');check(await p.locator('#gatherSkip').isVisible()||name.includes('received'),name+' active skip control');
 }
''')
s=s.replace("await snap(p,'phone-memory-wrong-next.png');await servePortion", """await snap(p,'phone-memory-wrong-next.png');
 check(await p.locator('[data-serve-taste=sour]').isDisabled(),'wrong physical sour portion now empty');
 check(await p.locator('.gather-stage [data-fed=false]').count()===3,'all three unserved guests stay waiting');
 const supplyBefore=await p.evaluate(()=>({bread:__farm.state().adventure.meals.rustic_bread,berry:__farm.state().storage.items.wild_berry}));
 await p.locator('[data-refill=sour]').click();
 check(await p.evaluate(b=>__farm.state().adventure.meals.rustic_bread===b.bread-1&&__farm.state().storage.items.wild_berry===b.berry-1,supplyBefore),'fourth physical portion pays bread and berry exactly once');
 check((await p.locator('.gather-supply').innerText()).includes('→'),'visible fourth portion material readback');await snap(p,'phone-memory-refill-source.png');
 await servePortion""")
s=s.replace("if(capture)await snap(p,`phone-memory-${label}-received.png`);", """if(capture)await snap(p,`phone-memory-${label}-received.png`);
 const mismatch=await p.locator('.gather-stage [data-fed=false]').evaluateAll(es=>es.some(e=>!/wait-/.test(e.src)));check(!mismatch,'every unserved guest has an actual waiting pose after impact');""")
s=s.replace("await snap(p,`phone-pond-${id}-note.png`);", """await snap(p,`phone-pond-${id}-note.png`);
  check((await p.locator('[data-fish-note="'+id+'"][data-unlocked=true] img').getAttribute('src')).includes('-color.png'),'unlocked '+id+' shows same colored fish');
  await p.locator('[data-replay="'+id+'"]').click();await p.waitForFunction(()=>document.querySelector('.note-replay .pond-stage')?.dataset.reel==='active');await snap(p,`phone-pond-${id}-note-replay.png`);await p.locator('.stop-note-replay').click();""")
s=s.replace("await snap(p,`phone-pond-${id}-sinking.png`);", """check(await p.locator('.pond-fisher').isVisible(),id+' visible Miri holding fishing rod');await snap(p,`phone-pond-${id}-sinking.png`);""")
s=s.replace("await snap(p,'phone-memory-corrected-complete.png');", """check((await p.locator('.serving-history summary').innerText()).includes('今天的上菜紀錄（4）'),'history accurately named and counts all four actual servings');await snap(p,'phone-memory-corrected-complete.png');""")
s=s.replace("await snap(q,'phone-memory-complete.png');", """check(!(await q.locator('.serving-history summary').innerText()).includes('分過'),'no shared label when all dishes individually served');await snap(q,'phone-memory-complete.png');""")
# The collection is a direct copy of native phone captures: 5 each, exactly 15.
a=s.index('function review(){');b=s.index('(async()=>',a)
s=s[:a]+'''async function lateFishing(){for(const [id,roll]of [['river_carp',0],['silver_dace',.5],['river_perch',.99]]){const{ctx,p}=await session();try{await p.evaluate(r=>{const start=AdventureAPI.startFishing;AdventureAPI.startFishing=(s,t)=>start(s,t,()=>r);},roll);await p.evaluate(()=>FarmWorld.visitSite('fishing_dock'));await p.waitForFunction(()=>document.querySelector('.world-fishing-result')?.textContent.includes('晚了'),null,{timeout:15000});check(await p.evaluate(()=>Object.keys(__farm.state().adventure.fishNotes).length===0),'late '+id+' earns no fish or note');await snap(p,`phone-pond-${id}-late-failure.png`);}finally{await ctx.close();}}}
function review(){
 const files=[['basket','phone-basket-merchant-walking-2.png'],['basket','phone-basket-elder-walking-2.png'],['basket','phone-basket-elder-contact.png'],['basket','phone-basket-elder-received.png'],['basket','phone-basket-child-walking-2.png'],['pond','phone-pond-comparison.png'],['pond','phone-pond-river_carp-sinking.png'],['pond','phone-pond-silver_dace-sinking.png'],['pond','phone-pond-river_perch-sinking.png'],['pond','phone-pond-river_carp-note-replay.png'],['memory','phone-memory-wrong-next.png'],['memory','phone-memory-refill-source.png'],['memory','phone-memory-corrected-child-carry.png'],['memory','phone-memory-corrected-child-received.png'],['memory','phone-memory-corrected-complete.png']];
 const dir=path.join(OUT,'review-set');fs.mkdirSync(dir,{recursive:true});report.reviewSet=files.map(([content,name],i)=>{const dest=String(i+1).padStart(2,'0')+'-'+name;fs.copyFileSync(path.join(OUT,name),path.join(dir,dest));return{content,source:'docs/content/r13/'+name,path:'docs/content/r13/review-set/'+dest};});
}
''' + s[b:]
s=s.replace('await catalog();await fish();await gather();', 'await catalog();await fish();await lateFishing();await gather();')
# Start a focused continuation only from an earned R13 save, without replaying completed work.
s=s.replace("if(process.argv.includes('--pond-only'))", "if(process.argv.includes('--resume-r13')){earned=JSON.parse(fs.readFileSync(path.join(OUT,'earned-save.json')));await gather();await layouts();await offline();await store();}\n else if(process.argv.includes('--pond-only'))")
(R/'scripts/test-content-r13-e2e.js').write_text(s,encoding='utf-8')
p=R/'scripts/measure-content-r13.js';p.write_text((R/'scripts/measure-content-r12.js').read_text(encoding='utf-8').replace('docs/content/r12','docs/content/r13'),encoding='utf-8')
print('PREPARED R13 browser journeys and performance runner')
