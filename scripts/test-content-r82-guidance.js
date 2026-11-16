"use strict";
/* R82A：nextGuidance 同時提供完整 text 與人工 short；四個入口同步；提示不打架；結果可離開。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const State = require("../src/state.js");
const A = require("../src/adventure.js");
const G = require("../src/game.js");
const H = require("../src/heirloom.js");
const R = require("../src/story-r76.js");
const M = require("../src/midgame-r66.js");
const K = require("../src/cooking-r75.js");
const T0 = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function fresh() { const s = State.defaultState(T0); A.ensure(s, T0); M.ensure(s, T0); K.ensure(s, T0); return s; }
function delivered() { const s = fresh(); s.heirloom.sunWheat = 2; s.storage.items.wheat = 2; assert.equal(H.deliver(s, "table", T0).ok, true); return s; }
function pair(label, step) {
  assert.ok(step, label + " 有下一步");
  assert.equal(typeof step.text, "string", label + " 有 text");
  assert.equal(typeof step.short, "string", label + " 有 short");
  assert.ok(step.text.trim() && step.short.trim(), label + " 兩種說法都有內容");
  assert.notEqual(step.short, step.text, label + " short 不是完整句複製");
  assert.notEqual(step.text.slice(0, step.short.length), step.short, label + " short 不得是 text 開頭截字");
  assert.doesNotMatch(step.short, /…|\.\.\./, label + " short 不含省略號");
  assert.ok([...step.short].length <= 12, label + " short 控制在 12 個全形字內");
  return step;
}

test("1 四個可見入口只讀 AdventureAPI.nextGuidance，任務卡同時掛 full 與 short", () => {
  const world = read("src/world-ui.js"), heir = read("src/heirloom-ui.js"), daily = read("src/daily-ui.js");
  assert.match(world, /function nextGuidance\(s, now\)[\s\S]*A\.nextGuidance/);
  assert.match(world, /const farmNow = nextGuidance\(s, Date\.now\(\)\)/, "任務卡");
  assert.match(world, /const farmStep = nextGuidance\(current, Date\.now\(\)\)/, "手札現在做");
  assert.match(world, /guidance && guidance\.guidanceScope === "r81_story" \? guidance\.text : story\.line/, "任務清單");
  assert.match(world, /r82a-guidance-full/); assert.match(world, /r82a-guidance-short/);
  assert.match(heir, /A && A\.nextGuidance \? A\.nextGuidance\(s, Date\.now\(\)\)/, "祖母手記");
  assert.match(daily, /AdventureAPI\.nextGuidance\(s, Date\.now\(\)\)/, "祖母手記重繪簽章");
  assert.equal(typeof A.nextGuidance, "function");
});

test("2 列舉農務、餐籃與故事下一步，每個都有人工 text／short", () => {
  const rows = [];
  let s = fresh();
  rows.push(["農務：播種", pair("農務：播種", A.nextGuidance(s, T0 + 1))]);

  s = fresh(); s.coins = 999; assert.equal(G.plant(s, 0, "wheat", T0).ok, true);
  rows.push(["農務：澆水", pair("農務：澆水", A.nextGuidance(s, T0 + 1))]);
  assert.equal(G.waterPlot(s, 0, T0 + 2).ok, true);
  rows.push(["農務：等待", pair("農務：等待", A.nextGuidance(s, T0 + 3))]);
  s.plots[0].plantedAt = T0 - 120000; s.plots[0].wateredAt = T0 - 119999;
  rows.push(["農務：收成", pair("農務：收成", A.nextGuidance(s, T0 + 4))]);

  s = fresh(); s.storage.items.wheat = 2;
  rows.push(["農務：找鎮長", pair("農務：找鎮長", A.nextGuidance(s, T0 + 1))]);
  s.adventure.claimed.c1_homecoming = true;
  rows.push(["農務：交班伯", pair("農務：交班伯", A.nextGuidance(s, T0 + 2))]);
  s.adventure.claimed.c1_first_harvest = true;
  rows.push(["農務：做麥餅", pair("農務：做麥餅", A.nextGuidance(s, T0 + 3))]);
  s.adventure.meals.rustic_bread = 1;
  rows.push(["農務：吃麥餅", pair("農務：吃麥餅", A.nextGuidance(s, T0 + 4))]);
  s.adventure.claimed.c1_first_meal = true;
  rows.push(["農務：看釣台", pair("農務：看釣台", A.nextGuidance(s, T0 + 5))]);

  s = fresh(); H.start(s);
  rows.push(["餐籃：播種", pair("餐籃：播種", A.nextGuidance(s, T0 + 1))]);
  s.heirloom.sunWheat = 2; s.storage.items.wheat = 2;
  rows.push(["餐籃：送出", pair("餐籃：送出", A.nextGuidance(s, T0 + 2))]);

  s = delivered();
  rows.push(["故事：二選一", pair("故事：二選一", A.nextGuidance(s, T0 + 1))]);
  assert.equal(R.r81Choose(s, "plant", T0 + 2).ok, true);
  rows.push(["故事：種小麥", pair("故事：種小麥", A.nextGuidance(s, T0 + 3))]);
  s.storage.items.wheat = 2;
  rows.push(["故事：交訂單", pair("故事：交訂單", A.nextGuidance(s, T0 + 4))]);
  assert.equal(R.r81Deliver(s, T0 + 5).ok, true);
  rows.push(["故事：聽收尾", pair("故事：聽收尾", A.nextGuidance(s, T0 + 6))]);
  assert.ok(rows.length >= 15, "下一步狀態列舉完整");
});

test("3 所有下一步建構分支都明寫 short，沒有 slice／substring 截字", () => {
  const src = read("src/adventure.js");
  const section = src.slice(src.indexOf("function questFarmStep"), src.indexOf("function earlyGoals"));
  assert.doesNotMatch(section, /short\s*:\s*[^,;\n]*(?:slice|substring|substr)\s*\(/);
  const direct = section.split(/\r?\n/).filter((line) => /return \{/.test(line) && /text\s*:/.test(line));
  assert.ok(direct.length >= 10, "直接回傳的下一步狀態有列出");
  direct.forEach((line, index) => assert.match(line, /short\s*:/, "直接狀態 " + (index + 1) + " 缺 short：" + line.trim()));
  assert.match(section, /const field = \(action, tile, text, actionLabel, short, extra\)/, "一般農務建構器要求 short");
  assert.match(section, /const field = \(action, tile, text, short, actionLabel\)/, "故事農務建構器要求 short");
  assert.match(section, /const step = \(kind, title, detail, short, label, target, extra\)/, "餐籃建構器要求 short");
});

test("4 餐籃、選擇、具名訂單交付與收尾後，每一步都換成當下唯一下一步", () => {
  const s = delivered();
  let step = A.nextGuidance(s, T0 + 1);
  assert.equal(step.guidanceScope, "r81_story"); assert.equal(step.action, "story_choice"); assert.match(step.text, /封存舊麥種.*種回田裡/);
  assert.equal(R.r81Choose(s, "plant", T0 + 2).ok, true);
  step = A.nextGuidance(s, T0 + 3);
  assert.equal(step.guidanceScope, "r81_story"); assert.equal(step.action, "plant"); assert.match(step.text, /班伯的老麥回禮單.*先種一株小麥/);
  s.coins = 999; assert.equal(G.plant(s, 0, "wheat", T0 + 4).ok, true);
  step = A.nextGuidance(s, T0 + 5);
  assert.notEqual(step.action, "plant", "田裡已有小麥，不再叫玩家再種"); assert.doesNotMatch(step.text, /去種|先種/);
  s.storage.items.wheat = 2;
  step = A.nextGuidance(s, T0 + 6);
  assert.equal(step.action, "story_order"); assert.match(step.text, /2 份小麥已備齊/);
  assert.equal(R.r81Deliver(s, T0 + 7).ok, true);
  step = A.nextGuidance(s, T0 + 8);
  assert.equal(step.action, "story_scene"); assert.match(step.text, /具名訂單已交付/);
  assert.equal(R.r81SceneSeen(s, T0 + 9), true);
  step = A.nextGuidance(s, T0 + 10);
  assert.notEqual(step.guidanceScope, "r81_story", "故事收尾後回到當下農務，不停在開頭");
});

test("5 未成熟、結算後與田裡已有作物時，不會出現互相矛盾的下一步", () => {
  const s = fresh(); s.heirloom.started = false; s.coins = 999;
  assert.equal(G.plant(s, 0, "wheat", T0).ok, true);
  s.sun = { nextAt: T0 + 1000, previewAt: 0, startsAt: T0 - 1, endsAt: T0 + 10000, plots: [0], previewPlots: [], used: [], refractions: 0 };
  const step = A.nextFarmStep(s, T0 + 1);
  assert.notEqual(step.action, "plant"); assert.doesNotMatch(step.text, /可收成|去種/);
  assert.equal(G.getCropProgress(s, s.plots[0], T0 + 1).ready, false);
  const result = G.harvest(s, 0, T0 + 1);
  assert.equal(result.ok, false); assert.equal(result.reason, "not_ready");
  const ui = read("src/ui.js");
  assert.match(ui, /afterChange\(true\); enqueueResultFeedback\(r\)/, "田上狀態先重畫，再顯示結算");
  assert.match(ui, /renderTileStateLabel\(tile\); toast\(act\.invalid\)/, "還沒成熟提示前先重讀田上標籤");
});

test("6 空白卡與米色殘影從來源清掉；作物評比結果有可見繼續鈕", () => {
  const story = read("src/story-r76.js"), festival = read("src/festival-stall-r72.js");
  assert.match(story, /document\.querySelectorAll\("\.npc-bubble"\)\.forEach\(\(n\) => n\.remove\(\)\)/);
  assert.match(festival, /data-r82a-result-close>繼續<\/button>/);
  assert.match(festival, /continueButton\.onclick[\s\S]*world-modal-close/);
});

test("7 CSS 在檔尾且不改任務卡高度；次要狀態不是黃色主按鈕", () => {
  const css = read("src/content-r58b.css"), block = (css.match(/R82A（單一下一步[\s\S]*R82A 結束/) || [""])[0];
  assert.ok(block); assert.ok(css.trimEnd().endsWith("/* ===== R82A 結束 ===== */") || /R82A 結束 ===== \*\/\s*\/\*[^\n]*R83[ABC]/.test(css)); /* R83A 同步：R83 各線依規定接在 R82A 後面 */
  assert.match(block, /\.r82a-guidance-short \{ display: none; \}/);
  assert.match(block, /max-height: 52px !important/);
  assert.doesNotMatch(block, /150px|r82a-action-next-row/);
  assert.match(block, /#actionA \{ background: rgba\(49,92,64/);
  assert.match(block, /\.r80b-now-copy \{ min-height: 0; padding: 0; border: 0;/);
  assert.match(block, /\.quest-collapse-btn \{ background: #735034/);
  assert.match(block, /text-overflow: clip !important/);
  assert.match(block, /r82a-result-close[\s\S]*background: #ffd978/);
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
});

test("8 舊麥種故事裡要去田裡的指示，任務卡按鈕走一般田地流程，不會打開交單對話", () => {
  /* R82 整合：選「種回田裡」後具名訂單缺小麥，指示是「去種小麥」（target field），按鈕卻一直打開班伯的交單對話，實玩卡住。 */
  const world = read("src/world-ui.js");
  const go = world.slice(world.indexOf("function goNextFarmStep()"), world.indexOf("function goNextFarmStep()") + 1200);
  assert.match(go, /step\.guidanceScope === "r81_story" && step\.target !== "field" && window\.StoryR76/, "只有不是田地的故事指示才交給 r81Go");
  assert.doesNotMatch(go, /step\.guidanceScope === "r81_story" && window\.StoryR76 && window\.StoryR76\.r81Go/, "不可再把所有故事指示都交給 r81Go");
});

test("9 餐籃或故事指示排在前面時，第一次收成後的另一個選項（去修河畔釣台）仍會帶上", () => {
  /* R82 整合：重拍時發現 R82C 的二選一在第 1 章被餐籃與故事指示整個蓋掉。 */
  const s = fresh(); s.coins = 50; A.record(s, { type: "talk", npcId: "mayor" }, T0); assert.equal(G.plant(s, 0, "wheat", T0).ok, true); A.record(s, { type: "plant", cropId: "wheat" }, T0);
  assert.equal(A.claim(s, "c1_homecoming", T0).ok, true); s.plots[0].plantedAt = T0 - 3600000; s.plots[0].wateredAt = T0 - 3599999;
  const r = G.harvest(s, 0, T0 + 1, () => 1); A.record(s, { type: "harvest", cropId: "wheat", count: r.added }, T0 + 1);
  s.materials.wood = 4; s.materials.stone = 2; s.heirloom.started = true;
  const farm = A.nextFarmStep(s, T0 + 2), g = A.nextGuidance(s, T0 + 2);
  assert.ok(farm.alternative, "nextFarmStep 掛了另一個選項");
  if (g !== farm && !["refract", "catch_sun", "ripen"].includes(g.action)) assert.deepEqual(g.alternative, farm.alternative, "排在前面的指示也帶上同一個選項");
  else assert.ok(g.alternative || ["refract", "catch_sun", "ripen"].includes(g.action), "主線本身就帶選項或正在處理光");
  assert.equal(typeof g.alternative.short, "string"); assert.ok([...g.alternative.short].length <= 12);
});

console.log("VERIFIED content R82A guidance (" + passed + " tests)");
