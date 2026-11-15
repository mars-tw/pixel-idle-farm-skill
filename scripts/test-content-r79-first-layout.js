"use strict";
/* R79B：1366×768、1366×600、390×844、844×390 的第一分鐘版面驗收。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), http = require("node:http"), { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), PORT = 5297, ORIGIN = `http://127.0.0.1:${PORT}`;
const VIEWS = [[1366,768,false],[1366,600,false],[390,844,true],[844,390,true]];
const MIME = { ".html":"text/html", ".js":"application/javascript", ".css":"text/css", ".json":"application/json", ".png":"image/png", ".webp":"image/webp", ".svg":"image/svg+xml", ".webmanifest":"application/manifest+json", ".ogg":"audio/ogg", ".m4a":"audio/mp4" };
function serve() { return new Promise((resolve, reject) => { const server = http.createServer((req,res) => { const u = new URL(req.url, ORIGIN), f = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))), rel = path.relative(ROOT,f); if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream","Cache-Control":"no-store"}); fs.createReadStream(f).pipe(res); }); server.once("error",reject); server.listen(PORT,"127.0.0.1",()=>resolve(server)); }); }
async function launch() { const opts={headless:true,args:["--no-sandbox"]}; try{return await chromium.launch(opts);}catch(_){} for(const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe","C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if(fs.existsSync(executablePath)) try{return await chromium.launch({...opts,executablePath});}catch(_){} throw Error("No browser available"); }
const overlap=(a,b)=>{if(!a||!b)return 0;const w=Math.min(a.right,b.right)-Math.max(a.left,b.left),h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);return w>0&&h>0?w*h:0;};
(async()=>{
  const server=await serve(),browser=await launch();let passed=0;
  try{
    for(const [width,height,isMobile] of VIEWS){
      const tag=`${width}x${height}`,ctx=await browser.newContext({viewport:{width,height},isMobile,hasTouch:isMobile,serviceWorkers:"block"}),page=await ctx.newPage(),errors=[];
      page.on("pageerror",e=>errors.push(String(e)));
      await page.goto(ORIGIN); await page.waitForFunction(()=>window.__farm&&window.Atlas&&window.Atlas.isReady()&&!document.querySelector("#startupLoading"),null,{timeout:30000});
      await page.evaluate(()=>document.querySelector("#worldBegin")?.click());
      await page.evaluate(()=>{
        const s=__farm.state(),t=Date.now(),tile=s.map.tiles.find(x=>x.plotIndex===0); s.coins=100; s.stats.plantCount=9; s.stats.harvested={}; s.flags.r79FirstLightHarvest=false;
        s.plots[0].cropId="wheat"; s.plots[0].careMode="water"; s.plots[0].plantedAt=t-3600000; s.plots[0].wateredAt=t-3600000;
        Object.assign(s.sun,{plots:[],used:[],startsAt:0,endsAt:0,previewPlots:[0],previewAt:t+30000,nextAt:t+30000,spawned:0,refractions:0,introduced:true});
        __farm.refresh(); FarmWorld.refresh(s); __farm.focusTile(tile.id); __farm.clickTile(tile.id); __farm.cancelJourney(); __farm.renderSceneActions();
      });
      await page.waitForTimeout(500);
      const first=await page.evaluate(()=>{
        const vis=n=>{if(!n||n.hidden)return false;const r=n.getBoundingClientRect(),c=getComputedStyle(n);return r.width>0&&r.height>0&&c.display!=="none"&&c.visibility!=="hidden";};
        const box=n=>{if(!vis(n))return null;const r=n.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        const label=document.querySelector("#tileStateLabel"),actions=[...document.querySelectorAll("#sceneActionBar button")].filter(vis),plots=[...document.querySelectorAll(".gtile.farm-plot")].map(box).filter(Boolean),action=document.querySelector("#actionA"),note=document.querySelector("#r79bActionNote");
        return {label:label?label.textContent:"",labelBox:box(label),actions:actions.map(n=>n.dataset.action),plots,actionText:action?action.textContent.trim():"",note:vis(note)?note.textContent.trim():"",refract:actions.filter(n=>n.dataset.action==="refract").length};
      });
      assert.deepEqual(first.actions,["wait_light"],`${tag} 第一次只有「等光再收」一個田格動作`);
      assert.equal(first.refract,0,`${tag} 第一次收成前沒有第二個折光入口`);
      assert.match(first.label,/^等光再收・小麥/,`${tag} 標籤第一行跟下一步一致（看到「${first.label}」）`);
      assert.ok(first.label.split("\n").length<=2,`${tag} 田邊標籤最多兩行`);
      assert.equal(first.plots.some(p=>overlap(first.labelBox,p)>1),false,`${tag} 田邊標籤不蓋田（標籤 ${JSON.stringify(first.labelBox)}；田 ${JSON.stringify(first.plots)}）`);
      assert.equal(first.actionText,"等光再收",`${tag} 右下大按鈕跟選中的熟田一致`);
      if(isMobile) assert.match(first.note,/按下後等 \d+ 秒，光到會自動收成/,`${tag} 等光按鈕下方寫明結果`);

      await page.evaluate(()=>__farm.enqueueSettlement({kind:"first_harvest",coins:0,xp:3,next:"把 2 份小麥交給老農班伯。"})); await page.waitForTimeout(100);
      const settlement=await page.evaluate(()=>{const n=document.querySelector("#toast-zone .settlement-card"),r=n&&n.getBoundingClientRect();return n?{text:n.textContent,box:{left:r.left,top:r.top,right:r.right,bottom:r.bottom}}:null;});
      assert.ok(settlement,`${tag} 結算卡有顯示`); assert.doesNotMatch(settlement.text,/獲得 0 金/,`${tag} 零金幣不顯示`);
      if(height<=600) assert.equal(first.plots.some(p=>overlap(settlement.box,p)>1),false,`${tag} 矮視窗結算卡不壓田（卡 ${JSON.stringify(settlement.box)}；田 ${JSON.stringify(first.plots)}）`);
      await page.evaluate(()=>document.querySelector("#toast-zone .settlement-card")?.click()); await page.waitForTimeout(50);
      await page.evaluate(()=>{__farm.toast("第一條");__farm.toast("第二條");__farm.toast("第三條");}); await page.waitForTimeout(50);
      assert.equal(await page.locator("#toast-zone > .toast").count(),1,`${tag} 底部深色提示一次只有一條`);
      assert.deepEqual(errors,[],`${tag} 沒有頁面錯誤`);
      passed++; console.log(`PASS ${tag} 第一分鐘版面`); await ctx.close();
    }
    console.log(`R79B first-minute layout: ${passed} views passed`);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error("FAIL R79B first-minute layout\n"+error.stack);process.exitCode=1;});
