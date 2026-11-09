'use strict';
const assert = require('node:assert/strict');

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

function afterTutorial() {
  const state = State.defaultState(T0);
  A.ensure(state, T0);
  A.record(state, { type: 'talk', npcId: 'mayor' }, T0 + 1);
  A.record(state, { type: 'plant', cropId: 'wheat' }, T0 + 2);
  const planted = A.finishTutorial(state, T0 + 3);
  assert.equal(planted.ok, true);
  assert.equal(state.adventure.claimed.c1_homecoming, true);
  return state;
}

const actions = {
  harvest(state, at) {
    A.record(state, { type: 'harvest', cropId: 'wheat', count: 6 }, at);
    state.storage.items.wheat = 6;
    assert.equal(A.claim(state, 'c1_first_harvest', at + 1).ok, true);
  },
  dock(state, at) { assert.equal(A.restore(state, 'fishing_dock', at).ok, true); },
  market(state, at) {
    const before = state.coins;
    const result = A.record(state, { type: 'talk', npcId: 'merchant' }, at);
    assert.equal(result.marketPreviewReward.coins, 5);
    assert.equal(state.coins, before + 5);
  },
};

test('新存檔只需找葛瑞與種第一格，隨即同時開放三件事', () => {
  const state = afterTutorial();
  const early = A.earlyGoals(state, T0 + 3);
  assert.equal(early.available, true);
  assert.deepEqual(early.goals.map((goal) => goal.id), ['harvest', 'dock', 'market']);
  assert.ok(early.goals.every((goal) => !goal.complete));
  assert.equal(A.projects(state).find((project) => project.id === 'fishing_dock').canRestore, true);
});

test('三件事以任一順序完成後，第一章仍可完成', () => {
  const orders = [
    ['harvest', 'dock', 'market'], ['harvest', 'market', 'dock'],
    ['dock', 'harvest', 'market'], ['dock', 'market', 'harvest'],
    ['market', 'harvest', 'dock'], ['market', 'dock', 'harvest'],
  ];
  orders.forEach((order, index) => {
    const state = afterTutorial();
    order.forEach((id, step) => actions[id](state, T0 + 10 + index * 20 + step * 2));
    const nextGoals = A.earlyGoals(state, T0 + 100 + index);
    assert.equal(nextGoals.goals[0].id, 'meal', order.join(' → ')); // R62：開市小麥完成後固定換成第一餐下一步。
    assert.equal(nextGoals.complete, false, '第一餐尚未完成前今日三件事不可提早結束');
    assert.equal(A.cook(state, 'rustic_bread', T0 + 110 + index).ok, true);
    assert.equal(A.claim(state, 'c1_first_meal', T0 + 120 + index).ok, true);
    assert.equal(A.summary(state, T0 + 121 + index).chapters[0].claimed, 3);
  });
});

test('農場旁兩個採集點不需修橋即可撿取，物品會進背包', () => {
  const state = State.defaultState(T0);
  assert.ok(state.map.tiles.some((tile) => tile.forage === 'farm_berry_patch'));
  assert.ok(state.map.tiles.some((tile) => tile.forage === 'farm_branch_pile'));
  const berry = G.gatherForage(state, 'farm_berry_patch', T0 + 1);
  const branch = G.gatherForage(state, 'farm_branch_pile', T0 + 2);
  assert.equal(berry.ok, true);
  assert.equal(branch.ok, true);
  assert.equal(state.storage.items.wild_berry, 1);
  assert.equal(state.storage.items.fallen_branch, 1);
});

console.log(`VERIFIED content R58 systems (${passed}/3)`);
if (process.exitCode) process.exit(1);
