/* Capture the deterministic R57 store-listing trio from the live atlas scene. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "references", "promo", "r59-20260714-1");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };

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

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  try {
    for (const id of ["spring", "summer", "winter"]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      await page.goto(base, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__farm && window.Atlas && window.Atlas.isReady());
      const fixture = await page.evaluate((sceneId) => window.__farm.applyPromoScene(sceneId), id);
      if (!fixture) throw new Error("unknown promo fixture: " + id);
      await page.waitForTimeout(500);
      const audit = await page.evaluate(() => {
        const ground = document.getElementById("groundLayer");
        return { season: getComputedStyle(ground, "::before").opacity,
          weather: getComputedStyle(ground, "::after").opacity,
          sceneWeather: document.getElementById("mapScene").dataset.weather };
      });
      await page.locator("#mapScene").screenshot({ path: path.join(OUT, `${id}.png`) });
      await page.close();
      console.log(`  ✓ ${id}.png (${fixture.season}/${fixture.weather}; ground ${audit.season}/${audit.weather}; scene ${audit.sceneWeather})`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log("✅ promo trio → " + path.relative(ROOT, OUT));
})().catch((error) => { console.error(error); process.exit(1); });
