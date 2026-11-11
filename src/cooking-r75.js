/* R75B：第 7～8 項——灶台看火候料理小遊戲、三個開場選擇的持續影響、手札「我做過的選擇」。
   純邏輯可由 Node 載入測試；瀏覽器段只透過既有 AdventureAPI / FarmWorld / MidgameR66 介面接線。 */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const C = isNode ? require("./config.js") : (root.CONFIG || root);
  const A = isNode ? require("./adventure.js") : (root.AdventureAPI || null);

  const DURATION_MS = 12000;
  const GOLD_MIN = 42;
  const GOLD_MAX = 68;
  const START_HEAT = 55;
  const DECAY_PER_SEC = 5.2;
  const STEP_HEAT = 16;
  const GRADE_ORDER = ["home", "tasty", "perfect"];
  const GRADES = {
    home: { id: "home", label: "家常", durationMult: 1, favorBonus: 0 },
    tasty: { id: "tasty", label: "好吃", durationMult: 1.25, favorBonus: 0 },
    perfect: { id: "perfect", label: "絕品", durationMult: 1.5, favorBonus: 1 },
  };
  const FALLBACK_RECIPE_IDS = ["rustic_bread", "baked_carrot", "mint_tea", "wheat_carrot_pancake", "carrot_wheat_stew", "bamber_rain_soup", "tomato_harvest_stew", "strawberry_market_tart", "carrot_trail_soup", "riverside_harvest_platter"];

  const CHOICE_DEFS = [
    { storyId: "mayor_welcome", npcId: "mayor", npcName: "鎮長葛瑞", question: "第一格種下去以前，想先從哪裡開始？", options: {
      farm: { answer: "我先去種田", effectId: "mayor_daily_seed", effectText: "農舍門口多一袋打開的小麥種子，每天送 1 包小麥種子。" },
      town: { answer: "先聽你講鎮上的事", effectId: "mayor_quest_coins", effectText: "鎮長每日委託的金幣多一成，委託卡上會寫明原因。" },
    } },
    { storyId: "elder_wheat", npcId: "elder", npcName: "老農班伯", question: "你想先賣，還是先留種？", options: {
      sell: { answer: "先賣一小袋", effectId: "elder_order_coins", effectText: "老農班伯的河畔委託金幣多一成。" },
      seed: { answer: "先留一包種子", effectId: "elder_advice_seed", effectText: "每天向老農班伯請教時，多拿 1 包當季種子。" },
    } },
    { storyId: "merchant_hello", npcId: "merchant", npcName: "蘿拉", question: "你想把牌子擺得醒目，還是先問客人喜歡什麼？", options: {
      sign: { answer: "先把農場牌掛起來", effectId: "merchant_order_coins", effectText: "農場入口立起一塊招牌，蘿拉的河畔委託金幣多一成。" },
      listen: { answer: "先聽客人想買什麼", effectId: "merchant_two_specials", effectText: "蘿拉的今日特價從一樣變兩樣。" },
    } },
  ];

  function isObject(value) { return !!value && typeof value === "object" && !Array.isArray(value); }
  function clampHeat(value) { return Math.max(0, Math.min(100, Number.isFinite(value) ? value : START_HEAT)); }
  function gradeRank(id) { return GRADE_ORDER.indexOf(id); }
  function dayKeyOf(now) { return new Date(Number.isFinite(now) ? now : 0).toISOString().slice(0, 10); }

  function gradeForRatio(ratio) {
    const r = Number.isFinite(ratio) ? ratio : 0;
    if (r >= 0.7) return "perfect";
    if (r >= 0.4) return "tasty";
    return "home";
  }

  /* 火候小遊戲的一局：指針就是火力，火會慢慢變小，添柴加一段、掀蓋降一段。 */
  function createFireSession(options) {
    const opts = isObject(options) ? options : {};
    const durationMs = Number.isFinite(opts.durationMs) && opts.durationMs > 0 ? Math.floor(opts.durationMs) : DURATION_MS;
    let heat = clampHeat(Number.isFinite(opts.startHeat) ? opts.startHeat : START_HEAT);
    let elapsedMs = 0;
    let inZoneMs = 0;
    let finished = false;
    const reducedMotion = opts.reducedMotion === true;
    function snapshot() {
      const ratio = durationMs > 0 ? inZoneMs / durationMs : 0;
      return { heat, elapsedMs, inZoneMs, durationMs, remainingMs: Math.max(0, durationMs - elapsedMs), ratio, inGold: heat >= GOLD_MIN && heat <= GOLD_MAX, finished, reducedMotion, grade: finished ? gradeForRatio(ratio) : null };
    }
    return {
      tick(dtMs) {
        if (finished) return snapshot();
        let dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
        dt = Math.min(dt, Math.max(0, durationMs - elapsedMs));
        if (dt > 0) {
          heat = clampHeat(heat - (dt / 1000) * DECAY_PER_SEC);
          elapsedMs += dt;
          if (heat >= GOLD_MIN && heat <= GOLD_MAX) inZoneMs += dt;
          if (elapsedMs >= durationMs) { elapsedMs = durationMs; finished = true; }
        }
        return snapshot();
      },
      addWood() { if (!finished) heat = clampHeat(heat + STEP_HEAT); return snapshot(); },
      vent() { if (!finished) heat = clampHeat(heat - STEP_HEAT); return snapshot(); },
      openLid() { return this.vent(); },
      snapshot,
      grade() { return gradeForRatio(durationMs > 0 ? inZoneMs / durationMs : 0); },
      ratio() { return durationMs > 0 ? inZoneMs / durationMs : 0; },
      get finished() { return finished; },
    };
  }

  function recipeIds(state) {
    if (A && typeof A.recipes === "function") {
      try { const rows = A.recipes(state); if (Array.isArray(rows) && rows.length) return rows.map((r) => r.id); } catch (_) { /* 用備用清單 */ }
    }
    return FALLBACK_RECIPE_IDS.slice();
  }
  function recipeOf(state, id) {
    if (A && typeof A.recipes === "function") {
      try { const row = A.recipes(state).find((r) => r.id === id); if (row) return row; } catch (_) { /* 接著回傳空值 */ }
    }
    return null;
  }

  function ensure(state, now) {
    if (!isObject(state)) return { ok: false, reason: "bad_state", message: "存檔資料不完整。" };
    if (A && typeof A.ensure === "function") A.ensure(state, now);
    if (!isObject(state.adventure)) state.adventure = {};
    const a = state.adventure;
    if (!isObject(a.r75b)) a.r75b = {};
    const b = a.r75b;
    if (!isObject(b.grades)) b.grades = {};
    if (!isObject(b.best)) b.best = {};
    if (!isObject(b.daily)) b.daily = {};
    if (!isObject(a.meals)) a.meals = {};
    for (const id of recipeIds(state)) {
      const raw = isObject(b.grades[id]) ? b.grades[id] : {};
      const bucket = { home: Math.max(0, Math.floor(raw.home) || 0), tasty: Math.max(0, Math.floor(raw.tasty) || 0), perfect: Math.max(0, Math.floor(raw.perfect) || 0) };
      b.grades[id] = bucket;
      const meals = Math.max(0, Math.floor(a.meals[id]) || 0);
      let total = bucket.home + bucket.tasty + bucket.perfect;
      if (total < meals) bucket.home += meals - total;
      if (total > meals) {
        let excess = total - meals;
        const takeHome = Math.min(bucket.home, excess); bucket.home -= takeHome; excess -= takeHome;
        const takeTasty = Math.min(bucket.tasty, excess); bucket.tasty -= takeTasty; excess -= takeTasty;
        bucket.perfect = Math.max(0, bucket.perfect - excess);
      }
      total = bucket.home + bucket.tasty + bucket.perfect;
      const storedBest = GRADES[b.best[id]] ? b.best[id] : null;
      const stockBest = bucket.perfect > 0 ? "perfect" : bucket.tasty > 0 ? "tasty" : total > 0 ? "home" : null;
      if (!storedBest && stockBest) b.best[id] = stockBest;
      if (storedBest && stockBest && gradeRank(stockBest) > gradeRank(storedBest)) b.best[id] = stockBest;
    }
    return { ok: true };
  }

  function bucketOf(state, recipeId) {
    ensure(state);
    return state.adventure.r75b.grades[recipeId] || { home: 0, tasty: 0, perfect: 0 };
  }
  function bestStockGrade(state, recipeId) {
    const bucket = bucketOf(state, recipeId);
    if (bucket.perfect > 0) return "perfect";
    if (bucket.tasty > 0) return "tasty";
    if (bucket.home > 0) return "home";
    return null;
  }
  function mealGrades(state, recipeId) {
    const bucket = bucketOf(state, recipeId);
    const bestEver = state.adventure.r75b.best[recipeId] || null;
    return { recipeId, home: bucket.home, tasty: bucket.tasty, perfect: bucket.perfect, total: bucket.home + bucket.tasty + bucket.perfect,
      bestInStock: bestStockGrade(state, recipeId), bestEver, bestEverLabel: bestEver ? GRADES[bestEver].label : "" };
  }
  function recordGrade(state, recipeId, grade) {
    ensure(state);
    const g = GRADES[grade] ? grade : "home";
    state.adventure.r75b.grades[recipeId][g] += 1;
    const prev = state.adventure.r75b.best[recipeId];
    if (!prev || gradeRank(g) > gradeRank(prev)) state.adventure.r75b.best[recipeId] = g;
    if (g === "perfect" && typeof CookingR75.onPerfect === "function") CookingR75.onPerfect(state, recipeId); /* R76C 追光手冊：煮成絕品蓋章 */
    return g;
  }
  function takeBestFromStock(state, recipeId) {
    const grade = bestStockGrade(state, recipeId);
    if (!grade) return null;
    state.adventure.r75b.grades[recipeId][grade] = Math.max(0, state.adventure.r75b.grades[recipeId][grade] - 1);
    return grade;
  }

  const originalCook = A && typeof A.cook === "function" ? A.cook.bind(A) : null;
  const originalEat = A && typeof A.eatMeal === "function" ? A.eatMeal.bind(A) : null;
  const originalDeliver = A && typeof A.deliverNeighbor === "function" ? A.deliverNeighbor.bind(A) : null;

  function cookWithGrade(state, recipeId, grade, now) {
    if (!originalCook) return { ok: false, reason: "no_adventure", message: "灶台還沒準備好。" };
    const g = GRADES[grade] ? grade : "home";
    ensure(state, now);
    const result = originalCook(state, recipeId, now);
    if (!result.ok) return result;
    recordGrade(state, recipeId, g);
    result.grade = g;
    result.gradeLabel = GRADES[g].label;
    result.message = result.message + "（" + GRADES[g].label + "）";
    return result;
  }
  function cookDirect(state, recipeId, now) { return cookWithGrade(state, recipeId, "home", now); }
  function finishFireSession(state, recipeId, session, now) {
    if (!session) return cookDirect(state, recipeId, now);
    const snap = typeof session.snapshot === "function" ? session.snapshot() : null;
    const grade = snap ? gradeForRatio(snap.ratio) : "home";
    return cookWithGrade(state, recipeId, grade, now);
  }

  function scaledDurationMs(baseMs, grade) {
    const mult = GRADES[grade] ? GRADES[grade].durationMult : 1;
    return Math.round((Number.isFinite(baseMs) ? baseMs : 0) * mult);
  }
  function durationText(ms) {
    const seconds = Math.max(0, Math.round((ms || 0) / 1000));
    const minutes = Math.floor(seconds / 60); const rest = seconds % 60;
    return minutes && rest ? `${minutes} 分 ${rest} 秒` : minutes ? `${minutes} 分鐘` : `${rest} 秒`;
  }
  function gradeEffectText(recipe, grade) {
    if (!recipe || !recipe.effect) return grade === "perfect" ? "分享給鄰居好感多 1" : "適合分享給鄰居";
    const base = recipe.effect.durationMs || 0; const actual = scaledDurationMs(base, grade);
    const effect = String(recipe.effect.summary || recipe.effect.label || "料理效果").replace(/。$/, "");
    return `${effect}・${durationText(base)} → ${durationText(actual)}${grade === "perfect" ? "・分享給鄰居好感多 1" : ""}`;
  }

  function eatMeal(state, recipeId, now) {
    if (!originalEat) return { ok: false, reason: "no_adventure", message: "餐籃還沒準備好。" };
    ensure(state, now);
    const recipe = recipeOf(state, recipeId);
    if (!recipe) return { ok: false, reason: "unknown_recipe", message: "找不到這道料理。" };
    if (!recipe.effect) return { ok: false, reason: "not_edible", message: "這道料理是帶去分享的，先留給鄰居吧。" };
    const grade = bestStockGrade(state, recipeId) || "home";
    const result = originalEat(state, recipeId, now);
    if (!result.ok) return result;
    takeBestFromStock(state, recipeId);
    ensure(state, now);
    const mult = GRADES[grade].durationMult;
    if (mult !== 1 && result.until) {
      const baseMs = recipe.effect.durationMs || 0;
      const start = result.until - baseMs;
      result.until = start + scaledDurationMs(baseMs, grade);
      const buffs = state.adventure.r58 && state.adventure.r58.buffs;
      const buff = buffs && buffs[recipe.effect.kind];
      if (buff) buff.until = result.until;
      if (result.buffs && A && typeof A.activeBuffs === "function") result.buffs = A.activeBuffs(state, now);
    }
    result.grade = grade;
    result.gradeLabel = GRADES[grade].label;
    result.durationMult = mult;
    result.durationMs = scaledDurationMs(recipe.effect.durationMs || 0, grade);
    result.durationText = durationText(result.durationMs);
    result.message = `${recipe.name}・${result.gradeLabel}，效果持續 ${result.durationText}。${result.message}`;
    return result;
  }

  /* 分享一份料理給鄰居：先用最好的；絕品讓好感多 1。 */
  function shareBestMeal(state, recipeId, npcId, now) {
    ensure(state, now);
    if (!isObject(state.adventure.meals) || (state.adventure.meals[recipeId] || 0) < 1) {
      return { ok: false, reason: "missing_resources", message: "餐籃裡還沒有這道料理，先去灶台做一份。" };
    }
    const grade = bestStockGrade(state, recipeId) || "home";
    takeBestFromStock(state, recipeId);
    state.adventure.meals[recipeId] -= 1;
    if (state.adventure.meals[recipeId] <= 0) delete state.adventure.meals[recipeId];
    let favorBonus = 0;
    if (grade === "perfect" && npcId) {
      if (!isObject(state.adventure.r58)) state.adventure.r58 = {};
      if (!isObject(state.adventure.r58.favor)) state.adventure.r58.favor = {};
      state.adventure.r58.favor[npcId] = Math.min(999, (state.adventure.r58.favor[npcId] || 0) + 1);
      favorBonus = 1;
    }
    return { ok: true, recipeId, npcId: npcId || null, grade, gradeLabel: GRADES[grade].label, favorBonus,
      message: favorBonus ? "絕品料理讓鄰居特別開心，好感多 1。" : "把一份" + GRADES[grade].label + "料理分享出去了。" };
  }
  /* 既有鄰居餐籃流程已經扣掉麥餅時，用這支把成果記到最好的一份。 */
  function noteSharedMeal(state, recipeId, npcId) {
    /* 外部流程已經先扣掉料理總數，這裡直接讀成果庫存取最好的一份，不能先同步把那一份修掉。 */
    const rawBucket = isObject(state) && isObject(state.adventure) && isObject(state.adventure.r75b) && isObject(state.adventure.r75b.grades) ? state.adventure.r75b.grades[recipeId] : null;
    let grade = null;
    if (isObject(rawBucket)) {
      grade = rawBucket.perfect > 0 ? "perfect" : rawBucket.tasty > 0 ? "tasty" : rawBucket.home > 0 ? "home" : null;
      if (grade) rawBucket[grade] = Math.max(0, rawBucket[grade] - 1);
    }
    if (!grade) { ensure(state); return { grade: null, favorBonus: 0 }; }
    let favorBonus = 0;
    if (grade === "perfect" && npcId) {
      if (!isObject(state.adventure.r58)) state.adventure.r58 = {};
      if (!isObject(state.adventure.r58.favor)) state.adventure.r58.favor = {};
      state.adventure.r58.favor[npcId] = Math.min(999, (state.adventure.r58.favor[npcId] || 0) + 1);
      favorBonus = 1;
    }
    ensure(state);
    return { grade, gradeLabel: GRADES[grade].label, favorBonus };
  }

  /* ---------- 第 8 項：開場選擇的持續影響 ---------- */
  function storyChoicesOf(state) {
    if (!isObject(state)) return {};
    const r60 = state.adventure && state.adventure.r58 && state.adventure.r58.r59 && state.adventure.r58.r59.r60;
    return isObject(r60) && isObject(r60.storyChoices) ? r60.storyChoices : {};
  }
  function selectedChoice(state, npcId) {
    const def = CHOICE_DEFS.find((row) => row.npcId === npcId);
    if (!def) return null;
    const saved = storyChoicesOf(state)[def.storyId];
    if (!isObject(saved) || !def.options[saved.choiceId]) return null;
    const opt = def.options[saved.choiceId];
    const follow = isObject(state.r76story) && isObject(state.r76story.seen) && isObject(state.r76story.seen[def.npcId]) ? state.r76story.seen[def.npcId] : null;
    return { storyId: def.storyId, npcId: def.npcId, npcName: def.npcName, question: def.question, choiceId: saved.choiceId,
      answer: opt.answer, effectId: opt.effectId, effectText: opt.effectText, at: saved.at || 0, followupSummary: follow ? String(follow.summary || "") : "" };
  }
  function hasEffect(state, effectId) {
    return CHOICE_DEFS.some((def) => {
      const saved = storyChoicesOf(state)[def.storyId];
      return isObject(saved) && def.options[saved.choiceId] && def.options[saved.choiceId].effectId === effectId;
    });
  }
  function choiceEffects(state) {
    if (!isObject(state)) return [];
    ensure(state);
    return CHOICE_DEFS.map((def) => selectedChoice(state, def.npcId)).filter(Boolean)
      .map((row) => Object.assign({}, row, { active: true }));
  }
  function orderCoinBonusRate(state, npcId) {
    if (npcId === "elder" && hasEffect(state, "elder_order_coins")) return 0.1;
    if (npcId === "merchant" && hasEffect(state, "merchant_order_coins")) return 0.1;
    return 0;
  }
  function mayorQuestBonusRate(state) { return hasEffect(state, "mayor_quest_coins") ? 0.1 : 0; }
  function boostedCoins(baseCoins, rate) {
    const base = Number.isFinite(baseCoins) ? baseCoins : 0;
    return Math.round(base * (1 + (Number.isFinite(rate) ? rate : 0)));
  }
  function farmSignVisible(state) { return hasEffect(state, "merchant_order_coins"); }
  function seedBagVisible(state) { return hasEffect(state, "mayor_daily_seed"); }

  function seasonalCropId(state) {
    const seasonId = state && state.season && state.season.id;
    const crops = Object.values(C.CROPS || {});
    const seasonal = crops.filter((crop) => crop.season && crop.season === seasonId);
    if (!seasonal.length) return "wheat";
    const level = (state && state.level) || 1;
    const unlocked = seasonal.filter((crop) => (crop.unlockLevel || 1) <= level);
    const pool = (unlocked.length ? unlocked : seasonal).slice().sort((x, y) => (x.unlockLevel || 1) - (y.unlockLevel || 1));
    return pool[0].id;
  }
  function elderAdviceSeed(state) {
    if (!hasEffect(state, "elder_advice_seed")) return null;
    const cropId = seasonalCropId(state);
    const def = (C.CROPS || {})[cropId];
    return { cropId, cropName: def ? def.name : cropId, qty: 1 };
  }

  /* 每天的持續好處：鎮長種田路線每天送 1 包小麥種子，同一天不重複送。 */
  function dailyPerks(state, now) {
    if (!isObject(state)) return { ok: false, reason: "bad_state", claimed: [] };
    ensure(state, now);
    const t = Number.isFinite(now) ? now : Date.now();
    const today = dayKeyOf(t);
    const claimed = [];
    const daily = state.adventure.r75b.daily;
    if (hasEffect(state, "mayor_daily_seed") && daily.mayorSeedDay !== today) {
      if (A && typeof A.ensure === "function") A.ensure(state, t);
      const packs = state.adventure.r58.r59.seedPacks;
      packs.wheat = Math.min(99, (packs.wheat || 0) + 1);
      daily.mayorSeedDay = today;
      daily.mayorSeedAt = t;
      claimed.push({ id: "mayor_wheat_seed", cropId: "wheat", cropName: "小麥", qty: 1, text: "農舍門口的種子袋今天送了 1 包小麥種子。" });
    }
    return { ok: true, day: today, claimed, seedBagVisible: seedBagVisible(state), farmSignVisible: farmSignVisible(state) };
  }

  function merchantDeals(state, now) {
    const M = loadMidgame();
    if (!M || typeof M.merchantSpecial !== "function") return [];
    const deal = M.merchantSpecial(state, now);
    return Array.isArray(deal.deals) && deal.deals.length ? deal.deals : [deal];
  }
  function buyMerchantDeal(state, now, cropId, dealIndex) {
    const M = loadMidgame();
    if (!M || typeof M.buyMerchantSpecial !== "function") return { ok: false, reason: "no_midgame", message: "市集還沒準備好。" };
    return M.buyMerchantSpecial(state, now, cropId, dealIndex);
  }
  let cachedMidgame = null;
  function loadMidgame() {
    if (cachedMidgame) return cachedMidgame;
    if (isNode) { try { cachedMidgame = require("./midgame-r66.js"); } catch (_) { cachedMidgame = null; } }
    else cachedMidgame = root.MidgameR66 || null;
    return cachedMidgame;
  }

  const CookingR75 = { DURATION_MS, GOLD_MIN, GOLD_MAX, START_HEAT, GRADES, GRADE_ORDER, CHOICE_DEFS,
    ensure, createFireSession, gradeForRatio, scaledDurationMs, durationText, gradeEffectText,
    mealGrades, bestStockGrade, cookWithGrade, cookDirect, finishFireSession, eatMeal, shareBestMeal, noteSharedMeal,
    selectedChoice, choiceEffects, hasEffect, orderCoinBonusRate, mayorQuestBonusRate, boostedCoins,
    farmSignVisible, seedBagVisible, seasonalCropId, elderAdviceSeed, dailyPerks, merchantDeals, buyMerchantDeal };
  root.CookingR75 = CookingR75;
  if (isNode) module.exports = CookingR75;

  /* 讓既有畫面自動吃到成果：直接做記家常、享用先用最好的一份、鄰居餐籃的絕品多 1 好感。 */
  if (A && !A.__r75bWrapped) {
    A.__r75bWrapped = true;
    if (originalCook) A.cook = function (state, id, now) { const r = originalCook(state, id, now); if (r && r.ok) { try { ensure(state, now); } catch (_) { /* 保留原本結果 */ } } return r; };
    if (originalEat) A.eatMeal = function (state, id, now) { return eatMeal(state, id, now); };
    if (originalDeliver) A.deliverNeighbor = function (state, id, taste, now) {
      const r = originalDeliver(state, id, taste, now);
      if (r && r.ok) { try { const note = noteSharedMeal(state, "rustic_bread", id); if (note.favorBonus) r.r75bFavorBonus = note.favorBonus; r.r75bGrade = note.grade; } catch (_) { /* 保留原本結果 */ } }
      return r;
    };
  }

  /* ---------- 瀏覽器接線 ---------- */
  if (typeof document === "undefined") return;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const versionQuery = () => root.FARM_VERSION_QUERY || "";
  const farm = () => root.__farm;
  function browserState() {
    const f = farm();
    if (!f) return null;
    try { return typeof f.state === "function" ? f.state() : null; } catch (_) { return null; }
  }
  function toast(message) { const f = farm(); if (f && f.toast) f.toast(message); }
  function persist(state) {
    const f = farm();
    if (f && f.safeSaveNow) f.safeSaveNow();
    if (f && f.refresh) f.refresh();
  }

  /* 灶台：替每道料理加上「開始煮」，原本的按鈕改成「直接做（家常）」，並顯示最高成果徽章。 */
  function augmentKitchen() {
    const state = browserState();
    if (!state) return;
    document.querySelectorAll(".recipe-row[data-recipe]").forEach((row) => {
      if (row.querySelector("[data-r75b-start]")) return;
      const cookBtn = row.querySelector("[data-cook]");
      if (!cookBtn) return;
      const recipeId = row.getAttribute("data-recipe");
      ensure(state);
      try { dailyPerks(state, Date.now()); } catch (_) { /* 每日好處失敗不擋灶台 */ }
      const info = mealGrades(state, recipeId);
      cookBtn.textContent = "直接做（家常）";
      const badge = document.createElement("p");
      badge.className = "r75b-grade-line";
      badge.setAttribute("data-r75b-grade", recipeId);
      const recipe = recipeOf(state, recipeId);
      const durations = recipe && recipe.effect ? GRADE_ORDER.map((grade) => `${GRADES[grade].label} ${durationText(scaledDurationMs(recipe.effect.durationMs, grade))}`).join("・") : "家常／好吃／絕品皆可分享";
      badge.textContent = (info.bestEver ? "最高成果：" + info.bestEverLabel + "・餐籃裡 家常 " + info.home + "、好吃 " + info.tasty + "、絕品 " + info.perfect : "還沒做過") + "・" + durations;
      cookBtn.before(badge);
      const start = document.createElement("button");
      start.type = "button";
      start.className = "r75b-start-cook";
      start.setAttribute("data-r75b-start", recipeId);
      start.textContent = "開始煮";
      start.disabled = cookBtn.disabled;
      start.onclick = () => openFireGame(state, recipeId);
      cookBtn.before(start);
      const pot = document.createElement("img");
      pot.className = "r75b-pot-thumb r76a-recipe-thumb";
      pot.src = "assets/generated/content-r73/item-" + recipeId + ".png" + versionQuery();
      pot.alt = recipe ? recipe.name : "料理";
      row.prepend(pot);
      const eat = row.querySelector("[data-eat]");
      if (eat && recipe && recipe.effect) { const grade = info.bestInStock || "home"; eat.textContent = `享用${GRADES[grade].label}・${durationText(scaledDurationMs(recipe.effect.durationMs, grade))}`; }
    });
  }

  function openFireGame(state, recipeId) {
    const recipe = recipeOf(state, recipeId) || { name: "這道料理" };
    document.querySelectorAll(".r75b-cook-overlay").forEach((node) => node.remove());
    const reduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const session = createFireSession({ reducedMotion: reduced });
    const overlay = document.createElement("div");
    overlay.className = "r75b-cook-overlay" + (reduced ? " r75b-reduced" : "");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "看火候煮" + recipe.name);
    overlay.innerHTML = '<div class="r75b-cook-card">'
      + '<button type="button" class="r75b-cook-close" data-r75b-close aria-label="關閉看火候畫面">×</button>'
      + "<h3>看火候・" + esc(recipe.name) + "</h3>"
      + '<img class="r75b-cook-pot" src="assets/generated/content-r73/item-' + esc(recipeId) + '.png' + esc(versionQuery()) + '" alt="鍋裡的' + esc(recipe.name) + '">'
      + '<div class="r75b-fire-track" aria-hidden="true"><div class="r75b-fire-gold"></div><div class="r75b-fire-pointer"></div></div>'
      + '<p class="r75b-cook-status" data-r75b-status>把指針留在金色區間，火會慢慢變小。</p>'
      + '<p class="r75b-cook-time" data-r75b-time>還剩 12 秒</p>'
      + '<div class="r75b-cook-actions">'
      + '<button type="button" data-r75b-wood>添柴</button>'
      + '<button type="button" data-r75b-vent>掀蓋</button>'
      + '<button type="button" data-r75b-direct>直接做（家常）</button>'
      + "</div>"
      + '<p class="r75b-cook-hint">空白鍵添柴、Enter 鍵掀蓋，滑鼠和觸控也可以按。</p>'
      + "</div>";
    document.body.appendChild(overlay);
    const pointer = overlay.querySelector(".r75b-fire-pointer");
    const status = overlay.querySelector("[data-r75b-status]");
    const timeLabel = overlay.querySelector("[data-r75b-time]");
    let raf = 0;
    let last = performance.now();
    let closed = false;
    function render(snap) {
      pointer.style.left = snap.heat + "%";
      timeLabel.textContent = "還剩 " + Math.ceil(snap.remainingMs / 1000) + " 秒";
      status.textContent = snap.inGold ? "剛好，火候穩穩的。" : snap.heat < GOLD_MIN ? "火變小了，按添柴加熱。" : "火太大了，按掀蓋降一點。";
    }
    function close() {
      closed = true;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
    }
    function finishCook(gradeOverride) {
      if (closed) return;
      const snap = session.snapshot();
      close();
      const result = gradeOverride ? cookWithGrade(state, recipeId, gradeOverride, Date.now()) : finishFireSession(state, recipeId, session, Date.now());
      if (!result.ok) { toast(result.message); if (root.FarmWorld && typeof root.FarmWorld.openKitchen === "function") root.FarmWorld.openKitchen(); return; }
      persist(state);
      showCookResultCard(state, recipeId, result, snap);
    }
    function frame(nowMs) {
      if (closed) return;
      const dt = Math.min(100, Math.max(0, nowMs - last));
      last = nowMs;
      const snap = session.tick(dt);
      render(snap);
      if (snap.finished) { finishCook(null); return; }
      raf = requestAnimationFrame(frame);
    }
    function onKey(event) {
      if (closed) return;
      if (event.code === "Space" || event.key === " ") { event.preventDefault(); render(session.addWood()); }
      else if (event.key === "Enter") { event.preventDefault(); render(session.vent()); }
      else if (event.key === "Escape") { event.preventDefault(); close(); }
    }
    overlay.querySelector("[data-r75b-wood]").onclick = () => render(session.addWood());
    overlay.querySelector("[data-r75b-vent]").onclick = () => render(session.vent());
    overlay.querySelector("[data-r75b-direct]").onclick = () => finishCook("home");
    overlay.querySelector("[data-r75b-close]").onclick = () => close();
    document.addEventListener("keydown", onKey, true);
    render(session.snapshot());
    raf = requestAnimationFrame(frame);
  }

  function showCookResultCard(state, recipeId, result, snap) {
    const recipe = recipeOf(state, recipeId) || { name: result.meal && result.meal.name || "料理" };
    const grade = result.grade || "home"; const ratio = Math.max(0, Math.min(1, Number(snap && snap.ratio) || 0));
    const overlay = document.createElement("div"); overlay.className = "r75b-cook-overlay r76a-result-overlay"; overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true"); overlay.setAttribute("aria-label", recipe.name + "料理成果");
    overlay.innerHTML = '<article class="r75b-cook-card r76a-result-card" data-r76a-cook-result>'
      + '<img class="r76a-result-image" src="assets/generated/content-r73/item-' + esc(recipeId) + '.png' + esc(versionQuery()) + '" alt="' + esc(recipe.name) + '">'
      + '<p class="r76a-grade-badge" data-grade="' + esc(grade) + '">' + esc(GRADES[grade].label) + '</p>'
      + '<h3>' + esc(recipe.name) + '做好了</h3>'
      + '<p>火候剛好 ' + Math.round(ratio * 100) + '%</p>'
      + '<p class="r76a-result-effect">' + esc(gradeEffectText(recipe, grade)) + '</p>'
      + '<div class="r76a-result-actions"><button type="button" data-r76a-eat' + (recipe.effect ? '' : ' disabled') + '>現在吃</button><button type="button" data-r76a-keep>先放餐籃</button></div></article>';
    document.body.appendChild(overlay);
    const finish = () => { overlay.remove(); persist(state); if (root.FarmWorld && typeof root.FarmWorld.openKitchen === "function") root.FarmWorld.openKitchen(); };
    const eat = overlay.querySelector("[data-r76a-eat]"); if (eat && recipe.effect) eat.onclick = () => { const eaten = eatMeal(state, recipeId, Date.now()); toast(eaten.message); finish(); };
    overlay.querySelector("[data-r76a-keep]").onclick = finish;
  }

  /* 手札：我做過的選擇（還沒選的不列） */
  function choicesSectionHtml(state) {
    const rows = choiceEffects(state);
    const deals = hasEffect(state, "merchant_two_specials") ? merchantDeals(state, Date.now()) : [];
    const second = deals.length > 1 ? deals[1] : null;
    return '<section class="r75b-choices" data-r75b-choices aria-label="我做過的選擇"><div class="story-kicker">我做過的選擇</div>'
      + (rows.length ? rows.map((row) => '<article class="r75b-choice-card" data-r75b-choice="' + esc(row.effectId) + '"><h3>' + esc(row.npcName) + '</h3><p class="r75b-choice-q">當時問：「' + esc(row.question) + "」</p><p class=\"r75b-choice-a\">我的回答：" + esc(row.answer) + "</p><p class=\"r75b-choice-e\">現在的影響：" + esc(row.effectText) + "</p>" + (row.followupSummary ? '<p class="r76b-choice-follow" data-r76b-followup="' + esc(row.npcId) + '">後來：' + esc(row.followupSummary) + "</p>" : "") + "</article>").join("") : '<p class="r75b-choice-empty">還沒做過開場選擇，先去跟鎮長、老農班伯和蘿拉聊聊。</p>')
      + (second ? '<div class="r75b-choice-card" data-r75b-second-deal><h3>蘿拉的第二樣特價</h3><p class="r75b-choice-e">今天第二樣特價：' + esc(second.cropName) + "種子 " + esc(second.specialPrice) + " 金。</p><button type=\"button\" class=\"r75b-act\" data-r75b-buy-second>買第二樣特價種子</button></div>" : "")
      + "</section>";
  }
  let injectingChoices = false;
  function injectChoices(stateArg) {
    const panel = document.querySelector("#journalPanel");
    const state = stateArg || browserState();
    if (!panel || !state || injectingChoices) return;
    if (!stateArg && panel.querySelector("[data-r75b-choices]")) return;
    injectingChoices = true;
    try {
      ensure(state);
      try { dailyPerks(state, Date.now()); } catch (_) { /* 每日好處失敗不擋手札 */ }
      panel.querySelectorAll("[data-r75b-choices]").forEach((node) => node.remove());
      const host = document.createElement("div");
      host.innerHTML = choicesSectionHtml(state);
      const section = host.firstElementChild;
      panel.appendChild(section);
      const buy = section.querySelector("[data-r75b-buy-second]");
      if (buy) buy.onclick = () => {
        const dealsNow = merchantDeals(state, Date.now());
        const target = dealsNow.length > 1 ? dealsNow[1] : null;
        const result = target ? buyMerchantDeal(state, Date.now(), target.cropId, 1) : { ok: false, message: "今天沒有第二樣特價。" };
        toast(result.message);
        if (result.ok) persist(state);
        injectingChoices = false;
        injectChoices(state);
      };
    } finally { injectingChoices = false; }
  }

  /* 地圖：招牌立在市集入口、種子袋放在農舍門口 */
  function paintChoices(state, tileSize) {
    const world = document.querySelector("#mapWorld");
    if (!world || !state || !state.map) return;
    ensure(state);
    try { dailyPerks(state, Date.now()); } catch (_) { /* 每日好處失敗不擋地圖 */ }
    world.querySelectorAll(".r75b-map-node").forEach((node) => node.remove());
    const addNode = (structureId, art, label, dataset) => {
      const tile = (state.map.tiles || []).find((t) => t.structureId === structureId);
      if (!tile) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "r75b-map-node";
      Object.assign(btn.dataset, dataset || {});
      btn.setAttribute("aria-label", label);
      const size = Math.min(Math.round(tileSize * 1.08), Math.floor(tileSize * 1.5));
      btn.style.cssText = "left:" + Math.round((tile.x + 0.5) * tileSize) + "px;top:" + Math.round((tile.y + 1) * tileSize) + "px;width:" + size + "px;height:" + size + "px;z-index:" + (Math.round((tile.y + 1) * tileSize) + 3) + ";";
      btn.innerHTML = '<img src="' + esc(art) + esc(versionQuery()) + '" alt="" draggable="false"><span>' + esc(label) + "</span>";
      btn.onclick = (event) => { event.stopPropagation(); toast(label); };
      world.appendChild(btn);
    };
    if (farmSignVisible(state)) addNode("shop", "assets/generated/content-r75/farm_sign.png", "農場招牌", { r75bSign: "farm_sign" });
    if (seedBagVisible(state)) addNode("farmhouse", "assets/generated/r83/seed-32.png", "門口的種子袋，每天送 1 包小麥種子", { r75bSeedBag: "wheat_seed" });
  }
  if (root.FarmWorld && !root.FarmWorld.__r75bPaintWrapped) {
    const originalPaint = root.FarmWorld.paintWorld;
    root.FarmWorld.paintWorld = function (s, tileSize, t) {
      const out = originalPaint.call(this, s, tileSize, t);
      try { paintChoices(s, tileSize); } catch (_) { /* 地圖裝飾失敗不擋主畫面 */ }
      return out;
    };
    root.FarmWorld.__r75bPaintWrapped = true;
  }

  const observer = new MutationObserver(() => { augmentKitchen(); if (!injectingChoices) injectChoices(); });
  const start = () => {
    const panel = document.querySelector("#journalPanel");
    if (panel) observer.observe(panel, { childList: true, subtree: true });
    const modalRoot = document.body;
    if (modalRoot) observer.observe(modalRoot, { childList: true, subtree: true });
    /* 遊戲內部重畫地圖時走的是內部函式，這裡跟既有鄰居設施一樣定時補上招牌與種子袋。 */
    setInterval(() => {
      const state = browserState();
      const world = document.querySelector("#mapWorld");
      if (!state || !world || !state.map || !world.offsetWidth) return;
      if (!document.querySelector(".r75b-map-node")) paintChoices(state, Math.max(24, Math.round(world.offsetWidth / state.map.width)));
    }, 600);
    augmentKitchen();
    injectChoices();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  root.CookingR75.injectChoices = injectChoices;
  root.CookingR75.paintChoices = paintChoices;
  root.CookingR75.openFireGame = openFireGame;
})(typeof window !== "undefined" ? window : globalThis);
