"""Build this round's continuous real-input six-image story from the retained capture harness."""
from pathlib import Path
R=Path(__file__).resolve().parents[1];p=R/'scripts/capture-r89-store.js';t=(R/'scripts/capture-r88-store.js').read_text(encoding='utf8')
t=t.replace('r88-art','r89-art')
t=t.replace("const moment=await page.evaluate", "const moment=await page.evaluate")
t=t.replace("const visual=await page.evaluate(()=>{const p=", "const visual=await page.evaluate(()=>{const s=__farm.state();const p=")
t=t.replace("return{rootHeight:p.height", "return{coins:s.coins,storage:{...s.storage.items},sunWheat:FarmHeirloom.status(s).sunWheat,harvested:{...s.stats.harvested},chapterQuest:document.querySelector('#questDock').dataset.quest,rootHeight:p.height")
old="for(const i of [0,1,2,3]){await page.waitForFunction(i=>getCropProgress(__farm.state(),__farm.state().plots[i],Date.now()).ready,i,{timeout:25000});await action(page,i,'harvest');await page.waitForFunction(i=>!__farm.state().plots[i].cropId,i);await rest(page);}"
new="""for(const i of [0,1,2,3]){
   await page.waitForFunction(i=>getCropProgress(__farm.state(),__farm.state().plots[i],Date.now()).ready,i,{timeout:25000});
   await action(page,i,'harvest');
   if(i===0){await page.waitForFunction(()=>__farm.playerAction()==='harvest'&&__farm.state().storage.items.wheat>0,null,{timeout:4000});await shot(page,platform+'-03-harvest');}
   await page.waitForFunction(i=>!__farm.state().plots[i].cropId,i);await rest(page);
  }"""
assert old in t;t=t.replace(old,new)
t=t.replace("platform+'-03-basket'","platform+'-04-basket'").replace("platform+'-04-note'","platform+'-05-note'").replace("platform+'-05-daily'","platform+'-06-daily'")
old="await shot(page,platform+'-04-basket');await page.locator(choice==='table'?'#heirloomTable':'#heirloomDoorstep').tap();"
new="await shot(page,platform+'-04-basket');await page.locator('#heirloomConfirm').tap();"
assert old in t;t=t.replace(old,new)
t=t.replace("await page.waitForTimeout(3200);await shot(page,platform+'-06-porch');", "await page.waitForTimeout(3200);await shot(page,platform+'-detail-porch');")
t=t.replace("2,'doorstep'","2,'table'")
t=t.replace("VERIFIED 12 real-input store captures including selected choice, porch and earned stamps", "VERIFIED continuous six-image story on both devices, plus post-delivery porch details")
p.write_text(t,encoding='utf8',newline='\n');print('prepared continuous-story capture')
