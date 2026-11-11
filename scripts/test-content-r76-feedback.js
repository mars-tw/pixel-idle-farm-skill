"use strict";
/* R76A：追光入帳、光性預覽、料理等級時間、季節文字與升級卡。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const State = require("../src/state.js");
const Game = require("../src/game.js");
const Sun = require("../src/sunplay-r75.js");
const Cooking = require("../src/cooking-r75.js");
const C = require("../src/config.js");
const T = 1794172800000;
function fresh() { const s = State.defaultState(T); Sun.normalize(s); s.coins = 999; return s; }
function readyInLight(s, cropId, hits) {
  s.level = Math.max(s.level, C.CROPS[cropId].unlockLevel); s.upgrades.plotCount = 1;
  assert.equal(Game.plant(s, 0, cropId, T).ok, true);
  s.plots[0].plantedAt = T - Game.plotGrowMs(s, s.plots[0], T) - 1;
  for (let i = 0; i < (hits || 0); i++) Sun.recordExposure(s, 0);
  Object.assign(s.sun, { plots: [0], used: [], startsAt: T - 1, endsAt: T + 10000, durationMs: 10001 });
}

{
  const s = fresh(); readyInLight(s, "wheat", 0); const r = Game.harvest(s, 0, T, () => 1);
  assert.equal(r.sun.bonus, 1); assert.equal(r.sun.sunlight, 2); assert.equal(Sun.sunlight(s), 2); assert.equal(r.added, C.CROPS.wheat.yield + 1);
  assert.doesNotMatch(JSON.stringify(r), /\+0/);
}
{
  const s = fresh(); readyInLight(s, "carrot", 0); const preview = Sun.harvestPreview(s, s.plots[0], true); assert.match(preview.text, /照 1 次.*優質/);
  const r = Game.harvest(s, 0, T, () => 1); assert.equal(r.lightTrait.source, "半日照優質"); assert.equal(r.quality, true); assert.equal(r.sun.sunlight, 1);
}
{
  const s = fresh(); readyInLight(s, "carrot", 1); assert.match(Sun.harvestPreview(s, s.plots[0], true).text, /照 2 次：曬過頭/);
  const r = Game.harvest(s, 0, T, () => 1); assert.equal(r.lightTrait.source, "半日照曬過頭"); assert.equal(r.quality, false);
}
{
  const s = fresh(); s.level = 4; assert.equal(Game.plant(s, 0, "strawberry", T).ok, true); s.plots[0].plantedAt = T - Game.plotGrowMs(s, s.plots[0], T) - 1;
  assert.match(Sun.harvestPreview(s, s.plots[0], false).text, /保持陰涼整批優質/); const r = Game.harvest(s, 0, T, () => 0); assert.equal(r.quality, true); assert.equal(r.added, (s.storage.quality || {}).strawberry);
}
{
  assert.equal(Cooking.scaledDurationMs(180000, "home"), 180000);
  assert.equal(Cooking.durationText(Cooking.scaledDurationMs(180000, "tasty")), "3 分 45 秒");
  assert.equal(Cooking.durationText(Cooking.scaledDurationMs(180000, "perfect")), "4 分 30 秒");
  assert.match(Cooking.gradeEffectText({ effect: { durationMs: 180000, summary: "成長加速。" } }, "perfect"), /3 分鐘 → 4 分 30 秒.*好感多 1/);
}
{
  const spring = fresh(); spring.level = 1; assert.equal(Game.cropSeasonMultiplier(spring, "pea", T), 0.85); assert.equal(Game.cropSeasonMultiplier(spring, "corn", T), 1.15);
  spring.level = 6; spring.season = { id: "夏", untilMs: T + 60000 }; assert.equal(Game.cropSeasonMultiplier(spring, "corn", T), 0.85); assert.equal(Game.cropSeasonMultiplier(spring, "pea", T), 1.15);
}
{
  const state = fresh(); state.level = 6; const card = Game.milestoneCard("level_up", { level: 6, state, now: T });
  assert.notEqual(card.earned, card.unlocked); assert.match(card.unlocked, /季節|四季/); assert.equal(card.next, require("../src/adventure.js").nextFarmStep(state, T).text);
  assert.match(Game.levelUnlocks(2).map((x) => x.name).join("、"), /曬架/); assert.match(Game.levelUnlocks(3).map((x) => x.name).join("、"), /手鏡/); assert.match(Game.levelUnlocks(4).map((x) => x.name).join("、"), /蓄光瓶/); assert.match(Game.levelUnlocks(5).map((x) => x.name).join("、"), /天氣/);
}
const ui = fs.readFileSync("src/ui.js", "utf8");
assert.doesNotMatch(ui, /陽光 \+" \+ r\.sun\.bonus/); assert.doesNotMatch(ui, /toast\("🎉 升/); assert.match(ui, /Lv 6 起換季/); assert.match(ui, /harvestRemainingMs/); assert.match(ui, /forageRemainingMs/);
console.log("VERIFIED content R76A feedback");
