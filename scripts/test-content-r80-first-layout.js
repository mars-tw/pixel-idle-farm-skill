"use strict";
/* R80B：四種尺寸、第一分鐘六時點——單一按鈕、同拍秒數、決定田可見與收成大字避讓。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), http = require("node:http"), { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), PORT = 5308, ORIGIN = `http://127.0.0.1:${PORT}`;
const VIEWS = [[1366,768,false],[1366,600,false],[390,844,true],[844,390,true]];
const MIME = { ".html":"text/html", ".js":"application/javascript", ".css":"text/css", ".json":"application/json", ".png":"image/png", ".webp":"image/webp", ".svg":"image/svg+xml", ".webmanifest":"application/manifest+json", ".ogg":"audio/ogg", ".m4a":"audio/mp4" };
function serve() { return new Promise((resolve, reject) => { const server = http.createServer((req,res) => { const u = new URL(req.url, ORIGIN), f = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))), rel = path.relative(ROOT,f); if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream","Cache-Control":"no-store"}); fs.createReadStream(f).pipe(res); }); server.once("error",reject); server.listen(PORT,"127.0.0.1",()=>resolve(server)); }); }
async function launch() { const opts={headless:true,args:["--no-sandbox"]}; try{return await chromium.launch(opts);}catch(_){} for(const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe","C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if(fs.existsSync(executablePath)) try{return await chromium.launch({...opts,executablePath});}catch(_){} throw Error("No browser available"); }
const overlap=(a,b)=>{if(!a||!b)return 0;const w=Math.min(a.right,b.right)-Math.max(a.left,b.left),h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);return w>0&&h>0?w*h:0;};

async function prepare(page, mode) {
  return page.evaluate((mode) => {
    const s=__farm.state(),A=AdventureAPI,t=Date.now(),active=activePlotCount(s),plotTile=(i)=>s.map.tiles.find(x=>x.plotIndex===i);
    document.querySelectorAll(".modal.show").forEach(n=>n.classList.remove("show")); const dialogue=document.querySelector("#worldDialogue"); if(dialogue)dialogue.hidden=true;
    A.ensure(s,t); s.coins=200; s.stats.plantCount=9; s.stats.harvested={}; s.orders=[]; s.flags.r79FirstLightHarvest=false; s.flags.r79LightChoiceCount=0; delete s.flags.r79WaitHarvest;
    if(s.adventure&&s.adventure.r75&&s.adventure.r75.r75Sunplay){s.adventure.r75.r75Sunplay.firstRefracted=false;s.adventure.r75.r75Sunplay.firstCaught=false;}
    for(let i=0;i<active;i++){s.plots[i].cropId=null;s.plots[i].plantedAt=0;delete s.plots[i].wateredAt;delete s.plots[i].careMode;delete s.plots[i].sunGrown;}
    const ready=(i)=>{s.plots[i].cropId="wheat";s.plots[i].careMode="water";s.plots[i].plantedAt=t-3600000;s.plots[i].wateredAt=t-3600000;};
    ready(0);
    if(mode==="market_choice"||mode==="market_wait"||mode==="manual_harvest") { s.stats.harvested={wheat:3}; s.flags.r79FirstLightHarvest=true; s.sun.spawned=1; s.orders=[{id:"shown_wheat",wants:{wheat:4},rewardCoins:29,rarity:"common",firstBatch:true,expiresAt:null,npcId:"merchant"}]; }
    if(mode==="market_wait"||mode==="manual_harvest") { s.plots[1].cropId="wheat";s.plots[1].careMode="water";s.plots[1].plantedAt=t;delete s.plots[1].wateredAt; }
    const previewIndex=mode==="refract_first"?1:0;
    Object.assign(s.sun,{plots:[],used:[],startsAt:0,endsAt:0,previewPlots:[previewIndex],previewAt:t+7000,nextAt:t+7000,refractions:0,introduced:true,spawned:s.sun.spawned||0});
    FarmSunplay.refreshLightCountdown(s.sun,t);
    s.interaction.selectedTileId=plotTile(0).id;
    __farm.refresh(); FarmWorld.refresh(s); __farm.focusTile(plotTile(0).id); __farm.clickTile(plotTile(0).id); __farm.cancelJourney(); __farm.renderSceneActions();
    return {targetId:plotTile(0).id};
  }, mode);
}

async function inspect(page, targetId) {
  return page.evaluate((targetId) => {
    const vis=n=>{if(!n||n.hidden)return false;const r=n.getBoundingClientRect(),c=getComputedStyle(n);return r.width>0&&r.height>0&&c.display!=="none"&&c.visibility!=="hidden"&&c.opacity!=="0";};
    const box=n=>{if(!vis(n))return null;const r=n.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const target=document.querySelector(`.gtile[data-tile-id="${targetId}"]`),targetBox=box(target);
    const hud=["header","#questDock",".seed-hud","#worldMinimap","#farmDock","#mobileControls","#sceneActionBar",".sun-chip"].flatMap(sel=>[...document.querySelectorAll(sel)]).filter(n=>vis(n)&&n!==target).map(n=>({sel:n.id?`#${n.id}`:n.className,box:box(n)}));
    const buttons=[...document.querySelectorAll("button")].filter(vis).map(n=>({text:n.textContent.trim().replace(/\s+/g," "),action:n.dataset.action||"",where:n.closest("#questDock")?"quest":n.closest("#sceneActionBar")?"scene":n.id==="actionA"?"thumb":"other",box:box(n),disabled:n.disabled}));
    const names=["等光再收","現在收","把光折到這裡"];
    const counts=Object.fromEntries(names.map(name=>[name,buttons.filter(b=>!b.disabled&&(b.text===name||b.text.startsWith(name+" ")||b.text.startsWith(name+"・"))).length]));
    const secondRoots=["#tileStateLabel","#sceneActionBar","#r79bActionNote","#questDock","#sunChip",".r75a-sun-preview"].flatMap(sel=>[...document.querySelectorAll(sel)]).filter(vis);
    const seconds=[]; for(const n of secondRoots){for(const m of n.textContent.matchAll(/(\d+)\s*秒/g))seconds.push(Number(m[1]));}
    const head=document.querySelector("#questDock .r80b-objective-head, #questDock .r80b-heirloom-head");
    const trade=[...document.querySelectorAll("#sceneActionBar [data-r79b-tradeoff]")].filter(vis).map(box);
    return {targetBox,hud,buttons,counts,seconds:[...new Set(seconds)],title:{source:head&&head.querySelector(".r80b-objective-source")?.textContent.trim(),task:head&&head.querySelector(".r80b-objective-task")?.textContent.trim(),progress:head&&head.querySelector('[data-audit="quest-progress"]')?.textContent.trim()},questText:document.querySelector("#questDock")?.textContent.replace(/\s+/g," ").trim()||"",ghost:vis(document.querySelector(".r77a-refract-ghost")),trade,pop:box(document.querySelector(".r78b-sun-pop")),width:innerWidth,height:innerHeight};
  }, targetId);
}

(async()=>{
  const server=await serve(),browser=await launch();let passed=0;
  try{
    for(const [width,height,isMobile] of VIEWS){
      const tag=`${width}x${height}`,ctx=await browser.newContext({viewport:{width,height},isMobile,hasTouch:isMobile,serviceWorkers:"block"}),page=await ctx.newPage(),errors=[];
      page.on("pageerror",e=>errors.push(String(e))); await page.goto(ORIGIN); await page.waitForFunction(()=>window.__farm&&window.Atlas&&window.Atlas.isReady()&&!document.querySelector("#startupLoading"),null,{timeout:30000}); await page.evaluate(()=>document.querySelector("#worldBegin")?.click());
      const assertTarget=(r,label)=>{assert.ok(r.targetBox,`${tag} ${label} 有目標田`);assert.ok(r.targetBox.left>=-1&&r.targetBox.top>=-1&&r.targetBox.right<=r.width+1&&r.targetBox.bottom<=r.height+1,`${tag} ${label} 田在畫面內 ${JSON.stringify(r.targetBox)}`);for(const h of r.hud)assert.equal(overlap(r.targetBox,h.box),0,`${tag} ${label} 田不被 ${h.sel} 蓋住：${JSON.stringify({target:r.targetBox,hud:h.box})}`);};
      const assertSingle=(r,label)=>{for(const [name,n] of Object.entries(r.counts))assert.ok(n<=1,`${tag} ${label}「${name}」可按鈕 ${n} 顆`);assert.ok(r.title.source&&r.title.task&&r.title.progress,`${tag} ${label} 標題列有來源／任務名／進度：${JSON.stringify(r.title)}`);};

      let prep=await prepare(page,"refract_first"); await page.waitForTimeout(1300); let r=await inspect(page,prep.targetId); assertTarget(r,"第一次折光");assertSingle(r,"第一次折光");assert.equal(r.ghost,false,`${tag} 第一次收成前不顯示折光田字`);assert.equal(r.buttons.filter(b=>b.action==="refract").length,0);assert.equal(r.buttons.filter(b=>b.where==="quest"&&/把光折過來/.test(b.text)).length,1);

      prep=await prepare(page,"tutorial_choice"); await page.waitForTimeout(1300); r=await inspect(page,prep.targetId);assertTarget(r,"教學等光");assertSingle(r,"教學等光");assert.deepEqual(r.seconds.length?r.seconds:[1],[r.seconds[0]||1],`${tag} 教學等光只有一套秒數`);assert.equal(r.buttons.filter(b=>b.where==="scene"&&b.action==="wait_light").length,1);assert.equal(r.buttons.filter(b=>b.where==="quest"&&/等光再收/.test(b.text)).length,0);

      await page.locator('#sceneActionBar [data-action="wait_light"]').click();await page.waitForTimeout(500);r=await inspect(page,prep.targetId);assertSingle(r,"教學已排入等待");assert.equal(await page.evaluate(()=>__farm.state().flags.r79WaitHarvest.autoHarvest),true);assert.ok(r.buttons.some(b=>b.action==="wait_light"&&b.disabled),`${tag} 教學等待鈕已鎖定`);

      prep=await prepare(page,"market_choice");await page.waitForTimeout(1300);r=await inspect(page,prep.targetId);assertTarget(r,"早市取捨");assertSingle(r,"早市取捨");assert.match(r.questText,/選一個/);assert.equal(r.buttons.filter(b=>b.where==="quest"&&/現在收|等光再收/.test(b.text)).length,0);assert.equal(r.trade.length,2);assert.ok(Math.abs(r.trade[0].width-r.trade[1].width)<=1,`${tag} 早市兩鈕等寬 ${r.trade.map(x=>x.width)}`);assert.ok(r.seconds.length<=1,`${tag} 早市倒數一致 ${r.seconds}`);

      prep=await prepare(page,"market_wait");await page.waitForTimeout(1300);await page.locator('#sceneActionBar [data-action="wait_light"]').click();await page.waitForTimeout(900);r=await inspect(page,prep.targetId);assertSingle(r,"早市已選等光");assert.equal(await page.evaluate(()=>__farm.state().flags.r79WaitHarvest.autoHarvest),false);assert.match(r.questText,/已選等光，光到了再回田邊收成/);

      await page.evaluate(()=>{const s=__farm.state(),t=Date.now(),tile=s.map.tiles.find(x=>x.plotIndex===0),pt=s.map.tiles.find(x=>Math.abs(x.x-tile.x)+Math.abs(x.y-tile.y)===1&&planMoveTo(s,tile.id));Object.assign(s.sun,{plots:[0],previewPlots:[],previewAt:0,startsAt:t-50,endsAt:t+10000,used:[]});if(pt){s.player.tileId=pt.id;s.player.x=pt.x;s.player.y=pt.y;}__farm.refresh();FarmWorld.refresh(s);__farm.focusTile(tile.id);__farm.clickTile(tile.id);__farm.cancelJourney();__farm.renderSceneActions();});
      await page.waitForTimeout(900);await page.locator('#sceneActionBar [data-action="harvest"]').click();await page.waitForSelector(".r78b-sun-pop",{timeout:5000});r=await inspect(page,prep.targetId);assert.ok(r.pop,`${tag} 收成大字有顯示`);for(const h of r.hud)assert.equal(overlap(r.pop,h.box),0,`${tag} 收成大字不壓 ${h.sel}`);

      assert.deepEqual(errors,[],`${tag} 沒有頁面錯誤`);passed+=6;console.log(`PASS ${tag} 第一分鐘六時點`);await ctx.close();
    }
    console.log(`R80B first-minute layout: ${passed} checkpoints passed`);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error("FAIL R80B first-minute layout\n"+error.stack);process.exitCode=1;});
