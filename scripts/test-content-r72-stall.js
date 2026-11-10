"use strict";
/* R72B：第 5～6 項——收穫祭擺攤叫賣小遊戲。
   計分/連擊/答錯/逾時/星等獎勵/每場兩次取最高/需求只出已解鎖/代幣模式。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const S = require("../src/state.js");
const A = require("../src/adventure.js");
const F = require("../src/festival-stall-r72.js");
const T0 = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (e) { console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; } }
function seeded(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function freshFestival(level) {
  const st = S.defaultState(T0);
  A.ensure(st, T0);
  st.level = level || 1;
  const f = st.adventure.r61.festival;
  f.unlocked = true; f.startsAt = T0; f.endsAt = T0 + 10 * 60 * 1000; f.nextAt = 0;
  f.baseline = { wheat: 0, tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } };
  f.supportProvisioned = true; f.harvestCrop = "wheat"; f.harvestRequired = 3;
  F.ensure(st, T0);
  return st;
}
function forceItemDemand(session, itemId, now) {
  const pool = session.pool.find((row) => row.id === itemId);
  assert.ok(pool, "測試指定的物品要在池裡：" + itemId);
  session.customer = { npcId: "mayor", npcName: "鎮長葛瑞", demand: { kind: "item", itemId, label: "我要" + pool.name }, startedAt: now, expiresAt: now + F.CUSTOMER_TIMEOUT_MS };
  return session.customer;
}
function correctItem(session) {
  const d = session.customer.demand;
  if (d.kind === "item") return d.itemId;
  const row = session.pool.find((item) => item.tastes.includes(d.taste));
  assert.ok(row, "口味需求必須有物品可滿足");
  return row.id;
}

test("常數：60 秒一場、每位顧客 8 秒", () => {
  assert.equal(F.DURATION_MS, 60000);
  assert.equal(F.CUSTOMER_TIMEOUT_MS, 8000);
  assert.equal(F.MAX_ATTEMPTS_PER_ROUND, 2);
});

test("祭典沒開時不能開始，已解鎖物品池只含等級內作物", () => {
  const st = S.defaultState(T0); A.ensure(st, T0);
  const denied = F.startSession(st, T0, seeded(1));
  assert.equal(denied.ok, false, "未解鎖收穫祭不能玩");
  const fest = freshFestival(1);
  const poolIds = F.unlockedItems(fest).map((row) => row.id);
  assert.ok(poolIds.includes("wheat"));
  assert.ok(!poolIds.includes("tomato") && !poolIds.includes("strawberry"), "未解鎖作物不得進池");
});

test("計分：答對 +10、連擊每多一次 +1（封頂 +6），顧客走近一秒內不能遞", () => {
  const st = freshFestival(3); st.upgrades.plotCount = 1;
  st.storage.items = { wheat: 20, carrot: 20, tomato: 20 };
  const started = F.startSession(st, T0, seeded(7));
  assert.equal(started.ok, true); assert.equal(started.session.mode, "stock");
  const s = started.session;
  forceItemDemand(s, "wheat", T0);
  let r = F.serve(st, s, "wheat", T0 + 1000);
  assert.equal(r.ok, true); assert.equal(r.gained, 10); assert.equal(s.score, 10); assert.equal(s.combo, 1);
  forceItemDemand(s, "wheat", T0 + 1000);
  r = F.serve(st, s, "wheat", T0 + 2000);
  assert.equal(r.gained, 11); assert.equal(s.score, 21); assert.equal(s.combo, 2);
  forceItemDemand(s, "wheat", T0 + 2000);
  r = F.serve(st, s, "wheat", T0 + 3000);
  assert.equal(r.gained, 12); assert.equal(s.score, 33); assert.equal(s.bestCombo, 3);
  assert.equal(F.CUSTOMER_ARRIVE_MS, 1000);
  const arriving = F.serve(st, s, correctItem(s), T0 + 3000);
  assert.equal(arriving.ok, false); assert.equal(arriving.reason, "arriving", "下一位走近的一秒內不能連點刷分");
  assert.equal(st.storage.items.wheat, 17, "一般模式答對要消耗 1 份背包");
});

test("答錯：不給分、連擊歸零、顧客離開且不消耗物品", () => {
  const st = freshFestival(3); st.upgrades.plotCount = 1;
  st.storage.items = { wheat: 5, carrot: 5, tomato: 5 };
  const s = F.startSession(st, T0, seeded(3)).session;
  forceItemDemand(s, "wheat", T0);
  F.serve(st, s, "wheat", T0 + 500);
  assert.equal(s.combo, 1);
  forceItemDemand(s, "wheat", T0 + 500);
  const before = st.storage.items.carrot;
  const r = F.serve(st, s, "carrot", T0 + 1000);
  assert.equal(r.ok, false); assert.equal(r.reason, "wrong_item");
  assert.equal(s.combo, 0); assert.equal(s.missed, 1); assert.equal(st.storage.items.carrot, before);
});

test("逾時：顧客離開、連擊歸零、不給分；60 秒到自動結算", () => {
  const st = freshFestival(1); st.storage.items = { wheat: 9 };
  const s = F.startSession(st, T0, seeded(5)).session;
  forceItemDemand(s, "wheat", T0);
  F.serve(st, s, "wheat", T0 + 1000); assert.equal(s.combo, 1);
  forceItemDemand(s, "wheat", T0 + 1000);
  const ticked = F.tickSession(st, s, T0 + 1000 + F.CUSTOMER_TIMEOUT_MS);
  assert.equal(ticked.timedOut, true); assert.equal(s.combo, 0); assert.equal(s.missed, 1); assert.equal(s.score, 10);
  const done = F.tickSession(st, s, T0 + F.DURATION_MS);
  assert.equal(done.finished, true); assert.equal(s.finished, true);
});

test("需求只出已解鎖物品，口味需求一定有物品可滿足", () => {
  const st = freshFestival(1);
  const poolIds = new Set(F.unlockedItems(st).map((row) => row.id));
  const rng = seeded(42);
  for (let i = 0; i < 120; i++) {
    const customer = F.makeCustomer(st, F.unlockedItems(st), T0 + i * 1000, rng);
    assert.ok(customer && customer.demand, "要有顧客");
    if (customer.demand.kind === "item") assert.ok(poolIds.has(customer.demand.itemId), "需求不得出未解鎖物品：" + customer.demand.itemId);
    else assert.ok(F.unlockedItems(st).some((row) => row.tastes.includes(customer.demand.taste)), "口味需求必須可滿足");
    assert.match(customer.demand.label, /我要|想吃/);
  }
});

test("代幣模式：背包全空自動開啟、答對只算分不消耗", () => {
  const st = freshFestival(1);
  assert.deepEqual(st.storage.items, {});
  const s = F.startSession(st, T0, seeded(11)).session;
  assert.equal(s.mode, "token");
  forceItemDemand(s, "wheat", T0);
  const r = F.serve(st, s, "wheat", T0 + 1000);
  assert.equal(r.ok, true); assert.equal(s.score, 10); assert.deepEqual(st.storage.items, {});
});

test("庫存用完自動切代幣模式，不會卡住", () => {
  const st = freshFestival(1); st.storage.items = { wheat: 1 };
  const s = F.startSession(st, T0, seeded(13)).session;
  assert.equal(s.mode, "stock");
  forceItemDemand(s, "wheat", T0);
  F.serve(st, s, "wheat", T0 + 1000);
  assert.equal(st.storage.items.wheat || 0, 0);
  // 下一位顧客在 tick/serve 流程後應已切代幣（makeCustomer 後由 session 同步）
  assert.equal(s.mode, "token", "最後一份用完後要切代幣模式");
  const id = correctItem(s);
  const r = F.serve(st, s, id, T0 + 2000);
  assert.equal(r.ok, true, "代幣模式仍可繼續得分");
});

test("星等門檻與獎勵：邊界分數、三星才有金色攤位旗", () => {
  assert.equal(F.starsForScore(0), 0); assert.equal(F.starsForScore(79), 0);
  assert.equal(F.starsForScore(80), 1); assert.equal(F.starsForScore(179), 1);
  assert.equal(F.starsForScore(180), 2); assert.equal(F.starsForScore(319), 2);
  assert.equal(F.starsForScore(320), 3);
  assert.deepEqual(F.rewardForStars(1), { stars: 1, coins: 12, medals: 0, goldenFlag: false });
  assert.deepEqual(F.rewardForStars(2), { stars: 2, coins: 30, medals: 1, goldenFlag: false });
  assert.deepEqual(F.rewardForStars(3), { stars: 3, coins: 60, medals: 1, goldenFlag: true });
});

test("結算只補到最高星差額：同分重玩不重複給獎、三星給旗", () => {
  const st = freshFestival(1); st.storage.items = { wheat: 99 }; st.coins = 100;
  const s1 = F.startSession(st, T0, seeded(21)).session; s1.score = 90;
  const f1 = F.finishSession(st, s1, T0 + 60000);
  assert.equal(f1.stars, 1); assert.equal(f1.granted.coins, 12); assert.equal(st.coins, 112);
  assert.equal(F.statusFor(st, T0).bestScore, 90);
  const s2 = F.startSession(st, T0, seeded(22)).session; s2.score = 330;
  const medalsBefore = st.adventure.r61.festival.medals;
  const f2 = F.finishSession(st, s2, T0 + 60000);
  assert.equal(f2.stars, 3); assert.equal(f2.granted.coins, 48, "只補 60-12");
  assert.equal(f2.granted.medals, 1); assert.equal(st.adventure.r61.festival.medals, medalsBefore + 1);
  assert.equal(F.statusFor(st, T0).goldenFlag, true, "三星要給限定裝飾金色攤位旗");
});

test("每場兩次：第三次被擋，下一場重新計算", () => {
  const st = freshFestival(1); st.storage.items = { wheat: 99 };
  for (let i = 0; i < 2; i++) {
    const started = F.startSession(st, T0, seeded(30 + i));
    assert.equal(started.ok, true, "第 " + (i + 1) + " 次應可開始");
    F.finishSession(st, started.session, T0 + 60000);
  }
  assert.equal(F.statusFor(st, T0).attemptsLeft, 0);
  assert.equal(F.startSession(st, T0, seeded(99)).ok, false);
  const f = st.adventure.r61.festival;
  f.startsAt = T0 + 30 * 60 * 1000; f.endsAt = f.startsAt + 10 * 60 * 1000;
  assert.equal(F.statusFor(st, f.startsAt).attemptsLeft, 2, "新的一場要重置次數");
  assert.equal(F.startSession(st, f.startsAt, seeded(100)).ok, true);
});

test("接線與美術：新檔、按鈕、快取、樣式與 manifest 都在", () => {
  const index = fs.readFileSync("index.html", "utf8");
  const sw = fs.readFileSync("sw.js", "utf8");
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  const css = fs.readFileSync("src/content-r58b.css", "utf8");
  const js = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  assert.match(index, /festival-stall-r72\.js/);
  assert.match(sw, /festival-stall-r72\.js/);
  assert.match(world, /擺攤叫賣/);
  assert.match(world, /FestivalStallR72/);
  assert.match(css, /R72B/);
  assert.match(js, /擺攤叫賣/);
  let open = 0, close = 0; for (const ch of css) { if (ch === "{") open++; if (ch === "}") close++; }
  assert.equal(open, close, "content-r58b.css 大括號要平衡");
  const manifest = JSON.parse(fs.readFileSync("assets/generated/content-r72/manifest.json", "utf8"));
  assert.match(String(manifest.model || manifest.tool || ""), /muse/i, "manifest 要註明產生模型");
  assert.ok(manifest.files.length >= 6);
  for (const row of manifest.files) assert.ok(fs.existsSync("assets/generated/content-r72/" + row.file), "缺圖：" + row.file);
});

console.log("VERIFIED content R72B stall (" + passed + " tests)");
