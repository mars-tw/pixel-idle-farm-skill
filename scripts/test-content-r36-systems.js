"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const C = require("../src/config.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const D = require("../src/daily.js");
const A = require("../src/adventure.js");

const T = Date.parse("2026-11-06T09:00:00+08:00");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }

test("A1 共用小麥依訂單順序分配，第二張還差 2 份", () => {
  const state = S.defaultState(T);
  state.storage.items.wheat = 6; // R66：2 份主線保留之外，仍有 4 份可分配給訂單。
  state.orders = [
    { id: "first", wants: { wheat: 2 } },
    { id: "second", wants: { wheat: 4 } },
  ];
  const rows = G.orderAllocation(state);
  assert.deepEqual(rows.map((row) => row.ready), [true, false]);
  assert.equal(rows[1].missing.wheat, 2);
  assert.equal(G.orderAllocationText(state, state.orders[1]), "這張要 4 份小麥；你手上 6 份有 2 份先留給老農班伯、2 份先給前面的訂單，所以還要再種 2 格（約 15 秒）"); // R69B 同步：分配數字不變，改完整一句並分開寫主線保留與前單占用
  assert.equal(G.fulfillOrder(state, "second", T).reason, "reserved", "後單不可繞過面板直接交付");
});

test("A2 新存檔文案不提前建議訂單收益，市集每日不計入可做數", () => {
  const state = S.defaultState(T);
  const daily = D.status(state, T);
  const sell = daily.tasks.find((task) => task.id === "sell");
  assert.equal(sell.available, false);
  assert.equal(daily.available, 2);
  assert.match(sell.detail, /市集開放後.*先把 2 份小麥交給老農班伯/);
  assert.doesNotMatch(sell.detail, /訂單.*(?:金|收益)/);
  const ui = fs.readFileSync("src/ui.js", "utf8");
  assert.match(ui, /const nextStep = next \? cardInfo\.nextStep : ""/); // R39：每張卡的差額與用途由同一份可測資料產生
  const summary = A.summary(state, T);
  assert.equal(summary.chapters[0].claimed, 0);
  assert.equal(summary.chapters[0].status, "active");
  assert.equal(summary.chapters[1].status, "locked");
  assert.match(fs.readFileSync("src/world-ui.js", "utf8"), /chapter\.claimed === chapter\.total \? "已完成"/);
});

test("A3 收成與澆水步驟會選對工具，成熟作物不受目前工具限制", () => {
  const ui = fs.readFileSync("src/ui.js", "utf8");
  assert.match(ui, /type === "water" \? "water" : type === "harvest" \? "hand"/);
  assert.match(ui, /manualToolStepKey !== step\.key/);
  assert.match(ui, /if \(tileReadyCrop\(tile\)\) \{/);
  assert.doesNotMatch(ui, /if \(tileReadyCrop\(tile\) && tool === "hand"\)/);
  const state = S.defaultState(T);
  state.plots[0] = { id: "p01", cropId: "wheat", plantedAt: T - C.CROPS.wheat.growMs - 1 };
  state.interaction.tool = "water";
  const result = G.harvest(state, 0, T);
  assert.equal(result.ok, true);
  assert.equal(state.storage.items.wheat, C.CROPS.wheat.yield);
});

test("A4 三種事件都有里程碑資料，回饋佇列一次只顯示一張", () => {
  const cards = [
    G.milestoneCard("chapter_one"),
    G.milestoneCard("market_open"),
    G.milestoneCard("level_up", { level: 2 }),
  ];
  cards.forEach((card) => {
    assert.equal(card.kind, "milestone");
    for (const key of ["title", "earned", "unlocked", "next"]) assert.ok(card[key]);
  });
  const queue = G.createFeedbackQueue();
  queue.push(cards[0]); queue.push(cards[1]); queue.push(cards[2]);
  assert.equal(queue.status().active.type, "chapter_one");
  assert.equal(queue.status().queued, 2);
  queue.close();
  assert.equal(queue.status().active.type, "market_open");
  assert.equal(queue.status().queued, 1);
});

test("A5 第一章任務按鈕不重複標題或說明，互動標籤含對象", () => {
  const state = S.defaultState(T);
  const quests = A.quests(state, T).filter((quest) => quest.chapter === 1);
  for (const quest of quests) {
    const step = quest.objectives.find((row) => !row.complete) || quest.requirements.find((row) => !row.complete) || null;
    const action = A.taskActionLabel(quest, step, C.NPCS[quest.npcId]);
    assert.notEqual(action, quest.name);
    assert.notEqual(action, quest.description);
  }
  const npcTile = state.map.tiles.find((tile) => tile.npc === "mayor");
  assert.equal(G.interactionLabelForTile(state, npcTile, T), "交談・鎮長葛瑞");
  const plotTile = state.map.tiles.find((tile) => tile.plotIndex === 0);
  state.plots[0] = { id: "p01", cropId: "wheat", plantedAt: T - C.CROPS.wheat.growMs - 1 };
  assert.equal(G.interactionLabelForTile(state, plotTile, T), "收成・小麥田");
});

console.log(`PASS content-r36 systems ${passed}/5`);
