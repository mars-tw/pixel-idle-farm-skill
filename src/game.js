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
    WEATHER, WEATHER_UNLOCK_LEVEL, WEATHER_DURATION_MS, ACHIEVEMENTS,
    levelFromXp,
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
  // 成長時間倍率：肥沃土壤升級 × 天氣（rain 加速）
  function growthMultiplier(state, now) {
    let m = 1;
    const lv = state.upgrades.growthSpeed;
    if (lv > 0) m *= UPGRADES.growthSpeed.levels[lv - 1].value;
    const w = currentWeather(state, now);
    m *= WEATHER[w].growthMul;
    return m;
  }
  function effectiveGrowMs(state, cropId, now) {
    const c = CROPS[cropId];
    return Math.max(1000, Math.floor(c.growMs * growthMultiplier(state, now)));
  }
  function getCropProgress(state, plot, now) {
    if (!plot.cropId) return { ready: false, ratio: 0, remainingMs: 0, stage: 0 };
    const growMs = effectiveGrowMs(state, plot.cropId, now);
    const elapsed = Math.max(0, now - plot.plantedAt);
    const ratio = Math.min(1, elapsed / growMs);
    const ready = elapsed >= growMs;
    // 5 階段：seed0 sprout1 small2 mature3 ready4
    const stage = ready ? 4 : Math.min(3, Math.floor(ratio * 4));
    return { ready, ratio, remainingMs: Math.max(0, growMs - elapsed), stage };
  }

  // ---------- 倉庫 ----------
  function storageCapacity(state) {
    const lv = state.upgrades.storageLevel;
    return GAME.baseStorage + (lv > 0 ? UPGRADES.storageLevel.levels[lv - 1].value : 0);
  }
  function storageUsed(state) {
    return Object.values(state.storage.items).reduce((s, n) => s + (n || 0), 0);
  }
  function addToStorage(state, cropId, qty) {
    const cap = storageCapacity(state);
    const free = Math.max(0, cap - storageUsed(state));
    const added = Math.min(qty, free);
    state.storage.items[cropId] = (state.storage.items[cropId] || 0) + added;
    return { added, lost: qty - added };
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
    return got;
  }

  // ---------- 售價 ----------
  function sellMultiplier(state, now) {
    const lv = state.upgrades.sellBonus;
    const bonus = lv > 0 ? UPGRADES.sellBonus.levels[lv - 1].value : 0;
    const w = currentWeather(state, now);
    return (1 + bonus + achievementBonus(state)) * WEATHER[w].sellMul;
  }
  function sellUnitValue(state, cropId, now) {
    return Math.max(1, Math.round(CROPS[cropId].sellValue * sellMultiplier(state, now)));
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
    const leveled = addXp(state, crop.xp);
    plot.cropId = null; plot.plantedAt = 0;
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
  function sellItem(state, cropId, qty, now) {
    const have = state.storage.items[cropId] || 0;
    const n = Math.min(qty, have);
    if (n <= 0) return { ok: false, coins: 0 };
    const coins = n * sellUnitValue(state, cropId, now);
    state.storage.items[cropId] = have - n;
    if (state.storage.items[cropId] === 0) delete state.storage.items[cropId];
    state.coins += coins;
    state.stats.totalCoinsEarned += coins;
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
  const ORDER_QTY = { wheat: [6, 14], carrot: [4, 9], tomato: [3, 6], strawberry: [2, 4], pumpkin: [1, 3] };
  function makeOrder(state, now, rng, idSeed) {
    const pool = unlockedCrops(state);
    const rarities = Object.values(ORDER_RARITY);
    const totalW = rarities.reduce((s, r) => s + r.weight, 0);
    let roll = (rng || Math.random)() * totalW, rarity = rarities[0];
    for (const r of rarities) { if (roll < r.weight) { rarity = r; break; } roll -= r.weight; }
    const rarityId = Object.keys(ORDER_RARITY).find((k) => ORDER_RARITY[k] === rarity);

    const nKinds = pool.length >= 2 && (rng || Math.random)() < 0.45 ? 2 : 1;
    const wants = {}; let baseValue = 0, baseXp = 0;
    const chosen = [];
    for (let k = 0; k < nKinds; k++) {
      let cropId; let guard = 0;
      do { cropId = rngPick(rng, pool); guard++; } while (chosen.includes(cropId) && guard < 10);
      chosen.push(cropId);
      const [mn, mx] = ORDER_QTY[cropId] || [2, 5];
      const qty = rngInt(rng, mn, mx);
      wants[cropId] = (wants[cropId] || 0) + qty;
      baseValue += CROPS[cropId].sellValue * qty;
      baseXp += CROPS[cropId].xp * qty;
    }
    return {
      id: "order_" + idSeed,
      wants,
      rarity: rarityId,
      rewardCoins: Math.round(baseValue * rarity.payMult),
      rewardXp: Math.max(1, Math.round(baseXp * 0.5 * rarity.xpMult)),
      expiresAt: now + GAME.orderTtlMs,
    };
  }
  function refreshOrders(state, now, rng) {
    // 移除過期訂單，補滿到 orderSlots
    state.orders = state.orders.filter((o) => o.expiresAt > now);
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
    }
    state.orderStreak++;
    const pay = orderPayout(state, order);
    state.coins += pay.coins;
    state.stats.totalCoinsEarned += pay.coins;
    addXp(state, pay.xp);
    state.stats.fulfilledOrders++;
    // 移除並補新單
    state.orders.splice(idx, 1);
    refreshOrders(state, now, rng);
    checkAchievements(state);
    return { ok: true, coins: pay.coins, xp: pay.xp, streakMul: pay.streakMul };
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
    const id = roll < 0.5 ? "clear" : roll < 0.75 ? "rain" : "sunny";
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

  // ---------- 離線進度 ----------
  // 回傳摘要：每作物收成、溢出損失、成熟未收的格數、補種次數
  function applyOffline(state, now) {
    const last = state.lastSeenAt || now;
    const rawMs = Math.max(0, now - last);
    const offlineMs = Math.min(rawMs, GAME.offlineCapMs);
    const cappedFrom = rawMs > GAME.offlineCapMs ? rawMs : 0;
    const summary = { offlineMs, cappedFromMs: cappedFrom, perCrop: {}, lost: 0, readyPlots: 0, replanted: 0, coins: 0, xp: 0 };
    if (offlineMs <= 0) { state.lastSeenAt = now; return summary; }

    const flags = helperFlags(state);
    const offlineNow = last + offlineMs; // 以離線結束點計算（天氣視為 clear）
    const active = activePlotCount(state);

    for (let i = 0; i < Math.min(state.plots.length, active); i++) {
      const plot = state.plots[i];
      if (!plot.cropId) continue;
      const crop = CROPS[plot.cropId];
      const growMs = effectiveGrowMs(state, plot.cropId, offlineNow);
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
        summary.xp += crop.xp; addXp(state, crop.xp);
        actualCycles++;
        if (flags.autoPlant && c < cycles - 1) {
          if (state.coins < crop.seedCost) {
            plot.cropId = null; plot.plantedAt = 0;
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
        plot.cropId = null; plot.plantedAt = 0; // 只收一輪，格子清空
      }
    }
    checkAchievements(state);
    state.lastSeenAt = now;
    return summary;
  }

  const GameAPI = {
    rngInt, rngPick, unlockedCrops, isCropUnlocked, growthMultiplier, effectiveGrowMs,
    getCropProgress, storageCapacity, storageUsed, addToStorage, addXp,
    achievementBonus, checkAchievements, sellMultiplier, sellUnitValue,
    activePlotCount, plant, harvest, harvestAll, sellItem, sellAll,
    makeOrder, refreshOrders, canFulfill, orderPayout, fulfillOrder, trashOrder,
    upgradeMaxLevel, nextUpgrade, buyUpgrade, helperFlags,
    currentWeather, updateWeather, runHelperOnline, applyOffline,
  };
  if (typeof window !== "undefined") Object.assign(window, GameAPI, { Game: GameAPI });
  if (typeof module !== "undefined" && module.exports) module.exports = GameAPI;
})(typeof window !== "undefined" ? window : globalThis);
