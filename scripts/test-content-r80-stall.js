"use strict";
/* R80A：攤前兩人差異、熱門上限、失分對帳、結算三行、設施雙路線與兩處文案。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const S = require("../src/state.js");
const A = require("../src/adventure.js");
const G = require("../src/game.js");
const M = require("../src/midgame-r66.js");
const F = require("../src/festival-stall-r72.js");
const Cooking = require("../src/cooking-r75.js");

const T0 = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function seeded(seed) {
  let a = seed >>> 0;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function festivalState(items) {
  const state = S.defaultState(T0); A.ensure(state, T0); state.level = 8; state.coins = 500; state.upgrades.plotCount = 1;
  const festival = state.adventure.r61.festival;
  Object.assign(festival, { unlocked: true, startsAt: T0, endsAt: T0 + 10 * 60 * 1000, nextAt: 0, baseline: { wheat: 0, carrot: 0, tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } }, supportProvisioned: true, harvestCrop: "wheat", harvestRequired: 3 });
  state.storage.items = Object.assign({}, items || { wheat: 20, carrot: 20, tomato: 20, strawberry: 20 });
  F.ensure(state, T0); state.adventure.r72b.totalPlays = 1; M.ensure(state, T0); return state;
}
function demandKey(demand) { return demand.kind === "item" ? "item:" + demand.itemId : demand.kind === "pair" ? "pair:" + demand.tastes.slice().sort().join("+") : "taste:" + demand.taste; }
function rowFor(state, session, customer) {
  const demand = customer.demand, rows = session.pool.filter((row) => session.offeredIds.includes(row.id));
  if (demand.kind === "item") return rows.find((row) => row.id === demand.itemId && F.stallStockOf(state, session, row) > 0) || rows.find((row) => row.id === demand.itemId);
  const tastes = demand.kind === "pair" ? (demand.remaining || demand.tastes) : [demand.taste];
  return rows.find((row) => tastes.some((taste) => row.tastes.includes(taste)) && F.stallStockOf(state, session, row) > 0) || rows.find((row) => tastes.some((taste) => row.tastes.includes(taste)));
}
function perfect(seed) {
  const state = festivalState(), session = F.startSession(state, T0, seeded(seed)).session; let now = T0, guard = 0;
  while (!session.finished && session.customer && guard++ < 80) {
    now = Math.max(now, session.customer.readyAt); const row = rowFor(state, session, session.customer); assert.ok(row);
    const served = F.serve(state, session, row.id, now); assert.equal(served.ok, true); if (!served.partial) now += 50;
  }
  return session.result || F.finishSession(state, session, now);
}
function freeTile(state) { return state.map.tiles.find((tile) => G.canBuildOn(state, tile)); }

test("客人類型固定為 15、18、21 秒，每天熱門最多兩樣", () => {
  assert.deepEqual(F.CUSTOMER_TYPES.map((row) => [row.label, row.timeoutMs]), [["趕時間", 15000], ["一般", 18000], ["只說口味", 21000]]);
  const state = festivalState(), pool = F.unlockedItems(state).filter((row) => ["wheat", "carrot", "tomato", "strawberry"].includes(row.id));
  for (let seed = 1; seed <= 200; seed++) assert.ok(F.marketPreview(state, pool, seeded(seed)).hotItems.length <= 2, "seed " + seed + " 熱門超過兩樣");
});

test("固定種子 200 場：任一可能同時在攤前的兩人都不同，全對至少半數三星", () => {
  let threeStars = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const state = festivalState(), session = F.startSession(state, T0, seeded(seed)).session;
    const plan = [...session.queue, ...session.customerPlan];
    for (let index = 1; index < plan.length; index++) for (let back = 1; back <= Math.min(2, index); back++) {
      const current = plan[index], other = plan[index - back];
      assert.notEqual(current.typeId, other.typeId, "seed " + seed + " 類型重複");
      assert.ok(Math.abs(current.patienceMs - other.patienceMs) >= 3000, "seed " + seed + " 耐心差不到 3 秒");
      assert.notEqual(demandKey(current.demand), demandKey(other.demand), "seed " + seed + " 需求重複");
      assert.ok(Number(!!current.demand.hot) + Number(!!other.demand.hot) <= 1, "seed " + seed + " 同時兩位都能拿熱門分");
    }
    const result = perfect(seed); if (result.stars === 3) threeStars++;
  }
  assert.ok(threeStars >= 100, "200 場全對只有 " + threeStars + " 場三星");
});

test("失分逐項相加等於最高分減實得，只有滿分寫沒有失分", () => {
  const session = { maxPossibleScore: 50, score: 28, tokenUses: 1, missed: 1, unfinished: 1, customers: [
    { outcome: "沒輪到", plannedHotBonus: 4, hotBonus: 0, tokenPenalty: 0, substitutePenalty: 0 },
    { outcome: "答對", plannedHotBonus: 0, hotBonus: 0, tokenPenalty: 5, substitutePenalty: 0 },
  ] };
  const loss = F.lossSummary(session);
  assert.equal(loss.gap, 22); assert.equal(loss.totalPoints, 22); assert.equal(loss.breakdown.reduce((sum, row) => sum + row.points, 0), 22);
  assert.match(loss.display, /熱門沒接到/); assert.match(loss.display, /代幣折半/); assert.match(loss.display, /沒招呼到/); assert.doesNotMatch(loss.display, /沒有失分/);
  assert.equal(F.lossSummary({ maxPossibleScore: 50, score: 50, customers: [] }).display, "主要失分：沒有失分");
});

test("蜂箱、香草小圃、雞舍餵食槽各有兩條可切換且真的產出不同物品的路", () => {
  const state = festivalState({ wheat: 5, carrot: 5, tomato: 5, strawberry: 5 }); state.level = 3;
  for (const type of M.FACILITY_ORDER) assert.equal(M.buildFacility(state, type, freeTile(state).id, T0).ok, true);
  for (const row of M.facilityStatus(state, T0)) assert.equal(row.routes.length, 2, row.name + " 路線數");
  assert.equal(M.chooseFacilityRoute(state, "r66_beehive", "orchard", T0 + 1).ok, true);
  assert.equal(M.collectFacility(state, "r66_beehive", T0 + 1 + 4 * 60 * 1000).itemId, "honey_good");
  assert.equal(M.chooseFacilityRoute(state, "r66_herb_garden", "herb", T0 + 1).ok, true);
  assert.equal(M.collectFacility(state, "r66_herb_garden", T0 + 1 + 5 * 60 * 1000).itemId, "forest_herb");
  const carrots = state.storage.items.carrot;
  assert.equal(M.chooseFacilityRoute(state, "r66_feed_trough", "greens", T0 + 1).ok, true);
  assert.equal(state.storage.items.carrot, carrots - 1, "餵菜葉要真的投入胡蘿蔔");
  assert.equal(M.collectFacility(state, "r66_feed_trough", T0 + 1 + 3 * 60 * 1000).itemId, "egg_good");
  const festivalIds = new Set(F.unlockedItems(state).map((row) => row.id));
  for (const id of ["honey_good", "forest_herb", "egg_good"]) assert.ok(festivalIds.has(id), id + " 要能進祭典叫賣");
  const gameSource = fs.readFileSync("src/game.js", "utf8"), adventureSource = fs.readFileSync("src/adventure.js", "utf8");
  assert.match(gameSource, /honey_good:[^\n]*egg_good|egg_good:[^\n]*honey_good|honey_good/); assert.match(gameSource, /forest_herb/);
  assert.match(adventureSource, /mint_tea[^\n]*river_mint/);
});

test("照顧彈窗寫比勤澆水慢幾秒，料理成果卡把 3 分鐘說成效果持續時間", () => {
  const state = festivalState(); state.materials.compost = 2; state.plots[0].cropId = "wheat"; state.plots[0].plantedAt = T0;
  const forecast = G.careForecast(state, 0, T0);
  assert.match(forecast.rows.find((row) => row.id === "compost").text, /比勤澆水慢 \d+ 秒/);
  assert.match(forecast.rows.find((row) => row.id === "natural").text, /比勤澆水慢 \d+ 秒/);
  const recipe = A.recipes(state).find((row) => row.effect && row.effect.durationMs === 3 * 60 * 1000);
  assert.ok(recipe, "要有 3 分鐘效果料理");
  assert.match(Cooking.gradeEffectText(recipe, "perfect"), /效果持續 3 分鐘 → 4 分 30 秒/);
});

test("擺攤與作物評比都有三行摘要和收合明細掛點", () => {
  const source = fs.readFileSync("src/festival-stall-r72.js", "utf8"), css = fs.readFileSync("src/content-r58b.css", "utf8");
  for (const hook of ["data-r80a-stall-summary", "data-r80a-stall-details", "data-r80a-judge-summary", "data-r80a-judge-details"]) assert.match(source, new RegExp(hook));
  const judging = F.judgingSummary({ stars: 2, totalScore: 3, maxScore: 5, scoreSources: { diverse: true, seasonal: true, hasMeal: true } });
  assert.equal(judging.score, 3); assert.match(judging.advice, /下次先補/);
  assert.match(css, /R80A/); assert.match(css, /\.r80a-result-summary/); assert.match(css, /\.r80a-facility-route/);
});

console.log("VERIFIED content R80A stall and facilities (" + passed + "/6)");
if (process.exitCode) process.exit(1);
