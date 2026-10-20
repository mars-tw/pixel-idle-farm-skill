'use strict';
const assert=require('node:assert/strict');
async function pickServingPerson(page,button){
 if(await page.locator('.gather-extras').isVisible())await page.locator('#gatherReturn').click();
 if(!await button.isVisible()&&await page.locator('#gatherChoosePerson').isVisible())await page.locator('#gatherChoosePerson').click();
 await button.click();
}
async function pickServingTaste(page,button){
 if(!await button.isVisible())await page.locator('.other-foods summary').click();
 await button.click();
}
async function refillServing(page,button){
 if(!await button.isVisible())await page.locator('#gatherSupplies').click();
 await button.click();
}
async function exactServingProgress(page,servings,guests){
 const r=await page.locator('.gather-progress').evaluate(e=>({text:e.textContent,servings:Number(e.dataset.servings),guests:Number(e.dataset.guests)}));
 assert.equal(r.servings,servings);assert.equal(r.guests,guests);
 const expected=guests===3?'三位都吃到了，謝謝這個下午。':guests===0?'還差蘿拉、班伯、圖圖':null;
 if(expected)assert.equal(r.text,expected);
 return true;
}
module.exports={pickServingPerson,pickServingTaste,refillServing,exactServingProgress};
