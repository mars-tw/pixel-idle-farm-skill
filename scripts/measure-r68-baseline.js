/* R68 before baseline: Fast 3G + 4x CPU, read-only browser timing probe. */
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png",
};

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

async function run() {
  const { chromium } = require("playwright");
  const server = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
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
  const started = Date.now();
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?r68-before=1`, {
      waitUntil: "domcontentloaded", timeout: 30000,
    });
    await page.waitForFunction(() => window.__farm && window.__farm.state, null, { timeout: 30000 });
    const interactiveReadyMs = Date.now() - started;
    await page.evaluate(() => {
      const close = document.querySelector("#howToModal.show #howToOk, #offlineModal.show #offlineOk");
      if (close) close.click();
    });
    await page.waitForFunction(() => {
      const scene = document.getElementById("mapScene");
      const tile = document.querySelector("#groundLayer .gtile");
      if (!scene || !tile) return false;
      const sr = scene.getBoundingClientRect();
      const tr = tile.getBoundingClientRect();
      return sr.width > 0 && sr.height > 0 && tr.width >= 10 && tr.height >= 10;
    }, null, { timeout: 30000 });
    const mainVisualReadyMs = Date.now() - started;
    console.log(JSON.stringify({
      release: "R68-before",
      profile: "Fast 3G / 4x CPU / 1366x768 / local concurrent machine",
      interactiveReadyMs,
      mainVisualReadyMs,
      measuredAt: new Date().toISOString(),
      note: "Concurrent-machine baseline; final shipment is rechecked by clean-machine audit.",
    }, null, 2));
  } finally {
    await context.close();
    await browser.close();
    server.close();
  }
}

run().catch((error) => { console.error(error); process.exit(1); });
