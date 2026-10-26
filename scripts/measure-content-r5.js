/* Shared-host reference only; raw rAF retained, no flags or renderer reductions. */
'use strict';
const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const {ROOT,serve}=require('./r85-browser-helper'),S=require('../src/state'),A=require('../src/adventure');
const OUT=path.join(ROOT,'docs/content/r5');fs.mkdirSync(OUT,{recursive:true});
const report={status:'EXECUTED',trust:'Concurrent shared host, not clean machine or physical mobile. Raw reference samples only, all visual layers enabled.',protocol:'Fresh headless Chromium/DPR1 per run. Original R79 fresh-save + worldBegin, six crops and16s sunlight,800ms warmup; pond three chapter-one claims/restored dock,4200ms warmup/recast.4s raw rAF, discard first5,ceil(n*.95)-1. No performance flags or visual changes.',samples:[]};
(async()=>{const {server,origin}=await serve();try{
 for(const scene of ['sunpatch','pond'])for(const v of [{w:1366,h:768},{w:390,h:844,mobile:true}])for(let run=1;run<=3;run++){
  const browser=await chromium.launch({headless:true});try{
   const ctx=await browser.newContext({viewport:{width:v.w,height:v.h},deviceScaleFactor:1,isMobile:!!v.mobile,hasTouch:!!v.mobile,serviceWorkers:'block'});
   if(scene==='pond'){const s=S.defaultState(Date.now());A.ensure(s,Date.now());for(const id of ['c1_homecoming','c1_first_harvest','c1_first_meal'])s.adventure.claimed[id]=true;s.adventure.projects.fishing_dock.restored=true;s.adventure.welcomeSeen=true;s.settings.offlineSummary=false;await ctx.addInitScript(s=>localStorage.setItem('pixel_idle_farm_save_v1',JSON.stringify(s)),s);}
   const page=await ctx.newPage();await page.goto(origin);await page.waitForFunction(()=>window.__farm&&Atlas.isReady()&&!document.querySelector('#startupLoading'));
   if(scene==='sunpatch'){
    await page.evaluate(()=>{document.querySelector('#worldBegin')?.click();const s=__farm.state(),t=Date.now();for(let i=0;i<6;i++)plant(s,i,'wheat',t-i*2000);s.sun={plots:[0,1],used:[],startsAt:t,endsAt:t+16000,nextAt:t+60000,introduced:true};__farm.refresh();__farm.sunTick();});await page.waitForTimeout(800);
   }else{await page.evaluate(()=>FarmWorld.visitSite('fishing_dock'));await page.locator('#worldCatch').waitFor();await page.waitForTimeout(4200);await page.locator('#worldCatch').click();await page.waitForTimeout(180);}
   const raw=await page.evaluate(()=>new Promise(resolve=>{const xs=[];let last=performance.now(),end=last+4000;function frame(t){xs.push({at:t,dt:t-last});last=t;if(t<end)requestAnimationFrame(frame);else resolve(xs);}requestAnimationFrame(frame);}));
   const sorted=raw.slice(5).map(x=>x.dt).sort((a,b)=>a-b),p95=+sorted[Math.ceil(sorted.length*.95)-1].toFixed(2);
   const screenshot=`docs/content/r5/${v.mobile?'phone':'desktop'}-performance-${scene}-run-${run}.png`;await page.screenshot({path:path.join(ROOT,screenshot)});
   report.samples.push({scene,viewport:`${v.w}x${v.h}`,isPhysicalDevice:false,run,p95Ms:p95,chromium:browser.version(),at:new Date().toISOString(),screenshot,rawRaf:raw});console.log(scene,v.w,run,p95);await ctx.close();
  }finally{await browser.close();}
 }
 report.status='VERIFIED';report.referenceGate=report.samples.every(x=>x.p95Ms<=18)?'VERIFIED':'BLOCKED';report.physicalAndCleanMachineGate='BLOCKED';
}catch(e){report.status='BLOCKED';report.error=e.stack;process.exitCode=1;}finally{await new Promise(r=>server.close(r));fs.writeFileSync(path.join(OUT,'performance-reference.json'),JSON.stringify(report,null,2)+'\n');}})();
