"use strict";

// Run this browser gate on the hosted runner. Use a new output directory so a
// previous run's pictures cannot satisfy this run's evidence checks.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { serve } = require("./review-capture-r85.cjs");
const { chromium } = require(process.env.R86_PLAYWRIGHT || "playwright");
const ROOT = path.resolve(__dirname, "..");
const VERSION = require("../package.json").appVersion;
const RAIN = "#journalPanel [data-r86-rain-notes]";
const OUTER = "#journalPanel .r76c-fold";
const VIEWS = [[1366, 768], [1366, 600], [390, 844], [844, 390]];

function outDir() {
  const index = process.argv.indexOf("--out");
  if (index === -1 || !process.argv[index + 1]) throw Error("Expected --out <artifact directory>");
  const result = path.resolve(process.argv[index + 1]);
  fs.mkdirSync(result, { recursive: true });
  return result;
}

async function activate(locator, mobile) {
  // Playwright scrolls as part of click/tap and re-resolves a detached button.
  // The scene action bar rebuilds its buttons on normal farm updates.
  if (mobile) await locator.tap();
  else await locator.click();
}

async function ready(page, mobile) {
  await page.waitForFunction(() => window.__farm && window.FarmWorld && window.FarmSunbook &&
    window.FarmRainplay && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading"));
  // Either the first-run card has arrived or the persisted save has seen it.
  await page.waitForFunction(() => document.querySelector("#worldBegin")?.getClientRects().length ||
    window.__farm.state().adventure?.welcomeSeen);
  if (await page.locator("#worldBegin").isVisible()) await activate(page.locator("#worldBegin"), mobile);
}

async function openBook(page, mobile) {
  await activate(page.locator("#farmMore"), mobile);
  await activate(page.locator('#farmMenu [data-tab="journal"]'), mobile);
  await page.locator('.world-panel-open [data-pane="journal"].sel').waitFor();
  await page.locator(OUTER).waitFor({ state: "attached" });
  if (!(await page.locator(OUTER).evaluate(el => el.open))) await activate(page.locator(OUTER + " > summary"), mobile);
  await page.locator(RAIN + " > summary").waitFor();
}

async function openNotes(page, mobile) {
  if (!(await page.locator(RAIN).evaluate(el => el.open))) await activate(page.locator(RAIN + " > summary"), mobile);
  await page.waitForFunction(selector => document.querySelector(selector)?.open === true, RAIN);
}

async function closeBook(page, mobile) {
  await activate(page.locator('.world-panel-open [data-pane="journal"].sel .world-close'), mobile);
  await page.waitForFunction(() => !document.querySelector(".side-panel.world-panel-open"));
}

function seedWeather() {
  const s = __farm.state(), t = Date.now();
  AdventureAPI.ensure(s, t);
  s.flags.r79FirstLightHarvest = true;
  s.adventure.claimed.c1_first_harvest = true;
  s.r75Sunplay.firstCaught = true;
  s.r75Sunplay.firstRefracted = true;
  s.stats.plantCount = Math.max(9, s.stats.plantCount || 0);
  s.stats.harvested.wheat = Math.max(1, s.stats.harvested.wheat || 0);
  s.coins = 200;
  s.level = 5;
  s.xp = CONFIG.xpForLevel(5);
  Game.ensureSunState(s);
  Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, nextAt: t + 3600000, previewPlots: [], previewAt: 0, rainbow: false });
  for (const plot of s.plots) {
    plot.cropId = null;
    delete plot.wateredAt;
  }
  const plant = Game.plant(s, 0, "corn", t);
  if (!plant.ok) throw Error("Corn fixture failed: " + JSON.stringify(plant));
  s.weather = { id: "rain", untilMs: t + 3600000 };
  const tile = s.map.tiles.find(row => row.plotIndex === 0);
  Object.assign(s.player, { tileId: tile.id, x: tile.x, y: tile.y, action: "idle" });
  __farm.cancelJourney();
  FarmRainplay.update(s, t);
  if (!s.r85Rain.spell) throw Error("Dry weather fixture");
  s.r85Rain.spell.filledMs = FarmRainplay.FILL_MS;
  __farm.refresh();
  __farm.followPlayer();
  return { tile: tile.id, resource: "corn", filledMs: s.r85Rain.spell.filledMs };
}

async function stateSnapshot(page) {
  return page.evaluate(() => {
    const s = __farm.state(), rain = s.r85Rain || {};
    return { version: window.FARM_VERSION_QUERY, notes: s.r86RainNotes || {}, count: FarmSunplay.rainNotesPage(s).count,
      crop: s.plots[0].cropId, wateredAt: s.plots[0].wateredAt || 0, harvested: s.stats.harvested.corn || 0,
      pours: rain.pours || 0, rainbows: rain.rainbows || 0,
      plots: s.sun.plots.slice(), rainbowActive: s.sun.rainbow === true && Game.sunpatchActive(s, Date.now()) };
  });
}

async function readable(locator) {
  await locator.evaluate(el => el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
  const info = await locator.evaluate(el => {
    const rect = el.getBoundingClientRect(), body = el.closest(".side-body").getBoundingClientRect();
    const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    const style = getComputedStyle(el);
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height,
      fontPx: parseFloat(style.fontSize), fitsPane: rect.left >= Math.max(body.left, 0) - 1 && rect.right <= Math.min(body.right, innerWidth) + 1,
      fitsScreen: rect.top >= -1 && rect.bottom <= innerHeight + 1, hit: top === el || el.contains(top),
      cover: top && [top.tagName, top.id, top.className].map(String).join(" ") };
  });
  assert.ok(info.fitsPane && info.fitsScreen && info.hit && info.fontPx >= 12, "Unreachable or clipped text: " + JSON.stringify(info));
  return info;
}

async function verifyPage(page, run, name, expected, out, screenshot) {
  const disclosure = page.locator(RAIN), summary = disclosure.locator(":scope > summary");
  await page.waitForFunction(({ selector, count }) => {
    const d = document.querySelector(selector);
    return d?.open && d.querySelector("summary").textContent.includes(count + "／3");
  }, { selector: RAIN, count: expected });
  const texts = await disclosure.locator("ol > li").allTextContents();
  assert.equal(texts.length, 3);
  texts.forEach((text, i) => assert.ok(text.startsWith(i < expected ? "已記下・" : "待記・"), text));
  if (expected === 3) {
    assert.match(texts[2], /玉米/);
    assert.match(await disclosure.locator(":scope > p").textContent(), /祖母.*玉米/);
  } else assert.equal(await disclosure.locator(":scope > p").count(), 0);
  const state = await stateSnapshot(page);
  assert.equal(state.count, expected);
  assert.equal(state.version, "?v=" + VERSION);
  const rows = [];
  for (const line of await disclosure.locator("ol > li, :scope > p").all()) rows.push(await readable(line));
  const control = await readable(summary);
  assert.ok(control.height >= 44 && control.width >= 44, "Rain journal target below 44px: " + JSON.stringify(control));
  const item = { name, text: texts, summary: await summary.textContent(), state, geometry: { control, rows } };
  if (screenshot) {
    item.image = run.id + "-" + name + ".png";
    await page.screenshot({ path: path.join(out, item.image), animations: "disabled" });
  }
  run.observations.push(item);
}

async function checkSurface(browser, origin, out, width, height, run) {
  const mobile = Math.min(width, height) === 390;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: mobile,
    hasTouch: mobile, reducedMotion: "reduce", serviceWorkers: "block" });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", error => run.pageErrors.push(error.message));
  page.on("response", response => {
    if (response.status() >= 400 && response.url().startsWith(origin)) run.badResponses.push([response.status(), new URL(response.url()).pathname]);
  });
  try {
    run.phase = "fresh";
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await ready(page, mobile);
    await openBook(page, mobile);
    assert.equal(await page.locator(RAIN).evaluate(el => el.open), false);
    await openNotes(page, mobile);
    await verifyPage(page, run, "fresh", 0, out, false);
    await activate(page.locator(RAIN + " > summary"), mobile);
    assert.equal(await page.locator(RAIN).evaluate(el => el.open), false);
    await closeBook(page, mobile);

    run.phase = "pour";
    run.fixture = await page.evaluate(seedWeather);
    await activate(page.locator('#mapWorld .r85b-barrel[data-stage="full"]'), mobile);
    await page.waitForFunction(() => __farm.state().r86RainNotes?.watered === true);
    await openBook(page, mobile);
    await openNotes(page, mobile);
    await verifyPage(page, run, "watered", 1, out, true);
    assert.ok(run.observations.at(-1).state.wateredAt > 0);

    run.phase = "rainbow";
    // End only the weather fixture. The normal rain ticker must produce the rainbow.
    await page.evaluate(() => { const s = __farm.state(); s.weather = { id: "clear", untilMs: Date.now() + 3600000 }; });
    await verifyPage(page, run, "landed", 2, out, false);
    assert.ok(run.observations.at(-1).state.rainbowActive && run.observations.at(-1).state.plots.includes(0));
    // Repaint with the real book injector, as the stamp notification does. It must
    // create a new disclosure and keep it open without another click.
    const replaced = await page.evaluate(selector => {
      const prev = document.querySelector(selector);
      FarmSunbook.inject(__farm.state());
      const next = document.querySelector(selector);
      return { replaced: prev !== next && !prev.isConnected, open: next.open };
    }, RAIN);
    assert.deepEqual(replaced, { replaced: true, open: true });
    run.rebuild = replaced;
    await closeBook(page, mobile);

    run.phase = "harvest";
    // Ripen the crop for this UI capture; use the ordinary harvest button for settlement.
    await page.evaluate(tile => {
      const s = __farm.state();
      s.plots[0].plantedAt = Date.now() - 3600000;
      __farm.setTool("hand");
      __farm.refresh();
      __farm.selectTile(tile);
    }, run.fixture.tile);
    await activate(page.locator('#sceneActionBar [data-action="harvest"]'), mobile);
    await page.waitForFunction(() => __farm.state().r86RainNotes?.crop === "corn");
    await openBook(page, mobile);
    await openNotes(page, mobile);
    await verifyPage(page, run, "complete", 3, out, true);
    const settled = run.observations.at(-1).state;
    assert.ok(settled.harvested > 0 && settled.pours === 1 && settled.rainbows === 1);
    const save = await page.evaluate(() => __farm.safeSaveNow());
    assert.ok(save?.ok);

    run.phase = "reload";
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(page, mobile);
    await openBook(page, mobile);
    await openNotes(page, mobile);
    await verifyPage(page, run, "reload", 3, out, false);
    assert.deepEqual(run.observations.at(-1).state.notes, settled.notes);
    assert.deepEqual(run.pageErrors, []);
    run.phase = "passed";
  } catch (error) {
    run.error = error.stack;
    run.lastState = await stateSnapshot(page).catch(() => null);
    run.lastDom = await page.locator("body").innerText({ timeout: 1500 }).then(s => s.slice(-1700)).catch(() => "");
    await page.screenshot({ path: path.join(out, run.id + "-failure.png"), timeout: 5000 }).catch(() => {});
  } finally { await context.close(); }
}

async function main() {
  const out = outDir();
  const views = VIEWS.map(([w, h]) => ({ id: w + "x" + h, observations: [], pageErrors: [], badResponses: [], phase: "not-run" }));
  const record = { revision: process.env.GITHUB_SHA || null, version: VERSION, views };
  const write = () => fs.writeFileSync(path.join(out, "measurements.json"), JSON.stringify(record, null, 2));
  write();
  const server = await serve(ROOT, 0);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.R86_CHROMIUM || undefined,
      args: ["--disable-gpu", "--disable-gpu-compositing", "--mute-audio"] });
    record.chromium = browser.version();
    for (const [i, [w, h]] of VIEWS.entries()) {
      await checkSurface(browser, "http://127.0.0.1:" + server.address().port, out, w, h, views[i]);
      write();
      console.log(views[i].id, views[i].phase, views[i].error || "");
    }
    assert.ok(views.every(run => run.phase === "passed"), "One or more R86 viewports failed, see measurements.json");
  } finally {
    if (browser) await browser.close();
    server.close();
    write();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
