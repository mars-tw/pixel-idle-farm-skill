"use strict";
/* R62 A 線驗收：灶台按鈕、可種訂單、主線下一步與名稱、小麥需求、開墾附種子。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
require("../src/config.js");
const A = require("../src/adventure.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const T0 = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function fresh() { const state = S.defaultState(T0); assert.equal(A.ensure(state, T0).ok, true); return state; }

test("1 灶台餐籃為零不顯示享用，做一份會寫食材缺口", () => {
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  assert.match(world, /r\.effect && r\.quantity > 0 \? `<button data-eat=/);
  assert.match(world, /r\.canCook \? "做一份" : `做一份・\$\{costText\(r\.requirements\.filter\(\(need\) => !need\.complete\)\)\}`/);
  assert.doesNotMatch(world, /disabled"}>享用一份/);
});

test("2 市集預告、第一批與隨機訂單只要求現在買得到種子的作物", () => {
  const state = fresh(); state.level = 2; state.adventure.claimed.c1_first_harvest = true;
  assert.equal(G.isCropUnlocked(state, "carrot"), false);
  assert.ok(G.previewMarketOrders(state, T0).every((o) => Object.keys(o.wants).every((id) => (id === "wild_berry" || G.isCropUnlocked(state, id))))); // 整合：田邊野莓開場可採，視為取得得到；胡蘿蔔仍不得出現
  G.refreshOrders(state, T0, () => 0.5);
  assert.ok(state.orders.every((o) => Object.keys(o.wants).every((id) => (id === "wild_berry" || G.isCropUnlocked(state, id)))), JSON.stringify(state.orders)); assert.ok(state.orders.every((o) => !o.wants.carrot));
  assert.ok(state.orders.every((o) => !o.wants.carrot), "開墾前不可出胡蘿蔔單");
});

test("3 開市小麥交付後，今日三件事固定顯示第一餐；第四、五章任務卡帶任務名稱", () => {
  const state = fresh(); state.adventure.claimed.c1_homecoming = true; state.adventure.claimed.c1_first_harvest = true;
  const goals = A.earlyGoals(state, T0).goals;
  assert.equal(goals[0].id, "meal");
  assert.equal(goals[0].name, "去灶台做一份農家麥餅（回家的第一餐）");
  assert.equal(goals[0].target, "kitchen");
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  assert.match(world, /q && q\.chapter >= 4 \? q\.name \+ "・"/);
});

test("4 鎮長第一件個人委託不搶小麥，旅行商人只收兩份小麥", () => {
  const state = fresh(); state.adventure.claimed.c1_homecoming = true;
  const mayor = A.personalQuests(state, T0).find((q) => q.id === "mayor_first_notice");
  assert.equal(mayor.requirements.some((r) => r.id === "wheat"), false);
  state.storage.items.wheat = 1; state.adventure.r58.nextEventAt = T0;
  let i = 0; A.maybeTriggerRandomEvent(state, T0, () => [0.01, 0][i++]);
  let active = A.randomEvents(state, T0).active;
  assert.equal(active.options.find((o) => o.id === "trade").label, "用 2 份小麥換 1 包");
  assert.equal(active.options.find((o) => o.id === "trade").unavailableReason, "小麥不足：有 1／需 2");
  state.storage.items.wheat = 2;
  assert.equal(A.resolveRandomEvent(state, "trade", T0 + 1).ok, true);
  assert.equal(state.storage.items.wheat, undefined);
});

test("5 第一次開墾附送三份胡蘿蔔種子，解鎖後仍能繼續種田", () => {
  const state = fresh(); state.level = 2;
  const next = G.nextUpgrade(state, "plotCount"); state.coins = next.cost + 1;
  assert.match(G.upgradeCardInfo(state, "plotCount").effect, /附送胡蘿蔔種子 3 份/);
  const result = G.buyUpgrade(state, "plotCount");
  assert.equal(result.ok, true); assert.equal(state.adventure.r58.r59.seedPacks.carrot, 3);
  assert.equal(G.isCropUnlocked(state, "carrot"), true);
  assert.equal(state.coins, 1, "買完仍保留金幣，三包附送種子可先種田");
  assert.equal(G.plant(state, 0, "carrot", T0 + 1).ok, true);
  assert.equal(state.adventure.r58.r59.seedPacks.carrot, 2, "先消耗附送種子，不再扣金幣");
});

console.log(`VERIFIED content R62A systems (${passed}/5)`);
if (process.exitCode) process.exit(1);
