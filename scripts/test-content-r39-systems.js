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

test('A1 任務列與市集預告共用班伯開市小麥 0/2 到 2/2', () => {
  const state = S.defaultState(T);
  assert.deepEqual(G.marketPreviewAction(state), {
    harvested: 0, target: 'field', label: '老農班伯的開市小麥（已收 0/2）',
  });
  state.storage.items.wheat = 1;
  assert.match(G.marketPreviewAction(state).label, /已收 1\/2/);
  state.storage.items.wheat = 2;
  assert.deepEqual(G.marketPreviewAction(state), {
    harvested: 2, target: 'elder', label: '交給老農班伯 2 份小麥（已收 2/2）',
  });
  const ui = read('src/ui.js');
  assert.match(ui, /planted < 3 \? `已種 \$\{planted\}／3 格・種滿再澆水` : "待澆水"/ /* R42：標籤寫出已種格數，意圖不變：種滿前不顯示待澆水 */);
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
  assert.match(ui, /金<small class="u-confirm-note">先留種子錢<\/small>/); // R46：會花到買不起種子時停用並寫原因
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

test("R39 整合：每秒更新倒數時，首批訂單仍顯示不限時", () => {
  const ui = require("fs").readFileSync(require("path").join(__dirname, "../src/ui.js"), "utf8");
  assert.match(ui, /m\.innerHTML = o\.firstBatch \|\| o\.expiresAt == null \? "首批不限時"/);
});

test("R39 整合：預告固定為開放時那一組、未解鎖作物註明等級、加成另外標示、開墾文案不矛盾", () => {
  const G2 = require("../src/game.js"), S2 = require("../src/state.js");
  const st = S2.defaultState(1_900_000_000_000);
  const preview = G2.previewMarketOrders(st, 1_900_000_000_000);
  assert.deepEqual(preview.map((o) => o.id), ["beginner_wheat_4", "beginner_wheat_2", "beginner_carrot_2"]); // R57：預告與首批都把 4 份大單排第一
  assert.match(preview.find((o) => o.id === "beginner_carrot_2").lockNote, /^Lv 2 解鎖胡蘿蔔種子$/);
  const ui = require("fs").readFileSync(require("path").join(__dirname, "../src/ui.js"), "utf8");
  assert.match(ui, /（含加成 \+\$\{fmtNum\(pay\.coins - o\.rewardCoins\)\}）/);
  assert.match(ui, /經驗（未含加成）<\/div>/);
  const game = require("fs").readFileSync(require("path").join(__dirname, "../src/game.js"), "utf8");
  assert.doesNotMatch(game, /多一格田/);
});

if (process.exitCode) process.exit(1);
console.log(`VERIFIED content R39 A1-A5 and A4b (${passed}/9)`);
