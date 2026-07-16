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

  // 多格建築/結構：footprint 磚標記 structureId + blocked（不可走、需走相鄰互動）
  function applyStructures(map) {
    for (const s of (C.STRUCTURES || [])) {
      for (let dy = 0; dy < s.h; dy++) for (let dx = 0; dx < s.w; dx++) {
        const tile = map.tiles.find((t) => t.x === s.x + dx && t.y === s.y + dy);
        if (tile) { tile.structureId = s.id; tile.blocked = true; tile.object = null; tile.station = null; }
      }
    }
    return map;
  }
  // 固定站點（grass 磚 + station 標記，阻擋移動需走相鄰格互動）
  function applyStations(map) {
    for (const s of (C.STATION_PLACEMENT || [])) {
      const tile = map.tiles.find((t) => t.x === s.x && t.y === s.y);
      if (tile && tile.terrain === "grass" && !tile.object && !tile.buildingId && !tile.structureId && !tile.blocked) tile.station = s.type;
    }
    return map;
  }
  // Stage 6：NPC 鎮民（grass 磚 + npc 標記；阻擋移動，需走相鄰格交談）
  function applyNpcs(map) {
    for (const n of (C.NPC_PLACEMENT || [])) {
      const tile = map.tiles.find((t) => t.x === n.x && t.y === n.y);
      if (tile && tile.terrain === "grass" && !tile.object && !tile.buildingId && !tile.structureId && !tile.blocked && !tile.station) {
        tile.npc = n.type; tile.npcFacing = n.facing || "down";
      }
    }
    return map;
  }
  function applyRegions(map) {
    for (const tile of (map.tiles || [])) {
      tile.region = (tile.x >= 19 && tile.y >= 8) ? "east_deep" : (tile.x >= C.EAST_REGION_MIN_X ? "east" : null);
    }
    return map;
  }
  function applyEvents(map) {
    for (const ev of Object.values(C.EVENTS || {})) {
      if (typeof ev.x !== "number" || typeof ev.y !== "number") continue;
      const tile = map.tiles.find((t) => t.x === ev.x && t.y === ev.y);
      if (tile) tile.event = ev.id;
    }
    return map;
  }
  function applyForage(map) {
    for (const n of (C.FORAGE_NODES || [])) {
      const tile = map.tiles.find((t) => t.x === n.x && t.y === n.y);
      if (tile && !tile.object && !tile.station && !tile.buildingId && !tile.structureId && !tile.npc) {
        tile.forage = n.id;
      }
    }
    return map;
  }
  function healthyMap(map) {
    if (!map || map.width !== C.MAP_W || map.height !== C.MAP_H || !Array.isArray(map.tiles)) return false;
    if (map.tiles.length !== C.MAP_W * C.MAP_H) return false;
    const coords = new Set(), ids = new Set(), plotIndexes = new Set();
    for (const tile of map.tiles) {
      if (!tile || typeof tile.x !== "number" || typeof tile.y !== "number") return false;
      if (tile.x < 0 || tile.x >= C.MAP_W || tile.y < 0 || tile.y >= C.MAP_H) return false;
      const coord = tile.x + "," + tile.y;
      if (coords.has(coord)) return false;
      coords.add(coord);
      const expectedId = "t" + tile.x + "_" + tile.y;
      if (tile.id !== expectedId || ids.has(tile.id)) return false;
      ids.add(tile.id);
      if (!C.TERRAIN[tile.terrain]) return false;
      if (tile.terrain === "soil") {
        if (!Number.isInteger(tile.plotIndex) || tile.plotIndex < 0 || tile.plotIndex >= C.GAME.maxPlots) return false;
        if (plotIndexes.has(tile.plotIndex)) return false;
        plotIndexes.add(tile.plotIndex);
      } else if (tile.plotIndex != null) return false;
    }
    return coords.size === C.MAP_W * C.MAP_H && plotIndexes.size === C.GAME.maxPlots;
  }
  function refreshDerivedMapFields(map) {
    const canonical = makeMap();
    const byId = {};
    for (const tile of (canonical.tiles || [])) byId[tile.id] = tile;
    for (const tile of (map.tiles || [])) {
      const ref = byId[tile.id];
      if (!ref) continue;
      tile.region = ref.region || null;
      tile.bridge = !!ref.bridge;
      tile.event = ref.event || null;
      tile.forage = ref.forage || null;
      if (ref.terrain === "soil") {
        tile.terrain = "soil";
        tile.plotIndex = ref.plotIndex;
      } else if (tile.terrain === "soil" || tile.plotIndex != null) {
        tile.terrain = ref.terrain;
        tile.plotIndex = null;
      } else {
        tile.terrain = ref.terrain;
      }
      if (ref.structureId) {
        tile.structureId = ref.structureId;
        tile.blocked = true;
        tile.station = null;
        tile.npc = null;
        tile.npcFacing = null;
        tile.object = null;
      } else {
        tile.structureId = null;
        tile.blocked = false;
        tile.station = ref.station || null;
        tile.npc = ref.npc || null;
        tile.npcFacing = ref.npc ? (ref.npcFacing || "down") : null;
        if (ref.station || ref.npc || ref.bridge || ref.event || ref.forage) {
          tile.object = null;
        }
      }
    }
    map.soilCount = (map.tiles || []).filter((t) => t.terrain === "soil").length;
    return map;
  }
  function nonNegativeNumber(value, fallback) {
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }
  function tileById(map, id) {
    return (map.tiles || []).find((t) => t.id === id) || null;
  }
  function structureForBuilding(b) {
    if (!b || !b.type) return null;
    const expectedById = b.id && b.id.slice(0, 2) === "b_" ? b.id.slice(2) : "";
    return (C.STRUCTURES || []).find((s) => s.building === b.type
      && (s.id === b.structureId || s.id === expectedById || b.tileId === "t" + s.x + "_" + s.y)) || null;
  }
  function clearBuildingIds(map) {
    for (const tile of (map.tiles || [])) tile.buildingId = null;
  }
  function canPlacePreservedBuilding(tile) {
    return !!(tile && tile.terrain === "grass" && !tile.object && !tile.station && !tile.structureId
      && !tile.blocked && !tile.buildingId && !tile.npc);
  }
  function placeBuildingOnMap(map, b) {
    const structure = structureForBuilding(b);
    if (structure) {
      const footprint = [];
      for (let dy = 0; dy < structure.h; dy++) for (let dx = 0; dx < structure.w; dx++) {
        const tile = (map.tiles || []).find((t) => t.x === structure.x + dx && t.y === structure.y + dy);
        if (!tile || (tile.buildingId && tile.buildingId !== b.id)) return false;
        footprint.push(tile);
      }
      footprint.forEach((tile) => { tile.buildingId = b.id; });
      return true;
    }
    const tile = tileById(map, b.tileId);
    if (!canPlacePreservedBuilding(tile)) return false;
    tile.buildingId = b.id;
    return true;
  }
  function sanitizeBuilding(raw, map, usedIds) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !raw.id || usedIds.has(raw.id)) return null;
    if (!C.BUILDINGS[raw.type]) return null;
    const b = Object.assign({}, raw);
    const structure = structureForBuilding(b);
    if (structure) {
      b.structureId = structure.id;
      b.tileId = "t" + structure.x + "_" + structure.y;
    } else if (typeof b.tileId !== "string" || !tileById(map, b.tileId)) {
      return null;
    }
    if (!placeBuildingOnMap(map, b)) return null;
    usedIds.add(b.id);
    return b;
  }
  function buildingCanHouseAnimal(building, animalType) {
    const def = building && C.BUILDINGS[building.type];
    const unlocks = def && def.effect && def.effect.unlockAnimal;
    return Array.isArray(unlocks) && unlocks.indexOf(animalType) !== -1;
  }
  function sanitizeAnimals(sourceAnimals, seededAnimals, buildings) {
    const animals = [];
    const usedIds = new Set();
    const byId = {};
    for (const b of buildings) byId[b.id] = b;
    const source = Array.isArray(sourceAnimals) ? sourceAnimals : seededAnimals;
    function add(raw) {
      if (!raw || typeof raw !== "object" || !C.ANIMALS[raw.type]) return;
      let home = byId[raw.homeId];
      if (!buildingCanHouseAnimal(home, raw.type)) home = buildings.find((b) => buildingCanHouseAnimal(b, raw.type));
      if (!home) return;
      let id = typeof raw.id === "string" && raw.id ? raw.id : "a_" + raw.type + "_" + (animals.length + 1);
      while (usedIds.has(id)) id = id + "_m";
      const a = Object.assign({}, raw, { id, homeId: home.id });
      usedIds.add(id);
      animals.push(a);
    }
    (source || []).forEach(add);
    return animals;
  }
  function canPlayerStandOn(map, tile, flags) {
    if (!tile) return false;
    if (tile.terrain === "water") return !!(tile.bridge && flags && flags.bridgeRepaired);
    if (tile.region === "east" && !(flags && flags.bridgeRepaired)) return false;
    if (tile.region === "east_deep" && !(flags && flags.eastDeepUnlocked)) return false;
    return !!(C.TERRAIN[tile.terrain] && !tile.object && !tile.station && !tile.npc
      && !tile.blocked && !tile.structureId && !tile.buildingId);
  }
  function sanitizePlayer(defPlayer, rawPlayer, map, flags) {
    const player = Object.assign({}, defPlayer, rawPlayer);
    const tile = tileById(map, player.tileId);
    if (!canPlayerStandOn(map, tile, flags)) return Object.assign({}, defPlayer);
    player.tileId = tile.id;
    player.x = tile.x;
    player.y = tile.y;
    if (["up", "down", "left", "right"].indexOf(player.facing) === -1) player.facing = defPlayer.facing;
    if (!player.action) player.action = defPlayer.action;
    return player;
  }
  function rebuildMapPreservingEntities(state, now) {
    const map = makeMap();
    const seeded = seedStructures(map, now);
    clearBuildingIds(map);
    const buildings = [];
    const usedBuildingIds = new Set();
    const addBuilding = (raw) => {
      const b = sanitizeBuilding(raw, map, usedBuildingIds);
      if (b) buildings.push(b);
    };
    if (Array.isArray(state.buildings)) state.buildings.forEach(addBuilding);
    seeded.buildings.forEach(addBuilding);
    return {
      map,
      buildings,
      animals: sanitizeAnimals(state.animals, seeded.animals, buildings),
    };
  }
  function reconcileBuildingsOnMap(map, rawBuildings, seededBuildings) {
    clearBuildingIds(map);
    const buildings = [];
    const usedBuildingIds = new Set();
    const addBuilding = (raw) => {
      const b = sanitizeBuilding(raw, map, usedBuildingIds);
      if (b) buildings.push(b);
    };
    if (Array.isArray(rawBuildings)) rawBuildings.forEach(addBuilding);
    for (const seeded of (seededBuildings || [])) {
      const structure = structureForBuilding(seeded);
      const alreadyPresent = structure && buildings.some((b) => b.structureId === structure.id);
      if (!alreadyPresent) addBuilding(seeded);
    }
    return buildings;
  }

  // 由 MAP_LAYOUT 產生大世界（soil→plot、grass/path/water、障礙、多格建築、站點、橋、事件點）
  function makeMap() {
    const layout = C.MAP_LAYOUT;
    const tiles = [];
    let plotIndex = 0;
    for (let y = 0; y < layout.length; y++) {
      for (let x = 0; x < layout[y].length; x++) {
        const ch = layout[y][x];
        // Stage 5：B=斷橋（水上、修好才可走）、E=事件點（草地上）
        let terrain, obstacle = null, bridge = false, event = null;
        if (ch === "B") { terrain = "water"; bridge = true; }
        else if (ch === "E") { terrain = "grass"; event = "east_clearing"; }
        else if (ch === "D") { terrain = "grass"; event = "east_deep_gate"; }
        else { obstacle = C.OBSTACLE_CODE[ch] || null; terrain = obstacle ? "grass" : (C.TERRAIN_CODE[ch] || "grass"); }
        const region = (x >= 19 && y >= 8) ? "east_deep" : (x >= C.EAST_REGION_MIN_X ? "east" : null); // 東林封鎖區（修橋後解鎖）
        tiles.push({
          id: "t" + x + "_" + y, x, y, terrain,
          object: obstacle,       // rock/stump/bush/tree（障礙，蓋在草地上）
          station: null,          // 固定站點（order_board/storage/mailbox/well/sign）
          structureId: null,      // 多格建築 footprint
          blocked: false,         // 不可走（水/障礙/建築 footprint 之外的明確阻擋）
          buildingId: null,       // 對應 state.buildings（動物家）
          bridge,                 // Stage 5：斷橋磚（修好後可走）
          event,                  // Stage 5：事件點 id（走過去觸發）
          forage: null,           // Stage 12：東林採集點 id
          region,                 // Stage 5：east＝東林封鎖區
          npc: null,              // Stage 6：NPC 鎮民 id（走相鄰交談）
          plotIndex: terrain === "soil" ? plotIndex++ : null,
        });
      }
    }
    const map = { width: layout[0].length, height: layout.length, tiles, soilCount: plotIndex };
    applyRegions(map);
    applyStructures(map);
    applyStations(map);
    applyNpcs(map);
    applyEvents(map);
    applyForage(map);
    return map;
  }

  // 由 STRUCTURES 預置動物家（雞舍起始 1 隻雞，動物可見＋可收集）+ 對應 buildingId
  // Stage 7：動物物件（含照護欄位）。affinity 為「上次照護當下的已收藏值」，
  // 實際親密度由 game.js 依經過時間衰減後現算，不在這裡模擬。
  function makeAnimal(id, type, homeId, now) {
    return { id, type, homeId, lastProducedAt: now,
      affinity: 0, lastCaredAt: now, lastFedAt: 0, lastWateredAt: 0, lastGroomedAt: 0,
      bestAffinity: 0 }; // Stage 11：歷史最高親密度（affinity 會隨時間衰減，Journal 的「曾經養到開心」里程碑要靠這個高水位，不能讀現值）
  }
  function seedStructures(map, now) {
    const buildings = [], animals = [];
    for (const s of (C.STRUCTURES || [])) {
      if (!s.building) continue;
      const b = { id: "b_" + s.id, type: s.building, tileId: "t" + s.x + "_" + s.y, structureId: s.id, builtAt: now, level: 1 };
      buildings.push(b);
      // footprint 磚的 buildingId 指向此 building（供收集互動）
      map.tiles.forEach((t) => { if (t.structureId === s.id) t.buildingId = b.id; });
      if (s.building === "chickenCoop") animals.push(makeAnimal("a_" + s.id + "_1", "chicken", b.id, now));
    }
    return { buildings, animals };
  }

  // 預設新存檔
  function defaultState(now) {
    now = now || Date.now();
    const map = makeMap();
    const seeded = seedStructures(map, now);
    return {
      version: C.GAME.version,
      createdAt: now,
      lastSeenAt: now,
      coins: C.GAME.startCoins,
      xp: 0,
      level: 1,
      selectedSeed: "wheat",
      gender: "f",                             // Stage 6：主角性別（f=Miri / m=Kai），可在設定切換
      useSprites: true,
      storage: { items: {} },                 // { cropId/productId: qty }
      plots: makePlots(C.GAME.maxPlots),      // 預建 maxPlots，soil 磚 1:1 對應；activePlotCount 控可用數
      upgrades: { plotCount: 0, growthSpeed: 0, sellBonus: 0, storageLevel: 0, helperLevel: 0 },
      orders: [],
      ordersSeededAt: 0,
      orderStreak: 0,
      weather: { id: "clear", untilMs: 0 },
      season: { id: "春", untilMs: now + (C.SEASON_DURATION_MS || 0) },
      achievements: {},                        // { id: true }
      // ===== MVP2 =====
      materials: { wood: 0, stone: 0, compost: 0 },
      map: map,
      buildings: seeded.buildings,             // 預置雞舍/畜舍（多格結構）
      animals: seeded.animals,                 // 預置雞舍 1 隻雞（可見＋可收集）
      // ===== 可走動世界 + camera =====
      camera: { x: 0, y: 0, followPlayer: true, focusTileId: null, focusUntil: 0 },
      player: { tileId: "t" + C.PLAYER_START.x + "_" + C.PLAYER_START.y, x: C.PLAYER_START.x, y: C.PLAYER_START.y,
                facing: "down", action: "idle", actionTargetTileId: null, actionEndsAt: 0 },
      interaction: { tool: "hand", buildType: null, selectedTileId: null, pendingPath: [], lastInvalidReason: null },
      // ===== 故事任務（地圖驅動）=====
      story: { questId: C.FIRST_QUEST, completed: {}, dialogueSeen: {}, markers: [] },
      mail: { unlocked: {}, read: {}, replied: false },
      // ===== Stage 5：世界探索旗標（修橋/事件）=====
      flags: { bridgeRepaired: false, eventsClaimed: {}, seasonEventsClaimed: {}, forageNodes: {}, eastForageDiscovered: false, eastForageReported: false, eastDeepUnlocked: false },
      stats: { harvested: {}, fulfilledOrders: 0, totalCoinsEarned: 0, plantCount: 0, cleared: 0, collected: {}, qualitySold: 0, npcRequestsCompleted: 0, festivalOrders: 0, seasonsReached: {} },
      discoveries: { items: {} }, // { [itemId]: firstDiscoveredAt }
      collections: {},            // { [collectibleId]: true }
      settings: { smartAssistant: true, smartAssistantCollapsed: true, offlineSummary: true, soundEnabled: true, soundVolume: 0.55, performanceMode: "auto", textSize: "medium", mapViewMode: "fit" },
      lastOfflineSummary: null,
      // ===== Stage 10：NPC 重複委託（依 npcId 為 key，同一時間每位 NPC 最多一張進行中）=====
      npcRequests: {},   // { [npcId]: { id, npcId, wants:{itemId:qty}, rewardCoins, rewardXp, createdAt } }
      npcRequestLog: {}, // { [npcId]: { lastRequestAt: 0, fulfilledCount: 0 } }
      npcSideQuests: {}, // { [npcId]: { id, status, startedAt, completedAt } }
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
    for (const key of Object.keys(C.UPGRADES || {})) {
      const max = Array.isArray(C.UPGRADES[key].levels) ? C.UPGRADES[key].levels.length : 0;
      const raw = Number.isFinite(merged.upgrades[key]) ? Math.floor(merged.upgrades[key]) : def.upgrades[key];
      merged.upgrades[key] = Math.max(0, Math.min(max, raw || 0));
    }
    merged.weather = Object.assign({ id: "clear", untilMs: 0 }, state.weather);
    merged.season = Object.assign({ id: "春", untilMs: def.season.untilMs }, state.season);
    if (!(C.SEASONS || []).some((s) => s.id === merged.season.id)) merged.season.id = "春";
    if (typeof merged.season.untilMs !== "number") merged.season.untilMs = def.season.untilMs;
    merged.achievements = Object.assign({}, state.achievements);
    merged.stats = Object.assign({}, def.stats, state.stats);
    merged.stats.harvested = Object.assign({}, state.stats && state.stats.harvested);
    merged.stats.collected = Object.assign({}, state.stats && state.stats.collected);
    merged.stats.seasonsReached = Object.assign({}, state.stats && state.stats.seasonsReached);
    merged.mail = Object.assign({}, def.mail, state.mail);
    merged.mail.unlocked = Object.assign({}, state.mail && state.mail.unlocked);
    merged.mail.read = Object.assign({}, state.mail && state.mail.read);
    merged.mail.replied = !!(state.mail && state.mail.replied);
    merged.npcRequests = Object.assign({}, state.npcRequests);
    merged.npcRequestLog = Object.assign({}, state.npcRequestLog);
    merged.npcSideQuests = Object.assign({}, state.npcSideQuests);
    if (!Array.isArray(merged.plots) || merged.plots.length === 0) merged.plots = def.plots;
    if (!Array.isArray(merged.orders)) merged.orders = [];
    // ===== MVP2 欄位補齊 =====
    merged.materials = Object.assign({ wood: 0, stone: 0, compost: 0 }, state.materials);
    merged.coins = nonNegativeNumber(merged.coins, def.coins);
    merged.xp = nonNegativeNumber(merged.xp, def.xp);
    merged.level = Math.max(1, Math.floor(nonNegativeNumber(merged.level, def.level)));
    for (const k of Object.keys(C.MATERIALS || {})) merged.materials[k] = nonNegativeNumber(merged.materials[k], 0);
    for (const [id, qty] of Object.entries(merged.storage.items || {})) {
      if (!Number.isFinite(qty) || qty <= 0) delete merged.storage.items[id];
      else merged.storage.items[id] = Math.floor(qty);
    }
    merged.flags = Object.assign({ bridgeRepaired: false, eventsClaimed: {}, seasonEventsClaimed: {}, forageNodes: {}, eastForageDiscovered: false, eastForageReported: false, eastDeepUnlocked: false }, state.flags);
    merged.flags.eventsClaimed = Object.assign({}, state.flags && state.flags.eventsClaimed);
    merged.flags.seasonEventsClaimed = Object.assign({}, state.flags && state.flags.seasonEventsClaimed);
    merged.flags.forageNodes = Object.assign({}, state.flags && state.flags.forageNodes);
    // 地圖：尺寸相符但 tiles 不完整/不合法也視為髒存檔，重建地圖綁定資料。
    if (healthyMap(state.map)) {
      merged.map = state.map;
      refreshDerivedMapFields(merged.map);
      merged.buildings = reconcileBuildingsOnMap(merged.map, state.buildings, def.buildings);
      merged.animals = sanitizeAnimals(Array.isArray(state.animals) ? state.animals : def.animals, def.animals, merged.buildings);
      merged.player = sanitizePlayer(def.player, state.player, merged.map, merged.flags);
    } else {
      const rebuilt = rebuildMapPreservingEntities(state, def.createdAt || state.lastSeenAt || 0);
      merged.map = rebuilt.map; merged.buildings = rebuilt.buildings; merged.animals = rebuilt.animals;
      merged.player = sanitizePlayer(def.player, state.player, merged.map, merged.flags);
    }
    // Stage 7：舊存檔的動物物件補齊照護欄位（新蓋的已經有，這裡對舊資料是 no-op）
    // Stage 11：bestAffinity 用舊 affinity 值當合理預設（沒有歷史資料，只能用現值墊底）
    merged.animals = (merged.animals || []).map((a) => Object.assign(
      { affinity: 0, lastCaredAt: a.lastProducedAt || 0, lastFedAt: 0, lastWateredAt: 0, lastGroomedAt: 0, bestAffinity: a.affinity || 0 }, a));
    // 確保 plots 數量足夠對應所有 soil 磚
    if (merged.plots.length < C.GAME.maxPlots) {
      while (merged.plots.length < C.GAME.maxPlots) merged.plots.push({ id: "p" + String(merged.plots.length + 1).padStart(2, "0"), cropId: null, plantedAt: 0 });
    }
    merged.camera = Object.assign({ x: 0, y: 0, followPlayer: true, focusTileId: null, focusUntil: 0 }, state.camera);
    merged.story = Object.assign({ questId: C.FIRST_QUEST, completed: {}, dialogueSeen: {}, markers: [] }, state.story);
    merged.discoveries = Object.assign({ items: {} }, state.discoveries);
    merged.discoveries.items = Object.assign({}, state.discoveries && state.discoveries.items);
    merged.settings = Object.assign({ smartAssistant: true, smartAssistantCollapsed: true, offlineSummary: true, soundEnabled: true, soundVolume: 0.55, performanceMode: "auto", textSize: "medium", mapViewMode: "fit" }, state.settings);
    if (!["auto", "high", "low"].includes(merged.settings.performanceMode)) merged.settings.performanceMode = "auto";
    if (!["small", "medium", "large"].includes(merged.settings.textSize)) merged.settings.textSize = "medium";
    if (!["fit", "natural"].includes(merged.settings.mapViewMode)) merged.settings.mapViewMode = "fit";
    merged.settings.soundVolume = Math.max(0, Math.min(1, Number.isFinite(merged.settings.soundVolume) ? merged.settings.soundVolume : 0.55));
    merged.lastOfflineSummary = state.lastOfflineSummary || null;
    const discoveredAtFallback = state.createdAt || state.lastSeenAt || Date.now();
    for (const [id, qty] of Object.entries(merged.stats.harvested || {})) {
      if (qty > 0 && !merged.discoveries.items[id]) merged.discoveries.items[id] = discoveredAtFallback;
    }
    for (const [id, qty] of Object.entries(merged.stats.collected || {})) {
      if (qty > 0 && !merged.discoveries.items[id]) merged.discoveries.items[id] = discoveredAtFallback;
    }
    merged.collections = Object.assign({}, state.collections);
    merged.gender = state.gender === "m" ? "m" : "f"; // Stage 6：主角性別
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

  // 安全存檔：失敗時不覆蓋既有 localStorage 內容。
  function safeSave(state) {
    if (typeof localStorage === "undefined") return;
    try {
      if (!state || typeof state !== "object" || !state.version) return { ok: false, reason: "bad_state" };
      const raw = JSON.stringify(state);
      JSON.parse(raw);
      localStorage.setItem(C.GAME.saveKey, raw);
      return { ok: true };
    } catch (e) {
      console.warn("存檔失敗：", e);
      return { ok: false, reason: "exception", error: e };
    }
  }
  function save(state) { safeSave(state); }

  // 清檔（測試用）
  function reset() {
    if (typeof localStorage === "undefined") return;
    try { localStorage.removeItem(C.GAME.saveKey); } catch (e) {}
  }

  const StateAPI = { defaultState, migrate, load, save, safeSave, reset, makePlots };
  if (typeof window !== "undefined") Object.assign(window, StateAPI);
  if (typeof module !== "undefined" && module.exports) module.exports = StateAPI;
})(typeof window !== "undefined" ? window : globalThis);
