/* Final route regression: earned save from the real R17 cooking/gift journey. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto');
const {chromium}=require('playwright'),{ROOT,serve}=require('./r85-browser-helper'),{captureNative}=require('./native-evidence-capture'),{revealFarmControl}=require('./farm-control-test-helper');
const O=path.join(ROOT,'docs/content/r17'),report={status:'EXECUTED',checks:[],frames:[],errors:[],fixture:'Replay the R17 UI-earned save. Move speed 750ms/tile for auditable frames; no delivery result or inventory is granted.'};
function check(x,n){assert(x,n);report.checks.push(n);console.log('PASS '+n);}
async function snap(p,name){await p.locator('.handover-actor,.handover-player,.handover-parcel').evaluateAll(async es=>{for(const e of es)await e.decode();});const rel='docs/content/r17/'+name;await captureNative(p,path.join(ROOT,rel));const state=await p.evaluate(()=>({player:__farm.state().player,phase:document.querySelector('.basket-carrying')?.dataset.phase,distance:document.querySelector('.carry-distance')?.textContent,goal:document.querySelector('.delivery-goal')?.style.cssText,markers:[...document.querySelectorAll('[data-path-tile]:not([hidden])')].map(e=>e.dataset.pathTile),bread:__farm.state().adventure.meals.rustic_bread}));report.frames.push({path:rel,state,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,rel))).digest('hex')});}
async function geometry(p,id,phase){const row=await p.evaluate(({id,phase})=>{
 const scene=document.querySelector('#mapScene').getBoundingClientRect(),s=__farm.state(),world=document.querySelector('#mapWorld');
 const blockers=[...document.querySelectorAll('.ob[data-kind="structure"],.ob[data-kind="tea-porch"],.ob[data-kind="building"]')].map(e=>e.getBoundingClientRect());
 const dots=[...document.querySelectorAll('[data-path-tile]')],visible=dots.filter(e=>!e.hidden);
 function inside(e){if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.left>=Math.max(0,scene.left)&&r.right<=Math.min(innerWidth,scene.right)&&r.top>=80&&r.bottom<=innerHeight-80&&getComputedStyle(e).visibility==='visible';}
 const handover=['arrived','reach','contact'].includes(phase);const actors=handover?[world.querySelector('.handover-player'),world.querySelector('.handover-actor')]:[document.querySelector('#player'),document.querySelector('.ob[data-kind="npc"][data-npc="'+id+'"]')];
 return {walkable:dots.every(e=>isWalkable(s,getTileById(s,e.dataset.pathTile))),outsideRoofs:visible.every(e=>!blockers.some(r=>ContentR17.overlaps(r,e.getBoundingClientRect()))),actorsVisible:actors.map(inside),spriteVisible:handover||getComputedStyle(document.querySelector('#playerSprite')).visibility==='visible',goal:document.querySelector('.delivery-goal')?.style.cssText,goalVisible:!document.querySelector('.delivery-goal')?.hidden,labelAnchor:document.querySelector('.carry-label')?.dataset.anchor,insideWorld:!handover||actors.every(e=>world.contains(e))};
 },{id,phase});
 check(row.walkable&&row.outsideRoofs,id+'/'+phase+' all drawn route guides on unobstructed walkable ground');
 if(['near','arrived','contact'].includes(phase))check(row.actorsVisible.every(Boolean)&&row.spriteVisible&&row.insideWorld,id+'/'+phase+' both complete actors visible in the world');
 (report.geometry||=[]).push({id,phase,...row});return row;
}
(async()=>{const{server,origin}=await serve();let browser;try{
 browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:430,height:932},isMobile:true,hasTouch:true,serviceWorkers:'block'}),p=await ctx.newPage();p.setDefaultTimeout(30000);p.on('pageerror',e=>report.errors.push(String(e)));
 const seed=JSON.parse(fs.readFileSync(path.join(O,'earned-save.json')));await ctx.addInitScript(s=>{if(!sessionStorage.getItem('r17-route')){localStorage.setItem('pixel_idle_farm_save_v1',JSON.stringify(s));sessionStorage.setItem('r17-route','1');}},seed);
 await p.goto(origin);await p.waitForFunction(()=>window.__farm&&Atlas.isReady()&&!document.querySelector('#startupLoading'));
 for(const[id,taste]of [['merchant','sour'],['elder','hot'],['child','sweet']]){
  await p.evaluate(()=>{window.MOVE_MS=35;__farm.setTool('hand');__farm.clickTile('t7_1');});await p.waitForFunction(()=>__farm.playerTileId()==='t7_1'&&!__farm.moving());
  const tab=p.locator('[data-tab=story]');await revealFarmControl(p,tab);await tab.click();await p.locator('#worldNeighborButton').click();await p.locator('[data-neighbor='+id+']').click();await p.locator('[data-taste='+taste+']').click();
  const before=await p.evaluate(id=>({bread:__farm.state().adventure.meals.rustic_bread,count:__farm.state().adventure.neighbors[id].deliveries}),id);
  await p.evaluate(()=>window.MOVE_MS=750);await p.locator('#sendNeighbor').click();await p.locator('.basket-carrying[data-phase=walking]').waitFor();
  const far=await geometry(p,id,'far');await snap(p,`phone-basket-${id}-far.png`);
  await p.waitForFunction(()=>{const d=Number(document.querySelector('.carry-distance')?.textContent.match(/\d+/)?.[0]);return d>1&&d<=4;});const mid=await geometry(p,id,'mid');await snap(p,`phone-basket-${id}-mid.png`);
  await p.waitForFunction(()=>document.querySelector('.carry-distance')?.textContent==='剩 1 格');const near=await geometry(p,id,'near');await snap(p,`phone-basket-${id}-near.png`);
  check(far.goal===mid.goal&&mid.goal===near.goal,id+' fixed destination ring throughout far/mid/near');
  await p.locator('.basket-carrying[data-phase=arrived]').waitFor();await geometry(p,id,'arrived');await snap(p,`phone-basket-${id}-arrived.png`);
  await p.locator('.basket-carrying[data-phase=reach]').waitFor();check(await p.evaluate(b=>__farm.state().adventure.meals.rustic_bread===b.bread,before),id+' reach does not spend ingredients');check(await p.locator('.carry-target:visible,.carry-label:visible').count()===0,id+' navigation avatar and label retire before physical exchange');await snap(p,`phone-basket-${id}-reach.png`);
  await p.locator('.basket-carrying[data-phase=contact]').waitFor();await geometry(p,id,'contact');await p.waitForFunction(()=>{const world=document.querySelector('#mapWorld'),wr=world.getBoundingClientRect(),es=[...document.querySelectorAll('.handover-parcel')],actor=document.querySelector('.handover-actor'),a=actor?.getBoundingClientRect(),e=es[0],r=e?.getBoundingClientRect(),size=Math.floor(32*(wr.width/world.offsetWidth)*64)/64;return es.length===1&&world.contains(e)&&world.contains(actor)&&r.width===size&&r.height===size&&r.left>=a.left&&r.right<=a.right;});check(true,id+' single native square basket fits the real world recipient');await snap(p,`phone-basket-${id}-received.png`);
  check(await p.evaluate(({b,id})=>__farm.state().adventure.meals.rustic_bread===b.bread-1&&__farm.state().adventure.neighbors[id].deliveries===b.count+1,{b:before,id}),id+' contact spends and delivers once');
  await p.locator('#anotherBasket').waitFor();await snap(p,`phone-basket-${id}-reply.png`);await p.locator('#backToFarm').click();
 }
 const counts=await p.evaluate(()=>Object.fromEntries(Object.entries(__farm.state().adventure.neighbors).map(([id,n])=>[id,n.deliveries])));await p.reload();await p.waitForFunction(()=>window.__farm&&Atlas.isReady()&&!document.querySelector('#startupLoading'));check(await p.evaluate(c=>Object.entries(c).every(([id,n])=>__farm.state().adventure.neighbors[id].deliveries===n),counts),'all three new deliveries persist after reload');
 check(!report.errors.length,'zero uncaught page errors');await ctx.close();report.status='VERIFIED';
 }catch(e){report.status='BLOCKED';report.failure=e.stack;console.error(e);process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(O,'journey-delivery-final.json'),JSON.stringify(report,null,2)+'\n');}})();
