"use strict";

// Regression: a watering quest must never harvest a mature crop with the water tool.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
const State = require("../src/state.js");
const Adventure = require("../src/adventure.js");

const root = path.resolve(__dirname, "..");
const saveKey = "pixel_idle_farm_save_v1";
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };

function serve() {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    const relative = path.relative(root, file);
    if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function fixture(withDryCrop, fillMature = false) {
  const now = Date.now();
  const state = State.defaultState(now);
  assert.equal(Adventure.record(state, { type: "talk", npcId: "mayor" }, now).ok, true);
  assert.equal(Adventure.record(state, { type: "plant", cropId: "wheat", count: 3 }, now).ok, true);
  state.adventure.welcomeSeen = true;
  state.plots[0].cropId = "wheat";
  state.plots[0].plantedAt = now - 60000;
  if (fillMature) {
    for (let i = 1; i < 6; i++) {
      state.plots[i].cropId = "wheat";
      state.plots[i].plantedAt = now - 60000;
    }
  } else if (withDryCrop) {
    state.plots[1].cropId = "wheat";
    state.plots[1].plantedAt = now;
  }
  return state;
}

async function runCase(browser, base, mobile, kind) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 768 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" });
  const state = fixture(kind === "dry", kind === "all-mature");
  await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: saveKey, value: state });
  const page = await context.newPage();
  try {
    await page.goto(base);
    await page.waitForFunction(() => window.__farm && document.querySelector("#questDock [data-world-go]") && !document.querySelector("#startupLoading"));
    await page.evaluate(() => { window.MOVE_MS = 5; });
    const snapshot = () => page.evaluate(() => {
      const s = window.__farm.state();
      return { plots: s.plots.slice(0, 6).map((p) => ({ cropId: p.cropId, wateredAt: p.wateredAt || 0 })), water: s.adventure.counts.water, harvested: s.stats.harvested.wheat || 0, tool: s.interaction.tool };
    });
    const pressGo = async () => {
      const button = page.locator("#questDock [data-world-go]");
      if (mobile) await button.tap(); else await button.click();
    };

    assert.equal(await page.locator("#questDock").getAttribute("data-quest"), "c1_homecoming");
    assert.match(await page.locator("#questDock").innerText(), /澆水農地/);
    await page.evaluate(() => {
      const s = window.__farm.state();
      const mature = s.map.tiles.find((tile) => tile.plotIndex === 0);
      window.__farm.setTool("water");
      window.__farm.clickTile(mature.id);
    });
    await page.waitForTimeout(550);
    let after = await snapshot();
    assert.equal(after.plots[0].cropId, "wheat", "water tool must leave mature crop intact");
    assert.equal(after.harvested, 0, "water tool must not record a harvest");

    if (kind === "dry") {
      assert.equal(await page.locator("#questDock").getAttribute("data-target-id"), await page.evaluate(() => window.__farm.state().map.tiles.find((tile) => tile.plotIndex === 1).id));
      await pressGo();
      await page.waitForFunction(() => window.__farm.state().adventure.counts.water === 1);
      after = await snapshot();
      assert.equal(after.plots[1].wateredAt > 0, true, "guide waters a growing dry crop");
      assert.equal(after.plots[0].cropId, "wheat", "guide leaves mature crop alone");
      assert.equal(after.harvested, 0);
    } else {
      await pressGo();
      if (kind === "all-mature") {
        await page.waitForFunction(() => !window.__farm.state().plots[0].cropId);
        after = await snapshot();
        assert.equal(after.harvested, 2, "guide first harvests with the hand tool when every plot is mature");
        assert.equal(after.tool, "hand");
        await pressGo();
      }
      const plantedIndex = kind === "all-mature" ? 0 : 1;
      await page.waitForFunction((i) => window.__farm.state().plots[i].cropId === "wheat", plantedIndex);
      after = await snapshot();
      assert.equal(after.tool, "hand", "guide switches to hand before planting");
      assert.equal(after.water, 0);
      if (kind !== "all-mature") assert.equal(after.plots[0].cropId, "wheat");
      await pressGo();
      await page.waitForFunction(() => window.__farm.state().adventure.counts.water === 1);
      after = await snapshot();
      assert.equal(after.plots[plantedIndex].wateredAt > 0, true);
      assert.equal(after.tool, "water");
    }
    console.log(`PASS ${mobile ? "phone" : "desktop"} ${kind}: watering guide progresses without accidental harvest`);
  } finally { await context.close(); }
}

(async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  try {
    const base = `http://127.0.0.1:${server.address().port}/`;
    for (const mobile of [false, true]) for (const kind of ["dry", "mature-and-empty", "all-mature"]) await runCase(browser, base, mobile, kind);
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
