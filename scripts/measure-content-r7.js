/* Shared host reference only: three desktop/mobile real-clock rAF samples. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const {ROOT,serve}=require('./r85-browser-helper');
const OUT=path.join(ROOT,'docs/content/r7');
const report={status:'EXECUTED',trust:'Shared host with other game lanes. Reference only; clean host and physical device performance remain BLOCKED.',protocol:'Fresh context per run; default renderer, DPR1; 800ms warmup; 4s real rAF, discard first5; ceil(n*.95)-1; desktop/mobile x3; earned R7 completed save, no invented rewards',samples:[]};
(async()=>{let browser,server;try{
 const s=await serve();server=s.server;browser=await chromium.launch({headless:true});
 const earned=JSON.parse(fs.readFileSync(path.join(OUT,'completed-save.json')));
 for(let run=1;run<=3;run++)for(const v of [{w:1366,h:768},{w:390,h:844}]){
  const ctx=await browser.newContext({viewport:{width:v.w,height:v.h},deviceScaleFactor:1,isMobile:v.w<700,hasTouch:v.w<700,serviceWorkers:'block'});
  try{await ctx.addInitScript(state=>localStorage.setItem('pixel_idle_farm_save_v1',JSON.stringify(state)),earned);
   const p=await ctx.newPage();await p.goto(s.origin);await p.waitForFunction(()=>window.__farm&&window.ContentR6&&Atlas.isReady()&&!document.querySelector('#startupLoading'));
   await p.evaluate(()=>{__farm.focusTile('t7_8');document.body.dataset.reunion='true';});await p.waitForTimeout(800);
   const raw=await p.evaluate(()=>new Promise(resolve=>{const frames=[];let last=performance.now(),end=last+4000;function sample(t){frames.push(t-last);last=t;if(t<end)requestAnimationFrame(sample);else resolve(frames);}requestAnimationFrame(sample);}));
   const sorted=raw.slice(5).sort((a,b)=>a-b),p95=+sorted[Math.ceil(sorted.length*.95)-1].toFixed(2);
   report.samples.push({run,viewport:`${v.w}x${v.h}`,p95Ms:p95,rawRafMs:raw,renderer:await p.evaluate(()=>({tier:document.documentElement.dataset.performanceTier,mode:document.documentElement.dataset.performanceMode,dpr:devicePixelRatio})),chromium:browser.version()});
   console.log(v.w,run,p95);
  }finally{await ctx.close();}
 }
 report.summary=Object.fromEntries(['1366x768','390x844'].map(v=>{const runs=report.samples.filter(s=>s.viewport===v).map(s=>s.p95Ms),median=runs.slice().sort((a,b)=>a-b)[1];return[v,{runsP95Ms:runs,medianP95Ms:median,within18:median<=18}];}));
 report.status=Object.values(report.summary).every(s=>s.within18)?'VERIFIED':'BLOCKED';if(report.status==='BLOCKED')process.exitCode=1;
}catch(e){report.status='BLOCKED';report.failure=e.stack;process.exitCode=1;}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(OUT,'performance-reference.json'),JSON.stringify(report,null,2)+'\n');}})();
