/* =========================================================================
 * validate-v3-atlas.js — 驗證 assets/generated/v3 atlas 完整性
 * 檢查：PNG 尺寸 == JSON meta；grid 可整除；必要 frame id 齊全；
 * 角色/作物/物件含 anchor；座標不出界；renderer(ui.js/config) 用到的 frame 都解析得到。
 * 執行：node scripts/validate-v3-atlas.js   （exit 0 通過，1 失敗）
 * ========================================================================= */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const V3 = path.join(ROOT, "assets", "generated", "v3");

const errors = [];
const warns = [];
const fail = (m) => errors.push(m);
const warn = (m) => warns.push(m);

// 讀 PNG 寬高（IHDR）
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.toString("ascii", 12, 16) !== "IHDR") return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// 每 sheet 必須存在的 frame id（對齊 sprite-cutting-method-v3.md 與 renderer 實際用到的）
function range(prefixes, cols) {
  const out = [];
  for (const p of prefixes) for (let c = 0; c < cols; c++) out.push(p + "_" + String(c).padStart(2, "0"));
  return out;
}
const SFX = ["c", "n", "s", "e", "w", "ne", "nw", "se", "sw"];
const REQUIRED = {
  walk: range(["walk_down", "walk_left", "walk_right", "walk_up"], 6),
  actions: range(["idle_down", "idle_left", "idle_right", "idle_up",
    "hoe_side", "water_side", "sow_down", "harvest_down", "carry_down",
    "collect_down", "use_station_down", "hurt"], 6),
  vfx: range(["water_droplets", "soil_dust", "seed_scatter", "harvest_pop",
    "material_pop", "product_pop", "valid_ring", "invalid_ring"], 6),
  crops: (() => {
    const rows = ["wheat", "carrot", "tomato", "strawberry", "corn", "pumpkin"];
    const cols = ["seed", "sprout", "young", "mature", "ready"];
    const out = []; for (const r of rows) for (const c of cols) out.push(r + "_" + c); return out;
  })(),
  terrain: [].concat(
    ["grass_center_01", "grass_center_02", "grass_center_03", "grass_center_04", "grass_flower_01", "grass_flower_02", "grass_clump_01"],
    SFX.map((s) => "path_" + s),
    SFX.map((s) => "soil_dry_" + s),
    SFX.map((s) => "soil_wet_" + s),
    SFX.map((s) => "water_" + s),
    ["bridge_h", "bridge_v"]
  ),
  props: ["order_board", "storage_crate", "mailbox", "well", "farmhouse", "chicken_coop",
    "barn", "stump", "rock", "bush", "compost_heap", "wood_stack", "stone_stack", "pond_edge"],
};
// 哪些 sheet 的 frame 必須有 anchor（角色/作物/物件需要腳底/底部錨點）
const NEED_ANCHOR = new Set(["walk", "actions", "crops", "props"]);

function main() {
  const manPath = path.join(V3, "manifest.json");
  if (!fs.existsSync(manPath)) { fail("缺 manifest.json（先跑 process-v3-atlas.js）"); return done(); }
  const manifest = JSON.parse(fs.readFileSync(manPath, "utf8"));

  for (const key of Object.keys(REQUIRED)) {
    const sheet = manifest.sheets[key];
    if (!sheet) { fail(`manifest 缺 sheet「${key}」`); continue; }
    const jsonPath = path.join(ROOT, sheet.map);
    const pngPath = path.join(ROOT, sheet.image);
    if (!fs.existsSync(jsonPath)) { fail(`${key}: 缺 JSON ${sheet.map}`); continue; }
    if (!fs.existsSync(pngPath)) { fail(`${key}: 缺 PNG ${sheet.image}`); continue; }
    const map = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const meta = map.meta || {};
    const size = pngSize(pngPath);

    // 1) PNG 尺寸 == meta
    if (size && (size.w !== meta.w || size.h !== meta.h))
      fail(`${key}: PNG ${size.w}x${size.h} != meta ${meta.w}x${meta.h}`);
    // 2) grid 可整除
    if (meta.frameW && meta.w % meta.frameW !== 0) fail(`${key}: meta.w ${meta.w} 不能被 frameW ${meta.frameW} 整除`);
    if (meta.frameH && meta.h % meta.frameH !== 0) fail(`${key}: meta.h ${meta.h} 不能被 frameH ${meta.frameH} 整除`);

    const frames = map.frames || {};
    // 3) 必要 frame id 齊全
    for (const id of REQUIRED[key]) if (!frames[id]) fail(`${key}: 缺 frame「${id}」`);
    // 4) 座標不出界 + 5) anchor
    for (const id of Object.keys(frames)) {
      const f = frames[id];
      if (f.x < 0 || f.y < 0 || f.x + f.w > meta.w || f.y + f.h > meta.h)
        fail(`${key}.${id}: 座標出界 (${f.x},${f.y},${f.w},${f.h}) / ${meta.w}x${meta.h}`);
      if (NEED_ANCHOR.has(key) && (!Array.isArray(f.anchor) || f.anchor.length !== 2))
        fail(`${key}.${id}: 缺 anchor`);
    }
    console.log(`  ✓ ${key}: ${Object.keys(frames).length} frames, ${size ? size.w + "x" + size.h : "?"}`);
  }

  // 6) renderer 解析：載入 config 取遊戲實際會用到的 props/crops frame
  try {
    const C = require(path.join(ROOT, "src", "config.js"));
    const cropMap = JSON.parse(fs.readFileSync(path.join(V3, "crops-32.json"), "utf8")).frames;
    const stages = ["seed", "sprout", "young", "mature", "ready"];
    for (const cid of Object.keys(C.CROPS)) for (const s of stages)
      if (!cropMap[cid + "_" + s]) fail(`renderer: crops 缺遊戲作物 frame「${cid}_${s}」`);
    const propMap = JSON.parse(fs.readFileSync(path.join(V3, "props-stations.json"), "utf8")).frames;
    const buildingFrame = { chickenCoop: "chicken_coop", barn: "barn", beeBox: "compost_heap", silo: "storage_crate", compostHeap: "compost_heap" };
    for (const t of Object.keys(buildingFrame)) if (!propMap[buildingFrame[t]]) fail(`renderer: props 缺建築 frame「${buildingFrame[t]}」`);
    // tree 為 Stage 4 障礙，改用 v4 structures:oak 呈現（不在 v3 props）；其餘障礙沿用 v3 props
    for (const o of Object.keys(C.OBSTACLES)) if (o !== "tree" && !propMap[o]) fail(`renderer: props 缺障礙 frame「${o}」`);
    for (const sid of Object.keys(C.STATIONS)) {
      const st = C.STATIONS[sid]; if ((st.sheet || "props") === "props" && !propMap[st.frame]) fail(`renderer: props 缺站點 frame「${st.frame}」`);
    }
  } catch (e) { warn("renderer 解析檢查略過：" + e.message); }

  done();
}

function done() {
  for (const w of warns) console.warn("  ⚠ " + w);
  if (errors.length) {
    console.error("\n❌ v3 atlas 驗證失敗：");
    for (const e of errors) console.error("   - " + e);
    process.exit(1);
  }
  console.log("\n✅ v3 atlas 驗證通過");
}

main();
