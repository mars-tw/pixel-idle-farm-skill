/* Art comparison captures: one headless browser, one temporary local server. */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), phase = process.argv.includes("--before") ? "before" : "after";
const mime = { ".html":"text/html", ".js":"application/javascript", ".css":"text/css", ".json":"application/json", ".png":"image/png", ".webp":"image/webp", ".ogg":"audio/ogg", ".m4a":"audio/mp4", ".webmanifest":"application/manifest+json" };
const out = path.join(ROOT, "docs/art/compare/r83", phase);
async function main() {
  fs.mkdirSync(out, {recursive:true});
  const server = http.createServer((req,res) => {
    const f = path.resolve(ROOT, "." + decodeURIComponent(new URL(req.url,"http://localhost").pathname === "/" ? "/index.html" : new URL(req.url,"http://localhost").pathname));
    if(path.relative(ROOT,f).startsWith("..") || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404).end();
    res.writeHead(200,{"Content-Type":mime[path.extname(f)] || "application/octet-stream"}); fs.createReadStream(f).pipe(res);
  });
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  let browser; const errors=[];
  try {
    browser=await chromium.launch({headless:true});
    for(const [w,h] of [[390,844],[844,390],[1032,1376],[1366,600]]) {
      const context=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,deviceScaleFactor:1,serviceWorkers:"block"});
      try {
        const page=await context.newPage(); page.on("pageerror",e=>errors.push(String(e)));
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(()=>window.__farm && !document.querySelector("#startupLoading"));
        const shot=async name=>{await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(out,`${w}x${h}-${name}.png`)});};
        await page.waitForTimeout(400); await shot("welcome");
        await page.locator("#worldSunBegin").click();
        await page.waitForTimeout(400); await shot("farm");
        await page.locator("#dailyOpen").click(); await shot("daily");
        await page.locator("#dailyHeirloom").click(); await shot("basket");
        if(phase==="after") {
          const guide=await page.locator("#heirloomGuide").evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>=44&&r.height>=44&&(hit===e||e.contains(hit));});
          if(!guide)throw Error(`${w}x${h} recipe action is obscured`);
        }
      } finally { await context.close(); }
    }
  } finally { if(browser)await browser.close(); await new Promise(r=>server.close(r)); }
  fs.writeFileSync(path.join(out,"capture.json"),JSON.stringify({phase,headless:true,errors},null,2));
  if(errors.length)throw Error(errors.join("\n"));
  console.log(`VERIFIED ${phase}: 16 screenshots, browser closed`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
