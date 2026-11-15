"use strict";
/* R76B 第 8～10 項：開場對白逐句、選項兩行小字、晚點再說、手札同字、六回訪、六長期影響、鄰居頭像。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
const A = require("../src/adventure.js");
const S = require("../src/state.js");
const M = require("../src/midgame-r66.js");
const K = require("../src/cooking-r75.js");
const R = require("../src/story-r76.js");
const N = require("../src/neighbors-r61.js");
const T0 = 1794172800000;
const DAY = 24 * 60 * 60 * 1000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (e) { console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; } }
function fresh(level) { const st = S.defaultState(T0); st.level = level == null ? 3 : level; st.coins = 500; A.ensure(st, T0); M.ensure(st, T0); return st; }
function choose(st, npcId, choiceId, at) {
  if (npcId === "elder") st.adventure.claimed.c1_first_harvest = true;
  if (npcId === "merchant") st.adventure.claimed.c1_homecoming = true;
  A.ensure(st, at || T0);
  const r = A.resolveMainStoryChoice(st, npcId, choiceId, at || T0);
  assert.equal(r.ok, true, npcId + "/" + choiceId + " " + JSON.stringify(r));
  return r;
}

test("1 三段對白至少三句、最後一句是問句，手札當時問與對話同一份字", () => {
  for (const npcId of ["mayor", "elder", "merchant"]) {
    const view = A.mainStoryChoice(fresh(), npcId, T0) || R.choiceDef(npcId);
    const def = R.choiceDef(npcId);
    assert.ok(def.lines.length >= 3, npcId + " 至少三句");
    assert.match(def.lines[def.lines.length - 1], /？$/, npcId + " 最後一句是問句");
    assert.equal(K.CHOICE_DEFS.find((row) => row.npcId === npcId).question, def.lines[def.lines.length - 1], npcId + " 手札與對話同字");
    const adv = A.mainStoryChoice((() => { const st = fresh(); if (npcId === "elder") st.adventure.claimed.c1_first_harvest = true; if (npcId === "merchant") st.adventure.claimed.c1_homecoming = true; A.ensure(st, T0); return st; })(), npcId, T0);
    if (adv) assert.deepEqual(adv.lines, def.lines, npcId + " 對話來源一致");
  }
  const src = fs.readFileSync("src/story-r76.js", "utf8");
  assert.match(src, /晚點再說/);
  assert.match(src, /不自動關閉|下一句/);
});

test("2 每個選項有馬上拿到與之後一直有效兩行小字，選完有回應句", () => {
  for (const npcId of ["mayor", "elder", "merchant"]) {
    const def = R.choiceDef(npcId);
    assert.equal(def.options.length, 2);
    for (const opt of def.options) {
      assert.match(opt.immediate, /^馬上拿到：/);
      assert.match(opt.longTerm, /^之後一直有效：/);
      assert.ok(opt.reply.length >= 10, npcId + "/" + opt.id + " 選完要回一句");
    }
  }
  const ui = fs.readFileSync("src/ui.js", "utf8");
  assert.match(ui, /openOpeningChoice/, "找鄰居說話要走逐句對話框");
  assert.doesNotMatch(fs.readFileSync("src/story-r76.js", "utf8"), /setTimeout\([^)]*remove/, "對話框不可自動消失");
});

test("3 六個回訪各至少兩句，隔天再找他或完成兩張訂單才觸發，播過後手札有後來一行", () => {
  const cases = [["mayor", "farm"], ["mayor", "town"], ["elder", "sell"], ["elder", "seed"], ["merchant", "sign"], ["merchant", "listen"]];
  for (const [npcId, choiceId] of cases) {
    const st = fresh();
    choose(st, npcId, choiceId, T0);
    const def = R.followupDef(st, npcId);
    assert.ok(def && def.lines.length >= 2, npcId + "/" + choiceId + " 回訪至少兩句");
    assert.equal(R.noteTalk(st, npcId, T0 + 1000), null, "同一天找他還不該觸發回訪");
    assert.ok(R.noteTalk(st, npcId, T0 + DAY), npcId + "/" + choiceId + " 隔天再找他要觸發");
    R.markFollowupSeen(st, npcId, T0 + DAY);
    assert.equal(R.noteTalk(st, npcId, T0 + DAY + 1000), null, "播過後不再重播");
    const row = K.choiceEffects(st).find((r) => r.npcId === npcId);
    assert.ok(row.followupSummary && row.followupSummary.length >= 8, "手札要有後來內容");
    const htmlSrc = fs.readFileSync("src/cooking-r75.js", "utf8");
    assert.match(htmlSrc, /後來：/, "手札卡片要印後來一行");
    const st2 = fresh();
    choose(st2, npcId, choiceId, T0);
    R.noteOrder(st2, npcId, T0);
    assert.equal(R.followupDue(st2, npcId, T0, "order"), null, "一張訂單還不觸發");
    const second = R.noteOrder(st2, npcId, T0);
    assert.ok(second.due, npcId + "/" + choiceId + " 兩張訂單要觸發回訪");
  }
});

test("4 六個長期影響逐一真的生效", () => {
  let st = fresh(); choose(st, "mayor", "farm");
  const packsBefore = st.adventure.r58.r59.seedPacks.wheat || 0;
  assert.equal(K.dailyPerks(st, T0).claimed.length, 1);
  assert.equal(st.adventure.r58.r59.seedPacks.wheat, packsBefore + 1, "鎮長種田：每天送種子真的入帳");
  st = fresh(); choose(st, "mayor", "town");
  const q = M.mayorQuest(st, T0);
  assert.equal(q.rewardCoins, Math.round(q.baseRewardCoins * 1.1), "鎮長聽鎮上的事：委託金幣多一成");
  st = fresh(); const baseElder = A.commissions(fresh(), T0).find((r) => r.id === "elder_supper");
  choose(st, "elder", "sell");
  assert.equal(A.commissions(st, T0).find((r) => r.id === "elder_supper").reward.coins, Math.round(baseElder.reward.coins * 1.1), "班伯先賣：委託多一成");
  st = fresh(); choose(st, "elder", "seed");
  const crop = K.seasonalCropId(st); const beforeSeed = st.adventure.r58.r59.seedPacks[crop] || 0;
  assert.equal(M.askElderAdvice(st, T0).seasonalSeed.cropId, crop);
  assert.equal(st.adventure.r58.r59.seedPacks[crop], beforeSeed + 1, "班伯留種：請教多一包當季種子");
  st = fresh(); const baseMer = A.commissions(fresh(), T0).find((r) => r.id === "river_market");
  choose(st, "merchant", "sign");
  assert.equal(K.farmSignVisible(st), true);
  assert.equal(A.commissions(st, T0).find((r) => r.id === "river_market").reward.coins, Math.round(baseMer.reward.coins * 1.1), "蘿拉掛牌：委託多一成");
  st = fresh(); choose(st, "merchant", "listen");
  assert.equal(M.merchantSpecial(st, T0).deals.length, 2, "蘿拉先聽客人：特價變兩樣");
});

test("5 鄰居故事與手札頭像：四位都有 64 顯示的頭像檔", () => {
  assert.deepEqual(Object.keys(N.PORTRAITS).sort(), ["child", "elder", "mayor", "merchant"]);
  for (const [id, file] of Object.entries(N.PORTRAITS)) {
    assert.ok(fs.existsSync(file), id + " 頭像檔要在：" + file);
    assert.equal(R.portraitFor(id), file, id + " story 頭像一致");
  }
  assert.equal(R.portraitFor("child"), "assets/generated/content-r76/portrait-child.png");
  const nb = fs.readFileSync("src/neighbors-r61.js", "utf8");
  assert.match(nb, /r76b-portrait/, "故事面板與手札都要有頭像");
  assert.match(nb, /r76b-story-head/);
});

test("6 載入與快取：story-r76 有進 index 與 sw，三張新頭像有進 sw，版本字串不變", () => {
  const index = fs.readFileSync("index.html", "utf8");
  const sw = fs.readFileSync("sw.js", "utf8");
  assert.match(index, /src\/story-r76\.js\?v=content-r78-20261115-1/);
  assert.match(sw, /story-r76\.js/);
  for (const f of ["portrait-elder.png", "portrait-merchant.png", "portrait-child.png"]) assert.match(sw, new RegExp("content-r76/" + f));
  assert.match(sw, /CACHE_VERSION = "content-r78-20261115-1"/);
});

console.log("VERIFIED content R76B story (" + passed + " tests)");
