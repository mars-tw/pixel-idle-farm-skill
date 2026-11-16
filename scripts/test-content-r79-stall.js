"use strict";
/* R79A：兩位客人、耐心取捨、替代品、十四位客流、星等模擬與火候三態。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const S = require("../src/state.js");
const A = require("../src/adventure.js");
const F = require("../src/festival-stall-r72.js");
const Cooking = require("../src/cooking-r75.js");

const T0 = 1794172800000;
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("PASS " + name); }
  catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; }
}
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function festivalState(items) {
  const state = S.defaultState(T0);
  A.ensure(state, T0); state.level = 8; state.upgrades.plotCount = 1;
  const festival = state.adventure.r61.festival;
  festival.unlocked = true; festival.startsAt = T0; festival.endsAt = T0 + 10 * 60 * 1000; festival.nextAt = 0;
  festival.baseline = { wheat: 0, carrot: 0, tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } };
  festival.supportProvisioned = true; festival.harvestCrop = "wheat"; festival.harvestRequired = 3;
  state.storage.items = Object.assign({}, items);
  F.ensure(state, T0);
  state.adventure.r72b.totalPlays = 1;
  return state;
}
function rowFor(state, session, customer) {
  const demand = customer.demand;
  const rows = session.pool.filter((row) => session.offeredIds.includes(row.id));
  if (demand.kind === "item") {
    const exact = rows.find((row) => row.id === demand.itemId && F.stallStockOf(state, session, row) > 0);
    return exact || rows.find((row) => F.substituteMatch(state, session, row.id, customer)) || rows.find((row) => row.id === demand.itemId);
  }
  const tastes = demand.kind === "pair" ? (demand.remaining || demand.tastes) : [demand.taste];
  return rows.find((row) => tastes.some((taste) => row.tastes.includes(taste)) && F.stallStockOf(state, session, row) > 0)
    || rows.find((row) => tastes.some((taste) => row.tastes.includes(taste)));
}
function perfectRun(seed) {
  const allotment = { wheat: 11, carrot: 12, tomato: 12, strawberry: 12 };
  const state = festivalState(allotment);
  const session = F.startSession(state, T0, seeded(seed), { allotment }).session;
  let now = T0; let guard = 0;
  while (!session.finished && session.customer && guard++ < 100) {
    const customer = session.customer;
    now = Math.max(now, customer.readyAt);
    const row = rowFor(state, session, customer);
    assert.ok(row, "每位客人都要有答案：" + JSON.stringify(customer.demand));
    const result = F.serve(state, session, row.id, now);
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.partial) now += 100;
  }
  return session.result || F.finishSession(state, session, now);
}

test("同時兩位客人排隊，各有獨立耐心，玩家可先選人再選貨", () => {
  const state = festivalState({ wheat: 20, carrot: 20, tomato: 20, strawberry: 20 });
  const session = F.startSession(state, T0, seeded(7901)).session;
  assert.equal(F.queueCustomers(session).length, 2);
  assert.notEqual(F.queueCustomers(session)[0].queueId, F.queueCustomers(session)[1].queueId);
  assert.ok(F.queueCustomers(session).every((customer) => customer.expiresAt > customer.readyAt));
  const second = F.queueCustomers(session)[1];
  assert.equal(F.selectCustomer(session, second.queueId).ok, true);
  assert.equal(session.customer, second);
});

test("先救快沒耐心的客人，和先拿熱門高分，會得到不同結果", () => {
  function scenario(urgentFirst) {
    const state = festivalState({ wheat: 10, carrot: 10, tomato: 10, strawberry: 10 });
    const session = F.startSession(state, T0, seeded(7902), { market: { hotItems: [{ id: "carrot", name: "胡蘿蔔", rank: 1, scoreBonus: 4 }] } }).session;
    const [urgent, high] = F.queueCustomers(session);
    Object.assign(urgent, { readyAt: T0, expiresAt: T0 + 1500, patienceMs: 1500, demand: { kind: "item", itemId: "wheat", label: "我要小麥", hot: false } });
    Object.assign(high, { readyAt: T0, expiresAt: T0 + 8000, patienceMs: 8000, demand: { kind: "item", itemId: "carrot", label: "我要胡蘿蔔", hot: true } });
    urgent._record.want = urgent.demand.label; high._record.want = high.demand.label;
    F.selectCustomer(session, urgentFirst ? urgent.queueId : high.queueId);
    F.serve(state, session, urgentFirst ? "wheat" : "carrot", T0 + 1000);
    if (urgentFirst) { F.selectCustomer(session, high.queueId); F.serve(state, session, "carrot", T0 + 2000); }
    else F.tickSession(state, session, T0 + 1600);
    return { score: session.score, served: session.served, timeouts: session.timeouts };
  }
  const patient = scenario(true), greedy = scenario(false);
  assert.deepEqual(patient, { score: 25, served: 2, timeouts: 0 });
  assert.deepEqual(greedy, { score: 14, served: 1, timeouts: 1 });
});

test("指定品賣完時可推同口味現貨，拿七成分且不花代幣", () => {
  const state = festivalState({ carrot: 1, strawberry: 3 });
  const session = F.startSession(state, T0, seeded(7903), { allotment: { carrot: 1, strawberry: 3 }, market: { hotItems: [] } }).session;
  const [first, second] = F.queueCustomers(session);
  for (const customer of [first, second]) {
    Object.assign(customer, { readyAt: T0, expiresAt: T0 + 8000, demand: { kind: "item", itemId: "carrot", label: "我要胡蘿蔔", hot: false } });
    customer._record.want = customer.demand.label;
  }
  F.selectCustomer(session, first.queueId);
  assert.equal(F.serve(state, session, "carrot", T0).ok, true);
  F.selectCustomer(session, second.queueId);
  assert.equal(F.substituteMatch(state, session, "strawberry", second), true);
  const tokens = session.tokensLeft;
  const result = F.serve(state, session, "strawberry", T0 + 100);
  assert.equal(result.ok, true); assert.equal(result.substitute, true); assert.equal(result.usesToken, false);
  assert.equal(result.gained, Math.floor(11 * F.SUBSTITUTE_SCORE_RATE));
  assert.equal(session.tokensLeft, tokens);
  assert.match(second._record.diff, /七成分/);
});

test("固定亂數 200 場：貨夠都能接滿十四位，全對至少兩星，半數以上三星", () => {
  let threeStars = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const result = perfectRun(seed);
    assert.ok(result.served >= 10, "seed " + seed + " 只接到 " + result.served + " 位");
    assert.equal(result.customerTotal, F.CUSTOMER_LIMIT);
    assert.ok(result.stars >= 2, "seed " + seed + " 只有 " + result.stars + " 星");
    assert.ok(result.score <= result.maxPossibleScore);
    if (result.stars === 3) threeStars++;
  }
  assert.ok(threeStars >= 100, "200 場全對只有 " + threeStars + " 場三星");
});

test("結算有最高分與逐客七欄，保底星規則仍保留原門檻", () => {
  const result = perfectRun(7904);
  assert.ok(result.maxPossibleScore >= 200);
  assert.deepEqual(F.STAR_THRESHOLDS, [{ stars: 1, score: 50 }, { stars: 2, score: 120 }, { stars: 3, score: 200 }]);
  assert.match(F.starThresholdText(), /沒有答錯、也沒有錯過客人/);
  const source = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  for (const text of ["這一場最多可以拿", "需求：", "交付：", "基本 ", "熱門加分", "連續答對加分", "代幣少", "合計 "]) assert.match(source, new RegExp(text));
});

test("R79 整合：同時在攤前的客人不會是同一個人；提早結束的句子寫這一場實際的人數", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const state = festivalState({ wheat: 20, carrot: 20, tomato: 20, strawberry: 20 });
    const started = F.startSession(state, T0, seeded(seed));
    assert.equal(started.ok, true);
    const order = [...started.session.queue, ...started.session.customerPlan].map((row) => row.npcId);
    // 玩家可以先招呼後面那位，所以第 i 位會跟第 i-1、i-2 位同時在攤前
    for (let i = 1; i < order.length; i++) {
      assert.notEqual(order[i], order[i - 1], "seed " + seed + " 第 " + (i + 1) + " 位跟前一位同一人");
      if (i >= 2) assert.notEqual(order[i], order[i - 2], "seed " + seed + " 第 " + (i + 1) + " 位跟前兩位同一人");
    }
  }
  const small = festivalState({ wheat: 3 });
  const session = F.startSession(small, T0, seeded(11)).session;
  assert.ok(session.plannedCustomers < F.CUSTOMER_LIMIT, "貨少時排定的客人要少於上限");
  const source = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  assert.doesNotMatch(source, /十四位客人/, "提早結束不得寫死十四位");
});

test("看火候有低、剛好、焦三態，並接好三張新圖與文字後備", () => {
  assert.equal(Cooking.potStateFor({ heat: 20, goldMin: 30, goldMax: 50 }).id, "low");
  assert.equal(Cooking.potStateFor({ heat: 40, goldMin: 30, goldMax: 50 }).id, "good");
  assert.equal(Cooking.potStateFor({ heat: 70, goldMin: 30, goldMax: 50 }).id, "burn");
  assert.deepEqual(Object.values(Cooking.POT_ART).map((row) => row.file), ["assets/generated/content-r79/pot-low.png", "assets/generated/content-r79/pot-good.png", "assets/generated/content-r79/pot-burn.png"]);
  const source = fs.readFileSync("src/cooking-r75.js", "utf8"), css = fs.readFileSync("src/content-r58b.css", "utf8");
  assert.match(source, /data-r79a-fire-segment/); assert.match(source, /data-r79a-pot-fallback/);
  assert.match(css, /R79A：看火候三態/); assert.match(css, /grid-template-columns: repeat\(10/);
});

console.log("VERIFIED content R79A stall and cooking (" + passed + " tests)");
