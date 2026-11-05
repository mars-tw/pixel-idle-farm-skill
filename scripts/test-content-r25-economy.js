"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const C = require("../src/config.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const A = require("../src/adventure.js");
const D = require("../src/daily.js");

const T0 = 2_000_000;
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("PASS " + name); }
  catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; }
}

test("新存檔第一天三張訂單全為已解鎖作物、各不相同且時限至少 30 分鐘", () => {
  const state = S.defaultState(T0);
  state.adventure = { claimed: { c1_first_harvest: true } };
  const orders = G.refreshOrders(state, T0, () => 0);
  assert.equal(orders.length, 3);
  assert.deepEqual(orders.map((order) => order.wants), [{ wheat: 2 }, { wheat: 3 }, { wheat: 4 }]);
  assert.ok(orders.every((order) => Object.keys(order.wants).every((id) => C.CROPS[id].unlockLevel <= state.level)));
  assert.equal(new Set(orders.map((order) => JSON.stringify(order.wants))).size, 3);
  assert.ok(orders.every((order) => order.expiresAt - (order.createdAt || T0) >= 30 * 60 * 1000));
  assert.ok(orders.every((order) => !/份量不用多/.test(order.flavor || "")));

  state.story.questId = "first_delivery";
  state.stats.harvested.wheat = C.CROPS.wheat.yield;
  const tutorialOrders = G.refreshOrders(state, T0 + C.CROPS.wheat.growMs, () => 0);
  assert.deepEqual(tutorialOrders.map((order) => order.wants), [{ wheat: 2 }, { wheat: 3 }, { wheat: 4 }]);
  assert.ok(tutorialOrders.every((order) => order.id !== "tutorial_first_delivery"));
});

test("停用交付鈕使用可行動的缺料文字", () => {
  const state = S.defaultState(T0);
  state.adventure = { claimed: { c1_first_harvest: true } };
  const order = G.refreshOrders(state, T0, () => 0)[0];
  assert.equal(G.canFulfill(state, order), false);
  assert.equal(G.orderMissingText(state, order), "還缺小麥 ×2");
  state.storage.items.wheat = 1;
  assert.equal(G.orderMissingText(state, order), "還缺小麥 ×1");
  const ui = fs.readFileSync(require.resolve("../src/ui.js"), "utf8");
  assert.ok(ui.includes('${can ? "交付" : escapeHtml(G.orderMissingText ? G.orderMissingText(state, o) : "缺少作物")}'));
});

test("第 1～3 章任務按鈕文字都是動作句，不含統計名詞", () => {
  const state = S.defaultState(T0);
  assert.equal(A.ensure(state, T0).ok, true);
  const objectives = A.quests(state, T0).filter((quest) => quest.chapter >= 1 && quest.chapter <= 3)
    .flatMap((quest) => quest.objectives);
  const actionStart = /^(找|種|替|收成|烤|修好|釣|採|照顧|交付|整理|泡)/;
  assert.ok(objectives.length > 0);
  for (const objective of objectives) {
    assert.match(objective.name, actionStart, objective.name);
    assert.doesNotMatch(objective.name, /(數量|次數|魚隻|作物數)/, objective.name);
  }
});

test("開場可購買的小麥種子數不少於空田格數", () => {
  const state = S.defaultState(T0);
  const affordableSeeds = Math.floor(state.coins / C.CROPS.wheat.seedCost);
  assert.ok(affordableSeeds >= G.activePlotCount(state), `${affordableSeeds} < ${G.activePlotCount(state)}`);
});

test("每日農務改用非主線動作，印章冊不再重複收成與小麥交付", () => {
  const state = S.defaultState(T0);
  const tasks = D.status(state, T0).tasks;
  assert.deepEqual(tasks.map((task) => task.id), ["water", "talk", "sell"]);
  assert.doesNotMatch(tasks.map((task) => task.detail).join(" "), /主線收成也算|交付.*小麥|右下角收成鍵/);
  D.record(state, "talk", 1, T0);
  assert.equal(D.status(state, T0).tasks.find((task) => task.id === "talk").have, 1);
});

test("更多選單與訂單面板使用清楚名稱、角色圖示與木框樣式", () => {
  const html = fs.readFileSync(require.resolve("../index.html"), "utf8");
  const ui = fs.readFileSync(require.resolve("../src/ui.js"), "utf8");
  const dailyCss = fs.readFileSync(require.resolve("../src/content-r24.css"), "utf8");
  assert.match(html, />地塊資訊<\/button>/);
  assert.doesNotMatch(html, />磚資訊<\/button>/);
  assert.match(ui, /縮放看整張地圖/);
  assert.match(ui, /用原尺寸逛地圖/);
  assert.match(html, /id="genderToggle"[\s\S]*?gender-icon/);
  assert.match(html, /side-pane\[data-pane="orders"\][^{]*\{[^}]*border: 3px solid/);
  assert.match(dailyCss, /\.chore-progress[^}]*background:#c7aa70[^}]*border:/);
});

process.on("exit", () => {
  if (!process.exitCode) console.log(`VERIFIED content R25 economy ${passed}/6`);
});
