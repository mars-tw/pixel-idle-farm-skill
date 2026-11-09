"use strict";
/* R67 B 線驗收：第 4 項訂單文案口語化、第 5 項 Lv 2 訂單多樣性、第 6 項開墾後種滿。 */
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
function quickMs(state, order) {
  let plots = 0, ms = 0;
  for (const [id, qty] of Object.entries(order.wants || {})) {
    const crop = C.CROPS[id]; if (!crop) return Infinity;
    plots += Math.ceil(qty / crop.yield); ms = Math.max(ms, crop.growMs);
  }
  return plots <= G.activePlotCount(state) ? ms : Infinity;
}
function assertVariety(state, label) {
  const npcs = new Set(state.orders.map((o) => G.orderNarrative(state, o).npcId));
  const items = new Set(state.orders.flatMap((o) => Object.keys(o.wants || {})));
  assert.ok(state.orders.length >= 2, label + "：至少兩張訂單 " + JSON.stringify(state.orders));
  assert.ok(npcs.size >= 2, label + "：至少兩位委託人 " + JSON.stringify([...npcs]));
  assert.ok(items.size >= 2, label + "：至少兩種物品 " + JSON.stringify([...items]));
  assert.ok(state.orders.some((o) => quickMs(state, o) <= 3 * 60 * 1000), label + "：其中一張 3 分鐘內可完成 " + JSON.stringify(state.orders.map((o) => [o.id, quickMs(state, o)])));
}

test("1 訂單文案是一句口語，不再出現庫存算式", () => {
  const state = fresh();
  state.storage.items.wheat = 6;
  state.orders = [
    { id: "first", wants: { wheat: 4 } },
    { id: "second", wants: { wheat: 4 } },
  ];
  const readyText = G.orderAllocationText(state, state.orders[0]);
  const shortText = G.orderAllocationText(state, state.orders[1]);
  for (const text of [readyText, shortText]) {
    assert.doesNotMatch(text, /[=＝－-]/, text);
    assert.doesNotMatch(text, /庫存|可用/, text);
  }
  assert.equal(readyText, "這張要 4 份小麥；手上有 6 份，夠交這張了"); // R69B 同步：訂單改完整一句，先講這張要幾份
  assert.equal(shortText, "這張要 4 份小麥；你手上 6 份先留給老農班伯和前面的訂單，所以還要再種 4 格（約 15 秒）"); // R69B 同步：完整一句講清要幾份、保留給誰、再種幾格
  assert.equal(typeof G.orderItemStatusText, "function", "訂單卡每項物品共用同一句口語");
  assert.equal(G.orderItemStatusText(state, state.orders[1], "wheat"), shortText);
  const ui = fs.readFileSync("src/ui.js", "utf8");
  const card = ui.slice(ui.indexOf("function renderOrders()"), ui.indexOf("// ---------- 升級 ----------"));
  assert.match(card, /G\.orderItemStatusText\(state, o, cid\)/);
  assert.doesNotMatch(card, /＝可用|庫存 \$\{|主線保留 \$\{/);
});

test("2 Lv 2 開墾後同時出現的訂單有兩位委託人、兩種物品與一張速單", () => {
  for (const roll of [0, 0.5, 0.99]) {
    const state = fresh();
    state.level = 2; state.upgrades.plotCount = 1;
    state.adventure.claimed.c1_first_harvest = true;
    G.refreshOrders(state, T0, () => roll);
    assertVariety(state, "Lv 2 開墾後 rng=" + roll);
  }
});

test("3 Lv 2 開墾前先生成的同人同物訂單，開墾後重新整理會換出多樣性", () => {
  const state = fresh();
  state.level = 2; state.adventure.claimed.c1_first_harvest = true;
  state.story.questId = "first_delivery"; state.ordersSeededAt = 3;
  state.orders = [2, 3, 4].map((qty, i) => ({ id: "old_" + i, wants: { wheat: qty }, npcId: "merchant", rarity: "common", rewardCoins: qty * 7, rewardXp: 2, expiresAt: T0 + 30 * 60 * 1000 }));
  state.upgrades.plotCount = 1; // 模擬玩家剛開墾，胡蘿蔔已可種
  G.refreshOrders(state, T0 + 1000, () => 0.99);
  assertVariety(state, "開墾後重新整理");
  assert.ok(state.orders.every((o) => Object.keys(o.wants).every((id) => G.isCropUnlocked(state, id))), "只要求種得出的物品");
});

test("4 Lv 2 尚未開墾只解鎖小麥時，第二張改雞蛋單且不出胡蘿蔔單（R68B 第 4 項同步）", () => {
  const state = fresh();
  state.level = 2; state.adventure.claimed.c1_first_harvest = true;
  G.refreshOrders(state, T0, () => 0.5);
  assert.ok(state.orders.length >= 1);
  assert.ok(state.orders.every((o) => Object.keys(o.wants).every((id) => G.isCropUnlocked(state, id) || id === "egg")), JSON.stringify(state.orders));
  assert.ok(state.orders.some((o) => o.id === "r68_lv2_egg_1" && o.wants.egg === 1), "只解鎖小麥時第二張應為雞蛋單");
  assert.ok(state.orders.every((o) => !o.wants.carrot), "開墾前不可出胡蘿蔔單");
});

test("5 開墾後只剩 2 金，也能立刻把所有空田種滿", () => {
  const state = fresh();
  state.level = 2;
  const next = G.nextUpgrade(state, "plotCount");
  state.coins = next.cost + 2;
  const result = G.buyUpgrade(state, "plotCount");
  assert.equal(result.ok, true);
  assert.equal(state.coins, 2);
  assert.equal(state.adventure.r58.r59.seedPacks.carrot, 3, "原有附送胡蘿蔔種子不變");
  const active = G.activePlotCount(state);
  for (let i = 0; i < active; i++) {
    if (!state.plots[i].cropId) assert.equal(G.plant(state, i, "wheat", T0 + 1 + i).ok, true, "第 " + i + " 格種得下");
  }
  assert.ok(state.plots.slice(0, active).every((plot) => plot.cropId === "wheat"), "所有空格都已種滿");
  assert.equal(state.coins, 2, "附送種子種滿時不再扣金幣");
});

test("6 開墾不再出現留種提醒，第二次開墾的新格子也種得滿", () => {
  const state = fresh();
  state.level = 2; state.coins = G.nextUpgrade(state, "plotCount").cost;
  assert.equal(G.upgradeCardInfo(state, "plotCount").reserveRisk, false, "開墾附送種子種滿空格，不需留種提醒");
  assert.equal(G.buyUpgrade(state, "plotCount").ok, true);
  for (let i = 0; i < G.activePlotCount(state); i++) if (!state.plots[i].cropId) assert.equal(G.plant(state, i, "wheat", T0 + 1 + i).ok, true);
  const second = G.nextUpgrade(state, "plotCount");
  state.coins = second.cost + 2;
  assert.equal(G.buyUpgrade(state, "plotCount").ok, true);
  assert.equal(state.coins, 2);
  const active = G.activePlotCount(state);
  for (let i = 0; i < active; i++) {
    if (!state.plots[i].cropId) assert.equal(G.plant(state, i, "wheat", T0 + 100 + i).ok, true, "新格子第 " + i + " 格種得下");
  }
  assert.ok(state.plots.slice(0, active).every((plot) => plot.cropId), "第二次開墾後同樣種滿");
});

console.log(`VERIFIED content R67B economy (${passed}/6)`);
if (process.exitCode) process.exit(1);
