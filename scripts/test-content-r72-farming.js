"use strict";
/* R72A：三種照顧方式、優質作物、季節成長與前十分鐘節奏。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const C = require("../src/config.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const A = require("../src/adventure.js");
const T0 = 1794172800000;

function fresh() {
  const state = S.defaultState(T0);
  assert.equal(A.ensure(state, T0).ok, true);
  state.coins = 9999;
  state.materials.compost = 9;
  return state;
}
function plantReady(state, index, cropId, careMode) {
  const planted = G.plant(state, index, cropId, T0, careMode);
  assert.equal(planted.ok, true, JSON.stringify(planted));
  state.plots[index].plantedAt = T0 - G.plotGrowMs(state, state.plots[index], T0) - 1;
  return state.plots[index];
}

// 三種方式：時間、產量、種子與堆肥。
{
  const state = fresh();
  plantReady(state, 0, "wheat", "water");
  assert.equal(G.plotGrowMs(state, state.plots[0], T0), Math.floor(C.CROPS.wheat.growMs * 0.75));
  assert.equal(G.harvest(state, 0, T0, () => 0.99).added, C.CROPS.wheat.yield);

  plantReady(state, 1, "wheat", "compost");
  assert.equal(state.materials.compost, 8, "施堆肥種下時消耗 1 份堆肥");
  assert.equal(G.harvest(state, 1, T0, () => 0.99).added, C.CROPS.wheat.yield + 1, "堆肥固定多收 1 份");

  plantReady(state, 2, "wheat", "natural");
  assert.equal(G.plotGrowMs(state, state.plots[2], T0), Math.floor(C.CROPS.wheat.growMs * 1.2));
  const packsBefore = state.adventure.r58.r59.seedPacks.wheat || 0;
  const natural = G.harvest(state, 2, T0, () => 0.99);
  /* R78B 第 3 項同步：三種照顧方式拉開差距，「放著長」帶回的種子從 1 包改成 2 包（原本多等幾秒只多 1 包、種子才 1 金，幾乎沒理由選）。 */
  assert.equal(natural.seedBack, 2);
  assert.equal(state.adventure.r58.r59.seedPacks.wheat, packsBefore + 2);
}

// 固定亂數驗證 30% 優質機率，且優質庫存與一般庫存分開。
{
  const state = fresh();
  plantReady(state, 0, "wheat", "compost");
  const quality = G.harvest(state, 0, T0, () => 0.2999);
  assert.equal(quality.quality, true);
  assert.equal(state.storage.quality.wheat, C.CROPS.wheat.yield + 1);
  assert.equal(state.storage.items.wheat || 0, 0);
  plantReady(state, 1, "wheat", "compost");
  assert.equal(G.harvest(state, 1, T0, () => 0.30).quality, false);
}

// 訂單以優質份數補足庫存，整張優質訂單加價 50%。
{
  const state = fresh();
  state.adventure.claimed.c1_first_harvest = true;
  state.adventure.claimed.c1_first_meal = true;
  state.storage.quality.wheat = 2;
  state.orders = [{ id: "r72_quality_order", wants: { wheat: 2 }, rewardCoins: 20, rewardXp: 1, rarity: "common", expiresAt: T0 + 999999 }];
  assert.equal(G.canFulfill(state, state.orders[0]), true);
  assert.equal(G.orderQualityBonus(state, state.orders[0]), 10);
  const before = state.coins;
  const result = G.fulfillOrder(state, "r72_quality_order", T0, () => 0.5);
  assert.equal(result.ok, true);
  assert.equal(result.qualityBonus, 10);
  assert.equal(result.qualityUsed, 2);
  assert.equal(state.coins - before, result.coins);
  assert.ok(result.coins >= 30, "優質基礎加價後仍可疊加既有成就／升級加成");
}

// 當季快 15%，非當季慢 15%；評比可把優質列為 +1 來源。
{
  const spring = fresh(); spring.level = 6; spring.season = { id: "春", untilMs: T0 + 999999 };
  assert.equal(G.cropSeasonMultiplier(spring, "radish", T0), 0.85);
  assert.equal(G.cropSeasonMultiplier(spring, "corn", T0), 1.15);
  spring.adventure.r61.festival.unlocked = true;
  spring.adventure.r61.festival.startsAt = T0; spring.adventure.r61.festival.endsAt = T0 + 600000; spring.adventure.r61.festival.nextAt = 0;
  spring.storage.quality.radish = 1; spring.storage.items.carrot = 1; spring.adventure.meals.rustic_bread = 1;
  const judged = A.judgeFestivalEntry(spring, ["quality:radish", "carrot", "rustic_bread"], T0 + 1);
  assert.equal(judged.ok, true);
  assert.equal(judged.scoreSources.quality, true);
  assert.ok(judged.details.some((row) => row.sources.includes("優質作物 +1")));
}

// 新手前三格不論選哪一種照顧方式，當下最長等待仍不超過 10 秒。
{
  const state = fresh(); state.story.questId = "plant_wheat";
  ["water", "compost", "natural"].forEach((mode, index) => assert.equal(G.plant(state, index, "wheat", T0, mode).ok, true));
  const waits = state.plots.slice(0, 3).map((plot) => G.getCropProgress(state, plot, T0).remainingMs);
  assert.ok(Math.max(...waits) <= 10000, JSON.stringify(waits));
}

const ui = fs.readFileSync("src/ui.js", "utf8"), css = fs.readFileSync("src/content-r58b.css", "utf8");
assert.match(ui, /r72a-care-picker/);
assert.match(ui, /r72a-plot-care/);
assert.match(ui, /交優質可多拿/);
assert.match(ui, /當季・快 15%/);
assert.match(css, /R72A/);
console.log("VERIFIED content R72A farming");
