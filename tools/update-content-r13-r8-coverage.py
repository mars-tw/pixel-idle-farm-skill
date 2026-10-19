from pathlib import Path
p=Path(__file__).resolve().parents[1]/'scripts/test-content-r8-e2e.js'
s=p.read_text(encoding='utf-8');needle="await p.locator('#gatherReview').waitFor();await snap(p,'phone-gathering-complete.png');"
assert needle in s
replacement="""await p.locator('#gatherReview').waitFor();
 // R13 requires an actual dish before a seated guest may eat. Preserve all
 // three-frame animation/feet assertions below after three real UI servings.
 for(const[id,taste]of people){await p.locator(`[data-serve-person="${id}"]`).click();await p.locator(`[data-serve-taste="${taste}"]`).click();await p.locator('#gatherSip').click();await p.locator('[data-serving-phase=reply]').waitFor();await p.locator('#gatherContinue').click();}
 check(await p.evaluate(()=>__farm.state().adventure.gathering.servings.filter(h=>h.matched).length===3),'all three guests actually served before eating animation coverage');await snap(p,'phone-gathering-complete.png');"""
s=s.replace(needle,replacement);p.write_text(s,encoding='utf-8');print('PREPARED R8 actual-service precondition, all old animation assertions retained')
