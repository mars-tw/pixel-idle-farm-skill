"""Add the real all-correct UI path and four-viewport serving coverage."""
import pathlib
R=pathlib.Path(__file__).resolve().parents[1];p=R/'scripts/test-content-r20-e2e.js';s=p.read_text(encoding='utf-8')
def rep(old,new):
 global s
 assert old in s,old[:100];s=s.replace(old,new)
rep(".practice-guesses button,.journal-pager button,.serving-foods button'", ".practice-guesses button,.journal-pager button,.serving-foods button,.neighbor-tabs button,.restock-foods button,.invite-choices button'")
rep("async function serving(){", "async function serving(allCorrect=false){")
rep("await picnic(p);\n async function portion", "await picnic(p);await controls(p,'choose a guest');\n async function portion")
rep("const before=await p.evaluate(()=>__farm.state().adventure.gathering.servings.length);await p.locator('#gatherSip').click();", "const before=await p.evaluate(()=>__farm.state().adventure.gathering.servings.length);await controls(p,id+' selected serving');await p.locator('#gatherSip').click();")
rep("expected=await p.evaluate(()=>AdventureAPI.servingReply('child','sweet',true))", "expected=await p.evaluate(()=>AdventureAPI.servingReply('child','sweet',__farm.state().adventure.gathering.servings.some(h=>!h.matched)))")
rep("await portion('child','sour',false);check", "if(!allCorrect){await portion('child','sour',false);check")
rep("await p.locator('#gatherSupplies').click();await p.locator('[data-refill=sour]').click();await p.locator('#gatherReturn').click();for(const[id,taste]of pairs)", "await p.locator('#gatherSupplies').click();await controls(p,'refill supplies');await p.locator('[data-refill=sour]').click();await p.locator('#gatherReturn').click();}for(const[id,taste]of pairs)")
rep("'UI portions match authority: sour 1+1-2=0 and all three portions exhausted'", "allCorrect?'UI portions match authority: three correct servings exhaust the three packed portions':'UI portions match authority: sour 1+1-2=0 and all three portions exhausted'")
rep("supply.includes('本次聚餐的補備與剩餘')&&supply.includes('補備時已取用')", "supply.includes('本次聚餐的補備與剩餘')&&(allCorrect?supply.includes('本次沒有另行補備'):supply.includes('補備時已取用'))")
rep("'journal identifies spent refill as this-meal history'", "allCorrect?'journal truthfully reports no extra refill':'journal identifies spent refill as this-meal history'")
rep("await snap(p,'phone-journal-first.png');", "await snap(p,allCorrect?'phone-journal-no-shared-first.png':'phone-journal-first.png');")
rep("await snap(p,'phone-journal-last.png');", "await snap(p,allCorrect?'phone-journal-no-shared-last.png':'phone-journal-last.png');")
rep("await snap(p,'phone-journal-photo-open.png');", "await snap(p,allCorrect?'phone-journal-no-shared-photo-open.png':'phone-journal-photo-open.png');")
rep("getAttribute('data-journal-page')==='2','photo return preserves journal page 2'", "getAttribute('data-journal-page')===(allCorrect?'1':'2'),'photo return preserves the actual journal page'")
needle="const invitationResources=await resources(p),invitationIngredients="
branch="""if(allCorrect){
   const absent=async()=>{const text=await p.locator('.invitation-status').innerText();check(text==='這次沒有另留共享盤。'&&!/尚未邀|已邀|不再拿食材|邀請只取/.test(text),'all-correct journal does not invent a shared plate or invitation cost rule');check(await p.locator('#gatherInvite').count()===0&&await p.locator('.invitation-journal').count()===0,'all-correct journal has no invitation entry');check(await p.evaluate(()=>{const g=__farm.state().adventure.gathering;return g.servings.length===3&&g.servings.every(h=>h.matched)&&g.refills.length===0&&!g.invitation;}),'all-correct absence matches the real three-serving state');};
   await absent();const ingredientBefore=await p.evaluate(()=>AdventureAPI.basketFlavors(__farm.state(),Date.now()).flatMap(f=>f.requirements.map(r=>({source:r.source,id:r.id,current:r.current}))));const beforeReload=JSON.parse(await resources(p));await p.reload();await ready(p);await baskets(p);await p.locator('#readNeighbor').click();await p.locator('#gatheringEntry').click();await absent();await controls(p,'all-correct reloaded journal');const ingredientAfter=await p.evaluate(()=>AdventureAPI.basketFlavors(__farm.state(),Date.now()).flatMap(f=>f.requirements.map(r=>({source:r.source,id:r.id,current:r.current}))));const afterReload=JSON.parse(await resources(p));report.noSharedAudit={before:beforeReload,afterReload,ingredientBefore,ingredientAfter,positiveInventoryChanges:Object.entries(afterReload.items).filter(([id,n])=>n>(beforeReload.items[id]||0))};check(require('node:util').isDeepStrictEqual(ingredientBefore,ingredientAfter)&&Object.entries(beforeReload.items).every(([id,n])=>(afterReload.items[id]||0)>=n),'no-shared journal reload never spends ingredients or other inventory');await snap(p,'phone-journal-no-shared-reloaded.png');fs.writeFileSync(path.join(OUT,'no-shared-reloaded-save.json'),JSON.stringify(await p.evaluate(()=>__farm.state()),null,2));return;
  }
  """
rep(needle,branch+needle)
rep("await p.locator('#gatherInvite').click();await p.locator('[data-invite=child]').click();", "await p.locator('#gatherInvite').click();await controls(p,'shared invitation choices');await p.locator('[data-invite=child]').click();")
rep("{delivery,fishing,serving,invitations,layouts,stores,offline}[only]", "{delivery,fishing,serving,'serving-correct':()=>serving(true),invitations,layouts,stores,offline}[only]")
p.write_text(s,encoding='utf-8')
p=R/'scripts/test-content-r22-e2e.js';s=p.read_text(encoding='utf-8');old=" {mode:'serving',views:[[430,932]]},";assert old in s;s=s.replace(old," {mode:'serving',views:[[320,568],[430,932],[844,390],[1366,600]]},\n {mode:'serving-correct',views:[[320,568],[430,932],[844,390],[1366,600]]},");p.write_text(s,encoding='utf-8')
print('R22 real all-correct and shared-invitation serving matrices registered')
