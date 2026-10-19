const { revealFarmControl } = require("./farm-control-test-helper");
/* Store review journey. Headless only; no progress/clock injection in the main journey. */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert/strict");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), OUT = path.join(ROOT, "docs/evidence/r81-store");
const before = process.argv.includes("--before");
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
const result = { status: "EXECUTED", headless: true, injectedProgress: false, clockAccelerated: false, checks: [], journeys: [], requests: [] };
function check(ok, name) { assert.ok(ok, name); result.checks.push(name); console.log("PASS " + name); }
async function shot(page, name, store = false) {
  const dir = path.join(ROOT, store ? "docs/store/screenshots" : `docs/evidence/r81-store/${before ? "before" : "after"}`);
  fs.mkdirSync(dir, { recursive: true });
  // A cold launch can finish boot before a newly inserted narrative image decodes.
  // Store captures must contain the real loaded artwork, not its reserved layout box.
  await page.locator("img").evaluateAll(nodes => Promise.all(nodes.map(img => img.decode())));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: path.join(dir, name + ".png") });
}
async function targets(page, selector, tag) {
  const rows = await page.locator(selector).evaluateAll((nodes) => nodes.filter((e) => !e.disabled && e.getBoundingClientRect().height > 0).map((e) => {
    const r = e.getBoundingClientRect(), at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { id: e.id, w: r.width, h: r.height, inside: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, hit: at === e || e.contains(at) };
  }));
  check(rows.length > 0 && rows.every((r) => r.w >= 44 && r.h >= 44 && r.inside && r.hit), tag + " reachable 44px controls " + JSON.stringify(rows));
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2 && document.documentElement.scrollHeight <= innerHeight + 2), tag + " no page overflow");
}
async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost"), filename = path.resolve(ROOT, "." + (url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname)));
    if (path.relative(ROOT, filename).startsWith("..") || !fs.existsSync(filename) || fs.statSync(filename).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": mime[path.extname(filename)] || "application/octet-stream", "Cache-Control": "no-cache" }); fs.createReadStream(filename).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const views = process.argv.includes("--journey-only") ? [] : before ? [[390,844],[844,390],[1366,600]] : [[375,667],[390,844],[844,390],[430,932],[768,1024],[1024,768],[1032,1376],[1376,1032],[1366,600],[1280,640]];
    for (const [w,h] of views) {
      const context = await browser.newContext({ viewport: { width:w,height:h }, deviceScaleFactor:1, hasTouch:true, serviceWorkers:"block" });
      try {
        const page = await context.newPage();
        await page.goto(origin); await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"));
        await shot(page, `${w}x${h}-welcome`);
        if (before) { await page.locator("#worldBegin").click(); await shot(page, `${w}x${h}-farm`); continue; }
        await targets(page, "#worldSunBegin, #worldBegin, .world-modal-close", `${w}x${h} welcome`);
        await page.locator("#worldSunBegin").click();
        await targets(page, "#questDock button, #dailyOpen, #farmMore, #actionA", `${w}x${h} farm`);
        await page.locator("#dailyOpen").click(); await page.locator("#dailyHeirloom").click();
        await targets(page, "#dailyClose, #dailyToday, #dailyCollection, #dailyHeirloom, #heirloomGuide", `${w}x${h} recipe`);
        await shot(page, `${w}x${h}-recipe`);
      } finally { await context.close(); }
    }
    if (!before) await journey(browser, origin);
    result.status = "VERIFIED";
  } catch (error) {
    result.status = "BLOCKED"; result.error = String(error); throw error;
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
    fs.writeFileSync(path.join(OUT, before ? "before.json" : "review-results.json"), JSON.stringify(result,null,2));
  }
}
async function journey(browser, origin) {
  const profile = path.join(ROOT, ".audit-tmp", "r81-review-" + Date.now());
  const options = { headless:true, viewport:{width:430,height:932}, deviceScaleFactor:3, hasTouch:true, serviceWorkers:"allow" };
  let context = await chromium.launchPersistentContext(profile, options);
  const errors = [], requests = new Set(), failures = [];
  try {
    const page = context.pages()[0];
    page.on("pageerror",e=>errors.push(String(e)));
    page.on("request",r=>requests.add(r.url()));
    page.on("response",r=>{if(r.status()>=400)failures.push({url:r.url(),status:r.status()});});
    const began = Date.now();
    await page.goto(origin + "/?swtest");
    await page.waitForFunction(()=>window.__farm && !document.querySelector("#startupLoading"));
    // The first service-worker install replaces this document once. Start input
    // only after that actual replacement boot, rather than sampling torn globals.
    await page.waitForFunction(()=>navigator.serviceWorker.controller && sessionStorage.getItem('pixelFarmPwaAutoReloaded') && window.FarmHeirloom && window.HeirloomUI && !document.querySelector('#startupLoading'),null,{timeout:45000});
    await shot(page,"iphone-01-welcome",true);
    await page.locator("#worldSunBegin").tap();
    let sawSun = false;
    for(let i=0;i<150;i++) {
      const st = await page.evaluate(()=>({ready:window.FarmHeirloom.status(window.__farm.state()).ready,kind:window.HeirloomUI.step(window.__farm.state()).kind,moving:window.__farm.moving(),action:window.__farm.playerAction(),sun:!!document.querySelector(".sun-beam:not(.caught)")}));
      if(i%10===0)console.log("JOURNEY",i,JSON.stringify(st));
      if(st.sun && !sawSun) { sawSun=true; await page.waitForTimeout(650); await shot(page,"iphone-02-sunlight",true); }
      if(st.ready) break;
      if(!st.moving && st.action === "idle" && !["wait","deliver"].includes(st.kind)) await page.locator("#questDock [data-world-go]").tap();
      await page.waitForTimeout(1000);
    }
    const earned = await page.evaluate(()=>({h:window.FarmHeirloom.status(window.__farm.state()),stats:window.__farm.state().stats}));
    result.lastEarned=earned;
    check(sawSun && earned.h.ready && earned.stats.sunCatches>0 && earned.stats.harvested.wheat>=2,"real touch journey grew and harvested sunlight wheat without fixtures " + JSON.stringify(earned));
    await page.locator("#questDock [data-world-go]").tap();
    await targets(page,"#heirloomDoorstep, #heirloomTable, #dailyClose","earned basket choices");
    await shot(page,"iphone-03-basket",true);
    const stock = earned.h.wheat;
    await page.locator("#heirloomTable").tap();
    check(await page.locator("#heirloomTable").getAttribute("aria-pressed")==="true" && await page.evaluate(()=>!FarmHeirloom.status(__farm.state()).delivered),"selection is visible and does not deliver before confirmation");
    await page.locator("#heirloomConfirm").tap();
    await page.waitForFunction(()=>window.FarmHeirloom.status(window.__farm.state()).delivered,{},{timeout:20000});
    await page.waitForSelector("#dailyModal.show");
    const elapsedMs=Date.now()-began;
    check(elapsedMs<180000,"cold start to first remembered note under three real minutes");
    check(await page.evaluate(n=>window.__farm.state().storage.items.wheat===(n-2 || undefined),stock),"actual walk-and-impact delivery consumes exactly two wheat");
    check((await page.locator("#dailyBody").innerText()).includes("多擺一張椅子"),"chosen table story is immediately readable");
    await shot(page,"iphone-04-note",true);
    await targets(page,"#dailyClose","unlocked note return");
    await page.locator("#dailyClose").tap(); await page.locator("#dailyOpen").tap(); await shot(page,"iphone-05-daily",true);
    await page.locator("#dailyClose").tap();
    check(await page.locator("#questDock").getAttribute("data-quest")!=="first_sun_basket","completed opening returns to the larger farm story");
    await (await revealFarmControl(page, page.locator("#settingsBtn"))).tap();
    check(await page.evaluate(()=>document.querySelector(".wrap").inert),"resting in settings blocks farm input");
    const tile=await page.evaluate(()=>window.__farm.playerTileId());
    await page.keyboard.press("ArrowLeft");
    check(await page.evaluate(id=>window.__farm.playerTileId()===id,tile),"movement is blocked while settings are open");
    await page.locator("#settingsOk").tap();
    check(await page.evaluate(()=>!document.querySelector(".wrap").inert),"return from rest restores farm input");
    const cdp=await context.newCDPSession(page);
    await cdp.send("Page.setWebLifecycleState",{state:"frozen"});
    await cdp.send("Page.setWebLifecycleState",{state:"active"});
    await page.reload();
    await page.waitForFunction(()=>window.__farm && !document.querySelector("#startupLoading"));
    check(await page.evaluate(()=>window.FarmHeirloom.status(window.__farm.state()).choice==="table"),"browser freeze/resume and reload retain the remembered choice");
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{},{timeout:90000});
    await page.evaluate(async()=>{const reg=await navigator.serviceWorker.ready; if(reg.active.state!=="activated")await new Promise(resolve=>reg.active.addEventListener("statechange",resolve,{once:true}));});
    check(await page.evaluate(async()=>{const cache=await caches.open(`pixel-farm-rpg-${window.FARM_CACHE_VERSION}-static`);return (await cache.keys()).some(r=>r.url.includes("heirloom-ui.js"));}),"new story modules are actually in offline cache");
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(window.GAME.saveKey)));
    check(saved.heirloom.delivered && saved.heirloom.choice==="table","delivery written to persistent storage");
    check(errors.length===0,"review journey has no uncaught browser errors");
    check(failures.length===0,"review journey has no HTTP errors");
    check([...requests].every(url=>new URL(url).origin===origin),"all observed game requests stay on the current origin");
    result.requests=[...requests].map(url=>url.replace(origin,"<local-origin>"));
    result.journeys.push({choice:"table",elapsedMs,realClock:true,errors,failures,lifecycle:"Chromium frozen/active; not an iOS background test"});
    await context.close(); context=null;
    context=await chromium.launchPersistentContext(profile,{...options,offline:true});
    const reopened= context.pages()[0];
    await reopened.goto(origin + "/?swtest");
    await reopened.waitForFunction(()=>window.__farm && !document.querySelector("#startupLoading"));
    check(await reopened.evaluate(()=>window.FarmHeirloom.status(window.__farm.state()).delivered && window.FarmHeirloom.status(window.__farm.state()).choice==="table"),"real Chromium process restart loads earned progress with network disabled");
    await reopened.locator("#dailyOpen").tap(); await reopened.locator("#dailyHeirloom").tap();
    check(await reopened.locator("#heirloomTable,#heirloomDoorstep").count()===0,"reopened note offers no duplicate delivery");
    await shot(reopened,"offline-reopened-note");
  } finally {if(context)await context.close();}
  const tablet=await browser.newContext({viewport:{width:1032,height:1376},deviceScaleFactor:2,hasTouch:true,serviceWorkers:"block"});
  try {
    const page=await tablet.newPage(), began=Date.now(); await page.goto(origin); await page.waitForFunction(()=>window.__farm && !document.querySelector("#startupLoading"));
    await shot(page,"ipad-01-welcome",true); await page.locator("#worldSunBegin").tap();
    let sawSun=false;
    for(let i=0;i<150;i++) {
      const st=await page.evaluate(()=>({ready:window.FarmHeirloom.status(window.__farm.state()).ready,kind:window.HeirloomUI.step(window.__farm.state()).kind,moving:window.__farm.moving(),action:window.__farm.playerAction(),sun:!!document.querySelector(".sun-beam:not(.caught)")}));
      if(st.sun && !sawSun){sawSun=true;await page.waitForTimeout(650);await shot(page,"ipad-02-sunlight",true);}
      if(st.ready)break;
      if(!st.moving && st.action==="idle" && !["wait","deliver"].includes(st.kind))await page.locator("#questDock [data-world-go]").tap();
      await page.waitForTimeout(1000);
    }
    check(sawSun && await page.evaluate(()=>window.FarmHeirloom.status(window.__farm.state()).ready),"iPad independently earns the basket with real input and growth");
    await page.locator("#questDock [data-world-go]").tap(); await shot(page,"ipad-03-basket",true);
    await targets(page,"#heirloomDoorstep,#heirloomTable,#dailyClose","iPad delivery choices");
    await page.locator("#heirloomDoorstep").tap();
    check(await page.locator("#heirloomDoorstep").getAttribute("aria-pressed")==="true" && await page.evaluate(()=>!FarmHeirloom.status(__farm.state()).delivered),"selection is visible and does not deliver before confirmation");
    await page.locator("#heirloomConfirm").tap();
    await page.waitForFunction(()=>window.FarmHeirloom.status(window.__farm.state()).choice==="doorstep",{},{timeout:20000});
    await page.waitForSelector("#dailyModal.show");
    check((await page.locator("#dailyBody").innerText()).includes("門邊那一籃"),"iPad doorstep choice earns its different note through real delivery");
    const elapsedMs=Date.now()-began; check(elapsedMs<180000,"iPad first note under three real minutes");
    result.journeys.push({choice:"doorstep",elapsedMs,realClock:true,progressInjected:false});
    await shot(page,"ipad-04-note",true);
    await page.locator("#dailyClose").tap(); await page.locator("#dailyOpen").tap(); await shot(page,"ipad-05-daily",true); await page.locator("#dailyHeirloom").tap();
    await targets(page,"#dailyClose","iPad earned note");
    await page.setViewportSize({width:1376,height:1032});
    await targets(page,"#dailyClose","iPad live landscape rotation");
    await shot(page,"1376x1032-earned-note");
    await page.locator("#dailyClose").tap();
    await targets(page,"#questDock button,#farmMore,#dailyOpen","iPad live landscape farm");
  }finally{await tablet.close();}
}
run().catch((e) => { console.error(e); process.exitCode = 1; });
