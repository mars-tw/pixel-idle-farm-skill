"use strict";
/* R76B 第 11～13 項：評比五分項、擺攤口味比例與兩樣單、代幣代價、結算失分、任務卡去重。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
const A = require("../src/adventure.js");
const S = require("../src/state.js");
const F = require("../src/festival-stall-r72.js");
const R = require("../src/story-r76.js");
const T0 = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (e) { console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; } }
function seeded(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function festivalState() {
  const st = S.defaultState(T0); A.ensure(st, T0); st.level = 3;
  const f = st.adventure.r61.festival;
  f.unlocked = true; f.startsAt = T0; f.endsAt = T0 + 10 * 60 * 1000; f.nextAt = 0;
  f.baseline = { wheat: 0, carrot: 0, tomato: 0, radish: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } };
  f.supportProvisioned = true; f.harvestCrop = "wheat"; f.harvestRequired = 3;
  return st;
}
function freshFestival(level) { const st = festivalState(); st.level = level || 3; F.ensure(st, T0); return st; }
function forceDemand(session, demand, now) { session.customer = { npcId: "mayor", npcName: "鎮長葛瑞", demand, startedAt: now, readyAt: now, expiresAt: now + F.CUSTOMER_TIMEOUT_MS }; }

test("1 評比五分項逐項列出、總分 N／5、三星門檻四分並點名缺項", () => {
  const st = festivalState();
  Object.assign(st.storage.items, { radish: 1, carrot: 1 });
  st.adventure.meals.rustic_bread = 1;
  const r = A.judgeFestivalEntry(st, ["radish", "carrot", "rustic_bread"], T0 + 1);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.breakdown.length, 5);
  assert.deepEqual(r.breakdown.map((row) => row.label), ["種類不同", "當季作物", "有料理", "優質作物", "日曬乾貨"]);
  assert.equal(r.totalScore, r.breakdown.filter((row) => row.got).length);
  assert.equal(r.maxScore, 5);
  const b = R.festivalBreakdown(r);
  assert.equal(b.total, r.totalScore); assert.equal(b.max, 5);
  assert.match(b.thresholdText, /三星要 4 分/);
  const two = festivalState(); Object.assign(two.storage.items, { wheat: 1, carrot: 1, tomato: 1 });
  const r2 = A.judgeFestivalEntry(two, ["wheat", "carrot", "tomato"], T0 + 1);
  assert.equal(r2.ok, true, JSON.stringify(r2));
  if (r2.totalScore < 4) assert.match(r2.tip, /三星要四項.*下次先補/);
  assert.ok(r2.breakdown.some((row) => !row.got), "要有留空的分項");
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  assert.match(world, /data-r76b-judge-breakdown/);
  assert.match(world, /總分 .*／/);
});

test("2 只說口味的顧客六成以上，且會出現一次要兩樣的顧客", () => {
  const st = freshFestival(8);
  st.storage.items = { strawberry: 9, tomato: 9, carrot: 9 };
  const pool = F.unlockedItems(st);
  const rng = seeded(1234);
  let tasteOrPair = 0; let pair = 0; const total = 300;
  for (let i = 0; i < total; i++) {
    const c = F.makeCustomer(st, pool, T0 + i * 1000, rng);
    if (c.demand.kind === "taste" || c.demand.kind === "pair") tasteOrPair++;
    if (c.demand.kind === "pair") { pair++; assert.equal(c.demand.tastes.length, 2); assert.notEqual(c.demand.tastes[0], c.demand.tastes[1]); }
  }
  assert.ok(tasteOrPair / total >= 0.6, "口味或兩樣單比例要六成以上，實際 " + tasteOrPair + "/" + total);
  assert.ok(pair > 0, "要有兩樣單顧客");
});

test("3 兩樣單：對一樣給一半、兩樣都對才算答對一位", () => {
  const st = freshFestival(8);
  st.storage.items = { strawberry: 5, radish: 5, carrot: 5, tomato: 5 };
  const s = F.startSession(st, T0, seeded(7)).session;
  const sweetRow = s.pool.find((row) => row.tastes.includes("sweet") && F.stockOf(st, row) > 0);
  const freshRow = s.pool.find((row) => row.tastes.includes("fresh") && row.id !== sweetRow.id && F.stockOf(st, row) > 0) || s.pool.find((row) => row.tastes.includes("fresh") && F.stockOf(st, row) > 0);
  assert.ok(sweetRow && freshRow, "測試池要有甜與清爽物品");
  forceDemand(s, { kind: "pair", tastes: ["sweet", "fresh"], remaining: ["sweet", "fresh"], label: "要一樣甜的、一樣清爽的" }, T0);
  const first = F.serve(st, s, sweetRow.id, T0 + 1000);
  assert.equal(first.ok, true); assert.equal(first.partial, true);
  assert.equal(first.gained, 5, "對一樣先拿一半（10 的一半）");
  assert.equal(s.served, 0, "只對一樣還不算答對一位");
  assert.equal(s.customer.demand.remaining.length, 1);
  const second = F.serve(st, s, freshRow.id, T0 + 2000);
  assert.equal(second.ok, true); assert.equal(second.partial, false);
  assert.equal(s.served, 1, "兩樣都對才算一位");
  assert.equal(s.score, 10, "兩半合起來是完整一位的分數");
});

test("4 代幣每場 3 枚、用完遞不出沒貨的東西、用代幣答對只拿一半分，三處文字一致", () => {
  assert.equal(F.TOKENS_PER_SESSION, 3);
  assert.match(F.TOKEN_RULE_TEXT, /3 枚/);
  assert.match(F.TOKEN_RULE_TEXT, /一半分/);
  const src = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  assert.match(src, /TOKEN_RULE_TEXT/, "開場說明要用同一份代幣規則");
  assert.match(src, /只拿一半分/, "按鈕小字要寫只拿一半分");
  assert.match(src, /data-r76b-loss/, "結算要寫代幣與失分");
  const st = freshFestival(1);
  const s = F.startSession(st, T0, seeded(11)).session;
  assert.equal(s.tokensLeft, 3);
  forceDemand(s, { kind: "item", itemId: "wheat", label: "我要小麥" }, T0);
  const r = F.serve(st, s, "wheat", T0 + 1000);
  assert.equal(r.gained, 5, "用代幣答對 10 分只拿一半");
  assert.equal(s.tokensLeft, 2); assert.equal(s.tokenUses, 1);
  s.tokensLeft = 0;
  forceDemand(s, { kind: "item", itemId: "wheat", label: "我要小麥" }, T0 + 2000);
  const blocked = F.serve(st, s, "wheat", T0 + 3000);
  assert.equal(blocked.ok, false); assert.equal(blocked.reason, "token_empty");
});

test("5 結算有主要失分與代幣次數", () => {
  const st = freshFestival(3);
  st.storage.items = { wheat: 5, carrot: 5, tomato: 5 };
  const s = F.startSession(st, T0, seeded(3)).session;
  forceDemand(s, { kind: "taste", taste: "sweet", label: "想吃甜的" }, T0);
  F.serve(st, s, "wheat", T0 + 1000);
  forceDemand(s, { kind: "taste", taste: "sweet", label: "想吃甜的" }, T0 + 2000);
  F.serve(st, s, "wheat", T0 + 3000);
  const result = F.finishSession(st, s, T0 + 60000);
  assert.match(result.mainLoss, /^主要失分：/);
  assert.match(result.mainLoss, /口味猜錯 2 次/);
  assert.equal(typeof result.tokenUses, "number");
  assert.equal(result.loss.counts.tasteWrong, 2);
});

test("6 任務卡不重複：主線列與需求列同一件事只留一列", () => {
  assert.equal(R.isDuplicateQuestRow("番茄 0/3", [{ name: "番茄", text: "番茄 0/3（與祭典共用）" }]), true);
  assert.equal(R.isDuplicateQuestRow("去找班伯說話", [{ name: "番茄", text: "番茄 0/3" }]), false);
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  assert.match(world, /mainRowDuplicate/, "任務卡要用去重判斷");
  assert.match(world, /isDuplicateQuestRow/);
  const css = fs.readFileSync("src/content-r58b.css", "utf8");
  assert.match(css, /R76B/);
  assert.match(css, /r69a-collapsed-summary \{ white-space: normal/, "收合時不可用省略號截斷");
});

console.log("VERIFIED content R76B festival (" + passed + " tests)");
