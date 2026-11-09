"use strict";
/* R68B 驗收：第 4 項 Lv 2 只解鎖小麥時訂單多樣性、第 5 項建造卡缺口文字。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
const C = require("../src/config.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const A = require("../src/adventure.js");
const M = require("../src/midgame-r66.js");
const T0 = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (e) { console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; } }
function fresh(level, coins) {
  const s = S.defaultState(T0);
  assert.equal(A.ensure(s, T0).ok, true);
  if (level) s.level = level;
  if (Number.isFinite(coins)) s.coins = coins;
  return s;
}
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
  assert.ok(state.orders.some((o) => quickMs(state, o) <= 3 * 60 * 1000), label + "：其中一張 3 分鐘內可完成");
}

test("1 Lv 2 只解鎖小麥時，第二張是老農班伯要 1 顆雞蛋，且一張 3 分鐘內可完成", () => {
  for (const roll of [0, 0.5, 0.99]) {
    const s = fresh(2);
    s.adventure.claimed.c1_first_harvest = true;
    assert.deepEqual(G.availableOrderItems(s), ["wheat"], "前提：只解鎖小麥 rng=" + roll);
    G.refreshOrders(s, T0, () => roll);
    assertVariety(s, "只解鎖小麥 rng=" + roll);
    const egg = s.orders.find((o) => o.id === "r68_lv2_egg_1");
    assert.ok(egg, "應有 R68 雞蛋單 " + JSON.stringify(s.orders.map((o) => o.id)));
    assert.deepEqual(egg.wants, { egg: 1 });
    assert.equal(G.orderNarrative(s, egg).npcId, "elder");
    assert.match(G.orderNarrative(s, egg).npcName, /老農班伯/);
    assert.ok(s.orders.every((o) => !o.wants.carrot), "不可出還種不出的胡蘿蔔單");
  }
});

test("2 Lv 2 只解鎖小麥、先前已生成同人同物訂單，重新整理後換出多樣性", () => {
  const s = fresh(2);
  s.createdAt = T0 - 48 * 60 * 60 * 1000;
  s.adventure.claimed.c1_first_harvest = true;
  s.story.questId = "first_delivery"; s.ordersSeededAt = 3;
  s.orders = [2, 3, 4].map((qty, i) => ({ id: "old_" + i, wants: { wheat: qty }, npcId: "merchant", rarity: "common", rewardCoins: qty * 7, rewardXp: 2, expiresAt: T0 + 30 * 60 * 1000 }));
  G.refreshOrders(s, T0, () => 0.99);
  assertVariety(s, "重新整理後");
});

test("3 兩張訂單物品不同時，不出現共用或同物提示；同物時仍保留提示", () => {
  const s = fresh(2);
  s.orders = [
    { id: "a", wants: { wheat: 2 }, npcId: "merchant" },
    { id: "b", wants: { egg: 1 }, npcId: "elder" },
  ];
  assert.equal(G.orderPriorityAdvice(s, s.orders[0]), "");
  assert.equal(G.orderPriorityAdvice(s, s.orders[1]), "");
  s.orders = [
    { id: "a", wants: { wheat: 4 }, npcId: "merchant" },
    { id: "b", wants: { wheat: 2 }, npcId: "elder" },
  ];
  assert.match(G.orderPriorityAdvice(s, s.orders[0]), /同樣需要這項作物/);
});

test("4 雞蛋單可正常交付（雞蛋不足改單不是死路）", () => {
  const s = fresh(2);
  s.adventure.claimed.c1_first_harvest = true;
  G.refreshOrders(s, T0, () => 0.5);
  const egg = s.orders.find((o) => o.id === "r68_lv2_egg_1");
  assert.ok(egg);
  s.storage.items.egg = 1;
  const before = s.coins;
  const r = G.fulfillOrder(s, egg.id, T0 + 1000, () => 0.5);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(s.coins > before);
});

test("5 建造卡分別寫等級與金幣缺口，兩者都滿足才顯示可建", () => {
  const both = M.facilityStatus(fresh(1, 27), T0).find((r) => r.type === "r66_beehive");
  assert.equal(both.levelGap, 1); assert.equal(both.coinShortfall, 13);
  assert.equal(both.gapText, "需要 Lv 2（還差 1 級）、還差 13 金");
  assert.equal(both.canBuild, false);
  const coinOnly = M.facilityStatus(fresh(2, 27), T0).find((r) => r.type === "r66_beehive");
  assert.equal(coinOnly.gapText, "還差 13 金"); assert.equal(coinOnly.canBuild, false);
  const levelOnly = M.facilityStatus(fresh(1, 100), T0).find((r) => r.type === "r66_beehive");
  assert.equal(levelOnly.gapText, "需要 Lv 2（還差 1 級）"); assert.equal(levelOnly.canBuild, false);
  const ok = M.facilityStatus(fresh(2, 40), T0).find((r) => r.type === "r66_beehive");
  assert.equal(ok.gapText, "可以建造"); assert.equal(ok.canBuild, true);
  assert.match(M.canBuildFacility(fresh(1, 100), "r66_beehive", T0).message, /需要 Lv 2（還差 1 級）/);
  assert.match(M.canBuildFacility(fresh(2, 27), "r66_beehive", T0).message, /還差 13 金/);
  const ui = fs.readFileSync("src/ui.js", "utf8");
  const mid = fs.readFileSync("src/midgame-r66.js", "utf8");
  assert.match(ui, /需要 Lv \$\{def\.unlockLevel\}（還差 \$\{levelGap\} 級）/);
  assert.match(ui, /buildingCostShortfall\(def\.cost\)/);
  assert.doesNotMatch(mid, /或金幣不足/);
  assert.doesNotMatch(ui, /或金幣不足/);
});

test("6 整合：第二種訂單排在前兩張（訂單面板預設只顯示兩張）", () => {
  for (const roll of [0, 0.5, 0.99]) {
  const s = fresh(1, 40);
  s.adventure.claimed.c1_first_harvest = true;
  G.refreshOrders(s, T0, () => roll); // 市集開張時（Lv 1）先生成第一批
  G.addXp(s, global.xpForLevel(2) - (s.xp || 0) + 1); // 實際升級路徑：不另外整理訂單
  const idx = s.orders.findIndex((o) => !(o.wants && o.wants.wheat));
  assert.ok(idx >= 0 && idx <= 1, `非小麥訂單應在前兩張，實際位置 ${idx}：${JSON.stringify(s.orders.map((o) => Object.keys(o.wants)))}`);
  }
});

console.log(`VERIFIED content R68B orders (${passed}/6)`);
if (process.exitCode) process.exit(1);
