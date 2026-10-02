"use strict";

// node scripts/test-world-rework-e2e.js
// FARM_URL=http://127.0.0.1:8123 uses an existing server; otherwise bind port 0.
// Chapter one is earned through UI. Fixtures below never assign adventure.claimed.
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, "tmp");
const SAVE_KEY = "pixel_idle_farm_save_v1";
const DEVICES = [
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true },
  { name: "landscape", width: 844, height: 390, mobile: true },
  { name: "small", width: 320, height: 568, mobile: true },
];
const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".mp3": "audio/mpeg", ".wav": "audio/wav",
};
let passed = 0;
const failures = [];
const touchPages = new WeakMap();
function check(ok, label, details) {
  if (ok) { passed++; if (process.env.FARM_VERBOSE === "1") console.log("PASS " + label); }
  else {
    const entry = { label, details };
    failures.push(entry);
    console.error("FAIL " + label + (details === undefined ? "" : " " + JSON.stringify(details)));
  }
}
function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let file;
      try {
        const pathname = decodeURIComponent(new URL(req.url, "http://local").pathname);
        file = path.resolve(ROOT, "." + (pathname === "/" ? "/index.html" : pathname));
      } catch (_) { res.writeHead(400); res.end(); return; }
      const rel = path.relative(ROOT, file);
      if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}
async function readState(page) { return page.evaluate(() => JSON.parse(JSON.stringify(window.__farm.state()))); }
async function ready(page) {
  await page.waitForFunction(() => window.__farm && window.FarmWorld && window.Atlas.isReady() && !document.querySelector("#startupLoading"));
}
async function openSession(browser, base, device, fixture) {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    isMobile: device.mobile, hasTouch: device.mobile,
    serviceWorkers: "block", reducedMotion: "no-preference",
  });
  if (fixture) {
    console.log("FIXTURE " + fixture.name + ": " + fixture.description);
    await context.addInitScript(({ key, state }) => {
      // Restore only on first navigation, not on reload; persistence must be genuine.
      if (!sessionStorage.getItem("r75-fixture-loaded")) {
        localStorage.setItem(key, JSON.stringify(state));
        sessionStorage.setItem("r75-fixture-loaded", "1");
      }
    }, { key: SAVE_KEY, state: fixture.state });
  }
  const page = await context.newPage();
  touchPages.set(page, device.mobile);
  page.setDefaultTimeout(7000);
  const messages = { console: [], pageerror: [], network: [] };
  page.on("console", (m) => messages.console.push({ type: m.type(), text: m.text() }));
  page.on("pageerror", (e) => messages.pageerror.push(e.stack || String(e)));
  page.on("requestfailed", (r) => messages.network.push({ url: r.url(), error: r.failure() }));
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 45000 });
  await ready(page);
  await page.evaluate(() => {
    window.__r75Events = [];
    for (const name of ["record", "claim", "cook", "restore", "fish"]) {
      const original = window.AdventureAPI[name];
      window.AdventureAPI[name] = function (...args) {
        const s = args[0];
        const inventory = () => ({ coins: s.coins, xp: s.xp, materials: { ...s.materials }, items: { ...s.storage.items }, meals: { ...s.adventure.meals }, catch: { ...s.adventure.catch } });
        const before = inventory();
        const result = original.apply(this, args);
        window.__r75Events.push({ name, arg: args[1], ok: result.ok, reason: result.reason,
          before, after: inventory(), player: { ...s.player }, result });
        return result;
      };
    }
  });
  return { context, page, messages, tag: fixture ? fixture.name : device.name };
}
function checkErrors(session) {
  const errors = session.messages.console.filter((m) => m.type === "error");
  check(!errors.length && !session.messages.pageerror.length && !session.messages.network.length,
    session.tag + " no console/pageerror/requestfailed", session.messages);
  if (session.messages.console.length) console.log("CONSOLE " + session.tag + " " + JSON.stringify(session.messages.console));
}
async function activate(page, locator) {
  // Touch devices use genuine taps, including pointerType=touch scene behavior.
  if (touchPages.get(page)) await locator.tap();
  else await locator.click();
}
async function failureState(page) {
  const s = await readState(page).catch(() => null);
  return s && { player: s.player, coins: s.coins, xp: s.xp, items: s.storage.items,
    materials: s.materials, counts: s.adventure.counts, claimed: s.adventure.claimed };
}
function compactError(e) {
  const lines = e.message.replace(/\u001b\[[0-9;]*m/g, "").split("\n");
  return { message: lines[0], intercept: lines.find((line) => line.includes("intercepts pointer events")),
    at: (e.stack || "").split("\n").filter((line) => line.includes("test-world-rework-e2e.js:")).slice(-4) };
}
async function dismissDialogue(page) {
  const close = page.locator("#worldDialogue:not([hidden]) button");
  if (await close.isVisible()) await activate(page, close);
}
async function go(page) {
  await dismissDialogue(page);
  await activate(page, page.locator("#questDock [data-world-go]"));
}
async function waitCount(page, type, count) {
  await page.waitForFunction(({ type, count }) => window.__farm.state().adventure.counts[type] >= count, { type, count });
  // The objective closure is rebuilt on a 750ms tick; do not click stale targets.
  await page.waitForTimeout(780);
}
async function metrics(page, selector) {
  return page.evaluate((query) => [...document.querySelectorAll(query)].filter((e) => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !e.disabled && !e.closest("[hidden]");
  }).map((e) => {
    const r = e.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { label: e.id || e.getAttribute("aria-label") || e.dataset.tool || e.textContent.trim().slice(0, 25),
      rect: [r.x, r.y, r.width, r.height],
      inView: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
      hit: !!hit && (hit === e || e.contains(hit)),
      blockedBy: hit && (hit.id || hit.className || hit.tagName) };
  }), selector);
}
async function checkControls(page, tag, selector, limit = Infinity) {
  const rows = (await metrics(page, selector)).slice(0, limit);
  check(rows.length > 0 && rows.every((r) => r.inView && r.hit), tag + " visible controls in viewport and hit-test reachable",
    rows.filter((r) => !r.inView || !r.hit));
  return rows;
}
async function geometry(page, tag) {
  // HUD placement is reconciled every 750ms after resource chips wrap.
  await page.waitForTimeout(850);
  const result = await page.evaluate(() => {
    const scene = document.querySelector("#mapScene"), r = scene.getBoundingClientRect();
    const tile = document.querySelector(".gtile"), tr = tile.getBoundingClientRect(), ts = getComputedStyle(tile);
    const fixed = ["header", "#questDock", "#seedRow", "#toolBar", ".side-tabs", ".toolbar"];
    const overflow = fixed.flatMap((query) => [...document.querySelectorAll(query)].filter((e) => e.getBoundingClientRect().width).map((e) => {
      const r = e.getBoundingClientRect();
      return { query, rect: [r.x, r.y, r.width, r.height], scroll: [e.scrollWidth, e.clientWidth] };
    })).filter((e) => e.rect[0] < -1 || e.rect[0] + e.rect[2] > innerWidth + 1 || e.rect[1] < -1 || e.rect[1] + e.rect[3] > innerHeight + 1 || e.scroll[0] > e.scroll[1] + 1);
    const chapter = document.querySelector("#questDock .world-chapter").getBoundingClientRect();
    const chapterHit = document.elementFromPoint(chapter.x + 8, chapter.y + chapter.height / 2);
    return { viewport: [innerWidth, innerHeight], scene: [r.x, r.y, r.width, r.height],
      document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      mode: scene.dataset.mapMode, tile: tr.width, borders: [ts.borderTopWidth, ts.borderRightWidth, ts.boxShadow], overflow,
      chapterReadable: !!chapterHit && !!chapterHit.closest("#questDock"), chapterBlockedBy: chapterHit && (chapterHit.className || chapterHit.id) };
  });
  check(JSON.stringify(result.scene) === JSON.stringify([0, 0, ...result.viewport]), tag + " scene fills viewport", result);
  check(result.mode === "natural" && result.tile >= 64, tag + " natural tiles >=64", result.tile);
  check(result.document[0] <= result.viewport[0] && result.document[1] <= result.viewport[1] && !result.overflow.length,
    tag + " no document/fixed-HUD overflow", result.overflow);
  check(result.borders.every((v) => v === "0px" || v === "none"), tag + " no tile grid borders", result.borders);
  check(result.chapterReadable, tag + " chapter label not occluded", result.chapterBlockedBy);
}
async function checkModal(page, tag, selector) {
  const before = await readState(page);
  const result = await page.evaluate((query) => {
    const m = document.querySelector(query), shell = document.querySelector(".wrap");
    const r = m.querySelector(".modal-card").getBoundingClientRect();
    return { inert: shell.inert && shell.hasAttribute("inert"), role: m.getAttribute("role"),
      aria: m.getAttribute("aria-modal"), focus: m.contains(document.activeElement),
      rect: [r.x, r.y, r.width, r.height],
      inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
  }, selector);
  check(result.inert && result.role === "dialog" && result.aria === "true" && result.focus && result.inView,
    tag + " modal inert/role/focus/bounds", result);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("e");
  for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
  const focus = await page.locator(selector).evaluate((m) => ({ inside: m.contains(document.activeElement), target: document.activeElement.tagName + "#" + document.activeElement.id }));
  check(focus.inside, tag + " Tab focus stays in modal", focus);
  await page.mouse.click(2, 2);
  const after = await readState(page);
  check(before.player.tileId === after.player.tileId && before.coins === after.coins && JSON.stringify(before.adventure.counts) === JSON.stringify(after.adventure.counts),
    tag + " backdrop/keyboard cannot activate farm");
}
async function modalEscape(page, tag, selector) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(80);
  check(!await page.locator(selector).isVisible() && !await page.locator(".wrap").evaluate((e) => e.inert), tag + " Escape closes modal and removes inert");
}
async function menus(page, tag) {
  for (const name of ["tile", "orders", "upgrades", "story", "journal"]) {
    const tab = page.locator(`.side-tab[data-tab="${name}"]`);
    await activate(page, tab);
    check(await page.locator(".side-panel").evaluate((e) => e.classList.contains("world-panel-open")), tag + " opens " + name);
    const body = await page.locator(".side-body").boundingBox();
    const before = await readState(page);
    await page.mouse.click(body.x + 3, body.y + 3);
    await page.waitForTimeout(60);
    const after = await readState(page);
    check(before.player.tileId === after.player.tileId && before.interaction.selectedTileId === after.interaction.selectedTileId,
      tag + " " + name + " menu interior does not hit map");
    const close = page.locator(".side-pane.sel .world-close").first();
    if (await close.count()) {
      await close.scrollIntoViewIfNeeded();
      await checkControls(page, tag + " " + name + " close", ".side-pane.sel .world-close", 1);
      await activate(page, close);
    } else {
      check(false, tag + " " + name + " menu has no close control");
      await page.keyboard.press("Escape");
    }
  }
  await activate(page, page.locator('.side-tab[data-tab="story"]'));
  const point = await page.evaluate(() => {
    const s = window.__farm.state();
    for (const tile of s.map.tiles) {
      if (!window.Game.isWalkable(s, tile) || tile.plotIndex != null || tile.id === s.player.tileId) continue;
      const e = document.querySelector(`.gtile[data-tile-id="${tile.id}"]`);
      if (!e) continue;
      const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (x > 5 && x < innerWidth - 5 && y > 5 && y < innerHeight - 5 && hit && hit.closest(".gtile") === e) return { x, y, tileId: tile.id };
    }
    return null;
  });
  if (!point) throw new Error("No actual exposed walkable map point for menu dismissal test");
  const before = await readState(page);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(700);
  const after = await readState(page);
  check(!await page.locator(".side-panel").evaluate((e) => e.classList.contains("world-panel-open")), tag + " outside click closes menu");
  check(before.player.tileId === after.player.tileId && before.interaction.selectedTileId === after.interaction.selectedTileId,
    tag + " outside menu dismissal consumes map click", { point, before: before.player.tileId, after: after.player.tileId, selected: after.interaction.selectedTileId });
}
async function claimUI(page, tag, id) {
  await page.waitForFunction((id) => document.querySelector("#questDock").dataset.quest === id && document.querySelector("[data-world-go]").textContent === "交付", id);
  const before = await readState(page);
  await go(page);
  await page.waitForFunction((id) => window.__farm.state().adventure.claimed[id] === true, id);
  await page.waitForTimeout(780);
  const event = await page.evaluate((id) => window.__r75Events.find((e) => e.name === "claim" && e.arg === id && e.ok), id);
  const q = await page.evaluate((id) => window.AdventureAPI.quests(window.__farm.state(), Date.now()).find((q) => q.id === id), id);
  const after = await readState(page);
  const npc = after.map.tiles.find((t) => t.npc === q.npcId);
  check(event && Math.abs(event.player.x - npc.x) + Math.abs(event.player.y - npc.y) === 1,
    tag + " " + id + " delivery occurs adjacent to NPC", event && event.player);
  check(event && event.after.coins - event.before.coins === q.reward.coins && event.after.xp - event.before.xp === q.reward.xp
    && Object.entries(q.reward.materials).every(([k, v]) => (event.after.materials[k] || 0) - (event.before.materials[k] || 0) === v),
  tag + " " + id + " rewards granted once with exact deltas", event);
  // Negative API probe is separate from completion; no progress or claimed flags are forged.
  const duplicate = await page.evaluate((id) => {
    const s = window.__farm.state();
    const money = JSON.stringify([s.coins, s.xp, s.materials, s.storage.items, s.adventure.meals]);
    const r = window.AdventureAPI.claim(s, id, Date.now());
    return { reason: r.reason, unchanged: money === JSON.stringify([s.coins, s.xp, s.materials, s.storage.items, s.adventure.meals]) };
  }, id);
  check(duplicate.reason === "already_claimed" && duplicate.unchanged, tag + " " + id + " duplicate reward rejected", duplicate);
  check(before.adventure.claimed[id] !== true && after.adventure.claimed[id] === true, tag + " " + id + " earned via real UI");
  await dismissDialogue(page);
}
async function cropAction(page, tag, index, action) {
  await dismissDialogue(page);
  const before = await readState(page);
  const tile = before.map.tiles.find((t) => t.plotIndex === index);
  const tool = action === "water" ? "water" : "hand";
  const toolName = await page.evaluate((id) => window.TOOLS[id].name, tool);
  await activate(page, page.locator("#toolBar").getByRole("button", { name: toolName, exact: true }));
  const focus = before.map.tiles.find((t) => t.x === tile.x + 1 && t.y === tile.y) || tile;
  // Keep the crop beside the fixed, centered action dock instead of underneath it.
  await page.evaluate((id) => window.__farm.focusTile(id), focus.id);
  await page.waitForTimeout(250);
  const point = await page.evaluate((id) => {
    const r = document.querySelector(`.gtile[data-tile-id="${id}"]`).getBoundingClientRect();
    // Crop sprites legitimately receive the tile's clicks. Hit the real exposed
    // crop/soil surface, not a ground locator hidden underneath the sprite.
    for (const fy of [.5, .8, .2, .95, .05]) for (const fx of [.5, .8, .2, .95, .05]) {
      const x = r.x + r.width * fx, y = r.y + r.height * fy;
      const hit = document.elementFromPoint(x, y), owner = hit && hit.closest("[data-tile-id]");
      if (x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && owner && owner.dataset.tileId === id) return { x, y };
    }
    return null;
  }, tile.id);
  check(!!point, tag + " " + action + " crop has exposed hit-test surface", tile.id);
  if (!point) { await go(page); return; }
  if (touchPages.get(page)) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  if (touchPages.get(page)) {
    const selected = await readState(page);
    check(selected.interaction.selectedTileId === tile.id && JSON.stringify(selected.plots[index]) === JSON.stringify(before.plots[index]),
      tag + " " + action + " true crop tap selects without mutating");
    const selector = `#sceneActionBar [data-action="${action}"]`;
    const rows = await checkControls(page, tag + " " + action + " touch dock", selector);
    // Ready crops intentionally start delayed harvest on the first map tap.
    // Do not issue a second harvest or mistake its pending impact for click-through.
    if (action === "harvest") {
      const pending = await readState(page);
      check(JSON.stringify(pending.plots[index]) === JSON.stringify(before.plots[index]), tag + " harvest map tap precedes delayed impact");
      return;
    }
    if (!rows.length || rows.some((r) => !r.inView || !r.hit)) {
      // Keep the failure and prove actual tap interception, then continue via another genuine UI route.
      try { await page.locator(selector).tap({ timeout: 800 }); }
      catch (e) { console.log("REPRO " + tag + " " + action + " " + JSON.stringify(compactError(e))); }
      check(JSON.stringify((await readState(page)).plots[index]) === JSON.stringify(before.plots[index]), tag + " blocked crop dock tap leaves state unchanged");
      await go(page);
      return;
    }
    await activate(page, page.locator(selector));
  }
  const immediate = await readState(page);
  check(JSON.stringify(immediate.plots[index]) === JSON.stringify(before.plots[index]), tag + " " + action + " click precedes impact/state mutation");
}
async function chapterOne(page, tag) {
  // The first trip uses real timing so different walk frames can be observed.
  await page.evaluate(() => { window.MOVE_MS = 200; });
  if (!(await readState(page)).adventure.byTarget.talk.mayor) {
    await go(page);
    const frames = new Set();
    for (let i = 0; i < 12; i++) {
      const frame = await page.evaluate(() => {
        const e = document.querySelector("#playerSprite"), s = getComputedStyle(e);
        return window.__farm.state().player.action === "walk" ? s.backgroundImage + "|" + s.backgroundPosition : null;
      });
      if (frame) frames.add(frame);
      await page.waitForTimeout(60);
    }
    check(frames.size >= 2, tag + " walking changes sprite atlas frames, not only transform", [...frames]);
    await waitCount(page, "talk", 1);
  }
  await page.evaluate(() => { window.MOVE_MS = 10; });
  const mayor = await page.evaluate(() => window.__r75Events.find((e) => e.name === "record" && e.arg.npcId === "mayor"));
  const state = await readState(page), mayorTile = state.map.tiles.find((t) => t.npc === "mayor");
  check(mayor && Math.abs(mayor.player.x - mayorTile.x) + Math.abs(mayor.player.y - mayorTile.y) === 1, tag + " mayor conversation occurs adjacent", mayor);
  for (let n = 1; n <= 3; n++) { if (n === 1) await cropAction(page, tag, 0, "plant"); else await go(page); await waitCount(page, "plant", n); }
  check((await readState(page)).plots.filter((p) => p.cropId === "wheat").length === 3, tag + " planted three actual plots");
  for (let n = 1; n <= 3; n++) { if (n === 1) await cropAction(page, tag, 0, "water"); else await go(page); await waitCount(page, "water", n); }
  check((await readState(page)).plots.filter((p) => p.cropId && p.wateredAt >= p.plantedAt).length === 3, tag + " watered three actual plots");
  await claimUI(page, tag, "c1_homecoming");
  await geometry(page, tag + " after first reward");
  await page.evaluate(() => {
    // Only crop age is accelerated; harvest, inventory and objectives still come from UI.
    window.__farm.state().plots.forEach((p) => { if (p.cropId) p.plantedAt = Date.now() - 60000; });
  });
  for (let n = 2; n <= 6; n += 2) { if (n === 2) await cropAction(page, tag, 0, "harvest"); else await go(page); await waitCount(page, "harvest", n); }
  check((await readState(page)).storage.items.wheat === 6, tag + " UI harvest yields six wheat");
  await go(page);
  await page.waitForFunction(() => window.__farm.state().adventure.byTarget.talk.elder >= 1);
  await page.waitForTimeout(780);
  const elder = await page.evaluate(() => window.__r75Events.find((e) => e.name === "record" && e.arg.npcId === "elder"));
  const elderTile = (await readState(page)).map.tiles.find((t) => t.npc === "elder");
  check(elder && Math.abs(elder.player.x - elderTile.x) + Math.abs(elder.player.y - elderTile.y) === 1, tag + " elder conversation occurs adjacent", elder);
  await claimUI(page, tag, "c1_first_harvest");
  check((await readState(page)).storage.items.wheat === 4, tag + " first harvest delivery consumes two wheat");
  await go(page);
  check(!await page.locator("#worldModal.show").isVisible(), tag + " kitchen does not open remotely before journey");
  await page.locator("#worldModal.show [data-cook=rustic_bread]").waitFor({ state: "visible" });
  await checkModal(page, tag + " kitchen", "#worldModal.show");
  await page.locator("[data-cook=rustic_bread]").scrollIntoViewIfNeeded();
  await checkControls(page, tag + " kitchen cook", "#worldModal.show [data-cook=rustic_bread]");
  await activate(page, page.locator("[data-cook=rustic_bread]"));
  await page.waitForFunction(() => window.__farm.state().adventure.meals.rustic_bread === 1);
  await page.locator("#worldModal.show").waitFor({ state: "visible" });
  check((await readState(page)).storage.items.wheat === 2, tag + " real cook consumes two wheat");
  await modalEscape(page, tag + " kitchen", "#worldModal.show");
  await page.waitForTimeout(780);
  await claimUI(page, tag, "c1_first_meal");
  check((await readState(page)).adventure.meals.rustic_bread === 0, tag + " meal delivery consumes the cooked bread");
  await geometry(page, tag + " chapter one complete");
  await checkControls(page, tag + " chapter one HUD", "#toolBar .tool, .side-tabs button, .toolbar button, #questDock button, #seedRow .seed:not(.locked)");
  const before = await readState(page);
  // Do not explicitly save here: the UI's own afterChange/scheduled save is under test.
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  const after = await readState(page);
  const persisted = (s) => JSON.stringify([s.adventure.claimed, s.adventure.counts, s.adventure.meals, s.storage.items, s.materials, s.coins, s.xp]);
  check(persisted(before) === persisted(after) && !await page.locator("#worldBegin").isVisible(), tag + " automatic reward/inventory/welcome reload persistence", { before: persisted(before), after: persisted(after) });
  return after;
}
async function runDevice(browser, base, device) {
  console.log("DEVICE " + device.name + " " + device.width + "x" + device.height);
  const s = await openSession(browser, base, device);
  let earned;
  try {
    await checkModal(s.page, device.name + " welcome", "#worldModal.show");
    await activate(s.page, s.page.locator("#worldBegin"));
    await geometry(s.page, device.name + " initial");
    await checkControls(s.page, device.name + " initial HUD", "#toolBar .tool, .side-tabs button, .toolbar button, #questDock button, #mapFitToggle, #seedRow .seed:not(.locked), .dpad-btn, #actionA");
    await s.page.screenshot({ path: path.join(TMP, `r75-e2e-${device.name}.png`) });
    if (device.mobile) {
      const before = await readState(s.page);
      const expected = before.map.tiles.find((t) => t.x === before.player.x && t.y === before.player.y - 1);
      const point = await s.page.locator('.dpad-btn[data-dir="up"]').boundingBox();
      await s.page.evaluate(() => { window.MOVE_MS = 10; });
      await s.page.touchscreen.tap(point.x + point.width / 2, point.y + point.height / 2);
      await s.page.waitForTimeout(100);
      check((await readState(s.page)).player.tileId === expected.id, device.name + " real D-pad up tap moves player", { before: before.player.tileId, expected: expected.id, after: (await readState(s.page)).player.tileId });
    }
    await activate(s.page, s.page.locator("#settingsBtn"));
    await checkModal(s.page, device.name + " settings", "#settingsModal.show");
    await modalEscape(s.page, device.name + " settings", "#settingsModal.show");
    earned = await chapterOne(s.page, device.name);
    console.log("CHAPTER_ONE_UI " + device.name + " 3 quests earned; plant3/water3/harvest6/cook1; reload checked");
    await s.page.evaluate(() => { window.MOVE_MS = 10; });
    await menus(s.page, device.name);
  } catch (e) {
    check(false, device.name + " UI flow interrupted", { error: compactError(e), state: await failureState(s.page) });
  } finally {
    await s.page.screenshot({ path: path.join(TMP, `r75-e2e-${device.name}.png`) }).catch(() => {});
    checkErrors(s);
    await s.context.close();
  }
  return earned;
}
async function travel(page, tileId) {
  await page.evaluate((id) => {
    window.__r75TravelFinished = false;
    if (!window.__farm.travelAndDo(id, "use", () => { window.__r75TravelFinished = true; })) throw new Error("Fixture setup journey rejected: " + id);
  }, tileId);
  await page.waitForFunction(() => window.__r75TravelFinished === true);
}
async function fixtureSession(browser, base, fixture, test) {
  const s = await openSession(browser, base, DEVICES[0], fixture);
  try { await s.page.evaluate(() => { window.MOVE_MS = 10; }); return await test(s.page, s.tag); }
  catch (e) { check(false, s.tag + " fixture interrupted", { error: compactError(e), state: await failureState(s.page) }); }
  finally { checkErrors(s); await s.context.close(); }
}
async function dockFixture(browser, base, earned) {
  return fixtureSession(browser, base, { name: "CHAPTER_ONE_EARNED_DOCK", state: earned,
    description: "Unmodified genuinely earned chapter-one save; dock still broken, exact earned materials." }, async (page, tag) => {
    const before = await readState(page);
    await page.evaluate(() => window.FarmWorld.openProjects("fishing_dock"));
    await activate(page, page.locator('[data-restore="fishing_dock"]'));
    const immediate = await readState(page);
    check(!immediate.adventure.projects.fishing_dock.restored && immediate.materials.wood === before.materials.wood, tag + " no remote/early restore or consumption");
    await page.waitForFunction(() => window.__farm.state().adventure.projects.fishing_dock.restored);
    const after = await readState(page);
    check(before.materials.wood - after.materials.wood === 4 && before.materials.stone - after.materials.stone === 2 && after.adventure.counts.restore === before.adventure.counts.restore + 1,
      tag + " restore consumes exactly wood4/stone2 and records once", after.materials);
    check(Math.abs(after.player.x - 2) + Math.abs(after.player.y - 9) === 1, tag + " dock restored only after adjacent real journey", after.player);
    const repeat = await page.evaluate(() => window.AdventureAPI.restore(window.__farm.state(), "fishing_dock", Date.now()));
    check(repeat.reason === "already_restored" && JSON.stringify((await readState(page)).materials) === JSON.stringify(after.materials), tag + " double restoration cannot consume materials", repeat);
    await page.waitForFunction(() => document.querySelector('[data-project-id="fishing_dock"]').dataset.restored === "true");
    const home = after.map.tiles.find((t) => t.structureId === "farmhouse");
    await travel(page, home.id);
    return readState(page);
  });
}
async function fishingFixture(browser, base, restored) {
  return fixtureSession(browser, base, { name: "UI_RESTORED_DOCK_FISHING", state: restored,
    description: "Dock restored by the preceding real UI fixture; relocated by a real journey, no fish/cooldown injection." }, async (page, tag) => {
    const before = await readState(page);
    await page.evaluate(() => window.FarmWorld.visitSite("fishing_dock"));
    check(!await page.locator("#worldModal.show").isVisible(), tag + " fishing modal waits for arrival");
    await page.locator("#worldCatch").waitFor({ state: "visible" });
    const arrived = await readState(page);
    check(before.player.tileId !== arrived.player.tileId && Math.abs(arrived.player.x - 2) + Math.abs(arrived.player.y - 9) === 1, tag + " fishing starts adjacent after nontrivial journey", arrived.player);
    await checkModal(page, tag, "#worldModal.show");
    const positions = new Set();
    for (let i = 0; i < 5; i++) { positions.add(await page.locator(".world-fishing-needle").evaluate((e) => e.style.left)); await page.waitForTimeout(70); }
    check(positions.size > 1, tag + " fishing needle changes animation frames", [...positions]);
    const needle = () => page.waitForFunction(() => {
      const m = document.querySelector(".world-fishing-meter").getBoundingClientRect();
      const n = document.querySelector(".world-fishing-needle").getBoundingClientRect();
      const x = (n.x - m.x) / m.width;
      return x > .4 && x < .48;
    }, null, { polling: "raf" });
    for (let attempt = 0; attempt < 8 && (await readState(page)).adventure.counts.fish === before.adventure.counts.fish; attempt++) {
      await needle(); await activate(page, page.locator("#worldCatch"));
    }
    const caught = await readState(page);
    check(caught.adventure.counts.fish === before.adventure.counts.fish + 1 && Object.values(caught.adventure.catch).reduce((a, b) => a + b, 0) === 1,
      tag + " real timed catch records exactly one fish", caught.adventure);
    check(await page.locator("#worldCatch").isDisabled(), tag + " catch immediately enters cooldown");
    const repeat = await page.evaluate(() => window.AdventureAPI.fish(window.__farm.state(), Date.now()));
    check(repeat.reason === "cooldown" && repeat.remainingMs > 0 && (await readState(page)).adventure.counts.fish === caught.adventure.counts.fish, tag + " cooldown rejects extra catch", repeat);
    await modalEscape(page, tag, "#worldModal.show");
    await page.reload({ waitUntil: "domcontentloaded" }); await ready(page);
    check((await readState(page)).adventure.lastFishAt === caught.adventure.lastFishAt && (await readState(page)).adventure.counts.fish === caught.adventure.counts.fish, tag + " catch and cooldown reload persistence");
    await page.evaluate(() => { window.MOVE_MS = 10; window.FarmWorld.visitSite("fishing_dock"); });
    await page.locator("#worldCatch").waitFor({ state: "visible" });
    check(await page.locator("#worldCatch").isDisabled(), tag + " reopened dock cannot bypass cooldown");
    const remaining = await page.evaluate(() => window.AdventureAPI.summary(window.__farm.state(), Date.now()).fishing.remainingMs);
    console.log("WAIT " + tag + " real cooldown " + remaining + "ms; lastFishAt is not backdated");
    await page.waitForTimeout(remaining + 150);
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.FarmWorld.visitSite("fishing_dock"));
    await page.locator("#worldCatch").waitFor({ state: "visible" });
    check(await page.locator("#worldCatch").isEnabled(), tag + " catch available after real 30s cooldown");
  });
}
async function cookingFixture(browser, base, earned) {
  const state = JSON.parse(JSON.stringify(earned));
  state.storage.items = { ...state.storage.items, wheat: 8, carrot: 4, river_mint: 2 };
  state.adventure.projects.picnic_table = { restored: true, restoredAt: Date.now() };
  return fixtureSession(browser, base, { name: "LATE_RECIPES_INGREDIENTS_PICNIC_FIXTURE", state,
    description: "Earned chapter-one claims retained; explicitly supplies wheat8/carrot4/mint2 and restored picnic table for recipe tests. NOT chapter-two completion." }, async (page, tag) => {
    for (const [id, costs] of [["rustic_bread", { wheat: 2 }], ["baked_carrot", { wheat: 1, carrot: 2 }], ["mint_tea", { wheat: 1, river_mint: 1 }]]) {
      if (await page.locator("#worldModal.show").isVisible()) await page.keyboard.press("Escape");
      // Open from a distance; real cooking button must still travel before consuming.
      await travel(page, "t5_8");
      await page.evaluate(() => window.FarmWorld.openKitchen());
      const before = await readState(page);
      const button = page.locator(`[data-cook="${id}"]`);
      await button.scrollIntoViewIfNeeded();
      await checkControls(page, tag + " " + id, `#worldModal.show [data-cook="${id}"]`);
      await activate(page, button);
      const immediate = await readState(page);
      check(JSON.stringify(immediate.storage.items) === JSON.stringify(before.storage.items), tag + " " + id + " no remote/early ingredient consumption");
      await page.waitForFunction(({ id, qty }) => window.__farm.state().adventure.meals[id] === qty + 1, { id, qty: before.adventure.meals[id] });
      await page.locator("#worldModal.show").waitFor({ state: "visible" });
      const after = await readState(page);
      const home = after.map.tiles.filter((t) => t.structureId === "farmhouse");
      check(home.some((t) => Math.abs(after.player.x - t.x) + Math.abs(after.player.y - t.y) === 1) && before.player.tileId !== after.player.tileId,
        tag + " " + id + " real journey ends adjacent to kitchen", after.player);
      check(Object.entries(costs).every(([item, n]) => (before.storage.items[item] || 0) - (after.storage.items[item] || 0) === n)
        && after.adventure.counts.cook === before.adventure.counts.cook + 1, tag + " " + id + " exact ingredients and one meal/event", after.storage.items);
    }
    await page.keyboard.press("Escape");
    const before = await readState(page);
    await page.reload({ waitUntil: "domcontentloaded" }); await ready(page);
    const after = await readState(page);
    check(JSON.stringify(before.adventure.meals) === JSON.stringify(after.adventure.meals) && JSON.stringify(before.storage.items) === JSON.stringify(after.storage.items), tag + " recipe outputs/consumption reload persistence");
    // Named guard subfixture: missing wheat, not simulated quest completion.
    console.log("FIXTURE MISSING_WHEAT_COOK_GUARD: only inventory wheat is removed for negative UI/API guard");
    await page.evaluate(() => { delete window.__farm.state().storage.items.wheat; window.FarmWorld.openKitchen(); });
    check(await page.locator('[data-cook="rustic_bread"]').isDisabled(), tag + " missing ingredients disable real cook button");
    const guard = await page.evaluate(() => {
      const s = window.__farm.state(), before = JSON.stringify([s.storage.items, s.adventure.meals, s.adventure.counts]);
      const r = window.AdventureAPI.cook(s, "rustic_bread", Date.now());
      return { reason: r.reason, unchanged: before === JSON.stringify([s.storage.items, s.adventure.meals, s.adventure.counts]) };
    });
    check(guard.reason === "missing_resources" && guard.unchanged, tag + " missing ingredient API guard does not mutate", guard);
  });
}
async function cropImpactFixture(browser, base, earned) {
  return fixtureSession(browser, base, { name: "EARNED_EMPTY_PLOT_IMPACT_CANCEL", state: earned,
    description: "Earned chapter-one save with empty harvested plots; only MOVE_MS is shortened. No crop/inventory/event injection." }, async (page, tag) => {
    const before = await readState(page);
    await page.evaluate(() => { window.__farm.setTool("hand"); window.__farm.focusTile("t2_1"); });
    await page.waitForTimeout(250);
    await page.locator('.gtile[data-tile-id="t2_1"]').click();
    await page.waitForFunction(() => window.__farm.state().player.action === "sow");
    const impactPending = await readState(page);
    check(!impactPending.plots[0].cropId && impactPending.coins === before.coins && impactPending.adventure.counts.plant === before.adventure.counts.plant,
      tag + " sow anticipation does not mutate crop/coins/objective");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(600);
    const cancelled = await readState(page);
    check(!cancelled.plots[0].cropId && cancelled.coins === before.coins && cancelled.adventure.counts.plant === before.adventure.counts.plant,
      tag + " walking interrupts pending impact without consuming seed", cancelled.plots[0]);
    await page.evaluate(() => window.__farm.focusTile("t2_1"));
    await page.waitForTimeout(200);
    await page.locator('.gtile[data-tile-id="t2_1"]').click();
    await page.waitForFunction(() => window.__farm.state().player.action === "sow");
    const frames = new Set();
    for (let i = 0; i < 4; i++) {
      frames.add(await page.locator("#playerSprite").evaluate((e) => e.style.backgroundImage + "|" + e.style.backgroundPosition));
      await page.waitForTimeout(80);
    }
    check(frames.size >= 2, tag + " action visibly changes atlas pose frames", [...frames]);
    await page.waitForFunction(() => window.__farm.state().plots[0].cropId === "wheat");
    const after = await readState(page);
    check(after.coins === before.coins - 1 && after.adventure.counts.plant === before.adventure.counts.plant + 1, tag + " uninterrupted real click mutates once at impact");
  });
}
async function marketFixture(browser, base, earned) {
  return fixtureSession(browser, base, { name: "EARNED_MARKET_MATERIALS_UI", state: earned,
    description: "Unmodified earned chapter-one coins/materials; market purchase uses real buttons and nontrivial travel." }, async (page, tag) => {
    for (const [material, price] of [["wood", 6], ["stone", 8]]) {
      if (await page.locator("#worldModal.show").isVisible()) await page.keyboard.press("Escape");
      await travel(page, "t5_8");
      await page.evaluate(() => window.FarmWorld.openMarket());
      const before = await readState(page);
      const button = page.locator(`[data-buy-material="${material}"]`);
      await button.scrollIntoViewIfNeeded();
      await activate(page, button);
      const immediate = await readState(page);
      check(immediate.coins === before.coins && immediate.materials[material] === before.materials[material], tag + " " + material + " no remote/early purchase");
      await page.waitForFunction(({ material, count }) => window.__farm.state().materials[material] === count + 1, { material, count: before.materials[material] });
      await page.locator("#worldModal.show").waitFor({ state: "visible" });
      const after = await readState(page);
      const shop = after.map.tiles.filter((t) => t.structureId === "shop");
      check(after.coins === before.coins - price && shop.some((t) => Math.abs(t.x - after.player.x) + Math.abs(t.y - after.player.y) === 1), tag + " " + material + " exact price/quantity at adjacent shop", { coins: after.coins, materials: after.materials, player: after.player });
    }
  });
}
async function run() {
  fs.mkdirSync(TMP, { recursive: true });
  let server, browser;
  try {
    if (!process.env.FARM_URL) server = await startServer();
    const base = process.env.FARM_URL || `http://127.0.0.1:${server.address().port}/index.html`;
    console.log("R75 real-browser review " + base);
    browser = await chromium.launch();
    let earned;
    for (const device of DEVICES) {
      const result = await runDevice(browser, base, device);
      if (!earned && result && result.adventure.claimed.c1_first_meal) earned = result;
    }
    if (earned) {
      const restored = await dockFixture(browser, base, earned);
      if (restored) await fishingFixture(browser, base, restored);
      else check(false, "fishing fixture unavailable: real dock restoration did not finish");
      await cookingFixture(browser, base, earned);
      await cropImpactFixture(browser, base, earned);
      await marketFixture(browser, base, earned);
    } else check(false, "late fixtures unavailable: no chapter-one save earned through UI");
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
  }
    console.log("R75 SUMMARY " + JSON.stringify({ passed, failed: failures.length }));
  if (failures.length) process.exitCode = 1;
}
run().catch((e) => { console.error(e.stack); process.exitCode = 1; });
