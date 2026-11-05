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
const dailyUi = read('src/daily-ui.js');
const html = read('index.html');
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (error) { console.error('  ✗ ' + name + '\n    ' + error.stack); process.exitCode = 1; }
}

test('升級面板只有一個標題關閉入口，買不起時顯示還差 X 金', () => {
  const start = html.indexOf('<div class="side-pane" data-pane="upgrades">');
  const pane = html.slice(start, html.indexOf('<div class="side-pane sel" data-pane="story">', start));
  assert.equal((pane.match(/class="pane-head"/g) || []).length, 1);
  assert.match(pane, /class="building-upgrades-head">已放置建物/);
  assert.match(ui, /\$\{fmtNum\(next\.cost\)\} 金（還差 \$\{fmtNum\(next\.cost - state\.coins\)\}）/);
  assert.match(ui, /buildingCostShortfall/);
  assert.match(ui, /const visibleUpgrades = upgradeKeys/);
  assert.doesNotMatch(ui, /appendListMore\(box, "upgrades"/);
});

test('建造模式顯示已解鎖與下一項、價格、負擔狀態與放置提示', () => {
  assert.match(ui, /if \(t === "build"\) showBuildCatalog\(\)/);
  assert.match(ui, /選一個建物，再點地面放置/);
  assert.match(ui, /visibleBuildingCatalogTypes\(\)\.forEach/);
  assert.match(ui, /const next = window\.BUILDING_ORDER\.find/);
  assert.match(ui, /buildCostText\(def\)/);
  assert.match(ui, /buildingCostShortfall\(def\.cost\)/);
  assert.match(ui, /state\.interaction\.buildType = type/);
  assert.match(ui, /cell\.el\.dataset\.buildable = buildable \? "true" : "false"/);
  assert.match(ui, /G\.buildBuilding\(state, tileId, type, t\)/);
});

test('新存檔九張主線卡的步驟文字與按鈕動作永遠指向同一個真實子目標', () => {
  const now = 1800000000000;
  const state = S.defaultState(now);
  const ids = ['c1_homecoming', 'c1_first_harvest', 'c1_first_meal', 'c2_fishing_dock', 'c2_river_basket', 'c2_picnic_table', 'c3_good_neighbors', 'c3_garden', 'c3_harvest_picnic'];
  for (const id of ids) {
    let view = A.summary(state, now);
    assert.equal(view.currentQuest.id, id);
    let guide = A.guide(state, now);
    assert.equal(guide.questId, id);
    assert.ok(guide.step, id + ' 應有真實未完成子目標');
    assert.equal(guide.actionLabel, guide.step.name);
    assert.match(guide.stepText, new RegExp('^' + guide.step.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\d+/\\d+$'));
    assert.doesNotMatch(guide.stepText, /物品備齊|交給鎮民/);
    const q = view.currentQuest;
    for (const row of q.objectives) {
      if (row.type === 'restore') state.adventure.projects[row.id].restored = true;
      else {
        state.adventure.counts[row.type] = Math.max(state.adventure.counts[row.type] || 0, row.required);
        if (row.id && state.adventure.byTarget[row.type]) state.adventure.byTarget[row.type][row.id] = row.required;
      }
    }
    for (const row of q.requirements) {
      if (row.source === 'catch') state.adventure.catch.river_carp = Math.max(state.adventure.catch.river_carp || 0, row.required);
      else if (row.source === 'meals') state.adventure.meals[row.id] = row.required;
      else if (row.source === 'materials') state.materials[row.id] = row.required;
      else if (row.source === 'coins') state.coins = Math.max(state.coins, row.required);
      else state.storage.items[row.id] = row.required;
    }
    guide = A.guide(state, now);
    assert.equal(guide.step, null);
    if (id === 'c1_first_harvest') {
      assert.equal(guide.stepText, '找老農 班伯回報');
      assert.equal(guide.actionLabel, '把 2 份小麥交給班伯');
    } else {
      assert.match(guide.stepText, /^找.+回報$/);
      assert.equal(guide.actionLabel, guide.stepText);
    }
    assert.equal(A.claim(state, id, now).ok, true);
  }
  assert.equal(A.summary(state, now).claimed, 9);
  assert.match(world, /本章 \$\{guide\.chapterProgress\.claimed\}\/\$\{guide\.chapterProgress\.total\}/);
  assert.doesNotMatch(world, /物品備齊，交給鎮民/);
});

test('第一次三格小麥收成足以完成班伯主線，市集不再重複扣兩份', () => {
  let now = 1800000000000;
  const state = S.defaultState(now);
  A.record(state, { type: 'talk', npcId: 'mayor' }, now);
  for (let i = 0; i < 3; i++) {
    assert.equal(G.plant(state, i, 'wheat', now).ok, true);
    A.record(state, { type: 'plant', cropId: 'wheat' }, now);
    assert.equal(G.waterPlot(state, i, now).ok, true);
    A.record(state, { type: 'water', cropId: 'wheat' }, now);
  }
  assert.equal(A.claim(state, 'c1_homecoming', now).ok, true);
  now += C.CROPS.wheat.growMs;
  for (let i = 0; i < 3; i++) {
    const result = G.harvest(state, i, now);
    assert.equal(result.ok, true);
    A.record(state, { type: 'harvest', cropId: 'wheat', count: result.added }, now);
  }
  assert.equal(state.storage.items.wheat, 6);
  A.record(state, { type: 'talk', npcId: 'elder' }, now);
  assert.equal(A.claim(state, 'c1_first_harvest', now).ok, true);
  assert.equal(state.storage.items.wheat, 4);
  const orders = G.refreshOrders(state, now, () => 0);
  assert.ok(orders.every((row) => JSON.stringify(row.wants) !== JSON.stringify({ wheat: 2 })));
  assert.equal(state.storage.items.wheat, 4);
});

test('每日收成門檻不超過首章 6 份，印章冊標示已領取 0/3', () => {
  for (let day = 0; day < 12; day++) {
    const state = S.defaultState(day * 86400000);
    state.daily = { day, cropId: 'wheat', water: 0, harvest: 0, claimed: {}, stamps: 0, stamped: false, collected: {} };
    const harvest = D.status(state, day * 86400000).tasks.find((row) => row.id === 'harvest');
    assert.ok(harvest.need <= C.CROPS.wheat.yield * 3);
  }
  assert.match(dailyUi, /已完成 \$\{st\.completed\}\/3・已領取 \$\{st\.claimed\}\/3/);
});

test('開場、對話與設定文案符合 R26', () => {
  assert.match(world, /先跟鎮民打招呼、認識農場/);
  assert.match(world, /class="dialogue-continue">繼續 ▶<\/button>/);
  assert.match(world, /class="dialogue-close" aria-label="關閉對話"/);
  assert.match(ui, /<details class="settings-advanced" data-audit="settings-advanced"><summary>進階<\/summary>/);
  const settings = ui.slice(ui.indexOf('function renderSettingsPanel'), ui.indexOf('function renderSmartAssistant'));
  const advanced = settings.match(/<details class="settings-advanced"[\s\S]*?<\/details>/)?.[0] || '';
  assert.match(advanced, /performanceModeHtml/);
  assert.match(advanced, /performanceDiagnosticsHtml/);
  assert.doesNotMatch(settings.split('<details class="settings-advanced"')[0], /WebAudio|FPS|降級/);
});

console.log(`\nR26 A 線系統與文字測試：${passed} 項通過。`);
if (process.exitCode) process.exit(1);
