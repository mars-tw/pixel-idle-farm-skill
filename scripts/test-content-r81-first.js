"use strict";
/* R81B：第一分鐘只在田邊動作列說秒數與收益，任務卡與田上標籤各留一層狀態。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const State = require("../src/state.js"), Sun = require("../src/sunplay-r75.js"), Game = require("../src/game.js"), Adventure = require("../src/adventure.js");
const ROOT = path.resolve(__dirname, ".."), T = 1794172800000;
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function fresh() { const s = State.defaultState(T); Sun.normalize(s); Adventure.ensure(s, T); s.coins = 200; s.stats.plantCount = 9; return s; }

test("1 等光數字與收益由同一份規則提供給田邊動作列", () => {
  const s = fresh(); assert.equal(Game.plant(s, 0, "wheat", T, "water").ok, true);
  s.plots[0].plantedAt = T - Game.plotGrowMs(s, s.plots[0], T) - 1;
  Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: T + 7000, nextAt: T + 7000 });
  Sun.refreshLightCountdown(s.sun, T);
  const choice = Game.lightHarvestChoice(s, 0, T);
  assert.equal(choice.ok, true); assert.equal(choice.seconds, 7); assert.ok(choice.waitQty > choice.nowQty); assert.ok(choice.waitSunlight > 0);
  const ui = read("src/ui.js");
  assert.match(ui, /等 \$\{lightChoice\.seconds\} 秒・\$\{lightChoice\.waitQty\} 份＋陽光 \$\{lightChoice\.waitSunlight\}/);
  assert.match(ui, /dataset\.r81bDetail/);
  assert.match(ui, /lightChoice && lightChoice\.hasTradeoff\) b\.dataset\.r79bTradeoff/);
});

test("2 底部重複說明已移除，田上附註退出可見與輔助閱讀", () => {
  const ui = read("src/ui.js"), css = read("src/content-r58b.css");
  assert.doesNotMatch(ui, /r79bActionNote|r79bSyncActionNote/);
  assert.match(ui, /r78b-wait-choice[\s\S]*aria-hidden/);
  assert.match(ui, /r77a-refract-note[\s\S]*aria-hidden/);
  assert.match(css, /R81B（第一分鐘一處說明、手機橫式不重複）/);
  assert.match(css, /#tileStateLabel :is\(\.r78b-wait-choice, \.r77a-refract-note\)/);
  assert.match(css, /\.r75a-sun-preview \{ font-size: 0 !important; \}/);
});

test("3 右下大鈕跟著成熟狀態", () => {
  const s = fresh(), tile = s.map.tiles.find((row) => row.plotIndex === 0);
  assert.equal(Game.plant(s, 0, "wheat", T, "water").ok, true);
  assert.equal(Game.facingPlotLabel(s, tile, T), "生長中・小麥田");
  assert.doesNotMatch(Game.facingPlotLabel(s, tile, T), /收成/);
  s.plots[0].plantedAt = T - Game.plotGrowMs(s, s.plots[0], T) - 1;
  assert.equal(Game.facingPlotLabel(s, tile, T), "收成・小麥田");
});

test("4 開場便箋照實際流程，結算下一步顯示前重讀", () => {
  const world = read("src/world-ui.js"), ui = read("src/ui.js");
  assert.match(world, /先種下第一株小麥，跟著第一道光照料它，等麥穗成熟後親手收成。留好兩份小麥，再把第一份餐籃送給鎮長葛瑞。/);
  assert.match(world, /id="worldSunBegin">開始種小麥/);
  assert.doesNotMatch(world, /先去找鎮長葛瑞，再親手種下第一格/);
  assert.match(ui, /settlement\.kind === "first_harvest"[\s\S]*AdventureAPI\.nextFarmStep[\s\S]*result\.settlement\.next = live\.text/);
});

test("5 任務卡的光狀態不重複秒數與收益", () => {
  const world = read("src/world-ui.js");
  assert.match(world, /function r81bObjectiveStatus/);
  assert.match(world, /光快到了，請在田邊選一種收成方式。/);
  assert.match(world, /已選等光再收，光落下後回田邊在光裡收成。/); /* R83C 同步：統一說法 */
  assert.match(world, /const chipText = plots\.length \? `☀ 陽光正在/);
  assert.doesNotMatch(world, /const chipText = plots\.length \? `☀ 陽光照在 \$\{plots\.length\} 格田・剩/);
});

if (!process.exitCode) console.log(`R81B first-minute rules: ${passed} passed`);
