"use strict";
/* R63 A 線驗收：今日三件事、NPC 自稱、主線手札與收穫祭現場。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
require("../src/config.js");
const A = require("../src/adventure.js");
const S = require("../src/state.js");
const T0 = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function ok(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result; }
function fresh() { const state = S.defaultState(T0); ok(A.ensure(state, T0)); return state; }
function finishThroughChapter5(state) {
  for (const q of A.quests(state, T0)) { state.adventure.claimed[q.id] = true; state.adventure.quests[q.id].status = "claimed"; state.adventure.quests[q.id].rewardGranted = true; }
  state.adventure.r61.festival.unlocked = true;
  state.adventure.r61.festival.startsAt = T0;
  state.adventure.r61.festival.endsAt = T0 + 300000;
  state.adventure.r61.festival.nextAt = 0;
  state.adventure.r61.festival.baseline = { harvest: 0, cook: 0, mayorTalk: 0, merchantTalk: 0 };
  state.adventure.r61.festival.completed = false;
  ok(A.ensure(state, T0));
}

test("1 今日三件事固定保留班伯項目，完成即計入，第一餐另列主線下一步", () => {
  const state = fresh();
  state.adventure.claimed.c1_homecoming = true;
  state.adventure.quests.c1_homecoming.status = "claimed";
  let view = A.earlyGoals(state, T0);
  assert.deepEqual(view.goals.map((g) => g.id), ["harvest", "dock", "market"]);
  assert.equal(view.goals.filter((g) => g.complete).length, 0);
  assert.equal(view.nextStep, null);
  state.adventure.claimed.c1_first_harvest = true;
  state.adventure.quests.c1_first_harvest.status = "claimed";
  view = A.earlyGoals(state, T0 + 1);
  assert.equal(view.goals[0].id, "harvest");
  assert.equal(view.goals[0].complete, true);
  assert.match(view.goals[0].name, /已收 2\/2/);
  assert.match(view.goals[0].detail, /已交付/);
  assert.equal(view.goals.filter((g) => g.complete).length, 1);
  assert.equal(view.nextStep.name, "回家的第一餐");
  state.adventure.claimed.c1_first_meal = true;
  state.adventure.quests.c1_first_meal.status = "claimed";
  view = A.earlyGoals(state, T0 + 2);
  assert.equal(view.nextStep.complete, true);
  assert.match(view.nextStep.detail, /第一章完成/);
});

test("2 鎮長第一次對白用自己的口氣，其他主線 NPC 會改成第一人稱", () => {
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  assert.match(world, /你就是她的孫子吧？先去祖母的田種下第一格，讓我看看你的本事。/);
  assert.doesNotMatch(world, /return "先找鎮長葛瑞/);
  assert.match(world, /ownNames\.reduce\(\(line, name\) => line\.replaceAll\(name, "我"\)/);
  for (const name of ["鎮長葛瑞", "老農班伯", "商人蘿拉", "孩童圖圖"]) assert.ok(world.includes(name));
});

test("3 手札最上方固定是目前主線，含完整說明、需求、前往按鈕，委託可展開全文", () => {
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  const css = fs.readFileSync("src/content-r58b.css", "utf8");
  assert.match(world, /r63a-main-story-wrap/);
  assert.match(world, /目前主線/);
  assert.match(world, /questCard\(currentMain, true\)/);
  assert.match(world, /rowsOf\(q\)\.map/);
  assert.match(world, /data-quest-go/);
  assert.match(world, /<details class="r63a-full-request"><summary>查看委託全文<\/summary>/);
  assert.match(css, /\.r63a-full-request\[open\] > p/);
  const state = fresh();
  for (const q of A.quests(state, T0).filter((q) => q.chapter < 4)) { state.adventure.claimed[q.id] = true; state.adventure.quests[q.id].status = "claimed"; }
  assert.equal(A.summary(state, T0).currentQuest.chapter, 4);
  for (const q of A.quests(state, T0).filter((q) => q.chapter < 5)) { state.adventure.claimed[q.id] = true; state.adventure.quests[q.id].status = "claimed"; }
  assert.equal(A.summary(state, T0).currentQuest.chapter, 5);
});

test("4 收穫祭期間有彩旗、燈籠、長桌、四位鄰居與可互動攤位，結束後全部移除", () => {
  const state = fresh(); finishThroughChapter5(state);
  const active = A.festivalScene(state, T0 + 1);
  assert.equal(active.active, true);
  assert.deepEqual(active.decorations.map((d) => d.id), ["bunting", "lanterns", "long_table"]);
  assert.deepEqual(active.neighbors.map((n) => n.id), ["mayor", "elder", "merchant", "child"]);
  assert.equal(active.stall.name, "祭典攤位");
  assert.equal(active.stall.goals.length, 3);
  assert.match(active.stall.rewardText, /收穫祭獎章 1 枚/);
  const ended = A.festivalScene(state, T0 + 300001);
  assert.deepEqual(ended, { active: false, decorations: [], neighbors: [], stall: null });
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  assert.match(world, /world\.querySelectorAll\("\.r63a-festival-scene"\)\.forEach\(\(node\) => node\.remove\(\)\)/);
  assert.match(world, /festivalStall/);
  assert.match(world, /查看收穫祭三個目標與獎勵/);
});

test("5 整合：收穫祭布置用像素圖、鄰居仍可交談；手機收合時保留一顆主要按鈕", () => {
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  const css = fs.readFileSync("src/content-r58b.css", "utf8");
  const sw = fs.readFileSync("sw.js", "utf8");
  for (const f of ["bunting.svg", "lanterns.svg", "stall.svg"]) {
    assert.ok(fs.existsSync("assets/generated/content-r63/" + f), f + " 應存在");
    assert.ok(sw.includes("assets/generated/content-r63/" + f), f + " 應列入離線快取");
    assert.ok(world.includes("content-r63/" + f), f + " 應被收穫祭場景使用");
  }
  assert.doesNotMatch(world, /node\.textContent = item\.icon/, "布置不可再用表情符號");
  assert.doesNotMatch(css, /data-r63a-festival="active"\] > \.ob\[data-kind="npc"\]/, "收穫祭期間不可藏起真正的鄰居（要能交談完成目標）");
  assert.match(world, /r63-primary/);
  assert.match(css, /quest-auto-collapsed[^{]*\.r63-primary \{ display: flex !important/);
  const state = fresh(); state.adventure.claimed.c1_homecoming = true;
  const early = A.earlyGoals(state, T0);
  assert.ok(early.goals.some((g) => !g.complete), "交付前至少有一項可當主要按鈕");
});

console.log(`VERIFIED content R63A systems (${passed}/5)`);
if (process.exitCode) process.exit(1);
