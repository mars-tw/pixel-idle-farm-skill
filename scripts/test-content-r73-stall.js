"use strict";
/* R73B（第 3～5 項）：擺攤叫賣商品卡圖示與口味標籤、背包模式逐項判斷、
   開始與結算星等門檻與結算一句建議、開始叫賣關閉祭典攤位視窗。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const S = require("../src/state.js");
const A = require("../src/adventure.js");
const C = require("../src/config.js");
const F = require("../src/festival-stall-r72.js");
const T0 = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (e) { console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; } }
function seeded(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function freshFestival(level) {
  const st = S.defaultState(T0);
  A.ensure(st, T0);
  st.level = level || 1;
  const f = st.adventure.r61.festival;
  f.unlocked = true; f.startsAt = T0; f.endsAt = T0 + 10 * 60 * 1000; f.nextAt = 0;
  f.baseline = { wheat: 0, tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } };
  f.supportProvisioned = true; f.harvestCrop = "wheat"; f.harvestRequired = 3;
  F.ensure(st, T0);
  return st;
}
function forceItemDemand(session, itemId, now) {
  const pool = session.pool.find((row) => row.id === itemId);
  assert.ok(pool, "測試指定的物品要在池裡：" + itemId);
  session.customer = { npcId: "mayor", npcName: "鎮長葛瑞", demand: { kind: "item", itemId, label: "我要" + pool.name }, startedAt: now, readyAt: now, expiresAt: now + F.CUSTOMER_TIMEOUT_MS };
  return session.customer;
}

test("商品卡資料：池內每項都有像素圖示檔案與口味標籤欄位", () => {
  const st = freshFestival(8);
  const rows = F.unlockedItems(st);
  assert.ok(rows.length >= 10, "高等級物品池要有足夠品項");
  for (const row of rows) {
    assert.ok(row.icon, row.id + " 要有圖示路徑");
    assert.ok(fs.existsSync(row.icon), "圖示檔案要存在：" + row.icon);
    assert.ok(Array.isArray(row.tasteLabels), row.id + " 要有口味標籤欄位");
    const card = F.itemCard(st, row);
    assert.equal(card.icon, row.icon);
    assert.deepEqual(card.tasteLabels, row.tasteLabels);
  }
  // 作物沿用既有 r66 原生像素圖
  assert.equal(F.iconFor("wheat", "crop"), "assets/generated/r66/native/crop_wheat-32.png");
  assert.equal(F.iconFor("bell_pepper", "crop"), "assets/generated/r66/native/crop_bell_pepper-32.png");
});

test("缺圖品項的像素圖：產品、採集、料理都有 content-r73 圖檔與 manifest", () => {
  const ids = ["egg", "milk", "wool", "honey", "duck_egg",
    "forest_herb", "glow_mushroom", "wild_berry", "river_mint", "fallen_branch", "mooncap_spore", "amber_resin", "forest_chestnut", "frost_cherry",
    "rustic_bread", "baked_carrot", "wheat_carrot_pancake", "carrot_wheat_stew", "bamber_rain_soup", "tomato_harvest_stew", "strawberry_market_tart", "carrot_trail_soup", "riverside_harvest_platter", "mint_tea"];
  for (const id of ids) {
    const kind = id === "rustic_bread" || A.recipes(freshFestival(1)).some((r) => r.id === id) ? "meal" : "product";
    const icon = F.iconFor(id, kind);
    assert.ok(fs.existsSync(icon), "缺圖：" + icon);
  }
  const manifest = JSON.parse(fs.readFileSync("assets/generated/content-r73/manifest.json", "utf8"));
  assert.match(String(manifest.model || manifest.tool || ""), /muse/i, "manifest 要註明產生模型");
  assert.ok(manifest.files.length >= 24);
  for (const row of manifest.files) assert.ok(fs.existsSync("assets/generated/content-r73/" + row.file), "manifest 缺圖：" + row.file);
});

test("口味標籤：甜、酸、清爽、熱熱的在代表品項上一眼可推", () => {
  const st = freshFestival(8);
  const byId = Object.fromEntries(F.unlockedItems(st).map((row) => [row.id, row]));
  assert.ok(byId.strawberry.tasteLabels.includes("甜"), "草莓要標甜");
  assert.ok(byId.tomato.tasteLabels.includes("酸"), "番茄要標酸");
  assert.ok(byId.radish.tasteLabels.includes("清爽"), "櫻桃蘿蔔要標清爽");
  // R73 整合同步：評審指出生小麥標「熱熱的」不合理，改為不給口味；「熱熱的」由料理（例如農家麥餅）代表
  assert.deepEqual(byId.wheat.tasteLabels, [], "生小麥不給口味標籤");
  assert.ok(F.tasteLabelsOf({ id: "rustic_bread", kind: "meal", tastes: F.tastesOf("rustic_bread", "meal") }).includes("熱熱的"), "農家麥餅要標熱熱的");
  assert.deepEqual(F.tasteLabelsOf({ id: "mint_tea", kind: "meal", tastes: F.tastesOf("mint_tea", "meal") }), ["清爽"]);
  const js = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  assert.match(js, /r73b-taste/, "商品卡要渲染口味標籤");
  assert.match(js, /r73b-item-icon/, "商品卡要渲染物品圖示");
  assert.match(js, /data-r73b-tastes/, "商品卡要帶口味資料");
});

test("逐項判斷：有貨扣背包、沒貨用代幣，代幣那格不影響其他格繼續扣背包", () => {
  const st = freshFestival(3); st.upgrades.plotCount = 1;
  st.storage.items = { wheat: 2, carrot: 0 };
  const s = F.startSession(st, T0, seeded(73)).session;
  const wheat = s.pool.find((row) => row.id === "wheat");
  const carrot = s.pool.find((row) => row.id === "carrot");
  assert.ok(wheat && carrot, "池裡要有小麥與胡蘿蔔");
  assert.equal(F.itemMode(st, wheat), "stock");
  assert.equal(F.itemMode(st, carrot), "token");
  assert.equal(F.itemCard(st, carrot).usesToken, true);
  assert.equal(F.itemCard(st, wheat).usesToken, false);
  // 沒貨的胡蘿蔔用代幣答對，不扣背包
  forceItemDemand(s, "carrot", T0);
  let r = F.serve(st, s, "carrot", T0 + 1000);
  assert.equal(r.ok, true); assert.equal(r.usesToken, true); assert.equal(r.mode, "token");
  assert.equal(st.storage.items.wheat, 2, "用代幣的那格不得扣其他物品");
  // 之後有貨的小麥仍要扣背包（舊整場模式會被代幣那格拖成整場代幣）
  forceItemDemand(s, "wheat", T0 + 1000);
  r = F.serve(st, s, "wheat", T0 + 2000);
  assert.equal(r.ok, true); assert.equal(r.usesToken, false); assert.equal(r.mode, "stock");
  assert.equal(st.storage.items.wheat, 1, "有貨的格子要繼續扣背包");
  // 小麥用完後逐項變代幣
  forceItemDemand(s, "wheat", T0 + 2000);
  F.serve(st, s, "wheat", T0 + 3000);
  assert.equal(st.storage.items.wheat || 0, 0);
  forceItemDemand(s, "wheat", T0 + 3000);
  r = F.serve(st, s, "wheat", T0 + 4000);
  assert.equal(r.usesToken, true, "這一格用完後才逐項改用代幣");
});

test("介面不再寫整場模式：不出現整場模式字樣，逐格標示沒貨用代幣", () => {
  const js = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  assert.doesNotMatch(js, /代幣模式|背包模式/, "頂部不得再寫整場模式");
  assert.match(js, /沒貨，用代幣/, "只有沒貨的那一格標用代幣");
  assert.match(js, /data-r73b-mode/, "每一格要帶自己的模式");
});

test("星等門檻：開始與結算都顯示 60／140／240，數字與 starsForScore 一致", () => {
  assert.deepEqual(F.STAR_THRESHOLDS, [{ stars: 1, score: 60 }, { stars: 2, score: 140 }, { stars: 3, score: 240 }]);
  assert.equal(F.starsForScore(59), 0); assert.equal(F.starsForScore(60), 1);
  assert.equal(F.starsForScore(139), 1); assert.equal(F.starsForScore(140), 2);
  assert.equal(F.starsForScore(239), 2); assert.equal(F.starsForScore(240), 3);
  assert.match(F.starThresholdText(), /60/); assert.match(F.starThresholdText(), /140/); assert.match(F.starThresholdText(), /240/);
  const js = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  const startSeg = js.slice(js.indexOf("function renderStart"), js.indexOf("function renderClock"));
  const resultSeg = js.slice(js.indexOf("function renderResult"));
  assert.match(startSeg, /data-r73b-thresholds/, "開始畫面要顯示星等門檻");
  assert.match(resultSeg, /data-r73b-thresholds/, "結算要顯示星等門檻");
});

test("結算只留一句建議：advice 恰一句，結算畫面只有一個建議段落", () => {
  for (const score of [0, 59, 60, 100, 139, 140, 200, 239, 240, 300]) {
    const advice = F.adviceFor({ score, stars: F.starsForScore(score) });
    assert.equal((advice.match(/。/g) || []).length, 1, "建議只能一句：" + advice);
  }
  assert.match(F.adviceFor({ score: 100, stars: 1 }), /再多 40 分就能拿到2顆星/);
  const st = freshFestival(1); st.storage.items = { wheat: 99 };
  const s = F.startSession(st, T0, seeded(74)).session; s.score = 100;
  const result = F.finishSession(st, s, T0 + 60000);
  assert.equal(result.advice, F.adviceFor(result), "結算結果要帶一句建議");
  const js = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  const resultSeg = js.slice(js.indexOf("function renderResult"));
  assert.equal((resultSeg.match(/data-r73b-advice/g) || []).length, 1, "結算畫面只能有一個建議段落");
  assert.doesNotMatch(resultSeg, /r72b-desc">\$\{esc\(result\.message\)\}/, "不得再重複顯示結算說明");
});

test("視窗不疊加：開始叫賣關閉祭典攤位視窗，回到攤位時再開", () => {
  const js = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  assert.match(js, /options\.onStart/, "開始成功時要通知外層關窗");
  assert.match(js, /options\.onReturnToStall/, "回到攤位時要通知外層開窗");
  assert.match(world, /onStart: \(\) => \{ if \(farm\(\) && farm\(\)\.closeModal\) farm\(\)\.closeModal\("worldModal"\)/, "開始叫賣要關閉祭典攤位視窗");
  assert.match(world, /onReturnToStall: \(\) => openFestivalStallPanel\(\)/, "結算回攤位要重開祭典攤位視窗");
  assert.match(world, /function openFestivalStallPanel/, "攤位視窗開啟要抽成可重用函式");
});

test("接線與樣式：R73B 樣式、CSS 大括號平衡", () => {
  const css = fs.readFileSync("src/content-r58b.css", "utf8");
  assert.match(css, /R73B/);
  assert.match(css, /\.r73b-item-icon/);
  assert.match(css, /\.r73b-taste/);
  let open = 0, close = 0; for (const ch of css) { if (ch === "{") open++; if (ch === "}") close++; }
  assert.equal(open, close, "content-r58b.css 大括號要平衡");
});

console.log("VERIFIED content R73B stall (" + passed + " tests)");
