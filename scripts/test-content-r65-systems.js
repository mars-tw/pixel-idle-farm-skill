"use strict";
/* R65 A 線驗收：單一下一步、吃下第一餐、前十分鐘節奏、三類今日事項、評比明細。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
const C = require("../src/config.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const A = require("../src/adventure.js");
const T0 = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function ok(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result; }
function fresh() { const state = S.defaultState(T0); ok(A.ensure(state, T0)); return state; }
function afterHarvest() { const s = fresh(); s.adventure.claimed.c1_homecoming = true; s.adventure.quests.c1_homecoming.status = "claimed"; s.adventure.claimed.c1_first_harvest = true; s.adventure.quests.c1_first_harvest.status = "claimed"; return s; }
function festivalState() { const s = fresh(); s.adventure.r61.festival.unlocked = true; s.adventure.r61.festival.startsAt = T0; s.adventure.r61.festival.endsAt = 0; s.adventure.r61.festival.nextAt = 0; return s; }

test("1 可收成時任務卡、田邊提示與手札共用同一個下一步，並帶成熟田格", () => {
  const s = afterHarvest(); s.plots[0] = { id: "p01", cropId: "wheat", plantedAt: T0 - C.CROPS.wheat.growMs - 1 };
  const next = A.nextFarmStep(s, T0); const early = A.earlyGoals(s, T0); const world = fs.readFileSync("src/world-ui.js", "utf8");
  assert.equal(next.action, "harvest"); assert.equal(next.tileId, s.map.tiles.find((tile) => tile.plotIndex === 0).id); assert.equal(early.nextStep.detail, next.text); assert.equal(early.nextStep.actionLabel, next.actionLabel);
  assert.match(world, /A\.nextFarmStep/); assert.match(world, /data-next-tile/); assert.match(world, /mainStep \? mainStep\.text/); assert.match(world, /goNextFarmStep/);
});

test("2 做出麥餅不完成，吃下麥餅才完成第一餐", () => {
  const s = afterHarvest(); s.storage.items.wheat = 2; const cooked = ok(A.cook(s, "rustic_bread", T0 + 1));
  assert.equal(cooked.storyAdvance, null); assert.equal(s.adventure.claimed.c1_first_meal, undefined); assert.equal(A.nextFarmStep(s, T0 + 2).action, "eat");
  const eaten = ok(A.eatMeal(s, "rustic_bread", T0 + 3)); assert.equal(eaten.storyAdvance.ok, true); assert.equal(s.adventure.claimed.c1_first_meal, true);
});

test("3 新存檔前三格小麥最長只等十秒，教學送兩包但第一格仍要付費", () => {
  const s = fresh(); s.story.questId = "plant_wheat";
  A.record(s, { type: "talk", npcId: "mayor" }, T0); ok(G.plant(s, 0, "wheat", T0)); A.record(s, { type: "plant", cropId: "wheat" }, T0); const tutorial = ok(A.finishTutorial(s, T0));
  assert.deepEqual(tutorial.tutorialSeeds, { wheat: 2 }); assert.equal(s.adventure.r58.r59.seedPacks.wheat, 2); const coinsAfterTutorial = s.coins;
  ok(G.plant(s, 1, "wheat", T0)); ok(G.plant(s, 2, "wheat", T0));
  const waits = s.plots.slice(0, 3).map((plot) => G.getCropProgress(s, plot, T0).remainingMs);
  assert.ok(Math.max(...waits) <= 10000, JSON.stringify(waits)); assert.equal(s.coins, coinsAfterTutorial); assert.equal(s.adventure.r58.r59.seedPacks.wheat, 0); assert.equal(G.harvest(s, 0, T0 + 10000).ok, true);
});

test("4 今日三件事分別是種田、修建、社交", () => {
  const s = fresh(); s.adventure.claimed.c1_homecoming = true; s.adventure.quests.c1_homecoming.status = "claimed";
  assert.deepEqual(A.earlyGoals(s, T0).goals.map((goal) => goal.type), ["farming", "repair", "social"]);
});

test("5 作物評比列三樣明細、加分來源、補星提示與拉開獎勵", () => {
  const one = festivalState(); one.storage.items.wheat = 3; const oneResult = ok(A.judgeFestivalEntry(one, ["wheat", "wheat", "wheat"], T0 + 1));
  assert.equal(oneResult.details.length, 3); assert.match(oneResult.tip, /三種不同品項/); assert.equal(oneResult.reward.coins, 8);
  const three = festivalState(); Object.assign(three.storage.items, { radish: 1, carrot: 1 }); three.adventure.meals.rustic_bread = 1; const result = ok(A.judgeFestivalEntry(three, ["radish", "carrot", "rustic_bread"], T0 + 1));
  assert.equal(result.stars, 3); assert.ok(result.details.some((row) => row.sources.includes("料理 +1"))); assert.match(result.rewardText, /50 金.*專屬.*河畔豐收拼盤/); assert.match(fs.readFileSync("src/world-ui.js", "utf8"), /result\.details.*result\.tip.*result\.rewardText/);
});

test("6 整合：成熟以遊戲判斷為準、第 4 章起手札不用前期下一步、三件事不重複收成提示", () => {
  const state = fresh(); ok(A.finishTutorial ? { ok: true } : { ok: true });
  state.adventure.claimed.c1_homecoming = true;
  state.plots[0] = Object.assign({}, state.plots[0], { cropId: "wheat", plantedAt: T0 - 999999, wateredAt: 0 });
  const saved = global.getCropProgress;
  global.getCropProgress = () => ({ ready: false });
  try { assert.notEqual(A.nextFarmStep(state, T0).action, "harvest", "遊戲說還沒熟時，不可叫玩家收成"); }
  finally { if (saved) global.getCropProgress = saved; else delete global.getCropProgress; }
  global.getCropProgress = () => ({ ready: true });
  try { assert.equal(A.nextFarmStep(state, T0).action, "harvest"); }
  finally { if (saved) global.getCropProgress = saved; else delete global.getCropProgress; }
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  assert.match(world, /main && q\.chapter === 1 && A\.nextFarmStep/, "只有第 1 章主線卡可用前期下一步");
  assert.match(world, /hint\.kind === "ready" && early\.goals\.some\(\(goal\) => goal\.id === "harvest" && !goal\.complete\)/, "收成提示已在班伯項目內時不另列一行");
});

console.log(`VERIFIED content R65A systems (${passed}/6)`);
if (process.exitCode) process.exit(1);
