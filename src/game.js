/* =========================================================================
 * game.js — Pixel Idle Farm 核心規則（純邏輯，無 DOM）
 * 所有函式接收 state、now(ms)、必要時 rng，回傳結果資訊或就地改 state。
 * 時間一律用毫秒 timestamp；成長由 plantedAt 推導，不靠 setInterval 累加。
 * Node 可載入做經濟模擬測試。
 * ========================================================================= */

(function (root) {
  const C = (typeof module !== "undefined" && module.exports)
    ? require("./config.js")
    : root;
  const {
    GAME, CROPS, UPGRADES, ORDER_RARITY, ORDER_STREAK_BONUS, ORDER_STREAK_CAP,
    SEASONS, SEASON_DURATION_MS, SEASON_UNLOCK_LEVEL,
    WEATHER, WEATHER_UNLOCK_LEVEL, WEATHER_DURATION_MS, ACHIEVEMENTS,
    levelFromXp,
    PRODUCTS, getItemDef, itemSellValue, MATERIALS, TERRAIN, OBSTACLES,
    BUILDINGS, BUILDING_ORDER, ANIMALS, MOISTURE_MUL,
    LETTERS, CHAPTER5_LETTERS,
    AFFINITY_MAX, AFFINITY_DECAY_PER_HOUR, AFFINITY_HAPPY_THRESHOLD, AFFINITY_GOOD_THRESHOLD,
    CARE_GAIN, CARE_COOLDOWN_MS, STATUS_STALE_MS, QUALITY_TIERS,
  } = C;

  // ---------- 工具 ----------
  function rngInt(rng, min, max) { return min + Math.floor((rng || Math.random)() * (max - min + 1)); }
  function rngPick(rng, arr) { return arr[Math.floor((rng || Math.random)() * arr.length)]; }

  // ---------- 解鎖 / 成長倍率 ----------
  function unlockedCrops(state) {
    return Object.values(CROPS).filter((c) => c.unlockLevel <= state.level).map((c) => c.id);
  }
  function isCropUnlocked(state, cropId) {
    const c = CROPS[cropId];
    return !!c && c.unlockLevel <= state.level;
  }
  // MVP2：玩家擁有的動物可生產的產品（訂單只會要玩家做得出的產品）
  function unlockedProducts(state) {
    // 動物產品（含 Stage 7 品質分級）要「玩家至少收集過一次」才進訂單池，避免起始雞讓 Lv1
    // 隨機訂單一開局就要蛋、或還沒摸過品質機制就被要求交優質品。直售/餵食不受此檢查影響。
    const set = {};
    for (const a of state.animals || []) {
      const def = ANIMALS[a.type]; if (!def) continue;
      for (const q of QUALITY_TIERS) {
        const id = q === "normal" ? def.product : def.product + "_" + q;
        if ((state.stats.collected[id] || 0) > 0) set[id] = true;
      }
    }
    return Object.keys(set);
  }
  function unlockedForageItems(state) {
    if (!(state.flags && state.flags.eastForageReported)) return [];
    const collected = (state.stats && state.stats.collected) || {};
    return Object.keys(C.FORAGE_ITEMS || {}).filter((id) => (collected[id] || 0) > 0);
  }
  function availableOrderItems(state) {
    return unlockedCrops(state).concat(unlockedProducts(state), unlockedForageItems(state));
  }
  // 成長時間倍率：肥沃土壤升級 × 天氣（rain 加速）
  function growthMultiplier(state, now) {
    let m = 1;
    const lv = state.upgrades.growthSpeed;
    if (lv > 0) m *= UPGRADES.growthSpeed.levels[lv - 1].value;
    const w = currentWeather(state, now);
    m *= WEATHER[w].growthMul;
    m *= buildingGrowthAura(state); // MVP2：堆肥場/蜂箱等建築的成長加成
    return m;
  }
  function buildingEffectLimit(def) {
    return def && typeof def.maxCount === "number" && def.maxCount > 0 ? def.maxCount : Infinity;
  }
  function effectBuildingAllowed(seen, type, def) {
    const used = seen[type] || 0;
    if (used >= buildingEffectLimit(def)) return false;
    seen[type] = used + 1;
    return true;
  }
  // 已蓋建築的成長光環連乘（compostHeap 0.90、beeBox 0.92…），同類型依 maxCount 封頂。
  function buildingGrowthAura(state) {
    let m = 1; const seen = {};
    for (const b of state.buildings || []) {
      const def = BUILDINGS[b.type];
      if (def && def.effect && def.effect.growthAura && effectBuildingAllowed(seen, b.type, def)) m *= def.effect.growthAura;
    }
    return m;
  }
  function buildingSeasonalBonus(state) {
    let bonus = 0; const seen = {};
    for (const b of state.buildings || []) {
      const def = BUILDINGS[b.type];
      if (def && def.effect && def.effect.seasonalSellBonus && effectBuildingAllowed(seen, b.type, def)) bonus += def.effect.seasonalSellBonus;
    }
    return bonus;
  }
  function effectiveGrowMs(state, cropId, now) {
    const c = CROPS[cropId];
    return Math.max(1000, Math.floor(c.growMs * growthMultiplier(state, now)));
  }
  // 此格本輪是否為濕土（澆水時間 >= 本輪種植時間）
  function isWet(plot) { return !!plot.cropId && (plot.wateredAt || 0) >= plot.plantedAt; }
  function getCropProgress(state, plot, now) {
    if (!plot.cropId) return { ready: false, ratio: 0, remainingMs: 0, stage: 0, wet: false };
    let growMs = effectiveGrowMs(state, plot.cropId, now);
    if (isWet(plot)) growMs = Math.max(1000, Math.floor(growMs * MOISTURE_MUL)); // 濕土加速
    const elapsed = Math.max(0, now - plot.plantedAt);
    const ratio = Math.min(1, elapsed / growMs);
    const ready = elapsed >= growMs;
    // 5 階段：seed0 sprout1 small2 mature3 ready4
    const stage = ready ? 4 : Math.min(3, Math.floor(ratio * 4));
    return { ready, ratio, remainingMs: Math.max(0, growMs - elapsed), stage, wet: isWet(plot) };
  }
  // 澆水：對已種植、未成熟、本輪尚未澆過的格子澆水（一輪一次）
  function waterPlot(state, plotIndex, now) {
    const plot = state.plots[plotIndex];
    if (!plot || !plot.cropId) return { ok: false, reason: "empty" };
    if (getCropProgress(state, plot, now).ready) return { ok: false, reason: "ready" };
    if (isWet(plot)) return { ok: false, reason: "already_wet" };
    plot.wateredAt = now;
    return { ok: true };
  }

  // ---------- 倉庫 ----------
  function storageCapacity(state) {
    const lv = state.upgrades.storageLevel;
    let cap = GAME.baseStorage + (lv > 0 ? UPGRADES.storageLevel.levels[lv - 1].value : 0);
    const seen = {};
    for (const b of state.buildings || []) { // MVP2：筒倉等建築加倉容
      const def = BUILDINGS[b.type];
      if (def && def.effect && def.effect.storageBonus && effectBuildingAllowed(seen, b.type, def)) cap += def.effect.storageBonus;
    }
    return cap;
  }
  function storageUsed(state) {
    return Object.values(state.storage.items).reduce((s, n) => s + (n || 0), 0);
  }
  function addToStorage(state, cropId, qty) {
    const cap = storageCapacity(state);
    const free = Math.max(0, cap - storageUsed(state));
    const added = Math.min(qty, free);
    if (added > 0) state.storage.items[cropId] = (state.storage.items[cropId] || 0) + added;
    return { added, lost: qty - added };
  }
  function ensureDiscoveryState(state) {
    if (!state.discoveries) state.discoveries = { items: {} };
    if (!state.discoveries.items) state.discoveries.items = {};
  }
  function recordDiscovery(state, itemId, now) {
    if (!itemId) return 0;
    ensureDiscoveryState(state);
    if (!state.discoveries.items[itemId]) state.discoveries.items[itemId] = now || Date.now();
    return state.discoveries.items[itemId];
  }
  function firstDiscoveredAt(state, itemId) {
    return (state.discoveries && state.discoveries.items && state.discoveries.items[itemId]) || 0;
  }

  // ---------- 等級 / XP / 成就 ----------
  function addXp(state, amount) {
    state.xp += amount;
    const before = state.level;
    state.level = levelFromXp(state.xp);
    return state.level - before; // 升了幾級
  }
  function achievementBonus(state) {
    // 每個成就 +2% 售出（永久微加成，非必要）
    return Object.keys(state.achievements).length * 0.02;
  }
  function checkAchievements(state) {
    const got = [];
    function unlock(id) { if (!state.achievements[id]) { state.achievements[id] = true; got.push(id); } }
    if (Object.keys(state.stats.harvested).length > 0) unlock("firstHarvest");
    if (state.stats.fulfilledOrders >= 10) unlock("order10");
    if (state.stats.totalCoinsEarned >= 1000) unlock("coins1k");
    if (unlockedCrops(state).length >= Object.keys(CROPS).length) unlock("allCrops");
    if (Object.keys(state.stats.collected || {}).some((id) => id === "duck_egg" || id.indexOf("duck_egg_") === 0)) unlock("duckKeeper");
    const harvestedSeasons = {};
    for (const [id, qty] of Object.entries(state.stats.harvested || {})) {
      const crop = CROPS[id];
      if (qty > 0 && crop && crop.season) harvestedSeasons[crop.season] = true;
    }
    if (Object.keys(harvestedSeasons).length >= 4) unlock("seasonalTable");
    if ((state.stats.festivalOrders || 0) > 0) unlock("festivalDeal");
    const read = (state.mail && state.mail.read) || {};
    if ((CHAPTER5_LETTERS || []).length && (CHAPTER5_LETTERS || []).every((id) => read[id])) unlock("letterKeeper");
    if (Object.keys(CROPS).every((id) => ((state.stats.harvested || {})[id] || 0) > 0)) unlock("fullPantry");
    if ((state.buildings || []).some((b) => b.type === "festival_stall")) unlock("stallOwner");
    return got;
  }

  // ---------- 售價 ----------
  function seasonIndex(id) {
    const idx = (SEASONS || []).findIndex((s) => s.id === id);
    return idx >= 0 ? idx : 0;
  }
  function recordSeasonReached(state, id) {
    if (!state.stats) state.stats = {};
    if (!state.stats.seasonsReached) state.stats.seasonsReached = {};
    if (id) state.stats.seasonsReached[id] = true;
  }
  function currentSeason(state, now) {
    if (state.level < (SEASON_UNLOCK_LEVEL || 6)) return (SEASONS && SEASONS[0] && SEASONS[0].id) || "春";
    if (!state.season || !(SEASONS || []).some((s) => s.id === state.season.id)) return (SEASONS && SEASONS[0] && SEASONS[0].id) || "春";
    const duration = SEASON_DURATION_MS || 0;
    if (duration > 0 && (state.season.untilMs || 0) > 0 && now >= state.season.untilMs) {
      const advance = Math.floor((now - state.season.untilMs) / duration) + 1;
      const next = (seasonIndex(state.season.id) + advance) % Math.max(1, (SEASONS || []).length);
      return SEASONS[next].id;
    }
    return state.season.id;
  }
  function advanceSeasonState(state, now) {
    const first = (SEASONS && SEASONS[0] && SEASONS[0].id) || "春";
    if (!state.season) state.season = { id: first, untilMs: now + (SEASON_DURATION_MS || 0) };
    if (state.level < (SEASON_UNLOCK_LEVEL || 6)) {
      const changed = state.season.id !== first || state.season.untilMs !== 0;
      state.season = { id: first, untilMs: 0 };
      recordSeasonReached(state, first);
      return { changed, advanced: 0, reached: [first] };
    }
    const valid = (SEASONS || []).some((s) => s.id === state.season.id);
    const duration = SEASON_DURATION_MS || 0;
    if (!valid || !duration || (state.season.untilMs || 0) <= 0) {
      const idx = valid ? seasonIndex(state.season.id) : 0;
      state.season = { id: SEASONS[idx].id, untilMs: now + duration };
      recordSeasonReached(state, state.season.id);
      return { changed: true, advanced: 0, reached: [state.season.id] };
    }
    if (now >= state.season.untilMs) {
      const advance = Math.floor((now - state.season.untilMs) / duration) + 1;
      const fromIdx = seasonIndex(state.season.id);
      const reached = [];
      const stepsToRecord = Math.min(advance, SEASONS.length);
      for (let step = 1; step <= stepsToRecord; step++) {
        const id = SEASONS[(fromIdx + step) % SEASONS.length].id;
        reached.push(id);
        recordSeasonReached(state, id);
      }
      if (advance >= SEASONS.length) for (const s of SEASONS) recordSeasonReached(state, s.id);
      const idx = (fromIdx + advance) % SEASONS.length;
      state.season = { id: SEASONS[idx].id, untilMs: state.season.untilMs + advance * duration };
      return { changed: true, advanced: advance, reached };
    }
    recordSeasonReached(state, state.season.id);
    return { changed: false, advanced: 0, reached: [state.season.id] };
  }
  function updateSeason(state, now) {
    return advanceSeasonState(state, now).changed;
  }
  function sellMultiplier(state, now) {
    const lv = state.upgrades.sellBonus;
    const bonus = lv > 0 ? UPGRADES.sellBonus.levels[lv - 1].value : 0;
    const w = currentWeather(state, now);
    return (1 + bonus + achievementBonus(state)) * WEATHER[w].sellMul;
  }
  function sellUnitValue(state, itemId, now) {
    const def = getItemDef(itemId); // 作物或動物產品
    const seasonMul = def && def.season && state.level >= (SEASON_UNLOCK_LEVEL || 6) && def.season === currentSeason(state, now) ? 1.15 + buildingSeasonalBonus(state) : 1;
    return Math.max(1, Math.round((def ? def.sellValue : 0) * seasonMul * sellMultiplier(state, now)));
  }

  // ---------- 種植 / 收成 ----------
  function activePlotCount(state) {
    const lv = state.upgrades.plotCount;
    return lv > 0 ? UPGRADES.plotCount.levels[lv - 1].value : GAME.startPlots;
  }
  function plant(state, plotIndex, cropId, now) {
    const plot = state.plots[plotIndex];
    if (!plot) return { ok: false, reason: "no_plot" };
    if (plotIndex >= activePlotCount(state)) return { ok: false, reason: "locked_plot" };
    if (plot.cropId) return { ok: false, reason: "occupied" };
    if (!isCropUnlocked(state, cropId)) return { ok: false, reason: "locked_crop" };
    const cost = CROPS[cropId].seedCost;
    if (state.coins < cost) return { ok: false, reason: "no_coins" };
    state.coins -= cost;
    plot.cropId = cropId;
    plot.plantedAt = now;
    delete plot.wateredAt;
    state.stats.plantCount++;
    return { ok: true };
  }
  function harvest(state, plotIndex, now) {
    const plot = state.plots[plotIndex];
    if (!plot || !plot.cropId) return { ok: false, reason: "empty" };
    const prog = getCropProgress(state, plot, now);
    if (!prog.ready) return { ok: false, reason: "not_ready" };
    const crop = CROPS[plot.cropId];
    const { added, lost } = addToStorage(state, crop.id, crop.yield);
    state.stats.harvested[crop.id] = (state.stats.harvested[crop.id] || 0) + added;
    if (added > 0) recordDiscovery(state, crop.id, now);
    const leveled = addXp(state, crop.xp);
    plot.cropId = null; plot.plantedAt = 0; delete plot.wateredAt;
    checkAchievements(state);
    return { ok: true, cropId: crop.id, added, lost, xp: crop.xp, leveled };
  }
  function harvestAll(state, now) {
    let totalAdded = 0, totalLost = 0, totalXp = 0; const perCrop = {};
    for (let i = 0; i < state.plots.length; i++) {
      const r = harvest(state, i, now);
      if (r.ok) { totalAdded += r.added; totalLost += r.lost; totalXp += r.xp; perCrop[r.cropId] = (perCrop[r.cropId] || 0) + r.added; }
    }
    return { totalAdded, totalLost, totalXp, perCrop };
  }

  // ---------- 賣出 ----------
  // Stage 7：品質分級品項 id 以 _good/_premium 結尾（見 config.buildProducts）
  function isQualityItem(id) { return /_(good|premium)$/.test(id); }
  function sellItem(state, cropId, qty, now) {
    const have = state.storage.items[cropId] || 0;
    const n = Math.min(qty, have);
    if (n <= 0) return { ok: false, coins: 0 };
    const coins = n * sellUnitValue(state, cropId, now);
    state.storage.items[cropId] = have - n;
    if (state.storage.items[cropId] === 0) delete state.storage.items[cropId];
    state.coins += coins;
    state.stats.totalCoinsEarned += coins;
    if (isQualityItem(cropId)) state.stats.qualitySold = (state.stats.qualitySold || 0) + n;
    checkAchievements(state);
    return { ok: true, coins, qty: n };
  }
  function sellAll(state, now) {
    let coins = 0, qty = 0;
    for (const cropId of Object.keys(state.storage.items)) {
      const r = sellItem(state, cropId, state.storage.items[cropId], now);
      if (r.ok) { coins += r.coins; qty += r.qty; }
    }
    return { coins, qty };
  }

  // ---------- 訂單 ----------
  // 訂單存活靠 expiresAt；獎金 = 直售總值 × rarity.payMult（解讀時再加 sellBonus/連單）
  // 作物 + 動物產品的訂單需求量範圍
  const ORDER_QTY = {
    wheat: [6, 14], carrot: [4, 9], tomato: [3, 6], corn: [2, 5], strawberry: [2, 4], pumpkin: [1, 3],
    bell_pepper: [2, 5], potato: [3, 7], grapes: [2, 4], melon: [1, 2],
    pea: [3, 7], sweet_potato: [2, 4], winter_kale: [2, 4],
    egg: [3, 8], milk: [2, 4], wool: [2, 3], honey: [2, 5], duck_egg: [2, 6],
    // Stage 7.1：品質分級品項明確給數量範圍，隨品質往下收（原本沒列到會 fallback [2,5]，
    // 對高單價的 premium 品項偏寬鬆）
    egg_good: [2, 5], egg_premium: [1, 3],
    milk_good: [1, 3], milk_premium: [1, 2],
    wool_good: [1, 2], wool_premium: [1, 1],
    honey_good: [1, 3], honey_premium: [1, 2],
    duck_egg_good: [1, 4], duck_egg_premium: [1, 2],
    forest_herb: [2, 4], glow_mushroom: [1, 3], wild_berry: [1, 3], river_mint: [1, 3],
    mooncap_spore: [1, 2], amber_resin: [1, 2], forest_chestnut: [1, 2], frost_cherry: [1, 2],
  };
  const TUTORIAL_DELIVERY_ORDER_ID = "tutorial_first_delivery";
  const ORDER_NPC_IDS = ["mayor", "merchant", "elder", "child"];
  const ORDER_COPY = {
    mayor: {
      offer: "鎮公所要補一批 {item}，麻煩你送到看板登記。",
      thanks: "交付得很準時，鎮上的餐桌會記得這份幫忙。",
    },
    merchant: {
      offer: "市集缺 {item}，我想先試一小批貨。",
      thanks: "品質不錯，這批我會好好賣。",
    },
    elder: {
      offer: "我想收些 {item} 做家常料理，份量不用多。",
      thanks: "辛苦了，這正合用。",
    },
    child: {
      offer: "可以幫我準備 {item} 嗎？我想帶去野餐。",
      thanks: "謝謝你！野餐袋變得好豐盛。",
    },
  };
  function hashString(s) {
    let h = 0;
    s = String(s || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function orderNpcIdFor(orderOrSeed) {
    const explicit = orderOrSeed && orderOrSeed.npcId;
    if (explicit && (C.NPCS || {})[explicit]) return explicit;
    const seed = typeof orderOrSeed === "string" ? orderOrSeed : (orderOrSeed && orderOrSeed.id);
    return ORDER_NPC_IDS[hashString(seed) % ORDER_NPC_IDS.length];
  }
  function orderNarrative(state, order) {
    const npcId = orderNpcIdFor(order);
    const npc = (C.NPCS || {})[npcId] || { name: "鎮民", title: "委託人" };
    const copy = ORDER_COPY[npcId] || ORDER_COPY.mayor;
    const firstId = Object.keys(order.wants || {})[0];
    const firstDef = getItemDef(firstId) || { name: firstId || "物資" };
    const qty = firstId ? order.wants[firstId] : 0;
    const itemText = firstId ? `${firstDef.name} x${qty}` : "物資";
    return {
      npcId,
      npcName: npc.name,
      npcTitle: npc.title,
      offer: order.flavor || copy.offer.replace("{item}", itemText),
      thanks: order.thanks || copy.thanks,
    };
  }
  function tutorialDeliveryOrderNeeded(state) {
    const story = state.story || {};
    const done = story.completed || {};
    const stats = state.stats || {};
    return story.questId === "first_delivery" && !done.first_delivery
      && (stats.fulfilledOrders || 0) === 0
      && ((stats.harvested || {}).wheat || 0) > 0;
  }
  function makeTutorialDeliveryOrder(now) {
    return {
      id: TUTORIAL_DELIVERY_ORDER_ID,
      wants: { wheat: CROPS.wheat.yield },
      rarity: "common",
      rewardCoins: 110,
      rewardXp: 8,
      expiresAt: now + GAME.orderTtlMs,
      tutorial: true,
      npcId: "mayor",
      flavor: "鎮長先替你掛一張首收小麥委託，交付 2 份就能完成。",
      thanks: "第一批小麥收到了，農場重新開張有個好開始。",
    };
  }
  function makeOrder(state, now, rng, idSeed) {
    const pool = availableOrderItems(state); // 作物 + 已解鎖動物產品
    const rarities = Object.values(ORDER_RARITY);
    const totalW = rarities.reduce((s, r) => s + r.weight, 0);
    let roll = (rng || Math.random)() * totalW, rarity = rarities[0];
    for (const r of rarities) { if (roll < r.weight) { rarity = r; break; } roll -= r.weight; }
    const rarityId = Object.keys(ORDER_RARITY).find((k) => ORDER_RARITY[k] === rarity);

    const nKinds = rarityId === "festival" && pool.length >= 2
      ? rngInt(rng, 2, Math.min(3, pool.length))
      : (pool.length >= 2 && (rng || Math.random)() < 0.45 ? 2 : 1);
    const wants = {}; let baseValue = 0, baseXp = 0;
    const chosen = [];
    for (let k = 0; k < nKinds; k++) {
      let itemId; let guard = 0;
      do { itemId = rngPick(rng, pool); guard++; } while (chosen.includes(itemId) && guard < 10);
      chosen.push(itemId);
      const [mn, mx] = ORDER_QTY[itemId] || [2, 5];
      const qty = rngInt(rng, mn, mx);
      wants[itemId] = (wants[itemId] || 0) + qty;
      const def = getItemDef(itemId);
      baseValue += (def ? def.sellValue : 0) * qty;
      baseXp += (CROPS[itemId] ? CROPS[itemId].xp : Math.round((def ? def.sellValue : 0) * 0.6)) * qty;
    }
    const id = "order_" + idSeed;
    return {
      id,
      wants,
      rarity: rarityId,
      rewardCoins: Math.round(baseValue * rarity.payMult),
      rewardXp: Math.max(1, Math.round(baseXp * 0.5 * rarity.xpMult)),
      expiresAt: now + GAME.orderTtlMs,
      npcId: orderNpcIdFor(id),
    };
  }
  function refreshOrders(state, now, rng) {
    // 移除過期訂單，補滿到 orderSlots
    state.orders = state.orders.filter((o) => o.expiresAt > now);
    if (tutorialDeliveryOrderNeeded(state)) {
      state.orders = state.orders.filter((o) => o.id !== TUTORIAL_DELIVERY_ORDER_ID);
      state.orders.unshift(makeTutorialDeliveryOrder(now));
      if (state.orders.length > GAME.orderSlots) state.orders.length = GAME.orderSlots;
    }
    let seed = (state.ordersSeededAt || 0);
    while (state.orders.length < GAME.orderSlots) {
      seed++;
      state.orders.push(makeOrder(state, now, rng, String(now) + "_" + seed));
    }
    state.ordersSeededAt = seed;
    return state.orders;
  }
  function canFulfill(state, order) {
    return Object.entries(order.wants).every(([cropId, qty]) => (state.storage.items[cropId] || 0) >= qty);
  }
  // 刻意設計：訂單是固定契約價（rewardCoins/rewardXp 在生成當下就定了），不吃天氣 sellMul——
  // 天氣只影響「直售」（sellMultiplier）。避免訂單獎勵隨天氣忽高忽低，讓訂單成為穩定的收益來源。
  function orderPayout(state, order) {
    const streakMul = 1 + Math.min(ORDER_STREAK_CAP, state.orderStreak * ORDER_STREAK_BONUS);
    const sellLv = state.upgrades.sellBonus;
    const sellBonus = sellLv > 0 ? UPGRADES.sellBonus.levels[sellLv - 1].value : 0;
    const coins = Math.round(order.rewardCoins * (1 + sellBonus + achievementBonus(state)) * streakMul);
    const xp = Math.round(order.rewardXp * streakMul);
    return { coins, xp, streakMul };
  }
  function fulfillOrder(state, orderId, now, rng) {
    const idx = state.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return { ok: false, reason: "gone" };
    const order = state.orders[idx];
    if (!canFulfill(state, order)) return { ok: false, reason: "short" };
    // 扣作物
    for (const [cropId, qty] of Object.entries(order.wants)) {
      state.storage.items[cropId] -= qty;
      if (state.storage.items[cropId] <= 0) delete state.storage.items[cropId];
      if (isQualityItem(cropId)) state.stats.qualitySold = (state.stats.qualitySold || 0) + qty;
    }
    state.orderStreak++;
    const pay = orderPayout(state, order);
    state.coins += pay.coins;
    state.stats.totalCoinsEarned += pay.coins;
    addXp(state, pay.xp);
    state.stats.fulfilledOrders++;
    if (order.rarity === "festival") {
      state.stats.festivalOrders = (state.stats.festivalOrders || 0) + 1;
      if (!state.collections) state.collections = {};
      state.collections.festival_lantern = true;
    }
    // 移除並補新單
    state.orders.splice(idx, 1);
    refreshOrders(state, now, rng);
    const story = order.rarity === "festival" ? syncStoryProgress(state, "festival_order", now) : null;
    checkAchievements(state);
    return { ok: true, coins: pay.coins, xp: pay.xp, streakMul: pay.streakMul, story };
  }
  function trashOrder(state, orderId, now, rng) {
    const idx = state.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return { ok: false };
    state.orders.splice(idx, 1);
    state.orderStreak = 0; // 丟單斷連
    refreshOrders(state, now, rng);
    return { ok: true };
  }

  // ---------- 升級 ----------
  function upgradeMaxLevel(key) { return UPGRADES[key].levels.length; }
  function nextUpgrade(state, key) {
    const lv = state.upgrades[key];
    if (lv >= upgradeMaxLevel(key)) return null;
    return UPGRADES[key].levels[lv]; // 下一級（lv 是已購級數，陣列 0-index = 下一級）
  }
  function buyUpgrade(state, key) {
    const next = nextUpgrade(state, key);
    if (!next) return { ok: false, reason: "maxed" };
    if (state.coins < next.cost) return { ok: false, reason: "no_coins" };
    state.coins -= next.cost;
    state.upgrades[key]++;
    // 開墾農地：補足 plots 陣列長度
    if (key === "plotCount") {
      const target = activePlotCount(state);
      while (state.plots.length < target) {
        state.plots.push({ id: "p" + String(state.plots.length + 1).padStart(2, "0"), cropId: null, plantedAt: 0 });
      }
    }
    return { ok: true, level: state.upgrades[key] };
  }
  function helperFlags(state) {
    const lv = state.upgrades.helperLevel;
    if (lv <= 0) return { autoHarvest: false, autoPlant: false };
    return UPGRADES.helperLevel.levels[lv - 1].value;
  }

  // ---------- 天氣 ----------
  function currentWeather(state, now) {
    if (state.level < WEATHER_UNLOCK_LEVEL) return "clear";
    if (!state.weather || now >= (state.weather.untilMs || 0)) return "clear";
    return state.weather.id;
  }
  function updateWeather(state, now, rng) {
    if (state.level < WEATHER_UNLOCK_LEVEL) { state.weather = { id: "clear", untilMs: 0 }; return false; }
    if (now < (state.weather.untilMs || 0)) return false;
    const roll = (rng || Math.random)();
    const id = roll < 0.32 ? "clear" : roll < 0.52 ? "rain" : roll < 0.68 ? "sunny" : roll < 0.80 ? "windy" : roll < 0.90 ? "fog" : roll < 0.96 ? "snow" : "storm";
    state.weather = { id, untilMs: now + WEATHER_DURATION_MS };
    return true;
  }

  // ---------- 幫手（線上 tick）----------
  // 每次呼叫處理一輪：成熟作物自動收成；有 autoPlant 則補種同作物（扣種子）
  function runHelperOnline(state, now) {
    const flags = helperFlags(state);
    if (!flags.autoHarvest) return { harvested: 0 };
    let harvested = 0;
    const active = activePlotCount(state);
    for (let i = 0; i < Math.min(state.plots.length, active); i++) {
      const plot = state.plots[i];
      if (!plot.cropId) continue;
      const prog = getCropProgress(state, plot, now);
      if (!prog.ready) continue;
      const cropId = plot.cropId;
      const r = harvest(state, i, now);
      if (r.ok) {
        harvested += r.added;
        if (flags.autoPlant && state.coins >= CROPS[cropId].seedCost) {
          plant(state, i, cropId, now);
        }
      }
    }
    return { harvested };
  }

  // ========================================================================
  // MVP2：建材 / 地圖障礙 / 建築 / 動物
  // ========================================================================

  // ---------- 建材 ----------
  function canAffordCost(state, cost) {
    if (!cost) return true;
    if (cost.coins && state.coins < cost.coins) return false;
    for (const k of Object.keys(MATERIALS)) if (cost[k] && (state.materials[k] || 0) < cost[k]) return false;
    return true;
  }
  function spendCost(state, cost) {
    if (!cost) return;
    if (cost.coins) state.coins -= cost.coins;
    for (const k of Object.keys(MATERIALS)) if (cost[k]) state.materials[k] -= cost[k];
  }
  function grantMaterials(state, grants) {
    for (const k of Object.keys(grants || {})) state.materials[k] = (state.materials[k] || 0) + grants[k];
  }

  // ---------- 地圖 / 障礙 ----------
  function getTile(state, tileId) { return (state.map.tiles || []).find((t) => t.id === tileId) || null; }
  function clearObstacle(state, tileId) {
    const tile = getTile(state, tileId);
    if (!tile || !tile.object) return { ok: false, reason: "no_obstacle" };
    const ob = OBSTACLES[tile.object];
    if (!ob) return { ok: false, reason: "unknown" };
    if (state.coins < ob.clearCost) return { ok: false, reason: "no_coins" };
    state.coins -= ob.clearCost;
    grantMaterials(state, ob.grants);
    const cleared = tile.object;
    tile.object = null;          // 釋出草地
    state.stats.cleared = (state.stats.cleared || 0) + 1;
    return { ok: true, cleared, grants: ob.grants };
  }

  // ---------- 建築 ----------
  function buildingUnlocked(state, type) { const d = BUILDINGS[type]; return !!d && state.level >= d.unlockLevel; }
  function buildingCount(state, type) { return (state.buildings || []).filter((b) => b.type === type).length; }
  function buildingAtMaxCount(state, type) {
    const def = BUILDINGS[type];
    return !!(def && typeof def.maxCount === "number" && def.maxCount > 0 && buildingCount(state, type) >= def.maxCount);
  }
  function canBuildOn(state, tile) { return !!tile && tile.terrain === "grass" && !tile.object && !tile.buildingId; }
  function buildBuilding(state, tileId, type, now) {
    now = now || Date.now();
    const def = BUILDINGS[type];
    if (!def) return { ok: false, reason: "unknown" };
    if (!buildingUnlocked(state, type)) return { ok: false, reason: "locked" };
    if (buildingAtMaxCount(state, type)) return { ok: false, reason: "max_count" };
    const tile = getTile(state, tileId);
    if (!canBuildOn(state, tile)) return { ok: false, reason: "bad_tile" };
    if (!canAffordCost(state, def.cost)) return { ok: false, reason: "cost" };
    spendCost(state, def.cost);
    const b = { id: "b_" + type + "_" + (state.buildings.length + 1), type, tileId, builtAt: now, level: 1 };
    state.buildings.push(b);
    tile.buildingId = b.id;
    // 動物家：自動入住 1 隻（讓收集產品立即可達）
    if (def.effect && def.effect.unlockAnimal) {
      addAnimal(state, b.id, def.effect.unlockAnimal[0], now);
    }
    return { ok: true, building: b };
  }

  // ---------- 動物 ----------
  function homeBuildingFor(state, animalType) {
    const homeType = ANIMALS[animalType].home;
    return (state.buildings || []).find((b) => b.type === homeType) || null;
  }
  function animalCapacity(state, buildingId) {
    const b = (state.buildings || []).find((x) => x.id === buildingId);
    if (!b) return 0;
    const def = BUILDINGS[b.type];
    return def && def.effect ? (def.effect.capacity || 0) : 0;
  }
  function animalsInHome(state, buildingId) { return (state.animals || []).filter((a) => a.homeId === buildingId); }

  // ---------- Stage 7：動物照護（親密度 → 產物品質）----------
  // 親密度＝上次照護當下的「已收藏值」，隨經過時間衰減，現算不模擬（同作物成長的哲學）。
  function animalAffinity(state, animal, now) {
    const banked = animal.affinity || 0;
    const elapsedMs = Math.max(0, now - (animal.lastCaredAt || animal.lastProducedAt || 0));
    const decay = (elapsedMs / (60 * 60 * 1000)) * AFFINITY_DECAY_PER_HOUR;
    return Math.max(0, Math.min(AFFINITY_MAX, banked - decay));
  }
  function qualityTierFor(affinity) {
    if (affinity >= AFFINITY_HAPPY_THRESHOLD) return "premium";
    if (affinity >= AFFINITY_GOOD_THRESHOLD) return "good";
    return "normal";
  }
  function qualityProductId(baseProduct, tier) { return tier === "normal" ? baseProduct : baseProduct + "_" + tier; }
  // 動物地圖狀態（給 UI 顯示提示圖示）：開心優先於各項照護提示
  function animalStatus(state, animal, now) {
    if (animalAffinity(state, animal, now) >= AFFINITY_HAPPY_THRESHOLD) return "happy";
    if (now - (animal.lastFedAt || 0) > STATUS_STALE_MS) return "hungry";
    if (now - (animal.lastWateredAt || 0) > STATUS_STALE_MS) return "thirsty";
    if (now - (animal.lastGroomedAt || 0) > STATUS_STALE_MS) return "needs_groom";
    return "happy";
  }
  // 澆水：免費、有冷卻，純照護動作（不產出）
  function waterAnimal(state, animalId, now) {
    const a = (state.animals || []).find((x) => x.id === animalId);
    if (!a) return { ok: false, reason: "gone" };
    if (now - (a.lastWateredAt || 0) < CARE_COOLDOWN_MS) return { ok: false, reason: "cooldown" };
    const cur = animalAffinity(state, a, now);
    a.lastWateredAt = now;
    a.affinity = Math.min(AFFINITY_MAX, cur + CARE_GAIN.water); a.lastCaredAt = now;
    a.bestAffinity = Math.max(a.bestAffinity || 0, a.affinity); // Stage 11 Journal 依賴此欄位，勿刪
    return { ok: true, affinity: a.affinity, status: animalStatus(state, a, now) };
  }
  // 梳理：免費、有冷卻，純照護動作（不產出）
  function groomAnimal(state, animalId, now) {
    const a = (state.animals || []).find((x) => x.id === animalId);
    if (!a) return { ok: false, reason: "gone" };
    if (now - (a.lastGroomedAt || 0) < CARE_COOLDOWN_MS) return { ok: false, reason: "cooldown" };
    const cur = animalAffinity(state, a, now);
    a.lastGroomedAt = now;
    a.affinity = Math.min(AFFINITY_MAX, cur + CARE_GAIN.groom); a.lastCaredAt = now;
    a.bestAffinity = Math.max(a.bestAffinity || 0, a.affinity); // Stage 11 Journal 依賴此欄位，勿刪
    return { ok: true, affinity: a.affinity, status: animalStatus(state, a, now) };
  }
  function isAnimalUnlocked(state, animalType) {
    // Stage 4 把 farmhouse/coop/barn/shop 改成一律預置的地圖常駐結構（RPG 世界感），
    // 但這代表「家已存在」不能再當解鎖條件 —— 改為直接檢查玩家等級（ANIMALS[type].unlockLevel）。
    // 起始雞是 seedStructures 直接塞進 state.animals（非經 buyAnimal），不受此檢查影響。
    const animalDef = ANIMALS[animalType];
    if (!animalDef || state.level < animalDef.unlockLevel) return false;
    const b = homeBuildingFor(state, animalType);
    if (!b) return false;
    const def = BUILDINGS[b.type];
    return !!(def.effect && def.effect.unlockAnimal && def.effect.unlockAnimal.indexOf(animalType) !== -1);
  }
  function addAnimal(state, buildingId, animalType, now) {
    // Stage 7 照護欄位：affinity 是「上次照護當下的已收藏值」，實際親密度依經過時間現算（見 animalAffinity）。
    const a = { id: "a_" + animalType + "_" + (state.animals.length + 1), type: animalType, homeId: buildingId, lastProducedAt: now,
      affinity: 0, lastCaredAt: now, lastFedAt: 0, lastWateredAt: 0, lastGroomedAt: 0, bestAffinity: 0 };
    state.animals.push(a);
    return a;
  }
  function buyAnimal(state, buildingId, animalType, now) {
    if (!isAnimalUnlocked(state, animalType)) return { ok: false, reason: "locked" };
    const home = (state.buildings || []).find((b) => b.id === buildingId);
    if (!home) return { ok: false, reason: "no_home" };
    if (animalsInHome(state, buildingId).length >= animalCapacity(state, buildingId)) return { ok: false, reason: "full" };
    const cost = ANIMALS[animalType].cost;
    if (state.coins < cost) return { ok: false, reason: "no_coins" };
    state.coins -= cost;
    return { ok: true, animal: addAnimal(state, buildingId, animalType, now) };
  }
  function animalProgress(state, animal, now) {
    const def = ANIMALS[animal.type];
    const elapsed = Math.max(0, now - animal.lastProducedAt);
    return { ready: elapsed >= def.produceMs, ratio: Math.min(1, elapsed / def.produceMs), remainingMs: Math.max(0, def.produceMs - elapsed) };
  }
  // 收集當下的親密度決定這次產物品質（tier）；品質品項 id 為 baseProduct 或 baseProduct_good/_premium
  function collectAnimal(state, animalId, now) {
    const a = (state.animals || []).find((x) => x.id === animalId);
    if (!a) return { ok: false, reason: "gone" };
    const def = ANIMALS[a.type];
    const cycles = Math.floor((now - a.lastProducedAt) / def.produceMs);
    if (cycles <= 0) return { ok: false, reason: "not_ready" };
    const tier = qualityTierFor(animalAffinity(state, a, now));
    const productId = qualityProductId(def.product, tier);
    const { added, lost } = addToStorage(state, productId, cycles);
    a.lastProducedAt += cycles * def.produceMs;
    state.stats.collected[productId] = (state.stats.collected[productId] || 0) + added;
    if (added > 0) recordDiscovery(state, productId, now);
    if (added > 0) checkAchievements(state);
    return { ok: true, product: productId, baseProduct: def.product, tier, added, lost, cycles };
  }
  function collectAllAnimals(state, now) {
    const perProduct = {}; let total = 0, lost = 0;
    for (const a of (state.animals || [])) {
      const r = collectAnimal(state, a.id, now);
      if (r.ok) { perProduct[r.product] = (perProduct[r.product] || 0) + r.added; total += r.added; lost += r.lost; }
    }
    return { perProduct, total, lost };
  }
  // 只收「單一建築（home）」內成熟動物的產物（per-building 收集，玩家走到該建築互動）
  function collectHome(state, homeId, now) {
    const perProduct = {}; let total = 0, lost = 0;
    for (const a of animalsInHome(state, homeId)) {
      const r = collectAnimal(state, a.id, now);
      if (r.ok) { perProduct[r.product] = (perProduct[r.product] || 0) + r.added; total += r.added; lost += r.lost; }
    }
    return { perProduct, total, lost };
  }
  // 餵食：花作物讓動物立即產出一份（主動玩法獎勵），同時是一種照護動作（漲親密度）。
  // Stage 7.1 修正兩點：(1) 有冷卻，避免無成本地狂點餵食把親密度/品質衝太快；
  // (2) 若動物已有自然累積的待收產物，餵食前先自動收掉，避免蓋掉 lastProducedAt 白白損失。
  function feedAnimal(state, animalId, now) {
    const a = (state.animals || []).find((x) => x.id === animalId);
    if (!a) return { ok: false, reason: "gone" };
    if (now - (a.lastFedAt || 0) < CARE_COOLDOWN_MS) return { ok: false, reason: "cooldown" };
    const def = ANIMALS[a.type];
    for (const k of Object.keys(def.feedCost)) if ((state.storage.items[k] || 0) < def.feedCost[k]) return { ok: false, reason: "no_feed" };
    let collectedFirst = null;
    if (Math.floor((now - a.lastProducedAt) / def.produceMs) > 0) collectedFirst = collectAnimal(state, animalId, now);
    for (const k of Object.keys(def.feedCost)) {
      state.storage.items[k] -= def.feedCost[k];
      if (state.storage.items[k] <= 0) delete state.storage.items[k];
    }
    const curAffinity = animalAffinity(state, a, now);
    a.lastFedAt = now; a.lastCaredAt = now;
    a.affinity = Math.min(AFFINITY_MAX, curAffinity + CARE_GAIN.feed);
    a.bestAffinity = Math.max(a.bestAffinity || 0, a.affinity); // Stage 11 Journal 依賴此欄位，勿刪
    const tier = qualityTierFor(a.affinity); // 餵食後立即以新親密度結算這份產物的品質
    const productId = qualityProductId(def.product, tier);
    const { added, lost } = addToStorage(state, productId, 1);
    state.stats.collected[productId] = (state.stats.collected[productId] || 0) + added;
    if (added > 0) recordDiscovery(state, productId, now);
    if (added > 0) checkAchievements(state);
    a.lastProducedAt = now; // 重置週期
    return { ok: true, product: productId, baseProduct: def.product, tier, added, lost, affinity: a.affinity, collectedFirst };
  }

  // ========================================================================
  // 可走動地圖：尋路 / 動作目標解析
  // ========================================================================
  function getTileById(state, id) { return (state.map.tiles || []).find((t) => t.id === id) || null; }
  function getTileXY(state, x, y) { return (state.map.tiles || []).find((t) => t.x === x && t.y === y) || null; }
  // 可站立：soil/grass/path 且無障礙、無建築/結構、無站點、非水、未明確阻擋
  function isWalkable(state, tile) {
    if (!tile) return false;
    const repaired = !!(state.flags && state.flags.bridgeRepaired);
    if (tile.terrain === "water") return tile.bridge && repaired; // 修好的斷橋可走，其餘水域不可
    if (tile.region === "east" && !repaired) return false;        // 東林封鎖區：修橋前不可進
    if (tile.region === "east_deep" && !(state.flags && state.flags.eastDeepUnlocked)) return false;
    if (tile.object) return false;
    if (tile.station) return false;
    if (tile.npc) return false;           // Stage 6：NPC 站位（走相鄰交談）
    if (tile.blocked) return false;       // 多格建築 footprint
    if (tile.structureId) return false;
    if (tile.buildingId) return false;
    return true;
  }
  // BFS 最短路徑（4 向，繞過障礙/水/建築）。回傳 tileId 陣列（不含起點、含終點）；不可達回 null
  function bfsPath(state, fromId, toId) {
    const from = getTileById(state, fromId), to = getTileById(state, toId);
    if (!from || !to || !isWalkable(state, to)) return null;
    if (fromId === toId) return [];
    const W = state.map.width, H = state.map.height;
    const k = (x, y) => x + "," + y;
    const parent = {}; parent[k(from.x, from.y)] = "__start__";
    const queue = [from]; const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    let found = false;
    while (queue.length) {
      const cur = queue.shift();
      if (cur.x === to.x && cur.y === to.y) { found = true; break; }
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nt = getTileXY(state, nx, ny);
        if (!isWalkable(state, nt)) continue;
        const nk = k(nx, ny);
        if (nk in parent) continue;
        parent[nk] = k(cur.x, cur.y);
        queue.push(nt);
      }
    }
    if (!found) return null;
    // 回溯
    const path = []; let ck = k(to.x, to.y);
    while (ck !== "__start__") {
      const [cx, cy] = ck.split(",").map(Number);
      path.push("t" + cx + "_" + cy);
      ck = parent[ck];
    }
    path.reverse(); path.shift(); // 去掉起點
    return path;
  }
  // 對「不可站立的目標」（障礙/建築/水），找最近的可站立相鄰格 + 路徑
  function pathToAdjacent(state, fromId, targetId) {
    const target = getTileById(state, targetId);
    if (!target) return null;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    let best = null;
    for (const [dx, dy] of dirs) {
      const nt = getTileXY(state, target.x + dx, target.y + dy);
      if (!nt || !isWalkable(state, nt)) continue;
      const p = bfsPath(state, fromId, nt.id);
      if (p && (best === null || p.length < best.path.length)) best = { tileId: nt.id, path: p };
    }
    return best;
  }
  // 走到目標或其相鄰格（依目標是否可站立），回傳 { path, standId }
  function planMoveTo(state, targetId) {
    const target = getTileById(state, targetId);
    if (!target) return null;
    if (isWalkable(state, target)) { const p = bfsPath(state, state.player.tileId, targetId); return p ? { path: p, standId: targetId } : null; }
    const adj = pathToAdjacent(state, state.player.tileId, targetId);
    return adj ? { path: adj.path, standId: adj.tileId } : null;
  }
  // 由站立格指向目標格的朝向（給角色面向）
  function facingTo(fromTile, toTile) {
    const dx = toTile.x - fromTile.x, dy = toTile.y - fromTile.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
    return dy >= 0 ? "down" : "up";
  }
  function plotOfTile(state, tile) { return tile && tile.plotIndex != null ? tile.plotIndex : null; }

  // ---------- 多格建築/結構 ----------
  function structureAt(state, tileId) {
    const tile = getTileById(state, tileId);
    if (!tile || !tile.structureId) return null;
    return (C.STRUCTURES || []).find((s) => s.id === tile.structureId) || null;
  }
  // 結構互動站立格：footprint 周邊最近可站立格 + 路徑
  function planMoveToStructure(state, structureId) {
    const s = (C.STRUCTURES || []).find((x) => x.id === structureId);
    if (!s) return null;
    let best = null;
    for (let dy = -1; dy <= s.h; dy++) for (let dx = -1; dx <= s.w; dx++) {
      const onEdge = dx === -1 || dx === s.w || dy === -1 || dy === s.h;
      if (!onEdge) continue;
      const nt = getTileXY(state, s.x + dx, s.y + dy);
      if (!nt || !isWalkable(state, nt)) continue;
      const p = bfsPath(state, state.player.tileId, nt.id);
      if (p && (best === null || p.length < best.path.length)) best = { path: p, standId: nt.id };
    }
    return best;
  }

  // ---------- 故事任務（地圖驅動）----------
  function currentQuest(state) {
    const id = state.story && state.story.questId;
    return id && C.QUESTS[id] ? C.QUESTS[id] : null;
  }
  function ensureStoryState(state) {
    if (!state.story) state.story = { questId: C.FIRST_QUEST, completed: {}, dialogueSeen: {}, markers: [] };
    if (!("questId" in state.story)) state.story.questId = C.FIRST_QUEST;
    if (!state.story.completed) state.story.completed = {};
    if (!state.stats) state.stats = { harvested: {}, fulfilledOrders: 0, totalCoinsEarned: 0, plantCount: 0, cleared: 0, collected: {} };
    if (!state.stats.harvested) state.stats.harvested = {};
    if (!state.stats.collected) state.stats.collected = {};
    if (typeof state.stats.festivalOrders !== "number") state.stats.festivalOrders = 0;
    if (!state.stats.seasonsReached) state.stats.seasonsReached = {};
  }
  function ensureMailState(state) {
    if (!state.mail) state.mail = { unlocked: {}, read: {}, replied: false };
    if (!state.mail.unlocked) state.mail.unlocked = {};
    if (!state.mail.read) state.mail.read = {};
    state.mail.replied = !!state.mail.replied;
    if (!state.collections) state.collections = {};
  }
  function letterById(id) {
    return (LETTERS || []).find((l) => l.id === id) || null;
  }
  function letterUnlockSatisfied(state, unlock, now) {
    unlock = unlock || {};
    ensureStoryState(state);
    if (unlock.type === "story_completed") return !!(state.story.completed && state.story.completed[unlock.id]);
    if (unlock.type === "flag") return !!(state.flags && state.flags[unlock.flag]);
    if (unlock.type === "season_reached") return !!(state.stats && state.stats.seasonsReached && state.stats.seasonsReached[unlock.season]);
    if (unlock.type === "festival_orders") return ((state.stats && state.stats.festivalOrders) || 0) >= (unlock.count || 1);
    if (unlock.type === "animal_happy") return (state.animals || []).some((a) => (a.bestAffinity || 0) >= AFFINITY_HAPPY_THRESHOLD);
    if (unlock.type === "level") return (state.level || 1) >= (unlock.level || 1);
    return false;
  }
  function evaluateLetters(state, now) {
    ensureMailState(state);
    ensureStoryState(state);
    const newly = [];
    for (const letter of (LETTERS || [])) {
      if (state.mail.unlocked[letter.id]) continue;
      if (!letterUnlockSatisfied(state, letter.unlock, now)) continue;
      state.mail.unlocked[letter.id] = true;
      newly.push(letter.id);
    }
    return newly;
  }
  function readLetter(state, id) {
    ensureMailState(state);
    const letter = letterById(id);
    if (!letter) return { ok: false, reason: "unknown" };
    if (!state.mail.unlocked[id]) return { ok: false, reason: "locked" };
    const wasRead = !!state.mail.read[id];
    state.mail.read[id] = true;
    let collectibleId = null;
    if (id === "letter_animals" && !state.collections.grandma_hat) {
      state.collections.grandma_hat = true;
      collectibleId = "grandma_hat";
    }
    checkAchievements(state);
    return { ok: true, id, wasRead, collectibleId };
  }
  function allChapter5LettersRead(state) {
    const read = (state.mail && state.mail.read) || {};
    return (CHAPTER5_LETTERS || []).length > 0 && (CHAPTER5_LETTERS || []).every((id) => !!read[id]);
  }
  function chapter5ReadCount(state) {
    const read = (state.mail && state.mail.read) || {};
    return (CHAPTER5_LETTERS || []).filter((id) => !!read[id]).length;
  }
  function replyLetter(state) {
    ensureMailState(state);
    if (!allChapter5LettersRead(state)) return { ok: false, reason: "unread" };
    const wasReplied = !!state.mail.replied;
    state.mail.replied = true;
    let collectibleId = null;
    if (!state.collections.seed_pouch) {
      state.collections.seed_pouch = true;
      collectibleId = "seed_pouch";
    }
    checkAchievements(state);
    return { ok: true, wasReplied, collectibleId };
  }
  function hasCrop(state, cropId) {
    return (state.plots || []).some((p) => p && p.cropId === cropId);
  }
  function hasWetCrop(state, cropId) {
    return (state.plots || []).some((p) => p && p.cropId === cropId && (p.wateredAt || 0) >= (p.plantedAt || 1));
  }
  function hasCollectedQuality(state) {
    const c = state.stats.collected || {};
    return Object.keys(c).some((k) => isQualityItem(k) && c[k] > 0);
  }
  function harvestedSeasonCount(state) {
    const seen = {};
    for (const [id, qty] of Object.entries((state.stats && state.stats.harvested) || {})) {
      const crop = CROPS[id];
      if (qty > 0 && crop && crop.season) seen[crop.season] = true;
    }
    return Object.keys(seen).length;
  }
  function hasCollectedDuckEgg(state) {
    const c = (state.stats && state.stats.collected) || {};
    return Object.keys(c).some((id) => c[id] > 0 && (id === "duck_egg" || id.indexOf("duck_egg_") === 0));
  }
  function questSatisfied(state, q, event, now) {
    if (!q) return false;
    now = now || Date.now();
    if (q.id === "intro_reopen_farm") return q.trigger === event;
    if (q.id === "plant_wheat") return hasCrop(state, "wheat");
    if (q.id === "first_water") return hasWetCrop(state, "wheat");
    if (q.id === "first_harvest") return ((state.stats.harvested || {}).wheat || 0) > 0;
    if (q.id === "first_delivery") return (state.stats.fulfilledOrders || 0) > 0 || q.objective === event;
    if (q.id === "clear_old_path") return (state.stats.cleared || 0) > 0 || q.objective === event;
    // 第二章（Stage 5）
    if (q.id === "repair_bridge") return !!(state.flags && state.flags.bridgeRepaired);
    if (q.id === "explore_new_area") return !!(state.flags && state.flags.eventsClaimed && state.flags.eventsClaimed.east_clearing) || q.objective === event;
    if (q.id === "discover_east_forage") return !!(state.flags && state.flags.eastForageDiscovered) || q.objective === event;
    if (q.id === "collect_east_forage") return eastForageStatus(state, now).collectedAll;
    if (q.id === "report_east_forage") return !!(state.flags && state.flags.eastForageReported) || q.objective === event;
    // 第三章（Stage 7：動物照護）
    if (q.id === "learn_animal_care") return q.trigger === event;
    if (q.id === "feed_care_animal") return q.objective === event;
    if (q.id === "raise_affinity_happy") return (state.animals || []).some((a) => (a.bestAffinity || animalAffinity(state, a, now)) >= AFFINITY_HAPPY_THRESHOLD);
    if (q.id === "collect_quality_product") return hasCollectedQuality(state);
    if (q.id === "deliver_quality_order") return (state.stats.qualitySold || 0) > 0;
    // 第四章（R47：豐年祭與四季物產）
    if (q.id === "prepare_four_seasons") return harvestedSeasonCount(state) >= 4 || q.objective === event;
    if (q.id === "welcome_ducks") return hasCollectedDuckEgg(state) || q.objective === event;
    if (q.id === "finish_festival_order") return (state.stats.festivalOrders || 0) > 0 || q.objective === event;
    return q.trigger === event || q.objective === event;
  }
  function syncStoryProgress(state, event, now) {
    ensureStoryState(state);
    let firstCompleted = null;
    const completedIds = [];
    for (let guard = 0; guard < 12; guard++) {
      const q = currentQuest(state);
      if (!questSatisfied(state, q, event, now)) break;
      state.story.completed[q.id] = true;
      if (!firstCompleted) firstCompleted = q.id;
      completedIds.push(q.id);
      state.story.questId = q.next || null;
      event = null; // 後續任務只用已存在的遊戲狀態同步，避免同一事件誤跳多關。
    }
    return completedIds.length
      ? { ok: true, completed: firstCompleted, completedIds, next: state.story.questId }
      : { ok: false };
  }
  // 事件推進：read_sign / plant / water / harvest / deliver / clear / npc_elder / care_animal ...
  function advanceStory(state, event, now) {
    return syncStoryProgress(state, event, now);
  }
  // 目前任務在地圖上的標記目標 tileId（給 marker 渲染）
  function questMarkerTile(state, now) {
    const q = currentQuest(state); if (!q || !q.marker) return null;
    const m = q.marker;
    if (m.kind === "station") { const t = state.map.tiles.find((tl) => tl.station === m.type); return t ? t.id : null; }
    if (m.kind === "obstacle") { const t = state.map.tiles.find((tl) => tl.object === m.object); return t ? t.id : null; }
    if (m.kind === "bridge") {
      if (q.id === "repair_bridge") {
        const mt = bridgeMaterialTargetTile(state);
        if (mt) return mt.id;
      }
      const t = state.map.tiles.find((tl) => tl.bridge); return t ? t.id : null;
    }
    if (m.kind === "event") { const t = state.map.tiles.find((tl) => tl.event === m.event); return t ? t.id : null; }
    if (m.kind === "forage") {
      const t = eastForageTargetTile(state, now || Date.now());
      return t ? t.id : null;
    }
    if (m.kind === "npc") { const t = state.map.tiles.find((tl) => tl.npc === m.type); return t ? t.id : null; }
    if (m.kind === "structure") {
      const s = (C.STRUCTURES || []).find((x) => x.id === m.id); if (!s) return null;
      const t = state.map.tiles.find((tl) => tl.structureId === s.id); return t ? t.id : null;
    }
    if (m.kind === "building") {
      const b = (state.buildings || []).find((x) => x.type === m.type);
      if (b && b.tileId) return b.tileId;
      const t = state.map.tiles.find((tl) => tl.terrain === "grass" && !tl.object && !tl.blocked && !tl.station && !tl.structureId && !tl.buildingId && !tl.npc);
      return t ? t.id : null;
    }
    if (m.kind === "soil") {
      const active = activePlotCount(state);
      for (const t of state.map.tiles) {
        if (t.plotIndex == null || t.plotIndex >= active) continue;
        const plot = state.plots[t.plotIndex];
        if (q.objective === "plant" && !plot.cropId) return t.id;
        if (q.objective === "harvest" && plot.cropId && getCropProgress(state, plot, now || Date.now()).ready) return t.id;
      }
      const f = state.map.tiles.find((t) => t.plotIndex != null && t.plotIndex < active);
      return f ? f.id : null;
    }
    return null;
  }

  // ---------- Stage 5：世界探索（橋 / 封鎖區 / 事件點）----------
  function bridgeTile(state) { return state.map.tiles.find((t) => t.bridge) || null; }
  function eventTile(state, eventId) { return state.map.tiles.find((t) => t.event === eventId) || null; }
  // 序章（第一章）是否全完成（修橋解鎖條件之一）
  function chapter1Done(state) {
    const ids = C.PROLOGUE_QUESTS || [];
    const done = (state.story && state.story.completed) || {};
    return ids.length > 0 && ids.every((id) => done[id]);
  }
  function chapter2Done(state) {
    const ids = C.CHAPTER2_QUESTS || [];
    const done = (state.story && state.story.completed) || {};
    return ids.length > 0 && ids.every((id) => done[id]);
  }
  // 第三章（動物照護）是否全完成（NPC 對話進 ch3done、開放 Stage 10 委託的前置條件）
  function chapter3Done(state) {
    const ids = C.CHAPTER3_QUESTS || [];
    const done = (state.story && state.story.completed) || {};
    return ids.length > 0 && ids.every((id) => done[id]);
  }
  function chapter4Done(state) {
    const ids = C.CHAPTER4_QUESTS || [];
    const done = (state.story && state.story.completed) || {};
    return ids.length > 0 && ids.every((id) => done[id]);
  }
  function chapter5Done(state) {
    ensureMailState(state);
    return allChapter5LettersRead(state) && !!state.mail.replied;
  }
  // 修橋條件：序章 6/6 + 木材/石頭足夠（用真資源，非按面板）
  function canRepairBridge(state) {
    if (!state.flags) return { ok: false, reason: "flags" };
    if (state.flags.bridgeRepaired) return { ok: false, reason: "done" };
    if (!chapter1Done(state)) return { ok: false, reason: "chapter", need: C.BRIDGE_COST };
    const status = bridgeMaterialStatus(state);
    for (const k in status.missing) if (status.missing[k] > 0) return { ok: false, reason: "materials", need: status.cost, status };
    return { ok: true, need: C.BRIDGE_COST, status };
  }
  function bridgeMaterialStatus(state) {
    const cost = C.BRIDGE_COST || {};
    const have = {}, missing = {}, sources = {};
    for (const k in cost) {
      have[k] = (state.materials && state.materials[k]) || 0;
      missing[k] = Math.max(0, cost[k] - have[k]);
      sources[k] = (state.map.tiles || [])
        .filter((t) => t.object && OBSTACLES[t.object] && (OBSTACLES[t.object].grants || {})[k] > 0)
        .map((t) => ({ tileId: t.id, object: t.object, grants: OBSTACLES[t.object].grants[k], clearCost: OBSTACLES[t.object].clearCost }));
    }
    const ready = Object.keys(cost).every((k) => missing[k] <= 0);
    return { cost, have, missing, sources, ready };
  }
  function bridgeMaterialTargetTile(state) {
    if (state.flags && state.flags.bridgeRepaired) return null;
    if (!chapter1Done(state)) return bridgeTile(state);
    const status = bridgeMaterialStatus(state);
    for (const k of ["wood", "stone"]) {
      if ((status.missing[k] || 0) <= 0) continue;
      for (const src of status.sources[k] || []) {
        const tile = getTileById(state, src.tileId);
        if (tile && planMoveTo(state, tile.id)) return tile;
      }
    }
    return bridgeTile(state);
  }
  function forageNodeDef(nodeId) {
    return (C.FORAGE_NODES || []).find((n) => n.id === nodeId) || null;
  }
  function forageTile(state, nodeId) {
    return (state.map.tiles || []).find((t) => t.forage === nodeId) || null;
  }
  function forageNodeStatus(state, nodeId, now) {
    const node = forageNodeDef(nodeId);
    if (!node) return null;
    now = now || Date.now();
    const last = ((state.flags && state.flags.forageNodes) || {})[node.id] || 0;
    const cooldownMs = node.cooldownMs || C.FORAGE_NODE_COOLDOWN_MS || 0;
    const readyAt = last + cooldownMs;
    const unlocked = !node.requiresFlag || !!(state.flags && state.flags[node.requiresFlag]);
    const ready = unlocked && (!last || now >= readyAt);
    return { node, item: (C.FORAGE_ITEMS || {})[node.itemId], lastCollectedAt: last, readyAt, ready, unlocked, remainingMs: ready ? 0 : Math.max(0, readyAt - now) };
  }
  function eastForageStatus(state, now) {
    const wants = (C.EAST_FORAGE_REPORT && C.EAST_FORAGE_REPORT.wants) || {};
    const collected = (state.stats && state.stats.collected) || {};
    const storage = (state.storage && state.storage.items) || {};
    const have = {}, found = {};
    for (const id of Object.keys(wants)) {
      have[id] = storage[id] || 0;
      found[id] = collected[id] || 0;
    }
    const readyForReport = Object.keys(wants).every((id) => have[id] >= wants[id]);
    const collectedAll = Object.keys(wants).every((id) => found[id] >= wants[id]);
    const nodes = (C.FORAGE_NODES || []).map((n) => Object.assign({ tile: forageTile(state, n.id) }, forageNodeStatus(state, n.id, now)));
    return {
      discovered: !!(state.flags && state.flags.eastForageDiscovered),
      reported: !!(state.flags && state.flags.eastForageReported),
      wants, have, found, readyForReport, collectedAll, nodes,
    };
  }
  function eastForageTargetTile(state, now) {
    const q = currentQuest(state);
    const status = eastForageStatus(state, now);
    if (q && q.id === "discover_east_forage") {
      const n = status.nodes.find((x) => x.tile && planMoveTo(state, x.tile.id));
      return n ? n.tile : null;
    }
    if (q && q.id === "collect_east_forage") {
      for (const itemId of Object.keys(status.wants)) {
        if ((status.found[itemId] || 0) >= status.wants[itemId]) continue;
        const n = status.nodes.find((x) => x.node.itemId === itemId && x.ready && x.tile && planMoveTo(state, x.tile.id));
        if (n) return n.tile;
      }
      const anyReady = status.nodes.find((x) => x.ready && x.tile && planMoveTo(state, x.tile.id));
      if (anyReady) return anyReady.tile;
    }
    return null;
  }
  function eastDeepStatus(state) {
    const cost = C.EAST_DEEP_UNLOCK_COST || {};
    const have = { coins: state.coins || 0 };
    const missing = {};
    for (const k of Object.keys(MATERIALS)) have[k] = (state.materials && state.materials[k]) || 0;
    for (const k of Object.keys(cost)) missing[k] = Math.max(0, cost[k] - (have[k] || 0));
    const prerequisites = !!(state.flags && state.flags.bridgeRepaired && state.flags.eastForageReported);
    const unlocked = !!(state.flags && state.flags.eastDeepUnlocked);
    return {
      unlocked,
      prerequisites,
      cost,
      have,
      missing,
      ready: !unlocked && prerequisites && Object.values(missing).every((n) => n <= 0),
      collectibleId: "east_deep_rubbing",
      rareNodes: (C.FORAGE_NODES || []).filter((n) => n.requiresFlag === "eastDeepUnlocked").map((n) => n.id),
    };
  }
  function canUnlockEastDeep(state) {
    const st = eastDeepStatus(state);
    if (st.unlocked) return { ok: false, reason: "done", status: st };
    if (!st.prerequisites) return { ok: false, reason: "story", status: st };
    if (!st.ready) return { ok: false, reason: "cost", status: st };
    return { ok: true, status: st };
  }
  function unlockEastDeep(state, now) {
    const chk = canUnlockEastDeep(state);
    if (!chk.ok) return chk;
    if (!state.flags) state.flags = {};
    spendCost(state, chk.status.cost);
    state.flags.eastDeepUnlocked = true;
    if (!state.flags.eventsClaimed) state.flags.eventsClaimed = {};
    state.flags.eventsClaimed.east_deep_gate = true;
    if (!state.collections) state.collections = {};
    state.collections.east_deep_rubbing = true;
    return { ok: true, cost: chk.status.cost, collectibleId: "east_deep_rubbing", now: now || Date.now() };
  }
  function repairBridge(state, now) {
    const chk = canRepairBridge(state); if (!chk.ok) return chk;
    const cost = C.BRIDGE_COST || {};
    for (const k in cost) state.materials[k] = (state.materials[k] || 0) - cost[k];
    state.flags.bridgeRepaired = true;
    const story = syncStoryProgress(state, "repair_bridge"); // 推進第二章
    return { ok: true, story, cost };
  }
  function discoverForage(state, nodeId, now) {
    const node = forageNodeDef(nodeId);
    if (!node) return { ok: false, reason: "unknown" };
    if (!state.flags || !state.flags.bridgeRepaired) return { ok: false, reason: "locked" };
    if (node.requiresFlag && !state.flags[node.requiresFlag]) return { ok: false, reason: "locked_deep" };
    state.flags.eastForageDiscovered = true;
    const story = syncStoryProgress(state, "discover_forage", now);
    return { ok: true, node, story };
  }
  function gatherForage(state, nodeId, now) {
    now = now || Date.now();
    const st = forageNodeStatus(state, nodeId, now);
    if (!st) return { ok: false, reason: "unknown" };
    if (!state.flags || !state.flags.bridgeRepaired) return { ok: false, reason: "locked" };
    if (!st.unlocked) return { ok: false, reason: "locked_deep" };
    if (!state.flags.eastForageDiscovered) return { ok: false, reason: "undiscovered" };
    if (!st.ready) return { ok: false, reason: "cooldown", readyAt: st.readyAt };
    const qty = st.node.yield || 1;
    const { added, lost } = addToStorage(state, st.node.itemId, qty);
    if (!state.flags.forageNodes) state.flags.forageNodes = {};
    state.flags.forageNodes[st.node.id] = now;
    state.stats.collected[st.node.itemId] = (state.stats.collected[st.node.itemId] || 0) + added;
    if (added > 0) recordDiscovery(state, st.node.itemId, now);
    const story = syncStoryProgress(state, "collect_forage", now);
    return { ok: true, node: st.node, item: st.item, added, lost, story };
  }
  function ensureEastForageReportRequest(state, now) {
    const cfg = C.EAST_FORAGE_REPORT;
    if (!cfg || !currentQuest(state) || currentQuest(state).id !== "report_east_forage") return null;
    ensureNpcRequestState(state);
    if (state.npcRequests[cfg.npcId]) return state.npcRequests[cfg.npcId];
    const req = {
      id: "req_east_forage_report",
      npcId: cfg.npcId,
      wants: Object.assign({}, cfg.wants),
      rewardCoins: cfg.rewardCoins,
      rewardXp: cfg.rewardXp,
      createdAt: now || Date.now(),
      storyEvent: "report_forage",
      flavorOffer: cfg.offer,
      flavorDone: cfg.done,
    };
    state.npcRequests[cfg.npcId] = req;
    return req;
  }
  // 走到事件點：首次給一次性獎勵 + 推進故事
  function triggerEvent(state, eventId, now) {
    if (eventId === "east_deep_gate") return unlockEastDeep(state, now);
    const ev = (C.EVENTS || {})[eventId]; if (!ev) return { ok: false, reason: "unknown" };
    if (!state.flags.eventsClaimed) state.flags.eventsClaimed = {};
    const already = !!state.flags.eventsClaimed[eventId];
    let reward = null;
    if (!already) {
      reward = ev.reward || null;
      if (reward) {
        if (reward.coins) { state.coins += reward.coins; state.stats.totalCoinsEarned = (state.stats.totalCoinsEarned || 0) + reward.coins; }
        if (reward.materials) for (const k in reward.materials) state.materials[k] = (state.materials[k] || 0) + reward.materials[k];
      }
      if (ev.once) state.flags.eventsClaimed[eventId] = true;
    }
    const story = syncStoryProgress(state, "reach_event");
    return { ok: true, reward, already, story };
  }

  // ---------- Stage 6：NPC 對話（依故事進度變台詞）----------
  function npcAt(state, tileId) {
    const t = getTileById(state, tileId);
    return t && t.npc ? (C.NPCS || {})[t.npc] : null;
  }
  // 對話階段：start → ch1done → bridge → ch2done → ch3done → ch4done
  function npcPhase(state) {
    if (chapter5Done(state)) return "ch5done";
    if (chapter4Done(state)) return "ch4done";
    if (chapter3Done(state)) return "ch3done";
    if (chapter2Done(state)) return "ch2done";
    if (state.flags && state.flags.bridgeRepaired) return "bridge";
    if (chapter1Done(state)) return "ch1done";
    return "start";
  }
  // 回傳此 NPC 在目前階段要說的一段台詞（lineIdx 由 UI 傳入做循環）；若有進行中委託，
  // line 會換成委託台詞，並在回傳值附上 request 唯讀投影供 UI 判斷是否顯示交付按鈕。
  function npcDialogue(state, npcId, lineIdx) {
    const npc = (C.NPCS || {})[npcId]; if (!npc) return null;
    const order = ["ch5done", "ch4done", "ch3done", "ch2done", "bridge", "ch1done", "start"];
    const phase = npcPhase(state);
    // 取目前階段的台詞；若該階段未定義，往較早階段回退
    let lines = null;
    for (let i = order.indexOf(phase); i < order.length; i++) {
      if (npc.lines[order[i]]) { lines = npc.lines[order[i]]; break; }
    }
    if (!lines || !lines.length) lines = ["……"];
    const idx = ((lineIdx || 0) % lines.length + lines.length) % lines.length;
    let line = lines[idx];
    let request = null;
    const cfg = (C.NPC_REQUESTS || {})[npcId];
    const req = (state.npcRequests || {})[npcId]; // 純讀取，委託狀態的初始化交給 generate/fulfill/decline/migrate
    if (req) {
      const itemId = Object.keys(req.wants)[0];
      const itemName = (getItemDef(itemId) || {}).name || itemId;
      const canDeliver = canFulfillNpcRequest(state, npcId);
      line = (req.flavorOffer || (cfg && cfg.flavorOffer && cfg.flavorOffer[0]) || "……").replace("{item}", itemName + " x" + req.wants[itemId]);
      request = { id: req.id, wants: req.wants, rewardCoins: req.rewardCoins, rewardXp: req.rewardXp,
        canDeliver, sideQuestId: req.sideQuestId || null, sideQuestStepId: req.sideQuestStepId || null };
    }
    return { id: npc.id, name: npc.name, title: npc.title, frame: npc.frame, phase, line, lineCount: lines.length, request };
  }

  // ---------- Stage 10：NPC 重複委託（走近觸發、交付後進冷卻，非到期制）----------
  function ensureNpcRequestState(state) {
    if (!state.npcRequests) state.npcRequests = {};
    if (!state.npcRequestLog) state.npcRequestLog = {};
  }
  function ensureNpcSideQuestState(state) {
    if (!state.npcSideQuests) state.npcSideQuests = {};
  }
  function npcSideQuestDef(npcId) {
    return (C.NPC_SIDE_QUESTS || {})[npcId] || null;
  }
  function sideQuestSteps(def) {
    if (!def) return [];
    if (Array.isArray(def.steps) && def.steps.length) return def.steps;
    return [{ id: def.id, title: def.title, wants: def.wants, rewardCoins: def.rewardCoins,
      rewardXp: def.rewardXp, offer: def.offer, done: def.done }];
  }
  function sideQuestCompletedSteps(rec, def) {
    const total = sideQuestSteps(def).length;
    if (!rec) return 0;
    if (typeof rec.completedSteps === "number") return Math.max(0, Math.min(total, rec.completedSteps));
    // R15 舊存檔：status=done 代表第一章已完成；R19 還要能續接第二章。
    if (rec.status === "done") return Math.min(1, total);
    return 0;
  }
  function npcSideQuestUnlocked(state, npcId) {
    return !!npcSideQuestDef(npcId) && chapter3Done(state);
  }
  function npcSideQuestStatus(state, npcId) {
    const def = npcSideQuestDef(npcId); if (!def) return null;
    const rec = ((state && state.npcSideQuests) || {})[npcId] || {};
    const req = state && state.npcRequests && state.npcRequests[npcId];
    const steps = sideQuestSteps(def);
    const completedSteps = sideQuestCompletedSteps(rec, def);
    const currentStep = steps[Math.min(completedSteps, Math.max(0, steps.length - 1))] || def;
    const activeReq = !!(req && req.sideQuestId === def.id);
    const completed = completedSteps >= steps.length;
    const unlocked = npcSideQuestUnlocked(state, npcId);
    const status = completed ? "done" : (activeReq || rec.status === "active") ? "active" : unlocked ? "available" : "locked";
    return {
      id: def.id, npcId, title: currentStep.title || def.title, chainTitle: def.title,
      stepId: currentStep.id || def.id, stepIndex: Math.min(completedSteps + 1, steps.length), totalSteps: steps.length,
      completedSteps, wants: Object.assign({}, currentStep.wants || def.wants),
      rewardCoins: currentStep.rewardCoins != null ? currentStep.rewardCoins : def.rewardCoins,
      rewardXp: currentStep.rewardXp != null ? currentStep.rewardXp : def.rewardXp,
      status, unlocked, completed, startedAt: rec.startedAt || 0, completedAt: rec.completedAt || 0,
      lore: def.lore || "", loreUnlocked: completed,
    };
  }
  function ensureNpcSideQuestRequest(state, npcId, now) {
    const def = npcSideQuestDef(npcId); if (!def || !npcSideQuestUnlocked(state, npcId)) return null;
    ensureNpcRequestState(state); ensureNpcSideQuestState(state);
    const rec = state.npcSideQuests[npcId] || {};
    const steps = sideQuestSteps(def);
    const completedSteps = sideQuestCompletedSteps(rec, def);
    if (completedSteps >= steps.length) return null;
    const active = state.npcRequests[npcId];
    if (active) return active.sideQuestId === def.id ? active : null;
    const step = steps[completedSteps] || def;
    const req = {
      id: "side_" + (step.id || def.id),
      npcId,
      wants: Object.assign({}, step.wants || def.wants),
      rewardCoins: step.rewardCoins != null ? step.rewardCoins : def.rewardCoins,
      rewardXp: step.rewardXp != null ? step.rewardXp : def.rewardXp,
      createdAt: now || Date.now(),
      sideQuestId: def.id,
      sideQuestStepId: step.id || def.id,
      sideQuestStepIndex: completedSteps,
      flavorOffer: step.offer || def.offer,
      flavorDone: step.done || def.done,
    };
    state.npcSideQuests[npcId] = Object.assign({}, rec, {
      id: def.id, status: "active", completedSteps,
      startedAt: rec.startedAt || req.createdAt,
    });
    state.npcRequests[npcId] = req;
    return req;
  }
  // 這位 NPC 目前實際能開出的候選品項（設定白名單 ∩ 玩家已解鎖/已發現的品項）
  function npcRequestPool(state, npcId) {
    const cfg = (C.NPC_REQUESTS || {})[npcId]; if (!cfg) return [];
    const avail = availableOrderItems(state);
    return cfg.pool.filter((id) => avail.indexOf(id) !== -1);
  }
  // 這位 NPC 現在能不能生成新委託：要先學完動物照護（ch3done）、身上沒有進行中委託、
  // 冷卻已過、且至少有一項玩家已發現的候選品項——四個條件缺一都不生成。
  function canRequestFrom(state, npcId, now) {
    ensureNpcRequestState(state);
    if (!(C.NPC_REQUESTS || {})[npcId]) return { ok: false, reason: "no_npc" };
    if (!chapter3Done(state)) return { ok: false, reason: "story" };
    if (state.npcRequests[npcId]) return { ok: false, reason: "active" };
    const log = state.npcRequestLog[npcId];
    const readyAt = (log && log.lastRequestAt || 0) + (C.NPC_REQUEST_COOLDOWN_MS || 0);
    if (log && now < readyAt) return { ok: false, reason: "cooldown", readyAt };
    if (npcRequestPool(state, npcId).length === 0) return { ok: false, reason: "no_pool" };
    return { ok: true };
  }
  // 生成一張新委託（單一品項，數量比市集訂單略少，維持「小委託」份量感）。
  // 報酬基準用 sellUnitValue（吃當下 sellBonus/成就/天氣），不是原始 sellValue，
  // 否則玩家升級市集人脈或遇到豔陽後，直接賣會比交付委託划算，委託就變成虧本互動。
  function generateNpcRequest(state, npcId, now, rng) {
    const chk = canRequestFrom(state, npcId, now); if (!chk.ok) return null;
    const cfg = C.NPC_REQUESTS[npcId];
    const pool = npcRequestPool(state, npcId);
    const itemId = rngPick(rng, pool);
    const [mn, mx] = ORDER_QTY[itemId] || [2, 5];
    const qty = Math.max(1, Math.round(rngInt(rng, mn, mx) * 0.6));
    const baseValue = sellUnitValue(state, itemId, now) * qty;
    const req = {
      id: "req_" + npcId + "_" + now,
      npcId,
      wants: { [itemId]: qty },
      rewardCoins: Math.round(baseValue * 1.2 * cfg.rewardMul),
      rewardXp: Math.max(1, Math.round(baseValue * 0.6 * cfg.rewardMul)),
      createdAt: now,
    };
    state.npcRequests[npcId] = req;
    return req;
  }
  function canFulfillNpcRequest(state, npcId) {
    ensureNpcRequestState(state);
    const req = state.npcRequests[npcId]; if (!req) return false;
    return Object.entries(req.wants).every(([id, qty]) => (state.storage.items[id] || 0) >= qty);
  }
  // 交付：扣庫存、發獎、記錄冷卻與完成次數，不像市集訂單一樣自動補新單（要等冷卻+再次走近）
  function fulfillNpcRequest(state, npcId, now) {
    ensureNpcRequestState(state);
    const req = state.npcRequests[npcId];
    if (!req) return { ok: false, reason: "none" };
    if (!canFulfillNpcRequest(state, npcId)) return { ok: false, reason: "short" };
    for (const [id, qty] of Object.entries(req.wants)) {
      state.storage.items[id] -= qty;
      if (state.storage.items[id] <= 0) delete state.storage.items[id];
      if (isQualityItem(id)) state.stats.qualitySold = (state.stats.qualitySold || 0) + qty;
    }
    state.coins += req.rewardCoins; state.stats.totalCoinsEarned += req.rewardCoins;
    addXp(state, req.rewardXp);
    if (!state.npcRequestLog[npcId]) state.npcRequestLog[npcId] = { lastRequestAt: 0, fulfilledCount: 0 };
    state.npcRequestLog[npcId].lastRequestAt = now;
    state.npcRequestLog[npcId].fulfilledCount++;
    state.stats.npcRequestsCompleted = (state.stats.npcRequestsCompleted || 0) + 1;
    delete state.npcRequests[npcId];
    let story = null;
    if (req.storyEvent === "report_forage") {
      if (!state.flags) state.flags = {};
      state.flags.eastForageReported = true;
      story = syncStoryProgress(state, "report_forage", now);
    }
    if (req.sideQuestId) {
      ensureNpcSideQuestState(state);
      const prev = state.npcSideQuests[npcId] || {};
      const def = npcSideQuestDef(npcId);
      const totalSteps = sideQuestSteps(def).length || 1;
      const completedSteps = Math.min(totalSteps, Math.max(sideQuestCompletedSteps(prev, def), (req.sideQuestStepIndex || 0)) + 1);
      const doneAll = completedSteps >= totalSteps;
      state.npcSideQuests[npcId] = Object.assign({}, prev, {
        id: req.sideQuestId,
        status: doneAll ? "done" : "available",
        completedSteps,
        lastStepId: req.sideQuestStepId || req.sideQuestId,
        lastStepCompletedAt: now,
        startedAt: prev.startedAt || req.createdAt || now,
        completedAt: doneAll ? now : (prev.completedAt || 0),
        loreUnlockedAt: doneAll ? now : (prev.loreUnlockedAt || 0),
      });
    }
    checkAchievements(state);
    return { ok: true, coins: req.rewardCoins, xp: req.rewardXp, npcId, story,
      sideQuestId: req.sideQuestId || null, doneLine: req.flavorDone || null };
  }
  // 放棄委託：清掉這張委託並跟交付一樣進冷卻——冷卻要一致，否則玩家能用「棄了重抽」
  // 無限刷到好賠率的品項，失去節流意義；用來解掉抽到「幾乎摸不到」品項時的卡關委託。
  function declineNpcRequest(state, npcId, now) {
    ensureNpcRequestState(state);
    const req = state.npcRequests[npcId];
    if (!req) return { ok: false, reason: "none" };
    delete state.npcRequests[npcId];
    if (req.sideQuestId) {
      ensureNpcSideQuestState(state);
      const prev = state.npcSideQuests[npcId] || {};
      const def = npcSideQuestDef(npcId);
      state.npcSideQuests[npcId] = Object.assign({}, prev, {
        id: req.sideQuestId,
        completedSteps: sideQuestCompletedSteps(prev, def),
        status: "available",
      });
    }
    if (!state.npcRequestLog[npcId]) state.npcRequestLog[npcId] = { lastRequestAt: 0, fulfilledCount: 0 };
    state.npcRequestLog[npcId].lastRequestAt = now;
    return { ok: true };
  }

  // ---------- Stage 11：Farm Journal（唯讀彙總層，只讀既有 state 欄位，不建立平行狀態）----------
  // 這一整組函式都不改 state，只是把 A-D 系統各自的資料換個角度彙總呈現；
  // 「玩家有沒有發現」一律沿用該系統原本的閥門（harvested/collected/dialogueSeen），
  // 不新發明一套判斷，否則兩邊定義漂移就會出現「Journal 說發現了，實際系統說沒有」的裂縫。
  function itemSourceHint(itemId) {
    if (CROPS[itemId]) {
      const c = CROPS[itemId];
      return `Lv${c.unlockLevel} 解鎖，在農土種植並收成`;
    }
    if (PRODUCTS[itemId]) {
      const p = PRODUCTS[itemId];
      const animal = Object.values(ANIMALS || {}).find((a) => a.product === p.baseProduct || a.product === itemId);
      return animal ? `${animal.name} 產出` : "動物照護產出";
    }
    if ((C.FORAGE_ITEMS || {})[itemId]) {
      const nodes = (C.FORAGE_NODES || []).filter((n) => n.itemId === itemId);
      const deep = nodes.some((n) => n.requiresFlag === "eastDeepUnlocked");
      return `${deep ? "解鎖東林深處後" : "修橋探索東林後"}採集${nodes.length ? "：" + nodes.map((n) => n.name).join("、") : ""}`;
    }
    return "尚未發現來源";
  }
  function itemUsageSummary(itemId) {
    const def = getItemDef(itemId);
    const usage = [];
    if (def && def.sellValue != null) usage.push(`直售 ${def.sellValue} 金`);
    if (CROPS[itemId] || (C.FORAGE_ITEMS || {})[itemId] || PRODUCTS[itemId]) usage.push("市集訂單");
    const npcUsers = Object.entries(C.NPC_REQUESTS || {})
      .filter(([, cfg]) => (cfg.pool || []).indexOf(itemId) !== -1)
      .map(([npcId]) => ((C.NPCS || {})[npcId] || {}).name || npcId);
    if (npcUsers.length) usage.push("鎮民委託：" + npcUsers.join("、"));
    const sideUsers = Object.entries(C.NPC_SIDE_QUESTS || {}).filter(([, defn]) =>
      sideQuestSteps(defn).some((step) => Object.prototype.hasOwnProperty.call(step.wants || {}, itemId)))
      .map(([npcId]) => ((C.NPCS || {})[npcId] || {}).name || npcId);
    if (sideUsers.length) usage.push("支線：" + sideUsers.join("、"));
    return usage;
  }
  function journalCrops(state) {
    const unlocked = unlockedCrops(state);
    const harvested = (state.stats && state.stats.harvested) || {};
    return Object.values(CROPS).map((c) => ({
      id: c.id, name: c.name, emoji: c.emoji,
      unlocked: unlocked.indexOf(c.id) !== -1,
      discovered: (harvested[c.id] || 0) > 0,
      sourceHint: itemSourceHint(c.id),
      season: c.season || "全年",
      sellValue: c.sellValue,
      usage: itemUsageSummary(c.id),
      firstDiscoveredAt: firstDiscoveredAt(state, c.id),
    }));
  }
  function journalProducts(state) {
    const collected = (state.stats && state.stats.collected) || {};
    return Object.keys(PRODUCTS).map((id) => {
      const p = PRODUCTS[id];
      return { id, name: p.name, emoji: p.emoji, quality: p.quality, baseProduct: p.baseProduct,
        discovered: (collected[id] || 0) > 0,
        sourceHint: itemSourceHint(id), season: "全年", sellValue: p.sellValue,
        usage: itemUsageSummary(id), firstDiscoveredAt: firstDiscoveredAt(state, id) };
    });
  }
  function journalForage(state) {
    const collected = (state.stats && state.stats.collected) || {};
    return Object.keys(C.FORAGE_ITEMS || {}).map((id) => {
      const f = C.FORAGE_ITEMS[id];
      const nodes = (C.FORAGE_NODES || []).filter((n) => n.itemId === id);
      return { id, name: f.name, emoji: f.emoji, region: f.region, season: f.season || "",
        discovered: (collected[id] || 0) > 0,
        sourceHint: itemSourceHint(id),
        source: nodes.map((n) => n.name).join("、") || (f.region === "east_deep" ? "東林深處" : "東林"),
        sellValue: f.sellValue,
        usage: itemUsageSummary(id),
        firstDiscoveredAt: firstDiscoveredAt(state, id) };
    });
  }
  function journalNpcs(state) {
    const seen = (state.story && state.story.dialogueSeen) || {};
    const log = state.npcRequestLog || {};
    return Object.values(C.NPCS || {}).map((n) => ({
      id: n.id, name: n.name, title: n.title, met: !!seen[n.id],
      requestsCompleted: (log[n.id] && log[n.id].fulfilledCount) || 0,
      sideQuest: npcSideQuestStatus(state, n.id),
    }));
  }
  // 動物親密度里程碑：affinity 現值會隨時間衰減，「曾經養到開心」要靠 bestAffinity 高水位判斷，
  // 讀現值會讓玩家出門一趟回來發現自己養的動物「從沒開心過」——這不是玩家想看到的東西。
  function journalAnimals(state, now) {
    return (state.animals || []).map((a) => {
      const def = ANIMALS[a.type];
      return { id: a.id, type: a.type, name: def ? def.name : a.type,
        currentTier: qualityTierFor(animalAffinity(state, a, now)),
        bestAffinity: a.bestAffinity || 0,
        everGood: (a.bestAffinity || 0) >= AFFINITY_GOOD_THRESHOLD,
        everHappy: (a.bestAffinity || 0) >= AFFINITY_HAPPY_THRESHOLD };
    });
  }
  function journalWorldFlags(state) {
    const f = state.flags || {};
    // 明確回傳具名旗標而非整個 eventsClaimed 清單——未來新增其他事件點時，這裡不會
    // 因為「任一事件已領取」就誤判成「東林已探索」（Codex 審核 Stage 11 時抓到的坑）
    return { bridgeRepaired: !!f.bridgeRepaired,
      eastClearingClaimed: !!(f.eventsClaimed && f.eventsClaimed.east_clearing),
      eastDeepUnlocked: !!f.eastDeepUnlocked };
  }
  // 章節完成度要跟 renderStory() 用同一套「解鎖」閥門：第二章要序章全完成才顯示，
  // 第三章要第二章全完成才顯示，不能提前曝光「還沒解鎖的章節有幾個任務」
  // （Codex 審核 Stage 11 時抓到的坑：Journal 原本不管解鎖狀態就把三章進度都顯示出來）。
  function journalChapters(state) {
    const completed = (state.story && state.story.completed) || {};
    const pct = (ids) => ({ done: ids.filter((id) => completed[id]).length, total: ids.length });
    const chapter1 = pct(C.PROLOGUE_QUESTS || []);
    const chapter2 = pct(C.CHAPTER2_QUESTS || []);
    const chapter3 = pct(C.CHAPTER3_QUESTS || []);
    const chapter4 = pct(C.CHAPTER4_QUESTS || []);
    const mail = state.mail || {};
    const read = mail.read || {};
    const chapter4Complete = chapter4.total > 0 && chapter4.done >= chapter4.total;
    const chapter5 = {
      done: (CHAPTER5_LETTERS || []).filter((id) => !!read[id]).length,
      total: (CHAPTER5_LETTERS || []).length,
      replied: !!mail.replied,
    };
    return {
      chapter1: Object.assign({ unlocked: true }, chapter1),
      chapter2: Object.assign({ unlocked: chapter1.total > 0 && chapter1.done >= chapter1.total }, chapter2),
      chapter3: Object.assign({ unlocked: chapter2.total > 0 && chapter2.done >= chapter2.total }, chapter3),
      chapter4: Object.assign({ unlocked: chapter3.total > 0 && chapter3.done >= chapter3.total }, chapter4),
      chapter5: Object.assign({ unlocked: chapter4Complete, complete: chapter5.total > 0 && chapter5.done >= chapter5.total && chapter5.replied }, chapter5),
    };
  }
  function journalAchievements(state) {
    const a = state.achievements || {};
    return Object.keys(ACHIEVEMENTS).map((id) => ({
      id, name: ACHIEVEMENTS[id].name, desc: ACHIEVEMENTS[id].desc, icon: ACHIEVEMENTS[id].icon, unlocked: !!a[id] }));
  }
  function journalCollectibles(state) {
    const owned = state.collections || {};
    return Object.keys(C.COLLECTIBLES || {}).map((id) => {
      const c = C.COLLECTIBLES[id];
      return { id, name: c.name, emoji: c.emoji, desc: c.desc, source: c.source, unlocked: !!owned[id] };
    });
  }
  function completionOf(items, pred) {
    const total = items.length;
    const done = items.filter(pred).length;
    return { done, total, pct: total ? Math.round(done / total * 100) : 0 };
  }
  // 彙總入口：一次回傳 Journal 面板要的全部資料，UI 只呼叫這一個函式，不要各自重算發現閥門
  function journalSummary(state, now) {
    const crops = journalCrops(state);
    const products = journalProducts(state);
    const forage = journalForage(state);
    const npcs = journalNpcs(state);
    const animals = journalAnimals(state, now);
    const world = journalWorldFlags(state);
    const achievements = journalAchievements(state);
    const collectibles = journalCollectibles(state);
    const worldItems = [world.bridgeRepaired, world.eastClearingClaimed, world.eastDeepUnlocked];
    return {
      crops,
      products,
      forage,
      npcs,
      animals,
      world,
      chapters: journalChapters(state),
      achievements,
      collectibles,
      completion: {
        crops: completionOf(crops, (c) => c.discovered),
        products: completionOf(products, (p) => p.discovered),
        forage: completionOf(forage, (f) => f.discovered),
        npcs: completionOf(npcs, (n) => n.met),
        npcSideQuests: completionOf(npcs.filter((n) => n.sideQuest), (n) => n.sideQuest.completed),
        animals: completionOf(animals, (a) => a.everGood || a.everHappy),
        world: completionOf(worldItems, Boolean),
        achievements: completionOf(achievements, (a) => a.unlocked),
        collectibles: completionOf(collectibles, (c) => c.unlocked),
      },
      npcRequestsCompleted: (state.stats && state.stats.npcRequestsCompleted) || 0,
    };
  }

  // ---------- R23：智慧農務助手（純讀取排序） ----------
  function plotTileId(state, plotIndex) {
    const tile = (state.map && state.map.tiles || []).find((t) => t.plotIndex === plotIndex);
    return tile ? tile.id : null;
  }
  function stationTileId(state, station) {
    const tile = (state.map && state.map.tiles || []).find((t) => t.station === station);
    return tile ? tile.id : null;
  }
  function npcTileId(state, npcId) {
    const tile = (state.map && state.map.tiles || []).find((t) => t.npc === npcId);
    return tile ? tile.id : null;
  }
  function requestCanDeliver(state, req) {
    if (!req || !req.wants) return false;
    const items = (state.storage && state.storage.items) || {};
    return Object.entries(req.wants).every(([id, qty]) => (items[id] || 0) >= qty);
  }
  function wantsText(wants) {
    return Object.entries(wants || {}).map(([id, qty]) => {
      const def = getItemDef(id) || { name: id };
      return `${def.name}×${qty}`;
    }).join("、");
  }
  function farmSeason(now) {
    const seasons = SEASONS || [{ id: "春" }];
    const span = SEASON_DURATION_MS || 1;
    const idx = Math.floor(Math.max(0, now || 0) / span) % seasons.length;
    return seasons[idx].id;
  }
  function affordableFeed(state, feedCost) {
    const items = (state.storage && state.storage.items) || {};
    return Object.entries(feedCost || {}).every(([id, qty]) => (items[id] || 0) >= qty);
  }
  function farmActionSuggestions(state, now, opts) {
    opts = opts || {};
    now = now || Date.now();
    const limit = opts.limit || 3;
    const season = opts.season || currentSeason(state, now);
    const suggestions = [];
    const active = activePlotCount(state);
    const readyByCrop = {};
    const readyTiles = {};
    const emptyPlots = [];
    for (let i = 0; i < Math.min((state.plots || []).length, active); i++) {
      const plot = state.plots[i];
      if (!plot || !plot.cropId) {
        emptyPlots.push(i);
        continue;
      }
      const progress = getCropProgress(state, plot, now);
      if (!progress.ready) continue;
      readyByCrop[plot.cropId] = (readyByCrop[plot.cropId] || 0) + 1;
      if (!readyTiles[plot.cropId]) readyTiles[plot.cropId] = plotTileId(state, i);
    }
    for (const [cropId, count] of Object.entries(readyByCrop)) {
      const crop = CROPS[cropId];
      const valueScore = count * (crop ? crop.yield * sellUnitValue(state, crop.id, now) : 1);
      suggestions.push({
        id: "harvest:" + cropId,
        type: "harvest",
        priority: 120,
        valueScore,
        title: `${crop ? crop.name : cropId}已成熟 ×${count}`,
        detail: "先收成可釋放田地並避免空等。",
        reason: `${crop ? crop.name : cropId}收成 +${Math.round(valueScore)} 金`,
        actionLabel: "前往",
        tileId: readyTiles[cropId],
      });
    }

    for (const order of (state.orders || [])) {
      if (!requestCanDeliver(state, order)) continue;
      const pay = orderPayout(state, order);
      suggestions.push({
        id: "order:" + order.id,
        type: "order",
        priority: 108,
        valueScore: pay.coins,
        title: `委託「${wantsText(order.wants)}」可交付`,
        detail: `交付可得 ${pay.coins} 金與 ${pay.xp} XP。`,
        reason: `委託交付 +${Math.round(pay.coins)} 金 / ${pay.xp} XP`,
        actionLabel: "前往",
        tileId: stationTileId(state, "order_board"),
      });
    }

    for (const [npcId, req] of Object.entries((state && state.npcRequests) || {})) {
      if (!requestCanDeliver(state, req)) continue;
      const npc = (C.NPCS || {})[npcId] || { name: npcId };
      const valueScore = (req.rewardCoins || 0) + (req.rewardXp || 0);
      suggestions.push({
        id: "npc:" + npcId,
        type: "npc-request",
        priority: 112,
        valueScore,
        title: `${npc.name}的委託可交付`,
        detail: `${wantsText(req.wants)} → ${req.rewardCoins || 0} 金。`,
        reason: `鎮民委託 +${Math.round(req.rewardCoins || 0)} 金 / ${req.rewardXp || 0} XP`,
        actionLabel: "前往",
        tileId: npcTileId(state, npcId),
      });
    }

    for (const a of (state.animals || [])) {
      const def = ANIMALS[a.type]; if (!def) continue;
      const home = (state.buildings || []).find((b) => b.id === a.homeId);
      const feedReady = now - (a.lastFedAt || 0) >= CARE_COOLDOWN_MS && affordableFeed(state, def.feedCost);
      const waterReady = now - (a.lastWateredAt || 0) >= CARE_COOLDOWN_MS;
      const groomReady = now - (a.lastGroomedAt || 0) >= CARE_COOLDOWN_MS;
      const actions = [];
      if (feedReady) actions.push("餵食");
      if (waterReady) actions.push("補水");
      if (groomReady) actions.push("梳理");
      if (!actions.length) continue;
      const careGain = (feedReady ? CARE_GAIN.feed : 0) + (waterReady ? CARE_GAIN.water : 0) + (groomReady ? CARE_GAIN.groom : 0);
      suggestions.push({
        id: "animal:" + a.id,
        type: "animal-care",
        priority: 86,
        valueScore: careGain,
        title: `${def.name}照護冷卻已好`,
        detail: actions.join("、") + "可提升親密度。",
        reason: `照護 +${careGain} 親密度，品質提升`,
        actionLabel: "前往",
        tileId: home ? home.tileId : null,
      });
    }

    if (state.flags && state.flags.bridgeRepaired && state.flags.eastForageDiscovered) {
      for (const node of (C.FORAGE_NODES || [])) {
        const st = forageNodeStatus(state, node.id, now);
        if (!st || !st.ready || !st.unlocked) continue;
        const tile = forageTile(state, node.id);
        const item = st.item || {};
        const valueScore = item.sellValue || 0;
        suggestions.push({
          id: "forage:" + node.id,
          type: "forage",
          priority: node.requiresFlag ? 78 : 72,
          valueScore,
          title: `${node.name}已刷新`,
          detail: `可採集${item.name || node.itemId}${item.season ? "（" + item.season + "）" : ""}。`,
          reason: `${item.name || node.itemId}採集 +${Math.round(valueScore)} 金`,
          actionLabel: "前往",
          tileId: tile ? tile.id : null,
        });
      }
    }

    if (emptyPlots.length) {
      let best = null;
      for (const cropId of unlockedCrops(state)) {
        const crop = CROPS[cropId]; if (!crop || state.coins < crop.seedCost) continue;
        const net = sellUnitValue(state, crop.id, now) * crop.yield - crop.seedCost;
        const minutes = Math.max(1, effectiveGrowMs(state, crop.id, now) / 60000);
        const seasonBonus = crop.season && crop.season === season ? 1.08 : 1;
        const score = (net / minutes) * seasonBonus;
        if (!best || score > best.score) best = { crop, score, net, minutes };
      }
      if (best) {
        suggestions.push({
          id: "plant:" + best.crop.id,
          type: "plant",
          priority: 55,
          valueScore: best.score,
          title: `空田 ×${emptyPlots.length} → 種 ${best.crop.name}`,
          detail: `本季${season}，預估淨值 ${best.net} 金。`,
          reason: `預估 ${best.score.toFixed(1)} 金/分鐘，淨值 +${Math.round(best.net)} 金`,
          actionLabel: "前往",
          tileId: plotTileId(state, emptyPlots[0]),
        });
      }
    }

    return suggestions
      .filter((s) => !!s.tileId)
      .sort((a, b) => (b.priority - a.priority) || (b.valueScore - a.valueScore) || a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  function offlineForageRefreshes(state, last, offlineNow) {
    const out = [];
    if (!(state.flags && state.flags.bridgeRepaired && state.flags.eastForageDiscovered)) return out;
    for (const node of (C.FORAGE_NODES || [])) {
      if (node.requiresFlag && !state.flags[node.requiresFlag]) continue;
      const collectedAt = (state.flags.forageNodes || {})[node.id] || 0;
      if (!collectedAt) continue;
      const readyAt = collectedAt + (node.cooldownMs || C.FORAGE_NODE_COOLDOWN_MS || 0);
      if (readyAt > last && readyAt <= offlineNow) {
        out.push({ nodeId: node.id, itemId: node.itemId, name: node.name, readyAt });
      }
    }
    return out;
  }

  // ---------- 離線進度 ----------
  // 回傳摘要：每作物收成、溢出損失、成熟未收的格數、補種次數、動物產品
  function applyOffline(state, now) {
    const last = state.lastSeenAt || now;
    const rawMs = Math.max(0, now - last);
    const offlineMs = Math.min(rawMs, GAME.offlineCapMs);
    const cappedFrom = rawMs > GAME.offlineCapMs ? rawMs : 0;
    const summary = { offlineMs, cappedFromMs: cappedFrom, perCrop: {}, lost: 0, readyPlots: 0, replanted: 0, coins: 0, xp: 0, forageReady: [] };
    if (offlineMs <= 0) { state.lastSeenAt = now; return summary; }

    const flags = helperFlags(state);
    const offlineNow = last + offlineMs; // 以離線結束點倍率計算；未分段積分整段離線天氣。
    const active = activePlotCount(state);
    const seasonCatchup = advanceSeasonState(state, offlineNow);
    summary.seasonsAdvanced = seasonCatchup.advanced || 0;
    summary.seasonsReached = seasonCatchup.reached || [];

    for (let i = 0; i < Math.min(state.plots.length, active); i++) {
      const plot = state.plots[i];
      if (!plot.cropId) continue;
      const crop = CROPS[plot.cropId];
      let growMs = effectiveGrowMs(state, plot.cropId, offlineNow);
      if (isWet(plot)) growMs = Math.max(1000, Math.floor(growMs * MOISTURE_MUL)); // 濕土加速：離線也要吃到，與 getCropProgress 一致
      const elapsed = Math.max(0, offlineNow - plot.plantedAt);
      if (elapsed < growMs) continue; // 還沒熟

      if (!flags.autoHarvest) { summary.readyPlots++; continue; } // 無幫手：標記成熟待收

      // 有幫手：自動收成
      let cycles = 1;
      if (flags.autoPlant) cycles = Math.min(500, Math.floor(elapsed / growMs)); // 自動補種多輪
      let actualCycles = 0;
      for (let c = 0; c < cycles; c++) {
        const { added, lost } = addToStorage(state, crop.id, crop.yield);
        summary.perCrop[crop.id] = (summary.perCrop[crop.id] || 0) + added;
        summary.lost += lost;
        state.stats.harvested[crop.id] = (state.stats.harvested[crop.id] || 0) + added;
        if (added > 0) recordDiscovery(state, crop.id, offlineNow);
        summary.xp += crop.xp; addXp(state, crop.xp);
        actualCycles++;
        if (flags.autoPlant && c < cycles - 1) {
          if (state.coins < crop.seedCost) {
            plot.cropId = null; plot.plantedAt = 0; delete plot.wateredAt;
            break;
          }
          state.coins -= crop.seedCost; summary.replanted++;
        }
      }
      if (flags.autoPlant && actualCycles > 0) {
        // 重設種植時間為最後一輪起點，保留殘餘進度
        if (plot.cropId) {
          plot.plantedAt = plot.plantedAt + actualCycles * growMs;
          if (plot.plantedAt > offlineNow) plot.plantedAt = offlineNow;
        }
      } else {
        plot.cropId = null; plot.plantedAt = 0; delete plot.wateredAt; // 只收一輪，格子清空
      }
    }

    // MVP2：動物離線自動產出（時間戳計算，與作物同上限規則）。
    // Stage 7.1 修正：離線收成品質改依「回來當下」的親密度結算（跟上線收集同規則），
    // 原本固定用 def.product（normal），跟「當下親密度決定品質」的設計語義不一致。
    summary.products = {};
    for (const a of (state.animals || [])) {
      const def = ANIMALS[a.type];
      const cycles = Math.min(500, Math.floor((offlineNow - a.lastProducedAt) / def.produceMs));
      if (cycles <= 0) continue;
      const tier = qualityTierFor(animalAffinity(state, a, offlineNow));
      const productId = qualityProductId(def.product, tier);
      const { added, lost } = addToStorage(state, productId, cycles);
      summary.products[productId] = (summary.products[productId] || 0) + added;
      summary.lost += lost;
      state.stats.collected[productId] = (state.stats.collected[productId] || 0) + added;
      if (added > 0) recordDiscovery(state, productId, offlineNow);
      a.lastProducedAt += cycles * def.produceMs;
    }

    summary.forageReady = offlineForageRefreshes(state, last, offlineNow);
    summary.forageReadyCount = summary.forageReady.length;
    checkAchievements(state);
    state.lastSeenAt = now;
    return summary;
  }

  const GameAPI = {
    rngInt, rngPick, unlockedCrops, isCropUnlocked, unlockedProducts, unlockedForageItems, availableOrderItems,
    growthMultiplier, buildingGrowthAura, effectiveGrowMs, isWet, waterPlot,
    getCropProgress, storageCapacity, storageUsed, addToStorage, ensureDiscoveryState, recordDiscovery, firstDiscoveredAt, addXp,
    achievementBonus, checkAchievements, sellMultiplier, sellUnitValue, buildingSeasonalBonus,
    activePlotCount, plant, harvest, harvestAll, sellItem, sellAll,
    tutorialDeliveryOrderNeeded, makeTutorialDeliveryOrder, orderNarrative,
    makeOrder, refreshOrders, canFulfill, orderPayout, fulfillOrder, trashOrder,
    upgradeMaxLevel, nextUpgrade, buyUpgrade, helperFlags,
    currentWeather, updateWeather, runHelperOnline, applyOffline,
    farmSeason, farmActionSuggestions, offlineForageRefreshes,
    // MVP2：建材 / 地圖 / 建築 / 動物
    canAffordCost, spendCost, grantMaterials, getTile, clearObstacle,
    buildingUnlocked, buildingCount, buildingAtMaxCount, canBuildOn, buildBuilding,
    homeBuildingFor, animalCapacity, animalsInHome, isAnimalUnlocked,
    addAnimal, buyAnimal, animalProgress, collectAnimal, collectAllAnimals, collectHome, feedAnimal,
    // 可走動地圖：尋路 / 目標解析
    getTileById, getTileXY, isWalkable, bfsPath, pathToAdjacent, planMoveTo, facingTo, plotOfTile,
    // Stage 4：多格結構 / 故事任務
    structureAt, planMoveToStructure, currentQuest, syncStoryProgress, advanceStory, questMarkerTile,
    // Stage 5：世界探索（橋 / 封鎖區 / 事件點）
    bridgeTile, eventTile, chapter1Done, chapter2Done, chapter3Done, chapter4Done, chapter5Done,
    canRepairBridge, bridgeMaterialStatus, bridgeMaterialTargetTile, repairBridge, triggerEvent,
    forageNodeDef, forageTile, forageNodeStatus, eastForageStatus, eastForageTargetTile,
    eastDeepStatus, canUnlockEastDeep, unlockEastDeep,
    discoverForage, gatherForage, ensureEastForageReportRequest,
    // Stage 6：NPC 對話
    npcAt, npcPhase, npcDialogue,
    // Stage 10：NPC 重複委託
    ensureNpcRequestState, ensureNpcSideQuestState, npcSideQuestStatus, ensureNpcSideQuestRequest,
    npcRequestPool, canRequestFrom, generateNpcRequest, canFulfillNpcRequest, fulfillNpcRequest, declineNpcRequest,
    // Stage 11：Farm Journal
    itemSourceHint, itemUsageSummary,
    journalCrops, journalProducts, journalForage, journalNpcs, journalAnimals, journalWorldFlags, journalChapters, journalAchievements, journalCollectibles, journalSummary,
    currentSeason, updateSeason, recordSeasonReached, evaluateLetters, readLetter, replyLetter,
    allChapter5LettersRead, chapter5ReadCount, harvestedSeasonCount, hasCollectedDuckEgg,
    // Stage 7：動物照護（親密度 / 品質分級）
    animalAffinity, qualityTierFor, qualityProductId, animalStatus, waterAnimal, groomAnimal,
    isQualityItem, hasCollectedQuality,
  };
  if (typeof window !== "undefined") Object.assign(window, GameAPI, { Game: GameAPI });
  if (typeof module !== "undefined" && module.exports) module.exports = GameAPI;
})(typeof window !== "undefined" ? window : globalThis);
