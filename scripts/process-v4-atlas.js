/* =========================================================================
 * process-v4-atlas.js — 把 gpt-image-2 v4 源圖切成精確 v4 frame atlas + JSON + manifest
 * 開 scripts/gen-v4/processor.html（canvas：程序化地形 + 切 gpt 源圖），讀 window.__v4，
 * 存 assets/generated/v4/ 各 atlas PNG/JSON 與 manifest.json。
 * props（站點/障礙 rock/stump/bush）與 vfx 沿用 v3，manifest 直接引用 v3 路徑。
 * 執行：node scripts/process-v4-atlas.js   （需 devDependency: playwright）
 * ========================================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "assets", "generated", "v4");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".png": "image/png" };
// 由 processor 自行切出的 sheets → 輸出檔名
const FILES = { terrain: "terrain-organic-32", crops: "crops-48", walk: "miri-walk-48x64",
  actions: "miri-actions-48x64", animals: "animals-48", buildings: "buildings", structures: "structures-nature",
  // Stage 6：男主角（性別可選）+ NPC 鎮民
  walk_m: "max-walk-48x64", actions_m: "max-actions-48x64", npcs: "npcs-48x64" };
// 沿用 v3 的 sheets（站點/障礙/特效）
const V3_REUSE = {
  props: { image: "assets/generated/v3/props-stations.png", map: "assets/generated/v3/props-stations.json" },
  vfx:   { image: "assets/generated/v3/action-vfx-32.png",  map: "assets/generated/v3/action-vfx-32.json" },
};

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
  page.on("console", (m) => { const t = m.type(); if (t === "error" || t === "warning") console.error("  page:", m.text()); });
  await page.goto("http://127.0.0.1:" + port + "/scripts/gen-v4/processor.html");
  await page.waitForFunction(() => window.__v4, { timeout: 45000 });
  const v4 = await page.evaluate(() => window.__v4);
  await browser.close(); s.close();

  const manifest = { version: "4.0.0", generatedBy: "process-v4-atlas.js (gpt-image-2 v4 源圖 + 程序化地形)", sheets: {} };
  for (const key of Object.keys(FILES)) {
    const sheet = v4[key]; const base = FILES[key];
    if (!sheet) { console.warn("  ⚠ 缺源圖，略過 " + key + "（先跑 gen-art-v4.js）"); continue; }
    const img = "assets/generated/v4/" + base + ".png", mapP = "assets/generated/v4/" + base + ".json";
    fs.writeFileSync(path.join(OUT, base + ".png"), Buffer.from(sheet.png.split(",")[1], "base64"));
    fs.writeFileSync(path.join(OUT, base + ".json"), JSON.stringify({ image: img, meta: sheet.meta, frames: sheet.frames }, null, 2));
    manifest.sheets[key] = { image: img, map: mapP, meta: sheet.meta, frameCount: Object.keys(sheet.frames).length };
    console.log("  ✓ " + base + ".png (" + sheet.meta.w + "x" + sheet.meta.h + ", " + Object.keys(sheet.frames).length + " frames)");
  }
  // 沿用 v3 props / vfx（路徑即引用，無需複製）
  for (const key of Object.keys(V3_REUSE)) {
    const r = V3_REUSE[key];
    if (!fs.existsSync(path.join(ROOT, r.map))) { console.warn("  ⚠ 缺 v3 " + key + "（先跑 process-v3-atlas.js）"); continue; }
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, r.map), "utf8"));
    manifest.sheets[key] = { image: r.image, map: r.map, meta: m.meta, frameCount: Object.keys(m.frames).length, reusedFrom: "v3" };
    console.log("  ↻ " + key + "（沿用 v3：" + Object.keys(m.frames).length + " frames）");
  }
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("✅ v4 atlas 處理完成 → assets/generated/v4/");
})();
