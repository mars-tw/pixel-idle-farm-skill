/* Same host, alternating git snapshots, fresh headless browser per 4-second rAF sample. */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require('playwright'),S=require('../src/state'),A=require('../src/adventure');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'docs/content/r2');fs.mkdirSync(OUT,{recursive:true});
const originalFarm=process.argv.includes('--sunpatch-original');
const completeFixture=process.argv.includes('--complete-fixture');
const labels=process.argv.includes('--before')?['art8','r1']:originalFarm?['art8','current']:['art8','r1','current'];
const scene=process.argv.includes('--sunpatch')||originalFarm?'sunpatch':'pond';
const roots={art8:path.join(ROOT,'.audit-tmp/perf-art8'),r1:path.join(ROOT,'.audit-tmp/perf-r1'),current:ROOT};
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json','.ogg':'audio/ogg','.m4a':'audio/mp4'};
const report={status:'EXECUTED',startedAt:new Date().toISOString(),trust:'shared concurrent host; not a clean-machine or physical-device result',commits:{art8:'06d7555',r1:'86621cc',current:'working tree'},nodeVersion:process.version,sourceHashes:Object.fromEntries(['src/content-r1.js','src/content-r1.css','src/adventure.js','src/ui.js'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex')])),protocol:'fresh unflagged headless Chromium per sample; DPR1; 4.2s warmup; live recast where supported; 180ms settle; 4s raw rAF, discard first5, ceil(n*.95)-1; interleaved revisions; no renderer reductions',samples:[]};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),parts=decodeURIComponent(u.pathname).split('/').filter(Boolean),label=parts.shift(),root=roots[label];if(!root)return res.writeHead(404).end();const f=path.resolve(root,parts.join('/')||'index.html');if(path.relative(root,f).startsWith('..')||!fs.existsSync(f)||fs.statSync(f).isDirectory())return res.writeHead(404).end();res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 for(const view of [{w:1366,h:768},{w:390,h:844,mobile:true}])for(let run=0;run<3;run++)for(const label of (run%2?labels.slice().reverse():labels)){
  const browser=await chromium.launch({headless:true});try{const ctx=await browser.newContext({viewport:{width:view.w,height:view.h},isMobile:!!view.mobile,hasTouch:!!view.mobile,serviceWorkers:'block'}),page=await ctx.newPage();
   const s=S.defaultState(Date.now());A.ensure(s,Date.now());s.adventure.claimed.c1_first_harvest=true;if(completeFixture)for(const id of ['c1_homecoming','c1_first_harvest','c1_first_meal'])s.adventure.claimed[id]=true;s.adventure.projects.fishing_dock.restored=true;s.adventure.welcomeSeen=true;s.settings.offlineSummary=false;
   if(!originalFarm)await ctx.addInitScript(s=>localStorage.setItem('pixel_idle_farm_save_v1',JSON.stringify(s)),s);await page.goto(`http://127.0.0.1:${server.address().port}/${label}/`);await page.waitForFunction(()=>window.__farm&&Atlas.isReady()&&!document.querySelector('#startupLoading'));
   if(originalFarm)await page.evaluate(()=>{const b=document.querySelector('#worldBegin');if(b)b.click();});
   if(scene==='pond'){
    await page.evaluate(()=>FarmWorld.visitSite('fishing_dock'));await page.locator('#worldCatch').waitFor({state:'visible'});await page.waitForTimeout(4200);
    if(await page.evaluate(()=>!!window.ContentR1)){await page.locator('#worldCatch').click();await page.waitForFunction(()=>document.querySelector('#worldCatch').textContent==='重新拋竿');await page.locator('#worldCatch').click();}
    await page.waitForTimeout(180);
   }else{
    await page.evaluate(()=>{const s=__farm.state();for(let i=0;i<6;i++)plant(s,i,'wheat',Date.now()-i*2000);s.sun={plots:[0,1],used:[],startsAt:Date.now(),endsAt:Date.now()+16000,nextAt:Date.now()+60000,introduced:true};__farm.refresh();__farm.sunTick();});await page.waitForTimeout(800);
   }
   const raw=await page.evaluate(()=>new Promise(resolve=>{const frames=[];let last=performance.now(),end=last+4000;function f(t){frames.push(t-last);last=t;if(t<end)requestAnimationFrame(f);else resolve(frames);}requestAnimationFrame(f);}));const sorted=raw.slice(5).sort((a,b)=>a-b),p95=+sorted[Math.ceil(sorted.length*.95)-1].toFixed(2);
   const renderer=await page.evaluate(()=>({tier:document.documentElement.dataset.performanceTier,mode:document.documentElement.dataset.performanceMode,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio}));
   report.samples.push({label,viewport:`${view.w}x${view.h}`,run:run+1,at:new Date().toISOString(),chromiumVersion:browser.version(),renderer,p95Ms:p95,rawRafMs:raw});console.log(label,view.w,run+1,p95);await ctx.close();
  }finally{await browser.close();}
 }
 report.summary={};for(const label of labels)for(const v of ['1366x768','390x844']){const xs=report.samples.filter(x=>x.label===label&&x.viewport===v).map(x=>x.p95Ms);report.summary[label+'-'+v]={runsP95Ms:xs,medianP95Ms:xs.slice().sort((a,b)=>a-b)[1],allThreeWithin18:xs.every(x=>x<=18)};}
 report.status='VERIFIED';if(!process.argv.includes('--before')){const current=report.samples.filter(x=>x.label==='current');report.performanceGate=current.every(x=>x.p95Ms<=18)?'VERIFIED':'BLOCKED';assert(current.every(x=>x.p95Ms<=18),'Every current desktop/mobile p95 must be <=18ms');}
 }catch(e){report.status='BLOCKED';report.error=e.stack;process.exitCode=1;}finally{report.scene=scene;report.fixture=originalFarm?'original R79 fresh save, no injection':completeFixture?'all three chapter-one claims and restored dock; matches R1 session prerequisites':'diagnostic partial fixture: only c1_first_harvest claimed and restored dock; not earned or complete chapter one';if(scene==='sunpatch')report.protocol='R79 sunpatch sampling: plant6 plus16s sun/ambient on; fresh unflagged headless browser per sample; DPR1;800ms warmup;4s raw rAF;discard5;ceil(n*.95)-1;interleaved revisions; '+(originalFarm?'exact original fresh-save/#worldBegin setup, no chapter/dock fixture':'common diagnostic chapter/dock fixture, differs from original R79 fresh save');report.endedAt=new Date().toISOString();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(OUT,originalFarm?'performance-sunpatch-original-comparison.json':completeFixture?'performance-complete-fixture-comparison.json':scene==='sunpatch'?'performance-sunpatch-comparison.json':process.argv.includes('--before')?'performance-before.json':'performance-comparison.json'),JSON.stringify(report,null,2)+'\n');}})();
