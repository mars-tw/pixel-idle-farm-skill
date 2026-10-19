/* The five Muse R7 criteria, plus proof that selecting a card never spends wheat. */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {chromium}=require('playwright'),{ROOT,serve}=require('./r85-browser-helper');
const OUT=path.join(ROOT,'docs/evidence/r89-art');let checks=0;const rows=[],errors=[];
function check(v,label){assert(v,label);checks++;console.log('PASS '+label);}
async function hit(page,selector){return page.locator(selector).evaluateAll(es=>es.filter(e=>e.offsetWidth&&!e.disabled).map(e=>{const r=e.getBoundingClientRect(),p=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id:e.id,w:r.width,h:r.height,hit:p===e||e.contains(p),inView:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};}));}
async function run(){
 fs.mkdirSync(OUT,{recursive:true});const m=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/generated/r89/manifest.json'),'utf8'));
 check(m.masters.length===9&&m.generator==='image_gen.imagegen'&&m.actualModelSlug===null,'9 actual masters, precise tool recorded without invented model slug');
 for(const r of [...m.masters,...m.records])check(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,r.path))).digest('hex')===r.sha256,'asset hash '+r.path);
 check(Object.values(m.qualityMetrics).every(v=>v.gatePass)&&m.actorReceipts.every(v=>v.identicalAlphaToR88&&v.lowerLegsUnchanged),'character double gate and original articulated poses retained');
 const {server,origin}=await serve();let browser,ok=false;
 try{browser=await chromium.launch({headless:true});for(const [w,h,scale,platform] of [[320,568,1,'small'],[390,844,1,'phone'],[844,390,1,'landscape'],[768,1024,1,'tablet'],[1366,600,1,'laptop'],[430,932,3,'iphone'],[1032,1376,2,'ipad']]){
  const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:scale,hasTouch:true,serviceWorkers:'block'});
  try{const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});await page.goto(origin);await page.waitForFunction(()=>window.__farm&&!document.querySelector('#startupLoading'));
   const welcome=await hit(page,'#worldSunBegin,.world-modal-close');check(welcome.every(v=>v.w>=44&&v.h>=44&&v.inView&&v.hit),`${w} welcome targets44`);await page.locator('#worldSunBegin').tap();
   await page.evaluate(()=>{const s=__farm.state(),n=Date.now(),at=n-effectiveGrowMs(s,'wheat',n)*.31;for(let i=0;i<2;i++)s.plots[i]={cropId:'wheat',plantedAt:at,wateredAt:0};s.plots[2]={cropId:'wheat',plantedAt:n,wateredAt:n};s.sun={plots:[0],used:[],startsAt:n,endsAt:n+90000,nextAt:n+120000,introduced:true};const a=s.map.tiles.find(t=>t.plotIndex===0),b=s.map.tiles.find(t=>t.plotIndex===1);s.player.tileId=a.id;s.player.x=a.x;s.player.y=a.y;s.player.facing='right';__farm.refresh();__farm.sunTick();s.camera.focusTileId=b.id;s.camera.focusUntil=n+120000;__farm.refresh();});await page.waitForTimeout(500);
   const light=await page.evaluate(()=>{const s=__farm.state(),a=document.querySelector('.sunlit-crop'),b=[...document.querySelectorAll('.ob.crop')].find(c=>!c.classList.contains('sunlit-crop'));return{sameAge:s.plots[0].plantedAt===s.plots[1].plantedAt,sameFrame:a.dataset.frame===b.dataset.frame,ratio:a.getBoundingClientRect().height/b.getBoundingClientRect().height,ground:getComputedStyle(document.querySelector('#mapWorld'),'::before').backgroundImage,repeat:getComputedStyle(document.querySelector('#mapWorld'),'::before').backgroundRepeat,fringe:getComputedStyle(document.querySelector('#worldFringe')).display,ray:getComputedStyle(document.querySelector('.sun-beam'),'::after').backgroundImage,physics:document.querySelector('#player').dataset.tileId===s.player.tileId,width:document.querySelector('#player').getBoundingClientRect().width};});
   check(light.sameAge&&light.sameFrame&&light.ratio>=1.2,`${w} same-age wheat clearly larger in light`);check(light.ground.includes('r89/garden-1536')&&light.repeat==='no-repeat'&&light.fringe==='none'&&light.ray.includes('r89/sunshaft'),`${w} one painted ground without repeat seams; actual upper-right ray asset`);check(light.physics&&light.width>=40,`${w} character40 and separate physics root`);
   if(platform==='iphone'||platform==='ipad'){
    await page.evaluate(()=>{const s=__farm.state(),t=s.map.tiles.find(t=>t.plotIndex===1);if(!__farm.travelAndDo(t.id,'water',()=>{}))throw Error('water preview');const p=__farm.player();p.frame=3;p.fps=0;p.acc=0;});await page.waitForFunction(()=>__farm.playerAction()==='water'&&__farm.player().frame===3);await page.waitForTimeout(700);
    // Keep shop counters identical to the same device's recorded real-input frame02.
    const journeyPath=path.join(OUT,'store-journey.json');let realEconomy=null;
    if(fs.existsSync(journeyPath)){const j=JSON.parse(fs.readFileSync(journeyPath,'utf8'));realEconomy=j.screenshots.find(v=>v.candidateStorePath.endsWith(platform+'-02-sunlight.png'))?.visual||null;}
    if(realEconomy)await page.evaluate(v=>{const s=__farm.state();s.coins=v.coins;s.storage.items={...v.storage};s.plots[3]={cropId:'wheat',plantedAt:Date.now(),wateredAt:0};__farm.refresh();},realEconomy);
    await page.evaluate(()=>{const s=__farm.state(),b=s.map.tiles.find(t=>t.plotIndex===1);s.camera.focusTileId=b.id;s.camera.focusUntil=Date.now()+120000;__farm.refresh();});await page.waitForTimeout(250);
    await page.screenshot({path:path.join(OUT,platform+'-02-sunlight.png')});
    fs.copyFileSync(path.join(OUT,platform+'-02-sunlight.png'),path.join(ROOT,'docs/store/screenshots',platform+'-02-sunlight.png'));
    const style=await page.addStyleTag({content:'header,#questDock,#seedHud,#farmDock,#worldDialogue,#mobileControls,#sceneActionBar,.world-location,.world-site-label,.sun-timer,#toast-zone{visibility:hidden!important}'});await page.screenshot({path:path.join(OUT,platform+'-no-text.png')});await style.evaluate(n=>n.remove());await page.evaluate(()=>{__farm.player().fps=7;__farm.player().acc=0;});await page.waitForFunction(()=>__farm.playerAction()==='idle');
   }
   await page.evaluate(()=>{const s=__farm.state();s.storage.items.wheat=4;s.heirloom={started:true,sunWheat:2,delivered:false,choice:null};__farm.refresh();DailyUI.openHeirloom();});
   check(await page.locator('#heirloomConfirm').isDisabled(),`${w} confirmation disabled until selection`);await page.locator('#heirloomTable').tap();await page.locator('#heirloomTable').tap();
   check(await page.evaluate(()=>__farm.state().storage.items.wheat===4&&!FarmHeirloom.status(__farm.state()).delivered),`${w} repeated selection never spends wheat`);check(await page.locator('#heirloomConfirm').innerText()==='交付小麥 ×2 給葛瑞'&&await page.locator('#heirloomTable').getAttribute('aria-pressed')==='true',`${w} selection and explicit cost visible`);
   const controls=await hit(page,'#dailyModal button:visible');await page.screenshot({path:path.join(OUT,`${w}x${h}-confirm.png`)});check(controls.every(v=>v.w>=44&&v.h>=44&&v.hit&&v.inView),`${w} every enabled paper control44 and reachable ${JSON.stringify(controls)}`);
   const rules=await page.locator('#dailyFooter').evaluate(e=>({size:parseFloat(getComputedStyle(e).fontSize),color:getComputedStyle(e).color}));check(rules.size>=12&&rules.color==='rgb(90, 62, 40)',`${w} rules readable dark tea`);
   await page.screenshot({path:path.join(OUT,`${w}x${h}-confirm.png`)});
   await page.locator('#heirloomConfirm').tap();await page.waitForFunction(()=>FarmHeirloom.status(__farm.state()).delivered,null,{timeout:20000});await page.waitForSelector('#dailyModal.show');check(await page.evaluate(()=>__farm.state().storage.items.wheat===2),`${w} only delivery impact spends exact2`);
   check(await page.locator('.heirloom-illustration').getAttribute('src').then(s=>s.includes('r89/table-result-512')),`${w} actual three-chair narrative art`);await page.locator('#dailyClose').tap();check(await page.locator('#questDock').getAttribute('data-quest')==='first_sun_basket_delivered'&&await page.locator('#questDock').innerText().then(s=>s.includes('3/3')),`${w} delivered objective cannot display0/9 reset`);
   await page.locator('#dailyOpen').tap();check(!(await page.locator('#dailyBody').innerText()).includes('種子袋裡'),`${w} no seed-bag noise in chore cards`);rows.push({w,h,light,controls,rules,welcome});
  }finally{await ctx.close();}
 }check(errors.length===0,'no browser errors or missing assets');ok=true;
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(OUT,'art-validation.json'),JSON.stringify({status:ok?'VERIFIED':'BLOCKED',checks,rows,errors,fixtureNote:'Store02 explicitly uses identical plantedAt preview and a real water pose without a game-effect callback; all other current store frames from continuous real-input journey.',independentRescore:false},null,2));}
 console.log('VERIFIED R89 '+checks+' checks; browser/server closed');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
