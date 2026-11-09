"use strict";
/* R64 A 線驗收：主角稱呼、主線即時狀態、鎮長選擇、收穫祭評比與結算。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
require("../src/config.js");
const A = require("../src/adventure.js");
const S = require("../src/state.js");
const T0 = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function ok(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result; }
function fresh() { const state = S.defaultState(T0); ok(A.ensure(state, T0)); return state; }
function festivalState() { const state = fresh(); state.adventure.r61.festival.unlocked = true; state.adventure.r61.festival.startsAt = T0; state.adventure.r61.festival.endsAt = 0; state.adventure.r61.festival.nextAt = 0; return state; }

test("1 主角稱呼依米莉與凱切換，沒有寫死孫子或小伙子", () => {
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  assert.match(world, /current\.gender === "m"/); assert.match(world, /孫女米莉/); assert.match(world, /孫子凱/); assert.doesNotMatch(world, /小伙子/);
});

test("2 第一餐吃下才完成並前進；缺零份小麥與釣台材料齊的提示可執行", () => {
  const state = fresh(); state.adventure.claimed.c1_homecoming = true; state.adventure.quests.c1_homecoming.status = "claimed"; state.adventure.claimed.c1_first_harvest = true; state.adventure.quests.c1_first_harvest.status = "claimed";
  state.storage.items.wheat = 0; let early = A.earlyGoals(state, T0); assert.match(early.nextStep.detail, /種.*小麥|收成/); assert.doesNotMatch(early.nextStep.detail, /帶去交付/);
  state.storage.items.wheat = 2; const cooked = ok(A.cook(state, "rustic_bread", T0 + 1)); assert.equal(cooked.storyAdvance, null); assert.equal(state.adventure.claimed.c1_first_meal, undefined); assert.equal(A.earlyGoals(state, T0 + 2).nextStep.action, "eat");
  assert.equal(state.adventure.meals.rustic_bread, 1); ok(A.eatMeal(state, "rustic_bread", T0 + 3)); assert.equal(state.adventure.claimed.c1_first_meal, true); assert.equal(A.earlyGoals(state, T0 + 3).nextStep.complete, true); assert.equal(A.guide(state, T0 + 3).questId, "c2_fishing_dock");
  state.materials.wood = 4; state.materials.stone = 2; early = A.earlyGoals(state, T0 + 4); assert.equal(early.goals.find((g) => g.id === "dock").detail, "材料齊了，可以修"); assert.equal(early.goals.find((g) => g.id === "dock").actionLabel, "去修");
});

test("3 鎮長第一次二選一有種田與鎮上故事，結果寫日誌並有不同回收", () => {
  const recalls = [];
  for (const choice of ["farm", "town"]) { const state = fresh(); const view = A.mainStoryChoice(state, "mayor", T0); assert.deepEqual(view.options.map((o) => o.id), ["farm", "town"]); const before = state.adventure.r58.r59.journal.length; const result = ok(A.resolveMainStoryChoice(state, "mayor", choice, T0 + 1)); assert.equal(state.adventure.r58.r59.journal.length, before + 1); assert.ok(result.journalText); recalls.push(A.mainStoryRecall(state, "mayor", T0 + 120001)); }
  assert.match(recalls[0], /田種得還順/); assert.match(recalls[1], /班伯.*蘿拉.*圖圖/);
});

test("4 收穫祭為十分鐘，三種星等、獎勵、每場一次與三星配方都成立", () => {
  const one = festivalState(); one.storage.items.wheat = 3; assert.equal(A.festivalStatus(one, T0).remainingMs, 600000); assert.equal(ok(A.judgeFestivalEntry(one, ["wheat", "wheat", "wheat"], T0 + 1)).stars, 1); assert.equal(one.coins, S.defaultState(T0).coins + 8); assert.equal(A.judgeFestivalEntry(one, ["wheat", "wheat", "wheat"], T0 + 2).reason, "already_judged"); // R65：拉開一至三星獎勵。
  const two = festivalState(); Object.assign(two.storage.items, { wheat: 1, carrot: 1, tomato: 1 }); const twoResult = ok(A.judgeFestivalEntry(two, ["wheat", "carrot", "tomato"], T0 + 1)); assert.equal(twoResult.stars, 2); assert.equal(twoResult.reward.decorations, 1);
  const three = festivalState(); Object.assign(three.storage.items, { radish: 1, carrot: 1 }); three.adventure.meals.rustic_bread = 1; const threeResult = ok(A.judgeFestivalEntry(three, ["radish", "carrot", "rustic_bread"], T0 + 1)); assert.equal(threeResult.stars, 3); assert.equal(threeResult.reward.recipe, "riverside_harvest_platter"); assert.equal(A.recipes(three).find((r) => r.id === "riverside_harvest_platter").unlocked, true);
});

test("5 逾時結算列完成數、星等、獎勵、下場時間，未全完成也給五金", () => {
  const state = festivalState(); const before = state.coins; const status = A.festivalStatus(state, T0); assert.equal(status.active, true); const ended = A.festivalStatus(state, T0 + 600001); assert.equal(ended.active, false); assert.equal(state.coins, before + 5); const settlement = A.takeFestivalSettlement(state, T0 + 600001); assert.equal(settlement.goalsCompleted, 0); assert.equal(settlement.stars, 0); assert.match(settlement.rewards.join("、"), /參加獎 5 金/); assert.equal(settlement.nextAt, T0 + 600000 + 20 * 60 * 1000); assert.equal(A.takeFestivalSettlement(state, T0 + 600002), null);
  const world = fs.readFileSync("src/world-ui.js", "utf8"); assert.match(world, /收穫祭小結算/); assert.match(world, /參加作物評比/); assert.match(world, /本場有 10 分鐘/);
});

console.log(`VERIFIED content R64A systems (${passed}/5)`);
if (process.exitCode) process.exit(1);
