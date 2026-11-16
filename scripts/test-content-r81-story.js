"use strict";
/* R81C：新存檔前十分鐘有一段有衝突、有收尾的小故事「藍布舊麥種」——
   1. 祖母便箋留一個具體的謎；餐籃送到鎮長葛瑞手上時，鎮長葛瑞要封存、老農班伯要種回田裡（同一包種子，兩邊要的相反）；
      玩家選一邊，地圖物件與一張具名訂單跟著不同；交完訂單演一段收尾場景，鎮長葛瑞的情緒從板著臉到說出當年的事。
      用遊戲本身的動作與時間（光、種、澆、收、送籃、選、交單、看完收尾）模擬新存檔，兩種選擇都在十分鐘內走完。
   2. 鄰居親口說的話不再講規則與獎勵（沒有數字、每天、獎勵、解鎖、金幣……），規則與數字留在選項、手札與提示。
   3. 手札第一屏三層：現在做（一行＋帶我去）、今天可做（最多兩項）、以後再說（預設收合），1366×768 與 390×844 實際量。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
global.window = global;
const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const C = require("../src/config.js");
const A = require("../src/adventure.js");
const State = require("../src/state.js");
const G = require("../src/game.js");
const H = require("../src/heirloom.js");
const M = require("../src/midgame-r66.js");
const K = require("../src/cooking-r75.js");
const R = require("../src/story-r76.js");
const Q = require("../src/choices-r77.js");
Q.install();

const T0 = 1794172800000, MIN = 60000;
const NO_LATIN = /[A-Za-z]/;
/* 鄰居親口說的話裡不該出現的規則／獎勵字眼。 */
const RULE_WORDS = /\d|每天|一天一|獎勵|報酬|解鎖|金幣|[一二兩三四五六七八九十]成|多付|多給|開張小禮/;
let passed = 0;
const pending = [];
function test(name, fn) {
  try { const out = fn(); if (out && typeof out.then === "function") { pending.push(out.then(() => { passed++; console.log("PASS " + name); }, (error) => { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; })); return; } passed++; console.log("PASS " + name); }
  catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; }
}
function fresh(at) { const s = State.defaultState(at || T0); A.ensure(s, at || T0); M.ensure(s, at || T0); K.ensure(s, at || T0); return s; }
function textOf(line) { return line && typeof line === "object" ? line.text : String(line); }
function isNarration(line) { return (line && typeof line === "object" && line.by === "") || /^（[\s\S]*）$/.test(textOf(line)); }
function rng(seed) { let x = seed >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
/* 市集同樣東西的一般訂單最多給幾金：新手單每份＝售價 × 7（game.js makeBeginnerOrder），其他照稀有度倍率（makeOrder）。 */
function generalMax(itemId, qty) {
  const sell = C.CROPS[itemId].sellValue;
  const units = [sell * 7].concat(Object.values(C.ORDER_RARITY).map((r) => Math.max(1, Math.round(sell * r.payMult))));
  return Math.max(...units) * qty;
}

test("第 1 項：祖母便箋留一個具體的謎，開場便箋與餐籃便箋同一句，餐籃送到前不會揭開", () => {
  assert.match(R.R81_MYSTERY, /籃底.*藍布舊麥種.*布上沒寫名字/);
  assert.match(R.R81_MYSTERY, /這包不是我的.*主人/);
  assert.doesNotMatch(R.R81_MYSTERY, NO_LATIN);
  assert.equal(R.R81_TITLE, "藍布舊麥種是誰的？");
  const world = read("src/world-ui.js"), heir = read("src/heirloom-ui.js");
  assert.match(world, /if \(title === "籃底有祖母留下的便箋"\) \{[\s\S]*?window\.StoryR76\.R81_MYSTERY[\s\S]*?p\.className = "r81c-mystery"/, "開場便箋接上那一句");
  assert.match(heir, /const mysteryText = window\.StoryR76 && window\.StoryR76\.R81_MYSTERY;/, "餐籃便箋同一句");
  const s = fresh();
  assert.equal(R.r81Stage(s), "", "餐籃還沒送到，故事還沒開始");
  assert.deepEqual(R.r81SceneRows(s), []);
  assert.equal(R.r81Today(s, T0), null);
  assert.equal(R.r81Choose(s, "plant", T0).reason, "locked");
  /* 謎底在收尾才說：衝突那段不提是誰的。 */
  assert.doesNotMatch(R.R81_CONFLICT.map(textOf).join(""), /他爹|我爹/);
});

test("第 1 項：送籃時兩位鄰居對同一包種子要的相反——鎮長葛瑞要封存、老農班伯要種回田裡，兩邊都親口說", () => {
  const lines = R.R81_CONFLICT;
  const mayor = lines.filter((l) => l.by === "mayor").map(textOf).join(""), elder = lines.filter((l) => l.by === "elder").map(textOf).join("");
  assert.match(mayor, /封/); assert.match(elder, /下田|種/);
  assert.ok(lines.some(isNarration), "有旁白");
  assert.ok(isNarration(lines[lines.length - 1]), "最後一句把決定交給玩家");
  assert.deepEqual(Object.keys(R.R81_OPTIONS).sort(), ["plant", "seal"]);
  assert.equal(R.R81_OPTIONS.plant.side, "elder"); assert.equal(R.R81_OPTIONS.seal.side, "mayor");
  for (const line of lines) if (!isNarration(line)) assert.ok(["mayor", "elder"].includes(line.by), "說話的是兩位鄰居：" + textOf(line));
  const s = fresh(); s.heirloom.sunWheat = 2; s.storage.items.wheat = 2;
  assert.equal(H.deliver(s, "table", T0 + 1000).ok, true);
  assert.equal(R.r81Stage(s), "conflict");
  const row = Q.sceneStates(s).find((r) => r.r81c);
  assert.equal(row.marker.anchor, "npc:mayor"); assert.equal(row.label, "藍布舊麥種・等你決定");
  const today = R.r81Today(s, T0 + 2000);
  assert.match(today.line, /葛瑞想封起來，班伯要種回田裡/);
});

test("第 1 項：選擇改變地圖物件與一張具名訂單；具名訂單不低於同樣東西的一般訂單，寫多少就入帳多少", () => {
  const looks = new Set(), orders = new Set();
  for (const choice of ["plant", "seal"]) {
    const s = fresh(); s.heirloom.sunWheat = 2; s.storage.items.wheat = 2; H.deliver(s, "doorstep", T0);
    const before = Q.sceneStates(s).find((r) => r.r81c);
    const r = R.r81Choose(s, choice, T0 + 1000);
    assert.equal(r.ok, true); assert.ok(r.reply && r.reply.text, "選完有一句角色的反應");
    assert.equal(R.r81Choose(s, choice === "plant" ? "seal" : "plant", T0 + 2000).reason, "decided", "選了就不能反悔");
    const row = Q.sceneStates(s).find((x) => x.r81c);
    assert.notEqual(row.marker.anchor, before.marker.anchor, "物件從鎮長葛瑞腳邊換到那一邊的地點");
    assert.notEqual(row.label, before.label);
    assert.ok(fs.existsSync(path.join(ROOT, row.marker.art)), "地圖物件用的圖一定存在：" + row.marker.art);
    looks.add(row.marker.anchor + "|" + row.label + "|" + row.marker.art);
    const info = R.r81Order(s, T0 + 3000);
    orders.add(info.name);
    assert.equal(info.enough, false);
    assert.match(R.r81Deliver(s, T0 + 3000).message, /倉庫還差 2 份/);
    const general = generalMax("wheat", 2);
    assert.equal(info.general, general, "一般訂單上限跟 game.js 的算法一致");
    assert.ok(info.coins >= general, info.name + " " + info.coins + " 金不低於一般訂單 " + general + " 金");
    s.storage.items.wheat = 2;
    const coins0 = s.coins, packs0 = s.adventure.r58.r59.seedPacks.wheat || 0;
    const done = R.r81Deliver(s, T0 + 4000);
    assert.equal(done.ok, true, JSON.stringify(done));
    assert.equal(s.coins - coins0, info.coins, "實際入帳就是寫出來的金幣");
    assert.equal((s.storage.items.wheat || 0), 0, "兩份小麥交出去了");
    if (choice === "plant") assert.equal(s.adventure.r58.r59.seedPacks.wheat - packs0, 2, "班伯回禮兩包小麥種子");
    assert.match(R.r81OrderPreview(choice), new RegExp("交 2 份小麥，拿 " + info.coins + " 金"), "選之前看到的數字跟交單一致");
    assert.equal(R.r81Stage(s), "scene");
    assert.equal(R.r81Deliver(s, T0 + 5000).ok, false, "一張只交一次");
  }
  assert.equal(looks.size, 2, "兩種選擇地圖上長得不一樣"); assert.equal(orders.size, 2, "兩種選擇的具名訂單不一樣");
  assert.deepEqual(R.R81_ART, { pending: "assets/generated/content-r81/story-pouch.png", plant: "assets/generated/content-r81/story-oldwheat-field.png", seal: "assets/generated/content-r81/story-seal-box.png" });
  for (const key of Object.keys(R.R81_ART)) assert.equal(R.R81_ART_READY.includes(key), fs.existsSync(path.join(ROOT, R.R81_ART[key])), key + " 清單要跟檔案在不在一致");
});

test("第 1 項：收尾是一段角色場景——揭開謎底（鎮長葛瑞他爹的麥種），鎮長葛瑞從講規矩到說出心裡話，不交代規則", () => {
  for (const choice of ["plant", "seal"]) {
    const opt = R.R81_OPTIONS[choice], scene = opt.scene;
    assert.ok(scene.length >= 6, choice + " 收尾至少六句");
    const said = scene.filter((l) => !isNarration(l));
    assert.ok(said.some((l) => l.by === "mayor") && said.some((l) => l.by === "elder"), "兩位鄰居都在場");
    assert.ok(scene.some(isNarration), "有動作描寫");
    assert.match(scene.map(textOf).join(""), /葛瑞他爹|寫我爹|那年我爹/, "揭開謎底");
    assert.match(scene.map(textOf).join(""), /……/, "說不出口的停頓");
    const mayorLines = said.filter((l) => l.by === "mayor").map(textOf);
    assert.notEqual(mayorLines[0], mayorLines[mayorLines.length - 1]);
    assert.match(mayorLines[mayorLines.length - 1], /我自己|替我/, "最後一句是鎮長葛瑞自己的決定，不是規則");
    for (const line of said) assert.doesNotMatch(textOf(line), RULE_WORDS, "收尾不講規則：" + textOf(line));
    const s = fresh(); s.heirloom.sunWheat = 2; s.storage.items.wheat = 4; H.deliver(s, "table", T0);
    R.r81Choose(s, choice, T0); R.r81Deliver(s, T0);
    assert.deepEqual(R.r81Scene(s).map(textOf), scene.map(textOf));
    assert.equal(R.r81SceneSeen(s, T0 + 1), true);
    assert.equal(R.r81Stage(s), "done"); assert.equal(R.r81Today(s, T0 + 2), null, "收尾後不再佔手札今天可做");
    assert.equal(R.r81Summary(s), opt.summary); assert.match(opt.summary, /藍布舊麥種是葛瑞他爹留下的/);
    assert.equal(Q.sceneStates(s).find((r) => r.r81c).label, opt.labels.done);
    const saved = State.migrate(JSON.parse(JSON.stringify(s)));
    assert.equal(R.r81Stage(saved), "done", "存檔讀回來進度還在");
  }
  const bad = fresh(); bad.r81story = { choice: "__proto__", orderAt: 5, sceneAt: 9, extra: 1 };
  assert.deepEqual(R.r81Ensure(bad), { choice: "", choiceAt: 0, shownAt: 0, orderAt: 0, sceneAt: 0 }, "壞掉的存檔欄位清乾淨");
});

/* 新存檔照遊戲本身的動作與時間走一遍：每秒更新一次光，玩家只在光裡種、在光裡澆、熟了就收。 */
function play(choice) {
  const s = fresh(), roll = rng(81);
  let t = T0;
  const log = [];
  const mark = (name) => log.push(name + " " + Math.round((t - T0) / 1000) + " 秒");
  t += 10000; H.start(s); mark("讀完祖母便箋");
  t += 15000; A.record(s, { type: "talk", npcId: "mayor" }, t);
  assert.equal(A.resolveMainStoryChoice(s, "mayor", "farm", t).ok, true); mark("回答鎮長葛瑞");
  const n = G.activePlotCount(s);
  const farmTick = () => {
    t += 1000;
    G.updateSunpatch(s, t, roll);
    const lit = G.sunpatchStatus(s, t).plots;
    const planted = s.plots.slice(0, n).some((p) => p.cropId);
    for (let i = 0; i < n; i++) {
      const p = s.plots[i];
      /* 每個動作都算走過去、蹲下去的三秒。 */
      if (!p.cropId) { if ((!planted || lit.includes(i)) && G.plant(s, i, "wheat", t).ok) t += 3000; continue; }
      const prog = G.getCropProgress(s, p, t);
      if (prog.ready) { if (G.harvest(s, i, t).ok) t += 3000; }
      else if (lit.includes(i) && !prog.wet && G.waterPlot(s, i, t).ok) t += 3000;
    }
  };
  while (!H.status(s).ready) { farmTick(); assert.ok(t - T0 < 10 * MIN, "十分鐘內要湊齊餐籃：" + JSON.stringify(H.status(s))); }
  mark("餐籃備齊");
  t += 20000; assert.equal(H.deliver(s, "table", t).ok, true); mark("餐籃送到鎮長葛瑞手上");
  assert.equal(R.r81Stage(s), "conflict");
  assert.equal(Q.sceneStates(s).find((r) => r.r81c).label, "藍布舊麥種・等你決定");
  t += 35000; assert.equal(R.r81Choose(s, choice, t).ok, true); mark("聽兩人爭執後選「" + R.R81_OPTIONS[choice].label + "」");
  const row = Q.sceneStates(s).find((r) => r.r81c);
  assert.equal(row.marker.anchor, R.R81_OPTIONS[choice].anchor); mark("地圖物件換成「" + row.label + "」");
  while (!R.r81Order(s, t).enough) { farmTick(); assert.ok(t - T0 < 10 * MIN, "十分鐘內要湊齊訂單的小麥"); }
  t += 20000; const done = R.r81Deliver(s, t); assert.equal(done.ok, true, JSON.stringify(done)); mark("交具名訂單「" + done.name + "」");
  t += 40000; assert.equal(R.r81SceneSeen(s, t), true); mark("看完收尾");
  assert.equal(R.r81Stage(s), "done");
  assert.ok(t - T0 <= 10 * MIN, choice + " 要在十分鐘內走完：" + log.join(" → "));
  return log;
}
test("第 1 項：新存檔十分鐘內走完「謎 → 衝突 → 選擇改變地圖與具名訂單 → 收尾」（兩種選擇都走得到）", () => {
  for (const choice of ["plant", "seal"]) console.log("  " + choice + "：" + play(choice).join(" → "));
});

test("第 2 項：鄰居親口說的話只講立場與心情，不講規則與獎勵；規則與數字留在選項與手札", () => {
  const lines = [];
  for (const def of Object.values(R.CHOICES)) for (const o of def.options) lines.push(["開場回答・" + o.id, o.reply]);
  for (const [key, def] of Object.entries(R.FOLLOWUPS)) def.lines.forEach((l) => lines.push(["回訪・" + key, l]));
  for (const [key, def] of Object.entries(Q.QUESTS)) {
    def.intro.concat(def.brief).forEach((l) => lines.push(["後續委託・" + key, l]));
    def.steps.forEach((step) => (step.lines || []).concat(step.ask ? [step.ask] : [], step.thanks ? [step.thanks] : []).forEach((l) => lines.push(["後續委託步驟・" + key, l])));
  }
  R.R81_CONFLICT.forEach((l) => lines.push(["藍布舊麥種・爭執", l]));
  for (const [key, opt] of Object.entries(R.R81_OPTIONS)) [opt.reply, opt.order.line, opt.after].concat(opt.scene).forEach((l) => lines.push(["藍布舊麥種・" + key, l]));
  const world = read("src/world-ui.js");
  for (const npc of ["merchant", "elder"]) { const m = world.match(new RegExp('if \\(npcId === "' + npc + '"\\) return "([^"]+)"')); assert.ok(m, npc + " 平常的招呼"); lines.push(["平常招呼・" + npc, m[1]]); }
  for (const [where, line] of lines) {
    const text = textOf(line);
    assert.ok(text && text.length >= 4, where + " 有內容");
    assert.doesNotMatch(text, NO_LATIN, where + " 不夾英文：" + text);
    if (!isNarration(line)) assert.doesNotMatch(text, RULE_WORDS, where + " 不講規則或獎勵：" + text);
  }
  assert.ok(lines.length >= 80, "掃過的鄰居對白夠多：" + lines.length);
  /* 規則與數字還在：選項、手札與地圖物件的交單選項寫得出要交什麼、拿多少。 */
  for (const choice of ["plant", "seal"]) assert.match(R.r81OrderPreview(choice), /^交 2 份小麥，拿 \d+ 金/);
  for (const def of Object.values(R.CHOICES)) for (const o of def.options) assert.match(o.immediate + o.longTerm, /\d|一成/, "開場選項照舊寫出拿到什麼");
  for (const def of Object.values(Q.QUESTS)) assert.ok(def.upgradeText && def.steps.every((s) => s.where), "手札照舊寫出步驟與永久改變");
  /* R80 的規則照舊：鄰居講自己不用第三人稱、不包引號。 */
  for (const def of Object.values(Q.QUESTS)) for (const l of def.brief) assert.doesNotMatch(l, /^(鎮長|老農班伯|班伯|蘿拉)|^「|」$/, "brief 是鄰居自己說的：" + l);
});

test("第 3 項：手札三層的程式接線（現在做的按鈕寫帶我去、今天可做最多兩項、以後再說收合且不再疊第二層再顯示）", () => {
  const world = read("src/world-ui.js"), ui = read("src/ui.js"), css = read("src/content-r58b.css");
  assert.match(world, /const R81C_TODAY_MAX = 2;/);
  assert.match(world, /r81cTierJournal\(panel\); if \(typeof window\.dispatchEvent/, "手札重畫完、通知收合之前就分好三層");
  assert.match(world, /\$\{main \? "帶我去" : esc\(action\)\}/, "目前主線卡的按鈕寫帶我去");
  assert.match(world, /button\.textContent = "帶我去"; button\.title = action;/, "同步時也寫帶我去，動作放提示");
  assert.match(world, /toggle\.textContent = "以後再說（" \+ count \+ " 項）"/);
  assert.match(ui, /c\.closest\("\.r60-later-quests, \[data-r81c-tier\]"\)/, "三層裡的卡都不納入首屏收合（不疊第二層再顯示）");
  assert.match(ui, /pane\.querySelector\("\.r32-show-more, \.r60-show-more, \.r81c-later-toggle\[aria-expanded=false\]"\)/, "以後再說收著時不再另外跳「往下還有」");
  const block = (css.match(/R81C（前十分鐘的小故事[\s\S]*R81C 結束/) || [""])[0];
  assert.ok(block, "R81C 區段在 content-r58b.css 檔尾");
  assert.match(css, /R81C 結束[\s\S]*R82B（舊麥種兩條專屬玩法）開始/, "R82B 依規定接在既有 R81C 後方");
  assert.ok(css.trimEnd().endsWith("/* ===== R81C 結束 ===== */") || /R81C 結束 ===== \*\/\s*\/\*[^\n]*R82[ABC]/.test(css), "R81C 追加在檔尾（R82 起的新段落接在它後面）"); /* R82C 同步：R82 各線依規定也追加在檔尾 */
  assert.ok(css.indexOf("/* ===== R81C 結束 ===== */") < css.indexOf("/* ===== R82A"), "R81C 區段保持完整，R82A 只追加在其後");
  /* R83C 同步：R83 各線的新樣式接在 R82A 後面；R82A 之後只能是 R83 的區塊。 */
  const r83cTail = css.slice(css.lastIndexOf("/* ===== R82A 結束 ===== */") + "/* ===== R82A 結束 ===== */".length);
  assert.ok(css.includes("/* ===== R82A 結束 ===== */") && (!r83cTail.trim() || /^\s*\/\* ===== R83/.test(r83cTail)), "新 CSS 仍只追加在檔尾");
  assert.ok(css.trimEnd().endsWith("/* ===== R82A 結束 ===== */") || /R82A 結束 ===== \*\/\s*\/\* ===== R83[ABC]/.test(css), "新 CSS 仍只追加在檔尾"); /* R83B 同步：R83 各線依規定接在 R82A 後面 */
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
  assert.match(block, /\.r68a-card-now small \{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis;/);
  assert.match(block, /\.r81c-later > \.r81c-later-body\[hidden\] \{ display: none !important; \}/);
});

test("原始碼：中文註解不放在程式後面、提到兩位鄰居用全名、版本字串沒動", () => {
  for (const file of ["src/story-r76.js", "src/choices-r77.js", "src/world-ui.js", "src/heirloom-ui.js"]) {
    const src = read(file), r81 = src.split("\n").filter((l) => /R81C/.test(l));
    assert.ok(r81.length >= 1, file + " 有 R81C 標記");
    for (const l of r81) assert.doesNotMatch(l, /[;,)}\]]\s*\/\/.*[一-鿿]/, file + " 中文註解不用 // 放在程式後面");
  }
  const story = read("src/story-r76.js"), comments = (story.match(/\/\*[\s\S]*?\*\//g) || []).filter((c) => /R81C|藍布/.test(c)).join("");
  assert.doesNotMatch(comments.replace(/鎮長葛瑞|老農班伯/g, ""), /葛瑞|班伯|老農|鎮長/, "註解提到兩位鄰居一律用「鎮長葛瑞」「老農班伯」");
  assert.match(read("sw.js"), /CACHE_VERSION = "content-r82-20261117-1"/);
  assert.match(read("scripts/guard-validation-writes.js"), /"node scripts\/test-content-r81-story\.js"/, "加進 unit 清單");
});

/* ---------- 版面：1366×768、390×844 實際開手札量三層 ---------- */
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
function serve() { return new Promise((resolve, reject) => { const server = http.createServer((req, res) => { const u = new URL(req.url, "http://127.0.0.1"), file = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))); if (path.relative(ROOT, file).startsWith("..") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(file).pipe(res); }); server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server)); }); }
async function launch(chromium) { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("No browser available"); }
test("第 1、3 項版面：手札第一屏三層、送籃後兩人爭執自動開場、選完地圖物件與今天可做的具名訂單跟著換", async () => {
  const { chromium } = require("playwright");
  const server = await serve(), origin = "http://127.0.0.1:" + server.address().port, browser = await launch(chromium);
  try {
    for (const [w, h, mobile] of [[1366, 768, false], [390, 844, true]]) {
      const tag = w + "x" + h;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await ctx.newPage(), errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(origin);
      await page.waitForFunction(() => window.__farm && window.ChoicesR77 && window.StoryR76 && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
      const mystery = await page.evaluate(() => document.querySelector("#worldModal [data-r81c-mystery]")?.textContent || "");
      assert.equal(mystery, await page.evaluate(() => StoryR76.R81_MYSTERY), tag + " 開場便箋有那個謎");
      await page.evaluate(() => { const b = document.querySelector("#worldSunBegin, #worldBegin"); if (b && b.offsetParent) b.click(); });
      await page.waitForTimeout(400);
      const measure = () => page.evaluate(() => {
        const pane = document.querySelector('.side-pane[data-pane="story"]'), body = document.querySelector(".side-panel.world-panel-open .side-body") || document.querySelector(".side-body"), br = body.getBoundingClientRect();
        const card = pane.querySelector('[data-r81c-tier="now"] [data-r63a-main-story]'), now = card && card.querySelector(".r68a-card-now"), small = now && now.querySelector("small"), btn = now && now.querySelector("button"), head = card && card.querySelector(".r68a-card-head");
        const today = pane.querySelector('[data-r81c-tier="today"]'), cards = today ? [...today.querySelectorAll(":scope > .r58-card")].filter((c) => c.getBoundingClientRect().height > 0) : [];
        const later = pane.querySelector("[data-r81c-later]"), r = (n) => n ? n.getBoundingClientRect() : null;
        const lh = small ? parseFloat(getComputedStyle(small).lineHeight) || 16 : 0;
        return { hasNow: !!card, nowLines: small ? Math.round(small.getBoundingClientRect().height / lh) : 0, nowFirst: !!(now && head && r(now).top < r(head).top), btn: btn ? btn.textContent.trim() : "",
          todayHead: today ? today.querySelector(".r81c-tier-head")?.textContent : "", todayCount: cards.length, todayKeys: cards.map((c) => c.dataset.r81cToday || c.dataset.r58PersonalCard || c.className),
          later: later ? { open: later.querySelector(".r81c-later-toggle").getAttribute("aria-expanded") === "true", summary: later.querySelector(".r81c-later-toggle").textContent, visible: [...later.querySelectorAll(".adventure-quest, .r58-card")].filter((c) => c.getBoundingClientRect().height > 0).length } : null,
          order: [r(card), r(today), r(later)].map((x) => x ? Math.round(x.top) : -1), nowInBody: !!(card && r(card).top >= br.top - 1 && r(card).bottom <= br.bottom + 1),
          showMore: !!pane.querySelector(".r32-show-more, .r60-show-more") };
      });
      await page.evaluate(() => FarmWorld.openPanel("story")); await page.waitForTimeout(700);
      let j = await measure();
      assert.equal(j.hasNow, true, tag + " 有現在做那一層");
      assert.equal(j.nowLines, 1, tag + " 現在做只有一行 " + JSON.stringify(j));
      assert.equal(j.nowFirst, true, tag + " 現在做排在章節進度上面");
      assert.equal(j.btn, "帶我去", tag + " 現在做的按鈕寫帶我去");
      assert.equal(j.todayHead, "今天可做");
      assert.ok(j.todayCount <= 2, tag + " 今天可做最多兩項 " + JSON.stringify(j.todayKeys));
      assert.ok(j.later && j.later.open === false && j.later.visible === 0, tag + " 以後再說預設收合 " + JSON.stringify(j.later));
      assert.match(j.later.summary, /^以後再說（\d+ 項）$/);
      assert.ok(j.order[0] < j.order[1] && j.order[1] < j.order[2], tag + " 三層由上而下 " + JSON.stringify(j.order));
      assert.equal(j.nowInBody, true, tag + " 現在做整張在可視區");
      assert.equal(j.showMore, false, tag + " 不再疊一層「再顯示 N 項」");
      await page.locator(".side-pane.sel .r81c-later-toggle").click(); await page.waitForTimeout(300);
      const opened = await measure();
      assert.ok(opened.later.open === true && opened.later.visible > 0, tag + " 按「以後再說」就展開 " + JSON.stringify(opened.later));
      assert.equal(opened.showMore, false, tag + " 展開後也不疊「再顯示」");
      await page.locator(".side-pane.sel .r81c-later-toggle").click(); await page.waitForTimeout(200);
      await page.evaluate(() => document.querySelector(".side-panel").classList.remove("world-panel-open"));
      /* 送籃：交出餐籃、看完送達那一頁，兩人爭執自動開場；選一邊。 */
      await page.evaluate(() => { const s = __farm.state(); s.heirloom.started = true; s.heirloom.sunWheat = 2; s.storage.items.wheat = 2; FarmHeirloom.deliver(s, "table", Date.now()); __farm.refresh(); DailyUI.openHeirloom(); });
      await page.waitForTimeout(500);
      assert.equal(await page.evaluate(() => !!document.querySelector(".r76b-dialogue")), false, tag + " 送達那一頁開著時不搶話");
      assert.match(await page.evaluate(() => document.querySelector('#dailyModal [data-r81c-mystery="conflict"]')?.textContent || ""), /藍布舊麥種滾了出來/, tag + " 送達那一頁接上舊麥種");
      await page.evaluate(() => __farm.closeModal("dailyModal"));
      await page.waitForFunction(() => document.querySelector('.r76b-dialogue[data-r81c-story="conflict"]'), null, { timeout: 8000 });
      const speakers = [];
      for (let i = 0; i < 12 && !(await page.locator(".r76b-dialogue [data-r76b-choice]").count()); i++) {
        speakers.push(await page.evaluate(() => document.querySelector(".r76b-dialogue-head")?.textContent.trim()));
        await page.locator(".r76b-dialogue [data-r76b-next]").first().click();
      }
      assert.ok(speakers.includes("鎮長葛瑞") && speakers.includes("老農班伯") && speakers.includes("旁白"), tag + " 兩位鄰居輪流說話 " + JSON.stringify(speakers));
      const choice = mobile ? "seal" : "plant";
      await page.locator('.r76b-dialogue [data-r76b-choice="' + choice + '"]').click();
      await page.locator(".r76b-dialogue [data-r76b-next]").click();
      await page.waitForFunction((c) => document.querySelector('.r78c-scene-change[data-r81c-story="' + c + '"]'), choice, { timeout: 8000 });
      await page.evaluate(() => FarmWorld.openPanel("story")); await page.waitForTimeout(700);
      j = await measure();
      assert.equal(j.todayKeys[0], "story", tag + " 今天可做第一項是那張具名訂單 " + JSON.stringify(j.todayKeys));
      const storyCard = await page.evaluate(() => document.querySelector('[data-r81c-today="story"]').textContent);
      assert.match(storyCard, choice === "plant" ? /班伯的老麥回禮單/ : /葛瑞的鎮誌登記單/, tag + " 具名訂單跟著選擇");
      assert.ok(j.todayCount <= 2 && j.later.open === false, tag + " 三層照舊");
      assert.deepEqual(errors, [], tag + " 不可有頁面錯誤");
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
});

Promise.all(pending).then(() => { console.log("VERIFIED content R81C story (" + passed + " tests)"); });
