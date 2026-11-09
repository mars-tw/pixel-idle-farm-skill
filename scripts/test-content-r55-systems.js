'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

global.window = global;
require('../src/config.js');
const G = require('../src/game.js');
const A = require('../src/adventure.js');
const State = require('../src/state.js');
const T0 = 1794172800000;
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { console.error('FAIL ' + name + '\n' + error.stack); process.exitCode = 1; }
}

test('共用小麥依訂單順序顯示口語句，按鈕狀態與可用量一致', () => { // R67B 同步：原名「顯示算式」改為口語句，分配規則不變
  const state = State.defaultState(T0);
  state.storage.items.wheat = 6; // R66：主線保留 2 份，另有 4 份可交第一張訂單。
  state.orders = [
    { id: 'wheat-4', wants: { wheat: 4 } },
    { id: 'wheat-2', wants: { wheat: 2 } },
  ];
  const rows = G.orderAllocation(state);
  assert.equal(rows[0].ready, true);
  assert.equal(rows[1].ready, false);
  assert.equal(G.orderAllocationText(state, state.orders[0]), '手上有 6 份小麥，夠交這張了'); // R67B 同步：可用量不變，改口語句
  assert.equal(G.orderAllocationText(state, state.orders[1]), '還要 2 份小麥，手上的先留給老農班伯和前面的訂單；再種 2 格（約 15 秒）'); // R67B 同步：缺量不變，改口語句
});

test('收成、訂單交付與升級都回傳可渲染的即時回饋資料', () => {
  const harvestState = State.defaultState(T0);
  harvestState.plots[0] = { id: 'p01', cropId: 'wheat', plantedAt: T0 - 999999 };
  const harvest = G.harvest(harvestState, 0, T0);
  assert.deepEqual(harvest.feedback.map((row) => row.kind), ['harvest']);
  assert.equal(harvest.feedback[0].text, '小麥 +2');

  const orderState = State.defaultState(T0);
  orderState.storage.items.wheat = 4; // R66：2 份主線保留，另 2 份可交訂單。
  orderState.adventure = { claimed: { c1_first_harvest: true } };
  orderState.ordersSeededAt = 3;
  orderState.orders = [{ id: 'test-order', wants: { wheat: 2 }, rarity: 'common', rewardCoins: 10, rewardXp: 1, expiresAt: T0 + 10000 }];
  const order = G.fulfillOrder(orderState, 'test-order', T0, () => 0);
  assert.equal(order.feedback[0].kind, 'order');
  assert.match(order.feedback[0].text, /^\+\d+ 金$/);

  const upgradeState = State.defaultState(T0);
  upgradeState.coins = 9999;
  const upgrade = G.buyUpgrade(upgradeState, 'growthSpeed');
  assert.equal(upgrade.feedback[0].kind, 'upgrade');
  assert.match(upgrade.feedback[0].text, /^－\d+ 金$/);
});

test('市集資料仍保留三張，鎖定畫面只顯示一張範例與兩張提示', () => {
  const state = State.defaultState(T0);
  const preview = G.previewMarketOrders(state, T0);
  assert.equal(preview.length, 3);
  const ui = read('src/ui.js');
  assert.match(ui, /previewMarketOrders\(state, now\(\)\) : \[\]\)\.slice\(0, 1\)/);
  assert.ok(ui.includes('開放後還有 2 張。'));
  assert.ok(ui.includes('className = "r55-future-upgrades"'));
  assert.ok(ui.includes('之後的目標（${upgradeKeys.length - 1}）'));
});

test('新存檔完成老農班伯交付後至少可建造一項建物', () => {
  const state = State.defaultState(T0);
  A.ensure(state, T0);
  A.record(state, { type: 'talk', npcId: 'mayor' }, T0 + 1);
  A.record(state, { type: 'plant', cropId: 'wheat', count: 3 }, T0 + 2);
  A.record(state, { type: 'water', cropId: 'wheat', count: 3 }, T0 + 3);
  assert.equal(A.claim(state, 'c1_homecoming', T0 + 4).ok, true);
  A.record(state, { type: 'harvest', cropId: 'wheat', count: 6 }, T0 + 5);
  state.storage.items.wheat = 6;
  assert.equal(A.claim(state, 'c1_first_harvest', T0 + 6).ok, true);
  assert.equal(global.BUILDINGS.compostHeap.cost.coins, 12);
  assert.ok(global.BUILDING_ORDER.some((type) => G.canBuild(state, type)));
});

test('任務卡只留目前步驟、進度與主要按鈕，章節交付移到故事手記', () => {
  const worldUi = read('src/world-ui.js');
  const ui = read('src/ui.js');
  const css = read('src/content-r55a.css');
  const objectiveTemplate = worldUi.slice(worldUi.indexOf('box.innerHTML = `<div class="world-objective-title">'), worldUi.indexOf('const choiceOpen =', worldUi.indexOf('box.innerHTML = `<div class="world-objective-title">')));
  assert.ok(objectiveTemplate.includes('data-audit="quest-progress"'));
  assert.ok(objectiveTemplate.includes('data-world-go'));
  assert.ok(!objectiveTemplate.includes('本章已交付'));
  assert.ok(!objectiveTemplate.includes('${choiceRoutes}'));
  // R58 同步：今日三件事卡可帶「一行」倒數提示（陽光 N 秒／最快 N 秒成熟，R79 回饋），仍不得多於一行、不得放章節交付與路線。
  assert.ok((objectiveTemplate.match(/world-objective-hint/g) || []).length <= 1);
  assert.ok(ui.includes('data-audit="story-chapter-progress"'));
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*r55NumberFlash/);
  assert.match(css, /quest-collapsed \.world-objective-title \.qp-step/);
});

console.log(`VERIFIED content R55 systems (${passed}/5)`);
if (process.exitCode) process.exit(1);
