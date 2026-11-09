// R42：陽光小標籤、二選一寫出後果且待選時隱藏前往鈕、任務待回報標示、作物標籤寫格數、升級／手記被黏底按鈕蓋到的卡收起。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }
const ui = read("src/ui.js"), world = read("src/world-ui.js"), css = read("src/content-r42.css"), html = read("index.html"), sw = read("sw.js");
test("陽光出現時有不被對話藏起的小標籤，點一下帶到受光的田", () => {
  assert.match(world, /function updateSunChip\(s\)/);
  assert.match(world, /☀ 陽光照在 \$\{plots\.length\} 格田・剩/);
  assert.match(css, /\.sun-chip \{[^}]*position: fixed/);
});
test("二選一寫出各自後果，尚未選擇時隱藏前往鈕", () => {
  assert.ok(ui.includes("交出 4 份小麥：馬上 +${") && ui.includes("G.orderPayout(farmState, o).coins : 28") && ui.includes("但要再種一輪小麥才能做餅"), "選項寫實際交付金額（含加成）"); // R52
  assert.match(ui, /先拿經驗、第 1 章更快完成/);
  assert.match(world, /\? "data-choice-open" : "data-world-go"/); // R68：待選時同一個「現在做」主按鈕切成選擇下一步
});
test("任務卡只顯示目前步驟，章節交付進度移到故事手記，作物標籤寫出已種格數", () => {
  assert.ok(!world.slice(world.indexOf('box.innerHTML = `<div class="world-objective-title">'), world.indexOf('const choiceOpen =')).includes("本章已交付"));
  assert.ok(ui.includes('data-audit="story-chapter-progress"'));
  assert.match(ui, /已種 \$\{planted\}／3 格・種滿再澆水/);
});
test("升級／手記面板中被黏底「再顯示」蓋到的卡會收起，訂單保留首屏兩張", () => {
  assert.match(ui, /key !== "orders" && visibleCount > \(key === "story" \? 0 : 1\) && cards\[visibleCount - 1\]\.getBoundingClientRect\(\)\.bottom > btn\.getBoundingClientRect\(\)\.top \+ 1/); // R59B：故事清單只剩一張卡被橫條壓到也要收起（比原 > 1 更嚴），其餘清單保留原下限
});
test("R42 樣式已載入並快取", () => {
  assert.match(html, /src\/content-r42\.css\?v=/);
  assert.match(sw, /versioned\("\.\/src\/content-r42\.css"\)/);
});
console.log(`VERIFIED content R42 clarity (${passed}/5)`);
