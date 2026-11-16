"use strict";
/* R82A：四尺寸驗收 task card 的 full／short 切換、原單行高度、無裁切／覆蓋，以及四入口同步。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..");
const VIEWS = [[1366,768,false],[1366,600,false],[390,844,true],[844,390,true]];
const MIME = { ".html":"text/html", ".js":"application/javascript", ".css":"text/css", ".json":"application/json", ".png":"image/png", ".webp":"image/webp", ".svg":"image/svg+xml", ".webmanifest":"application/manifest+json", ".ogg":"audio/ogg", ".m4a":"audio/mp4" };
function serve(){return new Promise((resolve,reject)=>{const server=http.createServer((req,res)=>{const u=new URL(req.url,"http://127.0.0.1"),file=path.resolve(ROOT,"."+(u.pathname==="/"?"/index.html":decodeURIComponent(u.pathname)));if(path.relative(ROOT,file).startsWith("..")||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}res.writeHead(200,{"Content-Type":MIME[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store"});fs.createReadStream(file).pipe(res);});server.once("error",reject);server.listen(0,"127.0.0.1",()=>resolve(server));});}
async function launch(){const opts={headless:true,args:["--no-sandbox"]};try{return await chromium.launch(opts);}catch(_){}for(const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe","C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"])if(fs.existsSync(executablePath))try{return await chromium.launch({...opts,executablePath});}catch(_){}throw Error("No browser available");}
const norm=(text)=>String(text||"").replace(/\s+/g," ").trim();
async function visibleYellow(page){return page.evaluate(()=>[...document.querySelectorAll("button")].filter((b)=>{const c=getComputedStyle(b),r=b.getBoundingClientRect();if(c.display==="none"||c.visibility==="hidden"||Number(c.opacity)===0||r.width<2||r.height<2)return false;const bg=c.backgroundColor,im=c.backgroundImage;return ["rgb(255, 207, 100)","rgb(255, 217, 120)","rgb(255, 214, 109)"].includes(bg)||/rgb\(255, 210, 112\)|rgb\(255, 211, 106\)/.test(im);}).map((b)=>String(b.textContent||"").replace(/\s+/g," ").trim()));}
async function closeOverlays(page){await page.evaluate(()=>{document.querySelectorAll(".r76b-dialogue,.npc-bubble").forEach((n)=>n.remove());const d=document.querySelector("#worldDialogue");if(d)d.hidden=true;document.querySelector(".side-panel")?.classList.remove("world-panel-open");for(const id of ["dailyModal","worldModal","settingsModal"])document.getElementById(id)?.classList.remove("show");});await page.waitForTimeout(50);}
async function canonical(page){return page.evaluate(()=>{const g=AdventureAPI.nextGuidance(__farm.state(),Date.now());return{text:g.text,short:g.short,action:g.action};});}
async function assertCollapsed(page,tag){
  const expected=await canonical(page);
  const m=await page.evaluate(()=>{const d=document.querySelector("#questDock");d.classList.remove("quest-auto-collapsed","quest-target-collapsed");d.classList.add("quest-collapsed");const small=d.querySelector(".r68a-now small,.r67a-now small,.world-objective-detail"),short=small&&small.querySelector(".r82a-guidance-short"),full=small&&small.querySelector(".r82a-guidance-full"),button=d.querySelector(".r68a-now-action,.r67a-now-action,.world-objective-bottom button"),r=(e)=>{const z=e.getBoundingClientRect();return{left:z.left,right:z.right,top:z.top,bottom:z.bottom,width:z.width,height:z.height}},vis=(e)=>!!e&&getComputedStyle(e).display!=="none"&&getComputedStyle(e).visibility!=="hidden"&&r(e).width>0&&r(e).height>0,dr=r(d),sr=r(small),br=r(button),style=getComputedStyle(small),out=[...d.querySelectorAll("*")].filter(vis).map((e)=>({c:e.className||e.tagName,r:r(e)})).filter((x)=>x.r.right>dr.right+1);return{height:dr.height,text:short&&short.textContent.trim(),dockRect:dr,client:d.clientWidth,scroll:d.scrollWidth,out,smallDisplay:style.display,shortDisplay:getComputedStyle(short).display,smallRect:sr,buttonRect:br,shortVisible:vis(short),fullVisible:vis(full),cut:small.scrollWidth>small.clientWidth+1||small.scrollHeight>small.clientHeight+1,ellipsis:style.textOverflow,overlap:Math.max(0,Math.min(sr.right,br.right)-Math.max(sr.left,br.left))*Math.max(0,Math.min(sr.bottom,br.bottom)-Math.max(sr.top,br.top)),sameRow:Math.min(sr.bottom,br.bottom)-Math.max(sr.top,br.top)>0,inside:sr.left>=dr.left-1&&sr.right<=dr.right+1&&br.left>=dr.left-1&&br.right<=dr.right+1,overflow:d.scrollWidth-d.clientWidth};});
  assert.equal(norm(m.text),norm(expected.short),tag+" 收合只顯示當下 short");
  assert.equal(m.shortVisible,true,tag+" short 可見："+JSON.stringify(m)); assert.equal(m.fullVisible,false,tag+" full 收合時隱藏："+JSON.stringify(m));
  assert.ok(m.height<=53,tag+" 收合高度維持原 53px 上限："+JSON.stringify(m));
  assert.equal(m.cut,false,tag+" short 不裁切"); assert.notEqual(m.ellipsis,"ellipsis",tag+" short 不用省略號");
  assert.equal(m.overlap,0,tag+" short 不被按鈕蓋住："+JSON.stringify(m)); assert.equal(m.sameRow,true,tag+" short 與按鈕同一行："+JSON.stringify(m));
  assert.equal(m.inside,true,tag+" short 與按鈕都在卡內："+JSON.stringify(m)); assert.ok(m.overflow<=1,tag+" 水平溢出最多 1px："+JSON.stringify(m));
}
async function assertExpandedMode(page,tag,width,height){
  await page.evaluate(()=>document.querySelector("#questDock").classList.remove("quest-collapsed","quest-auto-collapsed","quest-target-collapsed"));
  const expected=await canonical(page), compact=width<=859||height<=600;
  const m=await page.evaluate(()=>{const d=document.querySelector("#questDock"),small=d.querySelector(".r68a-now small,.r67a-now small,.world-objective-detail"),short=small.querySelector(".r82a-guidance-short"),full=small.querySelector(".r82a-guidance-full"),vis=(e)=>getComputedStyle(e).display!=="none"&&getComputedStyle(e).visibility!=="hidden"&&e.getBoundingClientRect().height>0;return{short:short.textContent.trim(),full:full.textContent.trim(),shortVisible:vis(short),fullVisible:vis(full),shown:vis(short)?short.textContent.trim():full.textContent.trim(),cut:small.scrollWidth>small.clientWidth+1||small.scrollHeight>small.clientHeight+1};});
  assert.equal(norm(m.shown),norm(compact?expected.short:expected.text),tag+" 展開模式用正確版本");
  assert.equal(m.shortVisible,compact,tag+" short 顯示規則"); assert.equal(m.fullVisible,!compact,tag+" full 顯示規則");
  assert.equal(m.cut,false,tag+" 展開目前文字不裁切");
}
async function assertFullEntrances(page,tag,mobile){
  const expected=await canonical(page);
  await page.evaluate(()=>DailyUI.openHeirloom());await page.waitForTimeout(80);
  const grandma=norm(await page.locator("[data-r82a-grandma-guidance] p").textContent());
  assert.equal(grandma,norm(expected.text),tag+" 祖母手記用完整 text");
  await page.evaluate(()=>__farm.closeModal("dailyModal"));
  await page.evaluate(()=>FarmWorld.openPanel("story"));await page.waitForTimeout(100);
  const rows=await page.evaluate(()=>({journal:document.querySelector('#adventurePanel [data-r81c-tier="now"] .r68a-card-now small')?.textContent||"",list:document.querySelector('#adventurePanel [data-r81c-today="story"] .r81c-today-line')?.textContent||"",dockDisplay:getComputedStyle(document.querySelector("#questDock")).display,dockHidden:getComputedStyle(document.querySelector("#questDock")).display==="none",panelClass:document.querySelector(".side-panel")?.className||"",innerWidth}));
  assert.equal(norm(rows.journal),norm(expected.text),tag+" 手札現在做用完整 text");
  assert.equal(norm(rows.list),norm(expected.text),tag+" 任務清單用完整 text");
  if(mobile)assert.equal(rows.dockHidden,true,tag+" 手機開手札時任務卡整張隱藏："+JSON.stringify(rows));
  await page.evaluate(()=>document.querySelector(".side-panel")?.classList.remove("world-panel-open"));
}
(async()=>{const server=await serve(),origin="http://127.0.0.1:"+server.address().port,browser=await launch();let checks=0;try{for(const [width,height,mobile] of VIEWS){const tag=width+"x"+height,context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,serviceWorkers:"block"}),page=await context.newPage(),errors=[];page.on("pageerror",(e)=>errors.push(String(e)));await page.goto(origin);await page.waitForFunction(()=>window.__farm&&window.StoryR76&&window.AdventureAPI&&window.Atlas&&Atlas.isReady()&&!document.querySelector("#startupLoading"),null,{timeout:30000});await page.evaluate(()=>document.querySelector("#worldSunBegin,#worldBegin")?.click());await page.waitForTimeout(250);
    await page.evaluate(()=>{const s=__farm.state(),now=Date.now();s.heirloom.started=true;s.heirloom.sunWheat=2;s.storage.items.wheat=2;FarmHeirloom.deliver(s,"table",now);__farm.refresh();});await closeOverlays(page);
    await assertExpandedMode(page,tag,width,height);checks++;
    await assertFullEntrances(page,tag,mobile);checks++;
    await closeOverlays(page);await assertCollapsed(page,tag+" 二選一");checks++;

    await page.evaluate(()=>{StoryR76.r81Choose(__farm.state(),"plant",Date.now());__farm.refresh();});await closeOverlays(page);await assertCollapsed(page,tag+" 缺小麥");checks++;
    await page.evaluate(()=>{__farm.state().storage.items.wheat=2;__farm.refresh();});await closeOverlays(page);await assertCollapsed(page,tag+" 訂單備齊");checks++;
    await page.evaluate(()=>{StoryR76.r81Deliver(__farm.state(),Date.now());__farm.refresh();});await closeOverlays(page);await assertCollapsed(page,tag+" 訂單交付");checks++;

    let yellow=await visibleYellow(page);assert.ok(yellow.length<=1,tag+" 同畫面最多一顆黃色主按鈕 "+JSON.stringify(yellow));checks++;
    await page.evaluate(()=>{const old=document.createElement("div");old.className="npc-bubble";old.innerHTML='<div class="r60a-story-choices"><button>舊選項一</button><button>舊選項二</button></div>';document.querySelector("#mapWorld").appendChild(old);StoryR76.openDialogue(__farm.state(),"mayor",["明天這一格我自己來翻。"],{speaker:"鎮長葛瑞"});});await page.waitForTimeout(80);
    assert.equal(await page.locator(".npc-bubble").count(),0,tag+" 舊泡泡與空白卡已移除");checks++;
    await closeOverlays(page);

    await page.evaluate(()=>{const s=__farm.state();s.adventure.r61.festival.judging={stars:2,totalScore:3,maxScore:5,scoreSources:{diverse:true,seasonal:true,hasMeal:true,quality:false,hasDried:false},details:[],rewardText:"金幣 24 枚"};const box=document.getElementById("worldModal");box.className="modal world-modal show";box.hidden=false;box.style.display="grid";box.innerHTML='<div class="modal-card"><button class="world-modal-close" type="button">×</button><h2 id="worldModalTitle">作物評比結果</h2><div class="modal-body">舊內容</div></div>';box.querySelector(".world-modal-close").onclick=()=>{box.classList.remove("show");box.hidden=true;};const trigger=document.createElement("button");trigger.id="festivalJudge";document.body.appendChild(trigger);trigger.click();trigger.remove();});await page.waitForSelector("[data-r82a-result-close]");
    const resultButton=await page.evaluate(()=>{const b=document.querySelector("[data-r82a-result-close]"),r=b.getBoundingClientRect();return{text:b.textContent.trim(),inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===b};});assert.deepEqual(resultButton,{text:"繼續",inside:true,hit:true},tag+" 評比結果有可見繼續鈕");await page.locator("[data-r82a-result-close]").click();assert.equal(await page.locator("#worldModal.show").count(),0,tag+" 繼續可關閉結果");checks++;
    assert.deepEqual(errors,[],tag+" 頁面錯誤："+errors.join("；"));await context.close();console.log("OK R82A guidance layout "+tag);
  }}finally{await browser.close();server.close();}console.log("VERIFIED content R82A guidance layout ("+checks+" checks)");})().catch((error)=>{console.error(error);process.exit(1)});
