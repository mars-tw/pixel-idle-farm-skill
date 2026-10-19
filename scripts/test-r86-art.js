/* R86 five acceptance criteria. Fixtures are labeled, never earned-play claims. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require('playwright'),{ROOT,serve}=require('./r85-browser-helper');
const OUT=path.join(ROOT,'docs/evidence/r86-art');let checks=0;const rows=[],errors=[];
const check=(v,n)=>{assert.ok(v,n);checks++;console.log('PASS '+n);};
async function shot(page,name){await page.locator('img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));await page.screenshot({path:path.join(OUT,name+'.png')});}
async function geometry(page){return page.evaluate(()=>{
 const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right};};
 const ids=['.daily-heading','.journal-links','#dailyBody','#dailyFooter','#dailyClose'];
 const nodes=ids.map(s=>document.querySelector(s));const card=box(document.querySelector('.daily-modal-card'));
 return{card,parts:nodes.map((e,i)=>({id:ids[i],...box(e)})),overflow:document.querySelector('#dailyBody').scrollHeight-document.querySelector('#dailyBody').clientHeight,
 controls:[...document.querySelectorAll('#dailyModal button')].filter(e=>e.getClientRects().length&&!e.disabled).map(e=>{const b=box(e),hit=document.elementFromPoint(b.x+b.w/2,b.y+b.h/2);return{id:e.id||e.dataset.claimTask||e.dataset.selectTask,w:b.w,h:b.h,hit:hit===e||e.contains(hit),inView:b.x>=0&&b.y>=0&&b.r<=innerWidth+1&&b.b<=innerHeight+1};}),
 binding:getComputedStyle(document.querySelector('.daily-modal-card'),'::before').width,
 questHidden:getComputedStyle(document.querySelector('#questDock')).visibility==='hidden',
 footer:document.querySelector('#dailyFooter').textContent};});}
async function run(){
 fs.mkdirSync(OUT,{recursive:true});const m=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/generated/r86/manifest.json'),'utf8'));
 check(m.masters.length===8&&m.records.length===19&&m.generator==='image_gen.imagegen'&&m.actualModelSlug===null,'8 generated masters, 19 runtime images; actual tool recorded');
 for(const r of [...m.masters,...m.records])check(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,r.path))).digest('hex')===r.sha256,'source and output hash '+r.path);
 for(const name of ['walk.png','actions.png','farming-actions.png','miri-0.png','miri-1.png','miri-2.png'])check(m.qualityMetrics['assets/generated/r86/'+name].gatePass,'character double gate '+name);
 for(const r of m.frameReceipts)check(new Set(r.hashes).size===6&&r.alphaDifferences.some(x=>x>.015)&&r.lowerBodyChangedFraction>.005,`${r.sheet} row ${r.row} six genuine changing poses`);
 const{server,origin}=await serve();let browser,success=false;
 try{
 browser=await chromium.launch({headless:true});
 for(const [w,h,scale,platform] of [[390,844,1,'phone'],[320,568,1,'small'],[844,390,1,'landscape'],[1032,1376,2,'ipad'],[1366,600,1,'laptop'],[430,932,3,'iphone']]){
  const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:scale,hasTouch:true,serviceWorkers:'block'});
  try{const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
   await page.goto(origin);await page.waitForFunction(()=>window.__farm&&!document.querySelector('#startupLoading'));await page.locator('#worldSunBegin').click();
   await page.evaluate(()=>{const s=__farm.state(),n=Date.now();for(let i=0;i<2;i++)s.plots[i]={cropId:'wheat',plantedAt:n-4500,wateredAt:0};s.sun={plots:[0],used:[],startsAt:n,endsAt:n+60000,nextAt:n+90000,introduced:true};const a=s.map.tiles.find(t=>t.plotIndex===0),b=s.map.tiles.find(t=>t.plotIndex===1);s.player.tileId=a.id;s.player.facing='right';__farm.refresh();__farm.sunTick();__farm.focusTile(b.id);});
   await page.waitForTimeout(600);
   const scene=await page.evaluate(()=>{const s=__farm.state(),cs=[...document.querySelectorAll('.ob[data-kind="crop"]')],p=document.querySelector('#player'),beam=document.querySelector('.sun-beam'),b=beam.getBoundingClientRect(),v=p.getBoundingClientRect();return{sameAge:s.plots[0].plantedAt===s.plots[1].plantedAt,stages:s.plots.slice(0,2).map(c=>getCropProgress(s,c,Date.now()).stage),crops:cs.map(e=>({lit:e.classList.contains('sunlit-crop'),frame:e.dataset.frame,filter:getComputedStyle(e).filter,transform:getComputedStyle(e).transform})),heroLit:p.classList.contains('sunlit-player'),physicsUnchanged:s.player.tileId===p.dataset.tileId,heroSize:[v.width,v.height],beam:{x:b.x,y:b.y,w:b.width,h:b.height,bg:getComputedStyle(beam,'::before').backgroundImage,opacity:getComputedStyle(beam).opacity},shadow:getComputedStyle(document.querySelector('.canopy-shadow')).backgroundImage,sprite:getComputedStyle(document.querySelector('#playerSprite')).backgroundImage};});
   check(scene.sameAge&&scene.stages[0]===scene.stages[1]&&scene.crops[0].frame===scene.crops[1].frame&&scene.crops[0].lit&&!scene.crops[1].lit,`${w}x${h} exact same-age wheat fixture, lit/unlit same stage`);
   check(scene.beam.bg.includes('r89/leaf-light')&&scene.shadow.includes('r89/canopy-shadow')&&scene.heroLit&&scene.sprite.includes('r89/walk'),`${w}x${h} generated directional lighting and matching sunlit hero`);
   check(scene.physicsUnchanged&&scene.heroSize[0]>=40,`${w}x${h} readable visual and separate physics`);
   await shot(page,`${w}x${h}-same-age`);
   if(platform==='iphone'||platform==='ipad')fs.copyFileSync(path.join(OUT,`${w}x${h}-same-age.png`),path.join(ROOT,'docs/store/screenshots',platform+'-06-same-age.png'));
   if(w===390||platform==='iphone'||platform==='ipad'){
    const hide=await page.addStyleTag({content:'.seed-hud,.scene-action-bar,#farmDock{display:none!important}header,header *,#questDock,#seedHud,#seedHud *,#worldDialogue,#farmDock,#farmDock *,#mobileControls,#mobileControls *,#sceneActionBar,#toast-zone,.world-location{visibility:hidden!important}'});await shot(page,`${w}x${h}-no-text`);await hide.evaluate(e=>e.remove());
   }
   await page.locator('#dailyOpen').click();
   const album=await geometry(page);
   check(album.controls.every(c=>c.w>=44&&c.h>=44&&c.hit&&c.inView),`${w}x${h} album controls at least44px and hit reachable`);
   check(album.parts.every((p,i,a)=>!i||p.y>=a[i-1].b-1)&&album.binding==='8px'&&album.questHidden,`${w}x${h} separate rows, binding clipped, background chapter hidden`);
   if(h>750)check(album.overflow<=1,`${w}x${h} whole portrait album requires no scroll`);
   await page.evaluate(()=>{const s=__farm.state();FarmDaily.ensure(s,Date.now());s.daily.water=3;s.daily.harvest=8;s.storage.items.wheat=2;DailyUI.refresh(s);});
   for(const id of ['water','harvest','basket'])await page.locator(`[data-claim-task="${id}"]`).click();
   const seals=await page.locator('.chore-stamp').evaluateAll(es=>es.map(e=>({src:e.src,alt:e.alt,filter:getComputedStyle(e).filter,opacity:getComputedStyle(e).opacity})));
   check(seals.length===3&&new Set(seals.map(s=>s.src)).size===3&&seals.every(s=>s.filter==='none'),`${w}x${h} three distinct red-ink stamps after claim`);
   check((await page.locator('.daily-kicker').first().innerText()).startsWith('今日 3/3'),`${w}x${h} only one daily completion count, today3/3`);
   await shot(page,`${w}x${h}-daily`);await page.locator('#dailyHeirloom').click();
   const basket=await geometry(page);
   check(basket.controls.every(c=>c.w>=44&&c.h>=44&&c.hit&&c.inView),`${w}x${h} basket controls reachable`);
   check(basket.parts.every((p,i,a)=>!i||p.y>=a[i-1].b-1)&&basket.footer.length>20,`${w}x${h} basket note and footer not overlapped`);
   await shot(page,`${w}x${h}-basket`);rows.push({w,h,scale,platform,fixture:true,scene,album,basket,seals});
  }finally{await ctx.close();}
 }
 check(errors.length===0,'no browser errors or missing artwork');success=true;
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(OUT,'art-validation.json'),JSON.stringify({status:success?'VERIFIED':'BLOCKED',checks,rows,errors,fixtureNote:'Exact planting-time comparison is explicitly a visual QA fixture, not earned play. Store main journey is separate real input.',unperformed:['independent Muse rescore','human timed recognition','native device']},null,2));}
 console.log('VERIFIED R86 '+checks+' checks, browser closed');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
