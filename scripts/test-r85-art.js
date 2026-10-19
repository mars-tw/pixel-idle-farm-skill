/* R85 presentation criteria: actual rendered pixels and labeled visual fixtures. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require('playwright'),{ROOT,serve}=require('./r85-browser-helper');
const OUT=path.join(ROOT,'docs/evidence/r85-art');const rows=[],errors=[];let checks=0;
function check(ok,name){assert.ok(ok,name);checks++;console.log('PASS '+name);}
async function shot(page,name){await page.locator('img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));await page.waitForTimeout(350);await page.screenshot({path:path.join(OUT,name+'.png')});}
async function run(){
 fs.mkdirSync(OUT,{recursive:true});const m=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/generated/r85/manifest.json'),'utf8'));
 check(m.masters.length===9&&m.records.length===26&&m.generator==='image_gen.imagegen'&&m.actualModelSlug===null,'9 real masters, 26 images; actual tool and undisclosed model recorded');
 for(const r of [...m.masters,...m.records])check(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,r.path))).digest('hex')===r.sha256,'source/output hash '+r.path);
 for(const name of ['walk.png','actions.png','farming-actions.png','miri-0.png','miri-1.png','miri-2.png'])check(m.qualityMetrics['assets/generated/r85/'+name].gatePass,'character brightness/saturation double gate '+name);
 for(const r of m.frameReceipts)check(new Set(r.hashes).size===6&&r.lowerBodyChangedFraction>.015,`${r.sheet} row ${r.row}: six poses with actual limb changes`);
 const {server,origin}=await serve();let browser,success=false;
 try{
  browser=await chromium.launch({headless:true});
  for(const [w,h] of [[390,844],[844,390],[1032,1376],[1366,600]]){
   const context=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,serviceWorkers:'block'});
   try{
    const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
    await page.goto(origin);await page.waitForFunction(()=>window.__farm&&!document.querySelector('#startupLoading'));await page.locator('#worldSunBegin').click();
    // Explicit fixture: identical wheat planting time; no claim of earned progression.
    await page.evaluate(()=>{const s=__farm.state(),n=Date.now();for(let i=0;i<3;i++)s.plots[i]={cropId:'wheat',plantedAt:n-7000,wateredAt:0};s.sun={plots:[0],used:[],startsAt:n,endsAt:n+18000,nextAt:n+60000,introduced:true};const a=s.map.tiles.find(t=>t.plotIndex===0),b=s.map.tiles.find(t=>t.plotIndex===1);s.player.tileId=a.id;s.player.facing='right';__farm.refresh();__farm.sunTick();__farm.focusTile(b.id);});
    await page.waitForTimeout(650);
    const scene=await page.evaluate(()=>{const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};},s=__farm.state(),p=document.querySelector('#player'),visual=document.querySelector('#playerSprite'),crops=[...document.querySelectorAll('.ob[data-kind="crop"]')];return{sameAge:s.plots[0].plantedAt===s.plots[1].plantedAt,rootTile:p.dataset.tileId,physicsTile:s.player.tileId,root:box(p),visual:box(visual),stance:getComputedStyle(visual).translate,shadow:getComputedStyle(p,'::before').backgroundImage,beam:box(document.querySelector('.sun-beam')),leafImage:getComputedStyle(document.querySelector('.sun-beam'),'::before').backgroundImage,leafVisible:getComputedStyle(document.querySelector('.sun-beam'),'::before').display==='block',motes:document.querySelectorAll('.sun-mote').length,canopy:document.querySelector('.canopy-shadow').dataset.treeBase,crops:crops.slice(0,2).map(e=>({tile:e.dataset.tileId,lit:e.classList.contains('sunlit-crop'),filter:getComputedStyle(e).filter,box:box(e)}))};});
    check(scene.sameAge&&scene.crops.length===2&&scene.crops[0].lit&&!scene.crops[1].lit,`${w}x${h} same-age wheat in/out of sunlight`);
    check(scene.leafVisible&&scene.leafImage.includes('r89/leaf-light.png')&&scene.motes===3&&scene.beam.w>140&&scene.beam.h>110,`${w}x${h} broad ground light, generated nonuniform leaf projection and dust`);
    check(scene.rootTile===scene.physicsTile&&scene.stance.startsWith('-')&&scene.shadow.includes('radial-gradient')&&scene.canopy,`${w}x${h} feet off wheat, separate unchanged physics root and contact shadows`);
    check(scene.root.w>=40&&scene.root.h>=40,`${w}x${h} readable hero size`);
    await shot(page,`${w}x${h}-sunlight`);
    if(w===390){
     const hide=await page.addStyleTag({content:'header,#questDock,#seedHud,#worldDialogue,#farmDock,#mobileControls,#sceneActionBar,#toast-zone,.world-location{visibility:hidden!important}'});
     await shot(page,'390x844-sunlight-no-text');
     const beam=scene.beam,clip={x:Math.max(0,Math.floor(beam.x)),y:Math.max(0,Math.floor(beam.y)),width:Math.min(w-Math.max(0,Math.floor(beam.x)),Math.ceil(beam.w)),height:Math.min(h-Math.max(0,Math.floor(beam.y)),Math.ceil(beam.h))};
     await page.screenshot({path:path.join(OUT,'light-on.png'),clip});const off=await page.addStyleTag({content:'.sun-beam{visibility:hidden!important}.sunlit-crop{filter:none!important;transform:none!important}'});await page.screenshot({path:path.join(OUT,'light-off.png'),clip});await off.evaluate(e=>e.remove());await hide.evaluate(e=>e.remove());
    }
    await page.locator('#dailyOpen').click();
    const album=await page.evaluate(()=>{const today=document.querySelector('#dailyToday'),links=document.querySelector('.journal-links'),heading=document.querySelector('.daily-heading');return{dateInHeading:links.contains(today)&&!heading.contains(today),twoLinks:links.children.length===3,linksAbove:links.getBoundingClientRect().bottom<=document.querySelector('#dailyBody').getBoundingClientRect().top+1,borders:[...document.querySelectorAll('.daily-chore')].map(e=>{const c=getComputedStyle(e);return[c.borderWidth,c.borderColor];})};});
    check(album.dateInHeading&&album.twoLinks&&album.linksAbove&&new Set(album.borders.map(JSON.stringify)).size===1,`${w}x${h} single three-page navigation above content, one border system`);
    await page.evaluate(()=>{const s=__farm.state();FarmDaily.ensure(s,Date.now());s.daily.water=3;s.daily.harvest=8;s.storage.items.wheat=2;DailyUI.refresh(s);});
    for(const id of ['water','harvest','basket'])await page.locator(`[data-claim-task="${id}"]`).click();
    check(await page.locator('.chore-stamp').count()===3&&new Set(await page.locator('.chore-stamp').evaluateAll(es=>es.map(e=>e.src))).size===3&&await page.locator('.chore-stamp').evaluateAll(es=>es.every(e=>getComputedStyle(e).filter==='none'&&/r86\/stamp-(water|harvest|basket)-32/.test(e.src))),`${w}x${h} all three actual claim actions leave three distinct legible farm seals`);
    await shot(page,`${w}x${h}-stamps`);await page.locator('#dailyHeirloom').click();
    check(await page.locator('.wheat-slot').count()===1&&(await page.locator('.wheat-slot').innerText()).includes('×0'),`${w}x${h} single explicit wheat inventory quantity`);
    if(h>750)check(await page.locator('#basketBanner').isVisible(),`${w}x${h} dedicated basket banner visible`);
    await shot(page,`${w}x${h}-basket`);
    await page.evaluate(()=>{const s=__farm.state();s.heirloom={started:true,sunWheat:2,delivered:true,choice:'table'};__farm.refresh();DailyUI.openHeirloom();});
    check(await page.locator('.daily-tabs').isHidden()&&(await page.locator('#dailyModal').evaluate(e=>getComputedStyle(e).backgroundColor))==='rgb(255, 246, 227)',`${w}x${h} full paper story, no green void or journal tabs`);
    check(await page.locator('.memory-stamp').count()===0&&await page.locator('.heirloom-reply').isVisible(),`${w}x${h} story dialogue carries no completion seal`);
    await shot(page,`${w}x${h}-story`);rows.push({w,h,fixture:true,scene,album});
   }finally{await context.close();}
  }
  check(errors.length===0,'no browser errors or missing images');success=true;
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(OUT,'art-validation.json'),JSON.stringify({status:success?'VERIFIED':'BLOCKED',checks,headless:true,rows,errors,limitations:['Visual comparison fixtures are labeled. Timed human recognition and independent 8/10 rescore remain unperformed.']},null,2));}
 console.log('VERIFIED R85 '+checks+' checks');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
