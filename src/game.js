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
  const Daily = (typeof module !== "undefined" && module.exports) ? require("./daily.js") : root.FarmDaily;
  const Heirloom = (typeof module !== "undefined" && module.exports) ? require("./heirloom.js") : root.FarmHeirloom;
  const Sunplay = (typeof module !== "undefined" && module.exports) ? require("./sunplay-r75.js") : root.FarmSunplay;
  const {
    GAME, CROPS, UPGRADES, ORDER_RARITY, ORDER_STREAK_BONUS, ORDER_STREAK_CAP,
    SEASONS, SEASON_DURATION_MS, SEASON_UNLOCK_LEVEL, SEASON_ORDER_BIAS, SEASON_EVENTS,
    WEATHER, WEATHER_UNLOCK_LEVEL, WEATHER_DURATION_MS, ACHIEVEMENTS,
    levelFromXp,
    PRODUCTS, getItemDef, itemSellValue, MATERIALS, TERRAIN, OBSTACLES,
    BUILDINGS, BUILDING_ORDER, ANIMALS, MOISTURE_MUL,
    LETTERS, CHAPTER5_LETTERS, TOWNSFOLK_LETTERS,
    AFFINITY_MAX, AFFINITY_DECAY_PER_HOUR, AFFINITY_HAPPY_THRESHOLD, AFFINITY_GOOD_THRESHOLD,
    CARE_GAIN, CARE_COOLDOWN_MS, STATUS_STALE_MS, QUALITY_TIERS,
  } = C;

  // ---------- 工具 ----------
  function rngInt(rng, min, max) { return min + Math.floor((rng || Math.random)() * (max - min + 1)); }
  function rngPick(rng, arr) { return arr[Math.floor((rng || Math.random)() * arr.length)]; }
  function itemDefinition(id) { return getItemDef(id) || (Sunplay && Sunplay.driedDef(id)); }

  // ---------- 解鎖 / 成長倍率 ----------
  function unlockedCrops(state) {
    return Object.values(CROPS).filter((c) => isCropUnlocked(state, c.id)).map((c) => c.id);
  }
  function isCropUnlocked(state, cropId) {
    const c = CROPS[cropId];
    if (!c || c.unlockLevel > state.level) return false;
    // R62A：胡蘿蔔從第一次開墾取得；等級到但還買不到種子時，不算已解鎖。
    if (cropId === "carrot") return ((state.upgrades || {}).plotCount || 0) >= 1;
    return true;
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
    return unlockedCrops(state).concat(unlockedProducts(state), unlockedForageItems(state), Sunplay ? Sunplay.driedItemIds(state) : []);
  }
  // 成長時間倍率：肥沃土壤升級 × 天氣（rain 加速）
  // R58：料理增益（純讀取 adventure.r58.buffs，不建立新存檔欄位）
  function mealBuffs(state) { return (state && state.adventure && state.adventure.r58 && state.adventure.r58.buffs) || null; }
  function mealGrowthMul(state, now) { const buffs = mealBuffs(state); const g = buffs && buffs.growth; const t = Number.isFinite(now) ? now : 0; return g && Number.isFinite(g.until) && g.until > t && Number.isFinite(g.mul) && g.mul > 0 && g.mul < 1 ? g.mul : 1; }
  function mealOrderBonus(state, now) { const buffs = mealBuffs(state); const o = buffs && buffs.order; const t = Number.isFinite(now) ? now : 0; return o && Number.isFinite(o.until) && o.until > t && Number.isFinite(o.bonus) && o.bonus > 0 && o.bonus <= 1 ? o.bonus : 0; }
  function mealFlatBonus(state, kind, now) { const buffs = mealBuffs(state); const b = buffs && buffs[kind]; const t = Number.isFinite(now) ? now : 0; return b && Number.isFinite(b.until) && b.until > t && Number.isFinite(b.bonus) && b.bonus > 0 ? Math.floor(b.bonus) : 0; }
  function growthMultiplier(state, now) {
    let m = 1;
    const lv = state.upgrades.growthSpeed;
    if (lv > 0) m *= UPGRADES.growthSpeed.levels[lv - 1].value;
    const w = currentWeather(state, now);
    m *= WEATHER[w].growthMul;
    m *= buildingGrowthAura(state); // MVP2：堆肥場/蜂箱等建築的成長加成
    m *= mealGrowthMul(state, now); // R58：小麥胡蘿蔔煎餅的限時成長加速
    // R66B（第 6 項）：老農班伯請教種田的當日小加成（由 src/midgame-r66.js 寫入，成長時間 ×0.90）
    const r66Advice = state.adventure && state.adventure.r66b && state.adventure.r66b.adviceBuff;
    if (r66Advice && Number.isFinite(r66Advice.until) && r66Advice.until > (Number.isFinite(now) ? now : 0) && Number.isFinite(r66Advice.mul) && r66Advice.mul > 0 && r66Advice.mul < 1) m *= r66Advice.mul;
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
  function buildingMaxLevel(type) {
    const def = BUILDINGS[type];
    return def && Array.isArray(def.levels) && def.levels.length ? def.levels.length : 1;
  }
  function buildingLevel(building) {
    if (!building || !BUILDINGS[building.type]) return 0;
    const raw = Number.isFinite(building.level) ? Math.floor(building.level) : 1;
    return Math.max(1, Math.min(buildingMaxLevel(building.type), raw));
  }
  function buildingLevelData(building) {
    const def = building && BUILDINGS[building.type];
    if (!def) return null;
    if (!Array.isArray(def.levels) || !def.levels.length) {
      return { cost: def.cost || {}, effect: def.effect || {}, effectLabel: def.desc || "" };
    }
    return def.levels[buildingLevel(building) - 1] || def.levels[0];
  }
  function buildingEffect(building) {
    const level = buildingLevelData(building);
    return (level && level.effect) || {};
  }
  // 已蓋建築的成長光環連乘（compostHeap 0.90、beeBox 0.92…），同類型依 maxCount 封頂。
  function buildingGrowthAura(state) {
    let m = 1; const seen = {};
    for (const b of state.buildings || []) {
      const def = BUILDINGS[b.type];
      const effect = buildingEffect(b);
      if (def && effect.growthAura && effectBuildingAllowed(seen, b.type, def)) m *= effect.growthAura;
    }
    return m;
  }
  function buildingSeasonalBonus(state) {
    let bonus = 0; const seen = {};
    for (const b of state.buildings || []) {
      const def = BUILDINGS[b.type];
      const effect = buildingEffect(b);
      if (def && effect.seasonalSellBonus && effectBuildingAllowed(seen, b.type, def)) bonus += effect.seasonalSellBonus;
    }
    return bonus;
  }
  function buildingOrderXpBonus(state) {
    let bonus = 0; const seen = {};
    for (const b of state.buildings || []) {
      const def = BUILDINGS[b.type];
      const effect = buildingEffect(b);
      if (def && effect.orderXpBonus && effectBuildingAllowed(seen, b.type, def)) bonus += effect.orderXpBonus;
    }
    return bonus;
  }
  function effectiveGrowMs(state, cropId, now) {
    const c = CROPS[cropId];
    return Math.max(1000, Math.floor(c.growMs * growthMultiplier(state, now)));
  }
  const FARM_CARE = {
    /* R78B：三種各有取捨——勤澆水最快；施堆肥多收、有機會優質，但長得慢又要用堆肥；放著長慢一點，種 1 包回 2 包種子。 */
    water: { id: "water", name: "勤澆水", icon: "💧", growMul: 0.75 },
    compost: { id: "compost", name: "施堆肥", icon: "🍂", growMul: 1.25, yieldBonus: 1, qualityChance: 0.30 },
    natural: { id: "natural", name: "放著長", icon: "🌿", growMul: 1.20, seedBack: 2 },
  };
  function cropSeasonMultiplier(state, cropId, now) {
    const crop = CROPS[cropId];
    if (!crop || !crop.season) return 1;
    return crop.season === currentSeason(state, now) ? 0.85 : 1.15;
  }
  function plotGrowMs(state, plot, now) {
    let growMs = effectiveGrowMs(state, plot.cropId, now) * cropSeasonMultiplier(state, plot.cropId, now);
    const care = FARM_CARE[plot.careMode];
    if (care && care.growMul) growMs *= care.growMul;
    if (isWet(plot) && plot.careMode !== "water") growMs *= MOISTURE_MUL;
    return Math.max(1000, Math.floor(growMs));
  }
  // 此格本輪是否為濕土（澆水時間 >= 本輪種植時間）
  function isWet(plot) { return !!plot.cropId && (plot.wateredAt || 0) >= plot.plantedAt; }
  function getCropProgress(state, plot, now) {
    if (!plot.cropId) return { ready: false, ratio: 0, remainingMs: 0, stage: 0, wet: false };
    const growMs = plotGrowMs(state, plot, now);
    const elapsed = Math.max(0, now - plot.plantedAt);
    const ratio = Math.min(1, elapsed / growMs);
    const ready = elapsed >= growMs;
    // 5 階段：seed0 sprout1 small2 mature3 ready4
    const stage = ready ? 4 : Math.min(3, Math.floor(ratio * 4));
    return { ready, ratio, remainingMs: Math.max(0, growMs - elapsed), stage, wet: isWet(plot) };
  }
  /* R77A 第 3 項：三種照顧方式換到「這一株」身上各是幾秒成熟、收幾份。
   * 秒數用 plotGrowMs（季節、天氣、料理效果、澆水都在裡面），份數用跟 harvest 同一條算式（作物產量＋光性＋料理＋照顧方式），不另寫一份規則。 */
  function careDurationText(ms) {
    const sec = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    if (sec <= 60) return `${sec} 秒`;
    const minutes = Math.floor(sec / 60), rest = sec % 60;
    return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分鐘`;
  }
  function careChanceText(chance) {
    const tenth = Math.max(0, Math.min(10, Math.round((Number(chance) || 0) * 10)));
    return ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][tenth] + "成";
  }
  function careForecast(state, plotIndex, now) {
    const plot = state && Array.isArray(state.plots) ? state.plots[plotIndex] : null;
    const crop = plot && plot.cropId ? CROPS[plot.cropId] : null;
    if (!crop) return { ok: false, rows: [] };
    const t = Number.isFinite(now) ? now : Date.now();
    const sunlit = isSunlit(state, plotIndex, t);
    const light = Sunplay ? Sunplay.harvestEffects(state, plot, function () { return 1; }, sunlit) : { yieldBonus: sunlit ? SUNPATCH.harvestBonus : 0 };
    const baseQty = crop.yield + (light.yieldBonus || 0) + mealFlatBonus(state, "harvest", t);
    const compostHave = Math.max(0, Math.floor(Number(state.materials && state.materials.compost) || 0));
    const remainingByCare = {};
    for (const id of Object.keys(FARM_CARE)) {
      const growMs = plotGrowMs(state, Object.assign({}, plot, { careMode: id }), t);
      remainingByCare[id] = Math.max(0, plot.plantedAt + growMs - t);
    }
    const waterSeconds = Math.ceil((remainingByCare.water || 0) / 1000);
    const rows = Object.keys(FARM_CARE).map((id) => {
      const care = FARM_CARE[id];
      const growMs = plotGrowMs(state, Object.assign({}, plot, { careMode: id }), t);
      const remainingMs = remainingByCare[id];
      const seconds = Math.ceil(remainingMs / 1000);
      const qty = baseQty + (care.yieldBonus || 0);
      const applied = plot.careMode === id;
      const compostCost = id === "compost" && !applied ? 1 : 0;
      const timeText = remainingMs > 0 ? `約 ${careDurationText(remainingMs)}` : "現在就能收";
      const slowerSeconds = Math.max(0, seconds - waterSeconds);
      const compared = id === "water" ? (remainingMs > 0 ? "成熟" : "") : slowerSeconds > 0 ? `（比勤澆水慢 ${careDurationText(slowerSeconds * 1000)}）` : "（和勤澆水一樣快）";
      let text = `${care.name}：${timeText}${compared}・收 ${qty} 份`;
      if (care.qualityChance) text += `，${careChanceText(care.qualityChance)}機率優質`;
      if (id === "compost") text += applied ? "（堆肥已經施了）" : compostHave >= compostCost ? `（用 ${compostCost} 份堆肥，現有 ${compostHave}）` : `（要 ${compostCost} 份堆肥，現在沒有）`;
      if (care.seedBack) text += `，帶回 ${care.seedBack} 包種子`;
      return { id, name: care.name, growMs, remainingMs, seconds, slowerSeconds, timeText, qty, qualityChance: care.qualityChance || 0,
        seedBack: care.seedBack || 0, compostCost, compostHave, available: compostHave >= compostCost, selected: applied, text };
    });
    return { ok: true, plotIndex, cropId: crop.id, cropName: crop.name, selected: plot.careMode || "", rows };
  }
  /* R78B 第 1 項：第一株只教「種下、光來、收成」。照顧方式的介紹進度寫在存檔（flags.r78CareIntro），收過第一次才打開；還沒打開時一律用勤澆水。 */
  function careIntroOpen(state) { return !!(state && state.flags && state.flags.r78CareIntro === true); }
  function firstRoundCare(state) { return careIntroOpen(state) ? null : "water"; }
  /* R78B 第 3 項：彈窗裡那一行「這次為什麼選這個」。看限時訂單、祭典、種子與金幣，回傳這一株最適合哪一種；秒數與份數都用上面的預測，不另寫一份。 */
  function careAdvice(state, plotIndex, now) {
    const forecast = careForecast(state, plotIndex, now);
    if (!forecast.ok) return { ok: false, best: null, need: "none", text: "" };
    const t = Number.isFinite(now) ? now : Date.now(); const crop = CROPS[forecast.cropId];
    const row = (id) => forecast.rows.find((r) => r.id === id); const water = row("water"), compost = row("compost"), natural = row("natural");
    const have = Math.max(0, Math.floor(Number(state.storage && state.storage.items && state.storage.items[crop.id]) || 0));
    const rush = (state.orders || []).find((o) => { const left = o && Number.isFinite(o.expiresAt) ? o.expiresAt - t : -1; return left > 0 && o.wants && (o.wants[crop.id] || 0) > have && water.remainingMs <= left && (compost.remainingMs > left || natural.remainingMs > left); });
    if (rush) return { ok: true, best: "water", need: "rush", text: `限時訂單還差 ${rush.wants[crop.id] - have} 份${crop.name}：只有勤澆水趕得上。` };
    const f = state.adventure && state.adventure.r61 && state.adventure.r61.festival;
    const festival = !!(f && f.unlocked && Number.isFinite(f.endsAt) && f.endsAt > t && (f.startsAt || 0) <= t && (f.harvestCrop || "tomato") === crop.id);
    if (festival && compost.available) return { ok: true, best: "compost", need: "quality", text: `祭典正在收${crop.name}：施堆肥多收 ${FARM_CARE.compost.yieldBonus} 份，還有${careChanceText(FARM_CARE.compost.qualityChance)}機率優質。` };
    const packs = Math.max(0, Math.floor(Number((((((state.adventure || {}).r58 || {}).r59 || {}).seedPacks || {})[crop.id])) || 0));
    if (packs <= 0 && (Number(state.coins) || 0) < crop.seedCost * 2) return { ok: true, best: "natural", need: "seeds", text: `種子用完了，金幣也不夠再買：放著長會帶回 ${FARM_CARE.natural.seedBack} 包種子。` };
    return { ok: true, best: "water", need: "none", text: "手上沒有急單：想早點收選勤澆水，想省種子選放著長。" };
  }
  /* R80B：早市獎金不再是固定 6 金。畫面上第一張需要這項作物的訂單就是當下換算基準；
     複合訂單依各品項直售值分攤報酬，沒有相關訂單時才退回新手單的每份七倍直售價。 */
  function lightOrderUnitCoins(state, cropId, now) {
    const crop = CROPS[cropId];
    const liveOrders = ((state && state.orders) || []).length ? state.orders : (state ? previewMarketOrders(state, Number.isFinite(now) ? now : Date.now()) : []);
    const relevant = liveOrders.find((order) => order && order.wants && (order.wants[cropId] || 0) > 0 && (order.rewardCoins || 0) > 0);
    if (relevant) {
      const weights = Object.entries(relevant.wants || {}).map(([id, qty]) => ({ id, qty: Math.max(0, Number(qty) || 0), value: Math.max(1, Number((itemDefinition(id) || {}).sellValue) || 1) }));
      const totalWeight = weights.reduce((sum, row) => sum + row.qty * row.value, 0);
      const own = weights.find((row) => row.id === cropId);
      if (own && totalWeight > 0) return Math.max(1, Math.round((relevant.rewardCoins * own.value / totalWeight) * 100) / 100);
    }
    return Math.max(1, (crop ? crop.sellValue : 1) * 7);
  }
  function harvestedTotal(state) { return Object.values((state && state.stats && state.stats.harvested) || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0); }
  function lightDecisionKind(state) {
    if (harvestedTotal(state) <= 0) return "tutorial";
    const flags = (state && state.flags) || {}, count = Math.max(0, Number(flags.r79LightChoiceCount) || 0);
    const beam = Math.max(0, Number(state && state.sun && state.sun.spawned) || 0), last = Math.max(0, Number(flags.r79LightChoiceLastBeam) || 0);
    if (count === 0) return "market";
    return beam > 0 && beam - last >= 3 ? "order" : "plain";
  }
  /* R79B：光快落在已熟的那一格時，份數、陽光、等待秒數與限時獎金集中在這一個回傳值。
     第一輪只有教學；第二輪是老農班伯早市，之後每隔三道光再出現一次限時收購。 */
  function lightHarvestChoice(state, plotIndex, now) {
    const plot = state && Array.isArray(state.plots) ? state.plots[plotIndex] : null; const crop = plot && plot.cropId ? CROPS[plot.cropId] : null;
    if (!crop || !Sunplay) return { ok: false };
    const t = Number.isFinite(now) ? now : Date.now(); const sun = state.sun || {};
    const active = t >= (sun.startsAt || 0) && t < (sun.endsAt || 0);
    if (active || !(t < (sun.previewAt || 0)) || !(sun.previewPlots || []).includes(plotIndex)) return { ok: false };
    if (!getCropProgress(state, plot, t).ready) return { ok: false };
    const care = FARM_CARE[plot.careMode] || null; const base = crop.yield + mealFlatBonus(state, "harvest", t) + (care && care.yieldBonus || 0);
    const pure = function () { return 1; };
    const nowOut = Sunplay.harvestOutcome(state, plot, { rng: pure, exposedNow: false, caughtSunlight: 0, baseQty: base });
    const waitOut = Sunplay.harvestOutcome(state, plot, { rng: pure, exposedNow: true, caughtSunlight: 1, baseQty: base });
    const nowQty = nowOut.quantity, waitQty = waitOut.quantity;
    const nowSunlight = nowOut.sunlightTotal, waitSunlight = waitOut.sunlightTotal;
    const waitMs = Math.max(0, sun.previewAt - t), seconds = Sunplay.lightSecondsLeft ? Sunplay.lightSecondsLeft(sun, t) : Sunplay.secondsLeft(waitMs);
    const kind = lightDecisionKind(state), hasTradeoff = kind === "market" || kind === "order";
    const orderUnitCoins = lightOrderUnitCoins(state, crop.id, t);
    /* 陽光 2 點可以催熟 1 格；換算時以一份當下訂單作物計入。這個換算只用來平衡兩邊，
       畫面仍把陽光的實際用途寫成「可催熟 1 格」，不把它假裝成真的金幣。 */
    const sunlightUnitEquivalent = Math.max(0, waitSunlight - nowSunlight) / 2;
    const nowCoins = hasTradeoff ? Math.max(1, Math.round((Math.max(0, waitQty - nowQty) + sunlightUnitEquivalent) * orderUnitCoins)) : 0;
    const roundCoins = (value) => Math.round(value * 100) / 100;
    const nowValueCoins = roundCoins(nowQty * orderUnitCoins + nowCoins + nowSunlight / 2 * orderUnitCoins);
    const waitValueCoins = roundCoins(waitQty * orderUnitCoins + waitSunlight / 2 * orderUnitCoins);
    const valueGapRatio = hasTradeoff ? roundCoins(Math.abs(nowValueCoins - waitValueCoins) / Math.max(1, nowValueCoins, waitValueCoins)) : 0;
    const unitText = Number.isInteger(orderUnitCoins) ? String(orderUnitCoins) : orderUnitCoins.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    const sunlightUseText = waitSunlight >= 2 ? `可催熟 ${Math.floor(waitSunlight / 2)} 格` : waitSunlight > 0 ? "再 1 點可催熟 1 格" : "";
    /* R82C 第 3 項：早市（限時收購）兩邊都直接寫最後拿到什麼——現在收是幾份作物加幾金，等光是幾份作物加陽光、但錯過早市。
       不再在旁邊寫「訂單每份幾金」，那一句會被讀成「這幾金就是賣掉那幾份的錢」。 */
    const bonusName = kind === "market" ? "老農班伯早市" : "限時收購", missName = kind === "market" ? "早市" : "限時收購";
    const nowShort = `${nowQty} 份${crop.name}` + (nowSunlight > 0 ? `＋陽光 ${nowSunlight}` : "") + (nowCoins > 0 ? `＋${kind === "market" ? "早市" : "收購"} ${nowCoins} 金` : "");
    const waitShort = `${waitQty} 份${crop.name}` + (waitSunlight > 0 ? `＋陽光 ${waitSunlight}` : "") + `・錯過${missName}`;
    const nowText = hasTradeoff
      ? `現在收：${nowQty} 份${crop.name}` + (nowSunlight > 0 ? `＋陽光 ${nowSunlight}` : "") + (nowCoins > 0 ? `＋${bonusName} ${nowCoins} 金` : "")
      : `現在收：${nowQty} 份` + (nowSunlight > 0 ? `＋陽光 ${nowSunlight}` : "");
    const waitText = hasTradeoff
      ? `等光再收：${waitQty} 份${crop.name}` + (waitSunlight > 0 ? `＋陽光 ${waitSunlight}（${sunlightUseText}）` : "") + `，但錯過${missName}`
      : `等光再收：${waitQty} 份` + (waitSunlight > 0 ? `＋陽光 ${waitSunlight}（${sunlightUseText}）` : "");
    const tutorialText = `等光再收：等 ${seconds} 秒，${waitQty} 份＋陽光 ${waitSunlight}（現在收只有 ${nowQty} 份）`; /* R83C：跟田邊鈕同一種說法 */
    const helpText = kind === "tutorial" ? `按下後等 ${seconds} 秒，光到會自動收成` : "已選等光；光到了要自己收成";
    return { ok: true, plotIndex, cropId: crop.id, cropName: crop.name, kind, hasTradeoff, nowQty, waitQty, nowSunlight, waitSunlight,
      nowCoins, waitCoins: 0, orderUnitCoins, orderUnitText: unitText, sunlightUnitEquivalent, sunlightUseText, nowValueCoins, waitValueCoins, valueGapRatio,
      waitMs, seconds, nowText, waitText, nowShort, waitShort, tutorialText, helpText, text: hasTradeoff ? nowText + "｜" + waitText : tutorialText };
  }
  function queueLightHarvest(state, plotIndex, now) {
    const choice = lightHarvestChoice(state, plotIndex, now); if (!choice.ok) return { ok: false, reason: "unavailable" };
    if (!state.flags) state.flags = {};
    state.flags.r79WaitHarvest = { plotIndex, cropId: choice.cropId, previewAt: (state.sun && state.sun.previewAt) || 0, queuedAt: Number.isFinite(now) ? now : Date.now(), autoHarvest: choice.kind === "tutorial", recorded: false, choice };
    return { ok: true, choice };
  }
  function lightHarvestQueue(state) {
    const queued = state && state.flags && state.flags.r79WaitHarvest;
    if (!queued || !Number.isInteger(queued.plotIndex)) return null;
    const plot = state.plots && state.plots[queued.plotIndex];
    if (!plot || plot.cropId !== queued.cropId) { delete state.flags.r79WaitHarvest; return null; }
    return queued;
  }
  function clearLightHarvestQueue(state) { if (state && state.flags) delete state.flags.r79WaitHarvest; }
  function recordLightHarvestChoice(state, choice, waited) {
    if (!choice || !choice.hasTradeoff) return;
    if (!state.flags) state.flags = {};
    state.flags.r79LightChoiceCount = Math.max(0, Number(state.flags.r79LightChoiceCount) || 0) + 1;
    state.flags.r79LightChoiceLastBeam = Math.max(0, Number(state.sun && state.sun.spawned) || 0);
    state.flags.r79LightChoiceLastResult = waited ? "wait" : "now";
  }
  /* R81B：右下互動鈕直接讀選中田的狀態；未成熟時明寫「生長中」，不能先顯示收成。 */
  function facingPlotLabel(state, tile, now) {
    const plot = tile && tile.plotIndex != null && state && Array.isArray(state.plots) ? state.plots[tile.plotIndex] : null; const crop = plot && plot.cropId ? CROPS[plot.cropId] : null;
    if (!crop) return "";
    const t = Number.isFinite(now) ? now : Date.now();
    /* R82C 第 3 項：早市二選一時不先替玩家寫「等光再收」，跟 ui.js 選中田的大鈕同一種寫法。 */
    /* R84C 第 1 項：「等光再收」只寫在田邊動作列那一顆鈕；大鈕寫「等光・某某田」（跟面向田時同一種寫法）。 */
    if (getCropProgress(state, plot, t).ready) { const choice = lightHarvestChoice(state, tile.plotIndex, t); return choice.ok && !choice.hasTradeoff ? `等光・${crop.name}田` : `收成・${crop.name}田`; }
    return `生長中・${crop.name}田`;
  }
  // 澆水：對已種植、未成熟、本輪尚未澆過的格子澆水（一輪一次）
  function waterPlot(state, plotIndex, now) {
    const plot = state.plots[plotIndex];
    if (!plot || !plot.cropId) return { ok: false, reason: "empty" };
    if (getCropProgress(state, plot, now).ready) return { ok: false, reason: "ready" };
    if (isWet(plot)) return { ok: false, reason: "already_wet" };
    plot.wateredAt = now;
    if (Daily) Daily.record(state, "water", 1, now);
    const sun = sunBoostGrowth(state, plotIndex, now);
    return sun ? { ok: true, sun } : { ok: true };
  }

  // ---------- R79 招牌玩法：陽光光斑 ----------
  // 光斑只在主動遊玩時出現（離線不累積），落在 1–2 格田上；在光裡種、澆、收各有加成，每格每道光只算一次。
  const SUNPATCH = {
    /* R75A：種下第一株後立即預告，8 秒後落光。 */
    firstDelayMs: 8000,
    intervalMs: 40000,       // 兩道光之間
    sunnyIntervalMs: 28000,  // 晴朗天氣更常出現
    durationMs: 16000,       // 每道光停留時間
    firstDurationMs: 40000,  // R51：第一道光配合教學對話停久一點，玩家讀完對話仍看得到光
    maxPlots: 2,
    rainbowMaxPlots: 4,      // R85B：雨後虹光
    growthBoost: 0.3,        // 種／澆：立刻推進成長時間 30%
    growthBoostCapMs: 180000,
    harvestBonus: 1,         // 收成多 1 份
    xpBonus: 2,
    blockedWeather: { rain: true, storm: true, snow: true, fog: true },
    /* R84C 第 2 項：新存檔的前十分鐘（遊戲時鐘，從存檔建立算起；天氣還沒解鎖），兩道光之間最多等 20 秒，
       加上光前 8 秒預告也不超過 30 秒（R83 圖 37 曾寫等 86 秒）。十分鐘以後、或天氣解鎖以後照原本的 28／40 秒。 */
    earlyWindowMs: 10 * 60 * 1000,
    earlyGapMs: 20000,
    /* R85B 第 2 項：前十分鐘原本只看「存檔建立後過了多久」（牆上時間）。新存檔建立後停在開場、手機切到背景、玩幾分鐘就離開再回來，
       牆上時間一過十分鐘，玩家實際才玩幾分鐘就回到 40 秒一道光。連續玩的話四種尺寸都在 20 秒內；遊戲時鐘裡找得到的「新存檔等超過 20 秒」
       只有這一條，R84 圖 106（1366×600）的 29 秒等光最可能就是這樣（例如截圖換尺寸時沿用同一份存檔）。
       現在新存檔另外記「開著遊戲的時間」（每次更新最多記 2 秒，離線、切到背景不算），兩者任一還在十分鐘內都算前十分鐘。
       只有第一次更新時存檔建立不到一分鐘才記（新存檔）；舊存檔、測試擺好的存檔照舊只看牆上時間。 */
    earlyPlayStepCapMs: 2000,
    earlyNewSaveMs: 60000,
  };
  function earlyLightWindow(state, now) {
    if (!state || (Number(state.level) || 1) >= WEATHER_UNLOCK_LEVEL) return false;
    const born = Number(state.createdAt) || 0;
    if (born > 0 && now >= born && now - born < SUNPATCH.earlyWindowMs) return true;
    const sun = state.sun, played = sun && Number.isFinite(sun.earlyPlayMs) && sun.earlyPlayMs >= 0 ? sun.earlyPlayMs : -1;
    if (played < 0) return false;
    /* 往後推算（例如「這道光散掉那一刻」）：一分鐘內的推算照實加上去；更久的時間差當成離線，不算。 */
    const ahead = Math.max(0, now - (Number(sun.earlyLastAt) || now));
    return played + (ahead <= 60000 ? ahead : 0) < SUNPATCH.earlyWindowMs;
  }
  /* 每次 updateSunpatch 先記一次開著遊戲的時間。 */
  function trackEarlyPlay(state, sun, now) {
    if (!Number.isFinite(sun.earlyPlayMs)) {
      const born = Number(state.createdAt) || 0;
      sun.earlyPlayMs = born > 0 && now >= born && now - born < SUNPATCH.earlyNewSaveMs ? 0 : -1;
      sun.earlyLastAt = now;
      return;
    }
    if (sun.earlyPlayMs < 0 || sun.earlyPlayMs >= SUNPATCH.earlyWindowMs) { sun.earlyLastAt = now; return; }
    const step = Math.max(0, Math.min(SUNPATCH.earlyPlayStepCapMs, now - (Number(sun.earlyLastAt) || now)));
    sun.earlyPlayMs = Math.min(SUNPATCH.earlyWindowMs, sun.earlyPlayMs + step); sun.earlyLastAt = now;
  }
  function sunGapMs(state, now, interval) { return earlyLightWindow(state, now) ? Math.min(interval, SUNPATCH.earlyGapMs) : interval; }
  function ensureSunState(state) {
    const s = state.sun;
    if (!s || typeof s !== "object" || Array.isArray(s)) state.sun = { plots: [], startsAt: 0, endsAt: 0, nextAt: 0, used: [], introduced: false };
    const sun = state.sun;
    const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
    sun.startsAt = num(sun.startsAt); sun.endsAt = num(sun.endsAt); sun.nextAt = num(sun.nextAt);
    const okIndex = (i) => Number.isInteger(i) && i >= 0 && i < (state.plots || []).length;
    /* R85B 第 4 項：雨後虹光一次照 4 格（rainplay-r85.js），其餘的光照舊最多 2 格。 */
    sun.plots = Array.isArray(sun.plots) ? sun.plots.filter(okIndex).slice(0, sun.rainbow ? SUNPATCH.rainbowMaxPlots : SUNPATCH.maxPlots) : [];
    sun.used = Array.isArray(sun.used) ? sun.used.filter(okIndex) : [];
    sun.introduced = !!sun.introduced;
    if (!state.stats) state.stats = {};
    if (!Number.isFinite(state.stats.sunCatches) || state.stats.sunCatches < 0) state.stats.sunCatches = 0;
    if (Sunplay) Sunplay.normalize(state);
    return sun;
  }
  function sunpatchActive(state, now) {
    const sun = state && state.sun;
    return !!(sun && Array.isArray(sun.plots) && sun.plots.length && now >= (sun.startsAt || 0) && now < (sun.endsAt || 0));
  }
  function isSunlit(state, plotIndex, now) {
    if (!sunpatchActive(state, now)) return false;
    return state.sun.plots.includes(plotIndex) && !(state.sun.used || []).includes(plotIndex);
  }
  function sunpatchStatus(state, now) {
    const active = sunpatchActive(state, now);
    const sun = state.sun || {};
    return {
      active,
      plots: active ? sun.plots.filter((i) => !(sun.used || []).includes(i)) : [],
      remainingMs: active ? Math.max(0, sun.endsAt - now) : 0,
      durationMs: sun.durationMs || SUNPATCH.durationMs,
      nextInMs: !active && sun.nextAt ? Math.max(0, sun.nextAt - now) : 0,
      catches: (state.stats && state.stats.sunCatches) || 0,
      preview: !active && Array.isArray(sun.previewPlots) && sun.previewPlots.length > 0 && now < (sun.previewAt || 0),
      previewPlots: !active && now < (sun.previewAt || 0) ? sun.previewPlots.slice() : [],
      previewInMs: !active && now < (sun.previewAt || 0) ? sun.previewAt - now : 0,
      refractionsLeft: Sunplay ? Math.max(0, Sunplay.mirrorLimit(state) - (sun.refractions || 0)) : 0,
    };
  }
  // 挑選光斑落點：可收成 > 生長中且未澆 > 已澆生長中 > 空地；同分隨機。
  function pickSunPlots(state, now, rng) {
    const active = activePlotCount(state);
    const scored = [];
    for (let i = 0; i < Math.min(active, state.plots.length); i++) {
      const p = state.plots[i];
      let score = 1;
      if (p.cropId) {
        const prog = getCropProgress(state, p, now);
        score = prog.ready ? 4 : prog.wet ? 2 : 3;
      }
      scored.push({ i, score: score + rng() * 0.9 });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, SUNPATCH.maxPlots).map((x) => x.i).sort((a, b) => a - b);
  }
  // 每個畫面 tick 呼叫。回傳 { spawned, expired, first }，UI 依此播放提示。
  function updateSunpatch(state, now, rng) {
    const sun = ensureSunState(state);
    const random = typeof rng === "function" ? rng : Math.random;
    const out = { spawned: false, expired: false, first: false };
    trackEarlyPlay(state, sun, now);
    if (sun.plots.length && sun.plots.every((i) => (sun.used || []).includes(i))) {
      sun.plots = []; sun.used = []; sun.endsAt = now; sun.nextAt = now + 15000; sun.rainbow = false; out.expired = true;
      const queued = lightHarvestQueue(state); if (queued && queued.previewAt === sun.startsAt) clearLightHarvestQueue(state);
    }
    if (sun.plots.length && sun.endsAt && now >= sun.endsAt) {
      if (Sunplay) Sunplay.settleBeam(state, sun.plots.filter((i) => !(sun.used || []).includes(i)));
      sun.plots = []; sun.used = []; sun.rainbow = false; out.expired = true;
      const queued = lightHarvestQueue(state); if (queued && queued.previewAt === sun.startsAt) clearLightHarvestQueue(state);
    }
    if (sunpatchActive(state, now)) return out;
    const planted = (state.plots || []).some((p) => p && p.cropId) || ((state.stats && state.stats.plantCount) || 0) > 0;
    if (!planted) return out;
    if (!sun.nextAt) { sun.nextAt = now + SUNPATCH.firstDelayMs; return out; }
    // 離線回來：nextAt 遠在過去也只補一道光，不會連續觸發。
    const previewMs = Sunplay ? Sunplay.PREVIEW_MS : 0;
    if (now < sun.nextAt - previewMs) return out;
    const weather = currentWeather(state, now);
    const interval = weather === "sunny" ? SUNPATCH.sunnyIntervalMs : SUNPATCH.intervalMs;
    if (SUNPATCH.blockedWeather[weather]) { sun.previewPlots = []; sun.previewAt = 0; sun.nextAt = now + Math.round(interval / 2); return out; }
    if (!sun.previewPlots.length) {
      let planned = pickSunPlots(state, now, random);
      const firstWheat = (state.stats && state.stats.plantCount) === 1 ? (state.plots || []).findIndex((p) => p && p.cropId === "wheat") : -1;
      if (!(sun.spawned || 0) && firstWheat >= 0) {
        const emptyNeighbor = [firstWheat - 1, firstWheat + 1].find((i) => i >= 0 && i < activePlotCount(state) && state.plots[i] && !state.plots[i].cropId);
        if (emptyNeighbor != null) planned = [emptyNeighbor];
      }
      sun.previewPlots = planned; sun.previewAt = sun.nextAt; sun.refractions = 0; sun.refractionLimit = Sunplay ? Sunplay.mirrorLimit(state) : 1;
      out.previewed = true;
    }
    if (now < sun.nextAt) return out;
    const plots = sun.previewPlots.slice();
    if (!plots.length) { sun.nextAt = now + sunGapMs(state, now, interval); return out; }
    const dur = sun.spawned ? SUNPATCH.durationMs : SUNPATCH.firstDurationMs; sun.spawned = (sun.spawned || 0) + 1;
    sun.plots = plots; sun.previewPlots = []; sun.previewAt = 0; sun.used = []; sun.startsAt = now; sun.endsAt = now + dur; sun.durationMs = dur; sun.rainbow = false;
    sun.nextAt = now + dur + ((sun.spawned || 0) === 1 ? Math.min(interval, 15000) : sunGapMs(state, now + dur, interval));
    out.spawned = true;
    const queued = lightHarvestQueue(state);
    if (queued && queued.previewAt === sun.startsAt && !queued.autoHarvest && !queued.recorded) {
      recordLightHarvestChoice(state, queued.choice, true);
      queued.recorded = true;
    }
    if (!sun.introduced) { sun.introduced = true; out.first = true; }
    return out;
  }
  function markSunUsed(state, plotIndex) {
    if (!state.sun.used.includes(plotIndex)) state.sun.used.push(plotIndex);
    state.stats.sunCatches = (state.stats.sunCatches || 0) + 1;
    return Sunplay ? Sunplay.catchSun(state, plotIndex) : { gained: 0, exposure: null };
  }
  // 種／澆在光裡：把種植時間往前推，等同立刻長快一段。
  function sunBoostGrowth(state, plotIndex, now) {
    ensureSunState(state);
    if (!isSunlit(state, plotIndex, now)) return null;
    const plot = state.plots[plotIndex];
    if (!plot || !plot.cropId) return null;
    let growMs = effectiveGrowMs(state, plot.cropId, now);
    if (isWet(plot)) growMs = Math.max(1000, Math.floor(growMs * MOISTURE_MUL));
    const boostMs = Math.min(SUNPATCH.growthBoostCapMs, Math.round(growMs * SUNPATCH.growthBoost));
    const wet = isWet(plot);
    plot.plantedAt -= boostMs;
    if (wet && (plot.wateredAt || 0) < plot.plantedAt) plot.wateredAt = plot.plantedAt;
    const caught = markSunUsed(state, plotIndex);
    plot.sunGrown = true;
    return { kind: "growth", boostMs, sunlight: caught.gained || 0, bottleFull: !(caught.gained > 0) };
  }

  // ---------- 倉庫 ----------
  function storageCapacity(state) {
    const lv = state.upgrades.storageLevel;
    let cap = GAME.baseStorage + (lv > 0 ? UPGRADES.storageLevel.levels[lv - 1].value : 0);
    const seen = {};
    for (const b of state.buildings || []) { // MVP2：筒倉等建築加倉容
      const def = BUILDINGS[b.type];
      const effect = buildingEffect(b);
      if (def && effect.storageBonus && effectBuildingAllowed(seen, b.type, def)) cap += effect.storageBonus;
    }
    return cap;
  }
  function storageUsed(state) {
    return Object.values(state.storage.items).reduce((s, n) => s + (n || 0), 0)
      + Object.values(state.storage.quality || {}).reduce((s, n) => s + (n || 0), 0);
  }
  function addToStorage(state, cropId, qty) {
    const cap = storageCapacity(state);
    const free = Math.max(0, cap - storageUsed(state));
    const added = Math.min(qty, free);
    if (added > 0) state.storage.items[cropId] = (state.storage.items[cropId] || 0) + added;
    return { added, lost: qty - added };
  }
  function addQualityToStorage(state, cropId, qty) {
    if (!state.storage.quality) state.storage.quality = {};
    const free = Math.max(0, storageCapacity(state) - storageUsed(state));
    const added = Math.min(qty, free);
    if (added > 0) state.storage.quality[cropId] = (state.storage.quality[cropId] || 0) + added;
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
    /* 舊擷取存檔可能把目前等級門檻扣了兩次，留下負 xp；規則層先夾到 0，HUD 再夾一次，畫面與後續升級都不會倒退。 */
    state.xp = Math.max(0, (Number(state.xp) || 0) + (Number(amount) || 0));
    const before = state.level;
    state.level = levelFromXp(state.xp);
    if (before < 2 && state.level >= 2 && Array.isArray(state.orders) && state.orders.length) { ensureLv2OrderVariety(state, Date.now()); promoteOrderVariety(state); } // R68 整合：Lv 1 開張的第一批訂單在升到 Lv 2 時也換出第二種，不必等空出訂單格
    return state.level - before; // 升了幾級
  }
  function achievementBonus(state) {
    // 舊成就維持 +2% 售出；新內容可標 noBonus，避免內容收藏推高理論金幣上限。
    return Object.keys(state.achievements || {}).reduce((sum, id) => {
      const def = ACHIEVEMENTS[id];
      if (def && def.noBonus) return sum;
      return sum + (def && typeof def.bonus === "number" ? def.bonus : 0.02);
    }, 0);
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
    if ((TOWNSFOLK_LETTERS || []).length && (TOWNSFOLK_LETTERS || []).every((id) => read[id])) unlock("neighborLetters");
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
      const addReached = (id) => {
        if (!id) return;
        if (reached.indexOf(id) === -1) reached.push(id);
        recordSeasonReached(state, id);
      };
      addReached(SEASONS[fromIdx].id);
      const stepsToRecord = Math.min(advance, SEASONS.length);
      for (let step = 1; step <= stepsToRecord; step++) {
        const id = SEASONS[(fromIdx + step) % SEASONS.length].id;
        addReached(id);
      }
      if (advance >= SEASONS.length) for (const s of SEASONS) recordSeasonReached(state, s.id);
      const idx = (fromIdx + advance) % SEASONS.length;
      const skippedSeasonEvents = closeSkippedSeasonEvents(state, fromIdx, state.season.untilMs, advance, now);
      state.season = { id: SEASONS[idx].id, untilMs: state.season.untilMs + advance * duration };
      return { changed: true, advanced: advance, reached, skippedSeasonEvents };
    }
    recordSeasonReached(state, state.season.id);
    return { changed: false, advanced: 0, reached: [state.season.id] };
  }
  function updateSeason(state, now) {
    return advanceSeasonState(state, now).changed;
  }
  function seasonOrderBias(state, now) {
    if (state.level < (SEASON_UNLOCK_LEVEL || 6)) return null;
    const season = currentSeason(state, now);
    return (SEASON_ORDER_BIAS || {})[season] || null;
  }
  function seasonOrderBiasToast(state, now) {
    const bias = seasonOrderBias(state, now);
    return bias ? bias.toast : "";
  }
  function seasonBiasItems(state, now, pool) {
    const bias = seasonOrderBias(state, now);
    if (!bias) return [];
    const set = new Set(pool || []);
    return (bias.preferredItems || []).filter((id) => set.has(id));
  }
  function weightedSeasonPick(state, now, rng, pool) {
    if (!pool || !pool.length) return null;
    const bias = seasonOrderBias(state, now);
    const preferred = seasonBiasItems(state, now, pool);
    if (!bias || !preferred.length) return rngPick(rng, pool);
    const preferredSet = new Set(preferred);
    const weighted = [];
    const weight = Math.max(1, Math.floor(bias.weight || 1));
    for (const id of pool) {
      const n = preferredSet.has(id) ? weight : 1;
      for (let i = 0; i < n; i++) weighted.push(id);
    }
    return rngPick(rng, weighted);
  }
  function forcedSeasonPick(state, now, rng, pool) {
    const preferred = seasonBiasItems(state, now, pool);
    return preferred.length ? rngPick(rng, preferred) : weightedSeasonPick(state, now, rng, pool);
  }
  function ensureSeasonEventState(state) {
    if (!state.flags) state.flags = {};
    if (!state.flags.seasonEventsClaimed) state.flags.seasonEventsClaimed = {};
  }
  function seasonEventForSeason(season) {
    return Object.values(SEASON_EVENTS || {}).find((ev) => ev.season === season) || null;
  }
  function seasonCycleKey(season, cycleStartMs) {
    return season + ":" + Math.max(0, cycleStartMs || 0);
  }
  function closeSkippedSeasonEvents(state, fromIdx, fromUntilMs, advance, now) {
    const skipped = [];
    if (state.level < (SEASON_UNLOCK_LEVEL || 6) || !SEASON_DURATION_MS || advance <= 0) return skipped;
    ensureSeasonEventState(state);
    for (let step = 0; step < advance; step++) {
      const season = SEASONS[(fromIdx + step) % SEASONS.length].id;
      const ev = seasonEventForSeason(season);
      if (!ev) continue;
      const cycleStart = fromUntilMs - SEASON_DURATION_MS + step * SEASON_DURATION_MS;
      const cycleId = seasonCycleKey(season, cycleStart);
      if (state.flags.seasonEventsClaimed[cycleId]) continue;
      state.flags.seasonEventsClaimed[cycleId] = { eventId: ev.id, skippedAt: now, skipped: true };
      skipped.push({ cycleId, eventId: ev.id, season });
    }
    return skipped;
  }
  function seasonCycleId(state, now) {
    const season = currentSeason(state, now);
    const duration = SEASON_DURATION_MS || 0;
    let until = state.season && typeof state.season.untilMs === "number" ? state.season.untilMs : 0;
    if (state.level < (SEASON_UNLOCK_LEVEL || 6) || !duration || until <= 0) return season + ":0";
    if (now >= until) {
      const advance = Math.floor((now - until) / duration) + 1;
      until += advance * duration;
    }
    return seasonCycleKey(season, until - duration);
  }
  function requirementStatusForSeasonEvent(state, ev) {
    const items = (state.storage && state.storage.items) || {};
    const consumes = {};
    const missing = [];
    for (const [id, qty] of Object.entries(ev.requires || {})) {
      if ((items[id] || 0) < qty) missing.push({ id, need: qty, have: items[id] || 0 });
      else consumes[id] = qty;
    }
    if (ev.requiresSeasonCrop) {
      const seasonal = Object.values(CROPS).filter((c) => c.season === ev.season).map((c) => c.id);
      const chosen = seasonal.find((id) => (items[id] || 0) >= ev.requiresSeasonCrop);
      if (chosen) consumes[chosen] = ev.requiresSeasonCrop;
      else missing.push({ anySeasonCrop: ev.season, need: ev.requiresSeasonCrop, have: 0 });
    }
    if (ev.requiresAny) {
      const chosen = Object.entries(ev.requiresAny).find(([id, qty]) => (items[id] || 0) >= qty);
      if (chosen) consumes[chosen[0]] = chosen[1];
      else missing.push({ any: Object.keys(ev.requiresAny), need: 1, have: 0 });
    }
    return { ok: missing.length === 0, consumes, missing };
  }
  function seasonEventStatus(state, now) {
    ensureSeasonEventState(state);
    if (state.level < (SEASON_UNLOCK_LEVEL || 6)) return { unlocked: false, event: null, available: false, claimed: false, canClaim: false };
    const season = currentSeason(state, now);
    const ev = seasonEventForSeason(season);
    if (!ev) return { unlocked: true, event: null, available: false, claimed: false, canClaim: false };
    const cycleId = seasonCycleId(state, now);
    const claimed = !!state.flags.seasonEventsClaimed[cycleId];
    const req = requirementStatusForSeasonEvent(state, ev);
    return {
      unlocked: true,
      season,
      cycleId,
      eventId: ev.id,
      event: ev,
      available: !claimed,
      claimed,
      canClaim: !claimed && req.ok,
      consumes: req.consumes,
      missing: req.missing,
    };
  }
  function consumeItems(state, consumes) {
    for (const [id, qty] of Object.entries(consumes || {})) {
      state.storage.items[id] = (state.storage.items[id] || 0) - qty;
      if (state.storage.items[id] <= 0) delete state.storage.items[id];
    }
  }
  function waterAllDryPlots(state, now) {
    let watered = 0;
    const active = activePlotCount(state);
    for (let i = 0; i < Math.min((state.plots || []).length, active); i++) {
      if (waterPlot(state, i, now).ok) watered++;
    }
    return watered;
  }
  function claimSeasonEvent(state, eventId, now) {
    ensureSeasonEventState(state);
    const status = seasonEventStatus(state, now);
    const ev = status.event;
    if (!ev || (eventId && ev.id !== eventId)) return { ok: false, reason: "not_available" };
    if (status.claimed) return { ok: false, reason: "claimed", status };
    if (!status.canClaim) return { ok: false, reason: "requirements", status };
    consumeItems(state, status.consumes);
    const reward = ev.reward || {};
    const out = { ok: true, eventId: ev.id, cycleId: status.cycleId, xp: reward.xp || 0, coins: reward.coins || 0, collectibleId: reward.collectible || null, watered: 0, message: ev.done || ev.name };
    if (reward.coins) {
      state.coins += reward.coins;
      state.stats.totalCoinsEarned = (state.stats.totalCoinsEarned || 0) + reward.coins;
    }
    if (reward.xp) addXp(state, reward.xp);
    if (reward.waterAll) out.watered = waterAllDryPlots(state, now);
    if (reward.collectible) {
      if (!state.collections) state.collections = {};
      state.collections[reward.collectible] = true;
    }
    state.flags.seasonEventsClaimed[status.cycleId] = { eventId: ev.id, claimedAt: now };
    checkAchievements(state);
    return out;
  }
  function sellMultiplier(state, now) {
    const lv = state.upgrades.sellBonus;
    const bonus = lv > 0 ? UPGRADES.sellBonus.levels[lv - 1].value : 0;
    const w = currentWeather(state, now);
    return (1 + bonus + achievementBonus(state)) * WEATHER[w].sellMul;
  }
  // R64B（第 6 項）：鄰居第 2 段故事好處——只讀 neighbors-r61 寫入的已看紀錄，不新增存檔欄位。
  function r64bStoryBenefit(state, npcId) {
    const seen = state && state.adventure && state.adventure.r61b && state.adventure.r61b.seen;
    return !!(seen && Array.isArray(seen[npcId]) && seen[npcId].includes(1));
  }
  function sellUnitValue(state, itemId, now) {
    /* 作物、動物產品或日曬乾貨共用直售入口。 */
    const def = itemDefinition(itemId);
    const seasonMul = def && def.season && state.level >= (SEASON_UNLOCK_LEVEL || 6) && def.season === currentSeason(state, now) ? 1.15 + buildingSeasonalBonus(state) : 1;
    const r64bMul = r64bStoryBenefit(state, "merchant") ? 1.05 : 1; // R64B：蘿拉第 2 段故事——市集收購價多 5%
    return Math.max(1, Math.round((def ? def.sellValue : 0) * seasonMul * sellMultiplier(state, now) * r64bMul));
  }

  // ---------- 種植 / 收成 ----------
  function activePlotCount(state) {
    const lv = state.upgrades.plotCount;
    return lv > 0 ? UPGRADES.plotCount.levels[lv - 1].value : GAME.startPlots;
  }
  function plant(state, plotIndex, cropId, now, careMode) {
    const plot = state.plots[plotIndex];
    if (!plot) return { ok: false, reason: "no_plot" };
    if (plotIndex >= activePlotCount(state)) return { ok: false, reason: "locked_plot" };
    if (plot.cropId) return { ok: false, reason: "occupied" };
    if (!CROPS[cropId]) return { ok: false, reason: "unknown_crop" };
    const explicitCare = careMode !== undefined;
    const chosenCare = explicitCare && FARM_CARE[careMode] ? careMode : null;
    if (explicitCare && !chosenCare) return { ok: false, reason: "unknown_care" };
    if (chosenCare === "compost" && (!state.materials || (state.materials.compost || 0) < 1)) return { ok: false, reason: "no_compost" };
    const cost = CROPS[cropId].seedCost;
    const seedPacks = state.adventure && state.adventure.r58 && state.adventure.r58.r59 && state.adventure.r58.r59.seedPacks;
    const freeSeed = seedPacks && (seedPacks[cropId] || 0) > 0;
    if (!freeSeed && !isCropUnlocked(state, cropId)) return { ok: false, reason: "locked_crop" };
    if (!freeSeed && state.coins < cost) return { ok: false, reason: "no_coins" };
    if (freeSeed) seedPacks[cropId]--; else state.coins -= cost;
    if (chosenCare === "compost") state.materials.compost--;
    plot.cropId = cropId;
    if (Sunplay) Sunplay.resetPlot(plot);
    if (chosenCare) plot.careMode = chosenCare; else delete plot.careMode;
    delete plot.wateredAt;
    const r65TutorialHeadStart = cropId === "wheat"
      && state.stats.plantCount < 3
      && ["plant_wheat", "first_water", "first_harvest"].includes(state.story && state.story.questId)
      && !(state.adventure && state.adventure.claimed && state.adventure.claimed.c1_first_harvest);
    plot.plantedAt = now;
    // R75：第一道光要 8 秒才落下，教學小麥改成剛好 10 秒成熟（原本最少先長 5 秒，會比光早熟，追光教學被收成蓋過）。
    if (r65TutorialHeadStart) plot.plantedAt = now - Math.max(0, plotGrowMs(state, plot, now) - 10000);
    delete plot.sunGrown;
    state.stats.plantCount++;
    const sun = sunBoostGrowth(state, plotIndex, now);
    const care = chosenCare ? FARM_CARE[chosenCare] : null;
    return sun ? { ok: true, sun, usedSeedPack: freeSeed, careMode: chosenCare, care } : { ok: true, usedSeedPack: freeSeed, careMode: chosenCare, care };
  }
  function harvest(state, plotIndex, now, rng) {
    const plot = state.plots[plotIndex];
    if (!plot || !plot.cropId) return { ok: false, reason: "empty" };
    const prog = getCropProgress(state, plot, now);
    if (!prog.ready) return { ok: false, reason: "not_ready" };
    const crop = CROPS[plot.cropId];
    const firstHarvest = !Object.values(state.stats.harvested || {}).some((count) => count > 0);
    ensureSunState(state);
    const sunlit = isSunlit(state, plotIndex, now);
    const queuedLight = lightHarvestQueue(state);
    const waitedForLight = !!(sunlit && queuedLight && queuedLight.plotIndex === plotIndex && queuedLight.cropId === plot.cropId);
    const liveChoice = !sunlit ? lightHarvestChoice(state, plotIndex, now) : { ok: false };
    const resolvedChoice = waitedForLight ? queuedLight.choice : liveChoice.ok ? liveChoice : null;
    const mealBonus = mealFlatBonus(state, "harvest", now);
    const care = FARM_CARE[plot.careMode] || null;
    const lightEffect = Sunplay ? Sunplay.harvestEffects(state, plot, rng, sunlit) : { yieldBonus: sunlit ? SUNPATCH.harvestBonus : 0, quality: false, sunlight: 0 };
    const qty = crop.yield + (lightEffect.yieldBonus || 0) + mealBonus + (care && care.yieldBonus || 0);
    const xp = crop.xp + (sunlit ? SUNPATCH.xpBonus : 0);
    const quality = !!(lightEffect.quality || (care && care.qualityChance && (rng === undefined ? Math.random() : rng()) < care.qualityChance));
    let added, lost;
    if (lightEffect.guaranteedQuality) {
      const premium = addQualityToStorage(state, crop.id, 1); const normal = addToStorage(state, crop.id, Math.max(0, qty - 1));
      added = premium.added + normal.added; lost = premium.lost + normal.lost;
    } else {
      const stored = quality ? addQualityToStorage(state, crop.id, qty) : addToStorage(state, crop.id, qty); added = stored.added; lost = stored.lost;
    }
    state.stats.harvested[crop.id] = (state.stats.harvested[crop.id] || 0) + added;
    if (Daily && added > 0) Daily.record(state, "harvest", added, now);
    if (Heirloom) Heirloom.recordHarvest(state, crop.id, added, sunlit || plot.sunGrown === true);
    if (added > 0) recordDiscovery(state, crop.id, now);
    const leveled = addXp(state, xp);
    if (care && care.seedBack) {
      state.adventure = state.adventure || {};
      state.adventure.r58 = state.adventure.r58 || {};
      state.adventure.r58.r59 = state.adventure.r58.r59 || {};
      const packs = state.adventure.r58.r59.seedPacks = state.adventure.r58.r59.seedPacks || {};
      packs[crop.id] = Math.min(99, (packs[crop.id] || 0) + care.seedBack);
    }
    const traitSunlight = Sunplay && lightEffect.sunlight ? Sunplay.addSunlight(state, lightEffect.sunlight) : 0;
    plot.cropId = null; plot.plantedAt = 0; delete plot.wateredAt; delete plot.sunGrown; delete plot.careMode;
    delete plot.r75SunHits; delete plot.r75ShadeEligible; delete plot.r75SunOver;
    const caughtSunlight = sunlit ? (markSunUsed(state, plotIndex).gained || 0) : 0;
    const marketBonus = resolvedChoice && resolvedChoice.hasTradeoff && !waitedForLight ? resolvedChoice.nowCoins : 0;
    if (marketBonus > 0) { state.coins += marketBonus; state.stats.totalCoinsEarned = (state.stats.totalCoinsEarned || 0) + marketBonus; }
    if (queuedLight && queuedLight.plotIndex === plotIndex) clearLightHarvestQueue(state);
    if (!(queuedLight && queuedLight.recorded)) recordLightHarvestChoice(state, resolvedChoice, waitedForLight);
    if (sunlit) { if (!state.flags) state.flags = {}; state.flags.r79FirstLightHarvest = true; }
    /* R78B：收過第一次，第二輪種植才介紹三種照顧方式。 */
    if (state.flags && added > 0) state.flags.r78CareIntro = true;
    checkAchievements(state);
    const out = { ok: true, cropId: crop.id, added, lost, xp, leveled, quality, careMode: care && care.id, seedBack: care && care.seedBack || 0, marketBonus,
      lightChoice: resolvedChoice ? { kind: resolvedChoice.kind, waited: waitedForLight, autoHarvest: !!(queuedLight && queuedLight.autoHarvest), hasTradeoff: resolvedChoice.hasTradeoff, nowCoins: resolvedChoice.nowCoins } : null,
      feedback: added > 0 ? [{ kind: "harvest", target: "storage", plotIndex, text: `${crop.name} +${added}` }] : [] };
    if (leveled > 0) out.milestones = [milestoneCard("level_up", { level: state.level, state, now })];
    if (firstHarvest && added > 0) out.settlement = { kind: "first_harvest", coins: 0, xp, next: farmNextStepText(state, now, "把 2 份小麥交給老農班伯。") };
    if (sunlit || lightEffect.yieldBonus || lightEffect.source) out.sun = { kind: "harvest", bonus: lightEffect.yieldBonus || 0, sunlight: traitSunlight + caughtSunlight, bottleFull: sunlit && traitSunlight + caughtSunlight === 0, xpBonus: sunlit ? SUNPATCH.xpBonus : 0, source: lightEffect.source || "" };
    if (lightEffect.source) out.lightTrait = lightEffect;
    if (mealBonus) out.meal = { kind: "harvest", bonus: mealBonus };
    return out;
  }
  function harvestAll(state, now) {
    let totalAdded = 0, totalLost = 0, totalXp = 0, settlement = null; const perCrop = {};
    for (let i = 0; i < state.plots.length; i++) {
      const r = harvest(state, i, now);
      if (r.ok) { if (!settlement && r.settlement) settlement = r.settlement; totalAdded += r.added; totalLost += r.lost; totalXp += r.xp; perCrop[r.cropId] = (perCrop[r.cropId] || 0) + r.added; }
    }
    return { totalAdded, totalLost, totalXp, perCrop, settlement };
  }

  // Thumb action: a reachable, fully storable harvest; sunlight first, then distance.
  // skipPlotIndex：任務卡叫玩家留著等光的那一格（田上寫「先別收」），快速收成不算它；不傳就照舊全部算。
  function quickHarvestStatus(state, now, skipPlotIndex) {
    const room = storageCapacity(state) - storageUsed(state);
    const ready = state.map.tiles.filter((t) => t.plotIndex != null && t.plotIndex < activePlotCount(state) && t.plotIndex !== skipPlotIndex
      && state.plots[t.plotIndex].cropId && getCropProgress(state, state.plots[t.plotIndex], now).ready);
    const candidates = ready.filter((t) => room >= CROPS[state.plots[t.plotIndex].cropId].yield + (isSunlit(state, t.plotIndex, now) ? SUNPATCH.harvestBonus : 0));
    candidates.sort((a, b) => Number(isSunlit(state, b.plotIndex, now)) - Number(isSunlit(state, a.plotIndex, now))
      || (Math.abs(a.x - state.player.x) + Math.abs(a.y - state.player.y)) - (Math.abs(b.x - state.player.x) + Math.abs(b.y - state.player.y)));
    const tile = candidates.find((t) => planMoveTo(state, t.id));
    return { count: ready.length, tileId: tile ? tile.id : null, noRoom: ready.length > 0 && candidates.length === 0 };
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
    if (Daily) Daily.record(state, "sell", n, now);
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
    radish: [3, 7], bell_pepper: [2, 5], potato: [3, 7], sunflower: [2, 4], grapes: [2, 4], melon: [1, 2],
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
  const BEGINNER_ORDERS = [
    { id: "beginner_wheat_2", wants: { wheat: 2 }, npcId: "merchant", ttlOffsetMs: 0, flavor: "蘿拉想先試賣 2 份新鮮小麥。" },
    { id: "beginner_carrot_1", wants: { carrot: 1 }, npcId: "mayor", ttlOffsetMs: 3 * 60 * 1000, flavor: "鎮長想先收 1 份胡蘿蔔，替巡路的人添菜。" },
    { id: "beginner_wheat_3", wants: { wheat: 3 }, npcId: "child", ttlOffsetMs: 5 * 60 * 1000, flavor: "圖圖想準備 3 份小麥做野餐點心。" },
    { id: "beginner_carrot_2", wants: { carrot: 2 }, npcId: "child", ttlOffsetMs: 5 * 60 * 1000, flavor: "圖圖想準備 2 份胡蘿蔔做野餐點心。" },
    { id: "beginner_wheat_4", wants: { wheat: 4 }, npcId: "merchant", ttlOffsetMs: 10 * 60 * 1000, flavor: "蘿拉需要 4 份小麥補上市集貨架。" },
  ];
  const ORDER_NPC_IDS = ["mayor", "merchant", "elder", "child"];
  // R68B（第 4 項）：Lv 2 只解鎖小麥時的多樣性訂單（預告與首批共用同一份範本）。
  const LV2_WHEAT_ONLY_ORDER = { id: "r68_lv2_egg_1", wants: { egg: 1 }, npcId: "elder", flavor: "老農班伯想收 1 顆雞蛋，做一頓簡單的早餐。" };
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
    const firstDef = itemDefinition(firstId) || { name: firstId || "物資" };
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
  function firstDayChapterOne(state, now) {
    const story = state.story || {};
    const createdAt = Number.isFinite(state.createdAt) ? state.createdAt : now;
    return now - createdAt < 24 * 60 * 60 * 1000
      && (C.PROLOGUE_QUESTS || []).includes(story.questId || C.FIRST_QUEST);
  }
  function makeBeginnerOrder(template, now) {
    const firstId = Object.keys(template.wants)[0];
    const qty = template.wants[firstId];
    const def = itemDefinition(firstId);
    return {
      id: template.id, wants: Object.assign({}, template.wants), rarity: "common",
      // 新手單採固定單價，避免固定加成讓大單的每份報酬反而較低。
      rewardCoins: Number.isFinite(template.rewardCoins) ? template.rewardCoins : (def ? def.sellValue : 1) * 7 * qty, rewardXp: Math.max(2, Math.ceil(qty / 2)),
      createdAt: now, expiresAt: null, firstBatch: true,
      npcId: template.npcId, flavor: template.flavor,
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
    const wants = {}; let baseXp = 0, contractCoins = 0;
    const chosen = [];
    for (let k = 0; k < nKinds; k++) {
      let itemId; let guard = 0;
      do {
        const candidatePool = pool.filter((id) => chosen.indexOf(id) === -1);
        const pickPool = candidatePool.length ? candidatePool : pool;
        itemId = k === 0 ? forcedSeasonPick(state, now, rng, pickPool) : weightedSeasonPick(state, now, rng, pickPool);
        guard++;
      } while (chosen.includes(itemId) && guard < 10);
      chosen.push(itemId);
      const dryOrder = !!(Sunplay && Sunplay.driedDef(itemId));
      const [mn, mx] = dryOrder ? [1, 1] : (ORDER_QTY[itemId] || [2, 5]);
      const qty = rngInt(rng, mn, mx);
      wants[itemId] = (wants[itemId] || 0) + qty;
      const def = itemDefinition(itemId);
      // 每個品項先定出固定單價再乘數量，避免整單四捨五入造成大單單價倒掛。
      contractCoins += Math.max(1, Math.round((def ? def.sellValue : 0) * rarity.payMult * (dryOrder ? 1.3 : 1))) * qty;
      baseXp += (CROPS[itemId] ? (CROPS[itemId].orderXp || CROPS[itemId].xp) : Math.round((def ? def.sellValue : 0) * 0.6)) * qty;
    }
    const id = "order_" + idSeed;
    const xpBonus = buildingOrderXpBonus(state);
    return {
      id,
      wants,
      rarity: rarityId,
      rewardCoins: contractCoins,
      rewardXp: Math.max(1, Math.round(baseXp * 0.5 * rarity.xpMult * (1 + xpBonus))),
      expiresAt: now + GAME.orderTtlMs,
      npcId: orderNpcIdFor(id),
    };
  }
  // R35：市集開放前的預告卡直接用開放時第一批訂單的同一份範本（委託人、需求、報酬一字不差）。
  function previewMarketOrders(state, now) {
    // R62A：預告也只列玩家現在能買種子、種得出的作物，避免先出現胡蘿蔔單。
    const available = new Set(availableOrderItems(state));
    const preferredIds = available.has("carrot")
      ? ["beginner_wheat_2", "beginner_carrot_2", "beginner_carrot_1"]
      : ["beginner_wheat_2", "beginner_wheat_3", "beginner_wheat_4"];
    return preferredIds
      .map((id) => BEGINNER_ORDERS.find((template) => template.id === id))
      .filter(Boolean)
      .filter((template) => Object.keys(template.wants).every((id) => available.has(id)))
      .map((template) => { const order = makeBeginnerOrder(template, now); return Object.assign(order, { narrative: orderNarrative(state, order), lockNote: "" }); })
      .map((order, idx, rows) => {
        // R68B：Lv 2 只解鎖小麥時，預告與首批同樣換上雞蛋單（維持 R35 預告一字不差）。
        if ((state.level || 1) !== 2 || available.size >= 2 || order.id === "beginner_wheat_4" || idx !== rows.length - 2) return order;
        const egg = makeBeginnerOrder(LV2_WHEAT_ONLY_ORDER, now);
        return Object.assign(egg, { narrative: orderNarrative(state, egg), lockNote: "" });
      });
  }
  function marketPreviewAction(state) {
    if (state && state.adventure && state.adventure.claimed && state.adventure.claimed.c1_first_harvest) return { harvested: 2, target: "elder", label: "✓ 已交給老農班伯" };
    const harvested = Math.min(2, Math.max(0, Number(state && state.storage && state.storage.items && state.storage.items.wheat) || 0));
    return harvested < 2
      ? { harvested, target: "field", label: `交給老農班伯 2 份小麥（已收 ${harvested}/2）` }
      : { harvested, target: "elder", label: "交給老農班伯 2 份小麥（已收 2/2）" };
  }
  function orderCompletionMs(state, order) {
    let plots = 0, ms = 0;
    for (const [itemId, qty] of Object.entries(order.wants || {})) {
      const crop = CROPS[itemId];
      if (!crop) return Infinity;
      plots += Math.ceil(qty / crop.yield);
      ms = Math.max(ms, crop.growMs);
    }
    return plots <= activePlotCount(state) ? ms : Infinity;
  }
  // R67B（第 5 項）：Lv 2 同時出現的訂單至少兩位委託人、兩種物品，且一張 3 分鐘內做得完。
  // R68B（第 4 項）：只解鎖小麥時，第二張改為老農班伯要 1 顆雞蛋（起始雞舍可取得），不再放棄多樣性。
  // R68 整合：訂單面板預設只看得到前兩張；第二張與第一張同物同人時，把後面不同的訂單排到第二張，讓變化看得見。
  function promoteOrderVariety(state) {
    if (!Array.isArray(state.orders) || state.orders.length < 3) return;
    const sig = (o) => Object.keys(o.wants || {}).sort().join("+") + "@" + orderNpcIdFor(o);
    const first = sig(state.orders[0]);
    if (sig(state.orders[1]) !== first) return;
    const idx = state.orders.findIndex((o, i) => i > 1 && sig(o) !== first);
    if (idx > 1) state.orders.splice(1, 0, state.orders.splice(idx, 1)[0]);
  }
  function ensureLv2OrderVariety(state, now) {
    if ((state.level || 1) !== 2 || !Array.isArray(state.orders) || state.orders.length < 2) return;
    const available = availableOrderItems(state);
    if (available.length < 2) {
      const hasFallback = state.orders.some((order) => order.id === "r68_lv2_egg_1" || (order.wants && order.wants.egg));
      const hasWheat = state.orders.some((order) => order.wants && order.wants.wheat);
      if (!hasFallback && hasWheat) {
        for (let i = state.orders.length - 1; i >= 0; i--) {
          if (state.orders[i].id === "beginner_wheat_4") continue;
          state.orders[i] = makeBeginnerOrder(LV2_WHEAT_ONLY_ORDER, now);
          if (i > 1) state.orders.splice(1, 0, state.orders.splice(i, 1)[0]); // R68 整合：第二種訂單排在第二張，不被「再顯示」收起
          break;
        }
      }
      if (!state.orders.some((order) => orderCompletionMs(state, order) <= 3 * 60 * 1000)) {
        const idx = state.orders.findIndex((order) => order.id !== "r68_lv2_egg_1" && order.id !== "beginner_wheat_4");
        const quick = BEGINNER_ORDERS.find((row) => row.id === "beginner_wheat_2" && !state.orders.some((order) => order.id === row.id));
        if (idx >= 0 && quick) state.orders[idx] = makeBeginnerOrder(quick, now);
      }
      return;
    }
    const itemSet = () => new Set(state.orders.flatMap((order) => Object.keys(order.wants || {})));
    const npcSet = () => new Set(state.orders.map((order) => orderNpcIdFor(order)));
    const hasQuick = () => state.orders.some((order) => orderCompletionMs(state, order) <= 3 * 60 * 1000);
    if (itemSet().size >= 2 && npcSet().size >= 2 && hasQuick()) return;
    const replaceIndex = () => {
      for (let i = state.orders.length - 1; i >= 0; i--) if (state.orders[i].id !== "beginner_wheat_4") return i;
      return -1;
    };
    if (itemSet().size < 2 || npcSet().size < 2) {
      const items = itemSet(), npcs = npcSet();
      const present = new Set(state.orders.map((order) => order.id));
      const template = BEGINNER_ORDERS.find((row) => !present.has(row.id)
        && Object.keys(row.wants).every((id) => available.includes(id))
        && (Object.keys(row.wants).some((id) => !items.has(id)) || !npcs.has(row.npcId)));
      const idx = replaceIndex();
      if (idx >= 0 && template) state.orders[idx] = makeBeginnerOrder(template, now);
      else if (idx >= 0) {
        const extra = available.find((id) => !items.has(id));
        const npcId = ORDER_NPC_IDS.find((id) => !npcs.has(id)) || "mayor";
        if (extra) state.orders[idx] = makeBeginnerOrder({ id: "r67_lv2_" + extra, wants: { [extra]: 1 }, npcId }, now);
      }
    }
    if (npcSet().size < 2) {
      const npcs = npcSet();
      const other = ORDER_NPC_IDS.find((id) => !npcs.has(id) && (C.NPCS || {})[id]);
      const idx = replaceIndex();
      if (other && idx >= 0) state.orders[idx] = Object.assign({}, state.orders[idx], { npcId: other });
    }
    if (!hasQuick()) {
      const idx = replaceIndex();
      const quick = BEGINNER_ORDERS.find((row) => ["beginner_wheat_2", "beginner_carrot_1"].includes(row.id)
        && Object.keys(row.wants).every((id) => available.includes(id)) && !state.orders.some((order) => order.id === row.id));
      if (idx >= 0 && quick) state.orders[idx] = makeBeginnerOrder(quick, now);
    }
  }
  function refreshOrders(state, now, rng) {
    const marketUnlocked = !!(state.adventure && state.adventure.claimed && state.adventure.claimed.c1_first_harvest);
    if (!marketUnlocked) {
      state.orders = [];
      return state.orders;
    }
    // 移除過期訂單，補滿到 orderSlots
    state.orders = state.orders.filter((o) => o.firstBatch === true || o.expiresAt > now);
    let seed = (state.ordersSeededAt || 0);
    if (firstDayChapterOne(state, now) && (state.ordersSeededAt || 0) < 3) {
      const available = new Set(availableOrderItems(state));
      const preferredIds = available.has("carrot")
        ? ["beginner_wheat_2", "beginner_carrot_2", "beginner_carrot_1"]
        : ["beginner_wheat_2", "beginner_wheat_3", "beginner_wheat_4"];
      const selectedTemplates = preferredIds.map((id) => BEGINNER_ORDERS.find((template) => template.id === id))
        .filter((template) => template && Object.keys(template.wants).every((id) => available.has(id)));
      const kept = new Map();
      for (const order of state.orders) {
        if (order && selectedTemplates.some((template) => template.id === order.id)) kept.set(order.id, order);
      }
      state.orders = selectedTemplates.map((template) => kept.get(template.id) || makeBeginnerOrder(template, now));
      while (state.orders.length < GAME.orderSlots) {
        seed++;
        state.orders.push(makeOrder(state, now, rng, String(now) + "_" + seed));
      }
      state.ordersSeededAt = Math.max(state.ordersSeededAt || 0, 3);
      ensureLv2OrderVariety(state, now); promoteOrderVariety(state);
      return state.orders;
    }
    while (state.orders.length < GAME.orderSlots) {
      seed++;
      state.orders.push(makeOrder(state, now, rng, String(now) + "_" + seed));
    }
    state.ordersSeededAt = seed;
    ensureLv2OrderVariety(state, now); promoteOrderVariety(state);
    return state.orders;
  }
  function canFulfill(state, order) {
    return Object.entries(order.wants).every(([cropId, qty]) => (state.storage.items[cropId] || 0) + ((state.storage.quality || {})[cropId] || 0) >= qty);
  }
  function orderQualityBonus(state, order) {
    const total = Object.values(order.wants || {}).reduce((sum, qty) => sum + qty, 0);
    if (!total) return 0;
    const quality = Object.entries(order.wants || {}).reduce((sum, [id, qty]) => sum + Math.min(qty, ((state.storage || {}).quality || {})[id] || 0), 0);
    return Math.round(order.rewardCoins * 0.5 * quality / total);
  }
  // R36：訂單共用同一份庫存時，依面板（state.orders）順序保留物品。
  function orderAllocation(state, orders) {
    const remaining = Object.assign({}, (state.storage && state.storage.items) || {});
    for (const [id, qty] of Object.entries((state.storage && state.storage.quality) || {})) remaining[id] = (remaining[id] || 0) + qty;
    const storyReserved = {};
    for (const itemId of Object.keys(remaining)) { storyReserved[itemId] = Math.min(remaining[itemId] || 0, mainStoryReserve(state, itemId)); remaining[itemId] = Math.max(0, (remaining[itemId] || 0) - storyReserved[itemId]); }
    return (orders || state.orders || []).map((order) => {
      const missing = {}, items = {};
      for (const [itemId, qty] of Object.entries(order.wants || {})) {
        const stock = Math.max(0, (((state.storage && state.storage.items) || {})[itemId] || 0) + (((state.storage && state.storage.quality) || {})[itemId] || 0));
        const available = Math.max(0, remaining[itemId] || 0);
        const priorReserved = Math.max(0, stock - available), storyReserve = storyReserved[itemId] || 0;
        const short = Math.max(0, qty - available);
        if (short) missing[itemId] = short;
        items[itemId] = { required: qty, stock, available, priorReserved, storyReserve, missing: short };
      }
      const ready = Object.keys(missing).length === 0;
      if (ready) for (const [itemId, qty] of Object.entries(order.wants || {})) remaining[itemId] -= qty;
      return { orderId: order.id, ready, missing, items, remaining: Object.assign({}, remaining) };
    });
  }
  function orderAllocationFor(state, orderId) {
    return orderAllocation(state).find((row) => row.orderId === orderId) || null;
  }
  function orderGrowDurationText(itemId) {
    const crop = CROPS[itemId];
    if (!crop) return "";
    const seconds = Math.ceil(crop.growMs / 1000);
    if (seconds < 60) return `${seconds} 秒`;
    return seconds % 60 === 0 ? `${seconds / 60} 分鐘` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
  }
  function storyReserveTargetName(state, itemId) {
    if (itemId !== "wheat") return "主線";
    return state.adventure && state.adventure.claimed && state.adventure.claimed.c1_first_harvest ? "回家的第一餐" : "老農班伯";
  }
  // R69B（第 4 項）：訂單改成完整一句——這張要幾份、手上的為何保留、還要種幾格一次講清；保留原因分主線（給誰）與前面的訂單。
  function orderItemStatusText(state, order, itemId, itemNames) {
    const row = orderAllocationFor(state, order.id) || orderAllocation(state, [order])[0];
    const item = row && row.items ? row.items[itemId] : null;
    if (!item) return "缺少作物";
    const def = itemNames && itemNames[itemId] ? itemNames[itemId] : itemDefinition(itemId);
    const name = def ? def.name : itemId;
    if (!item.missing) return `這張要 ${item.required} 份${name}；手上有 ${item.stock} 份，夠交這張了`;
    const priorOrders = Math.max(0, item.priorReserved - item.storyReserve);
    let reason; if (item.storyReserve > 0 && priorOrders > 0) reason = item.available > 0 ? `你手上 ${item.stock} 份有 ${item.storyReserve} 份先留給${storyReserveTargetName(state, itemId)}、${priorOrders} 份先給前面的訂單` : `你手上 ${item.stock} 份先留給${storyReserveTargetName(state, itemId)}和前面的訂單`;
    else if (item.storyReserve > 0) reason = item.available > 0 ? `你手上 ${item.stock} 份有 ${item.storyReserve} 份先留給${storyReserveTargetName(state, itemId)}` : `你手上 ${item.stock} 份先留給${storyReserveTargetName(state, itemId)}`;
    else if (item.priorReserved > 0) reason = item.available > 0 ? `你手上 ${item.stock} 份有 ${item.priorReserved} 份先給前面的訂單` : `你手上 ${item.stock} 份先給前面的訂單了`;
    else if (item.stock > 0) reason = `你手上 ${item.stock} 份可以先交這張`;
    else reason = `你手上還沒有${name}`;
    const grow = CROPS[itemId] ? `所以還要再種 ${item.missing} 格（約 ${orderGrowDurationText(itemId)}）` : `所以還差 ${item.missing} 份${name}`;
    return `這張要 ${item.required} 份${name}；${reason}，${grow}`;
  }
  function orderAllocationText(state, order, itemNames) {
    const row = orderAllocationFor(state, order.id);
    if (!row) return "缺少作物";
    return Object.keys(row.items || {}).map((itemId) => orderItemStatusText(state, order, itemId, itemNames)).join("；");
  }
  function orderPriorityAdvice(state, order) {
    const wants = Object.keys((order && order.wants) || {});
    if (wants.length !== 1) return "";
    const itemId = wants[0];
    const peers = (state.orders || []).filter((row) => row && row.wants && row.wants[itemId]);
    if (peers.length < 2) return "";
    const first = peers.slice().sort((a, b) => a.wants[itemId] - b.wants[itemId] || String(a.id).localeCompare(String(b.id)))[0];
    return first.id === order.id ? "先交這張：需求較少，能先完成。" : "同樣需要這項作物，建議先交需求較少的訂單。";
  }
  function mainStoryReserve(state, itemId) {
    if (itemId === "wheat" && state.adventure) {
      const a = state.adventure;
      const mealReady = (a.claimed && a.claimed.c1_first_meal)
        || (a.meals && a.meals.rustic_bread > 0)
        || (a.byTarget && a.byTarget.cook && a.byTarget.cook.rustic_bread > 0);
      if (mealReady) return 0;
      if (a.claimed && a.claimed.c1_first_harvest) return 2;
    }
    const completed = (state.story && state.story.completed) || {};
    const delivered = completed.first_delivery || !!(state.adventure && state.adventure.claimed && state.adventure.claimed.c1_first_harvest);
    return itemId === "wheat" && !delivered ? 2 : 0;
  }
  function orderConsumesStoryReserve(state, order) {
    return Object.entries(order.wants || {}).some(([itemId, qty]) => {
      const reserve = mainStoryReserve(state, itemId);
      const have = (state.storage && state.storage.items[itemId]) || 0;
      return reserve > 0 && have >= qty && have - qty < reserve;
    });
  }
  function orderStoryImpact(state, order) {
    const parts = Object.entries(order.wants || {}).map(([itemId, qty]) => {
      const have = Math.max(0, (state.storage && state.storage.items && state.storage.items[itemId]) || 0);
      const remaining = Math.max(0, have - qty);
      const reserve = mainStoryReserve(state, itemId);
      const def = itemDefinition(itemId) || { name: itemId };
      return { itemId, itemName: def.name, remaining, storyNeed: reserve, risky: reserve > remaining };
    });
    const relevant = parts.find((part) => part.storyNeed > 0) || parts[0] || { remaining: 0, storyNeed: 0, risky: false };
    return {
      parts,
      remaining: relevant.remaining,
      storyNeed: relevant.storyNeed,
      risky: parts.some((part) => part.risky),
      text: `交付後剩 ${relevant.remaining} 份・「${state.adventure && state.adventure.claimed && state.adventure.claimed.c1_first_harvest ? "回家的第一餐" : "老農班伯的開市小麥"}」還需 ${relevant.storyNeed} 份`, // R60：交付開市小麥後保留的 2 份是做第一餐的麥餅，寫對任務名
      warning: parts.some((part) => part.risky) ? "交付後主線物資會不足，還要再收成。" : "",
    };
  }
  function orderMissingText(state, order) {
    const missing = Object.entries(order.wants || {}).map(([itemId, qty]) => {
      const short = Math.max(0, qty - ((state.storage && state.storage.items[itemId]) || 0));
      const def = itemDefinition(itemId) || { name: itemId };
      return short > 0 ? `${def.name} ×${short}` : "";
    }).filter(Boolean);
    return missing.length ? `還缺${missing.join("、")}` : "交付";
  }
  // R28 整合：訂單要的作物還沒解鎖時，直接說哪一級解鎖，不讓「去田裡」變成死路。
  function orderLockText(state, order) {
    const locked = Object.keys(order.wants || {}).map((itemId) => CROPS[itemId]).filter((crop) => crop && crop.unlockLevel > (state.level || 1));
    return locked.length ? locked.map((crop) => `${crop.name} Lv ${crop.unlockLevel} 解鎖`).join("、") : "";
  }
  // 刻意設計：訂單是固定契約價（rewardCoins/rewardXp 在生成當下就定了），不吃天氣 sellMul——
  // 天氣只影響「直售」（sellMultiplier）。避免訂單獎勵隨天氣忽高忽低，讓訂單成為穩定的收益來源。
  function orderPayout(state, order, now, qualityBonus) {
    const streakMul = 1 + Math.min(ORDER_STREAK_CAP, state.orderStreak * ORDER_STREAK_BONUS);
    const sellLv = state.upgrades.sellBonus;
    const sellBonus = sellLv > 0 ? UPGRADES.sellBonus.levels[sellLv - 1].value : 0;
    const coins = Math.round((order.rewardCoins + (qualityBonus || 0)) * (1 + sellBonus + achievementBonus(state)) * streakMul * (1 + mealOrderBonus(state, now)));
    const xp = Math.round(order.rewardXp * streakMul);
    return { coins, xp, streakMul, qualityBonus: qualityBonus || 0 };
  }
  function fulfillOrder(state, orderId, now, rng) {
    const idx = state.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return { ok: false, reason: "gone" };
    const order = state.orders[idx];
    const allocation = orderAllocationFor(state, orderId);
    if (!allocation || !allocation.ready) return { ok: false, reason: "reserved", missing: allocation ? allocation.missing : {} };
    const beforeLevel = state.level || 1;
    let qualityUsed = 0;
    const qualityBonus = orderQualityBonus(state, order);
    // 優質作物先交，剩餘數量再由一般作物補足。
    for (const [cropId, qty] of Object.entries(order.wants)) {
      const qHave = ((state.storage.quality || {})[cropId] || 0), qUse = Math.min(qty, qHave), normalUse = qty - qUse;
      qualityUsed += qUse;
      if (qUse) { state.storage.quality[cropId] -= qUse; if (state.storage.quality[cropId] <= 0) delete state.storage.quality[cropId]; }
      state.storage.items[cropId] = (state.storage.items[cropId] || 0) - normalUse;
      if (state.storage.items[cropId] <= 0) delete state.storage.items[cropId];
      if (isQualityItem(cropId)) state.stats.qualitySold = (state.stats.qualitySold || 0) + qty;
    }
    state.orderStreak++;
    const pay = orderPayout(state, order, now, qualityBonus);
    state.stats.qualitySold = (state.stats.qualitySold || 0) + qualityUsed;
    state.coins += pay.coins;
    state.stats.totalCoinsEarned += pay.coins;
    addXp(state, pay.xp);
    state.stats.fulfilledOrders++;
    if (order.id === "beginner_wheat_4" && state.adventure && state.adventure.firstChoice) { // R47：第一個選擇改用 4 份大單，選它就得再種一輪才能做餅，才是真的取捨
      state.adventure.firstChoice.orderCompleted = true;
      state.adventure.firstChoice.tracked = "meal";
    }
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
    const milestones = [];
    if ((state.level || 1) > beforeLevel) milestones.push(milestoneCard("level_up", { level: state.level, state, now }));
    return { ok: true, coins: pay.coins, xp: pay.xp, streakMul: pay.streakMul, qualityBonus: pay.qualityBonus, qualityUsed, story, milestones,
      feedback: [{ kind: "order", target: "coins", text: `+${pay.coins} 金`, amount: pay.coins }],
      settlement: { kind: "order", coins: pay.coins, xp: pay.xp, next: farmNextStepText(state, now, "查看新訂單，或把收益投入農場升級。") } };
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
  // R64B（第 6 項）：鎮長葛瑞第 2 段故事——開墾農地少付 5 金（只影響 plotCount 的實際應付金額）。
  function r64bUpgradeCost(state, key, next) {
    return next ? (key === "plotCount" && r64bStoryBenefit(state, "mayor") ? Math.max(0, next.cost - 5) : next.cost) : 0;
  }
  function canBuyUpgrade(state, key) {
    const next = nextUpgrade(state, key);
    return !!next && state.coins >= r64bUpgradeCost(state, key, next);
  }
  function upgradeShortfall(state, key) {
    const next = nextUpgrade(state, key);
    return next ? Math.max(0, next.cost - state.coins) : 0;
  }
  function upgradeCardInfo(state, key) {
    const def = UPGRADES[key], next = nextUpgrade(state, key);
    if (!def || !next) return { effect: def ? def.desc : "", nextStep: "已達最高等級。", reserveRisk: false, roundSeedCost: 0 };
    const lv = Math.max(0, Number(state.upgrades && state.upgrades[key]) || 0);
    const previous = lv > 0 ? def.levels[lv - 1].value : null;
    let effect = def.desc;
    if (key === "plotCount") effect = `開墾農地：+${next.value - activePlotCount(state)} 格田${lv === 0 ? "・附送胡蘿蔔種子 3 份，另附小麥種子包種滿所有空格" : "・附送小麥種子包種滿所有空格"}`;
    if (key === "growthSpeed") effect = `肥沃土壤：生長時間 −${Math.round((1 - next.value) * 100)}%`;
    if (key === "sellBonus") effect = `市集人脈：賣出與訂單收益 +${Math.round(next.value * 100)}%`;
    if (key === "storageLevel") effect = `擴建穀倉：容量增加 ${next.value - (previous || 0)} 格`;
    if (key === "helperLevel") effect = next.value.autoPlant ? "稻草人幫手：自動收成並補種" : "稻草人幫手：自動收成成熟作物";
    const shortfall = Math.max(0, next.cost - state.coins);
    const use = {
      plotCount: "田變多，每輪就能同時多種幾株作物", // R39 整合：不寫死格數，避免與上一行「+N 格田」矛盾
      growthSpeed: "縮短每輪作物等待時間",
      sellBonus: "提高每次出貨與訂單收入",
      storageLevel: "避免收成因倉庫已滿而浪費",
      helperLevel: "離線時也能持續處理成熟作物",
    }[key];
    const nextStep = shortfall > 0 ? `這項升級還差 ${shortfall} 金；${use}` : `可升級；${use}`;
    const seed = CROPS[state.selectedSeed] || CROPS.wheat;
    const roundSeedCost = activePlotCount(state) * seed.seedCost;
    return { effect, nextStep, reserveRisk: key === "plotCount" ? false : state.coins >= next.cost && state.coins - next.cost < roundSeedCost, roundSeedCost };
  }
  function seedPackStore(state) {
    if (!state.adventure) state.adventure = {};
    if (!state.adventure.r58) state.adventure.r58 = {};
    if (!state.adventure.r58.r59) state.adventure.r58.r59 = {};
    if (!state.adventure.r58.r59.seedPacks) state.adventure.r58.r59.seedPacks = {};
    return state.adventure.r58.r59.seedPacks;
  }
  function buyUpgrade(state, key) {
    const next = nextUpgrade(state, key);
    if (!next) return { ok: false, reason: "maxed" };
    const cost = r64bUpgradeCost(state, key, next);
    if (state.coins < cost) return { ok: false, reason: "no_coins" };
    state.coins -= cost;
    state.upgrades[key]++;
    // 開墾農地：補足 plots 陣列長度
    if (key === "plotCount") {
      const target = activePlotCount(state);
      while (state.plots.length < target) {
        state.plots.push({ id: "p" + String(state.plots.length + 1).padStart(2, "0"), cropId: null, plantedAt: 0 });
      }
      const r67Packs = seedPackStore(state);
      const r67Empty = state.plots.slice(0, target).filter((plot) => !plot.cropId).length;
      if (r67Empty > 0) r67Packs.wheat = Math.min(99, Math.max(0, r67Packs.wheat || 0) + r67Empty);
      if (state.upgrades[key] === 1) {
        const packs = seedPackStore(state);
        packs.carrot = Math.min(99, Math.max(0, packs.carrot || 0) + 3);
      }
    }
    return { ok: true, level: state.upgrades[key],
      feedback: [{ kind: "upgrade", target: "coins", text: `－${cost} 金`, amount: -cost }],
      settlement: { kind: "upgrade", coins: 0, xp: 0, next: "回到田地，試試升級後的效果。" } };
  }
  function resourceSnapshot(state) {
    return {
      coins: Number(state && state.coins) || 0,
      items: Object.assign({}, state && state.storage && state.storage.items),
    };
  }
  function resourceDeltaEvents(before, after) {
    const prev = before || { coins: 0, items: {} };
    const next = after || { coins: 0, items: {} };
    const events = [];
    const coinDelta = (Number(next.coins) || 0) - (Number(prev.coins) || 0);
    if (coinDelta) events.push({ target: "coins", delta: coinDelta, text: `${coinDelta > 0 ? "+" : "－"}${Math.abs(coinDelta)} 金` });
    const itemParts = [];
    const ids = new Set(Object.keys(prev.items || {}).concat(Object.keys(next.items || {})));
    ids.forEach((id) => {
      const delta = ((next.items || {})[id] || 0) - ((prev.items || {})[id] || 0);
      if (!delta) return;
      const def = itemDefinition(id) || { name: id };
      itemParts.push(`${delta > 0 ? "+" : "－"}${Math.abs(delta)} ${def.name}`);
    });
    if (itemParts.length) events.push({ target: "storage", text: itemParts.join("、"), changes: itemParts.length });
    return events;
  }
  function helperFlags(state) {
    const lv = state.upgrades.helperLevel;
    if (lv <= 0) return { autoHarvest: false, autoPlant: false };
    return UPGRADES.helperLevel.levels[lv - 1].value;
  }

  // ---------- 天氣 ----------
  function currentWeather(state, now) {
    /* R85B 第 4 項：新存檔的過雲雨（rainplay-r85.js 排程）下著的時候算雨天，天氣還沒解鎖也一樣；光斑照 blockedWeather 停下來。 */
    const shower = state && state.r85Rain;
    if (shower && shower.showerUntil > now && now >= (shower.showerStartedAt || 0)) return "rain";
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
  function canBuild(state, type) {
    const def = BUILDINGS[type];
    return !!def && buildingUnlocked(state, type) && canAffordCost(state, def.cost)
      && !buildingAtMaxCount(state, type) && (state.map.tiles || []).some((tile) => canBuildOn(state, tile));
  }
  function buildingCount(state, type) { return (state.buildings || []).filter((b) => b.type === type).length; }
  function buildingAtMaxCount(state, type) {
    const def = BUILDINGS[type];
    return !!(def && typeof def.maxCount === "number" && def.maxCount > 0 && buildingCount(state, type) >= def.maxCount);
  }
  function canBuildOn(state, tile) { return !!tile && tile.terrain === "grass" && !tile.object && !tile.buildingId && !tile.adventureSite && !tile.station && !tile.npc && !tile.structureId && !tile.blocked && !tile.event && !tile.forage; }
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
  function nextBuildingUpgrade(state, buildingId) {
    const building = (state.buildings || []).find((b) => b.id === buildingId);
    if (!building) return null;
    const def = BUILDINGS[building.type];
    const level = buildingLevel(building);
    const maxLevel = buildingMaxLevel(building.type);
    if (!def || level >= maxLevel) return null;
    const next = def.levels[level]; // level 是目前 1-based，剛好指向下一級的 0-based 索引
    return {
      building,
      fromLevel: level,
      level: level + 1,
      maxLevel,
      cost: next.cost || {},
      effect: next.effect || {},
      effectLabel: next.effectLabel || "",
      current: buildingLevelData(building),
    };
  }
  function upgradeBuilding(state, buildingId) {
    const building = (state.buildings || []).find((b) => b.id === buildingId);
    if (!building) return { ok: false, reason: "gone" };
    const next = nextBuildingUpgrade(state, buildingId);
    if (!next) return { ok: false, reason: "maxed", level: buildingLevel(building) };
    if (!canAffordCost(state, next.cost)) return { ok: false, reason: "cost", cost: next.cost };
    spendCost(state, next.cost);
    building.level = next.level;
    return Object.assign({ ok: true }, next, { building, current: buildingLevelData(building) });
  }

  // ---------- 動物 ----------
  function homeBuildingFor(state, animalType) {
    const homeType = ANIMALS[animalType].home;
    return (state.buildings || []).find((b) => b.type === homeType) || null;
  }
  function animalCapacity(state, buildingId) {
    const b = (state.buildings || []).find((x) => x.id === buildingId);
    if (!b) return 0;
    return buildingEffect(b).capacity || 0;
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
    // R66B（第 5 項）：雞舍餵食槽——每次收雞蛋多 1 顆（設施由 src/midgame-r66.js 提供）
    const r66EggBonus = a.type === "chicken" && (state.buildings || []).some((b) => b.type === "r66_feed_trough") ? 1 : 0;
    if (cycles <= 0) return { ok: false, reason: "not_ready" };
    const tier = qualityTierFor(animalAffinity(state, a, now));
    const productId = qualityProductId(def.product, tier);
    const { added, lost } = addToStorage(state, productId, cycles);
    a.lastProducedAt += cycles * def.produceMs;
    state.stats.collected[productId] = (state.stats.collected[productId] || 0) + added;
    if (added > 0) recordDiscovery(state, productId, now);
    if (added > 0) checkAchievements(state);
    if (r66EggBonus) { const extra = addToStorage(state, productId, r66EggBonus); if (extra.added > 0) { state.stats.collected[productId] = (state.stats.collected[productId] || 0) + extra.added; recordDiscovery(state, productId, now); } return { ok: true, product: productId, baseProduct: def.product, tier, added: added + extra.added, lost: lost + extra.lost, cycles, eggBonus: extra.added }; }
    return { ok: true, product: productId, baseProduct: def.product, tier, added, lost, cycles, eggBonus: 0 };
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
  // R36: sprite extends north from the footprint base; tiles whose foot point
  // (tile centre, 0.08 tile above the base, mirroring ui.js) lands inside the
  // square sprite rect are not walkable, so the player never stands on a roof.
  function isRoofBlocked(state, tile) {
    if (!tile) return false;
    const footX = tile.x + 0.5, footY = tile.y + 1 - 0.08;
    for (const s of (C.STRUCTURES || [])) {
      if (!s || !s.occlude) continue;
      const width = s.w + ((s.id === "shop" || s.id === "barn") ? 0.25 : 0);
      const left = s.x + s.w / 2 - width / 2, bottom = s.y + s.h, top = bottom - width;
      if (footX > left && footX < left + width && footY > top && footY < bottom) return true;
    }
    return false;
  }
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
    if (isRoofBlocked(state, tile)) return false;
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
    let bestSide = null;
    for (const [dx, dy] of dirs) {
      const nt = getTileXY(state, target.x + dx, target.y + dy);
      if (!nt || !isWalkable(state, nt)) continue;
      const p = bfsPath(state, fromId, nt.id);
      if (!p) continue;
      const side = target.npc ? (dx !== 0 ? 0 : 1) : 0;
      if (best === null || side < bestSide || (side === bestSide && p.length < best.path.length)) { best = { tileId: nt.id, path: p }; bestSide = side; }
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
    if (unlock.type === "side_quest_done") {
      const st = npcSideQuestStatus(state, unlock.npcId);
      return !!(st && st.completed);
    }
    if (unlock.type === "r58_first_harvest") { const harvested = (state.stats && state.stats.harvested) || {}; return Object.values(harvested).some((n) => (n || 0) > 0); }
    if (unlock.type === "r58_market_open") return !!((state.adventure || {}).claimed && state.adventure.claimed.c1_first_harvest);
    if (unlock.type === "r58_first_cook") { const adv = state.adventure || {}; const meals = adv.meals || {}; return ((adv.counts || {}).cook || 0) > 0 || Object.values(meals).some((n) => (n || 0) > 0); }
    if (unlock.type === "r58_first_personal") return !!((((state.adventure || {}).r58 || {}).personal || {}).completed || []).length;
    if (unlock.type === "building_owned") return buildingCount(state, unlock.id || unlock.building) > 0;
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
    if (q.id === "first_delivery") return !!(state.adventure && state.adventure.claimed && state.adventure.claimed.c1_first_harvest);
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
    const riverChapter = !!(state.adventure && state.adventure.claimed && state.adventure.claimed.c1_first_meal);
    if (!chapter1Done(state) && !riverChapter) return { ok: false, reason: "chapter", need: C.BRIDGE_COST };
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
    if (!chapter1Done(state) && !(state.adventure && state.adventure.claimed && state.adventure.claimed.c1_first_meal)) return bridgeTile(state);
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
    const nodes = (C.FORAGE_NODES || []).filter((n) => !n.starter).map((n) => Object.assign({ tile: forageTile(state, n.id) }, forageNodeStatus(state, n.id, now)));
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
    if (!node.starter && (!state.flags || !state.flags.bridgeRepaired)) return { ok: false, reason: "locked" };
    if (node.requiresFlag && !state.flags[node.requiresFlag]) return { ok: false, reason: "locked_deep" };
    if (!node.starter) state.flags.eastForageDiscovered = true;
    const story = syncStoryProgress(state, "discover_forage", now);
    return { ok: true, node, story };
  }
  function gatherForage(state, nodeId, now) {
    now = now || Date.now();
    const st = forageNodeStatus(state, nodeId, now);
    if (!st) return { ok: false, reason: "unknown" };
    if (!st.node.starter && (!state.flags || !state.flags.bridgeRepaired)) return { ok: false, reason: "locked" };
    if (!st.unlocked) return { ok: false, reason: "locked_deep" };
    if (!st.node.starter && !state.flags.eastForageDiscovered) return { ok: false, reason: "undiscovered" };
    if (!st.ready) return { ok: false, reason: "cooldown", readyAt: st.readyAt };
    const mealBonus = mealFlatBonus(state, "forage", now);
    const qty = (st.node.yield || 1) + mealBonus + (r64bStoryBenefit(state, "child") ? 1 : 0); // R64B：圖圖第 2 段故事——採集多拿 1 份
    const { added, lost } = addToStorage(state, st.node.itemId, qty);
    if (!state.flags.forageNodes) state.flags.forageNodes = {};
    state.flags.forageNodes[st.node.id] = now;
    state.stats.collected[st.node.itemId] = (state.stats.collected[st.node.itemId] || 0) + added;
    if (added > 0) recordDiscovery(state, st.node.itemId, now);
    const story = syncStoryProgress(state, "collect_forage", now);
    return { ok: true, node: st.node, item: st.item, added, lost, story, mealBonus };
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
  // 對話階段：start → ch1done → bridge → ch2done → ch3done → ch4done → ch5done → postscript
  function npcPhase(state) {
    if (chapter5Done(state)) return "postscript";
    if (allChapter5LettersRead(state)) return "ch5done";
    if (chapter4Done(state)) return "ch4done";
    if (chapter3Done(state)) return "ch3done";
    if (chapter2Done(state)) return "ch2done";
    if (state.flags && state.flags.bridgeRepaired) return "bridge";
    if (chapter1Done(state)) return "ch1done";
    return "start";
  }
  // R71（B-02）：委託台詞 2 變體選句——用該張委託的 createdAt 當種子取模，決定性選句，
  // 不引入 Math.random：同一張委託反覆開對話永遠同一句，offer/done 用同一索引成組。
  function npcFlavorLine(list, seed) {
    if (!Array.isArray(list) || !list.length) return "";
    return list[Math.abs(Math.floor(seed || 0)) % list.length];
  }
  // 回傳此 NPC 在目前階段要說的一段台詞（lineIdx 由 UI 傳入做循環）；若有進行中委託，
  // line 會換成委託台詞，並在回傳值附上 request 唯讀投影供 UI 判斷是否顯示交付按鈕。
  function npcDialogue(state, npcId, lineIdx) {
    const npc = (C.NPCS || {})[npcId]; if (!npc) return null;
    const order = ["postscript", "ch5done", "ch4done", "ch3done", "ch2done", "bridge", "ch1done", "start"];
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
      const itemName = (itemDefinition(itemId) || {}).name || itemId;
      const canDeliver = canFulfillNpcRequest(state, npcId);
      line = (req.flavorOffer || npcFlavorLine(cfg && cfg.flavorOffer, req.createdAt) || "……").replace("{item}", itemName + " x" + req.wants[itemId]);
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
    const itemId = forcedSeasonPick(state, now, rng, pool);
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
    // R71（B-02）：一般委託沒有自帶 flavorDone（支線/東林回報才有），用 createdAt 取模
    // 選 2 變體之一，跟 npcDialogue 的 flavorOffer 同種子同索引，offer/done 口吻成組。
    const doneCfg = (C.NPC_REQUESTS || {})[npcId];
    return { ok: true, coins: req.rewardCoins, xp: req.rewardXp, npcId, story,
      sideQuestId: req.sideQuestId || null,
      doneLine: req.flavorDone || npcFlavorLine(doneCfg && doneCfg.flavorDone, req.createdAt) || null };
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
    const def = itemDefinition(itemId);
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
      lightTrait: Sunplay ? Sunplay.traitInfo(c.id) : null,
      flavor: c.flavor || "", // R71：祖母手札；空字串＝該品項尚無手札，UI 不顯示該列
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
        flavor: f.flavor || "", // R71：祖母手札；空字串＝尚無手札，UI 不顯示該列
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
  function milestoneCard(type, data) {
    data = data || {};
    if (type === "chapter_one") return { kind: "milestone", type, title: "第一章完成", earned: "農場重新有了第一批收成", unlocked: "河畔復興與下一章故事", next: "前往河邊，看看等待修復的設施。" };
    if (type === "market_open") return { kind: "milestone", type, title: "市集開放", earned: "16 金與修繕建材", unlocked: "市集訂單與出貨看板", next: "照任務列去灶台做晚餐；訂單看板之後隨時可以接單。" };
    if (type === "level_up") {
      const level = data.level || 2;
      const names = levelUnlocks(level).map((entry) => entry.name);
      const unlockText = data.unlocked || (names.length ? names.join("、") : "這一級沒有新增項目");
      let guideApi = root.AdventureAPI;
      if (!guideApi && data.state && typeof module !== "undefined" && module.exports) guideApi = require("./adventure.js");
      const guide = data.state && guideApi && guideApi.guide ? guideApi.guide(data.state, data.now) : null;
      const next = data.state && guideApi && guideApi.nextFarmStep ? guideApi.nextFarmStep(data.state, data.now) : null;
      /* R76 整合：第一餐之後 nextFarmStep 只剩「去河邊看看釣台」這一句，之後每次升級都指向釣台；
         吃完第一餐後改讀目前的主線任務，跟任務卡說同一件事。 */
      let questNext = "";
      if (data.state && guideApi && guideApi.summary && (((data.state.adventure || {}).claimed || {}).c1_first_meal)) {
        const view = guideApi.summary(data.state, data.now); const quest = view && view.ok !== false ? view.currentQuest : null;
        if (quest && guide && guide.stepText) questNext = `${quest.name}（${guide.stepText}）`;
        else if (view && view.ok !== false && !quest) questNext = "主線都完成了，照自己的步調經營農場。";
      }
      return { kind: "milestone", type, title: `升到 Lv ${level}`, earned: `農場等級提升到 Lv ${level}`, unlocked: unlockText, unlocks: levelUnlockCards(level), next: questNext || (next && next.text) || data.actionLabel || (guide && guide.actionLabel) || "繼續目前任務" };
    }
    return null;
  }
  function farmNextStepText(state, now, fallback) {
    let guideApi = root.AdventureAPI;
    if (!guideApi && typeof module !== "undefined" && module.exports) guideApi = require("./adventure.js");
    if (state && guideApi && guideApi.nextFarmStep && !(((state.adventure || {}).claimed || {}).c1_first_meal)) {
      const next = guideApi.nextFarmStep(state, now);
      if (next && next.text) return next.text;
    }
    return fallback;
  }
  function levelUnlocks(level) {
    const rows = [];
    Object.values(CROPS || {}).forEach((crop) => {
      if (crop.unlockLevel === level) rows.push({ id: crop.id, name: `${crop.name}種子`, kind: "seed" });
    });
    Object.values(BUILDINGS || {}).forEach((building) => {
      if (building.unlockLevel === level) rows.push({ id: building.id, name: building.name, kind: "upgrade" });
    });
    const extras = {
      2: [{ id: "drying_rack", name: "農舍曬架：用 2 份作物與 1 點陽光製作乾貨", kind: "feature" }],
      3: [{ id: "sun_mirror_upgrade", name: "磨亮手鏡：每道光可折 2 次", kind: "feature" }],
      4: [{ id: "sun_bottle_upgrade", name: "大蓄光瓶：陽光上限可升到 8 點", kind: "feature" }],
      5: [{ id: "weather", name: "天氣變化", kind: "feature" }],
      6: [{ id: "seasons", name: "四季輪替與當季成長加速", kind: "feature" }],
    };
    rows.push(...(extras[level] || []));
    const seen = new Set();
    return rows.filter((entry) => { const key = entry.name; if (seen.has(key)) return false; seen.add(key); return true; });
  }
  /* R79C 第 3 項：升級卡逐項列出這一級解鎖的作物、設施、功能，各帶一個小圖示。
     天氣與四季還沒有專屬圖示：檔名先接好（content-r79/unlock-*.png），圖到了再加進 UNLOCK_ART_READY。 */
  const UNLOCK_ART = {
    drying_rack: "assets/generated/content-r75/drying_rack_full.png", sun_mirror_upgrade: "assets/generated/content-r75/sun_mirror.png",
    sun_bottle_upgrade: "assets/generated/content-r75/sun_jar.png", r66_beehive: "assets/generated/content-r66/beehive.svg",
    r66_herb_garden: "assets/generated/content-r66/herb-garden.svg", r66_feed_trough: "assets/generated/content-r66/feed-trough.svg",
    weather: "assets/generated/content-r79/unlock-weather.png", seasons: "assets/generated/content-r79/unlock-seasons.png",
  };
  /* R80 整合：天氣、四季的專屬圖示由 MUSE 補上（content-r79/unlock-weather.png、unlock-seasons.png）。 */
  const UNLOCK_ART_READY = ["drying_rack", "sun_mirror_upgrade", "sun_bottle_upgrade", "r66_beehive", "r66_herb_garden", "r66_feed_trough", "weather", "seasons"];
  /* R80C 第 6 項：天氣、四季的專屬圖還沒到之前，先用遊戲裡本來就在用的天氣、季節符號（資源列的天氣格、換季提示用的同一組），不再空著。 */
  const UNLOCK_MARK = { weather: (WEATHER && WEATHER.rain && WEATHER.rain.icon) || "", seasons: (SEASONS && SEASONS[0] && SEASONS[0].icon) || "" };
  function levelUnlockCards(level) {
    return levelUnlocks(level).map((entry) => {
      const icon = entry.kind === "seed" ? `assets/generated/r66/native/crop_${entry.id}-32.png` : UNLOCK_ART_READY.includes(entry.id) ? UNLOCK_ART[entry.id] : "";
      const building = BUILDINGS && BUILDINGS[entry.id];
      return { id: entry.id, name: entry.name, kind: entry.kind, icon, mark: icon ? "" : (building && building.emoji) || UNLOCK_MARK[entry.id] || "" };
    });
  }
  function unseenLevelUnlocks(state, surface) {
    const seen = state && state.flags && state.flags.unlocksSeen && Number(state.flags.unlocksSeen[surface]) || 1;
    const level = Math.max(1, Number(state && state.level) || 1);
    const rows = [];
    for (let lv = seen + 1; lv <= level; lv++) rows.push(...levelUnlocks(lv));
    return rows.filter((entry) => surface === "seeds" ? entry.kind === "seed" : true);
  }
  function markLevelUnlocksSeen(state, surface) {
    if (!state.flags) state.flags = {};
    if (!state.flags.unlocksSeen) state.flags.unlocksSeen = { seeds: 1, upgrades: 1 };
    state.flags.unlocksSeen[surface] = Math.max(1, Number(state.level) || 1);
    return state.flags.unlocksSeen[surface];
  }
  function createFeedbackQueue() {
    const waiting = [];
    let active = null;
    return {
      push(data) { if (data) waiting.push(data); return this.next(); },
      next() { if (!active && waiting.length) active = waiting.shift(); return active; },
      close() { active = null; return this.next(); },
      status() { return { active, queued: waiting.length }; },
    };
  }
  function interactionLabelForTile(state, tile, now) {
    if (!tile) return "互動";
    if (tile.plotIndex != null) {
      const plot = (state.plots || [])[tile.plotIndex];
      if (plot && plot.cropId && getCropProgress(state, plot, now || Date.now()).ready) {
        const crop = CROPS[plot.cropId];
        return `收成・${crop ? crop.name : "作物"}田`;
      }
      /* R77A 第 5 項：面前是開墾好的田時，把接下來按下去會做的事寫出來（空田＝種植、還沒澆水＝澆水），不再只寫「互動」。 */
      if (tile.plotIndex < activePlotCount(state)) {
        if (!plot || !plot.cropId) return "種植・空田";
        if (!isWet(plot)) { const crop = CROPS[plot.cropId]; return `澆水・${crop ? crop.name : "作物"}田`; }
      }
    }
    if (tile.npc) { const npc = (C.NPCS || {})[tile.npc]; return `交談・${npc ? npc.name : "鎮民"}`; }
    if (tile.station) { const station = (C.STATIONS || {})[tile.station]; return `使用・${station ? station.name : "設施"}`; }
    if (tile.structureId) { const structure = (C.STRUCTURES || []).find((row) => row.id === tile.structureId); return `使用・${structure ? structure.name : "建物"}`; }
    if (tile.forage) return "採集・東林採集點";
    return "互動";
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
      grandmaLetters: (LETTERS || []).filter((l) => l.unlock && /^r58_/.test(l.unlock.type || "")).map((l) => ({ id: l.id, title: l.title, from: l.from, unlocked: !!(((state.mail || {}).unlocked || {})[l.id]), read: !!(((state.mail || {}).read || {})[l.id]) })),
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
      const def = itemDefinition(id) || { name: id };
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
      const pay = orderPayout(state, order, now);
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
    summary.skippedSeasonEvents = seasonCatchup.skippedSeasonEvents || [];

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
    quickHarvestStatus,
    rngInt, rngPick, unlockedCrops, isCropUnlocked, unlockedProducts, unlockedForageItems, availableOrderItems,
    growthMultiplier, buildingGrowthAura, buildingMaxLevel, buildingLevel, buildingLevelData, buildingEffect,
    nextBuildingUpgrade, upgradeBuilding, effectiveGrowMs, cropSeasonMultiplier, plotGrowMs, FARM_CARE, careForecast, careDurationText, careIntroOpen, firstRoundCare, careAdvice,
    lightOrderUnitCoins, lightHarvestChoice, queueLightHarvest, lightHarvestQueue, clearLightHarvestQueue, facingPlotLabel, isWet, waterPlot,
    getCropProgress, storageCapacity, storageUsed, addToStorage, addQualityToStorage, ensureDiscoveryState, recordDiscovery, firstDiscoveredAt, addXp,
    achievementBonus, checkAchievements, sellMultiplier, sellUnitValue, buildingSeasonalBonus, buildingOrderXpBonus,
    activePlotCount, plant, harvest, harvestAll, sellItem, sellAll,
    orderNarrative,
    seasonOrderBias, seasonOrderBiasToast, seasonBiasItems, seasonCycleId, seasonEventStatus, claimSeasonEvent,
    makeOrder, refreshOrders, previewMarketOrders, marketPreviewAction, canFulfill, orderQualityBonus, orderAllocation, orderAllocationFor, orderAllocationText, orderItemStatusText, mainStoryReserve, orderConsumesStoryReserve, orderStoryImpact, orderMissingText, orderLockText, orderPayout, fulfillOrder, trashOrder,
    upgradeMaxLevel, nextUpgrade, canBuyUpgrade, upgradeShortfall, upgradeCardInfo, buyUpgrade, resourceSnapshot, resourceDeltaEvents, helperFlags, orderPriorityAdvice,
    currentWeather, updateWeather, runHelperOnline, applyOffline,
    farmSeason, farmActionSuggestions, offlineForageRefreshes,
    // MVP2：建材 / 地圖 / 建築 / 動物
    canAffordCost, spendCost, grantMaterials, getTile, clearObstacle,
    buildingUnlocked, canBuild, buildingCount, buildingAtMaxCount, canBuildOn, buildBuilding,
    homeBuildingFor, animalCapacity, animalsInHome, isAnimalUnlocked,
    addAnimal, buyAnimal, animalProgress, collectAnimal, collectAllAnimals, collectHome, feedAnimal,
    // 可走動地圖：尋路 / 目標解析
    getTileById, getTileXY, isWalkable, isRoofBlocked, bfsPath, pathToAdjacent, planMoveTo, facingTo, plotOfTile,
    // Stage 4：多格結構 / 故事任務
    structureAt, planMoveToStructure, currentQuest, syncStoryProgress, advanceStory, questMarkerTile,
    // Stage 5：世界探索（橋 / 封鎖區 / 事件點）
    bridgeTile, eventTile, chapter1Done, chapter2Done, chapter3Done, chapter4Done, chapter5Done, milestoneCard, levelUnlocks, unseenLevelUnlocks, markLevelUnlocksSeen, createFeedbackQueue, interactionLabelForTile,
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
    // R79：陽光光斑
    SUNPATCH, ensureSunState, sunpatchActive, isSunlit, sunpatchStatus, updateSunpatch, earlyLightWindow,
  };
  if (typeof window !== "undefined") Object.assign(window, GameAPI, { Game: GameAPI });
  if (typeof module !== "undefined" && module.exports) module.exports = GameAPI;
})(typeof window !== "undefined" ? window : globalThis);
