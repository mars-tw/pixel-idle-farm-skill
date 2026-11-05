'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const C = require('../src/config.js');
const S = require('../src/state.js');
const G = require('../src/game.js');
const A = require('../src/adventure.js');
const D = require('../src/daily.js');

const read = (file) => fs.readFileSync(require.resolve('../' + file), 'utf8');
const ui = read('src/ui.js');
const world = read('src/world-ui.js');
const dailyUi = read('src/daily-ui.js');
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { console.error('FAIL ' + name + '\n' + error.stack); process.exitCode = 1; }
}

test('A1 新存檔前十二步的成熟提示單一且與實際成熟格一致', () => {
  let now = 1_900_000_000_000;
  const state = S.defaultState(now);
  const snapshots = [];
  const capture = () => {
    const active = G.activePlotCount(state);
    const ready = state.plots.slice(0, active).filter((plot) => plot.cropId && G.getCropProgress(state, plot, now).ready).length;
    const dom = ready ? `<div class="world-objective-hint ready">田裡有 ${ready} 格可以收成。</div>` : '';
    assert.ok((dom.match(/可以收成/g) || []).length <= 1);
    if (ready) assert.match(dom, new RegExp(`田裡有 ${ready} 格可以收成`));
    snapshots.push(ready);
  };
  capture();
  for (let i = 0; i < 3; i++) { assert.equal(G.plant(state, i, 'wheat', now).ok, true); capture(); }
  for (let i = 0; i < 3; i++) { assert.equal(G.waterPlot(state, i, now).ok, true); capture(); }
  now += C.CROPS.wheat.growMs; capture();
  for (let i = 0; i < 3; i++) { assert.equal(G.harvest(state, i, now).ok, true); capture(); }
  capture();
  assert.equal(snapshots.length, 12);
  assert.deepEqual(snapshots.slice(7, 11), [3, 2, 1, 0]);
  assert.equal((world.match(/可以收成/g) || []).length, 1, '成熟提示只有 world-ui 單一來源');
  assert.match(read('src/adventure.js'), /goal\("harvest", 6, "收成小麥", "wheat"\)/);
});

test('A2 市集交付班伯前不出單，開放後只出已解鎖作物', () => {
  const now = 1_900_000_000_000;
  const state = S.defaultState(now);
  assert.deepEqual(G.refreshOrders(state, now, () => 0), []);
  A.ensure(state, now); state.adventure.claimed.c1_first_harvest = true;
  const orders = G.refreshOrders(state, now, () => 0);
  assert.equal(orders.length, 3);
  assert.ok(orders.every((order) => Object.keys(order.wants).every((id) => C.CROPS[id].unlockLevel <= state.level)));
  assert.ok(orders.some((order) => JSON.stringify(order.wants) === JSON.stringify({ wheat: 2 })));
  const quest = A.quests(state, now).find((row) => row.id === 'c1_first_harvest');
  assert.deepEqual(quest.wants, { wheat: 2 });
  assert.match(read('src/adventure.js'), /再把其中 2 份交給老農班伯/);
  assert.match(ui, /把 2 份小麥交給老農班伯後開放/);
  assert.doesNotMatch(ui, /主線保留 2 份小麥|交付後會動用主線保留/);
  assert.doesNotMatch(ui + world + read('src/game.js'), /兩條路都不影響主線|這張訂單可選做/);
});

test('A3 路線只在首收完成後、班伯交付前顯示', () => {
  assert.match(ui, /wheatHarvested < 6 \|\| mainDelivered/);
  assert.match(ui, /adventure\.claimed\.c1_first_harvest/);
  assert.match(ui, /先完成主線/);
  assert.match(ui, /先整理田地/);
  assert.doesNotMatch(ui, /stats\.plantCount \|\| 0\) < 1/);
});

test('A4 建造只列已解鎖與下一項，升級有三段排序與可達路線', () => {
  const state = S.defaultState(1_900_000_000_000);
  const visible = C.BUILDING_ORDER.filter((type) => G.buildingUnlocked(state, type));
  const next = C.BUILDING_ORDER.find((type) => !G.buildingUnlocked(state, type));
  const catalog = next ? visible.concat(next) : visible;
  assert.deepEqual(catalog, ['compostHeap', 'silo']);
  assert.match(ui, /function visibleBuildingCatalogTypes\(\)/);
  assert.match(ui, /農場等級 \$\{def \? def\.unlockLevel/);
  assert.match(ui, /\["現在買得起", "差一點", "長期目標", "已滿級"\]/);
  assert.match(ui, /再交一張訂單約可補足/);
  state.coins += 12 + 16;
  assert.ok(C.UPGRADE_ORDER.some((key) => G.nextUpgrade(state, key) && state.coins >= G.nextUpgrade(state, key).cost), '第一章兩次主線獎勵後至少一項可買');
});

test('A5 開場、手記、印章冊與農場幫手文字一致', () => {
  assert.ok(world.indexOf('先種三格小麥') < world.indexOf('葛瑞會先帶你認識農場') && world.indexOf('id="worldSunBegin"') < world.indexOf('id="worldBegin"') && !world.includes('先照顧田裡的小麥，再跟葛瑞'), '開場便箋不再要求先種田再找葛瑞（R31：與任務第一步「找葛瑞」一致），按鈕順序跟內文一致');
  assert.match(ui, /function currentQuestFirst\(ids, cur\)/);
  assert.match(dailyUi, /今天可做 \$\{st\.available\} 項・達成 \$\{st\.completed\}・已領 \$\{st\.claimed\}/);
  const state = S.defaultState(1_900_000_000_000);
  let status = D.status(state, 1_900_000_000_000);
  assert.equal(status.completed, 0); assert.equal(status.claimed, 0);
  D.record(state, 'water', 3, 1_900_000_000_000);
  status = D.status(state, 1_900_000_000_000);
  assert.equal(status.completed, 1); assert.equal(status.claimed, 0);
  assert.equal(C.UPGRADES.helperLevel.name, '稻草人幫手');
  assert.equal(C.UPGRADES.helperLevel.icon, '🌾');
});

test('整合：未解鎖作物的訂單寫出哪一級解鎖', () => {
  const state = S.defaultState(1_900_000_000_000);
  state.level = 1;
  assert.equal(G.orderLockText(state, { wants: { carrot: 2 } }), `胡蘿蔔 Lv ${C.CROPS.carrot.unlockLevel} 解鎖`);
  assert.equal(G.orderLockText(state, { wants: { wheat: 3 } }), '');
  state.level = C.CROPS.carrot.unlockLevel;
  assert.equal(G.orderLockText(state, { wants: { carrot: 2 } }), '');
  assert.match(ui, /data-audit="order-lock"/);
});

console.log(`VERIFIED content R28 systems ${passed}/6`);
if (process.exitCode) process.exit(1);
