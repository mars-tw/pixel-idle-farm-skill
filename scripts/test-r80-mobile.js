const { revealFarmControl } = require("./farm-control-test-helper");
"use strict";
// All browser work stays headless and serves only this repository on loopback.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs/evidence/r80-mobile");
const before = process.argv.includes("--before");
const views = [[390, 844, true], [844, 390, true], [1366, 600, false], [1280, 640, false]];
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
const results = { mode: before ? "before" : "after", headless: true, passed: 0, views: [] };
function check(ok, label) { assert.ok(ok, label); results.passed++; console.log("PASS " + label); }
async function boot(browser, url, width, height, mobile) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", reducedMotion: "reduce", deviceScaleFactor: 1 });
  const page = await ctx.newPage(), errors = [];
  await page.clock.install();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"));
  await page.locator("#worldBegin").click();
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}
async function capture(page, size, name) {
  await page.screenshot({ path: path.join(OUT, before ? "before" : "after", `${size}-${name}.png`) });
}
async function run() {
  fs.mkdirSync(path.join(OUT, before ? "before" : "after"), { recursive: true });
  const server = http.createServer((req, res) => {
    const filename = path.resolve(ROOT, "." + (new URL(req.url, "http://localhost").pathname === "/" ? "/index.html" : decodeURIComponent(new URL(req.url, "http://localhost").pathname)));
    const rel = path.relative(ROOT, filename);
    if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(filename) || fs.statSync(filename).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": mime[path.extname(filename)] || "application/octet-stream" }); fs.createReadStream(filename).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const [w, h, mobile] of views) {
      const { ctx, page, errors } = await boot(browser, `http://127.0.0.1:${server.address().port}`, w, h, mobile);
      try {
        await capture(page, `${w}x${h}`, "farm");
        if (!before) await verify(page, `${w}x${h}`, mobile);
        check(errors.length === 0, `${w}x${h} no page errors`);
        results.views.push({ width: w, height: h, errors });
      } finally { await ctx.close(); }
    }
  } finally { if (browser) await browser.close(); await new Promise((resolve) => server.close(resolve)); fs.writeFileSync(path.join(OUT, before ? "before.json" : "mobile-results.json"), JSON.stringify(results, null, 2)); }
  console.log(`R80 ${results.mode}: ${results.passed} passed`);
}
async function hit(page, selector, mobile) { await revealFarmControl(page, page.locator(selector)); if (mobile) await page.locator(selector).tap(); else await page.locator(selector).click(); }
async function reachable(page, selector, name) {
  const data = await page.evaluate((query) => [...document.querySelectorAll(query)].filter((e) => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return !e.disabled && r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  }).map((e) => {
    const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { id: e.id, width: r.width, height: r.height, inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, hit: hit === e || e.contains(hit) };
  }), selector);
  check(data.length > 0 && data.every((r) => r.width >= 44 && r.height >= 44 && r.inside && r.hit), name + " 44px visible hit targets " + JSON.stringify(data));
}
async function verify(page, size, mobile) {
  await reachable(page, "#dailyOpen, #farmMore, #actionA", size + " farm controls");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2 && document.documentElement.scrollHeight <= innerHeight + 2), size + " no page overflow");
  await hit(page, "#dailyOpen", mobile);
  await reachable(page, "#dailyClose, #dailyToday, #dailyCollection, .daily-task-thumb", size + " daily controls");
  check(await page.evaluate(() => document.querySelector(".wrap").inert), size + " daily blocks background controls");
  check((await page.locator("#dailyBody").innerText()).includes("添水"), size + " opens reachable first task");
  await capture(page, size, "daily");
  await hit(page, ".daily-task-thumb >> nth=1", mobile); await hit(page, ".daily-task-thumb >> nth=2", mobile);
  check((await page.locator("#dailyBody").innerText()).includes("餐籃"), size + " basket reachable in two pages");
  await reachable(page, "#dailyClose, .daily-task-thumb", size + " basket return controls");
  await hit(page, "#dailyCollection", mobile);
  check((await page.locator("#dailyBody").innerText()).includes("不用連續登入"), size + " collection explains nonconsecutive visits");
  await capture(page, size, "collection-locked");
  await hit(page, "#dailyClose", mobile);
  check(await page.evaluate(() => !document.querySelector(".wrap").inert), size + " return restores controls");
  if (!mobile) return;
  if (size === "390x844") {
    // No inventory/progress injection: follow the actual new-player buttons first.
    const start = Date.now();
    for (let i = 0; i < 10; i++) {
      await page.waitForFunction(() => !window.__farm.moving());
      await page.waitForTimeout(550);
      const water = await page.evaluate(() => window.FarmDaily.status(window.__farm.state(), Date.now()).tasks[0]);
      if (water.have >= water.need) break;
      await page.locator("#questDock [data-world-go]").tap();
      await page.waitForTimeout(1100);
    }
    const farm = await page.evaluate(() => ({ plants: window.__farm.state().stats.plantCount, water: window.FarmDaily.status(window.__farm.state(), Date.now()).tasks[0] }));
    check(farm.plants > 0 && farm.water.have >= farm.water.need && Date.now() - start < 60000, "first minute: real tutorial planting and watering progress the daily goal");
    await hit(page, "#dailyOpen", true); await reachable(page, "#dailyClaim, #dailyClose", "first daily reward");
    await hit(page, "#dailyClaim", true);
    check(await page.evaluate(() => !!window.__farm.state().daily.claimed.water), "first minute: claim real watering reward");
    await hit(page, "#dailyClose", true);
  }
  // Mature-crop fixture: the harvest itself is a real touch, walk and impact-frame mutation.
  const original = await page.evaluate(() => {
    const s = window.__farm.state(), now = Date.now();
    s.sun = { plots: [], used: [], startsAt: 0, endsAt: 0, nextAt: now + 600000, introduced: true };
    for (let i = 0; i < 4; i++) s.plots[i] = { cropId: "wheat", plantedAt: now - 60000 };
    const tile = s.map.tiles.find((t) => t.plotIndex === 0), stand = window.planMoveTo(s, tile.id).standId;
    const at = window.getTileById(s, stand); Object.assign(s.player, { tileId: at.id, x: at.x, y: at.y });
    window.MOVE_MS = 20; window.__farm.refresh();
    return s.storage.items.wheat || 0;
  });
  await page.waitForFunction(() => document.getElementById("actionA").dataset.harvest === "ready");
  await capture(page, size, "harvest-ready");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const thumb = await page.locator("#actionA").boundingBox();
  for (let i = 0; i < 3; i++) await page.touchscreen.tap(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
  await page.clock.runFor(429);
  check(await page.evaluate((n) => (window.__farm.state().storage.items.wheat || 0) === n, original), size + " repeated touch does not reward before impact");
  await page.clock.runFor(250);
  check(await page.evaluate((n) => window.__farm.state().storage.items.wheat === n + 2 && document.getElementById("actionA").getAttribute("aria-disabled") === "true", original), size + " impact stores crop while recovery remains protected");
  await page.touchscreen.tap(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
  await page.clock.runFor(500);
  check(await page.evaluate((n) => window.__farm.state().storage.items.wheat === n + 2, original), size + " repeated touch settles one crop exactly once");
  await page.clock.resume();
  await capture(page, size, "harvest-result");
  for (let i = 0; i < 3; i++) {
    const n = await page.evaluate(() => window.__farm.state().storage.items.wheat);
    await page.locator("#actionA").tap();
    await page.waitForFunction((prior) => window.__farm.state().storage.items.wheat > prior, n);
    await page.waitForTimeout(500);
  }
  check(await page.evaluate(() => window.FarmDaily.status(window.__farm.state(), Date.now()).tasks[1].ready), size + " quick harvest advances actual daily produce goal");
  await hit(page, "#dailyOpen", true);
  await hit(page, ".daily-task-thumb >> nth=1", true);
  await hit(page, "#dailyClaim", true); // harvest
  await hit(page, ".daily-task-thumb >> nth=2", true);
  const stock = await page.evaluate(() => window.__farm.state().storage.items.wheat);
  await hit(page, "#dailyClaim", true); // basket
  check(await page.evaluate((n) => window.__farm.state().storage.items.wheat === n - 2, stock), size + " basket consumes exactly two actual crops");
  check(await page.evaluate(() => document.getElementById("dailyModal").contains(document.activeElement)), size + " claim keeps focus inside the dialog");
  if (size === "390x844") {
    check(await page.evaluate(() => window.__farm.state().daily.stamps === 1 && window.__farm.state().daily.stamped), "daily loop: three earned rewards give first stamp");
    await capture(page, size, "first-stamp");
    await hit(page, "#dailyClose", true);
    await page.reload(); await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"));
    check(await page.evaluate(() => window.__farm.state().daily.stamps === 1), "daily stamp persists after real save and reload");
    await page.setViewportSize({ width: 844, height: 390 });
    await hit(page, "#dailyOpen", true);
    await reachable(page, "#dailyClose, #dailyToday, #dailyCollection", "live portrait-to-landscape rotation");
    await capture(page, "rotation-844x390", "daily");
    await hit(page, "#dailyClose", true); await page.setViewportSize({ width: 390, height: 844 });
  } else await hit(page, "#dailyClose", true);
  // Shortage is a fixture; the input must preserve both the crop and full inventory.
  const full = await page.evaluate(() => {
    const s = window.__farm.state(); s.plots[0] = { cropId: "wheat", plantedAt: Date.now() - 60000 };
    s.storage.items = { wheat: window.storageCapacity(s) }; window.__farm.refresh(); return s.storage.items.wheat;
  });
  await page.locator("#actionA").tap(); await page.waitForTimeout(850);
  check(await page.evaluate((n) => window.__farm.state().plots[0].cropId === "wheat" && window.__farm.state().storage.items.wheat === n, full), size + " full storage leaves ripe crop intact");
  // 7-day saved-game fixture demonstrates the second actual readable reward.
  await page.evaluate(() => { const s = window.__farm.state(); s.daily.stamps = 7; window.DailyUI.refresh(s); });
  await hit(page, "#dailyOpen", true); await hit(page, "#dailyCollection", true); await hit(page, "#dailyNext", true);
  check((await page.locator("#dailyBody").innerText()).includes("你的名字"), size + " seventh-stamp story is readable");
  await capture(page, size, "collection-unlocked");
  await hit(page, "#dailyClose", true);
}
run().catch((e) => { console.error(e); process.exitCode = 1; });
