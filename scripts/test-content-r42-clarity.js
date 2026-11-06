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
  assert.match(ui, /馬上 \+14 金（現有 \$\{\(farmState && farmState\.coins\) \|\| 0\} 金），再回來做餅/); // R43：理由寫實際金幣，不再宣稱「才夠升級」
  assert.match(ui, /先拿經驗、第 1 章更快完成/);
  assert.match(world, /data-world-go \$\{choiceRoutes && !\/route\[\^"\]\*tracked\/\.test\(choiceRoutes\)/);
});
test("任務完成待回報時章節進度寫「待回報」，作物標籤寫出已種格數", () => {
  assert.match(world, /本章 \$\{guide\.chapterProgress\.claimed\}\/\$\{guide\.chapterProgress\.total\}\$\{q\.canClaim \? "・待回報" : ""\}/);
  assert.match(ui, /已種 \$\{planted\}／3 格・種滿再澆水/);
});
test("升級／手記面板中被黏底「再顯示」蓋到的卡會收起，訂單保留首屏兩張", () => {
  assert.match(ui, /key !== "orders" && visibleCount > 1 && cards\[visibleCount - 1\]\.getBoundingClientRect\(\)\.bottom > btn\.getBoundingClientRect\(\)\.top \+ 1/);
});
test("R42 樣式已載入並快取", () => {
  assert.match(html, /src\/content-r42\.css\?v=/);
  assert.match(sw, /versioned\("\.\/src\/content-r42\.css"\)/);
});
console.log(`VERIFIED content R42 clarity (${passed}/5)`);
