"use strict";
/* R69 B 線驗收：第 4 項訂單完整一句、主線缺口與訂單缺口分開講、升級缺口標明是這項升級。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
const C = require("../src/config.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const A = require("../src/adventure.js");
const T0 = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function fresh() { const state = S.defaultState(T0); assert.equal(A.ensure(state, T0).ok, true); return state; }

test("1 計畫範例：手上 1 份留給第一餐、訂單要 4 份需再種 4 格，主線只說第一餐還差 1 份", () => {
  const state = fresh();
  state.adventure.claimed.c1_first_harvest = true;
  state.storage.items.wheat = 1;
  state.orders = [{ id: "o1", wants: { wheat: 4 } }];
  const orderText = G.orderAllocationText(state, state.orders[0]);
  assert.equal(orderText, "這張要 4 份小麥；你手上 1 份先留給回家的第一餐，所以還要再種 4 格（約 15 秒）");
  assert.equal(G.orderItemStatusText(state, state.orders[0], "wheat"), orderText);
  const mainText = A.nextFarmStep(state, T0).text;
  assert.equal(mainText, "回家的第一餐還差 1 份小麥，先種下小麥。");
  assert.equal(A.firstMealTask(state, T0).text, "回家的第一餐：還差 1 份小麥，先回田裡收成。");
  assert.equal(A.firstMealTask(state, T0).missing, 1);
  assert.equal(G.orderAllocationFor(state, "o1").missing.wheat, 4);
});

test("2 主線保留與前面的訂單同時占用時，份數分開寫明給誰", () => {
  const state = fresh();
  state.storage.items.wheat = 6;
  state.orders = [{ id: "first", wants: { wheat: 2 } }, { id: "second", wants: { wheat: 4 } }];
  assert.equal(G.orderAllocationText(state, state.orders[1]), "這張要 4 份小麥；你手上 6 份有 2 份先留給老農班伯、2 份先給前面的訂單，所以還要再種 2 格（約 15 秒）");
});

test("3 只有主線保留且部分可用時，寫明保留份數與再種格數", () => {
  const state = fresh();
  state.adventure.claimed.c1_homecoming = true;
  state.storage.items.wheat = 4;
  state.orders = [{ id: "wheat", wants: { wheat: 3 } }];
  const text = G.orderAllocationText(state, state.orders[0]);
  assert.equal(text, "這張要 3 份小麥；你手上 4 份有 2 份先留給老農班伯，所以還要再種 1 格（約 15 秒）");
  assert.match(text, new RegExp(`再種 1 格（約 ${Math.ceil(C.CROPS.wheat.growMs / 1000)} 秒）`));
});

test("4 夠交、手上為零與非作物訂單也都是完整一句且不寫算式", () => {
  const ready = fresh();
  ready.storage.items.wheat = 6;
  ready.orders = [{ id: "first", wants: { wheat: 4 } }];
  assert.equal(G.orderAllocationText(ready, ready.orders[0]), "這張要 4 份小麥；手上有 6 份，夠交這張了");
  const empty = fresh();
  empty.orders = [{ id: "o", wants: { wheat: 2 } }];
  assert.equal(G.orderAllocationText(empty, empty.orders[0]), "這張要 2 份小麥；你手上還沒有小麥，所以還要再種 2 格（約 15 秒）");
  const egg = fresh();
  egg.orders = [{ id: "e", wants: { egg: 2 } }];
  assert.equal(G.orderAllocationText(egg, egg.orders[0]), "這張要 2 份雞蛋；你手上還沒有雞蛋，所以還差 2 份雞蛋");
  for (const text of [G.orderAllocationText(ready, ready.orders[0]), G.orderAllocationText(empty, empty.orders[0])]) {
    assert.doesNotMatch(text, /庫存|可用|＝|=/, text);
    assert.doesNotMatch(text, /\b\d+m\b/, text);
  }
});

test("5 第一餐完成後不再保留，手上的可先交這張", () => {
  const state = fresh();
  state.adventure.claimed.c1_first_harvest = true;
  state.adventure.claimed.c1_first_meal = true;
  state.storage.items.wheat = 1;
  state.orders = [{ id: "o", wants: { wheat: 4 } }];
  assert.equal(G.orderAllocationText(state, state.orders[0]), "這張要 4 份小麥；你手上 1 份可以先交這張，所以還要再種 3 格（約 15 秒）");
});

test("6 升級視窗缺口標明是這項升級的金幣，主線提示仍只講第一餐", () => {
  const state = fresh();
  state.adventure.claimed.c1_first_harvest = true;
  state.storage.items.wheat = 1;
  state.coins = 0;
  assert.match(G.upgradeCardInfo(state, "plotCount").nextStep, /^這項升級還差 \d+ 金；/);
  const card = G.milestoneCard("level_up", { level: 2, state, now: T0 });
  assert.equal(card.next, A.nextFarmStep(state, T0).text);
  assert.match(card.next, /回家的第一餐還差 1 份小麥/);
});

test("7 訂單卡仍共用同一句、R69B 樣式只追加在 content-r58b.css 檔尾區", () => {
  const ui = fs.readFileSync("src/ui.js", "utf8");
  const card = ui.slice(ui.indexOf("function renderOrders()"), ui.indexOf("// ---------- 升級 ----------"));
  assert.match(card, /G\.orderItemStatusText\(state, o, cid\)/);
  const css = fs.readFileSync("src/content-r58b.css", "utf8");
  assert.ok(css.includes("/* R69B：訂單需求改成完整一句後"));
  assert.ok(css.includes('.side-pane[data-pane="orders"] .o-wants .w'));
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, "content-r58b.css 大括號應平衡");
});

console.log(`VERIFIED content R69B wording (${passed}/7)`);
if (process.exitCode) process.exit(1);
