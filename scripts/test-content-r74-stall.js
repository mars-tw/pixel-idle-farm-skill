"use strict";
/* R74B（第 4～5 項）：擺攤叫賣需求至少 70% 來自有貨物品、分數列顯示代幣數、
   新顧客出現清除上一位回饋並以顧客卡飄字呈現、0 星保底 5 金與鼓勵語氣、
   結算一句建議、無口味物品不顯示非口味標籤、商品卡文字不碎行、
   背包有 4 種貨模擬 3 局至少 2 局 1 星以上。 */
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
  session.customer = { npcId: "mayor", npcName: "鎮長葛瑞", art: "customer-mayor.png", demand: { kind: "item", itemId, label: "我要" + pool.name }, startedAt: now, readyAt: now, expiresAt: now + F.CUSTOMER_TIMEOUT_MS };
  return session.customer;
}
function demandHasStock(st, session, customer) {
  if (!customer || !customer.demand) return false;
  const d = customer.demand;
  if (d.kind === "item") {
    const row = session.pool.find((r) => r.id === d.itemId);
    return !!row && F.stockOf(st, row) > 0;
  }
  return session.pool.some((r) => r.tastes.includes(d.taste) && F.stockOf(st, r) > 0);
}

test("顧客需求至少 70% 來自背包有貨物品（抽 300 位統計）", () => {
  const st = freshFestival(5);
  st.storage.items = { wheat: 50, tomato: 50, strawberry: 50, corn: 50 };
  const started = F.startSession(st, T0, seeded(7401));
  assert.equal(started.ok, true);
  const s = started.session;
  const rng = seeded(7402);
  let stocked = 0; const total = 300;
  for (let i = 0; i < total; i++) {
    const c = F.makeCustomer(st, s.pool, T0 + i * 1000, rng);
    assert.ok(c && c.demand, "要有顧客需求");
    if (demandHasStock(st, s, c)) stocked++;
  }
  assert.ok(stocked / total >= 0.7, "有貨需求比例要至少 70%，實際 " + stocked + "/" + total);
});

test("分數列顯示代幣數：用代幣結算才增加，扣背包不增加", () => {
  const st = freshFestival(3); st.upgrades.plotCount = 1;
  st.storage.items = { wheat: 5 };
  const s = F.startSession(st, T0, seeded(7410)).session;
  assert.equal(s.tokenUses, 0, "開局代幣數要從 0 開始");
  forceItemDemand(s, "wheat", T0);
  let r = F.serve(st, s, "wheat", T0 + 1000);
  assert.equal(r.ok, true); assert.equal(r.usesToken, false);
  assert.equal(s.tokenUses, 0, "扣背包答對不增加代幣數");
  // 小麥用完後再答小麥，逐格改用代幣
  st.storage.items = {};
  forceItemDemand(s, "wheat", T0 + 1000);
  r = F.serve(st, s, "wheat", T0 + 2000);
  assert.equal(r.ok, true); assert.equal(r.usesToken, true);
  assert.equal(s.tokenUses, 1, "用代幣結算要累計代幣數");
  assert.equal(r.tokenUses, 1, "serve 回傳要帶最新代幣數");
  const js = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  const gameSeg = js.slice(js.indexOf("function renderGame"), js.indexOf("function renderResult"));
  assert.match(gameSeg, /data-r74b-tokens/, "分數列要有代幣數欄位");
  assert.match(gameSeg, /代幣/, "分數列要顯示「代幣 N」");
});

test("回饋即時化與清除：答對有加分飄字資料、新顧客出現清除上一位回饋", () => {
  const st = freshFestival(3); st.upgrades.plotCount = 1;
  st.storage.items = { wheat: 20, carrot: 20, tomato: 20 };
  const s = F.startSession(st, T0, seeded(7420)).session;
  forceItemDemand(s, "wheat", T0);
  const r = F.serve(st, s, "wheat", T0 + 1000);
  assert.equal(r.ok, true);
  assert.ok(s.feedback, "答對後要有即時回饋");
  assert.equal(s.feedback.kind, "good");
  assert.equal(s.feedback.gained, r.gained, "飄字要帶加分數字");
  // 下一位顧客逾時離開後，上一位的答對回饋要被清除並換成逾時回饋
  const ticked = F.tickSession(st, s, s.customer.expiresAt);
  assert.equal(ticked.timedOut, true);
  assert.ok(s.feedback && s.feedback.kind !== "good", "新顧客出現後不得還留著上一位答對回饋");
  // 答錯也要有即時回饋，且不是答對樣式
  const readyAt = s.customer.readyAt;
  forceItemDemand(s, "wheat", readyAt);
  const wrongId = s.pool.find((row) => row.id !== "wheat").id;
  const bad = F.serve(st, s, wrongId, readyAt + 10);
  assert.equal(bad.ok, false); assert.equal(bad.reason, "wrong_item");
  assert.ok(s.feedback && s.feedback.kind === "bad", "答錯要有即時回饋（錯誤樣式）");
  const js = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  const gameSeg = js.slice(js.indexOf("function renderGame"), js.indexOf("function renderResult"));
  assert.match(gameSeg, /r74b-float/, "顧客卡要渲染加分飄字");
  assert.doesNotMatch(gameSeg, /lastMessage/, "遊戲畫面不得再把上一位回饋留在回饋列");
  const css = fs.readFileSync("src/content-r58b.css", "utf8");
  const r74b = css.slice(css.indexOf("R74B"));
  assert.match(r74b, /\.r74b-float/, "R74B 樣式要有飄字");
  assert.match(r74b, /@keyframes/, "飄字要有短動畫");
  assert.match(r74b, /prefers-reduced-motion/, "動畫要尊重減少動態偏好");
});

test("0 星保底 5 金：金額、只給一次、鼓勵語氣", () => {
  assert.equal(F.rewardForStars(0).coins, 5, "0 星獎勵定義要有保底 5 金");
  const st = freshFestival(1); st.storage.items = { wheat: 99 }; st.coins = 100;
  const s = F.startSession(st, T0, seeded(7430)).session; s.score = 10;
  const result = F.finishSession(st, s, T0 + 60000);
  assert.equal(result.stars, 0);
  assert.equal(result.granted.coins, 5, "0 星結算要給保底 5 金");
  assert.equal(st.coins, 105, "保底金要真的進錢包");
  assert.match(result.message, /沒關係|很棒|再接再厲|下次/, "0 星結算要用鼓勵語氣：" + result.message);
  assert.doesNotMatch(result.message, /沒有獎勵|所以沒有/, "0 星不得再寫沒有獎勵");
  // 同一場再玩一次仍 0 星，保底不重複給
  const s2 = F.startSession(st, T0, seeded(7431)).session; s2.score = 0;
  const again = F.finishSession(st, s2, T0 + 60000);
  assert.equal(again.granted.coins, 0, "同一場保底只給一次");
  assert.equal(st.coins, 105);
});

test("結算只留一句建議（含 0 星）", () => {
  for (const score of [0, 30, 49, 50, 100, 200]) {
    const advice = F.adviceFor({ score, stars: F.starsForScore(score) });
    assert.equal((advice.match(/。/g) || []).length, 1, "建議只能一句：" + advice);
  }
  const js = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  const resultSeg = js.slice(js.indexOf("function renderResult"));
  assert.equal((resultSeg.match(/data-r73b-advice/g) || []).length, 1, "結算畫面只能有一個建議段落");
});

test("無口味物品不顯示非口味標籤：小麥口味為空、介面不出現生活用品", () => {
  const st = freshFestival(5);
  const wheat = F.unlockedItems(st).find((row) => row.id === "wheat");
  assert.deepEqual(wheat.tasteLabels, [], "小麥不給口味標籤");
  assert.deepEqual(F.itemCard(st, wheat).tasteLabels, []);
  const js = fs.readFileSync("src/festival-stall-r72.js", "utf8");
  assert.doesNotMatch(js, /生活用品/, "介面不得再顯示非口味標籤");
  const gameSeg = js.slice(js.indexOf("function renderGame"), js.indexOf("function renderResult"));
  assert.doesNotMatch(gameSeg, /r73b-taste-none/, "無口味時不得渲染替代標籤");
});

test("商品卡文字不碎行：R74B 樣式釘住不換行與不拆字", () => {
  const css = fs.readFileSync("src/content-r58b.css", "utf8");
  const r74b = css.slice(css.indexOf("R74B"));
  assert.ok(r74b.length > 0, "content-r58b.css 檔尾要有 R74B 段落");
  assert.match(r74b, /word-break:\s*keep-all/, "商品卡文字不得拆字碎行");
  assert.match(r74b, /white-space:\s*nowrap/, "商品卡品名與說明不得碎行");
  let open = 0, close = 0; for (const ch of css) { if (ch === "{") open++; if (ch === "}") close++; }
  assert.equal(open, close, "content-r58b.css 大括號要平衡");
});

test("模擬 3 局：背包有 4 種貨、只答有貨且符合，至少 2 局 1 星以上", () => {
  function playGame(seed) {
    const st = freshFestival(5);
    st.storage.items = { wheat: 999, tomato: 999, strawberry: 999, corn: 999 };
    const started = F.startSession(st, T0, seeded(seed));
    assert.equal(started.ok, true, "模擬局要能開始");
    const s = started.session;
    let now = T0;
    for (let step = 0; step < 300 && !s.finished; step++) {
      if (!s.customer) break;
      if (now < s.customer.readyAt) now = s.customer.readyAt;
      if (now >= s.endsAt) break;
      const d = s.customer.demand;
      let pickId = null;
      if (d.kind === "item") {
        const row = s.pool.find((r) => r.id === d.itemId);
        if (row && F.stockOf(st, row) > 0) pickId = row.id;
      } else {
        const row = s.pool.find((r) => r.tastes.includes(d.taste) && F.stockOf(st, r) > 0);
        if (row) pickId = row.id;
      }
      if (pickId) {
        const r = F.serve(st, s, pickId, now);
        assert.equal(r.ok, true, "只答有貨且符合時要答對");
      } else {
        now = s.customer.expiresAt;
        F.tickSession(st, s, now);
      }
    }
    const result = F.finishSession(st, s, s.endsAt);
    return result;
  }
  const results = [playGame(7441), playGame(7442), playGame(7443)];
  const starred = results.filter((r) => r.stars >= 1).length;
  assert.ok(starred >= 2, "3 局至少 2 局要 1 星以上，實際分數 " + results.map((r) => r.score).join("/") + " 星 " + results.map((r) => r.stars).join("/"));
});

console.log("VERIFIED content R74B stall (" + passed + " tests)");
