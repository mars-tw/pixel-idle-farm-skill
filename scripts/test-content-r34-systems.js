"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../src/config.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const A = require("../src/adventure.js");

const T = Date.parse("2026-11-06T09:00:00+08:00");
const read = (file) => fs.readFileSync(file, "utf8");
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS " + name);
}

test("A1 市集第一批訂單依已解鎖品項產生差異", () => {
  const state = S.defaultState(T);
  state.level = 2;
  state.upgrades.plotCount = 1; // R62：第一次開墾後才把胡蘿蔔加入首批訂單。
  state.story.questId = "first_delivery";
  state.adventure = { claimed: { c1_first_harvest: true } };
  const orders = G.refreshOrders(state, T, () => 0.1);
  assert.equal(orders.length, C.GAME.orderSlots);
  const itemIds = [...new Set(orders.flatMap((order) => Object.keys(order.wants)))];
  assert.ok(itemIds.length >= 2, "第一批至少有兩種已解鎖作物");
  assert.ok(itemIds.every((id) => C.CROPS[id] && G.isCropUnlocked(state, id)));
  assert.ok(orders.every((order) => order.firstBatch === true && order.expiresAt === null), "首批訂單必須不限時");
  // R60 同步：首批改為一張小麥單＋兩張胡蘿蔔單（計畫第 3 項，避免搶小麥），「同作物需求多者獎勵高」改用有兩張單的作物檢查，規則不放寬。
  const pairCrop = ["wheat", "carrot"].find((id) => orders.filter((order) => order.wants[id]).length >= 2);
  assert.ok(pairCrop, "首批至少一種作物有兩張需求不同的訂單");
  const wheat = orders.filter((order) => order.wants[pairCrop]).sort((a, b) => a.wants[pairCrop] - b.wants[pairCrop]);
  assert.ok(wheat.length >= 2 && wheat[1].wants[pairCrop] > wheat[0].wants[pairCrop]);
  assert.ok(orders.filter((order) => order.wants.wheat).length <= 1, "R60：首批最多一張小麥單");
  assert.ok(wheat[1].rewardCoins > wheat[0].rewardCoins, "同作物需求較多時，總獎勵必須更高");
  const economicRows = orders.map((order) => ({
    value: Object.entries(order.wants).reduce((sum, [id, qty]) => sum + C.CROPS[id].sellValue * qty, 0),
    reward: order.rewardCoins,
  })).sort((a, b) => a.value - b.value);
  for (let i = 1; i < economicRows.length; i++) assert.ok(economicRows[i].reward >= economicRows[i - 1].reward);
});

test("A2 訂單卡寫清楚需要、持有與跨單共用", () => {
  const ui = read("src/ui.js");
  assert.match(ui, /G\.orderItemStatusText\(state, o, cid\)/); // R67B 同步：需求列改用 game.js 的口語句，不再寫「需要・可用」算式
  assert.doesNotMatch(ui, /＝可用|庫存 \$\{fmtNum\(item\.stock\)\}－/); // R67B 同步：訂單卡不得再出現庫存算式
  assert.match(ui, /sharedNeeds\[cid\] > \(state\.storage\.items\[cid\] \|\| 0\)/);
  assert.match(ui, /與其他訂單共用\$\{escapeHtml\(item \? item\.name : cid\)\}/);
});

test("A3 子目標完成待回報時不再顯示 3/3", () => {
  const state = S.defaultState(T);
  A.quests(state, T);
  state.adventure.byTarget.talk = { mayor: 1 };
  state.adventure.counts.plant = 3;
  state.adventure.counts.water = 3;
  const quest = A.summary(state, T).currentQuest;
  assert.equal(quest.canClaim, true);
  assert.equal(quest.npcId, "mayor");
  const world = read("src/world-ui.js");
  assert.match(world, /q && q\.canClaim \? `✓ 回報\$\{/);
  assert.doesNotMatch(world, /rowsOf\(q\)\[rowsOf\(q\)\.length - 1\]/);
});

test("A4 稱呼與主角名全遊戲一致", () => {
  assert.equal(C.NPCS.mayor.name, "鎮長葛瑞");
  assert.equal(C.NPCS.elder.name, "老農班伯");
  const contentFiles = fs.readdirSync("src").filter((name) => /^content-.*\.js$/.test(name));
  const visibleFiles = ["config.js", "game.js", "adventure.js", "ui.js", "world-ui.js", ...contentFiles];
  const visible = visibleFiles.map((name) => read(path.join("src", name))).join("\n");
  assert.doesNotMatch(visible, /鎮長 葛瑞|老農 班伯/);
  const ui = read("src/ui.js");
  assert.match(ui, /state\.gender === "m" \? "凱" : "米莉"/);
  assert.match(ui, /locator\.querySelector\('span'\)\.textContent=state\.gender === "m" \? "凱" : "米莉"/);
  assert.doesNotMatch(ui, /主角：(?:Kai|Miri)|setting-desc">\$\{state\.gender === "m" \? "Kai" : "Miri"\}/);
});

test("A5 種子欄有品類與數量，預告訂單有實際獎勵", () => {
  const ui = read("src/ui.js");
  // R38：「新」標記可插在名稱後，單價仍須緊接顯示。
  // R78：「種子 」兩個字包進 r78-seed-prefix，48px 的窄卡與橫式手機放不下時只收這兩個字；品類字樣、作物名、單價都還在。
  assert.match(ui, /<span class="sn"><span class="r78-seed-prefix">種子 <\/span>\$\{escapeHtml\(c\.name\)\}\$\{isNew \? '<em class="new-unlock-badge">新<\/em>' : ''\}<\/span><span class="sc">\$\{c\.seedCost\} 金<\/span>/);
  // R35：預告卡與市集開放後第一批訂單同一份範本，委託人、需求與報酬逐欄相同。
  assert.match(ui, /G\.previewMarketOrders\(state, now\(\)\)/);
  const st = S.defaultState(1_900_000_000_000); st.level = C.CROPS.carrot.unlockLevel; st.story = st.story || {};
  const preview = G.previewMarketOrders(st, 1_900_000_000_000);
  A.ensure(st, 1_900_000_000_000); st.adventure.claimed.c1_first_harvest = true;
  const real = G.refreshOrders(st, 1_900_000_000_000, () => 0);
  assert.deepEqual(preview.map((o) => [o.id, JSON.stringify(o.wants), o.rewardCoins, o.rewardXp, o.npcId]), real.slice(0, preview.length).map((o) => [o.id, JSON.stringify(o.wants), o.rewardCoins, o.rewardXp, o.npcId]));
  assert.doesNotMatch(ui, /報酬：金幣與經驗/);
});

console.log(`R34 content systems: ${passed} passed`);
