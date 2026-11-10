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
    r66_beehive: { type: "r66_beehive", name: "蜂箱", unlockLevel: 2, costCoins: 40, intervalMs: 3 * 60 * 1000, itemId: "honey", itemName: "蜂蜜", art: "assets/generated/content-r70/beehive.png", produceText: "每 3 分鐘產 1 份蜂蜜" },
    r66_herb_garden: { type: "r66_herb_garden", name: "香草小圃", unlockLevel: 2, costCoins: 35, intervalMs: 4 * 60 * 1000, itemId: "river_mint", itemName: "薄荷", art: "assets/generated/content-r70/herb-garden.png", produceText: "每 4 分鐘產 1 份薄荷" },
    r66_feed_trough: { type: "r66_feed_trough", name: "雞舍餵食槽", unlockLevel: 2, costCoins: 45, intervalMs: 0, itemId: "egg", itemName: "雞蛋", art: "assets/generated/content-r70/feed-trough.png", produceText: "每次收雞蛋多 1 顆" },
  };
  const FACILITY_ORDER = ["r66_beehive", "r66_herb_garden", "r66_feed_trough"];
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
        b.facilities[building.id] = { type: building.type, lastCollectAt: building.builtAt || now || 0 };
      }
    }
    return { ok: true };
  }

  // ---------- 第 5 項：三個中期設施 ----------
  function facilityDef(type) { return FACILITIES[type] || null; }
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
    state.adventure.r66b.facilities[r.building.id] = { type, lastCollectAt: now };
    return { ok: true, building: r.building, message: `${FACILITIES[type].name}建好了。${FACILITIES[type].produceText}。` };
  }
  function pendingOf(state, building, now) {
    const def = building && FACILITIES[building.type];
    if (!def || !def.intervalMs) return 0;
    const rec = state.adventure.r66b.facilities[building.id] || {};
    const since = Number.isFinite(rec.lastCollectAt) ? rec.lastCollectAt : (building.builtAt || now);
    return Math.max(0, Math.floor(((Number.isFinite(now) ? now : 0) - since) / def.intervalMs));
  }
  function nextInMs(state, building, now) {
    const def = building && FACILITIES[building.type];
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
      const pending = building ? pendingOf(state, building, now) : 0;
      return {
        type, name: def.name, unlockLevel: def.unlockLevel, costCoins: def.costCoins,
        intervalMs: def.intervalMs, itemId: def.itemId, itemName: def.itemName, produceText: def.produceText,
        built: !!building, buildingId: building ? building.id : null, tileId: building ? building.tileId : null,
        pending, ready: pending > 0, nextInMs: building ? nextInMs(state, building, now) : 0,
        canBuild: canBuildFacility(state, type, now).ok,
        levelGap: Math.max(0, def.unlockLevel - (state.level || 1)),
        coinShortfall: Math.max(0, def.costCoins - (state.coins || 0)),
        gapText: building ? "已建造" : (Math.max(0, def.unlockLevel - (state.level || 1)) > 0 || Math.max(0, def.costCoins - (state.coins || 0)) > 0 ? [Math.max(0, def.unlockLevel - (state.level || 1)) > 0 ? `需要 Lv ${def.unlockLevel}（還差 ${Math.max(0, def.unlockLevel - (state.level || 1))} 級）` : "", Math.max(0, def.costCoins - (state.coins || 0)) > 0 ? `還差 ${Math.max(0, def.costCoins - (state.coins || 0))} 金` : ""].filter(Boolean).join("、") : "可以建造"),
      };
    });
  }
  function collectFacility(state, typeOrBuildingId, now) {
    now = Number.isFinite(now) ? now : Date.now();
    ensure(state, now);
    const building = (state.buildings || []).find((b) => b.id === typeOrBuildingId || b.type === typeOrBuildingId) || null;
    if (!building || !FACILITIES[building.type]) return { ok: false, reason: "not_built", message: "這個設施還沒建好。" };
    const def = FACILITIES[building.type];
    if (!def.intervalMs) return { ok: false, reason: "passive", message: `${def.name}不用收取，收雞蛋時會自動多 1 顆。` };
    const pending = pendingOf(state, building, now);
    if (pending <= 0) return { ok: false, reason: "not_ready", message: `${def.name}還在準備，${formatDuration(nextInMs(state, building, now))}後可以收取。` };
    const rec = state.adventure.r66b.facilities[building.id];
    const since = Number.isFinite(rec.lastCollectAt) ? rec.lastCollectAt : (building.builtAt || now);
    const addedResult = G.addToStorage ? G.addToStorage(state, def.itemId, pending) : { added: 0, lost: pending };
    rec.lastCollectAt = since + pending * def.intervalMs;
    if (addedResult.added > 0) {
      if (!state.stats) state.stats = {};
      if (!state.stats.collected) state.stats.collected = {};
      state.stats.collected[def.itemId] = (state.stats.collected[def.itemId] || 0) + addedResult.added;
      if (G.recordDiscovery) G.recordDiscovery(state, def.itemId, now);
    }
    return { ok: true, itemId: def.itemId, itemName: def.itemName, added: addedResult.added, lost: addedResult.lost, pending,
      message: addedResult.added > 0 ? `收下了 ${addedResult.added} 份${def.itemName}。` : "倉庫滿了，先賣掉一些東西再來收。" };
  }
  function eggBonusActive(state) {
    return !!(state && (state.buildings || []).some((b) => b.type === "r66_feed_trough"));
  }

  // ---------- 第 6 項：四位鄰居專屬互動 ----------
  function unlockedCropPool(state) {
    const pool = Object.values(C.CROPS || {}).filter((c) => c.unlockLevel <= (state.level || 1)).map((c) => c.id);
    return pool.length ? pool : ["wheat"];
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
      b.mayorQuest = { day: today, cropId, qty, rewardCoins: qty * sell * 3 + 12, rewardXp: 6, claimed: false };
    }
    const q = b.mayorQuest;
    const have = (state.storage && state.storage.items && state.storage.items[q.cropId]) || 0;
    return { npcId: "mayor", name: "鎮長葛瑞", title: "鎮公所委託", day: q.day, cropId: q.cropId, cropName: itemNameOf(q.cropId),
      qty: q.qty, have, rewardCoins: q.rewardCoins, rewardXp: q.rewardXp, claimed: !!q.claimed, canDeliver: !q.claimed && have >= q.qty };
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
  function askElderAdvice(state, now) {
    now = Number.isFinite(now) ? now : Date.now();
    const info = elderAdvice(state, now);
    if (info.askedToday) return { ok: false, reason: "daily_limit", message: "班伯今天已經指點過了，明天再來請教吧。" };
    const until = (dayNumber(now) + 1) * DAY_MS;
    state.adventure.r66b.elderAdvice = { day: info.day, at: now };
    state.adventure.r66b.adviceBuff = { until, mul: 0.9, source: "elder_advice" };
    return { ok: true, mul: 0.9, until, message: "班伯指點了幾招，今天作物長得快一些，成長時間縮短一成。" };
  }
  function merchantSpecial(state, now) {
    ensure(state, now);
    const b = state.adventure.r66b;
    const today = dayKey(now);
    if (b.merchantDeal.day !== today) {
      const all = unlockedCropPool(state);
      const discounted = all.filter((id) => C.CROPS[id] && C.CROPS[id].seedCost >= 2);
      const pool = discounted.length ? discounted : all;
      const cropId = pool[(dayNumber(now) + 1) % pool.length];
      b.merchantDeal = { day: today, cropId, bought: 0 };
    }
    const crop = C.CROPS[b.merchantDeal.cropId];
    const normalPrice = crop ? crop.seedCost : 1;
    return { npcId: "merchant", name: "商人蘿拉", title: "今日特價", day: today, cropId: b.merchantDeal.cropId,
      cropName: itemNameOf(b.merchantDeal.cropId), normalPrice, specialPrice: Math.max(1, Math.floor(normalPrice / 2)), packsPerBuy: normalPrice < 2 ? 2 : 1, bought: b.merchantDeal.bought || 0 }; // R66 整合：原價 1 金的種子無法再打折，改成買一送一
  }
  function buyMerchantSpecial(state, now) {
    now = Number.isFinite(now) ? now : Date.now();
    const deal = merchantSpecial(state, now);
    if ((state.coins || 0) < deal.specialPrice) return { ok: false, reason: "cost", message: `金幣不足，特價種子需要 ${deal.specialPrice} 金。` };
    state.coins -= deal.specialPrice;
    if (A && A.ensure) A.ensure(state, now);
    const packs = state.adventure.r58.r59.seedPacks;
    packs[deal.cropId] = Math.min(99, (packs[deal.cropId] || 0) + (deal.packsPerBuy || 1));
    state.adventure.r66b.merchantDeal.bought = (state.adventure.r66b.merchantDeal.bought || 0) + 1;
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
      { npcId: "mayor", name: mayor.name, title: mayor.title, detail: `今天想收 ${mayor.qty} 份${mayor.cropName}，你有 ${mayor.have} 份。完成給 ${mayor.rewardCoins} 金，比一般訂單划算。`, actionLabel: mayor.claimed ? "今天已交付" : "交付委託", canAct: mayor.canDeliver, done: mayor.claimed },
      { npcId: "elder", name: advice.name, title: advice.title, detail: advice.active ? "今天的指點生效中，作物成長時間縮短一成。" : "每天可以請教一次，今天還沒請教。", actionLabel: advice.askedToday ? "今天請教過了" : "請教種田", canAct: !advice.askedToday, done: advice.askedToday },
      { npcId: "merchant", name: deal.name, title: deal.title, detail: deal.packsPerBuy > 1 ? `今天${deal.cropName}種子買一送一：${deal.specialPrice} 金拿 ${deal.packsPerBuy} 包，今天已買 ${deal.bought} 次。` : `今天${deal.cropName}種子特價 ${deal.specialPrice} 金（原價 ${deal.normalPrice} 金），今天已買 ${deal.bought} 包。`, actionLabel: "買特價種子", canAct: (state.coins || 0) >= deal.specialPrice, done: false },
      { npcId: "child", name: treasure.name, title: treasure.title, detail: treasure.found ? "今天的寶藏找到了，明天圖圖會再藏一個。" : "圖圖在地圖某處藏了小土堆，找到有小禮物。", actionLabel: treasure.found ? "今天找到了" : "去找寶藏", canAct: !treasure.found, done: treasure.found, tileId: treasure.tileId },
    ];
  }

  const MidgameR66 = { FACILITIES, FACILITY_ORDER, TREASURE_TILES, TREASURE_REWARD_COINS, ensure, dayKey, formatDuration,
    facilityDef, canBuildFacility, buildFacility, facilityStatus, pendingOf, collectFacility, eggBonusActive,
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
      btn.innerHTML = `<img src="${esc(art)}?v=content-r72-20261110-1" alt="" draggable="false">`;
      btn.onclick = (ev) => { ev.stopPropagation(); onClick(); };
      world.appendChild(btn);
      return btn;
    };
    for (const row of facilityStatus(state, Date.now())) {
      if (!row.built) continue;
      const def = FACILITIES[row.type];
      const node = addNode(row.tileId, def.art, row.ready ? `${row.name}，可以收取 ${row.pending} 份${row.itemName}` : row.name,
        { r66bFacility: row.type, r66bTile: row.tileId, r66bReady: row.ready ? "1" : "" },
        () => {
          if (row.type === "r66_feed_trough") { toast("雞舍餵食槽生效中，每次收雞蛋多 1 顆。"); return; }
          const r = collectFacility(state, row.type, Date.now());
          toast(r.message);
          if (r.ok) saveAndRefresh(state);
        });
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
      btn.innerHTML = `<span class="bw-ic"><img class="r66b-build-art" src="${esc(FACILITIES[row.type].art)}?v=content-r72-20261110-1" alt=""></span><span class="bw-t">${esc(row.name)}<em class="bw-effect">${esc(row.produceText)}</em><small>${row.costCoins} 金<br>${row.built ? "已建造" : row.canBuild ? "可以建造" : esc(row.gapText || "還差一點")}</small></span>`;
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
