"use strict";
/* R66 B 線驗收（計畫第 5～6 項）：
   5 三個中期設施（蜂箱、香草小圃、雞舍餵食槽）：Lv 2 可建、各 ≤ 50 金、產出時間、地圖顯示、收取；
   6 四位鄰居專屬互動：鎮長每日委託、班伯請教種田、蘿拉今日特價、圖圖的寶藏（每日一次與獎勵）。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
require("../src/config.js");
const C = require("../src/config.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const M = require("../src/midgame-r66.js");
const T0 = 1794172800000;
const DAY = 24 * 60 * 60 * 1000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (e) { console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; } }
function fresh(level, coins) {
  const st = S.defaultState(T0);
  st.level = level == null ? 2 : level;
  st.coins = coins == null ? 200 : coins;
  M.ensure(st, T0);
  return st;
}
function freeTile(st) { return st.map.tiles.find((t) => G.canBuildOn(st, t)); }

test("1 三設施定義：Lv 2 解鎖、各不超過 50 金、產出與時間寫清楚", () => {
  const rows = M.facilityStatus(fresh(), T0);
  assert.deepEqual(rows.map((r) => r.name), ["蜂箱", "香草小圃", "雞舍餵食槽"]);
  for (const r of rows) {
    assert.equal(r.unlockLevel, 2, r.name);
    assert.ok(r.costCoins > 0 && r.costCoins <= 50, `${r.name} 要在 50 金以內`);
    assert.equal(C.BUILDINGS[r.type].unlockLevel, 2, r.name + " 建造定義等級");
    assert.equal(C.BUILDINGS[r.type].cost.coins, r.costCoins, r.name + " 價格單一來源");
  }
  assert.equal(M.FACILITIES.r66_beehive.intervalMs, 3 * 60 * 1000);
  assert.equal(M.FACILITIES.r66_herb_garden.intervalMs, 4 * 60 * 1000);
  assert.match(M.FACILITIES.r66_beehive.produceText, /3 分鐘/);
  assert.match(M.FACILITIES.r66_herb_garden.produceText, /4 分鐘/);
  assert.match(M.FACILITIES.r66_feed_trough.produceText, /多 1 顆/);
  assert.doesNotMatch(JSON.stringify(M.FACILITIES), /\d+m\b|Lv\d/, "玩家文字不可夾英文縮寫");
});

test("2 建造：Lv 1 不可建、Lv 2 扣對金幣占地、重複與缺金被擋", () => {
  const low = fresh(1, 200);
  assert.equal(M.buildFacility(low, "r66_beehive", freeTile(low).id, T0).ok, false);
  const st = fresh(2, 200);
  const tile = freeTile(st);
  const r = M.buildFacility(st, "r66_beehive", tile.id, T0);
  assert.equal(r.ok, true);
  assert.equal(st.coins, 160);
  assert.equal(G.getTileById(st, tile.id).buildingId, r.building.id, "建好後要占住地圖那一格");
  assert.equal(M.buildFacility(st, "r66_beehive", freeTile(st).id, T0).reason, "built");
  const poor = fresh(2, 10);
  assert.equal(M.buildFacility(poor, "r66_herb_garden", freeTile(poor).id, T0).ok, false);
  assert.equal(poor.coins, 10, "失敗不可扣金");
  const migrated = S.migrate(JSON.parse(JSON.stringify(st)));
  assert.ok(migrated.buildings.some((b) => b.type === "r66_beehive"), "舊存檔遷移要保留新設施");
});

test("3 蜂箱每 3 分鐘、香草小圃每 4 分鐘產出，可收取且餘數保留", () => {
  const st = fresh();
  M.buildFacility(st, "r66_beehive", freeTile(st).id, T0);
  M.buildFacility(st, "r66_herb_garden", freeTile(st).id, T0);
  assert.equal(M.collectFacility(st, "r66_beehive", T0 + 2 * 60 * 1000).ok, false, "未滿 3 分鐘不可收");
  const honey = M.collectFacility(st, "r66_beehive", T0 + 3 * 60 * 1000);
  assert.equal(honey.ok, true); assert.equal(honey.added, 1); assert.equal(st.storage.items.honey, 1);
  assert.equal(M.collectFacility(st, "r66_herb_garden", T0 + 3 * 60 * 1000).ok, false, "薄荷要 4 分鐘");
  const mint = M.collectFacility(st, "r66_herb_garden", T0 + 9 * 60 * 1000);
  assert.equal(mint.added, 2); assert.equal(st.storage.items.river_mint, 2);
  const status = M.facilityStatus(st, T0 + 9 * 60 * 1000).find((r) => r.type === "r66_herb_garden");
  assert.equal(status.ready, false);
  assert.ok(status.nextInMs > 0 && status.nextInMs <= 4 * 60 * 1000);
  assert.equal(M.facilityStatus(st, T0 + 12 * 60 * 1000).find((r) => r.type === "r66_beehive").pending, 3);
});

test("4 雞舍餵食槽：每次收雞蛋多 1 顆，沒蓋時不多", () => {
  const collectEggs = (withTrough) => {
    const st = fresh(3, 300);
    if (withTrough) assert.equal(M.buildFacility(st, "r66_feed_trough", freeTile(st).id, T0).ok, true);
    const chicken = st.animals.find((a) => a.type === "chicken");
    const r = G.collectAnimal(st, chicken.id, T0 + 6 * 60 * 1000);
    assert.equal(r.ok, true);
    return r;
  };
  assert.equal(collectEggs(false).added, 1);
  const boosted = collectEggs(true);
  assert.equal(boosted.added, 2);
  assert.equal(boosted.eggBonus, 1);
  assert.equal(M.eggBonusActive(fresh()), false);
});

test("5 鎮長每日委託：指定作物、獎勵較高、交付扣貨、每日一次、跨日刷新", () => {
  const st = fresh();
  const q = M.mayorQuest(st, T0);
  assert.ok(q.cropId && q.qty >= 2);
  assert.ok(q.rewardCoins >= q.qty * (C.CROPS[q.cropId].sellValue * 2), "委託獎勵要比一般行情高");
  st.storage.items[q.cropId] = q.qty;
  const coinsBefore = st.coins;
  const done = M.deliverMayorQuest(st, T0);
  assert.equal(done.ok, true);
  assert.equal(st.coins, coinsBefore + q.rewardCoins);
  assert.equal(st.storage.items[q.cropId] || 0, 0);
  assert.equal(M.deliverMayorQuest(st, T0).reason, "daily_limit");
  const next = M.mayorQuest(st, T0 + DAY);
  assert.equal(next.claimed, false);
  assert.notEqual(next.day, q.day);
});

test("6 班伯請教種田：每天一次、當天成長加成真的生效、跨日可再問", () => {
  const st = fresh();
  const before = G.effectiveGrowMs(st, "wheat", T0);
  const r = M.askElderAdvice(st, T0);
  assert.equal(r.ok, true);
  assert.equal(M.askElderAdvice(st, T0 + 1000).reason, "daily_limit");
  const after = G.effectiveGrowMs(st, "wheat", T0);
  assert.ok(after < before, `請教後成長要變快（${before}→${after}）`);
  assert.equal(M.elderAdvice(st, T0).active, true);
  assert.equal(M.askElderAdvice(st, T0 + DAY).ok, true, "跨日可再請教");
});

test("7 蘿拉今日特價：每天一樣、半價、買了給種子包", () => {
  const st = fresh();
  const deal = M.merchantSpecial(st, T0);
  assert.ok(deal.cropId);
  assert.ok(deal.specialPrice < deal.normalPrice, "特價要比原價便宜");
  assert.equal(deal.specialPrice, Math.max(1, Math.floor(deal.normalPrice / 2)));
  const coinsBefore = st.coins;
  const bought = M.buyMerchantSpecial(st, T0);
  assert.equal(bought.ok, true);
  assert.equal(st.coins, coinsBefore - deal.specialPrice);
  assert.equal(st.adventure.r58.r59.seedPacks[deal.cropId], 1, "特價買到的是種子包");
  assert.equal(M.merchantSpecial(st, T0 + DAY).day, M.merchantSpecial(st, T0 + DAY).day);
  assert.notEqual(M.merchantSpecial(st, T0 + DAY).day, deal.day);
});

test("8 圖圖的寶藏：藏在地圖某格、找錯不給、找到給小禮物、每日一次", () => {
  const st = fresh();
  const info = M.treasureInfo(st, T0);
  const tile = st.map.tiles.find((t) => t.id === info.tileId);
  assert.ok(tile, "寶藏要在真的地圖格上");
  assert.equal(M.findTreasure(st, "t0_0", T0).ok, false, "找錯地方不可給獎");
  assert.equal(st.adventure.r66b.treasure.found, false);
  const coinsBefore = st.coins;
  const found = M.findTreasure(st, info.tileId, T0);
  assert.equal(found.ok, true);
  assert.equal(st.coins, coinsBefore + M.TREASURE_REWARD_COINS);
  assert.equal(st.adventure.r58.r59.seedPacks.wheat, 1);
  assert.equal(M.findTreasure(st, info.tileId, T0).reason, "daily_limit");
  assert.equal(M.treasureInfo(st, T0 + DAY).found, false, "跨日重新藏");
});

test("9 接線：新檔掛進首頁與快取、素材存在、CSS 標 R66B、版本不動、不碰 A 線", () => {
  const index = fs.readFileSync("index.html", "utf8");
  assert.match(index, /src\/midgame-r66\.js\?v=content-r84-20261117-1/, "首頁要載入新模組且不換版本");
  assert.ok(index.indexOf("src/midgame-r66.js") > index.indexOf("src/neighbors-r61.js"), "要在鄰居模組之後載入");
  const sw = fs.readFileSync("sw.js", "utf8");
  assert.match(sw, /versioned\("\.\/src\/midgame-r66\.js"\)/, "快取清單要有新模組");
  assert.match(sw, /CACHE_VERSION = "content-r84-20261117-1"/, "不可改快取版本");
  for (const art of ["beehive.svg", "herb-garden.svg", "feed-trough.svg", "treasure.svg"]) {
    assert.ok(fs.existsSync("assets/generated/content-r66/" + art), art + " 要存在");
    assert.match(sw, new RegExp("content-r66/" + art.replace(".", "\\.")), art + " 要進快取清單");
    const svg = fs.readFileSync("assets/generated/content-r66/" + art, "utf8");
    assert.match(svg, /shape-rendering="crispEdges"/, art + " 要是像素風");
  }
  const css = fs.readFileSync("src/content-r58b.css", "utf8");
  assert.match(css, /R66B/, "CSS 要標 R66B");
  assert.match(css, /\.r66b-map-node/, "地圖設施要有樣式");
  assert.match(css, /\.r66b-ready-badge/, "可收取標示要有樣式");
  const src = fs.readFileSync("src/midgame-r66.js", "utf8");
  assert.match(src, /MidgameR66/, "要暴露新模組介面");
  assert.match(src, /可收取/, "地圖要有可收取標示");
  assert.doesNotMatch(src, /src\/adventure\.js.*(改|覆寫)/, "不可動 A 線邏輯");
  const cfg = fs.readFileSync("src/config.js", "utf8");
  assert.match(cfg, /BUILDING_ORDER = \["compostHeap", "silo"/, "既有建造順序開頭不可被新設施改變");
});

test("10 整合：特價一定比原價划算（原價 1 金的種子改買一送一）", () => {
  const st = fresh(1, 50);
  const deal = M.merchantSpecial(st, T0);
  const perPack = deal.specialPrice / (deal.packsPerBuy || 1);
  assert.ok(perPack < deal.normalPrice, `每包 ${perPack} 金應低於原價 ${deal.normalPrice} 金`);
  const before = (st.adventure.r58.r59.seedPacks[deal.cropId] || 0);
  assert.equal(M.buyMerchantSpecial(st, T0).ok, true);
  assert.equal(st.adventure.r58.r59.seedPacks[deal.cropId] - before, deal.packsPerBuy || 1);
});

console.log(`VERIFIED content R66 midgame (${passed}/10)`);
if (process.exitCode) process.exit(1);
