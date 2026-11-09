"use strict";
/* R64 B 線驗收（計畫第 5～7 項）：
   5 四位鄰居各有喜好線索（日常對話與手札）、送喜歡有專屬台詞、送不喜歡好感 +0 且被婉拒；
   6 聽完第 2 段故事得到實際好處：蘿拉市集收購價多 5%、班伯每日多 1 份堆肥、圖圖採集多 1 份、葛瑞開墾少 5 金；
   7 鄰居委託依目前主線章節排序，舊章節未完成標「可補做」排後面。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
require("../src/config.js");
const S = require("../src/state.js");
const A = require("../src/adventure.js");
const G = require("../src/game.js");
const D = require("../src/daily.js");
const N = require("../src/neighbors-r61.js");
const T0 = 1794172800000;
const DAY = 24 * 60 * 60 * 1000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (e) { console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; } }
function fresh() { const st = S.defaultState(T0); A.ensure(st, T0); N.ensure(st, T0); return st; }
function hearStory2(st, npcId) {
  st.adventure.r58.favor[npcId] = 3;
  const r = N.markStorySeen(st, npcId, 1, T0);
  assert.equal(r.ok, true, npcId + " 第 2 段應可聽");
  return r;
}

test("1 四位鄰居各有喜好線索，線索能推到喜歡的禮物，手札也寫線索", () => {
  const lovedNames = { mayor: ["番茄", "農家麥餅"], elder: ["胡蘿蔔"], merchant: ["草莓", "葡萄"], child: ["草莓", "野莓", "向日葵"] };
  for (const p of N.PEOPLE) {
    assert.ok(N.CLUES[p.id] && N.CLUES[p.id].length >= 12, p.id + " 要有線索");
    assert.ok(lovedNames[p.id].some((name) => N.CLUES[p.id].includes(name)), p.id + " 線索要提到喜歡的東西：" + N.CLUES[p.id]);
    const d = N.journalData(fresh(), T0).find((x) => x.id === p.id);
    assert.equal(d.clue, N.CLUES[p.id], p.id + " 手札資料要有線索");
  }
  const src = fs.readFileSync("src/neighbors-r61.js", "utf8");
  assert.match(src, /線索：\$\{esc\(d\.clue\)\}/, "手札鄰居區塊要把線索寫出來，不再只寫還沒發現");
  assert.doesNotMatch(src, /還沒發現，送過才會知道/, "手札不可再寫還沒發現、送過才知道");
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  assert.match(world, /R64B（第 5 項）：日常對話帶喜好線索/, "日常對話要帶喜好線索");
});

test("2 每人一種不喜歡的禮物：好感加零、東西不收下、台詞委婉、今天還能再送", () => {
  for (const p of N.PEOPLE) {
    const st = fresh();
    const bad = N.DISLIKED[p.id];
    assert.ok(bad && !N.LOVED[p.id].includes(bad), p.id + " 不喜歡的禮物不可與喜歡重複");
    st.storage.items = { [bad]: 1, [N.LOVED[p.id][0]]: 1 };
    const before = N.favorOf(st, p.id);
    const r = N.giveGift(st, p.id, bad, T0);
    assert.equal(r.ok, true, p.id);
    assert.equal(r.disliked, true, p.id);
    assert.equal(r.gained, 0, p.id + " 好感應 +0");
    assert.equal(N.favorOf(st, p.id), before, p.id + " 好感不可變");
    assert.equal(st.storage.items[bad], 1, p.id + " 被婉拒的東西要留在背包");
    assert.equal(r.line, N.DISLIKED_LINES[p.id], p.id + " 要用委婉拒絕台詞");
    assert.equal(N.canGiftToday(st, p.id, T0), true, p.id + " 被婉拒後今天還能再送別的");
    assert.equal(N.journalData(st, T0).find((x) => x.id === p.id).dislikedRevealed, true, p.id + " 送過後手札要記得他不喜歡這個");
    const loved = N.giveGift(st, p.id, N.LOVED[p.id][0], T0);
    assert.equal(loved.loved, true, p.id + " 同日改送喜歡的要成功");
    assert.equal(loved.gained, 2, p.id);
  }
  assert.equal(new Set(Object.values(N.DISLIKED_LINES)).size, 4, "四人拒絕台詞不可重複");
});

test("3 送喜歡的禮物有專屬台詞，愛心跳動接線存在", () => {
  for (const p of N.PEOPLE) {
    const st = fresh();
    st.storage.items = { [N.LOVED[p.id][0]]: 1 };
    const r = N.giveGift(st, p.id, N.LOVED[p.id][0], T0);
    assert.equal(r.loved, true, p.id);
    assert.equal(r.line, N.GIFT_LINES[p.id].loved, p.id + " 要用喜歡的專屬台詞");
  }
  const src = fs.readFileSync("src/neighbors-r61.js", "utf8");
  assert.match(src, /beatHearts\(npcId\)/, "送到喜歡的禮物要讓愛心跳動");
  const css = fs.readFileSync("src/content-r58b.css", "utf8");
  assert.match(css, /R64B/, "CSS 要標 R64B");
  assert.match(css, /@keyframes r64b-heart-beat/, "要有愛心跳動動畫");
  assert.match(css, /\.r64b-heart-beat/, "愛心跳動要有套用 class");
});

test("4 聽完第 2 段故事才有好處，手札寫已獲得，四種好處都真的生效", () => {
  // 手札文字與解鎖時機
  for (const p of N.PEOPLE) {
    const st = fresh();
    let d = N.journalData(st, T0).find((x) => x.id === p.id);
    assert.equal(d.benefit.unlocked, false, p.id + " 未聽故事前不可有好處");
    assert.equal(d.benefit.text, N.BENEFITS[p.id].text);
    const heard = hearStory2(st, p.id);
    assert.ok(heard.benefit && heard.benefit.unlocked, p.id + " 聽完第 2 段要回報好處生效");
    d = N.journalData(st, T0).find((x) => x.id === p.id);
    assert.equal(d.benefit.unlocked, true, p.id + " 手札要顯示已獲得");
  }
  // 蘿拉：市集收購價多 5%
  const sellBase = fresh(); sellBase.storage.items = { strawberry: 10 };
  const baseCoins = G.sellItem(sellBase, "strawberry", 10, T0).coins;
  const sellBoost = fresh(); sellBoost.storage.items = { strawberry: 10 }; hearStory2(sellBoost, "merchant");
  const boostCoins = G.sellItem(sellBoost, "strawberry", 10, T0).coins;
  assert.ok(boostCoins > baseCoins, `蘿拉好處應提高收購價（${baseCoins}→${boostCoins}）`);
  // 班伯：每日做完今日農務多 1 份堆肥
  const dailyRun = (withBenefit) => {
    const st = fresh();
    st.adventure.claimed.c1_first_harvest = true;
    if (withBenefit) hearStory2(st, "elder");
    D.record(st, "water", 3, T0); D.record(st, "talk", 1, T0); D.record(st, "sell", 1, T0);
    const day = D.status(st, T0).day;
    for (const t of D.status(st, T0).tasks.filter((x) => x.available)) D.claim(st, t.id, day, T0);
    return st.materials.compost || 0;
  };
  assert.equal(dailyRun(false), 1, "原本每日完成給 1 份堆肥");
  assert.equal(dailyRun(true), 2, "班伯好處應每日多 1 份堆肥");
  // 圖圖：採集多拿 1 份
  const forageBase = fresh();
  assert.equal(G.gatherForage(forageBase, "farm_berry_patch", T0).added, 1);
  const forageBoost = fresh(); hearStory2(forageBoost, "child");
  assert.equal(G.gatherForage(forageBoost, "farm_berry_patch", T0).added, 2, "圖圖好處應讓採集多 1 份");
  // 葛瑞：開墾少 5 金（原價 25 金，20 金就買得起）
  const landBase = fresh(); landBase.coins = 20;
  assert.equal(G.canBuyUpgrade(landBase, "plotCount"), false, "沒有好處時 20 金買不起 25 金的開墾");
  const landBoost = fresh(); landBoost.coins = 20; hearStory2(landBoost, "mayor");
  assert.equal(G.canBuyUpgrade(landBoost, "plotCount"), true, "葛瑞好處應讓 20 金買得起開墾");
  assert.equal(G.buyUpgrade(landBoost, "plotCount").ok, true);
  assert.equal(landBoost.coins, 0, "開墾應只扣 20 金");
});

test("5 鄰居委託依目前主線排序：接近目前章節的在前，舊章節標可補做排後面", () => {
  const mk = (id, chapter, extra) => Object.assign({ id, chapter, unlocked: true, completed: false, canComplete: false }, extra || {});
  const sorted = N.sortPersonalQuests([
    mk("old_ch1", 1), mk("old_ch2", 2), mk("now_ch4", 4), mk("locked_ch5", 5, { unlocked: false }), mk("done_ch1", 1, { completed: true }),
  ], 4);
  assert.equal(sorted[0].id, "now_ch4", "最接近目前第 4 章的委託要排第一");
  assert.equal(sorted[0].catchUp, false);
  const catchUps = sorted.filter((p) => p.catchUp).map((p) => p.id);
  assert.deepEqual(catchUps.sort(), ["old_ch1", "old_ch2"], "舊章節未完成要標可補做");
  assert.ok(sorted.findIndex((p) => p.id === "old_ch1") > 0, "可補做要排在目前可做的後面");
  assert.equal(sorted[sorted.length - 1].id, "done_ch1", "已完成排最後");
  assert.equal(sorted.find((p) => p.id === "now_ch4").canDoNow, true);
  // 真實委託資料：主線到第 2 章時，第 2 章委託排在第 1 章可補做前面
  const st = fresh();
  st.adventure.claimed.c1_homecoming = true; st.adventure.claimed.c1_first_meal = true;
  const real = N.sortPersonalQuests(A.personalQuests(st, T0), 2);
  const available = real.filter((p) => p.canDoNow);
  assert.ok(available.length >= 4, "第一、二章委託應都已解鎖");
  assert.equal(available[0].chapter, 2, "第 2 章委託要排在第 1 章前面");
  assert.ok(available.filter((p) => p.chapter === 1).every((p) => p.catchUp), "第 1 章未完成要標可補做");
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  assert.match(world, /sortPersonalQuests/, "手札委託清單要用排序結果");
  assert.match(world, /可補做/, "手札委託卡要顯示可補做");
});

test("6 接線：好處接到既有函式、版本不動、CSS 標 R64B", () => {
  const game = fs.readFileSync("src/game.js", "utf8");
  assert.match(game, /R64B：蘿拉第 2 段故事/, "市集價格要接蘿拉好處");
  assert.match(game, /R64B：圖圖第 2 段故事/, "採集要接圖圖好處");
  assert.match(game, /R64B（第 6 項）：鎮長葛瑞第 2 段故事/, "開墾價格要接葛瑞好處");
  const daily = fs.readFileSync("src/daily.js", "utf8");
  assert.match(daily, /R64B（第 6 項）：老農班伯第 2 段故事/, "每日堆肥要接班伯好處");
  const css = fs.readFileSync("src/content-r58b.css", "utf8");
  assert.match(css, /R64B（第 5、6、7 項）/, "新 CSS 要標 R64B");
  const index = fs.readFileSync("index.html", "utf8");
  assert.match(index, /content-r68-20261110-1/, "不可改版本字串");
});

console.log(`VERIFIED content R64 neighbors (${passed}/6)`);
if (process.exitCode) process.exit(1);
