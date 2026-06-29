/* =========================================================================
 * state.js — 存檔結構、預設狀態、localStorage 讀寫、版本遷移
 * 純資料 + I/O，遊戲規則在 game.js。Node 可載入（存檔降級為記憶體）。
 * ========================================================================= */

(function (root) {
  const C = (typeof module !== "undefined" && module.exports)
    ? require("./config.js")
    : root;

  // 建立空農地陣列
  function makePlots(n) {
    const plots = [];
    for (let i = 0; i < n; i++) {
      plots.push({ id: "p" + String(i + 1).padStart(2, "0"), cropId: null, plantedAt: 0 });
    }
    return plots;
  }

  // 由 MAP_DEFAULT 產生地圖磚陣列（grass / 障礙 / 水域）
  function makeMap() {
    const m = C.MAP_DEFAULT;
    const tiles = [];
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        const key = x + "," + y;
        const isWater = m.water && m.water.indexOf(key) !== -1;
        tiles.push({
          id: "t" + x + "_" + y, x, y,
          terrain: isWater ? "water" : "grass",
          object: m.objects && m.objects[key] ? m.objects[key] : null, // rock/stump/bush
          buildingId: null, // 蓋了建築就指向 state.buildings 的 id
        });
      }
    }
    return { width: m.width, height: m.height, tiles };
  }

  // 預設新存檔
  function defaultState(now) {
    now = now || Date.now();
    return {
      version: C.GAME.version,
      createdAt: now,
      lastSeenAt: now,
      coins: C.GAME.startCoins,
      xp: 0,
      level: 1,
      selectedSeed: "wheat",
      useSprites: true,
      storage: { items: {} },                 // { cropId/productId: qty }
      plots: makePlots(C.GAME.startPlots),
      upgrades: { plotCount: 0, growthSpeed: 0, sellBonus: 0, storageLevel: 0, helperLevel: 0 },
      orders: [],
      ordersSeededAt: 0,
      orderStreak: 0,
      weather: { id: "clear", untilMs: 0 },
      achievements: {},                        // { id: true }
      // ===== MVP2 =====
      materials: { wood: 0, stone: 0, compost: 0 },
      map: makeMap(),
      buildings: [],                           // { id, type, tileId, builtAt, level }
      animals: [],                             // { id, type, homeId, lastProducedAt }
      stats: { harvested: {}, fulfilledOrders: 0, totalCoinsEarned: 0, plantCount: 0, cleared: 0, collected: {} },
    };
  }

  // 版本遷移：保證舊存檔欄位補齊（向後相容）
  function migrate(state) {
    const def = defaultState(state.lastSeenAt || Date.now());
    const merged = Object.assign({}, def, state);
    // 深層補齊巢狀物件
    merged.storage = Object.assign({ items: {} }, state.storage);
    merged.storage.items = Object.assign({}, state.storage && state.storage.items);
    merged.upgrades = Object.assign({}, def.upgrades, state.upgrades);
    merged.weather = Object.assign({ id: "clear", untilMs: 0 }, state.weather);
    merged.achievements = Object.assign({}, state.achievements);
    merged.stats = Object.assign({}, def.stats, state.stats);
    merged.stats.harvested = Object.assign({}, state.stats && state.stats.harvested);
    merged.stats.collected = Object.assign({}, state.stats && state.stats.collected);
    if (!Array.isArray(merged.plots) || merged.plots.length === 0) merged.plots = def.plots;
    if (!Array.isArray(merged.orders)) merged.orders = [];
    // ===== MVP2 欄位補齊 =====
    merged.materials = Object.assign({ wood: 0, stone: 0, compost: 0 }, state.materials);
    merged.map = (state.map && Array.isArray(state.map.tiles) && state.map.tiles.length) ? state.map : def.map;
    merged.buildings = Array.isArray(state.buildings) ? state.buildings : [];
    merged.animals = Array.isArray(state.animals) ? state.animals : [];
    merged.version = C.GAME.version;
    return merged;
  }

  // 讀檔（無存檔回 null）
  function load() {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(C.GAME.saveKey);
      if (!raw) return null;
      return migrate(JSON.parse(raw));
    } catch (e) {
      console.warn("讀檔失敗，將開新檔：", e);
      return null;
    }
  }

  // 存檔
  function save(state) {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(C.GAME.saveKey, JSON.stringify(state));
    } catch (e) {
      console.warn("存檔失敗：", e);
    }
  }

  // 清檔（測試用）
  function reset() {
    if (typeof localStorage === "undefined") return;
    try { localStorage.removeItem(C.GAME.saveKey); } catch (e) {}
  }

  const StateAPI = { defaultState, migrate, load, save, reset, makePlots };
  if (typeof window !== "undefined") Object.assign(window, StateAPI);
  if (typeof module !== "undefined" && module.exports) module.exports = StateAPI;
})(typeof window !== "undefined" ? window : globalThis);
