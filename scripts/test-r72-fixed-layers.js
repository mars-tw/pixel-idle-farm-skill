/* =========================================================================
 * test-r72-fixed-layers.js — R72 固定層避讓驗證（menuscan P0 回歸）
 *
 * P0-1：錯誤恢復橫幅／PWA 更新橫幅／離線摘要／設定／玩法／信箱 modal 按鈕
 *        不被 R69 固定底欄（#sideTabs／.toolbar）蓋住，中心命中自身且可真實 click。
 * P0-2：建造輪 7 格全在視口內、逐格 click actionability 通過（trial click 走
 *        真實 hit-testing 管線），並抽 2 型全真 click 驗證建造效果落地。
 * 附驗：每個 side-pane 內按鈕捲入後可命中；種子抽屜「×全部」可點。
 * 視口：390×844（直式）、844×390（橫式）＋ 1366×768 桌機證據圖。
 * 執行：node scripts/test-r72-fixed-layers.js
 * ========================================================================= */
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const EVIDENCE = path.join(ROOT, "docs", "evidence", "r72");
const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png",
};
let failed = 0;
function assert(condition, message) {
  if (condition) console.log("  ✓ " + message);
  else { console.error("  ✗ " + message); failed++; }
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, "http://local").pathname);
      const file = path.resolve(ROOT, "." + (pathname === "/" ? "/index.html" : pathname));
      if (path.relative(ROOT, file).startsWith("..") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function boot(page, base) {
  await page.goto(base + "?r68-controls=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.__farm && window.__farm.state, null, { timeout: 45000 });
  await page.waitForFunction(() => !document.getElementById("startupLoading"));
  const close = page.locator("#howToOk");
  if (await close.isVisible()) await close.click();
  await page.waitForFunction(() => !document.querySelector(".modal.show"));
}

async function hitMetric(page, selector) {
  return page.evaluate((query) => {
    const el = document.querySelector(query);
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const inView = x >= 0 && x < innerWidth && y >= 0 && y < innerHeight;
    const hit = inView ? document.elementFromPoint(x, y) : null;
    return {
      found: true, width: r.width, height: r.height, top: r.top, bottom: r.bottom, inView,
      hitSelf: !!hit && (hit === el || el.contains(hit)),
      hitName: hit ? (hit.id || String(hit.className).slice(0, 30) || hit.tagName) : "none",
    };
  }, selector);
}

async function snap(page, config, label) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `after-${config.width}x${config.height}-${label}.png`), fullPage: false });
}

async function assertClickableBanner(page, tag, config) {
  await page.evaluate(() => window.__farm.showErrorRecovery());
  await page.waitForFunction(() => !document.getElementById("errorRecovery").hidden);
  if (config) await snap(page, config, "error-recovery");
  for (const sel of ["#errorContinue", "#errorReload"]) {
    const m = await hitMetric(page, sel);
    assert(m.found && m.inView && m.hitSelf && m.width >= 44 && m.height >= 44,
      `${tag} 錯誤恢復 ${sel} 在視口內且命中自身（hit=${m.hitName}, bottom=${Math.round(m.bottom || 0)}）`);
  }
  await page.locator("#errorReload").click({ trial: true }); // 真實 hit-test，不觸發 reload
  await page.locator("#errorContinue").click();              // 真實 click
  await page.waitForFunction(() => document.getElementById("errorRecovery").hidden);
  assert(true, `${tag} 錯誤恢復「繼續」真實 click 後收合、「重載」actionability 通過`);

  await page.evaluate(() => { document.getElementById("pwaUpdate").hidden = false; });
  const pwa = await hitMetric(page, "#pwaUpdate");
  assert(pwa.found && pwa.inView && pwa.hitSelf, `${tag} PWA 更新橫幅命中自身（hit=${pwa.hitName}）`);
  await page.evaluate(() => { document.getElementById("pwaUpdate").hidden = true; });
}

async function assertModalButtons(page, tag) {
  // 離線摘要 modal（直接開啟展示層驗可點性）
  await page.evaluate(() => {
    document.getElementById("offlineBody").innerHTML =
      '<div class="ml">你離開的 180 分鐘：離線收益 <span class="v">+42 金</span></div>' +
      '<div class="ml">作物成熟 <span class="v">4 株</span></div>';
    document.getElementById("offlineModal").classList.add("show");
  });
  const ok = await hitMetric(page, "#offlineOk");
  assert(ok.found && ok.inView && ok.hitSelf && ok.width >= 44 && ok.height >= 44,
    `${tag} 離線摘要「繼續種田」命中自身（hit=${ok.hitName}, bottom=${Math.round(ok.bottom || 0)}）`);
  await page.locator("#offlineOk").click();
  await page.waitForFunction(() => !document.getElementById("offlineModal").classList.contains("show"));

  // 設定 modal（真實入口）
  await page.evaluate(() => document.getElementById("settingsBtn").click());
  await page.waitForFunction(() => document.getElementById("settingsModal").classList.contains("show"));
  const so = await hitMetric(page, "#settingsOk");
  assert(so.found && so.inView && so.hitSelf, `${tag} 設定「完成」命中自身（hit=${so.hitName}）`);
  await page.locator("#settingsOk").click();
  await page.waitForFunction(() => !document.querySelector(".modal.show"));

  // 玩法 modal
  await page.evaluate(() => document.getElementById("howToBtn").click());
  await page.waitForFunction(() => document.getElementById("howToModal").classList.contains("show"));
  const ho = await hitMetric(page, "#howToOk");
  assert(ho.found && ho.inView && ho.hitSelf, `${tag} 玩法「開始種田」命中自身（hit=${ho.hitName}）`);
  await page.locator("#howToOk").click();
  await page.waitForFunction(() => !document.querySelector(".modal.show"));

  // 信箱 modal
  await page.evaluate(() => window.__farm.openLetters());
  await page.waitForFunction(() => document.getElementById("lettersModal").classList.contains("show"));
  const lc = await hitMetric(page, "#lettersClose");
  assert(lc.found && lc.inView && lc.hitSelf, `${tag} 信箱「關閉信箱」命中自身（hit=${lc.hitName}）`);
  await page.locator("#lettersClose").click();
  await page.waitForFunction(() => !document.querySelector(".modal.show"));
}

async function assertSidePanes(page, tag) {
  const tabs = ["tile", "orders", "upgrades", "story", "journal"];
  for (const name of tabs) {
    await page.evaluate((tab) => {
      const panel = document.querySelector(".side-panel");
      if (panel) panel.classList.remove("panes-collapsed");
      const btn = document.querySelector(`.side-tab[data-tab="${tab}"]`);
      if (btn && !btn.classList.contains("sel")) btn.click();
      if (panel) panel.classList.remove("panes-collapsed");
    }, name);
    await page.waitForFunction((tab) => {
      const pane = document.querySelector(`.side-pane[data-pane="${tab}"]`);
      return pane && pane.classList.contains("sel");
    }, name);
    const result = await page.evaluate(async (tab) => {
      const pane = document.querySelector(`.side-pane[data-pane="${tab}"]`);
      const buttons = [...pane.querySelectorAll("button:not([disabled])")].filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden";
      });
      const misses = [];
      for (const el of buttons) {
        el.scrollIntoView({ block: "nearest" });
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const hit = (x >= 0 && x < innerWidth && y >= 0 && y < innerHeight) ? document.elementFromPoint(x, y) : null;
        if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) {
          misses.push({ label: (el.textContent || "").trim().slice(0, 14), hit: hit ? (hit.id || String(hit.className).slice(0, 24)) : "offscreen" });
        }
      }
      return { total: buttons.length, misses };
    }, name);
    assert(result.misses.length === 0,
      `${tag} 分頁「${name}」${result.total} 顆按鈕捲入後全命中` +
        (result.misses.length ? `：${result.misses.map((m) => `${m.label}(hit=${m.hit})`).join(", ")}` : ""));
  }
  await page.evaluate(() => {
    const panel = document.querySelector(".side-panel");
    if (panel && matchMedia("(max-width: 859px), (any-pointer: coarse) and (max-height: 480px)").matches) {
      panel.classList.add("panes-collapsed");
    }
  });
}

async function assertSeedDrawer(page, tag) {
  await page.evaluate(() => {
    const state = window.__farm.state();
    state.level = Math.max(state.level, 10);
    state.coins = Math.max(state.coins, 100000);
    window.__farm.setTool("hand");
    window.__farm.refresh();
    const tile = state.map.tiles.find((item) => item.plotIndex === 0);
    const el = tile && document.querySelector(`.gtile[data-tile-id="${tile.id}"]`);
    if (el) el.dispatchEvent(new PointerEvent("click", { bubbles: true, pointerType: "touch" }));
  });
  await page.evaluate(() => { const more = document.querySelector("#seedRow .seed.more"); if (more) more.onclick(); });
  await page.waitForFunction(() => document.querySelector("#seedRow .seed-drawer"));
  const m = await hitMetric(page, "#seedRow .seed.more");
  assert(m.found && m.inView && m.hitSelf, `${tag} 種子抽屜「×全部」命中自身（hit=${m.hitName}）`);
  await page.evaluate(() => { const more = document.querySelector("#seedRow .seed.more"); if (more) more.onclick(); });
}

async function assertBuildWheel(page, tag, config) {
  const setupOk = await page.evaluate(() => {
    const state = window.__farm.state();
    state.level = Math.max(state.level, 10);
    state.coins = 1000000;
    state.materials = state.materials || {};
    ["wood", "stone", "compost"].forEach((k) => { state.materials[k] = 999; });
    window.__farm.setTool("build");
    window.__farm.refresh();
    const tile = state.map.tiles.find((t) =>
      t.terrain === "grass" && !t.object && !t.buildingId && !t.structureId && !t.blocked && !t.station && !t.npc);
    if (!tile) return null;
    window.__farm.clickTile(tile.id);
    return tile.id;
  });
  assert(!!setupOk, `${tag} 可開啟建造輪（tile=${setupOk}）`);
  await page.waitForFunction(() => {
    const wheel = document.getElementById("buildWheel");
    return wheel && !wheel.hidden && wheel.querySelectorAll("button").length > 0;
  });
  const metrics = await page.evaluate(() => {
    const wheel = document.getElementById("buildWheel");
    const wr = wheel.getBoundingClientRect();
    return {
      count: wheel.querySelectorAll("button").length,
      wheelBox: { top: Math.round(wr.top), bottom: Math.round(wr.bottom), left: Math.round(wr.left), right: Math.round(wr.right) },
      items: [...wheel.querySelectorAll("button")].map((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const inView = x >= 0 && x < innerWidth && y >= 0 && y < innerHeight;
        const hit = inView ? document.elementFromPoint(x, y) : null;
        return { type: el.dataset.type, w: Math.round(r.width), h: Math.round(r.height), inView,
          hitSelf: !!hit && (hit === el || el.contains(hit)),
          hit: hit ? (hit.id || String(hit.className).slice(0, 24) || hit.tagName) : "none" };
      }),
    };
  });
  assert(metrics.count >= 7, `${tag} 建造輪至少 7 格（實際 ${metrics.count}，框=${JSON.stringify(metrics.wheelBox)}）`);
  if (config) await snap(page, config, "build-wheel");
  const bad = metrics.items.filter((item) => !item.inView || !item.hitSelf || item.w < 44 || item.h < 44);
  assert(bad.length === 0, `${tag} 建造輪 ${metrics.count}/${metrics.count} 格中心在視口內且命中自身` +
    (bad.length ? `：${bad.map((b) => `${b.type}(hit=${b.hit})`).join(", ")}` : ""));
  // 逐格 trial click（Playwright 真實 actionability／hit-test 管線，不改變狀態）
  let trials = 0;
  for (const item of metrics.items) {
    await page.locator(`#buildWheel button[data-type="${item.type}"]`).click({ trial: true });
    trials++;
  }
  assert(trials === metrics.count, `${tag} 建造輪 ${trials}/${metrics.count} 格逐格 click actionability 通過`);
  // 抽 2 型全真 click：效果需落地（建築數 +1、輪盤收合）
  const types = metrics.items.map((item) => item.type);
  let built = 0;
  for (const type of types.slice(0, 2)) {
    const before = await page.evaluate(() => window.__farm.state().buildings.length);
    await page.locator(`#buildWheel button[data-type="${type}"]`).click();
    const after = await page.evaluate(() => window.__farm.state().buildings.length);
    if (after === before + 1) built++;
    // 重開輪盤給下一型
    await page.evaluate(() => {
      const state = window.__farm.state();
      const tile = state.map.tiles.find((t) =>
        t.terrain === "grass" && !t.object && !t.buildingId && !t.structureId && !t.blocked && !t.station && !t.npc);
      if (tile) window.__farm.clickTile(tile.id);
    });
    await page.waitForFunction(() => {
      const wheel = document.getElementById("buildWheel");
      return wheel && !wheel.hidden && wheel.querySelectorAll("button").length > 0;
    });
  }
  assert(built === 2, `${tag} 建造輪真實 click 建造 ${built}/2 型成功落地`);
  await page.evaluate(() => window.__farm.setTool("hand"));
}

async function runViewport(browser, base, config) {
  const context = await browser.newContext({
    viewport: { width: config.width, height: config.height },
    hasTouch: config.touch, isMobile: !!config.mobile,
    serviceWorkers: "block", reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  try {
    await boot(page, base);
    console.log(`-- ${config.name} --`);
    await assertClickableBanner(page, config.name, config);
    await assertModalButtons(page, config.name);
    await assertSidePanes(page, config.name);
    if (config.mobile) await assertSeedDrawer(page, config.name);
    await assertBuildWheel(page, config.name, config);
    await snap(page, config, "overview");
    const realErrors = errors.filter((e) => !e.includes("test"));
    assert(realErrors.length === 0, `${config.name} 無 pageerror` + (realErrors.length ? `：${realErrors.join(" | ")}` : ""));
  } finally {
    await context.close();
  }
}

async function run() {
  const { chromium } = require("playwright");
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  try {
    console.log("== R72 固定層避讓驗證 ==");
    const viewports = [
      { name: "phone-390x844", width: 390, height: 844, touch: true, mobile: true, evidence: "after-390x844-build-wheel.png" },
      { name: "phone-landscape-844x390", width: 844, height: 390, touch: true, mobile: true, evidence: "after-844x390-build-wheel.png" },
      { name: "desktop-1366x768", width: 1366, height: 768, touch: false, mobile: false, evidence: "after-1366x768.png" },
    ];
    for (const config of viewports) await runViewport(browser, base, config);
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) { console.error(`\n❌ R72 固定層驗證失敗：${failed} 項`); process.exit(1); }
  console.log("\n✅ R72 固定層避讓驗證通過（3 視口）");
}

run().catch((error) => { console.error("R72 固定層驗證執行失敗：", error); process.exit(1); });
