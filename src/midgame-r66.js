/* R66B：第 5～6 項——Lv 2 中期設施（蜂箱、香草小圃、雞舍餵食槽）與四位鄰居專屬互動。
   純邏輯可由 Node 載入測試；瀏覽器段透過既有 FarmWorld / __farm 介面接線，
   不改 adventure.js 的主線、日誌與小事件邏輯。 */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const C = isNode ? require("./config.js") : (root.CONFIG || root);
  const G = isNode ? require("./game.js") : (root.Game || root);
  const A = isNode ? require("./adventure.js") : (root.AdventureAPI || null);
  const DAY_MS = 24 * 60 * 60 * 1000;

  const FACILITIES = {
    r66_beehive: { type: "r66_beehive", name: "蜂箱", unlockLevel: 2, costCoins: 40, intervalMs: 3 * 60 * 1000, itemId: "honey", itemName: "蜂蜜", art: "assets/generated/content-r70/beehive.png", produceText: "花圃路線每 3 分鐘產蜂蜜；果樹路線產良好蜂蜜" },
    r66_herb_garden: { type: "r66_herb_garden", name: "香草小圃", unlockLevel: 2, costCoins: 35, intervalMs: 4 * 60 * 1000, itemId: "river_mint", itemName: "薄荷", art: "assets/generated/content-r70/herb-garden.png", produceText: "薄荷路線每 4 分鐘可收；藥草路線改收東林藥草" },
    r66_feed_trough: { type: "r66_feed_trough", name: "雞舍餵食槽", unlockLevel: 2, costCoins: 45, intervalMs: 0, itemId: "egg", itemName: "雞蛋", art: "assets/generated/content-r70/feed-trough.png", produceText: "餵小麥時收雞蛋多 1 顆；餵菜葉可產良好雞蛋" },
  };
  const FACILITY_ORDER = ["r66_beehive", "r66_herb_garden", "r66_feed_trough"];
  /* R80A：每座設施都能切換兩條實際產出路線。沿用既有物品圖，輸出已能進訂單、料理或祭典叫賣。 */
  const FACILITY_ROUTES = {
    r66_beehive: [
      { id: "flowers", label: "花圃採蜜", action: "引蜂去花圃", intervalMs: 3 * 60 * 1000, itemId: "honey", itemName: "蜂蜜", amount: 1, kind: "product", input: {}, useText: "蜂蜜可交訂單，也能帶去祭典叫賣。" },
      { id: "orchard", label: "果樹採蜜", action: "引蜂去果樹", intervalMs: 4 * 60 * 1000, itemId: "honey_good", itemName: "良好蜂蜜", amount: 1, kind: "product", input: {}, useText: "良好蜂蜜可交高品質訂單，也能帶去祭典叫賣。" },
    ],
    r66_herb_garden: [
      { id: "mint", label: "種溪畔薄荷", action: "改種薄荷", intervalMs: 4 * 60 * 1000, itemId: "river_mint", itemName: "溪畔薄荷", amount: 1, kind: "forage", input: {}, useText: "溪畔薄荷可泡薄荷茶，也能做料理。" },
      { id: "herb", label: "種東林藥草", action: "改種藥草", intervalMs: 5 * 60 * 1000, itemId: "forest_herb", itemName: "東林藥草", amount: 1, kind: "forage", input: {}, useText: "東林藥草會出現在鎮民訂單裡。" },
    ],
    r66_feed_trough: [
      { id: "wheat", label: "餵小麥", action: "改餵小麥", intervalMs: 0, itemId: "egg", itemName: "雞蛋", amount: 1, kind: "product", input: { wheat: 1 }, useText: "收雞蛋時多 1 顆，可直接交訂單。", passive: true },
      { id: "greens", label: "餵菜葉", action: "改餵菜葉", intervalMs: 3 * 60 * 1000, itemId: "egg_good", itemName: "優質雞蛋", amount: 1, kind: "product", input: { carrot: 1 }, useText: "優質雞蛋可交高品質訂單，也能帶去祭典叫賣。" },
    ],
  };
  const TREASURE_TILES = ["t6_8", "t12_5", "t9_6", "t13_8", "t5_5", "t11_9", "t15_5", "t7_10"];
  const TREASURE_REWARD_COINS = 12;

  function dayKey(now) { return new Date(now).toISOString().slice(0, 10); }
  function dayNumber(now) { return Math.floor((Number.isFinite(now) ? now : 0) / DAY_MS); }
  function formatDuration(ms) {
    const totalSec = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
    const min = Math.floor(totalSec / 60), sec = totalSec % 60;
    if (min && sec) return `約 ${min} 分 ${sec} 秒`;
    if (min) return `約 ${min} 分鐘`;
    return `約 ${sec} 秒`;
  }
  function itemNameOf(id) {
    const def = C.getItemDef ? C.getItemDef(id) : null;
    return def && def.name ? def.name : id;
  }

  function ensure(state, now) {
    if (!state || typeof state !== "object") return { ok: false };
    if (A && A.ensure) A.ensure(state, now);
    if (!state.adventure || typeof state.adventure !== "object") state.adventure = {};
    if (!state.adventure.r66b || typeof state.adventure.r66b !== "object") state.adventure.r66b = {};
    const b = state.adventure.r66b;
    if (!b.facilities || typeof b.facilities !== "object") b.facilities = {};
    if (!b.mayorQuest || typeof b.mayorQuest !== "object") b.mayorQuest = {};
    if (!b.elderAdvice || typeof b.elderAdvice !== "object") b.elderAdvice = {};
    if (!b.merchantDeal || typeof b.merchantDeal !== "object") b.merchantDeal = {};
    if (!b.treasure || typeof b.treasure !== "object") b.treasure = {};
    // 已建好的設施補上收取起點（舊存檔或經既有建造流程蓋的都能接續）
    for (const building of state.buildings || []) {
      if (!FACILITIES[building.type]) continue;
      const rec = b.facilities[building.id];
      if (!rec || typeof rec !== "object") {
        b.facilities[building.id] = { type: building.type, routeId: FACILITY_ROUTES[building.type][0].id, lastCollectAt: building.builtAt || now || 0 };
      } else if (!FACILITY_ROUTES[building.type].some((route) => route.id === rec.routeId)) {
        rec.routeId = FACILITY_ROUTES[building.type][0].id;
      }
    }
    return { ok: true };
  }

  // ---------- 第 5 項：三個中期設施 ----------
  function facilityDef(type) { return FACILITIES[type] || null; }
  function facilityRoutes(type) { return (FACILITY_ROUTES[type] || []).map((route) => Object.assign({}, route, { input: Object.assign({}, route.input || {}) })); }
  function facilityRecord(state, building) { return state && state.adventure && state.adventure.r66b && state.adventure.r66b.facilities && building ? state.adventure.r66b.facilities[building.id] || null : null; }
  function activeRoute(state, building) {
    const routes = building && FACILITY_ROUTES[building.type] || [];
    const rec = facilityRecord(state, building);
    return routes.find((route) => rec && route.id === rec.routeId) || routes[0] || null;
  }
  function buildingOf(state, type) {
    return (state.buildings || []).find((b) => b.type === type) || null;
  }
  function canBuildFacility(state, type, now) {
    ensure(state, now);
    const def = FACILITIES[type];
    if (!def) return { ok: false, reason: "unknown", message: "找不到這個設施。" };
    if ((state.level || 1) < def.unlockLevel) return { ok: false, reason: "locked", message: `需要 Lv ${def.unlockLevel}（還差 ${def.unlockLevel - (state.level || 1)} 級）才能建造${def.name}。` };
    if (buildingOf(state, type)) return { ok: false, reason: "built", message: `${def.name}已經建好了。` };
    if ((state.coins || 0) < def.costCoins) return { ok: false, reason: "cost", message: `還差 ${def.costCoins - (state.coins || 0)} 金，建造${def.name}需要 ${def.costCoins} 金。` };
    return { ok: true };
  }
  function buildFacility(state, type, tileId, now) {
    now = Number.isFinite(now) ? now : Date.now();
    ensure(state, now);
    const check = canBuildFacility(state, type, now);
    if (!check.ok) return check;
    if (!G.buildBuilding) return { ok: false, reason: "no_game", message: "建造功能尚未就緒。" };
    const r = G.buildBuilding(state, tileId, type, now);
    if (!r.ok) {
      const messages = { bad_tile: "這塊地不能放設施，換一塊草地試試。", cost: "金幣或建材不足。", locked: "等級還不夠。", max_count: "這個設施已經建好了。" };
      return { ok: false, reason: r.reason, message: messages[r.reason] || "這裡不能建造。" };
    }
    state.adventure.r66b.facilities[r.building.id] = { type, routeId: FACILITY_ROUTES[type][0].id, lastCollectAt: now };
    return { ok: true, building: r.building, message: `${FACILITIES[type].name}建好了。${FACILITIES[type].produceText}。` };
  }
  function pendingOf(state, building, now) {
    const def = activeRoute(state, building);
    if (!def || !def.intervalMs) return 0;
    const rec = state.adventure.r66b.facilities[building.id] || {};
    const since = Number.isFinite(rec.lastCollectAt) ? rec.lastCollectAt : (building.builtAt || now);
    return Math.max(0, Math.floor(((Number.isFinite(now) ? now : 0) - since) / def.intervalMs));
  }
  function nextInMs(state, building, now) {
    const def = activeRoute(state, building);
    if (!def || !def.intervalMs) return 0;
    if (pendingOf(state, building, now) > 0) return 0;
    const rec = state.adventure.r66b.facilities[building.id] || {};
    const since = Number.isFinite(rec.lastCollectAt) ? rec.lastCollectAt : (building.builtAt || now);
    return Math.max(0, def.intervalMs - (((Number.isFinite(now) ? now : 0) - since) % def.intervalMs));
  }
  function facilityStatus(state, now) {
    ensure(state, now);
    return FACILITY_ORDER.map((type) => {
      const def = FACILITIES[type];
      const building = buildingOf(state, type);
      const route = building ? activeRoute(state, building) : FACILITY_ROUTES[type][0];
      const pending = building ? pendingOf(state, building, now) : 0;
      return {
        type, name: def.name, unlockLevel: def.unlockLevel, costCoins: def.costCoins,
        intervalMs: route.intervalMs, itemId: route.itemId, itemName: route.itemName, produceText: def.produceText,
        routeId: route.id, routeLabel: route.label, routeAction: route.action, routeUseText: route.useText, routes: facilityRoutes(type), passive: !!route.passive,
        built: !!building, buildingId: building ? building.id : null, tileId: building ? building.tileId : null,
        pending, ready: pending > 0, nextInMs: building ? nextInMs(state, building, now) : 0,
        canBuild: canBuildFacility(state, type, now).ok,
        levelGap: Math.max(0, def.unlockLevel - (state.level || 1)),
        coinShortfall: Math.max(0, def.costCoins - (state.coins || 0)),
        gapText: building ? "已建造" : (Math.max(0, def.unlockLevel - (state.level || 1)) > 0 || Math.max(0, def.costCoins - (state.coins || 0)) > 0 ? [Math.max(0, def.unlockLevel - (state.level || 1)) > 0 ? `需要 Lv ${def.unlockLevel}（還差 ${Math.max(0, def.unlockLevel - (state.level || 1))} 級）` : "", Math.max(0, def.costCoins - (state.coins || 0)) > 0 ? `還差 ${Math.max(0, def.costCoins - (state.coins || 0))} 金` : ""].filter(Boolean).join("、") : "可以建造"),
      };
    });
  }
  function inputText(input) {
    const rows = Object.entries(input || {}).map(([id, count]) => `${itemNameOf(id)} ${count} 份`);
    return rows.length ? rows.join("、") : "不用材料";
  }
  function canChooseFacilityRoute(state, typeOrBuildingId, routeId, now) {
    ensure(state, now);
    const building = (state.buildings || []).find((row) => row.id === typeOrBuildingId || row.type === typeOrBuildingId) || null;
    if (!building || !FACILITY_ROUTES[building.type]) return { ok: false, reason: "not_built", message: "這個設施還沒建好。" };
    const route = FACILITY_ROUTES[building.type].find((row) => row.id === routeId);
    if (!route) return { ok: false, reason: "unknown_route", message: "找不到這條生產路線。" };
    const rec = facilityRecord(state, building);
    if (rec && rec.routeId === route.id) return { ok: true, same: true, building, route };
    for (const [id, count] of Object.entries(route.input || {})) {
      const have = Math.max(0, Number(state.storage && state.storage.items && state.storage.items[id]) || 0);
      if (have < count) return { ok: false, reason: "missing_input", message: `還差 ${count - have} 份${itemNameOf(id)}，才能改走「${route.label}」。`, building, route };
    }
    return { ok: true, same: false, building, route };
  }
  function chooseFacilityRoute(state, typeOrBuildingId, routeId, now) {
    const t = Number.isFinite(now) ? now : Date.now();
    const check = canChooseFacilityRoute(state, typeOrBuildingId, routeId, t);
    if (!check.ok || check.same) return check.same ? { ok: true, same: true, building: check.building, route: check.route, message: `${FACILITIES[check.building.type].name}現在就是「${check.route.label}」。` } : check;
    for (const [id, count] of Object.entries(check.route.input || {})) {
      state.storage.items[id] -= count;
      if (state.storage.items[id] <= 0) delete state.storage.items[id];
    }
    const rec = facilityRecord(state, check.building);
    rec.routeId = check.route.id; rec.lastCollectAt = t;
    const hasInput = Object.keys(check.route.input || {}).length > 0;
    return { ok: true, same: false, building: check.building, route: check.route, message: `${FACILITIES[check.building.type].name}改走「${check.route.label}」，${hasInput ? "投入" + inputText(check.route.input) : "不用投入材料"}。${check.route.useText}` };
  }
  function collectFacility(state, typeOrBuildingId, now) {
    now = Number.isFinite(now) ? now : Date.now();
    ensure(state, now);
    const building = (state.buildings || []).find((b) => b.id === typeOrBuildingId || b.type === typeOrBuildingId) || null;
    if (!building || !FACILITIES[building.type]) return { ok: false, reason: "not_built", message: "這個設施還沒建好。" };
    const facility = FACILITIES[building.type];
    const def = activeRoute(state, building);
    if (!def.intervalMs) return { ok: false, reason: "passive", message: `${facility.name}現在走「${def.label}」，收雞蛋時會自動多 1 顆。` };
    const pending = pendingOf(state, building, now);
    if (pending <= 0) return { ok: false, reason: "not_ready", message: `${def.name}還在準備，${formatDuration(nextInMs(state, building, now))}後可以收取。` };
    const rec = state.adventure.r66b.facilities[building.id];
    const since = Number.isFinite(rec.lastCollectAt) ? rec.lastCollectAt : (building.builtAt || now);
    const produced = pending * (def.amount || 1);
    const addedResult = G.addToStorage ? G.addToStorage(state, def.itemId, produced) : { added: 0, lost: produced };
    rec.lastCollectAt = since + pending * def.intervalMs;
    if (addedResult.added > 0) {
      if (!state.stats) state.stats = {};
      if (!state.stats.collected) state.stats.collected = {};
      state.stats.collected[def.itemId] = (state.stats.collected[def.itemId] || 0) + addedResult.added;
      if (G.recordDiscovery) G.recordDiscovery(state, def.itemId, now);
    }
    return { ok: true, itemId: def.itemId, itemName: def.itemName, added: addedResult.added, lost: addedResult.lost, pending,
      routeId: def.id, routeLabel: def.label, message: addedResult.added > 0 ? `從「${def.label}」收下了 ${addedResult.added} 份${def.itemName}。${def.useText}` : "倉庫滿了，先賣掉一些東西再來收。" };
  }
  function eggBonusActive(state) {
    if (!state) return false;
    ensure(state, Date.now());
    const building = buildingOf(state, "r66_feed_trough");
    const route = building && activeRoute(state, building);
    return !!(route && route.id === "wheat");
  }
  function facilityCatalogItems(state) {
    ensure(state, Date.now());
    const seen = new Set(); const rows = [];
    for (const building of state.buildings || []) for (const route of FACILITY_ROUTES[building.type] || []) {
      if (!route.itemId || seen.has(route.itemId)) continue;
      seen.add(route.itemId); rows.push({ id: route.itemId, name: route.itemName, kind: route.kind || "product" });
    }
    return rows;
  }

  // ---------- 第 6 項：四位鄰居專屬互動 ----------
  function unlockedCropPool(state) {
    const pool = Object.values(C.CROPS || {}).filter((c) => c.unlockLevel <= (state.level || 1)).map((c) => c.id);
    return pool.length ? pool : ["wheat"];
  }
  /* R75B：先聽鎮長說鎮上的事，鎮長每日委託金幣多一成，卡上寫明原因。 */
  function r75bStoryChoice(state, storyId) {
    const choices = state && state.adventure && state.adventure.r58 && state.adventure.r58.r59 && state.adventure.r58.r59.r60 && state.adventure.r58.r59.r60.storyChoices;
    return choices && choices[storyId] ? choices[storyId].choiceId : null;
  }
  /* R77B：後續委託三步做完後，開場選擇的長期加成升一級（判斷放在冒險模組，這裡只查詢）。 */
  function r77bUpgraded(state, npcId) {
    return !!(A && typeof A.r77Upgraded === "function" && A.r77Upgraded(state, npcId));
  }
  function mayorQuest(state, now) {
    ensure(state, now);
    const b = state.adventure.r66b;
    const today = dayKey(now);
    if (b.mayorQuest.day !== today) {
      const pool = unlockedCropPool(state);
      const cropId = pool[dayNumber(now) % pool.length];
      const qty = 2 + (dayNumber(now) % 2);
      const sell = (C.CROPS[cropId] && C.CROPS[cropId].sellValue) || 1;
      b.mayorQuest = { day: today, cropId, qty, baseRewardCoins: qty * sell * 3 + 12, rewardCoins: qty * sell * 3 + 12, rewardXp: 6, claimed: false };
    }
    const q = b.mayorQuest;
    const baseRewardCoins = Number.isFinite(q.baseRewardCoins) ? q.baseRewardCoins : q.rewardCoins;
    q.baseRewardCoins = baseRewardCoins;
    const bonusApplied = r75bStoryChoice(state, "mayor_welcome") === "town";
    const bonusUpgraded = bonusApplied && r77bUpgraded(state, "mayor");
    q.rewardCoins = bonusApplied ? Math.round(baseRewardCoins * (bonusUpgraded ? 1.2 : 1.1)) : baseRewardCoins;
    const have = (state.storage && state.storage.items && state.storage.items[q.cropId]) || 0;
    return { npcId: "mayor", name: "鎮長葛瑞", title: "鎮公所委託", day: q.day, cropId: q.cropId, cropName: itemNameOf(q.cropId),
      qty: q.qty, have, rewardCoins: q.rewardCoins, baseRewardCoins, bonusApplied, bonusUpgraded, bonusText: bonusUpgraded ? "你做完了「鎮上的事」，這份委託的金幣從多一成變成多兩成。" : bonusApplied ? "因為你先聽鎮長說鎮上的事，這份委託的金幣多一成。" : "", rewardXp: q.rewardXp, claimed: !!q.claimed, canDeliver: !q.claimed && have >= q.qty };
  }
  function deliverMayorQuest(state, now) {
    const q = mayorQuest(state, now);
    if (q.claimed) return { ok: false, reason: "daily_limit", message: "今天的鎮公所委託已經交了，明天再來看看。" };
    if (q.have < q.qty) return { ok: false, reason: "not_enough", message: `還差 ${q.qty - q.have} 份${q.cropName}，先去田裡收成吧。` };
    state.storage.items[q.cropId] -= q.qty;
    if (state.storage.items[q.cropId] <= 0) delete state.storage.items[q.cropId];
    state.coins = (state.coins || 0) + q.rewardCoins;
    if (!state.stats) state.stats = {};
    state.stats.totalCoinsEarned = (state.stats.totalCoinsEarned || 0) + q.rewardCoins;
    let leveled = 0;
    if (G.addXp) leveled = G.addXp(state, q.rewardXp);
    state.adventure.r66b.mayorQuest.claimed = true;
    /* R77B：交付成功後通知後續委託（掛鉤由 choices-r77.js 設定，沒設定就略過）。 */
    if (typeof MidgameR66.onMayorQuestDelivered === "function") { try { MidgameR66.onMayorQuestDelivered(state, now, q); } catch (_) {} }
    return { ok: true, cropId: q.cropId, cropName: q.cropName, qty: q.qty, rewardCoins: q.rewardCoins, rewardXp: q.rewardXp, leveled,
      message: `鎮公所委託完成，拿到 ${q.rewardCoins} 金和 ${q.rewardXp} 點經驗。` };
  }
  function elderAdvice(state, now) {
    ensure(state, now);
    const b = state.adventure.r66b;
    const today = dayKey(now);
    const buff = b.adviceBuff && b.adviceBuff.until > now ? b.adviceBuff : null;
    return { npcId: "elder", name: "老農班伯", title: "請教種田", day: today, askedToday: b.elderAdvice.day === today,
      active: !!buff, mul: buff ? buff.mul : 0.9, until: buff ? buff.until : 0,
      text: "今天作物成長時間縮短一成" };
  }
  /* R75B：先留一包種子，每天請教班伯時多拿 1 包當季種子。 */
  function r75bSeasonalCropId(state) {
    const seasonId = state && state.season && state.season.id;
    const crops = Object.values(C.CROPS || {});
    const seasonal = crops.filter((crop) => crop.season && crop.season === seasonId);
    if (!seasonal.length) return "wheat";
    const level = (state && state.level) || 1;
    const unlocked = seasonal.filter((crop) => (crop.unlockLevel || 1) <= level);
    const pool = (unlocked.length ? unlocked : seasonal).slice().sort((x, y) => (x.unlockLevel || 1) - (y.unlockLevel || 1));
    return pool[0].id;
  }
  function askElderAdvice(state, now) {
    now = Number.isFinite(now) ? now : Date.now();
    const info = elderAdvice(state, now);
    if (info.askedToday) return { ok: false, reason: "daily_limit", message: "班伯今天已經指點過了，明天再來請教吧。" };
    const until = (dayNumber(now) + 1) * DAY_MS;
    state.adventure.r66b.elderAdvice = { day: info.day, at: now };
    state.adventure.r66b.adviceBuff = { until, mul: 0.9, source: "elder_advice" };
    let seasonalSeed = null;
    if (r75bStoryChoice(state, "elder_wheat") === "seed") {
      if (A && A.ensure) A.ensure(state, now);
      const cropId = r75bSeasonalCropId(state);
      const packs = state.adventure.r58.r59.seedPacks;
      const packCount = r77bUpgraded(state, "elder") ? 2 : 1;
      packs[cropId] = Math.min(99, (packs[cropId] || 0) + packCount);
      seasonalSeed = { cropId, cropName: itemNameOf(cropId), qty: packCount };
    }
    return { ok: true, mul: 0.9, until, seasonalSeed, message: "班伯指點了幾招，今天作物長得快一些，成長時間縮短一成。" + (seasonalSeed ? (seasonalSeed.qty > 1 ? "你做完了「留種」，班伯多給你 " + seasonalSeed.qty + " 包" + seasonalSeed.cropName + "種子。" : "因為你先留了一包種子，班伯多給你 1 包" + seasonalSeed.cropName + "種子。") : "") };
  }
  /* R75B：先聽客人想買什麼，蘿拉今日特價從一樣變兩樣（deals[0] 是原本那樣，deals[1] 是多出來的）。 */
  function merchantSpecial(state, now) {
    ensure(state, now);
    const b = state.adventure.r66b;
    const today = dayKey(now);
    if (b.merchantDeal.day !== today) {
      const all = unlockedCropPool(state);
      const discounted = all.filter((id) => C.CROPS[id] && C.CROPS[id].seedCost >= 2);
      const pool = discounted.length ? discounted : all;
      const cropId = pool[(dayNumber(now) + 1) % pool.length];
      b.merchantDeal = { day: today, cropId, cropId2: null, bought: 0, bought2: 0 };
    }
    const dealOf = (cropId) => {
      const crop = C.CROPS[cropId];
      const normalPrice = crop ? crop.seedCost : 1;
      return { cropId, cropName: itemNameOf(cropId), normalPrice, specialPrice: Math.max(1, Math.floor(normalPrice / 2)), packsPerBuy: normalPrice < 2 ? 2 : 1 };
    };
    const twoSpecials = r75bStoryChoice(state, "merchant_hello") === "listen";
    if (twoSpecials && !b.merchantDeal.cropId2) {
      const all = unlockedCropPool(state);
      const discounted = all.filter((id) => C.CROPS[id] && C.CROPS[id].seedCost >= 2);
      let pool = (discounted.length ? discounted : all).filter((id) => id !== b.merchantDeal.cropId);
      if (!pool.length) pool = all.filter((id) => id !== b.merchantDeal.cropId);
      b.merchantDeal.cropId2 = pool.length ? pool[(dayNumber(now) + 2) % pool.length] : b.merchantDeal.cropId;
    }
    if (!twoSpecials) b.merchantDeal.cropId2 = b.merchantDeal.cropId2 && b.merchantDeal.day === today ? b.merchantDeal.cropId2 : null;
    const primary = dealOf(b.merchantDeal.cropId);
    const deals = [Object.assign({}, primary, { bought: b.merchantDeal.bought || 0 })];
    if (twoSpecials && b.merchantDeal.cropId2) deals.push(Object.assign({}, dealOf(b.merchantDeal.cropId2), { bought: b.merchantDeal.bought2 || 0 }));
    /* R77B：做完「客人的話」之後，今日特價從兩樣變三樣（deals[2] 是多出來的第三樣）。 */
    const threeSpecials = twoSpecials && deals.length > 1 && r77bUpgraded(state, "merchant");
    if (threeSpecials && !b.merchantDeal.cropId3) {
      const all = unlockedCropPool(state);
      const taken = [b.merchantDeal.cropId, b.merchantDeal.cropId2];
      const discounted = all.filter((id) => C.CROPS[id] && C.CROPS[id].seedCost >= 2);
      let pool = (discounted.length ? discounted : all).filter((id) => !taken.includes(id));
      if (!pool.length) pool = all.filter((id) => !taken.includes(id));
      b.merchantDeal.cropId3 = pool.length ? pool[(dayNumber(now) + 3) % pool.length] : b.merchantDeal.cropId;
    }
    if (threeSpecials && b.merchantDeal.cropId3) deals.push(Object.assign({}, dealOf(b.merchantDeal.cropId3), { bought: b.merchantDeal.bought3 || 0 }));
    return { npcId: "merchant", name: "商人蘿拉", title: "今日特價", day: today, cropId: primary.cropId,
      cropName: primary.cropName, normalPrice: primary.normalPrice, specialPrice: primary.specialPrice, packsPerBuy: primary.packsPerBuy, bought: b.merchantDeal.bought || 0,
      cropId2: deals.length > 1 ? deals[1].cropId : null, cropId3: deals.length > 2 ? deals[2].cropId : null, deals, twoSpecials, threeSpecials };
  }
  function buyMerchantSpecial(state, now, cropId, dealIndex) {
    now = Number.isFinite(now) ? now : Date.now();
    const view = merchantSpecial(state, now);
    const deal = Number.isInteger(dealIndex) && view.deals[dealIndex] ? view.deals[dealIndex] : cropId ? view.deals.find((row) => row.cropId === cropId) : view.deals[0];
    if (!deal) return { ok: false, reason: "unknown", message: "找不到這樣特價。" };
    if ((state.coins || 0) < deal.specialPrice) return { ok: false, reason: "cost", message: `金幣不足，特價種子需要 ${deal.specialPrice} 金。` };
    state.coins -= deal.specialPrice;
    if (A && A.ensure) A.ensure(state, now);
    const packs = state.adventure.r58.r59.seedPacks;
    packs[deal.cropId] = Math.min(99, (packs[deal.cropId] || 0) + (deal.packsPerBuy || 1));
    if (Number.isInteger(dealIndex) && dealIndex > 1) state.adventure.r66b.merchantDeal.bought3 = (state.adventure.r66b.merchantDeal.bought3 || 0) + 1;
    else if (Number.isInteger(dealIndex) && dealIndex > 0) state.adventure.r66b.merchantDeal.bought2 = (state.adventure.r66b.merchantDeal.bought2 || 0) + 1;
    else if (deal.cropId === view.cropId) state.adventure.r66b.merchantDeal.bought = (state.adventure.r66b.merchantDeal.bought || 0) + 1;
    else state.adventure.r66b.merchantDeal.bought2 = (state.adventure.r66b.merchantDeal.bought2 || 0) + 1;
    return { ok: true, cropId: deal.cropId, cropName: deal.cropName, price: deal.specialPrice, seedPacks: packs[deal.cropId],
      message: `用特價 ${deal.specialPrice} 金買了 ${deal.packsPerBuy || 1} 包${deal.cropName}種子，種的時候會先用種子包。` };
  }
  function treasureInfo(state, now) {
    ensure(state, now);
    const b = state.adventure.r66b;
    const today = dayKey(now);
    if (b.treasure.day !== today) {
      const candidates = TREASURE_TILES.filter((id) => {
        const tile = (state.map && state.map.tiles || []).find((t) => t.id === id);
        return tile && (tile.terrain === "grass" || tile.terrain === "path") && !tile.buildingId && !tile.npc && !tile.station && !tile.structureId && !tile.object;
      });
      const tileId = candidates.length ? candidates[dayNumber(now) % candidates.length] : TREASURE_TILES[dayNumber(now) % TREASURE_TILES.length];
      b.treasure = { day: today, tileId, found: false };
    }
    return { npcId: "child", name: "孩童圖圖", title: "圖圖的寶藏", day: today, tileId: b.treasure.tileId, found: !!b.treasure.found, rewardCoins: TREASURE_REWARD_COINS };
  }
  function findTreasure(state, tileId, now) {
    now = Number.isFinite(now) ? now : Date.now();
    const info = treasureInfo(state, now);
    if (info.found) return { ok: false, reason: "daily_limit", message: "今天的寶藏已經找到了，明天圖圖會再藏一個。" };
    if (tileId !== info.tileId) return { ok: false, reason: "wrong_spot", message: "這裡沒有寶藏，再到地圖上找找小土堆。" };
    state.adventure.r66b.treasure.found = true;
    state.coins = (state.coins || 0) + info.rewardCoins;
    if (!state.stats) state.stats = {};
    state.stats.totalCoinsEarned = (state.stats.totalCoinsEarned || 0) + info.rewardCoins;
    if (A && A.ensure) A.ensure(state, now);
    const packs = state.adventure.r58.r59.seedPacks;
    packs.wheat = Math.min(99, (packs.wheat || 0) + 1);
    return { ok: true, tileId: info.tileId, rewardCoins: info.rewardCoins, message: `找到圖圖的寶藏，拿到 ${info.rewardCoins} 金和 1 包小麥種子。` };
  }
  function neighborPanel(state, now) {
    const mayor = mayorQuest(state, now), advice = elderAdvice(state, now), deal = merchantSpecial(state, now), treasure = treasureInfo(state, now);
    return [
      { npcId: "mayor", name: mayor.name, title: mayor.title, detail: `今天想收 ${mayor.qty} 份${mayor.cropName}，你有 ${mayor.have} 份。完成給 ${mayor.rewardCoins} 金，比一般訂單划算。${mayor.bonusText || ""}`, actionLabel: mayor.claimed ? "今天已交付" : "交付委託", canAct: mayor.canDeliver, done: mayor.claimed },
      { npcId: "elder", name: advice.name, title: advice.title, detail: (advice.active ? "今天的指點生效中，作物成長時間縮短一成。" : "每天可以請教一次，今天還沒請教。") + (r75bStoryChoice(state, "elder_wheat") === "seed" && r77bUpgraded(state, "elder") ? "你做完了「留種」，每次請教多拿 2 包當季種子。" : ""), actionLabel: advice.askedToday ? "今天請教過了" : "請教種田", canAct: !advice.askedToday, done: advice.askedToday },
      { npcId: "merchant", name: deal.name, title: deal.title, detail: (deal.deals && deal.deals.length > 2 ? `今天有三樣特價：${deal.deals.map((row) => `${row.cropName}種子 ${row.specialPrice} 金`).join("、")}，第一樣今天已買 ${deal.bought} 次，第二、第三樣可以在手札的「我做過的選擇」裡買。` : deal.deals && deal.deals.length > 1 ?`今天有兩樣特價：${deal.deals.map((row) => `${row.cropName}種子 ${row.specialPrice} 金`).join("、")}，第一樣今天已買 ${deal.bought} 次，第二樣可以在手札的「我做過的選擇」裡買。` : deal.packsPerBuy > 1 ? `今天${deal.cropName}種子買一送一：${deal.specialPrice} 金拿 ${deal.packsPerBuy} 包，今天已買 ${deal.bought} 次。` : `今天${deal.cropName}種子特價 ${deal.specialPrice} 金（原價 ${deal.normalPrice} 金），今天已買 ${deal.bought} 包。`), actionLabel: "買特價種子", canAct: (state.coins || 0) >= deal.specialPrice, done: false },
      { npcId: "child", name: treasure.name, title: treasure.title, detail: treasure.found ? "今天的寶藏找到了，明天圖圖會再藏一個。" : "圖圖在地圖某處藏了小土堆，找到有小禮物。", actionLabel: treasure.found ? "今天找到了" : "去找寶藏", canAct: !treasure.found, done: treasure.found, tileId: treasure.tileId },
    ];
  }

  const MidgameR66 = { FACILITIES, FACILITY_ROUTES, FACILITY_ORDER, TREASURE_TILES, TREASURE_REWARD_COINS, ensure, dayKey, formatDuration,
    facilityDef, facilityRoutes, activeRoute, canBuildFacility, buildFacility, facilityStatus, pendingOf, canChooseFacilityRoute, chooseFacilityRoute, collectFacility, eggBonusActive, facilityCatalogItems,
    mayorQuest, deliverMayorQuest, elderAdvice, askElderAdvice, merchantSpecial, buyMerchantSpecial,
    treasureInfo, findTreasure, neighborPanel };
  root.MidgameR66 = MidgameR66;
  if (isNode) module.exports = MidgameR66;

  /* ---------- 瀏覽器接線 ---------- */
  if (typeof document === "undefined" || !root.FarmWorld) return;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const farm = () => root.__farm;
  function currentState() {
    const f = farm();
    if (!f) return null;
    return typeof f.state === "function" ? f.state() : null;
  }
  function saveAndRefresh(state) {
    const f = farm();
    if (f && f.safeSaveNow) f.safeSaveNow();
    if (f && f.refresh) f.refresh();
    tryInjectJournal(state);
  }
  function toast(message) { const f = farm(); if (f && f.toast) f.toast(message); }
  function routeItemArt(id) {
    const base = String(id || "").replace(/_(good|premium)$/, "");
    return C.CROPS && C.CROPS[base] ? `assets/generated/r66/native/crop_${base}-32.png` : `assets/generated/content-r73/item-${base}.png`;
  }
  function openFacilityPanel(state, type, now) {
    const old = document.querySelector(".r80a-facility-overlay"); if (old) old.remove();
    const status = facilityStatus(state, now).find((row) => row.type === type);
    if (!status || !status.built) return;
    const overlay = document.createElement("div"); overlay.className = "r80a-facility-overlay"; overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true"); overlay.setAttribute("aria-label", status.name + "生產路線");
    const render = () => {
      const current = facilityStatus(state, Date.now()).find((row) => row.type === type);
      const routeCards = current.routes.map((route) => {
        const active = route.id === current.routeId;
        const check = canChooseFacilityRoute(state, type, route.id, Date.now());
        const input = inputText(route.input);
        const output = route.passive ? "收雞蛋時多 1 顆雞蛋" : `${formatDuration(route.intervalMs)}產 ${route.amount || 1} 份${route.itemName}`;
        return `<article class="r80a-route-card${active ? " is-active" : ""}" data-r80a-route-card="${esc(route.id)}"><img src="${esc(routeItemArt(route.itemId))}?v=content-r81-20261116-1" alt=""><div><h3>${esc(route.label)}</h3><p>操作：${esc(route.action)}</p><p>投入：${esc(input)}</p><p>產出：${esc(output)}</p><small>${esc(route.useText)}</small></div><button type="button" data-r80a-route="${esc(route.id)}" ${active || !check.ok ? "disabled" : ""}>${active ? "目前路線" : check.ok ? esc(route.action) : esc(check.message)}</button></article>`;
      }).join("");
      const readyText = current.passive ? "這條路線不用等倒數，收雞蛋時直接生效。" : current.ready ? `已經有 ${current.pending} 份可以收。` : `${formatDuration(current.nextInMs)}後可以收${current.itemName}。`;
      overlay.innerHTML = `<div class="r80a-facility-card"><button type="button" class="r80a-facility-close" aria-label="關閉">×</button><h2>${esc(current.name)}怎麼運作</h2><p class="r80a-active-route">目前走「${esc(current.routeLabel)}」。${esc(readyText)}</p><div class="r80a-route-grid">${routeCards}</div><div class="r80a-facility-actions"><button type="button" data-r80a-collect ${current.passive || !current.ready ? "disabled" : ""}>${current.passive ? "收蛋時自動生效" : current.ready ? `收取${esc(current.itemName)}` : "還在準備"}</button><button type="button" data-r80a-close>回到農場</button></div></div>`;
      overlay.querySelector(".r80a-facility-close").onclick = () => overlay.remove();
      overlay.querySelector("[data-r80a-close]").onclick = () => overlay.remove();
      overlay.querySelectorAll("[data-r80a-route]").forEach((button) => { button.onclick = () => {
        const result = chooseFacilityRoute(state, type, button.dataset.r80aRoute, Date.now()); toast(result.message);
        if (result.ok) { saveAndRefresh(state); render(); }
      }; });
      const collect = overlay.querySelector("[data-r80a-collect]"); if (collect) collect.onclick = () => {
        const result = collectFacility(state, type, Date.now()); toast(result.message);
        if (result.ok) saveAndRefresh(state);
        render();
      };
    };
    render(); document.body.appendChild(overlay);
  }

  // 地圖顯示：設施與寶藏疊在既有世界層上；收取標示是文字徽章，不用表情符號當地圖物件。
  function paintMidgame(state, tileSize) {
    const world = document.querySelector("#mapWorld");
    if (!world || !state || !state.map) return;
    ensure(state, Date.now());
    world.querySelectorAll(".r66b-map-node").forEach((n) => n.remove());
    const tileOf = (id) => (state.map.tiles || []).find((t) => t.id === id);
    const addNode = (tileId, art, label, dataset, onClick) => {
      const tile = tileOf(tileId); if (!tile) return;
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "r66b-map-node";
      Object.assign(btn.dataset, dataset || {});
      btn.setAttribute("aria-label", label);
      const size = Math.min(Math.round(tileSize * 1.08), Math.floor(tileSize * 1.5)); // R71B：設施圖寬度不超過一格半
      btn.style.cssText = `left:${Math.round((tile.x + 0.5) * tileSize)}px;top:${Math.round((tile.y + 1) * tileSize)}px;width:${size}px;height:${size}px;z-index:${Math.round((tile.y + 1) * tileSize) + 2};`;
      btn.innerHTML = `<img src="${esc(art)}?v=content-r81-20261116-1" alt="" draggable="false">${dataset && dataset.r66bFacility ? `<span class="r74a-facility-name">${esc(label.split("，")[0])}</span><span class="r80a-facility-route">${esc(dataset.r80aRouteLabel || "尚未選路線")}</span>` : ""}`;
      btn.onclick = (ev) => { ev.stopPropagation(); onClick(); };
      world.appendChild(btn);
      return btn;
    };
    for (const row of facilityStatus(state, Date.now())) {
      if (!row.built) continue;
      const def = FACILITIES[row.type];
      const node = addNode(row.tileId, def.art, row.ready ? `${row.name}，可以收取 ${row.pending} 份${row.itemName}` : row.name,
        { r66bFacility: row.type, r66bTile: row.tileId, r66bReady: row.ready ? "1" : "", r80aRouteLabel: row.routeLabel },
        () => openFacilityPanel(state, row.type, Date.now()));
      if (node && row.ready) {
        const badge = document.createElement("span");
        badge.className = "r66b-ready-badge"; badge.textContent = `可收取 ${row.pending}`;
        node.appendChild(badge);
      }
    }
    const treasure = treasureInfo(state, Date.now());
    if (!treasure.found) {
      addNode(treasure.tileId, "assets/generated/content-r66/treasure.svg", "圖圖的寶藏，點看看", { r66bTreasure: treasure.tileId }, () => {
        const f = farm();
        const doFind = () => { const r = findTreasure(state, treasure.tileId, Date.now()); toast(r.message); if (r.ok) saveAndRefresh(state); };
        if (f && f.travelAndDo) { if (!f.travelAndDo(treasure.tileId, "collect", doFind)) doFind(); }
        else doFind();
      });
    }
  }
  if (root.FarmWorld && !root.FarmWorld.__r66bPaintWrapped) {
    const originalPaint = root.FarmWorld.paintWorld;
    root.FarmWorld.paintWorld = function (s, tileSize, t) {
      const out = originalPaint.call(this, s, tileSize, t);
      paintMidgame(s, tileSize);
      return out;
    };
    root.FarmWorld.__r66bPaintWrapped = true;
  }

  // 建造選單：在既有建造選單後面補上三個中期設施，點了之後沿用既有放置流程。
  function injectBuildCatalog() {
    const box = document.querySelector("#buildWheel");
    const state = currentState();
    if (!box || !state || box.querySelector("[data-r66b-build]")) return;
    ensure(state, Date.now());
    for (const row of facilityStatus(state, Date.now())) {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "build-wheel-btn r66b-build-btn";
      btn.dataset.r66bBuild = row.type;
      btn.disabled = row.built || !row.canBuild;
      btn.title = `${row.name}・${row.costCoins} 金・${row.produceText}`;
      btn.innerHTML = `<span class="bw-ic"><img class="r66b-build-art" src="${esc(FACILITIES[row.type].art)}?v=content-r81-20261116-1" alt=""></span><span class="bw-t">${esc(row.name)}<em class="bw-effect">${esc(row.produceText)}</em><small><span class="bw-costs">${row.costCoins} 金</span><span class="bw-status">${row.built ? "已建造" : row.canBuild ? "可以建造" : esc(row.gapText || "還差一點")}</span></small></span>`;
      btn.onclick = (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        state.interaction.buildType = row.type;
        const f = farm();
        if (f && f.setTool) f.setTool("build");
        toast(`已選${row.name}，請點一塊亮起的草地放置。`);
      };
      box.appendChild(btn);
    }
  }

  // 鄰居專屬互動：注入手札面板，操作直接走純邏輯。
  function journalSectionHtml(state) {
    const rows = neighborPanel(state, Date.now());
    return `<section class="r66b-neighbors" data-r66b-panel aria-label="鄰居專屬互動"><div class="story-kicker">鄰居專屬互動</div>${rows.map((d) => `<article class="r66b-card" data-r66b-neighbor="${d.npcId}"><h3 class="r66b-name">${esc(d.name)}・${esc(d.title)}</h3><p class="r66b-detail">${esc(d.detail)}</p><div class="r66b-actions"><button type="button" class="r66b-act" data-r66b-act="${d.npcId}" ${d.canAct ? "" : "disabled"}>${esc(d.actionLabel)}</button></div></article>`).join("")}</section>`;
  }
  let injecting = false;
  function tryInjectJournal(stateArg) {
    const panel = document.querySelector("#journalPanel");
    const state = stateArg || currentState();
    if (!panel || !state || injecting) return;
    if (!stateArg && panel.querySelector("[data-r66b-panel]")) return;
    injecting = true;
    panel.querySelectorAll("[data-r66b-panel]").forEach((el) => el.remove());
    const host = document.createElement("div");
    host.innerHTML = journalSectionHtml(state);
    const section = host.firstElementChild;
    panel.appendChild(section);
    section.querySelectorAll("[data-r66b-act]").forEach((btn) => {
      btn.onclick = () => {
        const npcId = btn.dataset.r66bAct;
        let r = null;
        if (npcId === "mayor") r = deliverMayorQuest(state, Date.now());
        else if (npcId === "elder") r = askElderAdvice(state, Date.now());
        else if (npcId === "merchant") r = buyMerchantSpecial(state, Date.now());
        else if (npcId === "child") {
          const info = treasureInfo(state, Date.now());
          const f = farm();
          if (f && f.focusTile) f.focusTile(info.tileId);
          toast("圖圖把寶藏藏在地圖上的小土堆裡，去點那個土堆吧。");
          injecting = false;
          return;
        }
        if (r) toast(r.message);
        saveAndRefresh(state);
      };
    });
    injecting = false;
  }
  const observer = new MutationObserver(() => { injectBuildCatalog(); if (!injecting) tryInjectJournal(); });
  const start = () => {
    setInterval(() => {
      const state = currentState();
      const world = document.querySelector("#mapWorld");
      if (!state || !world || !state.map || !world.offsetWidth) return;
      if (!document.querySelector(".r66b-map-node")) paintMidgame(state, Math.max(24, Math.round(world.offsetWidth / state.map.width)));
    }, 600);
    const panel = document.querySelector("#journalPanel");
    if (panel) observer.observe(panel, { childList: true });
    const wheel = document.querySelector("#buildWheel");
    if (wheel) observer.observe(wheel, { childList: true });
    injectBuildCatalog();
    tryInjectJournal();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  root.MidgameR66.injectJournal = tryInjectJournal;
  root.MidgameR66.paintMidgame = paintMidgame;
})(typeof window !== "undefined" ? window : globalThis);
