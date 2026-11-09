'use strict';
/* R68B：第 6 項——手機右下浮動互動按鈕完整在畫面內，長文字省略並保留完整 title。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const PORT = 5168;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json', '.ogg':'audio/ogg', '.m4a':'audio/mp4' };
const TMP = path.join(ROOT, '.tmp-r68b-layout');
fs.mkdirSync(TMP, { recursive:true }); process.env.TEMP=TMP; process.env.TMP=TMP; process.env.TMPDIR=TMP;
const VIEWS = [{w:390,h:844,mobile:true},{w:844,h:390,mobile:true}];
async function startServer(){
  const server=http.createServer((req,res)=>{ const u=new URL(req.url,ORIGIN); const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname))); const rel=path.relative(ROOT,file); if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;} res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(file).pipe(res); });
  try { await new Promise((ok,bad)=>{server.once('error',bad);server.listen(PORT,'127.0.0.1',ok);}); return {server,intercepted:false}; } catch(e){ return {server:null,intercepted:true}; }
}
async function launchBrowser(){
  const opts={headless:true,args:['--no-sandbox']};
  if(process.env.FARM_TEST_CHROME){try{return await chromium.launch({...opts,executablePath:process.env.FARM_TEST_CHROME});}catch(e){}}
  try{return await chromium.launch(opts);}catch(e){}
  for(const p of ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium']) if(fs.existsSync(p)){try{return await chromium.launch({...opts,executablePath:p});}catch(e){}}
  throw new Error('找不到可用瀏覽器');
}
(async()=>{
  const css=fs.readFileSync(path.join(ROOT,'src/content-r58b.css'),'utf8');
  const ui=fs.readFileSync(path.join(ROOT,'src/ui.js'),'utf8');
  assert.match(css,/R68B（第 6 項）：手機右下浮動互動按鈕完整留在畫面內/);
  assert.match(ui,/action\.title =/);
  { let d=0; for (const ch of css.replace(/\/\*[\s\S]*?\*\//g,'')) { if (ch==='{') d++; if (ch==='}') d--; assert.ok(d>=0,'CSS 多了右大括號'); } assert.equal(d,0,'content-r58b.css 大括號未平衡'); }
  const {server,intercepted}=await startServer(); const browser=await launchBrowser();
  try {
    for(const view of VIEWS){
      const tag=`${view.w}x${view.h}`; const ctx=await browser.newContext({viewport:{width:view.w,height:view.h},isMobile:view.mobile,hasTouch:view.mobile,serviceWorkers:'block'});
      if(intercepted) await ctx.route(ORIGIN+'/**',async route=>{const u=new URL(route.request().url());const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));const rel=path.relative(ROOT,file);if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){await route.fulfill({status:404,body:''});return;}await route.fulfill({status:200,contentType:MIME[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});});
      const page=await ctx.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
      await page.goto(ORIGIN+'/index.html'); await page.waitForFunction(()=>window.__farm&&!document.querySelector('#startupLoading'),null,{timeout:30000});
      await page.evaluate(()=>{const b=document.querySelector('#worldBegin');if(b)b.click();}); await page.waitForTimeout(700);
      // 把玩家放到老農班伯旁、面向他，讓右下浮動按鈕顯示「交談・老農班伯」
      await page.evaluate(()=>{
        const s=window.__farm.state();
        const npc=(s.map.tiles||[]).find((t)=>t.npc==='elder');
        const dirs=[{x:0,y:1,f:'up'},{x:0,y:-1,f:'down'},{x:1,y:0,f:'left'},{x:-1,y:0,f:'right'}];
        const spot=npc&&dirs.map((d)=>({d,tile:(s.map.tiles||[]).find((t)=>t.x===npc.x+d.x&&t.y===npc.y+d.y)})).find((x)=>x.tile);
        if(npc&&spot){ s.player.tileId=spot.tile.id; s.player.x=spot.tile.x; s.player.y=spot.tile.y; s.player.facing=spot.d.f; }
        window.__farm.refresh(); if(window.FarmWorld) window.FarmWorld.refresh(s);
        const dlg=document.querySelector('#worldDialogue'); if(dlg) dlg.hidden=true;
      });
      await page.waitForTimeout(900);
      const info=await page.evaluate(()=>{
        const a=document.querySelector('#actionA'); if(!a) return null;
        const r=a.getBoundingClientRect(); const cs=getComputedStyle(a);
        return {text:a.textContent.trim(),title:a.title,aria:a.getAttribute('aria-label'),visible:a.dataset.interactVisible,
          left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:r.width,h:r.height,iw:innerWidth,ih:innerHeight,
          display:cs.display,overflow:cs.overflow,textOverflow:cs.textOverflow,whiteSpace:cs.whiteSpace,scrollW:a.scrollWidth,clientW:a.clientWidth};
      });
      assert.ok(info,`${tag} 應有右下浮動互動按鈕`);
      assert.equal(info.visible,'true',`${tag} 站在老農班伯旁時浮動按鈕應看得見（實際 ${JSON.stringify(info)}）`);
      assert.match(info.text,/交談・老農班伯/,`${tag} 浮動按鈕應寫出對象（實際「${info.text}」）`);
      assert.equal(info.title,'交談・老農班伯',`${tag} 完整文字應保留在 title（實際「${info.title}」）`);
      assert.ok(info.w>0&&info.h>0&&info.display!=='none',`${tag} 浮動按鈕應實際顯示`);
      assert.ok(info.left>=-1&&info.right<=info.iw+1&&info.top>=-1&&info.bottom<=info.ih+1,`${tag} 浮動按鈕應完整在畫面內（實際 left=${Math.round(info.left)} right=${Math.round(info.right)} top=${Math.round(info.top)} bottom=${Math.round(info.bottom)} / ${info.iw}x${info.ih}）`);
      assert.ok(info.scrollW<=info.clientW+1||(info.overflow==='hidden'&&info.textOverflow==='ellipsis'),`${tag} 長文字應省略而非溢出（scrollW=${info.scrollW} clientW=${info.clientW} overflow=${info.overflow}）`);
      // 更長的標籤也不得把按鈕撐出畫面
      const longInfo=await page.evaluate(()=>{
        const a=document.querySelector('#actionA'); a.textContent='交談・老農班伯與鎮長葛瑞一起散步'; a.title='交談・老農班伯與鎮長葛瑞一起散步';
        const r=a.getBoundingClientRect(); return {left:r.left,right:r.right,iw:innerWidth,clientW:a.clientWidth,scrollW:a.scrollWidth};
      });
      assert.ok(longInfo.left>=-1&&longInfo.right<=longInfo.iw+1,`${tag} 更長標籤時按鈕仍應在畫面內（實際 right=${Math.round(longInfo.right)} / ${longInfo.iw}）`);
      assert.deepEqual(errors,[],`${tag} 頁面錯誤`);
      console.log(`OK ${tag}：浮動按鈕「${info.text}」完整在畫面內（right=${Math.round(info.right)}/${info.iw}）`);
      await ctx.close();
    }
  } finally { await browser.close(); if(server)server.close(); fs.rmSync(TMP,{recursive:true,force:true}); }
  console.log('VERIFIED content R68B layout');
})().catch(e=>{console.error(e);process.exit(1);});
