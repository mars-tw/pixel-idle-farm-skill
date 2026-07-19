/* =========================================================================
 * test-rpg-v4-e2e.js — Stage 4–11 RPG 場景 gate E2E（真瀏覽器）
 *
 * 對應 references/production-directive-stage4-game-audit.md：
 *   1. 大世界：地圖 ≥22×12，世界像素 > 視口（camera 可平移）
 *   2. camera follow：角色移動 → 世界平移、角色維持在視口內
 *   3. 視覺：地面磚全用 v4 terrain atlas、物件/角色用 atlas sprite、主地圖 0 emoji、無 CSS 格線
 *   4. 動作走位路由：選工具 → 點地圖 → 角色走過去 → 動作 → 結算（種植/清除）
 *   5. 故事地圖驅動：序章任務鏈（讀告示→種麥→澆水→收成）逐步推進，地圖任務標記指向目標
 *   6. y-sort 遮擋：角色 z-index = 腳底 baseline，建築/物件依 baseline 分層
 *   7. 390px 無水平溢出、無 console / pageerror
 *   8. Stage 9：天氣視覺化——rain/sunny 切換時 #weatherLayer 的 class/data-weather 正確跟隨，
 *      clear 時視覺效果歸零，桌機/手機都不造成水平溢出
 *   9. Stage 10：NPC 重複委託——第三章完成後 ch3done 對話階段、走近 NPC 自動生成委託、
 *      庫存不足時交付按鈕 disabled、交付後扣庫存發獎並進冷卻、冷卻中不重複生成
 *  10. Stage 11：農場圖鑑——已發現/未發現內容正確區分（不連帶洩漏同系列其他項目）、
 *      鎮民名錄反映真實互動過的 NPC、動物親密度里程碑不受衰減影響、無水平溢出
 * 執行：node scripts/test-rpg-v4-e2e.js   （需 devDependency: playwright）
 * ========================================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".css": "text/css" };

let failed = 0;
function assert(cond, msg) { if (cond) console.log("  ✓ " + msg); else { console.error("  ✗ " + msg); failed++; } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dismissOpenModal(page) {
  await page.waitForFunction(() => !document.getElementById("startupLoading"));
  await page.evaluate(() => {
    const modal = document.querySelector(".modal.show");
    if (!modal) return;
    const close = modal.querySelector("#howToOk, #offlineOk, #settingsOk, #lettersClose");
    if (!close) throw new Error(`modal ${modal.id || "unknown"} 缺正式關閉控制`);
    close.click();
  });
  await page.waitForFunction(() => !document.querySelector(".modal.show"));
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, "http://local").pathname);
      const safePath = pathname === "/" ? "/index.html" : pathname;
      const fp = path.resolve(ROOT, "." + safePath);
      const rel = path.relative(ROOT, fp);
      // path.relative 而非 fp.startsWith(ROOT)：startsWith 對同前綴的鄰居目錄（如 ROOT 是
      // "C:\repo" 時的 "C:\repo-evil"）會誤判為在 ROOT 底下
      if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

// 等角色走完（moving 變 false）
async function waitArrive(page, max) {
  const t0 = Date.now();
  const limit = Math.max(max || 0, 60000);
  while (Date.now() - t0 < limit) {
    if (!(await page.evaluate(() => window.__farm.moving()))) return true;
    await sleep(120);
  }
  return false;
}
async function configureE2ePage(page) {
  page.setDefaultTimeout(60000);
}
async function storyProgress(page) {
  return page.evaluate(() => {
    const panel = document.getElementById("storyPanel");
    const bar = document.querySelector(".story-progress");
    const completed = (window.__farm.state().story && window.__farm.state().story.completed) || {};
    return {
      quest: window.__farm.state().story.questId,
      count: Object.keys(completed).length,
      progress: bar ? bar.dataset.progress : "",
      text: panel ? panel.innerText : "",
    };
  });
}
async function clearServiceWorkerState(page) {
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("pixel-farm-rpg-")).map((key) => caches.delete(key)));
    }
  });
}
async function reloadAllowAbort(page) {
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
  } catch (e) {
    if (!/ERR_ABORTED|frame was detached/i.test(String(e && e.message))) throw e;
  }
}
async function runTrueServiceWorkerOfflineTest(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow", reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(base + "?swtest=1", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => window.__farm && window.__farm.state);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await reloadAllowAbort(page);
    await page.waitForFunction(() => window.__farm && window.__farm.state);
    await page.waitForFunction(() => window.Atlas && window.Atlas.isReady && window.Atlas.isReady(), { timeout: 20000 });
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, { timeout: 10000 });
    await context.setOffline(true);
    await reloadAllowAbort(page);
    await page.waitForFunction(() => window.__farm && window.__farm.state && document.getElementById("questDock") && document.getElementById("questDock").offsetHeight > 0, { timeout: 12000 });
    await page.waitForFunction(() => window.Atlas && window.Atlas.isReady && window.Atlas.isReady(), { timeout: 20000 });
    const offlinePlayable = await page.evaluate(() => ({
      swtest: new URLSearchParams(location.search).has("swtest"),
      controlled: !!navigator.serviceWorker.controller,
      questDock: document.getElementById("questDock").innerText,
      tileCount: document.querySelectorAll("#groundLayer .gtile").length,
      atlasReady: !!(window.Atlas && window.Atlas.isReady && window.Atlas.isReady()),
    }));
    assert(offlinePlayable.swtest && offlinePlayable.controlled && offlinePlayable.tileCount > 0 && offlinePlayable.questDock.length > 0 && offlinePlayable.atlasReady,
      `真 SW 離線重載仍可載入遊戲（tiles=${offlinePlayable.tileCount}, atlas=${offlinePlayable.atlasReady}）`);
  } finally {
    await context.setOffline(false).catch(() => {});
    await clearServiceWorkerState(page).catch(() => {});
    await context.close();
  }
}
async function keyboardTabSmoke(page) {
  await dismissOpenModal(page);
  await page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
  const seen = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        id: el.id || "",
        cls: String(el.className || ""),
        text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40),
        outlineStyle: cs.outlineStyle,
        outlineWidth: parseFloat(cs.outlineWidth) || 0,
        visible: r.width > 0 && r.height > 0,
      };
    });
    if (info && info.visible) seen.push(info);
  }
  const distinct = new Map(seen.map((x) => [(x.id || x.cls || x.text), x]));
  const focused = [...distinct.values()];
  const visibleFocus = focused.filter((x) => x.outlineStyle !== "none" && x.outlineWidth >= 2);
  const reachedMain = focused.some((x) => x.cls.includes("side-tab")) && focused.some((x) => x.id === "settingsBtn" || x.id === "howToBtn" || x.id === "resetBtn");
  return { focused, visibleFocus, reachedMain };
}

async function runShortDesktopLayoutTest(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 700 }, serviceWorkers: "block", reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => window.__farm && window.__farm.state);
    await configureE2ePage(page);
    await dismissOpenModal(page);
    const mainControls = await page.evaluate(() => {
      const ids = ["settingsBtn", "spriteToggle", "howToBtn", "resetBtn"];
      return {
        controls: ids.map((id) => {
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ block: "center", inline: "nearest" });
          const r = el ? el.getBoundingClientRect() : { width: 0, height: 0, top: 9999, bottom: 9999, left: 9999, right: 9999 };
          const hit = el ? document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2))) : null;
          return { id, visible: !!el && r.width > 0 && r.height >= 40 && r.top >= 0 && r.bottom <= innerHeight && (hit === el || el.contains(hit)) };
        }),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    assert(mainControls.controls.every((c) => c.visible) && mainControls.overflow <= 2,
      `1366x700 主要工具按鈕可見可點且無水平溢出（${mainControls.controls.map((c) => c.id + "=" + c.visible).join(", ")}）`);
    await page.locator("#settingsBtn").scrollIntoViewIfNeeded();
    await page.click("#settingsBtn");
    await page.waitForFunction(() => document.getElementById("settingsModal").classList.contains("show"));
    const modalMetrics = await page.evaluate(() => {
      const card = document.querySelector("#settingsModal .modal-card");
      const cs = getComputedStyle(card);
      const r = card.getBoundingClientRect();
      return {
        maxHeight: parseFloat(cs.maxHeight) || 0,
        overflowY: cs.overflowY,
        inViewport: r.top >= 0 && r.bottom <= innerHeight,
      };
    });
    await page.locator("#pwaCheckBtn").scrollIntoViewIfNeeded();
    await page.click("#pwaCheckBtn");
    const pwaReachable = await page.evaluate(() => {
      const btn = document.getElementById("pwaCheckBtn");
      const ok = document.getElementById("settingsOk");
      const status = document.getElementById("pwaUpdateStatus");
      const br = btn.getBoundingClientRect();
      ok.scrollIntoView({ block: "center" });
      const or = ok.getBoundingClientRect();
      return {
        pwaButton: br.width > 0 && br.height >= 40 && br.top >= 0 && br.bottom <= innerHeight,
        okButton: or.width > 0 && or.height >= 40 && or.top >= 0 && or.bottom <= innerHeight,
        statusText: status ? status.textContent : "",
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    assert(modalMetrics.maxHeight <= 668 && modalMetrics.overflowY === "auto" && modalMetrics.inViewport &&
      pwaReachable.pwaButton && pwaReachable.okButton && pwaReachable.statusText.length > 0 && pwaReachable.overflow <= 2,
      `1366x700 設定 modal 可滾動，檢查更新/確認按鈕可達可點（max=${modalMetrics.maxHeight}, overflow=${modalMetrics.overflowY}）`);
  } finally {
    await context.close();
  }
}

async function runTouchFarmConfirmationTest(browser, base) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  try {
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => window.__farm && window.__farm.state);
    await configureE2ePage(page);
    await dismissOpenModal(page);
    const ids = await page.evaluate(() => window.__farm.state().map.tiles.filter((t) => t.plotIndex != null).slice(0, 4).map((t) => t.id));
    const touch = (id) => page.evaluate((tileId) => {
      const el = document.querySelector(`.gtile[data-tile-id="${tileId}"]`);
      el.dispatchEvent(new PointerEvent("click", { bubbles: true, pointerType: "touch" }));
    }, id);

    const coinsBefore = await page.evaluate(() => window.__farm.state().coins);
    const controls = await page.evaluate(() => {
      const mc = document.getElementById("mobileControls").getBoundingClientRect();
      const a = document.getElementById("actionA").getBoundingClientRect();
      const seed = document.getElementById("seedHud").getBoundingClientRect();
      return {
        mobile: mc.width > 0 && mc.height > 0,
        actionA: a.width >= 44 && a.height >= 44,
        dpad: document.querySelectorAll(".dpad-btn[data-dir]").length,
        seedHud: seed.width > 0 && seed.height > 0,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    assert(controls.mobile && controls.actionA && controls.dpad === 4 && controls.seedHud && controls.overflow <= 2,
      `R61 手機控制盤/種子 HUD 在地圖內顯示且無橫向溢出：A=${controls.actionA}, dpad=${controls.dpad}, overflow=${controls.overflow}`);

    await touch(ids[0]);
    const dock = await page.evaluate(() => ({
      coins: window.__farm.state().coins,
      crop: window.__farm.state().plots[0].cropId,
      pending: window.__farm.touchFarmPreview(),
      visible: !document.getElementById("sceneActionBar").hidden,
      actions: [...document.querySelectorAll("#sceneActionBar [data-action]")].map((b) => b.dataset.action),
      bar: document.getElementById("sceneActionBar").getBoundingClientRect(),
    }));
    assert(dock.coins === coinsBefore && !dock.crop && dock.pending === null && dock.visible &&
      dock.actions.includes("plant") && dock.bar.width > 0 && dock.bar.height >= 44,
      `R61 觸控點空農地改顯示地圖內 action dock，不再二次確認：actions=${dock.actions.join(",")}`);

    await page.click('#sceneActionBar [data-action="plant"]');
    await waitArrive(page, 9000);
    const planted = await page.evaluate(() => ({
      coins: window.__farm.state().coins,
      crop: window.__farm.state().plots[0].cropId,
      pending: window.__farm.touchFarmPreview(),
    }));
    assert(planted.crop === "wheat" && planted.coins === coinsBefore - windowSeedCost() && planted.pending === null,
      `R61 action dock 種植會走既有移動/種植流程：crop=${planted.crop}, coins=${planted.coins}`);

    await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      const start = window.Game.getTileXY(st, 7, 5);
      st.player.tileId = start.id; st.player.x = start.x; st.player.y = start.y; st.player.facing = "up";
      F.refresh();
    });
    await page.click('.dpad-btn[data-dir="up"]');
    await waitArrive(page, 3000);
    const moved = await page.evaluate(() => {
      const st = window.__farm.state();
      return { tile: st.player.tileId, x: st.player.x, y: st.player.y, facing: st.player.facing };
    });
    assert(moved.tile === "t7_4" && moved.facing === "up",
      `R61 D-pad 逐格移動重用玩家移動狀態：tile=${moved.tile}, facing=${moved.facing}`);

    await page.evaluate((targetId) => {
      const F = window.__farm; const st = F.state();
      const target = window.Game.getTile(st, targetId);
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [dx, dy] of dirs) {
        const stand = window.Game.getTileXY(st, target.x + dx, target.y + dy);
        if (stand && window.Game.isWalkable(st, stand)) {
          st.player.tileId = stand.id; st.player.x = stand.x; st.player.y = stand.y;
          st.player.facing = window.Game.facingTo(stand, target);
          break;
        }
      }
      F.setTool("hand");
      F.refresh();
    }, ids[2]);
    const coinsBeforeA = await page.evaluate(() => window.__farm.state().coins);
    const actionAReach = await page.evaluate(() => {
      const el = document.getElementById("actionA");
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = x >= 0 && x < innerWidth && y >= 0 && y < innerHeight ? document.elementFromPoint(x, y) : null;
      return { top: r.top, bottom: r.bottom, width: r.width, height: r.height,
        hit: !!hit && (hit === el || el.contains(hit)), hitLabel: hit && (hit.id || hit.className || hit.tagName) };
    });
    assert(actionAReach.width >= 44 && actionAReach.height >= 44 && actionAReach.top >= 0 &&
      actionAReach.bottom <= 844 && actionAReach.hit,
      `R66 A 鍵在互動後仍完整可見可點（top=${Math.round(actionAReach.top)}, bottom=${Math.round(actionAReach.bottom)}, hit=${actionAReach.hitLabel}）`);
    await page.click("#actionA");
    await waitArrive(page, 9000);
    const actionA = await page.evaluate((targetId) => {
      const st = window.__farm.state();
      const tile = window.Game.getTile(st, targetId);
      return { crop: st.plots[tile.plotIndex].cropId, coins: st.coins, facing: st.player.facing };
    }, ids[2]);
    assert(actionA.crop === "wheat" && actionA.coins === coinsBeforeA - windowSeedCost(),
      `R61 A 鍵會對面向農地執行情境動作：crop=${actionA.crop}, facing=${actionA.facing}`);
  } finally {
    await context.close();
  }
}

function windowSeedCost() { return 1; }

async function run() {
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (e) { console.error("需要 devDependency: playwright"); process.exit(2); }

  const server = await startServer();
  const port = server.address().port;
  const base = "http://127.0.0.1:" + port + "/index.html";
  const browser = await chromium.launch();

  try {
  console.log("\n== R67 preflight gates ==");
  await runShortDesktopLayoutTest(browser, base);
  await runTouchFarmConfirmationTest(browser, base);
  await runTrueServiceWorkerOfflineTest(browser, base);
  for (const vp of [{ w: 1280, h: 900, name: "桌面 1280x900" }, { w: 390, h: 844, name: "手機 390x844" }]) {
    console.log("\n== 視窗 " + vp.name + " ==");
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) errors.push("console: " + m.text()); });
    page.on("pageerror", (e) => errors.push("pageerror: " + (e && e.message)));

    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
    await configureE2ePage(page);
    const pwaFiles = await page.evaluate(async () => {
      const manifestRes = await fetch("manifest.webmanifest");
      const manifest = await manifestRes.json();
      const swRes = await fetch("sw.js");
      const swText = await swRes.text();
      const uiRes = await fetch("src/ui.js");
      const uiText = await uiRes.text();
      const htmlRes = await fetch("index.html");
      const htmlText = await htmlRes.text();
      let swSyntax = true;
      try { new Function(swText); } catch (e) { swSyntax = e.message; }
      const swVersion = (swText.match(/CACHE_VERSION\s*=\s*"([^"]+)"/) || [])[1] || "";
      const localRefs = [...htmlText.matchAll(/<(script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["'][^>]*>/gi)]
        .map((m) => m[2]).filter((url) => !/^(https?:|data:|mailto:|tel:|#)/i.test(url));
      return {
        manifestOk: manifestRes.ok,
        manifestName: manifest.name,
        orientation: manifest.orientation,
        iconSizes: (manifest.icons || []).map((i) => i.sizes).join(","),
        swOk: swRes.ok,
        swSyntax,
        swHasVersion: swText.includes("CACHE_VERSION"),
        swHasStrategies: swText.includes("networkFirst") && swText.includes("cacheFirst"),
        swHasSkipWaiting: swText.includes("SKIP_WAITING"),
        swHasInstallSkipWaiting: /addEventListener\(["']install["'][\s\S]*self\.skipWaiting\(\)/.test(swText),
        swHasClientsClaim: swText.includes("clients.claim()"),
        swHasCacheVersioned: swText.includes("VERSION_QUERY") && swText.includes("versioned(\"./src/ui.js\")") && swText.includes("ignoreSearch: false"),
        swHasFallback: swText.includes("OFFLINE_URL") && swText.includes("offline.html"),
        swHasAllSrc: ["./src/config.js", "./src/game.js", "./src/state.js", "./src/atlas.js", "./src/ui.js"].every((p) => swText.includes(p)),
        swVersion,
        htmlHasVersionedLocalRefs: localRefs.length >= 7 && localRefs.every((url) => new URL(url, location.href).searchParams.get("v") === swVersion),
        htmlHasBootGuard: htmlText.includes("FARM_CACHE_VERSION") && htmlText.includes("getRegistration(\"./\")") &&
          htmlText.includes("reg.update()") && htmlText.includes("controllerchange") &&
          htmlText.includes("RELOAD_WINDOW_MS = 15000") && htmlText.includes("pixelFarmPwaAutoReloaded"),
        uiHasAssetVersioning: uiText.includes("FARM_VERSION_QUERY") && uiText.includes("assetUrl(\"assets/generated/crop-growth.png\")"),
        uiHasControllerGuard: uiText.includes("controllerchange") && uiText.includes("PWA_AUTO_RELOAD_WINDOW_MS = 15000") &&
          uiText.includes("PWA_AUTO_RELOAD_SESSION_KEY") && uiText.includes("sessionStorage") &&
          uiText.includes("shouldAutoReloadOnControllerChange") && uiText.includes("showPwaReloadPrompt"),
        webdriver: navigator.webdriver === true,
      };
    });
    assert(pwaFiles.manifestOk && pwaFiles.manifestName === "像素農場 RPG" && pwaFiles.orientation === "any" && pwaFiles.iconSizes.includes("192x192") && pwaFiles.iconSizes.includes("512x512"),
      `PWA manifest 可取且含名稱/任意方向/icon（${pwaFiles.manifestName}, ${pwaFiles.iconSizes}）`);
    assert(pwaFiles.swOk && pwaFiles.swSyntax === true && pwaFiles.swHasVersion && pwaFiles.swHasStrategies && pwaFiles.swHasSkipWaiting &&
      pwaFiles.swHasInstallSkipWaiting && pwaFiles.swHasClientsClaim && pwaFiles.swHasCacheVersioned && pwaFiles.swHasFallback &&
      pwaFiles.swHasAllSrc && pwaFiles.htmlHasVersionedLocalRefs && pwaFiles.htmlHasBootGuard &&
      pwaFiles.uiHasAssetVersioning && pwaFiles.uiHasControllerGuard && pwaFiles.swVersion === "r72-20260719-1",
      `SW 檔存在、語法有效，含版本鍵/快取策略/skipWaiting（syntax=${pwaFiles.swSyntax}）`);
    assert(pwaFiles.webdriver === true, "E2E 環境 navigator.webdriver=true，可跳過 SW 註冊");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => window.__farm && window.__farm.state);
    await page.waitForFunction(() => window.Atlas && window.Atlas.isReady && window.Atlas.isReady(), { timeout: 20000 });
    await dismissOpenModal(page);
    await sleep(300);

    // R23：離開期間摘要（重開且離線 >=5 分鐘）
    const offlineRaw = await page.evaluate(() => {
      const start = Date.now() - 6 * 60 * 1000;
      const st = window.defaultState(start);
      st.stats.plantCount = 1;
      st.lastSeenAt = start;
      st.plots[0].cropId = "wheat";
      st.plots[0].plantedAt = start - window.CROPS.wheat.growMs - 1000;
      st.flags.bridgeRepaired = true;
      st.flags.eastForageDiscovered = true;
      st.flags.forageNodes.east_herb_patch = start - window.FORAGE_NODE_COOLDOWN_MS + 60 * 1000;
      return JSON.stringify(st);
    });
    await page.addInitScript(({ key, raw }) => {
      if (!sessionStorage.getItem("__r23OfflineSeeded")) {
        localStorage.setItem(key, raw);
        sessionStorage.setItem("__r23OfflineSeeded", "1");
      }
    }, { key: "pixel_idle_farm_save_v1", raw: offlineRaw });
    await page.reload();
    await page.waitForFunction(() => window.__farm && window.__farm.state);
    // R68 起初始 modal 延後到 loading 收場後才顯示：先等 loading 移除，再輪詢離線摘要出現（硬上限；
    // 逾時不吞錯——由下方既有斷言以 shown/head 實值報失敗，真回歸仍會紅）
    await page.waitForFunction(() => !document.getElementById("startupLoading"), { timeout: 20000 });
    await page.waitForFunction(() => {
      const m = document.getElementById("offlineModal");
      return m && m.classList.contains("show");
    }, { timeout: 8000 }).catch(() => {});
    const offlineSummary = await page.evaluate(() => {
      const modal = document.getElementById("offlineModal");
      const body = document.getElementById("offlineBody");
      return { shown: modal.classList.contains("show"), text: body.innerText,
        head: body.querySelector('[data-audit="offline-head"]')?.textContent || "",
        mature: body.querySelector('[data-audit="offline-mature"]')?.textContent || "",
        forage: body.querySelector('[data-audit="offline-forage"]')?.textContent || "" };
    });
    assert(offlineSummary.shown && offlineSummary.head.includes("你離開的 6 分鐘") && offlineSummary.head.includes("離線收益 +0 金"),
      `離線 >=5 分鐘重開顯示摘要與收益（${offlineSummary.head}）`);
    assert(offlineSummary.mature.includes("作物成熟") && offlineSummary.mature.includes("1"),
      `離線摘要列出成熟作物數（${offlineSummary.mature}）`);
    assert(offlineSummary.forage.includes("採集點已刷新") && offlineSummary.forage.includes("1"),
      `離線摘要列出採集點刷新（${offlineSummary.forage}）`);
    await page.click("#offlineOk");
    await page.click("#settingsBtn");
    const r27Settings = await page.evaluate(() => {
      const modal = document.getElementById("settingsModal");
      const toggles = [...document.querySelectorAll("[data-setting-key]")];
      const review = document.querySelector('[data-audit="offline-review-summary"]');
      const gear = document.getElementById("settingsBtn").getBoundingClientRect();
      return {
        shown: modal.classList.contains("show"),
        focusInside: modal.contains(document.activeElement),
        keys: toggles.map((el) => el.dataset.settingKey),
        textSizes: [...document.querySelectorAll('button[data-audit="text-size-mode"]')].map((el) => el.dataset.textSize),
        soundVolume: document.querySelector('[data-audit="sound-volume"]')?.value || "",
        soundVolumeText: document.querySelector('[data-audit="sound-volume-value"]')?.textContent || "",
        versionText: document.querySelector('[data-audit="setting-pwa"]')?.innerText || "",
        pwaButton: document.querySelector('[data-audit="pwa-check"]')?.textContent || "",
        diagnostics: document.querySelector('[data-audit="performance-diagnostics"]')?.textContent || "",
        perfHistoryEmpty: document.querySelector('[data-audit="performance-history-empty"]')?.textContent || "",
        liveAttrs: {
          toast: document.getElementById("toast-zone")?.getAttribute("aria-live") || "",
          quest: document.getElementById("questDock")?.getAttribute("aria-live") || "",
          pwa: document.getElementById("pwaUpdate")?.getAttribute("aria-live") || "",
          error: document.getElementById("errorRecovery")?.getAttribute("aria-live") || "",
        },
        settingsAria: document.getElementById("settingsBtn").getAttribute("aria-label") || "",
        tabAria: [...document.querySelectorAll(".side-tab")].map((el) => el.getAttribute("aria-label") || ""),
        reviewText: review ? review.innerText : "",
        saved: window.__farm.lastOfflineSummary(),
        gearTap: { w: gear.width, h: gear.height },
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    assert(r27Settings.shown && r27Settings.keys.includes("smartAssistant") && r27Settings.keys.includes("offlineSummary") && r27Settings.keys.includes("soundEnabled"),
      `設定面板集中助手與離線摘要偏好（keys=${r27Settings.keys.join(",")}）`);
    assert(r27Settings.reviewText.includes("離開 6 分鐘") && r27Settings.reviewText.includes("離線收益 +0 金") &&
      r27Settings.reviewText.includes("作物成熟 1 株") && r27Settings.reviewText.includes("採集點已刷新 1 處") &&
      r27Settings.saved && r27Settings.saved.readyPlots === 1 && r27Settings.saved.forageReadyCount === 1,
      `設定面板可回看最近一次離線摘要（${r27Settings.reviewText.replace(/\n/g, " / ")}）`);
    assert(r27Settings.focusInside && r27Settings.textSizes.join(",") === "small,medium,large" && r27Settings.versionText.includes("r72-20260719-1") &&
      r27Settings.pwaButton.includes("檢查更新") && r27Settings.diagnostics.includes("FPS") && r27Settings.diagnostics.includes("實際"),
      `設定面板含焦點移入/文字大小/PWA 版本/效能診斷（${r27Settings.diagnostics}）`);
    assert(r27Settings.soundVolume === "55" && r27Settings.soundVolumeText === "55%",
      `設定面板含程序化音效音量控制（${r27Settings.soundVolumeText}）`);
    assert(r27Settings.perfHistoryEmpty.includes("尚無") && Object.values(r27Settings.liveAttrs).every((v) => v === "polite"),
      `動態通知容器具 aria-live=polite 且效能歷史有空狀態（${JSON.stringify(r27Settings.liveAttrs)}）`);
    assert(r27Settings.settingsAria === "開啟設定" && r27Settings.tabAria.every((label) => label.includes("切換到")),
      `主要設定與分頁 aria-label 完整（tabs=${r27Settings.tabAria.join(" / ")}）`);
    assert(r27Settings.gearTap.h >= 44 && r27Settings.overflow <= 2,
      `設定入口可點且無水平溢出（h=${Math.round(r27Settings.gearTap.h)}, overflow=${r27Settings.overflow}）`);
    const textSizeBase = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".setting-title")).fontSize));
    await page.click('[data-text-size="large"]');
    const textSizeLarge = await page.evaluate((baseSize) => ({
      setting: window.__farm.state().settings.textSize,
      htmlClass: document.documentElement.classList.contains("text-large"),
      font: parseFloat(getComputedStyle(document.querySelector(".setting-title")).fontSize),
      baseSize,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }), textSizeBase);
    assert(textSizeLarge.setting === "large" && textSizeLarge.htmlClass && textSizeLarge.font > textSizeLarge.baseSize && textSizeLarge.overflow <= 2,
      `文字大小「大」會套用 CSS 變數且無水平溢出（${textSizeLarge.baseSize}->${textSizeLarge.font}）`);
    await page.click('[data-text-size="medium"]');
    await page.click('[data-setting-key="offlineSummary"]');
    const offlineOff = await page.evaluate(() => ({
      state: window.__farm.state().settings.offlineSummary,
      enabled: document.querySelector('[data-setting-key="offlineSummary"]').dataset.enabled,
    }));
    assert(offlineOff.state === false && offlineOff.enabled === "false", "設定面板可關閉離線摘要偏好");
    await page.click('[data-setting-key="offlineSummary"]');
    await page.click('[data-setting-key="smartAssistant"]');
    const assistantOff = await page.evaluate(() => ({
      state: window.__farm.state().settings.smartAssistant,
      hidden: document.getElementById("smartAssistant").classList.contains("hidden"),
      enabled: document.querySelector('[data-setting-key="smartAssistant"]').dataset.enabled,
    }));
    assert(assistantOff.state === false && assistantOff.hidden && assistantOff.enabled === "false",
      "設定面板可關閉智慧農務助手並立即隱藏面板");
    await page.click('[data-setting-key="smartAssistant"]');
    const textareaKeys = await page.evaluate(() => {
      const st = window.__farm.state();
      st.player.tileId = "t7_5";
      st.player.x = 7;
      st.player.y = 5;
      st.player.facing = "down";
      window.__farm.refresh();
      const box = document.getElementById("saveCodeBox");
      box.value = "";
      box.focus();
      return { beforeTile: st.player.tileId, activeId: document.activeElement && document.activeElement.id };
    });
    await page.keyboard.type("wasd");
    await page.keyboard.press("ArrowLeft");
    const textareaAfterKeys = await page.evaluate((beforeTile) => {
      const st = window.__farm.state();
      const box = document.getElementById("saveCodeBox");
      return {
        activeId: document.activeElement && document.activeElement.id,
        value: box.value,
        selectionStart: box.selectionStart,
        playerTile: st.player.tileId,
        facing: st.player.facing,
        preventedMove: st.player.tileId === beforeTile,
      };
    }, textareaKeys.beforeTile);
    assert(textareaKeys.activeId === "saveCodeBox" && textareaAfterKeys.activeId === "saveCodeBox"
      && textareaAfterKeys.value === "wasd" && textareaAfterKeys.selectionStart === 3
      && textareaAfterKeys.preventedMove && textareaAfterKeys.facing === "down",
      `設定 textarea 聚焦時 WASD/方向鍵不被全域移動攔截（value=${textareaAfterKeys.value}, tile=${textareaAfterKeys.playerTile}, cursor=${textareaAfterKeys.selectionStart}）`);
    await page.click('[data-performance-mode="low"]');
    const perfLow = await page.evaluate(() => ({
      mode: window.__farm.state().settings.performanceMode,
      tier: document.documentElement.dataset.performanceTier,
      lowClass: document.documentElement.classList.contains("perf-low"),
      desc: document.querySelector('[data-audit="performance-desc"]')?.textContent || "",
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    assert(perfLow.mode === "low" && perfLow.tier === "low" && perfLow.lowClass && perfLow.overflow <= 2,
      `效能模式可鎖低階並套用天氣降級 class（tier=${perfLow.tier}, overflow=${perfLow.overflow}）`);
    await page.click('[data-performance-mode="auto"]');
    const perfAuto = await page.evaluate(() => window.__farm.performanceInfo());
    const perfHistory = await page.evaluate(() => ({
      history: window.__farm.performanceInfo().history || [],
      rows: [...document.querySelectorAll('[data-audit="performance-history"] .perf-history-row')].map((el) => el.innerText),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    assert(perfAuto.mode === "auto" && perfAuto.tier === "high", `效能模式可切回自動（mode=${perfAuto.mode}, tier=${perfAuto.tier}）`);
    assert(perfHistory.history.length >= 2 && perfHistory.history.length <= 5 &&
      perfHistory.history.some((ev) => ev.type === "downgrade") && perfHistory.history.some((ev) => ev.type === "restore") &&
      perfHistory.rows.length >= 2 && perfHistory.overflow <= 2,
      `效能診斷保留最近降級/恢復歷史（${perfHistory.rows.join(" / ")}）`);
    const exportBefore = await page.evaluate(() => {
      const st = window.__farm.state();
      st.coins = 246;
      st.storage.items.wheat = 7;
      window.save(st);
      return { createdAt: st.createdAt, coins: st.coins, wheat: st.storage.items.wheat };
    });
    await page.click("#exportSaveBtn");
    await page.waitForFunction((expected) => {
      const code = document.getElementById("saveCodeBox").value || "";
      if (code.length < 80) return false;
      try {
        const raw = JSON.parse(decodeURIComponent(escape(atob(code))));
        return raw.createdAt === expected.createdAt && raw.coins === expected.coins && raw.storage.items.wheat === expected.wheat;
      } catch (e) {
        return false;
      }
    }, exportBefore);
    const saveCode = await page.$eval("#saveCodeBox", (el) => el.value);
    await page.evaluate(() => {
      const fresh = window.defaultState(Date.now());
      const live = window.__farm.state();
      Object.keys(live).forEach((k) => delete live[k]);
      Object.assign(live, fresh);
      localStorage.removeItem(window.GAME.saveKey);
    });
    await page.fill("#saveCodeBox", saveCode);
    await page.click("#importSaveBtn");
    await page.waitForFunction((createdAt) => window.__farm && window.__farm.state && window.__farm.state().createdAt === createdAt, exportBefore.createdAt, { timeout: 8000 });
    const importAfter = await page.evaluate(() => ({
      createdAt: window.__farm.state().createdAt,
      coins: window.__farm.state().coins,
      wheat: window.__farm.state().storage.items.wheat || 0,
    }));
    assert(importAfter.createdAt === exportBefore.createdAt && importAfter.coins === 246 && importAfter.wheat === 7,
      `匯出→清檔→匯入還原成功（coins=${importAfter.coins}, wheat=${importAfter.wheat}）`);
    await page.click("#settingsBtn");
    const rawBeforeBadImport = await page.evaluate(() => localStorage.getItem(window.GAME.saveKey));
    await page.fill("#saveCodeBox", "bad-code");
    await page.click("#importSaveBtn");
    await sleep(200);
    const badImport = await page.evaluate((rawBefore) => ({
      sameRaw: localStorage.getItem(window.GAME.saveKey) === rawBefore,
      status: document.getElementById("saveStatus")?.textContent || "",
    }), rawBeforeBadImport);
    assert(badImport.sameRaw && badImport.status.includes("匯入失敗"),
      `壞代碼被拒且不覆蓋存檔（${badImport.status}）`);
    await page.keyboard.press("Escape");
    const escClosed = await page.evaluate(() => !document.getElementById("settingsModal").classList.contains("show"));
    assert(escClosed, "Esc 可關閉設定 modal");
    await page.evaluate(() => {
      const fresh = window.defaultState(Date.now());
      const live = window.__farm.state();
      Object.keys(live).forEach((k) => delete live[k]);
      Object.assign(live, fresh);
      window.save(live);
    });
    await page.reload();
    await page.waitForFunction(() => window.__farm && window.__farm.state);
    await page.waitForFunction(() => window.Atlas && window.Atlas.isReady && window.Atlas.isReady(), { timeout: 20000 });
    await dismissOpenModal(page);
    await sleep(300);
    const tabSmoke = await keyboardTabSmoke(page);
    assert(tabSmoke.focused.length >= 4 && tabSmoke.visibleFocus.length >= 4 && tabSmoke.reachedMain,
      `鍵盤 Tab 可走訪主控件且 focus-visible 有樣式（${tabSmoke.focused.map((x) => x.id || x.cls || x.text).join(" > ")}）`);

    const chrome = await page.evaluate(() => ({
      title: document.title,
      heading: document.querySelector(".title") ? document.querySelector(".title").innerText : "",
      story: document.getElementById("storyPanel") ? document.getElementById("storyPanel").innerText : "",
    }));
    assert(chrome.title === "阿軒割割陽光農場開源遊戲世界", "文件標題已改為新遊戲名");
    assert(chrome.heading.includes("阿軒割割陽光農場開源遊戲世界"), "頁首顯示新遊戲名");
    assert(chrome.story.includes("任務完成度") && chrome.story.includes("0/6"), "故事面板初始顯示 0/6 完成度");
    const dockInitial = await page.evaluate(() => {
      const el = document.getElementById("questDock");
      const r = el.getBoundingClientRect();
      return { text: el.innerText, h: r.height, visible: r.width > 0 && r.height > 0,
        quest: el.dataset.quest, goAria: el.querySelector('[data-audit="quest-dock-go"]')?.getAttribute("aria-label") || "",
        overflow: document.documentElement.scrollWidth - window.innerWidth };
    });
    assert(dockInitial.visible && dockInitial.h >= 44, `任務 Dock 常駐且 tap target >=44px（${Math.round(dockInitial.h)}px）`);
    assert(dockInitial.quest === "intro_reopen_farm" && dockInitial.text.includes("主動作"),
      `任務 Dock 顯示當前任務與主動作（${dockInitial.quest}）`);
    assert(dockInitial.goAria.includes("前往") || dockInitial.goAria.includes("目標"), `Dock 前往按鈕具 aria-label（${dockInitial.goAria}）`);
    assert(dockInitial.overflow <= 2, `任務 Dock 不造成水平溢出（${dockInitial.overflow}）`);

    // 1. R66：整圖模式預設完整可見 + 原尺寸模式可切換
    const world = await page.evaluate(() => {
      const st = window.__farm.state();
      const scene = document.getElementById("mapScene"), wEl = document.getElementById("mapWorld");
      const tile = document.querySelector("#groundLayer .gtile");
      const tr = tile ? tile.getBoundingClientRect() : null;
      return { w: st.map.width, h: st.map.height,
        worldW: wEl.offsetWidth, worldH: wEl.offsetHeight,
        sceneW: scene.clientWidth, sceneH: scene.clientHeight,
        scrollW: scene.scrollWidth, scrollH: scene.scrollHeight,
        mode: scene.dataset.mapMode, tileW: tr ? tr.width : 0 };
    });
    assert(world.w >= 22 && world.h >= 12, `地圖 ≥22×12（${world.w}×${world.h}）`);
    assert(world.mode === "fit" && world.scrollH <= world.sceneH + 2 && world.scrollW <= world.sceneW + 2 &&
      world.worldW <= world.sceneW + 2 && world.worldH <= world.sceneH + 2,
      `整圖模式完整可見且零內捲（mode=${world.mode}, world ${world.worldW}×${world.worldH}, scene ${world.sceneW}×${world.sceneH}, scroll ${world.scrollW}×${world.scrollH}）`);
    assert(world.tileW >= 10, `整圖模式 tile 有最低辨識度（${Math.round(world.tileW)}px）`);
    const naturalMode = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      document.getElementById("mapFitToggle").click();
      await sleep(300);
      const F = window.__farm; const st = F.state();
      st.camera.focusTileId = null; st.camera.focusUntil = 0;
      const scene = document.getElementById("mapScene");
      const tilePx = window.TILE_PX || 48;
      const before = { left: scene.scrollLeft, top: scene.scrollTop };
      const far = st.map.tiles.filter((t) => window.isWalkable(st, t)).sort((a, b) => (b.x + b.y) - (a.x + a.y))[0];
      st.player.tileId = far.id; st.player.x = far.x; st.player.y = far.y;
      F.refresh(); await sleep(300);
      const after = { left: scene.scrollLeft, top: scene.scrollTop };
      return { mode: scene.dataset.mapMode, before, after, farX: far.x, farY: far.y,
        tilePx, worldW: document.getElementById("mapWorld").offsetWidth, sceneW: scene.clientWidth };
    });
    assert(naturalMode.mode === "natural" && naturalMode.worldW > naturalMode.sceneW && naturalMode.tilePx === 48,
      `原尺寸模式可切換且使用 48px tile（mode=${naturalMode.mode}, worldW=${naturalMode.worldW}, sceneW=${naturalMode.sceneW}）`);
    assert(naturalMode.after.left !== naturalMode.before.left || naturalMode.after.top !== naturalMode.before.top,
      `原尺寸模式鏡頭以場景內捲動跟隨（scroll ${naturalMode.before.left},${naturalMode.before.top}→${naturalMode.after.left},${naturalMode.after.top} target=${naturalMode.farX},${naturalMode.farY}）`);
    await page.evaluate(() => document.getElementById("mapFitToggle").click());
    await sleep(300);

    // 3. 視覺：地面磚 atlas / 物件 sprite / 0 emoji / 無格線
    const render = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll("#groundLayer .gtile")];
      const obs = [...document.querySelectorAll("#mapWorld .ob")];
      const reEmoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
      let imgTiles = 0, objImg = 0, emoji = 0;
      for (const t of tiles) if (getComputedStyle(t).backgroundImage.includes("url(")) imgTiles++;
      for (const o of obs) {
        if (getComputedStyle(o).backgroundImage.includes("url(")) objImg++;
        if (reEmoji.test(o.textContent || "")) emoji++;
      }
      const bushes = obs.filter((o) => o.dataset.kind === "obstacle" && o.dataset.object === "bush");
      const ps = document.getElementById("playerSprite");
      const ti = getComputedStyle(tiles[0]);
      // 取同一列相鄰兩磚，驗證精確貼合（無格線間隙）
      const st = window.__farm.state();
      const t00 = tiles.find((t) => t.dataset.tileId === "t0_0");
      const t10 = tiles.find((t) => t.dataset.tileId === "t1_0");
      const abut = t00 && t10 ? Math.abs((t10.offsetLeft) - (t00.offsetLeft + t00.offsetWidth)) : 99;
      return { tiles: tiles.length, imgTiles, obs: obs.length, objImg, emoji,
        bushCount: bushes.length,
        bushSheets: [...new Set(bushes.map((o) => o.dataset.sheet))],
        bushFrames: [...new Set(bushes.map((o) => o.dataset.frame))],
        playerImg: getComputedStyle(ps).backgroundImage.includes("url("),
        pos: ti.position, abut, tileBorder: ti.borderTopWidth };
    });
    assert(render.tiles >= 16 * 12 * 0.9, `地面磚渲染（${render.tiles}）`);
    assert(render.imgTiles === render.tiles, `全部地面磚使用 v4 terrain atlas（${render.imgTiles}/${render.tiles}）`);
    assert(render.obs >= 8, `物件 sprite 數量（建築/障礙/站點/作物/動物，共 ${render.obs}）`);
    assert(render.objImg === render.obs, `全部物件以 atlas sprite 呈現（${render.objImg}/${render.obs}）`);
    assert(render.emoji === 0, `主地圖物件 0 emoji（實際 ${render.emoji}）`);
    assert(render.bushCount >= 1 && render.bushSheets.join(",") === "structures" && render.bushFrames.every((f) => f.indexOf("bush_big") === 0),
      `主畫面 bush 障礙使用 v4 季相 bush_big 素材（${render.bushSheets.join(",")} / ${render.bushFrames.join(",")}）`);
    assert(render.playerImg, "角色 Miri 使用 atlas sprite");
    assert(render.pos === "absolute" && render.abut <= 1, `地面磚絕對定位精確貼合無格線（鄰磚間隙 ${render.abut}px）`);
    assert(parseFloat(render.tileBorder) === 0, "地面磚無邊框線");

    // 3b. 穩定稽核 hook（data-audit / data-kind / data-sheet）— 外部稽核不需依賴內部函式
    const audit = await page.evaluate(() => {
      const q = (sel) => document.querySelectorAll(sel).length;
      const player = document.querySelector('[data-audit="player"]');
      return {
        ground: q('#groundLayer [data-audit="ground-tile"]'),
        structure: q('#mapWorld [data-audit="object"][data-kind="structure"]'),
        station: q('#mapWorld [data-audit="object"][data-kind="station"]'),
        animal: q('#mapWorld [data-audit="object"][data-kind="animal"]'),
        animalSheet: q('#mapWorld [data-sheet="animals"]'),
        playerTile: player ? player.getAttribute("data-tile-id") : null,
        marker: (() => { const m = document.querySelector('[data-audit="quest-marker"]'); return m ? { tile: m.getAttribute("data-tile-id"), quest: m.getAttribute("data-quest") } : null; })(),
      };
    });
    assert(audit.ground >= 16 * 12 * 0.9, `data-audit=ground-tile 可稽核（${audit.ground}）`);
    assert(audit.structure >= 4, `data-kind=structure 多格建築可稽核（${audit.structure}）`);
    assert(audit.station >= 5, `data-kind=station 站點可稽核（${audit.station}）`);
    assert(audit.animal >= 1 && audit.animalSheet >= 1, `data-kind=animal / data-sheet=animals 動物可稽核（${audit.animal}）`);
    assert(!!audit.playerTile, `data-audit=player 帶 data-tile-id（${audit.playerTile}）`);
    assert(audit.marker && audit.marker.quest === "intro_reopen_farm", `data-audit=quest-marker 帶 data-quest（${audit.marker && audit.marker.quest}）`);

    // 4. y-sort 遮擋：角色與物件 z-index = 腳底 baseline（整數、隨 y 增）
    const zsort = await page.evaluate(() => {
      const pl = document.getElementById("player");
      const obs = [...document.querySelectorAll("#mapWorld .ob")];
      const zs = obs.map((o) => parseInt(getComputedStyle(o).zIndex)).filter((z) => !isNaN(z));
      return { playerZ: parseInt(getComputedStyle(pl).zIndex), obZ: zs.length, distinct: new Set(zs).size };
    });
    assert(!isNaN(zsort.playerZ) && zsort.playerZ > 0, `角色 z-index 依腳底 baseline（${zsort.playerZ}）`);
    assert(zsort.obZ >= 8 && zsort.distinct >= 4, `物件依 baseline 分層 y-sort（${zsort.distinct} 種 z）`);

    // 5. 390px 無水平溢出
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 2, `無水平溢出（scrollWidth - innerWidth = ${overflow}）`);

    // ===== Stage 6：NPC 鎮民 + 走近對話泡泡 + 主角性別切換 =====
    const npcAudit = await page.evaluate(() => ({
      npc: document.querySelectorAll('#mapWorld [data-audit="object"][data-kind="npc"]').length,
      sheet: document.querySelectorAll('#mapWorld [data-sheet="npcs"]').length,
    }));
    assert(npcAudit.npc >= 4 && npcAudit.sheet >= 4, `NPC 鎮民可稽核 data-kind=npc / data-sheet=npcs（${npcAudit.npc}）`);
    const npcMeta = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      const child = st.map.tiles.find((t) => t.npc === "child");
      return { childId: child.id, walkable: window.isWalkable(st, child),
        reachable: window.Game.planMoveTo(st, child.id) !== null, phase: window.Game.npcPhase(st) };
    });
    assert(!npcMeta.walkable && npcMeta.reachable, "NPC 阻擋移動但相鄰可達（走近交談）");
    assert(npcMeta.phase === "start", `序章階段 NPC 對話 phase=start（${npcMeta.phase}）`);
    await page.evaluate((id) => window.__farm.clickTile(id), npcMeta.childId);
    await waitArrive(page, 9000);
    await sleep(500);
    const bubble = await page.evaluate(() => {
      const b = document.querySelector('[data-audit="dialogue-bubble"]');
      const log = (window.__farm.state().story.dialogueLog || []).length;
      return { has: !!b, npc: b ? b.dataset.npc : null, text: b ? b.innerText.replace(/\s+/g, " ").trim() : "", log };
    });
    assert(bubble.has && bubble.npc === "child" && bubble.text.includes("圖圖"), `走近孩童出現對話泡泡（${bubble.text}）`);
    assert(bubble.log >= 1, `對話進入側欄記錄（${bubble.log} 則）`);

    const gender = await page.evaluate(() => {
      const before = window.__farm.state().gender;
      document.getElementById("genderToggle").click();
      const after = window.__farm.state().gender;
      const bg = getComputedStyle(document.getElementById("playerSprite")).backgroundImage;
      document.getElementById("genderToggle").click(); // 切回女，避免影響後續斷言
      return { before, after, male: /max-walk|max-actions/.test(bg), back: window.__farm.state().gender };
    });
    assert(gender.before === "f" && gender.after === "m" && gender.male, "主角性別可切換為男（sprite 換 max atlas）");
    assert(gender.back === "f", "性別可切回女");

    // 6. 動作走位路由：hand 點空農土 → 走過去 → 種植 + VFX + 故事推進到 first_water
    //    先把故事推進到 plant_wheat（讀告示牌）
    const sign = await page.evaluate(async () => {
      const F = window.__farm; F.setTool("hand");
      const before = F.state().story.questId;
      const marker = window.questMarkerTile(F.state(), Date.now());
      const signTile = F.state().map.tiles.find((t) => t.station === "sign");
      F.clickTile(signTile.id);
      return { before, marker, signId: signTile.id };
    });
    await waitArrive(page);
    await sleep(300);
    const afterSign = await page.evaluate(() => window.__farm.state().story.questId);
    assert(sign.marker === sign.signId, "序章任務標記指向告示牌");
    assert(sign.before === "intro_reopen_farm" && afterSign === "plant_wheat",
      `讀告示牌推進序章（${sign.before}→${afterSign}）`);
    const signProgress = await storyProgress(page);
    assert(signProgress.progress === "1/6" && signProgress.text.includes("1/6"), `讀告示後完成度 1/6（${signProgress.progress}）`);

    const sow = await page.evaluate(async () => {
      const F = window.__farm; const st = F.state(); F.setTool("hand");
      const marker = window.questMarkerTile(st, Date.now());
      const soil = st.map.tiles.find((t) => t.plotIndex === 0);
      const before = F.vfxSpawns();
      F.clickTile(soil.id);
      return { soilId: soil.id, marker, before };
    });
    await waitArrive(page);
    await sleep(300);
    const sowRes = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      const soil = st.map.tiles.find((t) => t.plotIndex === 0);
      return { planted: !!st.plots[soil.plotIndex].cropId, quest: st.story.questId, vfx: F.vfxSpawns() };
    });
    assert(sow.marker === sow.soilId, "種麥任務標記指向空農土");
    assert(sowRes.planted, "走到農土播種成功");
    assert(sowRes.vfx > sow.before, `種植時地圖出現 VFX（${sow.before}→${sowRes.vfx}）`);
    assert(sowRes.quest === "first_water", `種麥推進到澆水任務（${sowRes.quest}）`);
    const dockAfterMapClick = await page.evaluate(() => {
      const el = document.getElementById("questDock");
      const r = el.getBoundingClientRect();
      return { text: el.innerText, h: r.height, quest: el.dataset.quest,
        tileTab: window.__farm.activeTab(), overflow: document.documentElement.scrollWidth - window.innerWidth };
    });
    assert(dockAfterMapClick.tileTab === "tile" && dockAfterMapClick.h >= 44,
      `點地圖切到磚資訊後 Dock 仍可見且 >=44px（tab=${dockAfterMapClick.tileTab}, h=${Math.round(dockAfterMapClick.h)}）`);
    assert(dockAfterMapClick.quest === "first_water" && dockAfterMapClick.text.includes("主動作"),
      "點地圖後 Dock 仍顯示當前任務與下一動作");
    assert(dockAfterMapClick.overflow <= 2, `點地圖後 Dock 無水平溢出（${dockAfterMapClick.overflow}）`);
    const sowProgress = await storyProgress(page);
    assert(sowProgress.progress === "2/6" && sowProgress.text.includes("種下第一批小麥") && sowProgress.text.includes("1/1"),
      `種麥後完成度 2/6 並顯示作物 1/1（${sowProgress.progress}）`);

    // 7. 站點水井：走過去汲水 → 麥田變濕 + 故事推進到 first_harvest
    const well = await page.evaluate(async () => {
      const F = window.__farm; const st = F.state();
      const wellTile = st.map.tiles.find((t) => t.station === "well");
      F.clickTile(wellTile.id);
      return { wellId: wellTile.id };
    });
    await waitArrive(page, 9000);
    await sleep(400);
    const wellRes = await page.evaluate(() => {
      const st = window.__farm.state();
      const p = st.plots[0];
      return { wet: (p.wateredAt || 0) >= (p.plantedAt || 1), quest: st.story.questId };
    });
    assert(wellRes.wet, "水井：走過去汲水後麥田變濕");
    assert(wellRes.quest === "first_harvest", `澆水推進到收成任務（${wellRes.quest}）`);
    const waterProgress = await storyProgress(page);
    assert(waterProgress.progress === "3/6", `澆水後完成度 3/6（${waterProgress.progress}）`);

    // 8. 收成：時間快轉使麥成熟 → 走過去收成 → 故事推進到 first_delivery
    const harvest = await page.evaluate(async () => {
      const F = window.__farm; const st = F.state();
      const crop = window.CROPS[st.plots[0].cropId];
      st.plots[0].plantedAt = Date.now() - crop.growMs - 5000; // 快轉成熟
      F.refresh();
      const marker = window.questMarkerTile(st, Date.now());
      const soil = st.map.tiles.find((t) => t.plotIndex === 0);
      const assistant = document.getElementById("smartAssistant");
      const collapse = document.querySelector('[data-audit="assistant-collapse"]');
      if (assistant && assistant.classList.contains("collapsed") && collapse) collapse.click();
      const row = document.querySelector('[data-audit="assistant-row"][data-rank="1"]');
      const go = row && row.querySelector('[data-audit="assistant-go"]');
      const reason = row && row.querySelector('[data-audit="assistant-reason"]');
      const rect = go ? go.getBoundingClientRect() : { width: 0, height: 0 };
      const assistantBefore = { x: st.camera.x, y: st.camera.y, focus: st.camera.focusTileId };
      if (go) go.click();
      const assistantAfter = { x: st.camera.x, y: st.camera.y, focus: st.camera.focusTileId };
      F.setTool("hand"); F.clickTile(soil.id);
      return { marker, soilId: soil.id,
        assistantType: row ? row.dataset.suggestionType : "",
        assistantTarget: row ? row.dataset.targetId : "",
        assistantText: row ? row.innerText : "",
        assistantReason: reason ? reason.textContent : "",
        assistantScore: row ? Number(row.dataset.valueScore || 0) : 0,
        assistantAria: go ? go.getAttribute("aria-label") || "" : "",
        assistantTap: { w: rect.width, h: rect.height },
        assistantBefore, assistantAfter,
        assistantOverflow: document.documentElement.scrollWidth - window.innerWidth };
    });
    assert(harvest.assistantType === "harvest" && harvest.assistantTarget === harvest.soilId,
      `智慧助手第一建議為成熟作物收成並指向麥田（type=${harvest.assistantType}, target=${harvest.assistantTarget}）`);
    assert(harvest.assistantTap.w >= 44 && harvest.assistantTap.h >= 44 && harvest.assistantOverflow <= 2,
      `助手前往按鈕 tap target >=44px 且無水平溢出（${Math.round(harvest.assistantTap.w)}×${Math.round(harvest.assistantTap.h)}, overflow=${harvest.assistantOverflow}）`);
    assert(harvest.assistantAria.includes("前往建議目標"), `助手前往按鈕具 aria-label（${harvest.assistantAria}）`);
    assert(harvest.assistantAfter.focus === harvest.soilId &&
      (harvest.assistantAfter.x !== harvest.assistantBefore.x || harvest.assistantAfter.y !== harvest.assistantBefore.y || harvest.assistantAfter.focus !== harvest.assistantBefore.focus),
      `助手前往可用並設定鏡頭 focus（${harvest.assistantBefore.focus}→${harvest.assistantAfter.focus}）`);
    assert(harvest.assistantScore > 0 && harvest.assistantReason.includes("收成") && harvest.assistantReason.includes("+" + Math.round(harvest.assistantScore)) && harvest.assistantReason.includes("金"),
      `助手建議顯示 valueScore 量化理由（score=${harvest.assistantScore}, reason=${harvest.assistantReason}）`);
    await waitArrive(page, 9000);
    await sleep(400);
    const harvestRes = await page.evaluate(() => {
      const st = window.__farm.state();
      return { empty: !st.plots[0].cropId, quest: st.story.questId,
        harvested: Object.values(st.stats.harvested || {}).reduce((s, n) => s + (n || 0), 0) };
    });
    assert(harvest.marker === harvest.soilId, "收成任務標記指向成熟麥田");
    assert(harvestRes.harvested > 0 && harvestRes.empty, "走到成熟麥田收成成功");
    assert(harvestRes.quest === "first_delivery", `收成推進到交付任務（${harvestRes.quest}）`);
    const harvestProgress = await storyProgress(page);
    assert(harvestProgress.progress === "4/6", `收成後完成度 4/6（${harvestProgress.progress}）`);

    // 9. 首收後保底新手訂單可交付 → 走到看板交付 → 完成度 5/6
    const firstOrderReady = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      window.Game.refreshOrders(st, Date.now());
      F.refresh();
      const tutorial = st.orders.find((o) => o.id === "tutorial_first_delivery");
      const npc = document.querySelector('#orders [data-audit="order-npc"]');
      const flavor = document.querySelector("#orders .o-flavor");
      return { hasTutorial: !!tutorial, tutorialWants: tutorial ? tutorial.wants : null,
        canFulfillCount: st.orders.filter((o) => window.Game.canFulfill(st, o)).length,
        wheat: st.storage.items.wheat || 0,
        npcText: npc ? npc.textContent : "",
        flavorText: flavor ? flavor.textContent : "" };
    });
    assert(firstOrderReady.hasTutorial && firstOrderReady.tutorialWants.wheat === 2,
      "首收後生成 2 小麥新手保底訂單");
    assert(firstOrderReady.canFulfillCount >= 1,
      `新存檔首輪收成後至少 1 張訂單可交付（可交 ${firstOrderReady.canFulfillCount}，小麥 ${firstOrderReady.wheat}）`);
    assert(firstOrderReady.npcText.includes("鎮長") && firstOrderReady.flavorText.includes("首收小麥"),
      `訂單顯示 NPC 名字與委託語境（${firstOrderReady.npcText}｜${firstOrderReady.flavorText}）`);
    const orderBoard = await page.evaluate(() => {
      const F = window.__farm; const board = F.state().map.tiles.find((t) => t.station === "order_board");
      F.clickTile(board.id);
      return board.id;
    });
    await waitArrive(page, 9000);
    await sleep(300);
    const deliveryRes = await page.evaluate(() => {
      const btn = document.querySelector("#orders .ful:not([disabled])");
      if (btn) btn.click();
      const st = window.__farm.state();
      return { clicked: !!btn, quest: st.story.questId, fulfilledOrders: st.stats.fulfilledOrders };
    });
    assert(deliveryRes.clicked && deliveryRes.fulfilledOrders >= 1 && deliveryRes.quest === "clear_old_path",
      `走到訂單看板交付保底訂單後推進到清路任務（${deliveryRes.quest}，board=${orderBoard}）`);
    const deliveryProgress = await storyProgress(page);
    assert(deliveryProgress.progress === "5/6", `交付訂單後完成度 5/6（${deliveryProgress.progress}）`);

    // 10. 清除工具路由：清掉樹樁 → 變草地 + 故事完成
    const clear = await page.evaluate(async () => {
      const F = window.__farm; const st = F.state();
      F.refresh();
      const marker = window.questMarkerTile(st, Date.now());
      const stump = st.map.tiles.find((t) => t.object === "stump");
      F.setTool("clear"); F.clickTile(stump.id);
      return { marker, stumpId: stump.id, coinsBefore: st.coins };
    });
    await waitArrive(page, 9000);
    await sleep(400);
    const clearRes = await page.evaluate(() => {
      const st = window.__farm.state();
      return { quest: st.story.questId, anyStump: st.map.tiles.some((t) => t.object === "stump") };
    });
    assert(clear.marker === clear.stumpId, "清路任務標記指向樹樁");
    assert(clear.coinsBefore >= 18 && !clearRes.anyStump, "清除工具：不灌金幣，走過去清掉樹樁");
    assert(clearRes.quest === "repair_bridge", `清路後接第二章「修橋」（${clearRes.quest}）`);
    const clearProgress = await storyProgress(page);
    assert(clearProgress.progress === "6/6", `序章完成度 6/6（${clearProgress.progress}）`);

    // ===== Stage 5：世界可探索（封鎖東林 → 修橋 → 解鎖 → 事件點）=====
    // 11. 修橋前：斷橋不可走、東林 BFS 封鎖；data-audit bridge/locked-area/event-point 可稽核
    const pre = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      const bridge = window.Game.bridgeTile(st), event = window.Game.eventTile(st, "east_clearing");
      return {
        bridgeId: bridge.id, eventId: event.id,
        bridgeWalkable: window.isWalkable(st, bridge),
        eastBfs: window.Game.bfsPath(st, st.player.tileId, event.id),
        lockedArea: document.querySelectorAll('#groundLayer [data-kind="locked-area"]').length,
        bridgeOb: document.querySelectorAll('#mapWorld [data-audit="object"][data-kind="bridge"]').length,
        eventOb: document.querySelectorAll('#mapWorld [data-audit="object"][data-kind="event-point"]').length,
      };
    });
    assert(!pre.bridgeWalkable && pre.eastBfs === null, "修橋前：斷橋不可走、東林封鎖區 BFS 不可達");
    assert(pre.lockedArea >= 30, `修橋前：東林封鎖區可稽核 data-kind=locked-area（${pre.lockedArea}）`);
    assert(pre.bridgeOb >= 1 && pre.eventOb >= 1, `斷橋 / 事件點 data-audit 可稽核（bridge=${pre.bridgeOb} event=${pre.eventOb}）`);

    // 12. 修橋材料導引：不灌 state，依 Dock/marker 清大樹與兩顆巨石湊齊木6石4
    await page.evaluate(() => {
      const dock = document.getElementById("questDock");
      const toggle = document.querySelector('[data-audit="quest-dock-toggle"]');
      if (dock && !dock.classList.contains("expanded") && toggle) toggle.click();
    });
    const matStart = await page.evaluate(() => {
      const st = window.__farm.state();
      const s = window.Game.bridgeMaterialStatus(st);
      const dock = document.getElementById("questDock");
      const target = window.Game.getTile(st, window.questMarkerTile(st, Date.now()));
      return { status: s, dockText: dock.innerText, dockQuest: dock.dataset.quest,
        targetObject: target && target.object, targetId: target && target.id,
        overflow: document.documentElement.scrollWidth - window.innerWidth };
    });
    assert(matStart.dockQuest === "repair_bridge" && matStart.dockText.includes("木材") && matStart.dockText.includes("石頭"),
      "修橋任務 Dock 顯示材料清單");
    assert(matStart.status.have.wood === 2 && matStart.status.missing.wood === 4 && matStart.status.missing.stone === 4,
      `清樹樁後材料缺口正確（木 ${matStart.status.have.wood}/6，石缺 ${matStart.status.missing.stone}）`);
    assert(matStart.targetObject === "tree", `木材不足時 marker 指向大樹（${matStart.targetId}）`);
    assert(matStart.overflow <= 2, `修橋材料 Dock 無水平溢出（${matStart.overflow}）`);

    for (const expected of ["tree", "rock", "rock"]) {
      const target = await page.evaluate((want) => {
        const F = window.__farm; const st = F.state();
        const tid = window.questMarkerTile(st, Date.now());
        const tile = window.Game.getTile(st, tid);
        F.setTool("clear"); F.clickTile(tid);
        return { id: tid, object: tile && tile.object, want, coins: st.coins };
      }, expected);
      assert(target.object === expected, `材料導引 marker 指向 ${expected}（實際 ${target.object}）`);
      assert(target.coins >= (expected === "tree" ? 40 : 25), `清除 ${expected} 前金幣足夠（${target.coins}）`);
      await waitArrive(page, 9000);
      await sleep(350);
    }
    const matReady = await page.evaluate(() => {
      const st = window.__farm.state();
      const s = window.Game.bridgeMaterialStatus(st);
      const marker = window.questMarkerTile(st, Date.now());
      const bridge = window.Game.bridgeTile(st);
      return { status: s, marker, bridgeId: bridge.id, dockText: document.getElementById("questDock").innerText };
    });
    assert(matReady.status.ready && matReady.status.have.wood === 6 && matReady.status.have.stone === 4,
      "依 UI 材料導引清障後湊齊木6石4");
    assert(matReady.marker === matReady.bridgeId && matReady.dockText.includes("材料已齊"),
      "材料齊後 marker 回到斷橋，Dock 提示修復");

    // 12b. 走過去修橋（消耗真資源後解鎖）
    const repair = await page.evaluate(async () => {
      const F = window.__farm; const st = F.state();
      const bridge = window.Game.bridgeTile(st);
      const marker = window.questMarkerTile(st, Date.now());
      F.setTool("hand"); F.clickTile(bridge.id);
      return { bridgeId: bridge.id, marker };
    });
    await waitArrive(page, 9000);
    await sleep(400);
    const repairRes = await page.evaluate(() => {
      const st = window.__farm.state();
      return { repaired: !!st.flags.bridgeRepaired, wood: st.materials.wood, stone: st.materials.stone, quest: st.story.questId };
    });
    assert(repair.marker === repair.bridgeId, "修橋任務標記指向斷橋");
    assert(repairRes.repaired, "走到橋邊用建材修好斷橋");
    assert(repairRes.wood === 0 && repairRes.stone === 0, "修橋消耗木材 6、石頭 4（真資源）");
    assert(repairRes.quest === "explore_new_area", `修橋推進到「探索新區」（${repairRes.quest}）`);

    // 12c. Dock「前往」：鏡頭聚焦目前任務 marker，手機視口要實際平移
    const dockGuide = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const st = window.__farm.state();
      const target = window.questMarkerTile(st, Date.now());
      const before = { x: st.camera.x, y: st.camera.y };
      const btn = document.querySelector('[data-audit="quest-dock-go"]');
      const rect = btn ? btn.getBoundingClientRect() : null;
      if (btn) btn.click();
      await sleep(320);
      return {
        target,
        focus: st.camera.focusTileId,
        before,
        after: { x: st.camera.x, y: st.camera.y },
        quest: document.getElementById("questDock").dataset.quest,
        mapMode: document.getElementById("mapScene").dataset.mapMode,
        sceneScrollW: document.getElementById("mapScene").scrollWidth,
        sceneScrollH: document.getElementById("mapScene").scrollHeight,
        sceneClientW: document.getElementById("mapScene").clientWidth,
        sceneClientH: document.getElementById("mapScene").clientHeight,
        btnW: rect ? rect.width : 0,
        btnH: rect ? rect.height : 0,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    assert(dockGuide.quest === "explore_new_area" && dockGuide.focus === dockGuide.target,
      `Dock 前往把鏡頭 focus 到目前任務 marker（target=${dockGuide.target} focus=${dockGuide.focus}）`);
    assert(dockGuide.btnW >= 44 && dockGuide.btnH >= 44 && dockGuide.overflow <= 2,
      `Dock 前往 tap target >=44px 且無水平溢出（${Math.round(dockGuide.btnW)}×${Math.round(dockGuide.btnH)} overflow=${dockGuide.overflow}）`);
    if (vp.w <= 560 && dockGuide.mapMode !== "fit") {
      assert(dockGuide.before.x !== dockGuide.after.x || dockGuide.before.y !== dockGuide.after.y,
        `手機 Dock 前往觸發 camera 平移（x ${dockGuide.before.x}→${dockGuide.after.x}, y ${dockGuide.before.y}→${dockGuide.after.y}）`);
    } else if (vp.w <= 560) {
      assert(dockGuide.sceneScrollW <= dockGuide.sceneClientW + 2 && dockGuide.sceneScrollH <= dockGuide.sceneClientH + 2,
        `手機 Dock 前往維持整圖完整可見（mode=${dockGuide.mapMode}, scroll=${dockGuide.sceneScrollW}×${dockGuide.sceneScrollH}/${dockGuide.sceneClientW}×${dockGuide.sceneClientH}）`);
    } else {
      assert(dockGuide.focus === dockGuide.target, "桌機 Dock 前往設定 marker focus（視口較寬時可能已在 clamp 邊界）");
    }

    // 13. 修橋後：東林解鎖可達、走到事件點觸發獎勵，並接上採集鏈
    const explore = await page.evaluate(async () => {
      const F = window.__farm; const st = F.state();
      const event = window.Game.eventTile(st, "east_clearing");
      const marker = window.questMarkerTile(st, Date.now());
      F.setTool("hand"); F.clickTile(event.id);
      return { eventId: event.id, marker, coinsBefore: st.coins, eastReachable: window.Game.bfsPath(st, st.player.tileId, event.id) !== null };
    });
    await waitArrive(page, 12000);
    await sleep(400);
    const exploreRes = await page.evaluate(() => {
      const st = window.__farm.state();
      const ch2 = document.querySelector('.chapter2-progress');
      return {
        claimed: !!(st.flags.eventsClaimed && st.flags.eventsClaimed.east_clearing),
        quest: st.story.questId, coins: st.coins, camX: st.camera.x, playerX: st.player.x,
        mapMode: document.getElementById("mapScene").dataset.mapMode,
        sceneScrollW: document.getElementById("mapScene").scrollWidth,
        sceneScrollH: document.getElementById("mapScene").scrollHeight,
        sceneClientW: document.getElementById("mapScene").clientWidth,
        sceneClientH: document.getElementById("mapScene").clientHeight,
        ch2: ch2 ? ch2.getAttribute('data-progress2') : null,
        lockedAfter: document.querySelectorAll('#groundLayer [data-kind="locked-area"]').length,
      };
    });
    assert(explore.eastReachable, "修橋後：東林 BFS 可達");
    assert(explore.marker === explore.eventId, "探索任務標記指向東林事件點");
    assert(exploreRes.claimed && exploreRes.coins > explore.coinsBefore, `走到東林古樹觸發一次性獎勵（+${exploreRes.coins - explore.coinsBefore} 金）`);
    assert(exploreRes.playerX >= 17 && (exploreRes.mapMode === "fit"
      ? exploreRes.sceneScrollW <= exploreRes.sceneClientW + 2 && exploreRes.sceneScrollH <= exploreRes.sceneClientH + 2
      : exploreRes.camX < -50),
      `角色進入東林且地圖模式有效（mode=${exploreRes.mapMode}, playerX=${exploreRes.playerX}, camX=${exploreRes.camX}, scroll=${exploreRes.sceneScrollW}×${exploreRes.sceneScrollH}/${exploreRes.sceneClientW}×${exploreRes.sceneClientH}）`);
    assert(exploreRes.quest === "discover_east_forage" && exploreRes.ch2 === "2/5",
      `探索後接東林採集鏈（第二章 ${exploreRes.ch2}，quest=${exploreRes.quest}）`);
    assert(exploreRes.lockedAfter > 0 && exploreRes.lockedAfter < 30,
      `修橋後東林主區解除封鎖，只保留東林深處門檻區（locked-area=${exploreRes.lockedAfter}）`);

    // 13b. 東林採集鏈：辨認 → 採集兩種東林限定材料 → 向商人回報
    const forageDiscover = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      const marker = window.questMarkerTile(st, Date.now());
      const tile = window.Game.getTile(st, marker);
      F.setTool("hand"); F.clickTile(marker);
      return { marker, forage: tile && tile.forage };
    });
    await waitArrive(page, 9000);
    await sleep(400);
    const forageDiscoverRes = await page.evaluate(() => {
      const st = window.__farm.state();
      return { discovered: !!st.flags.eastForageDiscovered, quest: st.story.questId };
    });
    assert(!!forageDiscover.forage && forageDiscoverRes.discovered && forageDiscoverRes.quest === "collect_east_forage",
      `東林採集點可辨認並推進到收集樣品（node=${forageDiscover.forage}, quest=${forageDiscoverRes.quest}）`);

    for (const expected of ["forest_herb", "glow_mushroom"]) {
      const gatherInfo = await page.evaluate((want) => {
        const F = window.__farm; const st = F.state();
        const marker = window.questMarkerTile(st, Date.now());
        const tile = window.Game.getTile(st, marker);
        const node = tile && window.FORAGE_NODES.find((n) => n.id === tile.forage);
        F.setTool("hand"); F.clickTile(marker);
        return { marker, forage: tile && tile.forage, item: node && node.itemId, want };
      }, expected);
      assert(gatherInfo.item === expected, `採集任務 marker 指向 ${expected} 採集點（實際 ${gatherInfo.item}）`);
      await waitArrive(page, 9000);
      await sleep(400);
    }
    const forageCollectRes = await page.evaluate(() => {
      const st = window.__farm.state();
      const status = window.Game.eastForageStatus(st, Date.now());
      return {
        quest: st.story.questId,
        herb: st.storage.items.forest_herb || 0,
        mushroom: st.storage.items.glow_mushroom || 0,
        foundHerb: status.found.forest_herb || 0,
        foundMushroom: status.found.glow_mushroom || 0,
        ready: status.readyForReport,
      };
    });
    assert(forageCollectRes.quest === "report_east_forage" && forageCollectRes.ready,
      `採集兩種東林材料後接回報任務（quest=${forageCollectRes.quest}）`);
    assert(forageCollectRes.herb >= 1 && forageCollectRes.mushroom >= 1 && forageCollectRes.foundHerb >= 1 && forageCollectRes.foundMushroom >= 1,
      `倉庫與發現紀錄都有東林藥草/螢光菇（herb=${forageCollectRes.herb}, mushroom=${forageCollectRes.mushroom}）`);

    const merchantInfo = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      const merchant = st.map.tiles.find((t) => t.npc === "merchant");
      const marker = window.questMarkerTile(st, Date.now());
      F.clickTile(merchant.id);
      return { merchantId: merchant.id, marker, coinsBefore: st.coins };
    });
    await waitArrive(page, 9000);
    await sleep(500);
    const merchantCard = await page.evaluate(() => {
      const st = window.__farm.state();
      const req = st.npcRequests.merchant;
      const card = document.querySelector('[data-audit="npc-request"][data-npc="merchant"]');
      const btn = document.getElementById("fulfillReqBtn");
      return {
        hasReq: !!req,
        wants: req ? req.wants : null,
        hasCard: !!card,
        disabled: btn ? btn.disabled : null,
        text: document.getElementById("tileContext").innerText,
      };
    });
    assert(merchantInfo.marker === merchantInfo.merchantId, "回報任務 marker 指向商人");
    assert(merchantCard.hasReq && merchantCard.hasCard && merchantCard.disabled === false &&
      merchantCard.wants.forest_herb === 1 && merchantCard.wants.glow_mushroom === 1,
      `商人回報委託卡顯示東林材料需求（${merchantCard.text.replace(/\s+/g, " ").slice(0, 80)}）`);
    const reportRes = await page.evaluate(() => {
      const before = window.__farm.state().coins;
      document.getElementById("fulfillReqBtn").click();
      const st = window.__farm.state();
      const ch2 = document.querySelector(".chapter2-progress");
      return {
        before,
        after: st.coins,
        quest: st.story.questId,
        reported: !!st.flags.eastForageReported,
        ch2: ch2 ? ch2.getAttribute("data-progress2") : null,
        herb: st.storage.items.forest_herb || 0,
        mushroom: st.storage.items.glow_mushroom || 0,
        pool: window.Game.availableOrderItems(st),
      };
    });
    assert(reportRes.reported && reportRes.quest === "learn_animal_care" && reportRes.ch2 === "5/5",
      `商人回報後完成第二章並接第三章（ch2=${reportRes.ch2}, quest=${reportRes.quest}）`);
    assert(reportRes.after - reportRes.before === 18 && reportRes.herb === 0 && reportRes.mushroom === 0,
      `商人回報消耗材料並給 +18 金（${reportRes.before}→${reportRes.after}）`);
    assert(reportRes.pool.includes("forest_herb") && reportRes.pool.includes("glow_mushroom"),
      "回報後東林材料進入既有訂單/委託候選池");

    // 13c. Stage 6：對話依故事進度改變（通關後 → ch2done 階段台詞，與序章不同）
    const lateTalk = await page.evaluate(() => {
      const st = window.__farm.state();
      return { phase: window.Game.npcPhase(st), line: window.Game.npcDialogue(st, "mayor", 0).line,
        startLine: window.NPCS.mayor.lines.start[0] };
    });
    assert(lateTalk.phase === "ch2done", `通關後 NPC 對話 phase=ch2done（${lateTalk.phase}）`);
    assert(lateTalk.line !== lateTalk.startLine, "鎮長台詞隨故事進度改變（非序章台詞）");

    // ===== Stage 7：動物照護（老農對話 → 走到雞舍餵食 → 親密度 → 品質 → 賣出）=====
    // 15. 走到老農（elder）→ 觸發 npc_elder → 推進到第三章「餵食/澆水/梳理」
    const elderInfo = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      const elderTile = st.map.tiles.find((t) => t.npc === "elder");
      const marker = window.questMarkerTile(st, Date.now());
      F.clickTile(elderTile.id);
      return { elderId: elderTile.id, marker };
    });
    await waitArrive(page, 9000);
    await sleep(500);
    const afterElder = await page.evaluate(() => window.__farm.state().story.questId);
    assert(elderInfo.marker === elderInfo.elderId, "第三章開頭任務標記指向老農");
    assert(afterElder === "feed_care_animal", `跟老農對話推進到「餵食/澆水/梳理」任務（${afterElder}）`);

    // 16. 雞從未照護過應顯示 hungry 狀態圖示（data-audit 可稽核）
    const hungryAudit = await page.evaluate(() => {
      const animalEl = document.querySelector('[data-audit="object"][data-kind="animal"]');
      return { status: animalEl ? animalEl.dataset.status : null, sheet: animalEl ? animalEl.dataset.sheet : null };
    });
    assert(hungryAudit.status === "hungry", `起始雞從未照護過，狀態為 hungry（實際 ${hungryAudit.status}）`);

    // 17. 走到雞舍 → 點餵食 4 次（4×22=88 親密度，跨過開心門檻 70）→ 一次連跳 raise_affinity_happy + collect_quality_product
    const coopInfo = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      st.storage.items.wheat = 20;
      const coop = st.buildings.find((b) => b.type === "chickenCoop");
      const marker = window.questMarkerTile(st, Date.now());
      F.refresh(); F.clickTile(coop.tileId);
      return { coopTileId: coop.tileId, marker };
    });
    await waitArrive(page, 9000);
    await sleep(400);
    assert(coopInfo.marker === coopInfo.coopTileId, "「餵食/澆水/梳理」任務標記指向雞舍（structure marker）");
    // Stage 7.1：餵食現在有冷卻（CARE_COOLDOWN_MS），E2E 不用真的等 20 秒 —
    // 每次點擊後把該動物的 lastFedAt 往回撥，模擬冷卻已過，驗證的是「連續餵食後親密度/品質正確累積」
    // 而非冷卻計時器本身（冷卻邏輯已由 test-systems.js 的 node 單元測試覆蓋）。
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => { const b = document.querySelector(".afeed"); if (b) b.click(); });
      await sleep(200);
      await page.evaluate(() => {
        const F = window.__farm; const st = F.state();
        const coop = st.buildings.find((b) => b.type === "chickenCoop");
        for (const a of window.Game.animalsInHome(st, coop.id)) a.lastFedAt = 0;
        F.refresh(); // 按鈕的 disabled 狀態是渲染當下算的，直接改 state 要重繪面板才會反映
      });
    }
    const afterFeed = await page.evaluate(() => {
      const st = window.__farm.state();
      const ch3 = document.querySelector(".chapter3-progress");
      return { quest: st.story.questId, ch3: ch3 ? ch3.getAttribute("data-progress3") : null,
        hasQualityItem: Object.keys(st.storage.items).some((k) => k.endsWith("_good") || k.endsWith("_premium")) };
    });
    assert(afterFeed.hasQualityItem, "連續餵食後倉庫出現優質/頂級品項");
    assert(afterFeed.quest === "deliver_quality_order", `連跳兩關後接上「賣出優質品」任務（${afterFeed.quest}）`);
    assert(afterFeed.ch3 === "4/5", `第三章完成度 4/5（老農對話+餵食+開心+優質品，實際 ${afterFeed.ch3}）`);

    // 18. 賣出全部庫存（含優質品）→ qualitySold 增加 → 第三章 5/5 完成
    await page.evaluate(() => { const b = document.getElementById("sellAllBtn"); if (b) b.click(); });
    await sleep(300);
    const afterSell = await page.evaluate(() => {
      const st = window.__farm.state();
      const ch3 = document.querySelector(".chapter3-progress");
      return { qualitySold: st.stats.qualitySold, quest: st.story.questId, ch3: ch3 ? ch3.getAttribute("data-progress3") : null };
    });
    assert(afterSell.qualitySold > 0, `賣出優質品後 qualitySold 增加（${afterSell.qualitySold}）`);
    assert(afterSell.quest === "prepare_four_seasons" && afterSell.ch3 === "5/5", `第三章完成並接第四章（照護完成度 ${afterSell.ch3}, quest=${afterSell.quest}）`);

    // 19. Stage 10.0：第三章動物照護全完成後，NPC 對話進入 ch3done 階段
    const ch3Phase = await page.evaluate(() => window.Game.npcPhase(window.__farm.state()));
    assert(ch3Phase === "ch3done", `第三章完成後 NPC 對話階段為 ch3done（實際 ${ch3Phase}）`);

    // 20. Stage 10.1/R19：走近老農，優先生成三段連鎖支線委託（走近觸發，非按鈕）
    const elderTile2 = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      const t = st.map.tiles.find((x) => x.npc === "elder");
      F.clickTile(t.id);
      return t.id;
    });
    await waitArrive(page, 9000);
    await sleep(500);
    const reqGen = await page.evaluate(() => {
      const st = window.__farm.state();
      const req = st.npcRequests.elder;
      const bubble = document.querySelector('[data-audit="dialogue-bubble"][data-npc="elder"]');
      const sq = window.Game.npcSideQuestStatus(st, "elder");
      return { hasReq: !!req, wants: req ? req.wants : null, sideQuestId: req ? req.sideQuestId : null,
        sideStatus: sq ? sq.status : null, stepIndex: sq ? sq.stepIndex : null, totalSteps: sq ? sq.totalSteps : null,
        bubbleText: bubble ? bubble.querySelector(".nb-line").textContent : null };
    });
    assert(reqGen.hasReq === true && !!reqGen.sideQuestId && reqGen.sideStatus === "active" && reqGen.stepIndex === 1 && reqGen.totalSteps === 3,
      `走近老農後自動生成 R19 支線第 1/3 段（sideQuest=${reqGen.sideQuestId} status=${reqGen.sideStatus}）`);
    assert(!!reqGen.bubbleText && reqGen.bubbleText.includes("雞蛋"), `對話泡泡顯示支線委託內容（${reqGen.bubbleText}）`);

    // 21. 開啟磚資訊面板：委託卡顯示、庫存不足時交付按鈕 disabled
    await page.evaluate((id) => window.__farm.clickTile(id), elderTile2);
    await sleep(300);
    const cardBefore = await page.evaluate(() => {
      const box = document.getElementById("tileContext");
      const btn = document.getElementById("fulfillReqBtn");
      const side = box ? box.querySelector('[data-audit="npc-sidequest"]') : null;
      return { hasCard: !!(box && box.querySelector(".npc-request")), disabled: btn ? btn.disabled : null,
        sideStatus: side ? side.dataset.status : null, text: box ? box.innerText : "" };
    });
    assert(cardBefore.hasCard === true, "磚資訊側欄出現 NPC 委託卡");
    assert(cardBefore.disabled === true, "庫存不足時交付按鈕為 disabled");
    assert(cardBefore.sideStatus === "active" && cardBefore.text.includes("雞舍巡查") && cardBefore.text.includes("1/3"),
      `磚資訊側欄顯示支線狀態（${cardBefore.sideStatus}）`);

    // 22. 補足庫存後完成老農三段支線：coins 增加、3/3 完成、背景文本解鎖
    const fulfillResult = await page.evaluate(() => {
      const st = window.__farm.state();
      const before = st.coins;
      const doneSteps = [];
      function fill(req) {
        for (const [itemId, qty] of Object.entries(req.wants)) st.storage.items[itemId] = (st.storage.items[itemId] || 0) + qty;
      }
      let req = st.npcRequests.elder;
      fill(req);
      window.__farm.refresh();
      document.getElementById("fulfillReqBtn").click();
      doneSteps.push(window.Game.npcSideQuestStatus(st, "elder").completedSteps);
      for (let i = 0; i < 2; i++) {
        req = window.Game.ensureNpcSideQuestRequest(st, "elder", Date.now() + i + 1);
        fill(req);
        window.Game.fulfillNpcRequest(st, "elder", Date.now() + i + 11);
        doneSteps.push(window.Game.npcSideQuestStatus(st, "elder").completedSteps);
      }
      window.__farm.refresh();
      const sq = window.Game.npcSideQuestStatus(st, "elder");
      return { before, after: st.coins, gone: !st.npcRequests.elder,
        fulfilledCount: (window.__farm.state().npcRequestLog.elder || {}).fulfilledCount,
        sideDone: sq.completed, completedSteps: sq.completedSteps, totalSteps: sq.totalSteps,
        loreUnlocked: sq.loreUnlocked, lore: sq.lore, doneSteps };
    });
    assert(fulfillResult.after > fulfillResult.before, `交付委託後 coins 增加（${fulfillResult.before} → ${fulfillResult.after}）`);
    assert(fulfillResult.gone === true, "交付後委託從 state.npcRequests 移除");
    assert(fulfillResult.fulfilledCount === 3, `npcRequestLog 完成次數為 3（實際 ${fulfillResult.fulfilledCount}）`);
    assert(fulfillResult.sideDone === true && fulfillResult.completedSteps === 3 && fulfillResult.totalSteps === 3,
      `老農 R19 支線 3/3 完成（steps=${fulfillResult.doneSteps.join(">")}）`);
    assert(fulfillResult.loreUnlocked === true && fulfillResult.lore.includes("照護筆記"),
      "完成三段後解鎖老農小鎮背景文本");

    // 23. 交付後立刻再走近老農：仍在冷卻中，不會生成新委託，磚資訊不顯示委託卡
    const afterCooldownTile = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      const t = st.map.tiles.find((x) => x.npc === "elder");
      F.clickTile(t.id);
      return t.id;
    });
    await waitArrive(page, 9000);
    await sleep(400);
    await page.evaluate((id) => window.__farm.clickTile(id), afterCooldownTile);
    await sleep(300);
    const cardAfter = await page.evaluate(() => {
      const box = document.getElementById("tileContext");
      return !!(box && box.querySelector(".npc-request"));
    });
    assert(cardAfter === false, "三段支線完成後立刻再訪，不顯示新的老農委託卡");

    // 24. 放棄委託（用 mayor，避免跟 elder 的冷卻時間軸互相干擾）：點放棄後卡片消失、立刻進冷卻
    const mayorTile = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      const t = st.map.tiles.find((x) => x.npc === "mayor");
      F.clickTile(t.id);
      return t.id;
    });
    await waitArrive(page, 9000);
    await sleep(500);
    await page.evaluate((id) => window.__farm.clickTile(id), mayorTile);
    await sleep(300);
    const declineResult = await page.evaluate((id) => {
      const hadCard = !!document.getElementById("tileContext").querySelector(".npc-request");
      const btn = document.getElementById("declineReqBtn");
      if (btn) btn.click();
      const cardGone = !document.getElementById("tileContext").querySelector(".npc-request");
      const reqGone = !window.__farm.state().npcRequests.mayor;
      return { hadCard, cardGone, reqGone };
    }, mayorTile);
    assert(declineResult.hadCard === true, "鎮長也會自動生成委託（走近觸發，跟 elder 同一套邏輯）");
    assert(declineResult.cardGone === true && declineResult.reqGone === true, "點「放棄」後委託卡消失、state.npcRequests 清空");
    const overflowAfterDecline = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflowAfterDecline <= 2, `放棄委託後仍無水平溢出（${overflowAfterDecline}）`);

    // 25. 桌機/手機皆無水平溢出（Stage 10 新增的委託 UI 也要檢查）
    const overflowAfterRequest = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflowAfterRequest <= 2, `NPC 委託 UI 不造成水平溢出（${overflowAfterRequest}）`);

    // 26. R19：東林深處用 UI 入口解鎖，採集 1 個低頻稀有點並取得收藏品
    const deepGate = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      st.coins = Math.max(st.coins, 90);
      st.materials.wood = Math.max(st.materials.wood || 0, 4);
      st.materials.stone = Math.max(st.materials.stone || 0, 2);
      F.refresh();
      const t = st.map.tiles.find((x) => x.event === "east_deep_gate");
      F.clickTile(t.id);
      return { gateId: t.id, status: window.Game.eastDeepStatus(st) };
    });
    await waitArrive(page, 9000);
    await sleep(500);
    const deepUnlock = await page.evaluate(() => {
      const st = window.__farm.state();
      return { unlocked: !!st.flags.eastDeepUnlocked, collectible: !!(st.collections && st.collections.east_deep_rubbing),
        gateClaimed: !!(st.flags.eventsClaimed && st.flags.eventsClaimed.east_deep_gate),
        costPanel: document.querySelector('[data-audit="east-deep-cost"]') ? document.querySelector('[data-audit="east-deep-cost"]').getAttribute("data-unlocked") : "" };
    });
    assert(deepUnlock.unlocked && deepUnlock.collectible && deepUnlock.gateClaimed,
      `東林深處入口可由 UI 解鎖並取得收藏品（gate=${deepGate.gateId}）`);

    const rareClick = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      const t = st.map.tiles.find((x) => x.forage === "deep_mooncap_ring");
      F.clickTile(t.id);
      return { tileId: t.id };
    });
    await waitArrive(page, 9000);
    await sleep(500);
    const rareResult = await page.evaluate(() => {
      const st = window.__farm.state();
      const js = window.Game.journalSummary(st, Date.now());
      return {
        mooncap: st.storage.items.mooncap_spore || 0,
        discovered: !!(st.stats.collected.mooncap_spore > 0),
        firstSeen: js.forage.find((f) => f.id === "mooncap_spore").firstDiscoveredAt,
        completion: (() => { const c = js.completion.forage; return `${c.done}/${c.total} ${c.pct}%`; })(),
      };
    });
    assert(rareResult.mooncap >= 1 && rareResult.discovered && rareResult.firstSeen > 0,
      `東林深處稀有採集可完成並寫入首次發現時間（tile=${rareClick.tileId}）`);

    // 27. Stage 9/V1：天氣視覺化 + 常駐季節底調
    const winterAmbient = await page.evaluate(() => {
      const st = window.__farm.state();
      st.level = Math.max(st.level, 6);
      st.season = { id: "冬", untilMs: Date.now() + 999999, cycle: 1 };
      window.__farm.refresh();
      const scene = document.getElementById("mapScene");
      return { scene: scene.dataset.season, root: document.documentElement.dataset.season };
    });
    assert(winterAmbient.scene === "冬" && winterAmbient.root === "冬",
      `冬季常駐底調同步到天空與地圖（root=${winterAmbient.root}, scene=${winterAmbient.scene}）`);

    const rainState = await page.evaluate(() => {
      const st = window.__farm.state();
      st.level = Math.max(st.level, 5); // 天氣 Lv5 解鎖，故事鏈跑到這裡不一定已經到 Lv5
      st.weather = { id: "rain", untilMs: Date.now() + 999999 };
      window.__farm.refresh();
      const el = document.getElementById("weatherLayer");
      return { cls: el.className, data: el.getAttribute("data-weather"), scene: document.getElementById("mapScene").dataset.weather, overflow: document.documentElement.scrollWidth - window.innerWidth };
    });
    assert(rainState.cls === "rain" && rainState.data === "rain" && rainState.scene === "rain", `降雨：粒子層與地面濕潤層同步（class=${rainState.cls} data-weather=${rainState.data} scene=${rainState.scene}）`);
    assert(rainState.overflow <= 2, `降雨疊圖不造成水平溢出（${rainState.overflow}）`);

    const sunnyState = await page.evaluate(() => {
      const st = window.__farm.state();
      st.weather = { id: "sunny", untilMs: Date.now() + 999999 };
      window.__farm.refresh();
      const el = document.getElementById("weatherLayer");
      return { cls: el.className, data: el.getAttribute("data-weather"), overflow: document.documentElement.scrollWidth - window.innerWidth };
    });
    assert(sunnyState.cls === "sunny" && sunnyState.data === "sunny", `豔陽：#weatherLayer 套上 sunny（class=${sunnyState.cls} data-weather=${sunnyState.data}）`);
    assert(sunnyState.overflow <= 2, `豔陽疊圖不造成水平溢出（${sunnyState.overflow}）`);

    const windyState = await page.evaluate(() => {
      const st = window.__farm.state();
      st.weather = { id: "windy", untilMs: Date.now() + 999999 };
      window.__farm.refresh();
      const el = document.getElementById("weatherLayer");
      return { cls: el.className, data: el.getAttribute("data-weather"), overflow: document.documentElement.scrollWidth - window.innerWidth };
    });
    assert(windyState.cls === "windy" && windyState.data === "windy", `微風：#weatherLayer 套上 windy（class=${windyState.cls} data-weather=${windyState.data}）`);
    assert(windyState.overflow <= 2, `微風疊圖不造成水平溢出（${windyState.overflow}）`);

    const fogState = await page.evaluate(() => {
      const st = window.__farm.state();
      st.weather = { id: "fog", untilMs: Date.now() + 999999 };
      window.__farm.refresh();
      const el = document.getElementById("weatherLayer");
      return { cls: el.className, data: el.getAttribute("data-weather"), overflow: document.documentElement.scrollWidth - window.innerWidth };
    });
    assert(fogState.cls === "fog" && fogState.data === "fog", `晨霧：#weatherLayer 套上 fog（class=${fogState.cls} data-weather=${fogState.data}）`);
    assert(fogState.overflow <= 2, `晨霧疊圖不造成水平溢出（${fogState.overflow}）`);

    const clearState = await page.evaluate(() => {
      const st = window.__farm.state();
      st.weather = { id: "clear", untilMs: 0 };
      window.__farm.refresh();
      const el = document.getElementById("weatherLayer");
      return { cls: el.className, data: el.getAttribute("data-weather"), overflow: document.documentElement.scrollWidth - window.innerWidth };
    });
    assert(clearState.cls === "" && clearState.data === "clear", `晴朗：#weatherLayer 清空特效 class（class="${clearState.cls}" data-weather=${clearState.data}）`);
    assert(clearState.overflow <= 2, `晴朗時無水平溢出（${clearState.overflow}）`);

    // 28. Stage 11/R19：農場圖鑑——用故事鏈跑到這裡已經真實累積的發現狀態驗證
    await page.click('[data-tab="journal"]');
    await sleep(300);
    await page.evaluate(() => {
      let guard = 0;
      while (document.querySelector("[data-list-more]") && guard++ < 30) {
        document.querySelector("[data-list-more]").click();
      }
    });
    await sleep(100);
    const journalState = await page.evaluate(() => {
      const items = [...document.querySelectorAll('[data-audit="journal-item"]')];
      const byCat = (cat) => items.filter((el) => el.dataset.category === cat);
      const crop = byCat("crop"), product = byCat("product"), npc = byCat("npc"), forage = byCat("forage"), side = byCat("npc-sidequest"), collectible = byCat("collectible");
      const completion = (cat) => {
        const el = document.querySelector(`[data-audit="journal-completion"][data-category="${cat}"]`);
        return el ? el.textContent : "";
      };
      return {
        totalItems: items.length,
        cropFoundHasWheat: crop.some((el) => el.dataset.discovered === "true" && el.textContent.includes("小麥")),
        cropHasUndiscovered: crop.some((el) => el.dataset.discovered === "false"),
        productFound: product.some((el) => el.dataset.discovered === "true"),
        forageCount: forage.length,
        forageFound: forage.filter((el) => el.dataset.discovered === "true").length,
        forageHidden: forage.filter((el) => el.dataset.discovered === "false" && el.textContent.includes("未採集")).length,
        forageCompletion: completion("forage"),
        cropCompletion: completion("crops"),
        sideDone: side.some((el) => el.dataset.discovered === "true" && el.textContent.includes("老農") && el.textContent.includes("3/3")),
        sideCompletion: completion("npcSideQuests"),
        collectibleDone: collectible.some((el) => el.dataset.discovered === "true" && el.textContent.includes("東林年輪拓印")),
        collectibleCompletion: completion("collectibles"),
        npcMetCount: npc.filter((el) => el.dataset.discovered === "true").length,
        npcUnmetCount: npc.filter((el) => el.dataset.discovered === "false").length,
        merchantMet: npc.some((el) => el.dataset.discovered === "true" && el.textContent.includes("商人")),
        chickenHappy: [...document.querySelectorAll('[data-category="animal"]')].some((el) => el.textContent.includes("曾達開心")),
        bridgeFlag: [...document.querySelectorAll('[data-category="world"]')].some((el) => el.textContent.includes("東橋已修復")),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    assert(journalState.totalItems > 0, "圖鑑分頁渲染出內容");
    assert(journalState.cropFoundHasWheat === true, "作物圖鑑顯示已收成的小麥（真實故事進度累積，非灌資料）");
    assert(journalState.cropHasUndiscovered === true, "作物圖鑑仍有未發現項目（沒有全部提前曝光）");
    assert(journalState.cropCompletion.includes("/15"), `作物圖鑑完成度包含 R51 後的 15 作物總數（${journalState.cropCompletion}）`);
    assert(journalState.productFound === true, "產物圖鑑顯示已收集過的動物產品");
    assert(journalState.forageCount === 8 && journalState.forageFound === 3 && journalState.forageHidden === 5,
      `東林採集圖鑑顯示 3/8 已採、5 個未採集剪影（found=${journalState.forageFound} hidden=${journalState.forageHidden}）`);
    assert(journalState.forageCompletion.includes("3/8") && journalState.forageCompletion.includes("38%"),
      `東林採集完成度顯示 3/8 · 38%（${journalState.forageCompletion}）`);
    assert(journalState.sideDone === true && journalState.sideCompletion.includes("1/4"),
      `鎮民支線圖鑑記錄老農 3/3 完成且完成度 1/4（${journalState.sideCompletion}）`);
    assert(journalState.collectibleDone === true && journalState.collectibleCompletion.includes("1/8"),
      `收藏品圖鑑記錄東林年輪拓印（${journalState.collectibleCompletion}）`);
    assert(journalState.npcMetCount === 4 && journalState.npcUnmetCount === 0,
      `鎮民名錄：跑完故事鏈與回報流程後 4 位鎮民皆為真實互動遇見（met=${journalState.npcMetCount} unmet=${journalState.npcUnmetCount}）`);
    assert(journalState.merchantMet === true, "商人因東林回報流程列為已遇見");
    assert(journalState.chickenHappy === true, "動物親密度里程碑：起始雞的 bestAffinity 曾達開心門檻");
    assert(journalState.bridgeFlag === true, "世界旗標：東橋已修復狀態正確");
    assert(journalState.overflow <= 2, `圖鑑分頁無水平溢出（${journalState.overflow}）`);

    const journalDetailState = await page.evaluate(() => {
      const clickAndText = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return "";
        el.click();
        const detail = document.querySelector('[data-audit="journal-detail"]');
        return detail ? detail.innerText : "";
      };
      const wheat = clickAndText('[data-category="crop"][data-journal-id="wheat"]');
      const hiddenMint = clickAndText('[data-category="forage"][data-journal-id="river_mint"]');
      const collectible = clickAndText('[data-category="collectible"][data-journal-id="east_deep_rubbing"]');
      return { wheat, hiddenMint, collectible, overflow: document.documentElement.scrollWidth - window.innerWidth };
    });
    assert(journalDetailState.wheat.includes("來源") && journalDetailState.wheat.includes("首次發現") && journalDetailState.wheat.includes("市集訂單"),
      "收藏冊詳情頁顯示作物來源/用途/首次發現時間");
    assert(journalDetailState.hiddenMint.includes("尚未發現") && journalDetailState.hiddenMint.includes("來源提示") && !journalDetailState.hiddenMint.includes("直售"),
      "未發現採集物詳情只顯示剪影與來源提示");
    assert(journalDetailState.collectible.includes("純收藏") && journalDetailState.collectible.includes("東林年輪拓印"),
      "收藏品詳情顯示非通膨用途");
    assert(journalDetailState.overflow <= 2, `收藏冊詳情頁無水平溢出（${journalDetailState.overflow}）`);

    // 29. R57：商店三連圖 fixture——成排 atlas 作物、季相地標、地面專用靜讀層
    const promoScenes = [];
    for (const id of ["spring", "summer", "winter"]) {
      promoScenes.push(await page.evaluate((sceneId) => {
        const fixture = window.__farm.applyPromoScene(sceneId);
        const crops = [...document.querySelectorAll('[data-audit="object"][data-kind="crop"]')];
        const landmark = document.querySelector('[data-audit="object"][data-kind="event-point"]');
        const ground = document.getElementById("groundLayer");
        return {
          id: sceneId, fixture,
          cropCount: crops.length,
          cropSheets: [...new Set(crops.map((el) => el.dataset.sheet))],
          cropEmoji: crops.some((el) => el.classList.contains("emoji-ob")),
          landmarkFrame: landmark ? landmark.dataset.frame : "",
          groundSeasonOpacity: getComputedStyle(ground, "::before").opacity,
          groundWeatherOpacity: getComputedStyle(ground, "::after").opacity,
          groundSeasonColor: getComputedStyle(ground, "::before").backgroundColor,
          groundWeatherImage: getComputedStyle(ground, "::after").backgroundImage,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      }, id));
    }
    const [promoSpring, promoSummer, promoWinter] = promoScenes;
    assert(promoScenes.every((s) => s.fixture && s.cropCount === 12 && !s.cropEmoji && s.overflow <= 2),
      "宣傳三連圖各有 12 格成排 atlas 作物、主地圖零 emoji 且無水平溢出");
    assert(promoSpring.landmarkFrame === "oak_spring" && promoSummer.landmarkFrame === "oak" && promoWinter.landmarkFrame === "oak_winter",
      `地標隨季節切幀（${promoSpring.landmarkFrame}/${promoSummer.landmarkFrame}/${promoWinter.landmarkFrame}）`);
    const promoAutumn = await page.evaluate(() => {
      window.__farm.applyPromoScene("autumn");
      const landmark = document.querySelector('[data-audit="object"][data-kind="event-point"]');
      return landmark ? landmark.dataset.frame : "";
    });
    assert(promoAutumn === "oak_autumn", `秋季地標使用紅葉實幀（${promoAutumn}）`);
    assert(promoSpring.groundSeasonColor !== "rgba(0, 0, 0, 0)" && promoWinter.groundWeatherImage !== "none",
      `季節 base 與冬雪 weather cue 只在 groundLayer（${promoSpring.groundSeasonColor}/${promoWinter.groundWeatherImage.slice(0, 24)}）`);

    // 14. 無 console / pageerror
    assert(errors.length === 0, "無 console 錯誤 / pageerror" + (errors.length ? "：" + errors.slice(0, 3).join(" | ") : ""));

    await page.close();
  }
  } finally {
    await browser.close();
    server.close();
  }
  if (failed > 0) { console.error("\n❌ " + failed + " 項失敗"); process.exit(1); }
  console.log("\n✅ Stage 4-11 RPG v4 E2E 全部通過");
}

run().catch((e) => { console.error(e); process.exit(1); });
