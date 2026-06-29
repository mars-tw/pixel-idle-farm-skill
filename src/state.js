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
      storage: { items: {} },                 // { cropId: qty }
      plots: makePlots(C.GAME.startPlots),
      upgrades: { plotCount: 0, growthSpeed: 0, sellBonus: 0, storageLevel: 0, helperLevel: 0 },
      orders: [],
      ordersSeededAt: 0,
      orderStreak: 0,
      weather: { id: "clear", untilMs: 0 },
      achievements: {},                        // { id: true }
      stats: { harvested: {}, fulfilledOrders: 0, totalCoinsEarned: 0, plantCount: 0 },
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
    if (!Array.isArray(merged.plots) || merged.plots.length === 0) merged.plots = def.plots;
    if (!Array.isArray(merged.orders)) merged.orders = [];
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
