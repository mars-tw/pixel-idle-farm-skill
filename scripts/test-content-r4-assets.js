/* New art must decode after a real offline reload and recover in-place after a failed request. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {ROOT,serve}=require('./r85-browser-helper'),{revealFarmControl}=require('./farm-control-test-helper');
const OUT=path.join(ROOT,'docs/content/r4');
async function run({browser,origin,earned}){
 const report={status:'EXECUTED',fixture:'Unmodified nine-delivery save earned by test-content-r4-e2e.js; no new progress granted.',checks:[],screenshots:[]};
 const check=(v,n)=>{assert(v,n);report.checks.push(n);console.log('PASS '+n);};
 const ready=p=>p.waitForFunction(()=>window.__farm&&ContentR1&&Atlas.isReady()&&!document.querySelector('#startupLoading'));
 async function session(sw){const c=await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:sw});await c.addInitScript(s=>{if(!sessionStorage.getItem('r4-art-earned')){localStorage.setItem('pixel_idle_farm_save_v1',JSON.stringify(s));sessionStorage.setItem('r4-art-earned','1');}},earned);const p=await c.newPage();await p.goto(origin+(sw==='allow'?'/?swtest':''));await ready(p);return{c,p};}
 async function basket(p){const tab=p.locator('[data-tab="story"]');await revealFarmControl(p,tab);await tab.click();await p.locator('#worldNeighborButton').click();await p.locator('#sendNeighbor').waitFor();}
 async function snap(p,name){const rel='docs/content/r4/'+name;await p.screenshot({path:path.join(ROOT,rel)});report.screenshots.push(rel);}
 try{
  const {c,p}=await session('allow');try{
   await p.waitForFunction(()=>!!navigator.serviceWorker.controller&&!!sessionStorage.getItem('pixelFarmPwaAutoReloaded')&&performance.getEntriesByType('navigation').some(n=>n.type==='reload'),null,{timeout:30000});
   await c.setOffline(true);await p.reload();await ready(p);await basket(p);
   check(await p.evaluate(()=>ContentR1.verifyArtwork()),'new packing art decodes after controlled offline reload');
   check((await p.locator('.content-illustration').getAttribute('src')).includes('content-r4/basket.webp'),'offline normal basket entry uses the new packing image');await snap(p,'phone-basket-offline.png');
   await p.locator('[data-neighbor="child"]').click();await p.locator('#readNeighbor').click();
   check(await p.evaluate(()=>ContentR1.verifyArtwork()),'new pressed-flower scene decodes offline');
   check((await p.locator('.content-illustration').getAttribute('src')).includes('content-r8/token-child.png')&&await p.locator('.content-illustration').evaluate(e=>e.naturalWidth===64&&e.naturalHeight===64),'offline matched story uses the exact R8 native flower-chair illustration');
  }finally{await c.close();}
  const failing=await session('block');try{const{p}=failing;
   const before=await p.evaluate(()=>JSON.stringify({bread:__farm.state().adventure.meals,neighbors:__farm.state().adventure.neighbors}));
   await p.route('**/content-r4/basket.webp*',r=>r.abort());await basket(p);await p.locator('.art-load-status [role="alert"]').waitFor();
   const error=await p.evaluate(async()=>{try{await ContentR1.verifyArtwork();return '';}catch(e){return e.message;}});
   check(error.includes('basket.webp')&&!/webp|assets\//.test(await p.locator('#worldModal').innerText()),'packing fallback retains diagnostics without exposing filenames');await snap(p,'phone-art-basket-missing.png');
   await p.unroute('**/content-r4/basket.webp*');await p.locator('.retry-art').click();await p.waitForFunction(()=>document.querySelector('.content-illustration').dataset.artState==='loaded');
   check(await p.evaluate(()=>ContentR1.verifyArtwork()),'packing illustration recovers in the same page');await snap(p,'phone-art-basket-restored.png');
   check(await p.evaluate(()=>JSON.stringify({bread:__farm.state().adventure.meals,neighbors:__farm.state().adventure.neighbors}))===before,'missing and retried art never spends food or changes memories');
  }finally{await failing.c.close();}
  report.status='VERIFIED';
 }catch(e){report.status='BLOCKED';report.failure=e.stack;throw e;}
 finally{fs.writeFileSync(path.join(OUT,'art-checks.json'),JSON.stringify(report,null,2)+'\n');}
 return report;
}
module.exports={run};
if(require.main===module)(async()=>{const {chromium}=require('playwright'),{server,origin}=await serve();let browser;try{browser=await chromium.launch({headless:true});await run({browser,origin,earned:JSON.parse(fs.readFileSync(path.join(OUT,'earned-neighbors.json'),'utf8'))});}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
