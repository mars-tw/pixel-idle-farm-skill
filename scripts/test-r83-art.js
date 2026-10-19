/* R83 actual image bindings, generated frame contracts and mobile visibility. */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'docs/evidence/r83-art');
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/generated/r83/manifest.json'),'utf8'));
const checks=[],errors=[];function check(ok,label){assert.ok(ok,label);checks.push(label);console.log('PASS '+label);}
async function main(){
  fs.mkdirSync(OUT,{recursive:true});
  check(manifest.generator==='image_gen.imagegen'&&manifest.actualModelSlug===null,'actual tool named; undisclosed model slug not invented');
  check(manifest.masters.length===18,'eighteen generated masters retained');
  for(const r of [...manifest.masters,...manifest.records])check(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,r.path))).digest('hex')===r.sha256,'hash '+r.path);
  for(const key of ['Walk','Npcs','Actions','Tend','Crops','CropsLate','CropsSeason','World','Portraits','FarmerFace','Icons'])check(manifest.qualityMetrics[key].gatePass,'brightness and saturation double gate '+key);
  check(manifest.runtimeBytes<1400*1024,'generated image delivery payload below 1.4 MiB');
  for(const row of manifest.frameReceipts)check(row.lowerBodyChangedFraction>.015 && new Set(row.hashes).size===6,`${row.sheet} direction ${row.row}: six distinct poses with lower-body change`);
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json','.ogg':'audio/ogg','.m4a':'audio/mp4'};
  const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');const f=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(path.relative(ROOT,f).startsWith('..')||!fs.existsSync(f)||fs.statSync(f).isDirectory())return res.writeHead(404).end();res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Content-Length':fs.statSync(f).size});fs.createReadStream(f).pipe(res);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const views=[];
  try{
    browser=await chromium.launch({headless:true});
    for(const [w,h] of [[390,844],[844,390],[1032,1376],[1366,600]]){
      const context=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,serviceWorkers:'block'});
      try{
        const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
        await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.__farm&&!document.querySelector('#startupLoading'));
        check(await page.locator('.sun-welcome-scene').getAttribute('src').then(s=>s.includes('r88/welcome')),'new generated welcome '+w+'x'+h);
        await page.locator('#worldSunBegin').click();
        const player=await page.locator('#player').evaluate(e=>{const r=e.getBoundingClientRect();return{width:r.width,height:r.height,image:getComputedStyle(document.querySelector('#playerSprite')).backgroundImage};});
        check(player.width>=40&&player.height>=40&&player.image.includes('r89/walk.png'),'new straw-hat walk sprite >=40 CSS pixels '+w+'x'+h);
        const bindings=await page.evaluate(()=>{const result={};for(const [sheet,prefix] of [['terrain','grass'],['crops','wheat'],['crops2','potato'],['crops3','pea'],['crops4','sunflower'],['buildings','farmhouse']]){const id=sheet==='terrain'?'grass_center_01':sheet==='buildings'?prefix:prefix+'_ready';result[sheet]=window.Atlas.getFrame(sheet,id).image;}return result;});
        check(Object.entries(bindings).every(([sheet,p])=>p.includes(sheet==='terrain'?'r88/grass-32.png':sheet==='crops'?'r89/':'r83/')),'all crop atlases, ground and farm buildings use new generated assets '+w+'x'+h);
        await page.locator('#dailyOpen').click();check(await page.locator('.daily-task-thumb').count()===3,'three direct task cards '+w+'x'+h);
        const cardHits=await page.locator('.daily-task-thumb').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));check(cardHits.every(Boolean),'task cards 44px and unobscured '+w+'x'+h);
        await page.locator('#dailyHeirloom').click();await page.locator('.heirloom-illustration').evaluate(i=>i.decode());check(await page.locator('.heirloom-illustration').getAttribute('src').then(p=>p.includes('r88/basket-512')),'basket and welcome have distinct art '+w+'x'+h);
        await page.locator('#dailyClose').click();
        // Labeled visual fixture: not claimed as earned progression. Gameplay is checked by unchanged R79/R81 real journeys.
        await page.evaluate(()=>{const s=window.__farm.state();for(let i=0;i<2;i++)window.plant(s,i,'wheat',Date.now());s.sun={plots:[0,1],used:[],startsAt:Date.now(),endsAt:Date.now()+16000,nextAt:Date.now()+60000,introduced:true};window.__farm.refresh();window.__farm.sunTick();});
        check(await page.locator('.sun-beam').count()===2&&await page.locator('.sun-beam').evaluateAll(es=>es.every(e=>getComputedStyle(e,'::before').display==='block'&&getComputedStyle(e,'::before').backgroundImage.includes('r89/leaf-light.png'))),'two rendered generated leaf-light projections '+w+'x'+h);
        check(await page.locator('.sun-beam').first().evaluate(e=>{const r=e.getBoundingClientRect();return r.height/r.width<1.1;}),'light occupies the ground, no vertical pillar '+w+'x'+h);
        if(w===390){
          await page.evaluate(()=>{const s=window.__farm.state();const tile=s.map.tiles.find(t=>t.plotIndex===0);window.__farm.focusTile(tile.id);});await page.waitForTimeout(500);
          const box=await page.locator('.sun-beam').first().boundingBox();
          const clip={x:Math.ceil(box.x+box.width*.12),y:Math.ceil(box.y+box.height*.12),width:Math.floor(box.width*.76),height:Math.floor(box.height*.76)};
          await page.screenshot({path:path.join(OUT,'sun-on.png'),clip});
          await page.addStyleTag({content:'.sun-beam{visibility:hidden!important}.sunlit-crop{filter:none!important}'});
          await page.screenshot({path:path.join(OUT,'sun-off.png'),clip});
        }
        views.push({w,h,player,bindings});
      }finally{await context.close();}
    }
    check(errors.length===0,'no uncaught runtime errors or missing assets');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
  fs.writeFileSync(path.join(OUT,'art-validation.json'),JSON.stringify({status:'VERIFIED',headless:true,fixture:'Sun shape only; no claimed earned progress',checks,views,errors},null,2));
  console.log('R83 VERIFIED '+checks.length+' checks');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
