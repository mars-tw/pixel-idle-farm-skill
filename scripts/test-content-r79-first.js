"use strict";
/* R79B：第一分鐘數字、單一折光入口、第二輪等光取捨與負經驗防護。 */
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const State = require("../src/state.js"), Sun = require("../src/sunplay-r75.js"), Game = require("../src/game.js"), A = require("../src/adventure.js");
const T = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function fresh() { const s = State.defaultState(T); Sun.normalize(s); A.ensure(s, T); s.coins = 100; s.stats.plantCount = 9; return s; }
function ready(s, index) { assert.equal(Game.plant(s, index, "wheat", T, "water").ok, true); s.plots[index].plantedAt = T - Game.plotGrowMs(s, s.plots[index], T) - 1; }
function preview(s, index, seconds) { Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [index], previewAt: T + seconds * 1000, nextAt: T + seconds * 1000 }); }
const clone = (s) => JSON.parse(JSON.stringify(s));
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("1 陽光與份數由同一份收成結果產生", () => {
  const s = fresh(); ready(s, 0); preview(s, 0, 7);
  const choice = Game.lightHarvestChoice(s, 0, T);
  assert.equal(choice.kind, "tutorial"); assert.equal(choice.hasTradeoff, false);
  assert.deepEqual([choice.nowQty, choice.waitQty, choice.nowSunlight, choice.waitSunlight], [2, 3, 0, 2]);
  assert.equal(choice.tutorialText, "等 7 秒，光到了再收：3 份＋陽光 2（現在收只有 2 份）");
  const canonical = Sun.harvestOutcome(s, s.plots[0], { exposedNow: true, caughtSunlight: 1, baseQty: 2 });
  assert.deepEqual([canonical.quantity, canonical.sunlightTotal], [choice.waitQty, choice.waitSunlight]);
  assert.equal(Sun.traitText(s, "wheat"), "光裡收成多 1 份＋陽光 2");
});

test("2 第一次只教等光，按下後光到自動收", () => {
  const s = fresh(); ready(s, 0); preview(s, 0, 7);
  const queued = Game.queueLightHarvest(s, 0, T); assert.equal(queued.ok, true); assert.match(queued.choice.helpText, /按下後等 7 秒，光到會自動收成/);
  assert.match(read("src/world-ui.js"), /step\.action === "catch_sun"[\s\S]*queueLightHarvest/, "任務卡的唯一入口也會排入自動收成");
  assert.equal(Game.updateSunpatch(s, T + 7000, () => 0).spawned, true);
  const out = Game.harvest(s, 0, T + 7001, () => 1);
  assert.equal(out.added, 3); assert.equal(out.lightChoice.waited, true); assert.equal(Sun.sunlight(s), 2);
  assert.equal(s.flags.r79FirstLightHarvest, true); assert.equal(Game.lightHarvestQueue(s), null);
});

test("3 第二輪班伯早市兩邊各有一項較好", () => {
  const base = fresh(); base.stats.harvested.wheat = 3; base.sun.spawned = 1; ready(base, 0); preview(base, 0, 7);
  const choice = Game.lightHarvestChoice(base, 0, T); assert.equal(choice.kind, "market"); assert.equal(choice.hasTradeoff, true);
  assert.match(choice.nowText, /趕得上|班伯早市/); assert.match(choice.waitText, /沒有獎金/);
  const nowState = clone(base), waitState = clone(base), nowCoins = nowState.coins, waitCoins = waitState.coins;
  const nowOut = Game.harvest(nowState, 0, T + 1, () => 1);
  assert.equal(nowOut.added, choice.nowQty); assert.equal(nowOut.marketBonus, 14); assert.equal(nowState.coins - nowCoins, 14);
  assert.equal(Game.queueLightHarvest(waitState, 0, T).ok, true); assert.equal(Game.updateSunpatch(waitState, T + 7000, () => 0).spawned, true);
  const waitOut = Game.harvest(waitState, 0, T + 7001, () => 1);
  assert.equal(waitOut.added, choice.waitQty); assert.equal(waitOut.marketBonus, 0); assert.equal(waitState.coins - waitCoins, 0);
  assert.ok(nowState.coins > waitState.coins, "現在收的金幣較好"); assert.ok(waitOut.added > nowOut.added, "等光的份數較好"); assert.equal(Sun.sunlight(waitState), 2, "等光另有陽光");
});

test("4 每隔三道光再出現限時取捨，折光入口依教學進度切換", () => {
  const s = fresh(); s.stats.harvested.wheat = 3; s.flags.r79LightChoiceCount = 1; s.flags.r79LightChoiceLastBeam = 2; s.sun.spawned = 3; ready(s, 0); preview(s, 0, 7);
  assert.equal(Game.lightHarvestChoice(s, 0, T).kind, "plain");
  s.sun.spawned = 5; assert.equal(Game.lightHarvestChoice(s, 0, T).kind, "order");
  s.sun.previewPlots = [1]; assert.deepEqual(Sun.plotActions(s, 0, T).map((x) => x.action), [], "第一次光裡收成前田格沒有折光按鈕");
  s.flags.r79FirstLightHarvest = true; assert.deepEqual(Sun.plotActions(s, 0, T).map((x) => x.action), ["refract"], "完成後只留田格折光入口");
});

test("5 負經驗存檔不再顯示或延續負值", () => {
  const s = fresh(); s.xp = -90; Game.addXp(s, 0); assert.equal(s.xp, 0);
  const ui = read("src/ui.js"); assert.match(ui, /const xpInLv = Math\.max\(0,/); assert.match(ui, /normalToastQueue/);
  assert.doesNotMatch(read("src/adventure.js"), /多接 1 點陽光/);
  assert.doesNotMatch(read("src/sunplay-r75.js"), /多得 1 點陽光/);
});

test("6 第一次收成後三處都指向老農班伯", () => {
  const s = fresh(); s.adventure.claimed.c1_homecoming = true; A.ensure(s, T);
  assert.equal(A.record(s, { type: "harvest", cropId: "wheat", count: 3 }, T + 1).ok, true);
  s.storage.items.wheat = 3;
  const next = A.nextFarmStep(s, T + 2), current = A.summary(s, T + 2).currentQuest;
  assert.equal(current.id, "c1_first_harvest"); assert.equal(current.npcId, "elder"); assert.equal(next.target, "elder"); assert.equal(next.action, "deliver");
  const world = read("src/world-ui.js"); assert.match(world, /result\.settlement\.kind === "first_harvest"/); assert.match(world, /const taskName = q \? \(activeGoal/);
});

test("6b 還沒找鎮長就收成時，下一步、任務卡、驚嘆號都指向鎮長（R79 整合）", () => {
  const s = fresh(); A.ensure(s, T);
  assert.equal(A.record(s, { type: "harvest", cropId: "wheat", count: 3 }, T + 1).ok, true);
  s.storage.items.wheat = 3;
  const next = A.nextFarmStep(s, T + 2), current = A.summary(s, T + 2).currentQuest;
  assert.equal(current.id, "c1_homecoming"); assert.equal(current.npcId, "mayor");
  assert.equal(next.action, "report"); assert.equal(next.target, "mayor"); assert.equal(next.questId, "c1_homecoming");
  assert.doesNotMatch(next.text, /班伯/, "還沒找鎮長時，下一步不得叫玩家去找班伯");
});

if (!process.exitCode) console.log(`R79B first-minute rules: ${passed} passed`);
