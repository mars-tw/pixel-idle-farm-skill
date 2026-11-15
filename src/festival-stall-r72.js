/* R72B（第 5～6 項）：收穫祭「擺攤叫賣」小遊戲。
   純邏輯可由 Node 載入測試；瀏覽器段提供全螢幕叫賣介面。
   不改 adventure.js 種植邏輯與 game.js 成長計算；自己的紀錄存 adventure.r72b，
   獎章與裝飾數寫回既有 festival.medals / decorations 計數。 */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const C = isNode ? require("./config.js") : (root.CONFIG || root);
  const G = isNode ? require("./game.js") : (root.Game || root);
  const A = isNode ? require("./adventure.js") : (root.AdventureAPI || null);
  const Midgame = isNode ? (() => { try { return require("./midgame-r66.js"); } catch (_) { return null; } })() : (root.MidgameR66 || null);

  const DURATION_MS = 60000;
  const CUSTOMER_TIMEOUT_MS = 8000;
  const CUSTOMER_ARRIVE_MS = 1000;
  const MAX_ATTEMPTS_PER_ROUND = 2;
  const BASE_SCORE = 10;
  const COMBO_STEP = 1;
  const COMBO_CAP = 6;
  const HOT_SCORE_BONUS = 4;
  const THREE_STAR_COMBO = 10;
  const THREE_STAR_HOT_SERVED = 3;
  /* R79A：一場預排十四位，畫面同時保留兩位。十四位全對即使沒有熱門加分，
     連擊分也足以跨過 200 分；玩家必須在兩條耐心之間決定先招呼誰。 */
  const QUEUE_SIZE = 2;
  const CUSTOMER_LIMIT = 14;
  const SUBSTITUTE_SCORE_RATE = 0.7;
  /* R78 整合：沒答錯也沒錯過客人的保底兩顆星條件，門檻文字與判星共用同一份數字。 */
  const PERFECT_TWO_STAR_STOCK = 40;
  const PERFECT_TWO_STAR_SERVED = 10;
  /* R76B：第 12 項——代幣每場 3 枚，用代幣答對只拿一半分。 */
  const TOKENS_PER_SESSION = 3;
  const TOKEN_SCORE_RATE = 0.5;
  const TOKEN_RULE_TEXT = "每場有 3 枚叫賣代幣，用代幣答對只拿一半分；缺貨時也能推薦同口味的現貨，拿七成分、不花代幣。";
  const CUSTOMERS = [
    { id: "mayor", name: "鎮長葛瑞", art: "customer-mayor.png" },
    { id: "elder", name: "老農班伯", art: "customer-elder.png" },
    { id: "merchant", name: "蘿拉", art: "customer-merchant.png" },
    { id: "child", name: "圖圖", art: "customer-child.png" },
  ];
  /* R78A：三種客人決定題型與耐心；角色外觀仍從既有四位祭典客人抽。 */
  const CUSTOMER_TYPES = [
    { id: "rush", label: "趕時間", timeoutMs: 6000 },
    { id: "taste", label: "只說口味", timeoutMs: CUSTOMER_TIMEOUT_MS },
    { id: "regular", label: "老主顧", timeoutMs: CUSTOMER_TIMEOUT_MS },
  ];
  const TASTE_LABEL = { sweet: "甜的", sour: "酸酸的", fresh: "清爽的", warm: "熱熱的" };
  // R73B（第 3 項）：口味標籤短字，商品卡上直接顯示，玩家一眼可推口味題答案。
  const TASTE_CHIP = { sweet: "甜", sour: "酸", fresh: "清爽", warm: "熱熱的" };
  const TASTES_BY_BASE = {
    strawberry: ["sweet"], grapes: ["sweet"], melon: ["sweet"], sweet_potato: ["sweet"],
    corn: ["sweet"], carrot: ["sweet"], honey: ["sweet"], pumpkin: ["sweet"],
    sunflower: ["sweet"], amber_resin: ["sweet"],
    wild_berry: ["sour"], tomato: ["sour"], frost_cherry: ["sour"],
    river_mint: ["fresh"], radish: ["fresh"], pea: ["fresh"], winter_kale: ["fresh"], bell_pepper: ["fresh"],
    forest_herb: ["fresh"], milk: ["fresh", "sweet"],
    /* R73 整合：生小麥不算熱食，不給口味標籤（只能用「我要小麥」指名） */ potato: ["warm"], egg: ["warm"], duck_egg: ["warm"],
    glow_mushroom: ["warm"], mooncap_spore: ["warm"], forest_chestnut: ["warm"],
  };
  // R73B（第 5 項）：星等門檻，開始畫面與結算共用同一份數字。
  const STAR_THRESHOLDS = [
    { stars: 1, score: 50 },
    { stars: 2, score: 120 },
    { stars: 3, score: 200 },
  ];
  function starThresholdText() {
    return "一顆星 " + STAR_THRESHOLDS[0].score + " 分・二顆星 " + STAR_THRESHOLDS[1].score + " 分・三顆星 " + STAR_THRESHOLDS[2].score + " 分（三星還要連續答對 " + THREE_STAR_COMBO + " 位、接到 " + THREE_STAR_HOT_SERVED + " 位熱門需求）。" + STAR_FLOOR_RULE_TEXT;
  }
  /* R78 整合：評審看到 49 分、45 分也有一顆星，畫面卻只寫「一顆星 50 分」，像是算錯。
     保底規則寫進門檻那一行；真的靠保底拿到星的那一場，星星下面再寫一句原因。 */
  const STAR_FLOOR_RULE_TEXT = "沒有答錯、也沒有錯過客人，分數沒到也至少一顆星；同時擺了 " + PERFECT_TWO_STAR_STOCK + " 份以上、答對 " + PERFECT_TWO_STAR_SERVED + " 位以上，至少兩顆星。";
  function starFloorText(result) {
    const stars = qty(result && result.stars), score = qty(result && result.score);
    if (stars <= starsForScore(score)) return "";
    if (stars >= 2) return "分數沒到 " + STAR_THRESHOLDS[1].score + " 分，但這一場擺了 " + PERFECT_TWO_STAR_STOCK + " 份以上、答對 " + PERFECT_TWO_STAR_SERVED + " 位以上，沒有答錯、也沒有錯過客人，所以有兩顆星。";
    return "分數沒到 " + STAR_THRESHOLDS[0].score + " 分，但這一場沒有答錯、也沒有錯過客人，所以有一顆星。";
  }
  // R73B（第 5 項）：結算只留一句改善建議。
  function adviceFor(result) {
    const score = qty(result && result.score);
    const stars = qty(result && result.stars);
    if (stars >= 3) return "三顆星到手了；下次照樣先顧快沒耐心的人，再把熱門需求接穩。";
    if (qty(result && result.timedOut) > 0 || qty(result && result.notReached) > 0) return "差最多的是沒來得及招呼的客人；先點耐心快見底的那一位。";
    if (qty(result && result.wrong) > 0) return "差最多的是拿錯貨；先看需求，再看商品口味標籤。";
    if (qty(result && result.tokenUses) > 0) return "缺貨用代幣只拿一半分；有同口味現貨時，改推替代品可以拿七成分。";
    if (stars === 2 && score >= STAR_THRESHOLDS[2].score) {
      if (qty(result && result.bestCombo) < THREE_STAR_COMBO) return "分數夠了，還差連續答對 " + Math.max(0, THREE_STAR_COMBO - qty(result && result.bestCombo)) + " 位。";
      return "分數和連擊都夠了，還差 " + Math.max(0, THREE_STAR_HOT_SERVED - qty(result && result.hotServed)) + " 位熱門需求。";
    }
    const next = STAR_THRESHOLDS.find((row) => row.stars > stars);
    const gap = next ? Math.max(0, next.score - score) : 0;
    return "再多 " + gap + " 分就能拿到" + (next ? next.stars : 3) + "顆星；這場沒有明顯失誤，繼續維持連續答對並接熱門需求。";
  }
  const TASTES_BY_MEAL = {
    rustic_bread: ["warm"], baked_carrot: ["warm", "sweet"], wheat_carrot_pancake: ["warm", "sweet"],
    carrot_wheat_stew: ["warm"], bamber_rain_soup: ["warm"], tomato_harvest_stew: ["warm", "sour"],
    strawberry_market_tart: ["sweet"], carrot_trail_soup: ["warm"], riverside_harvest_platter: ["fresh"],
    mint_tea: ["fresh"],
  };
  function baseId(id) { return String(id || "").replace(/_(good|premium)$/, ""); }
  function tastesOf(id, kind) {
    if (kind === "meal") return (TASTES_BY_MEAL[id] || ["warm"]).slice();
    return (TASTES_BY_BASE[baseId(id)] || []).slice();
  }
  // R73B（第 3 項）：物品像素圖示。作物沿用既有 r66 原生像素圖，
  // 產品／採集／料理沿用 content-r73 補產生的像素圖（見該目錄 manifest）。
  function iconFor(id, kind) {
    const base = baseId(id);
    if (kind === "crop" || (C.CROPS && C.CROPS[base])) return "assets/generated/r66/native/crop_" + base + "-32.png";
    return "assets/generated/content-r73/item-" + base + ".png";
  }
  function tasteLabelsOf(row) {
    const tastes = row && Array.isArray(row.tastes) ? row.tastes : tastesOf(row && row.id, row && row.kind);
    return tastes.map((taste) => TASTE_CHIP[taste] || TASTE_LABEL[taste] || taste);
  }
  function qty(value) { const n = Math.floor(Number(value) || 0); return n > 0 ? n : 0; }
  function at(now) { return Number.isFinite(now) ? now : Date.now(); }
  function pick(rng, rows) { return rows[Math.min(rows.length - 1, Math.floor((rng || Math.random)() * rows.length))]; }
  function weightedPick(rng, rows, weightOf) {
    if (!rows || !rows.length) return null;
    const weights = rows.map((row) => Math.max(0, Number(weightOf(row)) || 0));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return pick(rng, rows);
    let cursor = (rng || Math.random)() * total;
    for (let i = 0; i < rows.length; i++) { cursor -= weights[i]; if (cursor < 0) return rows[i]; }
    return rows[rows.length - 1];
  }

  function ensure(state, now) {
    if (!state || typeof state !== "object") return { ok: false, reason: "no_state", message: "還沒有農場紀錄。" };
    if (A && A.ensure) A.ensure(state, at(now));
    if (!state.adventure || typeof state.adventure !== "object") state.adventure = {};
    if (!state.adventure.r72b || typeof state.adventure.r72b !== "object") state.adventure.r72b = {};
    const b = state.adventure.r72b;
    if (!b.rounds || typeof b.rounds !== "object" || Array.isArray(b.rounds)) b.rounds = {};
    b.goldenFlag = !!b.goldenFlag;
    if (!Number.isFinite(b.totalPlays) || b.totalPlays < 0) b.totalPlays = 0;
    return { ok: true };
  }
  function festivalInfo(state, now) {
    ensure(state, now);
    const status = A && A.festivalStatus ? A.festivalStatus(state, at(now)) : { unlocked: false, active: false };
    const f = state.adventure && state.adventure.r61 && state.adventure.r61.festival;
    const roundKey = status.active && f && Number.isFinite(f.startsAt) && f.startsAt > 0 ? String(f.startsAt) : null;
    return { status, roundKey, festival: f || null };
  }
  function roundRecord(state, now, create) {
    const info = festivalInfo(state, now);
    if (!info.roundKey) return { info, record: null };
    const rounds = state.adventure.r72b.rounds;
    if (!rounds[info.roundKey] || typeof rounds[info.roundKey] !== "object") {
      if (!create) return { info, record: { attemptsUsed: 0, bestScore: 0, bestStars: 0, rewardedStars: 0, floorGranted: false } };
      rounds[info.roundKey] = { attemptsUsed: 0, bestScore: 0, bestStars: 0, rewardedStars: 0, floorGranted: false };
    }
    const r = rounds[info.roundKey];
    r.attemptsUsed = Math.min(MAX_ATTEMPTS_PER_ROUND, qty(r.attemptsUsed));
    r.bestScore = qty(r.bestScore); r.bestStars = qty(r.bestStars); r.rewardedStars = qty(r.rewardedStars);
    r.floorGranted = !!r.floorGranted;
    return { info, record: r };
  }
  function statusFor(state, now) {
    const { info, record } = roundRecord(state, now, false);
    const rec = record || { attemptsUsed: 0, bestScore: 0, bestStars: 0, rewardedStars: 0 };
    return {
      unlocked: !!info.status.unlocked, active: !!info.status.active, roundKey: info.roundKey,
      attemptsUsed: rec.attemptsUsed, attemptsLeft: Math.max(0, MAX_ATTEMPTS_PER_ROUND - rec.attemptsUsed),
      canPlay: !!info.status.active && rec.attemptsUsed < MAX_ATTEMPTS_PER_ROUND,
      bestScore: rec.bestScore, bestStars: rec.bestStars,
      goldenFlag: !!(state.adventure && state.adventure.r72b && state.adventure.r72b.goldenFlag),
    };
  }

  function unlockedItems(state) {
    ensure(state, Date.now());
    const rows = []; const seen = new Set();
    const add = (id, kind, name) => { if (!id || seen.has(id) || !name) return; seen.add(id); const row = { id, kind, name, tastes: tastesOf(id, kind) }; row.icon = iconFor(id, kind); row.tasteLabels = tasteLabelsOf(row); rows.push(row); };
    const cropIds = G && G.unlockedCrops ? G.unlockedCrops(state)
      : Object.values(C.CROPS || {}).filter((c) => (c.unlockLevel || 1) <= (state.level || 1)).map((c) => c.id);
    for (const id of cropIds) { const def = C.CROPS[id]; if (def) add(id, "crop", def.name); }
    const productIds = G && G.unlockedProducts ? G.unlockedProducts(state) : [];
    for (const id of productIds) { const def = C.getItemDef ? C.getItemDef(id) : null; if (def) add(id, "product", def.name); }
    const forageIds = G && G.unlockedForageItems ? G.unlockedForageItems(state) : [];
    for (const id of forageIds) { const def = C.getItemDef ? C.getItemDef(id) : null; if (def) add(id, "forage", def.name); }
    if (A && A.recipes) for (const recipe of A.recipes(state)) if (recipe.unlocked) add(recipe.id, "meal", recipe.name);
    return rows;
  }
  function stockOf(state, row) {
    if (!row) return 0;
    if (row.kind === "meal") return qty(state.adventure && state.adventure.meals && state.adventure.meals[row.id]);
    return qty(state.storage && state.storage.items && state.storage.items[row.id]);
  }
  function totalStock(state, pool) { return (pool || []).reduce((sum, row) => sum + stockOf(state, row), 0); }
  // R73B（第 4 項）：背包／代幣改為逐項判斷——這一格有貨就用背包、沒貨才用代幣，
  // 不再因某一格沒貨就把整場切成代幣結算。
  function itemMode(state, row) { return stockOf(state, row) > 0 ? "stock" : "token"; }
  function itemCard(state, row) {
    if (!row) return null;
    const stock = stockOf(state, row);
    const mode = stock > 0 ? "stock" : "token";
    return {
      id: row.id, kind: row.kind, name: row.name, stock, mode, usesToken: mode === "token",
      tastes: (row.tastes || []).slice(), tasteLabels: tasteLabelsOf(row),
      icon: row.icon || iconFor(row.id, row.kind),
    };
  }
  /* R77C 第 10 項：開攤前先算「留給誰」。
     會搶同一批貨的是讀倉庫／餐籃現量的計數：主線目前任務、鄰居個人委託、
     河畔委託與鎮長每日委託還缺的量。祭典收成目標讀的是累計收成次數，賣貨不會讓它倒退。 */
  function reservePlan(state, now, pool) {
    ensure(state, at(now));
    const rows = Array.isArray(pool) && pool.length ? pool : unlockedItems(state);
    const t = at(now);
    const needs = new Map();
    const addNeed = (id, missing, label) => {
      const n = qty(missing); if (!id || !n || !label) return;
      if (!needs.has(id)) needs.set(id, []);
      needs.get(id).push({ qty: n, label });
    };
    /* 留的量是委託總共要的量，不是還差的量：手上這幾份正是讓它顯示備齊的那幾份，賣掉就倒退。 */
    try {
      const list = A && A.quests ? A.quests(state, t) : [];
      const current = list.find((q) => q.status !== "claimed");
      if (current) for (const r of current.requirements || []) if (r.source === "inventory" || r.source === "meals") addNeed(r.id, r.required, "主線「" + current.name + "」");
    } catch (_) { /* 委託讀不到時不擋擺攤 */ }
    try {
      if (A && A.personalQuests) for (const p of A.personalQuests(state, t)) if (p.unlocked && !p.completed) for (const r of p.requirements || []) addNeed(r.id, r.required, "鄰居委託「" + p.title + "」");
    } catch (_) { /* 同上 */ }
    try {
      if (A && A.commissions) for (const c of A.commissions(state, t)) if (c.unlocked && !c.completed) for (const r of c.requirements || []) if (r.source === "inventory" || r.source === "meals") addNeed(r.id, r.required, "河畔委託「" + c.name + "」");
    } catch (_) { /* 同上 */ }
    try {
      if (Midgame && Midgame.mayorQuest) { const mq = Midgame.mayorQuest(state, t); if (mq && !mq.claimed) addNeed(mq.cropId, mq.qty, "鎮長每日委託"); }
    } catch (_) { /* 同上 */ }
    return rows.map((row) => {
      const stock = stockOf(state, row);
      let left = stock;
      const reserveFor = [];
      for (const need of needs.get(row.id) || []) { const take = Math.min(left, need.qty); if (take > 0) { reserveFor.push({ label: need.label, qty: take }); left -= take; } }
      const reserved = stock - left;
      return { id: row.id, kind: row.kind, name: row.name, stock, reserved, stallQty: left, reserveFor,
        reserveText: reserved > 0 ? "留 " + reserved + " 份給" + reserveFor.map((r) => r.label).join("、") : "沒有委託等著用" };
    }).filter((row) => row.stock > 0);
  }
  function defaultStallQty(row) { return Math.max(0, qty(row && row.stock) - qty(row && row.reserved)); }
  /* R78A：熱門表只由玩家目前有機會擺出的品項產生。固定亂數會得到完全相同的排序。 */
  function marketPreview(state, pool, rng) {
    const random = typeof rng === "function" ? rng : Math.random;
    const source = (Array.isArray(pool) ? pool : unlockedItems(state)).filter((row) => stockOf(state, row) > 0 || qty(row.stallQty) > 0);
    const remaining = source.slice(); const chosen = [];
    while (remaining.length && chosen.length < 3) {
      const row = pick(random, remaining); chosen.push(row); remaining.splice(remaining.indexOf(row), 1);
    }
    const hotItems = chosen.map((row, index) => ({
      id: row.id, name: row.name, kind: row.kind, rank: index + 1,
      weight: 4 - index, scoreBonus: HOT_SCORE_BONUS,
      label: row.name + "（熱門加 " + HOT_SCORE_BONUS + " 分）",
    }));
    return { hotItems, labels: hotItems.map((row) => row.label) };
  }
  function marketItem(market, row) { return market && Array.isArray(market.hotItems) ? market.hotItems.find((hot) => hot.id === row.id) || null : null; }
  function marketWeight(market, row) { const hot = marketItem(market, row); return hot ? Math.max(2, 6 - hot.rank) : 1; }
  function offeredRows(state, rows, session) {
    if (session && Array.isArray(session.offeredIds)) return rows.filter((row) => session.offeredIds.includes(row.id));
    return rows.filter((row) => stockOf(state, row) > 0);
  }
  function totalStallStock(state, session) { return offeredRows(state, session.pool || [], session).reduce((sum, row) => sum + stallStockOf(state, session, row), 0); }
  function stallStockOf(state, session, row) {
    if (!row) return 0;
    if (session && session.allotment) return Math.min(qty(session.allotment[row.id]), stockOf(state, row));
    return stockOf(state, row);
  }
  /* R77C 第 9 項：這一張單現在答不答得出來。兩樣單兩邊分開算，同一份貨不能當兩份。 */
  function demandAnswerable(state, pool, demand, session, tokensLeft) {
    if (!demand) return false;
    const sourceRows = Array.isArray(pool) ? pool : [];
    const rows = session && Array.isArray(session.offeredIds) ? sourceRows.filter((row) => session.offeredIds.includes(row.id)) : sourceRows;
    const tokens = Number.isFinite(tokensLeft) ? qty(tokensLeft) : TOKENS_PER_SESSION;
    const avail = (row) => stallStockOf(state, session, row);
    if (demand.kind === "item") { const row = rows.find((r) => r.id === demand.itemId); return !!row && (avail(row) > 0 || tokens > 0); }
    const tastes = demand.kind === "pair" ? (demand.remaining && demand.remaining.length ? demand.remaining : demand.tastes || []) : [demand.taste];
    for (const taste of tastes) if (!rows.some((r) => (r.tastes || []).includes(taste))) return false;
    if (demand.kind !== "pair") return rows.some((r) => (r.tastes || []).includes(demand.taste) && avail(r) > 0) || tokens > 0;
    if (tokens >= tastes.length) return true;
    const stockFor = (taste) => rows.filter((r) => (r.tastes || []).includes(taste)).reduce((sum, r) => sum + avail(r), 0);
    if (tokens === 1) return tastes.some((taste) => stockFor(taste) > 0);
    const union = rows.filter((r) => tastes.some((taste) => (r.tastes || []).includes(taste))).reduce((sum, r) => sum + avail(r), 0);
    return tastes.every((taste) => stockFor(taste) > 0) && union >= tastes.length;
  }
  function consumeOne(state, row) {
    if (row.kind === "meal") { if (qty(state.adventure.meals[row.id]) > 0) state.adventure.meals[row.id] -= 1; return; }
    if (!state.storage) state.storage = { items: {} };
    if (!state.storage.items) state.storage.items = {};
    if (qty(state.storage.items[row.id]) > 0) { state.storage.items[row.id] -= 1; if (state.storage.items[row.id] <= 0) delete state.storage.items[row.id]; }
  }
  // R73B（第 4 項）：session.mode 只保留作整場尚有存貨的概覽（相容舊紀錄），
  // 實際扣貨與否一律由 serve 依該物品當下存貨逐項決定，不再整場切換。
  function syncMode(state, session) {
    const total = session.allotment ? session.pool.reduce((sum, row) => sum + stallStockOf(state, session, row), 0) : totalStock(state, session.pool);
    session.mode = total <= 0 ? "token" : "stock";
    return session.mode;
  }

  /* R78A：保留舊常數與查詢函式供既有測試／外部掛點讀取；實際出題改為只讀本場擺出且尚有貨的清單。 */
  const STOCK_DEMAND_RATE = 0.8;
  function stockedItems(state, rows) { return (rows || []).filter((row) => stockOf(state, row) > 0); }
  function makeCustomer(state, pool, now, rng, opts) {
    const rows = Array.isArray(pool) && pool.length ? pool : unlockedItems(state);
    if (!rows.length) return null;
    const random = typeof rng === "function" ? rng : Math.random;
    const options = opts || {};
    const sessionLike = options.session || (options.allotment ? options : null);
    const tokensLeft = Number.isFinite(options.tokensLeft) ? options.tokensLeft : sessionLike && Number.isFinite(sessionLike.tokensLeft) ? sessionLike.tokensLeft : TOKENS_PER_SESSION;
    const person = pick(random, CUSTOMERS);
    const type = pick(random, CUSTOMER_TYPES);
    const eligible = sessionLike && Array.isArray(sessionLike.offeredIds) ? rows.filter((row) => sessionLike.offeredIds.includes(row.id)) : rows;
    const stocked = eligible.filter((row) => stallStockOf(state, sessionLike, row) > 0);
    const shortage = stocked.length === 0;
    if (!eligible.length || shortage && (qty(tokensLeft) <= 0 || sessionLike && qty(sessionLike.stockoutQuestions) >= 1)) return null;
    const source = shortage ? eligible : stocked;
    const chooseRow = () => weightedPick(random, source, (row) => marketWeight(sessionLike && sessionLike.market, row));
    let row = chooseRow();
    if (!row) return null;
    let demand = null; let hot = !!marketItem(sessionLike && sessionLike.market, row);
    if (type.id === "regular" || !row.tastes.length) {
      demand = { kind: "item", itemId: row.id, label: "我要" + row.name };
    } else if (type.id === "taste" && random() < 0.35) {
      const first = pick(random, row.tastes);
      const secondRows = source.filter((candidate) => candidate.tastes.some((taste) => taste !== first));
      const secondRow = weightedPick(random, secondRows, (candidate) => marketWeight(sessionLike && sessionLike.market, candidate));
      if (secondRow) {
        const second = pick(random, secondRow.tastes.filter((taste) => taste !== first));
        hot = hot || !!marketItem(sessionLike && sessionLike.market, secondRow);
        demand = { kind: "pair", tastes: [first, second], remaining: [first, second], label: "要一樣" + (TASTE_LABEL[first] || "甜的") + "、一樣" + (TASTE_LABEL[second] || "清爽的") };
      }
    }
    if (!demand) {
      const taste = pick(random, row.tastes);
      demand = taste ? { kind: "taste", taste, label: "想吃" + (TASTE_LABEL[taste] || "甜的") } : { kind: "item", itemId: row.id, label: "我要" + row.name };
    }
    demand.hot = hot; demand.shortage = shortage;
    if (!demandAnswerable(state, rows, demand, sessionLike, tokensLeft)) {
      row = source.find((candidate) => stallStockOf(state, sessionLike, candidate) > 0) || source[0];
      if (!row) return null;
      demand = { kind: "item", itemId: row.id, label: "我要" + row.name, hot: !!marketItem(sessionLike && sessionLike.market, row), shortage };
    }
    if (shortage && sessionLike) sessionLike.stockoutQuestions = qty(sessionLike.stockoutQuestions) + 1;
    const tags = [type.label]; if (demand.hot) tags.push("熱門加 " + HOT_SCORE_BONUS + " 分");
    const timeout = type.timeoutMs || CUSTOMER_TIMEOUT_MS;
    return { npcId: person.id, npcName: person.name, art: person.art, typeId: type.id, typeLabel: type.label, tags: tags.slice(0, 2), demand, patienceMs: timeout, startedAt: at(now), readyAt: at(now) + CUSTOMER_ARRIVE_MS, expiresAt: at(now) + CUSTOMER_ARRIVE_MS + timeout };
  }
  function matchesDemand(session, itemId, customer) {
    const target = customer || (session && session.customer);
    if (!session || !target) return false;
    const row = session.pool.find((item) => item.id === itemId);
    if (!row) return false;
    const demand = target.demand;
    if (demand.kind === "item") return demand.itemId === itemId;
    if (demand.kind === "pair") return (demand.remaining || demand.tastes || []).some((taste) => row.tastes.includes(taste));
    return row.tastes.includes(demand.taste);
  }
  function substituteMatch(state, session, itemId, customer) {
    const target = customer || (session && session.customer);
    const demand = target && target.demand;
    if (!demand || demand.kind !== "item" || demand.itemId === itemId) return false;
    const wanted = session.pool.find((row) => row.id === demand.itemId);
    const offered = session.pool.find((row) => row.id === itemId);
    if (!wanted || !offered || !wanted.tastes.length || stallStockOf(state, session, wanted) > 0 || stallStockOf(state, session, offered) <= 0) return false;
    return wanted.tastes.some((taste) => offered.tastes.includes(taste));
  }
  function demandText(state, session, customer) {
    const target = customer || (session && session.customer);
    if (!target || !target.demand) return "";
    const demand = target.demand;
    if (demand.kind !== "item") return demand.label || "";
    const wanted = session.pool.find((row) => row.id === demand.itemId);
    if (!wanted || stallStockOf(state, session, wanted) > 0 || !wanted.tastes.length) return demand.label || "";
    const taste = TASTE_LABEL[wanted.tastes[0]] || "同口味";
    return (demand.label || "想要這一樣") + "；賣完可換" + taste + "的現貨，拿七成分";
  }
  function lossSummary(session) {
    const records = session && Array.isArray(session.customers) ? session.customers : [];
    const missedPoints = records.filter((rec) => rec.outcome !== "答對" && rec.outcome !== "替代成功").reduce((sum, rec) => sum + (qty(rec.maxScore) || BASE_SCORE), 0);
    const tokenPoints = records.reduce((sum, rec) => sum + qty(rec.tokenPenalty), 0);
    const substitutePoints = records.reduce((sum, rec) => sum + qty(rec.substitutePenalty), 0);
    const counts = { tasteWrong: qty(session && session.tasteWrong), itemWrong: qty(session && session.itemWrong), timeouts: qty(session && session.timeouts), tokenUses: qty(session && session.tokenUses), missedPoints, tokenPoints, substitutePoints };
    const candidates = [
      { id: "missed", label: "沒來得及招呼", count: counts.timeouts + qty(session && session.unfinished), points: missedPoints },
      { id: "wrong", label: "拿錯東西或口味", count: counts.tasteWrong + counts.itemWrong, points: missedPoints },
      { id: "tokenUses", label: "缺貨用代幣", count: counts.tokenUses, points: tokenPoints },
      { id: "substitute", label: "改推替代品", count: records.filter((rec) => qty(rec.substitutePenalty) > 0).length, points: substitutePoints },
    ];
    let primary = candidates.slice().sort((a, b) => b.points - a.points || b.count - a.count)[0];
    let text = primary && primary.count > 0 ? primary.label + "，少了約 " + primary.points + " 分" : "沒有明顯失分";
    if (counts.tasteWrong > 0) { primary = { id: "tasteWrong", label: "口味猜錯", count: counts.tasteWrong, points: missedPoints }; text = "口味猜錯 " + counts.tasteWrong + " 次"; }
    else if (counts.itemWrong > 0) { primary = { id: "itemWrong", label: "拿錯東西", count: counts.itemWrong, points: missedPoints }; text = "拿錯東西 " + counts.itemWrong + " 次"; }
    const hasLoss = !!(primary && primary.count > 0);
    return { counts, primary: hasLoss ? primary : null, text, display: hasLoss ? "主要失分：差最多是" + text : "主要失分：" + text };
  }
  /* R77C 第 11 項：每一位客人一筆紀錄，結算逐位對得上總分。 */
  function beginRecord(session, customer) {
    const target = customer || session.customer;
    if (!target) { session.currentRecord = null; return null; }
    if (target._record) { session.currentRecord = target._record; return target._record; }
    const d = target.demand || {};
    const rec = { queueId: target.queueId || "", npcId: target.npcId, npcName: target.npcName, typeId: target.typeId || "", tags: (target.tags || []).slice(0, 2), want: d.label || "", given: [], givenNames: [], gained: 0, baseScore: BASE_SCORE, hotBonus: 0, comboBonus: 0, tokenPenalty: 0, substitutePenalty: 0, tokenUses: 0, hot: false, outcome: "招待中", diff: "", maxScore: qty(target.maxScore) || BASE_SCORE };
    if (!Array.isArray(session.customers)) session.customers = [];
    session.customers.push(rec); target._record = rec; session.currentRecord = rec;
    return rec;
  }
  function finishRecord(session, outcome, diff, customer) {
    const target = customer || session.customer;
    const rec = target && target._record ? target._record : session.currentRecord; if (!rec) return null;
    rec.outcome = outcome; rec.diff = diff || rec.diff || "";
    rec.givenNames = rec.given.map((g) => g.name);
    if (session.currentRecord === rec) session.currentRecord = null;
    return rec;
  }
  function queueCustomers(session) {
    if (Array.isArray(session && session.queue)) {
      if (session.customer && !session.queue.includes(session.customer)) return [session.customer];
      return session.queue;
    }
    return session && session.customer ? [session.customer] : [];
  }
  function syncSelectedCustomer(session) {
    const queue = queueCustomers(session);
    if (!queue.length) { session.customer = null; session.currentRecord = null; session.selectedCustomerId = ""; return null; }
    let selected = queue.find((customer) => customer.queueId === session.selectedCustomerId);
    if (!selected) selected = queue[0];
    session.selectedCustomerId = selected.queueId || "";
    session.customer = selected;
    session.currentRecord = selected._record || beginRecord(session, selected);
    return selected;
  }
  function selectCustomer(session, queueId) {
    const queue = queueCustomers(session);
    const selected = queue.find((customer, index) => customer.queueId === queueId || String(index) === String(queueId));
    if (!selected) return { ok: false, reason: "not_in_queue", message: "這位客人已經離開隊伍了。" };
    session.selectedCustomerId = selected.queueId || "";
    syncSelectedCustomer(session);
    return { ok: true, customer: selected, message: "先招呼" + selected.npcName + "。" };
  }
  function removeQueuedCustomer(session, customer) {
    if (Array.isArray(session.queue)) {
      const index = session.queue.indexOf(customer);
      if (index >= 0) session.queue.splice(index, 1);
      else if (session.customer === customer) {
        const abandonedCustomers = session.queue.slice();
        const abandoned = new Set(abandonedCustomers.map((row) => row._record).filter(Boolean));
        session.customers = (session.customers || []).filter((record) => !abandoned.has(record));
        for (const row of abandonedCustomers) delete row._record;
        session.customerPlan = abandonedCustomers.concat(session.customerPlan || []);
        session.queue = [];
      }
    }
    if (session.customer === customer) session.customer = null;
    if (session.selectedCustomerId === (customer && customer.queueId)) session.selectedCustomerId = "";
  }
  function plannedMaxScore(index, customer) {
    /* 玩家可以用口味題挑熱門品項，因此上限以每位都遞到熱門貨計；實得分永遠不會高過這個上限。 */
    return BASE_SCORE + Math.min(COMBO_CAP, Math.max(0, index) * COMBO_STEP) + HOT_SCORE_BONUS;
  }
  function prepareCustomerPlan(state, session, now) {
    session.customerPlan = [];
    let maximum = 0;
    for (let index = 0; index < session.customerLimit; index++) {
      const customer = makeCustomer(state, session.pool, now, session.rng, { session, tokensLeft: session.tokensLeft });
      if (!customer) break;
      /* R79 整合：隊伍同時有兩位，玩家可以先招呼後面那位，所以新客人避開前兩位排定的人，
         攤前不會出現兩個一模一樣的蘿拉。 */
      const recent = session.customerPlan.slice(-2).map((row) => row.npcId);
      if (recent.includes(customer.npcId)) {
        const others = CUSTOMERS.filter((row) => !recent.includes(row.id));
        const person = others.length ? pick(session.rng, others) : null;
        if (person) { customer.npcId = person.id; customer.npcName = person.name; customer.art = person.art; }
      }
      customer.queueId = "r79a-customer-" + (index + 1);
      customer.maxScore = plannedMaxScore(index, customer);
      maximum += customer.maxScore;
      session.customerPlan.push(customer);
    }
    session.maxPossibleScore = maximum;
    session.plannedCustomers = session.customerPlan.length;
  }
  function fillQueue(state, session, now) {
    if (!Array.isArray(session.queue)) session.queue = [];
    if (!Array.isArray(session.customerPlan)) session.customerPlan = [];
    while (session.queue.length < QUEUE_SIZE && session.customerPlan.length) {
      const customer = session.customerPlan.shift();
      const patience = qty(customer.patienceMs) || CUSTOMER_TIMEOUT_MS;
      customer.startedAt = at(now); customer.readyAt = at(now) + CUSTOMER_ARRIVE_MS; customer.expiresAt = customer.readyAt + patience;
      session.queue.push(customer); session.spawned = qty(session.spawned) + 1;
      beginRecord(session, customer);
    }
    return syncSelectedCustomer(session);
  }
  function spawnNext(state, session, now, rng) {
    // R74B（第 4 項）：新顧客出現就清除上一位的回饋，不讓舊訊息留到下一位。
    session.feedback = null;
    fillQueue(state, session, now);
    syncMode(state, session);
    return session.customer;
  }
  function startSession(state, now, rng, options) {
    const t = at(now);
    const { info, record } = roundRecord(state, t, true);
    if (!info.status.unlocked || !info.status.active || !info.roundKey) return { ok: false, reason: "not_active", message: "收穫祭還沒開始，祭典攤位還沒開放擺攤叫賣。" };
    if (record.attemptsUsed >= MAX_ATTEMPTS_PER_ROUND) return { ok: false, reason: "attempts_exhausted", message: "這一場已經玩過兩次了，等下一場收穫祭再來擺攤。" };
    const pool = unlockedItems(state);
    if (!pool.length) return { ok: false, reason: "no_items", message: "還沒有已解鎖的作物或料理可以叫賣。" };
    const opts = options || {};
    let allotment = null, reserve = null;
    if (opts.allotment && typeof opts.allotment === "object") {
      allotment = {};
      for (const row of pool) allotment[row.id] = Math.min(stockOf(state, row), qty(opts.allotment[row.id]));
      reserve = Array.isArray(opts.reservePlan) ? opts.reservePlan : reservePlan(state, t, pool);
    }
    const offeredIds = pool.filter((row) => allotment ? qty(allotment[row.id]) > 0 : stockOf(state, row) > 0).map((row) => row.id);
    const marketRows = pool.filter((row) => offeredIds.includes(row.id));
    const market = opts.market && Array.isArray(opts.market.hotItems) ? JSON.parse(JSON.stringify(opts.market)) : marketPreview(state, marketRows, typeof rng === "function" ? rng : Math.random);
    const initialStock = pool.reduce((sum, row) => sum + (allotment ? qty(allotment[row.id]) : stockOf(state, row)), 0);
    if (!offeredIds.length || initialStock <= 0) return { ok: false, reason: "no_supply", message: "至少擺一份貨，客人才知道今天能點什麼。" };
    record.attemptsUsed += 1;
    state.adventure.r72b.totalPlays += 1;
    const session = {
      roundKey: info.roundKey, startedAt: t, endsAt: t + DURATION_MS,
      score: 0, combo: 0, bestCombo: 0, served: 0, missed: 0, spawned: 0,
      wrong: 0, tokenUses: 0, tokensLeft: TOKENS_PER_SESSION, stockoutQuestions: 0, hotServed: 0,
      tasteWrong: 0, itemWrong: 0, timeouts: 0, feedback: null,
      mode: totalStock(state, pool) <= 0 ? "token" : "stock",
      pool, customer: null, finished: false, result: null, rng: typeof rng === "function" ? rng : Math.random,
      allotment, reservePlan: reserve, offeredIds, initialStock, market, customers: [], currentRecord: null,
      queue: [], selectedCustomerId: "", customerPlan: [],
    };
    session.customerLimit = Math.min(CUSTOMER_LIMIT, initialStock + TOKENS_PER_SESSION);
    prepareCustomerPlan(state, session, t);
    spawnNext(state, session, t, session.rng);
    if (!session.customer) soldOutFinish(state, session, t);
    return { ok: true, session, message: "兩位客人都在等，先點要招呼的人，再點要給的貨。" };
  }
  function starsForScore(score) { const s = qty(score); return s >= STAR_THRESHOLDS[2].score ? 3 : s >= STAR_THRESHOLDS[1].score ? 2 : s >= STAR_THRESHOLDS[0].score ? 1 : 0; }
  function starsForSession(session) {
    let stars = starsForScore(session && session.score);
    const perfect = qty(session && session.served) > 0 && qty(session && session.wrong) === 0 && qty(session && session.timeouts) === 0;
    if (perfect) stars = Math.max(stars, 1);
    if (perfect && qty(session && session.initialStock) >= PERFECT_TWO_STAR_STOCK && qty(session && session.served) >= PERFECT_TWO_STAR_SERVED) stars = Math.max(stars, 2);
    if (stars >= 3 && (qty(session && session.bestCombo) < THREE_STAR_COMBO || qty(session && session.hotServed) < THREE_STAR_HOT_SERVED)) stars = 2;
    return stars;
  }
  function rewardForStars(stars) {
    if (stars >= 3) return { stars: 3, coins: 60, medals: 1, goldenFlag: true };
    if (stars === 2) return { stars: 2, coins: 30, medals: 1, goldenFlag: false };
    if (stars === 1) return { stars: 1, coins: 12, medals: 0, goldenFlag: false };
    // R74B（第 4 項）：0 星也給保底 5 金。
    return { stars: 0, coins: 5, medals: 0, goldenFlag: false };
  }
  function finishSession(state, session, now) {
    if (!session || session.finished && session.result) return session ? session.result : { ok: false, reason: "no_session", message: "還沒有開始叫賣。" };
    ensure(state, at(now));
    /* R79A：時間到時，兩位隊伍中與已排定但尚未進場的客人都列為「沒輪到」，
       結算的人數會等於本場實際排定的客流，不再只剩截圖腳本碰到的四位。 */
    const pending = queueCustomers(session).slice();
    if (session.customer && !pending.includes(session.customer)) pending.push(session.customer);
    for (const customer of pending) {
      beginRecord(session, customer);
      if (customer._record && customer._record.outcome === "招待中") { finishRecord(session, "時間到", "這一場結束時還沒招待完。", customer); session.unfinished = qty(session.unfinished) + 1; }
    }
    for (const customer of session.customerPlan || []) {
      beginRecord(session, customer);
      finishRecord(session, "沒輪到", "這一場結束前還沒排到攤前。", customer);
      session.unfinished = qty(session.unfinished) + 1;
    }
    session.customerPlan = []; session.queue = [];
    session.finished = true; session.customer = null; session.currentRecord = null;
    const stars = starsForSession(session);
    /* R77C 第 12 項：賣得最好的一樣與這一場成績，留給評比口碑與晚宴對白用。 */
    const soldCounts = {};
    for (const rec of session.customers || []) for (const g of rec.given || []) { soldCounts[g.id] = soldCounts[g.id] || { id: g.id, name: g.name, count: 0 }; soldCounts[g.id].count += 1; }
    const bestSeller = Object.values(soldCounts).sort((a, b) => b.count - a.count)[0] || null;
    const roundsByKey = state.adventure.r72b.rounds;
    if (session.roundKey && (!roundsByKey[session.roundKey] || typeof roundsByKey[session.roundKey] !== "object")) roundsByKey[session.roundKey] = { attemptsUsed: 1, bestScore: 0, bestStars: 0, rewardedStars: 0, floorGranted: false };
    const record = session.roundKey ? roundsByKey[session.roundKey] : null;
    let granted = { coins: 0, medals: 0, goldenFlag: false };
    let upgraded = false;
    if (record) {
      if (session.score > record.bestScore) record.bestScore = session.score;
      if (stars > record.bestStars) record.bestStars = stars;
      if (stars > record.rewardedStars) {
        const before = rewardForStars(record.rewardedStars), after = rewardForStars(stars);
        // R74B：先前已領 0 星保底時，升星只補差額；沒領過保底就直接補全額。
        const beforeCoins = record.rewardedStars > 0 ? before.coins : (record.floorGranted ? before.coins : 0);
        granted = { coins: after.coins - beforeCoins, medals: after.medals - before.medals, goldenFlag: after.goldenFlag && !before.goldenFlag };
        record.rewardedStars = stars; record.floorGranted = true; upgraded = true;
      } else if (stars === 0 && !record.floorGranted) {
        // R74B（第 4 項）：0 星保底 5 金，同一場只給一次，之後升星再補差額。
        granted = { coins: rewardForStars(0).coins, medals: 0, goldenFlag: false };
        record.floorGranted = true;
      }
      if (granted.goldenFlag) state.adventure.r72b.goldenFlag = true;
      record.stallStars = Math.max(qty(record.stallStars), stars); record.stallScore = session.score;
      if (bestSeller) { record.bestSeller = bestSeller; state.adventure.r72b.lastBestSeller = Object.assign({}, bestSeller, { at: at(now) }); }
    }
    if (granted.coins > 0) { state.coins = qty(state.coins) + granted.coins; if (!state.stats) state.stats = {}; state.stats.totalCoinsEarned = qty(state.stats.totalCoinsEarned) + granted.coins; }
    if (granted.medals > 0) {
      const festival = state.adventure.r61 && state.adventure.r61.festival;
      if (festival) { festival.medals = Math.min(999, qty(festival.medals) + granted.medals); if (granted.goldenFlag) festival.decorations = Math.min(999, qty(festival.decorations) + 1); }
    }
    const reward = rewardForStars(stars);
    const loss = lossSummary(session);
    const wrong = qty(session.wrong); const timedOut = qty(session.timeouts); const notReached = qty(session.unfinished);
    const customerTotal = qty(session.served) + wrong + timedOut + notReached;
    const endReason = session.endReason || (at(now) >= session.endsAt ? "time_up" : qty(session.tokensLeft) <= 0 ? "token_empty" : "sold_out");
    const endReasonText = endReason === "time_up" ? "時間到，這一場結束。" : endReason === "all_served" ? "這一場的 " + qty(session.plannedCustomers) + " 位客人都招呼完了，提早結束。" : endReason === "token_empty" ? "代幣用完，攤上也沒有能接的貨，這一場結束。" : "擺出的貨賣完，這一場結束。";
    const result = {
      ok: true, finished: true, startedAt: session.startedAt, endedAt: at(now), endReason, endReasonText,
      score: session.score, stars, served: session.served, missed: session.missed, wrong, timedOut, notReached, customerTotal, unfinished: notReached,
      bestCombo: session.bestCombo, mode: session.mode, tokenUses: qty(session.tokenUses), tokensLeft: qty(session.tokensLeft), tokensPerSession: TOKENS_PER_SESSION, loss, mainLoss: loss.display, reward, granted, upgraded,
      hotServed: qty(session.hotServed), stockoutQuestions: qty(session.stockoutQuestions), maxPossibleScore: qty(session.maxPossibleScore), plannedCustomers: qty(session.plannedCustomers),
      goldenFlag: !!state.adventure.r72b.goldenFlag,
      customers: JSON.parse(JSON.stringify(session.customers || [])), bestSeller: bestSeller ? Object.assign({}, bestSeller) : null, soldOut: !!session.soldOut,
      message: stars === 0 ? (granted.coins > 0 ? "沒拿到星星也沒關係，這次已經很棒了，保底 5 金先收下，下次多答對幾位就能拿到星星。" : "沒拿到星星也沒關係，這次已經很棒了，下次多答對幾位就能拿到星星。") : upgraded ? `拿到 ${stars} 顆星，獎勵已補到這一場的最高紀錄。` : "這一場的獎勵已經照先前最高星領過了，這次不重複給。",
    };
    result.advice = adviceFor(result);
    result.starFloorText = starFloorText(result);
    session.result = result;
    return result;
  }
  /* R77C 第 9 項補：擺出的貨和代幣都用完時不會再有答得出的單，直接收攤結算，不讓畫面空等到時間到。 */
  const SOLD_OUT_TEXT = "擺出去的貨賣完了，這一場提早收攤結算。";
  const TOKEN_EMPTY_TEXT = "代幣用完，攤上也沒有能接的貨，這一場提早收攤結算。";
  function soldOutFinish(state, session, now) {
    session.soldOut = true;
    session.endReason = qty(session.tokensLeft) <= 0 ? "token_empty" : "sold_out";
    const result = finishSession(state, session, now);
    return { ok: false, reason: session.endReason, soldOut: true, message: session.endReason === "token_empty" ? TOKEN_EMPTY_TEXT : SOLD_OUT_TEXT, result };
  }
  function allCustomersFinish(state, session, now) {
    session.endReason = "all_served";
    const result = finishSession(state, session, now);
    return { ok: true, reason: "all_served", message: "這一場的 " + qty(session.plannedCustomers) + " 位客人都招呼完了，提早結算。", result };
  }
  function leaveCustomer(state, session, now, reason, customer) {
    const target = customer || session.customer;
    if (target && !target._record) beginRecord(session, target);
    if (target && target._record) {
      const d = target.demand;
      const missing = d && d.kind === "pair" && (d.remaining || []).length ? "還差：" + (d.remaining || []).map((t) => (TASTE_LABEL[t] || "") + "的").join("、") : "還沒拿到想要的";
      finishRecord(session, reason === "timeout" ? "等太久先離開" : "拿錯先離開", missing, target);
    }
    if (reason === "timeout") session.timeouts = qty(session.timeouts) + 1;
    else if (target && target.demand && target.demand.kind === "item") { session.itemWrong = qty(session.itemWrong) + 1; session.wrong = qty(session.wrong) + 1; }
    else { session.tasteWrong = qty(session.tasteWrong) + 1; session.wrong = qty(session.wrong) + 1; }
    session.combo = 0; session.missed += 1;
    removeQueuedCustomer(session, target);
    spawnNext(state, session, at(now), session.rng);
    // R74B（第 4 項）：答錯或逾時的即時回饋，給顧客卡飄字用；下一位再離開時會被清除換新。
    session.feedback = { kind: "bad", gained: 0, text: reason === "timeout" ? "等太久了" : "不是這一樣", spawned: session.spawned };
    return { ok: false, reason, timedOut: reason === "timeout", customer: session.customer, feedback: session.feedback };
  }
  function serve(state, session, itemId, now) {
    const t = at(now);
    if (!session || session.finished) return { ok: false, reason: "not_playing", message: "這一場叫賣已經結束了。" };
    if (t >= session.endsAt) { session.endReason = "time_up"; const result = finishSession(state, session, t); return { ok: false, reason: "time_up", message: "一分鐘到了，先結算這一場。", result }; }
    if (!session.customer) spawnNext(state, session, t, session.rng);
    if (!session.customer) return session.customerPlan && session.customerPlan.length === 0 ? allCustomersFinish(state, session, t) : soldOutFinish(state, session, t);
    beginRecord(session, session.customer);
    if (session.customer.readyAt && t < session.customer.readyAt) return { ok: false, reason: "arriving", message: "顧客還在走近攤位，等他站好再遞。" };
    if (t >= session.customer.expiresAt) { const left = leaveCustomer(state, session, t, "timeout", session.customer); return { ...left, message: "顧客等太久先離開了，下一位已經走近攤位。" }; }
    const row = session.pool.find((item) => item.id === itemId);
    if (!row) return { ok: false, reason: "unknown_item", message: "這件東西不在已解鎖的叫賣清單裡。" };
    const substitute = substituteMatch(state, session, itemId, session.customer);
    if (!matchesDemand(session, itemId, session.customer) && !substitute) { const left = leaveCustomer(state, session, t, "wrong_item", session.customer); return { ...left, message: "這不是顧客想要的，他先去逛逛別攤了。" }; }
    /* R76B：第 12 項——逐項判斷有貨扣背包、沒貨用代幣；代幣每場 3 枚，用完就遞不出沒貨的東西。 */
    /* R77C 第 10 項：有擺出量時只賣擺出去的，擺完的那一樣才用代幣。 */
    const usesToken = !substitute && stallStockOf(state, session, row) <= 0;
    if (usesToken && qty(session.tokensLeft) <= 0) return { ok: false, reason: "token_empty", message: "這一場的 3 枚叫賣代幣用完了，這一樣沒貨就遞不出去了。", tokenUses: qty(session.tokenUses), tokensLeft: 0 };
    if (!usesToken) { consumeOne(state, row); if (session.allotment) session.allotment[row.id] = Math.max(0, qty(session.allotment[row.id]) - 1); }
    const demand = session.customer.demand;
    const isPair = demand.kind === "pair";
    const matchedTaste = isPair ? (demand.remaining || demand.tastes || []).find((taste) => row.tastes.includes(taste)) : null;
    const hotSale = !!marketItem(session.market, row);
    const fullGained = BASE_SCORE + Math.min(COMBO_CAP, session.combo * COMBO_STEP) + (hotSale ? HOT_SCORE_BONUS : 0);
    let gained = fullGained;
    let partial = false;
    if (isPair) {
      demand.remaining = (demand.remaining || demand.tastes || []).filter((taste) => taste !== matchedTaste);
      demand.got = (demand.got || []).concat(matchedTaste ? [matchedTaste] : []);
      partial = demand.remaining.length > 0;
      gained = partial ? Math.ceil(fullGained / 2) : fullGained - Math.ceil(fullGained / 2) + Math.ceil(fullGained / 2);
      if (!partial) gained = fullGained;
      else gained = Math.ceil(fullGained / 2);
      if (partial && demand.pairFirstGained == null) demand.pairFirstGained = gained;
      if (!partial && demand.pairFirstGained != null) { gained = fullGained - demand.pairFirstGained; delete demand.pairFirstGained; }
    }
    const beforePenalty = gained;
    if (substitute) gained = Math.max(1, Math.floor(gained * SUBSTITUTE_SCORE_RATE));
    if (usesToken) gained = Math.max(1, Math.floor(gained * TOKEN_SCORE_RATE));
    session.score += gained;
    if (session.currentRecord) {
      session.currentRecord.given.push({ id: row.id, name: row.name, via: substitute ? "substitute" : usesToken ? "token" : "stock", gained });
      session.currentRecord.gained += gained; session.currentRecord.hot = session.currentRecord.hot || hotSale;
      session.currentRecord.hotBonus = Math.max(session.currentRecord.hotBonus, hotSale ? HOT_SCORE_BONUS : 0);
      session.currentRecord.comboBonus = Math.max(session.currentRecord.comboBonus, Math.min(COMBO_CAP, session.combo * COMBO_STEP));
      if (usesToken) { session.currentRecord.tokenUses += 1; session.currentRecord.tokenPenalty += Math.max(0, beforePenalty - gained); session.currentRecord.diff = "有一樣用代幣遞，只拿一半分"; }
      if (substitute) { session.currentRecord.substitutePenalty += Math.max(0, beforePenalty - gained); session.currentRecord.diff = "缺貨改推同口味現貨，拿七成分"; }
    }
    if (usesToken) { session.tokenUses = qty(session.tokenUses) + 1; session.tokensLeft = Math.max(0, qty(session.tokensLeft) - 1); }
    if (partial) {
      demand.label = "還要一樣" + (TASTE_LABEL[demand.remaining[0]] || "清爽的");
      session.feedback = { kind: "good", gained, text: "+" + gained + " 分", spawned: session.spawned };
      syncMode(state, session);
      return { ok: true, partial: true, gained, score: session.score, combo: session.combo, mode: usesToken ? "token" : "stock", usesToken, tokenUses: qty(session.tokenUses), tokensLeft: qty(session.tokensLeft), feedback: session.feedback, customer: session.customer, message: usesToken ? "先對了一樣，這一樣用叫賣代幣結算，只拿一半分，還差一樣。" : "先對了一樣，還差一樣。" };
    }
    session.combo += 1; session.bestCombo = Math.max(session.bestCombo, session.combo);
    session.served += 1;
    const completedCustomer = session.customer;
    const completedRecord = finishRecord(session, substitute ? "替代成功" : "答對", session.currentRecord && session.currentRecord.diff ? session.currentRecord.diff : "都對上了", completedCustomer);
    if (completedRecord && completedRecord.hot) session.hotServed = qty(session.hotServed) + 1;
    removeQueuedCustomer(session, completedCustomer);
    spawnNext(state, session, t, session.rng);
    session.feedback = { kind: "good", gained, text: "+" + gained + " 分", spawned: session.spawned };
    syncMode(state, session);
    if (!session.customer) {
      const depleted = totalStallStock(state, session) <= 0 && qty(session.tokensLeft) <= 0;
      const closed = depleted ? soldOutFinish(state, session, t) : allCustomersFinish(state, session, t);
      return { ok: true, partial: false, gained, score: session.score, combo: session.combo, mode: usesToken ? "token" : "stock", usesToken, substitute, tokenUses: qty(session.tokenUses), tokensLeft: qty(session.tokensLeft), feedback: session.feedback, customer: null, soldOut: depleted, result: closed.result, message: closed.message };
    }
    return { ok: true, partial: false, gained, score: session.score, combo: session.combo, mode: usesToken ? "token" : "stock", usesToken, substitute, tokenUses: qty(session.tokenUses), tokensLeft: qty(session.tokensLeft), feedback: session.feedback, customer: session.customer, message: substitute ? "客人接受同口味的替代品，這次拿七成分，不花代幣。" : usesToken ? "答對了，這一樣背包沒貨，用叫賣代幣結算，只拿一半分，沒有消耗背包。" : "答對了，顧客開心地收下了。" };
  }
  function tickSession(state, session, now) {
    const t = at(now);
    if (!session || session.finished) return { finished: !!(session && session.finished), timedOut: false };
    if (t >= session.endsAt) { session.endReason = "time_up"; const result = finishSession(state, session, t); return { finished: true, timedOut: false, result }; }
    if (!session.customer) { const closed = session.customerPlan && session.customerPlan.length === 0 ? allCustomersFinish(state, session, t) : soldOutFinish(state, session, t); return { finished: true, timedOut: false, soldOut: !!closed.soldOut, result: closed.result }; }
    const expired = queueCustomers(session).filter((customer) => t >= customer.expiresAt);
    for (const customer of expired) leaveCustomer(state, session, t, "timeout", customer);
    if (!session.customer && session.customerPlan && session.customerPlan.length === 0) { const closed = allCustomersFinish(state, session, t); return { finished: true, timedOut: expired.length > 0, result: closed.result }; }
    return { finished: false, timedOut: expired.length > 0, customer: session.customer };
  }

  // ---------- 瀏覽器介面 ----------
  const ART_BASE = "assets/generated/content-r72/";
  const STALL_BOOTH_ART = "assets/generated/content-r79/stall-booth.png";
  function open(state, opts) {
    if (typeof document === "undefined" || !document.body) return { ok: false, reason: "no_dom", message: "目前不能開啟叫賣介面。" };
    const options = opts || {};
    const notify = typeof options.notify === "function" ? options.notify : function () {};
    const save = typeof options.save === "function" ? options.save : function () {};
    const versionQuery = typeof window !== "undefined" && window.FARM_VERSION_QUERY ? window.FARM_VERSION_QUERY : "";
    const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    const old = document.getElementById("r72bStallOverlay"); if (old) old.remove();
    const overlay = document.createElement("div");
    overlay.id = "r72bStallOverlay"; overlay.className = "r72b-overlay";
    overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true"); overlay.setAttribute("aria-label", "擺攤叫賣");
    document.body.appendChild(overlay);
    let session = null; let timer = 0; let lastMessage = "";
    /* R77C 第 10 項：開攤前「今天擺出去的貨」草稿，預設扣掉留給委託的量。 */
    let stallPlanCache = null; let stallDraft = null; let marketCache = null;
    function stallPlan() {
      if (!stallPlanCache) {
        stallPlanCache = reservePlan(state, Date.now()); stallDraft = {};
        for (const row of stallPlanCache) stallDraft[row.id] = defaultStallQty(row);
        const poolById = new Map(unlockedItems(state).map((row) => [row.id, row]));
        marketCache = marketPreview(state, stallPlanCache.map((row) => poolById.get(row.id)).filter(Boolean), Math.random);
      }
      return stallPlanCache;
    }
    function stallTotal() { stallPlan(); return Object.values(stallDraft || {}).reduce((sum, n) => sum + qty(n), 0); }
    /* 開攤前先講清楚這一場最多能招待幾位：擺出的份數加上代幣，用完就收攤。 */
    function stallTotalText() {
      stallPlan();
      const total = stallTotal();
      return total > 0
        ? "一共擺出 " + total + " 份。客人要的貨賣完時，可以用代幣遞（共 " + TOKENS_PER_SESSION + " 枚，只拿一半分）。"
        : "這一場沒有擺出任何貨，至少擺一份才能開始叫賣。";
    }
    function close() { if (timer) clearInterval(timer); timer = 0; overlay.remove(); if (typeof options.onClose === "function") options.onClose(); }
    function shell(inner) {
      overlay.innerHTML = `<div class="r72b-card"><button type="button" class="r72b-close" aria-label="離開擺攤叫賣">×</button>${inner}</div>`;
      overlay.querySelector(".r72b-close").onclick = () => { if (session && !session.finished) notify("這一場還沒結算就離開，剛才用掉的次數不會退回。"); close(); };
    }
    function renderStart(message) {
      const view = statusFor(state, Date.now());
      stallPlan();
      const marketHtml = marketCache && marketCache.hotItems.length ? marketCache.hotItems.map((hot) => `<span class="r78a-hot">${esc(hot.label)}</span>`).join("") : `<span class="r78a-hot">先擺貨，客人才知道能點什麼</span>`;
      const canStart = view.canPlay && stallTotal() > 0;
      shell(`<h2 class="r72b-title">擺攤叫賣</h2>
        <div class="r79a-opening-rules" data-r79a-opening-rules>
          <p class="r78a-market" data-r78a-market><b>今天客人愛什麼（熱門）：</b><span class="r78a-hot-list">${marketHtml}</span></p>
          <p class="r73b-thresholds" data-r73b-thresholds><b>星等：</b>${STAR_THRESHOLDS[0].score} 分一顆、${STAR_THRESHOLDS[1].score} 分兩顆、${STAR_THRESHOLDS[2].score} 分三顆；三顆星還要連續答對 ${THREE_STAR_COMBO} 位、接到 ${THREE_STAR_HOT_SERVED} 位熱門需求。</p>
          <p class="r79a-token-line"><b>代幣：</b>沒貨時可用，共 ${TOKENS_PER_SESSION} 枚，只拿一半分；推薦同口味現貨拿七成分。</p>
        </div>
        ${view.goldenFlag ? `<p class="r72b-owned"><img src="${ART_BASE}golden-flag.png${versionQuery}" alt="">你已經有金色攤位旗了。</p>` : `<p class="r72b-desc">拿到三顆星，就能把限定的金色攤位旗帶回家。</p>`}
        <p class="r72b-status">這一場還可以玩 ${view.attemptsLeft} 次・最高分 ${view.bestScore} 分${view.bestStars ? `・最高 ${view.bestStars} 顆星` : ""}</p>
        ${message ? `<p class="r72b-feedback" role="status">${esc(message)}</p>` : ""}
        <button type="button" class="r72b-primary" data-r72b-start ${canStart ? "" : "disabled"}>${!view.canPlay ? "這一場已經玩完兩次" : stallTotal() <= 0 ? "至少擺一份才能開始" : "開始叫賣（一分鐘）"}</button>
        <section class="r77c-stall-plan" data-r77c-stall-plan><h3>今天擺出去的貨</h3><p class="r72b-desc">預設已把其他委託要用的量留下；客人只會點這裡有擺的貨。</p><p class="r72b-desc r77c-stall-total" data-r77c-stall-total>${esc(stallTotalText())}</p><ul class="r77c-stall-list">${stallPlan().map((row) => `<li class="r77c-stall-row" data-r77c-stall-row="${esc(row.id)}"><span class="r77c-stall-name"><b>${esc(row.name)}</b><small>背包 ${row.stock} 份・${esc(row.reserveText)}</small></span><span class="r77c-stepper"><button type="button" class="r77c-step" data-r77c-minus="${esc(row.id)}" aria-label="少擺一份${esc(row.name)}">－</button><span class="r77c-qty" data-r77c-qty="${esc(row.id)}">擺 ${stallDraft[row.id]} 份</span><button type="button" class="r77c-step" data-r77c-plus="${esc(row.id)}" aria-label="多擺一份${esc(row.name)}">＋</button></span></li>`).join("") || `<li class="r77c-stall-row"><span class="r77c-stall-name"><b>背包還沒有貨</b><small>先準備至少一份貨再開攤。</small></span></li>`}</ul></section>
        <details class="r78a-rules"><summary>詳細規則</summary><p>一場一分鐘，共有 ${CUSTOMER_LIMIT} 位客人；同時兩位排隊，先點客人再點貨。連續答對會加分。${esc(TOKEN_RULE_TEXT)}</p><p>${esc(STAR_FLOOR_RULE_TEXT)}</p></details>`);
      overlay.querySelectorAll("[data-r77c-minus],[data-r77c-plus]").forEach((button) => { button.onclick = () => {
        const id = button.dataset.r77cMinus || button.dataset.r77cPlus; const row = stallPlan().find((r) => r.id === id); if (!row) return;
        const delta = button.dataset.r77cMinus ? -1 : 1;
        stallDraft[id] = Math.max(0, Math.min(row.stock, qty(stallDraft[id]) + delta));
        const qtyNode = overlay.querySelector(`[data-r77c-qty="${id}"]`); if (qtyNode) qtyNode.textContent = "擺 " + stallDraft[id] + " 份";
        const totalNode = overlay.querySelector("[data-r77c-stall-total]"); if (totalNode) totalNode.textContent = stallTotalText();
        const startNode = overlay.querySelector("[data-r72b-start]"); if (startNode && view.canPlay) { startNode.disabled = stallTotal() <= 0; startNode.textContent = startNode.disabled ? "至少擺一份才能開始" : "開始叫賣（一分鐘）"; }
      }; });
      const start = overlay.querySelector("[data-r72b-start]");
      if (start) start.onclick = () => {
        const started = startSession(state, Date.now(), undefined, { allotment: Object.assign({}, stallDraft || {}), reservePlan: stallPlanCache, market: marketCache });
        if (!started.ok) { renderStart(started.message); notify(started.message); return; }
        session = started.session; lastMessage = started.message; save();
        // R73B（第 5 項）：開始叫賣時關閉祭典攤位視窗，避免視窗疊在一起。
        if (typeof options.onStart === "function") options.onStart();
        renderGame();
        timer = setInterval(() => {
          const ticked = tickSession(state, session, Date.now());
          if (ticked.finished) { clearInterval(timer); timer = 0; save(); renderResult(ticked.result || session.result); }
          else if (ticked.timedOut) { lastMessage = "顧客等太久先離開了，下一位已經走近攤位。"; renderGame(); }
          else if (session.customer && session.customer.readyAt && Date.now() >= session.customer.readyAt && overlay.querySelector("[data-r72b-item]:disabled")) renderGame();
          else renderClock();
        }, 250);
      };
    }
    function renderClock() {
      if (!session) return;
      const remain = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000));
      const clock = overlay.querySelector("[data-r72b-clock]"); if (clock) clock.textContent = "剩 " + remain + " 秒";
      overlay.querySelectorAll("[data-r79a-wait]").forEach((wait) => {
        const customer = queueCustomers(session).find((row) => row.queueId === wait.dataset.r79aWait);
        if (!customer) return;
        const remainMs = Math.max(0, customer.expiresAt - Date.now());
        wait.textContent = customer.readyAt > Date.now() ? "正在走近攤位" : "還能等 " + Math.ceil(remainMs / 1000) + " 秒";
        const bar = overlay.querySelector(`[data-r79a-patience="${customer.queueId}"]`);
        if (bar) bar.style.width = Math.max(0, Math.min(100, remainMs / (qty(customer.patienceMs) || CUSTOMER_TIMEOUT_MS) * 100)) + "%";
      });
    }
    function renderGame() {
      if (!session || !session.customer) return;
      const customer = session.customer;
      const remain = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000));
      const arriving = customer.readyAt && Date.now() < customer.readyAt;
      const visibleRows = Array.isArray(session.offeredIds) ? session.pool.filter((row) => session.offeredIds.includes(row.id)) : session.pool;
      const buttons = visibleRows.map((row) => {
        const card = itemCard(state, row);
        const kind = row.kind === "meal" ? "料理" : row.kind === "product" ? "產品" : row.kind === "forage" ? "採集" : "作物";
        const stallLeft = stallStockOf(state, session, row);
        const canToken = stallLeft <= 0 && qty(session.tokensLeft) > 0 && matchesDemand(session, row.id, customer);
        const cardState = stallLeft > 0 ? "stock" : canToken ? "token" : "soldout";
        const count = cardState === "stock" ? `有貨・還剩 ${stallLeft} 份` : cardState === "token" ? "用代幣・只拿一半分" : "賣完";
        const chips = card.tasteLabels.length ? card.tasteLabels.map((label) => `<span class="r73b-taste">${esc(label)}</span>`).join("") : "";
        const isSubstitute = substituteMatch(state, session, row.id, customer);
        return `<button type="button" class="r72b-item r73b-item" data-r72b-item="${esc(row.id)}" data-r73b-mode="${card.mode}" data-r78a-card-state="${cardState}" data-r79a-substitute="${isSubstitute ? "true" : "false"}" data-r73b-tastes="${esc((row.tastes || []).join(","))}" ${arriving || cardState === "soldout" ? "disabled" : ""}><img class="r73b-item-icon" src="${esc(card.icon)}${versionQuery}" alt="" width="32" height="32"><span class="r73b-item-main"><b>${esc(row.name)}</b><small>${kind}・<span class="r79a-count">${count}</span>${isSubstitute ? "・可替代" : ""}</small><span class="r73b-tastes">${chips}</span></span></button>`;
      }).join("");
      // R74B（第 4 項）：回饋改放顧客卡上的短動畫與加分飄字；回饋列只留操作提示，
      // 新顧客出現時 session.feedback 已在 spawnNext 清除，不會留上一位的訊息。
      const feedback = session.feedback;
      const floatHtml = feedback ? `<span class="r74b-float r74b-float-${esc(feedback.kind)}" data-r74b-feedback="${esc(feedback.kind)}">${esc(feedback.kind === "good" ? "+" + feedback.gained + " 分" : (feedback.text || "不是這一樣"))}</span>` : "";
      const queueHtml = queueCustomers(session).map((queued) => {
        const selected = queued === customer;
        const waitMs = Math.max(0, queued.expiresAt - Date.now());
        return `<button type="button" class="r72b-customer r79a-customer${selected ? " is-selected" : ""}" data-r79a-customer="${esc(queued.queueId)}" aria-pressed="${selected ? "true" : "false"}"><img class="r72b-portrait" src="${ART_BASE}${esc(queued.art)}${versionQuery}" alt="${esc(queued.npcName)}"><span class="r79a-customer-copy"><b>${esc(queued.npcName)}</b><span class="r78a-customer-tags"${selected ? " data-r78a-customer-tags" : ""}>${(queued.tags || []).slice(0, 2).map((tag) => `<span>${esc(tag)}</span>`).join("")}</span><span class="r72b-bubble">${esc(demandText(state, session, queued))}</span><span class="r79a-patience" aria-label="耐心"><i data-r79a-patience="${esc(queued.queueId)}" style="width:${Math.max(0, Math.min(100, waitMs / (qty(queued.patienceMs) || CUSTOMER_TIMEOUT_MS) * 100))}%"></i></span><small data-r79a-wait="${esc(queued.queueId)}">${queued.readyAt > Date.now() ? "正在走近攤位" : "還能等 " + Math.ceil(waitMs / 1000) + " 秒"}</small></span>${selected ? floatHtml : ""}</button>`;
      }).join("");
      shell(`<div class="r72b-head"><h2 class="r72b-title">擺攤叫賣</h2><span class="r72b-clock" data-r72b-clock>剩 ${remain} 秒</span></div>
        <div class="r72b-score"><span>分數 <b>${session.score}</b></span><span>連續答對 <b>${session.combo}</b> 次</span><span data-r74b-tokens>代幣已用 <b>${qty(session.tokenUses)}</b>・剩 <b>${qty(session.tokensLeft)}</b> 枚</span></div>
        <section class="r79a-stall-scene" data-r79a-stall-scene><div class="r79a-booth"><img data-r79a-booth-art src="${STALL_BOOTH_ART}${versionQuery}" alt="像素攤位"><span>木攤與布棚</span></div><div class="r79a-queue" data-r79a-queue>${queueHtml}</div></section>
        <p class="r72b-feedback" role="status">先點要招呼的客人，再點要給的貨。</p>
        <div class="r72b-items">${buttons}</div>
        <p class="r72b-desc">中途離開不會結算，剛才用掉的次數也不會退回。</p>`);
      const boothArt = overlay.querySelector("[data-r79a-booth-art]");
      if (boothArt) { boothArt.onload = () => boothArt.parentElement.classList.add("has-art"); boothArt.onerror = () => { boothArt.hidden = true; boothArt.parentElement.classList.remove("has-art"); }; if (boothArt.complete && boothArt.naturalWidth) boothArt.parentElement.classList.add("has-art"); }
      overlay.querySelectorAll("[data-r79a-customer]").forEach((button) => { button.onclick = () => { selectCustomer(session, button.dataset.r79aCustomer); renderGame(); }; });
      overlay.querySelectorAll("[data-r72b-item]").forEach((button) => { button.onclick = () => {
        serve(state, session, button.dataset.r72bItem, Date.now());
        save();
        if (session.finished) { if (timer) clearInterval(timer); timer = 0; renderResult(session.result); return; }
        renderGame();
      }; });
    }
    function renderResult(result) {
      if (!result) { renderStart("這一場已經結束了。"); return; }
      const view = statusFor(state, Date.now());
      const stars = "★".repeat(result.stars) + "☆".repeat(Math.max(0, 3 - result.stars));
      const grantedText = result.granted && (result.granted.coins || result.granted.medals || result.granted.goldenFlag)
        ? `這次補給：金幣 ${result.granted.coins} 枚${result.granted.medals ? `、祭典獎章 ${result.granted.medals} 枚` : ""}${result.granted.goldenFlag ? "、金色攤位旗" : ""}。`
        : result.stars > 0 ? "這次沒有新的獎勵，先前已經照最高星領過了。" : "這一場的保底 5 金已經領過了，下一場再接再厲。";
      shell(`<h2 class="r72b-title">這一場結算</h2>
        <p class="r78a-end-reason" data-r78a-end-reason role="status">結束原因：${esc(result.endReasonText)}</p>
        <p class="r72b-stars" aria-label="${result.stars} 顆星">${stars}</p>
        ${starFloorText(result) ? `<p class="r78a-star-floor" data-r78a-star-floor>${esc(starFloorText(result))}</p>` : ""}
        ${result.stars >= 3 ? `<img class="r72b-flag" src="${ART_BASE}golden-flag.png${versionQuery}" alt="金色攤位旗">` : ""}
        ${result.soldOut ? `<span data-r77c-sold-out hidden>${esc(SOLD_OUT_TEXT)}</span>` : ""}
        <p class="r72b-status" data-r78a-counts>${result.score} 分・答對 ${result.served} 位・答錯 ${qty(result.wrong)} 位・錯過 ${qty(result.timedOut)} 位・沒輪到 ${qty(result.notReached)} 位・共 ${qty(result.customerTotal)} 位・最高連續答對 ${result.bestCombo} 次</p>
        <p class="r79a-max-score" data-r79a-max-score>這一場最多可以拿 ${qty(result.maxPossibleScore)} 分；你拿到 ${qty(result.score)} 分。</p>
        <p class="r76b-loss" data-r76b-loss>${esc(result.mainLoss || (result.loss && result.loss.display) || "主要失分：沒有明顯失分")}・代幣用了 ${qty(result.tokenUses)} 次（每場 ${result.tokensPerSession || TOKENS_PER_SESSION} 枚，用代幣答對只拿一半分）</p>
        <p class="r73b-thresholds" data-r73b-thresholds>星等門檻：${starThresholdText()}</p>
        <p class="r73b-advice" data-r73b-advice>${esc(result.advice || adviceFor(result))}</p>
        <p class="r72b-status">${esc(grantedText)}這一場還可以玩 ${view.attemptsLeft} 次・最高分 ${view.bestScore} 分</p>
        <details class="r77c-customers" data-r77c-customers open><summary>這一場的客人（${qty(result.customerTotal)} 位）</summary><ul>${(result.customers || []).map((rec) => `<li class="r77c-customer-row"><b>${esc(rec.npcName)}</b><span>需求：${esc(rec.want)}<span class="r79a-legacy-label">想要：</span></span><span>交付：${esc((rec.givenNames || []).join("、") || "沒有交付")}</span><span>基本 ${qty(rec.baseScore)} 分・熱門加分 ${qty(rec.hotBonus)} 分・連續答對加分 ${qty(rec.comboBonus)} 分・代幣少 ${qty(rec.tokenPenalty)} 分${qty(rec.substitutePenalty) ? "・替代品少 " + qty(rec.substitutePenalty) + " 分" : ""}・合計 ${qty(rec.gained)} 分</span><span>${esc(rec.outcome)}${rec.diff ? "・" + esc(rec.diff) : ""}</span></li>`).join("") || "<li>這一場沒有排到客人。</li>"}</ul></details>
        ${result.bestSeller ? `<p class="r72b-status" data-r77c-best-seller>這一場賣得最好：${esc(result.bestSeller.name)}（${qty(result.bestSeller.count)} 份）</p>` : ""}
        <div class="r72b-actions"><button type="button" class="r72b-primary" data-r72b-again ${view.canPlay ? "" : "disabled"}>再玩一次</button><button type="button" class="r72b-secondary" data-r72b-done>回到攤位</button></div>`);
      /* 再玩一次時重算擺出清單：上一場賣掉的貨已經不在背包裡。 */
      const again = overlay.querySelector("[data-r72b-again]"); if (again) again.onclick = () => { stallPlanCache = null; marketCache = null; renderStart(""); };
      const done = overlay.querySelector("[data-r72b-done]"); if (done) done.onclick = () => { if (typeof options.onReturnToStall === "function") options.onReturnToStall(); close(); };
      notify(result.message);
    }
    const view = statusFor(state, Date.now());
    if (!view.active) { notify("收穫祭還沒開始，祭典攤位還沒開放擺攤叫賣。"); overlay.remove(); return { ok: false, reason: "not_active", message: "收穫祭還沒開始，祭典攤位還沒開放擺攤叫賣。" }; }
    renderStart("");
    return { ok: true };
  }

  const FestivalStallR72 = {
    DURATION_MS, CUSTOMER_TIMEOUT_MS, CUSTOMER_ARRIVE_MS, MAX_ATTEMPTS_PER_ROUND, BASE_SCORE, HOT_SCORE_BONUS, CUSTOMERS, CUSTOMER_TYPES,
    QUEUE_SIZE, CUSTOMER_LIMIT, SUBSTITUTE_SCORE_RATE,
    TASTE_LABEL, TASTE_CHIP, STAR_THRESHOLDS, STOCK_DEMAND_RATE, TOKENS_PER_SESSION, TOKEN_SCORE_RATE, TOKEN_RULE_TEXT,
    ensure, festivalInfo, statusFor, unlockedItems, stockOf, totalStock, stockedItems,
    reservePlan, defaultStallQty, marketPreview, marketItem, stallStockOf, demandAnswerable,
    tastesOf, tasteLabelsOf, iconFor, itemMode, itemCard, starThresholdText, starFloorText, adviceFor, lossSummary,
    makeCustomer, matchesDemand, substituteMatch, demandText, queueCustomers, selectCustomer, startSession, serve, tickSession, finishSession,
    starsForScore, starsForSession, rewardForStars, open,
  };
  if (typeof window !== "undefined") window.FestivalStallR72 = FestivalStallR72;
  if (typeof module !== "undefined" && module.exports) module.exports = FestivalStallR72;
})(typeof window !== "undefined" ? window : globalThis);
