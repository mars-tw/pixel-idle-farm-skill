/* R68 browser visual gates: Fast 3G focus, TTI regression, crop safety, p95, modal exclusion, evidence. */
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const EVIDENCE = path.join(ROOT, "docs", "evidence", "R68");
const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png",
};
const VIEWPORTS = [
  [1920, 1080], [1440, 780], [1366, 600], [1280, 640], [1366, 700], [1280, 720],
  [1024, 768], [820, 1180], [768, 1024], [390, 844], [360, 640], [844, 390],
];
const SEASONS = ["spring", "summer", "autumn", "winter"];
const baseline = JSON.parse(fs.readFileSync(path.join(EVIDENCE, "before-baseline.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "generated", "r68", "manifest.json"), "utf8"));
let failed = 0;
function gate(condition, message) {
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

function cropRow(width, height, season) {
  const [x0, y0, x1, y1] = manifest.pipeline.focalBoxNormalized;
  const inset = manifest.pipeline.safeAreaViewportInset;
  const scale = Math.max(width, height); // square source with CSS background-size: cover
  const cropX = (scale - width) / 2;
  const cropY = (scale - height) / 2;
  const mapped = {
    left: x0 * scale - cropX,
    top: y0 * scale - cropY,
    right: x1 * scale - cropX,
    bottom: y1 * scale - cropY,
  };
  const safe = { left: width * inset, top: height * inset, right: width * (1 - inset), bottom: height * (1 - inset) };
  const pass = mapped.left >= safe.left && mapped.top >= safe.top && mapped.right <= safe.right && mapped.bottom <= safe.bottom;
  return { season, viewport: `${width}x${height}`, mapped, safe, pass };
}

async function performanceGate(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block", reducedMotion: "reduce" });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: Math.floor(1.6 * 1024 * 1024 / 8),
    uploadThroughput: Math.floor(750 * 1024 / 8),
    connectionType: "cellular3g",
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  try {
    await page.goto(base + "?r68-season=spring&r68-perf=1", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => performance.getEntriesByName("farm-visual-focus-ready").length > 0, null, { timeout: 30000 });
    await page.waitForFunction(() => performance.getEntriesByName("farm-interactive-ready").length > 0, null, { timeout: 30000 });
    const result = await page.evaluate(() => {
      const mark = (name) => performance.getEntriesByName(name)[0]?.startTime || null;
      const resource = performance.getEntriesByType("resource").find((item) => item.name.includes("loading-spring-low.png"));
      return {
        focusReadyMs: mark("farm-visual-focus-ready"),
        interactiveReadyMs: mark("farm-interactive-ready"),
        loadingResource: resource ? { name: resource.name, duration: resource.duration, transferSize: resource.transferSize } : null,
      };
    });
    result.profile = "Fast 3G / 4x CPU / 1366x768 / local concurrent machine";
    result.trust = "concurrent-untrusted";
    result.focusLimitMs = 3000;
    result.interactiveRegressionLimitMs = baseline.interactiveRegressionLimitMs;
    result.focusPass = result.focusReadyMs !== null && result.focusReadyMs <= 3000 && !!result.loadingResource;
    result.interactivePass = result.interactiveReadyMs !== null && result.interactiveReadyMs <= baseline.interactiveRegressionLimitMs;
    result.pageErrors = pageErrors;
    gate(result.focusPass, `Fast 3G/4x loading focal mark ${Math.round(result.focusReadyMs)}ms <= 3000ms and real asset loaded`);
    gate(result.interactivePass, `interactive ${Math.round(result.interactiveReadyMs)}ms <= before+10% ${baseline.interactiveRegressionLimitMs}ms`);
    gate(pageErrors.length === 0, "performance profile has zero pageerror");
    return result;
  } finally {
    await context.close();
  }
}

async function p95Gate(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block", reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(base + "?r68-p95=1", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => window.__farm && !document.getElementById("startupLoading"), null, { timeout: 30000 });
    await page.evaluate(() => {
      const close = document.querySelector(".modal.show #howToOk, .modal.show #offlineOk");
      if (close) close.click();
    });
    const intervals = await page.evaluate(() => new Promise((resolve) => {
      const values = [];
      let previous = 0;
      function frame(time) {
        if (previous) values.push(time - previous);
        previous = time;
        if (values.length >= 180) resolve(values);
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }));
    const sorted = intervals.slice().sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
    const result = { samples: intervals.length, p95Ms: p95, limitMs: 18, trust: "concurrent-untrusted", pass: p95 <= 18 };
    gate(result.pass, `requestAnimationFrame p95 ${p95.toFixed(2)}ms <= 18ms (concurrent-untrusted)`);
    return result;
  } finally {
    await context.close();
  }
}

async function captureLoading(browser, base, config) {
  const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, serviceWorkers: "block", reducedMotion: "reduce", isMobile: config.mobile, hasTouch: config.mobile });
  const page = await context.newPage();
  try {
    await page.goto(`${base}?r68-hold-loading=1&r68-season=${config.season}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => document.getElementById("startupLoading")?.dataset.assetLoaded === "true", null, { timeout: 30000 });
    await page.waitForFunction(() => window.__farm && window.__farm.state, null, { timeout: 30000 });
    const exclusion = await page.evaluate(() => ({
      loadingVisible: !!document.getElementById("startupLoading"),
      openModals: document.querySelectorAll(".modal.show").length,
      loadingIsModal: document.getElementById("startupLoading")?.classList.contains("modal") || false,
    }));
    gate(exclusion.loadingVisible && exclusion.openModals === 0 && !exclusion.loadingIsModal,
      `${config.width}x${config.height} loading and modal systems are mutually exclusive`);
    await page.screenshot({ path: path.join(EVIDENCE, config.file), fullPage: false });
    return exclusion;
  } finally {
    await context.close();
  }
}

async function capturePanel(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block", reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(base + "?r68-panel=1", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => window.__farm && !document.getElementById("startupLoading"), null, { timeout: 30000 });
    await page.evaluate(() => {
      const close = document.querySelector(".modal.show #howToOk, .modal.show #offlineOk");
      if (close) close.click();
      const state = window.__farm.state();
      state.level = Math.max(9, state.level || 1);
      state.season = { id: "春", untilMs: Date.now() + 600000 };
      window.__farm.refresh();
      window.__farm.openLetters();
    });
    await page.waitForFunction(() => {
      const card = document.querySelector(".season-event-card");
      return card && getComputedStyle(card).backgroundImage.includes("activity-panel");
    }, null, { timeout: 15000 });
    const result = await page.evaluate(() => {
      const card = document.querySelector(".season-event-card");
      return {
        eventId: card.dataset.eventId,
        season: card.dataset.season,
        backgroundImage: getComputedStyle(card).backgroundImage,
        openModals: document.querySelectorAll(".modal.show").length,
      };
    });
    gate(result.backgroundImage.includes("?v=e100dd7f") && result.openModals === 1,
      "existing activity card loads content-hashed generated med tier inside the sole active modal");
    await page.screenshot({ path: path.join(EVIDENCE, "after-activity-panel-1366x768.png"), fullPage: false });
    return result;
  } finally {
    await context.close();
  }
}

async function run() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  console.log("== R68 browser visual gates ==");
  const cropRows = VIEWPORTS.flatMap(([width, height]) => SEASONS.map((season) => cropRow(width, height, season)));
  gate(cropRows.length === 48 && cropRows.every((row) => row.pass), "4 seasons x 12 RWD viewports: focal bbox stays wholly inside 8% safe area");

  const { chromium } = require("playwright");
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  try {
    const performance = await performanceGate(browser, base);
    const p95 = await p95Gate(browser, base);
    const loadingEvidence = [];
    loadingEvidence.push(await captureLoading(browser, base, { width: 1440, height: 780, season: "spring", file: "after-loading-desktop-1440x780.png", mobile: false }));
    loadingEvidence.push(await captureLoading(browser, base, { width: 390, height: 844, season: "summer", file: "after-loading-mobile-390x844.png", mobile: true }));
    loadingEvidence.push(await captureLoading(browser, base, { width: 820, height: 1180, season: "winter", file: "after-loading-tablet-820x1180.png", mobile: true }));
    const panel = await capturePanel(browser, base);
    const result = {
      release: "R68",
      pass: failed === 0,
      safeCrop: { matrix: "4 seasons x 12 viewports", inset: 0.08, rows: cropRows, pass: cropRows.every((row) => row.pass) },
      performance,
      p95,
      loadingModalExclusion: loadingEvidence,
      activityPanel: panel,
    };
    fs.writeFileSync(path.join(EVIDENCE, "browser-gates.json"), JSON.stringify(result, null, 2) + "\n");
    fs.writeFileSync(path.join(EVIDENCE, "safe-crop-gate.json"), JSON.stringify(result.safeCrop, null, 2) + "\n");
    fs.writeFileSync(path.join(EVIDENCE, "performance-gate.json"), JSON.stringify({ performance, p95 }, null, 2) + "\n");
  } finally {
    await browser.close();
    if (typeof server.closeAllConnections === "function") server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (failed) {
    console.error(`\n❌ R68 browser visual gates failed: ${failed}`);
    process.exit(1);
  }
  console.log("\n✅ R68 browser visual gates PASS");
}

run().catch((error) => { console.error(error); process.exit(1); });
