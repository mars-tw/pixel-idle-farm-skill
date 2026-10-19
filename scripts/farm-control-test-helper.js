/* Follow the same visible menu/dialogue steps as a player; never force a click. */
async function revealFarmControl(page, locator) {
  const inMenu=await locator.evaluate(e=>!!e.closest('#farmMenu')).catch(()=>false);
  const inDock=await locator.evaluate(e=>!!e.closest('#farmDock')).catch(()=>false);
  if(inMenu||inDock) {
    const close=page.locator('#worldDialogue:not([hidden]) button');
    if(await close.isVisible())await close.click();
  }
  if(inMenu && await page.locator('#farmMenu').isHidden())await page.locator('#farmMore').click();
  return locator;
}
module.exports={revealFarmControl};
