// R44：麥餅地點統一為農舍灶台、預告按鈕不再縮寫「交班伯」、升級警告縮短、面板開啟時任務標題可兩行、對話中隱藏前往、二選一看得出可點。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }
const G = require("../src/game.js"), S = require("../src/state.js");
const ui = read("src/ui.js"), adv = read("src/adventure.js"), world = read("src/world-ui.js"), css = read("src/content-r42.css");
test("麥餅地點統一為農舍灶台", () => {
  assert.match(adv, /在農舍灶台做一份農家麥餅/);
  assert.match(world, /把剛收的小麥帶去農舍灶台/);
});
test("市集預告按鈕寫完整的老農班伯", () => {
  const st = S.defaultState(1_900_000_000_000);
  assert.equal(G.marketPreviewAction(st).label, "先收成小麥（已收 0/6，要交老農班伯 2 份）");
  assert.doesNotMatch(read("src/game.js"), /交班伯需/);
});
test("升級警告句子縮短", () => {
  assert.match(ui, /金，買一輪種子要 \$\{fmtNum\(cardInfo\.roundSeedCost\)\} 金。/);
});
test("面板開啟時任務標題可兩行、對話中隱藏前往、二選一有「選這條」", () => {
  assert.match(css, /-webkit-line-clamp: 2/);
  assert.match(css, /#worldDialogue:not\(\[hidden\]\)\) #questDock \[data-world-go\] \{ visibility: hidden; \}/);
  assert.match(css, /content: "選這條 ▶"/);
});
test("作物先熟、田裡已無可澆作物時，澆水步驟補記完成，不會卡關", () => {
  assert.match(world, /function unstickWaterStep\(s\)/);
  assert.match(world, /if \(waterable \|\| !anyReady\) return false;/);
  assert.match(world, /A\.record\(s, \{ type: "water", count: remain \}, now\)/);
});
console.log(`VERIFIED content R44 wording (${passed}/5)`);
