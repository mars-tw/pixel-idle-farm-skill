'use strict';
/* R69 整合：實機截圖抓到的任務卡三個問題（標題與進度重疊、桌面收合重複標題、提示出現時卡片被壓出半截空框）。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const PORT = 5169;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json', '.ogg':'audio/ogg', '.m4a':'audio/mp4' };
const TMP = path.join(ROOT, '.tmp-r69-integration');
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
  const {server,intercepted}=await startServer(); const browser=await launchBrowser();
  async function open(view){
    const ctx=await browser.newContext({viewport:{width:view.w,height:view.h},isMobile:!!view.mobile,hasTouch:!!view.mobile,serviceWorkers:'block'});
      if(intercepted) await ctx.route(ORIGIN+'/**',async route=>{const u=new URL(route.request().url());const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));const rel=path.relative(ROOT,file);if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){await route.fulfill({status:404,body:''});return;}await route.fulfill({status:200,contentType:MIME[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});});
    const page=await ctx.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(ORIGIN+'/index.html'); await page.waitForFunction(()=>window.__farm&&!document.querySelector('#startupLoading'),null,{timeout:30000});
    await page.evaluate(()=>{const b=document.querySelector('#worldBegin');if(b)b.click();}); await page.waitForTimeout(700);
    return {ctx,page,errors};
  }
  const closeDialogue=(page)=>page.evaluate(()=>{const d=document.querySelector('#worldDialogue');if(d)d.hidden=true;});
  try {
    // 1) 第 4 章＋收穫祭（展開）：標題文字與進度數字不重疊
    { const {ctx,page,errors}=await open({w:1366,h:768});
      await page.evaluate(()=>{const s=window.__farm.state(),A=window.AdventureAPI,now=Date.now();A.ensure(s,now);A.quests(s,now).filter(q=>q.chapter<=3).forEach(q=>s.adventure.claimed[q.id]=true);A.ensure(s,now);const f=s.adventure.r61.festival;f.unlocked=true;f.nextAt=now-1;f.endsAt=0;A.festivalStatus(s,now);window.__farm.refresh();window.FarmWorld.refresh(s);});
      await page.waitForTimeout(600); await closeDialogue(page); await page.waitForTimeout(400);
      const r=await page.evaluate(()=>{const h=document.querySelector('#questDock .r68a-objective-head');const step=h&&h.querySelector('.qp-step');const prog=h&&[...h.children].find(e=>!e.classList.contains('qp-step'));if(!step||!prog)return null;const a=step.getBoundingClientRect(),b=prog.getBoundingClientRect();return {a:[a.left,a.right],b:[b.left,b.right],overlap:Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))};});
      assert.ok(r,'第 4 章任務卡應有標題與進度'); assert.ok(r.overlap<=1,`1366×768 收穫祭時標題與進度不可重疊：${JSON.stringify(r)}`);
      assert.deepEqual(errors,[]); await ctx.close(); console.log('OK 標題與進度不重疊'); }
    // 2) 矮筆電收合：「今日三件事」只出現一次
    { const {ctx,page,errors}=await open({w:1366,h:600});
      await page.evaluate(()=>{const s=window.__farm.state(),A=window.AdventureAPI,now=Date.now();A.ensure(s,now);s.adventure.claimed.c1_homecoming=true;window.__farm.refresh();window.FarmWorld.refresh(s);});
      await page.waitForTimeout(600); await closeDialogue(page);
      const cls=await page.locator('#questDock').getAttribute('class')||''; if(!/collapsed/.test(cls)){await page.locator("[data-audit='quest-collapse']").click();await page.waitForTimeout(400);}
      const n=await page.evaluate(()=>[...document.querySelectorAll('#questDock *')].filter(e=>e.children.length===0&&/今日三件事/.test(e.textContent)&&e.getBoundingClientRect().width>0&&getComputedStyle(e).visibility!=='hidden').length);
      assert.equal(n,1,`1366×600 收合時「今日三件事」應只出現一次（實際 ${n} 次）`);
      assert.deepEqual(errors,[]); await ctx.close(); console.log('OK 收合不重複標題'); }
    // 3) 提示訊息出現時，展開的任務卡內容不被壓成半截
    { const {ctx,page,errors}=await open({w:1366,h:768});
      await page.evaluate(()=>{const s=window.__farm.state(),A=window.AdventureAPI,now=Date.now();A.ensure(s,now);A.quests(s,now).filter(q=>q.chapter<=1).forEach(q=>s.adventure.claimed[q.id]=true);A.ensure(s,now);window.__farm.refresh();window.FarmWorld.refresh(s);});
      await page.waitForTimeout(600); await closeDialogue(page);
      const cls=await page.locator('#questDock').getAttribute('class')||''; if(/collapsed/.test(cls)){await page.locator("[data-audit='quest-collapse']").click();await page.waitForTimeout(400);}
      const r=await page.evaluate(()=>{let z=document.querySelector('#toast-zone');if(!z){z=document.createElement('div');z.id='toast-zone';document.body.appendChild(z);}const t=document.createElement('div');t.className='toast';t.textContent='量測用提示';z.appendChild(t);const q=document.querySelector('#questDock'),qr=q.getBoundingClientRect();const now=q.querySelector('.r68a-now, .r67a-now');const nr=now&&now.getBoundingClientRect();const out={dock:[qr.top,qr.bottom],now:nr&&[nr.top,nr.bottom],ov:getComputedStyle(q).overflow};t.remove();return out;});
      assert.ok(r.now,'應有「現在做」列'); assert.ok(r.now[1]<=r.dock[1]+1||r.ov==='visible',`提示出現時「現在做」不可被卡片裁成半截：${JSON.stringify(r)}`);
      assert.ok(r.now[1]-r.now[0]>=30,`「現在做」列應完整顯示：${JSON.stringify(r)}`);
      assert.deepEqual(errors,[]); await ctx.close(); console.log('OK 提示出現時不裁切'); }
    // 4) R70 整合：桌面開著手札時，第 4 章與收穫祭任務卡排成一行：文字（標題或祭典摘要）＋有字的主要按鈕，皆完整在卡內
    for (const fest of [false, true]) { const {ctx,page,errors}=await open({w:1366,h:768});
      await page.evaluate((fest)=>{const s=window.__farm.state(),A=window.AdventureAPI,now=Date.now();A.ensure(s,now);A.quests(s,now).filter(q=>q.chapter<=3).forEach(q=>s.adventure.claimed[q.id]=true);A.ensure(s,now);if(fest){const f=s.adventure.r61.festival;f.unlocked=true;f.nextAt=now-1;f.endsAt=0;A.festivalStatus(s,now);}window.__farm.refresh();window.FarmWorld.refresh(s);},fest);
      await page.waitForTimeout(500); await closeDialogue(page); await page.evaluate(()=>window.FarmWorld.openPanel('story')); await page.waitForTimeout(700);
      const r=await page.evaluate(()=>{const q=document.querySelector('#questDock'),qr=q.getBoundingClientRect();const vis=e=>e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0;const btn=[...q.querySelectorAll('button')].find(b=>!b.classList.contains('quest-collapse-btn')&&vis(b));const txt=[...q.querySelectorAll('.r82a-guidance-short, .qp-step, .r69a-collapsed-summary')].find(vis);const br=btn&&btn.getBoundingClientRect(),tr=txt&&txt.getBoundingClientRect();return {btn:btn&&btn.textContent.trim(),txt:txt&&txt.textContent.trim(),btnIn:!!br&&br.top>=qr.top-1&&br.bottom<=qr.bottom+1,txtIn:!!tr&&tr.top>=qr.top-1&&tr.bottom<=qr.bottom+1,overlap:br&&tr?Math.max(0,Math.min(br.right,tr.right)-Math.max(br.left,tr.left))*Math.max(0,Math.min(br.bottom,tr.bottom)-Math.max(br.top,tr.top)):0};});
      const tag=fest?'收穫祭':'第 4 章';
      assert.ok(r.btn&&r.btnIn,`${tag}：開手札時主要按鈕要有字且完整在卡內：${JSON.stringify(r)}`); assert.ok(r.txt&&r.txtIn,`${tag}：開手札時要看得到標題或祭典摘要：${JSON.stringify(r)}`); assert.ok(r.overlap<=1,`${tag}：按鈕不可蓋住文字：${JSON.stringify(r)}`);
      assert.deepEqual(errors,[]); await ctx.close(); console.log('OK 開手札時任務卡一行：'+tag); }
    console.log('VERIFIED content R69 integration');
  } finally { await browser.close(); if(server) server.close(); fs.rmSync(TMP,{recursive:true,force:true}); }
})().catch(e=>{console.error(e);process.exit(1);});
