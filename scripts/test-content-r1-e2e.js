"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const {chromium} = require("playwright");
const {serve,ROOT} = require("./r85-browser-helper");
const {revealFarmControl} = require("./farm-control-test-helper");
const S = require("../src/state"), A = require("../src/adventure");
const OUT = path.join(ROOT,"docs/content/r1");
const STORE = path.join(ROOT,"docs/store/screenshots");
fs.mkdirSync(OUT,{recursive:true});
const report = {status:"EXECUTED", fixture:"Explicit mid-game ingredient fixture: earned farming progression is covered separately by the existing world E2E. This test supplies chapter-one unlocks, restored dock, wheat20/carrot5/berries5, and performs actual cooking, delivery, timed reels and localStorage reload via UI.",checks:[],errors:[],screenshots:[]};
report.scope = process.argv.includes("--perf-only") ? "strict 18ms performance reference gate on a shared host" : "functional play, persistence, offline and RWD; the unchanged strict performance assertion is a separate --perf-only gate";
let browser,server;
function check(value,name) { assert.ok(value,name); report.checks.push(name); console.log("PASS "+name); }
function fixture() {
  const now=Date.now(),s=S.defaultState(now);A.ensure(s,now);
  for(const id of ["c1_homecoming","c1_first_harvest","c1_first_meal"]) s.adventure.claimed[id]=true;
  s.adventure.projects.fishing_dock.restored=true;s.adventure.welcomeSeen=true;
  s.storage.items={wheat:20,carrot:5,wild_berry:5};s.coins=100;
  s.settings.offlineSummary=false;s.settings.thumbFarmMode="direct";
  return s;
}
async function ready(page) {
  await page.waitForFunction(()=>window.__farm&&window.ContentR1&&window.Atlas.isReady()&&!document.querySelector("#startupLoading"));
  await page.evaluate(()=>{window.MOVE_MS=8;});
}
async function session(origin,view,state=fixture(),sw="block") {
  const context=await browser.newContext({viewport:{width:view.w,height:view.h},isMobile:!!view.mobile,hasTouch:!!view.mobile,deviceScaleFactor:view.dpr||1,serviceWorkers:sw});
  await context.addInitScript(s=>{if(!sessionStorage.getItem("content-r1-fixture")){localStorage.setItem("pixel_idle_farm_save_v1",JSON.stringify(s));sessionStorage.setItem("content-r1-fixture","1");}},state);
  const page=await context.newPage();page.setDefaultTimeout(10000);
  page.on("pageerror",e=>report.errors.push(String(e)));
  page.on("response",r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(origin + (sw === "allow" ? "/?swtest" : ""));await ready(page);
  return {context,page};
}
async function snap(page,name,store=false) {
  const file=path.join(store?STORE:OUT,name);await page.screenshot({path:file,fullPage:false});
  report.screenshots.push(path.relative(ROOT,file).replaceAll("\\","/"));
}
async function openBaskets(page) {
  // Same visible farm menu and story tab as normal play, never a hidden feature hook.
  const tab=page.locator('[data-tab="story"]');await revealFarmControl(page,tab);await tab.click();
  await page.locator("#worldNeighborButton").click();
  await page.locator("#sendNeighbor").waitFor({state:"visible"});
}
async function cookBread(page) {
  // Kitchen entry is exposed on the basket page; recipe uses actual wheat and farm action frame.
  await page.locator("#basketKitchen").click();
  const before=await page.evaluate(()=>__farm.state().adventure.meals.rustic_bread);
  await page.locator('[data-cook="rustic_bread"]').click();
  await page.waitForFunction(n=>__farm.state().adventure.meals.rustic_bread===n+1,before);
  await page.locator("#kitchenNeighbors").click();
}
async function send(page,id,taste="plain") {
  await page.locator(`[data-neighbor="${id}"]`).click();
  await page.locator(`[data-taste="${taste}"]`).click();
  const before=await page.evaluate(id=>({bread:__farm.state().adventure.meals.rustic_bread,del:__farm.state().adventure.neighbors[id].deliveries}),id);
  await page.locator("#sendNeighbor").dblclick({delay:35});
  await page.waitForFunction(({id,del})=>__farm.state().adventure.neighbors[id].deliveries===del+1,{id,del:before.del});
  await page.locator('[data-content-view="response"] #anotherBasket').waitFor({state:"visible"});
  const result=await page.evaluate(id=>({bread:__farm.state().adventure.meals.rustic_bread,n:AdventureAPI.neighbors(__farm.state(),Date.now()).find(n=>n.id===id),distance:(()=>{const s=__farm.state(),t=s.map.tiles.find(t=>t.npc===id);return Math.abs(s.player.x-t.x)+Math.abs(s.player.y-t.y);})()}),id);
  check(result.bread===before.bread-1&&result.n.deliveries===before.del+1&&result.distance===1,`${id}/${taste}: double tap spends one actual bread only at resident action frame`);
  return result;
}
async function playNeighbors(origin) {
  const {context,page}=await session(origin,{w:390,h:844,mobile:true});
  try {
    await snap(page,"before-new-content-390x844.png");
    await openBaskets(page);
    check(await page.locator("#sendNeighbor").isDisabled(),"empty meal basket visibly directs player to the existing kitchen");
    for(let i=0;i<10;i++)await cookBread(page);
    check(await page.evaluate(()=>(__farm.state().storage.items.wheat||0)===0),"ten real kitchen actions consume twenty wheat");
    await page.locator("#sendNeighbor").click();await page.locator(".basket-carrying button").click();
    await page.waitForTimeout(650);
    check(await page.evaluate(()=>__farm.state().adventure.meals.rustic_bread===10&&__farm.state().adventure.neighbors.merchant.deliveries===0),"cancel during carrying spends nothing and never completes the story later");
    await openBaskets(page);
    for(const [id,taste] of [["merchant","sour"],["elder","hot"],["child","sweet"]]) {
      const first=await send(page,id);
      check(!!first.n.story&&!first.n.matched&&!!first.n.reaction,`${id}: first story and taste clue are earned`);
      await snap(page,`story-${id}-390x844.png`);
      await page.locator("#anotherBasket").click();
      const wrong=await send(page,id,taste==="sweet"?"sour":"sweet");
      check(!wrong.n.lastMatched,`${id}: wrong taste never opens remembered-taste reply`);
      await page.locator("#anotherBasket").click();
      const right=await send(page,id,taste);
      check(right.n.lastMatched&&right.n.matched&&right.n.reaction!==wrong.n.reaction,`${id}: matching remembered preference opens a unique reply`);
      check(await page.locator("#worldModalTitle").textContent()===right.n.memory.heading,`${id}: clear completion feedback`);
      await snap(page,`taste-${id}-390x844.png`);
      await page.locator("#anotherBasket").click();
    }
    await page.locator(".world-modal-close").click();await page.reload();await ready(page);
    check(await page.evaluate(()=>Object.values(__farm.state().adventure.neighbors).every(n=>n.deliveries===3&&n.matched&&n.lastMatched)),"all three stories, delivery counts and matched replies persist through actual reload");
    await openBaskets(page);await page.locator('[data-neighbor="child"]').click();await page.locator("#readNeighbor").click();
    check(/胡蘿蔔/.test(await page.locator(".neighbor-reaction").textContent()),"earned taste conversation can be reread after reload");
    return await page.evaluate(()=>JSON.parse(JSON.stringify(__farm.state())));
  } finally {await context.close();}
}
async function playFish(origin) {
  for(const [id,roll] of [["river_carp",0],["silver_dace",.5],["river_perch",.99]]) {
    const {context,page}=await session(origin,{w:390,h:844,mobile:true});
    try {
      // Pin only the otherwise random species; all elapsed times and pointer input stay real.
      await page.evaluate(roll=>{const original=AdventureAPI.startFishing;AdventureAPI.startFishing=(s,t)=>original(s,t,()=>roll);},roll);
      await page.evaluate(()=>FarmWorld.visitSite("fishing_dock"));
      await page.locator("#worldCatch").waitFor({state:"visible"});
      await page.locator("#worldCatch").click();
      check(await page.evaluate(()=>AdventureAPI.summary(__farm.state(),Date.now()).fishing.used===0),`${id}: early UI reel has no catch`);
      await page.waitForFunction(()=>document.querySelector("#worldCatch").textContent==="重新拋竿");
      await page.locator("#worldCatch").click();
      await page.waitForFunction(()=>document.querySelector(".pond-stage").dataset.pose==="strike",null,{polling:"raf"});
      await page.locator("#worldCatch").click();
      await page.waitForFunction(id=>__farm.state().adventure.catch[id]===1,id);
      check(await page.locator("#worldCatch").isDisabled(),`${id}: correct visible bite phase catches its species and enters cooldown`);
      await snap(page,`fish-${id}-390x844.png`);
      await page.locator("#worldFishNotes").click();
      check((await page.locator(".fish-note").count())===1,`${id}: first catch writes a specific river observation`);
      await snap(page,`note-${id}-390x844.png`);
      await page.locator(".world-modal-close").click();await page.reload();await ready(page);
      check(await page.evaluate(id=>__farm.state().adventure.fishNotes[id]&&__farm.state().adventure.catch[id]===1,id),`${id}: real reload preserves catch and note`);
      await page.evaluate(()=>FarmWorld.visitSite("fishing_dock"));await page.locator("#worldCatch").waitFor({state:"visible"});
      check(await page.locator("#worldCatch").isDisabled(),`${id}: reopening the pond cannot bypass cooldown`);
    } finally {await context.close();}
  }
}
async function layout(origin,earned) {
  for(const view of [{w:320,h:568,mobile:true},{w:844,h:390,mobile:true},{w:768,h:1024,mobile:true},{w:1366,h:600},{w:430,h:932,mobile:true,dpr:3,platform:"iphone"},{w:1032,h:1376,mobile:true,dpr:2,platform:"ipad"}]) {
    const {context,page}=await session(origin,view,earned);
    try {
      await openBaskets(page);
      for(const selector of [".world-modal-close","#sendNeighbor","#basketKitchen","#readNeighbor","[data-neighbor]","[data-taste]"]) {
        const bounds=await page.locator(selector).evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {w:r.width,h:r.height,visible:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,hit:e.contains(document.elementFromPoint(x,y))};}));
        check(bounds.every(b=>b.w>=44&&b.h>=44&&b.visible&&b.hit),`${view.w}x${view.h} ${selector}: >=44px, onscreen and center hittable`);
      }
      await page.locator('[data-neighbor="child"]').click();await page.locator('[data-taste="sweet"]').click();
      check(await page.locator('[data-taste="sweet"]').getAttribute("aria-pressed")==="true",`${view.w} actual taste tab selects without spending`);
      await snap(page,`basket-${view.w}x${view.h}.png`);
      await page.locator("#readNeighbor").click();
      if(view.mobile)check(!/WASD|方向鍵|鍵盤|按 E/.test(await page.locator("#worldModal").innerText()),`${view.w} no keyboard instruction on mobile content`);
      await snap(page,`response-${view.w}x${view.h}.png`);
      if(view.platform)await snap(page,`${view.platform}-07-neighbor-memory.png`,true);
      await page.locator("#backToFarm").click();
      check(!await page.locator("#worldModal").isVisible(),`${view.w} close returns to playable farm`);
      await page.evaluate(()=>FarmWorld.visitSite("fishing_dock"));await page.locator("#worldCatch").waitFor({state:"visible"});
      const size=await page.locator("#worldCatch").boundingBox();check(size.height>=44&&size.y+size.height<=view.h,`${view.w} pond action stays reachable`);
      const notes=await page.locator("#worldFishNotes").boundingBox();check(notes.height>=44&&notes.width>=44&&notes.y+notes.height<=view.h,`${view.w} river notes stay reachable beside the action`);
      await snap(page,`pond-${view.w}x${view.h}.png`);
    } finally {await context.close();}
  }
}
async function offline(origin,earned) {
  const {context,page}=await session(origin,{w:390,h:844,mobile:true},earned,"allow");
  try {
    await page.waitForFunction(async()=>{const reg=await navigator.serviceWorker.getRegistration();return reg&&reg.active&&reg.active.state==="activated";},null,{timeout:30000});
    // Activation precedes clients.claim/controllerchange. Let the app's real first
    // controller reload finish before requesting our explicit persistence reload.
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&!!sessionStorage.getItem("pixelFarmPwaAutoReloaded")&&performance.getEntriesByType("navigation").some(n=>n.type==="reload"),null,{timeout:30000});
    await page.reload();await ready(page);
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:15000});
    check(await page.evaluate(()=>!!navigator.serviceWorker.controller),"service worker controls the local game");
    const cached=await page.evaluate(async()=>{const urls=(await Promise.all((await caches.keys()).map(async k=>(await (await caches.open(k)).keys()).map(r=>r.url)))).flat();return ["src/content-r1.js","src/content-r1.css","merchant.webp","elder.webp","child.webp","water.webp","bobber.png"].every(p=>urls.some(u=>u.includes(p)));});
    check(cached,"content code and illustrations are actually precached");
    await context.setOffline(true);await page.reload();await ready(page);
    await openBaskets(page);await page.locator("#readNeighbor").click();
    check(await page.locator(".content-illustration").evaluate(e=>e.complete&&e.naturalWidth===64&&e.naturalHeight===64&&e.src.includes("content-r8/token-")),"offline reload opens earned story with local art and save intact");
    await snap(page,"offline-story-390x844.png");
    await page.locator("#backToFarm").click();await page.evaluate(()=>FarmWorld.visitSite("fishing_dock"));
    await page.locator("#worldCatch").waitFor({state:"visible"});
    check(await page.locator(".pond-bobber").evaluate(e=>e.complete&&e.naturalWidth===32),"offline pond loads the actual generated bobber");
    check(await page.evaluate(async()=>{const bg=getComputedStyle(document.querySelector(".pond-stage")).backgroundImage.match(/url\(["']?(.*?)["']?\)/)[1];return (await fetch(bg)).ok;}),"offline pond water texture resolves from the precache before any online pond visit");
    await page.waitForFunction(()=>document.querySelector(".pond-stage").dataset.pose==="strike",null,{polling:"raf"});
    await page.locator("#worldCatch").click();
    check(await page.evaluate(()=>__farm.state().adventure.counts.fish===1&&AdventureAPI.fishNotes(__farm.state(),Date.now()).length===1),"offline real reel completes a catch and a river note");
    await snap(page,"offline-catch-390x844.png");await page.reload();await ready(page);
    check(await page.evaluate(()=>__farm.state().adventure.counts.fish===1),"offline catch persists after a second offline reload");
  } finally {await context.close();}
}
async function performanceGate(origin) {
  // Match the existing R79 sampling protocol: no renderer/DPR history from screenshots.
  await browser.close(); browser = null;
  report.performance = {};
  for(const view of [{w:1366,h:768},{w:390,h:844,mobile:true}]) {
    const runs=[];
    for(let i=0;i<3;i++) {
      browser=await chromium.launch({headless:true});
      const {context,page}=await session(origin,view);
      try {
        await page.evaluate(()=>FarmWorld.visitSite("fishing_dock"));await page.locator("#worldCatch").waitFor({state:"visible"});
        // Warm the first full cast (max 3.6s), then measure another live cast.
        // This isolates steady rendering from initial river-map/image rasterization.
        await page.waitForTimeout(4200);await page.locator("#worldCatch").click();
        await page.waitForFunction(()=>document.querySelector("#worldCatch").textContent==="重新拋竿");
        await page.locator("#worldCatch").click();await page.waitForTimeout(180);
        const p95=await page.evaluate(()=>new Promise(resolve=>{const frames=[];let last=performance.now(),end=last+4000;function sample(t){frames.push(t-last);last=t;if(t<end)requestAnimationFrame(sample);else{const sorted=frames.slice(5).sort((a,b)=>a-b);resolve(sorted[Math.ceil(sorted.length*.95)-1]);}}requestAnimationFrame(sample);}));
        runs.push(+p95.toFixed(2));
      } finally {await context.close();await browser.close();browser=null;}
    }
    const median=runs.slice().sort((a,b)=>a-b)[1];report.performance[`${view.w}x${view.h}`]={runsP95Ms:runs,medianP95Ms:median,limitMs:18,trust:"concurrent shared host; reference only",warmup:"first full 4.2s cast, then a new real cast and 4s sample; fresh browser per run",scene:"live R1 pond bobber modal over farm"};
    check(median<=18,`${view.w} new-content rAF p95 median of three ${median}ms <=18ms`);
  }
  browser=await chromium.launch({headless:true});
}
(async()=>{
  try {
    const served=await serve();server=served.server;
    browser=await chromium.launch({headless:true});
    if(process.argv.includes("--perf-only")) await performanceGate(served.origin);
    else {
      const earned=await playNeighbors(served.origin);
      await playFish(served.origin);await layout(served.origin,earned);await offline(served.origin,earned);
    }
    check(report.errors.length===0,"no page errors or missing local assets");report.status="VERIFIED";
  } catch(error) {report.status="BLOCKED";report.failure=error.stack;console.error(error);process.exitCode=1;}
  finally {if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(OUT,process.argv.includes("--perf-only")?"performance-diagnostic.json":"browser-checks.json"),JSON.stringify(report,null,2)+"\n");}
})();
