"use strict";
/* R80B：單一動作入口、同拍秒數、動態早市換算、教學後親手收成與一致用語。 */
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const State = require("../src/state.js"), Sun = require("../src/sunplay-r75.js"), Game = require("../src/game.js"), A = require("../src/adventure.js");
const T = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function fresh() { const s = State.defaultState(T); Sun.normalize(s); A.ensure(s, T); s.coins = 200; s.stats.plantCount = 9; return s; }
function ready(s, index, cropId = "wheat") { assert.equal(Game.plant(s, index, cropId, T, "water").ok, true); s.plots[index].plantedAt = T - Game.plotGrowMs(s, s.plots[index], T) - 1; }
function preview(s, index, milliseconds = 7000) { Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [index], previewAt: T + milliseconds, nextAt: T + milliseconds, refractions: 0 }); }
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("1 所有光倒數共用同一拍快照", () => {
  const s = fresh(); ready(s, 0); preview(s, 0, 1500);
  assert.equal(Sun.refreshLightCountdown(s.sun, T).seconds, 2);
  assert.equal(Sun.lightSecondsText(s.sun, T + 999), "2 秒", "同一刷新週期不因另一個 Date.now 跨界而變成 1 秒");
  assert.equal(Game.lightHarvestChoice(s, 0, T + 999).seconds, 2);
  assert.equal(Sun.refreshLightCountdown(s.sun, T + 1001).seconds, 1);
  assert.equal(Game.lightHarvestChoice(s, 0, T + 1001).seconds, 1);
});

test("2 早市按畫面訂單單價換算，兩邊差距不超過兩成", () => {
  const s = fresh(); s.stats.harvested.wheat = 1; s.sun.spawned = 1; s.orders = [{ id: "shown_wheat", wants: { wheat: 4 }, rewardCoins: 29 }]; ready(s, 0); preview(s, 0);
  const c = Game.lightHarvestChoice(s, 0, T);
  assert.equal(c.kind, "market"); assert.equal(c.orderUnitCoins, 7.25); assert.equal(c.nowCoins, 15);
  assert.equal(c.nowValueCoins, 29.5); assert.equal(c.waitValueCoins, 29); assert.ok(c.valueGapRatio <= 0.2, `價值差 ${c.valueGapRatio}`);
  assert.match(c.nowText, /訂單每份 7\.25 金/); assert.match(c.waitText, /陽光 2（可催熟 1 格）/);
  const mixed = fresh(); mixed.stats.harvested.wheat = 1; mixed.sun.spawned = 1; mixed.orders = [{ id: "shown_mixed", wants: { wheat: 2, carrot: 2 }, rewardCoins: 20 }]; ready(mixed, 0); preview(mixed, 0);
  const m = Game.lightHarvestChoice(mixed, 0, T);
  assert.equal(m.orderUnitCoins, 2.5); assert.equal(m.nowCoins, 5); assert.equal(m.nowValueCoins, 10); assert.equal(m.waitValueCoins, 10); assert.equal(m.valueGapRatio, 0);
});

test("3 教學最多十秒且只有教學會自動等光", () => {
  assert.ok(Game.SUNPATCH.firstDelayMs <= 10000, `第一次等待 ${Game.SUNPATCH.firstDelayMs} 毫秒`);
  const tutorial = fresh(); ready(tutorial, 0); preview(tutorial, 0, 7000);
  const tq = Game.queueLightHarvest(tutorial, 0, T); assert.equal(tq.ok, true); assert.equal(Game.lightHarvestQueue(tutorial).autoHarvest, true); assert.match(tq.choice.helpText, /自動收成/);
  const market = fresh(); market.stats.harvested.wheat = 1; market.sun.spawned = 1; market.orders = [{ id: "shown", wants: { wheat: 2 }, rewardCoins: 14 }]; ready(market, 0); preview(market, 0, 7000);
  const mq = Game.queueLightHarvest(market, 0, T); assert.equal(mq.ok, true); assert.equal(Game.lightHarvestQueue(market).autoHarvest, false); assert.equal(mq.choice.helpText, "已選等光；光到了要自己收成");
  assert.equal(Game.updateSunpatch(market, T + 7000, () => 0).spawned, true);
  assert.equal(market.plots[0].cropId, "wheat", "教學後光到了不自動收"); assert.equal(market.flags.r79LightChoiceCount, 1, "選擇在光落下時結算一次");
  const out = Game.harvest(market, 0, T + 7001, () => 1); assert.equal(out.ok, true); assert.equal(out.lightChoice.waited, true); assert.equal(out.lightChoice.autoHarvest, false);
});

test("4 選了等光後，等待期間會指向另一件農事", () => {
  const s = fresh(); s.adventure.claimed.c1_homecoming = true; s.stats.harvested.wheat = 1; s.sun.spawned = 1; s.orders = [{ id: "shown", wants: { wheat: 2 }, rewardCoins: 14 }];
  ready(s, 0); assert.equal(Game.plant(s, 1, "wheat", T, "water").ok, true); delete s.plots[1].wateredAt; preview(s, 0, 7000);
  assert.equal(Game.queueLightHarvest(s, 0, T).ok, true);
  const next = A.nextFarmStep(s, T + 1);
  assert.equal(next.action, "tend"); assert.equal(next.plotIndex, 1); assert.equal(next.holdPlotIndex, 0); assert.match(next.text, /先替另一格小麥澆水/);
});

test("5 第一次收成前沒有折光田字，完成後只用同一種說法", () => {
  const s = fresh(); ready(s, 0); preview(s, 1, 7000); s.interaction.selectedTileId = s.map.tiles.find((tile) => tile.plotIndex === 0).id;
  assert.equal(Sun.refractGhostPlot(s, T), null); assert.deepEqual(Sun.plotActions(s, 0, T), []);
  s.flags.r79FirstLightHarvest = true;
  assert.equal(Sun.refractGhostPlot(s, T), 0); assert.deepEqual(Sun.plotActions(s, 0, T).map((row) => row.action), ["refract"]);
  const sources = ["src/ui.js", "src/adventure.js", "src/game.js", "src/sunplay-r75.js", "src/world-ui.js"].map(read).join("\n");
  assert.doesNotMatch(sources, /等光再澆水|留著水，等光落下再澆/);
  assert.match(read("src/ui.js"), /把光折到這裡/); assert.match(read("src/content-r58b.css"), /R80B[\s\S]*content:\s*"把光折到這裡"/);
});

test("6 任務卡與手機大鈕採單一動作規則", () => {
  const world = read("src/world-ui.js"), ui = read("src/ui.js"), css = read("src/content-r58b.css");
  assert.match(world, /r80bFieldActionShown/); assert.match(world, /data-r80b-task-copy/); assert.match(world, /光快到了，請在田邊選一種收成方式/);
  assert.match(world, /r80b-objective-source/); assert.match(world, /r80b-objective-task/); assert.match(world, /data-audit="quest-progress"/);
  assert.match(ui, /dataset\.r80bDuplicate/); assert.match(css, /#actionA\[data-r80b-duplicate="true"\]/);
  const s = fresh(); assert.equal(Game.facingPlotLabel(s, s.map.tiles.find((tile) => tile.plotIndex === 0), T), "");
  assert.equal(Game.plant(s, 0, "wheat", T, "water").ok, true); assert.equal(Game.facingPlotLabel(s, s.map.tiles.find((tile) => tile.plotIndex === 0), T), "生長中・小麥田");
});

if (!process.exitCode) console.log(`R80B first-minute rules: ${passed} passed`);
