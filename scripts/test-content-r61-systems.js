"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
require("../src/config.js");
const A = require("../src/adventure.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const T0 = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function ok(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result; }
function fresh() { const state = S.defaultState(T0); ok(A.ensure(state, T0)); return state; }
function finishThroughChapter3(state) {
  const ids = A.quests(state, T0).filter((q) => q.chapter <= 3).map((q) => q.id);
  ids.forEach((id) => { state.adventure.claimed[id] = true; state.adventure.quests[id].status = "claimed"; state.adventure.quests[id].rewardGranted = true; });
  ok(A.ensure(state, T0));
}
function stock(state) {
  Object.assign(state.storage.items, { wheat: 99, carrot: 99, tomato: 99, strawberry: 99, river_mint: 99 });
  Object.assign(state.materials, { wood: 99, stone: 99 });
}

test("1 第四、五章六個任務依序完成，對白、混合需求與世界變化寫入存檔", () => {
  const state = fresh(); finishThroughChapter3(state); stock(state);
  let quests = A.quests(state, T0); const ids = quests.filter((q) => q.chapter >= 4).map((q) => q.id);
  assert.deepEqual(ids, ["c4_market_expansion", "c4_tasting_stall", "c4_notice_bench", "c5_festival_tables", "c5_invite_neighbors", "c5_festival_dinner"]);
  assert.ok(quests.filter((q) => q.chapter >= 4).every((q) => q.opening.length >= 3 && q.completion.length >= 3));
  assert.ok(quests.filter((q) => q.chapter >= 4).every((q) => q.requirements.length + q.goals.length >= 2));
  ok(A.claim(state, ids[0], T0 + 1));
  const choice = A.r61MarketChoice(state, T0 + 2); assert.equal(choice.options.length, 2);
  ok(A.chooseR61MarketFlag(state, "stall", T0 + 2));
  assert.equal(state.adventure.r61.world.marketFlag, "stall");
  state.storage.items.strawberry = 99; state.storage.items.wheat = 99; ok(A.cook(state, "strawberry_market_tart", T0 + 3));
  ok(A.claim(state, ids[1], T0 + 4)); assert.equal(state.adventure.r61.world.tastingMark, true);
  state.storage.items.tomato = 99; state.storage.items.carrot = 99; ok(A.cook(state, "tomato_harvest_stew", T0 + 5));
  ok(A.claim(state, ids[2], T0 + 6)); assert.equal(state.adventure.r61.world.noticeBench, true);
  stock(state); ok(A.claim(state, ids[3], T0 + 7)); assert.equal(state.adventure.r61.world.festivalTables, true);
  state.storage.items.carrot = 99; state.storage.items.river_mint = 99; ok(A.cook(state, "carrot_trail_soup", T0 + 8));
  for (const npcId of ["mayor", "elder", "merchant", "child"]) ok(A.record(state, { type: "talk", npcId }, T0 + 9));
  ok(A.claim(state, ids[4], T0 + 10));
  stock(state); ok(A.cook(state, "tomato_harvest_stew", T0 + 11)); ok(A.cook(state, "strawberry_market_tart", T0 + 12)); ok(A.cook(state, "carrot_trail_soup", T0 + 13));
  ok(A.claim(state, ids[5], T0 + 14)); assert.equal(state.adventure.r61.festival.unlocked, true);
  const saved = JSON.parse(JSON.stringify(state)); ok(A.ensure(saved, T0 + 15));
  assert.equal(saved.adventure.claimed.c5_festival_dinner, true); assert.equal(saved.adventure.r61.world.marketFlag, "stall");
});

test("2 市集掛旗二選一有不同結果、日誌與後續回收", () => {
  const recalls = [];
  for (const id of ["gate", "stall"]) {
    const state = fresh(); finishThroughChapter3(state); stock(state); ok(A.claim(state, "c4_market_expansion", T0 + 1));
    const before = state.adventure.r58.r59.journal.length; const result = ok(A.chooseR61MarketFlag(state, id, T0 + 2));
    assert.equal(state.adventure.r58.r59.journal.length, before + 1); assert.equal(result.choiceId, id); assert.equal(state.adventure.r61.world.marketFlag, id);
    recalls.push(A.r61MarketRecall(state, T0 + 3));
  }
  assert.notEqual(recalls[0], recalls[1]); assert.match(recalls[0], /入口/); assert.match(recalls[1], /試吃攤/);
});

test("3 三道料理可做可吃，數值、五分鐘與實際效果生效", () => {
  const state = fresh(); finishThroughChapter3(state); stock(state); ok(A.claim(state, "c4_market_expansion", T0 + 1));
  ok(A.cook(state, "strawberry_market_tart", T0 + 2)); ok(A.claim(state, "c4_tasting_stall", T0 + 3));
  const recipes = A.recipes(state, T0 + 4).filter((r) => ["tomato_harvest_stew", "strawberry_market_tart", "carrot_trail_soup"].includes(r.id));
  assert.equal(recipes.length, 3); assert.ok(recipes.every((r) => r.unlocked && r.effect.durationMs === 300000 && r.effect.durationText === "5 分鐘"));
  for (const recipe of recipes) { stock(state); ok(A.cook(state, recipe.id, T0 + 5)); ok(A.eatMeal(state, recipe.id, T0 + 6)); }
  const buffs = A.activeBuffs(state, T0 + 7); assert.equal(buffs.harvestBonus, 1); assert.equal(buffs.orderBonus, 0.15); assert.equal(buffs.forageBonus, 1);
  state.level = 4; state.coins = 999; state.storage.items = {}; const planted = G.plant(state, 0, "wheat", T0 - 60000); assert.equal(planted.ok, true);
  const harvested = G.harvest(state, 0, T0 + 7); assert.equal(harvested.meal.bonus, 1); assert.equal(harvested.added, global.CROPS.wheat.yield + 1);
  state.flags.forageNodes = {}; const gathered = G.gatherForage(state, "farm_berry_patch", T0 + 7); assert.equal(gathered.mealBonus, 1); assert.equal(gathered.added, 2);
});

test("4 收穫祭開啟、倒數、三目標、獎勵與二十分鐘後再次開啟", () => {
  const state = fresh(); finishThroughChapter3(state); stock(state);
  for (const id of ["c4_market_expansion", "c4_tasting_stall", "c4_notice_bench", "c5_festival_tables", "c5_invite_neighbors"]) {
    if (id === "c4_tasting_stall") { state.adventure.claimed.c4_market_expansion = true; stock(state); ok(A.cook(state, "strawberry_market_tart", T0 + 1)); }
    if (id === "c4_notice_bench") { stock(state); ok(A.cook(state, "tomato_harvest_stew", T0 + 1)); }
    if (id === "c5_invite_neighbors") { stock(state); ok(A.cook(state, "carrot_trail_soup", T0 + 1)); for (const npcId of ["mayor", "elder", "merchant", "child"]) ok(A.record(state, { type: "talk", npcId }, T0 + 1)); }
    stock(state); if (!state.adventure.claimed[id]) ok(A.claim(state, id, T0 + 2));
  }
  stock(state); for (const id of ["tomato_harvest_stew", "strawberry_market_tart", "carrot_trail_soup"]) ok(A.cook(state, id, T0 + 3));
  ok(A.claim(state, "c5_festival_dinner", T0 + 4));
  let festival = A.festivalStatus(state, T0 + 5); assert.equal(festival.active, true); assert.equal(festival.remainingMs, 300000);
  ok(A.record(state, { type: "harvest", cropId: "tomato", count: 3 }, T0 + 6)); stock(state); ok(A.cook(state, "tomato_harvest_stew", T0 + 7));
  ok(A.record(state, { type: "talk", npcId: "mayor" }, T0 + 8)); ok(A.record(state, { type: "talk", npcId: "merchant" }, T0 + 9));
  festival = A.festivalStatus(state, T0 + 10); assert.equal(festival.canComplete, true); assert.ok(festival.goals.every((g) => g.complete));
  const done = ok(A.completeFestival(state, T0 + 10)); assert.deepEqual(done.reward, { medals: 1, decorations: 1 });
  festival = A.festivalStatus(state, T0 + 10 + 20 * 60 * 1000); assert.equal(festival.active, true); assert.equal(festival.rounds, 1);
  assert.match(fs.readFileSync("src/world-ui.js", "utf8"), /r61a-festival-banner/); assert.match(fs.readFileSync("src/content-r58b.css", "utf8"), /R61A/);
});

test("5 只到第三章的舊存檔可遷移，不會憑空完成新內容", () => {
  const state = fresh(); finishThroughChapter3(state); delete state.adventure.r61;
  ok(A.ensure(state, T0 + 1)); assert.equal(state.adventure.r61.festival.unlocked, false); assert.equal(state.adventure.r61.marketFlagChoice, null);
  const chapter4 = A.quests(state, T0 + 1).filter((q) => q.chapter === 4); assert.equal(chapter4[0].status, "active"); assert.ok(chapter4.slice(1).every((q) => q.status === "locked"));
});

console.log(`VERIFIED content R61A systems (${passed}/5)`);
if (process.exitCode) process.exit(1);
