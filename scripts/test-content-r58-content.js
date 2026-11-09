"use strict";
// Run: node scripts/test-content-r58-content.js
const assert = require("node:assert/strict");
const A = require("../src/adventure.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const C = require("../src/config.js");
const T0 = 3000000;
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (e) { failed++; console.error("FAIL " + name + "\n" + e.stack); } }
function ok(r) { assert.equal(r.ok, true, JSON.stringify(r)); return r; }
function fresh() { const s = S.defaultState(T0); ok(A.ensure(s, T0)); return s; }
function seq(values) { let i = 0; return () => values[Math.min(i++, values.length - 1)]; }
function trigger(s, pick, at) {
  s.adventure.r58.nextEventAt = at;
  const r = ok(A.maybeTriggerRandomEvent(s, at, seq([pick, 0])));
  assert.equal(r.triggered, true, JSON.stringify(r));
  return r.event;
}

test("四種小事件都能觸發並結算，且間隔約 2～3 分鐘", () => {
  // R59A：旅行商人付 12 金得 2 包可直接種的草莓種子，結算後不能重複領。
  let s = fresh(); s.coins = 30;
  let ev = trigger(s, 0, T0); assert.equal(ev.id, "traveling_merchant");
  ok(A.resolveRandomEvent(s, T0 + 1000));
  assert.equal(s.coins, 18); assert.equal(s.adventure.r58.r59.seedPacks.strawberry, 2);
  assert.equal(A.resolveRandomEvent(s, T0 + 2000).reason, "no_event");
  assert.ok(s.adventure.r58.nextEventAt >= T0 + 120000 && s.adventure.r58.nextEventAt <= T0 + 180000, "下一件在 2～3 分鐘後");
  // 烏鴉：得羽毛材料。
  s = fresh(); ev = trigger(s, 0.3, T0); assert.equal(ev.id, "crow_steal");
  ok(A.resolveRandomEvent(s, T0)); assert.equal(s.materials.feather, 1);
  assert.equal(C.MATERIALS.feather.name, "烏鴉羽毛");
  // 午後小雨：田全部自動澆水。
  s = fresh(); s.plots[0].cropId = "wheat"; s.plots[0].plantedAt = T0; s.plots[0].wateredAt = 0;
  s.plots[1].cropId = "wheat"; s.plots[1].plantedAt = T0; s.plots[1].wateredAt = 0;
  ev = trigger(s, 0.55, T0); assert.equal(ev.id, "afternoon_rain");
  const rain = ok(A.resolveRandomEvent(s, T0 + 5000));
  assert.equal(rain.reward.wateredPlots, 2);
  assert.ok(s.plots[0].wateredAt >= T0 && s.plots[1].wateredAt >= T0);
  assert.equal(G.getCropProgress(s, s.plots[0], T0 + 5000).wet, true);
  // 走失小雞：得雞蛋。
  s = fresh(); ev = trigger(s, 0.8, T0); assert.equal(ev.id, "lost_chick");
  ok(A.resolveRandomEvent(s, T0)); assert.equal(s.storage.items.egg, 1);
  // 時間未到不觸發；商人錢不夠時事件保留。
  s = fresh(); assert.equal(ok(A.maybeTriggerRandomEvent(s, T0, seq([0, 0]))).triggered, false);
  s.coins = 5; trigger(s, 0, T0);
  assert.equal(A.resolveRandomEvent(s, T0).reason, "missing_resources");
  assert.equal(A.randomEvents(s, T0).active.id, "traveling_merchant");
});

test("每位鄰居 2 件個人委託可完成、好感提升且不可重複", () => {
  const s = fresh();
  // 未解鎖前不可完成。
  assert.equal(A.completePersonalQuest(s, "mayor_first_notice", T0).reason, "locked");
  s.adventure.claimed.c1_homecoming = true; ok(A.ensure(s, T0));
  const list = A.personalQuests(s, T0);
  assert.equal(list.length, 8);
  for (const npcId of ["mayor", "elder", "merchant", "child"]) assert.equal(list.filter((q) => q.npcId === npcId).length, 2, npcId);
  assert.ok(list.filter((q) => q.chapter === 1).every((q) => q.unlocked));
  assert.ok(list.filter((q) => q.chapter === 2).every((q) => !q.unlocked), "第二件依第二章進度才出現");
  // 缺物品時不扣任何東西。
  const before = JSON.stringify(s.storage.items);
  assert.equal(A.completePersonalQuest(s, "mayor_first_notice", T0).reason, "missing_resources");
  assert.equal(JSON.stringify(s.storage.items), before);
  // 逐件完成第一章委託。
  s.storage.items = { wheat: 20, carrot: 20 };
  for (const q of list.filter((x) => x.chapter === 1)) {
    const coins = s.coins; const r = ok(A.completePersonalQuest(s, q.id, T0));
    assert.equal(r.favor, 1); assert.ok(s.coins > coins); assert.ok(r.doneLine.length > 5);
    assert.equal(A.completePersonalQuest(s, q.id, T0).reason, "already_claimed");
  }
  // 第二章委託在第一章主線完成後解鎖並可完成。
  s.adventure.claimed.c1_first_meal = true; ok(A.ensure(s, T0));
  s.storage.items = { wheat: 20, carrot: 20 };
  for (const q of A.personalQuests(s, T0).filter((x) => x.chapter === 2)) {
    const r = ok(A.completePersonalQuest(s, q.id, T0)); assert.equal(r.favor, 2, q.id);
  }
  const done = A.personalQuests(s, T0);
  assert.ok(done.every((q) => q.completed));
  for (const npcId of ["mayor", "elder", "merchant", "child"]) assert.equal(done.find((q) => q.npcId === npcId).favor, 2);
  // 存檔重載後完成狀態與好感保留。
  const reloaded = S.migrate(JSON.parse(JSON.stringify(s))); ok(A.ensure(reloaded, T0));
  assert.ok(A.personalQuests(reloaded, T0).every((q) => q.completed));
});

test("祖母的信依里程碑解鎖、讀後收進手記", () => {
  const s = fresh();
  assert.deepEqual(G.evaluateLetters(s, T0).filter((id) => id.startsWith("letter_r58_")), []);
  s.stats.harvested.wheat = 2;
  assert.ok(G.evaluateLetters(s, T0).includes("letter_r58_first_harvest"));
  assert.equal(G.readLetter(s, "letter_r58_market_open").reason, "locked");
  s.adventure.claimed.c1_first_harvest = true;
  assert.ok(G.evaluateLetters(s, T0).includes("letter_r58_market_open"));
  s.storage.items.wheat = 4; ok(A.cook(s, "rustic_bread", T0)); ok(A.ensure(s, T0));
  assert.ok(G.evaluateLetters(s, T0).includes("letter_r58_first_cook"));
  s.adventure.r58.personal.completed.push("mayor_first_notice");
  assert.ok(G.evaluateLetters(s, T0).includes("letter_r58_neighbor_hand"));
  for (const id of ["letter_r58_first_harvest", "letter_r58_market_open", "letter_r58_first_cook", "letter_r58_neighbor_hand"]) {
    const letter = C.LETTERS.find((l) => l.id === id);
    assert.ok(letter && letter.from === "祖母" && letter.body.length >= 3, id);
    assert.equal(ok(G.readLetter(s, id)).ok, true);
  }
  const journal = G.journalSummary(s, T0);
  assert.equal(journal.grandmaLetters.length, 4);
  assert.ok(journal.grandmaLetters.every((l) => l.unlocked && l.read), "四封都已解鎖並讀完收進手記");
});

test("新料理 2 道可用前期作物做、享用後效果生效且會過期", () => {
  const s = fresh();
  s.adventure.claimed.c1_first_harvest = true; ok(A.ensure(s, T0));
  s.storage.items = { wheat: 10, carrot: 10 };
  const recipes = A.recipes(s, T0);
  const pancake = recipes.find((r) => r.id === "wheat_carrot_pancake");
  const stew = recipes.find((r) => r.id === "carrot_wheat_stew");
  assert.ok(pancake && pancake.canCook && pancake.effect.kind === "growth");
  assert.ok(stew && stew.canCook && stew.effect.kind === "order");
  ok(A.cook(s, "wheat_carrot_pancake", T0)); ok(A.cook(s, "carrot_wheat_stew", T0));
  assert.equal(s.adventure.meals.wheat_carrot_pancake, 1); assert.equal(s.adventure.meals.carrot_wheat_stew, 1);
  // 成長加速：享用前後同條件比較。
  const baseGrow = G.effectiveGrowMs(s, "wheat", T0);
  ok(A.eatMeal(s, "wheat_carrot_pancake", T0));
  assert.equal(s.adventure.meals.wheat_carrot_pancake, 0);
  const fastGrow = G.effectiveGrowMs(s, "wheat", T0);
  assert.ok(fastGrow < baseGrow, baseGrow + " -> " + fastGrow);
  assert.ok(Math.abs(fastGrow / baseGrow - 0.75) < 0.02);
  assert.equal(A.activeBuffs(s, T0).growthMul, 0.75);
  // 訂單收入提高。
  const order = { rewardCoins: 100, rewardXp: 10 };
  const basePay = G.orderPayout(s, order, T0).coins;
  ok(A.eatMeal(s, "carrot_wheat_stew", T0));
  const boostedPay = G.orderPayout(s, order, T0).coins;
  assert.ok(boostedPay > basePay, basePay + " -> " + boostedPay);
  assert.ok(Math.abs(boostedPay / basePay - 1.2) < 0.02);
  // 過期後效果消失；沒料理時不能享用。
  const later = T0 + 300001;
  assert.equal(A.activeBuffs(s, later).growthMul, 1);
  assert.equal(G.orderPayout(s, order, later).coins, basePay);
  assert.equal(G.effectiveGrowMs(s, "wheat", later), baseGrow);
  assert.equal(A.eatMeal(s, "wheat_carrot_pancake", later).reason, "missing_resources");
  assert.equal(A.eatMeal(s, "rustic_bread", T0).reason, "not_edible");
});

console.log("\nR58 content tests: " + passed + " passed, " + failed + " failed.");
if (failed) process.exit(1);
