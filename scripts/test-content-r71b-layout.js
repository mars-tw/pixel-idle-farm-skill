"use strict";
/* R71B：第 5～6 項——手機直式任務卡展開上限 32%、祭典收合列只留一段以「｜」分隔的摘要、
   右下互動鈕可容納「交談・老農班伯」（裝不下只留人名）、中期設施圖不超過一格半且名牌層級更高。四種尺寸。 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http"),{chromium}=require("playwright");
const ROOT=path.resolve(__dirname,".."),PORT=5197,ORIGIN=`http://127.0.0.1:${PORT}`;
const TMP=path.join(ROOT,".tmp-r71b-layout");fs.mkdirSync(TMP,{recursive:true});process.env.TEMP=TMP;process.env.TMP=TMP;process.env.TMPDIR=TMP;
const VIEWS=[[1366,768,false],[1366,600,false],[390,844,true],[844,390,true]];
const MIME={".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".webmanifest":"application/manifest+json",".ogg":"audio/ogg",".m4a":"audio/mp4"};
async function startServer(){const server=http.createServer((req,res)=>{const u=new URL(req.url,ORIGIN),file=path.resolve(ROOT,"."+(u.pathname==="/"?"/index.html":decodeURIComponent(u.pathname))),rel=path.relative(ROOT,file);if(rel.startsWith("..")||path.isAbsolute(rel)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end()}res.writeHead(200,{"Content-Type":MIME[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store"});fs.createReadStream(file).pipe(res)});try{await new Promise((ok,bad)=>{server.once("error",bad);server.listen(PORT,"127.0.0.1",ok)});return{server,intercepted:false}}catch(_){return{server:null,intercepted:true}}}
async function launch(){const opts={headless:true,args:["--no-sandbox"]};try{return await chromium.launch(opts)}catch(_){}for(const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe","C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"])if(fs.existsSync(executablePath))try{return await chromium.launch({...opts,executablePath})}catch(_){}throw Error("找不到可用瀏覽器")}
(async()=>{
  const css=fs.readFileSync(path.join(ROOT,"src/content-r58b.css"),"utf8");
  assert.match(css,/R71B（第 5 項）：手機直式任務卡展開上限改為畫面高 32%/);
  assert.match(css,/max-height:\s*32dvh/);
  assert.match(css,/R71B（第 6 項）：中期設施圖顯示寬度不超過一格半/);
  const worldUi=fs.readFileSync(path.join(ROOT,"src/world-ui.js"),"utf8");
  assert.match(worldUi,/R71B：收合列只留這一段摘要，兩段以「｜」分隔/);
  assert.match(worldUi,/祭典 \$\{festivalDone\}\/\$\{festival\.goals\.length\}｜/);
  const ui=fs.readFileSync(path.join(ROOT,"src/ui.js"),"utf8");
  assert.match(ui,/R71B：右下互動鈕裝不下完整「交談・人名」時/);
  const mid=fs.readFileSync(path.join(ROOT,"src/midgame-r66.js"),"utf8");
  assert.match(mid,/R71B：設施圖寬度不超過一格半/);
  let depth=0;for(const c of css.replace(/\/\*[\s\S]*?\*\//g,"")){if(c==="{")depth++;if(c==="}")depth--;assert.ok(depth>=0,"CSS 多了右大括號")}assert.equal(depth,0,"CSS 大括號未平衡");
  const {server,intercepted}=await startServer(),browser=await launch();
  try{for(const [w,h,mobile] of VIEWS){const ctx=await browser.newContext({viewport:{width:w,height:h},isMobile:mobile,hasTouch:mobile,serviceWorkers:"block"});if(intercepted)await ctx.route(ORIGIN+"/**",async route=>{const u=new URL(route.request().url()),file=path.resolve(ROOT,"."+(u.pathname==="/"?"/index.html":decodeURIComponent(u.pathname))),rel=path.relative(ROOT,file);if(rel.startsWith("..")||path.isAbsolute(rel)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){await route.fulfill({status:404,body:""});return}await route.fulfill({status:200,contentType:MIME[path.extname(file)]||"application/octet-stream",body:fs.readFileSync(file)})});const page=await ctx.newPage(),errors=[];page.on("pageerror",e=>errors.push(String(e)));await page.goto(ORIGIN);await page.waitForFunction(()=>window.__farm&&!document.querySelector("#startupLoading"),null,{timeout:30000});await page.evaluate(()=>document.querySelector("#worldBegin")?.click());
    const tag=`${w}×${h}`;
    // 第 5 項之一：祭典收合列只留一段摘要
    const fest=await page.evaluate(()=>{const dock=document.querySelector("#questDock");dock.dataset.quest="r71b-test";dock.className="quest-collapsed";dock.innerHTML=`<div class="world-objective-title r68a-objective-head"><span class="qp-step">第 4 章・把市集撐大一點</span><span data-audit="quest-progress">0/3</span></div><section class="r68a-now r69a-festival-now"><span><b>現在做</b><span class="r69a-collapsed-summary">祭典 0/3｜剩 9 分</span><small>祭典：收成 3 份番茄（0/3）</small></span><button class="r68a-now-action r63-primary">去種番茄</button></section><div class="r68a-requirements">完整任務內容</div>`;const vis=e=>!!e&&getComputedStyle(e).display!=="none"&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;const s=dock.querySelector(".r69a-collapsed-summary"),small=dock.querySelector("small"),r=dock.getBoundingClientRect();return{text:s.textContent.trim(),summaryVisible:vis(s),smallVisible:vis(small),dockHeight:r.height,visibleSummaries:[...dock.querySelectorAll(".r69a-collapsed-summary,.r65b-festival-compact")].filter(vis).length};});
    assert.ok(fest.summaryVisible,`${tag} 祭典收合摘要須顯示：${JSON.stringify(fest)}`);
    assert.match(fest.text,/^祭典 0\/3｜剩 9 分$/,`${tag} 祭典收合列兩段須以「｜」分隔（實際「${fest.text}」）`);
    assert.ok(!fest.text.includes("收成 3 份"),`${tag} 祭典收合列只留一段摘要，不可黏上完整目標`);
    assert.equal(fest.smallVisible,false,`${tag} 收合時完整祭典目標文字不可另成一段顯示`);
    assert.equal(fest.visibleSummaries,1,`${tag} 收合時只可有一段可見摘要`);
    assert.ok(fest.dockHeight<=53,`${tag} 祭典收合維持一行（高 ${Math.round(fest.dockHeight)}）`);
    console.log(`OK ${tag} 祭典收合：「${fest.text}」`);
    // 第 6 項：設施圖寬度與名牌層級（四種尺寸都查）
    const fac=await page.evaluate(()=>{const world=document.querySelector("#mapWorld");world.style.setProperty("--tile-size","40px");const node=document.createElement("button");node.className="r66b-map-node";node.style.cssText="left:100px;top:100px;width:200px;height:200px;z-index:500;";node.innerHTML='<img alt="" src="assets/generated/content-r70/feed-trough.png">';world.appendChild(node);const site=document.createElement("span");site.className="world-site";site.style.cssText="left:100px;top:40px;width:40px;height:40px;z-index:400;";site.innerHTML='<span class="world-site-label">花園・待修</span>';world.appendChild(site);const nr=node.getBoundingClientRect(),label=site.querySelector(".world-site-label");const out={width:nr.width,imgWidth:node.querySelector("img").getBoundingClientRect().width,nodeZ:getComputedStyle(node).zIndex,labelZ:getComputedStyle(label).zIndex};node.remove();site.remove();return out;});
    assert.ok(fac.width<=61,`${tag} 中期設施圖寬度不可超過一格半（40×1.5=60，實際 ${Math.round(fac.width)}）`);
    assert.ok(fac.imgWidth<=61,`${tag} 中期設施圖片本體不可超過一格半（實際 ${Math.round(fac.imgWidth)}）`);
    assert.ok(parseInt(fac.labelZ,10)>parseInt(fac.nodeZ,10),`${tag} 名牌層級（${fac.labelZ}）須高於設施圖（${fac.nodeZ}）`);
    console.log(`OK ${tag} 設施圖寬 ${Math.round(fac.width)}、名牌層級 ${fac.labelZ}＞設施 ${fac.nodeZ}`);
    if(mobile&&w<h){
      // 第 5 項之二：直式展開上限 32%，超出卡內捲動
      const exp=await page.evaluate(()=>{const dock=document.querySelector("#questDock");dock.dataset.quest="r71b-test";dock.className="";dock.innerHTML=`<div class="world-objective-title r68a-objective-head"><span class="qp-step">第 4 章・把市集撐大一點</span><span data-audit="quest-progress">0/3</span></div><section class="r68a-now"><span><b>現在做</b><small>前往商人蘿拉的攤位</small></span><button class="r68a-now-action r63-primary">前往商人蘿拉</button></section><div class="r68a-requirements">${"<span>完整任務內容</span>".repeat(30)}</div>`;const r=dock.getBoundingClientRect();return{height:r.height,overflowY:getComputedStyle(dock).overflowY,scrollHeight:dock.scrollHeight,clientHeight:dock.clientHeight};});
      assert.ok(exp.height<=h*0.32+2,`${tag} 直式任務卡展開高 ${Math.round(exp.height)} 不可超過畫面 32%（${Math.round(h*0.32)}）`);
      assert.equal(exp.overflowY,"auto",`${tag} 展開任務卡超出部分須在卡內捲動`);
      assert.ok(exp.scrollHeight>=exp.clientHeight,`${tag} 展開任務卡內容須可捲動`);
      console.log(`OK ${tag} 直式展開高 ${Math.round(exp.height)}／上限 ${Math.round(h*0.32)}`);
      // 第 5 項之三：右下互動鈕容納人名
      const act=await page.evaluate(()=>{const a=document.querySelector("#actionA");a.classList.remove("r32-interact-hidden");a.dataset.interactVisible="true";a.removeAttribute("aria-hidden");a.textContent="交談・老農班伯";a.title="交談・老農班伯";const r=a.getBoundingClientRect();return{text:a.textContent.trim(),left:r.left,right:r.right,width:r.width,scrollW:a.scrollWidth,clientW:a.clientWidth,iw:innerWidth};});
      assert.ok(act.text==="交談・老農班伯"||act.text==="老農班伯",`${tag} 互動鈕文字須完整或只留人名（實際「${act.text}」）`);
      assert.ok(act.scrollW<=act.clientW+1,`${tag} 互動鈕文字不可被截斷（scrollW=${act.scrollW} clientW=${act.clientW}）`);
      assert.ok(act.left>=-1&&act.right<=act.iw+1,`${tag} 互動鈕須完整在畫面內`);
      assert.ok(act.width>=150,`${tag} 互動鈕最小寬度須可容納人名（實際 ${Math.round(act.width)}）`);
      console.log(`OK ${tag} 互動鈕：「${act.text}」寬 ${Math.round(act.width)}`);
    }
    assert.deepEqual(errors,[],`${tag} 頁面錯誤`);await ctx.close()}}
  finally{await browser.close();if(server)server.close();fs.rmSync(TMP,{recursive:true,force:true})}
  console.log("VERIFIED content R71B layout");
})().catch(e=>{console.error(e);process.exit(1)});
