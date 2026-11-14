"use strict";
/* R77C 第 9～12 項：擺攤每張單都答得出來、保留量不被賣掉、逐位客人紀錄、口碑與晚宴連動。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
const A = require("../src/adventure.js");
const S = require("../src/state.js");
const F = require("../src/festival-stall-r72.js");
const M = require("../src/midgame-r66.js");
const T0 = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (e) { console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; } }
function seeded(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function festivalState(level) {
  const st = S.defaultState(T0); A.ensure(st, T0); st.level = level || 8;
  const f = st.adventure.r61.festival;
  f.unlocked = true; f.startsAt = T0; f.endsAt = T0 + 10 * 60 * 1000; f.nextAt = 0;
  f.baseline = { wheat: 0, carrot: 0, tomato: 0, radish: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } };
  f.supportProvisioned = true; f.harvestCrop = "wheat"; f.harvestRequired = 3;
  F.ensure(st, T0);
  return st;
}
/* 照顧客的單找一樣現在遞得出去的：先用擺出的貨，沒有才用代幣。 */
function pickFor(st, s) {
  const d = s.customer.demand;
  const rows = d.kind === "item" ? s.pool.filter((r) => r.id === d.itemId) : s.pool.filter((r) => (d.kind === "pair" ? (d.remaining || d.tastes) : [d.taste]).some((t) => r.tastes.includes(t)));
  return (rows.find((r) => F.stallStockOf(st, s, r) > 0) || rows[0] || {}).id;
}
function playSession(st, s) {
  let now = T0, guard = 0, checked = 0;
  while (s.customer && guard++ < 200) {
    now = Math.max(now, s.customer.readyAt);
    if (now >= s.endsAt) break;
    assert.equal(F.demandAnswerable(st, s.pool, s.customer.demand, s, s.tokensLeft), true, "每一張單都要答得出來：" + JSON.stringify(s.customer.demand) + " 代幣剩 " + s.tokensLeft);
    checked++;
    const id = pickFor(st, s);
    assert.ok(id, "要找得到可遞的品項");
    const r = F.serve(st, s, id, now);
    assert.equal(r.ok, true, "照單遞要成功：" + JSON.stringify(r));
    now += 100;
  }
  return checked;
}

test("9 固定種子 200 場模擬：逐張單檢查手上有貨或還有代幣，兩樣單兩邊分開算", () => {
  let totalChecked = 0, pairs = 0;
  for (let i = 0; i < 200; i++) {
    const st = festivalState(8);
    st.storage.items = { wheat: 30, carrot: 30, tomato: 30, strawberry: 30, corn: 30, radish: 30 };
    const started = F.startSession(st, T0, seeded(77000 + i));
    assert.equal(started.ok, true, "第 " + i + " 場要開得起來");
    const s = started.session;
    const origSpawn = s.customer;
    if (origSpawn && origSpawn.demand.kind === "pair") pairs++;
    totalChecked += playSession(st, s);
    for (const rec of (s.customers || [])) if (rec.want.includes("要一樣")) pairs += 0;
    F.finishSession(st, s, s.endsAt);
  }
  assert.ok(totalChecked >= 1000, "200 場要檢查到夠多張單，實際 " + totalChecked);
  /* 兩樣單的數量檢查：只有一份甜貨、清爽沒貨又沒代幣時，兩樣單不算答得出。 */
  const st = festivalState(8);
  st.storage.items = { strawberry: 1 };
  const pool = F.unlockedItems(st);
  const pair = { kind: "pair", tastes: ["sweet", "fresh"], remaining: ["sweet", "fresh"], label: "要一樣甜的、一樣清爽的" };
  assert.equal(F.demandAnswerable(st, pool, pair, { allotment: { strawberry: 1 } }, 0), false, "兩樣單少一邊就不算答得出");
  assert.equal(F.demandAnswerable(st, pool, pair, { allotment: { strawberry: 1 } }, 1), true, "少的那邊有代幣就答得出");
  assert.equal(F.demandAnswerable(st, pool, pair, null, 0), false, "沒代幣且清爽沒貨時兩樣單不成立（庫存只有草莓）");
  for (let i = 0; i < 200; i++) {
    const c = F.makeCustomer(st, pool, T0 + i * 1000, seeded(77500 + i), { tokensLeft: 0 });
    if (c) assert.equal(F.demandAnswerable(st, pool, c.demand, null, 0), true, "沒代幣時出的單都要有貨可答：" + JSON.stringify(c.demand));
  }
  const empty = festivalState(8); empty.storage.items = {};
  assert.equal(F.makeCustomer(empty, F.unlockedItems(empty), T0, seeded(1), { tokensLeft: 0 }), null, "沒貨也沒代幣就不出單");
});

test("10 保留量：預設留給委託、寫明留給誰，擺攤只賣擺出去的量", () => {
  const st = festivalState(3);
  const mq = M.mayorQuest(st, T0);
  st.storage.items = {}; st.storage.items[mq.cropId] = mq.qty + 2;
  const plan = F.reservePlan(st, T0);
  const row = plan.find((r) => r.id === mq.cropId);
  assert.ok(row, "鎮長每日委託的作物要在清單裡");
  assert.equal(row.reserved, mq.qty, "預設要留委託總共要的量");
  assert.match(row.reserveText, /留 \d+ 份給鎮長每日委託/, "要寫明留給誰：" + row.reserveText);
  assert.equal(row.stallQty, 2, "剩下 2 份可以擺出去");
  const allotment = {}; for (const r of plan) allotment[r.id] = r.stallQty;
  const s = F.startSession(st, T0, seeded(771), { allotment, reservePlan: plan }).session;
  assert.ok(s.allotment, "場次要帶著擺出量");
  playSession(st, s);
  F.finishSession(st, s, s.endsAt);
  assert.ok((st.storage.items[mq.cropId] || 0) >= mq.qty, "擺完以後委託要的量還在，實際 " + (st.storage.items[mq.cropId] || 0) + "/" + mq.qty);
  /* 玩家自己把擺出量改成 0，那一樣就只能用代幣，不會動到庫存。 */
  const st2 = festivalState(3);
  st2.storage.items = { wheat: 4 };
  const refused = F.startSession(st2, T0, seeded(772), { allotment: { wheat: 0 } });
  assert.equal(refused.ok, false); assert.equal(refused.reason, "no_supply", "什麼都沒擺就不能靠未擺的貨開攤");
  assert.equal(st2.storage.items.wheat, 4, "拒絕開攤不能動到庫存");
});

test("11 結算逐位客人：要什麼、給了什麼、得幾分、差在哪，總分對得上", () => {
  const st = festivalState(8);
  st.storage.items = { wheat: 30, carrot: 30, tomato: 30, strawberry: 30, corn: 30, radish: 30 };
  const s = F.startSession(st, T0, seeded(773)).session;
  playSession(st, s);
  /* 再故意遞錯一樣，讓一位客人帶著紀錄離開。 */
  if (s.customer) {
    const wrong = s.pool.find((r) => !F.matchesDemand(s, r.id));
    if (wrong) F.serve(st, s, wrong.id, Math.max(T0, s.customer.readyAt));
  }
  const result = F.finishSession(st, s, s.endsAt);
  assert.ok(Array.isArray(result.customers) && result.customers.length >= 3, "要有逐位客人紀錄");
  const sum = result.customers.reduce((n, r) => n + r.gained, 0);
  assert.equal(sum, result.score, "逐位分數加起來要等於總分");
  assert.equal(result.customers.filter((r) => r.outcome === "答對").length, result.served, "答對人數要對得上");
  for (const rec of result.customers) {
    assert.ok(rec.npcName && rec.want, "每位要記下是誰、要什麼");
    assert.ok(Array.isArray(rec.given), "要記下給了什麼");
    assert.ok(typeof rec.diff === "string", "要記下差在哪");
  }
  assert.ok(result.customers.some((r) => r.outcome !== "答對"), "答錯或時間到的客人也要留紀錄");
  const src = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  assert.match(src, /data-r77c-customers/, "結算畫面要有這一場的客人回顧");
  assert.match(src, /這一場的客人/, "回顧標題要看得懂");
});

test("12 口碑與晚宴：擺攤 2 星以上評比多一行口碑、五分項不變；晚宴提到賣最好的", () => {
  const st = festivalState(8);
  st.storage.items = { wheat: 30, carrot: 30, tomato: 30, strawberry: 30, corn: 30, radish: 30 };
  const s = F.startSession(st, T0, seeded(774)).session;
  playSession(st, s);
  s.score = Math.max(s.score, 150);
  const stallResult = F.finishSession(st, s, s.endsAt);
  assert.ok(stallResult.bestSeller && stallResult.bestSeller.name, "要記下賣得最好的那一樣");
  Object.assign(st.storage.items, { radish: 3, carrot: 3 });
  st.adventure.meals.rustic_bread = 1;
  const judged = A.judgeFestivalEntry(st, ["radish", "carrot", "rustic_bread"], T0 + 1000);
  assert.equal(judged.ok, true, JSON.stringify(judged));
  assert.equal(judged.breakdown.length, 5, "評比還是五個分項");
  assert.equal(judged.maxScore, 5, "總分還是 5 分");
  assert.ok(judged.stallReputation && judged.stallReputation.stars >= 2, "擺攤 2 星以上要有口碑");
  assert.match(judged.stallReputation.text, /攤位口碑/, "口碑那一行要寫明");
  /* 沒擺攤或不到 2 星時不出現口碑。 */
  const plain = festivalState(8);
  Object.assign(plain.storage.items, { radish: 3, carrot: 3 }); plain.adventure.meals.rustic_bread = 1;
  const judged2 = A.judgeFestivalEntry(plain, ["radish", "carrot", "rustic_bread"], T0 + 1000);
  assert.equal(judged2.stallReputation, null, "沒擺攤成績時不要有口碑行");
  /* 晚宴交付：對白提到賣得最好的那一樣。 */
  const dst = festivalState(8);
  dst.storage.items = { wheat: 30, carrot: 30, tomato: 30, strawberry: 30 };
  const ds = F.startSession(dst, T0, seeded(775)).session;
  playSession(dst, ds);
  const dres = F.finishSession(dst, ds, ds.endsAt);
  const sellerName = dres.bestSeller && dres.bestSeller.name;
  assert.ok(sellerName, "晚宴測試要先有賣最好的紀錄");
  for (const q of A.quests(dst, T0)) if (q.id !== "c5_festival_dinner") dst.adventure.claimed[q.id] = true;
  A.ensure(dst, T0);
  dst.adventure.meals.tomato_harvest_stew = 1; dst.adventure.meals.strawberry_market_tart = 1; dst.adventure.meals.carrot_trail_soup = 1;
  for (const id of ["mayor", "elder", "merchant", "child"]) dst.adventure.byTarget.talk[id] = 1;
  const dinner = A.claim(dst, "c5_festival_dinner", T0 + 2000);
  assert.equal(dinner.ok, true, JSON.stringify(dinner));
  assert.ok(dinner.dinnerLine.includes(sellerName), "晚宴對白要提到賣得最好的：" + dinner.dinnerLine);
  const world = fs.readFileSync("src/world-ui.js", "utf8");
  assert.match(world, /data-r77c-stall-reputation/, "評比畫面要顯示口碑那一行");
  assert.match(world, /dinnerLine/, "晚宴交付要把賣最好的一句接上對白");
});

test("9b 擺出的貨和代幣都用完就提早收攤結算，不會卡著等時間到", () => {
  const st = festivalState(8);
  st.storage.items = { wheat: 30, carrot: 30, tomato: 30, strawberry: 30, corn: 30, radish: 30 };
  /* 只擺 2 份小麥，其他都不擺：2 份貨加 3 枚代幣，最多招待 5 位。 */
  const allotment = {}; for (const row of F.unlockedItems(st)) allotment[row.id] = 0; allotment.wheat = 2;
  const s = F.startSession(st, T0, seeded(776), { allotment }).session;
  let now = T0, last = null, guard = 0;
  while (s.customer && guard++ < 50) {
    now = Math.max(now, s.customer.readyAt);
    assert.ok(now < s.endsAt, "應該在時間到以前就收攤");
    last = F.serve(st, s, pickFor(st, s), now);
    assert.equal(last.ok, true, JSON.stringify(last));
    now += 100;
  }
  assert.equal(s.finished, true, "賣完又沒代幣時要直接結算");
  assert.equal(last.soldOut, true, "最後一次遞貨要告知已經收攤");
  assert.ok(last.result && last.result.soldOut === true, "結算要標明是提早收攤");
  assert.match(last.message, /提早收攤/, "要用看得懂的話講原因");
  assert.ok(last.result.customers.length <= 5, "2 份貨加 3 枚代幣最多招待 5 位，實際 " + last.result.customers.length);
  assert.equal(st.storage.items.wheat, 28, "只賣掉擺出去的 2 份小麥");
  for (const id of ["carrot", "tomato", "strawberry", "corn", "radish"]) assert.equal(st.storage.items[id], 30, id + " 沒擺出去就不能少");
  /* 收攤以後再遞、再計時都不可以出錯。 */
  assert.doesNotThrow(() => F.serve(st, s, "wheat", now + 100));
  assert.doesNotThrow(() => F.tickSession(st, s, now + 200));
  /* 什麼都沒擺：不產生未擺品項的代幣題，直接擋下開攤。 */
  const st2 = festivalState(8);
  st2.storage.items = { wheat: 5 };
  const none = {}; for (const row of F.unlockedItems(st2)) none[row.id] = 0;
  const denied = F.startSession(st2, T0, seeded(777), { allotment: none });
  assert.equal(denied.ok, false); assert.equal(denied.reason, "no_supply");
  assert.equal(st2.storage.items.wheat, 5, "沒擺出去的庫存不能動");
  const src = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  assert.match(src, /data-r77c-sold-out/, "結算畫面要寫明提早收攤");
  assert.match(src, /data-r77c-stall-total/, "開攤前要先講一共擺出幾份");
});

console.log("VERIFIED content R77C festival (" + passed + " tests)");
