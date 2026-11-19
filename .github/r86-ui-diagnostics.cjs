'use strict';
const fs = require('node:fs');
const out = process.env.RUNNER_TEMP;
const {chromium}=require('playwright');
async function collect(page){
 try {
  const state=await page.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(Math.round)};
   const visible=e=>!!e.getBoundingClientRect().height && getComputedStyle(e).visibility!=='hidden';
   return {url:location.pathname,size:[innerWidth,innerHeight],modal:[...document.querySelectorAll('.modal.show,#worldDialogue:not([hidden]),.r76b-dialogue')].filter(visible).map(e=>[e.id,e.className,e.innerText.slice(0,800)]),panel:document.querySelector('.side-panel')?.className,menu:document.querySelector('#farmMenu')?.hidden,
    basket:[...document.querySelectorAll('#worldNeighborButton,#sendNeighbor,#gatheringEntry,#backToFarm')].map(b=>{let steps=[];for(let e=b;e;e=e.parentElement)steps.push([e.tagName,e.id,e.className,e.hidden,getComputedStyle(e).display,rect(e)]);return steps}),
    choices:[...document.querySelectorAll('button:not([disabled])')].filter(visible).map(e=>[e.id,e.textContent.trim().slice(0,55)]).slice(0,125),
    farm:window.__farm?{activeTab:window.__farm.activeTab?.(),player:window.__farm.state().player,quest:document.querySelector('#questDock')?.dataset.quest}:null};
  }); fs.writeFileSync(out+'/result/last-page.json', JSON.stringify(state,null,2));
 } catch {}
}
const launch=chromium.launch.bind(chromium);
chromium.launch=async opts=>{
 const b=await launch(opts);
 const nc=b.newContext.bind(b);
 b.newContext=async (...a)=>{const c=await nc(...a);const close=c.close.bind(c);c.close=async(...arg)=>{await Promise.all(c.pages().map(collect));return close(...arg)};return c;};
 const close=b.close.bind(b);b.close=async(...arg)=>{await Promise.all(b.contexts().flatMap(c=>c.pages()).map(collect));return close(...arg)};return b;
};
