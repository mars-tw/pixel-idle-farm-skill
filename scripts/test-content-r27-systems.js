'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../src/config.js');
const S = require('../src/state.js');
const G = require('../src/game.js');
const A = require('../src/adventure.js');
const D = require('../src/daily.js');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const ui = read('src/ui.js');
const world = read('src/world-ui.js');
const daily = read('src/daily.js');
const adventure = read('src/adventure.js');
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (error) { console.error('  ✗ ' + name + '\n    ' + error.stack); process.exitCode = 1; }
}

test('新存檔首輪六份小麥可完成班伯主線，且市集不重複扣同一份交付', () => {
  let now = 1800000000000;
  const state = S.defaultState(now);
  assert.ok(C.GAME.startCoins >= C.CROPS.wheat.seedCost * 3);
  assert.ok(G.activePlotCount(state) >= 3);
  A.record(state, { type: 'talk', npcId: 'mayor' }, now);
  for (let i = 0; i < 3; i++) {
    assert.equal(G.plant(state, i, 'wheat', now).ok, true);
    A.record(state, { type: 'plant', cropId: 'wheat' }, now);
    assert.equal(G.waterPlot(state, i, now).ok, true);
    A.record(state, { type: 'water', cropId: 'wheat' }, now);
    D.record(state, 'water', 1, now);
  }
  assert.equal(A.claim(state, 'c1_homecoming', now).ok, true);
  now += C.CROPS.wheat.growMs;
  for (let i = 0; i < 3; i++) {
    const harvest = G.harvest(state, i, now);
    assert.equal(harvest.ok, true);
    A.record(state, { type: 'harvest', cropId: 'wheat', count: harvest.added }, now);
  }
  assert.equal(state.storage.items.wheat, 6);
  A.record(state, { type: 'talk', npcId: 'elder' }, now);
  assert.equal(A.claim(state, 'c1_first_harvest', now).ok, true);
  assert.equal(state.storage.items.wheat, 4);
  const orders = G.refreshOrders(state, now, () => 0);
  assert.ok(orders.every((order) => Object.keys(order.wants).every((id) => C.CROPS[id].unlockLevel <= state.level)));
  assert.equal(G.orderConsumesStoryReserve(state, orders.find((o) => o.id === 'beginner_wheat_2')), false); // R57：首批第一張改為 4 份大單（刻意與主線搶小麥），2 份小單仍不動用主線保留
  assert.deepEqual(D.status(state, now).tasks.map((row) => row.id), ['water', 'talk', 'sell']);
  assert.equal(state.storage.items.wheat || 0, 4, '每日目標不再消耗主線小麥');
});

test('開場與主線統一把兩份小麥交給班伯，每日目標改成不同動作', () => {
  assert.match(adventure, /id: "c1_first_harvest"[\s\S]*?交給老農班伯 2 份小麥[\s\S]*?wants: \{ wheat: 2 \}/);
  assert.match(world, /先收成、修釣台，或去跟蘿拉打招呼/);
  assert.match(world, /先去找鎮長葛瑞，再親手種下第一格/);
  assert.match(world, /id="worldSunBegin">去見鎮長葛瑞/);
  assert.doesNotMatch(world, /給葛瑞送一籃/);
  assert.deepEqual(D.status(S.defaultState(1800000000000), 1800000000000).tasks.map((row) => row.id), ['water', 'talk', 'sell']);
  const state = S.defaultState(1800000000000);
  A.ensure(state, 1800000000000); state.adventure.claimed.c1_first_harvest = true;
  const orders = G.refreshOrders(state, 1800000000000, () => 0);
  assert.ok(orders.every((order) => Object.keys(order.wants).every((id) => C.CROPS[id].unlockLevel <= state.level)));
  assert.match(ui, /把 2 份小麥交給老農班伯後開放/);
});

test('訂單卡不再用可選文案解釋主線，缺料與丟棄操作仍完整', () => {
  assert.doesNotMatch(ui, /class="o-optional"/);
  assert.match(ui, /class="btn buy small ful" \$\{can \? "" : "disabled"\}>\$\{can \? \(storyImpact && storyImpact\.risky \? "交付前請確認" : "交付"\)/);
  assert.match(ui, /fulfill\.dataset\.confirmed !== "true"/);
  assert.match(ui, /class="btn ghost small order-go"[^>]*>去田裡</);
  assert.match(ui, /requestOrderTrash\(o\.id\)/);
  assert.match(ui, /確認丟棄/);
  const state = S.defaultState(1800000000000);
  A.ensure(state, 1800000000000); state.adventure.claimed.c1_first_harvest = true;
  const order = G.refreshOrders(state, 1800000000000, () => 0)[0];
  assert.equal(G.orderMissingText(state, order), '還缺小麥 ×2');
  state.storage.items.wheat = 2;
  assert.equal(G.orderMissingText(state, order), '交付');
});

test('成熟格、背包名稱、升級實價與設定目前狀態皆有明確標籤', () => {
  assert.match(world, /田裡有 \$\{readyCount\} 格可以收成/);
  assert.match(ui, /class="res-name">背包<\/span>/);
  assert.match(ui, /title="背包：\$\{used\} 份／\$\{cap\} 份/);
  assert.match(ui, /\$\{fmtNum\(next\.cost\)\} 金（還差 \$\{fmtNum\(shortfall\)\}）/);
  assert.match(ui, /目前：\$\{enabled \? "開" : "關"\}/);
  assert.doesNotMatch(ui.slice(ui.indexOf('function settingRowHtml'), ui.indexOf('function soundVolumeHtml')), />\$\{enabled \? "開啟" : "關閉"\}<\/button>/);
});

test('市集開放後提供可儲存、可切換的兩條實際路線', () => {
  assert.match(ui, /function earlyChoiceRoutes\(farmState\)/);
  assert.match(ui, /AdventureAPI\.firstChoiceStatus\(farmState\)/);
  assert.match(ui, /先做農家麥餅/);
  assert.match(ui, /先接蘿拉的 4 份大單/);
  assert.match(world, /A\.trackFirstPath/);
  assert.match(world, /A\.chooseFirstPath/);
  assert.match(world, /window\.FarmEarlyChoiceRoutesHtml/);
});

console.log(`\nR27 A 線系統與狀態測試：${passed} 項通過。`);
if (process.exitCode) process.exit(1);
