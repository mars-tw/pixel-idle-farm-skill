/* =========================================================================
 * sunplay-r75.js — R75A 追光、作物光性、蓄光瓶與曬架
 * 純規則可由 Node 測試；瀏覽器端只加 R75A 專屬介面。
 * ========================================================================= */
(function (root) {
  const C = (typeof module !== "undefined" && module.exports) ? require("./config.js") : root;
  const PREVIEW_MS = 8000;
  const DRYING_MS = 30000;
  /* R77A 第 4 項：曬到一半（第 15 秒）起有 10 秒可以翻面，翻了多收 1 份；錯過照常曬好、不扣。 */
  const FLIP_WINDOW_MS = 10000;
  const TRAITS = {
    wheat: "sun", tomato: "sun", corn: "sun", sunflower: "sun", melon: "sun",
    carrot: "partial", potato: "partial", pumpkin: "partial", strawberry: "shade",
  };
  const TRAIT_INFO = {
    sun: { icon: "☀", name: "喜光", text: "光裡收成會多 1 份，並把陽光收進蓄光瓶。" },
    partial: { icon: "◐", name: "半日照", text: "生長時照到剛好一次，收成保證 1 份優質；第二次起曬過頭。" },
    shade: { icon: "☂", name: "耐陰", text: "全程沒照光，收成時優質機率增加 35%。" },
    neutral: { icon: "◇", name: "一般", text: "沒有特殊光性。" },
  };
  const DRIED = {
    sun_wheat: { id: "sun_wheat", cropId: "wheat", name: "日曬麥穗", icon: "assets/generated/content-r75/item-sun_wheat.png" },
    sun_carrot: { id: "sun_carrot", cropId: "carrot", name: "胡蘿蔔乾", icon: "assets/generated/content-r75/item-sun_carrot.png" },
    sun_tomato: { id: "sun_tomato", cropId: "tomato", name: "番茄乾", icon: "assets/generated/content-r75/item-sun_tomato.png" },
    sun_strawberry: { id: "sun_strawberry", cropId: "strawberry", name: "草莓乾", icon: "assets/generated/content-r75/item-sun_strawberry.png" },
  };

  function integer(value, fallback) { return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback; }
  /* R76C 追光手冊：集章里程碑給的永久加成（蓄光瓶容量、手鏡折光次數），存在 state.sunbook.bonus。 */
  function sunbookBonus(state, key, max) { const bonus = state && state.sunbook && state.sunbook.bonus; const n = bonus ? Math.floor(bonus[key]) : 0; return n > 0 ? Math.min(max, n) : 0; }
  function normalize(state) {
    if (!state || typeof state !== "object") return state;
    const old = state.r75Sunplay && typeof state.r75Sunplay === "object" ? state.r75Sunplay : {};
    state.r75Sunplay = {
      sunlight: Math.min((integer(old.bottleLevel, 0) > 0 ? 8 : 5) + sunbookBonus(state, "jar", 2), integer(old.sunlight, 0)),
      mirrorLevel: integer(old.mirrorLevel, 0) > 0 ? 1 : 0,
      bottleLevel: integer(old.bottleLevel, 0) > 0 ? 1 : 0,
      firstRefracted: !!old.firstRefracted,
      firstCaught: !!old.firstCaught,
      firstRipened: !!old.firstRipened,
      rack: normalizeRack(old.rack),
    };
    if (!state.storage) state.storage = { items: {}, quality: {} };
    if (!state.storage.items) state.storage.items = {};
    if (!state.sun || typeof state.sun !== "object") state.sun = {};
    const sun = state.sun;
    sun.previewPlots = Array.isArray(sun.previewPlots) ? sun.previewPlots.filter(Number.isInteger).slice(0, 2) : [];
    sun.previewAt = integer(sun.previewAt, 0);
    sun.refractions = integer(sun.refractions, 0);
    sun.refractionLimit = integer(sun.refractionLimit, mirrorLimit(state));
    return state;
  }
  function normalizeRack(rack) {
    rack = rack && typeof rack === "object" ? rack : {};
    return { cropId: typeof rack.cropId === "string" ? rack.cropId : null, itemId: typeof rack.itemId === "string" ? rack.itemId : null,
      startedAt: integer(rack.startedAt, 0), readyAt: integer(rack.readyAt, 0), ready: !!rack.ready,
      /* R77A：翻面的時間點（0＝沒翻）。跟著存檔走，重新載入後接續。 */
      flippedAt: typeof rack.cropId === "string" ? integer(rack.flippedAt, 0) : 0 };
  }
  function bottleCapacity(state) { normalize(state); return (state.r75Sunplay.bottleLevel ? 8 : 5) + sunbookBonus(state, "jar", 2); }
  function mirrorLimit(state) { return (state && state.r75Sunplay && state.r75Sunplay.mirrorLevel ? 2 : 1) + sunbookBonus(state, "mirror", 1); }
  function sunlight(state) { normalize(state); return state.r75Sunplay.sunlight; }
  function addSunlight(state, amount) {
    normalize(state); const before = state.r75Sunplay.sunlight; const cap = bottleCapacity(state);
    state.r75Sunplay.sunlight = Math.min(cap, before + Math.max(0, integer(amount, 0)));
    if (state.r75Sunplay.sunlight > before) state.r75Sunplay.firstCaught = true;
    return state.r75Sunplay.sunlight - before;
  }
  function spendSunlight(state, amount) {
    normalize(state); const cost = integer(amount, 0); if (state.r75Sunplay.sunlight < cost) return false;
    state.r75Sunplay.sunlight -= cost; return true;
  }
  function trait(cropId) { return TRAITS[cropId] || "neutral"; }
  function traitInfo(cropId) { const id = trait(cropId); return Object.assign({ id }, TRAIT_INFO[id]); }
  function resetPlot(plot) { if (!plot) return; plot.r75SunHits = 0; plot.r75ShadeEligible = true; delete plot.r75SunOver; }
  function recordExposure(state, plotIndex) {
    normalize(state); const plot = (state.plots || [])[plotIndex]; if (!plot || !plot.cropId) return null;
    plot.r75SunHits = integer(plot.r75SunHits, 0) + 1; plot.r75ShadeEligible = false;
    if (trait(plot.cropId) === "partial" && plot.r75SunHits > 1) plot.r75SunOver = true;
    return { cropId: plot.cropId, hits: plot.r75SunHits, over: !!plot.r75SunOver };
  }
  function settleBeam(state, plotIndexes) { return (plotIndexes || []).map((i) => recordExposure(state, i)).filter(Boolean); }
  function harvestEffects(state, plot, rng, exposedNow) {
    normalize(state); const kind = trait(plot && plot.cropId); const hits = integer(plot && plot.r75SunHits, 0) + (exposedNow ? 1 : 0);
    const effect = { yieldBonus: 0, guaranteedQuality: false, qualityBonusChance: 0, sunlight: 0, source: "" };
    if (kind === "sun" && (plot.sunGrown === true || hits > 0)) { effect.yieldBonus = 1; effect.sunlight = 1; effect.source = "喜光豐收"; }
    if (kind === "partial" && hits === 1) { effect.guaranteedQuality = true; effect.source = "半日照優質"; }
    if (kind === "partial" && hits > 1) effect.source = "半日照曬過頭";
    if (kind === "shade" && hits === 0 && plot.r75ShadeEligible !== false) { effect.qualityBonusChance = 0.35; effect.source = "陰涼熟成"; }
    effect.quality = effect.guaranteedQuality || (effect.qualityBonusChance > 0 && (typeof rng === "function" ? rng() : Math.random()) < effect.qualityBonusChance);
    return effect;
  }
  /* R79B：收成份數與陽光只在這裡合成一次。baseQty 由 game.js 傳入（已含料理與照顧方式），
     caughtSunlight 是玩家在光裡親手收成接住的 1 點；瓶子剩餘空間也在這裡扣，所有畫面因此拿到實際總數。 */
  function harvestOutcome(state, plot, options) {
    const opts = options || {}, effect = harvestEffects(state, plot, opts.rng, opts.exposedNow === true);
    const baseQty = Math.max(0, integer(opts.baseQty, 0));
    const room = Math.max(0, bottleCapacity(state) - sunlight(state));
    const traitSunlight = Math.max(0, integer(effect.sunlight, 0));
    const caughtSunlight = Math.max(0, integer(opts.caughtSunlight, 0));
    const sunlightTotal = Math.min(room, traitSunlight + caughtSunlight);
    return { effect, quantity: baseQty + Math.max(0, integer(effect.yieldBonus, 0)), yieldBonus: effect.yieldBonus || 0,
      traitSunlight: Math.min(room, traitSunlight), caughtSunlight: Math.min(Math.max(0, room - traitSunlight), caughtSunlight), sunlightTotal, room };
  }
  function traitText(state, cropId) {
    const info = traitInfo(cropId); if (info.id !== "sun") return info.text;
    const out = harvestOutcome(state, { cropId }, { exposedNow: true, caughtSunlight: 1 });
    return `光裡收成多 ${Math.max(0, out.yieldBonus)} 份＋陽光 ${Math.max(0, out.sunlightTotal)}`;
  }
  function harvestPreview(state, plot, exposedNow) {
    if (!plot || !plot.cropId) return { text: "", effect: null };
    const info = traitInfo(plot.cropId);
    const hits = integer(plot.r75SunHits, 0) + (exposedNow ? 1 : 0);
    const outcome = harvestOutcome(state, plot, { rng: function () { return 0; }, exposedNow, caughtSunlight: exposedNow ? 1 : 0 });
    const litOutcome = harvestOutcome(state, plot, { rng: function () { return 0; }, exposedNow: true, caughtSunlight: 1 });
    const effect = outcome.effect;
    let text = `${info.icon} ${info.name}`;
    if (info.id === "sun") text += (plot.sunGrown === true || hits > 0) ? `・照過光了：收成多 ${effect.yieldBonus} 份＋陽光 ${outcome.sunlightTotal}` : `・還沒照到：光裡收成多 ${litOutcome.yieldBonus} 份＋陽光 ${litOutcome.sunlightTotal}`;
    else if (info.id === "partial") text += hits === 0 ? "・還沒照到：再照 1 次有優質" : hits === 1 ? "・照 1 次：收成保證 1 份優質" : `・照 ${hits} 次：曬過頭`;
    else if (info.id === "shade") text += hits === 0 && plot.r75ShadeEligible !== false ? "・還沒照到：保持陰涼整批優質" : "・照過光了：陰涼加成失效";
    else text += "・沒有特殊光性";
    return { text, effect, hits, outcome };
  }
  function catchSun(state, plotIndex) { const exposure = recordExposure(state, plotIndex); const gained = addSunlight(state, 1); return { gained, exposure }; }
  /* R80B：秒數不只共用算法，也共用同一拍的快照。遊戲主迴圈每次刷新先呼叫
     refreshLightCountdown；田上標籤、動作框、任務卡與頂部倒數在下一拍前都讀同一個整數，
     不會因各自呼叫 Date.now() 剛好跨過秒界而出現 1／2 秒。WeakMap 不會寫進存檔。 */
  const lightCountdownSnapshots = typeof WeakMap === "function" ? new WeakMap() : null;
  function secondsLeft(ms) { return Math.max(1, Math.ceil((Number(ms) || 0) / 1000)); }
  function lightCountdownTarget(sun, now) {
    if (!sun) return { phase: "preview", at: 0 };
    const active = now >= (sun.startsAt || 0) && now < (sun.endsAt || 0);
    return active ? { phase: "active", at: sun.endsAt || 0 } : { phase: "preview", at: sun.previewAt || 0 };
  }
  function refreshLightCountdown(sun, now) {
    const t = Number.isFinite(now) ? now : Date.now();
    const target = lightCountdownTarget(sun, t);
    const snap = { phase: target.phase, at: target.at, refreshedAt: t, seconds: secondsLeft(target.at - t) };
    if (lightCountdownSnapshots && sun && typeof sun === "object") lightCountdownSnapshots.set(sun, snap);
    return snap;
  }
  function lightCountdown(sun, now) {
    const t = Number.isFinite(now) ? now : Date.now();
    const target = lightCountdownTarget(sun, t);
    const cached = lightCountdownSnapshots && sun && typeof sun === "object" ? lightCountdownSnapshots.get(sun) : null;
    return cached && cached.phase === target.phase && cached.at === target.at && t - cached.refreshedAt < 1250
      ? cached : refreshLightCountdown(sun, t);
  }
  function lightSecondsLeft(sun, now) { return lightCountdown(sun, now).seconds; }
  function lightSecondsText(sun, now) { return `${lightSecondsLeft(sun, now)} 秒`; }
  /* R78B 第 5 項：一次只有一個主要互動層，全部照這一條規則排，不在每個面板各寫一次。
     主要層（對話框、對話、料理、曬架、側邊面板、選單、建造）開著時：任務卡收起、提示卡全部排隊、光的提示條先收。
     沒有主要層時：提示卡照 FOCUS_CARDS 的順序只出一張，其餘排隊。 */
  const FOCUS_PRIMARY = ["modal", "dialogue", "cook", "rack", "panel", "menu", "build"];
  const FOCUS_CARDS = ["settlement", "care", "stamp"];
  function focusRule(input) {
    const open = (input && input.open) || [], cards = (input && input.cards) || [];
    const primary = FOCUS_PRIMARY.find((id) => open.includes(id)) || null;
    const known = FOCUS_CARDS.filter((id) => cards.includes(id));
    const card = primary ? null : known[0] || null;
    return { primary, card, queued: known.filter((id) => id !== card), questDock: primary ? "folded" : "shown", hints: primary ? "hidden" : "shown" };
  }
  /* R78B 第 2 項：折光後的那一句提示。預告期間說「光會落在這一格」，光已經在照就說趁光還在；光落下後，預告期間的句子就過期了。 */
  function refractToastText(result) {
    if (!result || !result.ok) return "現在沒有光可以折，等下一道光的預告。";
    if (result.remaining > 0) return `光折過來了，這道光還能再折 ${result.remaining} 次。`;
    /* R83C 第 1 項：跟任務卡同一組說法（在光裡澆水／在光裡收成），不再寫「趁光還在」「光到了再」。 */
    return result.active ? "光折過來了。在光裡澆水或收成。" : "光會落在這一格，在光裡澆水或收成。";
  }
  /* R83C：「先別澆水」是預告期間的話，光落下後也算過期。 */
  function staleLightText(text, light) { return !!(light && light.active) && /光會落在這一格|光到了再|光快落在|先別澆水/.test(String(text || "")); }
  /* R83C 第 1 項：頂部陽光籤什麼時候提「手鏡可折 N 次」。
     任務卡正在教折光才提；第一次光裡收成前（折光還沒交給玩家）不提；任務卡叫玩家等光、或光本來就要落在任務那一格時也不提，免得教等光時又冒出折光。 */
  function mirrorHint(state, step, now) {
    const sun = (state && state.sun) || {}, left = Math.max(0, mirrorLimit(state) - integer(sun.refractions, 0));
    if (!left) return "";
    const text = `手鏡可折 ${left} 次`;
    if (step && step.action === "refract") return text;
    const firstLessonDone = !!(state && ((state.flags && state.flags.r79FirstLightHarvest === true) || (state.adventure && state.adventure.claimed && state.adventure.claimed.c1_first_harvest)));
    if (!firstLessonDone) return "";
    const queued = state.flags && state.flags.r79WaitHarvest;
    if (queued && Number.isInteger(queued.plotIndex)) return "";
    if (step && (step.action === "catch_sun" || step.holdPlotIndex != null || step.lightChoice)) return "";
    const t = Number.isFinite(now) ? now : Date.now(), active = t >= (sun.startsAt || 0) && t < (sun.endsAt || 0);
    const lit = active ? sun.plots || [] : t < (sun.previewAt || 0) ? sun.previewPlots || [] : [];
    if (step && Number.isInteger(step.plotIndex) && lit.includes(step.plotIndex)) return "";
    return text;
  }
  /* R78B 第 6 項：光裡收成的大字，數字直接取收成結果。 */
  function harvestPopText(out) {
    const sun = out && out.sun; if (!sun || sun.kind !== "harvest") return [];
    const lines = []; if (sun.bonus > 0) lines.push(`多 ${sun.bonus} 份`); if (sun.sunlight > 0) lines.push(`陽光 +${sun.sunlight}`);
    return lines;
  }
  /* R77A 第 1 項：能不能折、為什麼不能折，都由這一個函式判斷；canRefract、折光前的預覽、動作列按鈕共用同一份規則。
   * reason：""＝可以折、"none"＝現在沒有光也沒有預告、"plot"＝不是開墾好的田、"lit"＝這格本來就會照到、"used"＝這道光的次數用完了。 */
  function refractCheck(state, targetIndex, now) {
    normalize(state); const sun = state.sun || {}; const active = !!(now >= (sun.startsAt || 0) && now < (sun.endsAt || 0) && (sun.plots || []).length);
    const preview = !active && !!(now < (sun.previewAt || 0) && (sun.previewPlots || []).length);
    const plots = active ? sun.plots : preview ? sun.previewPlots : [];
    const activeCount = typeof root.activePlotCount === "function" ? root.activePlotCount(state) : ((state.upgrades || {}).plotCount > 0 && C.UPGRADES ? C.UPGRADES.plotCount.levels[state.upgrades.plotCount - 1].value : C.GAME.startPlots);
    const limit = mirrorLimit(state), remaining = Math.max(0, limit - sun.refractions);
    const inField = Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < activeCount;
    const reason = !(active || preview) ? "none" : !inField ? "plot" : plots.includes(targetIndex) ? "lit" : remaining <= 0 ? "used" : "";
    return { ok: !reason, reason, active, preview, remaining, limit, from: plots.slice(), spent: reason === "lit" && active && (sun.used || []).includes(targetIndex) };
  }
  function canRefract(state, targetIndex, now) { return refractCheck(state, targetIndex, now).ok; }
  /* 折光之前先寫出折過去會怎樣。份數與陽光全部取自 harvestEffects（跟實際收成同一套），這裡只把「照到」與「沒照到」的差別寫成一句話。
   * yieldGain／sunlightGain＝這一格照到光之後，收成比現在多出來的份數與陽光（不含在光裡親手收成另外接到的那 1 點）。 */
  function refractPreview(state, targetIndex, now) {
    const check = refractCheck(state, targetIndex, now);
    const out = { can: check.ok, reason: check.reason, remaining: check.remaining, limit: check.limit, active: check.active, from: check.from, to: targetIndex,
      yieldGain: 0, sunlightGain: 0, sunlightTotal: 0, qualityChange: "", text: "", buttonText: "" };
    if (check.reason === "none" || check.reason === "plot") return out;
    if (check.reason === "lit") { out.spent = check.spent; out.text = check.spent ? "這道光在這格已經用過了" : "這格本來就會照到光，不用折"; return out; }
    if (check.reason === "used") { out.text = "這道光已經折過了，等下一道光"; return out; }
    out.buttonText = `手鏡還能折 ${check.remaining} 次`;
    const plot = (state.plots || [])[targetIndex];
    if (!plot || !plot.cropId) { out.text = "折過來：這格會照到光，在光裡種下去長得快"; return out; }
    const one = function () { return 1; };
    const beforeOutcome = harvestOutcome(state, plot, { rng: one, exposedNow: false, caughtSunlight: 0 });
    const afterOutcome = harvestOutcome(state, plot, { rng: one, exposedNow: true, caughtSunlight: 1 });
    const before = beforeOutcome.effect, after = afterOutcome.effect;
    out.yieldGain = after.yieldBonus - before.yieldBonus; out.sunlightGain = after.sunlight - before.sunlight; out.sunlightTotal = afterOutcome.sunlightTotal;
    const info = traitInfo(plot.cropId), who = info.id === "neutral" ? cropName(plot.cropId) : `${cropName(plot.cropId)}（${info.name}）`;
    let effectText = "收成跟現在一樣";
    if (!before.guaranteedQuality && after.guaranteedQuality) { out.qualityChange = "gain"; effectText = "照到剛好 1 次，收成保證 1 份優質"; }
    else if (before.guaranteedQuality && !after.guaranteedQuality) { out.qualityChange = "lose"; effectText = "照到第 2 次，曬過頭，保證優質就沒了"; }
    else if (before.qualityBonusChance > 0 && !(after.qualityBonusChance > 0)) { out.qualityChange = "lose"; effectText = "陰涼的優質加成就沒了"; }
    else if (out.yieldGain > 0) effectText = `收成多 ${out.yieldGain} 份`;
    if (out.sunlightTotal > 0) effectText += `・光裡收成得陽光 ${out.sunlightTotal}`;
    out.text = `折過來：${who}會照到光，${effectText}`;
    return out;
  }
  function refract(state, targetIndex, now) {
    if (!canRefract(state, targetIndex, now)) return { ok: false, reason: "unavailable" };
    const sun = state.sun; const active = now >= (sun.startsAt || 0) && now < (sun.endsAt || 0);
    const from = (active ? sun.plots : sun.previewPlots).slice();
    if (active) sun.plots = [targetIndex]; else sun.previewPlots = [targetIndex];
    sun.refractions++; state.r75Sunplay.firstRefracted = true;
    return { ok: true, from, to: targetIndex, remaining: mirrorLimit(state) - sun.refractions, active };
  }
  function ripen(state, plotIndex, now) {
    normalize(state); const plot = (state.plots || [])[plotIndex]; if (!plot || !plot.cropId) return { ok: false, reason: "empty" };
    const progress = typeof root.getCropProgress === "function" ? root.getCropProgress(state, plot, now) : null;
    if (progress && progress.ready) return { ok: false, reason: "ready" };
    if (!spendSunlight(state, 2)) return { ok: false, reason: "sunlight" };
    const growMs = typeof root.plotGrowMs === "function" ? root.plotGrowMs(state, plot, now) : C.CROPS[plot.cropId].growMs;
    plot.plantedAt = now - growMs; if ((plot.wateredAt || 0) > 0) plot.wateredAt = Math.max(plot.wateredAt, plot.plantedAt);
    state.r75Sunplay.firstRipened = true; return { ok: true, plotIndex, spent: 2 };
  }
  function buyMirror(state) { normalize(state); if ((state.level || 1) < 3) return { ok: false, reason: "level" }; if (state.r75Sunplay.mirrorLevel) return { ok: false, reason: "max" }; if ((state.coins || 0) < 60) return { ok: false, reason: "coins" }; state.coins -= 60; state.r75Sunplay.mirrorLevel = 1; return { ok: true }; }
  function buyBottle(state) { normalize(state); if ((state.level || 1) < 4) return { ok: false, reason: "level" }; if (state.r75Sunplay.bottleLevel) return { ok: false, reason: "max" }; if ((state.coins || 0) < 90) return { ok: false, reason: "coins" }; state.coins -= 90; state.r75Sunplay.bottleLevel = 1; return { ok: true }; }
  function driedDef(itemId) { const d = DRIED[itemId]; if (!d) return null; const crop = C.CROPS[d.cropId]; return Object.assign({}, d, { sellValue: crop.sellValue * 3, emoji: "☀", unlockLevel: 2 }); }
  function driedItemIds(state) { normalize(state); return (state.level || 1) >= 2 ? Object.keys(DRIED).filter((id) => (state.storage.items[id] || 0) > 0) : []; }
  function startDrying(state, cropId, now) {
    normalize(state); const entry = Object.values(DRIED).find((d) => d.cropId === cropId); const rack = updateRack(state, now);
    if (!entry) return { ok: false, reason: "crop" }; if (rack.cropId) return { ok: false, reason: "busy" };
    if ((state.storage.items[cropId] || 0) < 2) return { ok: false, reason: "items" }; if (!spendSunlight(state, 1)) return { ok: false, reason: "sunlight" };
    state.storage.items[cropId] -= 2; if (!state.storage.items[cropId]) delete state.storage.items[cropId];
    state.r75Sunplay.rack = { cropId, itemId: entry.id, startedAt: now, readyAt: now + DRYING_MS, ready: false, flippedAt: 0 };
    return { ok: true, readyAt: now + DRYING_MS, itemId: entry.id };
  }
  function updateRack(state, now) { normalize(state); const rack = state.r75Sunplay.rack; if (rack.cropId && now >= rack.readyAt) rack.ready = true; return rack; }
  /* R77A 第 4 項：翻面。時間窗從曬到一半開始，最長 FLIP_WINDOW_MS，不會超過曬好的時間。
   * flipState：none＝空架、early＝還沒到一半、open＝現在可以翻、done＝翻過了、missed＝錯過了（照常曬好、不扣）。 */
  function flipWindow(rack) { const from = rack.startedAt + Math.floor(Math.max(0, rack.readyAt - rack.startedAt) / 2); return { from, until: Math.min(rack.readyAt, from + FLIP_WINDOW_MS) }; }
  function flipState(rack, now) {
    if (!rack || !rack.cropId) return "none"; if (rack.flippedAt > 0) return "done"; if (rack.ready || now >= rack.readyAt) return "missed";
    const win = flipWindow(rack); return now < win.from ? "early" : now < win.until ? "open" : "missed";
  }
  function flipRack(state, now) {
    const rack = updateRack(state, now), flip = flipState(rack, now);
    if (flip !== "open") return { ok: false, reason: flip === "none" ? "empty" : flip === "done" ? "flipped" : rack.ready ? "ready" : flip };
    rack.flippedAt = Math.max(1, Math.floor(now)); return { ok: true, itemId: rack.itemId, quantity: 2 };
  }
  function collectDrying(state, now) {
    const rack = updateRack(state, now); if (!rack.cropId || !rack.ready) return { ok: false, reason: rack.cropId ? "not_ready" : "empty" };
    if (typeof API.onDried === "function") API.onDried(state, rack.itemId); /* R76C 追光手冊：曬成乾貨蓋章（翻不翻面都只蓋一次，取得條件不變） */
    const quantity = rack.flippedAt > 0 ? 2 : 1; /* R77A：翻過面多 1 份 */
    state.storage.items[rack.itemId] = (state.storage.items[rack.itemId] || 0) + quantity; const itemId = rack.itemId; state.r75Sunplay.rack = normalizeRack(null); return { ok: true, itemId, quantity };
  }
  function rackStatus(state, now) {
    const rack = updateRack(state, now), flip = flipState(rack, now);
    return Object.assign({}, rack, { empty: !rack.cropId, remainingMs: rack.cropId ? Math.max(0, rack.readyAt - now) : 0,
      flip, flipRemainingMs: flip === "open" ? Math.max(0, flipWindow(rack).until - now) : 0, quantity: rack.cropId ? (rack.flippedAt > 0 ? 2 : 1) : 0 });
  }
  function festivalBonus(itemId) { return DRIED[itemId] ? { points: 1, source: "日曬乾貨 +1" } : { points: 0, source: "" }; }

  /* ---------- 瀏覽器介面（R75 整合重做）----------
   * 原本右上角的浮動三顆鈕被資源列蓋住、田邊泡泡每 250ms 重建又被田格標籤蓋住、
   * 升級卡硬塞進升級面板，把「再顯示 N 項」擠出首屏。現在改成：
   *   蓄光瓶＝資源列裡的一枚籤（ui.js renderResBar 呼叫 jarChipHtml）
   *   手鏡／蓄光瓶升級＝升級清單裡的兩張卡（ui.js renderUpgrades 呼叫 upgradeCards）
   *   折光／催熟＝點田格後動作列上的按鈕（ui.js renderSceneActionsForSelection 呼叫 plotActions）
   *   曬架＝農舍旁的地圖物件，點它開曬架面板 */
  function versionQuery() { return root.FARM_VERSION_QUERY || ""; }
  function farmApi() { return root.__farm || null; }
  function liveState() { const farm = farmApi(); return farm && farm.state ? farm.state() : null; }
  function toast(text) { const farm = farmApi(); if (farm && farm.toast) farm.toast(text); }
  function cropName(cropId) { return (C.CROPS[cropId] || {}).name || "作物"; }
  function saveRefresh() { const farm = farmApi(); if (farm && farm.safeSaveNow) farm.safeSaveNow(); if (farm && farm.refresh) farm.refresh(); tick(); }

  /* 蓄光瓶：接過第一點陽光才出現，新玩家一開始不會多看到一個不懂的數字。 */
  function jarVisible(state) { normalize(state); return state.r75Sunplay.sunlight > 0 || state.r75Sunplay.firstCaught; }
  function jarChipHtml(state) {
    if (!jarVisible(state)) return "";
    const amount = sunlight(state), cap = bottleCapacity(state);
    return `<div class="res r75a-jar-chip" data-audit="r75a-jar" title="蓄光瓶：在光裡種、澆、收會接到陽光。2 點可以催熟一格，1 點可以開曬架。" aria-label="蓄光瓶，陽光 ${amount}/${cap}"><img src="assets/generated/content-r75/sun_jar.png${versionQuery()}" alt=""><span class="sub">陽光 ${amount}/${cap}</span></div>`;
  }
  let jarSignature = "";
  function syncJarChip(state) {
    const signature = jarVisible(state) ? sunlight(state) + "/" + bottleCapacity(state) : "";
    if (signature === jarSignature) return; jarSignature = signature;
    const farm = farmApi(); if (farm && farm.refreshResources) farm.refreshResources();
  }

  /* 升級清單用的兩張卡：只回資料，畫法跟其他升級卡一致，由 ui.js 負責。 */
  function upgradeCards(state) {
    normalize(state); const level = state.level || 1, coins = state.coins || 0, own = state.r75Sunplay;
    const card = function (id, name, icon, effect, needLevel, cost, done, buy) {
      const locked = level < needLevel, short = Math.max(0, cost - coins);
      return { id, name, icon: "assets/generated/content-r75/" + icon, effect, level: needLevel, cost, done, locked, short, canBuy: !done && !locked && !short,
        status: done ? "已完成" : locked ? `等級 ${needLevel} 解鎖` : short ? "差一點" : "現在買得起",
        buttonText: locked ? `等級 ${needLevel} 解鎖` : short ? `${cost} 金（還差 ${short}）` : `${cost} 金`,
        affordability: done ? "maxed" : locked ? "long-term" : short ? (short <= 18 ? "near" : "long-term") : "affordable",
        buy: function () { return buy(state); } };
    };
    return [
      card("mirror", "磨亮手鏡", "sun_mirror.png", "每道光可以折 " + (2 + sunbookBonus(state, "mirror", 1)) + " 次", 3, 60, !!own.mirrorLevel, buyMirror),
      card("bottle", "大一點的蓄光瓶", "sun_jar.png", "陽光上限提高到 " + (8 + sunbookBonus(state, "jar", 2)) + " 點", 4, 90, !!own.bottleLevel, buyBottle),
    ];
  }

  /* 點田格後的動作列：光可以折到這一格、或蓄光瓶夠催熟時，各多一顆鈕。 */
  function canRipen(state, plotIndex, now) {
    normalize(state); const plot = (state.plots || [])[plotIndex]; if (!plot || !plot.cropId || sunlight(state) < 2) return false;
    const progress = typeof root.getCropProgress === "function" ? root.getCropProgress(state, plot, now) : null; return !(progress && progress.ready);
  }
  function plotActions(state, plotIndex, now) {
    const actions = []; if (!Number.isInteger(plotIndex)) return actions;
    /* 第一次光裡收成完成前，折光只從任務卡進入；完成後才在選中的田上留下唯一入口。 */
    const firstLessonDone = !!(state && ((state.flags && state.flags.r79FirstLightHarvest === true) || (state.adventure && state.adventure.claimed && state.adventure.claimed.c1_first_harvest)));
    if (firstLessonDone && canRefract(state, plotIndex, now)) actions.push({ action: "refract", enabled: true });
    if (canRipen(state, plotIndex, now)) actions.push({ action: "ripen", enabled: true });
    return actions;
  }
  function runPlotAction(action, plotIndex) {
    const state = liveState(); if (!state) return { ok: false, reason: "state" }; const now = Date.now(); let result;
    if (action === "refract") {
      result = refract(state, plotIndex, now);
      toast(refractToastText(result));
      /* R78B：r78bRefractNote 記下「這句是預告期間說的」，光一落下就把還留在畫面上的舊句子收掉。 */
      r78bRefractNote = result.ok && !result.active && !(result.remaining > 0) ? { plotIndex, at: now } : null;
    } else if (action === "ripen") {
      result = ripen(state, plotIndex, now);
      toast(result.ok ? "用掉 2 點陽光，這一格立刻成熟了，可以收成。" : result.reason === "sunlight" ? "陽光不足 2 點，先到光裡照料作物接一些。" : result.reason === "ready" ? "這一格已經成熟，直接收成就好。" : "這一格沒有作物。");
    } else return { ok: false, reason: "action" };
    if (result.ok) { saveRefresh(); if (action === "refract") playBeam(state, result.from, result.to); }
    return result;
  }
  let actionSignature = "";
  function syncPlotActions(state, now) {
    const farm = farmApi(); if (!farm || !farm.renderSceneActions) return;
    const id = state.interaction && state.interaction.selectedTileId; const tile = id && state.map ? state.map.tiles.find((t) => t.id === id) : null;
    const isPlot = !!(tile && tile.plotIndex != null);
    const names = isPlot ? plotActions(state, tile.plotIndex, now).map((a) => a.action).join(",") : "";
    /* R77A：折光的原因與剩餘次數寫在標籤與按鈕上，這些變了也要重畫一次（沒有光、不是田的時候不算，免得白白重畫）。 */
    const check = isPlot ? refractCheck(state, tile.plotIndex, now) : null;
    const note = check && check.reason !== "none" && check.reason !== "plot" ? [check.reason, check.remaining, check.active ? 1 : 0, check.spent ? 1 : 0].join("/") : "";
    const signature = names || note ? tile.id + "|" + names + "|" + note : "";
    if (signature === actionSignature) return; actionSignature = signature; farm.renderSceneActions();
  }
  /* R77A 第 1 項：選到可以折光的格子時，先在那一格畫一塊淡色光斑（還沒折，只是先看到光會落在哪）。
   * 能不能折只問 refractCheck，跟動作列的「把光折到這裡」是同一個判斷，所以有光斑就一定有那顆鈕。 */
  function refractGhostPlot(state, now) {
    const id = state && state.interaction && state.interaction.selectedTileId; const tile = id && state.map ? state.map.tiles.find((t) => t.id === id) : null;
    const firstLessonDone = !!(state && ((state.flags && state.flags.r79FirstLightHarvest === true) || (state.adventure && state.adventure.claimed && state.adventure.claimed.c1_first_harvest)));
    return firstLessonDone && tile && tile.plotIndex != null && refractCheck(state, tile.plotIndex, now).ok ? tile.plotIndex : null;
  }
  function syncRefractGhost(state, now) {
    if (typeof document === "undefined") return; const world = document.getElementById("mapWorld"); if (!world) return;
    const want = refractGhostPlot(state, now), point = want == null ? null : tilePoint(state, want); let node = world.querySelector(".r77a-refract-ghost");
    if (!point) { if (node) node.remove(); return; }
    if (!node) { node = document.createElement("div"); node.className = "r77a-refract-ghost"; node.dataset.audit = "r77a-refract-ghost"; node.setAttribute("aria-hidden", "true"); world.appendChild(node); }
    const box = want + "|" + point.left + "|" + point.top + "|" + point.size;
    if (node.dataset.box !== box) { node.dataset.box = box; node.dataset.plotIndex = String(want); node.style.left = point.left + "px"; node.style.top = point.top + "px"; node.style.width = point.size + "px"; node.style.height = point.size + "px"; }
  }

  function tilePoint(state, plotIndex) {
    const tile = state.map && state.map.tiles.find((t) => t.plotIndex === plotIndex); if (!tile) return null;
    const node = document.querySelector(`.gtile[data-tile-id="${tile.id}"]`);
    return { tile, left: node ? node.offsetLeft : tile.x * 48, top: node ? node.offsetTop : tile.y * 48, size: node ? node.offsetWidth : 48 };
  }
  /* 折光的那一下：一道光從原本的格子掃到新格子，落點亮一下。 */
  function playBeam(state, from, to) {
    if (typeof document === "undefined") return; const world = document.getElementById("mapWorld"); if (!world) return;
    const start = tilePoint(state, Array.isArray(from) ? from[0] : from), end = tilePoint(state, to); if (!end) return;
    const endX = end.left + end.size / 2, endY = end.top + end.size / 2;
    const flash = document.createElement("div"); flash.className = "r75a-beam-flash"; flash.setAttribute("aria-hidden", "true");
    flash.style.cssText = `left:${endX}px;top:${endY}px;width:${end.size}px;height:${end.size}px`; world.appendChild(flash); setTimeout(function () { flash.remove(); }, 900);
    if (!start) return; const startX = start.left + start.size / 2, startY = start.top + start.size / 2;
    const beam = document.createElement("div"); beam.className = "r75a-beam"; beam.setAttribute("aria-hidden", "true");
    beam.style.cssText = `left:${startX}px;top:${startY}px;width:${Math.round(Math.hypot(endX - startX, endY - startY))}px;transform:rotate(${Math.atan2(endY - startY, endX - startX).toFixed(4)}rad)`;
    world.appendChild(beam); setTimeout(function () { beam.remove(); }, 700);
  }
  /* 預告圈：光落下前先在田上亮起，寫著還有幾秒。 */
  function renderPreview(state, now) {
    const world = document.getElementById("mapWorld"); if (!world) return; const sun = state.sun || {};
    const active = now >= (sun.startsAt || 0) && now < (sun.endsAt || 0);
    const preview = !active && now < (sun.previewAt || 0) ? sun.previewPlots || [] : []; const wanted = new Set(preview);
    world.querySelectorAll(".r75a-sun-preview").forEach((n) => { if (!wanted.has(Number(n.dataset.plotIndex))) n.remove(); });
    const text = lightSecondsText(sun, now);
    preview.forEach((i) => {
      const p = tilePoint(state, i); if (!p) return; let n = world.querySelector(`.r75a-sun-preview[data-plot-index="${i}"]`);
      if (!n) { n = document.createElement("div"); n.className = "r75a-sun-preview"; n.dataset.plotIndex = String(i); n.setAttribute("data-r78b-light-secs", ""); n.setAttribute("aria-hidden", "true"); world.appendChild(n); }
      const box = p.left + "|" + p.top + "|" + p.size;
      if (n.dataset.box !== box) { n.dataset.box = box; n.style.left = p.left + "px"; n.style.top = p.top + "px"; n.style.width = p.size + "px"; n.style.height = p.size + "px"; }
      if (n.textContent !== text) n.textContent = text;
    });
  }

  /* 曬架立在農舍右邊那格草地；那格被玩家蓋了建物，就靠回農舍牆角，不擋建物。 */
  function rackSpot(state) {
    const tiles = (state.map && state.map.tiles) || []; const house = (C.STRUCTURES || []).find((s) => s.id === "farmhouse") || { x: 11, y: 4, w: 3, h: 2 };
    const right = house.x + house.w - 1, bottom = house.y + house.h - 1; const side = tiles.find((t) => t.x === right + 1 && t.y === bottom);
    const free = side && side.terrain === "grass" && !side.object && !side.buildingId && !side.station && !side.npc && !side.structureId && !side.blocked && !side.event && !side.forage && !side.adventureSite;
    return free ? { x: right + 1.5, y: bottom + 1 } : { x: right + 1, y: bottom + 1 };
  }
  /* R77A 第 4 項：可以翻面的那 10 秒寫「還要 N 秒・可以翻面」，翻過寫「翻過了・還要 N 秒」；還沒到一半或錯過了維持原本的「曬架・N 秒」。 */
  function rackLabel(state, status) {
    if (status.empty) return "曬架"; if (status.ready) return "曬架・可收"; const left = Math.ceil(status.remainingMs / 1000);
    return status.flip === "open" ? `還要 ${left} 秒・可以翻面` : status.flip === "done" ? `翻過了・還要 ${left} 秒` : `曬架・${left} 秒`;
  }
  function rackTimeText(status) {
    const left = Math.ceil(status.remainingMs / 1000);
    return status.flip === "open" ? `還要 ${left} 秒・可以翻面` : status.flip === "done" ? `翻過了・還要 ${left} 秒` : `還要 ${left} 秒`;
  }
  function rackAria(status) {
    if (status.empty) return "農舍旁的曬架，點一下打開"; if (status.ready) return "曬架上的乾貨曬好了，點一下收下"; const left = Math.ceil(status.remainingMs / 1000);
    return status.flip === "open" ? `曬架可以翻面了，點一下翻面，還要 ${left} 秒曬好` : status.flip === "done" ? `曬架翻過面了，還要 ${left} 秒曬好` : `曬架正在曬作物，${left} 秒`;
  }
  /* 翻面與收下：曬架節點、曬架面板、右下互動鈕三個入口都走這兩個函式，提示文字與存檔只寫一份。 */
  function flipNow(state) {
    const result = flipRack(state, Date.now());
    toast(result.ok ? "翻面了，曬好會多收 1 份。" : result.reason === "early" ? "還沒曬到一半，等一下再翻。" : result.reason === "flipped" ? "這一批已經翻過了。" : result.reason === "empty" ? "曬架上沒有東西。" : result.reason === "ready" ? "已經曬好了，直接收下就好。" : "這次來不及翻了，照常曬好，不會少。");
    if (result.ok) { saveRefresh(); rackPanelMode = ""; renderRackPanel(state, Date.now()); }
    return result;
  }
  function collectNow(state) {
    const result = collectDrying(state, Date.now()); if (!result.ok) return result;
    toast(`收下 ${result.quantity} 份${(DRIED[result.itemId] || {}).name || "乾貨"}，放進倉庫了。`); saveRefresh(); rackPanelMode = ""; renderRackPanel(state, Date.now()); return result;
  }
  /* 右下互動鈕：站在曬架旁（曬架那一格與周圍一圈）而且現在可以翻面或可以收，才回傳要做的事；其他時候回 null，互動鈕照原本的規則。 */
  function rackNear(state) {
    const player = state && state.player; if (!player || !state.map) return false; const spot = rackSpot(state);
    return Math.abs(player.x + 0.5 - spot.x) <= 1.5 && Math.abs(player.y + 0.5 - (spot.y - 0.5)) <= 1.5;
  }
  function rackInteraction(state, now) {
    if (!rackNear(state)) return null; const status = rackStatus(state, now);
    if (status.flip === "open") return { action: "flip", label: "翻面・曬架" };
    if (status.ready) return { action: "collect", label: "收乾貨・曬架" };
    return null;
  }
  function runRackInteraction() {
    const state = liveState(); if (!state) return { ok: false, reason: "state" }; const hit = rackInteraction(state, Date.now());
    if (!hit) return { ok: false, reason: "none" };
    return hit.action === "flip" ? flipNow(state) : collectNow(state);
  }
  let flipAnnounced = 0;
  function announceFlip(status) {
    if (status.flip !== "open" || flipAnnounced === status.startedAt) return; flipAnnounced = status.startedAt;
    toast(`曬架曬到一半了，${Math.round(FLIP_WINDOW_MS / 1000)} 秒內翻個面，多收 1 份。`);
  }
  function paintRack(state, now) {
    const world = document.getElementById("mapWorld"); if (!world || !state.map || !world.offsetWidth) return;
    const spot = rackSpot(state), status = rackStatus(state, now), tileSize = Math.max(24, Math.round(world.offsetWidth / state.map.width));
    let node = document.getElementById("r75aRackNode");
    if (!node || node.parentNode !== world) {
      if (node) node.remove(); node = document.createElement("button"); node.type = "button"; node.id = "r75aRackNode"; node.className = "r75a-map-node"; node.dataset.audit = "r75a-rack";
      /* R77A：可以翻面的那 10 秒，點曬架就直接翻面（不用先開面板）；其他時候照舊打開面板。 */
      node.innerHTML = '<img alt="" draggable="false"><span></span>'; node.onclick = function (event) { event.stopPropagation(); const live = liveState(); if (live && rackStatus(live, Date.now()).flip === "open") flipNow(live); else openRack(); }; world.appendChild(node);
    }
    const size = Math.round(tileSize * 1.3), left = Math.round(spot.x * tileSize), top = Math.round(spot.y * tileSize), box = left + "|" + top + "|" + size;
    if (node.dataset.box !== box) { node.dataset.box = box; node.style.cssText = `left:${left}px;top:${top}px;width:${size}px;height:${size}px;z-index:${top + 3}`; }
    const art = status.empty ? "drying_rack_empty.png" : "drying_rack_full.png";
    if (node.dataset.art !== art) { node.dataset.art = art; node.querySelector("img").src = "assets/generated/content-r75/" + art + versionQuery(); }
    const label = rackLabel(state, status), span = node.querySelector("span");
    if (span.textContent !== label) { span.textContent = label; node.setAttribute("aria-label", rackAria(status)); }
    node.dataset.rackState = status.empty ? "empty" : status.ready ? "ready" : "drying";
    if (node.dataset.rackFlip !== status.flip) node.dataset.rackFlip = status.flip;
    announceFlip(status);
  }

  /* 曬架面板 */
  let rackPanelMode = "";
  function closeRack() { const overlay = typeof document !== "undefined" && document.getElementById("r75aRackOverlay"); if (overlay) overlay.remove(); rackPanelMode = ""; }
  function openRack() {
    const state = liveState(); if (!state || typeof document === "undefined") return; normalize(state); closeRack();
    const overlay = document.createElement("div"); overlay.id = "r75aRackOverlay"; overlay.className = "r75a-rack-overlay";
    overlay.innerHTML = '<div id="r75aRackPanel" class="r75a-rack-panel" role="dialog" aria-modal="true" aria-label="農舍曬架"></div>';
    overlay.addEventListener("click", function (event) { if (event.target === overlay) closeRack(); });
    document.body.appendChild(overlay); renderRackPanel(state, Date.now());
    const close = overlay.querySelector("[data-close]"); if (close && close.focus) close.focus();
  }
  function renderRackPanel(state, now) {
    const panel = typeof document !== "undefined" && document.getElementById("r75aRackPanel"); if (!panel) return;
    const status = rackStatus(state, now), amount = sunlight(state), locked = (state.level || 1) < 2;
    /* R77A：翻面的四個階段各是一種畫面（按鈕出現、消失、說明換句），階段變了才重畫，其餘時候只更新秒數。 */
    const mode = locked ? "locked" : status.ready ? "ready|" + status.quantity : !status.empty ? "drying|" + status.flip : "empty|" + amount + "|" + Object.values(DRIED).map((d) => Math.min(2, state.storage.items[d.cropId] || 0)).join(",");
    if (mode === rackPanelMode) {
      const time = panel.querySelector("[data-rack-time]"), text = rackTimeText(status); if (time && time.textContent !== text) time.textContent = text; return;
    }
    rackPanelMode = mode; const art = function (file, alt) { return `<img class="r75a-rack-art" src="assets/generated/content-r75/${file}${versionQuery()}" alt="${alt}">`; };
    const head = '<div class="r75a-rack-head"><b>農舍曬架</b><button type="button" data-close aria-label="關閉曬架">關閉</button></div>';
    const dried = status.itemId ? DRIED[status.itemId] : null;
    /* 曬架圖是通用的，旁邊補上這一批乾貨的圖示，玩家才看得出架上曬的是哪一種。 */
    const item = dried ? `<img class="r75a-rack-item" src="${dried.icon}${versionQuery()}" alt="">` : "";
    /* 曬乾中與可收：空架上直接鋪這一批乾貨的圖，不再用通用的滿架圖（曬小麥時看起來像別的東西）。 */
    const loaded = dried ? `<div class="r75a-rack-stage">${art("drying_rack_empty.png", "鋪著" + dried.name + "的曬架")}<span class="r75a-rack-load" aria-hidden="true">${item}${item}${item}</span></div>` : art("drying_rack_full.png", "鋪滿作物的曬架");
    if (locked) panel.innerHTML = head + art("drying_rack_empty.png", "空的曬架") + "<p>等級 2 開放。到時放上 2 份作物、用掉 1 點陽光，30 秒後就能收下日曬乾貨。</p>";
    else if (status.ready) panel.innerHTML = head + loaded + `<p class="r75a-rack-line">${item}<span>${dried ? dried.name : "乾貨"}曬好了${status.quantity > 1 ? "，翻過面多 1 份" : ""}。</span></p><button type="button" class="r75a-rack-collect" data-collect>收下 ${status.quantity} 份${dried ? dried.name : "乾貨"}</button>`;
    else if (!status.empty) {
      const flipNote = status.flip === "open" ? "現在翻面，收的時候多 1 份。來不及翻也照常曬好，不會少。" : status.flip === "done" ? "翻過了，曬好會收到 2 份。曬好了，地圖上的曬架會寫「可收」。" : status.flip === "missed" ? "這次沒翻到，照常曬好、收 1 份。曬好了，地圖上的曬架會寫「可收」。" : "曬到一半可以翻面，翻了多收 1 份；不翻也照常曬好。";
      const flipButton = status.flip === "open" ? '<button type="button" class="r75a-rack-collect r77a-rack-flip" data-flip>翻面・多收 1 份</button>' : "";
      panel.innerHTML = head + loaded + `<p class="r75a-rack-line">${item}<span>${cropName(status.cropId)}正在曬成${dried ? dried.name : "乾貨"}。</span></p><p class="r75a-rack-time" data-rack-time>${rackTimeText(status)}</p>${flipButton}<p class="r75a-rack-note">${flipNote}</p>`;
    }
    else panel.innerHTML = head + art("drying_rack_empty.png", "空的曬架") + `<p>放上 2 份作物、用掉 1 點陽光，30 秒後收下 1 份日曬乾貨；曬到一半翻個面，多收 1 份。乾貨的賣價是 1 份作物的 3 倍。</p><p class="r75a-rack-sun">蓄光瓶：陽光 ${amount} 點${amount < 1 ? "。先到光裡種、澆、收，接 1 點陽光再來。" : ""}</p><div class="r75a-rack-choices">${Object.values(DRIED).map(function (d) {
      const have = state.storage.items[d.cropId] || 0, lack = Math.max(0, 2 - have);
      return `<button type="button" data-dry="${d.cropId}" ${lack || amount < 1 ? "disabled" : ""}><img src="${d.icon}${versionQuery()}" alt=""><span>${cropName(d.cropId)} → ${d.name}<small>${lack ? `倉庫 ${have} 份・還差 ${lack} 份` : `倉庫 ${have} 份`}</small></span></button>`;
    }).join("")}</div>`;
    panel.querySelector("[data-close]").onclick = closeRack;
    panel.querySelectorAll("[data-dry]").forEach(function (button) {
      button.onclick = function () {
        const result = startDrying(state, button.dataset.dry, Date.now());
        if (!result.ok) { toast(result.reason === "items" ? "作物不足 2 份。" : result.reason === "sunlight" ? "陽光不足 1 點。" : result.reason === "busy" ? "曬架正在使用。" : "這種作物不能曬。"); return; }
        toast(`${cropName(button.dataset.dry)}放上曬架了，30 秒後曬好；曬到一半記得翻面。`); saveRefresh(); rackPanelMode = ""; renderRackPanel(state, Date.now());
      };
    });
    const collect = panel.querySelector("[data-collect]");
    if (collect) collect.onclick = function () { collectNow(state); };
    const flip = panel.querySelector("[data-flip]");
    if (flip) flip.onclick = function () { flipNow(state); };
  }

  function tick() {
    const state = liveState(); if (!state || typeof document === "undefined") return;
    normalize(state); const now = Date.now();
    syncJarChip(state); renderPreview(state, now); paintRack(state, now); renderRackPanel(state, now); syncPlotActions(state, now); syncRefractGhost(state, now); syncLightSecs(state, now);
  }
  /* R78B：畫面上所有寫「光還有幾秒」的地方（預告圈、提示條、田上標籤）都掛 data-r78b-light-secs，在這裡同一拍寫進同一個數字。
     光一落下，預告期間留下的句子（光會落在這一格、等光到了再…）就從提示區收掉，不讓舊字留在畫面上。 */
  let r78bRefractNote = null;
  function syncLightSecs(state, now) {
    const sun = state.sun || {}, active = now >= (sun.startsAt || 0) && now < (sun.endsAt || 0);
    const pending = !active && now < (sun.previewAt || 0);
    if (pending) {
      const text = lightSecondsText(sun, now); document.querySelectorAll("[data-r78b-light-secs]").forEach((n) => { if (n.textContent !== text) n.textContent = text; });
      document.querySelectorAll("[data-r78b-light-tpl]").forEach((n) => { const line = n.getAttribute("data-r78b-light-tpl").replace("{秒}", text); if (n.textContent !== line) n.textContent = line; });
    } else document.querySelectorAll("[data-r78b-light-tpl]").forEach((n) => { n.removeAttribute("data-r78b-light-tpl"); n.textContent = ""; });
    if (!active) return;
    r78bRefractNote = null;
    document.querySelectorAll("#toast-zone .toast:not(.settlement-card)").forEach((n) => { if (staleLightText(n.textContent, { active: true })) n.remove(); });
  }
  function initUI() {
    if (typeof document === "undefined") return;
    setInterval(tick, 250); if (document.readyState !== "loading") tick(); else document.addEventListener("DOMContentLoaded", tick, { once: true });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeRack(); });
  }

  const API = { PREVIEW_MS, DRYING_MS, FLIP_WINDOW_MS, TRAITS, TRAIT_INFO, DRIED, normalize, bottleCapacity, mirrorLimit, sunlight, addSunlight, spendSunlight, trait, traitInfo, traitText, resetPlot, recordExposure, settleBeam, harvestEffects, harvestOutcome, harvestPreview, catchSun, canRefract, refractCheck, refractPreview, refract, ripen, buyMirror, buyBottle, driedDef, driedItemIds, startDrying, updateRack, flipWindow, flipState, flipRack, collectDrying, rackStatus, rackLabel, rackTimeText, rackSpot, rackNear, rackInteraction, runRackInteraction, festivalBonus, jarChipHtml, upgradeCards, plotActions, runPlotAction, playBeam, refractGhostPlot, syncRefractGhost, openRack, closeRack, secondsLeft, refreshLightCountdown, lightCountdown, lightSecondsLeft, lightSecondsText, FOCUS_PRIMARY, FOCUS_CARDS, focusRule, refractToastText, staleLightText, mirrorHint, harvestPopText };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else {
    const baseGetItemDef = root.getItemDef;
    if (typeof baseGetItemDef === "function") root.getItemDef = function (id) { return baseGetItemDef(id) || driedDef(id); };
    root.FarmSunplay = API; initUI();
  }
})(typeof window !== "undefined" ? window : globalThis);
