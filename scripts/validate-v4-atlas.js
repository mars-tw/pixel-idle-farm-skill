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
  crops2: (() => {
    const rows = ["bell_pepper", "potato", "grapes", "melon"];
    const cols = ["seed", "sprout", "young", "mature", "ready"];
    const out = []; for (const r of rows) for (const c of cols) out.push(r + "_" + c); return out;
  })(),
  crops3: (() => {
    const rows = ["pea", "sweet_potato", "winter_kale"];
    const cols = ["seed", "sprout", "young", "mature", "ready"];
    const out = []; for (const r of rows) for (const c of cols) out.push(r + "_" + c); return out;
  })(),
  crops4: (() => {
    const rows = ["radish", "sunflower"];
    const cols = ["seed", "sprout", "young", "mature", "ready"];
    const out = []; for (const r of rows) for (const c of cols) out.push(r + "_" + c); return out;
  })(),
  animals: (() => {
    const rows = ["chicken", "cow", "sheep", "bee"];
    const cols = ["idle_a", "idle_b", "walk_a", "walk_b"];
    const out = []; for (const r of rows) for (const c of cols) out.push(r + "_" + c); return out;
  })(),
  animals_duck: [
    "duck_idle_a", "duck_idle_b", "duck_walk_a", "duck_walk_b",
    "duck_happy_a", "duck_happy_b", "duck_eating_a", "duck_eating_b",
  ],
  buildings: ["farmhouse", "barn", "chicken_coop", "shop"],
  structures: ["oak", "oak_spring", "oak_autumn", "oak_winter", "bush_big_spring", "bush_big_autumn", "bush_big_winter"],
  terrain: [].concat(
    ["grass_center_01", "grass_center_02", "grass_center_03", "grass_center_04", "grass_flower_01", "grass_flower_02", "grass_clump_01"],
    SFX.map((s) => "path_" + s), SFX.map((s) => "soil_dry_" + s),
    SFX.map((s) => "soil_wet_" + s), SFX.map((s) => "water_" + s), ["bridge_h", "bridge_v"]
  ),
  props: ["order_board", "storage_crate", "mailbox", "well", "rock", "stump", "bush"],
  // water_droplets 在 v3 源圖整列為空（沿用），角色澆水動畫已提供回饋，故不強制要求
  vfx: range(["soil_dust", "seed_scatter", "harvest_pop", "product_pop", "valid_ring", "invalid_ring"], 6),
  // Stage 7：動物照護
  care_props: (() => {
    const cols = { feed_trough: ["empty", "grain", "hay", "mixed"], water_trough: ["empty", "half", "full", "fresh"],
      grooming_brush: ["plain", "wool", "bucket", "kit"], animal_bed: ["plain", "fresh", "cozy", "premium"] };
    const out = []; for (const r of Object.keys(cols)) for (const c of cols[r]) out.push(r + "_" + c); return out;
  })(),
  product_quality: (() => {
    const rows = ["egg", "milk", "wool", "honey"], cols = ["normal", "good", "premium"];
    const out = []; for (const r of rows) for (const c of cols) out.push(r + "_" + c); return out;
  })(),
  product_quality_duck: ["duck_egg_normal", "duck_egg_good", "duck_egg_premium"],
  care_vfx: range(["feed_bits", "water_splash", "groom_sparkle", "affinity_heart", "quality_sparkle", "care_ready_ring"], 6),
  animal_status: range(["hungry", "thirsty", "needs_groom", "happy"], 4),
  animals_care: (() => {
    const rows = ["chicken", "cow", "sheep", "bee"], cols = ["happy_a", "happy_b", "eating_a", "eating_b"];
    const out = []; for (const r of rows) for (const c of cols) out.push(r + "_" + c); return out;
  })(),
};
const NEED_ANCHOR = new Set(["walk", "actions", "walk_m", "actions_m", "npcs", "crops", "crops2", "crops3", "crops4", "animals", "animals_duck", "buildings", "structures",
  "care_props", "product_quality_duck", "animals_care"]);
// 需做像素「非空白」檢查的 sheet（程序化 terrain / vfx 略過）
const PIXEL_SHEETS = ["walk", "actions", "walk_m", "actions_m", "npcs", "crops", "crops2", "crops3", "crops4", "animals", "animals_duck", "buildings",
  "care_props", "product_quality", "product_quality_duck", "animals_care"];

function server() {
  return new Promise((res) => {
    const s = http.createServer((rq, rs) => {
      let p = decodeURIComponent(rq.url.split("?")[0]); if (p === "/") p = "/index.html";
      if (p === "/__pixel_check.html") {
        rs.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        rs.end("<!doctype html><meta charset=\"utf-8\"><title>atlas pixel check</title>");
        return;
      }
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
  const qualityStats = {};
  const originalGoto = page.goto.bind(page);
  page.goto = (url, options) => originalGoto(
    url === "http://127.0.0.1:" + port + "/" ? "http://127.0.0.1:" + port + "/__pixel_check.html" : url,
    options || { waitUntil: "domcontentloaded" },
  );
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
        let on = 0, edge = 0, edgeTot = 0, minY = f.h, maxY = -1;
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
          const a = d[((f.y + y) * meta.w + (f.x + x)) * 4 + 3];
          if (a > 40) { on++; if (y < minY) minY = y; if (y > maxY) maxY = y; }
          const onEdge = x <= 1 || y <= 1 || x >= f.w - 2 || y >= f.h - 2;
          if (onEdge) { edgeTot++; if (a > 60) edge++; }
        }
        out[id] = { cover: on / (f.w * f.h), edge: edge / Math.max(1, edgeTot), empty: !!f.empty,
          bboxH: maxY >= minY ? maxY - minY + 1 : 0, bottom: maxY };
      }
      return out;
    }, { url, frames: map.frames, meta: map.meta, want: [...need] });
    if (stats.error) { fail(`${key}: 像素檢查載入失敗 ${sheet.image}`); continue; }
    qualityStats[key] = stats;
    for (const id of need) {
      const st = stats[id]; if (!st) continue; // 缺 frame 由結構檢查負責
      if (st.empty || st.cover < 0.012) fail(`${key}.${id}: 空白幀（覆蓋率 ${(st.cover * 100).toFixed(1)}%）`);
      if (["crops", "crops2", "crops3", "crops4"].includes(key) && st.edge > 0.06) fail(`${key}.${id}: 作物觸碰格邊被裁切（邊緣 ${(st.edge * 100).toFixed(0)}%）`);
      else if (st.edge > 0.18) warn(`${key}.${id}: 內容貼近格邊（邊緣 ${(st.edge * 100).toFixed(0)}%）`);
    }
  }
  // P0 action-sheet guard: full bodies must remain at walk-sheet scale. This catches
  // the former hoe_up head-only fragments and oversized idle portraits after a regen.
  for (const [walkKey, actionKey] of [["walk", "actions"], ["walk_m", "actions_m"]]) {
    const walkRef = qualityStats[walkKey] && qualityStats[walkKey].walk_down_00;
    const actions = qualityStats[actionKey];
    if (!walkRef || !actions) continue;
    const rows = ACTION_ROWS.concat(["idle_down", "idle_up", "idle_side"]);
    for (const id of range(rows, 6)) {
      const st = actions[id]; if (!st) continue;
      if (st.bboxH < walkRef.bboxH * 0.9)
        fail(`${actionKey}.${id}: 全身高度 ${st.bboxH}px，低於 walk 基準 ${walkRef.bboxH}px 的 90%`);
      if (st.bottom < walkRef.bottom - 2)
        fail(`${actionKey}.${id}: 腳底 baseline ${st.bottom}px，高於 walk 基準 ${walkRef.bottom}px 超過 2px`);
      if (id.startsWith("idle_") && st.cover > 0.45)
        fail(`${actionKey}.${id}: idle 覆蓋率 ${(st.cover * 100).toFixed(1)}%，疑似巨臉/近景`);
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
    const stages = ["seed", "sprout", "young", "mature", "ready"];
    const cropMaps = {};
    for (const cid of Object.keys(C.CROPS)) {
      const crop = C.CROPS[cid];
      if (crop.emojiOnly) continue;
      const sheetKey = crop.sheet || "crops";
      if (!cropMaps[sheetKey]) {
        const sheet = manifest.sheets[sheetKey];
        if (!sheet) { fail(`renderer: crops 缺 sheet「${sheetKey}」`); continue; }
        cropMaps[sheetKey] = JSON.parse(fs.readFileSync(path.join(ROOT, sheet.map), "utf8")).frames;
      }
      for (const s of stages)
        if (!cropMaps[sheetKey][cid + "_" + s]) fail(`renderer: ${sheetKey} 缺遊戲作物 frame「${cid}_${s}」`);
    }
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
    // Stage 7：品質分級圖示 / 動物 happy+eating 幀，config 實際用到的都要能解析
    const qualMaps = {};
    for (const pid of Object.keys(C.PRODUCTS)) {
      const p = C.PRODUCTS[pid]; const fid = p.baseProduct + "_" + p.quality;
      const sheetKey = p.qualitySheet || "product_quality";
      if (!qualMaps[sheetKey]) {
        const sheet = manifest.sheets[sheetKey];
        if (!sheet) { fail(`renderer: product_quality 缺 sheet「${sheetKey}」`); continue; }
        qualMaps[sheetKey] = JSON.parse(fs.readFileSync(path.join(ROOT, sheet.map), "utf8")).frames;
      }
      if (!qualMaps[sheetKey][fid]) fail(`renderer: ${sheetKey} 缺產品 frame「${fid}」（${pid}）`);
    }
    const animalMaps = {};
    const animalFrames = (sheetKey) => {
      if (!animalMaps[sheetKey]) {
        const sheet = manifest.sheets[sheetKey];
        if (!sheet) return null;
        animalMaps[sheetKey] = JSON.parse(fs.readFileSync(path.join(ROOT, sheet.map), "utf8")).frames;
      }
      return animalMaps[sheetKey];
    };
    for (const aid of Object.keys(C.ANIMALS)) {
      const a = C.ANIMALS[aid];
      const baseKey = a.sheet || "animals";
      const careKey = a.careSheet || "animals_care";
      const base = animalFrames(baseKey);
      const care = animalFrames(careKey);
      if (!base) { fail(`renderer: animals 缺 sheet「${baseKey}」`); continue; }
      if (!care) { fail(`renderer: animals_care 缺 sheet「${careKey}」`); continue; }
      for (const suffix of ["idle_a", "idle_b", "walk_a", "walk_b"])
        if (!base[aid + "_" + suffix]) fail(`renderer: ${baseKey} 缺動物 frame「${aid}_${suffix}」`);
      for (const suffix of ["happy_a", "happy_b", "eating_a", "eating_b"])
        if (!care[aid + "_" + suffix]) fail(`renderer: ${careKey} 缺動物 frame「${aid}_${suffix}」`);
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
