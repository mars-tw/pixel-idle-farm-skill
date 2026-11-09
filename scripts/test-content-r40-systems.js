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
const T0 = 1772755200000;
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { console.error('FAIL ' + name + '\n' + error.stack); process.exitCode = 1; }
}
function marketState() {
  const state = State.defaultState(T0);
  A.ensure(state, T0);
  state.adventure.claimed.c1_homecoming = true;
  state.adventure.claimed.c1_first_harvest = true;
  state.adventure.quests.c1_homecoming.status = 'claimed';
  state.adventure.quests.c1_first_harvest.status = 'claimed';
  state.storage.items.wheat = 4;
  return state;
}

test('訂單卡能計算交付後庫存與主線保留量', () => { // R60 同步：已交班伯後保留的 2 份小麥是做「回家的第一餐」麥餅，任務名改正，數字不變
  const state = marketState();
  const small = { id: 'beginner_wheat_2', wants: { wheat: 2 } };
  const large = { id: 'beginner_wheat_4', wants: { wheat: 4 } };
  assert.equal(G.orderStoryImpact(state, small).text, '交付後剩 2 份・「回家的第一餐」還需 2 份');
  assert.equal(G.orderStoryImpact(state, small).risky, false);
  assert.equal(G.orderStoryImpact(state, large).text, '交付後剩 0 份・「回家的第一餐」還需 2 份');
  assert.equal(G.orderStoryImpact(state, large).risky, true);
});

test('兩種第一選擇都能切換追蹤並回到第一章主線', () => {
  for (const choice of ['meal', 'order']) {
    const state = marketState();
    assert.equal(A.chooseFirstPath(state, choice).ok, true);
    assert.equal(A.firstChoiceStatus(state).selected, choice);
    assert.equal(A.trackFirstPath(state, choice === 'meal' ? 'order' : 'meal').ok, true);
    assert.equal(A.trackFirstPath(state, choice).ok, true);
    if (choice === 'order') {
      // R47：市集路線改為蘿拉的 4 份大單（交出全部小麥，之後要再種一輪才能做餅）
      state.storage.items.wheat = Math.max(4, state.storage.items.wheat || 0);
      state.orders = [{ id: 'beginner_wheat_4', wants: { wheat: 4 }, rarity: 'common', rewardCoins: 28, rewardXp: 2, firstBatch: true }];
      state.orderStreak = 0;
      assert.equal(G.fulfillOrder(state, 'beginner_wheat_4', T0 + 1, () => 0).ok, true);
      assert.equal(A.firstChoiceStatus(state).orderCompleted, true);
      assert.equal(A.firstChoiceStatus(state).tracked, 'meal');
    }
    state.storage.items.wheat = Math.max(2, state.storage.items.wheat || 0);
    state.adventure.meals.rustic_bread = 1;
    state.adventure.byTarget.cook.rustic_bread = 1;
    const quest = A.quests(state, T0 + 2).find((row) => row.id === 'c1_first_meal');
    assert.equal(quest.canClaim, true, choice + ' 路線能完成第一章最後任務');
    assert.equal(A.claim(state, 'c1_first_meal', T0 + 3).ok, true);
  }
});

test('印章冊鎖定列、頂部返回與關閉鈕都存在', () => {
  const dailyUi = read('src/daily-ui.js');
  const html = read('index.html');
  assert.match(dailyUi, /市集開放後解鎖：賣出一份作物/);
  assert.match(dailyUi, /daily-locked-row/);
  assert.match(html, /id="dailyTopBack"[^>]*>返回農場/);
  assert.match(html, /id="dailyTopClose"[^>]*aria-label="關閉每日印章冊"/);
});

test('HUD 與建造系統共用木料、石材名稱', () => {
  const ui = read('src/ui.js');
  assert.equal(global.MATERIALS.stone.name, '石材');
  assert.match(ui, /木料 \$\{mats\.wood \|\| 0\}/);
  assert.match(ui, /石材 \$\{mats\.stone \|\| 0\}/);
});

test('升級與里程碑使用米色紙卡並避開工具列', () => {
  const css = read('src/content-r40a.css');
  assert.match(css, /settlement-card\.milestone-card[\s\S]*background:\s*#fff2cf/);
  assert.match(css, /#toast-zone:has\([\s\S]*top:\s*max\(76px/);
  assert.match(css, /bottom:\s*calc\(var\(--fixed-bottom-inset/);
});

console.log(`\nR40 A 線系統與內容測試：${passed} 項通過。`);
if (process.exitCode) process.exit(1);
