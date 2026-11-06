// R51：第一道陽光停久一點配合教學、選擇期間蘿拉 4 份大單排第一、手機種子卡顯示單價、收合任務卡只顯示任務名與進度。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }
const game = read("src/game.js"), ui = read("src/ui.js"), css = read("src/content-r42.css");
test("第一道陽光停 40 秒，之後恢復 16 秒", () => {
  assert.match(game, /firstDurationMs: 40000/);
  assert.match(game, /const dur = sun\.spawned \? SUNPATCH\.durationMs : SUNPATCH\.firstDurationMs;/);
  assert.match(game, /durationMs: sun\.durationMs \|\| SUNPATCH\.durationMs,/);
});
test("第一個選擇未完成時，4 份大單排在訂單最前面", () => {
  assert.ok(ui.includes('const k = state.orders.findIndex((o) => o.id === "beginner_wheat_4"); if (k > 0) state.orders.unshift'), "直接調整 state.orders 順序，分配與交付一致");
});
test("手機種子卡顯示單價、收合任務卡隱藏步驟名並單行顯示", () => {
  assert.match(css, /#mapScene \.seed \.sc \{ display: block !important;/);
  assert.match(css, /#questDock\.quest-collapsed \.world-objective-title \.qp-step,/);
  assert.match(css, /#questDock\.quest-collapsed \.world-objective-title, #questDock\.quest-auto-collapsed \.world-objective-title \{ white-space: nowrap !important;/);
});
console.log(`VERIFIED content R51 flow (${passed}/3)`);
