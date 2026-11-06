// R47：第一個選擇改用蘿拉的 4 份大單（選它要再種一輪才能做餅，才是真的取捨）、建造卡寫出效果、展開時不重複顯示選擇入口。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }
const ui = read("src/ui.js"), adv = read("src/adventure.js"), game = read("src/game.js"), css = read("src/content-r42.css");
test("市集路線改用 4 份大單，交出全部小麥後要再種才能做餅", () => {
  assert.match(adv, /id: "beginner_wheat_4", name: "交付蘿拉的小麥單", current: Math\.min\(4, have\), required: 4/);
  assert.match(adv, /之後要再種一輪小麥，才能做農家麥餅/);
  assert.match(game, /if \(order\.id === "beginner_wheat_4" && state\.adventure && state\.adventure\.firstChoice\)/);
  assert.ok(ui.includes("交出 4 份小麥：馬上 +${"), "選項寫實際交付金額"); // R52：與訂單卡含加成金額一致
});
test("建造卡寫出第一級效果", () => {
  assert.match(ui, /<em class="bw-effect">\$\{escapeHtml\(effect\)\}<\/em>/);
});
test("任務卡展開時不重複顯示「選擇下一步」", () => {
  assert.match(css, /#questDock:not\(\.quest-collapsed\):not\(\.quest-auto-collapsed\):not\(\.quest-target-collapsed\) \[data-choice-open\] \{ display: none !important; \}/);
});
test("收合任務卡仍保留「選擇下一步」並撐開寬度；手機橫式收合只顯示任務名與進度", () => {
  assert.match(css, /#questDock\.quest-collapsed \.world-objective-bottom \[data-choice-open\],/);
  assert.match(css, /#questDock\.quest-collapsed:has\(\[data-choice-open\]\) \{ width: auto !important;/);
  assert.match(css, /@media \(max-height: 480px\) and \(orientation: landscape\) \{\n  #questDock\.quest-collapsed \.world-chapter > span:first-child/); // 保留「本章任務」進度，只藏章節名稱
});
console.log(`VERIFIED content R47 choice (${passed}/4)`);
