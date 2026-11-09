'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const C = require('../src/config.js');
const S = require('../src/state.js');
const G = require('../src/game.js');
const D = require('../src/daily.js');

const T = 1_900_000_000_000;
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}\n${error.stack}`); process.exitCode = 1; }
}
const read = (path) => fs.readFileSync(path, 'utf8');

test('A1 市集未開放時兩項一致，領完兩項即可蓋章', () => {
  const state = S.defaultState(T);
  let status = D.status(state, T);
  assert.equal(status.available, 2);
  assert.equal(status.tasks.filter((task) => task.available).length, 2);
  assert.equal(status.tasks.find((task) => task.id === 'sell').available, false);
  D.record(state, 'water', 3, T);
  D.record(state, 'talk', 1, T);
  assert.equal(D.claim(state, 'water', status.day, T).stamp, false);
  assert.equal(D.claim(state, 'talk', status.day, T).stamp, true);
  status = D.status(state, T);
  assert.equal(status.claimed, status.available);
  const ui = read('src/daily-ui.js');
  assert.match(ui, /市集開放後解鎖：賣出一份作物/);
  assert.match(ui, /daily-locked-row/);
  assert.match(ui, /把今天可做的 \$\{st\.available\} 項都領取，就能蓋章並得堆肥 1/);
  assert.match(ui, /今天的印章已蓋好/);
});

test('A1 市集開放後三項一致，三項都領完才蓋章', () => {
  const state = S.defaultState(T);
  state.adventure = { claimed: { c1_first_harvest: true } };
  let status = D.status(state, T);
  assert.equal(status.available, 3);
  assert.equal(status.tasks.filter((task) => task.available).length, 3);
  D.record(state, 'water', 3, T); D.record(state, 'talk', 1, T); D.record(state, 'sell', 1, T);
  assert.equal(D.claim(state, 'water', status.day, T).stamp, false);
  assert.equal(D.claim(state, 'talk', status.day, T).stamp, false);
  assert.equal(D.claim(state, 'sell', status.day, T).stamp, true);
  status = D.status(state, T);
  assert.equal(status.claimed, status.available);
});

test('A2 新手預告與開放首批同步，且同作物大單單價不倒掛', () => {
  const state = S.defaultState(T);
  state.level = 2;
  const preview = G.previewMarketOrders(state, T);
  state.adventure = { claimed: { c1_first_harvest: true } };
  G.refreshOrders(state, T, () => 0.5);
  const actual = new Map(state.orders.map((order) => [order.id, order]));
  for (const order of preview) {
    const opened = actual.get(order.id);
    assert.ok(opened, `${order.id} 應出現在首批`);
    assert.deepEqual(opened.wants, order.wants);
    assert.equal(opened.rewardCoins, order.rewardCoins);
  }
  const wheat = preview.filter((order) => order.wants.wheat).sort((a, b) => a.wants.wheat - b.wants.wheat);
  for (let i = 1; i < wheat.length; i++) {
    assert.ok(wheat[i].rewardCoins / wheat[i].wants.wheat >= wheat[i - 1].rewardCoins / wheat[i - 1].wants.wheat);
  }
  assert.equal(wheat.find((order) => order.wants.wheat === 4).rewardCoins, 28);
});

test('A2 一般訂單在同品項與稀有度內不會因數量增加而降低單價', () => {
  const state = S.defaultState(T); state.level = 9;
  let seed = 123456789;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
  const groups = new Map();
  for (let i = 0; i < 4000; i++) {
    const order = G.makeOrder(state, T, rng, i);
    if (Object.keys(order.wants).length !== 1) continue;
    const [id, qty] = Object.entries(order.wants)[0];
    const key = `${id}:${order.rarity}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ qty, unit: order.rewardCoins / qty });
  }
  for (const rows of groups.values()) {
    rows.sort((a, b) => a.qty - b.qty);
    for (let i = 1; i < rows.length; i++) if (rows[i].qty > rows[i - 1].qty) assert.ok(rows[i].unit + 1e-9 >= rows[i - 1].unit);
  }
  assert.ok(groups.size >= 3, '至少覆蓋三種一般訂單稀有度');
});

test('A3 便箋、主按鈕與任務第一步都先找鎮長，勾號只屬於完成步驟', () => {
  const world = read('src/world-ui.js');
  const ui = read('src/ui.js');
  assert.match(world, /先去找鎮長葛瑞，再親手種下第一格。完成這兩步後，你可以自己決定先收成、修釣台，或去跟蘿拉打招呼。/);
  assert.match(world, /id="worldSunBegin">去見鎮長葛瑞/);
  const state = S.defaultState(T);
  const guide = require('../src/adventure.js').guide(state, T);
  assert.equal(guide.step.type, 'talk');
  assert.equal(guide.step.id, 'mayor');
  assert.match(ui, /done \? "✓" : active \? "➤" : "□"/);
});

test('A4 收成與澆水步驟工具正確，關閉面板會同步且同一步尊重手動選擇', () => {
  const ui = read('src/ui.js');
  assert.match(ui, /type === "water" \? "water" : type === "harvest" \? "hand" : null/);
  assert.match(ui, /quest\.objective === "water" \? "water" : quest\.objective === "harvest" \? "hand" : null/);
  assert.match(ui, /manualToolStepKey !== step\.key/);
  const close = ui.slice(ui.indexOf('function closeModal'), ui.indexOf('function closeOpenModal'));
  assert.match(close, /syncQuestTool\(\);[\s\S]*renderToolbar\(\);/);
  for (const panel of ['orders', 'upgrades', 'story']) assert.match(ui, new RegExp(`data-pane=['"]${panel}['"]|name === ['"]${panel}['"]|key === ['"]${panel}['"]`));
});

test('A5 Lv 2 里程碑列具體解鎖，兩個介面的新標記看過後各自清除', () => {
  const state = S.defaultState(T); state.level = 2;
  const card = G.milestoneCard('level_up', { level: 2 });
  assert.match(card.unlocked, /胡蘿蔔種子/);
  assert.doesNotMatch(card.unlocked, /新的作物與農場能力/);
  assert.deepEqual(G.unseenLevelUnlocks(state, 'seeds').map((row) => row.name), ['胡蘿蔔種子']);
  assert.ok(G.unseenLevelUnlocks(state, 'upgrades').some((row) => row.name === '胡蘿蔔種子'));
  G.markLevelUnlocksSeen(state, 'seeds');
  assert.equal(G.unseenLevelUnlocks(state, 'seeds').length, 0);
  assert.ok(G.unseenLevelUnlocks(state, 'upgrades').length > 0, '種子欄看過不應提前清除升級頁標記');
  G.markLevelUnlocksSeen(state, 'upgrades');
  assert.equal(G.unseenLevelUnlocks(state, 'upgrades').length, 0);
  const ui = read('src/ui.js');
  assert.match(ui, /new-unlock-badge/);
});

test("R38 整合：自動換工具時重畫工具列，有效光圈不播實心白圓格", () => {
  const ui = require("fs").readFileSync(require("path").join(__dirname, "../src/ui.js"), "utf8");
  assert.match(ui, /if \(syncQuestTool\(\)\) renderToolbar\(\);/);
  assert.match(ui, /valid \? "valid_ring" : "invalid_ring", \{ scale: 1, startFrame: valid \? 2 : 0 \}/);
});

if (process.exitCode) process.exit(1);
console.log(`VERIFIED content R38 A1-A5 (${passed}/8)`);
