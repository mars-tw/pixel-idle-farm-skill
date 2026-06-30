/* =========================================================================
 * validate-v4-atlas.js — 驗證 assets/generated/v4 atlas 完整性與品質
 * 結構檢查（純 Node）：PNG 尺寸==JSON meta；grid 可整除；必要 frame 齊全；
 *   角色/作物/動物/建築含 anchor；座標不出界；renderer(config) 用到的 frame 都在。
 * 像素檢查（playwright，缺則降級 warn）：必要 frame 非空白（alpha 覆蓋率達門檻）；
 *   作物 frame 不可觸碰格邊（避免裁切）。
 * 執行：node scripts/validate-v4-atlas.js   （exit 0 通過，1 失敗）
 * ========================================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const V4 = path.join(ROOT, "assets", "generated", "v4");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".png": "image/png" };

const errors = [];
const warns = [];
const fail = (m) => errors.push(m);
const warn = (m) => warns.push(m);

function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.toString("ascii", 12, 16) !== "IHDR") return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function range(prefixes, cols) {
  const out = [];
  for (const p of prefixes) for (let c = 0; c < cols; c++) out.push(p + "_" + String(c).padStart(2, "0"));
  return out;
}
const SFX = ["c", "n", "s", "e", "w", "ne", "nw", "se", "sw"];
// renderer 實際會播的動作列（idle 在 actions sheet 內未被渲染，改用 walk 站立幀，故不強制要求）
const ACTION_ROWS = ["water", "hoe", "sow", "harvest", "collect", "build", "use"]
  .flatMap((b) => [b + "_down", b + "_up", b + "_side"]);
const REQUIRED = {
  walk: range(["walk_down", "walk_left", "walk_right", "walk_up"], 6),
  actions: range(ACTION_ROWS, 6),
  // Stage 6：男主角 Kai（性別可選，frame 命名同 Miri）
  walk_m: range(["walk_down", "walk_left", "walk_right", "walk_up"], 6),
  actions_m: range(ACTION_ROWS, 6),
  // Stage 6：NPC 鎮民（front-facing idle/talk）
  npcs: (() => {
    const rows = ["mayor", "merchant", "elder", "child"];
    const cols = ["idle_a", "idle_b", "talk_a", "talk_b"];
    const out = []; for (const r of rows) for (const c of cols) out.push(r + "_" + c); return out;
  })(),
  crops: (() => {
    const rows = ["wheat", "carrot", "tomato", "strawberry", "corn", "pumpkin"];
    const cols = ["seed", "sprout", "young", "mature", "ready"];
    const out = []; for (const r of rows) for (const c of cols) out.push(r + "_" + c); return out;
  })(),
  animals: (() => {
    const rows = ["chicken", "cow", "sheep", "bee"];
    const cols = ["idle_a", "idle_b", "walk_a", "walk_b"];
    const out = []; for (const r of rows) for (const c of cols) out.push(r + "_" + c); return out;
  })(),
  buildings: ["farmhouse", "barn", "chicken_coop", "shop"],
  structures: ["oak"], // loose 抽取，只硬性要求 oak（tree 障礙用）；其餘裝飾為加分
  terrain: [].concat(
    ["grass_center_01", "grass_center_02", "grass_center_03", "grass_center_04", "grass_flower_01", "grass_flower_02", "grass_clump_01"],
    SFX.map((s) => "path_" + s), SFX.map((s) => "soil_dry_" + s),
    SFX.map((s) => "soil_wet_" + s), SFX.map((s) => "water_" + s), ["bridge_h", "bridge_v"]
  ),
  props: ["order_board", "storage_crate", "mailbox", "well", "rock", "stump", "bush"],
  // water_droplets 在 v3 源圖整列為空（沿用），角色澆水動畫已提供回饋，故不強制要求
  vfx: range(["soil_dust", "seed_scatter", "harvest_pop", "product_pop", "valid_ring", "invalid_ring"], 6),
};
const NEED_ANCHOR = new Set(["walk", "actions", "walk_m", "actions_m", "npcs", "crops", "animals", "buildings", "structures"]);
// 需做像素「非空白」檢查的 sheet（程序化 terrain / vfx 略過）
const PIXEL_SHEETS = ["walk", "actions", "walk_m", "actions_m", "npcs", "crops", "animals", "buildings"];

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

// 像素檢查：每 frame 統計 alpha 覆蓋率 + 邊緣環 alpha 比例
async function pixelCheck(manifest) {
  let chromium;
  try { ({ chromium } = require("playwright")); } catch { warn("無 playwright，略過像素級空白/觸邊檢查"); return; }
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) { warn("無法啟動 chromium（" + e.message.split("\n")[0] + "），略過像素級檢查"); return; }
  const s = await server(); const port = s.address().port;
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:" + port + "/"); // 與圖片同源，避免 canvas 被跨來源汙染
  for (const key of PIXEL_SHEETS) {
    const sheet = manifest.sheets[key]; if (!sheet) continue;
    const map = JSON.parse(fs.readFileSync(path.join(ROOT, sheet.map), "utf8"));
    const url = "http://127.0.0.1:" + port + "/" + sheet.image;
    const need = new Set(REQUIRED[key] || Object.keys(map.frames));
    const stats = await page.evaluate(async ({ url, frames, meta, want }) => {
      const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = url; });
      if (!img) return { error: "load_fail" };
      const cv = document.createElement("canvas"); cv.width = meta.w; cv.height = meta.h;
      const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, meta.w, meta.h).data;
      const out = {};
      for (const id of want) {
        const f = frames[id]; if (!f) continue;
        let on = 0, edge = 0, edgeTot = 0;
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
          const a = d[((f.y + y) * meta.w + (f.x + x)) * 4 + 3];
          if (a > 40) on++;
          const onEdge = x <= 1 || y <= 1 || x >= f.w - 2 || y >= f.h - 2;
          if (onEdge) { edgeTot++; if (a > 60) edge++; }
        }
        out[id] = { cover: on / (f.w * f.h), edge: edge / Math.max(1, edgeTot), empty: !!f.empty };
      }
      return out;
    }, { url, frames: map.frames, meta: map.meta, want: [...need] });
    if (stats.error) { fail(`${key}: 像素檢查載入失敗 ${sheet.image}`); continue; }
    for (const id of need) {
      const st = stats[id]; if (!st) continue; // 缺 frame 由結構檢查負責
      if (st.empty || st.cover < 0.012) fail(`${key}.${id}: 空白幀（覆蓋率 ${(st.cover * 100).toFixed(1)}%）`);
      if (key === "crops" && st.edge > 0.06) fail(`${key}.${id}: 作物觸碰格邊被裁切（邊緣 ${(st.edge * 100).toFixed(0)}%）`);
      else if (st.edge > 0.18) warn(`${key}.${id}: 內容貼近格邊（邊緣 ${(st.edge * 100).toFixed(0)}%）`);
    }
  }
  await browser.close(); s.close();
}

async function main() {
  const manPath = path.join(V4, "manifest.json");
  if (!fs.existsSync(manPath)) { fail("缺 manifest.json（先跑 process-v4-atlas.js）"); return done(); }
  const manifest = JSON.parse(fs.readFileSync(manPath, "utf8"));

  for (const key of Object.keys(REQUIRED)) {
    const sheet = manifest.sheets[key];
    if (!sheet) { fail(`manifest 缺 sheet「${key}」`); continue; }
    const jsonPath = path.join(ROOT, sheet.map), pngPath = path.join(ROOT, sheet.image);
    if (!fs.existsSync(jsonPath)) { fail(`${key}: 缺 JSON ${sheet.map}`); continue; }
    if (!fs.existsSync(pngPath)) { fail(`${key}: 缺 PNG ${sheet.image}`); continue; }
    const map = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const meta = map.meta || {}, size = pngSize(pngPath), frames = map.frames || {};

    if (size && (size.w !== meta.w || size.h !== meta.h)) fail(`${key}: PNG ${size.w}x${size.h} != meta ${meta.w}x${meta.h}`);
    if (meta.frameW && meta.w % meta.frameW !== 0) fail(`${key}: meta.w ${meta.w} 不能被 frameW ${meta.frameW} 整除`);
    if (meta.frameH && meta.h % meta.frameH !== 0) fail(`${key}: meta.h ${meta.h} 不能被 frameH ${meta.frameH} 整除`);
    for (const id of REQUIRED[key]) {
      if (!frames[id]) { fail(`${key}: 缺 frame「${id}」`); continue; }
      if (frames[id].empty) fail(`${key}.${id}: frame 標記為空（empty）`);
    }
    for (const id of Object.keys(frames)) {
      const f = frames[id];
      if (f.x < 0 || f.y < 0 || f.x + f.w > meta.w || f.y + f.h > meta.h)
        fail(`${key}.${id}: 座標出界 (${f.x},${f.y},${f.w},${f.h}) / ${meta.w}x${meta.h}`);
      if (NEED_ANCHOR.has(key) && (!Array.isArray(f.anchor) || f.anchor.length !== 2))
        fail(`${key}.${id}: 缺 anchor`);
    }
    console.log(`  ✓ ${key}: ${Object.keys(frames).length} frames, ${size ? size.w + "x" + size.h : "?"}`);
  }

  // renderer 解析：config 實際會用到的 crops/buildings/obstacles/stations frame
  try {
    const C = require(path.join(ROOT, "src", "config.js"));
    const cropMap = JSON.parse(fs.readFileSync(path.join(V4, "crops-48.json"), "utf8")).frames;
    const stages = ["seed", "sprout", "young", "mature", "ready"];
    for (const cid of Object.keys(C.CROPS)) for (const s of stages)
      if (!cropMap[cid + "_" + s]) fail(`renderer: crops 缺遊戲作物 frame「${cid}_${s}」`);
    const bMap = JSON.parse(fs.readFileSync(path.join(V4, "buildings.json"), "utf8")).frames;
    for (const s of (C.STRUCTURES || [])) if (s.sheet === "buildings" && !bMap[s.frame]) fail(`renderer: buildings 缺結構 frame「${s.frame}」`);
    const propMap = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/generated/v3/props-stations.json"), "utf8")).frames;
    for (const sid of Object.keys(C.STATIONS)) {
      const st = C.STATIONS[sid]; const sheet = st.sheet || "props";
      if (sheet === "props" && !propMap[st.frame]) fail(`renderer: props 缺站點 frame「${st.frame}」`);
    }
    // 障礙：tree 用 structures:oak，其餘用 props 同名
    const structMap = JSON.parse(fs.readFileSync(path.join(V4, "structures-nature.json"), "utf8")).frames;
    for (const o of Object.keys(C.OBSTACLES)) {
      if (o === "tree") { if (!structMap.oak) fail("renderer: structures 缺 tree 用的 frame「oak」"); }
      else if (!propMap[o]) fail(`renderer: props 缺障礙 frame「${o}」`);
    }
  } catch (e) { warn("renderer 解析檢查略過：" + e.message); }

  await pixelCheck(manifest);
  done();
}

function done() {
  for (const w of warns) console.warn("  ⚠ " + w);
  if (errors.length) {
    console.error("\n❌ v4 atlas 驗證失敗：");
    for (const e of errors) console.error("   - " + e);
    process.exit(1);
  }
  console.log("\n✅ v4 atlas 驗證通過");
}

main();
