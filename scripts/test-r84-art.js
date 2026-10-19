/* Muse's five criteria, exercised in one headless browser. Fixtures are labeled. */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright');
const {revealFarmControl}=require('./farm-control-test-helper');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'docs/evidence/r84-art');
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.m4a':'audio/mp4'};
let checks=0,success=false;const views=[],errors=[];
function check(ok,name){assert.ok(ok,name);checks++;console.log('PASS '+name);}
async function shot(page,name){await page.locator('img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));await page.screenshot({path:path.join(OUT,name+'.png')});}
async function run(){
  fs.mkdirSync(OUT,{recursive:true});
  const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),f=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(path.relative(ROOT,f).startsWith('..')||!fs.existsSync(f)||fs.statSync(f).isDirectory())return res.writeHead(404).end();res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true});
    for(const [w,h] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1032,1376],[1366,600]]){
      const context=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:w<1000,serviceWorkers:'block'});
      try{
        const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
        await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.__farm&&!document.querySelector('#startupLoading'));
        await page.locator('#worldSunBegin').click();
        const geometry=await page.evaluate(()=>{
          const root=document.querySelector('#player'),visual=document.querySelector('#playerSprite'),r=root.getBoundingClientRect();
          const buttons=[...document.querySelectorAll('#farmDock button')].map(e=>{const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{w:b.width,h:b.height,y:b.y,hit:hit===e||e.contains(hit)};});
          const overlays=[...document.querySelectorAll('header,#questDock,#seedHud,#farmDock,#mobileControls button')].filter(e=>{const c=getComputedStyle(e);return c.display!=='none'&&c.visibility!=='hidden';}).map(e=>e.getBoundingClientRect());
          let clear=0,total=0;for(let y=0;y<100;y++)for(let x=0;x<100;x++){const px=(x+.5)*innerWidth/100,py=(y+.5)*innerHeight/100;total++;if(!overlays.some(b=>px>=b.left&&px<b.right&&py>=b.top&&py<b.bottom))clear++;}
          return{player:[r.width,r.height],opacity:getComputedStyle(visual).opacity,background:getComputedStyle(visual).backgroundColor,border:getComputedStyle(root).borderWidth,buttons,worldFraction:clear/total,overflow:document.documentElement.scrollWidth>innerWidth+2};
        });
        fs.writeFileSync(path.join(OUT,'last-geometry.json'),JSON.stringify({w,h,geometry},null,2));
        await shot(page,`${w}x${h}-farm`);
        check(geometry.player.every(v=>v>=40)&&geometry.opacity==='1'&&geometry.border==='0px',`${w}x${h} opaque character >=40px, no rectangle`);
        check(geometry.buttons.length===7&&geometry.buttons.every(b=>b.w>=44&&b.h>=44&&b.hit)&&new Set(geometry.buttons.map(b=>b.y)).size===1,`${w}x${h} seven 44px controls in exactly one row`);
        check(!geometry.overflow,`${w}x${h} no horizontal overflow`);
        if(h>w)check(geometry.worldFraction>=.60,`${w}x${h} world area >=60% (${geometry.worldFraction})`);
        check(await page.locator('#farmMenu').isHidden(),`${w}x${h} no right-hand test toolbar in default view`);
        await page.locator('#farmMore').click();
        const entries=await page.locator('#farmMenu button:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{w:r.width,h:r.height,hit:hit===e||e.contains(hit)};}));
        check(entries.length>=8&&entries.every(b=>b.w>=44&&b.h>=44&&b.hit),`${w}x${h} every drawer entry remains reachable`);
        await page.locator('#farmMore').click();
        await page.locator('#dailyOpen').click();
        check(await page.locator('.daily-task-thumb').count()===3&&await page.locator('#dailyNext').isHidden()&&await page.locator('#dailyPrev').isHidden(),`${w}x${h} three chores with no page arrows`);
        const cardHits=await page.locator('.daily-task-thumb').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>=44&&r.height>=44&&e.contains(hit);}));
        check(cardHits.every(Boolean),`${w}x${h} all three chores reachable without scrolling`);
        await shot(page,`${w}x${h}-daily`);
        // Reward-ready fixture; actual earned rewards remain covered by the R80 journey.
        await page.evaluate(()=>{const s=window.__farm.state();window.FarmDaily.ensure(s,Date.now());s.daily.water=3;s.daily.harvest=8;s.storage.items.wheat=2;window.DailyUI.refresh(s);});
        const claimHits=await page.locator('[data-claim-task]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>=44&&r.height>=44&&e.contains(hit);}));
        check(claimHits.length===3&&claimHits.every(Boolean),`${w}x${h} all ready rewards reachable on their cards`);
        for(const id of ['water','harvest','basket'])await page.locator(`[data-claim-task="${id}"]`).click();
        check(await page.locator('.chore-stamp').count()===3,`${w}x${h} three claimed chores visibly stamped`);
        await shot(page,`${w}x${h}-daily-stamped`);
        await page.locator('#dailyHeirloom').click();check(await page.locator('.wheat-slot').count()===1 && await page.locator('.wheat-slot strong').textContent()==='×0',`${w}x${h} one unambiguous wheat quantity slot`);
        const guide=await page.locator('#heirloomGuide').evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>=44&&r.height>=44&&e.contains(hit);});
        check(guide,`${w}x${h} recipe action reachable without scrolling`);
        await page.locator('#dailyClose').click();
        await page.evaluate(()=>window.FarmWorld.speak('鎮長 葛瑞','看，陽光照到田上了！'));
        check(await page.locator('#farmDock').isHidden()&&await page.locator('#farmDock button:visible').count()===0&&await page.locator('#mobileControls').isHidden(),`${w}x${h} dialogue hides every dock child and movement`);
        await shot(page,`${w}x${h}-dialogue`);
        await page.locator('#worldDialogue button').click();
        // Explicit visual fixtures only. Unmodified earning/economy assertions run in R79/R81.
        await page.evaluate(()=>{const s=window.__farm.state(),now=Date.now();for(let i=0;i<3;i++)s.plots[i]={cropId:'wheat',plantedAt:now-7000,wateredAt:0};s.sun={plots:[0],used:[],startsAt:now,endsAt:now+18000,nextAt:now+60000,introduced:true};window.__farm.refresh();window.__farm.sunTick();const tile=s.map.tiles.find(t=>t.plotIndex===1);window.__farm.focusTile(tile.id);});
        await page.waitForTimeout(700);
        check(await page.locator('.sun-beam').count()===1&&await page.locator('.sun-beam').evaluate(e=>getComputedStyle(e,'::before').display==='block'&&getComputedStyle(e,'::before').backgroundImage.includes('r89/leaf-light.png')),`${w}x${h} rendered generated nonuniform leaf-light projection`);
        check(await page.locator('.canopy-shadow').count()>0,`${w}x${h} actual tree shadows in world coordinates`);
        if(w===390){
          await shot(page,'390x844-sunlight');
          await page.addStyleTag({content:'#questDock,#worldDialogue{visibility:hidden!important}'});await shot(page,'390x844-sunlight-no-text');
          const samples=await page.locator('.ob[data-kind="crop"]').evaluateAll(es=>es.slice(0,2).map(e=>{const r=e.getBoundingClientRect();return{tile:e.dataset.tileId,filter:getComputedStyle(e).filter,box:{x:r.x,y:r.y,width:r.width,height:r.height}};}));
          fs.writeFileSync(path.join(OUT,'sun-comparison.json'),JSON.stringify({fixture:'Same wheat and planting time; first plot illuminated, second outside light. No claimed player study.',samples},null,2));
        }
        for(const choice of ['table','doorstep']){
          await page.evaluate(choice=>{const s=window.__farm.state();s.heirloom={started:true,sunWheat:2,delivered:true,choice};window.__farm.refresh();window.DailyUI.openHeirloom();},choice);
          check(await page.locator('.daily-tabs').isHidden()&&await page.locator('#dailyFooter').isHidden(),`${w}x${h} ${choice} result has no journal navigation`);
          check(await page.locator('header').isHidden()&&await page.locator('#questDock').isHidden()&&await page.locator('#worldDialogue').isHidden()&&await page.locator('#farmDock button:visible').count()===0&&await page.locator(':is(#seedHud,#worldMinimap,#sceneActionBar,#globalActions):visible').count()===0&&await page.locator('.memory-stamp').count()===0&&await page.locator('.heirloom-reply').isVisible(),`${w}x${h} ${choice} story has a pure spoken reply and clears every background HUD control`);
          const textVisible=await page.locator('.heirloom-paper h3,.heirloom-reply').evaluateAll(es=>es.every(e=>{const range=document.createRange();range.selectNodeContents(e);const r=range.getBoundingClientRect(),body=document.querySelector('#dailyBody').getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>0&&r.top>=body.top&&r.bottom<=body.bottom+1&&(hit===e||e.contains(hit));}));
          check(textVisible,`${w}x${h} ${choice} title and reply text remain visible and uncovered`);
          check(await page.locator('.heirloom-illustration').getAttribute('src').then(s=>s.includes((choice==='table'?'r89/':'r88/')+choice+'-result')),`${w}x${h} ${choice} has distinct aftermath art`);
          await shot(page,`${w}x${h}-${choice}-result`);await page.locator('#dailyClose').click();
        }
        await page.evaluate(()=>{const s=window.__farm.state();window.__farm.focusTile('t10_5');});await page.waitForTimeout(500);
        const objects=await page.locator('.world-keepsake').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{kind:e.dataset.kind,visible:r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight};}));
        check(objects.length===2,`${w}x${h} basket and two-chair porch are real world objects`);
        await shot(page,`${w}x${h}-world-keepsakes`);
        views.push({w,h,geometry,objects});
      }finally{await context.close();}
    }
    check(errors.length===0,'no page errors or missing assets');success=true;
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(OUT,'art-validation.json'),JSON.stringify({status:success?'VERIFIED':'BLOCKED',headless:true,checks,views,errors,limitations:['Three-second recognition needs a human blind test; no independent rescore.']},null,2));}
  console.log('VERIFIED R84 '+checks+' checks');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
