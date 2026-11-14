"use strict";
/* R78A：擺攤供需、熱門客群、計分、結算與舊獎勵紀錄。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const S = require("../src/state.js");
const A = require("../src/adventure.js");
const F = require("../src/festival-stall-r72.js");

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
function festivalState(level) {
  const state = S.defaultState(T0);
  A.ensure(state, T0);
  state.level = level || 8;
  state.upgrades.plotCount = Math.max(1, state.upgrades.plotCount || 0);
  const festival = state.adventure.r61.festival;
  festival.unlocked = true; festival.startsAt = T0; festival.endsAt = T0 + 10 * 60 * 1000; festival.nextAt = 0;
  festival.baseline = { wheat: 0, carrot: 0, tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } };
  festival.supportProvisioned = true; festival.harvestCrop = "wheat"; festival.harvestRequired = 3;
  F.ensure(state, T0);
  return state;
}
function reviewAllotment() { return { wheat: 11, carrot: 12, tomato: 12, strawberry: 12 }; }
function matchingRow(state, session) {
  const demand = session.customer && session.customer.demand;
  if (!demand) return null;
  const offered = session.pool.filter((row) => !session.offeredIds || session.offeredIds.includes(row.id));
  if (demand.kind === "item") return offered.find((row) => row.id === demand.itemId) || null;
  const tastes = demand.kind === "pair" ? (demand.remaining || demand.tastes || []) : [demand.taste];
  return offered.find((row) => tastes.some((taste) => row.tastes.includes(taste)) && F.stallStockOf(state, session, row) > 0)
    || offered.find((row) => tastes.some((taste) => row.tastes.includes(taste))) || null;
}
function playPerfect(state, session, maxCustomers) {
  let now = session.startedAt, guard = 0;
  while (!session.finished && session.customer && session.served < (maxCustomers || 999) && guard++ < 500) {
    now = Math.max(now, session.customer.readyAt);
    if (now >= session.endsAt) break;
    const row = matchingRow(state, session);
    assert.ok(row, "每一題都要能從本場擺出的貨回答：" + JSON.stringify(session.customer.demand));
    const served = F.serve(state, session, row.id, now);
    assert.equal(served.ok, true, JSON.stringify(served));
    if (!served.partial) now += 100;
  }
  return F.finishSession(state, session, session.endsAt);
}

test("評審配貨模擬 200 場：只點擺出的四樣，每場最多一題缺貨題", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const state = festivalState(8);
    state.storage.items = reviewAllotment();
    const started = F.startSession(state, T0, seeded(seed), { allotment: reviewAllotment() });
    assert.equal(started.ok, true, "seed " + seed);
    const session = started.session;
    assert.deepEqual([...session.offeredIds].sort(), ["carrot", "strawberry", "tomato", "wheat"]);
    const result = playPerfect(state, session);
    assert.ok(session.stockoutQuestions <= 1, "seed " + seed + " 缺貨題 " + session.stockoutQuestions);
    assert.ok(result.served >= 10, "47 份貨至少接 10 位，seed " + seed + " 實際 " + result.served);
    assert.ok(!result.soldOut || result.endedAt - result.startedAt >= 20000, "不能在 20 秒內因缺貨收攤");
    assert.ok(result.stars >= 2, "評審配貨全答對至少兩星，seed " + seed + " 得分 " + result.score);
    assert.equal(result.customerTotal, result.served + result.wrong + result.timedOut + result.notReached);
    for (const rec of result.customers) {
      for (const given of rec.given) assert.ok(session.offeredIds.includes(given.id), "不能遞沒擺的 " + given.id);
    }
  }
});

test("熱門與客群可固定種子重現：至少三項熱門、三種客人、每位最多兩個標籤", () => {
  const state = festivalState(8);
  state.storage.items = reviewAllotment();
  const pool = F.unlockedItems(state).filter((row) => Object.hasOwn(reviewAllotment(), row.id));
  const first = F.marketPreview(state, pool, seeded(7801));
  const again = F.marketPreview(state, pool, seeded(7801));
  assert.deepEqual(first, again, "同一種子要得到同一份熱門表");
  assert.ok(first.hotItems.length >= 3, "配貨前至少看得到三項熱門");
  const session = F.startSession(state, T0, seeded(7802), { allotment: reviewAllotment(), market: first }).session;
  const types = new Set(), hot = { yes: 0, no: 0 };
  for (let i = 0; i < 240; i++) {
    const customer = F.makeCustomer(state, session.pool, T0, seeded(9000 + i), { session, tokensLeft: session.tokensLeft });
    assert.ok(customer, "貨還夠時要能出題");
    types.add(customer.typeId);
    assert.ok(customer.tags.length >= 1 && customer.tags.length <= 2, "需求標籤最多兩個");
    hot[customer.demand.hot ? "yes" : "no"]++;
  }
  assert.deepEqual([...types].sort(), ["regular", "rush", "taste"]);
  assert.ok(hot.yes > hot.no, "熱門需求要比非熱門需求常出現：" + JSON.stringify(hot));

  const hotState = festivalState(8); hotState.storage.items = { wheat: 3, tomato: 3 };
  const hotSession = F.startSession(hotState, T0, seeded(7803), { market: { hotItems: [{ id: "wheat", name: "小麥", rank: 1, scoreBonus: 4 }] } }).session;
  hotSession.customer = { npcId: "mayor", npcName: "鎮長葛瑞", tags: ["老主顧", "熱門加 4 分"], demand: { kind: "item", itemId: "wheat", label: "我要小麥", hot: true }, readyAt: T0, expiresAt: T0 + 8000 };
  const hotScore = F.serve(hotState, hotSession, "wheat", T0).gained;
  const coldState = festivalState(8); coldState.storage.items = { wheat: 3, tomato: 3 };
  const coldSession = F.startSession(coldState, T0, seeded(7804), { market: { hotItems: [{ id: "wheat", name: "小麥", rank: 1, scoreBonus: 4 }] } }).session;
  coldSession.customer = { npcId: "mayor", npcName: "鎮長葛瑞", tags: ["老主顧"], demand: { kind: "item", itemId: "tomato", label: "我要番茄", hot: false }, readyAt: T0, expiresAt: T0 + 8000 };
  const coldScore = F.serve(coldState, coldSession, "tomato", T0).gained;
  assert.equal(hotScore, coldScore + F.HOT_SCORE_BONUS, "熱門品項答對要多拿分");
});

test("專攻熱門與多樣少量都能拿星；三星必須同時有長連擊與熱門成交", () => {
  function run(strategy, seed) {
    const state = festivalState(8);
    state.storage.items = { wheat: 20, carrot: 20, tomato: 20, strawberry: 20 };
    const pool = F.unlockedItems(state).filter((row) => ["wheat", "carrot", "tomato", "strawberry"].includes(row.id));
    const market = F.marketPreview(state, pool, seeded(7810));
    const allotment = strategy === "hot"
      ? Object.fromEntries(pool.map((row) => [row.id, market.hotItems.some((hot) => hot.id === row.id) ? 6 : 0]))
      : { wheat: 4, carrot: 4, tomato: 4, strawberry: 4 };
    const session = F.startSession(state, T0, seeded(seed), { allotment, market }).session;
    return playPerfect(state, session, 10);
  }
  const focused = run("hot", 7811), diverse = run("diverse", 7812);
  assert.ok(focused.stars >= 1, "專攻熱門要能拿星：" + focused.score);
  assert.ok(diverse.stars >= 1, "多樣少量要能拿星：" + diverse.score);

  const short = festivalState(8); short.storage.items = { wheat: 3 };
  const shortSession = F.startSession(short, T0, seeded(7815)).session;
  shortSession.score = 22; shortSession.served = 3; shortSession.wrong = 0; shortSession.timeouts = 0;
  assert.ok(F.finishSession(short, shortSession, shortSession.endsAt).stars >= 1, "答對 3 位且沒有答錯或錯過也要有一顆星");

  const low = festivalState(8); low.storage.items = { wheat: 50 };
  const lowSession = F.startSession(low, T0, seeded(7813)).session;
  lowSession.score = 999; lowSession.bestCombo = 2; lowSession.hotServed = 0; lowSession.served = 2;
  assert.ok(F.finishSession(low, lowSession, lowSession.endsAt).stars <= 2, "只有高分、沒有連擊與熱門成交不能三星");
  const high = festivalState(8); high.storage.items = { wheat: 50, carrot: 50, tomato: 50 };
  const highSession = F.startSession(high, T0, seeded(7814)).session;
  highSession.score = 999; highSession.bestCombo = 10; highSession.hotServed = 3; highSession.served = 10;
  assert.equal(F.finishSession(high, highSession, highSession.endsAt).stars, 3);
});

test("配貨預設永遠等於背包減保留，玩家尚未調整不會多一份", () => {
  const state = festivalState(8);
  state.storage.items = { wheat: 12, carrot: 12, tomato: 12, strawberry: 12 };
  const plan = F.reservePlan(state, T0);
  assert.ok(plan.length >= 4);
  for (const row of plan) assert.equal(row.stallQty, row.stock - row.reserved, row.id + " 的預設擺出量");
  const exact = { id: "wheat", stock: 12, reserved: 2, stallQty: 10 };
  assert.equal(F.defaultStallQty(exact), 10, "背包 12 份、留 2 份就是擺 10 份");
});

test("結算原因與人數逐項對帳；舊 rewardedStars 與 floorGranted 不重複領也不倒扣", () => {
  const state = festivalState(8); state.storage.items = { wheat: 30, carrot: 30, tomato: 30 };
  const session = F.startSession(state, T0, seeded(7820)).session;
  playPerfect(state, session, 3);
  const result = session.result;
  assert.match(result.endReasonText, /時間到|貨賣完|代幣用完/);
  assert.equal(result.customerTotal, result.customers.length);
  assert.equal(result.customerTotal, result.served + result.wrong + result.timedOut + result.notReached);

  const old = festivalState(8); old.storage.items = { wheat: 99 };
  const key = String(T0), record = old.adventure.r72b.rounds[key] = { attemptsUsed: 0, bestScore: 150, bestStars: 2, rewardedStars: 2, floorGranted: true };
  const beforeCoins = old.coins;
  const oldSession = F.startSession(old, T0, seeded(7821)).session;
  oldSession.score = 1; oldSession.served = 1;
  const oldResult = F.finishSession(old, oldSession, oldSession.endsAt);
  assert.equal(record.rewardedStars, 2); assert.equal(oldResult.granted.coins, 0); assert.equal(old.coins, beforeCoins);
});

test("R78A 接線：新門檻、三種卡片狀態、熱門與結束原因都有畫面掛點", () => {
  assert.deepEqual(F.STAR_THRESHOLDS, [{ stars: 1, score: 50 }, { stars: 2, score: 120 }, { stars: 3, score: 200 }]);
  const source = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  for (const hook of ["data-r78a-market", "data-r78a-customer-tags", "data-r78a-card-state", "data-r78a-end-reason", "data-r78a-counts"]) assert.match(source, new RegExp(hook));
  const css = fs.readFileSync("src/content-r58b.css", "utf8");
  const start = css.indexOf("R78A（擺攤叫賣）開始"), end = css.indexOf("R78A 結束");
  assert.ok(start >= 0 && end > start, "R78A 樣式只能寫在指定區段");
  assert.match(css.slice(start, end), /data-r78a-card-state="stock"/);
  assert.match(css.slice(start, end), /data-r78a-card-state="token"/);
  assert.match(css.slice(start, end), /data-r78a-card-state="soldout"/);
  assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length, "CSS 大括號平衡");
});

console.log("VERIFIED content R78A stall (" + passed + " tests)");
