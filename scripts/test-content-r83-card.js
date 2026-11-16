"use strict";
/* R83A 第 7 項（規則）：任務卡讀得懂、主線跟著劇情走。
   第 3 項：交餐籃給鎮長、或舊麥種故事裡鎮長葛瑞開口的那段聽完，都記一次跟鎮長的交談，第 1 章照一般規則完成，不直接改旗標。
   第 1、4 項：收合列只留短句；祖母手記收合時有短句與「另一件」小鈕。
   第 2 項：空白卡的根因（種子卡的 visibility 過場）已收掉。
   第 5 項：右下大鈕只讀任務卡的目標，不改 nextGuidance 的優先順序。
   第 6 項：任務卡的字與按鈕讀同一個來源；成熟後不留「還沒成熟」；空地不留「收成」鈕。 */
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
const T0 = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function fresh() { const s = State.defaultState(T0); A.ensure(s, T0); return s; }
const c1 = (s) => s.adventure.quests.c1_homecoming.status;
const talked = (s) => s.adventure.byTarget.talk.mayor || 0;
function planted(s, t) { s.coins = 999; assert.equal(G.plant(s, 0, "wheat", t).ok, true); A.record(s, { type: "plant", cropId: "wheat" }, t); A.finishTutorial(s, t); }

test("3-1 先種過第一格、再把餐籃交給鎮長：記一次交談，第 1 章照一般規則完成並拿到教學種子", () => {
  const s = fresh(); planted(s, T0 + 1);
  assert.equal(c1(s), "active", "只種了第一格，還沒找鎮長");
  assert.equal(A.summary(s, T0 + 2).currentQuest.id, "c1_homecoming");
  s.heirloom.started = true; s.heirloom.sunWheat = 2; s.storage.items.wheat = 2;
  const seeds = s.adventure.r58.r59.seedPacks.wheat || 0;
  const r = H.deliver(s, "doorstep", T0 + 3);
  assert.equal(r.ok, true); assert.equal(r.talkNpcId, "mayor", "交付結果標明是交到鎮長手上");
  const talk = R.r83NoteMayorTalk(s, T0 + 3);
  assert.equal(talk.ok, true); assert.ok(talk.tutorial && talk.tutorial.ok, "條件齊了，照 finishTutorial 結算");
  assert.equal(talked(s), 1, "記了一次跟鎮長的交談");
  assert.equal(c1(s), "claimed", "第 1 章找鎮長任務完成");
  assert.equal(s.adventure.r58.r59.seedPacks.wheat, seeds + 2, "教學種子跟一般完成一樣給");
  assert.notEqual(A.summary(s, T0 + 4).currentQuest.id, "c1_homecoming", "任務卡換到下一件，鎮長頭上的「!」不再指向找鎮長");
});

test("3-2 還沒種第一格就先跟鎮長說上話：只記交談，第 1 章等種下第一格才完成（一般規則不變）", () => {
  const s = fresh();
  const talk = R.r83NoteMayorTalk(s, T0 + 1);
  assert.equal(talk.ok, true); assert.equal(talk.tutorial, null, "條件不齊不結算");
  assert.equal(talked(s), 1); assert.notEqual(c1(s), "claimed");
  planted(s, T0 + 2);
  assert.equal(c1(s), "claimed", "種下第一格之後照原本的規則完成");
});

test("3-3 舊麥種故事裡鎮長有開口的段落才算；旁白、只有班伯說話的段落不算", () => {
  assert.equal(R.r83MayorSpeaks("mayor", R.R81_CONFLICT), true, "爭執那段鎮長開口");
  for (const side of ["plant", "seal"]) assert.equal(R.r83MayorSpeaks(R.R81_OPTIONS[side].side, R.R81_OPTIONS[side].scene), true, side + " 收尾那段鎮長開口");
  assert.equal(R.r83MayorSpeaks("elder", [{ by: "elder", text: "老麥要配新麥一起曬。" }, { by: "", text: "（班伯點點頭。）" }]), false, "只有班伯與旁白");
  assert.equal(R.r83MayorSpeaks("mayor", ["（葛瑞沒有說話。）"]), false, "全形括號整句是旁白");
  assert.equal(R.r83MayorSpeaks("mayor", ["那一穗我看見了。"]), true, "主說話者是鎮長、沒寫 by");
  assert.equal(R.r83MayorSpeaks("elder", ["那一穗我看見了。"]), false, "主說話者是班伯");
});

test("3-4 對話框只在舊麥種故事標記（r81c／r82b）且整段聽完時記交談；交付端走同一個入口；兩邊都不直接改任務旗標", () => {
  const story = read("src/story-r76.js"), heir = read("src/heirloom-ui.js");
  assert.match(story, /const r83MayorStory = !!\(options && options\.dataset && \(options\.dataset\.r81cStory \|\| options\.dataset\.r82bBranch\) && r83MayorSpeaks\(npcId, lines\)\)/);
  assert.match(story, /if \(step < lines\.length - 1\) \{ step\+\+; render\(\); return; \}\s*r83NoteMayorStory\(\);/, "最後一句按「聽完了」才記");
  assert.equal((story.match(/r83NoteMayorStory\(\);/g) || []).length, 1, "只有一個呼叫點（晚點再說不記）");
  assert.match(heir, /r\.talkNpcId === "mayor" && window\.StoryR76 && window\.StoryR76\.r83NoteMayorTalk \? window\.StoryR76\.r83NoteMayorTalk\(s, deliveredAt\)/);
  for (const [name, src] of [["story-r76", story], ["heirloom-ui", heir]]) assert.doesNotMatch(src, /(claimed\.c1_homecoming|quests\.c1_homecoming[^;]*status)\s*=/, name + " 不直接改第 1 章旗標");
});

test("1 收合列只留短句：R82A 想藏的章節標題被 R70A 雙 ID 規則畫回來，R83A 用三個 ID 收回，只留進度數字在第 2 欄", () => {
  const css = read("src/content-r58b.css"), block = css.slice(css.indexOf("R83A（收合任務卡不疊字"));
  assert.ok(block.length > 100, "R83A 區塊在 content-r58b.css 檔尾");
  assert.match(block, /#questDock#questDock#questDock:is\(\.quest-collapsed,\.quest-auto-collapsed,\.quest-target-collapsed\):has\(\.r82a-guidance-short\):not\(:has\(\.r69a-festival-now\)\) > :is\(\.r67a-now,\.r68a-now\),\s*[^{]*\{\s*grid-column: 1 !important;/, "短句與按鈕在第 1 欄");
  assert.match(block, /> :is\(\.r68a-objective-head,\.r67a-objective-head\) > :not\(\[data-audit="quest-progress"\]\) \{ display: none !important; \}/, "章節名與任務名不畫");
  assert.match(block, /html body:is\(:has\(#worldDialogue:not\(\[hidden\]\)\),:has\(\.r76b-dialogue\)\)/, "桌面展開時開著對話也排成同一列");
  assert.match(block, /min-width: 44px !important; height: 26px !important;/, "進度做成右側小徽章（R28：收合時標題列至少 40px 寬）");
  assert.ok(css.indexOf("R83A（收合任務卡不疊字") > css.lastIndexOf("R82A 結束"), "R83A 追加在檔尾");
});

test("4 祖母手記收合：短標題、主鈕、「另一件」小鈕與 1/3 排成一列；「另一件」只在有第二件可挑時出現，按下去跟展開時的「去修釣台」同一件事", () => {
  const css = read("src/content-r58b.css"), heir = read("src/heirloom-ui.js");
  assert.match(css, /#questDock \.r83a-heirloom-alt \{ display: none !important; \}/, "平常不顯示");
  assert.match(css, /\[data-quest="first_sun_basket"\]:is\(\.quest-collapsed,\.quest-auto-collapsed,\.quest-target-collapsed\) > \.world-objective-title,/, "收合時顯示這一步的短標題（R75 一列模式要看得到標題）");
  assert.match(heir, /compactPick\.textContent = "另一件"/);
  assert.match(heir, /compactPick\.title = "還有另一件可挑：" \+ alt\.text/);
  assert.match(heir, /pick\.onclick = visitAlt;[\s\S]*compactPick\.onclick = visitAlt/, "兩顆鈕做同一件事");
  assert.match(heir, /else \{ if \(pick\) pick\.remove\(\); if \(note\) note\.remove\(\); if \(compactPick\) compactPick\.remove\(\);/, "沒有第二件時移除");
});

test("2 空白卡根因：種子卡與工具列按鈕的過場不含 visibility，對話時藏起來就是當下藏起來", () => {
  const css = read("src/content-r58b.css"), html = read("index.html");
  assert.match(html, /\.seed \{[\s\S]*?transition: all \.1s;/, "原本的 transition: all 還在（由 R83A 收窄）");
  const rule = /\.seed, \.tool \{ transition-property: ([^;]+); \}/.exec(css);
  assert.ok(rule, "R83A 收窄種子卡過場");
  assert.doesNotMatch(rule[1], /visibility|all/, "過場不含 visibility");
  assert.match(css, /body:has\(#worldDialogue:not\(\[hidden\]\)\) #mapScene \.seed-hud, body:has\(#worldDialogue:not\(\[hidden\]\)\) #mapScene \.seed-hud \* \{ visibility: hidden !important;/, "對話時種子列照舊藏起來");
});

test("5 右下大鈕：只比對任務卡此刻的目標（data-target-id），身旁不相干的東西不搶寫；改寫任務卡那一步，不呼叫 nextGuidance、不改優先順序", () => {
  const ui = read("src/ui.js"), css = read("src/content-r58b.css"), adv = read("src/adventure.js");
  const fn = ui.slice(ui.indexOf("function r83aOffGuideTarget"), ui.indexOf("function r83aOffGuideTarget") + 600);
  assert.match(fn, /dock\.dataset \? dock\.dataset\.targetId/);
  assert.doesNotMatch(fn, /nextGuidance|nextFarmStep/);
  assert.match(fn, /if \(!tile \|\| tile\.npc \|\| tile\.plotIndex != null\) return false;/, "鄰居本人與田格照舊寫自己（R68B、R78B），只攔身旁的物件");
  assert.match(ui, /const offTarget = !busy && targetLabel !== "互動" && r83aOffGuideTarget\(labelTile\);/);
  assert.match(ui, /if \(guideButton\) targetLabel = guideButton\.textContent\.trim\(\);/, "大鈕改寫任務卡主鈕那一句");
  assert.match(ui, /dataset\.r83aOffTarget === "guide"\) \{ const guide = r83aGuideButton\(\); if \(guide\) \{ guide\.click\(\);/, "按大鈕就按任務卡主鈕");
  assert.match(css, /#actionA\[data-r83a-off-target="true"\] \{ visibility: hidden !important; pointer-events: none !important; \}/);
  assert.doesNotMatch(adv, /R83A/, "A 線沒有動 nextGuidance 的判斷");
});

test("6 同畫面不矛盾：任務卡字與按鈕同一個來源；成熟時收掉過期提示；空地重畫動作列", () => {
  const world = read("src/world-ui.js"), ui = read("src/ui.js");
  assert.match(world, /const showRouteChoice = routeChoiceOpen && !questStep;/, "有具體下一步時不顯示舊的「選擇下一步」");
  assert.match(world, /\$\{showRouteChoice \? "data-choice-open" : "data-world-go"\}>\$\{showRouteChoice \? "選擇下一步"/);
  assert.match(world, /const nowShort = questStep \? farmNowShort : showRouteChoice \? "先選下一步" : q \? \(activeGoal && activeGoal\.name\) \|\| taskName \|\| step : "繼續經營農場";/);
  assert.doesNotMatch(world, /\(farmNow && farmNow\.short\) \|\| step/, "不再借農務短句配主線按鈕");
  assert.match(ui, /if \(selectedJustRipened\) \{ r83aDropStaleGrowToasts\(\); renderSceneActionsForSelection\(\); \}/);
  assert.match(ui, /else if \(r83aStaleHarvestBar\(t\)\) renderSceneActionsForSelection\(\);/);
  assert.match(ui, /\/還沒成熟\|還在長\//);
});

test("7 兩支 R83A 測試都列在 guard 的 unit 清單（排在 R82 之後）", () => {
  const guard = read("scripts/guard-validation-writes.js");
  const list = guard.slice(guard.indexOf("const unit=["), guard.indexOf("];", guard.indexOf("const unit=[")));
  const at = (name) => list.indexOf('"node scripts/' + name + '"');
  assert.ok(at("test-content-r83-card.js") > at("test-content-r82-guidance-layout.js") && at("test-content-r82-guidance-layout.js") > 0, "規則測試在 R82 之後");
  assert.ok(at("test-content-r83-card-layout.js") > at("test-content-r83-card.js"), "四尺寸測試接在規則測試後面");
});

console.log(passed + " passed");
if (!process.exitCode) console.log("VERIFIED content R83A card rules");
