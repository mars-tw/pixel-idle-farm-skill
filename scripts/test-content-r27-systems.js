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

test('新存檔首輪六份小麥可依序完成首章前兩項、班伯保留份、新手訂單與印章餐籃', () => {
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
    D.record(state, 'harvest', harvest.added, now);
  }
  assert.equal(state.storage.items.wheat, 6);
  A.record(state, { type: 'talk', npcId: 'elder' }, now);
  assert.equal(A.claim(state, 'c1_first_harvest', now).ok, true);
  assert.equal(state.storage.items.wheat, 4);
  state.story.questId = 'first_delivery';
  const order = G.refreshOrders(state, now, () => 0).find((row) => row.id === 'tutorial_first_delivery');
  assert.ok(order);
  assert.equal(order.npcId, 'elder');
  assert.deepEqual(order.wants, { wheat: 2 });
  assert.equal(G.fulfillOrder(state, order.id, now, () => 0).ok, true);
  assert.equal(D.status(state, now).tasks.find((row) => row.id === 'basket').ready, true);
  assert.equal(D.claim(state, 'basket', D.dayNumber(now), now).ok, true);
  assert.equal(state.storage.items.wheat || 0, 0);
});

test('開場、主線、訂單與印章冊統一留兩份小麥給班伯的灶台', () => {
  assert.match(adventure, /id: "c1_first_harvest"[\s\S]*?留 2 份小麥給班伯的灶台[\s\S]*?wants: \{ wheat: 2 \}/);
  assert.match(world, /留 2 份小麥給班伯的灶台/);
  assert.match(world, /種下第一把小麥，做陽光餐籃/);
  assert.doesNotMatch(world, /給葛瑞送一籃/);
  assert.match(daily, /留 2 份\$\{crop\.name\}給班伯的灶台/);
  const state = S.defaultState(1800000000000);
  state.story.questId = 'first_delivery';
  state.stats.harvested.wheat = 6;
  const order = G.refreshOrders(state, 1800000000000, () => 0)[0];
  assert.match(G.orderNarrative(state, order).offer, /留 2 份小麥給班伯的灶台/);
});

test('訂單卡有可選標籤、缺料主按鈕與獨立去田裡按鈕，丟棄維持二次確認', () => {
  assert.match(ui, /class="o-optional"[^>]*>可選</);
  assert.match(ui, /class="btn buy small ful" \$\{can \? "" : "disabled"\}>\$\{can \? "交付" : escapeHtml\(G\.orderMissingText/);
  assert.match(ui, /class="btn ghost small order-go"[^>]*>去田裡</);
  assert.match(ui, /requestOrderTrash\(o\.id\)/);
  assert.match(ui, /確認丟棄/);
  const state = S.defaultState(1800000000000);
  const order = G.refreshOrders(state, 1800000000000, () => 0)[0];
  assert.equal(G.orderMissingText(state, order), '還缺小麥 ×2');
  state.storage.items.wheat = 2;
  assert.equal(G.orderMissingText(state, order), '交付');
});

test('成熟格、背包名稱、升級實價與設定目前狀態皆有明確標籤', () => {
  assert.match(world, /田裡有 \$\{readyCount\} 格可以收成/);
  assert.match(ui, /class="res-name">背包<\/span>/);
  assert.match(ui, /title="背包：\$\{used\} 份／\$\{cap\} 份/);
  assert.match(ui, /\$\{fmtNum\(next\.cost\)\} 金（還差 \$\{fmtNum\(next\.cost - state\.coins\)\}）/);
  assert.match(ui, /目前：\$\{enabled \? "開" : "關"\}/);
  assert.doesNotMatch(ui.slice(ui.indexOf('function settingRowHtml'), ui.indexOf('function soundVolumeHtml')), />\$\{enabled \? "開啟" : "關閉"\}<\/button>/);
});

test('首次種植後任務卡提供兩條不阻擋主線的自主路線', () => {
  assert.match(ui, /function earlyChoiceRoutes\(farmState\)/);
  assert.match(ui, /先完成班伯訂單/);
  assert.match(ui, /\+45 金幣/);
  assert.match(ui, /先存錢擴一格田/);
  assert.match(ui, /\+2 格產量/);
  assert.match(ui, /不影響主線/);
  assert.match(world, /window\.FarmEarlyChoiceRoutesHtml/);
});

console.log(`\nR27 A 線系統與狀態測試：${passed} 項通過。`);
if (process.exitCode) process.exit(1);
