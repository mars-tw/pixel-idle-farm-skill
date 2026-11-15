"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const C = require("../src/config.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const A = require("../src/adventure.js");
const T = Date.parse("2026-11-05T09:00:00+08:00");
const source = (path) => fs.readFileSync(path, "utf8");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }
function unlockMarket(state) { A.ensure(state, T); state.adventure.claimed.c1_first_harvest = true; }

test("A1 市集在班伯交付前為空，交付後首批委託人不混用葛瑞或班伯", () => {
  const state = S.defaultState(T);
  assert.deepEqual(G.refreshOrders(state, T, () => 0.1), []);
  assert.match(source("src/ui.js"), /把 2 份小麥交給老農班伯後開放/);
  unlockMarket(state);
  const orders = G.refreshOrders(state, T, () => 0.1);
  assert.equal(orders.length, C.GAME.orderSlots);
  assert.ok(orders.every((order) => !["mayor", "elder"].includes(order.npcId)));
  assert.doesNotMatch(source("src/ui.js"), /主線保留 2 份小麥|交付後會動用主線保留/);
});

test("A2 第一章交付後至少一項建物可建，且建造清單第一項就是它", () => {
  const state = S.defaultState(T);
  state.coins += 12 + 16;
  state.materials.wood += 10;
  state.materials.stone += 6;
  unlockMarket(state);
  const buildable = C.BUILDING_ORDER.filter((type) => G.canBuild(state, type));
  assert.ok(buildable.length >= 1);
  assert.equal(C.BUILDING_ORDER[0], buildable[0]);
  assert.equal(buildable[0], "compostHeap");
});

test("A3 四種關鍵事件皆產生結算卡資料", () => {
  const harvestState = S.defaultState(T);
  assert.equal(G.plant(harvestState, 0, "wheat", T).ok, true);
  const harvest = G.harvest(harvestState, 0, T + C.CROPS.wheat.growMs + 1);
  assert.equal(harvest.settlement.kind, "first_harvest");
  const questState = S.defaultState(T);
  A.record(questState, { type: "talk", npcId: "mayor" }, T);
  A.record(questState, { type: "plant", cropId: "wheat", count: 3 }, T);
  A.record(questState, { type: "water", cropId: "wheat", count: 3 }, T);
  assert.equal(A.claim(questState, "c1_homecoming", T).ok, true);
  A.record(questState, { type: "harvest", cropId: "wheat", count: 6 }, T);
  questState.storage.items.wheat = 2;
  const quest = A.claim(questState, "c1_first_harvest", T);
  assert.equal(quest.settlement.kind, "quest");
  G.refreshOrders(questState, T, () => 0.1);
  const order = questState.orders[0];
  questState.storage.items.wheat = order.wants.wheat + 2; // R66：訂單可用數先扣主線保留 2 份。
  const delivered = G.fulfillOrder(questState, order.id, T + 1, () => 0.1);
  assert.equal(delivered.settlement.kind, "order");
  const upgradeState = S.defaultState(T);
  upgradeState.coins = C.UPGRADES.growthSpeed.levels[0].cost;
  const upgraded = G.buyUpgrade(upgradeState, "growthSpeed");
  assert.equal(upgraded.settlement.kind, "upgrade");
  for (const result of [harvest, quest, delivered, upgraded]) {
    assert.equal(typeof result.settlement.coins, "number");
    assert.equal(typeof result.settlement.xp, "number");
    assert.ok(result.settlement.next.length > 0);
  }
});

test("A3 結算卡共用單一 FIFO 佇列，一次只顯示一張", () => {
  const ui = source("src/ui.js");
  assert.match(ui, /const feedbackQueue = G\.createFeedbackQueue \? G\.createFeedbackQueue\(\) : null/);
  assert.match(ui, /if \(settlementVisible\) return/);
  assert.match(ui, /feedbackQueue \? feedbackQueue\.next\(\) : settlementQueue\.shift\(\)/);
  assert.match(ui, /if \(feedbackQueue\) feedbackQueue\.close\(\)/);
  assert.match(ui, /setTimeout\(close, 2500\)/);
  assert.match(ui, /card\.onclick = close/);
  assert.match(ui, /data\.coins > 0[\s\S]*data\.xp > 0[\s\S]*filter\(Boolean\)[\s\S]*下一步：/);
});

test("A4 任務卡一般與收合摘要都含目前子目標進度", () => {
  const ui = source("src/ui.js"), world = source("src/world-ui.js");
  assert.match(ui, /data-audit="quest-progress">\$\{progress\.done\}\/\$\{progress\.total\}/);
  assert.match(ui, /qd-summary">\$\{action\} \$\{cur \? `\$\{progress\.done\}\/\$\{progress\.total\}`/);
  assert.match(world, /data-audit="quest-progress">\$\{esc\(progressText\)\}/);
});

test("A5 訂單倒數採中文分秒，對話關閉鍵明示略過", () => {
  const ui = source("src/ui.js"), world = source("src/world-ui.js");
  assert.match(ui, /`\$\{minutes\} 分 \$\{String\(seconds\)\.padStart\(2, "0"\)\} 秒`/);
  /* R80C 同步：關閉鍵改成跟下方對話框同一個字「晚點再說」（仍寫明是先不聽），主要鈕「聽完了」。 */
  assert.match(world, />晚點再說<\/button>/);
  assert.match(world, />聽完了<\/button>/);
});
console.log(`R30 content systems: ${passed} passed`);
