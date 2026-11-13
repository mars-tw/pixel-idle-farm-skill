"use strict";
/* R77B 第 7～8 項：六種開場回答各一條三步後續委託（觸發、三步進度、獎勵只入帳一次、長期加成升級並量實際數字、舊存檔相容），
   以及兩套回訪不會對同一個選擇各提一次。步驟一律用真實遊戲函式推進（收成、曬架、賣出、委託、餐籃、交談）。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
global.window = global;
const A = require("../src/adventure.js");
const S = require("../src/state.js");
const M = require("../src/midgame-r66.js");
const K = require("../src/cooking-r75.js");
const R = require("../src/story-r76.js");
const G = require("../src/game.js");
const SP = require("../src/sunplay-r75.js");
const Q = require("../src/choices-r77.js");
Q.install();

const ROOT = path.resolve(__dirname, "..");
const T0 = 1794172800000; /* 2026-11-08 */
const DAY = 24 * 60 * 60 * 1000;
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("PASS " + name); } catch (e) { console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
}
function fresh(level) {
  const st = S.defaultState(T0);
  st.level = level == null ? 5 : level;
  st.coins = 5000;
  A.ensure(st, T0); M.ensure(st, T0);
  return st;
}
function choose(st, npcId, choiceId, at) {
  if (npcId === "elder") st.adventure.claimed.c1_first_harvest = true;
  if (npcId === "merchant") st.adventure.claimed.c1_homecoming = true;
  A.ensure(st, at || T0);
  const r = A.resolveMainStoryChoice(st, npcId, choiceId, at || T0);
  assert.equal(r.ok, true, npcId + "/" + choiceId + " " + JSON.stringify(r));
  return r;
}
/* 選完回答 → 隔天交談觸發 R76 回訪 → 播完（瀏覽器的 openFollowup 會呼叫 onFollowupSeen） */
function startQuest(st, npcId, choiceId) {
  choose(st, npcId, choiceId, T0);
  const at = T0 + DAY;
  assert.equal(Q.questView(st, npcId, at).status, "waiting", "回訪前只顯示等待提示");
  assert.ok(R.noteTalk(st, npcId, at), "隔天交談要觸發 R76 回訪");
  R.markFollowupSeen(st, npcId, at);
  assert.equal(Q.onFollowupSeen(st, npcId, at), true, "回訪播完後委託開始");
  const notes = Q.takeNotes();
  assert.ok(notes.some((n) => /多交代了一件事/.test(n)), "要跳一則訊息說多交代了一件事：" + notes.join("|"));
  return at;
}
function readyPlot(st, i, at, care) {
  st.plots[i].cropId = null;
  const r = G.plant(st, i, "wheat", at - 10 * 60 * 1000, care);
  assert.equal(r.ok, true, "播種 " + JSON.stringify(r));
}
function sunOn(st, plots, at) { st.sun = { plots, startsAt: at - 1000, endsAt: at + 10000, nextAt: at + 60000, used: [], introduced: true }; }
function sunHarvest(st, i, at) {
  readyPlot(st, i, at);
  sunOn(st, [i], at);
  const r = G.harvest(st, i, at);
  assert.equal(r.ok, true, "收成 " + JSON.stringify(r));
  assert.ok(r.sun && r.sun.xpBonus > 0, "這次要是光裡收成");
  return r;
}
function dryOnce(st, at) {
  st.storage.items.wheat = (st.storage.items.wheat || 0) + 2;
  SP.addSunlight(st, 1);
  const s = SP.startDrying(st, "wheat", at);
  assert.equal(s.ok, true, "曬架開始 " + JSON.stringify(s));
  const c = SP.collectDrying(st, at + SP.DRYING_MS + 1);
  assert.equal(c.ok, true, "曬架收下 " + JSON.stringify(c));
  return c;
}
/* 料理本身的灶台流程由 R75 測試涵蓋，這裡直接放一份做好的麥餅進餐籃。 */
function addBread(st, n) { st.adventure.meals.rustic_bread = (st.adventure.meals.rustic_bread || 0) + (n || 1); }
function openDock(st, at) {
  st.adventure.projects.fishing_dock = { restored: true, restoredAt: T0 };
  A.ensure(st, at);
}
function progress(st, npcId, at) { return Q.questView(st, npcId, at).steps.map((s) => s.progress); }
function stepsDone(st, npcId, at) { return Q.questView(st, npcId, at).stepsDone; }
function noteText() { return Q.takeNotes().join("|"); }

test("六條委託定義：各三步、每條至少兩種玩法、每步有事件或按鈕、文字不夾英文", () => {
  assert.deepEqual(Object.keys(Q.QUESTS).sort(), ["elder:seed", "elder:sell", "mayor:farm", "mayor:town", "merchant:listen", "merchant:sign"]);
  const plays = ["追光", "料理", "曬架", "鄰居委託", "市集"];
  for (const [key, def] of Object.entries(Q.QUESTS)) {
    assert.equal(def.steps.length, 3, key);
    const used = Q.playsOf(def).map((p) => Q.PLAY_NAMES[p]);
    assert.ok(used.length >= 2 && used.every((p) => plays.includes(p)), key + " 至少兩種玩法：" + used.join("、"));
    def.steps.forEach((s, i) => assert.ok(s.event || s.act, key + " 第 " + (i + 1) + " 步要有推進來源"));
    const texts = [def.name, def.upgradeText, def.afterText].concat(def.brief, def.steps.map((s) => s.title + s.where + (s.actLabel || "")));
    /* {natural}、{color} 是顯示前會換成中文的佔位字 */
    for (const t of texts) assert.doesNotMatch(t.replace(/\{(natural|color)\}/g, ""), /[A-Za-z]/, key + " 玩家看到的文字不夾英文：" + t);
    assert.notEqual(def.afterText, R.FOLLOWUPS[key].summary, key + " 「再後來」不和 R76 回訪摘要相同");
  }
});

test("晨耕（我先去種田）：光裡收成 3 次 → 曬架 → 交乾貨；種子袋每天 2 包", () => {
  const st = fresh(5);
  const control = fresh(5); choose(control, "mayor", "farm", T0);
  const at = startQuest(st, "mayor", "farm");
  assert.deepEqual(progress(st, "mayor", at), ["進度 0/3", "進度 0/1", "進度 0/1"]);
  readyPlot(st, 0, at); assert.equal(G.harvest(st, 0, at).ok, true);
  assert.equal(progress(st, "mayor", at)[0], "進度 0/3", "不在光裡的收成不算");
  sunHarvest(st, 0, at + 1000);
  assert.equal(progress(st, "mayor", at)[0], "進度 1/3");
  readyPlot(st, 1, at + 2000); readyPlot(st, 2, at + 2000); sunOn(st, [1, 2], at + 2000);
  G.harvestAll(st, at + 2000);
  assert.equal(stepsDone(st, "mayor", at), 1, "一鍵收成兩格光裡的田也算兩次");
  assert.match(noteText(), /「晨耕」第 1 步完成！下一步：到曬架曬好並收下 1 批乾貨/);
  assert.equal(Q.act(st, "mayor", at + 2100).reason, "not_here", "曬架這一步不能在手札按");
  dryOnce(st, at + 3000);
  assert.equal(stepsDone(st, "mayor", at), 2);
  assert.match(noteText(), /第 2 步完成/);
  const dried = st.storage.items.sun_wheat;
  delete st.storage.items.sun_wheat;
  assert.equal(Q.act(st, "mayor", at + 4000).reason, "missing_dried");
  st.storage.items.sun_wheat = dried;
  const coins = st.coins, xp = st.xp, level = st.level;
  const r = Q.act(st, "mayor", at + 5000);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(st.coins, coins + Q.REWARD_COINS, "三步做完入帳 30 金");
  assert.ok(st.level > level || st.xp === xp + Q.REWARD_XP, "三步做完入帳 12 點經驗");
  assert.equal((st.storage.items.sun_wheat || 0), dried - 1, "交出 1 份乾貨");
  assert.match(r.message, /三步都完成了/);
  assert.equal(A.r77Upgraded(st, "mayor"), true);
  assert.equal(Q.act(st, "mayor", at + 6000).reason, "done");
  assert.equal(st.coins, coins + Q.REWARD_COINS, "不會再入帳");
  /* 實際數字：隔天種子袋送 2 包（小麥＋當季），同一天不重送；沒做委託的存檔照舊 1 包 */
  const day2 = at + DAY;
  const seasonal = K.seasonalCropId(st);
  const before = Object.assign({}, st.adventure.r58.r59.seedPacks);
  const perks = K.dailyPerks(st, day2);
  assert.equal(perks.claimed.length, 2, JSON.stringify(perks.claimed));
  const packs = st.adventure.r58.r59.seedPacks;
  if (seasonal === "wheat") assert.equal(packs.wheat, (before.wheat || 0) + 2);
  else { assert.equal(packs.wheat, (before.wheat || 0) + 1, "小麥實際多 1 包"); assert.equal(packs[seasonal], (before[seasonal] || 0) + 1, "當季作物實際多 1 包"); }
  assert.equal(K.dailyPerks(st, day2 + 1000).claimed.length, 0, "同一天不重送");
  assert.equal(K.dailyPerks(control, day2).claimed.length, 1, "沒做後續委託的照舊一天 1 包");
  assert.match(Q.seedBagLabel(st), /每天送 2 包/);
  assert.match(Q.seedBagLabel(control), /每天送 1 包小麥種子/);
  assert.match(K.selectedChoice(st, "mayor").effectText, /2 包/);
  const html = Q.cardHtml(st, "mayor", day2);
  assert.match(html, /data-r77b-state="done"/);
  assert.match(html, /再後來：鎮長收下那份乾貨/);
  assert.match(html, /data-r77b-upgrade/);
});

test("鎮上的事（先聽鎮上的事）：四位鄰居 → 兩次鎮長委託 → 端料理；委託金幣 1.2 倍、每天可換一次", () => {
  const st = fresh(5);
  const at = startQuest(st, "mayor", "town");
  assert.equal(progress(st, "mayor", at)[0], "進度 1/4", "回訪那次交談算鎮長");
  A.record(st, { type: "talk", npcId: "mayor" }, at + 100);
  assert.equal(progress(st, "mayor", at)[0], "進度 1/4", "同一個人說兩次不重算");
  A.record(st, { type: "talk", npcId: "elder" }, at + 200);
  A.record(st, { type: "talk", npcId: "merchant" }, at + 300);
  assert.equal(progress(st, "mayor", at)[0], "進度 3/4");
  A.record(st, { type: "talk", npcId: "child" }, at + 400);
  assert.equal(stepsDone(st, "mayor", at), 1);
  /* 第 2 步：鎮公所委託（還沒升級：多一成） */
  const q1 = M.mayorQuest(st, at + 500);
  st.storage.items[q1.cropId] = (st.storage.items[q1.cropId] || 0) + q1.qty;
  let c0 = st.coins;
  assert.equal(M.deliverMayorQuest(st, at + 500).ok, true);
  assert.equal(st.coins - c0, Math.round(q1.baseRewardCoins * 1.1), "升級前鎮長委託多一成");
  assert.equal(progress(st, "mayor", at)[1], "進度 1/2");
  st.npcRequests = st.npcRequests || {};
  st.npcRequests.mayor = { id: "req_mayor_test", npcId: "mayor", wants: { wheat: 1 }, rewardCoins: 5, rewardXp: 1, createdAt: at };
  st.storage.items.wheat = (st.storage.items.wheat || 0) + 1;
  assert.equal(G.fulfillNpcRequest(st, "mayor", at + 600).ok, true);
  assert.equal(stepsDone(st, "mayor", at), 2, "鎮長開口要的東西交給他也算");
  /* 第 3 步：端料理 */
  st.adventure.meals = Object.assign(st.adventure.meals, { rustic_bread: 0 });
  assert.equal(Q.act(st, "mayor", at + 700).reason, "missing_meal");
  addBread(st);
  c0 = st.coins;
  assert.equal(Q.act(st, "mayor", at + 800).ok, true);
  assert.equal(st.coins, c0 + Q.REWARD_COINS);
  assert.equal((st.adventure.meals.rustic_bread || 0), 0, "料理端出去了");
  /* 實際數字：隔天鎮長委託多兩成；換一次委託，第二次不行；交付入帳也是多兩成 */
  const day2 = at + DAY;
  const q2 = M.mayorQuest(st, day2);
  assert.equal(q2.bonusUpgraded, true);
  assert.equal(q2.rewardCoins, Math.round(q2.baseRewardCoins * 1.2));
  assert.match(q2.bonusText, /多兩成/);
  assert.match(M.neighborPanel(st, day2).find((d) => d.npcId === "mayor").detail, /多兩成/);
  const sw = Q.swapMayorQuest(st, day2);
  assert.equal(sw.ok, true, JSON.stringify(sw));
  assert.equal(Q.swapMayorQuest(st, day2 + 1000).reason, "daily_limit");
  const q3 = M.mayorQuest(st, day2);
  assert.equal(q3.cropId, sw.cropId);
  assert.equal(q3.rewardCoins, Math.round(q3.baseRewardCoins * 1.2));
  st.storage.items[q3.cropId] = (st.storage.items[q3.cropId] || 0) + q3.qty;
  c0 = st.coins;
  assert.equal(M.deliverMayorQuest(st, day2 + 2000).ok, true);
  assert.equal(st.coins - c0, Math.round(q3.baseRewardCoins * 1.2), "升級後交付實際入帳多兩成");
  assert.equal(Q.swapMayorQuest(st, day2 + 3000).reason, "claimed");
  assert.equal(Q.swapMayorQuest(st, day2 + DAY).ok, true, "再隔一天又可以換");
  const html = Q.cardHtml(st, "mayor", day2 + DAY);
  assert.match(html, /data-r77b-swap/);
  assert.match(html, /再後來：/);
});

test("第一筆生意（先賣一小袋）：賣三種作物 → 兩次班伯委託 → 找班伯算帳；河畔委託金幣 1.2 倍", () => {
  const st = fresh(5);
  const at = startQuest(st, "elder", "sell");
  st.storage.items.wheat = 5; st.storage.items.carrot = 2; st.storage.items.tomato = 2; st.storage.items.sun_wheat = 1;
  G.sellItem(st, "wheat", 1, at + 100); G.sellItem(st, "wheat", 1, at + 200);
  assert.equal(progress(st, "elder", at)[0], "進度 1/3", "同一種作物賣兩次只算一種");
  G.sellItem(st, "sun_wheat", 1, at + 250);
  assert.equal(progress(st, "elder", at)[0], "進度 1/3", "乾貨不算作物");
  G.sellAll(st, at + 300);
  assert.equal(stepsDone(st, "elder", at), 1, "一鍵賣出也算");
  openDock(st, at);
  st.adventure.catch.river_carp = 1; addBread(st);
  const row = A.commissions(st, at + 400).find((c) => c.id === "elder_supper");
  assert.equal(row.reward.coins, Math.round(14 * 1.1));
  let c0 = st.coins;
  assert.equal(A.deliverCommission(st, "elder_supper", at + 400).ok, true);
  assert.equal(st.coins - c0, Math.round(14 * 1.1), "升級前多一成");
  assert.equal(progress(st, "elder", at)[1], "進度 1/2");
  addBread(st);
  assert.equal(A.deliverNeighbor(st, "elder", "plain", at + 500).ok, true);
  assert.equal(stepsDone(st, "elder", at), 2, "送餐籃給班伯也算");
  A.record(st, { type: "talk", npcId: "elder" }, at + 600);
  assert.equal(stepsDone(st, "elder", at), 2, "剛交完的同一刻說話不順便算掉");
  c0 = st.coins;
  A.record(st, { type: "talk", npcId: "elder" }, at + 5000);
  assert.equal(stepsDone(st, "elder", at), 3);
  assert.equal(st.coins, c0 + Q.REWARD_COINS);
  /* 實際數字：下一批河畔委託多兩成，交付實際入帳 */
  const at2 = at + 600000;
  const row2 = A.commissions(st, at2).find((c) => c.id === "elder_supper");
  assert.equal(row2.choiceBonusRate, 0.2);
  assert.match(row2.choiceBonusText, /多兩成/);
  st.adventure.catch.river_carp = 1; addBread(st);
  c0 = st.coins;
  assert.equal(A.deliverCommission(st, "elder_supper", at2).ok, true);
  assert.equal(st.coins - c0, Math.round(14 * 1.2), "升級後實際入帳多兩成");
  assert.match(K.selectedChoice(st, "elder").effectText, /多兩成/);
});

test("留種（先留一包種子）：放著長收成 2 次 → 曬架 → 種子包和料理；請教班伯多 2 包", () => {
  const st = fresh(5);
  const at = startQuest(st, "elder", "seed");
  sunHarvest(st, 3, at + 100);
  assert.equal(progress(st, "elder", at)[0], "進度 0/2", "一般收成不算");
  readyPlot(st, 0, at + 200, "natural");
  assert.equal(G.harvest(st, 0, at + 200).ok, true);
  assert.equal(progress(st, "elder", at)[0], "進度 1/2");
  readyPlot(st, 1, at + 300, "natural"); readyPlot(st, 2, at + 300, "natural");
  G.harvestAll(st, at + 300);
  assert.equal(stepsDone(st, "elder", at), 1, "一次事件最多推進一步");
  assert.match(Q.questView(st, "elder", at).steps[0].title, /放著長/);
  dryOnce(st, at + 400);
  assert.equal(stepsDone(st, "elder", at), 2);
  /* 各模組的 ensure 可能換掉 seedPacks 物件，每次都從 state 重新讀 */
  const packs = () => st.adventure.r58.r59.seedPacks;
  Object.keys(packs()).forEach((k) => { packs()[k] = 0; });
  st.adventure.meals.rustic_bread = 0;
  const miss = Q.act(st, "elder", at + 500);
  assert.equal(miss.reason, "missing_seed_meal");
  assert.match(miss.message, /種子包還差 2 包、料理還差 1 份/);
  packs().carrot = 3; addBread(st);
  const c0 = st.coins;
  assert.equal(Q.act(st, "elder", at + 600).ok, true);
  assert.equal(packs().carrot, 1, "交出 2 包種子");
  assert.equal(st.adventure.meals.rustic_bread || 0, 0, "交出 1 道料理");
  assert.equal(st.coins, c0 + Q.REWARD_COINS);
  /* 實際數字：隔天請教班伯，當季種子多 2 包 */
  const day2 = at + DAY;
  const seasonal = K.seasonalCropId(st);
  const b0 = packs()[seasonal] || 0;
  const adv = M.askElderAdvice(st, day2);
  assert.equal(adv.ok, true);
  assert.equal(adv.seasonalSeed.qty, 2);
  assert.equal(packs()[seasonal], b0 + 2, "實際多拿 2 包");
  assert.match(adv.message, /多給你 2 包/);
});

test("招牌（先把農場牌掛起來）：兩份木料 → 料理分給蘿拉 → 選顏色；蘿拉委託 1.2 倍、招牌換色", () => {
  const st = fresh(5);
  st.adventure.claimed.c1_first_harvest = true;
  const at = startQuest(st, "merchant", "sign");
  st.materials.wood = 0;
  const miss = Q.act(st, "merchant", at + 100);
  assert.equal(miss.reason, "missing_wood");
  assert.match(miss.message, /木料還差 2 份/);
  assert.equal(A.buyMaterial(st, "wood", 2, at + 200).ok, true);
  assert.equal(progress(st, "merchant", at)[0], "木料 2/2");
  assert.equal(Q.act(st, "merchant", at + 300).ok, true);
  assert.equal(st.materials.wood, 0);
  addBread(st);
  assert.equal(A.deliverNeighbor(st, "merchant", "plain", at + 400).ok, true);
  assert.equal(stepsDone(st, "merchant", at), 2, "送鄰居餐籃給蘿拉也算分料理");
  const html = Q.cardHtml(st, "merchant", at + 500);
  assert.equal((html.match(/data-r77b-color="/g) || []).length, 3, "三個顏色選項");
  assert.equal(Q.act(st, "merchant", at + 500, "purple").reason, "pick_color");
  const c0 = st.coins;
  assert.equal(Q.act(st, "merchant", at + 600, "blue").ok, true);
  assert.equal(st.coins, c0 + Q.REWARD_COINS);
  assert.equal(Q.signColor(st), "blue");
  assert.equal(Q.signLabel(st), "農場招牌（河水藍）");
  assert.deepEqual(Q.signDataset(st), { r77bSignColor: "blue" });
  assert.match(Q.cardHtml(st, "merchant", at + 700), /再後來：蘿拉把招牌釘牢，照我選的河水藍重新漆過/);
  assert.equal(Q.act(st, "merchant", at + 800, "green").ok, true, "做完後還能換色");
  assert.equal(st.coins, c0 + Q.REWARD_COINS, "換色不會再給獎勵");
  assert.equal(Q.signColor(st), "green");
  /* 實際數字：河鮮籃多兩成 */
  openDock(st, at);
  const at2 = at + 600000;
  const row = A.commissions(st, at2).find((c) => c.id === "river_market");
  assert.equal(row.choiceBonusRate, 0.2);
  st.adventure.catch.river_carp = 2;
  const c1 = st.coins;
  assert.equal(A.deliverCommission(st, "river_market", at2).ok, true);
  assert.equal(st.coins - c1, Math.round(18 * 1.2), "升級後實際入帳多兩成");
});

test("客人的話（先聽客人想買什麼）：兩次蘿拉委託 → 帶特價作物 → 聽蘿拉轉述；特價變三樣且買得到第三樣", () => {
  const st = fresh(5);
  st.adventure.claimed.c1_first_harvest = true;
  const at = startQuest(st, "merchant", "listen");
  openDock(st, at);
  st.adventure.catch.river_carp = 2;
  assert.equal(A.deliverCommission(st, "river_market", at + 100).ok, true);
  assert.equal(progress(st, "merchant", at)[0], "進度 1/2");
  addBread(st);
  assert.equal(A.deliverNeighbor(st, "merchant", "plain", at + 200).ok, true);
  assert.equal(stepsDone(st, "merchant", at), 1);
  const deals = M.merchantSpecial(st, at + 300).deals.map((d) => d.cropId);
  assert.equal(deals.length, 2);
  const miss = Q.act(st, "merchant", at + 300);
  assert.equal(miss.reason, "missing_special");
  assert.match(Q.questView(st, "merchant", at + 300).steps[1].where, /今天特價的是/);
  const other = Object.keys(require("../src/config.js").CROPS).find((id) => !deals.includes(id));
  st.storage.items[other] = 1;
  G.sellItem(st, other, 1, at + 400);
  assert.equal(stepsDone(st, "merchant", at), 1, "賣不是特價的作物不算");
  st.storage.items[deals[1]] = (st.storage.items[deals[1]] || 0) + 1;
  G.sellItem(st, deals[1], 1, at + 500);
  assert.equal(stepsDone(st, "merchant", at), 2, "賣她今天特價的作物算");
  /* 既有的「第一次跟蘿拉說話給 5 金」先領掉，這裡只量後續委託的獎勵 */
  st.adventure.earlyGoals.marketPreview = true;
  const c0 = st.coins;
  A.record(st, { type: "talk", npcId: "merchant" }, at + 5000);
  assert.equal(stepsDone(st, "merchant", at), 3);
  assert.equal(st.coins, c0 + Q.REWARD_COINS);
  /* 實際數字：特價三樣，第三樣買得到 */
  const day2 = at + DAY;
  const sp = M.merchantSpecial(st, day2);
  assert.equal(sp.deals.length, 3);
  assert.equal(sp.threeSpecials, true);
  const third = sp.deals[2];
  const p0 = st.adventure.r58.r59.seedPacks[third.cropId] || 0, c1 = st.coins;
  const buy = K.buyMerchantDeal(st, day2, third.cropId, 2);
  assert.equal(buy.ok, true, JSON.stringify(buy));
  assert.equal(c1 - st.coins, third.specialPrice, "第三樣照特價扣錢");
  assert.equal(st.adventure.r58.r59.seedPacks[third.cropId], p0 + third.packsPerBuy, "第三樣的種子包實際入帳");
  assert.match(Q.cardHtml(st, "merchant", day2), /data-r77b-buy-third/);
  assert.match(M.neighborPanel(st, day2).find((d) => d.npcId === "merchant").detail, /三樣/);
});

test("另一條路：特價作物和料理也能在手札直接交", () => {
  const st = fresh(5);
  st.adventure.claimed.c1_first_harvest = true;
  const at = startQuest(st, "merchant", "listen");
  openDock(st, at);
  st.adventure.catch.river_carp = 2;
  A.deliverCommission(st, "river_market", at + 100);
  st.npcRequests = st.npcRequests || {};
  st.npcRequests.merchant = { id: "req_merchant_test", npcId: "merchant", wants: { wheat: 1 }, rewardCoins: 5, rewardXp: 1, createdAt: at };
  st.storage.items.wheat = (st.storage.items.wheat || 0) + 1;
  assert.equal(G.fulfillNpcRequest(st, "merchant", at + 200).ok, true);
  assert.equal(stepsDone(st, "merchant", at), 1, "蘿拉開口要的東西交給她也算");
  const deal = M.merchantSpecial(st, at + 300).deals[0].cropId;
  st.storage.items[deal] = (st.storage.items[deal] || 0) + 1;
  const before = st.storage.items[deal];
  assert.equal(Q.act(st, "merchant", at + 300).ok, true);
  assert.equal(st.storage.items[deal] || 0, before - 1);
  assert.equal(stepsDone(st, "merchant", at), 2);
  const st2 = fresh(5);
  st2.adventure.claimed.c1_first_harvest = true;
  const at2 = startQuest(st2, "merchant", "sign");
  A.buyMaterial(st2, "wood", 2, at2);
  Q.act(st2, "merchant", at2 + 100);
  addBread(st2);
  assert.equal(Q.act(st2, "merchant", at2 + 200).ok, true, "手札按「把料理分給蘿拉」");
  assert.equal(stepsDone(st2, "merchant", at2), 2);
});

test("手札卡：三步、去哪裡做、幾分之幾、目前這一步才有按鈕", () => {
  const st = fresh(5);
  const at = startQuest(st, "mayor", "town");
  const html = Q.cardHtml(st, "mayor", at);
  assert.match(html, /data-r77b-quest="mayor"/);
  assert.match(html, /後續委託：鎮上的事/);
  assert.match(html, /已完成 0\/3 步/);
  assert.equal((html.match(/data-r77b-step="/g) || []).length, 3);
  assert.equal((html.match(/去哪裡做：/g) || []).length, 3);
  assert.match(html, /進度 1\/4/);
  assert.match(html, /鄰居委託/);
  assert.match(html, /料理/);
  assert.doesNotMatch(html, /data-r77b-act=/, "交談這一步不在手札按");
  for (const id of ["elder", "merchant", "child"]) A.record(st, { type: "talk", npcId: id }, at + 100);
  st.npcRequests = st.npcRequests || {};
  for (let i = 0; i < 2; i++) {
    st.npcRequests.mayor = { id: "req_mayor_" + i, npcId: "mayor", wants: { wheat: 1 }, rewardCoins: 5, rewardXp: 1, createdAt: at };
    st.storage.items.wheat = (st.storage.items.wheat || 0) + 1;
    G.fulfillNpcRequest(st, "mayor", at + 200 + i);
  }
  const html2 = Q.cardHtml(st, "mayor", at + 300);
  assert.match(html2, /已完成 2\/3 步/);
  assert.equal((html2.match(/data-r77b-act="mayor"/g) || []).length, 1);
  assert.match(html2, /把料理端給鎮長/);
  assert.equal((html2.match(/去哪裡做：/g) || []).length, 1, "做完的步驟不再寫去哪裡");
});

test("舊存檔：選過也看過 R76 回訪的，載入就補上三條；只選過的先顯示等回訪", () => {
  const st = fresh(5);
  const r60 = st.adventure.r58.r59.r60;
  r60.storyChoices = {
    mayor_welcome: { npcId: "mayor", choiceId: "town", at: T0, journal: "舊紀錄" },
    elder_wheat: { npcId: "elder", choiceId: "seed", at: T0, journal: "舊紀錄" },
    merchant_hello: { npcId: "merchant", choiceId: "listen", at: T0, journal: "舊紀錄" },
  };
  st.r76story = { seen: { mayor: { choiceId: "town", at: T0, summary: "舊" }, elder: { choiceId: "seed", at: T0, summary: "舊" }, merchant: { choiceId: "listen", at: T0, summary: "舊" } }, orders: {} };
  const loaded = S.migrate(JSON.parse(JSON.stringify(st)));
  A.ensure(loaded, T0 + DAY); M.ensure(loaded, T0 + DAY); K.ensure(loaded, T0 + DAY);
  Q.takeNotes();
  assert.deepEqual(Q.sync(loaded, T0 + DAY), ["mayor", "elder", "merchant"]);
  assert.match(noteText(), /鎮長葛瑞、老農班伯、蘿拉都多交代了一件事/);
  for (const npc of ["mayor", "elder", "merchant"]) assert.equal(Q.questView(loaded, npc, T0 + DAY).status, "active");
  assert.deepEqual(Q.sync(loaded, T0 + DAY + 1000), [], "不會重複開");
  const old = fresh(5);
  old.adventure.r58.r59.r60.storyChoices = { elder_wheat: { npcId: "elder", choiceId: "sell", at: T0, journal: "舊紀錄" } };
  A.ensure(old, T0);
  assert.deepEqual(Q.sync(old, T0 + 1000), []);
  assert.match(Q.cardHtml(old, "elder", T0 + 1000), /data-r77b-state="waiting"[\s\S]*還有一件事要交代/);
  assert.ok(R.noteTalk(old, "elder", T0 + DAY));
  R.markFollowupSeen(old, "elder", T0 + DAY);
  assert.equal(Q.onFollowupSeen(old, "elder", T0 + DAY), true);
  assert.equal(Q.questView(old, "elder", T0 + DAY).name, "第一筆生意");
  Q.takeNotes();
});

test("存檔：state.adventure.r77 經過各模組 ensure 與存讀檔往返都還在；壞資料會修正、獎勵不補發", () => {
  const st = fresh(5);
  const at = startQuest(st, "mayor", "farm");
  for (let i = 0; i < 3; i++) Q.noteHarvest(st, { sunlit: true }, at + i);
  Q.noteDried(st, "sun_wheat", at + 10);
  st.storage.items.sun_wheat = 1;
  assert.equal(Q.act(st, "mayor", at + 20).ok, true);
  const coins = st.coins;
  A.ensure(st, at + DAY); M.ensure(st, at + DAY); K.ensure(st, at + DAY); R.ensure(st);
  Q.ensure(st); Q.sync(st, at + DAY);
  assert.equal(st.coins, coins, "重新整理不補發");
  assert.equal(st.adventure.r77.quests.mayor.step, 3);
  const copy = S.migrate(JSON.parse(JSON.stringify(st)));
  A.ensure(copy, at + DAY);
  assert.equal(copy.adventure.r77.quests.mayor.step, 3);
  assert.equal(copy.adventure.r77.quests.mayor.rewardedAt, at + 20);
  assert.equal(A.r77Upgraded(copy, "mayor"), true);
  assert.equal(Q.act(copy, "mayor", at + DAY).reason, "done");
  copy.adventure.r77.quests.child = { choiceId: "farm", step: 1 };
  copy.adventure.r77.quests.elder = { choiceId: "sell", step: 2 };
  copy.adventure.r77.quests.mayor.seen = ["a", "a", 3];
  copy.adventure.r77.quests.mayor.color = "purple";
  Q.ensure(copy);
  assert.equal(copy.adventure.r77.quests.child, undefined, "不是三位鄰居的拿掉");
  assert.equal(copy.adventure.r77.quests.elder, undefined, "沒選過的回答拿掉");
  assert.deepEqual(copy.adventure.r77.quests.mayor.seen, ["a"]);
  assert.equal(copy.adventure.r77.quests.mayor.color, "");
  const noChoice = fresh(5);
  noChoice.adventure.r77 = { quests: { mayor: { choiceId: "farm", step: 3, upgraded: true } } };
  A.ensure(noChoice, T0); Q.ensure(noChoice);
  assert.equal(A.r77Upgraded(noChoice, "mayor"), false, "沒有對應的開場選擇不能升級");
});

test("第 8 項：兩套回訪不重複——六種回答只剩 R76 回訪那一次", () => {
  const cases = [["mayor", "farm"], ["mayor", "town"], ["elder", "sell"], ["elder", "seed"], ["merchant", "sign"], ["merchant", "listen"]];
  for (const [npc, choice] of cases) {
    const st = fresh(5);
    choose(st, npc, choice, T0);
    const t3 = T0 + 3 * 60 * 1000;
    assert.ok(A.__r77bOrigMainStoryRecall(st, npc, t3), npc + "/" + choice + " 原本那套會再提一次");
    let recalls = 0;
    for (const t of [t3, T0 + DAY, T0 + 2 * DAY]) if (A.mainStoryRecall(st, npc, t)) recalls++;
    assert.ok(R.followupDue(st, npc, T0 + DAY, "talk"), npc + "/" + choice + " R76 回訪照常出現");
    R.markFollowupSeen(st, npc, T0 + DAY);
    let followups = 1;
    for (const t of [T0 + 2 * DAY, T0 + 3 * DAY]) if (R.followupDue(st, npc, t, "talk")) followups++;
    for (const t of [T0 + 2 * DAY, T0 + 3 * DAY]) if (A.mainStoryRecall(st, npc, t)) recalls++;
    assert.equal(recalls, 0, npc + "/" + choice + " 固定回訪台詞不再出現");
    assert.equal(followups, 1, npc + "/" + choice + " 只回訪一次");
  }
  const none = fresh(5);
  assert.equal(A.mainStoryRecall(none, "mayor", T0 + DAY), A.__r77bOrigMainStoryRecall(none, "mayor", T0 + DAY), "沒選過的照舊");
  const ui = fs.readFileSync(path.join(ROOT, "src/ui.js"), "utf8");
  assert.ok(ui.includes("window.AdventureAPI.mainStoryRecall(state, tile.npc, now())"), "ui.js 以屬性呼叫，包裝接得到");
  assert.ok(ui.includes("window.StoryR76.openFollowup(state, tile.npc, {})"), "ui.js 以屬性呼叫回訪，包裝接得到");
});

test("載入清單與原始碼：新檔加進 index.html 與 sw.js、版本字串沒動、註解寫法", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /<script src="src\/sunbook-r76\.js\?v=content-r77-20261113-1"><\/script>\s*<script src="src\/choices-r77\.js\?v=content-r77-20261113-1"><\/script>/);
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  assert.match(sw, /versioned\("\.\/src\/choices-r77\.js"\)/);
  assert.match(sw, /CACHE_VERSION = "content-r77-20261113-1"/);
  const src = fs.readFileSync(path.join(ROOT, "src/choices-r77.js"), "utf8");
  assert.doesNotMatch(src, /[;,)}\]]\s*\/\/.*[一-鿿]/, "中文註解不用 // 放在程式後面");
  const css = fs.readFileSync(path.join(ROOT, "src/content-r58b.css"), "utf8");
  assert.match(css, /R77B/);
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, "CSS 大括號平衡");
  for (const c of Q.SIGN_COLORS) assert.ok(css.includes('[data-r77b-sign-color="' + c.id + '"]'), "招牌 " + c.name + " 有 CSS 濾色");
});

console.log("VERIFIED content R77B choices follow-up quests (" + passed + " tests)");
