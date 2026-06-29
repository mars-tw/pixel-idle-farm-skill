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

  // 由 MAP_LAYOUT 產生統一地圖（soil 對應作物 plot、grass/path/water、障礙）
  function makeMap() {
    const layout = C.MAP_LAYOUT;
    const tiles = [];
    let plotIndex = 0;
    for (let y = 0; y < layout.length; y++) {
      for (let x = 0; x < layout[y].length; x++) {
        const ch = layout[y][x];
        const obstacle = C.OBSTACLE_CODE[ch] || null;
        const terrain = obstacle ? "grass" : (C.TERRAIN_CODE[ch] || "grass");
        const tile = {
          id: "t" + x + "_" + y, x, y, terrain,
          object: obstacle,       // rock/stump/bush（障礙，蓋在草地上）
          buildingId: null,       // 蓋了建築就指向 state.buildings 的 id
          plotIndex: terrain === "soil" ? plotIndex++ : null, // 農土對應 state.plots
        };
        tiles.push(tile);
      }
    }
    return { width: layout[0].length, height: layout.length, tiles, soilCount: plotIndex };
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
      plots: makePlots(C.GAME.maxPlots),      // 預建 maxPlots，soil 磚 1:1 對應；activePlotCount 控可用數
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
      // ===== 可走動地圖 =====
      player: { tileId: "t" + C.PLAYER_START.x + "_" + C.PLAYER_START.y, x: C.PLAYER_START.x, y: C.PLAYER_START.y,
                facing: "down", action: "idle", actionTargetTileId: null, actionEndsAt: 0 },
      interaction: { tool: "hand", buildType: null, selectedTileId: null, pendingPath: [], lastInvalidReason: null },
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
    // 地圖：舊存檔（無 plotIndex 的 6×4 擴張圖）一律以新統一地圖重建（保留建築需重置，屬大改版）
    const hasUnifiedMap = state.map && Array.isArray(state.map.tiles) && state.map.tiles.some((t) => t.plotIndex != null);
    merged.map = hasUnifiedMap ? state.map : def.map;
    merged.buildings = (hasUnifiedMap && Array.isArray(state.buildings)) ? state.buildings : [];
    merged.animals = (hasUnifiedMap && Array.isArray(state.animals)) ? state.animals : [];
    // 確保 plots 數量足夠對應所有 soil 磚
    if (merged.plots.length < C.GAME.maxPlots) {
      while (merged.plots.length < C.GAME.maxPlots) merged.plots.push({ id: "p" + String(merged.plots.length + 1).padStart(2, "0"), cropId: null, plantedAt: 0 });
    }
    // 可走動地圖欄位
    merged.player = Object.assign({}, def.player, state.player);
    merged.interaction = Object.assign({ tool: "hand", buildType: null, selectedTileId: null, pendingPath: [], lastInvalidReason: null }, state.interaction);
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
