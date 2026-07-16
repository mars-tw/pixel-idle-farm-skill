/* farm R64 control reachability gate: primary-pointer routing + viewport hit testing. */
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const EVIDENCE = path.join(ROOT, "docs", "evidence", "R64", "controls");
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
      const safePath = pathname === "/" ? "/index.html" : pathname;
      const file = path.resolve(ROOT, "." + safePath);
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

const VIEWPORTS = [
  { name: "desktop-1920x1080", width: 1920, height: 1080, touch: false },
  { name: "desktop-1440x780", width: 1440, height: 780, touch: false, evidence: "desktop-1440x780.png" },
  { name: "desktop-1366x600", width: 1366, height: 600, touch: false, evidence: "desktop-1366x600.png" },
  { name: "desktop-1280x640", width: 1280, height: 640, touch: false },
  { name: "touch-laptop-1366x640", width: 1366, height: 640, touch: true, mobile: false },
  { name: "phone-390x844", width: 390, height: 844, touch: true, mobile: true, evidence: "mobile-390x844.png" },
  { name: "tablet-820x1180", width: 820, height: 1180, touch: true, mobile: true },
];

async function closeInitialModal(page) {
  const close = page.locator("#howToOk");
  if (await close.isVisible()) await close.click();
  await page.waitForFunction(() => !document.querySelector(".modal.show"));
}

async function controlMetrics(page, selector) {
  return page.evaluate((query) => [...document.querySelectorAll(query)].filter((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return !el.disabled && cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity !== 0 && r.width > 0 && r.height > 0;
  }).map((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const centerInViewport = x >= 0 && x < innerWidth && y >= 0 && y < innerHeight;
    const hit = centerInViewport ? document.elementFromPoint(x, y) : null;
    return {
      label: el.id || el.getAttribute("aria-label") || (el.textContent || "").trim().slice(0, 24) || el.className,
      width: r.width, height: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right,
      centerInViewport,
      centerHit: !!hit && (hit === el || el.contains(hit)),
      hit: hit ? (hit.id || hit.getAttribute("aria-label") || hit.className || hit.tagName) : "none",
    };
  }), selector);
}

function assertReachable(tag, metrics) {
  assert(metrics.length > 0, `${tag} 有載入關鍵控制`);
  const undersized = metrics.filter((item) => item.width < 44 || item.height < 44);
  const unreachable = metrics.filter((item) => !item.centerInViewport || !item.centerHit);
  assert(undersized.length === 0, `${tag} ${metrics.length} 顆關鍵控制命中目標全數 ≥44px` +
    (undersized.length ? `：${undersized.map((item) => `${item.label} ${Math.round(item.width)}×${Math.round(item.height)}`).join(", ")}` : ""));
  assert(unreachable.length === 0, `${tag} ${metrics.length} 顆關鍵控制中心皆在視口內且命中自身` +
    (unreachable.length ? `：${unreachable.map((item) => `${item.label}(hit=${item.hit}, top=${Math.round(item.top)}, bottom=${Math.round(item.bottom)})`).join(", ")}` : ""));
}

async function assertModal(page, tag) {
  await page.click("#howToBtn");
  await page.waitForFunction(() => document.getElementById("howToModal").classList.contains("show"));
  const result = await page.evaluate(() => {
    const modal = document.getElementById("howToModal");
    const close = document.getElementById("howToOk");
    const background = document.getElementById("settingsBtn");
    const r = close.getBoundingClientRect();
    const br = background.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const backgroundHit = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
    return {
      closeVisible: r.width >= 44 && r.height >= 44 && r.top >= 0 && r.bottom <= innerHeight,
      closeHit: hit === close || close.contains(hit),
      backgroundBlocked: !(backgroundHit === background || background.contains(backgroundHit)),
      backgroundHit: backgroundHit && (backgroundHit.id || backgroundHit.className || backgroundHit.tagName),
      zIndex: Number(getComputedStyle(modal).zIndex),
    };
  });
  assert(result.closeVisible && result.closeHit, `${tag}「怎麼玩」關閉鈕固定在視口內且可點`);
  assert(result.backgroundBlocked && result.zIndex > 9900,
    `${tag} modal 高於遊戲控制並攔截背景點擊（hit=${result.backgroundHit}, z=${result.zIndex}）`);
  await page.click("#howToOk");
}

async function assertTouchActionDock(page, tag) {
  const opened = await page.evaluate(() => {
    const state = window.__farm.state();
    const tile = state.map.tiles.find((item) => item.plotIndex === 0);
    const el = tile && document.querySelector(`.gtile[data-tile-id="${tile.id}"]`);
    if (!el) return false;
    el.dispatchEvent(new PointerEvent("click", { bubbles: true, pointerType: "touch" }));
    return true;
  });
  assert(opened, `${tag} 可由觸控農地開啟 action dock`);
  await page.waitForFunction(() => {
    const bar = document.getElementById("sceneActionBar");
    return bar && !bar.hidden && bar.querySelector("button");
  });
  const result = await page.evaluate(() => {
    const actionButtons = [...document.querySelectorAll("#sceneActionBar button")];
    const movementButtons = [...document.querySelectorAll("#mobileControls button")];
    const all = [...actionButtons, ...movementButtons];
    const metrics = all.map((el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { width: r.width, height: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right,
        hit: hit === el || el.contains(hit) };
    });
    const overlaps = [];
    for (let i = 0; i < actionButtons.length; i++) {
      const a = actionButtons[i].getBoundingClientRect();
      for (let j = 0; j < movementButtons.length; j++) {
        const b = movementButtons[j].getBoundingClientRect();
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 1 && overlapY > 1) overlaps.push([i, j, overlapX, overlapY]);
      }
    }
    return { metrics, overlaps, assistantVisible: getComputedStyle(document.getElementById("smartAssistant")).display !== "none" };
  });
  assert(result.metrics.every((item) => item.width >= 44 && item.height >= 44 && item.hit),
    `${tag} action dock／D-pad 每顆按鈕 ≥44px 且中心可命中`);
  assert(result.overlaps.length === 0 && !result.assistantVisible,
    `${tag} action dock 與 D-pad 不重疊，動作選擇時暫收助手`);
}

async function runViewport(browser, base, config) {
  const context = await browser.newContext({
    viewport: { width: config.width, height: config.height },
    hasTouch: config.touch,
    isMobile: !!config.mobile,
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  const errors = [];
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  try {
    await page.goto(base + "?r64-controls=1", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => window.__farm && window.__farm.state, null, { timeout: 15000 });
    await closeInitialModal(page);

    const device = await page.evaluate(() => ({
      primaryCoarse: matchMedia("(pointer: coarse)").matches,
      mobileClass: document.documentElement.classList.contains("mobile-controls-enabled"),
      mobileDisplay: getComputedStyle(document.getElementById("mobileControls")).display,
      pageScroll: document.documentElement.scrollHeight - innerHeight,
      overflowX: document.documentElement.scrollWidth - innerWidth,
    }));
    const expectsMobileControls = !!config.mobile;
    assert(device.mobileClass === expectsMobileControls && (device.mobileDisplay !== "none") === expectsMobileControls,
      `${config.name} D-pad 分流正確（primaryCoarse=${device.primaryCoarse}, enabled=${device.mobileClass}）`);
    assert(device.pageScroll <= 2 && device.overflowX <= 2,
      `${config.name} 無頁級捲動／水平溢出（y=${device.pageScroll}, x=${device.overflowX}）`);

    const selector = [
      "#toolBar .tool", "#questDock button:not([disabled])", ".toolbar button",
      "#smartAssistant button", "#seedHud .seed:not(.locked)",
      expectsMobileControls ? "#mobileControls button" : "",
    ].filter(Boolean).join(",");
    assertReachable(config.name, await controlMetrics(page, selector));

    if (config.evidence) {
      fs.mkdirSync(EVIDENCE, { recursive: true });
      await page.screenshot({ path: path.join(EVIDENCE, config.evidence), fullPage: false });
    }

    await page.locator(".side-tabs").scrollIntoViewIfNeeded();
    assertReachable(`${config.name} 側欄 tabs`, await controlMetrics(page, ".side-tabs button"));
    await assertModal(page, config.name);
    if (expectsMobileControls) {
      await page.locator("#mapScene").scrollIntoViewIfNeeded();
      await assertTouchActionDock(page, config.name);
    }
    assert(errors.length === 0, `${config.name} 無 pageerror` + (errors.length ? `：${errors.join(" | ")}` : ""));
  } finally {
    await context.close();
  }
}

async function run() {
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (error) { console.error("需要 devDependency: playwright"); process.exit(2); }
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  try {
    console.log("== farm R64 控制可達性守門 ==");
    for (const config of VIEWPORTS) await runViewport(browser, base, config);
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) {
    console.error(`\n❌ R64 控制可達性守門失敗：${failed} 項`);
    process.exit(1);
  }
  console.log("\n✅ R64 控制可達性守門通過（7 種裝置／視口）");
}

run().catch((error) => { console.error("R64 控制可達性守門執行失敗：", error); process.exit(1); });
