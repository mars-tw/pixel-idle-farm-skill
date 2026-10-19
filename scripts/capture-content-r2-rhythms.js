/* Supplement: show the return BETWEEN the carp's two taps, using real elapsed time. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright'),{ROOT,serve}=require('./r85-browser-helper');
const S=require('../src/state'),A=require('../src/adventure'),OUT=path.join(ROOT,'docs/content/r2');
(async()=>{const {server,origin}=await serve();let browser;const frames=[];try{browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:430,height:932},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const s=S.defaultState(Date.now());A.ensure(s,Date.now());s.adventure.projects.fishing_dock.restored=true;s.adventure.welcomeSeen=true;s.settings.offlineSummary=false;await ctx.addInitScript(s=>localStorage.setItem('pixel_idle_farm_save_v1',JSON.stringify(s)),s);const page=await ctx.newPage();await page.goto(origin);await page.waitForFunction(()=>window.ContentR1&&Atlas.isReady()&&!document.querySelector('#startupLoading'));
 await page.evaluate(()=>{const start=AdventureAPI.startFishing;AdventureAPI.startFishing=(s,t)=>start(s,t,()=>0);FarmWorld.visitSite('fishing_dock');});
 await page.locator('#worldCatch').waitFor({state:'visible'});
 for(const [phase,name]of [['1','tap-one'],['2','returned'],['3','tap-two'],['4','submerged']]){
  await page.waitForFunction(p=>document.querySelector('.pond-stage').dataset.phase===p,phase,{polling:'raf'});const before=await page.evaluate(()=>({at:Date.now(),phase:document.querySelector('.pond-stage').dataset.phase,pose:document.querySelector('.pond-stage').dataset.pose,transform:getComputedStyle(document.querySelector('.pond-bobber')).transform,cast:__farm.state().adventure.fishingCast}));
  const file=`phone-rhythm-carp-${name}.png`;await page.screenshot({path:path.join(OUT,file)});const after=await page.locator('.pond-stage').getAttribute('data-phase');assert.equal(after,phase,'screenshot must remain entirely within the intended real phase');frames.push({file:'docs/content/r2/'+file,...before});
 }
 assert.notEqual(frames[0].transform,frames[1].transform);assert.equal(frames[0].transform,frames[2].transform);assert.equal(frames[3].pose,'strike');await page.locator('#worldCatch').click();assert.equal(await page.evaluate(()=>__farm.state().adventure.catch.river_carp),1);await ctx.close();
 fs.writeFileSync(path.join(OUT,'carp-continuity.json'),JSON.stringify({status:'VERIFIED',clock:'real elapsed wall time; no freeze or time advance',frames,catch:1},null,2)+'\n');console.log('VERIFIED four consecutive real carp phases including return and actual catch');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
