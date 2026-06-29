/* =========================================================================
 * gen-v2-atlases.js — 產生 assets/generated/v2/ 精確尺寸 atlas（placeholder）
 *
 * 用 Playwright 開 scripts/gen-v2/generator.html（canvas 程序化地形 + 重切
 * 現有去背作物/角色 + 物件/動物 placeholder），輸出整數 frame PNG + JSON
 * frame map + manifest。正式 gpt-image-2 v2 素材就緒後可直接覆蓋同名檔。
 * 執行：node scripts/gen-v2-atlases.js   （需 devDependency: playwright）
 * ========================================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "assets", "generated", "v2");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".png": "image/png" };

const FILES = {
  terrain: "terrain-tiles-32", crops: "crops-32", walk: "miri-walk-48x64",
  actions: "miri-actions-48x64", buildings: "buildings-props", animals: "animals-48",
};

function startServer() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
      fs.createReadStream(fp).pipe(res);
    });
    s.listen(0, "127.0.0.1", () => resolve(s));
  });
}

(async function () {
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch { console.error("需要 devDependency: playwright"); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });

  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("console", (m) => { if (m.type() === "error") console.error("  page error:", m.text()); });
  await page.goto("http://127.0.0.1:" + port + "/scripts/gen-v2/generator.html");
  await page.waitForFunction(() => window.__v2, { timeout: 30000 });
  const v2 = await page.evaluate(() => window.__v2);
  await browser.close();
  server.close();

  const manifest = { version: "2.0.0", generatedBy: "gen-v2-atlases.js (placeholder)", note: "整數 frame placeholder atlas；正式 gpt-image-2 v2 就緒可覆蓋同名 PNG。", sheets: {} };
  for (const key of Object.keys(FILES)) {
    const sheet = v2[key]; const base = FILES[key];
    const b64 = sheet.png.split(",")[1];
    fs.writeFileSync(path.join(OUT, base + ".png"), Buffer.from(b64, "base64"));
    fs.writeFileSync(path.join(OUT, base + ".json"), JSON.stringify({ image: "assets/generated/v2/" + base + ".png", meta: sheet.meta, frames: sheet.frames }, null, 2));
    manifest.sheets[key] = { image: "assets/generated/v2/" + base + ".png", map: "assets/generated/v2/" + base + ".json", meta: sheet.meta, frameCount: Object.keys(sheet.frames).length };
    console.log("  ✓ " + base + ".png (" + sheet.meta.w + "x" + sheet.meta.h + ", " + Object.keys(sheet.frames).length + " frames)");
  }
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("  ✓ manifest.json");
  console.log("✅ v2 atlas 產生完成 → assets/generated/v2/");
})();
