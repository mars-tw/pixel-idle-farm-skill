/* R5 actual UI journeys. No granted deliveries/catches, no clock changes. */
'use strict';
const {verifyWaterPixels}=require('./content-r8-water-test-helper');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{ROOT,serve}=require('./r85-browser-helper');
const {revealFarmControl}=require('./farm-control-test-helper');
const S=require('../src/state'),A=require('../src/adventure');
const OUT=path.join(ROOT,'docs/content/r5');fs.mkdirSync(OUT,{recursive:true});
const report={status:'EXECUTED',fixture:'Chapter1/dock unlocked; wheat20, carrot4, berries4 supplied. Ten breads cooked and nine gifts delivered via UI. Only fish RNG is fixed. Real clock, actual hit windows, full30s cooldown. Layout/offline/store sessions reuse this run earned saves.',checks:[],screenshots:[],frames:[],errors:[]};
const ids=['merchant','elder','child'], tastes={merchant:'sour',elder:'hot',child:'sweet'};
let browser,server,origin,earned;const firstSaves={},matchedSaves={},fishSaves={};
function check(v,n){assert(v,n);report.checks.push(n);console.log('PASS '+n);}
function fixture(){const s=S.defaultState(Date.now());A.ensure(s,Date.now());for(const id of ['c1_homecoming','c1_first_harvest','c1_first_meal'])s.adventure.claimed[id]=true;s.adventure.projects.fishing_dock.restored=true;s.adventure.welcomeSeen=true;s.storage.items={wheat:20,carrot:4,wild_berry:4};s.settings.offlineSummary=false;s.settings.thumbFarmMode='direct';return s;}
async function ready(page){await page.waitForFunction(()=>window.__farm&&window.ContentR1&&Atlas.isReady()&&!document.querySelector('#startupLoading'));await page.evaluate(()=>window.MOVE_MS=30);}
async function session(view={w:430,h:932},state=fixture(),sw='block'){
 const ctx=await browser.newContext({viewport:{width:view.w,height:view.h},deviceScaleFactor:view.dpr||1,isMobile:!!(view.w<700),hasTouch:true,serviceWorkers:sw});
 await ctx.addInitScript(s=>{if(!sessionStorage.getItem('r5-earned')){localStorage.setItem('pixel_idle_farm_save_v1',JSON.stringify(s));sessionStorage.setItem('r5-earned','1');}},state);
 const page=await ctx.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(origin+(sw==='allow'?'/?swtest':''));await ready(page);return{ctx,page};
}
async function snap(page,name,store=false){
 if(await page.locator('#worldModal.show img.content-illustration').count())await page.evaluate(()=>ContentR1.verifyArtwork());
 const rel=(store?'docs/store/screenshots/':'docs/content/r5/')+name;
 await page.screenshot({path:path.join(ROOT,rel),fullPage:false});report.screenshots.push(rel);
 report.frames.push({path:rel,at:Date.now(),state:await page.evaluate(()=>({resident:document.querySelector('#worldModal')?.dataset.resident,view:document.querySelector('#worldModal')?.dataset.contentView,phase:document.querySelector('.pond-stage')?.dataset.phase,pose:document.querySelector('.pond-stage')?.dataset.pose,cast:__farm.state().adventure.fishingCast,player:__farm.state().player,action:__farm.playerAction(),sprite:__farm.player().frame,bread:__farm.state().adventure.meals.rustic_bread,neighbors:__farm.state().adventure.neighbors,catch:__farm.state().adventure.catch}))});
}
async function baskets(page){const t=page.locator('[data-tab="story"]');await revealFarmControl(page,t);await t.click();await page.locator('#worldNeighborButton').click();await page.locator('#sendNeighbor').waitFor();}
async function send(page,id,taste){
 await page.locator(`[data-neighbor="${id}"]`).click();await page.locator(`[data-taste="${taste}"]`).click();
 const before=await page.evaluate(id=>({bread:__farm.state().adventure.meals.rustic_bread,count:__farm.state().adventure.neighbors[id].deliveries}),id);
 await page.locator('#sendNeighbor').click();await page.locator('#anotherBasket').waitFor();
 check(await page.evaluate(({id,b})=>__farm.state().adventure.meals.rustic_bread===b.bread-1&&__farm.state().adventure.neighbors[id].deliveries===b.count+1,{id,b:before}),id+' '+taste+' reaches resident and spends exactly one bread');
}
async function neighbors(){const{ctx,page}=await session();try{
 await baskets(page);
 for(let i=0;i<10;i++){await page.locator('#basketKitchen').click();const n=await page.evaluate(()=>__farm.state().adventure.meals.rustic_bread);await page.locator('[data-cook="rustic_bread"]').click();await page.waitForFunction(n=>__farm.state().adventure.meals.rustic_bread===n+1,n);await page.locator('#kitchenNeighbors').click();}
 for(const id of ids){
  if(id==='merchant'){
   await page.evaluate(()=>window.MOVE_MS=170);await page.locator('#sendNeighbor').click();await page.locator('.basket-carrying').waitFor();
   for(let k=1;k<=3;k++){await snap(page,`phone-basket-walking-${k}.png`);if(k<3)await page.waitForTimeout(140);}
   await page.locator('#anotherBasket').waitFor();await page.evaluate(()=>window.MOVE_MS=30);
  }else await send(page,id,'plain');
  await snap(page,`phone-story-${id}-first.png`);
  firstSaves[id]=await page.evaluate(()=>JSON.parse(JSON.stringify(__farm.state())));
  const first=await page.locator('.neighbor-reaction').textContent();
  await page.locator('#anotherBasket').click();await page.locator('#recallNeighbor').click();
  const recall=await page.locator('#worldModal').innerText();
  check(!/甜|酸|熱|胡蘿蔔|野莓|小麥|麥餅|果子|烤好|那根菜/.test(recall),id+' complete recall has no taste or ingredient answer');
  check(await page.locator('.npc-bubble:visible,#worldDialogue:visible').count()===0,id+' recall hides old farm speech');
  await snap(page,`phone-memory-${id}-recall.png`);await page.locator('#backToBasket').click();
  await send(page,id,tastes[id]==='sweet'?'sour':'sweet');
  check(await page.locator('#worldModal').getAttribute('data-matched')==='false'&&await page.locator('.neighbor-reaction').textContent()!==first,id+' wrong match has distinct feedback');
  await snap(page,`phone-memory-${id}-wrong.png`);await page.locator('#anotherBasket').click();
  await page.locator(`[data-taste="${tastes[id]}"]`).click();await snap(page,`phone-memory-${id}-choosing.png`);
  await send(page,id,tastes[id]);check(await page.locator('.story-occasion.matched').count()===1,id+' correct match adds bookmark');
  const objects=id==='merchant'?['秤','凳子']:id==='elder'?['魚竿','盤子']:['空椅子','花'];
  await page.locator('.memory-story summary').click();
  const story=await page.locator('.neighbor-story').innerText(),reaction=await page.locator('.neighbor-reaction').textContent();
  check(objects.every(x=>story.includes(x)&&reaction.includes(x)),id+' two recall objects return in story and matched response');
  await snap(page,`phone-memory-${id}-matched.png`);matchedSaves[id]=await page.evaluate(()=>JSON.parse(JSON.stringify(__farm.state())));
  await page.locator('#backToFarm').click();
  const resident=page.locator(`.ob[data-kind="npc"][data-npc="${id}"]`);await resident.tap();
  const talk=page.locator('[data-action="talk"]:visible').first();if(await talk.count())await talk.click();else await page.locator('#talkNpcBtn').click();
  await page.waitForFunction(({id,line})=>document.querySelector(`.npc-bubble[data-npc="${id}"] .nb-line`)?.textContent===line,{id,line:reaction});
  await snap(page,`phone-memory-${id}-farm-response.png`);await baskets(page);
 }
 await page.locator('.world-modal-close').click();await page.reload();await ready(page);
 check(await page.evaluate(()=>Object.values(__farm.state().adventure.neighbors).every(n=>n.deliveries===3&&n.lastMatched)),'all nine real gifts and matched memories survive reload');
 earned=await page.evaluate(()=>JSON.parse(JSON.stringify(__farm.state())));
 const walk=report.frames.filter(x=>/basket-walking/.test(x.path));check(new Set(walk.map(x=>x.state.sprite)).size>=2,'delivery uses distinct true sprite poses, not one translated picture');
}finally{await ctx.close();}}
async function footerChecks(page,tag){
 const b=await page.locator('.basket-footer button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);const lines=[...range.getClientRects()],hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id:e.id,w:r.width,h:r.height,visible:r.top>=0&&r.left>=0&&r.bottom<=innerHeight&&r.right<=innerWidth,hit:e===hit||e.contains(hit),lines:new Set(lines.map(x=>x.top)).size,unclipped:lines.every(x=>x.left>=r.left&&x.right<=r.right)&&e.scrollWidth<=e.clientWidth};}));
 check(b.length===4&&b.every(x=>x.h>=48&&x.w>=44&&x.visible&&x.hit&&x.unclipped&&x.lines<=(x.id==='sendNeighbor'?2:1)),tag+' all four footer controls >=48px, visible, hittable, complete text');
}
async function layouts(){for(const v of [{w:320,h:568},{w:430,h:932}])for(const id of ids){
 const{ctx,page}=await session(v,earned);try{
  await baskets(page);await page.locator(`[data-neighbor="${id}"]`).click();await page.locator('[data-taste="plain"]').click();
  await footerChecks(page,`${v.w} ${id}`);await snap(page,`phone-basket-${id}-${v.w}-top.png`);
  const text=await page.locator('#basketDescription').textContent();check(text.endsWith('但不會觸發口味配對。'),'plain description retains complete rule text '+id);
  await page.locator('#worldModal .modal-body').evaluate(e=>e.scrollTop=e.scrollHeight);
  const readable=await page.locator('#basketDescription').evaluate(e=>{const r=e.getBoundingClientRect(),p=e.closest('.modal-body').getBoundingClientRect();return r.top>=p.top-1&&r.bottom<=p.bottom+1&&e.scrollWidth<=e.clientWidth;});
  check(readable,`${v.w} ${id} full description visible at scroll bottom`);await snap(page,`phone-basket-${id}-${v.w}-bottom.png`);
  await page.locator('#recallNeighbor').click();await page.locator('#backToBasket').click();await page.locator('#readNeighbor').click();
  await snap(page,`phone-story-${id}-${v.w}-top.png`);await page.locator('#worldModal .modal-body').evaluate(e=>e.scrollTop=e.scrollHeight);await snap(page,`phone-story-${id}-${v.w}-bottom.png`);
  await page.locator('#anotherBasket').click();await page.locator('#basketKitchen').click();await page.locator('#kitchenNeighbors').click();
  await send(page,id,'plain');check(await page.locator('#anotherBasket').isVisible(),`${v.w} ${id} actual footer send completes`);
 }finally{await ctx.close();}
}
for(const v of [{w:844,h:390},{w:768,h:1024},{w:1366,h:600}]){
 const{ctx,page}=await session(v,earned);try{await baskets(page);await footerChecks(page,`${v.w}x${v.h}`);check(!/WASD|鍵盤|方向鍵/.test(await page.locator('#worldModal').innerText()),'no keyboard instructions '+v.w);await snap(page,`layout-basket-${v.w}x${v.h}.png`);await page.locator('#sendNeighbor').click();await page.locator('#anotherBasket').waitFor();}finally{await ctx.close();}
}}
async function fixedFish(page,roll){await page.evaluate(r=>{const start=AdventureAPI.startFishing;AdventureAPI.startFishing=(s,t)=>start(s,t,()=>r);},roll);}
async function phase(page,index){await page.waitForFunction(i=>document.querySelector('.pond-stage')?.dataset.phase===String(i),index,{polling:'raf'});}
async function stateCheck(page,learned,label){
 check(await page.locator('.pond-state').count()===0&&await page.locator('.world-fishing-result[role="status"]').count()===1,label+' single current status, no duplicate state line');
 if(learned)check(!/河鯉|銀鯽|溪鱸|輕點|橫拉|停得|浮回|忽然/.test(await page.locator('#worldModal').innerText()),label+' learned view hides fish and rhythm answers');
}
async function waterPair(page,id,name,index){
 await phase(page,index);const before=await page.locator('.pond-stage').getAttribute('data-phase');
 await snap(page,`phone-pond-${id}-${name}-original.png`);
 const mask=await page.addStyleTag({content:'#worldModal *{color:transparent!important;text-shadow:none!important}.farm-logo{visibility:hidden!important}'});
 await snap(page,`phone-pond-${id}-${name}-masked.png`);await mask.evaluate(e=>e.remove());
 const after=await page.locator('.pond-stage').getAttribute('data-phase');check(before===after,id+' '+name+' original/masked from same real phase');
 check(await verifyWaterPixels(page,id,name==='sinking'?2:id==='silver_dace'?0:1),id+' '+name+' exact R8 generated native RGBA water frame');
}
async function fish(){for(const [id,roll,pre,sink]of [['river_carp',0,2,4],['silver_dace',.5,0,1],['river_perch',.99,2,3]]){
 const{ctx,page}=await session();try{
  await fixedFish(page,roll);await page.evaluate(()=>FarmWorld.visitSite('fishing_dock'));await page.locator('#worldCatch').waitFor();
  await stateCheck(page,false,id+' waiting');await snap(page,`phone-pond-${id}-waiting.png`);
  await phase(page,pre);await stateCheck(page,false,id+' pre-sink');await snap(page,`phone-pond-${id}-pre-sink.png`);
  await phase(page,sink);await page.locator('#worldCatch').click();await page.waitForFunction(()=>document.querySelector('#worldModal').dataset.fishingState==='caught');
  await stateCheck(page,false,id+' ended');await snap(page,`phone-pond-${id}-ended.png`);const caughtAt=await page.evaluate(()=>__farm.state().adventure.lastFishAt);
  await page.locator('#worldFishNotes').click();await snap(page,`phone-pond-${id}-note.png`);await page.locator('.world-modal-close').click();await page.reload();await ready(page);
  check(await page.evaluate(id=>__farm.state().adventure.catch[id]===1&&__farm.state().adventure.fishNotes[id],id),id+' actual catch/note survives reload');
  await fixedFish(page,roll);await page.evaluate(()=>FarmWorld.visitSite('fishing_dock'));await page.locator('#worldCatch').waitFor();check(await page.locator('#worldCatch').isDisabled(),id+' reload retains cooldown');
  await page.waitForFunction(()=>!document.querySelector('#worldCatch').disabled,null,{timeout:35000});check(Date.now()-caughtAt>=30000,id+' full30s real cooldown');
  await page.locator('#worldCatch').click();await stateCheck(page,true,id+' learned waiting');await snap(page,`phone-pond-${id}-learned-waiting.png`);
  if(id==='silver_dace')await page.waitForTimeout(700);
  await waterPair(page,id,'pre-sink',pre);await stateCheck(page,true,id+' learned pre-sink');
  await waterPair(page,id,'sinking',sink);await stateCheck(page,true,id+' learned sinking');
  await page.locator('#worldCatch').click();check(await page.evaluate(id=>__farm.state().adventure.catch[id]===2,id),id+' second actual catch adds one fish');
  await snap(page,`phone-pond-${id}-learned-ended.png`);fishSaves[id]=await page.evaluate(()=>JSON.parse(JSON.stringify(__farm.state())));
 }finally{await ctx.close();}
}}
async function offline(){const{ctx,page}=await session(undefined,earned,'allow');try{
 await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?.active?.state==='activated';},null,{timeout:45000});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&!!sessionStorage.getItem('pixelFarmPwaAutoReloaded'),null,{timeout:45000});
 await page.reload();await ready(page);
 const precache=await page.evaluate(async()=>{const c=await caches.open('pixel-farm-rpg-'+FARM_CACHE_VERSION+'-static');const urls=(await c.keys()).map(x=>new URL(x.url).pathname);return['content-r4/basket.webp','content-r4/child.webp','content-r3/merchant.webp','content-r3/elder.webp','content-r3/child.webp','content-r5/merchant.webp','content-r5/elder.webp'].every(x=>urls.some(u=>u.endsWith(x)));});
 check(precache,'all packing/first/matched illustrations precached before first open');
 await ctx.setOffline(true);await page.reload();await ready(page);
 for(const id of ids){await baskets(page);await page.locator(`[data-neighbor="${id}"]`).click();await page.locator(`[data-taste="${tastes[id]}"]`).click();
  check(await page.evaluate(()=>ContentR1.verifyArtwork()),id+' offline FIRST basket opening decodes real art');await snap(page,`phone-basket-${id}-offline.png`);
  await page.locator('#readNeighbor').click();check(await page.evaluate(()=>ContentR1.verifyArtwork()),id+' offline matched art decodes');await snap(page,`phone-memory-${id}-offline.png`);await page.locator('#backToFarm').click();
 }
}finally{await ctx.close();}
// Failure injection belongs outside the selected review set; selection and ingredients remain intact.
for(const id of ids){const{ctx,page}=await session(undefined,earned);try{
 await page.route('**/content-r4/basket.webp*',r=>r.abort());await baskets(page);await page.locator(`[data-neighbor="${id}"]`).click();await page.locator('[data-taste="sour"]').click();await page.locator('.retry-art').waitFor();
 const before=await page.evaluate(()=>JSON.stringify({bread:__farm.state().adventure.meals,items:__farm.state().storage.items,resident:document.querySelector('#worldModal').dataset.resident,taste:document.querySelector('[data-taste][aria-pressed="true"]').dataset.taste,description:document.querySelector('#basketDescription').textContent}));
 await page.unroute('**/content-r4/basket.webp*');await page.locator('.retry-art').click();await page.waitForFunction(()=>document.querySelector('.content-illustration').dataset.artState==='loaded');
 check(await page.evaluate(()=>JSON.stringify({bread:__farm.state().adventure.meals,items:__farm.state().storage.items,resident:document.querySelector('#worldModal').dataset.resident,taste:document.querySelector('[data-taste][aria-pressed="true"]').dataset.taste,description:document.querySelector('#basketDescription').textContent}))===before,id+' same-page retry preserves resident, flavor, all text and ingredients');await snap(page,`phone-basket-${id}-retry-restored.png`);
}finally{await ctx.close();}}
// First-delivery story images have not been opened before this offline reload.
for(const id of ids){const{ctx,page}=await session(undefined,firstSaves[id],'allow');try{
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&!!sessionStorage.getItem('pixelFarmPwaAutoReloaded'),null,{timeout:45000});await ctx.setOffline(true);await page.reload();await ready(page);await baskets(page);await page.locator(`[data-neighbor="${id}"]`).click();await page.locator('#readNeighbor').click();check(await page.evaluate(()=>ContentR1.verifyArtwork()),id+' offline FIRST story opening decodes');await snap(page,`phone-story-${id}-offline-first.png`);
}finally{await ctx.close();}}
}
async function store(){for(const v of [{w:430,h:932,dpr:3,name:'iphone'},{w:1032,h:1376,dpr:2,name:'ipad'}]){const{ctx,page}=await session(v,earned);try{await baskets(page);await page.locator('[data-neighbor="elder"]').click();await page.locator('#readNeighbor').click();await snap(page,`${v.name}-11-stove-return.png`,true);}finally{await ctx.close();}}}
function selectReview(){const selection=[
 ['basket','phone-basket-walking-1.png'],['basket','phone-basket-walking-2.png'],['basket','phone-story-child-first.png'],['basket','phone-basket-child-430-top.png'],['basket','phone-basket-merchant-320-bottom.png'],
 ['pond','phone-pond-river_carp-sinking-original.png'],['pond','phone-pond-silver_dace-pre-sink-original.png'],['pond','phone-pond-silver_dace-sinking-original.png'],['pond','phone-pond-river_perch-pre-sink-original.png'],['pond','phone-pond-river_perch-sinking-original.png'],
 ['memory','phone-memory-merchant-recall.png'],['memory','phone-memory-merchant-matched.png'],['memory','phone-memory-elder-matched.png'],['memory','phone-memory-child-choosing.png'],['memory','phone-memory-child-matched.png']];
 const dir=path.join(OUT,'review-set');fs.mkdirSync(dir,{recursive:true});report.reviewSet=selection.map(([content,name],i)=>{const dest=String(i+1).padStart(2,'0')+'-'+name;fs.copyFileSync(path.join(OUT,name),path.join(dir,dest));return{content,source:'docs/content/r5/'+name,path:'docs/content/r5/review-set/'+dest};});
 fs.writeFileSync(path.join(OUT,'review-set.json'),JSON.stringify(report.reviewSet,null,2)+'\n');
}
(async()=>{try{const s=await serve();server=s.server;origin=s.origin;browser=await chromium.launch({headless:true});await neighbors();await layouts();await fish();await offline();await store();selectReview();check(report.errors.length===0,'no browser page errors');fs.writeFileSync(path.join(OUT,'earned-neighbors.json'),JSON.stringify(earned,null,2)+'\n');report.status='VERIFIED';}catch(e){report.status='BLOCKED';report.failure=e.stack;console.error(e);process.exitCode=1;}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(OUT,'browser-checks.json'),JSON.stringify(report,null,2)+'\n');}})();
