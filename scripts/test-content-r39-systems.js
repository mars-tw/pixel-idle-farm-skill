'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const S = require('../src/state.js');
const G = require('../src/game.js');
const A = require('../src/adventure.js');
const D = require('../src/daily.js');

const T = 1_900_000_000_000;
const read = (path) => fs.readFileSync(path, 'utf8');
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}\n${error.stack}`); process.exitCode = 1; }
}

test('A1 任務列與市集預告共用已收小麥 0/6 到 6/6', () => {
  const state = S.defaultState(T);
  assert.deepEqual(G.marketPreviewAction(state), {
    harvested: 0, target: 'field', label: '先收成小麥（已收 0/6，交班伯需 2）',
  });
  state.stats.harvested.wheat = 4;
  assert.match(G.marketPreviewAction(state).label, /已收 4\/6/);
  state.stats.harvested.wheat = 6;
  assert.deepEqual(G.marketPreviewAction(state), {
    harvested: 6, target: 'elder', label: '前往老農班伯（交付 2 份小麥）',
  });
  const ui = read('src/ui.js');
  assert.match(ui, /planted < 3 \? "已種下・種滿 3 格再澆水" : "待澆水"/);
});

test('A1 印章冊未領完顯示可做項數，領完後才說印章已蓋好', () => {
  const state = S.defaultState(T);
  assert.equal(D.status(state, T).available, 2);
  const dailyUi = read('src/daily-ui.js');
  assert.match(dailyUi, /把今天可做的 \$\{st\.available\} 項都領取，就能蓋章並得堆肥 1/);
  assert.match(dailyUi, /st\.stamped \? "今天的印章已蓋好/);
});

test('A2 Lv 2 里程碑的獲得具體，下一步等於任務列行動', () => {
  const state = S.defaultState(T);
  state.level = 2;
  const guide = A.guide(state, T);
  const card = G.milestoneCard('level_up', { level: 2, state, now: T });
  assert.match(card.earned, /^Lv 2・.*胡蘿蔔種子/);
  assert.equal(card.next, guide.actionLabel);
  assert.doesNotMatch(card.earned, /新的農場等級/);
});

test('A3 升級效果有數字、下一步各異，低於一輪種子成本改次要確認', () => {
  const state = S.defaultState(T);
  state.coins = 25;
  const plot = G.upgradeCardInfo(state, 'plotCount');
  const growth = G.upgradeCardInfo(state, 'growthSpeed');
  assert.match(plot.effect, /\+2 格田/);
  assert.match(growth.effect, /−10%/);
  assert.notEqual(plot.nextStep, growth.nextStep);
  assert.equal(plot.reserveRisk, true);
  const ui = read('src/ui.js');
  assert.match(ui, /cardInfo\.reserveRisk \? "ghost" : "buy"/);
  assert.match(ui, /確認後升級/);
});

test('A4 預告與首批逐欄一致，首批不限時，補單恢復倒數', () => {
  const state = S.defaultState(T);
  state.level = 2;
  const preview = G.previewMarketOrders(state, T);
  state.adventure = { claimed: { c1_first_harvest: true } };
  G.refreshOrders(state, T, () => 0.5);
  assert.equal(state.orders.length, preview.length);
  for (let i = 0; i < preview.length; i++) {
    assert.deepEqual(state.orders[i].wants, preview[i].wants);
    assert.equal(state.orders[i].rewardCoins, preview[i].rewardCoins);
    assert.equal(state.orders[i].rewardXp, preview[i].rewardXp);
    assert.equal(state.orders[i].firstBatch, true);
    assert.equal(state.orders[i].expiresAt, null);
  }
  const first = state.orders[0];
  state.storage.items = { ...first.wants };
  assert.equal(G.fulfillOrder(state, first.id, T + 1, () => 0.5).ok, true);
  assert.ok(state.orders.some((order) => order.firstBatch !== true && Number.isFinite(order.expiresAt)));
  assert.match(read('src/ui.js'), /o\.firstBatch \? "首批不限時"/);
});

test('A4b 新存檔手記只把主線排前面，不顯示餐籃與河畔委託', () => {
  const state = S.defaultState(T);
  assert.deepEqual(A.storyPanelAvailability(state), {
    marketUnlocked: false, showNeighborBasket: false, showRiverCommissions: false,
  });
  const world = read('src/world-ui.js');
  assert.ok(world.indexOf('<div class="adventure-quests">') < world.indexOf('showNeighborBasket'));
  assert.match(world, /availability\.showNeighborBasket/);
  assert.match(world, /availability\.showRiverCommissions/);
});

test('A5 去田裡會關面板、選訂單作物並置中空田', () => {
  const ui = read('src/ui.js');
  const start = ui.indexOf('if (orderGo) orderGo.onclick');
  const end = ui.indexOf('const cancelTrash', start);
  const handler = ui.slice(start, end);
  assert.match(handler, /Object\.keys\(o\.wants \|\| \{\}\)\[0\]/);
  assert.match(handler, /classList\.remove\("world-panel-open"\)/);
  assert.match(handler, /chooseSeed\(cropId\)/);
  assert.match(handler, /focusCameraOnTile\(tile\.id\)/);
});

if (process.exitCode) process.exit(1);
console.log(`VERIFIED content R39 A1-A5 and A4b (${passed}/7)`);
