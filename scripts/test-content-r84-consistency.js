"use strict";
/* R84B：下一步不矛盾、一次只有一層。
   規則（Node）：
   1. 任務卡、手札「現在做」、章節清單共用 AdventureAPI.nowStep／questFocus；「任務：X n/m」的名字與數字出自同一列（圖 77、96、152）。
      舊麥種還沒選之前不提地圖上還不存在的物件（圖 138、139）；封存路線全程不出現「藍布老麥田」（圖 144）；
      不再有「Lv 3 才解鎖，現在就能種」（圖 87、111）；同一張具名訂單第一張跟每天那張同一個份數（圖 87、89）。
   2. 一次只留一個主要互動層：FarmSunplay.layerRule（玩家按出來的馬上出、其他層收掉；自己跳出來的排隊不丟）。
   3. 右下大鈕：任務卡留著的那一格不寫收成；收合列小鈕寫得出要做什麼。
   瀏覽器（1366×768、1366×600、390×844、844×390；大鈕另跑 390×844）：
   - 兩個對話框、手札加自動故事、手札加結算卡、集章小卡重跳、看火候加灶台清單：任何時候主要層最多一個，排隊的最後一定出來。
   - 提示與結算卡不壓任務卡；結算卡的「下一步」跟任務卡「現在做」同一句。
   - 任務卡與手札的「任務：X n/m」同字同數；光的步驟不配主線的數字；一鍵收成後任務的收成數跟倉庫一致。
   - 圖 128、153、160 三個大鈕情境。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
global.window = global;
const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const C = require("../src/config.js");
const State = require("../src/state.js");
const A = require("../src/adventure.js");
const G = require("../src/game.js");
const H = require("../src/heirloom.js");
const M = require("../src/midgame-r66.js");
const K = require("../src/cooking-r75.js");
const SP = require("../src/sunplay-r75.js");
const R = require("../src/story-r76.js");
const Q = require("../src/choices-r77.js");
Q.install();

const T0 = Date.parse("2026-11-09T08:00:00Z"), DAY = 86400000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function fresh(now) { const s = State.defaultState(now || T0); A.ensure(s, now || T0); M.ensure(s, now || T0); K.ensure(s, now || T0); return s; }
/* 「任務：X n/m」的 X 跟 n/m 必須出自同一列。 */
function sameRow(s, now, label) {
  const f = A.questFocus(s, now), q = A.summary(s, now).currentQuest, g = A.guide(s, now);
  assert.ok(f && q, label + "：有目前主線");
  const rows = g.route ? [g.step] : (q.objectives || []).concat(q.requirements || []);
  const row = rows.find((r) => r && r.name === f.name && !r.complete);
  if (row) assert.equal(f.progress, Math.min(row.current, row.required) + "/" + row.required, label + "：名字「" + f.name + "」配的是同一列的數字");
  else assert.ok(q.canClaim || !rows.some((r) => r && !r.complete), label + "：找不到這一列時只能是可以回報 " + JSON.stringify(f));
  return f;
}
const LATIN_UNIT = /\b\d+\s*(m|s|min|sec)\b/i;

test("1-1 「任務：X n/m」的數字一定是 X 自己的：標題一律寫主線那一列與 questFocus 的數字，光的步驟只佔「現在做」（圖 77）", () => {
  const s = fresh(); s.heirloom.started = false; s.coins = 999;
  assert.equal(G.plant(s, 0, "wheat", T0).ok, true); A.record(s, { type: "plant", cropId: "wheat" }, T0);
  const t = T0 + 10;
  s.plots[0].plantedAt = t - 3600000; s.plots[0].wateredAt = t - 3600000;
  s.sun = Object.assign(s.sun || {}, { plots: [0], used: [], startsAt: t - 1000, endsAt: t + 60000, previewPlots: [], previewAt: 0, nextAt: t + 600000, introduced: true });
  const g = A.nextGuidance(s, t), now = A.nowStep(s, t), f = sameRow(s, t, "光裡收成時");
  assert.equal(g.sunlit, true, "光正照著熟麥");
  assert.deepEqual(now, g, "「現在做」是光的那一步");
  assert.deepEqual([f.name, f.progress], ["找鎮長葛瑞交談", "0/1"], "手札目前主線（questFocus）仍是主線那一列與它的數字");
  const world = read("src/world-ui.js");
  /* R85A 同步（R85 計畫 A 線第 1 項，R84 圖 75、34、52、129：標題寫「找鎮長葛瑞交談 0/1」按鈕卻是折光）：
     任務卡標題改寫「現在做」那一步（A.oneStep），光的那一步只寫步驟名、不配數字；「數字一定是那個名字自己的」這條規則不變，
     由 test-content-r85-one-step.js 逐狀態檢查。手札卡的標題寫任務名、數字寫底下子項完成幾項（R84 圖 136、147）。 */
  const one = A.oneStep(s, t);
  assert.deepEqual([one.title, one.progress], ["在光裡收成小麥", ""], "任務卡標題寫光的那一步，不配主線那一列的 0/1");
  assert.match(world, /const shownTaskName = present\.kind === "free" \? taskName : present\.title \|\| taskName;/, "任務卡標題讀 presentStep");
  assert.match(world, /const progressText = present\.kind === "free" \? "" : present\.progress;/, "數字只配自己那一列（祭典讀祭典的）");
  assert.match(read("src/content-r58b.css"), /#questDock\.r80b-decision-compact \.r84b-task-prefix \{ display: none; \}/, "第一分鐘的窄卡只省字首，名字不被截斷");
  assert.match(world, /const progress = main \? journalProgress\(q\) :/, "手札目前主線的數字是子項完成幾項");
  assert.match(world, /const cardTaskName = main \? journalTaskName\(q\) : q\.name;/, "手札目前主線的名字是任務名");
  assert.match(world, /if \(headProgress && headProgress\.textContent !== progress\) headProgress\.textContent = progress;/, "手札開著時同步的數字也一樣");
});

test("1-2 手札「現在做」跟任務卡同一支 nowStep：祖母手記排在前面時兩邊都寫祖母手記那一步；第 4 章的數字是同一列（圖 96）", () => {
  const s = fresh(); const t = T0 + 5;
  for (const q of A.quests(s, t)) if (q.chapter <= 3) s.adventure.claimed[q.id] = true;
  A.ensure(s, t); s.storage.items.tomato = 1;
  s.heirloom.started = true; s.heirloom.delivered = false; s.heirloom.sunWheat = 0;
  const now = A.nowStep(s, t), f = sameRow(s, t, "第 4 章");
  assert.equal(now && now.guidanceScope, "heirloom", "祖母手記排在前面");
  assert.deepEqual(now, A.nextGuidance(s, t));
  assert.deepEqual([f.name, f.progress], ["番茄", "1/3"], "第 4 章標題寫「番茄 1/3」，不是「完成 0/3 項」");
  const world = read("src/world-ui.js");
  /* R85A 同步：手札「現在做」改讀 presentStep（A.oneStep 以 nowStep 為準），跟任務卡同一支。 */
  assert.match(world, /function syncMainStoryCard\(\) \{[\s\S]*?const p = presentStep\(current, Date\.now\(\)\);/, "手札讀 presentStep（nowStep）");
  assert.deepEqual(A.oneStep(s, t).step, now, "presentStep 讀的就是 nowStep");
  assert.match(world, /if \(step\.guidanceScope === "heirloom" && window\.HeirloomUI && window\.HeirloomUI\.guide\)/, "手札「帶我去」做的事跟祖母手記卡主鈕一樣");
  /* 沒有祖母手記、也沒有光的時候：第 1 章找鎮長那一步，兩邊都寫主線這一步。 */
  const s2 = fresh(); s2.heirloom.started = false;
  assert.equal(A.nowStep(s2, T0 + 1), null, "沒有前導步驟時回 null，畫面寫主線這一步");
  assert.equal(sameRow(s2, T0 + 1, "新存檔").name, "找鎮長葛瑞交談");
});

test("1-3 今日三件事與故事階段：nowStep 跟著 nextGuidance；每一個狀態的名字與數字都出自同一列", () => {
  const s = fresh(); s.heirloom.started = false; s.adventure.claimed.c1_homecoming = true; A.ensure(s, T0);
  const g = A.nextGuidance(s, T0 + 1);
  assert.deepEqual(A.nowStep(s, T0 + 1), g, "今日三件事期間「現在做」就是 nextGuidance");
  sameRow(s, T0 + 1, "今日三件事");
  s.storage.items.wheat = 2; s.adventure.byTarget.harvest.wheat = 2; A.ensure(s, T0 + 2);
  sameRow(s, T0 + 2, "可以交給班伯");
  const d = fresh(); d.heirloom.sunWheat = 2; d.storage.items.wheat = 4;
  assert.equal(H.deliver(d, "table", T0).ok, true);
  assert.equal(A.nowStep(d, T0 + 1).guidanceScope, "r81_story", "故事階段兩邊都寫故事那一步");
});

test("1-4 舊麥種還沒選之前不提還不存在的物件；選了以後收尾地點照選的那一邊（圖 138、139、144）", () => {
  const s = fresh(); s.heirloom.sunWheat = 2; s.storage.items.wheat = 4;
  assert.equal(H.deliver(s, "table", T0).ok, true);
  const g = A.nextGuidance(s, T0 + 1);
  assert.equal(g.action, "story_choice");
  for (const key of ["text", "short", "actionLabel"]) assert.doesNotMatch(g[key], /藍布老麥田|封存箱/, "還沒選：" + key + "「" + g[key] + "」不提還不存在的物件");
  assert.match(g.short, /藍布舊麥種/, "指的是鎮長腳邊那包（地圖上的「藍布舊麥種・等你決定」）");
  assert.match(R.R81_PENDING.label, /^藍布舊麥種/);
  for (const [choice, place, other] of [["plant", "藍布老麥田", "封存箱"], ["seal", "封存箱", "藍布老麥田"]]) {
    const x = fresh(); x.heirloom.sunWheat = 2; x.storage.items.wheat = 4; H.deliver(x, "table", T0);
    R.r81Choose(x, choice, T0 + 1); x.storage.items.wheat = 2; assert.equal(R.r81Deliver(x, T0 + 2).ok, true);
    const scene = A.nextGuidance(x, T0 + 3);
    assert.equal(scene.action, "story_scene");
    assert.match(scene.short, new RegExp(place), choice + " 收尾寫「" + place + "」");
    assert.doesNotMatch(scene.text + scene.short, new RegExp(other), choice + " 收尾不提另一邊的物件");
    assert.ok([...scene.short].length <= 12, "short 控制在 12 字內");
  }
});

test("1-5 封存路線從選擇到三件舊物找齊，任務卡、今天可做、地圖名牌、具名訂單都不出現「藍布老麥田」（圖 144）", () => {
  const s = fresh(); s.heirloom.sunWheat = 2; s.storage.items.wheat = 4;
  assert.equal(H.deliver(s, "table", T0).ok, true);
  assert.equal(R.r81Choose(s, "seal", T0 + 1000).ok, true);
  const seen = [];
  const sweep = (now, label) => {
    const out = [];
    const g = A.nextGuidance(s, now); if (g) out.push(g.text, g.short, g.actionLabel, g.title || "");
    const n = A.nowStep(s, now); if (n) out.push(n.text, n.short);
    const today = R.r81Today(s, now); if (today) out.push(today.title, today.line);
    const branch = R.r82Today(s, now); if (branch) out.push(branch.title, branch.line);
    R.r81SceneRows(s).forEach((row) => out.push(row.label || ""));
    R.r82SceneRows(s, now).forEach((row) => out.push(row.label || "", row.hint || ""));
    const order = R.r81Order(s, now); if (order) out.push(order.name, order.wantText, order.rewardText, order.vsText);
    if (R.r81Summary(s)) out.push(R.r81Summary(s));
    for (const text of out) assert.doesNotMatch(String(text), /藍布老麥田/, label + "：「" + text + "」");
    seen.push(label);
  };
  s.storage.items.wheat = 0; sweep(T0 + 2000, "訂單缺小麥");
  s.coins = 999; G.plant(s, 0, "wheat", T0 + 2100); sweep(T0 + 2200, "田裡在長");
  s.storage.items.wheat = 2; sweep(T0 + 2300, "訂單備齊");
  assert.equal(R.r81Deliver(s, T0 + 2400).ok, true); sweep(T0 + 2500, "等聽收尾");
  assert.equal(R.r81SceneSeen(s, T0 + 2600), true); sweep(T0 + 2700, "收尾後第 1 天");
  for (let day = 0; day < 3; day++) {
    const now = T0 + day * DAY + 5000, next = R.r82SealStatus(s, now).next;
    sweep(now, "第 " + (day + 1) + " 天找舊物前");
    if (next) assert.equal(R.r82FindRelic(s, next.id, now).ok, true, "第 " + (day + 1) + " 天找到 " + next.name);
    sweep(now + 1, "第 " + (day + 1) + " 天找舊物後");
  }
  assert.equal(R.r82SealStatus(s, T0 + 2 * DAY + 9000).decorated, true, "三件舊物找齊");
  assert.ok(seen.length >= 11, "封存路線每一段都掃過");
});

test("1-6 送的種子不再寫「Lv 3 才解鎖，現在就能種」；字條不寫「下一級才種得到」（圖 87、111）", () => {
  for (let level = 1; level <= 12; level++) {
    const s = fresh(); s.level = level;
    const id = Q.nextSeedCropId(s);
    const def = Q.questDef("mayor", "farm"), v = def.special.variants.seed;
    const s2 = fresh(); s2.level = level; s2.xp = C.xpForLevel(level); s2.storage.items.wheat = 9;
    const text = Q.specialInfo(s2, "mayor", T0).rewardText || "";
    if (id) {
      const shown = (Q.specialInfo(s2, "mayor", T0).eligible ? text : "") || "";
      assert.doesNotMatch(shown, /才解鎖/, "Lv " + level + "：" + shown);
    }
    assert.doesNotMatch(v.diff + v.line, /還沒解鎖|下一級才種得到|才解鎖/, "說明與字條不自相矛盾");
  }
  const src = read("src/choices-r77.js");
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, ""), /才解鎖，現在就能種|下一級才種得到|還沒解鎖的作物種子，現在就能先種/, "原始碼（不含註解）沒有矛盾句");
  assert.match(src, /const NEXT_SEED_NOTE = "還買不到，拿到就能種";/);
  /* 真的拿到那一包：一級就能種下去，文案跟事實一致。 */
  const s = fresh(); s.level = 1; s.xp = 0; s.coins = 500;
  const before = A.ensure(s, T0) && Q.nextSeedCropId(s);
  assert.ok(before && C.CROPS[before].unlockLevel > 1, "送的是商店還買不到的作物");
});

test("1-7 同一張具名訂單只有一個份數：第一張跟之後每天那張要的份數一樣（圖 87、89）", () => {
  const routes = [["mayor", "farm"], ["mayor", "town"], ["elder", "sell"], ["elder", "seed"], ["merchant", "sign"], ["merchant", "listen"]];
  let n = 0;
  for (const [npc, choice] of routes) {
    const def = Q.questDef(npc, choice);
    if (!def || !def.special) continue;
    for (const key of Object.keys(def.special.variants)) {
      const v = def.special.variants[key], trial = Q.trialWant(v);
      assert.equal(trial.qty, v.want.qty, def.name + "「" + v.name + "」第一張 " + trial.qty + " 份、每天 " + v.want.qty + " 份");
      assert.equal(trial.type === "meal", v.want.type === "meal", "收料理的那張第一張也收料理");
      n++;
    }
  }
  assert.ok(n >= 10, "每一張具名訂單都比過");
  const card = read("src/choices-r77.js");
  assert.doesNotMatch(card, /第一張只要同一種作物 2 份/, "手札不再另外寫第一張 2 份");
});

test("2-1 一次只留一個主要互動層：玩家按出來的馬上出、其他層收掉；自己跳出來的排隊", () => {
  assert.deepEqual(SP.LAYER_KINDS, ["dialogue", "journal", "settlement", "stamp", "cook"]);
  const rule = (open, incoming, byPlayer) => SP.layerRule({ open, incoming, byPlayer });
  assert.deepEqual(rule([], "dialogue", false), { show: true, close: [], queue: false }, "畫面空著就出");
  assert.deepEqual(rule(["journal"], "dialogue", true).close, ["journal"], "點鄰居開對話：手札收起（圖 147）");
  assert.deepEqual(rule(["dialogue"], "journal", true).close, ["dialogue"], "打開手札：對話收起（等於晚點再說）");
  assert.equal(rule(["journal"], "dialogue", false).show, false, "自動演的故事遇到手札開著先排隊（圖 147）");
  assert.equal(rule(["journal"], "dialogue", false).queue, true);
  assert.equal(rule(["dialogue"], "settlement", false).show, false, "結算卡遇到對話先排隊");
  assert.equal(rule(["settlement"], "stamp", false).show, false, "集章小卡遇到結算卡先排隊");
  assert.deepEqual(rule(["stamp"], "dialogue", true).close, ["stamp"], "集章小卡被玩家的動作打斷就收掉（看過的不重跳，見 2-2）");
  assert.deepEqual(rule(["dialogue"], "dialogue", true).close, [], "同一種不互收（下方對話框自己會換掉舊的那個）");
  assert.equal(SP.layersOk(["dialogue"]), true); assert.equal(SP.layersOk([]), true);
  assert.equal(SP.layersOk(["dialogue", "journal"]), false); assert.equal(SP.layersOk(["settlement", "stamp"]), false);
  /* 任意排列：每一步照規則開關以後，主要層最多一個；排隊的最後都會出來。 */
  const kinds = SP.LAYER_KINDS;
  let open = [], queue = [], shown = 0, asked = 0;
  for (let i = 0; i < 400; i++) {
    const kind = kinds[(i * 7 + (i >> 2)) % kinds.length], byPlayer = (i % 3) === 0;
    asked++;
    const r = rule(open, kind, byPlayer);
    if (r.show) { open = open.filter((id) => !r.close.includes(id)); if (!open.includes(kind)) open.push(kind); shown++; } else queue.push(kind);
    assert.equal(SP.layersOk(open), true, "第 " + i + " 步：" + open.join("、"));
    if (i % 5 === 4) { open = []; while (queue.length) { const k = queue.shift(); const r2 = rule(open, k, false); assert.equal(r2.show, true); open = [k]; shown++; open = []; } }
  }
  assert.equal(shown, asked, "每一層最後都出來過（排隊的不丟）");
});

test("2-2 各層的接線：對話框、自動故事、結算卡、集章小卡、看火候都照同一條規則", () => {
  const story = read("src/story-r76.js"), ui = read("src/ui.js"), book = read("src/sunbook-r76.js"), css = read("src/content-r58b.css"), world = read("src/world-ui.js");
  assert.match(story, /root\.FarmLayers\.request\("dialogue", !\(options && options\.passive\)\)/, "下方對話框開之前照規則收掉其他層");
  assert.match(story, /const said = document\.getElementById\("worldDialogue"\); if \(said && !said\.hidden\) said\.hidden = true;/, "兩個對話框不同時開（圖 29）");
  const busy = (story.match(/function busy81\(\) \{[^\n]*\}/) || [""])[0];
  assert.match(busy, /\.side-panel\.world-panel-open/, "自動故事等手札關掉（圖 147）"); assert.match(busy, /#worldDialogue:not\(\[hidden\]\)/); assert.match(busy, /mustWait\("dialogue"\)/);
  assert.match(ui, /if \(window\.FarmLayers && window\.FarmLayers\.mustWait\("settlement"\)\) return;/, "結算卡排隊");
  assert.match(ui, /showNextSettlement\(\); r84bKeepToastOffDock\(\);/, "排隊的結算卡每 250 毫秒再試一次，最後一定出來");
  assert.match(ui, /journal: "\.side-panel\.world-panel-open \.side-pane\.sel:is\(\[data-pane=\\"story\\"\],\[data-pane=\\"journal\\"\]\)"/, "手札＝手札或圖鑑那一頁");
  assert.match(book, /const CARD_SEEN_MS = 1200/); assert.match(book, /else shownNow\.forEach\(\(e\) => \{ const key = cardKey\(e\); if \(key\) cardSeen\.add\(key\); \}\);/, "集章小卡停過 1.2 秒才被蓋過去就記成看過，不重跳（圖 19、23）");
  assert.match(book, /list\.filter\(\(e\) => !cardSeen\.has\(cardKey\(e\)\)/, "同一枚印章只排一次");
  assert.match(css, /html body:has\(\.r75b-cook-overlay\) \.modal\.show \{ visibility: hidden !important; pointer-events: none !important; \}/, "看火候開著時灶台清單退場（圖 39、58、71）");
  const tail = css.slice(css.lastIndexOf("/* ===== R84B（下一步不矛盾、一次只有一層）開始 ===== */"));
  assert.ok(tail.length > 50 && /\/\* ===== R84B 結束 ===== \*\//.test(tail), "R84B 樣式接在 content-r58b.css 檔尾");
  assert.match(world, /reconcile\(s\) \{[\s\S]*?s\.adventure\.byTarget\.harvest\[id\] = Math\.max/, "一鍵收成也補齊任務的收成數（圖 152）");
});

test("3-1 右下大鈕：只讀 nextGuidance，不改它的優先順序；任務卡留著的那一格不寫收成；收合小鈕寫要做的事", () => {
  const ui = read("src/ui.js"), heir = read("src/heirloom-ui.js"), adv = read("src/adventure.js");
  assert.match(ui, /function r84bGuide\(\) \{.*value = A && A\.nextGuidance \? A\.nextGuidance\(state, t\) : null;/, "大鈕只讀 nextGuidance（同一拍只算一次）");
  assert.match(ui, /if \(!busy && labelTile && \/\^收成・\/\.test\(targetLabel\) && labelTile\.plotIndex != null && labelTile\.plotIndex === lightHoldPlotIndex\(\)\) targetLabel = r84bHeldLabel\(labelTile\) \|\| targetLabel\.replace\(\/\^收成・\/, "等光・"\);/, "圖 128：等光的寫「等光・小麥田」，「等光再收」只留在田邊動作列");
  assert.match(heir, /compactPick\.textContent = alt\.pickLabel \|\| alt\.actionLabel;/, "圖 160");
  assert.doesNotMatch(heir, /textContent = "另一件"/);
  assert.match(adv, /actionLabel: "去修釣台", pickLabel: "修釣台"/);
  /* nextGuidance 的優先順序（故事 → 祖母手記 → 農務）沒變。 */
  assert.match(adv, /const lead = storyGuidance\(state, t\) \|\| heirloomGuidance\(state, t\);\s*const farm = nextFarmStep\(state, t\), next = lead \|\| farm;/);
  const world = read("src/world-ui.js");
  assert.match(world, /box\.dataset\.targetId = earlyTarget \? earlyTarget\.id : "";/, "今日三件事的卡也標出要去的那一格（圖 153）");
});

test("3-2 新字是台灣繁中、沒有英文縮寫單位；測試列在 unit 清單最後", () => {
  for (const text of ["去決定藍布舊麥種", "回封存箱聽故事", "還買不到，拿到就能種", "修釣台", "等光・小麥田"]) assert.doesNotMatch(text, /[A-Za-z]/);
  const ui = read("src/ui.js"), block = ui.slice(ui.indexOf("===== R84B 第 2 項"), ui.indexOf("===== R84B 第 2 項結束"));
  assert.ok(block.length > 100); assert.doesNotMatch(block, LATIN_UNIT);
  const guard = read("scripts/guard-validation-writes.js"), list = guard.slice(guard.indexOf("const unit=["), guard.indexOf("];", guard.indexOf("const unit=[")));
  const rows = list.split("\n").map((line) => line.trim()).filter((line) => line.startsWith('"node scripts/'));
  /* R85A 同步：R85 的新測試依規定接在 R84 後面，這一支之後只能是 R85 的測試。 */
  const at = rows.indexOf('"node scripts/test-content-r84-consistency.js",');
  assert.ok(at >= 0 && rows.slice(at + 1).every((row) => /^"node scripts\/test-content-r85-[a-z-]+\.js",$/.test(row)), "新測試在 unit 清單最後（後面只接 R85）");
});

/* ---------------- 瀏覽器 ---------------- */
const VIEWS = [[1366, 768, false], [1366, 600, false], [390, 844, true], [844, 390, true]];
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
function serve() { return new Promise((resolve, reject) => { const server = http.createServer((req, res) => { const u = new URL(req.url, "http://127.0.0.1"), file = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))); if (path.relative(ROOT, file).startsWith("..") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(file).pipe(res); }); server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server)); }); }
async function launch(chromium) { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("No browser available"); }

function install() {
  const shown = (el) => { if (!el || el.hidden) return false; const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false; for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === "none" || Number(c.opacity) === 0) return false; } return getComputedStyle(el).visibility !== "hidden"; };
  const box = (el) => { if (!shown(el)) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
  window.__r84 = {
    shown, box,
    layers: () => window.FarmLayers ? window.FarmLayers.open() : [],
    ok: () => window.FarmLayers ? window.FarmLayers.ok() : false,
    dialogues: () => [document.querySelector("#worldDialogue"), ...document.querySelectorAll(".r76b-dialogue")].filter(shown).length,
    /* 換主線進度時連任務紀錄一起換（ensure 會照紀錄把「已完成」補回 claimed）。 */
    claim(map) { const s = __farm.state(); s.adventure.claimed = Object.assign({}, map); s.adventure.quests = {}; AdventureAPI.ensure(s, Date.now()); return s; },
    clear() {
      document.querySelectorAll(".r76b-dialogue,.npc-bubble,.r75b-cook-overlay").forEach((n) => n.remove());
      const d = document.querySelector("#worldDialogue"); if (d) d.hidden = true;
      document.querySelector(".side-panel")?.classList.remove("world-panel-open");
      for (const id of ["dailyModal", "worldModal", "settingsModal"]) { if (document.getElementById(id)?.classList.contains("show") && __farm.closeModal) __farm.closeModal(id); document.getElementById(id)?.classList.remove("show"); }
      if (!document.querySelector(".modal.show")) document.body.classList.remove("modal-open");
      if (window.FarmSunbook && FarmSunbook.hideCard) FarmSunbook.hideCard();
      document.querySelector("#toast-zone").innerHTML = "";
    },
  };
}
const overlap = (a, b) => { if (!a || !b) return 0; const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return w > 0 && h > 0 ? Math.round(w * h) : 0; };
async function until(page, fn, arg, ms, label) { try { await page.waitForFunction(fn, arg, { timeout: ms }); } catch (_) { throw new Error(label + "（等了 " + ms + " 毫秒）"); } }
async function clear(page) { await page.evaluate(() => __r84.clear()); await page.waitForTimeout(350); await page.evaluate(() => __r84.clear()); }
async function oneLayer(page, tag, what) { const r = await page.evaluate(() => ({ layers: __r84.layers(), ok: __r84.ok(), dialogues: __r84.dialogues() })); assert.ok(r.ok && r.dialogues <= 1, tag + " " + what + "：主要層最多一個 " + JSON.stringify(r)); return r; }

/* 二、一次只有一層。 */
async function layers(page, tag) {
  /* 1. 兩個對話框（圖 29）：鄰居順口一句開著時點出下方對話框，只留下方那一個。 */
  await clear(page);
  await page.evaluate(() => { __farm.state().sun.introduced = true; FarmWorld.speak("鎮長葛瑞", "看，陽光照到田上了！"); });
  await until(page, () => { const d = document.querySelector("#worldDialogue"); return d && !d.hidden; }, null, 4000, tag + " 鄰居那一句出現");
  await page.evaluate(() => StoryR76.openDialogue(__farm.state(), "mayor", ["咳，先說好，這段別寫進鎮公所的紀錄裡。", "我年輕時不是鎮長。"], { speaker: "鎮長葛瑞", dataset: { r61bStory: "mayor-0" } }));
  await page.waitForTimeout(300);
  let r = await oneLayer(page, tag, "兩個對話框");
  assert.deepEqual([r.layers, r.dialogues], [["dialogue"], 1], tag + " 只剩下方對話框 " + JSON.stringify(r));

  /* 2. 手札開著時餐籃剛送到（圖 147）：自動演的爭執先等；關掉手札後一定演出來。 */
  await clear(page);
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); FarmWorld.openPanel("story"); s.heirloom.started = true; s.heirloom.sunWheat = 2; s.storage.items.wheat = 4; delete s.r81story; FarmHeirloom.deliver(s, "table", t); __farm.refresh(); });
  await page.waitForTimeout(2600);
  r = await oneLayer(page, tag, "手札開著、餐籃剛送到");
  assert.deepEqual(r.layers, ["journal"], tag + " 手札開著時自動故事先排隊 " + JSON.stringify(r));
  await page.evaluate(() => document.querySelector(".side-panel")?.classList.remove("world-panel-open"));
  await until(page, () => !!document.querySelector('.r76b-dialogue[data-r81c-story="conflict"]'), null, 5000, tag + " 關掉手札後排隊的爭執演出來");
  await oneLayer(page, tag, "爭執演出來");
  /* 在對話開著時打開手札：對話收起（等於晚點再說），故事還在原處。 */
  await page.evaluate(() => FarmWorld.openPanel("story")); await page.waitForTimeout(400);
  r = await oneLayer(page, tag, "對話中打開手札");
  assert.deepEqual(r.layers, ["journal"], tag + " 打開手札時對話收起 " + JSON.stringify(r));
  assert.equal(await page.evaluate(() => StoryR76.r81Stage(__farm.state())), "conflict", tag + " 故事沒被跳過");

  /* 3. 手札開著時來了結算卡：先排隊，關掉手札就出來。 */
  await clear(page);
  await page.evaluate(() => { FarmWorld.openPanel("story"); __farm.enqueueSettlement({ kind: "upgrade", coins: 0, xp: 0, next: "回到田地，試試升級後的效果。" }); });
  await page.waitForTimeout(900);
  r = await oneLayer(page, tag, "手札開著時來結算卡");
  assert.deepEqual(r.layers, ["journal"], tag + " 結算卡排隊 " + JSON.stringify(r));
  await page.evaluate(() => document.querySelector(".side-panel")?.classList.remove("world-panel-open"));
  await until(page, () => !!document.querySelector("#toast-zone .settlement-card"), null, 4000, tag + " 關掉手札後結算卡出來");
  await oneLayer(page, tag, "結算卡出來");

  /* 4. 集章小卡（圖 19、23）：被玩家點出的對話蓋過去就收掉，對話關掉也不重跳；同一枚再送一次也不跳。 */
  await clear(page);
  await until(page, () => !document.querySelector("#toast-zone > *"), null, 4000, tag + " 等提示走完");
  const stamp = { cropId: "wheat", stampId: "lit", text: "追光手冊：小麥・光裡收成（小麥 1／4 枚）" };
  await page.evaluate((e) => FarmSunbook.showCard([e]), stamp);
  await until(page, () => __r84.shown(document.querySelector("#r76cStampCard")), null, 4000, tag + " 集章小卡出現");
  await oneLayer(page, tag, "集章小卡");
  await page.waitForTimeout(1500); /* 小卡在畫面上停過一下，玩家看過了 */
  await page.evaluate(() => StoryR76.openDialogue(__farm.state(), "mayor", ["今天風大。"], { speaker: "鎮長葛瑞" }));
  await page.waitForTimeout(700);
  r = await oneLayer(page, tag, "對話蓋過集章小卡");
  assert.deepEqual(r.layers, ["dialogue"], tag + " 集章小卡收掉 " + JSON.stringify(r));
  await page.evaluate(() => document.querySelector(".r76b-dialogue [data-r76b-next]")?.click());
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => __r84.shown(document.querySelector("#r76cStampCard"))), false, tag + " 對話關掉後同一枚不重跳");
  await page.evaluate((e) => FarmSunbook.showCard([e]), stamp); await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => __r84.shown(document.querySelector("#r76cStampCard"))), false, tag + " 同一枚印章只跳一次");
  /* 剛冒出來就被蓋掉的那一枚不丟：對話關掉後出一次，之後也不再跳。 */
  const early = { cropId: "carrot", stampId: "trait", text: "追光手冊：胡蘿蔔・光性達成（胡蘿蔔 1／4 枚）" };
  await page.evaluate((e) => { FarmSunbook.showCard([e]); StoryR76.openDialogue(__farm.state(), "mayor", ["等等。"], { speaker: "鎮長葛瑞" }); }, early);
  await page.waitForTimeout(500);
  r = await oneLayer(page, tag, "剛冒出來就被對話蓋過去");
  assert.deepEqual(r.layers, ["dialogue"], tag + " 對話開著時小卡不出來 " + JSON.stringify(r));
  await page.evaluate(() => document.querySelector(".r76b-dialogue [data-r76b-next]")?.click());
  await until(page, () => __r84.shown(document.querySelector("#r76cStampCard")) && /胡蘿蔔/.test(document.querySelector("#r76cStampCard").textContent), null, 4000, tag + " 排隊的小卡在對話關掉後出來");
  await oneLayer(page, tag, "排隊的小卡出來");
  await page.evaluate(() => document.querySelector("[data-r76c-card-close]")?.click());
  await page.waitForTimeout(300);
  await page.evaluate((e) => FarmSunbook.showCard([e]), early); await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => __r84.shown(document.querySelector("#r76cStampCard"))), false, tag + " 看過以後同一枚不再跳");

  /* 5. 看火候（圖 39、58、71）：灶台清單退場，畫面上只有一個關閉鈕；關掉看火候，灶台清單回來。 */
  await clear(page);
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); AdventureAPI.ensure(s, t); s.adventure.claimed.c1_first_harvest = true; AdventureAPI.ensure(s, t); s.storage.items.wheat = 8; __farm.refresh(); FarmWorld.openKitchen(); });
  await until(page, () => !!document.querySelector('[data-r75b-start="rustic_bread"]'), null, 6000, tag + " 灶台清單打開");
  await page.evaluate(() => document.querySelector('[data-r75b-start="rustic_bread"]').click());
  await until(page, () => !!document.querySelector(".r75b-cook-overlay [data-r75b-close]"), null, 4000, tag + " 看火候打開");
  const closers = () => page.evaluate(() => [...document.querySelectorAll(".world-modal-close, .modal-close, [data-r75b-close], .modal.show button[aria-label*='關閉'], .r75b-cook-overlay button[aria-label*='關閉']")].filter(__r84.shown).map((b) => b.closest(".r75b-cook-overlay") ? "看火候" : "灶台"));
  let c = await closers();
  assert.deepEqual([...new Set(c)], ["看火候"], tag + " 看火候開著時只有它自己的關閉鈕 " + JSON.stringify(c));
  assert.equal(c.length, 1, tag + " 關閉鈕只有一個 " + JSON.stringify(c));
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".modal.show .modal-card")].some(__r84.shown)), false, tag + " 灶台清單退場");
  r = await oneLayer(page, tag, "看火候");
  await page.evaluate(() => document.querySelector(".r75b-cook-overlay [data-r75b-close]").click());
  await page.waitForTimeout(300);
  c = await closers();
  assert.deepEqual([...new Set(c)], ["灶台"], tag + " 關掉看火候，灶台清單回來 " + JSON.stringify(c));
  await clear(page);
  return 5;
}

/* 提示與結算卡不壓任務卡（圖 106、134）；結算卡的「下一步」跟任務卡「現在做」同一句。 */
async function toastOffDock(page, tag) {
  await clear(page);
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); __r84.claim({}); s.heirloom.started = true; s.heirloom.delivered = false; s.heirloom.sunWheat = 0; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.plots[0].cropId = "wheat"; s.plots[0].plantedAt = t; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000, introduced: true }); __farm.refresh(); FarmWorld.refresh(s); });
  await clear(page);
  for (const kind of ["toast", "settlement"]) {
    await until(page, () => !document.querySelector("#toast-zone > *"), null, 6000, tag + " 等上一張走完");
    await page.evaluate((k) => { if (k === "toast") __farm.toast("祖母寄來一封信……"); else __farm.enqueueSettlement({ kind: "first_harvest", coins: 0, xp: 3, next: "把 2 份小麥交給老農班伯。" }); }, kind);
    await until(page, () => !!document.querySelector("#toast-zone > *"), null, 4000, tag + " " + kind + " 出現");
    await page.waitForTimeout(320);
    const m = await page.evaluate(() => { const z = document.querySelector("#toast-zone > *"), d = document.querySelector("#questDock"); const s = __farm.state(), t = Date.now(), n = AdventureAPI.nowStep(s, t), g = AdventureAPI.guide(s, t); return { toast: __r84.box(z), dock: __r84.box(d), text: z ? z.textContent.replace(/\s+/g, " ").trim() : "", now: n && n.text ? n.text : g.stepText }; });
    assert.ok(m.toast && m.dock, tag + " " + kind + "：提示與任務卡都看得到 " + JSON.stringify(m));
    assert.equal(overlap(m.toast, m.dock), 0, tag + " " + kind + "：不壓任務卡 " + JSON.stringify(m));
    if (kind === "settlement") {
      assert.ok(m.text.includes("下一步：" + m.now), tag + " 結算卡的下一步就是任務卡現在做那一句 " + JSON.stringify(m));
      assert.doesNotMatch(m.text, /把 2 份小麥交給老農班伯/, tag + " 不留排隊時寫好的過期下一步（圖 106）");
    }
  }
  await clear(page);
  return 2;
}

/* 一、任務卡、手札、章節清單講同一件事、同一個數字。 */
async function sameNumbers(page, tag) {
  const readBoth = async () => {
    const dock = await page.evaluate(() => { const d = document.querySelector("#questDock"); return { task: d.querySelector(".r71a-task-name")?.textContent.trim() || "", progress: d.querySelector('[data-audit="quest-progress"]')?.textContent.trim() || "", quest: d.dataset.quest, now: d.querySelector(".r82a-guidance-full")?.textContent.trim() || "" }; });
    await page.evaluate(() => FarmWorld.openPanel("story")); await page.waitForTimeout(250);
    const journal = await page.evaluate(() => { const card = document.querySelector("#adventurePanel [data-r63a-main-story]"); return { task: card?.querySelector(".r71a-task-name")?.textContent.trim() || "", progress: card?.querySelector(".r68a-card-head > span:last-child")?.textContent.trim() || "", now: card?.querySelector(".r68a-card-now small")?.textContent.trim() || "", rows: [...(card?.querySelectorAll(".r68a-card-requirements span") || [])].map((n) => n.textContent.trim()) }; });
    await page.evaluate(() => document.querySelector(".side-panel")?.classList.remove("world-panel-open")); await page.waitForTimeout(150);
    return { dock, journal };
  };
  /* 圖 77：光正照在熟麥上，主線還差找鎮長。 */
  await clear(page);
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); __r84.claim({}); s.adventure.byTarget.talk.mayor = 0; s.heirloom.started = false; s.heirloom.delivered = false; AdventureAPI.record(s, { type: "plant", cropId: "wheat" }, t); for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.plots[0].cropId = "wheat"; s.plots[0].plantedAt = t - 3600000; s.plots[0].wateredAt = t - 3600000; Object.assign(s.sun, { plots: [0], used: [], startsAt: t - 1000, endsAt: t + 60000, previewPlots: [], previewAt: 0, nextAt: t + 600000, introduced: true }); __farm.refresh(); FarmWorld.refresh(s); });
  await clear(page);
  let r = await readBoth();
  /* R85A 同步（R85 計畫 A 線第 1 項）：任務卡標題寫「現在做」那一步、光的那一步不配數字，所以不會再出現「在光裡收成 0/1」（圖 77），
     也不會「標題寫找鎮長、按鈕卻是光」（R84 圖 75、34、52、129）。手札卡的標題寫任務名、數字寫底下子項完成幾項（R84 圖 136、147），
     手札「現在做」跟任務卡同一句。 */
  const subRows = (rows) => rows.filter((row) => /^[✓○]/.test(row));
  const sameJournal = (r, what) => { const rows = subRows(r.journal.rows); assert.equal(r.journal.progress, rows.filter((row) => row.startsWith("✓")).length + "/" + rows.length, tag + " " + what + "：手札的數字跟列出的子項數一致 " + JSON.stringify(r)); assert.equal(r.journal.now, r.dock.now, tag + " " + what + "：手札「現在做」跟任務卡同一句 " + JSON.stringify(r)); };
  assert.equal(await page.evaluate(() => AdventureAPI.nextGuidance(__farm.state(), Date.now()).sunlit), true, tag + " 圖 77 情境：光正照著熟麥");
  assert.deepEqual([r.dock.task, r.dock.progress], ["任務：在光裡收成小麥", ""], tag + " 任務卡標題就是光的那一步、不配主線那一列的 0/1 " + JSON.stringify(r));
  assert.match(r.dock.now, /光/, tag + " 光的那一步佔著「現在做」 " + JSON.stringify(r));
  sameJournal(r, "圖 77");
  assert.ok(r.journal.rows.some((row) => row === "○ 找鎮長葛瑞交談 0/1"), tag + " 條件列還是 0/1 " + JSON.stringify(r.journal.rows));
  /* 光走了以後：任務卡與手札同字同數。 */
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000 }); s.plots[0].plantedAt = t; s.plots[0].wateredAt = t; __farm.refresh(); FarmWorld.refresh(s); });
  await clear(page);
  r = await readBoth();
  assert.deepEqual([r.dock.task, r.dock.progress], ["任務：找鎮長葛瑞交談", "0/1"], tag + " 沒有光時任務卡是主線那一列 " + JSON.stringify(r));
  sameJournal(r, "光走了以後");
  /* 圖 96：祖母手記帶路、主線在第 4 章番茄 1/3。 */
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); for (const q of AdventureAPI.quests(s, t)) if (q.chapter <= 3) s.adventure.claimed[q.id] = true; AdventureAPI.ensure(s, t); s.storage.items.tomato = 1; s.heirloom.started = true; s.heirloom.delivered = false; s.heirloom.sunWheat = 0; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000 }); s.plots[0].cropId = "wheat"; s.plots[0].plantedAt = t; delete s.plots[0].wateredAt; __farm.refresh(); FarmWorld.refresh(s); });
  await clear(page);
  r = await readBoth();
  const lead = await page.evaluate(() => { const g = AdventureAPI.nextGuidance(__farm.state(), Date.now()); return { scope: g.guidanceScope, text: g.text }; });
  assert.equal(lead.scope, "heirloom", tag + " 圖 96 情境：祖母手記帶路");
  assert.equal(r.dock.quest, "first_sun_basket", tag + " 任務卡是祖母手記");
  assert.equal(r.journal.now, lead.text, tag + " 手札「現在做」跟任務卡同一步（祖母手記），不是「番茄 1/3」 " + JSON.stringify(r));
  /* R85A 同步：第 4 章的子項是 R78C 的兩條路格子，數字跟這一章主線要交的子項（任務本身的條件列）完成幾項一致。 */
  const ch4 = await page.evaluate(() => { const q = AdventureAPI.summary(__farm.state(), Date.now()).currentQuest, rows = (q.objectives || []).concat(q.requirements || []); return { progress: rows.filter((row) => row.complete).length + "/" + rows.length, tomato: rows.find((row) => row.id === "tomato") }; });
  assert.equal(r.journal.progress, ch4.progress, tag + " 第 4 章手札的數字跟子項完成幾項一致 " + JSON.stringify([r, ch4]));
  assert.deepEqual([ch4.tomato.current, ch4.tomato.required], [1, 3], tag + " 番茄那一列還是 1/3");
  /* 圖 152：一鍵收成收了 2 份小麥（沒經過收成掛勾）。倉庫 2/2 時任務的收成數也是 2/2，交得出去。 */
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); __r84.claim({ c1_homecoming: true }); s.heirloom.started = false; s.adventure.byTarget.harvest.wheat = 0; s.stats.harvested = { wheat: 2 }; s.storage.items.wheat = 2; __farm.refresh(); FarmWorld.refresh(s); });
  await page.waitForTimeout(300);
  const q = await page.evaluate(() => { const q = AdventureAPI.quests(__farm.state(), Date.now()).find((row) => row.id === "c1_first_harvest"); return { goal: q.objectives[0].current + "/" + q.objectives[0].required, need: q.requirements[0].current + "/" + q.requirements[0].required, canClaim: q.canClaim }; });
  assert.deepEqual(q, { goal: "2/2", need: "2/2", canClaim: true }, tag + " 圖 152：收成數跟倉庫一致、交得出去 " + JSON.stringify(q));
  /* 圖 138、139：還沒選之前任務卡不提藍布老麥田。 */
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); __r84.claim({ c1_homecoming: true }); s.heirloom.started = true; s.heirloom.sunWheat = 2; s.storage.items.wheat = 4; delete s.r81story; FarmHeirloom.deliver(s, "table", t); StoryR76.r81Ensure(s).shownAt = t; __farm.refresh(); FarmWorld.refresh(s); });
  await clear(page);
  const dockText = await page.evaluate(() => document.querySelector("#questDock").textContent);
  assert.doesNotMatch(dockText, /藍布老麥田|封存箱/, tag + " 還沒選時任務卡不指向還不存在的物件 " + dockText);
  assert.match(dockText, /藍布舊麥種/, tag + " 任務卡指的是鎮長腳邊那包");
  return 4;
}

/* 三、手機右下大鈕（390×844）。 */
async function thumb(page, tag) {
  const stand = (fnName) => page.evaluate((fnName) => {
    const s = __farm.state(), target = s.map.tiles.find(window[fnName]);
    const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    /* 站的那一格四周沒有田（田格照舊寫自己的狀態，R78B），面前就是目標。 */
    const at = (x, y) => s.map.tiles.find((t) => t.x === x && t.y === y);
    const free = (tile) => tile && !tile.object && !tile.station && !tile.npc && tile.plotIndex == null && !tile.structureId && !tile.buildingId && tile.terrain !== "water";
    const noPlot = (tile) => Object.values(dirs).every(([dx, dy]) => { const n = at(tile.x + dx, tile.y + dy); return !n || n.plotIndex == null; });
    for (const strict of [true, false]) for (const [name, [dx, dy]] of Object.entries(dirs)) { const tile = at(target.x - dx, target.y - dy); if (free(tile) && (!strict || noPlot(tile))) { s.player.tileId = tile.id; s.player.x = tile.x; s.player.y = tile.y; s.player.facing = name; s.player.action = "idle"; return target.id; } }
    return "";
  }, fnName);
  /* 圖 128：熟麥那一格任務卡叫玩家先折光（光會落在旁邊空田），大鈕不寫收成，按下去是折光。 */
  await clear(page);
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); __r84.claim({}); s.heirloom.started = false; s.heirloom.delivered = false; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.plots[0].cropId = "wheat"; s.plots[0].plantedAt = t - 3600000; s.plots[0].wateredAt = t - 3600000; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [1], previewAt: t + 30000, nextAt: t + 30000, refractions: 0, introduced: true }); FarmSunplay.normalize(s).r75Sunplay.firstRefracted = false; window.__r84Plot0 = (x) => x.plotIndex === 0; });
  const plot0 = await stand("__r84Plot0");
  await page.evaluate((id) => { __farm.refresh(); FarmWorld.refresh(__farm.state()); __farm.clickTile(id); if (__farm.cancelJourney) __farm.cancelJourney(); }, plot0);
  await clear(page);
  await page.waitForTimeout(800);
  let r = await page.evaluate(() => { const a = document.querySelector("#actionA"), g = AdventureAPI.nextGuidance(__farm.state(), Date.now()); const why = []; for (let n = a; n && n !== document.body; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === "none" || c.visibility === "hidden" || n.hidden) why.push((n.id || n.className) + ":" + c.display + "/" + c.visibility); } return { why, say: (document.querySelector("#worldDialogue:not([hidden])") || {}).textContent || "", story: document.querySelectorAll(".r76b-dialogue").length, menu: !!document.querySelector("#farmMenu:not([hidden])"), focus: document.documentElement.dataset.r78Focus || "", text: a.textContent.trim(), shown: __r84.shown(a), held: a.dataset.r84bHeld, step: g.action, plot: g.plotIndex, label: g.actionLabel, ready: Game.getCropProgress(__farm.state(), __farm.state().plots[0], Date.now()).ready }; });
  assert.deepEqual([r.step, r.plot, r.ready], ["refract", 0, true], tag + " 圖 128 情境：熟麥那一格要先折光 " + JSON.stringify(r));
  assert.ok(!(r.shown && /^收成/.test(r.text)), tag + " 大鈕不寫收成 " + JSON.stringify(r));
  /* R85A 同步（R85 計畫 A 線第 2 項，R84 圖 95、128、160：任務卡與右下大鈕寫同一句）：同一個動作只留任務卡那一顆主鈕，大鈕讓位，按任務卡主鈕就是折光。 */
  assert.ok(!(r.shown && r.text === r.label), tag + " 大鈕不跟任務卡主鈕寫同一句 " + JSON.stringify(r));
  await page.locator("#questDock [data-world-go]").first().tap({ timeout: 8000 });
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => { const s = __farm.state(); return { crop: s.plots[0].cropId, refractions: s.sun.refractions, preview: s.sun.previewPlots }; });
  assert.equal(after.crop, "wheat", tag + " 按下去沒有把麥收掉 " + JSON.stringify(after));
  assert.ok(after.refractions >= 1 && after.preview.includes(0), tag + " 按下去是折光 " + JSON.stringify(after));

  /* 圖 153：今日三件事帶玩家把小麥交給班伯，主角站在告示牌旁——大鈕不寫「使用・告示牌」，寫任務卡那一步。 */
  await clear(page);
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); __r84.claim({ c1_homecoming: true }); s.heirloom.started = false; s.materials.wood = 0; s.materials.stone = 0; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.storage.items.wheat = 2; s.stats.harvested = { wheat: 2 }; s.adventure.byTarget.harvest.wheat = 2; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000 }); s.interaction.selectedTileId = null; window.__r84Sign = (x) => x.station === "sign"; const sign = s.map.tiles.find(window.__r84Sign); if (__farm.travelAndDo(sign.id, "use", () => {}) && __farm.cancelJourney) __farm.cancelJourney(); /* 上一段點選的田格不留著 */ });
  await stand("__r84Sign");
  await page.evaluate(() => { __farm.refresh(); FarmWorld.refresh(__farm.state()); });
  await clear(page);
  await page.waitForTimeout(900);
  r = await page.evaluate(() => { const a = document.querySelector("#actionA"), d = document.querySelector("#questDock"), main = d.querySelector("[data-early-goal],[data-world-go]"), s = __farm.state(), elder = s.map.tiles.find((x) => x.npc === "elder"); return { text: a.textContent.trim(), shown: __r84.shown(a), off: a.dataset.r83aOffTarget, target: d.dataset.targetId, elder: elder.id, quest: d.dataset.quest, main: main ? main.textContent.trim() : "", step: AdventureAPI.nextGuidance(s, Date.now()).action }; });
  assert.deepEqual([r.quest, r.step], ["early_free_choice", "deliver"], tag + " 圖 153 情境：今日三件事帶去交給班伯 " + JSON.stringify(r));
  assert.equal(r.target, r.elder, tag + " 任務卡標出要去的是班伯 " + JSON.stringify(r));
  assert.ok(!(r.shown && /告示牌/.test(r.text)), tag + " 大鈕不寫告示牌 " + JSON.stringify(r));
  if (r.main) assert.ok(!(r.shown && r.text === r.main), tag + " 大鈕不抄任務卡主鈕那一句（R85A 同步） " + JSON.stringify(r));

  /* 圖 160：祖母手記卡收合時那顆小鈕寫要做的事。 */
  await clear(page);
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); __r84.claim({ c1_homecoming: true }); s.heirloom.started = true; s.heirloom.delivered = false; s.heirloom.sunWheat = 0; s.materials.wood = 4; s.materials.stone = 2; s.stats.harvested = { wheat: 1 }; s.storage.items.wheat = 0; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.plots[0].cropId = "wheat"; s.plots[0].plantedAt = t; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000 }); __farm.refresh(); FarmWorld.refresh(s); });
  await clear(page);
  await page.evaluate(() => { const d = document.querySelector("#questDock"); d.classList.remove("quest-auto-collapsed", "quest-target-collapsed"); d.classList.add("quest-collapsed"); });
  await page.waitForTimeout(250);
  r = await page.evaluate(() => { const b = document.querySelector("#questDock .r83a-heirloom-alt"), g = AdventureAPI.nextGuidance(__farm.state(), Date.now()); return { alt: !!(g && g.alternative), text: b ? b.textContent.trim() : "", shown: __r84.shown(b), title: b ? b.title : "" }; });
  assert.equal(r.alt, true, tag + " 圖 160 情境：有另一件可挑 " + JSON.stringify(r));
  assert.equal(r.text, "修釣台", tag + " 小鈕寫得出要做什麼 " + JSON.stringify(r));
  assert.ok(r.shown, tag + " 收合時看得到小鈕 " + JSON.stringify(r));
  await clear(page);
  return 3;
}

async function browserChecks() {
  let chromium;
  try { ({ chromium } = require("playwright")); } catch (error) { throw new Error("缺 playwright：" + error.message); }
  const server = await serve(), origin = "http://127.0.0.1:" + server.address().port, browser = await launch(chromium);
  let checks = 0;
  try {
    for (const [w, h, mobile] of VIEWS) {
      const tag = w + "×" + h, ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await ctx.newPage(), errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(origin);
      await page.waitForFunction(() => window.__farm && window.StoryR76 && window.AdventureAPI && window.FarmLayers && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
      await page.evaluate(() => document.querySelector("#worldSunBegin,#worldBegin")?.click());
      await page.waitForTimeout(400);
      await page.evaluate(install);
      checks += await sameNumbers(page, tag);
      checks += await toastOffDock(page, tag);
      checks += await layers(page, tag);
      if (mobile && w < h) checks += await thumb(page, tag);
      assert.deepEqual(errors, [], tag + " 沒有頁面錯誤");
      console.log("PASS 瀏覽器 " + tag);
      await ctx.close();
    }
  } finally { await browser.close(); await new Promise((done) => server.close(done)); }
  return checks;
}

browserChecks().then((checks) => {
  passed++;
  console.log("PASS 瀏覽器檢查 " + checks + " 項");
  console.log(passed + " passed");
  if (!process.exitCode) console.log("VERIFIED content R84B consistency and single layer");
}).catch((error) => { console.error("FAIL 瀏覽器檢查\n" + (error && error.stack || error)); process.exitCode = 1; });
