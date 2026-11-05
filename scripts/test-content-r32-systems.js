"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const C = require("../src/config.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const A = require("../src/adventure.js");
const T = Date.parse("2026-11-05T09:00:00+08:00");
const source = (path) => fs.readFileSync(path, "utf8");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }

test("A1 未開放市集提供三張預告訂單與可點的主要動作", () => {
  const ui = source("src/ui.js");
  // R35：預告卡改由 previewMarketOrders 產生（與開放後第一批同範本），仍須是 3 張。
  assert.match(ui, /data-audit="preview-order"/);
  assert.equal(require('../src/game.js').previewMarketOrders(require('../src/state.js').defaultState(1_900_000_000_000), 1_900_000_000_000).length, 3);
  assert.match(ui, /data-order-main-go>\$\{escapeHtml\(G\.marketPreviewAction\(state\)\.label\)\}<\/button>/);
  assert.match(ui, /tile\.npc === "elder"/);
  assert.match(ui, /預覽・尚未開放/);
});

test("A2 新存檔至少一項建物可建造", () => {
  const state = S.defaultState(T);
  const buildable = C.BUILDING_ORDER.filter((type) => G.canBuild(state, type));
  assert.ok(buildable.length >= 1);
  assert.equal(buildable[0], "compostHeap");
  assert.ok(C.BUILDINGS.compostHeap.cost.coins <= C.GAME.startCoins);
});

test("A3 金幣與物品增減產生合併後的 HUD 飄字事件", () => {
  const before = { coins: 20, items: { wheat: 3, carrot: 1 } };
  const after = { coins: 32, items: { wheat: 1, carrot: 3 } };
  assert.deepEqual(G.resourceDeltaEvents(before, after), [
    { target: "coins", delta: 12, text: "+12 金" },
    { target: "storage", text: "－2 小麥、+2 胡蘿蔔", changes: 2 },
  ]);
  const ui = source("src/ui.js");
  assert.match(ui, /resourceDeltaEvents\(resourceHudSnapshot, nextResourceSnapshot\)\.forEach\(showResourceDelta\)/);
  assert.match(ui, /dataset\.audit = "resource-delta"/);
  assert.match(ui, /data-audit="upgrade-spend-all">升級後不足一輪種子成本/);
  assert.match(ui, /cardInfo\.reserveRisk \? "ghost" : "buy"/);
});

test("A4 故事手記先顯示進行中任務與下一段按鈕，設定顯示開關文字", () => {
  const ui = source("src/ui.js");
  const htmlStart = ui.indexOf("box.innerHTML = `<div class=\"story-card\">");
  const active = ui.indexOf("${activeQuestHtml}", htmlStart);
  const progress = ui.indexOf("data-progress=", htmlStart);
  assert.ok(htmlStart >= 0 && active > htmlStart && active < progress);
  assert.match(ui, /data-audit="story-current"/);
  assert.match(ui, /data-audit="story-next-go">前往下一段劇情/);
  assert.match(ui, /目前：\$\{enabled \? "開" : "關"\}/);
  assert.match(source("index.html"), /\.setting-toggle[^}]*font-size: 12px/s);
});

test("A5 任務、對話、訂單與手記使用一致稱呼", () => {
  assert.equal(C.NPCS.mayor.name, "鎮長葛瑞");
  assert.equal(C.NPCS.elder.name, "老農班伯");
  const adventureState = S.defaultState(T);
  const quests = A.quests(adventureState, T);
  assert.ok(quests.some((q) => /鎮長葛瑞/.test(q.description)));
  assert.ok(quests.some((q) => /老農班伯/.test(q.description)));
  const visibleSources = ["src/config.js", "src/adventure.js", "src/game.js", "src/ui.js", "src/world-ui.js"].map(source).join("\n");
  assert.doesNotMatch(visibleSources, /鎮長 葛瑞|老農 班伯/);
  assert.doesNotMatch(visibleSources, /(?<!鎮長)葛瑞(?!.*\.test\(name\))/);
  assert.doesNotMatch(visibleSources.replace(/交班伯需 2/g, ""), /(?<!老農)班伯/);
});

console.log(`R32 content systems: ${passed} passed`);
