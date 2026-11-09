// R60：買得起即可升級，留種改成提醒；其餘 R46 守門維持。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }
const ui = read("src/ui.js"), world = read("src/world-ui.js"), css = read("src/content-r42.css");
test("升級買得起即可按，留種改成提醒", () => {
  assert.match(ui, /\$\{G\.canBuyUpgrade\(state, key\) \? "" : "disabled"\}/);
  assert.match(ui, /留種提醒/);
});
test("手記已交付任務標「已完成」，章節進度留在故事手記", () => {
  assert.match(world, /claimed: "已完成" \}\[q\.status\]/);
  assert.match(ui, /data-audit="story-chapter-progress"/);
});
test("待選路線時只有「選擇下一步」入口，按下才開啟路線選擇", () => {
  assert.match(world, /<button type="button" data-choice-open>選擇下一步<\/button>/);
  assert.match(world, /choiceOpen\.onclick = \(\) => \{\s*const choiceModal = modal\("選擇下一步", choiceRoutes\)/);
});
test("手機訂單面板底部預留空間", () => {
  assert.match(css, /\.side-pane\[data-pane="orders"\] \{ padding-bottom: 64px !important; \}/);
});
console.log(`VERIFIED content R46 guard (${passed}/4)`);
