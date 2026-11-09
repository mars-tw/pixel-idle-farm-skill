"use strict";
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

test("1 主線交付前後只有一種狀態說法", () => {
  const state = fresh(); state.adventure.claimed.c1_homecoming = true;
  let goal = A.earlyGoals(state, T0).goals[0];
  assert.equal(goal.name, "交給老農班伯 2 份小麥（已收 0/2）");
  assert.doesNotMatch(goal.name, /✓/);
  state.storage.items.wheat = 2;
  assert.equal(G.marketPreviewAction(state).label, "交給老農班伯 2 份小麥（已收 2/2）");
  state.adventure.claimed.c1_first_harvest = true;
  goal = A.earlyGoals(state, T0).goals[0];
  assert.equal(goal.name, "交給老農班伯 2 份小麥（已收 2/2）"); assert.equal(goal.complete, true); // R63：班伯項目保留並打勾。
  assert.equal(A.earlyGoals(state, T0).nextStep.name, "回家的第一餐");
  assert.equal(G.marketPreviewAction(state).label, "✓ 已交給老農班伯");
});

test("2 麥餅有三分鐘增益、HUD 寫名稱效果分秒，晚餐缺口導回田裡", () => {
  const state = fresh(); state.adventure.claimed.c1_first_harvest = true;
  const bread = A.recipes(state).find((r) => r.id === "rustic_bread");
  assert.equal(bread.effect.mul, 0.75); assert.equal(bread.effect.durationMs, 180000); assert.equal(bread.effect.durationText, "3 分鐘");
  state.storage.items.wheat = 2; assert.equal(A.cook(state, "rustic_bread", T0).ok, true); assert.equal(A.eatMeal(state, "rustic_bread", T0).ok, true);
  assert.equal(A.activeBuffs(state, T0 + 1000).growthRemainingMs, 179000); const buff = A.activeBuffs(state, T0 + 1000); assert.equal(buff.growthMeal, "農家麥餅"); assert.equal(buff.growthPct, 25); // 整合同步：HUD 改寫實際吃下的料理名稱，不再固定寫「麥餅」
  state.storage.items.wheat = 1;
  assert.deepEqual(A.firstMealTask(state, T0 + 1), { available: true, missing: 1, target: "field", text: "做一份自己的晚餐：還差 1 份小麥，先回田裡收成。" });
  const ui = fs.readFileSync("src/ui.js", "utf8");
  assert.match(ui, /${mealBuffs.growthMeal || "料理"}・成長 +${mealBuffs.growthPct || 25}%・${fmtBuffCountdown(mealBuffs.growthRemainingMs)}/);
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  assert.match(world, /送給\$\{esc\(r\.share\.who\)\}/); assert.doesNotMatch(world, /不提供限時增益/);
});

test("3 市集預覽與第一批不卡小麥，開墾買得起就能按", () => {
  const state = fresh(); state.level = 2; state.adventure.claimed.c1_first_harvest = true;
  const preview = G.previewMarketOrders(state, T0);
  assert.ok(preview.every((o) => Object.keys(o.wants).every((id) => G.isCropUnlocked(state, id)))); // R62：只列目前真的種得出的作物。
  G.refreshOrders(state, T0, () => 0.5);
  assert.ok(state.orders.every((o) => !o.wants.carrot), JSON.stringify(state.orders)); // R62：未開墾前不得先出胡蘿蔔單。
  state.orders = [
    { id: "small", wants: { wheat: 2 } }, { id: "large", wants: { wheat: 4 } },
  ];
  assert.match(G.orderPriorityAdvice(state, state.orders[0]), /先交這張/);
  const next = G.nextUpgrade(state, "plotCount"); state.coins = next.cost;
  assert.equal(G.canBuyUpgrade(state, "plotCount"), true); assert.equal(G.upgradeCardInfo(state, "plotCount").reserveRisk, true);
  assert.match(fs.readFileSync("src/ui.js", "utf8"), /提醒：升級後剩/);
  assert.doesNotMatch(fs.readFileSync("src/ui.js", "utf8"), /G\.canBuyUpgrade\(state, key\) && !cardInfo\.reserveRisk/);
});

test("4 三個主線節點各有三句對白、二選一、實際結果、日誌與不同回收台詞", () => {
  const cases = [
    ["mayor", {}, "tools", "neighbors"],
    ["elder", { c1_first_harvest: true }, "sell", "seed"],
    ["merchant", { c1_homecoming: true }, "sign", "listen"],
  ];
  for (const [npc, flags, left, right] of cases) {
    const recalls = [];
    for (const choice of [left, right]) {
      const state = fresh(); Object.assign(state.adventure.claimed, flags);
      const view = A.mainStoryChoice(state, npc, T0); assert.equal(view.lines.length, 3); assert.equal(view.options.length, 2); assert.equal(view.available, true);
      const before = state.adventure.r58.r59.journal.length;
      const result = A.resolveMainStoryChoice(state, npc, choice, T0 + 1);
      assert.equal(result.ok, true); assert.ok(Object.keys(result.reward).length); assert.equal(state.adventure.r58.r59.journal.length, before + 1);
      assert.equal(A.mainStoryRecall(state, npc, T0 + 120000), "");
      recalls.push(A.mainStoryRecall(state, npc, T0 + 120001));
    }
    assert.ok(recalls[0]); assert.ok(recalls[1]); assert.notEqual(recalls[0], recalls[1]);
  }
});

test("5 小事件兩分鐘後回收選擇，不可選項寫清楚缺口", () => {
  const state = fresh(); state.coins = 0; state.storage.items.wheat = 1; state.adventure.r58.nextEventAt = T0;
  let i = 0; assert.equal(A.maybeTriggerRandomEvent(state, T0, () => [0.01, 0][i++]).ok, true);
  const active = A.randomEvents(state, T0).active;
  assert.equal(active.options.find((o) => o.id === "buy").unavailableReason, "金幣不足：有 0／需 12");
  assert.equal(active.options.find((o) => o.id === "trade").unavailableReason, "小麥不足：有 1／需 2"); // R62：旅行商人的需求降為兩份。
  assert.equal(A.resolveRandomEvent(state, "decline", T0 + 1).ok, true);
  assert.equal(A.randomEventRecall(state, T0 + 120000), "");
  assert.match(A.randomEventRecall(state, T0 + 120001), /上回沒買/);
});

console.log(`VERIFIED content R60A systems (${passed}/5)`);
if (process.exitCode) process.exit(1);
