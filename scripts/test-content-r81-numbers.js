"use strict";
/* R81A：具名單不低於畫面上的同物一般單；照顧時間用絕對秒數；擺攤第一場一人、耐心至少十五秒，零星有做法與保底。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
const C = require("../src/config.js");
const S = require("../src/state.js");
const A = require("../src/adventure.js");
const G = require("../src/game.js");
const Q = require("../src/choices-r77.js");
const F = require("../src/festival-stall-r72.js");
Q.install();

const T0 = 1794172800000;
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("PASS " + name); }
  catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; }
}
function seeded(seed) {
  let a = seed >>> 0;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function festivalState() {
  const state = S.defaultState(T0); A.ensure(state, T0); state.level = 8; state.upgrades.plotCount = 1;
  const festival = state.adventure.r61.festival;
  Object.assign(festival, { unlocked: true, startsAt: T0, endsAt: T0 + 600000, nextAt: 0, baseline: { wheat: 0, carrot: 0, tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } }, supportProvisioned: true, harvestCrop: "wheat", harvestRequired: 3 });
  state.storage.items = { wheat: 20, carrot: 20, tomato: 20, strawberry: 20 };
  F.ensure(state, T0);
  return state;
}

test("具名第一單以畫面上的 3 份小麥 21 金為底，卡片與入帳同為多兩成（R84B 同步：第一張跟每天那張同為 3 份，原為 2 份 14 金）", () => {
  const state = S.defaultState(T0); A.ensure(state, T0);
  assert.equal(A.resolveMainStoryChoice(state, "mayor", "farm", T0).ok, true);
  assert.equal(Q.act(state, "mayor", T0 + 1).ok, true);
  assert.equal(Q.act(state, "mayor", T0 + 2, "seed").ok, true);
  state.storage.items.wheat = 3;
  const info = Q.specialInfo(state, "mayor", T0 + 3);
  assert.equal(Q.shownGeneralOrder(state, "wheat", 3, T0 + 3), 21);
  assert.equal(info.general, 21);
  assert.equal(info.coins, 26, "21 金多兩成，向上取整後是 26 金");
  assert.match(info.rewardText, /^26 金（比一般訂單多兩成）/);
  assert.match(Q.cardHtml(state, "mayor", T0 + 3), /26 金（比一般訂單多兩成）/);
  const before = state.coins;
  assert.equal(Q.takeSpecial(state, "mayor", T0 + 4).ok, true);
  assert.equal(state.coins - before, 26);
});

test("三種照顧方式共用絕對時間，慢幾秒以勤澆水為基準且不顯示百分比", () => {
  const state = S.defaultState(T0), plot = state.plots[0];
  state.materials.compost = 3;
  Object.assign(plot, { cropId: "wheat", careMode: "water", plantedAt: T0, wateredAt: T0 });
  const forecast = G.careForecast(state, 0, T0 + 1000);
  assert.equal(forecast.rows.length, 3);
  const water = forecast.rows.find((row) => row.id === "water");
  assert.match(water.text, /^勤澆水：約 .+成熟・收 \d+ 份/);
  for (const row of forecast.rows.filter((item) => item.id !== "water")) {
    assert.equal(row.slowerSeconds, row.seconds - water.seconds);
    assert.match(row.text, new RegExp("約 .+（比勤澆水慢 " + row.slowerSeconds + " 秒）"));
  }
  assert.doesNotMatch(forecast.rows.map((row) => row.text).join("｜"), /%|百分/);
  const ui = fs.readFileSync("src/ui.js", "utf8");
  const summary = ui.slice(ui.indexOf("function r78bCareSummary"), ui.indexOf("function r78bBox"));
  assert.doesNotMatch(summary, /%|百分/);
});

test("擺攤第一場同時一位、第二場起兩位，三種客人耐心都至少十五秒", () => {
  const state = festivalState();
  const first = F.startSession(state, T0, seeded(8101));
  assert.equal(first.ok, true); assert.equal(first.session.queueSize, 1); assert.equal(F.queueCustomers(first.session).length, 1);
  assert.ok(F.CUSTOMER_TYPES.every((row) => row.timeoutMs >= 15000));
  F.finishSession(state, first.session, T0 + 1);
  const second = F.startSession(state, T0 + 2, seeded(8102));
  assert.equal(second.ok, true); assert.equal(second.session.queueSize, 2); assert.equal(F.queueCustomers(second.session).length, 2);
  assert.deepEqual(F.STAR_THRESHOLDS, [{ stars: 1, score: 50 }, { stars: 2, score: 120 }, { stars: 3, score: 200 }]);
});

test("商品卡常態只顯示圖示、品名、剩量、熱門（R82C 同步：加回品名），缺貨才補口味與替代說明；零星寫做法與 5 金保底", () => {
  const source = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  const game = source.slice(source.indexOf("function renderGame"), source.indexOf("function renderResult"));
  assert.match(game, /const hot = !!marketItem/);
  assert.match(game, /const showShortageHelp = cardState !== "stock" \|\| isSubstitute/);
  assert.match(game, /showShortageHelp && card\.tasteLabels\.length/);
  assert.doesNotMatch(game, /<b>\$\{esc\(row\.name\)\}<\/b>/);
  const state = festivalState(), session = F.startSession(state, T0, seeded(8103)).session;
  const result = F.finishSession(state, session, T0 + 1);
  assert.equal(result.stars, 0); assert.equal(result.granted.coins, 5);
  assert.match(result.advice, /下次先看清一位客人的需求/);
  assert.match(result.advice, /保底 5 金已入帳/);
  assert.deepEqual(F.rewardForStars(0), { stars: 0, coins: 5, medals: 0, goldenFlag: false });
});

if (!process.exitCode) console.log("VERIFIED content R81A numbers (" + passed + " tests)");
