"use strict";
/* R66 A 線：每日五選三、主線保留、收穫祭接續、世界小事件。 */
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
function fresh() { const state = S.defaultState(T0); ok(A.ensure(state, T0)); state.adventure.claimed.c1_homecoming = true; state.adventure.quests.c1_homecoming.status = "claimed"; return state; }

test("1 今日提供五類候選、挑三件、第一天主線不可換且每天只能換一件", () => {
  const s = fresh(); const view = A.earlyGoals(s, T0);
  assert.equal(view.candidates.length, 5); assert.deepEqual(view.candidates.map((row) => row.type), ["farming", "repair", "social", "explore", "cooking"]);
  assert.equal(A.chooseDailyGoals(s, ["dock", "market", "cook"], T0).reason, "story_locked");
  ok(A.chooseDailyGoals(s, ["harvest", "market", "cook"], T0));
  assert.equal(A.swapDailyGoal(s, "harvest", "dock", T0).reason, "story_locked");
  ok(A.swapDailyGoal(s, "market", "forage", T0)); assert.equal(A.swapDailyGoal(s, "cook", "market", T0).reason, "already_swapped");
  const world = fs.readFileSync("src/world-ui.js", "utf8"); assert.match(world, /今日五選三/); assert.match(world, /換一件今日事項/);
});

test("2 五類有不同獎勵，全完成另有小獎", () => {
  const s = fresh(); s.adventure.claimed.c1_first_harvest = true; s.adventure.quests.c1_first_harvest.status = "claimed";
  ok(A.chooseDailyGoals(s, ["harvest", "forage", "cook"], T0));
  s.adventure.counts.forage = 1; s.adventure.counts.cook = 1; const before = s.coins;
  const result = ok(A.claimDailyGoals(s, T0)); assert.equal(result.reward.coins, 15); assert.equal(result.reward.seedPacks.carrot, 1); assert.equal(result.reward.items.wheat, 1); assert.equal(s.coins, before + 15);
});

test("3 訂單可用數先扣主線保留，並提示再種幾格與秒數", () => {
  const s = fresh(); s.storage.items.wheat = 4; s.orders = [{ id: "wheat", wants: { wheat: 3 } }];
  const row = G.orderAllocationFor(s, "wheat"); assert.equal(row.items.wheat.storyReserve, 2); assert.equal(row.items.wheat.available, 2); assert.equal(row.ready, false);
  const text = G.orderAllocationText(s, s.orders[0]); assert.match(text, /主線保留 2 份/); assert.match(text, new RegExp(`再種 1 格小麥（約 ${Math.ceil(C.CROPS.wheat.growMs / 1000)} 秒）`));
});

test("4 開祭時沒有番茄會送三包種子，三個目標在十分鐘內可完成", () => {
  const s = fresh(); s.level = 9; s.adventure.r61.festival.unlocked = true; s.adventure.r61.festival.startsAt = T0; s.adventure.r61.festival.endsAt = 0;
  const status = A.festivalStatus(s, T0); assert.equal(status.active, true); assert.equal(s.adventure.r58.r59.seedPacks.tomato, 3); assert.match(status.supportMessage, /送你 3 包番茄種子.*先去種番茄.*秒/); assert.equal(status.goals.length, 3); assert.ok(status.goals.every((goal) => goal.required <= 3)); assert.ok(C.CROPS.tomato.growMs < 600000);
});

test("5 烏鴉與小雞會成為世界可點物件，點後才選擇，兩分鐘逾時寫入日誌", () => {
  for (const [roll, id] of [[0.26, "crow_steal"], [0.99, "lost_chick"]]) { const s = fresh(); s.adventure.r58.nextEventAt = T0; let n = 0; ok(A.maybeTriggerRandomEvent(s, T0, () => n++ ? 0 : roll)); const object = A.worldEventObject(s, T0); assert.equal(object.id, id); assert.ok(object.tileId); assert.ok(object.options.length >= 2); }
  const s = fresh(); s.storage.items.wheat = 1; s.adventure.r58.nextEventAt = T0; let n = 0; ok(A.maybeTriggerRandomEvent(s, T0, () => n++ ? 0 : 0.26));
  const settled = A.settleExpiredWorldEvent(s, T0 + 180001); assert.equal(settled.choiceId, "timeout"); assert.match(settled.journalText, /叼走了 1 份小麥/); assert.equal(s.storage.items.wheat, undefined); assert.equal(s.adventure.r58.r59.journal.at(-1).choiceId, "timeout");
  assert.match(fs.readFileSync("src/world-ui.js", "utf8"), /paintR66WorldEvent.*data-r66a-event-choice/s);
});

test("6 新存檔前三格小麥最長等待仍不超過十秒", () => {
  const s = S.defaultState(T0); ok(A.ensure(s, T0)); s.story.questId = "plant_wheat"; A.record(s, { type: "talk", npcId: "mayor" }, T0); ok(G.plant(s, 0, "wheat", T0)); A.record(s, { type: "plant", cropId: "wheat" }, T0); ok(A.finishTutorial(s, T0)); ok(G.plant(s, 1, "wheat", T0)); ok(G.plant(s, 2, "wheat", T0)); assert.ok(Math.max(...s.plots.slice(0, 3).map((plot) => G.getCropProgress(s, plot, T0).remainingMs)) <= 10000);
});

console.log(`VERIFIED content R66A systems (${passed}/6)`);
if (process.exitCode) process.exit(1);
