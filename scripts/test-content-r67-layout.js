'use strict';
/* R67A：任務卡三層、四尺寸高度與完整收合、手機手札避讓、陽光提示外移、主線鎖定勾選。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const PORT = 5167;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json', '.ogg':'audio/ogg', '.m4a':'audio/mp4' };
const TMP = path.join(ROOT, '.tmp-r67-layout');
fs.mkdirSync(TMP, { recursive:true }); process.env.TEMP=TMP; process.env.TMP=TMP; process.env.TMPDIR=TMP;
const VIEWS = [{w:1366,h:768,mobile:false},{w:1366,h:600,mobile:false},{w:390,h:844,mobile:true},{w:844,h:390,mobile:true}];
async function startServer(){
  const server=http.createServer((req,res)=>{ const u=new URL(req.url,ORIGIN); const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname))); const rel=path.relative(ROOT,file); if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;} res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(file).pipe(res); });
  try { await new Promise((ok,bad)=>{server.once('error',bad);server.listen(PORT,'127.0.0.1',ok);}); return {server,intercepted:false}; } catch(e){ return {server:null,intercepted:true}; }
}
async function launchBrowser(){
  const opts={headless:true,args:['--no-sandbox']};
  if(process.env.FARM_TEST_CHROME){try{return await chromium.launch({...opts,executablePath:process.env.FARM_TEST_CHROME});}catch(e){}}
  try{return await chromium.launch(opts);}catch(e){}
  for(const p of ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium']) if(fs.existsSync(p)){try{return await chromium.launch({...opts,executablePath:p});}catch(e){}}
  throw new Error('找不到可用的瀏覽器');
}
(async()=>{
  const css=fs.readFileSync(path.join(ROOT,'src/content-r58b.css'),'utf8');
  const world=fs.readFileSync(path.join(ROOT,'src/world-ui.js'),'utf8');
  assert.match(css,/R67A：今日三件事改成單一卡內三層/);
  assert.match(world,/class="r67a-now"/);
  { let d=0; for (const ch of css.replace(/\/\*[\s\S]*?\*\//g,'')) { if (ch==='{') d++; if (ch==='}') d--; assert.ok(d>=0,'CSS 多了右大括號'); } assert.equal(d,0,'content-r58b.css 大括號未平衡（合併時漏掉 }，後面的規則會被包進錯的 @media）'); } // R67 整合
  const {server,intercepted}=await startServer(); const browser=await launchBrowser();
  try {
    for(const view of VIEWS){
      const tag=`${view.w}×${view.h}`; const ctx=await browser.newContext({viewport:{width:view.w,height:view.h},isMobile:view.mobile,hasTouch:view.mobile,serviceWorkers:'block'});
      if(intercepted) await ctx.route(ORIGIN+'/**',async route=>{const u=new URL(route.request().url());const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));const rel=path.relative(ROOT,file);if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){await route.fulfill({status:404,body:''});return;}await route.fulfill({status:200,contentType:MIME[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});});
      const page=await ctx.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
      await page.goto(ORIGIN+'/index.html'); await page.waitForFunction(()=>window.__farm&&!document.querySelector('#startupLoading'),null,{timeout:30000});
      await page.evaluate(()=>{const b=document.querySelector('#worldBegin');if(b)b.click();}); await page.waitForTimeout(700);
      await page.evaluate(()=>{const s=window.__farm.state(),A=window.AdventureAPI;A.ensure(s,Date.now());s.adventure.claimed.c1_homecoming=true;s.adventure.quests.c1_homecoming.status='claimed';s.adventure.r61.daily.selected=['harvest','market','cook'];s.adventure.r61.daily.chosen=false;s.adventure.r61.daily.swapped=false;window.__farm.refresh();window.FarmWorld.refresh(s);const d=document.querySelector('#worldDialogue');if(d)d.hidden=true;});
      await page.waitForTimeout(700);
      let cls=await page.locator('#questDock').getAttribute('class')||''; if(/quest-(auto-)?collapsed|quest-target-collapsed/.test(cls)){await page.locator("[data-audit='quest-collapse']").click();await page.waitForTimeout(350);}
      const open=await page.evaluate(()=>{const box=document.querySelector('#questDock'),r=box.getBoundingClientRect(),title=box.querySelector('.world-objective-title'),now=box.querySelector('.r67a-now'),list=box.querySelector('.r67a-task-list'),pick=title&&title.querySelector('.r66a-daily-pick');return{h:r.height,ih:innerHeight,title:title&&title.innerText,now:!!now,tasks:list?[...list.children].length:0,pick:pick&&pick.innerText,hints:box.querySelectorAll('.world-objective-hint').length,directCards:[...box.children].filter(e=>e.classList.contains('world-objective-route')||e.classList.contains('r63a-main-next')).length,scrollable:box.scrollHeight>box.clientHeight+1};});
      assert.match(open.title,/今日三件事[\s\S]*0\/3/,`${tag} 標題應完整`); assert.equal(open.now,true,`${tag} 應有現在做層`); assert.equal(open.tasks,3,`${tag} 應有三件清單`); assert.equal(open.pick,'從五件中挑三件',`${tag} 五選三應在標題列`); assert.equal(open.hints,0,`${tag} 任務卡內不可放陽光／等待提示`); assert.equal(open.directCards,0,`${tag} 不可再拼接獨立任務卡`);
      const cap=view.mobile?0.40:0.45; if(!view.mobile||view.h>view.w) assert.ok(open.h<=view.h*cap+2,`${tag} 展開高 ${open.h} 超過 ${Math.round(view.h*cap)}`);
      { const over=await page.evaluate(()=>{const q=document.querySelector('#questDock'),qr=q.getBoundingClientRect();return [...q.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'&&r.right>qr.right+1;}).map(e=>e.className||e.tagName).slice(0,3);}); assert.deepEqual(over,[],`${tag} 展開時任務卡內容不可超出右緣`); } // R68 整合
      await page.locator("[data-audit='quest-collapse']").click(); await page.waitForTimeout(350);
      const folded=await page.evaluate(()=>{const box=document.querySelector('#questDock'),br=box.getBoundingClientRect(),vis=e=>e&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&e.getBoundingClientRect().height>0;const kids=[...box.children].filter(vis).map(e=>({c:e.className,r:e.getBoundingClientRect()}));return{h:br.height,w:br.width,scrollH:box.scrollHeight,clientH:box.clientHeight,kids:kids.map(x=>({c:x.c,top:x.r.top,bottom:x.r.bottom,left:x.r.left,right:x.r.right})),card:{top:br.top,bottom:br.bottom,left:br.left,right:br.right},taskVisible:vis(box.querySelector('.r67a-task-list'))};});
      assert.equal(folded.taskVisible,false,`${tag} 收合不可露出第三層`); for(const k of folded.kids) assert.ok(k.top>=folded.card.top-2&&k.bottom<=folded.card.bottom+2&&k.left>=folded.card.left-2&&k.right<=folded.card.right+2,`${tag} 收合內容 ${k.c} 不可裁切`); if(view.mobile) assert.ok(folded.h<=52.5,`${tag} 手機收合應為一行`); { const act=await page.evaluate(()=>{const b=document.querySelector('#questDock .r67a-now-action');return !!(b&&getComputedStyle(b).display!=='none'&&b.getBoundingClientRect().height>=32&&b.textContent.trim());}); assert.ok(act,`${tag} 收合時仍要看得到「現在做」的主要按鈕`); } // R67 整合
      if(view.mobile){await page.evaluate(()=>window.FarmWorld.openPanel('story'));await page.waitForTimeout(350);const hidden=await page.evaluate(()=>getComputedStyle(document.querySelector('#questDock')).display==='none');assert.equal(hidden,true,`${tag} 手札開啟時任務卡應整張隱藏`);await page.evaluate(()=>document.querySelector('.side-panel').classList.remove('world-panel-open'));await page.waitForTimeout(200);}
      if(view.w===390){
        cls=await page.locator('#questDock').getAttribute('class')||''; if(/quest-(auto-)?collapsed|quest-target-collapsed/.test(cls)){await page.locator("[data-audit='quest-collapse']").click();await page.waitForTimeout(250);}
        await page.locator('[data-r66a-daily]').click(); await page.waitForTimeout(200);
        const locked=await page.evaluate(()=>{const b=document.querySelector('.r66a-candidate.r67a-locked');return b&&{pressed:b.getAttribute('aria-pressed'),disabled:b.disabled,check:b.querySelector('.r66a-check').textContent.trim(),text:b.innerText};});
        assert.ok(locked,`${tag} 應有鎖定主線項`); assert.equal(locked.pressed,'true'); assert.equal(locked.disabled,true); assert.equal(locked.check,'✓'); assert.match(locked.text,/主線必做/); assert.match(locked.text,/🔒/);
      }
      assert.deepEqual(errors,[],`${tag} 頁面錯誤`); console.log(`OK ${tag}：展開 ${Math.round(open.h)}px、收合 ${Math.round(folded.h)}px`); await ctx.close();
    }
  } finally { await browser.close(); if(server)server.close(); fs.rmSync(TMP,{recursive:true,force:true}); }
  console.log('VERIFIED content R67A layout');
})().catch(e=>{console.error(e);process.exit(1);});
