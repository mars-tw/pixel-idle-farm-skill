/* =========================================================================
 * sunplay-r75.js — R75A 追光、作物光性、蓄光瓶與曬架
 * 純規則可由 Node 測試；瀏覽器端只加 R75A 專屬介面。
 * ========================================================================= */
(function (root) {
  const C = (typeof module !== "undefined" && module.exports) ? require("./config.js") : root;
  const PREVIEW_MS = 8000;
  const DRYING_MS = 30000;
  const TRAITS = {
    wheat: "sun", tomato: "sun", corn: "sun", sunflower: "sun", melon: "sun",
    carrot: "partial", potato: "partial", pumpkin: "partial", strawberry: "shade",
  };
  const TRAIT_INFO = {
    sun: { icon: "☀", name: "喜光", text: "在光裡照料，收成多 1 份並多得 1 點陽光。" },
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
  function normalize(state) {
    if (!state || typeof state !== "object") return state;
    const old = state.r75Sunplay && typeof state.r75Sunplay === "object" ? state.r75Sunplay : {};
    state.r75Sunplay = {
      sunlight: Math.min(integer(old.bottleLevel, 0) > 0 ? 8 : 5, integer(old.sunlight, 0)),
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
      startedAt: integer(rack.startedAt, 0), readyAt: integer(rack.readyAt, 0), ready: !!rack.ready };
  }
  function bottleCapacity(state) { normalize(state); return state.r75Sunplay.bottleLevel ? 8 : 5; }
  function mirrorLimit(state) { return state && state.r75Sunplay && state.r75Sunplay.mirrorLevel ? 2 : 1; }
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
    if (kind === "shade" && hits === 0 && plot.r75ShadeEligible !== false) { effect.qualityBonusChance = 0.35; effect.source = "陰涼熟成"; }
    effect.quality = effect.guaranteedQuality || (effect.qualityBonusChance > 0 && (typeof rng === "function" ? rng() : Math.random()) < effect.qualityBonusChance);
    return effect;
  }
  function catchSun(state, plotIndex) { const exposure = recordExposure(state, plotIndex); const gained = addSunlight(state, 1); return { gained, exposure }; }
  function canRefract(state, targetIndex, now) {
    normalize(state); const sun = state.sun || {}; const active = now >= (sun.startsAt || 0) && now < (sun.endsAt || 0) && (sun.plots || []).length;
    const preview = !active && now < (sun.previewAt || 0) && (sun.previewPlots || []).length;
    const activePlots = active ? sun.plots : sun.previewPlots;
    const activeCount = typeof root.activePlotCount === "function" ? root.activePlotCount(state) : ((state.upgrades || {}).plotCount > 0 && C.UPGRADES ? C.UPGRADES.plotCount.levels[state.upgrades.plotCount - 1].value : C.GAME.startPlots);
    return !!((active || preview) && Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < activeCount && !activePlots.includes(targetIndex) && sun.refractions < mirrorLimit(state));
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
    state.r75Sunplay.rack = { cropId, itemId: entry.id, startedAt: now, readyAt: now + DRYING_MS, ready: false };
    return { ok: true, readyAt: now + DRYING_MS, itemId: entry.id };
  }
  function updateRack(state, now) { normalize(state); const rack = state.r75Sunplay.rack; if (rack.cropId && now >= rack.readyAt) rack.ready = true; return rack; }
  function collectDrying(state, now) {
    const rack = updateRack(state, now); if (!rack.cropId || !rack.ready) return { ok: false, reason: rack.cropId ? "not_ready" : "empty" };
    state.storage.items[rack.itemId] = (state.storage.items[rack.itemId] || 0) + 1; const itemId = rack.itemId; state.r75Sunplay.rack = normalizeRack(null); return { ok: true, itemId, quantity: 1 };
  }
  function rackStatus(state, now) { const rack = updateRack(state, now); return Object.assign({}, rack, { empty: !rack.cropId, remainingMs: rack.cropId ? Math.max(0, rack.readyAt - now) : 0 }); }
  function festivalBonus(itemId) { return DRIED[itemId] ? { points: 1, source: "日曬乾貨 +1" } : { points: 0, source: "" }; }

  function initUI() {
    if (typeof document === "undefined") return;
    const tick = function () {
      const farm = root.__farm; const state = farm && farm.state && farm.state(); if (!state) return;
      normalize(state); renderHud(state); renderOverlays(state, Date.now());
    };
    setInterval(tick, 250); if (document.readyState !== "loading") tick(); else document.addEventListener("DOMContentLoaded", tick, { once: true });
  }
  function ensureNode(id, className, parent) { let node = document.getElementById(id); if (!node) { node = document.createElement("div"); node.id = id; node.className = className; (parent || document.body).appendChild(node); } return node; }
  function saveRefresh() { if (root.__farm && root.__farm.safeSaveNow) root.__farm.safeSaveNow(); if (root.__farm && root.__farm.refresh) root.__farm.refresh(); }
  let hudSignature = "";
  function renderHud(state) {
    const cap = bottleCapacity(state); const box = ensureNode("r75aSunHud", "r75a-sun-hud"); const rack = rackStatus(state, Date.now());
    const signature = [sunlight(state), cap, mirrorLimit(state), integer(state.sun.refractions, 0), rack.empty, rack.ready, state.level, state.coins, state.r75Sunplay.mirrorLevel, state.r75Sunplay.bottleLevel].join("|");
    if (signature === hudSignature && document.getElementById("r75aUpgrades")) return; hudSignature = signature;
    box.innerHTML = `<button type="button" class="r75a-mirror" aria-label="祖母的手鏡"><img src="assets/generated/content-r75/sun_mirror.png${root.FARM_VERSION_QUERY || ""}" alt=""><span>這道光還能折 ${Math.max(0, mirrorLimit(state) - integer(state.sun.refractions, 0))} 次</span></button><button type="button" class="r75a-jar" aria-label="蓄光瓶，目前 ${sunlight(state)}/${cap}"><img src="assets/generated/content-r75/sun_jar.png${root.FARM_VERSION_QUERY || ""}" alt=""><b>${sunlight(state)}/${cap}</b></button><button type="button" class="r75a-rack-open"><img src="assets/generated/content-r75/${rack.empty ? "drying_rack_empty.png" : "drying_rack_full.png"}${root.FARM_VERSION_QUERY || ""}" alt="">${rack.ready ? "可收" : "曬架"}</button>`;
    box.querySelector(".r75a-rack-open").onclick = function () { openRack(state); };
    renderUpgradeCards(state);
  }
  function renderUpgradeCards(state) {
    const upgrades = document.getElementById("upgrades"); if (!upgrades) return;
    let wrap = document.getElementById("r75aUpgrades"); if (!wrap) { wrap = document.createElement("section"); wrap.id = "r75aUpgrades"; wrap.className = "up r75a-upgrades"; upgrades.prepend(wrap); }
    wrap.innerHTML = `<article class="r75a-upgrade"><div class="u-main"><b>磨亮手鏡</b><span>等級 3・每道光可折 2 次</span></div><button type="button" ${state.r75Sunplay.mirrorLevel || state.level < 3 || state.coins < 60 ? "disabled" : ""}>${state.r75Sunplay.mirrorLevel ? "已完成" : "60 金"}</button></article><article class="r75a-upgrade"><div class="u-main"><b>大一點的蓄光瓶</b><span>等級 4・上限提高到 8 點</span></div><button type="button" ${state.r75Sunplay.bottleLevel || state.level < 4 || state.coins < 90 ? "disabled" : ""}>${state.r75Sunplay.bottleLevel ? "已完成" : "90 金"}</button></article>`;
    const buttons = wrap.querySelectorAll("button"); buttons[0].onclick = function () { buyMirror(state); saveRefresh(); }; buttons[1].onclick = function () { buyBottle(state); saveRefresh(); };
  }
  function tilePoint(state, plotIndex) {
    const tile = state.map && state.map.tiles.find((t) => t.plotIndex === plotIndex); if (!tile) return null;
    const node = document.querySelector(`.gtile[data-tile-id="${tile.id}"]`);
    return { tile, left: node ? node.offsetLeft : tile.x * 48, top: node ? node.offsetTop : tile.y * 48, size: node ? node.offsetWidth : 48 };
  }
  function renderOverlays(state, now) {
    const world = document.getElementById("mapWorld"); if (!world) return; const sun = state.sun || {}; const active = now >= (sun.startsAt || 0) && now < (sun.endsAt || 0);
    const preview = !active && now < (sun.previewAt || 0) ? sun.previewPlots || [] : []; const wanted = new Set(preview);
    world.querySelectorAll(".r75a-sun-preview").forEach((n) => { if (!wanted.has(Number(n.dataset.plotIndex))) n.remove(); });
    preview.forEach((i) => { const p = tilePoint(state, i); if (!p) return; let n = world.querySelector(`.r75a-sun-preview[data-plot-index="${i}"]`); if (!n) { n = document.createElement("div"); n.className = "r75a-sun-preview"; n.dataset.plotIndex = String(i); world.appendChild(n); } n.style.left = p.left + "px"; n.style.top = p.top + "px"; n.style.width = p.size + "px"; n.style.height = p.size + "px"; n.textContent = `☀ ${Math.max(0, Math.ceil((sun.previewAt - now) / 1000))} 秒後`; });
    const selected = state.interaction && state.interaction.selectedTileId && state.map.tiles.find((t) => t.id === state.interaction.selectedTileId);
    let action = document.getElementById("r75aPlotAction"); if (action) action.remove();
    if (!selected || selected.plotIndex == null) return; const i = selected.plotIndex; const plot = state.plots[i]; const canMove = canRefract(state, i, now); const canRipe = plot && plot.cropId && sunlight(state) >= 2 && !(root.getCropProgress && root.getCropProgress(state, plot, now).ready);
    if (!canMove && !canRipe) return; action = document.createElement("div"); action.id = "r75aPlotAction"; action.className = "r75a-plot-action";
    if (canMove) { const b = document.createElement("button"); b.type = "button"; b.textContent = "把光折到這裡"; b.onclick = function () { refract(state, i, Date.now()); saveRefresh(); }; action.appendChild(b); }
    if (canRipe) { const b = document.createElement("button"); b.type = "button"; b.textContent = "催熟（用 2 點陽光）"; b.onclick = function () { ripen(state, i, Date.now()); saveRefresh(); }; action.appendChild(b); }
    const point = tilePoint(state, i); world.appendChild(action); action.style.left = (point ? point.left + point.size / 2 : (selected.x + 0.5) * 48) + "px"; action.style.top = (point ? point.top - 8 : selected.y * 48 - 8) + "px";
  }
  function openRack(state) {
    let panel = document.getElementById("r75aRackPanel"); if (panel) panel.remove(); panel = ensureNode("r75aRackPanel", "r75a-rack-panel"); const status = rackStatus(state, Date.now());
    if (status.empty) panel.innerHTML = `<div class="r75a-rack-head"><b>農舍曬架</b><button type="button" data-close>關閉</button></div><p>放入 2 份作物和 1 點陽光，30 秒後收成日曬乾貨。</p><div class="r75a-rack-choices">${Object.values(DRIED).map((d) => `<button type="button" data-dry="${d.cropId}"><img src="${d.icon}${root.FARM_VERSION_QUERY || ""}" alt="">${C.CROPS[d.cropId].name} 2 份</button>`).join("")}</div>`;
    else panel.innerHTML = `<div class="r75a-rack-head"><b>農舍曬架</b><button type="button" data-close>關閉</button></div><img class="r75a-rack-art" src="assets/generated/content-r75/drying_rack_full.png${root.FARM_VERSION_QUERY || ""}" alt="鋪滿作物的曬架"><p>${status.ready ? "已曬好，可以收了。" : `還要 ${Math.ceil(status.remainingMs / 1000)} 秒`}</p><button type="button" data-collect ${status.ready ? "" : "disabled"}>收下日曬乾貨</button>`;
    panel.querySelector("[data-close]").onclick = function () { panel.remove(); };
    panel.querySelectorAll("[data-dry]").forEach((b) => { b.onclick = function () { const r = startDrying(state, b.dataset.dry, Date.now()); if (!r.ok) root.alert && root.alert(r.reason === "items" ? "作物不足 2 份。" : r.reason === "sunlight" ? "陽光不足 1 點。" : "曬架正在使用。 "); else { saveRefresh(); openRack(state); } }; });
    const collect = panel.querySelector("[data-collect]"); if (collect) collect.onclick = function () { collectDrying(state, Date.now()); saveRefresh(); openRack(state); };
  }

  const API = { PREVIEW_MS, DRYING_MS, TRAITS, TRAIT_INFO, DRIED, normalize, bottleCapacity, mirrorLimit, sunlight, addSunlight, spendSunlight, trait, traitInfo, resetPlot, recordExposure, settleBeam, harvestEffects, catchSun, canRefract, refract, ripen, buyMirror, buyBottle, driedDef, driedItemIds, startDrying, updateRack, collectDrying, rackStatus, festivalBonus };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else {
    const baseGetItemDef = root.getItemDef;
    if (typeof baseGetItemDef === "function") root.getItemDef = function (id) { return baseGetItemDef(id) || driedDef(id); };
    root.FarmSunplay = API; initUI();
  }
})(typeof window !== "undefined" ? window : globalThis);
