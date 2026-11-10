"use strict";
/* R71A：成熟提示、祭典共用作物、第一章章名與任務名一致。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const A = require("../src/adventure.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const C = require("../src/config.js");
const T0 = 2000000;

const state = S.defaultState(T0);
assert.equal(A.ensure(state, T0).ok, true);
const firstChapter = A.quests(state, T0).filter((q) => q.chapter === 1);
assert.equal(firstChapter.length, 3);
assert.ok(firstChapter.every((q) => q.chapterName === "回家與第一餐"), "第一章所有任務共用章名「回家與第一餐」");
assert.deepEqual(firstChapter.map((q) => q.name), ["種下第一格", "老農班伯的開市小麥", "回家的第一餐"], "三個任務名保持固定");

const ui = fs.readFileSync("src/ui.js", "utf8");
const world = fs.readFileSync("src/world-ui.js", "utf8");
assert.match(ui, /if \(prog\.ready\) return name \+ "・可收成";/, "田邊泡泡的成熟文字由 getCropProgress.ready 決定，且成熟時只顯示可收成");
assert.match(world, /data-r71a-shared-crop="true"/);
assert.match(world, /（與祭典共用）/);
assert.match(world, /chapterTaskLabel\(q\)/, "任務卡與手札共用章名／任務名組字函式");

for (const q of A.quests(state, T0).filter((row) => row.chapter <= 3)) state.adventure.claimed[q.id] = true;
A.ensure(state, T0);
state.level = Math.max(state.level, C.CROPS.tomato.unlockLevel || 1);
const f = state.adventure.r61.festival;
f.unlocked = true; f.startsAt = T0 - 1000; f.endsAt = T0 + 300000; f.nextAt = 0;
f.baseline = { tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } };
f.harvestCrop = "tomato"; f.harvestRequired = 3; f.supportProvisioned = true;
state.plots[0] = { cropId: "tomato", plantedAt: T0 - C.CROPS.tomato.growMs - 1, wateredAt: 0 };
assert.equal(G.getCropProgress(state, state.plots[0], T0).ready, true);
const harvested = G.harvest(state, 0, T0);
assert.equal(harvested.ok, true);
assert.equal(A.record(state, { type: "harvest", cropId: harvested.cropId, count: harvested.added }, T0).ok, true);
const mainTomato = A.summary(state, T0).currentQuest.requirements.find((row) => row.id === "tomato");
const festivalTomato = A.festivalStatus(state, T0).goals.find((goal) => goal.id === "tomato");
assert.equal(mainTomato.current, harvested.added, "一次收成寫入主線庫存進度");
assert.equal(festivalTomato.current, Math.min(festivalTomato.required, harvested.added), "同一次收成寫入祭典進度");
assert.equal(state.adventure.byTarget.harvest.tomato, harvested.added, "收成事件只記一次，不重複加總");
console.log("VERIFIED content R71A systems");
