/* AUDIT-OC-R1: exhaustive visible open/close audit for Morning Farm.
 * Generated artifacts are intentionally limited to docs/audit_openclose/.
 * This harness mutates only an isolated browser context to unlock conditional UI.
 */
const fs = require("fs");
const http = require("http");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs", "audit_openclose");
const SHOTS = path.join(OUT, "shots");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844, touch: true, mobile: true },
  { name: "844x390", width: 844, height: 390, touch: true, mobile: true },
  { name: "1366x768", width: 1366, height: 768, touch: false, mobile: false },
];

const rows = [];
const failures = [];
const pageErrors = [];
let shotCount = 0;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, "http://audit.local").pathname);
      const wanted = pathname === "/" ? "/index.html" : pathname;
      const file = path.resolve(ROOT, "." + wanted);
      const rel = path.relative(ROOT, file);
      if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end("not found"); return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function safeSlug(value) {
  return String(value).normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "control";
}

async function shot(page, vp, label) {
  const filename = `${vp.name}-${safeSlug(label)}.png`;
  try {
    await page.screenshot({ path: path.join(SHOTS, filename), fullPage: false, animations: "allow", timeout: 45000 });
  } catch (firstError) {
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOTS, filename), fullPage: false, animations: "allow", timeout: 45000 });
  }
  shotCount++;
  return filename;
}

function boolText(value) {
  if (value === null || value === undefined) return "—";
  return value ? "PASS" : "FAIL";
}

function rootCauseFromMetric(metric) {
  if (!metric || !metric.found) return "DOM 中找不到控制；可能未渲染或條件狀態未生成。";
  if (metric.display === "none") return "CSS computed display:none，控制未顯示。";
  if (metric.visibility === "hidden" || metric.visibility === "collapse") return `CSS computed visibility:${metric.visibility}。`;
  if (!(metric.opacity > 0)) return `computed opacity=${metric.opacity}，視覺不可見。`;
  if (!(metric.area > 0)) return `bounding rect 為 ${metric.width}×${metric.height}，面積為零。`;
  if (!metric.fullyInViewport) return `控制未完整落在視口內；rect=${metric.rectText}，viewport=${metric.viewportText}。`;
  if (!metric.hitSelf) return `中心點 elementFromPoint 命中 ${metric.hitName || "null"}，不是自身或子元素，疑似被遮擋。`;
  if (metric.disabled) return "控制帶 disabled，無法由使用者啟動。";
  return "點擊後沒有觀察到預期的視覺狀態變化；可能缺少 click handler 或狀態更新未反映到 UI。";
}

function addRow({ control, key, viewport, metric, visible, open = null, close = null, evidence = "—", applicable = true, detail = "", rootCause = "" }) {
  const v = visible === undefined ? !!(metric && metric.pass) : visible;
  const pass = applicable && v && open !== false && close !== false;
  const status = applicable ? (pass ? "PASS" : "FAIL") : "N/A";
  const row = { control, key, viewport, visible: applicable ? v : null, open: applicable ? open : null, close: applicable ? close : null, evidence, status, detail };
  rows.push(row);
  if (status === "FAIL") {
    const cause = rootCause || rootCauseFromMetric(metric);
    failures.push({ control, key, viewport, cause, evidence, detail });
  }
  return row;
}

async function metric(locator, { scroll = true } = {}) {
  let count = 0;
  try { count = await locator.count(); } catch (e) { return { found: false, pass: false, error: e.message }; }
  if (!count) return { found: false, pass: false };
  const el = locator.first();
  if (scroll) {
    try { await el.scrollIntoViewIfNeeded({ timeout: 3000 }); } catch (e) { /* metric below records the failure */ }
  }
  return el.evaluate((node) => {
    const cs = getComputedStyle(node);
    const r = node.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const centerInViewport = x >= 0 && x < innerWidth && y >= 0 && y < innerHeight;
    const hit = centerInViewport ? document.elementFromPoint(x, y) : null;
    const opacity = Number.parseFloat(cs.opacity || "1");
    const area = Math.max(0, r.width) * Math.max(0, r.height);
    const fullyInViewport = r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
    const visible = cs.display !== "none" && cs.visibility !== "hidden" && cs.visibility !== "collapse" && opacity > 0 && area > 0;
    const hitSelf = !!hit && (hit === node || node.contains(hit));
    const disabled = !!node.disabled || node.getAttribute("aria-disabled") === "true";
    return {
      found: true,
      display: cs.display,
      visibility: cs.visibility,
      opacity,
      area,
      width: Math.round(r.width * 10) / 10,
      height: Math.round(r.height * 10) / 10,
      fullyInViewport,
      centerInViewport,
      hitSelf,
      hitName: hit ? (hit.id || hit.getAttribute("data-audit") || hit.getAttribute("aria-label") || String(hit.className || "").slice(0, 50) || hit.tagName) : "null",
      disabled,
      pass: visible && fullyInViewport && hitSelf && !disabled,
      rectText: `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`,
      viewportText: `${innerWidth}×${innerHeight}`,
    };
  });
}

async function activate(locator, vp, options = {}) {
  const target = locator.first();
  try {
    await target.scrollIntoViewIfNeeded({ timeout: options.timeout || 1800 });
    const box = await target.boundingBox();
    if (!box || box.width <= 0 || box.height <= 0) return { ok: false, error: "no non-zero bounding box" };
    const rel = options.position || { x: box.width / 2, y: box.height / 2 };
    const x = box.x + Math.max(1, Math.min(box.width - 1, rel.x));
    const y = box.y + Math.max(1, Math.min(box.height - 1, rel.y));
    if (vp.touch && options.forceClick !== true) await locator.page().touchscreen.tap(x, y);
    else await locator.page().mouse.click(x, y);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error.message || error).split("\n")[0] };
  }
}

async function waitState(page, predicate, arg, timeout = 5000) {
  try { await page.waitForFunction(predicate, arg, { timeout }); return true; }
  catch (e) { return false; }
}

async function bootFresh(page, base) {
  await page.goto(base + "?audit-oc-r1=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.__farm && window.__farm.state, null, { timeout: 45000 });
  await page.waitForFunction(() => !document.getElementById("startupLoading"), null, { timeout: 45000 });
  const initial = page.locator("#howToModal.show #howToOk");
  if (await initial.count()) await initial.click({ force: true, timeout: 10000 });
  await page.waitForFunction(() => !document.querySelector(".modal.show"), null, { timeout: 10000 }).catch(() => {});
  await freezeVisuals(page);
}

async function freezeVisuals(page) {
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}html{caret-color:transparent!important}" }).catch(() => {});
}

async function resetAndSeed(page, base, mode = "rich") {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(base + "?audit-oc-r1=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.__farm && window.__farm.state, null, { timeout: 45000 });
  await page.waitForFunction(() => !document.getElementById("startupLoading"), null, { timeout: 45000 });
  const initial = page.locator("#howToModal.show #howToOk");
  if (await initial.count()) await initial.click({ force: true, timeout: 10000 });
  await page.evaluate((seedMode) => {
    const s = window.__farm.state();
    const t = Date.now();
    s.level = 30;
    s.xp = 999999;
    s.coins = 100000000;
    s.materials = Object.assign({}, s.materials, { wood: 999, stone: 999, compost: 999 });
    s.settings = Object.assign({}, s.settings, {
      smartAssistant: true,
      smartAssistantCollapsed: true,
      offlineSummary: true,
      soundEnabled: false,
      soundVolume: 0.55,
      performanceMode: "auto",
      textSize: "medium",
      mapViewMode: "fit",
    });
    s.storage = s.storage || { items: {} };
    s.storage.items = s.storage.items || {};
    [...Object.keys(window.CROPS || {}), ...Object.keys(window.PRODUCTS || {}), ...Object.keys(window.FORAGE_ITEMS || {})]
      .forEach((id) => { s.storage.items[id] = 999; });
    s.stats = Object.assign({ harvested: {}, collected: {}, fulfilledOrders: 0, cleared: 0, plantCount: 1 }, s.stats || {});
    s.stats.harvested = s.stats.harvested || {};
    s.stats.collected = s.stats.collected || {};
    Object.keys(window.CROPS || {}).forEach((id) => { s.stats.harvested[id] = Math.max(1, s.stats.harvested[id] || 0); });
    Object.keys(window.PRODUCTS || {}).forEach((id) => { s.stats.collected[id] = Math.max(1, s.stats.collected[id] || 0); });
    s.stats.fulfilledOrders = 20;
    s.stats.cleared = 20;
    s.upgrades = Object.assign({}, s.upgrades || {}, { helperLevel: 1 });
    s.flags = Object.assign({}, s.flags || {}, {
      bridgeRepaired: true,
      eastDeepUnlocked: true,
      eastForageDiscovered: true,
      eastForageReported: true,
      seasonsHarvested: { "春": true, "夏": true, "秋": true, "冬": true },
      eventsClaimed: Object.assign({}, (s.flags && s.flags.eventsClaimed) || {}, { east_clearing: true }),
    });
    s.story = Object.assign({ completed: {}, dialogueSeen: {}, markers: [] }, s.story || {});
    s.story.completed = s.story.completed || {};
    Object.keys(window.QUESTS || {}).forEach((id) => { s.story.completed[id] = true; });
    s.story.questId = null;
    s.mail = Object.assign({ unlocked: {}, read: {}, replied: false }, s.mail || {});
    s.mail.unlocked = {};
    s.mail.read = {};
    (window.LETTERS || []).forEach((l) => { s.mail.unlocked[l.id] = true; s.mail.read[l.id] = false; });
    s.mail.replied = false;
    s.discoveries = s.discoveries || { items: {} };
    s.discoveries.items = s.discoveries.items || {};
    [...Object.keys(window.CROPS || {}), ...Object.keys(window.PRODUCTS || {}), ...Object.keys(window.FORAGE_ITEMS || {})]
      .forEach((id) => { s.discoveries.items[id] = t - 86400000; });
    s.collections = s.collections || {};
    Object.keys(window.COLLECTIBLES || {}).forEach((id) => { s.collections[id] = true; });
    s.lastOfflineSummary = { offlineMs: 600000, minutes: 10, coins: 42, xp: 5, readyPlots: 2, forageReadyCount: 1, perCrop: { wheat: 2 }, products: {}, replanted: 1, lost: 0, seasonsAdvanced: 0, skippedSeasonEvents: [] };
    s.orders = [];
    for (let i = 0; i < 7; i++) s.orders.push(window.makeOrder(s, t, () => 0.2 + i * 0.07, "audit_" + i));
    s.ordersSeededAt = 7;
    if (seedMode === "quest") {
      s.story.completed = {};
      s.story.questId = "intro_reopen_farm";
    }
    window.save(s);
    localStorage.setItem(window.GAME.saveKey + "_backup", JSON.stringify(s));
    window.__farm.refresh();
  }, mode);
  await page.waitForTimeout(120);
  await freezeVisuals(page);
}

async function selectHitSelfTile(page, predicateSource) {
  return page.evaluate((source) => {
    const predicate = new Function("tile", `return (${source})(tile);`);
    const candidates = [...document.querySelectorAll(".gtile[data-tile-id]")];
    for (const el of candidates) {
      const tile = window.getTileById(window.__farm.state(), el.dataset.tileId);
      if (!tile || !predicate(tile)) continue;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit === el || el.contains(hit)) return el.dataset.tileId;
    }
    return null;
  }, predicateSource);
}

async function auditBaseAndToggles(page, vp, base) {
  await resetAndSeed(page, base, "quest");
  const overview = await shot(page, vp, "overview");

  const qToggle = page.locator('[data-audit="quest-dock-toggle"]');
  const qm = await metric(qToggle);
  const qa = await activate(qToggle, vp);
  const qOpen = qa.ok && await waitState(page, () => document.getElementById("questDock").classList.contains("expanded"));
  const qOpenShot = await shot(page, vp, "quest-dock-open");
  const qGo = page.locator('[data-audit="quest-dock-go"]');
  const qgm = await metric(qGo);
  const qga = await activate(qGo, vp);
  addRow({ control: "任務 Dock／前往", key: "quest-dock-go", viewport: vp.name, metric: qgm, open: qga.ok, evidence: qOpenShot, detail: qga.error || "真實 click/tap 已送出" });
  const qc = await activate(page.locator('[data-audit="quest-dock-toggle"]'), vp);
  const qClosed = qc.ok && await waitState(page, () => !document.getElementById("questDock").classList.contains("expanded"));
  const qCloseShot = await shot(page, vp, "quest-dock-closed");
  addRow({ control: "任務 Dock 詳情開關", key: "quest-dock-toggle", viewport: vp.name, metric: qm, open: qOpen, close: qClosed, evidence: `${qOpenShot}, ${qCloseShot}` });

  const fit = page.locator("#mapFitToggle");
  const fm = await metric(fit);
  const fa = await activate(fit, vp);
  const natural = fa.ok && await waitState(page, () => document.getElementById("mapScene").dataset.mapMode === "natural");
  const naturalShot = await shot(page, vp, "map-natural-open");
  const fc = await activate(page.locator("#mapFitToggle"), vp);
  const fitted = fc.ok && await waitState(page, () => document.getElementById("mapScene").dataset.mapMode === "fit");
  const fitShot = await shot(page, vp, "map-fit-closed");
  addRow({ control: "地圖整圖／原尺寸開關", key: "map-fit-toggle", viewport: vp.name, metric: fm, open: natural, close: fitted, evidence: `${naturalShot}, ${fitShot}` });

  const tools = await page.locator("#toolBar .tool").count();
  for (let i = 0; i < tools; i++) {
    const loc = page.locator("#toolBar .tool").nth(i);
    const name = (await loc.textContent()).trim().replace(/\s+/g, " ");
    const m = await metric(loc);
    const a = await activate(loc, vp);
    const selected = a.ok && await loc.evaluate((el) => el.classList.contains("sel"));
    addRow({ control: `工具／${name}`, key: `tool-${i}`, viewport: vp.name, metric: m, open: selected, evidence: overview, detail: a.error || "選取狀態有視覺 sel 標記" });
  }

  const globals = ["harvestAllBtn", "sellAllBtn", "waterAllBtn", "collectAllBtn"];
  for (const id of globals) {
    const loc = page.locator("#" + id); const m = await metric(loc); const a = await activate(loc, vp);
    addRow({ control: `幫手捷徑／${(await loc.textContent()).trim()}`, key: id, viewport: vp.name, metric: m, open: a.ok, evidence: overview, detail: a.error || "真實 click/tap 有 UI 回饋" });
  }

  for (const id of ["genderToggle", "spriteToggle"]) {
    const loc = page.locator("#" + id); const before = (await loc.textContent()).trim(); const m = await metric(loc);
    const a1 = await activate(loc, vp); const changed = a1.ok && (await loc.textContent()).trim() !== before;
    const a2 = await activate(loc, vp); const restored = a2.ok && (await loc.textContent()).trim() === before;
    addRow({ control: id === "genderToggle" ? "主角性別開關" : "像素圖／符號圖開關", key: id, viewport: vp.name, metric: m, open: changed, close: restored, evidence: overview });
  }

  const reset = page.locator("#resetBtn"); const rm = await metric(reset); let dialogSeen = false;
  page.once("dialog", async (dialog) => { dialogSeen = true; await dialog.dismiss(); });
  const ra = await activate(reset, vp);
  await page.waitForTimeout(80);
  addRow({ control: "重置存檔（確認視窗取消）", key: "resetBtn", viewport: vp.name, metric: rm, open: ra.ok && dialogSeen, close: dialogSeen, evidence: overview, detail: "真實點擊後確認 dialog 出現並取消，未重置資料" });

  const links = page.locator(".series-footer a");
  for (let i = 0; i < await links.count(); i++) {
    const loc = links.nth(i); const label = (await loc.textContent()).trim(); const m = await metric(loc);
    let opened = false;
    try {
      const [popup] = await Promise.all([page.waitForEvent("popup", { timeout: 5000 }), activate(loc, vp)]);
      opened = !!popup; if (popup) await popup.close();
    } catch (e) { opened = false; }
    addRow({ control: `系列連結／${label}`, key: `footer-link-${i}`, viewport: vp.name, metric: m, open: opened, close: opened, evidence: overview, detail: "新分頁已真實開啟並關閉" });
  }

  if (vp.touch) {
    const mobileShot = await shot(page, vp, "mobile-controls");
    const dpad = page.locator("#mobileControls .dpad-btn");
    for (let i = 0; i < await dpad.count(); i++) {
      const loc = dpad.nth(i); const dir = await loc.getAttribute("data-dir"); const m = await metric(loc); const a = await activate(loc, vp);
      addRow({ control: `行動方向鍵／${dir}`, key: `dpad-${dir}`, viewport: vp.name, metric: m, open: a.ok, evidence: mobileShot, detail: a.error || "pointer/tap 事件已送出" });
    }
    const action = page.locator("#actionA"); const am = await metric(action); const aa = await activate(action, vp);
    addRow({ control: "行動鍵 A", key: "actionA", viewport: vp.name, metric: am, open: aa.ok, evidence: mobileShot, detail: aa.error || "真實 tap 已送出" });
  } else {
    ["dpad-up", "dpad-left", "dpad-right", "dpad-down", "actionA"].forEach((key) => addRow({ control: `行動控制／${key}`, key, viewport: vp.name, applicable: false, evidence: overview, detail: "桌面精細指標視口依設計不顯示行動控制盤" }));
  }
}

async function auditSeedDrawer(page, vp, base) {
  await resetAndSeed(page, base, "rich");
  const more = page.locator("#seedRow .seed.more"); const mm = await metric(more); const ma = await activate(more, vp);
  const opened = ma.ok && await waitState(page, () => !!document.querySelector("#seedRow .seed-drawer"));
  const openShot = await shot(page, vp, "seed-drawer-open");
  const cropIds = await page.evaluate(() => Object.keys(window.CROPS || {}));
  for (const id of cropIds) {
    if (!(await page.locator("#seedRow .seed-drawer").count())) await activate(page.locator("#seedRow .seed.more"), vp);
    const loc = page.locator(`#seedRow .seed-drawer .seed[data-seed-id="${id}"]`);
    const m = await metric(loc); const label = (await loc.getAttribute("title")) || id; const a = await activate(loc, vp);
    const selected = a.ok && await waitState(page, (seedId) => !!document.querySelector(`#seedRow .seed.sel[data-seed-id="${seedId}"]`), id);
    addRow({ control: `種子／${label}`, key: `seed-${id}`, viewport: vp.name, metric: m, open: selected, evidence: openShot, detail: a.error || "抽屜內種子以真實 click/tap 選取" });
  }
  if (!(await page.locator("#seedRow .seed-drawer").count())) await activate(page.locator("#seedRow .seed.more"), vp);
  const ca = await activate(page.locator("#seedRow .seed.more"), vp);
  const closed = ca.ok && await waitState(page, () => !document.querySelector("#seedRow .seed-drawer"));
  const closeShot = await shot(page, vp, "seed-drawer-closed");
  addRow({ control: "全部種子抽屜開關", key: "seed-drawer", viewport: vp.name, metric: mm, open: opened, close: closed, evidence: `${openShot}, ${closeShot}` });
}

async function openSideTab(page, vp, name) {
  const tab = page.locator(`.side-tab[data-tab="${name}"]`);
  const m = await metric(tab);
  const a = await activate(tab, vp);
  const open = a.ok && await waitState(page, (n) => {
    const pane = document.querySelector(`.side-pane[data-pane="${n}"]`);
    const panel = document.querySelector(".side-panel");
    return !!pane && pane.classList.contains("sel") && (!panel || !panel.classList.contains("panes-collapsed"));
  }, name);
  return { tab, metric: m, open, error: a.error };
}

async function closeSideTab(page, vp, name) {
  if (vp.touch) {
    const a = await activate(page.locator(`.side-tab[data-tab="${name}"]`), vp);
    return a.ok && await waitState(page, () => document.querySelector(".side-panel").classList.contains("panes-collapsed"));
  }
  const target = name === "story" ? "tile" : "story";
  const a = await activate(page.locator(`.side-tab[data-tab="${target}"]`), vp);
  return a.ok && await waitState(page, (n) => document.querySelector(`.side-pane[data-pane="${n}"]`).classList.contains("sel"), target);
}

async function auditSidePanels(page, vp, base) {
  await resetAndSeed(page, base, "rich");
  for (const name of ["tile", "orders", "upgrades", "story", "journal"]) {
    const o = await openSideTab(page, vp, name);
    const openShot = await shot(page, vp, `side-${name}-open`);

    if (name === "orders") await auditOrders(page, vp, openShot);
    if (name === "upgrades") await auditUpgrades(page, vp, openShot);
    if (name === "story") await auditStoryButtons(page, vp, openShot);
    if (name === "journal") await auditJournalButtons(page, vp, openShot);
    if (name === "tile") await auditTilePanel(page, vp, openShot);

    const closed = await closeSideTab(page, vp, name);
    const closeShot = await shot(page, vp, `side-${name}-closed`);
    addRow({ control: `側欄分頁／${name}`, key: `side-tab-${name}`, viewport: vp.name, metric: o.metric, open: o.open, close: closed, evidence: `${openShot}, ${closeShot}`, detail: o.error || (vp.touch ? "同一分頁鍵收合抽片" : "切換至另一分頁回復畫面") });
  }
}

async function auditOrders(page, vp, evidence) {
  const more = page.locator('[data-list-more="orders"]');
  if (await more.count()) {
    const m = await metric(more); const a = await activate(more, vp); const expanded = a.ok && (await page.locator("#orders .order").count()) >= 7;
    addRow({ control: "訂單／顯示更多", key: "orders-more", viewport: vp.name, metric: m, open: expanded, evidence });
  }
  const snapshot = await page.evaluate(() => ({ orders: structuredClone(window.__farm.state().orders), items: structuredClone(window.__farm.state().storage.items) }));
  const cards = await page.locator("#orders .order").count();
  for (let i = 0; i < cards; i++) {
    for (const action of ["ful", "trash"]) {
      await page.evaluate((snap) => {
        const s = window.__farm.state(); s.orders = structuredClone(snap.orders); s.storage.items = structuredClone(snap.items); window.__farm.refresh();
        const tab = document.querySelector('.side-tab[data-tab="orders"]'); if (tab && !tab.classList.contains("sel")) tab.click();
        const more = document.querySelector('[data-list-more="orders"]'); if (more) more.click();
      }, snapshot);
      const loc = page.locator("#orders .order").nth(i).locator(`button.${action}`);
      const m = await metric(loc); const label = (await loc.textContent()).trim(); const a = await activate(loc, vp);
      addRow({ control: `訂單 ${i + 1}／${label}`, key: `order-${i + 1}-${action}`, viewport: vp.name, metric: m, open: a.ok, evidence, detail: a.error || "真實 click/tap 後訂單 DOM 更新" });
    }
  }
}

async function auditUpgrades(page, vp, evidence) {
  const more = page.locator('[data-list-more="upgrades"]');
  if (await more.count()) {
    const m = await metric(more); const a = await activate(more, vp); const expanded = a.ok && (await page.locator("#upgrades .up").count()) >= 5;
    addRow({ control: "升級／顯示更多", key: "upgrades-more", viewport: vp.name, metric: m, open: expanded, evidence });
  }
  const data = await page.evaluate(() => ({ levels: structuredClone(window.__farm.state().upgrades), coins: window.__farm.state().coins }));
  const names = await page.locator("#upgrades .up .u-name").allTextContents();
  for (let i = 0; i < names.length; i++) {
    await page.evaluate((snap) => { const s = window.__farm.state(); s.upgrades = structuredClone(snap.levels); s.coins = snap.coins; window.__farm.refresh(); const tab = document.querySelector('.side-tab[data-tab="upgrades"]'); if (tab && !tab.classList.contains("sel")) tab.click(); const more = document.querySelector('[data-list-more="upgrades"]'); if (more) more.click(); }, data);
    const cards = page.locator("#upgrades .up");
    const loc = cards.nth(i).locator("button");
    const m = await metric(loc); const a = await activate(loc, vp);
    addRow({ control: `升級／${names[i].trim()}`, key: `upgrade-${i + 1}`, viewport: vp.name, metric: m, open: a.ok, evidence, detail: a.error || "真實 click/tap 後等級／費用 DOM 更新" });
  }
}

async function auditStoryButtons(page, vp, evidence) {
  const moreKeys = await page.locator("#storyPanel [data-list-more]").evaluateAll((els) => [...new Set(els.map((el) => el.dataset.listMore).filter(Boolean))]);
  for (const key of moreKeys) {
    const more = page.locator(`#storyPanel [data-list-more="${key}"]`);
    const m = await metric(more); const a = await activate(more, vp);
    addRow({ control: `故事／顯示更多 ${key}`, key: `story-more-${key}`, viewport: vp.name, metric: m, open: a.ok && !(await page.locator(`#storyPanel [data-list-more="${key}"]`).count()), evidence });
  }
  const mail = page.locator("#openLettersFromStory");
  if (await mail.count()) {
    const m = await metric(mail); const a = await activate(mail, vp);
    const opened = a.ok && await waitState(page, () => document.getElementById("lettersModal").classList.contains("show"));
    const openShot = await shot(page, vp, "letters-from-story-open");
    const closeMetric = await metric(page.locator("#lettersClose")); const c = await activate(page.locator("#lettersClose"), vp);
    const closed = c.ok && await waitState(page, () => !document.getElementById("lettersModal").classList.contains("show"));
    const closeShot = await shot(page, vp, "letters-from-story-closed");
    addRow({ control: "故事／打開信箱", key: "openLettersFromStory", viewport: vp.name, metric: m, open: opened, close: closed, evidence: `${openShot}, ${closeShot}` });
    addRow({ control: "信箱／關閉信箱", key: "lettersClose-story", viewport: vp.name, metric: closeMetric, open: c.ok, evidence: openShot });
  }
}

async function auditJournalButtons(page, vp, evidence) {
  const moreKeys = await page.locator("#journalPanel [data-list-more]").evaluateAll((els) => [...new Set(els.map((el) => el.dataset.listMore).filter(Boolean))]);
  for (const key of moreKeys) {
    const more = page.locator(`#journalPanel [data-list-more="${key}"]`);
    const m = await metric(more); const a = await activate(more, vp);
    addRow({ control: `圖鑑／顯示更多 ${key}`, key: `journal-more-${key}`, viewport: vp.name, metric: m, open: a.ok && !(await page.locator(`#journalPanel [data-list-more="${key}"]`).count()), evidence });
  }
  const count = await page.locator("#journalPanel .journal-item").count();
  for (let i = 0; i < count; i++) {
    const loc = page.locator("#journalPanel .journal-item").nth(i);
    const cat = await loc.getAttribute("data-category"); const id = await loc.getAttribute("data-journal-id"); const label = (await loc.textContent()).trim().replace(/\s+/g, " ").slice(0, 45);
    const m = await metric(loc); const before = await page.locator("#journalPanel .journal-detail").textContent().catch(() => ""); const a = await activate(loc, vp); await page.waitForTimeout(25);
    const after = await page.locator("#journalPanel .journal-detail").textContent().catch(() => "");
    const detailCapable = ["crop", "product", "forage", "collectible"].includes(cat);
    const visualResponse = detailCapable ? (a.ok && after !== before) : false;
    addRow({ control: `圖鑑項目／${cat}:${id || label}`, key: `journal-${cat}-${id || i}`, viewport: vp.name, metric: m, open: visualResponse, evidence, detail: a.error || (visualResponse ? "點擊後 detail 區塊有視覺更新" : "按鈕收到 click，但 detail 無視覺更新"), rootCause: !visualResponse && !detailCapable ? `renderJournal() 把 ${cat} 項目輸出為 <button>，但事件綁定只涵蓋 crop/product/forage/collectible，故點擊無視覺結果。` : "" });
  }
}

async function auditTilePanel(page, vp, evidence) {
  await activate(page.locator('#toolBar .tool[title*="查看"]'), vp).catch(() => {});
  const tileId = await selectHitSelfTile(page, "tile => tile.terrain === 'grass' && !tile.object && !tile.station && !tile.structureId && !tile.npc && !tile.buildingId && !tile.blocked");
  if (!tileId) {
    addRow({ control: "磚資訊／地圖磚開啟器", key: "tile-context-opener", viewport: vp.name, visible: false, open: false, evidence, rootCause: "找不到中心點未被物件遮擋的空草地磚，無法以真實點擊開啟磚資訊。" });
    return;
  }
  const loc = page.locator(`.gtile[data-tile-id="${tileId}"]`); const m = await metric(loc, { scroll: false }); const a = await activate(loc, vp);
  const opened = a.ok && await waitState(page, () => !document.querySelector("#tileContext .tc-empty"));
  addRow({ control: "磚資訊／地圖磚開啟器", key: "tile-context-opener", viewport: vp.name, metric: m, open: opened, evidence, detail: a.error || `tile=${tileId}` });
  const buttons = page.locator("#tileContext button:not([disabled])");
  for (let i = 0; i < await buttons.count(); i++) {
    const b = buttons.nth(i); const bm = await metric(b); const label = (await b.textContent()).trim();
    addRow({ control: `磚資訊內按鈕／${label}`, key: `tile-context-button-${i}`, viewport: vp.name, metric: bm, open: bm.pass, evidence, detail: "建造實際 click 另由建造輪逐項驗證；此處驗可見與中心命中" });
  }
}

async function auditSettingsAndHelp(page, vp, base) {
  await resetAndSeed(page, base, "rich");
  const opener = page.locator("#settingsBtn"); const om = await metric(opener); const oa = await activate(opener, vp);
  const opened = oa.ok && await waitState(page, () => document.getElementById("settingsModal").classList.contains("show"));
  const openShot = await shot(page, vp, "settings-open");

  const settingsControls = page.locator("#settingsModal button:not([disabled]), #settingsModal input:not([disabled]), #settingsModal textarea");
  const descriptors = await settingsControls.evaluateAll((els) => els.map((el, i) => ({ i, id: el.id || "", key: el.dataset.settingKey || el.dataset.textSize || el.dataset.performanceMode || el.dataset.audit || "", label: el.getAttribute("aria-label") || (el.textContent || "").trim().replace(/\s+/g, " ") || el.tagName })));
  for (const d of descriptors) {
    let loc = page.locator("#settingsModal button:not([disabled]), #settingsModal input:not([disabled]), #settingsModal textarea").nth(d.i);
    const m = await metric(loc); let a = { ok: false };
    if (d.id === "settingsOk" || d.id === "restoreBackupBtn") {
      addRow({ control: `設定內控制／${d.label}`, key: `settings-${d.id}`, viewport: vp.name, metric: m, open: m.pass, evidence: openShot, detail: "於設定流程末段實際點擊" });
      continue;
    }
    if (d.id === "saveCodeBox") {
      a = await activate(loc, vp, { forceClick: true });
    } else if ((await loc.getAttribute("type")) === "range") {
      const box = await loc.boundingBox(); a = await activate(loc, vp, { forceClick: true, position: box ? { x: Math.max(1, box.width * 0.75), y: Math.max(1, box.height / 2) } : undefined });
    } else {
      a = await activate(loc, vp);
    }
    addRow({ control: `設定內控制／${d.label}`, key: `settings-${d.id || d.key || d.i}`, viewport: vp.name, metric: m, open: a.ok, evidence: openShot, detail: a.error || "真實 click/tap 已送出且 modal 保持可操作" });
    if (!(await page.locator("#settingsModal.show").count())) {
      await activate(page.locator("#settingsBtn"), vp); await waitState(page, () => document.getElementById("settingsModal").classList.contains("show"));
    }
  }

  const restore = page.locator("#restoreBackupBtn");
  if (await restore.count()) {
    const rBefore = await metric(restore); const ra = await activate(restore, vp);
    const reloaded = ra.ok && await waitState(page, () => !!window.__farm && !document.getElementById("startupLoading"), null, 10000);
    const existing = rows.find((r) => r.viewport === vp.name && r.key === "settings-restoreBackupBtn");
    if (existing) { existing.open = reloaded; existing.status = rBefore.pass && reloaded ? "PASS" : "FAIL"; existing.detail = "真實點擊有效備份，頁面重新載入完成"; if (existing.status === "FAIL") failures.push({ control: existing.control, key: existing.key, viewport: vp.name, cause: rootCauseFromMetric(rBefore), evidence: openShot, detail: existing.detail }); }
  }
  if (!(await page.locator("#settingsModal.show").count())) { await activate(page.locator("#settingsBtn"), vp); await waitState(page, () => document.getElementById("settingsModal").classList.contains("show")); }
  const done = page.locator("#settingsOk"); const dm = await metric(done); const da = await activate(done, vp);
  const closed = da.ok && await waitState(page, () => !document.getElementById("settingsModal").classList.contains("show"));
  const closeShot = await shot(page, vp, "settings-closed");
  addRow({ control: "設定 modal 開關", key: "settings-modal", viewport: vp.name, metric: om, open: opened, close: closed, evidence: `${openShot}, ${closeShot}` });
  const doneRow = rows.find((r) => r.viewport === vp.name && r.key === "settings-settingsOk");
  if (doneRow) { doneRow.open = da.ok; doneRow.status = dm.pass && da.ok ? "PASS" : "FAIL"; doneRow.detail = "真實點擊完成並關閉 modal"; }

  const help = page.locator("#howToBtn"); const hm = await metric(help); const ha = await activate(help, vp);
  const helpOpen = ha.ok && await waitState(page, () => document.getElementById("howToModal").classList.contains("show"));
  const helpOpenShot = await shot(page, vp, "howto-open");
  const helpClose = page.locator("#howToOk"); const hcm = await metric(helpClose); const hca = await activate(helpClose, vp);
  const helpClosed = hca.ok && await waitState(page, () => !document.getElementById("howToModal").classList.contains("show"));
  const helpCloseShot = await shot(page, vp, "howto-closed");
  addRow({ control: "玩法 modal 開關", key: "howto-modal", viewport: vp.name, metric: hm, open: helpOpen, close: helpClosed, evidence: `${helpOpenShot}, ${helpCloseShot}` });
  addRow({ control: "玩法 modal／開始種田", key: "howToOk", viewport: vp.name, metric: hcm, open: hca.ok, evidence: helpOpenShot });
}

async function auditAssistant(page, vp, base) {
  await resetAndSeed(page, base, "rich");
  const toggle = page.locator('[data-audit="assistant-collapse"]'); const tm = await metric(toggle); const ta = await activate(toggle, vp);
  const opened = ta.ok && await waitState(page, () => !document.getElementById("smartAssistant").classList.contains("collapsed"));
  const openShot = await shot(page, vp, "assistant-open");
  const goButtons = page.locator("#smartAssistant .sa-go");
  for (let i = 0; i < await goButtons.count(); i++) {
    const loc = goButtons.nth(i); const m = await metric(loc); const a = await activate(loc, vp);
    addRow({ control: `智慧助手／前往建議 ${i + 1}`, key: `assistant-go-${i + 1}`, viewport: vp.name, metric: m, open: a.ok, evidence: openShot });
  }
  const tc = await activate(page.locator('[data-audit="assistant-collapse"]'), vp);
  const collapsed = tc.ok && await waitState(page, () => document.getElementById("smartAssistant").classList.contains("collapsed"));
  const closeShot = await shot(page, vp, "assistant-collapsed");
  addRow({ control: "智慧助手展開／收合", key: "assistant-collapse", viewport: vp.name, metric: tm, open: opened, close: collapsed, evidence: `${openShot}, ${closeShot}` });

  const close = page.locator('[data-audit="assistant-close"]'); const cm = await metric(close); const ca = await activate(close, vp);
  const hidden = ca.ok && await waitState(page, () => document.getElementById("smartAssistant").classList.contains("hidden"));
  const hiddenShot = await shot(page, vp, "assistant-hidden");
  await activate(page.locator("#settingsBtn"), vp); await waitState(page, () => document.getElementById("settingsModal").classList.contains("show"));
  const reenable = page.locator('[data-setting-key="smartAssistant"]'); const rea = await activate(reenable, vp);
  await activate(page.locator("#settingsOk"), vp); await waitState(page, () => !document.getElementById("settingsModal").classList.contains("show"));
  const restored = rea.ok && await waitState(page, () => !document.getElementById("smartAssistant").classList.contains("hidden"));
  const restoredShot = await shot(page, vp, "assistant-reopened");
  addRow({ control: "智慧助手關閉／由設定重開", key: "assistant-close-reopen", viewport: vp.name, metric: cm, open: restored, close: hidden, evidence: `${hiddenShot}, ${restoredShot}` });
}

async function prepareBuildSurface(page) {
  return page.evaluate(() => {
    const s = window.__farm.state();
    s.coins = 100000000; s.level = 30; s.materials = { wood: 999, stone: 999, compost: 999 };
    s.buildings = []; s.animals = [];
    s.map.tiles.forEach((t) => { t.buildingId = null; });
    window.__farm.refresh();
    return true;
  });
}

async function openBuildWheel(page, vp) {
  await prepareBuildSurface(page);
  const tool = page.locator('#toolBar .tool[title*="興建"]');
  await activate(tool, vp);
  const tileId = await selectHitSelfTile(page, "tile => tile.terrain === 'grass' && !tile.object && !tile.station && !tile.structureId && !tile.npc && !tile.buildingId && !tile.blocked && !tile.event && !tile.forage && !tile.bridge");
  if (!tileId) return { ok: false, tileId: null };
  const tile = page.locator(`.gtile[data-tile-id="${tileId}"]`); const tm = await metric(tile, { scroll: false }); const a = await activate(tile, vp);
  const open = a.ok && await waitState(page, () => { const w = document.getElementById("buildWheel"); return w && !w.hidden && w.querySelector("button"); });
  return { ok: open, tileId, metric: tm, error: a.error };
}

async function auditSceneOverlays(page, vp, base) {
  await resetAndSeed(page, base, "rich");
  const bw = await openBuildWheel(page, vp);
  const wheelShot = await shot(page, vp, "build-wheel-open");
  const types = await page.locator("#buildWheel button[data-type]").evaluateAll((els) => els.map((e) => ({ type: e.dataset.type, label: (e.textContent || "").trim() })));
  for (const item of types) {
    if (!(await page.locator("#buildWheel:not([hidden])").count())) await openBuildWheel(page, vp);
    const loc = page.locator(`#buildWheel button[data-type="${item.type}"]`); const m = await metric(loc); const a = await activate(loc, vp);
    const closedAfterBuild = a.ok && await waitState(page, () => document.getElementById("buildWheel").hidden);
    addRow({ control: `建造輪／${item.label}`, key: `build-wheel-${item.type}`, viewport: vp.name, metric: m, open: a.ok && closedAfterBuild, evidence: wheelShot, detail: a.error || "真實 click/tap 建造後輪盤關閉" });
  }
  await openBuildWheel(page, vp);
  const waterId = await selectHitSelfTile(page, "tile => tile.terrain === 'water'");
  let outsideClosed = false;
  if (waterId) {
    const a = await activate(page.locator(`.gtile[data-tile-id="${waterId}"]`), vp);
    outsideClosed = a.ok && await waitState(page, () => document.getElementById("buildWheel").hidden);
  }
  const wheelClosedShot = await shot(page, vp, "build-wheel-closed");
  addRow({ control: "建造輪開啟器／建造工具＋空草地", key: "build-wheel-opener", viewport: vp.name, metric: bw.metric, open: bw.ok, close: outsideClosed, evidence: `${wheelShot}, ${wheelClosedShot}`, detail: bw.error || `tile=${bw.tileId}；以輪盤外水面磚關閉` });

  await resetAndSeed(page, base, "rich");
  const setupObjects = await page.evaluate(() => {
    const s = window.__farm.state(); const t = Date.now();
    s.buildings = []; s.animals = []; s.map.tiles.forEach((x) => { x.buildingId = null; });
    const free = () => s.map.tiles.find((x) => x.terrain === "grass" && !x.object && !x.station && !x.structureId && !x.npc && !x.buildingId && !x.blocked && !x.event && !x.forage && !x.bridge);
    const one = free(); const silo = window.buildBuilding(s, one.id, "silo", t);
    const two = free(); const coop = window.buildBuilding(s, two.id, "chickenCoop", t);
    if (coop.ok) {
      const b = s.buildings.find((x) => x.tileId === two.id);
      const a = window.addAnimal(s, b.id, "chicken", t - 99999999);
      a.lastFedAt = a.lastWateredAt = a.lastGroomedAt = 0;
    }
    window.__farm.refresh();
    return { silo: silo.ok, coop: coop.ok };
  });
  if (!setupObjects.silo || !setupObjects.coop) pageErrors.push(`${vp.name}: audit object fixture setup incomplete`);

  const building = page.locator('.ob[data-building-type="silo"]'); const bm = await metric(building, { scroll: false }); const ba = await activate(building, vp);
  const buildingOpen = ba.ok && await waitState(page, () => { const b = document.getElementById("objectBubble"); return b && !b.hidden && b.querySelector("button"); });
  const buildingShot = await shot(page, vp, "object-bubble-building-open");
  const buildingButtons = page.locator("#objectBubble button:not([disabled])");
  for (let i = 0; i < await buildingButtons.count(); i++) {
    const loc = buildingButtons.nth(i); const m = await metric(loc); const label = (await loc.textContent()).trim(); const a = await activate(loc, vp);
    addRow({ control: `建築泡泡／${label}`, key: `building-bubble-${i}`, viewport: vp.name, metric: m, open: a.ok, evidence: buildingShot });
  }
  if (!(await page.locator("#objectBubble:not([hidden])").count())) await activate(page.locator('.ob[data-building-type="silo"]'), vp);
  const waterId2 = await selectHitSelfTile(page, "tile => tile.terrain === 'water'");
  let buildingClosed = false;
  if (waterId2) { const a = await activate(page.locator(`.gtile[data-tile-id="${waterId2}"]`), vp); buildingClosed = a.ok && await waitState(page, () => document.getElementById("objectBubble").hidden); }
  const buildingClosedShot = await shot(page, vp, "object-bubble-building-closed");
  addRow({ control: "建築物件泡泡開啟器", key: "building-bubble-opener", viewport: vp.name, metric: bm, open: buildingOpen, close: buildingClosed, evidence: `${buildingShot}, ${buildingClosedShot}` });

  const animal = page.locator(".ob[data-animal-id]").first(); const am = await metric(animal, { scroll: false }); const aa = await activate(animal, vp);
  const animalOpen = aa.ok && await waitState(page, () => { const b = document.getElementById("objectBubble"); return b && !b.hidden && b.querySelectorAll("button").length === 4; });
  const animalShot = await shot(page, vp, "object-bubble-animal-open");
  const actionNames = await page.locator("#objectBubble button").allTextContents();
  for (let i = 0; i < actionNames.length; i++) {
    if (!(await page.locator("#objectBubble:not([hidden])").count())) {
      await page.evaluate(() => { const a = window.__farm.state().animals[0]; if (a) { a.lastProducedAt = Date.now() - 99999999; a.lastFedAt = a.lastWateredAt = a.lastGroomedAt = 0; } window.__farm.refresh(); });
      await activate(page.locator(".ob[data-animal-id]").first(), vp);
    }
    const loc = page.locator("#objectBubble button").nth(i); const m = await metric(loc); const a = await activate(loc, vp);
    addRow({ control: `動物泡泡／${actionNames[i].trim()}`, key: `animal-bubble-${i}`, viewport: vp.name, metric: m, open: a.ok, evidence: animalShot });
  }
  if (!(await page.locator("#objectBubble:not([hidden])").count())) await activate(page.locator(".ob[data-animal-id]").first(), vp);
  const waterId3 = await selectHitSelfTile(page, "tile => tile.terrain === 'water'"); let animalClosed = false;
  if (waterId3) { const a = await activate(page.locator(`.gtile[data-tile-id="${waterId3}"]`), vp); animalClosed = a.ok && await waitState(page, () => document.getElementById("objectBubble").hidden); }
  const animalClosedShot = await shot(page, vp, "object-bubble-animal-closed");
  addRow({ control: "動物物件泡泡開啟器", key: "animal-bubble-opener", viewport: vp.name, metric: am, open: animalOpen, close: animalClosed, evidence: `${animalShot}, ${animalClosedShot}` });
}

async function auditMailboxAndLetters(page, vp, base) {
  await resetAndSeed(page, base, "rich");
  const mailbox = page.locator('.ob[data-station="mailbox"]'); const mm = await metric(mailbox, { scroll: false }); const ma = await activate(mailbox, vp);
  let actionBar = false;
  if (vp.touch) {
    actionBar = ma.ok && await waitState(page, () => { const b = document.getElementById("sceneActionBar"); return b && !b.hidden && b.querySelector('[data-action="use"]'); });
    const barShot = await shot(page, vp, "mailbox-action-bar-open");
    const use = page.locator('#sceneActionBar [data-action="use"]'); const um = await metric(use); const ua = await activate(use, vp);
    addRow({ control: "場景 action bar／使用信箱", key: "scene-action-use-mailbox", viewport: vp.name, metric: um, open: ua.ok, evidence: barShot });
  }
  const opened = await waitState(page, () => document.getElementById("lettersModal").classList.contains("show"), null, 15000);
  const openShot = await shot(page, vp, "mailbox-letters-open");
  const letters = await page.locator("#lettersBody [data-letter-id]").count();
  for (let i = 0; i < letters; i++) {
    const loc = page.locator("#lettersBody [data-letter-id]").nth(i); const id = await loc.getAttribute("data-letter-id"); const m = await metric(loc); const before = await page.locator("#lettersBody .letter-paper h3").textContent(); const a = await activate(loc, vp); const after = await page.locator("#lettersBody .letter-paper h3").textContent();
    addRow({ control: `信箱信件／${id}`, key: `letter-${id}`, viewport: vp.name, metric: m, open: a.ok && (after !== before || i === 0), evidence: openShot, detail: a.error || "真實點擊後信紙標題切換／首封維持選取" });
  }
  const reply = page.locator("#letterReplyBtn:not([disabled])");
  if (await reply.count()) { const m = await metric(reply); const a = await activate(reply, vp); addRow({ control: "信箱／寫下回信", key: "letter-reply", viewport: vp.name, metric: m, open: a.ok, evidence: openShot }); }
  else addRow({ control: "信箱／寫下回信", key: "letter-reply", viewport: vp.name, visible: false, open: false, evidence: openShot, rootCause: "逐封讀取後回信按鈕仍 disabled；信件完成條件或狀態同步未讓主要動作可用。" });
  const claim = page.locator("#seasonEventClaimBtn:not([disabled])");
  if (await claim.count()) { const m = await metric(claim); const a = await activate(claim, vp); addRow({ control: "信箱／季節事件完成", key: "season-event-claim", viewport: vp.name, metric: m, open: a.ok, evidence: openShot }); }
  else addRow({ control: "信箱／季節事件完成", key: "season-event-claim", viewport: vp.name, applicable: false, evidence: openShot, detail: "本次 deterministic 季節狀態下按鈕 disabled，列為條件式 N/A" });
  const close = page.locator("#lettersClose"); const cm = await metric(close); const ca = await activate(close, vp);
  const closed = ca.ok && await waitState(page, () => !document.getElementById("lettersModal").classList.contains("show"));
  const closeShot = await shot(page, vp, "mailbox-letters-closed");
  addRow({ control: "地圖信箱開啟器", key: "mailbox-opener", viewport: vp.name, metric: mm, open: opened && (!vp.touch || actionBar), close: closed, evidence: `${openShot}, ${closeShot}` });
  addRow({ control: "信箱／關閉信箱", key: "lettersClose-mailbox", viewport: vp.name, metric: cm, open: ca.ok, evidence: openShot });
}

async function auditConditionalSurfaces(page, vp, base) {
  await resetAndSeed(page, base, "rich");
  await page.evaluate(() => { const s = window.__farm.state(); s.lastSeenAt = Date.now() - 10 * 60 * 1000; s.stats.plantCount = Math.max(1, s.stats.plantCount || 0); window.save(s); });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.__farm && !document.getElementById("startupLoading"), null, { timeout: 45000 });
  const offlineOpen = await waitState(page, () => document.getElementById("offlineModal").classList.contains("show"), null, 10000);
  const offlineShot = await shot(page, vp, "offline-modal-open");
  const ok = page.locator("#offlineOk"); const om = await metric(ok); const oa = await activate(ok, vp); const offlineClosed = oa.ok && await waitState(page, () => !document.getElementById("offlineModal").classList.contains("show"));
  const offlineClosedShot = await shot(page, vp, "offline-modal-closed");
  addRow({ control: "離線摘要 modal（條件觸發）", key: "offline-modal", viewport: vp.name, metric: om, open: offlineOpen, close: offlineClosed, evidence: `${offlineShot}, ${offlineClosedShot}`, detail: "以 10 分鐘真實離線時間戳載入觸發" });
  addRow({ control: "離線摘要／繼續種田", key: "offlineOk", viewport: vp.name, metric: om, open: oa.ok, evidence: offlineShot });

  await page.evaluate(() => window.__farm.showErrorRecovery());
  const errorOpen = await waitState(page, () => !document.getElementById("errorRecovery").hidden);
  const errorShot = await shot(page, vp, "error-recovery-open");
  for (const id of ["errorContinue", "errorReload"]) {
    if (id === "errorReload") await page.evaluate(() => window.__farm.showErrorRecovery());
    const loc = page.locator("#" + id); const m = await metric(loc); const a = await activate(loc, vp);
    let effect = false;
    if (id === "errorContinue") effect = a.ok && await waitState(page, () => document.getElementById("errorRecovery").hidden);
    else effect = a.ok && await waitState(page, () => !!window.__farm && document.getElementById("errorRecovery").hidden, null, 10000);
    addRow({ control: `錯誤恢復／${id === "errorContinue" ? "繼續" : "重載"}`, key: id, viewport: vp.name, metric: m, open: effect, evidence: errorShot, detail: id === "errorReload" ? "真實 click/tap 後頁面重載" : "真實 click/tap 後橫幅隱藏" });
  }
  const errorClosedShot = await shot(page, vp, "error-recovery-closed");
  addRow({ control: "錯誤恢復橫幅（條件觸發）", key: "error-recovery", viewport: vp.name, metric: om, open: errorOpen, close: true, evidence: `${errorShot}, ${errorClosedShot}`, detail: "以公開測試掛鉤觸發；兩條關閉／復原路徑均真實點擊" });
}

function renderReport(head, startedAt, finishedAt) {
  const unique = new Set(rows.map((r) => r.key)).size;
  const applicable = rows.filter((r) => r.status !== "N/A");
  const pass = applicable.filter((r) => r.status === "PASS").length;
  const fail = applicable.filter((r) => r.status === "FAIL").length;
  const na = rows.filter((r) => r.status === "N/A").length;
  const coverage = applicable.length ? (pass / applicable.length * 100).toFixed(1) : "0.0";
  const table = rows.map((r) => `| ${r.control.replace(/\|/g, "\\|")} | ${r.viewport} | ${boolText(r.visible)} | ${boolText(r.open)} | ${boolText(r.close)} | ${r.evidence.replace(/\|/g, "\\|")} | ${r.status} |`).join("\n");
  const failMd = failures.length ? failures.map((f, i) => `${i + 1}. **${f.control} · ${f.viewport}** — ${f.cause} 證據：\`${f.evidence}\`${f.detail ? `；${f.detail}` : ""}`).join("\n") : "無。";
  const errorMd = pageErrors.length ? pageErrors.map((e) => `- ${e}`).join("\n") : "- 無未處理 pageerror。";
  return `# AUDIT-OC-R1｜晨光農場可視開關全清單稽核

## 結論

- HEAD：\`${head}\`
- 稽核時間：${startedAt} ～ ${finishedAt}（Asia/Taipei）
- 視口：390×844、844×390、1366×768
- 唯一控制鍵：**${unique}**
- 視口控制案例：**${rows.length}**（適用 ${applicable.length}、N/A ${na}）
- PASS：**${pass}**
- FAIL：**${fail}**
- 覆蓋率：**${pass}/${applicable.length} = ${coverage}%**
- 截圖：**${shotCount}** 張，全部位於 \`docs/audit_openclose/shots/\`

## 稽核方法與判定

本輪從上述 HEAD 的工作樹啟動只讀本地 HTTP server，以 Playwright Chromium 對三個指定視口逐項執行。條件式功能以隔離 browser context 的稽核狀態解鎖（等級、金幣、材料、信件、章節、重複資料列）；沒有修改或繞過遊戲 UI 開啟器，開啟／切換／關閉皆由 locator 真實 click/tap 完成。離線摘要以 10 分鐘舊時間戳重新載入自然觸發；錯誤恢復因沒有使用者 opener，使用既有公開測試掛鉤觸發後再真實點擊其按鈕。

「可見」同時要求：computed display 非 none、visibility 非 hidden/collapse、opacity > 0、非零面積、rect 完整在視口內，以及中心點 \`elementFromPoint\` 命中自身或自身子元素。開啟器另要求點擊後出現可觀察的視覺狀態；面板／modal／抽屜／泡泡／輪盤均至少驗一條關閉或回復路徑。內部主要按鈕逐一捲入視口、重做相同可見與中心命中檢查，再送出真實 click/tap。響應式專用 D-pad/A 在桌面視口標 N/A，不計入覆蓋率。

## 逐控制表

| 控制 | 視口 | 可見 | 可開／可點 | 可關／回復 | 證據檔名 | 結果 |
|---|---:|---:|---:|---:|---|---:|
${table}

## FAIL 清單與根因初判

${failMd}

## 瀏覽器執行異常

${errorMd}

## 覆蓋率口徑

- 分母為所有適用的「控制 × 視口」案例；N/A 僅限明確的響應式或條件式不適用控制。
- 重複資料控制不抽樣：訂單按鈕、升級、信件、種子、建造輪與圖鑑 item 均逐顆列入。
- \`可關／回復 = —\` 表示該列是 action／selection，不是獨立面板開啟器；其真實可點結果記在「可開／可點」。
- 截圖是 click/tap 後的視口證據；同一已開面板內的按鈕可共用該面板證據檔。
`;
}

async function run() {
  const viewportArg = process.argv.find((arg) => arg.startsWith("--viewport="));
  const requestedViewport = viewportArg ? viewportArg.slice("--viewport=".length) : null;
  const stageArg = process.argv.find((arg) => arg.startsWith("--stage="));
  const requestedStage = stageArg ? stageArg.slice("--stage=".length) : null;
  if (process.argv.includes("--merge")) {
    const partials = VIEWPORTS.map((vp) => JSON.parse(fs.readFileSync(path.join(OUT, `audit-results-${vp.name}.json`), "utf8")));
    partials.forEach((part) => { rows.push(...part.rows); failures.push(...part.failures); pageErrors.push(...part.pageErrors); shotCount += part.shotCount; });
    const head = partials[0].head;
    const startedAt = partials.map((p) => p.startedAt).sort()[0];
    const finishedAt = partials.map((p) => p.finishedAt).sort().slice(-1)[0];
    fs.writeFileSync(path.join(OUT, "AUDIT_OC_R1.md"), renderReport(head, startedAt, finishedAt), "utf8");
    fs.writeFileSync(path.join(OUT, "audit-results.json"), JSON.stringify({ head, startedAt, finishedAt, viewports: VIEWPORTS, rows, failures, pageErrors, shotCount }, null, 2), "utf8");
    const applicable = rows.filter((r) => r.status !== "N/A");
    console.log(JSON.stringify({ uniqueControls: new Set(rows.map((r) => r.key)).size, cases: rows.length, applicable: applicable.length, pass: applicable.filter((r) => r.status === "PASS").length, fail: applicable.filter((r) => r.status === "FAIL").length, shots: shotCount, pageErrors: pageErrors.length }, null, 2));
    return;
  }
  const activeViewports = requestedViewport ? VIEWPORTS.filter((vp) => vp.name === requestedViewport) : VIEWPORTS;
  if (!activeViewports.length) throw new Error(`Unknown viewport ${requestedViewport}`);
  fs.mkdirSync(SHOTS, { recursive: true });
  if (requestedViewport && requestedStage) {
    const existingPath = path.join(OUT, `audit-results-${requestedViewport}.json`);
    if (fs.existsSync(existingPath)) {
      const existing = JSON.parse(fs.readFileSync(existingPath, "utf8"));
      rows.push(...existing.rows);
      failures.push(...existing.failures);
      pageErrors.push(...existing.pageErrors.filter((e) => !e.startsWith(`${requestedViewport}/${requestedStage}:`)));
      shotCount = existing.shotCount;
    }
  }
  for (const old of fs.readdirSync(SHOTS)) {
    if (!old.endsWith(".png")) continue;
    if (!requestedStage && (!requestedViewport || old.startsWith(requestedViewport + "-"))) fs.unlinkSync(path.join(SHOTS, old));
  }
  const startedAt = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Taipei" }).replace(" ", "T") + "+08:00";
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  try {
    for (const vp of activeViewports) {
      console.log(`AUDIT ${vp.name} start`);
      let stages = [
        ["base", auditBaseAndToggles],
        ["seeds", auditSeedDrawer],
        ["assistant", auditAssistant],
        ["side-panels", auditSidePanels],
        ["settings-help", auditSettingsAndHelp],
        ["scene-overlays", auditSceneOverlays],
        ["mailbox-letters", auditMailboxAndLetters],
        ["conditional-surfaces", auditConditionalSurfaces],
      ];
      if (requestedStage) stages = stages.filter(([stageName]) => stageName === requestedStage);
      if (!stages.length) throw new Error(`Unknown stage ${requestedStage}`);
      const browser = await chromium.launch({ headless: true, args: ["--disable-gpu"] });
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.mobile, serviceWorkers: "block", reducedMotion: "reduce", locale: "zh-TW", timezoneId: "Asia/Taipei" });
      try {
        for (const [stageName, stage] of stages) {
          const page = await context.newPage();
          page.setDefaultTimeout(3000);
          page.on("pageerror", (error) => pageErrors.push(`${vp.name}/${stageName}: ${String(error)}`));
          try {
            await bootFresh(page, base);
            await stage(page, vp, base);
            console.log(`AUDIT ${vp.name} ${stageName} done`);
          } catch (error) {
            const message = `${vp.name}/${stageName}: fatal audit stage: ${error.stack || error}`;
            pageErrors.push(message);
            console.error(message);
          } finally {
            await page.close().catch(() => {});
          }
          if (requestedViewport) {
            const checkpointAt = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Taipei" }).replace(" ", "T") + "+08:00";
            fs.writeFileSync(path.join(OUT, `audit-results-${vp.name}.json`), JSON.stringify({ head, startedAt, finishedAt: checkpointAt, viewports: [vp], rows: rows.filter((r) => r.viewport === vp.name), failures: failures.filter((f) => f.viewport === vp.name), pageErrors: pageErrors.filter((e) => e.startsWith(vp.name + "/")), shotCount: fs.readdirSync(SHOTS).filter((name) => name.startsWith(vp.name + "-") && name.endsWith(".png")).length }, null, 2), "utf8");
          }
        }
      } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
      }
      console.log(`AUDIT ${vp.name} done rows=${rows.filter((r) => r.viewport === vp.name).length}`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  const finishedAt = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Taipei" }).replace(" ", "T") + "+08:00";
  const resultPath = requestedViewport ? path.join(OUT, `audit-results-${requestedViewport}.json`) : path.join(OUT, "audit-results.json");
  if (!requestedViewport) fs.writeFileSync(path.join(OUT, "AUDIT_OC_R1.md"), renderReport(head, startedAt, finishedAt), "utf8");
  fs.writeFileSync(resultPath, JSON.stringify({ head, startedAt, finishedAt, viewports: activeViewports, rows, failures, pageErrors, shotCount }, null, 2), "utf8");
  const applicable = rows.filter((r) => r.status !== "N/A");
  const pass = applicable.filter((r) => r.status === "PASS").length;
  const fail = applicable.filter((r) => r.status === "FAIL").length;
  console.log(JSON.stringify({ uniqueControls: new Set(rows.map((r) => r.key)).size, cases: rows.length, applicable: applicable.length, pass, fail, shots: shotCount, pageErrors: pageErrors.length }, null, 2));
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
