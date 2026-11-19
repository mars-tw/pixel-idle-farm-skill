"use strict";
/* R85C：美術資產與評審截圖工具（R84 未解第 8 項）。
 * 1 新圖（assets/generated/content-r85）：manifest 每一張都有記錄（尺寸、位元組、sha256、MUSE CLI 與模型欄位），尺寸對齊同類素材、真透明（RGBA、四角透明、有不透明主體）。
 * 2 兩種晨耕種子籃：縮到 64px 輪廓重疊（IoU）不到 0.7、縮圖差至少 80（舊圖 0.93／34.8）；地圖物件改接新圖。
 * 3 藍布老麥田：故事階段（班伯在等、班伯有話要說）與等你播種改用跟 content-r84 同一套 2×2 田圖；土堆寬度與底邊跟 R84 四張對齊。
 * 4 料理：十道料理各有自己的成品圖（64×64），兩兩縮圖差至少 30、跟鐵鍋爐子圖差至少 60；灶台清單與成果卡都接上，不再共用爐子。
 * 5 風吹白線：不再畫在 #weatherLayer（整個視口最上層），改畫在田野地面 #groundLayer；實拍四尺寸，介面與場景名牌上沒有看得出來的白線，地面上有。
 * 6 評審截圖工具 scripts/review-capture-r85.cjs：清單涵蓋計畫要的每個畫面，四尺寸實跑一小組不報錯、檔名有序號、index.md 有序號／尺寸／畫面／該看什麼。
 * 7 接線：加進 unit 清單；樣式改在原有規則上，不追加到 content-r58b.css 檔尾。 */
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), zlib = require("node:zlib"), os = require("node:os"), cp = require("node:child_process"), crypto = require("node:crypto");
global.window = global;
const ROOT = path.join(__dirname, ".."), read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const State = require("../src/state.js"), A = require("../src/adventure.js"), K = require("../src/cooking-r75.js"), H = require("../src/heirloom.js");
const R = require("../src/story-r76.js"), Q = require("../src/choices-r77.js");
Q.install();
const DIR = "assets/generated/content-r85", T0 = Date.parse("2026-11-09T08:00:00Z");
let passed = 0;
const pending = [];
function test(name, fn) { pending.push([name, fn]); }

/* ---------- 讀 PNG（8 位元 RGBA、不交錯；不認得的格式回傳 rgba:null） ---------- */
function decodePng(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  assert.equal(b.readUInt32BE(0), 0x89504e47, "不是 PNG：" + file);
  let p = 8, w = 0, h = 0, depth = 0, type = 0, inter = 0; const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), t = b.toString("ascii", p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (t === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; inter = d[12]; } else if (t === "IDAT") idat.push(d); else if (t === "IEND") break;
    p += 12 + len;
  }
  if (depth !== 8 || type !== 6 || inter !== 0) return { w, h, depth, type, rgba: null };
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * 4, out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? out[y * stride + x - 4] : 0, up = y ? out[(y - 1) * stride + x] : 0, c = x >= 4 && y ? out[(y - 1) * stride + x - 4] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, depth, type, rgba: out };
}
/* 等比縮成 n×n（長邊對齊、置中），區塊平均（先乘不透明度）。 */
function shrink(img, n) {
  const s = Math.max(img.w, img.h) / n, ox = (n - img.w / s) / 2, oy = (n - img.h / s) / 2, acc = new Float64Array(n * n * 5);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const k = (y * img.w + x) * 4, a = img.rgba[k + 3] / 255, X = Math.min(n - 1, Math.floor(x / s + ox)), Y = Math.min(n - 1, Math.floor(y / s + oy)), j = (Y * n + X) * 5;
    acc[j] += img.rgba[k] * a; acc[j + 1] += img.rgba[k + 1] * a; acc[j + 2] += img.rgba[k + 2] * a; acc[j + 3] += a; acc[j + 4]++;
  }
  const out = [];
  for (let i = 0; i < n * n; i++) { const j = i * 5, cnt = acc[j + 4] || 1, a = acc[j + 3]; out.push(a ? acc[j] / a : 0, a ? acc[j + 1] / a : 0, a ? acc[j + 2] / a : 0, 255 * a / cnt); }
  return out;
}
/* 縮圖差：顏色差（照不透明度加權）＋輪廓差，0～255。 */
function thumbDiff(a, b) { let d = 0, n = 0; for (let i = 0; i < a.length; i += 4) { const wa = a[i + 3] / 255, wb = b[i + 3] / 255; d += (Math.abs(a[i] * wa - b[i] * wb) + Math.abs(a[i + 1] * wa - b[i + 1] * wb) + Math.abs(a[i + 2] * wa - b[i + 2] * wb)) / 3 + Math.abs(a[i + 3] - b[i + 3]); n++; } return d / n; }
function iou(a, b) { let i = 0, u = 0; for (let k = 3; k < a.length; k += 4) { const x = a[k] > 127, y = b[k] > 127; if (x && y) i++; if (x || y) u++; } return u ? i / u : 1; }
/* 不透明主體的外框與土堆寬（最下面三分之一高度裡最寬的一列）。 */
function body(img) {
  let l = 1e9, r = -1, t = 1e9, btm = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.rgba[(y * img.w + x) * 4 + 3] > 128) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); btm = Math.max(btm, y); }
  let wide = 0;
  for (let y = Math.round(btm - (btm - t) / 3); y <= btm; y++) { let a = -1, b = -1; for (let x = 0; x < img.w; x++) if (img.rgba[(y * img.w + x) * 4 + 3] > 128) { if (a < 0) a = x; b = x; } wide = Math.max(wide, b - a + 1); }
  return { l, r, t, b: btm, wide };
}
const dish = (id) => DIR + "/dish-" + id + ".png";
const RECIPE_IDS = (() => { const s = State.defaultState(T0); A.ensure(s, T0); return A.recipes(s, T0).map((r) => r.id); })();

/* ---------- 第 1 項：manifest 與檔案 ---------- */
const EXPECTED = [
  ["decision-mayor-farm-seed.png", 96, 96], ["decision-mayor-farm-sun.png", 96, 96],
  ["blue-cloth-wheat-field-tilled.png", 192, 192], ["blue-cloth-wheat-field-seedbag.png", 192, 192],
  ...RECIPE_IDS.map((id) => ["dish-" + id + ".png", 64, 64]),
];
test("1 新圖都在 manifest 裡：尺寸、位元組、sha256 跟檔案一致；寫明 MUSE CLI 與模型欄位；尺寸對齊同類素材、真透明", () => {
  const m = JSON.parse(read(DIR + "/manifest.json"));
  assert.match(m.tool, /MUSE CLI/, "工具寫 MUSE CLI"); assert.ok(typeof m.model === "string" && m.model.length >= 4, "模型欄位有寫（沒回報就寫模型未回報）");
  assert.match(m.model, /muse|模型未回報/i);
  assert.equal(RECIPE_IDS.length, 10, "灶台有十道料理");
  const listed = new Map(m.files.map((f) => [f.file, f]));
  const onDisk = fs.readdirSync(path.join(ROOT, DIR)).filter((f) => f.endsWith(".png")).sort();
  assert.deepEqual(onDisk, EXPECTED.map((e) => e[0]).sort(), "資料夾裡只有這輪要的新圖");
  for (const [file, w, h] of EXPECTED) {
    const row = listed.get(file); assert.ok(row, file + " 有記在 manifest");
    const buf = fs.readFileSync(path.join(ROOT, DIR, file)), img = decodePng(DIR + "/" + file);
    assert.deepEqual([img.w, img.h], [w, h], file + " 尺寸");
    assert.deepEqual(row.size, [w, h], file + " manifest 尺寸");
    assert.equal(row.bytes, buf.length, file + " 位元組"); assert.equal(row.sha256, crypto.createHash("sha256").update(buf).digest("hex"), file + " sha256");
    assert.ok(img.rgba, file + " 是 8 位元 RGBA（真透明，不是調色盤或白底）");
    const px = (x, y) => img.rgba[(y * w + x) * 4 + 3];
    assert.deepEqual([px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)], [0, 0, 0, 0], file + " 四角透明");
    let opaque = 0, magenta = 0; const colors = new Set();
    for (let k = 0; k < img.rgba.length; k += 4) if (img.rgba[k + 3] > 200) { opaque++; colors.add(img.rgba[k] >> 4 << 8 | img.rgba[k + 1] >> 4 << 4 | img.rgba[k + 2] >> 4); if (img.rgba[k] > 200 && img.rgba[k + 2] > 200 && img.rgba[k + 1] < 90) magenta++; }
    assert.ok(opaque >= w * h * 0.2, file + " 有不透明主體 " + opaque);
    assert.ok(colors.size >= 40, file + " 不是幾塊純色（不是程序化方塊）：" + colors.size + " 種色");
    assert.ok(magenta <= opaque * 0.002, file + " 洋紅底去乾淨 " + magenta);
  }
  /* 尺寸對齊同類素材：決定物件跟 content-r80 一樣 96×96、2×2 田圖跟 content-r84 一樣 192×192。 */
  const r80 = decodePng("assets/generated/content-r80/decision-mayor-town-town-gate.png"), r84 = decodePng("assets/generated/content-r84/blue-cloth-wheat-field-sprout.png");
  assert.deepEqual([r80.w, r80.h, r84.w, r84.h], [96, 96, 192, 192]);
  assert.match(read("CREDITS.md"), /content-r85[\s\S]{0,400}MUSE/, "CREDITS 記下 R85 新圖與 MUSE");
});

/* ---------- 第 2 項：兩種晨耕種子籃 ---------- */
test("2 兩種晨耕種子籃縮到 64px 分得出來（輪廓與顏色），地圖物件接新圖", () => {
  const thumbs = (dir) => ["seed", "sun"].map((k) => shrink(decodePng(dir + "/decision-mayor-farm-" + k + ".png"), 64));
  const [oldSeed, oldSun] = thumbs("assets/generated/content-r80"), [seed, sun] = thumbs(DIR);
  const oldD = thumbDiff(oldSeed, oldSun), newD = thumbDiff(seed, sun), oldI = iou(oldSeed, oldSun), newI = iou(seed, sun);
  assert.ok(oldD < 60 && oldI > 0.85, "量法有效：舊圖本來就分不出來 " + JSON.stringify([oldD, oldI]));
  assert.ok(newD >= 80, "新圖 64px 縮圖差夠大 " + newD.toFixed(1));
  assert.ok(newI <= 0.7, "新圖輪廓不一樣（寬矮對高瘦）IoU " + newI.toFixed(2));
  /* 主色：留種籃帶綠芽，晨光籃是金黃的瓶子。 */
  const tone = (img) => { let g = 0, y = 0; for (let k = 0; k < img.rgba.length; k += 4) { if (img.rgba[k + 3] < 200) continue; const r = img.rgba[k], gg = img.rgba[k + 1], b = img.rgba[k + 2]; if (gg > r + 10 && gg > b + 30) g++; if (r > 200 && gg > 170 && b < 120) y++; } return { g, y }; };
  const ts = tone(decodePng(DIR + "/decision-mayor-farm-seed.png")), tu = tone(decodePng(DIR + "/decision-mayor-farm-sun.png"));
  assert.ok(ts.g > tu.g * 3 && tu.y > ts.y * 3, "留種籃綠、晨光籃金黃 " + JSON.stringify({ ts, tu }));
  for (const key of ["seed", "sun"]) {
    assert.equal(Q.DECISION_ART["mayor:farm:" + key], DIR + "/decision-mayor-farm-" + key + ".png");
    assert.ok(Q.DECISION_ART_READY.includes("mayor:farm:" + key));
    const s = State.defaultState(T0); A.ensure(s, T0); A.resolveMainStoryChoice(s, "mayor", "farm", T0); Q.act(s, "mayor", T0 + 1); Q.act(s, "mayor", T0 + 2, key);
    const row = Q.sceneStates(s).find((x) => x.npcId === "mayor");
    assert.equal(row.marker.art, DIR + "/decision-mayor-farm-" + key + ".png", key + " 地圖物件用新圖");
  }
});

/* ---------- 第 3 項：藍布老麥田同一套畫法 ---------- */
function freshStory(now) { const s = State.defaultState(now); A.ensure(s, now); s.heirloom.started = true; s.heirloom.sunWheat = 2; s.storage.items.wheat = 2; H.deliver(s, "table", now); return s; }
test("3 藍布老麥田：故事階段與等你播種改用 content-r84 同一套 2×2 田圖，土堆跟 R84 四張對齊；封存那一邊不變", () => {
  const s = freshStory(T0); R.r81Choose(s, "plant", T0 + 1000);
  const order = R.r81SceneRows(s)[0];
  assert.equal(R.r81Stage(s), "order");
  assert.equal(order.marker.art, DIR + "/blue-cloth-wheat-field-tilled.png", "班伯在等：剛翻好的土");
  assert.deepEqual(order.marker.footprint, { dx: 1, dy: 0, w: 2, h: 2 }, "還是 2×2");
  const info = R.r81Order(s, T0 + 2000); s.storage.items[info.itemId] = info.need; R.r81Deliver(s, T0 + 2000);
  assert.equal(R.r81Stage(s), "scene"); assert.equal(R.r81SceneRows(s)[0].marker.art, DIR + "/blue-cloth-wheat-field-tilled.png", "班伯有話要說：同一張");
  R.r81SceneSeen(s, T0 + 3000);
  const arts = { empty: R.r81SceneRows(s)[0].marker.art };
  assert.equal(arts.empty, DIR + "/blue-cloth-wheat-field-seedbag.png", "等你播種：翻好的土上放著種子包");
  /* 故事與五個分支階段全部是同一套 blue-cloth-wheat-field-* 田圖。 */
  for (const file of [order.marker.art, arts.empty, ...Object.values(R.R84_ART)]) assert.match(file, /\/blue-cloth-wheat-field-[a-z-]+\.png$/, "同一套田圖：" + file);
  for (const k of R.R85_FIELD_ART_READY) assert.ok(fs.existsSync(path.join(ROOT, R.R85_FIELD_ART[k])), k + " 新圖存在");
  for (const f of Object.values(R.R85_FIELD_FALLBACK)) assert.ok(fs.existsSync(path.join(ROOT, f)), "後備圖存在 " + f);
  /* 土堆對齊：寬度與底邊跟 R84 四張差不到 3px；縮圖看得出跟 R84 剛種下不一樣（沒有芽）。 */
  const ref = Object.values(R.R84_ART).map((f) => body(decodePng(f)));
  for (const f of Object.values(R.R85_FIELD_ART)) {
    const b = body(decodePng(f));
    for (const r of ref) { assert.ok(Math.abs(b.wide - r.wide) <= 3, f + " 土堆寬 " + b.wide + " 對 " + r.wide); assert.ok(Math.abs(b.b - r.b) <= 3, f + " 底邊 " + b.b + " 對 " + r.b); assert.ok(Math.abs(b.l - r.l) <= 3, f + " 左緣"); }
  }
  const t = (f) => shrink(decodePng(f), 16);
  assert.ok(thumbDiff(t(R.R85_FIELD_ART.tilled), t(R.R85_FIELD_ART.seedbag)) >= 4, "翻好的土與放了種子包分得出");
  assert.notEqual(R.R85_FIELD_ART.tilled, R.r81Art("plant"), "不再用 R81 那一小株金麥");
  const seal = freshStory(T0); R.r81Choose(seal, "seal", T0 + 1000);
  assert.equal(R.r81SceneRows(seal)[0].marker.art, R.r81Art("seal"), "封存那一邊照舊是封存箱");
  /* CSS：只有缺圖退回單獨一包種子時才縮小，新田圖撐滿 2×2。 */
  const css = read("src/content-r58b.css");
  assert.match(css, /\.r78c-scene-change\[data-r84c-field\]\[data-r82b-stage="empty"\] img\[src\*="story-pouch"\] \{ width: 56%; height: 56%; \}/);
  assert.doesNotMatch(css, /\[data-r82b-stage="empty"\] img \{ width: 56%/, "新田圖不再被縮成 56%");
});

/* ---------- 第 4 項：料理各有自己的成品圖 ---------- */
test("4 十道料理各有自己的成品圖；灶台清單與成果卡接新圖、不再共用鐵鍋爐子", () => {
  const pot = shrink(decodePng("assets/generated/content-r75/cooking_pot.png"), 16), th = {};
  for (const id of RECIPE_IDS) {
    assert.equal(K.dishArt(id), dish(id), id + " 有自己的圖"); assert.equal(K.DISH_ART[id], dish(id));
    th[id] = shrink(decodePng(dish(id)), 16);
    assert.ok(thumbDiff(th[id], pot) >= 60, id + " 不是爐子 " + thumbDiff(th[id], pot).toFixed(1));
  }
  assert.equal(new Set(RECIPE_IDS.map(K.dishArt)).size, 10, "十張不同的圖");
  for (let i = 0; i < RECIPE_IDS.length; i++) for (let j = i + 1; j < RECIPE_IDS.length; j++) {
    const d = thumbDiff(th[RECIPE_IDS[i]], th[RECIPE_IDS[j]]); assert.ok(d >= 30, RECIPE_IDS[i] + " 與 " + RECIPE_IDS[j] + " 縮圖分得出 " + d.toFixed(1));
  }
  assert.equal(K.dishArt("not_a_recipe"), K.DISH_ART_FALLBACK, "不在清單上的料理才退回鐵鍋圖");
  const src = read("src/cooking-r75.js");
  assert.match(src, /pot\.src = dishArt\(recipeId\) \+ versionQuery\(\);/, "灶台清單縮圖用這道料理的圖");
  assert.doesNotMatch(src.slice(src.indexOf("function augmentKitchen"), src.indexOf("function openFireGame")), /pot\.src = "assets\/generated\/content-r75\/cooking_pot\.png"/, "清單不再每道都放鐵鍋");
  assert.match(src, /class="r76a-result-image" data-r85c-dish="' \+ esc\(recipeId\) \+ '" src="' \+ esc\(DISH_ART\[recipeId\]/, "成果卡用同一張成品圖");
});

/* ---------- 第 5 項（規則）：風吹白線的繪製層 ---------- */
test("5a 風吹白線不畫在天氣層（視口最上層），改畫在田野地面；省電與減少動態都有對應", () => {
  const html = read("index.html");
  assert.match(html, /#weatherLayer\.windy::before \{ background-image: none; animation: none; \}/, "天氣層不再畫白線");
  assert.doesNotMatch(html, /#weatherLayer\.windy::before \{ background-image: repeating-linear-gradient/, "舊的整片白線拿掉了");
  assert.match(html, /#mapScene\[data-weather="windy"\] #groundLayer::after \{ display: block; opacity: 1; background-image: repeating-linear-gradient\(12deg,/, "白線畫在地面層");
  assert.match(html, /html\.perf-low #mapScene\[data-weather="windy"\] #groundLayer::after \{ background-image: repeating-linear-gradient\(12deg,[^}]*animation: none; \}/, "省電模式：線少、不動");
  const reduced = html.slice(html.indexOf("#weatherLayer::before, #weatherLayer::after { animation: none !important; }"));
  assert.match(reduced.slice(0, 400), /#mapScene\[data-weather="windy"\] #groundLayer::after \{ animation: none !important; \}/, "減少動態時不動");
  /* 地面層在 #mapWorld 裡、在作物與角色那一層（#markerLayer）底下；介面都不在 #mapWorld 裡。 */
  const world = html.slice(html.indexOf('<div id="mapWorld">'), html.indexOf('<div id="weatherLayer"'));
  assert.ok(world.indexOf('id="groundLayer"') >= 0 && world.indexOf('id="groundLayer"') < world.indexOf('id="markerLayer"'), "地面層在物件層底下");
  for (const id of ["questDock", "sceneActionBar", "mobileControls", "worldMinimap", "toolBar"]) assert.ok(!world.includes('id="' + id + '"'), id + " 不在場景裡");
});

/* ---------- 第 6 項（規則）：截圖工具的畫面清單 ---------- */
test("6a 評審截圖工具：涵蓋計畫要的每個畫面；四尺寸預設；壞天氣留擴充點；檔名有序號", () => {
  const tool = require("./review-capture-r85.cjs"), ids = tool.SCENES.flatMap((sc) => sc.shots.map((sh) => sh.id));
  for (const want of ["first-minute", "first-minute-heirloom", "field-planted", "field-lit", "field-ripe", "field-harvested", "chores-sparrow", "story-conflict", "story-plant-order",
    "branch-plant-empty", "branch-plant-ripe", "branch-seal-relic", "branch-seal-decorated", "heirloom-collapsed", "heirloom-expanded", "market-choice", "festival-card", "festival-stall",
    "kitchen-list", "kitchen-fire", "journal", "map-minimap", "map-fit", "weather-rain", "weather-windy", "basket-seed", "basket-sun"]) assert.ok(ids.includes(want), "有拍 " + want);
  assert.equal(new Set(ids).size, ids.length, "每張的 id 不重複");
  for (const sc of tool.SCENES) for (const sh of sc.shots) { assert.ok(sh.title && sh.look && sh.look.length >= 8, sh.id + " 有畫面名稱與「該看什麼」"); assert.equal(typeof sh.run, "function"); }
  const src = read("scripts/review-capture-r85.cjs");
  assert.match(src, /DEFAULT_SIZES = \[\[1366, 768\], \[1366, 600\], \[390, 844\], \[844, 390\]\]/);
  assert.match(src, /async function badWeatherPlay\(page, weatherId\)/, "壞天氣小玩法的擴充點");
  assert.match(src, /"--disable-gpu"/, "軟體繪圖");
  assert.match(src, /String\(n\)\.padStart\(3, "0"\) \+ "-" \+ tag \+ "-" \+ shot\.id \+ "\.png"/, "檔名有序號");
  assert.match(src, /\| 序號 \| 尺寸 \| 畫面 \| 該看什麼 \| 檔名 \| 狀態 \|/, "index.md 欄位");
  assert.doesNotMatch(src, /fs\.(writeFileSync|copyFileSync|renameSync|rmSync|unlinkSync)\([^)]*opts\.root/, "工具不寫遊戲檔，只寫 --out");
});

/* ---------- 第 7 項：接線 ---------- */
test("7 接線：加進 unit 清單；樣式改在原有規則，不追加到 content-r58b.css 檔尾；版本字串沒動", () => {
  const guard = read("scripts/guard-validation-writes.js"), list = guard.slice(guard.indexOf("const unit=["), guard.indexOf("];", guard.indexOf("const unit=[")));
  assert.match(list, /"node scripts\/test-content-r85-art\.js",/);
  assert.doesNotMatch(read("src/content-r58b.css"), /\/\* ===== R85C/, "沒有新增 R85C 段落（改的是 R84C 原有那一條）");
  assert.match(read("sw.js"), /CACHE_VERSION = "content-r86-20261119-1"/, "版本字串由主控統一改");
});

/* ---------- 瀏覽器：四尺寸實拍 ---------- */
const VIEWS = [[1366, 768, false], [1366, 600, false], [390, 844, true], [844, 390, true]];
async function windCheck(page, tag) {
  /* 田邊小事會自己冒出來，先關掉，免得兩張截圖之間多了一隻麻雀。 */
  await page.evaluate(() => { const h = __rc85, s = h.reset(), t = Date.now(); h.level(s, 6); h.weather(s, "windy", t); for (const i of [0, 1, 2]) h.crop(s, i, "wheat", t, { wet: true, ago: 2000 }); h.noSun(s, t); const st = FarmWaitplay.normalize(s); st.active = null; h.done(s, { keepWeather: true }); h.focus(h.tile(1)); });
  await page.waitForTimeout(900);
  /* 加一條提示，看提示條上有沒有白線。 */
  /* 遊戲自己的提示可能正在淡出（半透明本來就看得到底下），先清掉，只留這一條穩定的。 */
  await page.evaluate(() => { __rc85.clean(); const z = document.querySelector("#toast-zone"); if (z) { const d = document.createElement("div"); d.className = "toast"; d.id = "r85cToast"; d.textContent = "晨光鎮廣播：河風轉暖，今天適合曬麥。"; z.appendChild(d); } __rc85.refocus(); });
  await page.waitForTimeout(500);
  const style = await page.evaluate(() => ({ layer: document.getElementById("weatherLayer").className, before: getComputedStyle(document.getElementById("weatherLayer"), "::before").backgroundImage, ground: getComputedStyle(document.getElementById("groundLayer"), "::after").backgroundImage, groundDisplay: getComputedStyle(document.getElementById("groundLayer"), "::after").display }));
  assert.equal(style.layer, "windy", tag + " 微風");
  assert.equal(style.before, "none", tag + " 天氣層沒有白線");
  assert.match(style.ground, /repeating-linear-gradient/, tag + " 白線在地面層"); assert.notEqual(style.groundDisplay, "none", tag + " 地面層的白線有顯示");
  /* 有白線（a）→ 把白線藏起來（b）→ 再放回來（a2）。只算 a 與 a2 一樣、但跟 b 不一樣的點，排掉兩張截圖之間自己在動的東西（提示倒數、角色）。 */
  const shot = async () => (await page.screenshot()).toString("base64");
  await page.evaluate(() => document.querySelectorAll("#toast-zone > :not(#r85cToast)").forEach((n) => n.remove()));
  const a = await shot();
  await page.evaluate(() => { const st = document.createElement("style"); st.id = "r85cHideWind"; st.textContent = "#weatherLayer::before,#groundLayer::after{visibility:hidden!important}"; document.head.appendChild(st); });
  await page.waitForTimeout(250);
  const b = await shot();
  await page.evaluate(() => document.getElementById("r85cHideWind").remove());
  await page.waitForTimeout(250);
  const a2 = await shot();
  const r = await page.evaluate(async ([a, b, a2]) => {
    const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = "data:image/png;base64," + s; });
    const [ia, ib, ia2] = await Promise.all([load(a), load(b), load(a2)]), c = document.createElement("canvas"); c.width = ia.width; c.height = ia.height; const g = c.getContext("2d");
    const px = (im) => { g.clearRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const da = px(ia), db = px(ib), da2 = px(ia2);
    const d3 = (p, q, k) => Math.abs(p[k] - q[k]) + Math.abs(p[k + 1] - q[k + 1]) + Math.abs(p[k + 2] - q[k + 2]);
    /* 看得出來的白線：同一點三個色版加起來差 40 以上（直接畫在草地上約 120；壓在九成不透明的面板下只剩十幾）。 */
    const count = (r) => { let n = 0; for (let y = Math.max(0, Math.floor(r.top)); y < Math.min(c.height, Math.ceil(r.bottom)); y++) for (let x = Math.max(0, Math.floor(r.left)); x < Math.min(c.width, Math.ceil(r.right)); x++) { const k = (y * c.width + x) * 4; if (d3(da, db, k) >= 40 && d3(da, da2, k) <= 6) n++; } return n; };
    const alpha = (e) => { const m = getComputedStyle(e).backgroundColor.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(",").map(Number); return p.length > 3 ? p[3] : 1; };
    /* 自己跟祖先的不透明度乘起來要九成五以上（淡入淡出中的東西本來就半透明，看得到底下的地面）。 */
    const opaque = (e) => { let o = 1; for (let n = e; n && n !== document.documentElement; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
    const shown = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 4 && r.height > 4 && s.visibility !== "hidden" && s.display !== "none" && opaque(e) >= 0.95 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; };
    const ui = [...document.querySelectorAll("#questDock, #sceneActionBar, #toolBar button, .res-bar > *, #mobileControls button, #worldMinimap, #r85cToast, #mapFitToggle, #smartAssistant")].filter((e) => !e.closest("#mapWorld") && shown(e));
    /* 場景裡的名牌、標籤：底色八成以上不透明的才算（半透明的名牌本來就看得到底下的草地）。 */
    const tags = [...document.querySelectorAll("#mapWorld [class*='label'], #mapWorld .npc-nameplate, #mapWorld .npc-footname, #mapWorld .r83c-chore-tag")].filter((e) => shown(e) && alpha(e) >= 0.8);
    /* 圓角外面那一小塊本來就是底下的草地：左右各內縮一個圓角半徑、上下內縮 2px（只量直邊之間、確定是面板本身的範圍）。 */
    const inner = (e) => { const r = e.getBoundingClientRect(), rad = Math.min(parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0, r.width / 2, r.height / 2); return { left: r.left + rad + 1, top: r.top + 2, right: r.right - rad - 1, bottom: r.bottom - 2 }; };
    const hits = [...ui, ...tags].map((e) => ({ who: (e.id || e.className || e.tagName).toString().slice(0, 40), n: count(inner(e)) })).filter((x) => x.n > 3);
    return { hits, ground: count({ left: 0, top: 0, right: c.width, bottom: c.height }), ui: ui.length, tags: tags.length };
  }, [a, b, a2]);
  assert.ok(r.ui >= 2, tag + " 量到介面 " + r.ui);
  assert.deepEqual(r.hits, [], tag + " 介面與名牌上看不到風吹白線 " + JSON.stringify(r));
  assert.ok(r.ground >= 400, tag + " 田野地面上有風吹白線 " + r.ground);
}
async function kitchenCheck(page, tag) {
  await page.evaluate(() => { const h = __rc85, s = h.reset(), t = Date.now(); h.main(s, "", t); Object.assign(s.storage.items, { wheat: 20, carrot: 12, tomato: 8, strawberry: 6, river_mint: 4, rainwater: 3 }); CookingR75.ensure(s, t); h.done(s); FarmWorld.openKitchen(); });
  await page.waitForFunction(() => { const imgs = [...document.querySelectorAll(".recipe-row[data-recipe] .r75b-pot-thumb")]; return imgs.length >= 10 && imgs.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 10000 });
  const m = await page.evaluate(() => [...document.querySelectorAll(".recipe-row[data-recipe]")].map((row) => { const i = row.querySelector(".r75b-pot-thumb"), r = i.getBoundingClientRect(); return { id: row.dataset.recipe, src: i.getAttribute("src").split("?")[0], nat: i.naturalWidth, w: r.width, dish: i.dataset.r85cDish, alt: i.alt }; }));
  assert.equal(m.length, 10, tag + " 十道料理");
  for (const row of m) { assert.equal(row.src, "assets/generated/content-r85/dish-" + row.id + ".png", tag + " " + row.id + " 用自己的成品圖"); assert.equal(row.nat, 64); assert.equal(row.dish, row.id); assert.ok(row.w >= 40, tag + " 縮圖看得到 " + row.w); assert.ok(row.alt && !/鍋子/.test(row.alt), tag + " 替代文字寫料理名 " + row.alt); }
  assert.equal(new Set(m.map((r) => r.src)).size, 10, tag + " 沒有兩道料理共用同一張圖");
  /* 成果卡：直接做一份，成品圖是這道料理。 */
  await page.evaluate(() => document.querySelector('[data-r75b-start="rustic_bread"]').click());
  await page.waitForFunction(() => document.querySelector(".r75b-cook-overlay [data-r75b-direct]"), null, { timeout: 6000 });
  await page.evaluate(() => document.querySelector(".r75b-cook-overlay [data-r75b-direct]").click());
  await page.waitForFunction(() => { const i = document.querySelector("[data-r76a-cook-result] img"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 6000 });
  const res = await page.evaluate(() => { const i = document.querySelector("[data-r76a-cook-result] img"); return { src: i.getAttribute("src").split("?")[0], nat: i.naturalWidth }; });
  assert.deepEqual(res, { src: "assets/generated/content-r85/dish-rustic_bread.png", nat: 64 }, tag + " 成果卡用同一張成品圖");
  await page.evaluate(() => { document.querySelector("[data-r76a-keep]")?.click(); __rc85.clean(); });
}
async function fieldCheck(page, tag) {
  for (const stage of ["order", "empty"]) {
    await page.evaluate((stage) => { const h = __rc85, s = h.reset(), t = Date.now(); if (stage === "order") h.story(s, t, "plant"); else { h.finishStory(s, t, "plant"); s.r82branches = { route: "plant", plant: {}, seal: {} }; StoryR76.r82Ensure(s, t); } h.done(s); h.focus(h.station("well")); }, stage);
    await page.waitForTimeout(700);
    await page.waitForFunction(() => { const i = document.querySelector('.r78c-scene-change[data-r78c-route="r81c_story:plant"] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 });
    const m = await page.evaluate(() => { const n = document.querySelector('.r78c-scene-change[data-r78c-route="r81c_story:plant"]'), i = n.querySelector("img"), T = parseFloat(document.querySelector(".gtile").style.width), r = n.getBoundingClientRect(), ir = i.getBoundingClientRect(); return { src: i.getAttribute("src").split("?")[0], field: n.dataset.r84cField, T, w: r.width, h: r.height, iw: ir.width, ih: ir.height, nat: i.naturalWidth }; });
    const want = stage === "order" ? "tilled" : "seedbag";
    assert.equal(m.src, "assets/generated/content-r85/blue-cloth-wheat-field-" + want + ".png", tag + " " + stage + " 用同一套田圖");
    assert.equal(m.field, "2x2"); assert.equal(m.nat, 192);
    assert.ok(m.iw >= 1.9 * m.T && m.ih >= 1.9 * m.T, tag + " " + stage + " 圖撐滿 2×2（跟分支階段一樣大）" + JSON.stringify(m));
  }
}
async function basketCheck(page, tag) {
  const seen = {};
  for (const key of ["seed", "sun"]) {
    await page.evaluate((key) => { const h = __rc85, s = h.reset(), now = Date.now(); AdventureAPI.ensure(s, now); AdventureAPI.resolveMainStoryChoice(s, "mayor", "farm", now); ChoicesR77.act(s, "mayor", now + 1); ChoicesR77.act(s, "mayor", now + 2, key); h.done(s); h.clean(); h.focus(h.station("sign")); }, key);
    await page.waitForFunction(() => { const i = document.querySelector('.r78c-scene-change[data-r78c-route="mayor:farm"] img:not(.r80c-decision-badge)'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 });
    seen[key] = await page.evaluate(() => { const i = document.querySelector('.r78c-scene-change[data-r78c-route="mayor:farm"] img:not(.r80c-decision-badge)'), r = i.getBoundingClientRect(); return { src: i.getAttribute("src").split("?")[0], w: r.width, badge: !!document.querySelector('.r78c-scene-change[data-r78c-route="mayor:farm"] img.r80c-decision-badge') }; });
    assert.equal(seen[key].src, "assets/generated/content-r85/decision-mayor-farm-" + key + ".png", tag + " " + key + " 地圖物件用新圖");
    assert.equal(seen[key].badge, false, tag + " 圖到了就不疊小圖示");
  }
}
async function browserChecks() {
  const tool = require("./review-capture-r85.cjs");
  let chromium; try { ({ chromium } = require("playwright")); } catch (_) { throw Error("playwright 不可用"); }
  const server = await tool.serve(ROOT, 0), origin = "http://127.0.0.1:" + server.address().port, browser = await tool.launch(chromium); let checks = 0;
  try {
    for (const [width, height, mobile] of VIEWS) {
      const tag = width + "x" + height;
      const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", reducedMotion: "reduce" });
      const page = await context.newPage(), errors = []; page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(origin);
      await page.waitForFunction(() => window.__farm && window.AdventureAPI && window.StoryR76 && window.ChoicesR77 && window.CookingR75 && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading"), null, { timeout: 45000 });
      await page.evaluate(() => document.querySelector("#worldBegin")?.click()); await page.waitForTimeout(400);
      await page.evaluate(tool.installHelpers); await page.evaluate(() => __rc85.snapshot());
      await kitchenCheck(page, tag); checks++;
      await fieldCheck(page, tag); checks++;
      await basketCheck(page, tag); checks++;
      await windCheck(page, tag); checks++;
      assert.deepEqual(errors, [], tag + " 沒有頁面錯誤");
      await context.close();
    }
  } finally { await browser.close(); server.close(); }
  return checks;
}
/* 截圖工具在四尺寸各跑一小組（自己挑空埠、輸出到系統暫存資料夾，跑完刪掉）。 */
function captureSmoke() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "r85-capture-"));
  try {
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, "review-capture-r85.cjs"), "--out", out, "--port", "0", "--only", "first-minute,kitchen-list,weather-windy,basket-seed"], { encoding: "utf8", windowsHide: true, timeout: 600000 });
    assert.equal(r.status, 0, "截圖工具結束碼 0\n" + (r.stdout || "").slice(-2000) + (r.stderr || "").slice(-2000));
    const files = fs.readdirSync(out).filter((f) => f.endsWith(".png")).sort();
    assert.equal(files.length, 16, "四個畫面 × 四個尺寸 " + files.join(","));
    files.forEach((f, i) => assert.match(f, new RegExp("^" + String(i + 1).padStart(3, "0") + "-\\d+x\\d+-[a-z-]+\\.png$"), "檔名有序號 " + f));
    for (const size of ["1366x768", "1366x600", "390x844", "844x390"]) assert.equal(files.filter((f) => f.includes("-" + size + "-")).length, 4, size + " 四張");
    const md = fs.readFileSync(path.join(out, "index.md"), "utf8");
    assert.match(md, /\| 序號 \| 尺寸 \| 畫面 \| 該看什麼 \| 檔名 \| 狀態 \|/);
    assert.equal((md.match(/^\| 0\d\d \| /gm) || []).length, 16, "index.md 每張一列");
    assert.doesNotMatch(md, /\*\*要看\*\*/, "沒有不是預期畫面的");
    for (const f of files) assert.ok(fs.statSync(path.join(out, f)).size > 20000, f + " 不是空白圖");
    return files.length;
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
}

(async () => {
  for (const [name, fn] of pending) { try { await fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
  try { const checks = await browserChecks(); passed++; console.log(`PASS 5b 實拍 ${VIEWS.map((v) => v[0] + "×" + v[1]).join("、")}：料理各有成品圖、藍布老麥田同一套 2×2、種子籃新圖、風吹白線只在地面（${checks} 組）`); }
  catch (error) { console.error("FAIL 5b 實拍\n" + error.stack); process.exitCode = 1; }
  try { const n = captureSmoke(); passed++; console.log(`PASS 6b 評審截圖工具四尺寸實跑：${n} 張、序號與 index.md 正確`); }
  catch (error) { console.error("FAIL 6b 評審截圖工具\n" + error.stack); process.exitCode = 1; }
  if (!process.exitCode) console.log(`R85C art: ${passed} passed`);
})();
