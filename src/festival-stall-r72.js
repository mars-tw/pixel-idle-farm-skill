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

  const DURATION_MS = 60000;
  const CUSTOMER_TIMEOUT_MS = 8000;
  const CUSTOMER_ARRIVE_MS = 1000;
  const MAX_ATTEMPTS_PER_ROUND = 2;
  const BASE_SCORE = 10;
  const COMBO_STEP = 1;
  const COMBO_CAP = 6;
  const CUSTOMERS = [
    { id: "mayor", name: "鎮長葛瑞", art: "customer-mayor.png" },
    { id: "elder", name: "老農班伯", art: "customer-elder.png" },
    { id: "merchant", name: "蘿拉", art: "customer-merchant.png" },
    { id: "child", name: "圖圖", art: "customer-child.png" },
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
    { stars: 1, score: 60 },
    { stars: 2, score: 140 },
    { stars: 3, score: 240 },
  ];
  function starThresholdText() {
    return "一顆星 " + STAR_THRESHOLDS[0].score + " 分・二顆星 " + STAR_THRESHOLDS[1].score + " 分・三顆星 " + STAR_THRESHOLDS[2].score + " 分";
  }
  // R73B（第 5 項）：結算只留一句改善建議。
  function adviceFor(result) {
    const score = qty(result && result.score);
    const stars = qty(result && result.stars);
    if (stars >= 3) return "這場已經拿到三顆星，下次保持連續答對、別讓顧客等太久，就能穩穩守住。";
    const next = STAR_THRESHOLDS.find((row) => score < row.score);
    const gap = next ? next.score - score : 0;
    return "再多 " + gap + " 分就能拿到" + (next ? next.stars : 3) + "顆星，連續答對可以多拿分，別讓顧客等太久。";
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
  function consumeOne(state, row) {
    if (row.kind === "meal") { if (qty(state.adventure.meals[row.id]) > 0) state.adventure.meals[row.id] -= 1; return; }
    if (!state.storage) state.storage = { items: {} };
    if (!state.storage.items) state.storage.items = {};
    if (qty(state.storage.items[row.id]) > 0) { state.storage.items[row.id] -= 1; if (state.storage.items[row.id] <= 0) delete state.storage.items[row.id]; }
  }
  // R73B（第 4 項）：session.mode 只保留作整場尚有存貨的概覽（相容舊紀錄），
  // 實際扣貨與否一律由 serve 依該物品當下存貨逐項決定，不再整場切換。
  function syncMode(state, session) {
    session.mode = totalStock(state, session.pool) <= 0 ? "token" : "stock";
    return session.mode;
  }

  // R74B（第 4 項）：背包有貨時，顧客需求至少 70% 要能用有貨物品滿足。
  // 作法是 80% 的需求直接從有貨清單出題（含口味題，只挑有貨物品有的口味），
  // 其餘才從全部已解鎖清單出題；沒貨時維持原本從全部清單出題。
  const STOCK_DEMAND_RATE = 0.8;
  function stockedItems(state, rows) { return (rows || []).filter((row) => stockOf(state, row) > 0); }
  function makeCustomer(state, pool, now, rng) {
    const rows = Array.isArray(pool) && pool.length ? pool : unlockedItems(state);
    if (!rows.length) return null;
    const random = typeof rng === "function" ? rng : Math.random;
    const person = pick(random, CUSTOMERS);
    const stocked = stockedItems(state, rows);
    const source = stocked.length && random() < STOCK_DEMAND_RATE ? stocked : rows;
    const tastes = [...new Set(source.flatMap((row) => row.tastes))].filter((taste) => source.some((row) => row.tastes.includes(taste)));
    let demand;
    if (tastes.length && random() < 0.4) {
      const taste = pick(random, tastes);
      demand = { kind: "taste", taste, label: "想吃" + (TASTE_LABEL[taste] || "甜的") };
    } else {
      const row = pick(random, source);
      demand = { kind: "item", itemId: row.id, label: "我要" + row.name };
    }
    return { npcId: person.id, npcName: person.name, art: person.art, demand, startedAt: at(now), readyAt: at(now) + CUSTOMER_ARRIVE_MS, expiresAt: at(now) + CUSTOMER_ARRIVE_MS + CUSTOMER_TIMEOUT_MS };
  }
  function matchesDemand(session, itemId) {
    if (!session || !session.customer) return false;
    const row = session.pool.find((item) => item.id === itemId);
    if (!row) return false;
    const demand = session.customer.demand;
    return demand.kind === "item" ? demand.itemId === itemId : row.tastes.includes(demand.taste);
  }
  function spawnNext(state, session, now, rng) {
    // R74B（第 4 項）：新顧客出現就清除上一位的回饋，不讓舊訊息留到下一位。
    session.feedback = null;
    session.customer = makeCustomer(state, session.pool, now, rng || session.rng);
    syncMode(state, session);
    return session.customer;
  }
  function startSession(state, now, rng) {
    const t = at(now);
    const { info, record } = roundRecord(state, t, true);
    if (!info.status.unlocked || !info.status.active || !info.roundKey) return { ok: false, reason: "not_active", message: "收穫祭還沒開始，祭典攤位還沒開放擺攤叫賣。" };
    if (record.attemptsUsed >= MAX_ATTEMPTS_PER_ROUND) return { ok: false, reason: "attempts_exhausted", message: "這一場已經玩過兩次了，等下一場收穫祭再來擺攤。" };
    const pool = unlockedItems(state);
    if (!pool.length) return { ok: false, reason: "no_items", message: "還沒有已解鎖的作物或料理可以叫賣。" };
    record.attemptsUsed += 1;
    state.adventure.r72b.totalPlays += 1;
    const session = {
      roundKey: info.roundKey, startedAt: t, endsAt: t + DURATION_MS,
      score: 0, combo: 0, bestCombo: 0, served: 0, missed: 0, spawned: 0,
      tokenUses: 0, feedback: null,
      mode: totalStock(state, pool) <= 0 ? "token" : "stock",
      pool, customer: null, finished: false, result: null, rng: typeof rng === "function" ? rng : Math.random,
    };
    spawnNext(state, session, t, session.rng); session.spawned = 1;
    return { ok: true, session, message: "擺攤叫賣開始，點符合的東西遞給顧客；沒貨的那一樣會用叫賣代幣結算。" };
  }
  function starsForScore(score) { const s = qty(score); return s >= 240 ? 3 : s >= 140 ? 2 : s >= 60 ? 1 : 0; /* R72 整合：實機一分鐘答對 7 位約 74 分，原 80 分門檻太嚴，下修為 60／140／240 */ }
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
    session.finished = true; session.customer = null;
    const stars = starsForScore(session.score);
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
    }
    if (granted.coins > 0) { state.coins = qty(state.coins) + granted.coins; if (!state.stats) state.stats = {}; state.stats.totalCoinsEarned = qty(state.stats.totalCoinsEarned) + granted.coins; }
    if (granted.medals > 0) {
      const festival = state.adventure.r61 && state.adventure.r61.festival;
      if (festival) { festival.medals = Math.min(999, qty(festival.medals) + granted.medals); if (granted.goldenFlag) festival.decorations = Math.min(999, qty(festival.decorations) + 1); }
    }
    const reward = rewardForStars(stars);
    const result = {
      ok: true, finished: true, score: session.score, stars, served: session.served, missed: session.missed,
      bestCombo: session.bestCombo, mode: session.mode, tokenUses: qty(session.tokenUses), reward, granted, upgraded,
      goldenFlag: !!state.adventure.r72b.goldenFlag,
      message: stars === 0 ? (granted.coins > 0 ? "沒拿到星星也沒關係，這次已經很棒了，保底 5 金先收下，下次多答對幾位就能拿到星星。" : "沒拿到星星也沒關係，這次已經很棒了，下次多答對幾位就能拿到星星。") : upgraded ? `拿到 ${stars} 顆星，獎勵已補到這一場的最高紀錄。` : "這一場的獎勵已經照先前最高星領過了，這次不重複給。",
    };
    result.advice = adviceFor(result);
    session.result = result;
    return result;
  }
  function leaveCustomer(state, session, now, reason) {
    session.combo = 0; session.missed += 1;
    spawnNext(state, session, at(now), session.rng); session.spawned += 1;
    // R74B（第 4 項）：答錯或逾時的即時回饋，給顧客卡飄字用；下一位再離開時會被清除換新。
    session.feedback = { kind: "bad", gained: 0, text: reason === "timeout" ? "等太久了" : "不是這一樣", spawned: session.spawned };
    return { ok: false, reason, timedOut: reason === "timeout", customer: session.customer, feedback: session.feedback };
  }
  function serve(state, session, itemId, now) {
    const t = at(now);
    if (!session || session.finished) return { ok: false, reason: "not_playing", message: "這一場叫賣已經結束了。" };
    if (t >= session.endsAt) { const result = finishSession(state, session, t); return { ok: false, reason: "time_up", message: "一分鐘到了，先結算這一場。", result }; }
    if (!session.customer) spawnNext(state, session, t, session.rng);
    if (session.customer.readyAt && t < session.customer.readyAt) return { ok: false, reason: "arriving", message: "顧客還在走近攤位，等他站好再遞。" };
    if (t >= session.customer.expiresAt) { const left = leaveCustomer(state, session, t, "timeout"); return { ...left, message: "顧客等太久先離開了，下一位已經走近攤位。" }; }
    const row = session.pool.find((item) => item.id === itemId);
    if (!row) return { ok: false, reason: "unknown_item", message: "這件東西不在已解鎖的叫賣清單裡。" };
    if (!matchesDemand(session, itemId)) { const left = leaveCustomer(state, session, t, "wrong_item"); return { ...left, message: "這不是顧客想要的，他先去逛逛別攤了。" }; }
    // R73B（第 4 項）：逐項判斷——這一格有貨就扣背包，沒貨才用代幣，不影響其他格。
    const usesToken = stockOf(state, row) <= 0;
    if (!usesToken) consumeOne(state, row);
    session.combo += 1; session.bestCombo = Math.max(session.bestCombo, session.combo);
    const gained = BASE_SCORE + Math.min(COMBO_CAP, (session.combo - 1) * COMBO_STEP);
    session.score += gained; session.served += 1;
    // R74B（第 4 項）：代幣結算次數累計，分數列顯示「代幣 N」。
    if (usesToken) session.tokenUses = qty(session.tokenUses) + 1;
    spawnNext(state, session, t, session.rng); session.spawned += 1;
    // R74B（第 4 項）：答對的即時回饋（加分飄字），下一位顧客離開或答對時會換掉。
    session.feedback = { kind: "good", gained, text: "+" + gained + " 分", spawned: session.spawned };
    syncMode(state, session);
    return { ok: true, gained, score: session.score, combo: session.combo, mode: usesToken ? "token" : "stock", usesToken, tokenUses: qty(session.tokenUses), feedback: session.feedback, customer: session.customer, message: usesToken ? "答對了，這一樣背包沒貨，用叫賣代幣結算，沒有消耗背包。" : "答對了，顧客開心地收下了。" };
  }
  function tickSession(state, session, now) {
    const t = at(now);
    if (!session || session.finished) return { finished: !!(session && session.finished), timedOut: false };
    if (t >= session.endsAt) { const result = finishSession(state, session, t); return { finished: true, timedOut: false, result }; }
    if (session.customer && t >= session.customer.expiresAt) { leaveCustomer(state, session, t, "timeout"); return { finished: false, timedOut: true, customer: session.customer }; }
    return { finished: false, timedOut: false };
  }

  // ---------- 瀏覽器介面 ----------
  const ART_BASE = "assets/generated/content-r72/";
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
    function close() { if (timer) clearInterval(timer); timer = 0; overlay.remove(); if (typeof options.onClose === "function") options.onClose(); }
    function shell(inner) {
      overlay.innerHTML = `<div class="r72b-card"><button type="button" class="r72b-close" aria-label="離開擺攤叫賣">×</button>${inner}</div>`;
      overlay.querySelector(".r72b-close").onclick = () => { if (session && !session.finished) notify("這一場還沒結算就離開，剛才用掉的次數不會退回。"); close(); };
    }
    function renderStart(message) {
      const view = statusFor(state, Date.now());
      shell(`<h2 class="r72b-title">擺攤叫賣</h2>
        <p class="r72b-desc">一場一分鐘。顧客會說想要的作物、料理或口味，點符合的東西遞給他。連續答對會多給分，答錯或等太久，顧客就會先離開。</p>
        <p class="r72b-desc">每一格自己算：有貨就扣背包，沒貨的那一格才用叫賣代幣結算，只算分、不消耗背包。每一場收穫祭可以玩兩次，獎勵照最高的那一場補齊。</p>
        <p class="r73b-thresholds" data-r73b-thresholds>星等門檻：${starThresholdText()}</p>
        ${view.goldenFlag ? `<p class="r72b-owned"><img src="${ART_BASE}golden-flag.png${versionQuery}" alt="">你已經有金色攤位旗了。</p>` : `<p class="r72b-desc">拿到三顆星，就能把限定的金色攤位旗帶回家。</p>`}
        <p class="r72b-status">這一場還可以玩 ${view.attemptsLeft} 次・最高分 ${view.bestScore} 分${view.bestStars ? `・最高 ${view.bestStars} 顆星` : ""}</p>
        ${message ? `<p class="r72b-feedback" role="status">${esc(message)}</p>` : ""}
        <button type="button" class="r72b-primary" data-r72b-start ${view.canPlay ? "" : "disabled"}>${view.canPlay ? "開始叫賣（一分鐘）" : "這一場已經玩完兩次"}</button>`);
      const start = overlay.querySelector("[data-r72b-start]");
      if (start) start.onclick = () => {
        const started = startSession(state, Date.now());
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
      const wait = overlay.querySelector("[data-r72b-wait]");
      if (wait && session.customer) wait.textContent = "這位顧客還等 " + Math.max(0, Math.ceil((session.customer.expiresAt - Date.now()) / 1000)) + " 秒";
    }
    function renderGame() {
      if (!session || !session.customer) return;
      const customer = session.customer;
      const remain = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000));
      const arriving = customer.readyAt && Date.now() < customer.readyAt;
      const buttons = session.pool.map((row) => {
        const card = itemCard(state, row);
        const kind = row.kind === "meal" ? "料理" : row.kind === "product" ? "產品" : row.kind === "forage" ? "採集" : "作物";
        const count = card.usesToken ? "沒貨，用代幣" : `背包有 ${card.stock} 份`;
        // R74B（第 4 項）：無口味物品不顯示任何非口味標籤，沒有口味就不渲染標籤。
        const chips = card.tasteLabels.length ? card.tasteLabels.map((label) => `<span class="r73b-taste">${esc(label)}</span>`).join("") : "";
        return `<button type="button" class="r72b-item r73b-item" data-r72b-item="${esc(row.id)}" data-r73b-mode="${card.mode}" data-r73b-tastes="${esc((row.tastes || []).join(","))}" ${arriving ? "disabled" : ""}><img class="r73b-item-icon" src="${esc(card.icon)}${versionQuery}" alt="" width="32" height="32"><span class="r73b-item-main"><b>${esc(row.name)}</b><small>${kind}・${count}</small><span class="r73b-tastes">${chips}</span></span></button>`;
      }).join("");
      // R74B（第 4 項）：回饋改放顧客卡上的短動畫與加分飄字；回饋列只留操作提示，
      // 新顧客出現時 session.feedback 已在 spawnNext 清除，不會留上一位的訊息。
      const feedback = session.feedback;
      const floatHtml = feedback ? `<span class="r74b-float r74b-float-${esc(feedback.kind)}" data-r74b-feedback="${esc(feedback.kind)}">${esc(feedback.kind === "good" ? "+" + feedback.gained + " 分" : (feedback.text || "不是這一樣"))}</span>` : "";
      shell(`<div class="r72b-head"><h2 class="r72b-title">擺攤叫賣</h2><span class="r72b-clock" data-r72b-clock>剩 ${remain} 秒</span></div>
        <div class="r72b-score"><span>分數 <b>${session.score}</b></span><span>連續答對 <b>${session.combo}</b> 次</span><span data-r74b-tokens>代幣 <b>${qty(session.tokenUses)}</b></span></div>
        <div class="r72b-customer${feedback ? " r74b-customer-" + esc(feedback.kind) : ""}"><img class="r72b-portrait" src="${ART_BASE}${esc(customer.art)}${versionQuery}" alt="${esc(customer.npcName)}">
          <div><b>${esc(customer.npcName)}</b><p class="r72b-bubble">${esc(customer.demand.label)}</p><small data-r72b-wait>這位顧客還等 ${Math.max(0, Math.ceil((customer.expiresAt - Date.now()) / 1000))} 秒</small></div>${floatHtml}</div>
        <p class="r72b-feedback" role="status">點下面符合的東西，遞給顧客。</p>
        <div class="r72b-items">${buttons}</div>
        <p class="r72b-desc">中途離開不會結算，剛才用掉的次數也不會退回。</p>`);
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
        <p class="r72b-stars" aria-label="${result.stars} 顆星">${stars}</p>
        ${result.stars >= 3 ? `<img class="r72b-flag" src="${ART_BASE}golden-flag.png${versionQuery}" alt="金色攤位旗">` : ""}
        <p class="r72b-status">${result.score} 分・答對 ${result.served} 位・錯過 ${result.missed} 位・最高連續答對 ${result.bestCombo} 次</p>
        <p class="r73b-thresholds" data-r73b-thresholds>星等門檻：${starThresholdText()}</p>
        <p class="r73b-advice" data-r73b-advice>${esc(result.advice || adviceFor(result))}</p>
        <p class="r72b-status">${esc(grantedText)}這一場還可以玩 ${view.attemptsLeft} 次・最高分 ${view.bestScore} 分</p>
        <div class="r72b-actions"><button type="button" class="r72b-primary" data-r72b-again ${view.canPlay ? "" : "disabled"}>再玩一次</button><button type="button" class="r72b-secondary" data-r72b-done>回到攤位</button></div>`);
      const again = overlay.querySelector("[data-r72b-again]"); if (again) again.onclick = () => renderStart("");
      const done = overlay.querySelector("[data-r72b-done]"); if (done) done.onclick = () => { if (typeof options.onReturnToStall === "function") options.onReturnToStall(); close(); };
      notify(result.message);
    }
    const view = statusFor(state, Date.now());
    if (!view.active) { notify("收穫祭還沒開始，祭典攤位還沒開放擺攤叫賣。"); overlay.remove(); return { ok: false, reason: "not_active", message: "收穫祭還沒開始，祭典攤位還沒開放擺攤叫賣。" }; }
    renderStart("");
    return { ok: true };
  }

  const FestivalStallR72 = {
    DURATION_MS, CUSTOMER_TIMEOUT_MS, CUSTOMER_ARRIVE_MS, MAX_ATTEMPTS_PER_ROUND, BASE_SCORE, CUSTOMERS,
    TASTE_LABEL, TASTE_CHIP, STAR_THRESHOLDS, STOCK_DEMAND_RATE,
    ensure, festivalInfo, statusFor, unlockedItems, stockOf, totalStock, stockedItems,
    tastesOf, tasteLabelsOf, iconFor, itemMode, itemCard, starThresholdText, adviceFor,
    makeCustomer, matchesDemand, startSession, serve, tickSession, finishSession,
    starsForScore, rewardForStars, open,
  };
  if (typeof window !== "undefined") window.FestivalStallR72 = FestivalStallR72;
  if (typeof module !== "undefined" && module.exports) module.exports = FestivalStallR72;
})(typeof window !== "undefined" ? window : globalThis);
