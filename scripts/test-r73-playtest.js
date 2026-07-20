/* R73 PLAYTEST-R1 defects: mobile system tools, structure selection, series links, and order discard guard. */
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const EVIDENCE = path.join(ROOT, "docs", "evidence", "r73");
const CAPTURE = String(process.env.R73_CAPTURE || "").trim().toLowerCase();
const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".css": "text/css",
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
      const rel = path.relative(ROOT, file);
      if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function newPage(browser, base, viewport, mobile = false) {
  const context = await browser.newContext({
    viewport,
    hasTouch: mobile,
    isMobile: mobile,
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(base + "?r73-playtest=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.__farm && window.__farm.state && !document.getElementById("startupLoading"), null, { timeout: 45000 });
  const close = page.locator("#howToOk");
  if (await close.isVisible()) await close.click();
  await page.waitForFunction(() => !document.querySelector(".modal.show"));
  await page.evaluate(() => { window.MOVE_MS = 5; });
  return { context, page };
}

async function metric(page, selector) {
  return page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const hit = x >= 0 && x < innerWidth && y >= 0 && y < innerHeight ? document.elementFromPoint(x, y) : null;
    return {
      width: r.width, height: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right,
      inView: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
      hit: !!hit && (hit === el || el.contains(hit)),
      hitName: hit && (hit.id || hit.getAttribute("aria-label") || hit.className || hit.tagName),
    };
  });
}

async function closeModal(page, selector) {
  await page.locator(selector).click();
  await page.waitForFunction(() => !document.querySelector(".modal.show"));
}

async function assertToolbarAtCurrentSize(page, tag) {
  const toolbar = await metric(page, ".toolbar");
  const tabs = await metric(page, ".side-tabs");
  assert(toolbar.inView && toolbar.bottom <= tabs.top + 2,
    `${tag} 系統工具列完整在視口內、位於頁籤上方（toolbar ${Math.round(toolbar.top)}-${Math.round(toolbar.bottom)}, tabs top=${Math.round(tabs.top)}）`);
  for (const selector of ["#settingsBtn", "#howToBtn", "#resetBtn"]) {
    const m = await metric(page, selector);
    assert(m.width >= 44 && m.height >= 44 && m.inView && m.hit,
      `${tag} ${selector} ≥44px、可見且中心命中自身（hit=${m.hitName}）`);
    if (selector === "#settingsBtn") {
      await page.locator(selector).click();
      await page.waitForFunction(() => document.getElementById("settingsModal").classList.contains("show"));
      await closeModal(page, "#settingsOk");
    } else if (selector === "#howToBtn") {
      await page.locator(selector).click();
      await page.waitForFunction(() => document.getElementById("howToModal").classList.contains("show"));
      await closeModal(page, "#howToOk");
    } else {
      let dialogText = "";
      page.once("dialog", async (dialog) => { dialogText = dialog.message(); await dialog.dismiss(); });
      await page.locator(selector).click();
      await page.waitForTimeout(50);
      assert(dialogText.includes("確定重置存檔"), `${tag} #resetBtn 真實 click 進入重置確認且已取消`);
    }
  }
  const inset = await page.evaluate(() => {
    const toolbar = document.querySelector(".toolbar").getBoundingClientRect();
    return {
      css: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fixed-bottom-inset")) || 0,
      measured: Math.round(innerHeight - toolbar.top),
    };
  });
  assert(Math.abs(inset.css - inset.measured) <= 2,
    `${tag} --fixed-bottom-inset 沿用實測工具列頂口徑（css=${inset.css}, measured=${inset.measured}）`);
}

async function testLandscapeToolbarAndRotation(browser, base) {
  const { context, page } = await newPage(browser, base, { width: 844, height: 390 }, true);
  try {
    await assertToolbarAtCurrentSize(page, "844×390 fresh");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(120);
    await assertToolbarAtCurrentSize(page, "旋轉後 390×844");
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(120);
    await assertToolbarAtCurrentSize(page, "再旋轉 844×390");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(120);
    await assertToolbarAtCurrentSize(page, "回到 390×844");
  } finally {
    await context.close();
  }
}

async function openMailboxThenTapShop(page) {
  const mailbox = page.locator('.ob[data-station="mailbox"]');
  await mailbox.tap();
  await page.waitForFunction(() => {
    const b = document.querySelector('#sceneActionBar button[data-action="use"]');
    return b && !b.disabled;
  });
  await page.locator('#sceneActionBar button[data-action="use"]').click();
  await page.waitForFunction(() => document.getElementById("lettersModal").classList.contains("show"), null, { timeout: 10000 });
  await closeModal(page, "#lettersClose");
  await page.locator('.ob[data-structure-id="shop"]').tap();
}

async function testMarketSelection(browser, base) {
  const { context, page } = await newPage(browser, base, { width: 390, height: 844 }, true);
  try {
    await page.evaluate(() => { window.__farm.state().storage.items.wheat = 2; window.__farm.refresh(); });
    await openMailboxThenTapShop(page);
    await page.waitForFunction(() => {
      const state = window.__farm.state();
      const tile = state.map.tiles.find((item) => item.id === state.interaction.selectedTileId);
      return tile && tile.structureId === "shop";
    });
    const selection = await page.evaluate(() => {
      const state = window.__farm.state();
      const tile = state.map.tiles.find((item) => item.id === state.interaction.selectedTileId);
      const shop = document.querySelector('.ob[data-structure-id="shop"]');
      return {
        selectedTileId: state.interaction.selectedTileId,
        structureId: tile && tile.structureId,
        objectTileId: shop && shop.dataset.tileId,
        action: document.querySelector("#sceneActionBar button")?.dataset.action || "",
      };
    });
    assert(selection.structureId === "shop" && selection.objectTileId === selection.selectedTileId && selection.action === "use",
      `點市集改選 shop footprint（tile=${selection.selectedTileId}），不沿用信箱 selection`);
    await page.locator('#sceneActionBar button[data-action="use"]').click();
    await page.waitForFunction(() => (window.__farm.state().storage.items.wheat || 0) === 0, null, { timeout: 10000 });
    const result = await page.evaluate(() => ({
      mailOpen: document.getElementById("lettersModal").classList.contains("show"),
      wheat: window.__farm.state().storage.items.wheat || 0,
    }));
    assert(!result.mailOpen && result.wheat === 0, "市集「使用」真實 click 執行賣出，沒有重開信箱");
  } finally {
    await context.close();
  }
}

async function testSeriesLinksAt(browser, base, viewport, tag) {
  const { context, page } = await newPage(browser, base, viewport, true);
  try {
    await page.locator("#settingsBtn").click();
    await page.waitForFunction(() => document.getElementById("settingsModal").classList.contains("show"));
    const links = page.locator("#settingsSeriesLinks a");
    assert(await links.count() === 3, `${tag} 設定內「其他遊戲」有三條系列連結`);
    for (let i = 0; i < 3; i++) {
      const link = links.nth(i);
      await link.scrollIntoViewIfNeeded();
      const m = await metric(page, `#settingsSeriesLinks a:nth-child(${i + 1})`);
      assert(m.width >= 44 && m.height >= 44 && m.inView && m.hit,
        `${tag} 系列連結 ${i + 1} 可見、≥44px 且中心命中自身`);
      await link.evaluate((el) => el.addEventListener("click", (ev) => {
        ev.preventDefault(); el.dataset.r73Clicked = "true";
      }, { once: true }));
      await link.click();
      assert(await link.getAttribute("data-r73-clicked") === "true", `${tag} 系列連結 ${i + 1} 通過真實 click`);
    }
  } finally {
    await context.close();
  }
}

async function testOrderDiscardGuard(browser, base) {
  const { context, page } = await newPage(browser, base, { width: 390, height: 844 }, true);
  try {
    await page.locator('.side-tab[data-tab="orders"]').click();
    const firstOrderId = await page.locator("#orders .order").first().getAttribute("data-order-id");
    await page.locator("#orders .trash").first().click();
    const guarded = await page.evaluate((id) => ({
      sameOrder: window.__farm.state().orders.some((order) => order.id === id),
      confirmVisible: !!document.querySelector(`#orders .order[data-order-id="${id}"] .trash-confirm`),
      cancelVisible: !!document.querySelector(`#orders .order[data-order-id="${id}"] .trash-cancel`),
    }), firstOrderId);
    assert(guarded.sameOrder && guarded.confirmVisible && guarded.cancelVisible,
      "第一次點丟棄不變更訂單，顯示「保留／確認丟棄」二段防呆");
    await page.locator(`#orders .order[data-order-id="${firstOrderId}"] .trash-cancel`).click();
    assert(await page.locator(`#orders .order[data-order-id="${firstOrderId}"] .trash`).count() === 1,
      "點「保留」取消丟棄並恢復原訂單");
    await page.locator(`#orders .order[data-order-id="${firstOrderId}"] .trash`).click();
    await page.locator(`#orders .order[data-order-id="${firstOrderId}"] .trash-confirm`).click();
    await page.waitForFunction((id) => !window.__farm.state().orders.some((order) => order.id === id), firstOrderId);
    assert(true, "第二次明確按「確認丟棄」後才替換訂單");
  } finally {
    await context.close();
  }
}

async function captureBefore(browser, base) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  {
    const { context, page } = await newPage(browser, base, { width: 390, height: 844 }, true);
    try {
      await openMailboxThenTapShop(page);
      await page.locator('#sceneActionBar button[data-action="use"]').click();
      await page.waitForFunction(() => document.getElementById("lettersModal").classList.contains("show"));
      await page.screenshot({ path: path.join(EVIDENCE, "before-390x844-market-stale-selection.png") });
    } finally { await context.close(); }
  }
  {
    const { context, page } = await newPage(browser, base, { width: 844, height: 390 }, true);
    try { await page.screenshot({ path: path.join(EVIDENCE, "before-844x390-toolbar-unreachable.png") }); }
    finally { await context.close(); }
  }
  {
    const { context, page } = await newPage(browser, base, { width: 1366, height: 768 }, false);
    try {
      await page.locator('.side-tab[data-tab="orders"]').click();
      await page.screenshot({ path: path.join(EVIDENCE, "before-1366x768-order-discard.png") });
    } finally { await context.close(); }
  }
  console.log("✓ R73 before 證據已擷取（390×844、844×390、1366×768）");
}

async function captureAfter(browser, base) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  {
    const { context, page } = await newPage(browser, base, { width: 390, height: 844 }, true);
    try {
      await page.locator("#settingsBtn").click();
      await page.locator("#settingsSeriesLinks").scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(EVIDENCE, "after-390x844-series-links.png") });
    } finally { await context.close(); }
  }
  {
    const { context, page } = await newPage(browser, base, { width: 844, height: 390 }, true);
    try { await page.screenshot({ path: path.join(EVIDENCE, "after-844x390-toolbar-reachable.png") }); }
    finally { await context.close(); }
  }
  {
    const { context, page } = await newPage(browser, base, { width: 1366, height: 768 }, false);
    try {
      await page.locator('.side-tab[data-tab="orders"]').click();
      await page.locator("#orders .trash").first().click();
      await page.screenshot({ path: path.join(EVIDENCE, "after-1366x768-order-confirm.png") });
    } finally { await context.close(); }
  }
  console.log("✓ R73 after 證據已擷取（390×844、844×390、1366×768）");
}

async function run() {
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (error) { console.error("需要 devDependency: playwright"); process.exit(2); }
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  try {
    if (CAPTURE === "before") { await captureBefore(browser, base); return; }
    console.log("== R73 PLAYTEST-R1 缺陷回歸 ==");
    await testLandscapeToolbarAndRotation(browser, base);
    await testMarketSelection(browser, base);
    await testSeriesLinksAt(browser, base, { width: 390, height: 844 }, "390×844");
    await testSeriesLinksAt(browser, base, { width: 768, height: 1024 }, "768×1024 tablet");
    await testOrderDiscardGuard(browser, base);
    if (CAPTURE === "after") await captureAfter(browser, base);
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) { console.error(`\n❌ R73 PLAYTEST-R1 回歸失敗：${failed} 項`); process.exit(1); }
  console.log("\n✅ R73 PLAYTEST-R1 回歸通過");
}

run().catch((error) => { console.error("R73 PLAYTEST-R1 守門執行失敗：", error); process.exit(1); });
