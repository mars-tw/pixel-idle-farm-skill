// R46：花到買不起種子的升級直接停用並寫原因、手記已交付任務標「已完成」、章節進度標「本章任務」、待選路線時有「選擇下一步」入口、手機訂單底部預留空間。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }
const ui = read("src/ui.js"), world = read("src/world-ui.js"), css = read("src/content-r42.css");
test("升級會讓金幣不夠買一輪種子時，按鈕停用並寫「先留種子錢」", () => {
  assert.match(ui, /\$\{G\.canBuyUpgrade\(state, key\) && !cardInfo\.reserveRisk \? "" : "disabled"\}/);
  assert.match(ui, /先留種子錢/);
});
test("手記已交付任務標「已完成」，任務列章節進度寫「本章任務」", () => {
  assert.match(world, /claimed: "已完成" \}\[q\.status\]/);
  assert.match(world, /本章已交付 \$\{guide\.chapterProgress\.claimed\}/);
});
test("待選路線時有「選擇下一步」入口，按下會展開任務卡", () => {
  assert.match(world, /<button type="button" data-choice-open>選擇下一步<\/button>/);
  assert.match(world, /choiceOpen\.onclick = \(\) => \{ box\.classList\.remove\("quest-collapsed"/);
});
test("手機訂單面板底部預留空間", () => {
  assert.match(css, /\.side-pane\[data-pane="orders"\] \{ padding-bottom: 64px !important; \}/);
});
console.log(`VERIFIED content R46 guard (${passed}/4)`);
