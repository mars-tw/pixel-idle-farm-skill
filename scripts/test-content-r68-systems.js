"use strict";
/* R68A：第 1 章四個提示面共用 nextFarmStep，成熟田格優先。 */
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
function fresh() { const state = S.defaultState(T0); A.ensure(state, T0); return state; }

test("成熟作物永遠先於陽光倒數與其他動作", () => {
  const state = fresh();
  state.plots[0] = { cropId: "wheat", plantedAt: T0 - C.CROPS.wheat.growMs - 1, wateredAt: T0 - C.CROPS.wheat.growMs - 1 };
  state.sun = { plots: [0], used: [], startsAt: T0 - 1000, endsAt: T0 + 15000, nextAt: T0 + 60000, durationMs: 16000 };
  const step = A.nextFarmStep(state, T0);
  assert.equal(step.action, "harvest");
  assert.equal(step.tileId, state.map.tiles.find((tile) => tile.plotIndex === 0).id);
  assert.match(step.text, /點一下收成：多收 1 份＋陽光 2/);
});

test("收成結算的下一步直接等於 nextFarmStep", () => {
  const state = fresh();
  state.plots[0] = { cropId: "wheat", plantedAt: T0 - C.CROPS.wheat.growMs - 1, wateredAt: T0 - C.CROPS.wheat.growMs - 1 };
  const result = G.harvest(state, 0, T0);
  assert.ok(result.ok && result.settlement);
  assert.equal(result.settlement.next, A.nextFarmStep(state, T0).text);
});

test("第 1 章升級提示的下一步直接等於 nextFarmStep", () => {
  const state = fresh(); state.level = 2;
  const card = G.milestoneCard("level_up", { level: 2, state, now: T0 });
  assert.equal(card.next, A.nextFarmStep(state, T0).text);
});

test("任務卡、田邊泡泡、結算與手札主線都讀同一個下一步", () => {
  const adventure = fs.readFileSync("src/adventure.js", "utf8");
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  const ui = fs.readFileSync("src/ui.js", "utf8");
  const game = fs.readFileSync("src/game.js", "utf8");
  assert.match(adventure, /function nextFarmStep/);
  assert.match(world, /const nextFarm = A\.nextFarmStep/);
  assert.match(world, /const farmStep = main && q\.chapter === 1 && A\.nextFarmStep/);
  assert.match(ui, /可收成，點一下收成/);
  assert.match(game, /next: farmNextStepText\(state, now/);
  assert.match(game, /guideApi\.nextFarmStep\(data\.state, data\.now\)/);
});

test("玩家文字沒有英文縮寫時間", () => {
  const sources = ["src/adventure.js", "src/world-ui.js", "src/ui.js"].map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(sources.slice(sources.indexOf("R68A")), />[^<]*\b\d+m\b/);
});

console.log(`VERIFIED content R68A systems (${passed}/5)`);
if (process.exitCode) process.exit(1);
