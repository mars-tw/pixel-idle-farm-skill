// R41 整合：遠處 NPC 小名字、面板開啟時任務卡改用收合摘要、升級按鈕寫價格與餘額、里程碑卡避開資源列。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }
const ui = read("src/ui.js"), css = read("src/content-r41.css"), html = read("index.html"), sw = read("sw.js");
test("遠處 NPC 腳下有小名字且不參與名牌避讓", () => {
  assert.match(ui, /foot\.className = "npc-footname"/);
  assert.match(css, /\.npc-footname \{[^}]*pointer-events: none/);
});
test("大型面板開啟時任務卡改用收合摘要並保留行動按鈕", () => {
  assert.match(css, /#questDock:not\(\.quest-collapsed\) \.world-objective-bottom \{ display: flex !important;/);
  assert.match(css, /#questDock:not\(\.quest-collapsed\) \{ display: flex !important;[^}]*max-height: none !important/);
});
test("升級按鈕寫出價格，警告寫出升級後餘額", () => {
  assert.match(ui, /金<small class="u-confirm-note">先留種子錢<\/small>/);
  assert.match(ui, /升級後剩 \$\{fmtNum\(Math\.max\(0, state\.coins - next\.cost\)\)\} 金/);
});
test("里程碑卡在桌面避開第二列資源、R41 樣式已載入並快取", () => {
  assert.match(css, /top: max\(116px, env\(safe-area-inset-top\)\)/);
  assert.match(html, /src\/content-r41\.css\?v=/);
  assert.match(sw, /versioned\("\.\/src\/content-r41\.css"\)/);
});
console.log(`VERIFIED content R41 polish (${passed}/4)`);
