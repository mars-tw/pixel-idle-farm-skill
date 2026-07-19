/* =========================================================================
 * test-r72-night-gate.js — R72 夜間/暴風亮度閘 + 季節色盤一致性量測
 *
 * OPTIM_PLAN_R72 C-2/C-3：4 季 × 7 天氣把 #mapScene 實截圖丟進 canvas 算
 * mean luminance（0-255）。閘門：
 *   - storm（最暗天氣）≥ 56；其餘天氣 ≥ 72（不過暗，夜間感靠色相不靠壓黑）。
 *   - 同天氣跨季亮度落差 ≤ 35%（季節色盤一致性——秋冬不得整體發黑）。
 * 輸出 docs/evidence/r72/night-gate.json（含四季 sky/grass 色盤對照）。
 * 執行：node scripts/test-r72-night-gate.js
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
const SEASONS = ["春", "夏", "秋", "冬"];
const WEATHERS = ["clear", "sunny", "rain", "storm", "snow", "fog", "windy"];
const MIN_LUMA = { storm: 56, default: 72 };
const MAX_SEASON_SPREAD = 0.35;
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

async function meanLuma(page, pngBuffer) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let total = 0, n = 0;
    for (let i = 0; i < data.length; i += 16) { // 每 4 px 取樣
      total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      n++;
    }
    return total / n;
  }, pngBuffer.toString("base64"));
}

async function run() {
  const { chromium } = require("playwright");
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 844, height: 700 }, serviceWorkers: "block", reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const report = { release: "R72", gate: MIN_LUMA, maxSeasonSpread: MAX_SEASON_SPREAD, seasons: {}, measurements: {} };
  try {
    console.log("== R72 夜間/暴風亮度閘 ==");
    await page.goto(base + "?r68-controls=1", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.__farm && window.__farm.state, null, { timeout: 45000 });
    await page.waitForFunction(() => !document.getElementById("startupLoading"));
    const close = page.locator("#howToOk");
    if (await close.isVisible()) await close.click();
    await page.evaluate(() => {
      const state = window.__farm.state();
      state.level = Math.max(state.level, 8); // 解鎖季節+天氣顯示
    });
    const scene = page.locator("#mapScene");
    for (const season of SEASONS) {
      report.seasons[season] = await page.evaluate((s) => {
        document.documentElement.dataset.season = s;
        const cs = getComputedStyle(document.documentElement);
        return { sky1: cs.getPropertyValue("--sky-1").trim(), sky2: cs.getPropertyValue("--sky-2").trim(),
          grass: cs.getPropertyValue("--grass").trim(), grassD: cs.getPropertyValue("--grass-d").trim() };
      }, season);
      for (const weather of WEATHERS) {
        await page.evaluate(([s, w]) => {
          const state = window.__farm.state();
          state.season = Object.assign({}, state.season, { id: s, untilMs: Date.now() + 9e6 });
          state.weather = { id: w, untilMs: Date.now() + 9e6 };
          window.__farm.refresh();
        }, [season, weather]);
        await page.waitForFunction(([s, w]) => {
          const el = document.getElementById("mapScene");
          return el.dataset.season === s && el.dataset.weather === w;
        }, [season, weather]);
        await page.waitForTimeout(700); // 讓 0.6s 疊層過場走完
        const buffer = await scene.screenshot();
        const luma = await meanLuma(page, buffer);
        report.measurements[`${season}-${weather}`] = Math.round(luma * 10) / 10;
        if (weather === "storm" || (season === "冬" && weather === "snow")) {
          fs.mkdirSync(path.join(EVIDENCE, "night"), { recursive: true });
          fs.writeFileSync(path.join(EVIDENCE, "night", `${season}-${weather}.png`), buffer);
        }
      }
    }
    for (const [key, luma] of Object.entries(report.measurements)) {
      const weather = key.split("-")[1];
      const floor = MIN_LUMA[weather] != null ? MIN_LUMA[weather] : MIN_LUMA.default;
      assert(luma >= floor, `${key} mean luminance ${luma} ≥ ${floor}`);
    }
    for (const weather of WEATHERS) {
      const values = SEASONS.map((s) => report.measurements[`${s}-${weather}`]);
      const spread = (Math.max(...values) - Math.min(...values)) / Math.max(...values);
      assert(spread <= MAX_SEASON_SPREAD,
        `${weather} 跨季亮度落差 ${(spread * 100).toFixed(1)}% ≤ ${MAX_SEASON_SPREAD * 100}%（${values.join("/")}）`);
    }
    report.pass = failed === 0;
    fs.mkdirSync(EVIDENCE, { recursive: true });
    fs.writeFileSync(path.join(EVIDENCE, "night-gate.json"), JSON.stringify(report, null, 2) + "\n");
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) { console.error(`\n❌ R72 夜間亮度閘失敗：${failed} 項`); process.exit(1); }
  console.log("\n✅ R72 夜間亮度閘通過（4 季 × 7 天氣，詳 docs/evidence/r72/night-gate.json）");
}

run().catch((error) => { console.error("R72 夜間亮度閘執行失敗：", error); process.exit(1); });
