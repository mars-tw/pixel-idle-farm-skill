"use strict";
/* R75B 第 8 項：三個開場選擇各留下一個看得見、一直有效的差異，加上舊存檔補發與手札「我做過的選擇」。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
const A = require("../src/adventure.js");
const S = require("../src/state.js");
const M = require("../src/midgame-r66.js");
const K = require("../src/cooking-r75.js");
const T0 = 1794172800000;
const DAY = 24 * 60 * 60 * 1000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (e) { console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; } }
function fresh(level) {
  const st = S.defaultState(T0);
  st.level = level == null ? 3 : level;
  st.coins = 500;
  A.ensure(st, T0);
  M.ensure(st, T0);
  return st;
}
function choose(st, npcId, choiceId) {
  const r = A.resolveMainStoryChoice(st, npcId, choiceId, T0);
  assert.equal(r.ok, true, npcId + "/" + choiceId + ": " + JSON.stringify(r));
  return r;
}

test("1 鎮長選種田：看得見種子袋，每天送 1 包小麥種子（同一天不重複）", () => {
  const st = fresh();
  choose(st, "mayor", "farm");
  assert.equal(K.seedBagVisible(st), true);
  assert.equal(K.hasEffect(st, "mayor_daily_seed"), true);
  const before = st.adventure.r58.r59.seedPacks.wheat || 0;
  const first = K.dailyPerks(st, T0);
  assert.equal(first.claimed.length, 1);
  assert.equal(st.adventure.r58.r59.seedPacks.wheat, before + 1);
  const again = K.dailyPerks(st, T0 + 1000);
  assert.equal(again.claimed.length, 0, "同一天不能重複領");
  assert.equal(st.adventure.r58.r59.seedPacks.wheat, before + 1);
  const nextDay = K.dailyPerks(st, T0 + DAY);
  assert.equal(nextDay.claimed.length, 1, "隔天再送 1 包");
  assert.equal(st.adventure.r58.r59.seedPacks.wheat, before + 2);
});

test("2 鎮長選聽鎮上的事：每日委託金幣多一成，委託卡寫明原因", () => {
  const plain = fresh();
  const base = M.mayorQuest(plain, T0);
  const st = fresh();
  choose(st, "mayor", "town");
  const boosted = M.mayorQuest(st, T0);
  assert.equal(boosted.bonusApplied, true);
  assert.match(boosted.bonusText, /先聽鎮長說鎮上的事/);
  assert.equal(boosted.rewardCoins, Math.round(boosted.baseRewardCoins * 1.1));
  assert.ok(boosted.rewardCoins > base.rewardCoins || boosted.baseRewardCoins === base.baseRewardCoins, "多一成後要比原本多（或同額進位）");
  /* 鄰居面板的委託卡也要看到原因與加成後金額 */
  const panel = M.neighborPanel(st, T0).find((row) => row.npcId === "mayor");
  assert.match(panel.detail, /先聽鎮長說鎮上的事/);
  st.storage.items[boosted.cropId] = boosted.qty;
  const coinsBefore = st.coins;
  const done = M.deliverMayorQuest(st, T0);
  assert.equal(done.ok, true);
  assert.equal(done.rewardCoins, boosted.rewardCoins, "交付真的拿到多一成的金幣");
  assert.equal(st.coins, coinsBefore + boosted.rewardCoins);
});

test("3 班伯選先賣一小袋：班伯的河畔委託金幣多一成", () => {
  const plain = fresh();
  const baseRow = A.commissions(plain, T0).find((row) => row.id === "elder_supper");
  const st = fresh();
  st.adventure.claimed.c1_first_harvest = true;
  A.ensure(st, T0);
  choose(st, "elder", "sell");
  const row = A.commissions(st, T0).find((entry) => entry.id === "elder_supper");
  assert.equal(row.choiceBonusRate, 0.1);
  assert.match(row.choiceBonusText, /先賣了一小袋/);
  assert.equal(row.reward.coins, Math.round(baseRow.reward.coins * 1.1), baseRow.reward.coins + " 的一成");
  /* 真的交付時拿到加成後的金幣 */
  st.adventure.projects.fishing_dock = { restored: true, restoredAt: T0 };
  A.ensure(st, T0);
  st.adventure.catch.river_carp = 2;
  st.adventure.meals.rustic_bread = 1;
  const coinsBefore = st.coins;
  const done = A.deliverCommission(st, "elder_supper", T0);
  assert.equal(done.ok, true, JSON.stringify(done));
  assert.equal(st.coins, coinsBefore + row.reward.coins);
  const other = A.commissions(fresh(), T0).find((entry) => entry.id === "elder_supper");
  assert.equal(other.reward.coins, baseRow.reward.coins, "沒選的人金額不變");
});

test("4 班伯選先留種子：每天請教時多拿 1 包當季種子", () => {
  const st = fresh();
  st.adventure.claimed.c1_first_harvest = true;
  A.ensure(st, T0);
  choose(st, "elder", "seed");
  const seasonCrop = K.seasonalCropId(st);
  const before = st.adventure.r58.r59.seedPacks[seasonCrop] || 0;
  const r = M.askElderAdvice(st, T0);
  assert.equal(r.ok, true);
  assert.ok(r.seasonalSeed, "請教時要多給當季種子");
  assert.equal(r.seasonalSeed.cropId, seasonCrop);
  assert.equal(st.adventure.r58.r59.seedPacks[seasonCrop], before + 1);
  assert.match(r.message, /多給你 1 包/);
  assert.equal(M.askElderAdvice(st, T0 + 1000).reason, "daily_limit", "同一天不能重複請教領種子");
  const plain = fresh();
  const plainResult = M.askElderAdvice(plain, T0);
  assert.equal(plainResult.seasonalSeed, null, "沒選留種子的人不另外給");
});

test("5 蘿拉選掛牌：入口招牌看得見，蘿拉的河畔委託金幣多一成", () => {
  const st = fresh();
  st.adventure.claimed.c1_homecoming = true;
  A.ensure(st, T0);
  choose(st, "merchant", "sign");
  assert.equal(K.farmSignVisible(st), true, "招牌要立起來");
  const plainRow = A.commissions(fresh(), T0).find((row) => row.id === "river_market");
  const row = A.commissions(st, T0).find((entry) => entry.id === "river_market");
  assert.equal(row.choiceBonusRate, 0.1);
  assert.equal(row.reward.coins, Math.round(plainRow.reward.coins * 1.1));
  st.adventure.projects.fishing_dock = { restored: true, restoredAt: T0 };
  A.ensure(st, T0);
  st.adventure.catch.river_carp = 2;
  const coinsBefore = st.coins;
  const done = A.deliverCommission(st, "river_market", T0);
  assert.equal(done.ok, true, JSON.stringify(done));
  assert.equal(st.coins, coinsBefore + row.reward.coins);
});

test("6 蘿拉選先聽客人：今日特價從一樣變兩樣，第二樣買得到", () => {
  const plain = fresh();
  assert.equal(M.merchantSpecial(plain, T0).deals.length, 1, "沒選的人只有一樣特價");
  const st = fresh();
  st.adventure.claimed.c1_homecoming = true;
  A.ensure(st, T0);
  choose(st, "merchant", "listen");
  const view = M.merchantSpecial(st, T0);
  assert.equal(view.deals.length, 2, "選了先聽客人要有兩樣特價");
  assert.notEqual(view.deals[0].cropId, view.deals[1].cropId);
  const deals = K.merchantDeals(st, T0);
  assert.equal(deals.length, 2);
  const second = deals[1];
  const packsBefore = st.adventure.r58.r59.seedPacks[second.cropId] || 0;
  const coinsBefore = st.coins;
  const bought = K.buyMerchantDeal(st, T0, second.cropId);
  assert.equal(bought.ok, true, JSON.stringify(bought));
  assert.equal(bought.cropId, second.cropId);
  assert.equal(st.coins, coinsBefore - second.specialPrice);
  assert.ok((st.adventure.r58.r59.seedPacks[second.cropId] || 0) > packsBefore, "買完要有種子包");
  const panel = M.neighborPanel(st, T0).find((row) => row.npcId === "merchant");
  assert.match(panel.detail, /兩樣特價/);
  /* 只解鎖一種作物時，第二樣特價也要出現（先用同一種種子頂著，不能只剩一樣） */
  const low = fresh(1);
  low.adventure.claimed.c1_homecoming = true;
  A.ensure(low, T0);
  choose(low, "merchant", "listen");
  assert.equal(M.merchantSpecial(low, T0).deals.length, 2, "低等級也要有兩樣特價");
  const lowBought = K.buyMerchantDeal(low, T0, M.merchantSpecial(low, T0).deals[1].cropId, 1);
  assert.equal(lowBought.ok, true, JSON.stringify(lowBought));
});

test("7 手札「我做過的選擇」：列出回答與持續影響，還沒選的不列", () => {
  const st = fresh();
  assert.deepEqual(K.choiceEffects(st), [], "還沒選時不列任何一筆");
  choose(st, "mayor", "town");
  let rows = K.choiceEffects(st);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].npcName, "鎮長葛瑞");
  assert.equal(rows[0].answer, "先聽你講鎮上的事"); /* R76B 同步：手札回答改與對話選項同一份字 */
  assert.match(rows[0].effectText, /多一成/);
  st.adventure.claimed.c1_first_harvest = true;
  st.adventure.claimed.c1_homecoming = true;
  A.ensure(st, T0);
  choose(st, "elder", "seed");
  choose(st, "merchant", "listen");
  rows = K.choiceEffects(st);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row.npcId), ["mayor", "elder", "merchant"]);
  const src = fs.readFileSync("src/cooking-r75.js", "utf8");
  assert.match(src, /我做過的選擇/, "手札要有我做過的選擇區");
  assert.match(src, /data-r75b-choices/);
});

test("8 舊存檔：已經選過的載入後自動補上對應影響", () => {
  /* 模擬 R74 舊存檔：只有 storyChoices，沒有任何 R75 新欄位 */
  const st = fresh();
  st.adventure.r58.r59.r60.storyChoices = {
    mayor_welcome: { npcId: "mayor", choiceId: "town", at: T0, journal: "舊紀錄" },
    elder_wheat: { npcId: "elder", choiceId: "sell", at: T0, journal: "舊紀錄" },
    merchant_hello: { npcId: "merchant", choiceId: "sign", at: T0, journal: "舊紀錄" },
  };
  delete st.adventure.r75b;
  const rows = K.choiceEffects(st);
  assert.equal(rows.length, 3, "舊存檔三個選擇都要補上");
  assert.equal(M.mayorQuest(st, T0).bonusApplied, true, "舊存檔鎮長委託自動多一成");
  assert.equal(A.commissions(st, T0).find((row) => row.id === "elder_supper").choiceBonusRate, 0.1);
  assert.equal(A.commissions(st, T0).find((row) => row.id === "river_market").choiceBonusRate, 0.1);
  assert.equal(K.farmSignVisible(st), true);
  const reloaded = S.migrate(JSON.parse(JSON.stringify(st)));
  assert.equal(K.choiceEffects(reloaded).length, 3, "存檔重讀後影響還在");
  assert.equal(M.merchantSpecial(reloaded, T0).deals.length, 1, "選掛牌的人特價維持一樣");
});

test("9 快取與載入：新程式與兩張美術有進清單，版本字串不變", () => {
  const index = fs.readFileSync("index.html", "utf8");
  const sw = fs.readFileSync("sw.js", "utf8");
  assert.match(index, /src\/cooking-r75\.js\?v=content-r78-20261115-1/, "index 要載入新程式且不改版本");
  assert.match(sw, /cooking-r75\.js/, "sw 快取要有新程式");
  assert.match(sw, /content-r75\/cooking_pot\.png/, "sw 快取要有鐵鍋圖");
  assert.match(sw, /content-r75\/farm_sign\.png/, "sw 快取要有招牌圖");
  assert.match(sw, /CACHE_VERSION = "content-r78-20261115-1"/, "版本字串不可改");
});

console.log("VERIFIED content R75B choices (" + passed + " tests)");
