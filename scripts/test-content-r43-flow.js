// R43：麥餅地點一致、選完路線立即前往、二選一寫實際金幣並以兩色區分、解鎖改橫幅、播種時標出下一格空田。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }
const ui = read("src/ui.js"), world = read("src/world-ui.js"), adv = read("src/adventure.js"), css = read("src/content-r42.css");
test("班伯台詞與任務都說在農舍灶台做麥餅（料理實際在農舍）", () => {
  assert.match(world, /把剛收的小麥帶去農舍灶台/);
  assert.match(adv, /在農舍灶台做一份農家麥餅/);
  assert.doesNotMatch(world + adv, /野餐廚房/);
});
test("第一次選路線後立即前往", () => {
  assert.match(world, /if \(!status\.selected\) \{ const g2 = A\.guide\(s, Date\.now\(\)\);[^}]*openPanel\("orders"\); else if \(q2\) goQuest\(q2\);/);
});
test("二選一寫出現有金幣，並以主線／市集兩色區分", () => {
  assert.match(ui, /現有 \$\{\(farmState && farmState\.coins\) \|\| 0\} 金/);
  assert.match(css, /data-first-choice="meal"\] b::before \{ content: "主線｜"/);
  assert.match(css, /data-first-choice="order"\] b::before \{ content: "市集｜"/);
});
test("等級解鎖改成升級面板頂端的細橫幅，不再是升級卡", () => {
  assert.match(ui, /note\.className = "upgrade-unlock-banner new-unlock-summary"/);
  assert.doesNotMatch(ui, /note\.className = "up new-unlock-summary"/);
});
test("播種步驟標出下一格空田", () => {
  assert.match(world, /function markNextPlot\(s\)/);
  assert.match(css, /\.gtile\.next-plot::after \{ content: "下一格"/);
});
console.log(`VERIFIED content R43 flow (${passed}/5)`);
