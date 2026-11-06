"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const S = require("../src/state.js");
const G = require("../src/game.js");
const D = require("../src/daily.js");
const A = require("../src/adventure.js");

const T = Date.parse("2026-11-06T09:00:00+08:00");
const read = (file) => fs.readFileSync(file, "utf8");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }

test("A1 點擊卡片外會先關閉回饋卡，卡片內點擊不會提前關閉", () => {
  const ui = read("src/ui.js");
  const match = ui.match(/document\.addEventListener\("pointerdown", (\(event\) => \{ if \(closeActiveSettlement[\s\S]*?\}), true\);/);
  assert.ok(match, "找不到結算卡的捕獲階段 pointerdown 處理器");
  const handler = vm.runInNewContext(match[1], {
    closeActiveSettlement: () => { throw new Error("未注入關閉函式"); },
  });
  let closed = 0;
  const context = { closeActiveSettlement: () => { closed++; } };
  const runnable = vm.runInNewContext(match[1], context);
  runnable({ target: { closest: (selector) => selector === ".settlement-card" ? null : null } });
  assert.equal(closed, 1);
  runnable({ target: { closest: (selector) => selector === ".settlement-card" ? {} : null } });
  assert.equal(closed, 1);
  assert.equal(typeof handler, "function");
});

test("A1 面板、更多選單、對話窗開啟時 speak 延後", () => {
  const world = read("src/world-ui.js");
  const match = world.match(/const speakBlocked = (\(\) => \{[\s\S]*?\}); \/\/ R37/);
  assert.ok(match, "找不到 speakBlocked 判斷");
  const blocked = ({ toast = 0, panel = false, menu = false, modal = false }) => vm.runInNewContext(`(${match[1]})`, {
    el: () => ({ children: { length: toast } }),
    document: {
      querySelector: (selector) => selector.includes("side-panel") ? (panel ? {} : null) : selector.includes("farmMenu") ? (menu ? {} : null) : selector.includes("modal.show") ? (modal ? {} : null) : null,
    },
  })();
  assert.equal(blocked({}), false);
  assert.equal(blocked({ panel: true }), true);
  assert.equal(blocked({ menu: true }), true);
  assert.equal(blocked({ modal: true }), true);
});

test("A1 市集開放里程碑與任務列都指向料理", () => {
  assert.match(G.milestoneCard("market_open").next, /任務列.*灶台做晚餐/);
  const state = readyForFirstHarvestClaim();
  const result = A.claim(state, "c1_first_harvest", T);
  assert.equal(result.ok, true);
  assert.equal(A.guide(state, T).actionLabel, "前往料理");
});

test("A2 市集預告依主線已收小麥數切換文字與目的地", () => {
  const state = S.defaultState(T);
  state.stats.harvested.wheat = 0;
  assert.deepEqual(G.marketPreviewAction(state), { harvested: 0, target: "field", label: "先收成小麥（已收 0/6，要交老農班伯 2 份）" });
  state.stats.harvested.wheat = 6;
  assert.deepEqual(G.marketPreviewAction(state), { harvested: 6, target: "elder", label: "前往老農班伯（交付 2 份小麥）" });
  const ui = read("src/ui.js");
  assert.match(ui, /預覽・尚未開放/);
  assert.match(ui, /action\.target === "field".*tile\.plotIndex === 0/);
});

test("A3 印章冊表頭不混用分母，每項都顯示目前與目標", () => {
  const ui = read("src/daily-ui.js");
  assert.match(ui, /今天可做 \$\{st\.available\} 項・達成 \$\{st\.completed\}・已領 \$\{st\.claimed\}/);
  assert.doesNotMatch(ui, /已完成 \$\{st\.completed\}\/\$\{st\.available\}|已領取 \$\{st\.claimed\}\/\$\{st\.available\}/);
  assert.match(ui, /目前 \$\{Math\.min\(task\.have,task\.need\)\}／\$\{task\.need\}/);
  const state = S.defaultState(T);
  const sell = D.status(state, T).tasks.find((task) => task.id === "sell");
  assert.equal(`${sell.title} ${sell.have}/${sell.need}`, "賣出一份作物 0/1");
});

test("A4 對話的繼續是實心主按鈕，略過是小字次按鈕", () => {
  const css = read("src/content-r37a.css");
  const world = read("src/world-ui.js");
  assert.match(world, /class="dialogue-close"[^>]*>× 略過<\/button>/);
  assert.match(world, /class="dialogue-continue">繼續 ▶<\/button>/);
  assert.match(css, /\.dialogue-continue[\s\S]*min-height: 42px[\s\S]*background: #5f8a45[\s\S]*color: #fffdf4/);
  assert.match(css, /\.dialogue-close[\s\S]*background: transparent[\s\S]*font-size: 11px/);
});

test("A5 第一批交付後卡片、任務列與班伯台詞只指向料理", () => {
  const state = readyForFirstHarvestClaim();
  const result = A.claim(state, "c1_first_harvest", T);
  assert.equal(result.ok, true);
  assert.match(result.settlement.next, /農舍灶台.*晚餐/);
  assert.match(result.milestones.find((row) => row.type === "market_open").next, /灶台做晚餐/);
  const guide = A.guide(state, T);
  assert.equal(guide.questId, "c1_first_meal");
  assert.equal(guide.actionLabel, "前往料理");
  const world = read("src/world-ui.js");
  assert.match(world, /c1_first_harvest: "把剛收的小麥帶去農舍灶台，做一份自己的晚餐吧。灶火還能用。"/); // R44：任務與台詞統一為「農舍灶台」（料理實際在農舍）
  assert.doesNotMatch(world, /c1_first_harvest: "別只顧著把作物賣掉/);
});

function readyForFirstHarvestClaim() {
  const state = S.defaultState(T);
  A.ensure(state, T);
  state.adventure.claimed.c1_homecoming = true;
  state.adventure.quests.c1_homecoming.status = "claimed";
  state.adventure.counts.harvest = 6;
  state.adventure.byTarget.harvest.wheat = 6;
  state.storage.items.wheat = 2;
  return state;
}

test("A0 整合：對話開著時按「更多」先收起對話再開選單", () => {
  const more = require("fs").readFileSync(require("path").join(__dirname, "../src/art-r84.js"), "utf8");
  assert.match(more, /if\(menu\.hidden&&dlg&&!dlg\.hidden\)dlg\.hidden=true;/);
});

console.log(`PASS content-r37 systems ${passed}/8`);
