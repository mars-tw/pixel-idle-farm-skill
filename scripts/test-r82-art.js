/* Generated-art contract, decoded alpha/palette checks and actual runtime bindings. */
"use strict";
const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert/strict"),crypto=require("crypto");
const {chromium}=require("playwright");
const ROOT=path.resolve(__dirname,".."), OUT=path.join(ROOT,"docs/evidence/r82-art");
const hash=p=>crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT,p))).digest("hex");
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,"assets/generated/r82/manifest.json"),"utf8"));
const checks=[]; function check(ok,name){assert.ok(ok,name);checks.push(name);console.log("PASS "+name);}
async function main(){
  check(manifest.generator==="image_gen.imagegen" && manifest.actualModelSlug===null,"exact tool disclosure without invented model slug");
  check(manifest.masters.length===8,"eight independently generated source assets retained");
  for(const r of [...manifest.records,...manifest.masters])check(hash(r.path)===r.sha256,"asset hash "+r.path);
  check(manifest.runtimeBytes<256*1024,"new asset payload stays below 256KiB");
  check(manifest.qualityMetrics.Farmer.gatePass,"farmer brightness and saturation double gate");
  const server=http.createServer((req,res)=>{
    const f=path.resolve(ROOT,"."+decodeURIComponent(new URL(req.url,"http://localhost").pathname==="/"?"/index.html":new URL(req.url,"http://localhost").pathname));
    if(path.relative(ROOT,f).startsWith("..")||!fs.existsSync(f)||fs.statSync(f).isDirectory())return res.writeHead(404).end();
    const ext=path.extname(f),mime={".html":"text/html",".js":"application/javascript",".css":"text/css",".png":"image/png",".webp":"image/webp",".json":"application/json"};
    res.writeHead(200,{"Content-Type":mime[ext]||"application/octet-stream"});fs.createReadStream(f).pipe(res);
  });
  await new Promise(r=>server.listen(0,"127.0.0.1",r));let browser;
  const errors=[],badResponses=[];
  try{
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:"block"});
    const page=await context.newPage();page.on("pageerror",e=>errors.push(String(e)));page.on("response",r=>{if(r.status()>=400)badResponses.push(r.url());});
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.__farm&&!document.querySelector("#startupLoading"));
    const decoded=await page.evaluate(async({records,palette})=>{
      const colors=new Set(palette.map(h=>parseInt(h.slice(1),16))),rows=[];
      for(const item of records.filter(r=>r.path.startsWith("assets/"))){
        const im=new Image();im.src=item.path;await im.decode();const c=document.createElement("canvas");c.width=im.width;c.height=im.height;const ctx=c.getContext("2d");ctx.drawImage(im,0,0);const px=ctx.getImageData(0,0,im.width,im.height).data;
        let outside=0,visible=0,partial=0;for(let i=0;i<px.length;i+=4){if(px[i+3]>0){visible++;if(!colors.has((px[i]<<16)|(px[i+1]<<8)|px[i+2]))outside++;}if(px[i+3]!==0&&px[i+3]!==255)partial++;}
        const corners=[0,im.width-1,(im.height-1)*im.width,im.width*im.height-1].map(i=>px[i*4+3]);
        rows.push({path:item.path,size:[im.width,im.height],expected:item.size,outside,partial,visible,corners,cutout:/farmer|logo|icons-128|(?:basket|note|wheat|stamp|water|seed|sun|tea)-32/.test(item.path)});
      }return rows;
    },{records:manifest.records,palette:manifest.palette});
    for(const row of decoded){check(JSON.stringify(row.size)===JSON.stringify(row.expected)&&row.visible>0&&row.outside===0,"decoded size, nonempty and common palette "+row.path);if(row.cutout)check(row.partial===0&&row.corners.every(a=>a===0),"binary alpha and clean corners "+row.path);}
    check(await page.locator(".sun-welcome-scene").evaluate(i=>i.complete&&i.naturalWidth===512),"welcome displays the generated farm-table background");
    check(await page.locator(".farm-logo").evaluate(i=>i.complete&&i.naturalWidth===320),"generated Traditional Chinese logo loaded");
    await page.locator("#worldSunBegin").tap();
    for(const [selector,file] of [[".tool-bar .i-tool-water","water-32.png"],[".daily-open .ui-icon","note-32.png"],[".seed-hud .i-crop-wheat","wheat-32.png"]]) {
      check(await page.locator(selector).first().evaluate((e,file)=>getComputedStyle(e).backgroundImage.includes("r89/"+file),file),"actual farm control uses current R88 art "+file);
    }
    await page.locator("#dailyOpen").tap();
    check(await page.locator(".daily-task-thumb img").first().evaluate(i=>i.complete&&i.naturalWidth===32),"daily task displays a native generated icon");
    await page.locator("#dailyHeirloom").tap();
    await page.locator('.heirloom-illustration').evaluate(i=>i.decode());
    check(await page.locator(".heirloom-illustration").evaluate(i=>i.complete&&i.naturalWidth===512),"basket page displays its real illustration");
    // Explicitly labeled fixtures inspect both choices and both retained story pages.
    await page.evaluate(()=>{const s=window.__farm.state();s.heirloom={started:true,sunWheat:2,delivered:false,choice:null};s.storage.items.wheat=2;window.DailyUI.openHeirloom();});
    await page.locator(".heirloom-choice-image").first().evaluate(i=>i.decode());
    check(await page.locator(".heirloom-choice-image").count()===2,"earned choice has distinct doorstep and table illustrations");
    for(const choice of ["doorstep","table"]){
      await page.evaluate(choice=>{const s=window.__farm.state();s.heirloom={started:true,sunWheat:2,delivered:true,choice};window.DailyUI.openHeirloom();},choice);
      await page.locator(".heirloom-illustration").evaluate(i=>i.decode());
      check(await page.locator(".heirloom-illustration").getAttribute("src").then(s=>s.includes((choice==='table'?'r89/':'r88/')+choice+"-result-512.webp")),choice+" story uses its own generated scene");
      await page.screenshot({path:path.join(OUT,"fixture-"+choice+".png")});
    }
    check(errors.length===0&&badResponses.length===0,"runtime has no uncaught errors or missing art");
    await context.close();
    fs.writeFileSync(path.join(OUT,"art-validation.json"),JSON.stringify({status:"VERIFIED",headless:true,fixtureNote:"Only choice/story screenshot checks use earned-state fixtures; actual earning is covered by the unchanged R81 review journey.",checks,decoded,errors,badResponses},null,2));
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
