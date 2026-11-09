"use strict";
// Run: node scripts/test-content-r59-systems.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const A = require("../src/adventure.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const T0 = 5900000;
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { failed++; console.error("FAIL " + name + "\n" + error.stack); } }
function ok(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result; }
function fresh() { const state = S.defaultState(T0); ok(A.ensure(state, T0)); return state; }
function trigger(state, eventIndex, at = T0) {
  state.adventure.r58.nextEventAt = at;
  const values = [eventIndex / 4 + 0.01, 0]; let i = 0;
  return ok(A.maybeTriggerRandomEvent(state, at, () => values[i++])).event;
}

test("1 主線所有入口共用老農班伯的開市小麥 2 份進度", () => {
  const state = fresh(); state.adventure.claimed.c1_homecoming = true; ok(A.ensure(state, T0));
  assert.match(A.quests(state, T0).find((q) => q.id === "c1_first_harvest").description, /2 份小麥/);
  assert.match(A.earlyGoals(state, T0).goals[0].name, /交給老農班伯 2 份小麥（已收 0\/2）/);
  assert.deepEqual(G.marketPreviewAction(state), { harvested: 0, target: "field", label: "交給老農班伯 2 份小麥（已收 0/2）" });
  state.storage.items.wheat = 2;
  assert.deepEqual(G.marketPreviewAction(state), { harvested: 2, target: "elder", label: "交給老農班伯 2 份小麥（已收 2/2）" });
  assert.match(fs.readFileSync(path.join(__dirname, "../src/game.js"), "utf8"), /"老農班伯的開市小麥"}」還需/); // R60 同步：交付前仍寫班伯任務名，交付後改寫「回家的第一餐」，故改比對樣板中的任務名
});

test("2 四種事件的每個選項都結算、寫日誌並回收選擇", () => {
  const choices = { traveling_merchant: ["buy", "trade", "decline"], crow_steal: ["shoo", "feed"], afternoon_rain: ["water", "collect"], lost_chick: ["coop", "tutu"] };
  Object.entries(choices).forEach(([eventId, ids], eventIndex) => ids.forEach((choiceId) => {
    const state = fresh(); state.coins = 50; state.level = 1; state.storage.items.wheat = 10;
    state.plots[0].cropId = "wheat"; state.plots[0].plantedAt = T0 - 1000;
    assert.equal(trigger(state, eventIndex).id, eventId);
    const result = ok(A.resolveRandomEvent(state, choiceId, T0 + 1));
    assert.equal(result.choiceId, choiceId); assert.match(result.journalText, /：/);
    assert.equal(state.adventure.r58.r59.journal.at(-1).choiceId, choiceId);
    if (eventId === "traveling_merchant" && choiceId !== "decline") {
      assert.ok(state.adventure.r58.r59.seedPacks.strawberry > 0);
      const coins = state.coins; const planted = G.plant(state, 1, "strawberry", T0 + 2);
      assert.equal(planted.ok, true); assert.equal(planted.usedSeedPack, true); assert.equal(state.coins, coins);
    }
  }));
  const declined = fresh(); declined.coins = 50; trigger(declined, 0); ok(A.resolveRandomEvent(declined, "decline", T0 + 1)); trigger(declined, 0, T0 + 200000); assert.match(A.randomEvents(declined, T0 + 200000).active.dialogue, /上次沒買/);
  const fed = fresh(); fed.storage.items.wheat = 2; trigger(fed, 1); ok(A.resolveRandomEvent(fed, "feed", T0 + 1)); trigger(fed, 1, T0 + 200000); assert.equal(fed.materials.stone, 1); assert.match(A.randomEvents(fed, T0 + 200000).active.dialogue, /亮亮的小石子/);
  const tutu = fresh(); trigger(tutu, 3); ok(A.resolveRandomEvent(tutu, "tutu", T0 + 1)); tutu.adventure.claimed.c1_homecoming = true; assert.match(A.personalQuests(tutu, T0 + 2).find((q) => q.npcId === "child").dialogue, /那隻小雞/);
});

test("3 每位鄰居完成兩件委託後都有永久結果", () => {
  const state = fresh(); state.adventure.claimed.c1_homecoming = true; state.adventure.claimed.c1_first_meal = true; state.storage.items = { wheat: 99, carrot: 99, river_mint: 1 }; // R62：鎮長首件改收採集物。
  for (const quest of A.personalQuests(state, T0)) ok(A.completePersonalQuest(state, quest.id, T0 + 1));
  const results = A.permanentResults(state, T0 + 2);
  assert.equal(results.length, 4); assert.ok(results.every((row) => row.unlocked && row.revisit.length > 10));
  assert.ok(A.recipes(state, T0 + 2).find((row) => row.id === "bamber_rain_soup").unlocked);
  assert.deepEqual(results.map((row) => row.kind).sort(), ["object", "object", "product", "recipe"]);
});

test("4 料理都有圖示與解鎖文字，增益有數值、時間與 HUD 倒數", () => {
  const state = fresh(); const locked = A.recipes(state, T0);
  assert.ok(locked.every((row) => row.icon && row.unlockText));
  assert.ok(locked.filter((row) => row.effect).every((row) => row.effect.durationMs > 0 && row.effect.durationText && /%|1 份/.test(row.effect.summary)));
  state.adventure.claimed.c1_first_harvest = true; state.storage.items = { wheat: 10, carrot: 10 }; ok(A.ensure(state, T0));
  ok(A.cook(state, "wheat_carrot_pancake", T0)); ok(A.eatMeal(state, "wheat_carrot_pancake", T0));
  assert.ok(A.activeBuffs(state, T0).growthRemainingMs > 0); assert.equal(A.activeBuffs(state, T0 + 300001).growthRemainingMs, 0);
  const ui = fs.readFileSync(path.join(__dirname, "../src/ui.js"), "utf8");
  assert.match(ui, /r59-buff-chip/); assert.match(ui, /growthRemainingMs/); assert.match(ui, /orderRemainingMs/);
});

test("5 今日三件事寫出釣台缺口、可修狀態與蘿拉位置", () => {
  const state = fresh(); state.adventure.claimed.c1_homecoming = true; ok(A.ensure(state, T0));
  let goals = A.earlyGoals(state, T0).goals;
  assert.match(goals.find((row) => row.id === "dock").detail, /木料 0\/4・石材 0\/2/);
  assert.match(goals.find((row) => row.id === "market").detail, /農場東側的市集攤位/);
  state.materials.wood = 4; state.materials.stone = 2; goals = A.earlyGoals(state, T0).goals;
  assert.equal(goals.find((row) => row.id === "dock").actionLabel, "去修釣台");
});

console.log(`\nR59A systems: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
