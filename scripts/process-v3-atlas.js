/* =========================================================================
 * process-v3-atlas.js — 把 gpt-image-2 源圖切成精確 v3 frame atlas + JSON + manifest
 * 開 scripts/gen-v3/processor.html（canvas：程序化地形 + 切 gpt 源圖），
 * 讀 window.__v3，存 assets/generated/v3/ 各 atlas PNG/JSON 與 manifest.json。
 * 執行：node scripts/process-v3-atlas.js   （需 devDependency: playwright）
 * ========================================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "assets", "generated", "v3");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".png": "image/png" };
const FILES = { terrain: "terrain-organic-32", crops: "crops-32", walk: "miri-walk-48x64",
  actions: "miri-actions-48x64", vfx: "action-vfx-32", props: "props-stations" };

function server() {
  return new Promise((res) => {
    const s = http.createServer((rq, rs) => {
      let p = decodeURIComponent(rq.url.split("?")[0]); if (p === "/") p = "/index.html";
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { rs.writeHead(404); rs.end(); return; }
      rs.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
      fs.createReadStream(fp).pipe(rs);
    });
    s.listen(0, "127.0.0.1", () => res(s));
  });
}

(async function () {
  let chromium; try { ({ chromium } = require("playwright")); } catch { console.error("需要 playwright"); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const s = await server(); const port = s.address().port;
  const browser = await chromium.launch(); const page = await browser.newPage();
  page.on("console", (m) => { if (m.type() === "error") console.error("  page:", m.text()); });
  await page.goto("http://127.0.0.1:" + port + "/scripts/gen-v3/processor.html");
  await page.waitForFunction(() => window.__v3, { timeout: 30000 });
  const v3 = await page.evaluate(() => window.__v3);
  await browser.close(); s.close();

  const manifest = { version: "3.0.0", generatedBy: "process-v3-atlas.js (gpt-image-2 源圖 + 程序化地形)", sheets: {} };
  for (const key of Object.keys(FILES)) {
    const sheet = v3[key]; const base = FILES[key];
    if (!sheet) { console.warn("  ⚠ 缺源圖，略過 " + key + "（先跑 gen-art-v3.js）"); continue; }
    fs.writeFileSync(path.join(OUT, base + ".png"), Buffer.from(sheet.png.split(",")[1], "base64"));
    fs.writeFileSync(path.join(OUT, base + ".json"), JSON.stringify({ image: "assets/generated/v3/" + base + ".png", meta: sheet.meta, frames: sheet.frames }, null, 2));
    manifest.sheets[key] = { image: "assets/generated/v3/" + base + ".png", map: "assets/generated/v3/" + base + ".json", meta: sheet.meta, frameCount: Object.keys(sheet.frames).length };
    console.log("  ✓ " + base + ".png (" + sheet.meta.w + "x" + sheet.meta.h + ", " + Object.keys(sheet.frames).length + " frames)");
  }
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("✅ v3 atlas 處理完成 → assets/generated/v3/");
})();
