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
async function openNeighborBaskets(page) {
  const pane = page.locator('.side-panel.world-panel-open [data-pane="story"].sel');
  if (!await pane.isVisible()) {
    const tab = page.locator('[data-tab="story"]');
    await revealFarmControl(page, tab);
    await tab.click();
  }
  const basket = page.locator('#worldNeighborButton');
  await basket.waitFor({state: 'attached'});
  const later = page.locator('[data-r81c-later]').filter({has: basket});
  if (await later.count()) {
    const toggle = later.locator('button[aria-controls="r81cLaterBody"]');
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  }
  await basket.click();
  await page.locator('#sendNeighbor').waitFor({state: 'visible'});
}
module.exports = {revealFarmControl, openNeighborBaskets};
