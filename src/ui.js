/* =========================================================================
 * ui.js — DOM 渲染與互動（瀏覽器專用）
 * 依賴 config.js / game.js / state.js 先載入。
 * 渲染原則：畫面從 state + config 推導；計時靠 Date.now() 與 plantedAt。
 * ========================================================================= */
(function () {
  "use strict";
  const G = window;          // game.js 把函式掛在 window
  const CROP_SHEET = window.CROP_SHEET;
  const ASSET_VERSION_QUERY = window.FARM_VERSION_QUERY || "";
  const assetUrl = (path) => path + ASSET_VERSION_QUERY;
  const ASSETS = {
    crops: assetUrl("assets/generated/crop-growth.png"),
    terrain: assetUrl("assets/generated/terrain-tileset.png"),
    icons: assetUrl("assets/generated/ui-icons.png"),
    // 角色圖：優先用去背 cutout，失敗退原圖
    actions: assetUrl("assets/generated/characters/miri-rowan-farm-actions-cutout.png"),
    actionsRaw: assetUrl("assets/generated/characters/miri-rowan-farm-actions.png"),
    walk: assetUrl("assets/generated/characters/miri-rowan-walk-cycle-cutout.png"),
    walkRaw: assetUrl("assets/generated/characters/miri-rowan-walk-cycle.png"),
  };

  let state = null;
  let selectedSeed = "wheat";
  let selectedLetterId = null;
  let spritesReady = false;
  let lastOrderSig = "";
  let lastAssistantSig = "";
  let saveTimer = null;
  let selectedTileId = null;
  let pendingTouchFarmAction = null;
  let lastTouchMapAt = 0;
  let lastMapPointer = null;
  let moveTimer = null;
  let atlasReady = false;
  let journalDetailSelection = null;
  let perfMonitorStarted = false;
  let perfAvgFps = 60;
  let perfLowFrames = 0;
  let perfStableFrames = 0;
  let perfAutoLow = false;
  let perfLastDowngradeReason = "尚未降級";
  const perfEventHistory = [];
  let pwaRegistration = null;
  let pwaWaitingWorker = null;
  let pwaUpdateStatus = "";
  let lastModalFocus = null;
  const plotEls = []; // 農地格 DOM 快取
  const tileEls = []; // 地圖磚 DOM 快取
  let lastFarmRenderAt = 0;
  let lastMapRenderAt = 0;
  let lastAssistantRenderAt = 0;
  let perfNeedsBaseline = false;
  let seedDrawerOpen = false;
  let recentSeeds = [];
  let sceneControlBound = false;
  let dpadRepeatTimer = null;
  let questDockExpanded = false;
  const sideListExpanded = {};
  let lastMapFitSig = "";

  const $ = (id) => document.getElementById(id);
  const now = () => Date.now();
  const escapeHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
  const uiIcon = (slug, extra) => `<span class="ui-icon i-${String(slug).replace(/_/g, "-")}${extra ? " " + extra : ""}" aria-hidden="true"></span>`;
  const TOOL_UI_ICONS = { hand: "tool_plant", water: "tool_water", clear: "tool_clear", build: "tool_build", inspect: "tool_inspect" };
  const OFFLINE_SUMMARY_MIN_MS = 5 * 60 * 1000;
  const MAP_POINTER_SEQUENCE_MAX_AGE_MS = 350;
  const LEGACY_TOUCH_CLICK_WINDOW_MS = 350;
  const SAVE_BACKUP_SUFFIX = "_backup_r31";
  const PWA_CACHE_VERSION = window.FARM_CACHE_VERSION || "r70-20260719-1";
  const PWA_AUTO_RELOAD_WINDOW_MS = 15000;
  const PWA_AUTO_RELOAD_SESSION_KEY = "pixelFarmPwaAutoReloaded";

  // ---------- 物品/建材顯示 ----------
  const FX_MAX_PARTICLES = 28;
  const FX_MAX_NODES = 72;
  const FX_SEASON_COLORS = {
    "春": "rgba(255, 214, 168, .44)",
    "夏": "rgba(255, 235, 142, .38)",
    "秋": "rgba(238, 155, 82, .40)",
    "冬": "rgba(188, 225, 255, .42)",
  };
  const cropReadySeen = new Set();
  let harvestCombo = 0;
  let harvestComboTimer = null;
  let audioCtx = null;
  let audioUnlocked = false;

  function itemDef(id) { return window.getItemDef ? window.getItemDef(id) : (window.CROPS[id] || (window.PRODUCTS || {})[id]); }
  function itemEmoji(id) { const d = itemDef(id); if (d) return d.emoji; const m = (window.MATERIALS || {})[id]; if (m) return m.emoji; const c = (window.COLLECTIBLES || {})[id]; return c ? c.emoji : "❔"; }
  function itemName(id) { const d = itemDef(id); if (d) return d.name; const m = (window.MATERIALS || {})[id]; if (m) return m.name; const c = (window.COLLECTIBLES || {})[id]; return c ? c.name : id; }

  // ---------- 工具 ----------
  function fmtTime(ms) {
    const s = Math.ceil(ms / 1000);
    if (s < 60) return s + "s";
    const m = Math.floor(s / 60), r = s % 60;
    if (m < 60) return m + "m" + (r ? " " + r + "s" : "");
    const h = Math.floor(m / 60), rm = m % 60;
    return h + "h" + (rm ? " " + rm + "m" : "");
  }
  function fmtNum(n) {
    if (n < 1000) return "" + n;
    if (n < 1e6) return (n / 1000).toFixed(n < 1e4 ? 1 : 0) + "k";
    return (n / 1e6).toFixed(1) + "M";
  }
  function fmtDate(ms) {
    if (!ms) return "尚未發現";
    try {
      return new Date(ms).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "已記錄";
    }
  }
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    $("toast-zone").appendChild(t);
    setTimeout(() => t.remove(), 2100);
  }
  function floatText(x, y, text, color) {
    if (!shouldUseJuiceFx()) return;
    const f = document.createElement("div");
    f.className = "float"; f.textContent = text; f.style.color = color || "#fff";
    f.style.left = x + "px"; f.style.top = y + "px";
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }
  function reducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
  }
  function shouldUseJuiceFx() {
    return !reducedMotion() && !isLowPerformanceTier();
  }
  function rootFxLayer() {
    let layer = $("screenFxLayer");
    if (!layer && document.body) {
      layer = document.createElement("div");
      layer.id = "screenFxLayer";
      layer.setAttribute("aria-hidden", "true");
      document.body.appendChild(layer);
    }
    return layer;
  }
  function trimFxLayer(layer, room) {
    if (!layer || !layer.children) return;
    const keepRoom = Math.max(0, room || 0);
    while (layer.children.length + keepRoom > FX_MAX_NODES) {
      const first = layer.children[0];
      if (!first) break;
      const before = layer.children.length;
      first.remove();
      if (layer.children.length === before) break;
    }
  }
  function removeFxNode(el, ms) {
    if (!el) return;
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      el.remove();
    };
    try { el.addEventListener("animationend", cleanup, { once: true }); } catch (e) {}
    setTimeout(cleanup, ms);
  }
  function elementCenter(el) {
    if (!el || !el.getBoundingClientRect) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }
  function tileCenter(tileId) {
    return elementCenter(tileElOf(tileId));
  }
  function screenBurst(x, y, glyphs, opts) {
    if (!shouldUseJuiceFx()) return;
    const layer = rootFxLayer(); if (!layer) return;
    const list = Array.isArray(glyphs) ? glyphs : [glyphs || "*"];
    const count = Math.min((opts && opts.count) || 10, FX_MAX_PARTICLES);
    trimFxLayer(layer, count);
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "juice-particle" + (opts && opts.className ? " " + opts.className : "");
      p.textContent = list[i % list.length];
      const angle = (-105 + Math.random() * 210) * Math.PI / 180;
      const dist = ((opts && opts.distance) || 54) * (0.55 + Math.random() * 0.75);
      p.style.left = x + "px";
      p.style.top = y + "px";
      p.style.setProperty("--jx", Math.cos(angle) * dist + "px");
      p.style.setProperty("--jy", Math.sin(angle) * dist - Math.random() * 18 + "px");
      p.style.setProperty("--jr", (Math.random() * 120 - 60).toFixed(0) + "deg");
      p.style.animationDelay = (Math.random() * 55).toFixed(0) + "ms";
      layer.appendChild(p);
      removeFxNode(p, 980);
    }
  }
  function popCoinHud() {
    if (!shouldUseJuiceFx()) return;
    const coin = document.querySelector(".res.coins");
    if (!coin) return;
    coin.classList.remove("coin-pop");
    void coin.offsetWidth;
    coin.classList.add("coin-pop");
    setTimeout(() => coin.classList.remove("coin-pop"), 360);
  }
  function flyCoinsToHud(x, y, count) {
    if (!shouldUseJuiceFx()) return;
    popCoinHud();
    const target = document.querySelector(".res.coins");
    const layer = rootFxLayer();
    if (!target || !layer) return;
    const end = elementCenter(target);
    const n = Math.min(count || 3, 8);
    trimFxLayer(layer, n);
    for (let i = 0; i < n; i++) {
      const c = document.createElement("div");
      c.className = "juice-coin";
      c.textContent = "\ud83e\ude99";
      const sx = x + (Math.random() * 28 - 14);
      const sy = y + (Math.random() * 18 - 9);
      c.style.left = sx + "px";
      c.style.top = sy + "px";
      c.style.setProperty("--tx", (end.x - sx) + "px");
      c.style.setProperty("--ty", (end.y - sy) + "px");
      c.style.animationDelay = (i * 45) + "ms";
      layer.appendChild(c);
      removeFxNode(c, 900);
    }
  }
  function harvestComboText(x, y) {
    if (!shouldUseJuiceFx()) return;
    harvestCombo++;
    if (harvestComboTimer) clearTimeout(harvestComboTimer);
    harvestComboTimer = setTimeout(() => { harvestCombo = 0; harvestComboTimer = null; }, 1400);
    if (harvestCombo <= 1) return;
    const layer = rootFxLayer(); if (!layer) return;
    const el = document.createElement("div");
    el.className = "combo-float";
    el.textContent = "combo x" + harvestCombo;
    el.style.left = x + "px";
    el.style.top = (y - 28) + "px";
    trimFxLayer(layer, 1);
    layer.appendChild(el);
    removeFxNode(el, 820);
  }
  function screenBurstFromEl(el, glyphs, opts) {
    const c = elementCenter(el);
    screenBurst(c.x, c.y, glyphs, opts);
    return c;
  }
  function cropHarvestFx(tileId, crop, added) {
    const c = tileCenter(tileId);
    screenBurst(c.x, c.y, [crop && crop.emoji ? crop.emoji : "\ud83c\udf3e"], { count: Math.min(12, 5 + (added || 1)), distance: 62 });
    flyCoinsToHud(c.x, c.y, 4);
    harvestComboText(c.x, c.y);
  }
  function waterSplashFx(tileId) {
    const c = tileCenter(tileId);
    screenBurst(c.x, c.y, ["\ud83d\udca7"], { count: 7, distance: 36, className: "water-drop-particle" });
  }
  function softFlashAt(tileId) {
    if (!shouldUseJuiceFx()) return;
    const el = tileElOf(tileId); if (!el) return;
    const f = document.createElement("div");
    f.className = "mature-flash";
    el.appendChild(f);
    removeFxNode(f, 620);
  }
  function cropMatureCue(key, tileId, el) {
    if (!key) return;
    if (cropReadySeen.has(key)) return;
    cropReadySeen.add(key);
    if (!shouldUseJuiceFx()) return;
    if (el) {
      el.classList.remove("crop-mature-pop");
      void el.offsetWidth;
      el.classList.add("crop-mature-pop");
      setTimeout(() => el.classList.remove("crop-mature-pop"), 620);
    }
    softFlashAt(tileId);
  }
  function resetCropMatureCue(key) {
    if (key) cropReadySeen.delete(key);
  }
  function orderCompleteFx(anchorEl, coins) {
    const c = screenBurstFromEl(anchorEl, ["\ud83c\udfab", "\u2b50"], { count: 18, distance: 86, className: "reward-particle" });
    flyCoinsToHud(c.x, c.y, Math.min(8, Math.max(3, Math.round((coins || 0) / 20))));
  }
  function levelUpFx(anchorEl) {
    const c = screenBurstFromEl(anchorEl || document.querySelector(".res.level"), ["\u2728", "\u2b50", "\ud83c\udf31"], { count: 20, distance: 92, className: "level-particle" });
    if (!shouldUseJuiceFx()) return;
    const layer = rootFxLayer(); if (!layer) return;
    const fan = document.createElement("div");
    fan.className = "level-fanfare";
    fan.textContent = "Level up";
    fan.style.left = c.x + "px";
    fan.style.top = (c.y + 8) + "px";
    trimFxLayer(layer, 1);
    layer.appendChild(fan);
    removeFxNode(fan, 1150);
  }
  function mailArriveFx() {
    const mailbox = stationTileOf("mailbox");
    const el = mailbox ? tileElOf(mailbox) : document.querySelector('.ob[data-station="mailbox"]');
    if (el && shouldUseJuiceFx()) {
      el.classList.remove("mail-bell-ring");
      void el.offsetWidth;
      el.classList.add("mail-bell-ring");
      setTimeout(() => el.classList.remove("mail-bell-ring"), 900);
    }
    if (el) screenBurstFromEl(el, ["\ud83d\udd14", "\u2709"], { count: 8, distance: 42, className: "mail-particle" });
  }
  function seasonTransitionFx(seasonId) {
    if (!shouldUseJuiceFx()) return;
    const layer = rootFxLayer(); if (!layer) return;
    const wash = document.createElement("div");
    wash.className = "season-wash";
    wash.style.background = FX_SEASON_COLORS[seasonId] || "rgba(255, 244, 204, .35)";
    trimFxLayer(layer, 1);
    layer.appendChild(wash);
    removeFxNode(wash, 1050);
  }
  function clamp01(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
  }
  function soundVolume() {
    const settings = ensureSettings();
    return settings.soundEnabled === false ? 0 : clamp01(settings.soundVolume, 0.55);
  }
  function unlockAudio(forceResume) {
    if (!state) return;
    const settings = ensureSettings();
    if (settings.soundEnabled === false) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      audioCtx = audioCtx || new Ctx();
      if (audioCtx.resume && (!audioUnlocked || forceResume || audioCtx.state === "suspended")) audioCtx.resume().catch(() => {});
      audioUnlocked = true;
    } catch (e) {}
  }
  function setupAudioUnlock() {
    const opts = { once: true, passive: true };
    ["pointerdown", "keydown", "touchstart"].forEach((ev) => {
      try { document.addEventListener(ev, unlockAudio, opts); } catch (e) {}
    });
    try {
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && audioUnlocked) unlockAudio(true);
      });
    } catch (e) {}
    try {
      window.addEventListener("pageshow", () => {
        if (audioUnlocked) unlockAudio(true);
      });
    } catch (e) {}
  }
  function playSound(kind) {
    if (!state || ensureSettings().soundEnabled === false) return;
    const volume = soundVolume();
    if (volume <= 0) return;
    unlockAudio(true);
    const ctx = audioCtx;
    if (ctx && ctx.state === "closed") { audioCtx = null; audioUnlocked = false; return; }
    if (!ctx || !ctx.createOscillator || !ctx.createGain) return;
    const patterns = {
      plant: [[260, .035, "triangle", .65], [410, .045, "triangle", .7]],
      harvest: [[520, .035, "square", .85], [760, .045, "square", .9]],
      water: [[330, .055, "triangle", .55], [520, .045, "sine", .45]],
      feed: [[220, .04, "triangle", .55], [330, .055, "triangle", .65]],
      groom: [[640, .035, "sine", .45], [880, .04, "sine", .5]],
      coin: [[900, .035, "square", .75], [1180, .045, "square", .8]],
      order: [[520, .06, "square", .75], [780, .06, "square", .85], [1040, .08, "square", .9]],
      mail: [[740, .06, "triangle", .75], [620, .06, "triangle", .65]],
      level: [[440, .06, "triangle", .85], [660, .08, "triangle", .95], [990, .10, "square", 1]],
      ui: [[620, .025, "triangle", .38]],
    };
    const seq = patterns[kind] || patterns.coin;
    let t0 = ctx.currentTime || 0;
    seq.forEach(([freq, dur, wave, amp], idx) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave || (kind === "water" ? "triangle" : "square");
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + idx * 0.055);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.055 * volume * (amp || 1)), t0 + idx * 0.055 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + idx * 0.055 + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t0 + idx * 0.055); osc.stop(t0 + idx * 0.055 + dur + 0.02);
      } catch (e) {}
    });
  }
  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => { saveTimer = null; window.save(state); }, 600);
  }
  function focusFirstInModal(modal, preferredSelector) {
    if (!modal || typeof modal.querySelector !== "function") return;
    const target = (preferredSelector && modal.querySelector(preferredSelector)) ||
      modal.querySelector("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])");
    if (target && typeof target.focus === "function") {
      try { target.focus({ preventScroll: true }); }
      catch (e) { target.focus(); }
    }
  }
  function setModalBackgroundInert(inert) {
    const appShell = typeof document.querySelector === "function" ? document.querySelector(".wrap") : null;
    if (appShell) {
      if (inert) {
        if (typeof appShell.setAttribute === "function") appShell.setAttribute("inert", "");
        appShell.inert = true;
      } else {
        if (typeof appShell.removeAttribute === "function") appShell.removeAttribute("inert");
        appShell.inert = false;
      }
    }
    if (document.body && document.body.classList) document.body.classList.toggle("modal-open", !!inert);
  }
  function openModal(id, preferredSelector) {
    const modal = $(id); if (!modal) return;
    lastModalFocus = document.activeElement || lastModalFocus;
    document.querySelectorAll(".modal.show").forEach((open) => {
      if (open !== modal) open.classList.remove("show");
    });
    if (typeof modal.setAttribute === "function") {
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
    }
    modal.classList.add("show");
    setModalBackgroundInert(true);
    focusFirstInModal(modal, preferredSelector);
  }
  function closeModal(id) {
    const modal = $(id); if (!modal) return false;
    modal.classList.remove("show");
    if (typeof document.querySelector !== "function" || !document.querySelector(".modal.show")) {
      setModalBackgroundInert(false);
    }
    if (lastModalFocus && typeof lastModalFocus.focus === "function") {
      setTimeout(() => lastModalFocus.focus(), 0);
    }
    return true;
  }
  function closeOpenModal() {
    const modal = typeof document.querySelector === "function" ? document.querySelector(".modal.show") : null;
    return modal && modal.id ? closeModal(modal.id) : false;
  }

  // ---------- 資源列 ----------
  function renderResBar() {
    const cap = G.storageCapacity(state), used = G.storageUsed(state);
    const lvXp = window.LEVEL_XP[state.level - 1] || 0;
    const nextXp = window.LEVEL_XP[state.level] != null ? window.LEVEL_XP[state.level] : null;
    const xpInLv = state.xp - lvXp;
    const xpNeed = nextXp != null ? nextXp - lvXp : 1;
    const xpPct = nextXp != null ? Math.min(100, (xpInLv / xpNeed) * 100) : 100;
    const wId = G.currentWeather(state, now());
    const w = window.WEATHER[wId];
    const weatherUnlocked = state.level >= window.WEATHER_UNLOCK_LEVEL;
    const seasonUnlocked = state.level >= (window.SEASON_UNLOCK_LEVEL || 6);
    const sId = G.currentSeason ? G.currentSeason(state, now()) : "春";
    const season = (window.SEASONS || []).find((s) => s.id === sId) || { id: sId, name: sId, icon: "🌱" };
    const seasonLeft = seasonUnlocked && state.season && state.season.untilMs ? fmtTime(Math.max(0, state.season.untilMs - now())) : "";
    $("resBar").innerHTML = `
      <div class="res coins">${uiIcon("system_coin")} ${fmtNum(state.coins)}</div>
      <div class="res level">${uiIcon("system_xp")}
        <div><div>Lv ${state.level}</div><div class="xp-track"><div class="xp-fill" style="width:${xpPct}%"></div></div></div>
        <span class="sub">${nextXp != null ? xpInLv + "/" + xpNeed : "MAX"}</span>
      </div>
      <div class="res">${uiIcon("system_storage")} ${used}<span class="sub">/${cap}</span></div>
      ${weatherUnlocked ? `<div class="res weather" title="${w.name}"><span class="ic">${w.icon}</span><span class="sub">${w.name}</span></div>` : ""}
      ${seasonUnlocked ? `<div class="res season" title="${season.name}"><span class="ic">${season.icon}</span><span class="sub season-chip"><span>${season.name}</span><small>${seasonLeft}</small></span></div>` : ""}
      ${matChips()}`;
  }
  // 建材顯示（>0 才顯示，省空間）
  function matChips() {
    const mats = state.materials || {};
    return Object.keys(window.MATERIALS).filter((k) => (mats[k] || 0) > 0)
      .map((k) => `<div class="res mat" title="${window.MATERIALS[k].name}"><span class="ic">${window.MATERIALS[k].emoji}</span> ${mats[k]}</div>`).join("");
  }

  // ---------- 種子選擇 ----------
  function rememberSeedUse(id) {
    if (!id || id === selectedSeed) return;
    recentSeeds = [selectedSeed].concat(recentSeeds.filter((x) => x && x !== id && x !== selectedSeed)).slice(0, 4);
  }
  function chooseSeed(id) {
    const c = window.CROPS[id];
    if (!c || c.unlockLevel > state.level) return;
    clearTouchFarmPreview();
    hideBuildWheel();
    hideObjectBubble();
    rememberSeedUse(id);
    selectedSeed = id;
    state.selectedSeed = id;
    seedDrawerOpen = false;
    renderSeeds();
    renderSceneActionsForSelection();
    scheduleSave();
  }
  function seedChip(c, seasonUnlocked, sId, compact) {
    const unlocked = c.unlockLevel <= state.level;
    const el = document.createElement("div");
    const inSeason = seasonUnlocked && c.season && c.season === sId;
    const seasonBadge = c.season ? `<span class="seed-season ${inSeason ? "active" : ""}">${inSeason ? "x1.15" : escapeHtml(c.season)}</span>` : "";
    el.className = "seed" + (selectedSeed === c.id && unlocked ? " sel" : "") + (unlocked ? "" : " locked");
    el.dataset.seedId = c.id;
    el.title = c.name;
    el.innerHTML = unlocked
      ? `<span class="se">${uiIcon("crop_" + c.id)}</span><span class="sn">${escapeHtml(c.name)}</span><span class="sc">${c.seedCost}</span>${compact ? "" : seasonBadge}`
      : `<span class="se">?</span><span class="sn">${escapeHtml(c.name)}</span><span class="sc">Lv${c.unlockLevel}</span>${compact ? "" : seasonBadge}`;
    if (unlocked) el.onclick = () => chooseSeed(c.id);
    return el;
  }
  function renderSeeds() {
    const row = $("seedRow"); if (!row) return;
    row.innerHTML = "";
    const crops = Object.values(window.CROPS);
    const seasonUnlocked = state.level >= (window.SEASON_UNLOCK_LEVEL || 6);
    const sId = G.currentSeason ? G.currentSeason(state, now()) : "";
    const unlockedIds = crops.filter((c) => c.unlockLevel <= state.level).map((c) => c.id);
    if (!window.CROPS[selectedSeed] || unlockedIds.indexOf(selectedSeed) === -1) selectedSeed = unlockedIds[0] || "wheat";
    const quickIds = [];
    const addQuick = (id) => {
      if (id && quickIds.indexOf(id) === -1 && window.CROPS[id] && window.CROPS[id].unlockLevel <= state.level) quickIds.push(id);
    };
    addQuick(selectedSeed);
    recentSeeds.forEach(addQuick);
    unlockedIds.forEach((id) => { if (quickIds.length < 5) addQuick(id); });

    const quick = document.createElement("div");
    quick.className = "seed-quickbar";
    quickIds.slice(0, 5).forEach((id) => quick.appendChild(seedChip(window.CROPS[id], seasonUnlocked, sId, true)));
    const more = document.createElement("div");
    more.className = "seed more" + (seedDrawerOpen ? " sel" : "");
    more.title = "全部種子";
    more.innerHTML = `<span class="se">${seedDrawerOpen ? "×" : "+"}</span><span class="sn">全部</span>`;
    more.onclick = () => { seedDrawerOpen = !seedDrawerOpen; renderSeeds(); };
    quick.appendChild(more);
    row.appendChild(quick);

    if (seedDrawerOpen) {
      const drawer = document.createElement("div");
      drawer.className = "seed-drawer";
      crops.forEach((c) => drawer.appendChild(seedChip(c, seasonUnlocked, sId, false)));
      row.appendChild(drawer);
    }
  }

  // ---------- 側欄分頁 ----------
  function switchTab(name) {
    document.querySelectorAll(".side-tab").forEach((b) => {
      const selected = b.dataset.tab === name;
      b.classList.toggle("sel", selected);
      if (b.setAttribute) b.setAttribute("aria-selected", selected ? "true" : "false");
    });
    document.querySelectorAll(".side-pane").forEach((p) => p.classList.toggle("sel", p.dataset.pane === name));
    if (name === "story") renderStory();
    if (name === "journal") renderJournal();
  }
  function setupSideTabs() {
    const mobileTabsQuery = (typeof window.matchMedia === "function")
      ? window.matchMedia("(max-width: 859px), (any-pointer: coarse) and (max-height: 480px)")
      : { matches: false };
    const panel = (typeof document.querySelector === "function") ? document.querySelector(".side-panel") : null;
    document.querySelectorAll(".side-tab").forEach((b) => {
      if (!b.getAttribute || !b.getAttribute("aria-label")) b.setAttribute && b.setAttribute("aria-label", "切換到" + (b.textContent || "").trim() + "分頁");
      b.onclick = () => {
        if (hasOpenModal()) return;
        // R69：手機頁籤為固定底欄——點已選中的頁籤＝收合/展開抽片，保持地圖為主畫面
        if (mobileTabsQuery.matches && panel && b.classList.contains("sel")) {
          panel.classList.toggle("panes-collapsed");
          return;
        }
        if (panel) panel.classList.remove("panes-collapsed");
        switchTab(b.dataset.tab);
      };
    });
    // R69：手機初始收合抽片（地圖優先）；桌機不動
    if (mobileTabsQuery.matches && panel) panel.classList.add("panes-collapsed");
    // R70：點抽片外（地圖等處）收合抽片；捕獲相位吞掉該次點擊，避免收合同時觸發地圖動作
    if (typeof document.addEventListener === "function") document.addEventListener("pointerdown", (ev) => {
      if (!mobileTabsQuery.matches || !panel || panel.classList.contains("panes-collapsed")) return;
      if (hasOpenModal()) return;
      if (ev.target && ev.target.closest && (ev.target.closest(".side-panel") || ev.target.closest(".side-tabs") || ev.target.closest(".toolbar"))) return;
      panel.classList.add("panes-collapsed");
      ev.stopPropagation(); ev.preventDefault();
    }, true);
  }
  function visibleListItems(key, items, limit) {
    const all = Array.isArray(items) ? items : [];
    return sideListExpanded[key] ? all : all.slice(0, limit);
  }
  function sideListMoreHtml(key, total, shown) {
    if (total <= shown) return "";
    return `<button type="button" class="btn ghost small side-list-more" data-list-more="${escapeHtml(key)}" aria-label="顯示更多項目">顯示更多 ${total - shown}</button>`;
  }
  function compactRowsHtml(key, rows, limit) {
    const all = (rows || []).filter(Boolean);
    const visible = visibleListItems(key, all, limit);
    return visible.join("") + sideListMoreHtml(key, all.length, visible.length);
  }
  function bindListMore(container, renderFn) {
    if (!container) return;
    container.querySelectorAll("[data-list-more]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        sideListExpanded[btn.dataset.listMore] = true;
        renderFn();
      };
    });
  }
  function appendListMore(container, key, total, shown, renderFn) {
    if (!container || total <= shown) return;
    if (typeof container.insertAdjacentHTML === "function") {
      container.insertAdjacentHTML("beforeend", sideListMoreHtml(key, total, shown));
      bindListMore(container, renderFn);
      return;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn ghost small side-list-more";
    btn.dataset.listMore = key;
    btn.textContent = "顯示更多 " + (total - shown);
    btn.onclick = () => { sideListExpanded[key] = true; renderFn(); };
    container.appendChild(btn);
  }

  // 幫手自動化捷徑：早期隱藏（初期動作必須走到目標執行）；升「幫手機器人」後才解鎖
  function syncHud() {
    const ga = $("globalActions"); if (!ga) return;
    const unlocked = (state.upgrades && state.upgrades.helperLevel > 0);
    ga.style.display = unlocked ? "flex" : "none";
  }
  // Stage 6：主角性別按鈕標籤
  function syncGenderBtn() {
    const b = $("genderToggle"); if (!b) return;
    b.textContent = state.gender === "m" ? "男主角" : "女主角";
  }

  // ---------- 工具列（roadmap：工具模式）----------
  function currentTool() { return (state.interaction && state.interaction.tool) || "hand"; }
  function setTool(t) { clearTouchFarmPreview(); hideBuildWheel(); hideObjectBubble(); state.interaction.tool = t; renderToolbar(); renderQuestDock(); renderSceneActionsForSelection(); $("farmHint").innerHTML = uiIcon(TOOL_UI_ICONS[t]) + escapeHtml(window.TOOLS[t].desc); scheduleSave(); }
  function renderToolbar() {
    const bar = $("toolBar"); if (!bar) return; bar.innerHTML = "";
    window.TOOL_ORDER.forEach((id) => {
      const t = window.TOOLS[id];
      const el = document.createElement("div");
      el.className = "tool" + (currentTool() === id ? " sel" : "");
      el.title = t.desc;
      el.innerHTML = `<span class="ti">${uiIcon(TOOL_UI_ICONS[id])}</span><span class="tn">${t.name}</span>`;
      el.onclick = () => setTool(id);
      bar.appendChild(el);
    });
  }

  // ---------- 農場 ----------
  function buildFarm() {
    const farm = $("farm"); farm.innerHTML = ""; plotEls.length = 0;
    for (let i = 0; i < window.GAME.maxPlots; i++) {
      const el = document.createElement("div");
      el.className = "plot";
      el.innerHTML = `<div class="crop-sprite" style="display:none"></div><div class="crop-emoji" style="display:none"></div>
        <div class="grow-bar" style="display:none"><div class="grow-fill"></div></div>
        <div class="timer" style="display:none"></div><div class="ready-tag" style="display:none">成熟!</div>`;
      el.addEventListener("click", () => onPlotClick(i));
      farm.appendChild(el);
      plotEls.push(el);
    }
  }
  function emojiForStage(crop, stage) {
    if (stage <= 1) return { e: "🌱", s: stage === 0 ? 0.55 : 0.75 };
    return { e: crop.emoji, s: stage === 2 ? 0.7 : stage === 3 ? 0.92 : 1.1 };
  }
  function updateFarm(t) {
    if (!state || plotEls.length === 0) return;
    const active = G.activePlotCount(state);
    for (let i = 0; i < plotEls.length; i++) {
      const el = plotEls[i];
      const sprite = el.querySelector(".crop-sprite");
      const emoji = el.querySelector(".crop-emoji");
      const bar = el.querySelector(".grow-bar");
      const fill = el.querySelector(".grow-fill");
      const timer = el.querySelector(".timer");
      const readyTag = el.querySelector(".ready-tag");

      // 鎖定格
      if (i >= active) {
        el.className = "plot locked";
        sprite.style.display = emoji.style.display = bar.style.display = timer.style.display = readyTag.style.display = "none";
        continue;
      }
      const plot = state.plots[i];
      if (!plot || !plot.cropId) {
        el.className = "plot empty";
        resetCropMatureCue("plot:" + i);
        sprite.style.display = emoji.style.display = bar.style.display = timer.style.display = readyTag.style.display = "none";
        continue;
      }
      const crop = window.CROPS[plot.cropId];
      const prog = G.getCropProgress(state, plot, t);
      if (prog.ready) cropMatureCue("plot:" + i, null, el);
      else resetCropMatureCue("plot:" + i);
      el.className = "plot" + (prog.ready ? " ready" : " growing") + (prog.wet && !prog.ready ? " wet" : "");
      // 濕土水滴標記
      let wd = el.querySelector(".wet-drop");
      if (prog.wet && !prog.ready) { if (!wd) { wd = document.createElement("div"); wd.className = "wet-drop"; wd.textContent = "💧"; el.appendChild(wd); } wd.style.display = "block"; }
      else if (wd) wd.style.display = "none";

      if (state.useSprites && spritesReady && !crop.sheet && !crop.emojiOnly && Number.isFinite(crop.spriteRow)) {
        sprite.style.display = "block"; emoji.style.display = "none";
        const x = (prog.stage / (CROP_SHEET.cols - 1)) * 100;
        const y = (crop.spriteRow / (CROP_SHEET.rows - 1)) * 100;
        sprite.style.backgroundPosition = x + "% " + y + "%";
      } else {
        sprite.style.display = "none"; emoji.style.display = "flex";
        const em = emojiForStage(crop, prog.stage);
        emoji.textContent = em.e; emoji.style.transform = "scale(" + em.s + ")";
      }
      if (prog.ready) {
        bar.style.display = "none"; timer.style.display = "none"; readyTag.style.display = "block";
      } else {
        bar.style.display = "block"; readyTag.style.display = "none";
        fill.style.width = (prog.ratio * 100).toFixed(1) + "%";
        timer.style.display = "block"; timer.textContent = fmtTime(prog.remainingMs);
      }
    }
  }
  function onPlotClick(i) {
    const t = now();
    if (i >= G.activePlotCount(state)) { toast("🔒 升級「開墾農地」解鎖更多格"); return; }
    const plot = state.plots[i];
    const rect = plotEls[i].getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const tool = currentTool();

    // 工具路由：查看 / 澆水 / 清除·建造（農地不適用）
    if (tool === "inspect") {
      if (!plot.cropId) { toast("🟫 空農地，選「👆手」種植"); return; }
      const prog = G.getCropProgress(state, plot, t); const crop = window.CROPS[plot.cropId];
      toast(`${crop.emoji} ${crop.name}・${prog.ready ? "✅ 可收成" : "⏳ " + fmtTime(prog.remainingMs)}${prog.wet ? "・💧濕土加速中" : ""}`);
      return;
    }
    if (tool === "water") {
      const r = G.waterPlot(state, i, t);
      if (r.ok) { playAction("water"); playSound("water"); screenBurst(cx, cy, ["\ud83d\udca7"], { count: 7, distance: 36, className: "water-drop-particle" }); floatText(cx, cy, "💧", "#bfe6f7"); afterChange(false); }
      else if (r.reason === "empty") toast("💧 只有種了作物的乾土需要澆水");
      else if (r.reason === "ready") toast("已成熟，不需澆水");
      else if (r.reason === "already_wet") toast("💧 這格已是濕土");
      return;
    }
    if (tool === "clear" || tool === "build") { toast("這裡是農地，「" + window.TOOLS[tool].name + "」請用在右下方擴張地圖"); return; }

    // hand（預設）：種植 / 收成
    if (!plot.cropId) {
      const r = G.plant(state, i, selectedSeed, t);
      if (!r.ok) {
        if (r.reason === "no_coins") toast("🪙 金幣不足，先賣點作物");
        else if (r.reason === "locked_crop") toast("🔒 此作物尚未解鎖");
        return;
      }
      playAction("sow");
      playSound("plant");
      afterChange(true);
    } else {
      const prog = G.getCropProgress(state, plot, t);
      if (!prog.ready) { toast("⏳ 還要 " + fmtTime(prog.remainingMs)); return; }
      const crop = window.CROPS[plot.cropId];
      const r = G.harvest(state, i, t);
      if (r.ok) {
        playAction("harvest");
        playSound("harvest"); playSound("coin"); screenBurst(cx, cy, [crop.emoji], { count: Math.min(12, 5 + r.added), distance: 58 }); flyCoinsToHud(cx, cy, 4); harvestComboText(cx, cy);
        floatText(cx, cy, "+" + r.added + " " + crop.emoji, "#dff5c8");
        if (r.lost > 0) toast("📦 倉庫滿了，損失 " + r.lost + " " + crop.name);
        if (r.leveled > 0) { levelUpFx(plotEls[i]); playSound("level"); toast("🎉 升到 Lv " + state.level + "！"); }
        afterChange(true);
      }
    }
  }

  // ---------- 訂單 ----------
  function orderSig() { return state.orders.map((o) => o.id).join("|") + "#" + state.orderStreak; }
  function renderOrders() {
    const box = $("orders"); box.innerHTML = "";
    const streakMul = 1 + Math.min(window.ORDER_STREAK_CAP, state.orderStreak * window.ORDER_STREAK_BONUS);
    $("streakHint").innerHTML = state.orderStreak > 0
      ? `<span class="streak-badge">🔥 連單 ${state.orderStreak}（獎金 ×${streakMul.toFixed(2)}）</span>` : "";
    if (state.orders.length === 0) { box.innerHTML = `<div style="font-size:12px;color:var(--ink-soft)">尚無訂單…</div>`; return; }
    const ordered = state.orders.slice().sort((a, b) => {
      const ca = G.canFulfill(state, a) ? 1 : 0;
      const cb = G.canFulfill(state, b) ? 1 : 0;
      if (ca !== cb) return cb - ca;
      return (a.expiresAt || 0) - (b.expiresAt || 0);
    });
    const visibleOrders = visibleListItems("orders", ordered, 4);
    visibleOrders.forEach((o) => {
      const rarity = window.ORDER_RARITY[o.rarity];
      const pay = G.orderPayout(state, o);
      const can = G.canFulfill(state, o);
      const narrative = G.orderNarrative ? G.orderNarrative(state, o) : null;
      const wantsHtml = Object.entries(o.wants).map(([cid, q]) => {
        const have = state.storage.items[cid] || 0;
        const ok = have >= q;
        return `<span class="w ${ok ? "have" : "miss"}">${itemEmoji(cid)}${have}/${q}</span>`;
      }).join("");
      const el = document.createElement("div");
      const isFestival = o.rarity === "festival";
      el.className = "order" + (isFestival ? " festival" : "");
      if (narrative) el.dataset.npc = narrative.npcId;
      el.innerHTML = `
        <div class="o-rarity" style="background:${rarity.color}"></div>
        <div class="o-body">
          ${isFestival ? `<div class="festival-tag">🏮四季物產</div>` : ""}
          ${narrative ? `<div class="o-client" data-audit="order-npc">${narrative.npcName}｜${narrative.npcTitle}</div>
          <div class="o-flavor">${narrative.offer}</div>` : ""}
          <div class="o-wants">${wantsHtml}</div>
          <div class="o-reward">🪙 ${fmtNum(pay.coins)} · <span class="xp">⭐ ${pay.xp}</span></div>
          <div class="o-meta">${rarity.label} · ⏳ ${fmtTime(Math.max(0, o.expiresAt - now()))}</div>
        </div>
        <div class="o-actions">
          <button class="btn buy small ful" ${can ? "" : "disabled"}>交付</button>
          <button class="btn ghost small trash">丟棄</button>
        </div>`;
      el.querySelector(".ful").onclick = () => {
        const r = G.fulfillOrder(state, o.id, now());
        if (r.ok) { G.advanceStory(state, "deliver"); orderCompleteFx(el, r.coins); playSound("order"); playSound("coin"); toast((narrative ? narrative.npcName + "：「" + narrative.thanks + "」 +" : "📜 訂單完成！+") + fmtNum(r.coins) + " 🪙" + (r.streakMul > 1 ? " (×" + r.streakMul.toFixed(2) + ")" : "")); afterChange(true); renderOrders(); }
        else toast("作物不足，無法交付");
      };
      el.querySelector(".trash").onclick = () => {
        G.trashOrder(state, o.id, now()); toast("🗑️ 已丟棄（連單中斷）"); afterChange(true); renderOrders();
      };
      box.appendChild(el);
    });
    appendListMore(box, "orders", ordered.length, visibleOrders.length, renderOrders);
    lastOrderSig = orderSig();
  }

  // ---------- 升級 ----------
  function renderUpgrades() {
    const box = $("upgrades"); box.innerHTML = "";
    const upgradeKeys = window.UPGRADE_ORDER.slice().sort((a, b) => {
      const na = G.nextUpgrade(state, a), nb = G.nextUpgrade(state, b);
      const ba = na && state.coins >= na.cost ? 0 : na ? 1 : 2;
      const bb = nb && state.coins >= nb.cost ? 0 : nb ? 1 : 2;
      return ba - bb;
    });
    const visibleUpgrades = visibleListItems("upgrades", upgradeKeys, 4);
    visibleUpgrades.forEach((key) => {
      const def = window.UPGRADES[key];
      const lv = state.upgrades[key];
      const max = G.upgradeMaxLevel(key);
      const next = G.nextUpgrade(state, key);
      const el = document.createElement("div");
      el.className = "up";
      el.innerHTML = `
        <div class="u-ic">${def.icon}</div>
        <div class="u-body">
          <div class="u-name">${def.name} <span class="lv">Lv ${lv}/${max}</span></div>
          <div class="u-desc">${def.desc}</div>
        </div>
        ${next
          ? `<button class="btn buy small" ${state.coins >= next.cost ? "" : "disabled"}>🪙 ${fmtNum(next.cost)}</button>`
          : `<span class="u-maxed">✓ 滿級</span>`}`;
      if (next) {
        el.querySelector("button").onclick = () => {
          const r = G.buyUpgrade(state, key);
          if (r.ok) {
            levelUpFx(el); playSound("level");
            toast(def.icon + " " + def.name + " → Lv " + r.level);
            if (key === "plotCount") buildFarm();
            afterChange(true); renderUpgrades(); renderSeeds();
          } else if (r.reason === "no_coins") toast("🪙 金幣不足");
        };
      }
      box.appendChild(el);
    });
    appendListMore(box, "upgrades", upgradeKeys.length, visibleUpgrades.length, renderUpgrades);
  }

  // ---------- 故事 / 任務（地圖驅動：state.story 任務鏈）----------
  // 第一章＝序章 6 關（主完成度面板 0/6→6/6）；第二章＝Stage 5 探索 2 關；第三章＝Stage 7 動物照護 5 關，各自另計。
  const QUEST_ORDER = ["intro_reopen_farm", "plant_wheat", "first_water", "first_harvest", "first_delivery", "clear_old_path"];
  const CHAPTER2_ORDER = (typeof window !== "undefined" && window.CHAPTER2_QUESTS) || ["repair_bridge", "explore_new_area"];
  const CHAPTER3_ORDER = (typeof window !== "undefined" && window.CHAPTER3_QUESTS) ||
    ["learn_animal_care", "feed_care_animal", "raise_affinity_happy", "collect_quality_product", "deliver_quality_order"];
  const CHAPTER4_ORDER = (typeof window !== "undefined" && window.CHAPTER4_QUESTS) ||
    ["prepare_four_seasons", "welcome_ducks", "finish_festival_order"];
  const CHAPTER5_LETTER_ORDER = (typeof window !== "undefined" && window.CHAPTER5_LETTERS) || [];
  function questStepProgress(id, completed) {
    if (completed[id]) return { done: 1, total: 1 };
    const harvested = (state.stats && state.stats.harvested) || {};
    const flags = state.flags || {};
    if (id === "plant_wheat") return { done: state.plots.some((p) => p && p.cropId === "wheat") ? 1 : 0, total: 1 };
    if (id === "first_water") return { done: state.plots.some((p) => p && p.cropId === "wheat" && (p.wateredAt || 0) >= (p.plantedAt || 1)) ? 1 : 0, total: 1 };
    if (id === "first_harvest") return { done: (harvested.wheat || 0) > 0 ? 1 : 0, total: 1 };
    if (id === "first_delivery") return { done: (state.stats && state.stats.fulfilledOrders || 0) > 0 ? 1 : 0, total: 1 };
    if (id === "clear_old_path") return { done: (state.stats && state.stats.cleared || 0) > 0 ? 1 : 0, total: 1 };
    if (id === "repair_bridge") return { done: flags.bridgeRepaired ? 1 : 0, total: 1 };
    if (id === "explore_new_area") return { done: (flags.eventsClaimed && flags.eventsClaimed.east_clearing) ? 1 : 0, total: 1 };
    if (id === "discover_east_forage") return { done: flags.eastForageDiscovered ? 1 : 0, total: 1 };
    if (id === "collect_east_forage") {
      const st = G.eastForageStatus ? G.eastForageStatus(state, now()) : null;
      const done = st ? Object.keys(st.wants).filter((k) => (st.found[k] || 0) >= st.wants[k]).length : 0;
      return { done, total: st ? Object.keys(st.wants).length : 2 };
    }
    if (id === "report_east_forage") return { done: flags.eastForageReported ? 1 : 0, total: 1 };
    if (id === "raise_affinity_happy") return { done: (state.animals || []).some((a) => Math.max(a.bestAffinity || 0, G.animalAffinity(state, a, now())) >= window.AFFINITY_HAPPY_THRESHOLD) ? 1 : 0, total: 1 };
    if (id === "collect_quality_product") return { done: G.hasCollectedQuality(state) ? 1 : 0, total: 1 };
    if (id === "deliver_quality_order") return { done: (state.stats && state.stats.qualitySold || 0) > 0 ? 1 : 0, total: 1 };
    if (id === "prepare_four_seasons") return { done: G.harvestedSeasonCount ? G.harvestedSeasonCount(state) : 0, total: 4 };
    if (id === "welcome_ducks") return { done: G.hasCollectedDuckEgg && G.hasCollectedDuckEgg(state) ? 1 : 0, total: 1 };
    if (id === "finish_festival_order") return { done: (state.stats && state.stats.festivalOrders || 0) > 0 ? 1 : 0, total: 1 };
    return { done: 0, total: 1 };
  }
  function questRow(id, completed, cur) {
    const q = window.QUESTS[id]; const done = !!completed[id]; const active = cur && cur.id === id;
    const step = questStepProgress(id, completed);
    return `<div class="quest ${done ? "done" : ""} ${active ? "active" : ""}">
      <span class="qmark">${done ? "✓" : active ? "➤" : "□"}</span>
      <span class="qtext"><span>${q.title}</span><em>${step.done}/${step.total}</em></span></div>`;
  }
  function chapter5Letters() {
    const byId = {};
    (window.LETTERS || []).forEach((l) => { byId[l.id] = l; });
    return CHAPTER5_LETTER_ORDER.map((id) => byId[id]).filter(Boolean);
  }
  function mailboxLetters() {
    return (window.LETTERS || []).slice();
  }
  function unreadLetterCount() {
    const mail = state.mail || {};
    const unlocked = mail.unlocked || {};
    const read = mail.read || {};
    return mailboxLetters().filter((l) => unlocked[l.id] && !read[l.id]).length;
  }
  function updateMailBadges() {
    const n = unreadLetterCount();
    const badge = $("storyBadge");
    if (badge) {
      badge.textContent = n > 0 ? String(n) : "";
      badge.hidden = n <= 0;
    }
    document.querySelectorAll('.ob[data-station="mailbox"]').forEach((el) => {
      el.classList.toggle("mail-unread", n > 0);
    });
  }
  function checkNewLetters(t, notify) {
    if (!G.evaluateLetters || !state) return [];
    const ids = G.evaluateLetters(state, t);
    if (ids.length && notify) {
      const first = letterById(ids[0]);
      toast("📬 " + (first && first.from ? first.from : "信箱") + "寄來一封信…");
      mailArriveFx(); playSound("mail");
      const mailbox = stationTileOf("mailbox");
      if (mailbox) focusCameraOnTile(mailbox);
    }
    if (ids.length) { renderStory(); renderJournal(); scheduleSave(); }
    updateMailBadges();
    return ids;
  }
  function letterById(id) {
    return (window.LETTERS || []).find((l) => l.id === id) || null;
  }
  function letterBodyHtml(letter) {
    const body = Array.isArray(letter.body) ? letter.body : [letter.body || ""];
    return body.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  }
  function selectLetter(id) {
    selectedLetterId = id;
    if (G.readLetter) {
      const r = G.readLetter(state, id);
      if (r && r.collectibleId === "grandma_hat") toast("🎩 取得收藏：祖母的草帽");
    }
    renderLettersModal();
    renderStory(); renderJournal(); updateMailBadges(); scheduleSave();
  }
  function sendLetterReply() {
    if (!G.replyLetter) return;
    const r = G.replyLetter(state);
    if (r.ok) {
      toast(r.wasReplied ? "📮 回信已放在信箱裡" : "📮 你把回信放進祖母留下的信箱");
      if (r.collectibleId === "seed_pouch") toast("🌱 取得收藏：祖母的種子布袋");
      renderLettersModal(); renderStory(); renderJournal(); updateMailBadges(); renderQuestDock(); scheduleSave();
    } else {
      toast("還有信沒有讀完");
    }
  }
  function seasonEventCardHtml() {
    if (!G.seasonEventStatus) return "";
    const status = G.seasonEventStatus(state, now());
    if (!status || !status.event) return "";
    const ev = status.event;
    const missing = (status.missing || []).map((m) => {
      if (m.id) return itemName(m.id) + " " + (m.have || 0) + "/" + m.need;
      if (m.anySeasonCrop) return m.anySeasonCrop + "季作物 0/" + m.need;
      if (m.any) return m.any.map(itemName).join("或");
      return "材料不足";
    }).join("、");
    const stateText = status.claimed ? "本季已完成" : status.canClaim ? "可完成" : "需要：" + (missing || "物資不足");
    return `
      <section class="season-event-card ${status.claimed ? "done" : ""}" data-audit="season-event" data-event-id="${ev.id}" data-season="${escapeHtml(ev.season || "春")}">
        <div>
          <b>${ev.icon || "🌿"} ${escapeHtml(ev.name)}</b>
          <p>${escapeHtml(ev.desc || "")}</p>
          <em>${escapeHtml(stateText)}</em>
        </div>
        <button type="button" class="btn buy small" id="seasonEventClaimBtn" data-event-id="${ev.id}" ${status.canClaim ? "" : "disabled"}>${escapeHtml(ev.actionLabel || "完成")}</button>
      </section>`;
  }
  function bindSeasonEventCard() {
    const btn = $("seasonEventClaimBtn");
    if (!btn || !G.claimSeasonEvent) return;
    btn.onclick = () => {
      const r = G.claimSeasonEvent(state, btn.dataset.eventId, now());
      if (r.ok) {
        toast((r.collectibleId ? itemEmoji(r.collectibleId) + " " : "") + r.message + (r.xp ? " +" + r.xp + " XP" : "") + (r.coins ? " +" + r.coins + " 🪙" : ""));
        renderLettersModal();
        afterChange(true);
      } else if (r.reason === "requirements") {
        toast("季節事件需要的物資不足");
        renderLettersModal();
      } else if (r.reason === "claimed") {
        toast("本季已完成這件事");
        renderLettersModal();
      }
    };
  }
  function renderLettersModal() {
    const box = $("lettersBody"); if (!box) return;
    const mail = state.mail || { unlocked: {}, read: {}, replied: false };
    const unlocked = mail.unlocked || {};
    const read = mail.read || {};
    const letters = mailboxLetters();
    const firstReadable = letters.find((l) => unlocked[l.id]) || null;
    if (!selectedLetterId || !letterById(selectedLetterId) || !unlocked[selectedLetterId]) {
      selectedLetterId = (letters.find((l) => unlocked[l.id] && !read[l.id]) || firstReadable || letters[0] || {}).id || null;
    }
    const selected = selectedLetterId ? letterById(selectedLetterId) : null;
    const selectedUnlocked = selected && unlocked[selected.id];
    const allRead = CHAPTER5_LETTER_ORDER.length > 0 && CHAPTER5_LETTER_ORDER.every((id) => read[id]);
    const rows = letters.map((l, idx) => {
      const isUnlocked = !!unlocked[l.id];
      const isRead = !!read[l.id];
      return `<button type="button" class="letter-list-item ${selectedLetterId === l.id ? "sel" : ""} ${isUnlocked ? "" : "locked"}" data-letter-id="${l.id}" ${isUnlocked ? "" : "disabled"}>
        <span>${isUnlocked ? (isRead ? "✓" : "●") : "🔒"}</span>
        <b>${idx + 1}. ${escapeHtml(l.title)}</b>
        <em>${isUnlocked ? escapeHtml(l.season || "四季") : "尚未送達"}</em>
      </button>`;
    }).join("");
    const paper = selectedUnlocked ? `
      <article class="letter-paper" data-audit="letter-paper">
        <div class="letter-meta">${escapeHtml(selected.season || "四季")} · ${escapeHtml(selected.from || "祖母")}</div>
        <h3>${escapeHtml(selected.title)}</h3>
        ${letterBodyHtml(selected)}
      </article>` : `
      <article class="letter-paper locked" data-audit="letter-paper">
        <div class="letter-meta">信箱還在等農場甦醒</div>
        <h3>尚未送達的信</h3>
        <p>修好更多地方、照顧動物、迎接四季與豐年祭，鎮長就會把祖母留下的信交到你手上。</p>
      </article>`;
    box.innerHTML = `
      ${seasonEventCardHtml()}
      <div class="letters-layout">
        <div class="letters-list" data-audit="letter-list">${rows}</div>
        <div class="letters-reader">
          ${paper}
          <div class="letters-footer">
            <span>${CHAPTER5_LETTER_ORDER.filter((id) => read[id]).length}/${CHAPTER5_LETTER_ORDER.length} 已讀${mail.replied ? " · 已回信" : ""}</span>
            <button type="button" class="btn buy small" id="letterReplyBtn" ${allRead && !mail.replied ? "" : "disabled"}>寫下回信</button>
          </div>
        </div>
      </div>`;
    box.querySelectorAll("[data-letter-id]").forEach((btn) => {
      btn.onclick = () => selectLetter(btn.dataset.letterId);
    });
    const reply = $("letterReplyBtn");
    if (reply) reply.onclick = sendLetterReply;
    bindSeasonEventCard();
  }
  function openLettersModal() {
    checkNewLetters(now(), false);
    const mail = state.mail || {};
    const unlocked = mail.unlocked || {};
    const read = mail.read || {};
    const first = mailboxLetters().find((l) => unlocked[l.id] && !read[l.id]) ||
      mailboxLetters().find((l) => unlocked[l.id]);
    if (first) {
      selectedLetterId = first.id;
      if (G.readLetter) G.readLetter(state, first.id);
    }
    renderLettersModal();
    renderStory(); renderJournal(); updateMailBadges(); scheduleSave();
    openModal("lettersModal", "[data-letter-id]:not([disabled])");
  }
  function bridgeMaterialRowsHtml(compact) {
    if (!G.bridgeMaterialStatus) return "";
    const st = G.bridgeMaterialStatus(state);
    const names = { wood: "木材", stone: "石頭" };
    const rows = Object.keys(st.cost).map((k) => {
      const ready = (st.missing[k] || 0) <= 0;
      const src = (st.sources[k] || []).map((s) => window.OBSTACLES[s.object].name).filter((v, i, arr) => arr.indexOf(v) === i).join("、");
      return `<div class="bm-row ${ready ? "ready" : "miss"}" data-material="${k}" data-missing="${st.missing[k]}">
        <span>${window.MATERIALS[k].emoji} ${names[k] || window.MATERIALS[k].name}</span>
        <b>${st.have[k]}/${st.cost[k]}${ready ? " 完成" : " 缺 " + st.missing[k]}</b>
        ${compact ? "" : `<span class="bm-src">${ready ? "已備齊" : "來源：" + (src || "已無可清障礙")}</span>`}
      </div>`;
    }).join("");
    return `<div class="bridge-materials" data-audit="bridge-materials" data-ready="${st.ready}">${rows}</div>`;
  }
  function forageRowsHtml(compact) {
    if (!G.eastForageStatus) return "";
    const st = G.eastForageStatus(state, now());
    const rows = Object.keys(st.wants).map((k) => {
      const def = itemDef(k) || { name: k, emoji: "" };
      const done = (st.found[k] || 0) >= st.wants[k];
      return `<div class="bm-row ${done ? "ready" : "miss"}" data-forage-item="${k}">
        <span>${def.emoji} ${def.name}</span><b>${st.found[k] || 0}/${st.wants[k]}</b>
        ${compact ? "" : `<span class="bm-src">${done ? "已採樣" : "東林採集點"}</span>`}
      </div>`;
    }).join("");
    return `<div class="bridge-materials forage-status" data-audit="forage-status" data-ready="${st.collectedAll}">${rows}</div>`;
  }
  function eastDeepCostRowsHtml(compact) {
    if (!G.eastDeepStatus) return "";
    const st = G.eastDeepStatus(state);
    const label = { coins: "金幣", wood: "木材", stone: "石頭", compost: "堆肥" };
    const icon = { coins: "🪙" };
    const rows = Object.keys(st.cost).map((k) => {
      const have = st.have[k] || 0;
      const ready = (st.missing[k] || 0) <= 0;
      const mat = window.MATERIALS[k];
      return `<div class="bm-row ${ready ? "ready" : "miss"}" data-deep-cost="${k}" data-missing="${st.missing[k]}">
        <span>${icon[k] || (mat && mat.emoji) || ""} ${label[k] || (mat && mat.name) || k}</span>
        <b>${have}/${st.cost[k]}${ready ? " 完成" : " 缺 " + st.missing[k]}</b>
        ${compact ? "" : `<span class="bm-src">${ready ? "已備齊" : "清障與經營取得"}</span>`}
      </div>`;
    }).join("");
    return `<div class="bridge-materials deep-status" data-audit="east-deep-cost" data-ready="${st.ready}" data-unlocked="${st.unlocked}">${rows}</div>`;
  }
  function questActionText(cur) {
    if (!cur) return "自由經營：繼續種植、接訂單、照顧動物。";
    if (cur.id === "intro_reopen_farm") return "主動作：點金色箭頭旁的告示牌，走過去閱讀。";
    if (cur.id === "plant_wheat") return "主動作：選手工具，點空農土種下小麥。";
    if (cur.id === "first_water") return "主動作：走到水井，或選澆水工具點麥田。";
    if (cur.id === "first_harvest") return "主動作：等小麥成熟，點麥田走過去收成。";
    if (cur.id === "first_delivery") return "主動作：走到訂單看板，交付 2 小麥新手訂單。";
    if (cur.id === "clear_old_path") return "主動作：選清除工具，點金色箭頭標示的樹樁。";
    if (cur.id === "repair_bridge") {
      const st = G.bridgeMaterialStatus ? G.bridgeMaterialStatus(state) : null;
      return st && st.ready ? "主動作：材料已齊，點斷橋走過去修復。" : "主動作：跟著金色箭頭清障，補齊修橋材料。";
    }
    if (cur.id === "explore_new_area") return "主動作：過橋走到東林古樹。";
    if (cur.id === "discover_east_forage") return "主動作：前往東林採集點，先辨認可採的藥草或菇木。";
    if (cur.id === "collect_east_forage") return "主動作：各採一份東林藥草與螢光菇。";
    if (cur.id === "report_east_forage") return "主動作：回到商人身邊交付東林樣品。";
    if (cur.id === "learn_animal_care") return "主動作：找老農班伯交談。";
    if (cur.id === "feed_care_animal") return "主動作：走到雞舍，餵食、澆水或梳理動物。";
    if (cur.id === "raise_affinity_happy") return "主動作：持續照護同一隻動物到開心。";
    if (cur.id === "collect_quality_product") return "主動作：親密度高時收集優質或頂級產物。";
    if (cur.id === "deliver_quality_order") return "主動作：把優質產物賣到市集或交付訂單。";
    if (cur.id === "prepare_four_seasons") return "主動作：春夏秋冬各收成至少一種作物。";
    if (cur.id === "welcome_ducks") return "主動作：照顧鴨舍並收集一枚鴨蛋。";
    if (cur.id === "finish_festival_order") return "主動作：完成一張豐年祭四季物產訂單。";
    return "主動作：" + cur.desc;
  }
  function renderQuestDock() {
    const box = $("questDock"); if (!box) return;
    if (G.syncStoryProgress) G.syncStoryProgress(state);
    const cur = G.currentQuest(state);
    const targetId = G.questMarkerTile ? G.questMarkerTile(state, now()) : null;
    const title = cur ? cur.title : "自由經營";
    const action = questActionText(cur);
    const isFestivalQuest = cur && cur.id === "finish_festival_order";
    box.dataset.quest = cur ? cur.id : "free";
    box.dataset.targetId = targetId || "";
    box.classList.toggle("festival", !!isFestivalQuest);
    box.classList.toggle("expanded", questDockExpanded);
    box.innerHTML = `<div class="qd-body">
        <div class="qd-title"><span>📍</span><span>${title}</span><span class="qd-summary">${action}</span>${isFestivalQuest ? `<em class="festival-tag">🏮四季物產</em>` : ""}</div>
        <div class="qd-action">${action}</div>
        ${cur && cur.id === "repair_bridge" ? bridgeMaterialRowsHtml(true) : ""}
        ${cur && (cur.id === "collect_east_forage") ? forageRowsHtml(true) : ""}
      </div>
      <div class="qd-actions">
        <button class="qd-meta qd-toggle" data-audit="quest-dock-toggle" aria-label="${questDockExpanded ? "收合任務詳情" : "展開任務詳情"}">${questDockExpanded ? "收" : "詳"}</button>
        <button class="qd-meta qd-go" data-audit="quest-dock-go" aria-label="${targetId ? "前往目前任務目標" : "目前任務沒有可前往目標"}" ${targetId ? "" : "disabled"}>${targetId ? "前往" : "探索"}</button>
      </div>`;
    const toggle = box.querySelector(".qd-toggle");
    if (toggle) toggle.onclick = (ev) => { ev.stopPropagation(); questDockExpanded = !questDockExpanded; renderQuestDock(); };
    const go = box.querySelector(".qd-go");
    if (go && targetId) go.onclick = (ev) => { ev.stopPropagation(); focusCameraOnTile(targetId); };
  }
  function ensureSettings() {
    if (!state) return {};
    if (!state.settings) state.settings = {};
    if (state.settings.smartAssistant == null) state.settings.smartAssistant = true;
    if (state.settings.smartAssistantCollapsed == null) state.settings.smartAssistantCollapsed = true;
    if (state.settings.offlineSummary == null) state.settings.offlineSummary = true;
    if (state.settings.soundEnabled == null) state.settings.soundEnabled = true;
    state.settings.soundVolume = clamp01(state.settings.soundVolume, 0.55);
    if (!["auto", "high", "low"].includes(state.settings.performanceMode)) state.settings.performanceMode = "auto";
    if (!["small", "medium", "large"].includes(state.settings.textSize)) state.settings.textSize = "medium";
    if (!["fit", "natural"].includes(state.settings.mapViewMode)) state.settings.mapViewMode = "fit";
    if (state.lastOfflineSummary === undefined) state.lastOfflineSummary = null;
    return state.settings;
  }
  function settingRowHtml(key, title, desc, enabled) {
    return `<div class="setting-row" data-audit="setting-row" data-setting-row="${escapeHtml(key)}">
      <div>
        <div class="setting-title">${escapeHtml(title)}</div>
        <div class="setting-desc">${escapeHtml(desc)}</div>
      </div>
      <button class="setting-toggle" data-audit="setting-toggle" data-setting-key="${escapeHtml(key)}" data-enabled="${enabled ? "true" : "false"}" aria-label="${escapeHtml(title)}${enabled ? "已開啟" : "已關閉"}">${enabled ? "開啟" : "關閉"}</button>
    </div>`;
  }
  function soundVolumeHtml(volume, enabled) {
    const pct = Math.round(clamp01(volume, 0.55) * 100);
    return `<div class="setting-row" data-audit="setting-sound-volume">
      <div>
        <div class="setting-title">音量</div>
        <div class="setting-desc">調整種植、收成、澆水、餵食、升級與 UI 確認音效。</div>
      </div>
      <label class="setting-slider" aria-label="音效音量">
        <input type="range" min="0" max="100" step="5" value="${pct}" data-audit="sound-volume" ${enabled ? "" : "disabled"}>
        <output id="soundVolumeValue" data-audit="sound-volume-value">${pct}%</output>
      </label>
    </div>`;
  }
  function performanceModeHtml(mode) {
    const labels = { auto: "自動", high: "高", low: "低" };
    const desc = mode === "auto"
      ? `自動監測 FPS，低於 45fps 會節流地圖刷新並降級天氣動畫。現在 ${document.documentElement.classList.contains("perf-low") ? "低階" : "高階"}。`
      : (mode === "high" ? "鎖定完整地圖刷新、天氣動畫與視覺密度。" : "鎖定低頻地圖刷新與低密度天氣動畫，降低耗電與卡頓。");
    return `<div class="setting-row" data-audit="setting-performance">
      <div>
        <div class="setting-title">效能模式</div>
        <div class="setting-desc" data-audit="performance-desc">${escapeHtml(desc)}</div>
      </div>
      <div class="setting-mode-group">
        ${["auto", "high", "low"].map((m) => `<button class="setting-mode ${mode === m ? "sel" : ""}" data-audit="performance-mode" data-performance-mode="${m}">${labels[m]}</button>`).join("")}
      </div>
    </div>`;
  }
  function textSizeHtml(size) {
    const labels = { small: "小", medium: "中", large: "大" };
    return `<div class="setting-row" data-audit="setting-text-size">
      <div>
        <div class="setting-title">文字大小</div>
        <div class="setting-desc">調整主要 UI 文字尺寸，適合手機長時間遊玩。</div>
      </div>
      <div class="setting-mode-group">
        ${["small", "medium", "large"].map((m) => `<button class="setting-mode ${size === m ? "sel" : ""}" data-audit="text-size-mode" data-text-size="${m}" aria-label="文字大小${labels[m]}">${labels[m]}</button>`).join("")}
      </div>
    </div>`;
  }
  function pwaVersionHtml() {
    const waiting = !!pwaWaitingWorker || !!(pwaRegistration && pwaRegistration.waiting);
    const status = pwaUpdateStatus || (typeof navigator !== "undefined" && "serviceWorker" in navigator ? "可手動檢查更新。" : "此瀏覽器不支援離線安裝。");
    return `<div class="setting-row" data-audit="setting-pwa">
      <div>
        <div class="setting-title">版本 ${escapeHtml(PWA_CACHE_VERSION)}</div>
        <div class="setting-desc" id="pwaUpdateStatus" data-audit="pwa-update-status">${escapeHtml(status)}</div>
      </div>
      <button class="setting-toggle" id="pwaCheckBtn" data-audit="pwa-check" aria-label="${waiting ? "套用新版本" : "檢查 PWA 更新"}">${waiting ? "套用更新" : "檢查更新"}</button>
    </div>`;
  }
  function performanceTierLabel(tier) {
    return tier === "low" ? "低" : "高";
  }
  function fmtPerfEventTime(ms) {
    try {
      return new Date(ms).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch (e) {
      return "--:--:--";
    }
  }
  function recordPerformanceEvent(type, reason) {
    const entry = {
      type,
      at: now(),
      reason: reason || (type === "downgrade" ? "效能自動降級" : "效能恢復"),
    };
    if (type === "downgrade") perfLastDowngradeReason = entry.reason;
    perfEventHistory.unshift(entry);
    if (perfEventHistory.length > 5) perfEventHistory.length = 5;
    updatePerformanceDiagnostics();
  }
  function performanceHistoryHtml() {
    if (!perfEventHistory.length) return `<div class="perf-history-empty" data-audit="performance-history-empty">本次遊玩尚無降級或恢復事件。</div>`;
    return `<div class="perf-history" data-audit="performance-history">${perfEventHistory.map((ev) =>
      `<div class="perf-history-row" data-kind="${escapeHtml(ev.type)}"><b>${fmtPerfEventTime(ev.at)}</b><span>${escapeHtml(ev.reason)}</span></div>`
    ).join("")}</div>`;
  }
  function performanceDiagnosticsHtml() {
    const info = performanceInfo();
    return `<div class="setting-row" data-audit="setting-performance-diagnostics">
      <div>
        <div class="setting-title">效能診斷</div>
        <div class="setting-desc" id="performanceDiagnostics" data-audit="performance-diagnostics">FPS ${Math.round(info.avgFps)}｜實際 ${performanceTierLabel(info.tier)}｜最近降級：${escapeHtml(info.lastDowngradeReason)}</div>
        ${performanceHistoryHtml()}
      </div>
    </div>`;
  }
  function backupSaveKey() {
    return ((window.GAME && window.GAME.saveKey) || "pixel_idle_farm_save_v1") + SAVE_BACKUP_SUFFIX;
  }
  function saveManagerHtml() {
    const hasBackup = typeof localStorage !== "undefined" && !!localStorage.getItem(backupSaveKey());
    return `<div class="save-manager" data-audit="save-manager">
      <div class="save-manager-title">存檔管家</div>
      <textarea class="save-code" id="saveCodeBox" data-audit="save-code" placeholder="匯出後會產生代碼；匯入時貼上代碼。"></textarea>
      <div class="save-actions">
        <button class="btn ghost" id="exportSaveBtn" data-audit="save-export">匯出存檔</button>
        <button class="btn buy" id="importSaveBtn" data-audit="save-import">匯入存檔</button>
        <button class="btn ghost" id="restoreBackupBtn" data-audit="save-restore" ${hasBackup ? "" : "disabled"}>還原備份</button>
      </div>
      <div class="save-status" id="saveStatus" data-audit="save-status"></div>
    </div>`;
  }
  function setSaveStatus(msg, ok) {
    const box = $("saveStatus"); if (!box) return;
    box.textContent = msg;
    box.style.color = ok ? "#2f6525" : "#9b3b25";
  }
  function encodeSaveText(text) {
    if (typeof btoa !== "function") throw new Error("no_btoa");
    return btoa(unescape(encodeURIComponent(text)));
  }
  function decodeSaveText(code) {
    if (typeof atob !== "function") throw new Error("no_atob");
    return decodeURIComponent(escape(atob(String(code || "").trim())));
  }
  function validateImportedSaveText(raw) {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.version || typeof parsed.coins !== "number" || !parsed.storage) throw new Error("bad_save_shape");
    const migrated = window.migrate(parsed);
    if (!migrated || typeof migrated !== "object" || !migrated.version || !Array.isArray(migrated.plots) || !migrated.map || !Array.isArray(migrated.map.tiles)) throw new Error("bad_migrated_save");
    return migrated;
  }
  async function exportSaveCode() {
    try {
      ensureSettings();
      state.lastSeenAt = now();
      window.save(state);
      const raw = localStorage.getItem(window.GAME.saveKey) || JSON.stringify(state);
      const code = encodeSaveText(raw);
      const box = $("saveCodeBox"); if (box) { box.value = code; box.focus(); box.select && box.select(); }
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        try { await navigator.clipboard.writeText(code); } catch (e) {}
      }
      setSaveStatus("已匯出存檔代碼並嘗試複製。", true);
      return code;
    } catch (e) {
      setSaveStatus("匯出失敗，請稍後再試。", false);
      return null;
    }
  }
  function importSaveCode() {
    try {
      const box = $("saveCodeBox");
      const raw = decodeSaveText(box ? box.value : "");
      const migrated = validateImportedSaveText(raw);
      const currentRaw = localStorage.getItem(window.GAME.saveKey);
      if (currentRaw) localStorage.setItem(backupSaveKey(), currentRaw);
      const saved = window.safeSave ? window.safeSave(migrated) : null;
      if (!saved || saved.ok === false) throw new Error("save_failed");
      Object.keys(state).forEach((k) => delete state[k]);
      Object.assign(state, migrated);
      setSaveStatus("匯入成功，正在重新載入。", true);
      setTimeout(() => window.location.reload(), 80);
      return true;
    } catch (e) {
      setSaveStatus("匯入失敗：代碼無效或資料不相容，原存檔未覆蓋。", false);
      return false;
    }
  }
  function restoreBackupSave() {
    try {
      const raw = localStorage.getItem(backupSaveKey());
      if (!raw) throw new Error("no_backup");
      const migrated = validateImportedSaveText(raw);
      const saved = window.safeSave ? window.safeSave(migrated) : null;
      if (!saved || saved.ok === false) throw new Error("save_failed");
      Object.keys(state).forEach((k) => delete state[k]);
      Object.assign(state, migrated);
      setSaveStatus("備份已還原，正在重新載入。", true);
      setTimeout(() => window.location.reload(), 80);
      return true;
    } catch (e) {
      setSaveStatus("還原失敗：找不到可用備份。", false);
      return false;
    }
  }
  function applyTextSize() {
    if (!state) return;
    const settings = ensureSettings();
    const size = settings.textSize || "medium";
    const root = document.documentElement;
    root.classList.toggle("text-small", size === "small");
    root.classList.toggle("text-medium", size === "medium");
    root.classList.toggle("text-large", size === "large");
    root.dataset.textSize = size;
  }
  function performanceInfo() {
    const tier = document.documentElement.dataset.performanceTier || "high";
    return {
      mode: ensureSettings().performanceMode,
      avgFps: perfAvgFps,
      autoLow: perfAutoLow,
      tier,
      lastDowngradeReason: perfLastDowngradeReason,
      history: perfEventHistory.slice(),
    };
  }
  function updatePerformanceDiagnostics() {
    const box = $("performanceDiagnostics"); if (!box) return;
    const info = performanceInfo();
    box.textContent = `FPS ${Math.round(info.avgFps)}｜實際 ${performanceTierLabel(info.tier)}｜最近降級：${info.lastDowngradeReason}`;
    const history = (typeof document.querySelector === "function")
      ? document.querySelector('[data-audit="performance-history"], [data-audit="performance-history-empty"]')
      : null;
    if (history) history.outerHTML = performanceHistoryHtml();
  }
  function applyPerformanceMode() {
    if (!state) return;
    const settings = ensureSettings();
    const mode = settings.performanceMode || "auto";
    const low = mode === "low" || (mode === "auto" && perfAutoLow);
    document.documentElement.dataset.performanceMode = mode;
    document.documentElement.dataset.performanceTier = low ? "low" : "high";
    document.documentElement.classList.toggle("perf-low", low);
    const layer = $("weatherLayer");
    if (layer) layer.dataset.performanceTier = low ? "low" : "high";
  }
  function isLowPerformanceTier() {
    return document.documentElement.dataset.performanceTier === "low";
  }
  function startPerformanceMonitor() {
    if (perfMonitorStarted) return;
    perfMonitorStarted = true;
    applyPerformanceMode();
    if (typeof requestAnimationFrame !== "function") return;
    const perf = (typeof performance !== "undefined" && performance.now) ? performance : { now: () => now() };
    let last = perf.now();
    const frame = (ts) => {
      const t = typeof ts === "number" ? ts : perf.now();
      if (document.hidden || perfNeedsBaseline) {
        last = t;
        perfNeedsBaseline = false;
        requestAnimationFrame(frame);
        return;
      }
      const dt = Math.max(1, t - last);
      last = t;
      const fps = Math.min(120, 1000 / dt);
      perfAvgFps = perfAvgFps * 0.92 + fps * 0.08;
      const mode = state ? ensureSettings().performanceMode : "auto";
      if (mode === "auto") {
        if (perfAvgFps < 45) { perfLowFrames++; perfStableFrames = 0; }
        else if (perfAvgFps > 53) { perfStableFrames++; perfLowFrames = 0; }
        else { perfLowFrames = 0; perfStableFrames = 0; }
        if (!perfAutoLow && perfLowFrames >= 30) {
          perfAutoLow = true;
          const reason = `FPS ${Math.round(perfAvgFps)} 低於 45，已節流地圖刷新並降低天氣動畫密度`;
          applyPerformanceMode();
          recordPerformanceEvent("downgrade", reason);
          renderSettingsPanel();
        }
        if (perfAutoLow && perfStableFrames >= 120) {
          perfAutoLow = false;
          const reason = `FPS ${Math.round(perfAvgFps)} 回穩，已恢復高品質`;
          applyPerformanceMode();
          recordPerformanceEvent("restore", reason);
          renderSettingsPanel();
        }
      } else if (perfAutoLow || perfLowFrames || perfStableFrames) {
        perfAutoLow = false; perfLowFrames = 0; perfStableFrames = 0; applyPerformanceMode();
      }
      updatePerformanceDiagnostics();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  function showPwaUpdatePrompt(worker) {
    const box = $("pwaUpdate"); if (!box || !worker) return;
    pwaWaitingWorker = worker;
    pwaUpdateStatus = "新版本已下載，可套用更新。";
    box.hidden = false;
    renderSettingsPanel();
    box.onclick = () => {
      worker.postMessage({ type: "SKIP_WAITING" });
      box.hidden = true;
    };
  }
  function applyWaitingServiceWorker() {
    const worker = pwaWaitingWorker || (pwaRegistration && pwaRegistration.waiting);
    if (!worker) return false;
    worker.postMessage({ type: "SKIP_WAITING" });
    pwaWaitingWorker = null;
    pwaUpdateStatus = "正在套用更新...";
    const box = $("pwaUpdate"); if (box) box.hidden = true;
    return true;
  }
  async function checkPwaUpdate() {
    if (!pwaRegistration || typeof pwaRegistration.update !== "function") {
      pwaUpdateStatus = "尚未註冊離線功能，請重新整理後再試。";
      renderSettingsPanel();
      return false;
    }
    try {
      const reg = await pwaRegistration.update();
      if ((reg && reg.waiting) || pwaWaitingWorker) {
        showPwaUpdatePrompt((reg && reg.waiting) || pwaWaitingWorker);
        return true;
      }
      pwaUpdateStatus = "已檢查，目前是最新版本。";
      renderSettingsPanel();
      return false;
    } catch (e) {
      pwaUpdateStatus = "檢查更新失敗，請確認網路後再試。";
      renderSettingsPanel();
      return false;
    }
  }
  function handlePwaUpdateButton() {
    if (applyWaitingServiceWorker()) return;
    checkPwaUpdate();
  }
  function shouldAutoReloadOnControllerChange(loadAt) {
    if (now() - loadAt > PWA_AUTO_RELOAD_WINDOW_MS) return false;
    try {
      if (sessionStorage.getItem(PWA_AUTO_RELOAD_SESSION_KEY)) return false;
      sessionStorage.setItem(PWA_AUTO_RELOAD_SESSION_KEY, "1");
      return true;
    } catch (e) {
      return false;
    }
  }
  function showPwaReloadPrompt() {
    const box = $("pwaUpdate");
    pwaWaitingWorker = null;
    pwaUpdateStatus = "新版本已套用，點擊重新載入。";
    if (box) {
      box.hidden = false;
      box.onclick = () => window.location.reload();
    }
    renderSettingsPanel();
  }
  function setupPwa() {
    const allowSwTest = typeof location !== "undefined" && new URLSearchParams(location.search || "").has("swtest");
    if (typeof navigator === "undefined" || (navigator.webdriver && !allowSwTest) || !("serviceWorker" in navigator)) return;
    const loadAt = now();
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      if (shouldAutoReloadOnControllerChange(loadAt)) {
        refreshing = true;
        window.location.reload();
        return;
      }
      showPwaReloadPrompt();
    });
    if (window.__farmPwaUpdatePending) showPwaReloadPrompt();
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).then((reg) => {
      pwaRegistration = reg;
      if (reg.waiting) showPwaUpdatePrompt(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) showPwaUpdatePrompt(worker);
        });
      });
      renderSettingsPanel();
    }).catch(() => {});
  }
  function compactOfflineSummary(summary) {
    const forageCount = summary.forageReadyCount || (summary.forageReady || []).length || 0;
    return {
      recordedAt: now(),
      offlineMs: summary.offlineMs || 0,
      cappedFromMs: summary.cappedFromMs || 0,
      minutes: Math.max(5, Math.round((summary.offlineMs || 0) / 60000)),
      coins: summary.coins || 0,
      xp: summary.xp || 0,
      readyPlots: summary.readyPlots || 0,
      forageReadyCount: forageCount,
      perCrop: Object.assign({}, summary.perCrop || {}),
      products: Object.assign({}, summary.products || {}),
      replanted: summary.replanted || 0,
      lost: summary.lost || 0,
      seasonsAdvanced: summary.seasonsAdvanced || 0,
      seasonsReached: (summary.seasonsReached || []).slice(0, 8),
      skippedSeasonEvents: (summary.skippedSeasonEvents || []).slice(0, 8),
    };
  }
  function recordOfflineSummary(summary) {
    if (!state || !summary || summary.offlineMs < OFFLINE_SUMMARY_MIN_MS) return false;
    state.lastOfflineSummary = compactOfflineSummary(summary);
    return true;
  }
  function offlineReviewHtml(summary) {
    if (!summary) {
      return `<div class="offline-review" data-audit="offline-review">
        <div class="offline-review-title">最近一次離線回顧</div>
        <div class="offline-review-body" data-audit="offline-review-empty">尚無可回看的離線摘要。</div>
      </div>`;
    }
    const forageCount = summary.forageReadyCount || 0;
    const lines = [
      `離開 ${summary.minutes || Math.max(5, Math.round((summary.offlineMs || 0) / 60000))} 分鐘`,
      `離線收益 +${summary.coins || 0} 金`,
      `作物成熟 ${summary.readyPlots || 0} 株`,
      `採集點已刷新 ${forageCount} 處`,
    ];
    const crops = Object.entries(summary.perCrop || {});
    if (crops.length) lines.push(`自動收成 ${crops.map(([cid, n]) => `${itemName(cid)}×${n}`).join("、")}`);
    const products = Object.entries(summary.products || {});
    if (products.length) lines.push(`動物產出 ${products.map(([pid, n]) => `${itemName(pid)}×${n}`).join("、")}`);
    if (summary.replanted > 0) lines.push(`幫手補種 ${summary.replanted} 次`);
    if (summary.lost > 0) lines.push(`倉滿損失 ${summary.lost}`);
    if (summary.seasonsAdvanced > 0) lines.push(`季節推進 ${summary.seasonsAdvanced} 次`);
    if ((summary.skippedSeasonEvents || []).length) lines.push(`已結束節慶 ${summary.skippedSeasonEvents.length} 個`);
    return `<div class="offline-review" data-audit="offline-review">
      <div class="offline-review-title">最近一次離線回顧</div>
      <div class="offline-review-body" data-audit="offline-review-summary">${lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}</div>
    </div>`;
  }
  function renderSettingsPanel() {
    const box = $("settingsList"); if (!box || !state) return;
    const settings = ensureSettings();
    box.innerHTML = [
      settingRowHtml("smartAssistant", "智慧農務助手", "在地圖角落顯示即時行動建議與一鍵前往。", settings.smartAssistant !== false),
      settingRowHtml("offlineSummary", "離線摘要", "離開 5 分鐘以上回來時顯示本次收益摘要。", settings.offlineSummary !== false),
      settingRowHtml("soundEnabled", "音效", "首次點擊或按鍵後，主要操作會播放短促 WebAudio 回饋。", settings.soundEnabled !== false),
      soundVolumeHtml(settings.soundVolume, settings.soundEnabled !== false),
      textSizeHtml(settings.textSize || "medium"),
      performanceModeHtml(settings.performanceMode || "auto"),
      performanceDiagnosticsHtml(),
      pwaVersionHtml(),
      offlineReviewHtml(state.lastOfflineSummary),
      saveManagerHtml(),
    ].join("");
    box.querySelectorAll("[data-setting-key]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.stopPropagation();
        const key = btn.dataset.settingKey;
        ensureSettings();
        state.settings[key] = state.settings[key] === false;
        if (key === "smartAssistant" && state.settings.smartAssistant) state.settings.smartAssistantCollapsed = true;
        if (key === "soundEnabled" && state.settings.soundEnabled !== false) { unlockAudio(true); playSound("ui"); }
        else playSound("ui");
        renderSettingsPanel();
        renderSmartAssistant(true);
        scheduleSave();
      };
    });
    box.querySelectorAll("[data-audit='sound-volume']").forEach((slider) => {
      const update = (preview) => {
        ensureSettings();
        state.settings.soundVolume = clamp01(Number(slider.value) / 100, 0.55);
        const out = $("soundVolumeValue");
        if (out) out.textContent = Math.round(state.settings.soundVolume * 100) + "%";
        if (preview && state.settings.soundEnabled !== false) { unlockAudio(true); playSound("ui"); }
        scheduleSave();
      };
      slider.oninput = () => update(false);
      slider.onchange = () => update(true);
    });
    box.querySelectorAll("[data-text-size]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.stopPropagation();
        ensureSettings();
        state.settings.textSize = btn.dataset.textSize || "medium";
        applyTextSize();
        playSound("ui");
        renderSettingsPanel();
        scheduleSave();
      };
    });
    box.querySelectorAll("[data-performance-mode]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.stopPropagation();
        ensureSettings();
        const beforeTier = document.documentElement.dataset.performanceTier || "high";
        const nextMode = btn.dataset.performanceMode || "auto";
        state.settings.performanceMode = nextMode;
        perfAutoLow = false; perfLowFrames = 0; perfStableFrames = 0;
        applyPerformanceMode();
        const afterTier = document.documentElement.dataset.performanceTier || "high";
        if (beforeTier !== afterTier) {
          const reason = afterTier === "low"
            ? (nextMode === "low" ? "手動鎖定低品質模式" : "效能自動降級")
            : (nextMode === "high" ? "手動鎖定高品質模式" : "手動切回自動，恢復高品質");
          recordPerformanceEvent(afterTier === "low" ? "downgrade" : "restore", reason);
        }
        playSound("ui");
        renderSettingsPanel();
        scheduleSave();
      };
    });
    const exportBtn = $("exportSaveBtn"); if (exportBtn) exportBtn.onclick = (ev) => { ev.stopPropagation(); exportSaveCode(); };
    const importBtn = $("importSaveBtn"); if (importBtn) importBtn.onclick = (ev) => { ev.stopPropagation(); importSaveCode(); };
    const restoreBtn = $("restoreBackupBtn"); if (restoreBtn) restoreBtn.onclick = (ev) => { ev.stopPropagation(); restoreBackupSave(); };
    const pwaBtn = $("pwaCheckBtn"); if (pwaBtn) pwaBtn.onclick = (ev) => { ev.stopPropagation(); handlePwaUpdateButton(); };
    updatePerformanceDiagnostics();
  }
  function renderSmartAssistant(force) {
    const box = $("smartAssistant"); if (!box || !state || !G.farmActionSuggestions) return;
    const settings = ensureSettings();
    const enabled = settings.smartAssistant !== false;
    if (!enabled) {
      box.className = "smart-assistant hidden";
      box.innerHTML = "";
      lastAssistantSig = "off";
      return;
    }
    const collapsed = !!settings.smartAssistantCollapsed;
    const suggestions = G.farmActionSuggestions(state, now(), { limit: 3 });
    const primary = suggestions[0] || null;
    const assistantSkin = !primary ? "idle" : primary.priority >= 100 ? "alert" : "tip";
    const assistantStatus = assistantSkin === "alert" ? "有可立即處理的農務" : assistantSkin === "tip" ? "有一則農務建議" : "農場狀態安穩";
    const sig = [collapsed ? "c" : "o", assistantSkin].concat(suggestions.map((s) => [s.id, s.type, s.tileId, Math.round((s.valueScore || 0) * 10), s.reason].join(":"))).join("|");
    if (!force && sig === lastAssistantSig) return;
    lastAssistantSig = sig;
    box.className = "smart-assistant assistant-" + assistantSkin + (collapsed ? " collapsed" : "");
    box.dataset.assistantSkin = assistantSkin;
    const rows = suggestions.length ? suggestions.map((s, idx) => `
      <div class="sa-row" data-audit="assistant-row" data-rank="${idx + 1}" data-suggestion-id="${escapeHtml(s.id)}" data-suggestion-type="${escapeHtml(s.type)}" data-target-id="${escapeHtml(s.tileId)}" data-value-score="${escapeHtml(Math.round((s.valueScore || 0) * 10) / 10)}">
        <div>
          <div class="sa-title">${escapeHtml(s.title)}</div>
          <div class="sa-detail">${escapeHtml(s.detail || "")}</div>
          <div class="sa-reason" data-audit="assistant-reason">${escapeHtml(s.reason || "")}</div>
        </div>
        <button class="sa-go" data-audit="assistant-go" data-target-id="${escapeHtml(s.tileId)}" data-suggestion-type="${escapeHtml(s.type)}" aria-label="前往建議目標：${escapeHtml(s.title)}">${escapeHtml(s.actionLabel || "前往")}</button>
      </div>`).join("")
      : `<div class="sa-row" data-audit="assistant-empty"><div><div class="sa-title">目前沒有急件</div><div class="sa-detail">可以整理倉庫、探索地圖或等待作物成熟。</div></div></div>`;
    box.innerHTML = `
      <div class="sa-head">
        <span class="sa-skin sa-skin-${assistantSkin}" aria-hidden="true"></span>
        <span class="sa-copy"><b>智慧農務助手</b><small>${assistantStatus}</small></span>
        <button class="sa-icon-btn" data-audit="assistant-collapse" title="${collapsed ? "展開" : "收合"}" aria-label="${collapsed ? "展開智慧農務助手" : "收合智慧農務助手"}">${collapsed ? "▾" : "▴"}</button>
        <button class="sa-icon-btn" data-audit="assistant-close" title="關閉" aria-label="關閉智慧農務助手">×</button>
      </div>
      <div class="sa-list">${rows}</div>`;
    const collapse = box.querySelector('[data-audit="assistant-collapse"]');
    if (collapse) collapse.onclick = (ev) => {
      ev.stopPropagation();
      ensureSettings();
      state.settings.smartAssistantCollapsed = !state.settings.smartAssistantCollapsed;
      scheduleSave();
      renderSmartAssistant(true);
    };
    const close = box.querySelector('[data-audit="assistant-close"]');
    if (close) close.onclick = (ev) => {
      ev.stopPropagation();
      ensureSettings();
      state.settings.smartAssistant = false;
      scheduleSave();
      renderSmartAssistant(true);
      renderSettingsPanel();
    };
    box.querySelectorAll(".sa-go").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.stopPropagation();
        focusCameraOnTile(btn.dataset.targetId);
      };
    });
  }
  function renderStory() {
    const box = $("storyPanel"); if (!box) return;
    if (G.syncStoryProgress) G.syncStoryProgress(state);
    const cur = G.currentQuest(state);
    const completed = (state.story && state.story.completed) || {};
    const doneCount = QUEST_ORDER.filter((id) => completed[id]).length;
    const donePct = Math.round(doneCount / QUEST_ORDER.length * 100);
    const ch1Done = doneCount >= QUEST_ORDER.length;
    const ch2Done = CHAPTER2_ORDER.filter((id) => completed[id]).length;
    const ch2Pct = Math.round(ch2Done / CHAPTER2_ORDER.length * 100);
    const ch2AllDone = ch2Done >= CHAPTER2_ORDER.length;
    const ch3Done = CHAPTER3_ORDER.filter((id) => completed[id]).length;
    const ch3Pct = Math.round(ch3Done / CHAPTER3_ORDER.length * 100);
    const ch3AllDone = ch3Done >= CHAPTER3_ORDER.length;
    const ch4Done = CHAPTER4_ORDER.filter((id) => completed[id]).length;
    const ch4Pct = Math.round(ch4Done / CHAPTER4_ORDER.length * 100);
    const ch4AllDone = ch4Done >= CHAPTER4_ORDER.length;
    const mail = state.mail || {};
    const mailRead = mail.read || {};
    const letterDone = CHAPTER5_LETTER_ORDER.filter((id) => mailRead[id]).length;
    const letterPct = CHAPTER5_LETTER_ORDER.length ? Math.round(letterDone / CHAPTER5_LETTER_ORDER.length * 100) : 0;
    const ch5AllDone = CHAPTER5_LETTER_ORDER.length > 0 && letterDone >= CHAPTER5_LETTER_ORDER.length && !!mail.replied;
    const kicker = doneCount === 0 ? "序章" : ch5AllDone ? "第五章" : ch4AllDone ? "第五章" : ch3AllDone ? "第四章" : ch2AllDone ? "第三章" : ch1Done ? "第二章" : "第一章";
    const title = cur ? cur.title : "陽光農場的新篇章";
    const copy = cur ? cur.desc
      : "阿軒割割陽光農場開源遊戲世界重新熱鬧了起來。東林已通，繼續開墾田地、迎接更多動物與市集訂單，讓這座農場成為玩家共創的 RPG 世界。";
    const quests = compactRowsHtml("story-main", QUEST_ORDER.map((id) => questRow(id, completed, cur)), 4);
    // 第二章：序章 6/6 後才顯示，獨立完成度（不影響主面板 0/6 讀值）
    const ch2Html = ch1Done ? `
      <div class="chapter2">
        <div class="story-kicker">第二章 · 世界可探索</div>
        <div class="story-progress chapter2-progress" data-progress2="${ch2Done}/${CHAPTER2_ORDER.length}">
          <div class="story-progress-head"><span>探索完成度</span><b>${ch2Done}/${CHAPTER2_ORDER.length}</b></div>
          <div class="story-progress-track"><i style="width:${ch2Pct}%"></i></div>
        </div>
        <div class="quest-list">${compactRowsHtml("story-ch2", CHAPTER2_ORDER.map((id) => questRow(id, completed, cur)), 3)}</div>
      </div>` : "";
    // 第三章：第二章 2/2 後才顯示，獨立完成度（Stage 7 動物照護）
    const ch3Html = ch2AllDone ? `
      <div class="chapter2 chapter3">
        <div class="story-kicker">第三章 · 動物照護</div>
        <div class="story-progress chapter3-progress" data-progress3="${ch3Done}/${CHAPTER3_ORDER.length}">
          <div class="story-progress-head"><span>照護完成度</span><b>${ch3Done}/${CHAPTER3_ORDER.length}</b></div>
          <div class="story-progress-track"><i style="width:${ch3Pct}%"></i></div>
        </div>
        <div class="quest-list">${compactRowsHtml("story-ch3", CHAPTER3_ORDER.map((id) => questRow(id, completed, cur)), 3)}</div>
      </div>` : "";
    const ch4Html = ch3AllDone ? `
      <div class="chapter2 chapter4">
        <div class="story-kicker">第四章 · 四季物產</div>
        <div class="story-progress chapter4-progress" data-progress4="${ch4Done}/${CHAPTER4_ORDER.length}">
          <div class="story-progress-head"><span>四季完成度</span><b>${ch4Done}/${CHAPTER4_ORDER.length}</b></div>
          <div class="story-progress-track"><i style="width:${ch4Pct}%"></i></div>
        </div>
        <div class="quest-list">${compactRowsHtml("story-ch4", CHAPTER4_ORDER.map((id) => questRow(id, completed, cur)), 3)}</div>
      </div>` : "";
    const letterRows = chapter5Letters().map((l) => {
      const unlocked = !!((mail.unlocked || {})[l.id]);
      const read = !!mailRead[l.id];
      return `<div class="quest ${read ? "done" : ""} ${unlocked && !read ? "active" : ""}">
        <span class="qmark">${read ? "✓" : unlocked ? "●" : "🔒"}</span>
        <span class="qtext"><span>${escapeHtml(l.title)}</span><em>${unlocked ? (read ? "已讀" : "新信") : "未送達"}</em></span></div>`;
    }).join("");
    const ch5Html = ch4AllDone ? `
      <div class="chapter2 chapter5">
        <div class="story-kicker">第五章 · 祖母的季節信箋</div>
        <div class="story-progress chapter5-progress" data-progress5="${letterDone}/${CHAPTER5_LETTER_ORDER.length}">
          <div class="story-progress-head"><span>信箋完成度</span><b>${letterDone}/${CHAPTER5_LETTER_ORDER.length}${mail.replied ? "・已回信" : ""}</b></div>
          <div class="story-progress-track"><i style="width:${letterPct}%"></i></div>
        </div>
        <div class="quest-list">${compactRowsHtml("story-ch5", chapter5Letters().map((l) => {
          const unlocked = !!((mail.unlocked || {})[l.id]);
          const read = !!mailRead[l.id];
          return `<div class="quest ${read ? "done" : ""} ${unlocked && !read ? "active" : ""}">
            <span class="qmark">${read ? "✅" : unlocked ? "📬" : "🔒"}</span>
            <span class="qtext"><span>${escapeHtml(l.title)}</span><em>${unlocked ? (read ? "已讀" : "未讀") : "未解鎖"}</em></span></div>`;
        }), 3)}</div>
        <button type="button" class="btn ghost small story-mail-btn" id="openLettersFromStory">打開信箱</button>
      </div>` : "";
    box.innerHTML = `<div class="story-card">
      <div class="story-kicker">${kicker}</div>
      <div class="story-title">${title}</div>
      <div class="story-copy">${copy}</div>
      <div class="story-progress" data-progress="${doneCount}/${QUEST_ORDER.length}">
        <div class="story-progress-head"><span>任務完成度</span><b>${doneCount}/${QUEST_ORDER.length}</b></div>
        <div class="story-progress-track"><i style="width:${donePct}%"></i></div>
      </div>
      <div class="quest-list">${quests}</div>
      ${ch2Html}
      ${ch3Html}
      ${ch4Html}
      ${ch5Html}
      ${cur ? `<div class="quest-hint">📍 ${cur.desc}　地圖上的 <b>金色箭頭</b> 會指向目標。${cur.id === "repair_bridge" ? bridgeMaterialRowsHtml(false) : ""}${cur.id === "collect_east_forage" ? forageRowsHtml(false) : ""}</div>` : ""}
      ${dialogueLogHtml()}
    </div>`;
    const openMail = $("openLettersFromStory");
    if (openMail) openMail.onclick = openLettersModal;
    bindListMore(box, renderStory);
  }
  // Stage 6：側欄對話記錄（走近 NPC 交談後累積）
  function dialogueLogHtml() {
    const log = (state.story && state.story.dialogueLog) || [];
    if (!log.length) return "";
    const rows = log.slice(-8).reverse().map((e) =>
      `<div class="dlg-row"><span class="dlg-name">${e.name}</span><span class="dlg-line">${e.line}</span></div>`).join("");
    return `<div class="dialogue-log"><div class="story-kicker">💬 對話記錄</div>${rows}</div>`;
  }

  // Stage 11：農場圖鑑——唯讀彙總層，畫面只是把 G.journalSummary() 的資料換個角度顯示，
  // 不在這裡重新判斷任何「有沒有發現」，一律照 journalSummary 給的 discovered/unlocked/met 顯示。
  function renderJournal() {
    const box = $("journalPanel"); if (!box) return;
    const j = G.journalSummary(state, now());
    const item = (discovered, html, category, id) =>
      `<button type="button" class="journal-item ${discovered ? "found" : "undiscovered"}" data-audit="journal-item" data-category="${category}" data-journal-id="${id || ""}" data-discovered="${discovered}">${html}</button>`;
    const head = (label, key) => {
      const c = j.completion && j.completion[key];
      return `<div class="story-kicker">${label}${c ? ` <span class="journal-pct" data-audit="journal-completion" data-category="${key}">${c.done}/${c.total} · ${c.pct}%</span>` : ""}</div>`;
    };
    const findEntry = (category, id) => {
      const map = { crop: j.crops, product: j.products, forage: j.forage, collectible: j.collectibles };
      return ((map[category] || []).find((x) => x.id === id)) || null;
    };
    const detailHtml = () => {
      if (!journalDetailSelection) return `<div class="journal-detail muted" data-audit="journal-detail">點作物或採集物查看來源、季節、用途與首次發現時間。</div>`;
      const entry = findEntry(journalDetailSelection.category, journalDetailSelection.id);
      if (!entry) return "";
      const discovered = entry.discovered !== false && entry.unlocked !== false;
      if (journalDetailSelection.category === "collectible") {
        return `<div class="journal-detail" data-audit="journal-detail" data-category="collectible" data-discovered="${entry.unlocked}">
          <div class="jd-title">${entry.unlocked ? entry.emoji + " " + entry.name : "◼ 未取得收藏品"}</div>
          <div class="jd-row"><b>來源</b><span>${entry.source}</span></div>
          <div class="jd-row"><b>用途</b><span>純收藏，不產生收益</span></div>
          <div class="jd-note">${entry.unlocked ? entry.desc : "先完成對應探索。"} </div>
        </div>`;
      }
      if (!discovered) {
        return `<div class="journal-detail undiscovered" data-audit="journal-detail" data-category="${journalDetailSelection.category}" data-discovered="false">
          <div class="jd-title">◼ 尚未發現</div>
          <div class="jd-row"><b>來源提示</b><span>${entry.sourceHint || "繼續探索農場"}</span></div>
        </div>`;
      }
      return `<div class="journal-detail" data-audit="journal-detail" data-category="${journalDetailSelection.category}" data-discovered="true">
        <div class="jd-title">${entry.emoji || ""} ${entry.name}</div>
        <div class="jd-row"><b>來源</b><span>${entry.source || entry.sourceHint || "農場"}</span></div>
        <div class="jd-row"><b>季節</b><span>${entry.season || "全年"}</span></div>
        <div class="jd-row"><b>用途</b><span>${(entry.usage || []).join("／") || "收藏"}</span></div>
        ${entry.flavor ? `<div class="jd-row jd-flavor" data-audit="journal-flavor"><b>手札</b><span>${entry.flavor}</span></div>` : ""}
        <div class="jd-row"><b>首次發現</b><span data-audit="journal-first-seen">${fmtDate(entry.firstDiscoveredAt)}</span></div>
      </div>`;
    };
    const cropRows = compactRowsHtml("journal-crops", j.crops.map((c) => {
      if (!c.unlocked) return item(false, "🔒 未解鎖", "crop", c.id);
      if (!c.discovered) return item(false, "❔ 尚未發現", "crop", c.id);
      return item(true, `${c.emoji} ${c.name}`, "crop", c.id);
    }), 5);
    const productRows = compactRowsHtml("journal-products", j.products.map((p) =>
      item(p.discovered, p.discovered ? `${p.emoji} ${p.name}` : "❔ 尚未發現", "product", p.id)), 5);
    const forageRows = compactRowsHtml("journal-forage", (j.forage || []).map((f) =>
      item(f.discovered, f.discovered ? `${f.emoji} ${f.name}${f.season ? "・" + f.season : ""}` : "◼ 未採集", "forage", f.id)), 5);
    const npcMetCount = j.npcs.filter((n) => n.met).length;
    const npcRows = compactRowsHtml("journal-npcs", j.npcs.map((n) => item(n.met,
      n.met ? `🧑 ${n.name}・${n.title}${n.requestsCompleted > 0 ? "・已完成 " + n.requestsCompleted + " 次委託" : ""}${n.sideQuest && n.sideQuest.completed ? "・支線完成" : ""}` : "❔ 尚未遇見", "npc", n.id)), 5);
    // discovered 要用 everGood||everHappy，不能只看 everHappy——不然「曾達良好」的文字
    // 顯示了，但 CSS class/data-discovered 卻標成 undiscovered，兩者互相矛盾
    const animalRows = compactRowsHtml("journal-animals", j.animals.map((a) => item(a.everGood || a.everHappy,
      `${a.everHappy ? "💛" : a.everGood ? "🤍" : "⬜"} ${a.name}${a.everHappy ? "・曾達開心" : a.everGood ? "・曾達良好" : "・尚未達標"}`, "animal", a.id)), 5);
    const achRows = compactRowsHtml("journal-achievements", j.achievements.map((a) => item(a.unlocked,
      a.unlocked ? `${a.icon} ${a.name}` : "❔ 未解鎖成就", "achievement", a.id)), 5);
    const collectibleRows = compactRowsHtml("journal-collectibles", (j.collectibles || []).map((c) => item(c.unlocked,
      c.unlocked ? `${c.emoji} ${c.name}` : "◼ 未取得收藏品", "collectible", c.id)), 5);
    const npcSideRows = compactRowsHtml("journal-npc-sidequests", j.npcs.map((n) => {
      const sq = n.sideQuest;
      const lore = sq && sq.loreUnlocked ? `<span class="sq-lore">・${sq.lore}</span>` : "";
      return item(!!(sq && sq.completed), sq ? `${sq.completed ? "✅" : sq.status === "active" ? "📌" : sq.status === "available" ? "📮" : "🔒"} ${n.name}・${sq.chainTitle || sq.title} ${sq.completedSteps}/${sq.totalSteps}${lore}` : "❔ 尚無支線", "npc-sidequest", n.id);
    }), 5);
    const chapterLine = (label, ch) => ch.unlocked
      ? `<div>${label} ${ch.done}/${ch.total}${ch.replied ? "・已回信" : ""}</div>`
      : `<div>🔒 ${label}未解鎖</div>`;
    box.innerHTML = `<div class="story-card journal-card">
      <div class="story-kicker">章節完成度</div>
      <div class="journal-chapters">
        ${chapterLine("第一章", j.chapters.chapter1)}
        ${chapterLine("第二章", j.chapters.chapter2)}
        ${chapterLine("第三章", j.chapters.chapter3)}
        ${chapterLine("第四章", j.chapters.chapter4)}
        ${chapterLine("第五章", j.chapters.chapter5)}
      </div>
      ${detailHtml()}
      ${head("🌾 作物圖鑑", "crops")}<div class="journal-grid">${cropRows}</div>
      ${head("🥚 產物與品質圖鑑", "products")}<div class="journal-grid">${productRows}</div>
      ${head("🌲 東林採集", "forage")}<div class="journal-grid" data-audit="journal-forage">${forageRows}</div>
      ${head("🧑 鎮民名錄（" + npcMetCount + "/" + j.npcs.length + "）", "npcs")}<div class="journal-grid">${npcRows}</div>
      ${head("📬 鎮民支線", "npcSideQuests")}<div class="journal-grid">${npcSideRows}</div>
      ${head("🐾 動物親密度里程碑", "animals")}<div class="journal-grid">${animalRows}</div>
      ${head("🌉 世界旗標", "world")}
      <div class="journal-grid">
        ${item(j.world.bridgeRepaired, j.world.bridgeRepaired ? "✅ 東橋已修復" : "🔒 東橋未修復", "world", "bridge")}
        ${item(j.world.eastClearingClaimed, j.world.eastClearingClaimed ? "✅ 東林空地已探索" : "🔒 東林空地未探索", "world", "east_clearing")}
        ${item(j.world.eastDeepUnlocked, j.world.eastDeepUnlocked ? "✅ 東林深處已解鎖" : "🔒 東林深處未解鎖", "world", "east_deep")}
      </div>
      ${head("📜 收藏品", "collectibles")}<div class="journal-grid" data-audit="journal-collectibles">${collectibleRows}</div>
      ${head("🏆 成就", "achievements")}
      <div class="journal-grid">${achRows}</div>
    </div>`;
    box.querySelectorAll("[data-journal-id]").forEach((el) => {
      const cat = el.dataset.category;
      if (!["crop", "product", "forage", "collectible"].includes(cat)) return;
      el.addEventListener("click", () => {
        journalDetailSelection = { category: cat, id: el.dataset.journalId };
        renderJournal();
      });
    });
    bindListMore(box, renderJournal);
  }

  // ====================================================================
  // 地圖 / 障礙 / 建築 / 動物 UI
  // ====================================================================
  // ===== v3 frame 對應 =====
  const STAGE_NAME = ["seed", "sprout", "young", "mature", "ready"];
  // 遊戲建築 type → props atlas frame（v3 無 silo/bee_box 專屬圖，沿用近似物件）
  const BUILDING_FRAME = { chickenCoop: "chicken_coop", barn: "barn", beeBox: "compost_heap",
    silo: "storage_crate", compostHeap: "compost_heap", duckPen: "chicken_coop", greenhouse: "compost_heap", festival_stall: "shop", memory_garden: "flower_bed" };
  const BUILDING_SHEET = { festival_stall: "buildings", memory_garden: "structures" };
  // 障礙 → props frame（同名）
  const OBSTACLE_FRAME = { rock: "rock", stump: "stump", bush: "bush" };
  // ===== Stage 4：像素世界 + camera + 分層 y-sort 渲染器 =====
  const BASE_TILE = window.TILE_PX || 48;
  const MIN_READABLE_TILE = 14;
  const MAX_FIT_TILE = 72;
  const FIT_OVERFLOW_GUTTER = 24;
  let TILE = BASE_TILE;
  let worldEl = null, groundEl = null;
  const obStatic = [], obDyn = [];   // 物件層 sprite（靜態：建築/障礙/站點；動態：作物/動物/狀態）
  const pxv = (n) => n + "px";

  function mapViewMode() {
    const settings = ensureSettings();
    return settings.mapViewMode === "natural" ? "natural" : "fit";
  }
  function fitTileForScene(scene) {
    if (!scene || !state || !state.map) return BASE_TILE;
    const vw = Math.max(1, (scene.clientWidth || scene.getBoundingClientRect().width || 1) - FIT_OVERFLOW_GUTTER);
    const vh = Math.max(1, (scene.clientHeight || scene.getBoundingClientRect().height || 1) - FIT_OVERFLOW_GUTTER);
    const raw = Math.min(vw / state.map.width, vh / state.map.height);
    if (!Number.isFinite(raw) || raw <= 0) return BASE_TILE;
    return Math.max(10, Math.min(MAX_FIT_TILE, Math.floor(raw)));
  }
  function syncMapModeUi(fitTile) {
    const scene = $("mapScene");
    const btn = $("mapFitToggle");
    const mode = mapViewMode();
    if (scene) {
      scene.dataset.mapMode = mode;
      scene.dataset.fitTile = mode === "fit" && fitTile < MIN_READABLE_TILE ? "tiny" : "ok";
      scene.style.setProperty("--map-tile-px", pxv(TILE));
    }
    if (btn) {
      const natural = mode === "natural";
      btn.textContent = natural ? "原尺寸" : "整圖";
      btn.title = natural ? "切換為整張地圖完整顯示" : "切換為原尺寸場景內捲動";
      if (btn.setAttribute) {
        btn.setAttribute("aria-pressed", natural ? "true" : "false");
        btn.setAttribute("aria-label", btn.title);
      }
    }
  }
  function applyMapViewSizing(force) {
    const scene = $("mapScene");
    if (!scene || !state || !state.map) return false;
    const mode = mapViewMode();
    const fitTile = fitTileForScene(scene);
    const nextTile = mode === "natural" ? BASE_TILE : fitTile;
    const sig = [mode, nextTile, scene.clientWidth, scene.clientHeight].join("|");
    const changed = force || nextTile !== TILE || sig !== lastMapFitSig;
    TILE = nextTile;
    lastMapFitSig = sig;
    syncMapModeUi(fitTile);
    return changed;
  }
  function rebuildMapForView() {
    applyMapViewSizing(true);
    buildMap();
    updateMap(now());
    positionPlayer(false);
  }
  function toggleMapViewMode() {
    ensureSettings();
    state.settings.mapViewMode = mapViewMode() === "natural" ? "fit" : "natural";
    lastMapFitSig = "";
    rebuildMapForView();
    scheduleSave();
  }

  function buildMap() { buildScene(); }          // 相容舊呼叫名
  function buildScene() {
    const scene = $("mapScene"); if (!scene) return;
    worldEl = $("mapWorld"); groundEl = $("groundLayer");
    if (!worldEl || !groundEl) return;
    applyMapViewSizing(false);
    const W = state.map.width * TILE, H = state.map.height * TILE;
    scene.style.setProperty("--map-world-width", pxv(W));
    scene.style.setProperty("--map-world-height", pxv(H));
    worldEl.style.width = pxv(W); worldEl.style.height = pxv(H);
    groundEl.style.width = pxv(W); groundEl.style.height = pxv(H);
    groundEl.innerHTML = ""; tileEls.length = 0;
    for (const tile of state.map.tiles) {
      const el = document.createElement("div");
      el.className = "gtile " + tile.terrain + (tile.plotIndex != null ? " farm-plot" : "");
      el.dataset.tileId = tile.id;
      el.dataset.audit = "ground-tile"; el.dataset.terrain = tile.terrain;
      el.style.left = pxv(tile.x * TILE); el.style.top = pxv(tile.y * TILE);
      el.style.width = pxv(TILE); el.style.height = pxv(TILE);
      el.addEventListener("pointerdown", (ev) => {
        if (!ev.pointerType) return;
        lastMapPointer = { pointerType: ev.pointerType, tileId: tile.id, at: now() };
      }, { passive: true });
      el.addEventListener("touchend", () => { lastTouchMapAt = now(); }, { passive: true });
      el.addEventListener("click", (ev) => handleMapClick(tile.id, mapActivationType(ev, tile.id)));
      groundEl.appendChild(el);
      tileEls.push({ el, tileId: tile.id });
    }
    paintGround();
    buildStaticObjects();
    document.documentElement.style.setProperty("--move-ms", window.MOVE_MS + "ms");
    updateMap(now());
    positionPlayer(false);
  }
  // 地面 terrain 圖（含 wet/locked/sel class）
  function paintGround() {
    if (!atlasReady) return;
    const active = G.activePlotCount(state);
    for (const cell of tileEls) {
      const tile = G.getTileById(state, cell.tileId);
      const plot = tile.plotIndex != null ? state.plots[tile.plotIndex] : null;
      const prog = plot && plot.cropId ? G.getCropProgress(state, plot, now()) : null;
      const locked = tile.plotIndex != null && tile.plotIndex >= active;
      const lockedArea = (tile.region === "east" && !(state.flags && state.flags.bridgeRepaired))
        || (tile.region === "east_deep" && !(state.flags && state.flags.eastDeepUnlocked)); // 東林/深處封鎖區
      let cls = "gtile " + tile.terrain;
      if (tile.plotIndex != null) cls += " farm-plot";
      if (locked) cls += " locked";
      if (lockedArea) cls += " locked-area";
      if (prog && prog.wet && !prog.ready) cls += " wet";
      if (cell.tileId === selectedTileId) cls += " sel";
      if (pendingTouchFarmAction && cell.tileId === pendingTouchFarmAction.tileId) cls += " touch-pending";
      const kind = lockedArea ? "locked-area" : "";
      const frame = terrainFrame(tile, prog);
      const sig = cls + "|" + kind + "|" + frame;
      if (cell.groundSig === sig) continue;
      cell.groundSig = sig;
      cell.el.className = cls;
      cell.el.dataset.kind = kind;
      window.Atlas.applyTo(cell.el, "terrain", frame);
    }
  }
  // 以「像素中心 + 腳底 baseline」放一個物件 sprite；依 frame 真實長寬比，z=baseline 做遮擋
  // kind：穩定稽核標籤（crop/animal/structure/obstacle/station），對外掛 data-* 屬性
  function addObjectPx(arr, sheet, frame, cx, baselineY, wPx, cls, zAdjust, kind) {
    if (!worldEl) return null;
    const f = atlasReady ? window.Atlas.getFrame(sheet, frame) : null;
    const ratio = f ? (f.h / f.w) : 1;
    const w = wPx, h = wPx * ratio;
    const el = document.createElement("div");
    el.className = "ob " + (cls || "");
    el.dataset.audit = "object"; el.dataset.kind = kind || "object";
    el.dataset.sheet = sheet; el.dataset.frame = frame;
    el.style.left = pxv(Math.round(cx - w / 2)); el.style.top = pxv(Math.round(baselineY - h));
    el.style.width = pxv(w); el.style.height = pxv(h);
    el.style.zIndex = Math.round(baselineY + (zAdjust || 0));
    if (f) { const st = window.Atlas.frameStyleFor(sheet, frame, w, h);
      if (st) { el.style.backgroundImage = st.backgroundImage; el.style.backgroundSize = st.backgroundSize; el.style.backgroundPosition = st.backgroundPosition; } }
    worldEl.appendChild(el); if (arr) arr.push(el);
    return el;
  }
  function addEmojiObjectPx(arr, emoji, cx, baselineY, sizePx, cls, zAdjust, kind) {
    if (!worldEl) return null;
    const size = sizePx || TILE * 0.8;
    const el = document.createElement("div");
    el.className = "ob emoji-ob " + (cls || "");
    el.dataset.audit = "object"; el.dataset.kind = kind || "object";
    el.textContent = emoji || "🌱";
    el.style.left = pxv(Math.round(cx - size / 2)); el.style.top = pxv(Math.round(baselineY - size));
    el.style.width = pxv(size); el.style.height = pxv(size);
    el.style.zIndex = Math.round(baselineY + (zAdjust || 0));
    worldEl.appendChild(el); if (arr) arr.push(el);
    return el;
  }
  // 多格建築：寬=footprint 寬，底=footprint 底，sprite 依 frame 比例自然向上延伸（遮擋）
  function addStructure(s) {
    const cx = (s.x + s.w / 2) * TILE;
    const baselineY = (s.y + s.h) * TILE;
    const frame = s.sheet === "structures" ? seasonalStructureFrame(s.frame) : s.frame;
    const el = addObjectPx(obStatic, s.sheet, frame, cx, baselineY, s.w * TILE, "shadowed", 0, "structure");
    if (el) el.dataset.structureId = s.id;
  }
  const OBSTACLE_SHEET = { rock: "props", stump: "props", bush: "structures", tree: "structures" };
  const OBSTACLE_FRAME2 = { rock: "rock", stump: "stump", bush: "bush_big", tree: "oak" };
  const OBSTACLE_SCALE = { rock: 1.05, stump: 1.0, bush: 1.35, tree: 1.8 };
  const SEASON_FRAME_SUFFIX = { "春": "spring", "秋": "autumn", "冬": "winter" };
  function seasonalStructureFrame(frame, t) {
    const season = G.currentSeason ? G.currentSeason(state, t || now()) : "春";
    const suffix = SEASON_FRAME_SUFFIX[season];
    const candidate = suffix ? frame + "_" + suffix : frame;
    return suffix && window.Atlas && window.Atlas.hasFrame("structures", candidate) ? candidate : frame;
  }
  // 靜態物件：多格建築 / 障礙 / 站點（buildScene 與清障時重建）
  function buildStaticObjects() {
    for (const e of obStatic) e.remove(); obStatic.length = 0;
    if (!atlasReady || !worldEl) return;
    for (const s of (window.STRUCTURES || [])) addStructure(s);
    for (const tile of state.map.tiles) {
      if (!tile.object) continue;
      const sheet = OBSTACLE_SHEET[tile.object] || "props";
      const baseFrame = OBSTACLE_FRAME2[tile.object] || tile.object;
      const frame = sheet === "structures" ? seasonalStructureFrame(baseFrame) : baseFrame;
      const el = addObjectPx(obStatic, sheet, frame, (tile.x + 0.5) * TILE, (tile.y + 1) * TILE, TILE * (OBSTACLE_SCALE[tile.object] || 1), "shadowed", 0, "obstacle");
      if (el) { el.dataset.object = tile.object; el.dataset.tileId = tile.id; }
    }
    for (const tile of state.map.tiles) {
      if (!tile.station) continue;
      const stn = window.STATIONS[tile.station];
      const el = addObjectPx(obStatic, (stn && stn.sheet) || "props", stn ? stn.frame : "order_board", (tile.x + 0.5) * TILE, (tile.y + 1) * TILE, TILE * 1.1, "shadowed", 0, "station");
      if (el) { el.dataset.station = tile.station; el.dataset.tileId = tile.id; }
    }
    // Stage 5：斷橋（橫跨河；未修＝broken 半透明、修好＝完整木橋）
    const repaired = !!(state.flags && state.flags.bridgeRepaired);
    for (const tile of state.map.tiles) {
      if (!tile.bridge) continue;
      const el = addObjectPx(obStatic, "terrain", "bridge_h", (tile.x + 0.5) * TILE, (tile.y + 1) * TILE, TILE, repaired ? "" : "broken", 0, "bridge");
      if (el) { el.dataset.tileId = tile.id; el.dataset.repaired = repaired ? "1" : "0"; }
    }
    // Stage 5：事件點（東林古樹，地標）
    for (const tile of state.map.tiles) {
      if (!tile.event) continue;
      const el = addObjectPx(obStatic, "structures", seasonalStructureFrame("oak"), (tile.x + 0.5) * TILE, (tile.y + 1) * TILE, TILE * 2.0, "shadowed", 0, "event-point");
      if (el) { el.dataset.event = tile.event; el.dataset.tileId = tile.id; }
    }
    for (const tile of state.map.tiles) {
      if (!tile.forage) continue;
      const node = (window.FORAGE_NODES || []).find((n) => n.id === tile.forage);
      const frame = node && node.itemId === "glow_mushroom" ? "bush" : "bush";
      const el = addObjectPx(obStatic, "props", frame, (tile.x + 0.5) * TILE, (tile.y + 1) * TILE, TILE * 0.9, "shadowed", 0, "forage");
      if (el) { el.dataset.forage = tile.forage; el.dataset.item = node ? node.itemId : ""; el.dataset.tileId = tile.id; }
    }
  }
  // ---- 地形 autotile：依鄰格選 center/edge/corner，破除方塊感 ----
  // 鎖定（未解鎖）的農土視為荒草未開墾區，而非耕土 → 不再是整塊深棕方格
  function isLockedPlot(tile) {
    return !!(tile && tile.plotIndex != null && tile.plotIndex >= G.activePlotCount(state));
  }
  function terrainKind(tile) {
    if (!tile) return "grass";
    if (tile.terrain === "soil") return isLockedPlot(tile) ? "grass" : "soil"; // 鎖定農土＝荒草
    if (tile.terrain === "water") return "water";
    if (tile.terrain === "path") return "path";
    return "grass"; // grass / 障礙 / 建築 / 站點底層皆視為草
  }
  const DIR4 = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
  // 此磚四向「鄰格不同類」的邊（n/s/e/w）
  function edgeSidesFor(tile) {
    const kind = terrainKind(tile); const sides = [];
    for (const d of ["n", "s", "e", "w"]) {
      const nt = G.getTileXY(state, tile.x + DIR4[d][0], tile.y + DIR4[d][1]);
      if (terrainKind(nt) !== kind) sides.push(d);
    }
    return sides;
  }
  // 邊集合 → frame 後綴：0→c、1→單邊、2相鄰→角、對邊/3邊→取首單邊近似
  function autoSuffix(sides) {
    if (sides.length === 0) return "c";
    if (sides.length === 1) return sides[0];
    const has = (a, b) => sides.includes(a) && sides.includes(b);
    if (has("n", "e")) return "ne"; if (has("n", "w")) return "nw";
    if (has("s", "e")) return "se"; if (has("s", "w")) return "sw";
    return sides[0];
  }
  function hash2(x, y) { return Math.abs((x * 73856093) ^ (y * 19349663)); }
  // 地形 → v3 terrain frame（autotile）
  function terrainFrame(tile, prog) {
    const kind = terrainKind(tile);
    if (kind === "grass") {
      // 未開墾的鎖定農土：呈現高叢荒草，讓「等待開墾」一眼可辨（非深棕封死格）
      if (isLockedPlot(tile)) return "grass_clump_01";
      const h = hash2(tile.x, tile.y);
      if (h % 9 === 0) return "grass_flower_01";
      if (h % 9 === 1) return "grass_flower_02";
      if (h % 13 === 0) return "grass_clump_01";
      return "grass_center_0" + (1 + (h % 4));
    }
    const sfx = autoSuffix(edgeSidesFor(tile));
    if (kind === "soil") return ((prog && prog.wet && !prog.ready) ? "soil_wet_" : "soil_dry_") + sfx;
    if (kind === "water") return "water_" + sfx;
    if (kind === "path") return "path_" + sfx;
    return "grass_center_01";
  }
  // 動態物件（作物 + 狀態、動物、任務標記）每 tick 重建；地面/靜態物件另管。
  // 季節是常駐底調：同步到 html（天空）與 mapScene（地圖 tint），不靠轉場動畫表意。
  function updateSeasonAmbient(t) {
    if (!state) return;
    const sId = G.currentSeason ? G.currentSeason(state, t) : "春";
    document.documentElement.dataset.season = sId;
    const scene = $("mapScene");
    if (scene) {
      const changed = !!scene.dataset.season && scene.dataset.season !== sId;
      scene.dataset.season = sId;
      if (changed && atlasReady && worldEl) buildStaticObjects();
    }
  }
  // Stage 9：天氣視覺化——只在天氣真的變了才切 class，避免每個 tick 重啟 CSS 動畫
  function updateWeatherLayer(t) {
    const el = $("weatherLayer"); if (!el || !state) return;
    const wId = G.currentWeather(state, t);
    const scene = $("mapScene");
    if (scene) scene.dataset.weather = wId;
    if (el.dataset.weather === wId) return;
    el.dataset.weather = wId;
    el.className = wId === "clear" ? "" : wId;
  }
  function updateMap(t) {
    updateSeasonAmbient(t);
    updateWeatherLayer(t);
    if (!state.map || tileEls.length === 0) return;
    paintGround();
    for (const e of obDyn) e.remove(); obDyn.length = 0;
    if (atlasReady && worldEl) {
      const active = G.activePlotCount(state);
      // 作物（在 soil 磚，略低於角色 z）
      for (const tile of state.map.tiles) {
        if (tile.plotIndex == null || tile.plotIndex >= active) continue;
        const plot = state.plots[tile.plotIndex];
        if (!plot.cropId) { resetCropMatureCue("map:" + tile.plotIndex); continue; }
        const prog = G.getCropProgress(state, plot, t);
        const crop = window.CROPS[plot.cropId];
        const sheet = (crop && crop.sheet) || "crops";
        const frame = plot.cropId + "_" + STAGE_NAME[prog.stage];
        const hasFrame = crop && !crop.emojiOnly && window.Atlas.getFrame(sheet, frame);
        const el = hasFrame
          ? addObjectPx(obDyn, sheet, frame, (tile.x + 0.5) * TILE, (tile.y + 1) * TILE, TILE * 0.92, "crop", -2, "crop")
          : addEmojiObjectPx(obDyn, prog.stage <= 1 ? "🌱" : crop.emoji, (tile.x + 0.5) * TILE, (tile.y + 1) * TILE, TILE * (prog.ready ? 0.8 : 0.68), "crop", -2, "crop");
        if (el) { el.dataset.crop = plot.cropId; el.dataset.tileId = tile.id; }
        if (prog.ready) {
          cropMatureCue("map:" + tile.plotIndex, tile.id, el);
          addDot((tile.x + 0.5) * TILE, tile.y * TILE + 2);
        } else {
          resetCropMatureCue("map:" + tile.plotIndex);
          addBar(tile.x * TILE + TILE * 0.12, (tile.y + 1) * TILE - 6, TILE * 0.76, prog.ratio);
        }
      }
      for (const b of (state.buildings || [])) {
        if (!b || b.structureId || !b.tileId) continue;
        const tile = G.getTileById(state, b.tileId); if (!tile) continue;
        const baseFrame = BUILDING_FRAME[b.type] || "storage_crate";
        const sheet = BUILDING_SHEET[b.type] || "props";
        const frame = sheet === "structures" ? seasonalStructureFrame(baseFrame, t) : baseFrame;
        const el = addObjectPx(obDyn, sheet, frame, (tile.x + 0.5) * TILE, (tile.y + 1) * TILE, TILE * 1.08, "shadowed", 0, "building");
        if (el) { el.dataset.buildingId = b.id; el.dataset.buildingType = b.type; el.dataset.tileId = tile.id; }
      }
      renderAnimals(t);
      renderNpcs(t);
      renderMarkers(t);
    }
    positionPlayer(true);
  }
  function addBar(left, top, w, ratio) {
    const el = document.createElement("div"); el.className = "ob-bar";
    el.style.left = pxv(left); el.style.top = pxv(top); el.style.width = pxv(w);
    el.innerHTML = '<i style="width:' + (ratio * 100).toFixed(0) + '%"></i>';
    worldEl.appendChild(el); obDyn.push(el);
  }
  function addDot(cx, top, variant) {
    const el = document.createElement("div"); el.className = "ob-dot" + (variant ? " ob-dot-" + variant : "");
    el.style.left = pxv(Math.round(cx - 5)); el.style.top = pxv(top);
    worldEl.appendChild(el); obDyn.push(el);
  }
  function strHash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  // Stage 7：地圖上動物頭上的照護狀態小圖示（hungry/thirsty/needs_groom 才顯示，happy 不額外標，
  // 因為 happy 已經用 animals_care 的開心姿態表現，避免畫面太吵）
  const STATUS_ICON_ROW = { hungry: "hungry", thirsty: "thirsty", needs_groom: "needs_groom" };
  function addStatusIcon(cx, top, status) {
    const row = STATUS_ICON_ROW[status]; if (!row || !atlasReady) return;
    const size = TILE * 0.34;
    const el = document.createElement("div"); el.className = "ob-status-icon";
    el.dataset.audit = "object"; el.dataset.kind = "animal-status"; el.dataset.status = status;
    el.style.left = pxv(Math.round(cx - size / 2)); el.style.top = pxv(Math.round(top));
    el.style.width = pxv(size); el.style.height = pxv(size);
    const stl = window.Atlas.frameStyleFor("animal_status", row + "_00", size, size);
    if (stl) { el.style.backgroundImage = stl.backgroundImage; el.style.backgroundSize = stl.backgroundSize; el.style.backgroundPosition = stl.backgroundPosition; }
    worldEl.appendChild(el); obDyn.push(el);
  }
  // 動物實體：每隻動物在 home 結構前方草地緩慢 roam 漫遊（Lissajous），走動時用 walk 幀並依朝向翻轉，
  // 靜止時依親密度用開心/待機幀；頭上顯示照護提示圖示、可收集時放亮點。每隻掛 data-audit/animal-id 供稽核。
  function renderAnimals(t) {
    for (const home of state.buildings) {
      const animals = G.animalsInHome(state, home.id); if (!animals.length) continue;
      const s = (window.STRUCTURES || []).find((x) => x.id === home.structureId);
      let baseX, baseY;
      if (s) { baseX = s.x + s.w / 2; baseY = s.y + s.h + 0.9; } // 地圖常駐多格結構：結構正下方草地帶
      else {
        // Stage 7.1 修正：玩家自建的建築（buildBuilding，如額外雞舍/畜舍/蜂箱）沒有 structureId，
        // 原本會被 continue 跳過導致動物在地圖上永遠不可見。改用建築自己所在的單格磚當錨點。
        const tile = G.getTileById(state, home.tileId); if (!tile) continue;
        baseX = tile.x + 0.5; baseY = tile.y + 1.15;
      }
      animals.forEach((a, i) => {
        const seed = (strHash(a.id) % 1000) / 1000;        // 每隻獨立相位/速度
        const ph = seed * Math.PI * 2, sp = 0.00035 + seed * 0.00025;
        const rx = Math.sin(t * sp + ph) * 1.1 + Math.sin(t * sp * 0.5 + ph * 2) * 0.35;
        const ry = Math.cos(t * sp * 0.8 + ph) * 0.45;
        const spread = (i - (animals.length - 1) / 2) * 0.7; // 多隻橫向錯開
        const cx = (baseX + spread + rx) * TILE, baselineY = (baseY + ry) * TILE;
        const vx = Math.cos(t * sp + ph);                  // x 速度方向
        const moving = Math.abs(vx) > 0.45;
        const status = G.animalStatus(state, a, t);
        const col = Math.floor(t / 320) % 2 === 0 ? "a" : "b";
        // 移動中沿用基礎 walk 幀；靜止時開心用 animals_care 開心姿態，其餘用基礎 idle 幀
        const adef = window.ANIMALS[a.type] || {};
        const baseSheet = adef.sheet || "animals";
        const careSheet = adef.careSheet || "animals_care";
        const sheet = (!moving && status === "happy") ? careSheet : baseSheet;
        const frame = a.type + "_" + (moving ? "walk_" : (status === "happy" ? "happy_" : "idle_")) + col;
        const el = addObjectPx(obDyn, sheet, frame, cx, baselineY, TILE * 0.82, "shadowed", 0, "animal");
        if (el) {
          el.dataset.animalId = a.id; el.dataset.animalType = a.type;
          el.dataset.homeId = home.id; el.dataset.status = status;
          if (vx < 0) el.style.transform = "scaleX(-1)"; // 朝左翻轉（源圖朝右）
        }
        addStatusIcon(cx, baselineY - TILE * 1.6, status);
        if (G.animalProgress(state, a, t).ready) addDot(cx, baselineY - TILE * 1.05);
      });
    }
  }
  // Stage 6：NPC 鎮民 — 固定站位、front-facing 呼吸 idle；交談中切 talk 幀；掛 data-audit=npc
  let activeTalk = null; // { npcId, until }
  function renderNpcs(t) {
    for (const tile of state.map.tiles) {
      if (!tile.npc) continue;
      const npc = window.NPCS[tile.npc]; if (!npc) continue;
      const talking = activeTalk && activeTalk.npcId === tile.npc && t < activeTalk.until;
      const col = Math.floor(t / 420) % 2 === 0 ? "a" : "b";
      const frame = tile.npc + (talking ? "_talk_" : "_idle_") + col;
      const cx = (tile.x + 0.5) * TILE, baselineY = (tile.y + 1) * TILE;
      const el = addObjectPx(obDyn, "npcs", frame, cx, baselineY, TILE * 1.0, "shadowed", 0, "npc");
      if (el) { el.dataset.npc = tile.npc; el.dataset.tileId = tile.id; }
      // Stage 10：委託可交付時放綠點（優先）；否則首次見面尚未對話過時放金點
      const req = state.npcRequests && state.npcRequests[tile.npc];
      const sq = G.npcSideQuestStatus ? G.npcSideQuestStatus(state, tile.npc) : null;
      if (req && G.canFulfillNpcRequest(state, tile.npc)) addDot(cx, baselineY - TILE * 1.15, "ready");
      else if (sq && sq.status === "available") addDot(cx, baselineY - TILE * 1.15);
      else if (!(state.story.dialogueSeen && state.story.dialogueSeen[tile.npc])) addDot(cx, baselineY - TILE * 1.15);
    }
  }
  // 任務標記：目前任務目標磚上方浮動箭頭
  function renderMarkers(t) {
    const mEl = $("markerLayer"); if (!mEl) return; mEl.innerHTML = "";
    const targetId = G.questMarkerTile(state, t); if (!targetId) return;
    const tile = G.getTileById(state, targetId); if (!tile) return;
    const m = document.createElement("div"); m.className = "qmarker";
    m.dataset.audit = "quest-marker";
    m.dataset.quest = (state.story && state.story.questId) || "";
    m.dataset.tileId = targetId;
    m.innerHTML = '<div class="qdot"></div><div class="qpin"></div>';
    m.style.left = pxv((tile.x + 0.5) * TILE); m.style.top = pxv(tile.y * TILE);
    mEl.appendChild(m);
  }
  // ---- 動作 VFX 疊層（地圖可見回饋）----
  const ACTION_VFX = { water: "water_droplets", hoe: "soil_dust", clear: "soil_dust", build: "soil_dust",
    sow: "seed_scatter", plant: "seed_scatter", harvest: "harvest_pop", collect: "product_pop" };
  let vfxSpawnCount = 0;
  function spawnVfx(tileId, vfxRow, opts) {
    if (!shouldUseJuiceFx()) return;
    if (!atlasReady || !vfxRow) return;
    const layer = $("vfxLayer"); const el = tileElOf(tileId); if (!layer || !el) return;
    const sheet = (opts && opts.sheet) || "vfx"; // Stage 7：動物照護 VFX 用獨立的 care_vfx sheet
    vfxSpawnCount++;
    const size = el.offsetWidth * ((opts && opts.scale) || 0.95);
    const sp = document.createElement("div"); sp.className = "map-vfx";
    sp.style.width = size + "px"; sp.style.height = size + "px";
    sp.style.left = (el.offsetLeft + el.offsetWidth / 2) + "px";
    sp.style.top = (el.offsetTop + el.offsetHeight * ((opts && opts.yf) || 0.5)) + "px";
    trimFxLayer(layer, 1);
    layer.appendChild(sp);
    let f = 0;
    const paint = () => { const stl = window.Atlas.frameStyleFor(sheet, vfxRow + "_" + String(f).padStart(2, "0"), size, size);
      if (stl) { sp.style.backgroundImage = stl.backgroundImage; sp.style.backgroundSize = stl.backgroundSize; sp.style.backgroundPosition = stl.backgroundPosition; } };
    paint();
    const iv = setInterval(() => { f++; if (f > 5) { clearInterval(iv); sp.remove(); return; } paint(); }, 75);
    setTimeout(() => { clearInterval(iv); sp.remove(); }, 650);
  }
  function spawnRing(tileId, valid) { spawnVfx(tileId, valid ? "valid_ring" : "invalid_ring", { scale: 1.05 }); }
  function stationTileOf(type) { const t = state.map.tiles.find((x) => x.station === type); return t ? t.id : null; }

  // ---------- 玩家定位 / camera / 移動 ----------
  function tileElOf(tileId) { const r = tileEls.find((x) => x.tileId === tileId); return r ? r.el : null; }
  function clearCameraFocus() {
    if (!state.camera) state.camera = {};
    state.camera.focusTileId = null; state.camera.focusUntil = 0; state.camera.followPlayer = true;
  }
  function focusCameraOnTile(tileId) {
    const tile = G.getTileById(state, tileId);
    if (!tile) return false;
    if (!state.camera) state.camera = {};
    state.camera.focusTileId = tileId;
    state.camera.focusUntil = now() + 2600;
    state.camera.followPlayer = false;
    spawnRing(tileId, true);
    updateCamera(true);
    toast("📍 鏡頭移到任務目標");
    scheduleSave();
    return true;
  }
  function positionPlayer(animate) {
    const pl = $("player"); if (!pl) return;
    const tile = G.getTileById(state, state.player.tileId); if (!tile) return;
    if (pl.dataset.audit !== "player") { pl.dataset.audit = "player"; }
    pl.dataset.tileId = tile.id; pl.dataset.facing = state.player.facing || "down";
    const w = TILE * 1.18, h = w * (64 / 48);            // v3/v4 frame 比例 3:4
    pl.style.width = pxv(w); pl.style.height = pxv(h);
    if (!animate) pl.style.transition = "none"; else pl.style.transition = "";
    const cx = (tile.x + 0.5) * TILE, baselineY = (tile.y + 1) * TILE - TILE * 0.08;
    pl.style.left = pxv(cx); pl.style.top = pxv(baselineY);
    pl.style.zIndex = Math.round(baselineY);             // y-sort：與物件/建築互相遮擋
    if (!animate) { void pl.offsetWidth; pl.style.transition = ""; }
    updateCamera(animate);
  }
  // camera：跟隨玩家置中，clamp 到世界邊界（世界比視口大才平移）
  function updateCamera(animate) {
    if (!worldEl) return;
    const scene = $("mapScene"); if (!scene) return;
    const vw = scene.clientWidth, vh = scene.clientHeight;
    const worldW = state.map.width * TILE, worldH = state.map.height * TILE;
    let tile = null;
    if (state.camera && state.camera.focusTileId && now() < (state.camera.focusUntil || 0)) {
      tile = G.getTileById(state, state.camera.focusTileId);
    } else if (state.camera && state.camera.focusTileId) {
      clearCameraFocus();
    }
    if (!tile) tile = G.getTileById(state, state.player.tileId);
    if (!tile) return;
    const px0 = (tile.x + 0.5) * TILE, py0 = (tile.y + 0.5) * TILE;
    if (mapViewMode() === "natural") {
      const maxX = Math.max(0, worldW - vw), maxY = Math.max(0, worldH - vh);
      const left = Math.min(maxX, Math.max(0, px0 - vw / 2));
      const top = Math.min(maxY, Math.max(0, py0 - vh / 2));
      state.camera.x = -left; state.camera.y = -top;
      if (!animate) scene.scrollTo(left, top);
      else scene.scrollTo({ left, top, behavior: "smooth" });
      if (!animate) worldEl.style.transition = "none";
      worldEl.style.transform = "translate(0px,0px)";
      if (!animate) { void worldEl.offsetWidth; worldEl.style.transition = ""; }
      return;
    }
    let camX = vw / 2 - px0, camY = vh / 2 - py0;
    camX = worldW <= vw ? (vw - worldW) / 2 : Math.min(0, Math.max(vw - worldW, camX));
    camY = worldH <= vh ? (vh - worldH) / 2 : Math.min(0, Math.max(vh - worldH, camY));
    state.camera.x = camX; state.camera.y = camY;
    if (!animate) worldEl.style.transition = "none";
    worldEl.style.transform = "translate(" + Math.round(camX) + "px," + Math.round(camY) + "px)";
    if (!animate) { void worldEl.offsetWidth; worldEl.style.transition = ""; }
  }
  function walkPath(path, onArrive) {
    if (moveTimer) { clearTimeout(moveTimer); moveTimer = null; }
    clearCameraFocus();
    if (!path || path.length === 0) { if (onArrive) onArrive(); else setPlayerIdle(); return; }
    state.player.action = "walk";
    let i = 0;
    const step = () => {
      if (i >= path.length) {
        moveTimer = null; state.player.action = "idle";
        if (onArrive) onArrive(); else setPlayerIdle();
        scheduleSave(); return;
      }
      const nextId = path[i++];
      const nt = G.getTileById(state, nextId);
      const cur = G.getTileById(state, state.player.tileId);
      state.player.facing = G.facingTo(cur, nt);
      state.player.tileId = nextId; state.player.x = nt.x; state.player.y = nt.y;
      positionPlayer(true);
      moveTimer = setTimeout(step, window.MOVE_MS);
    };
    step();
  }
  function mapActivationType(ev, tileId) {
    if (!ev) return "direct";
    if (ev.pointerType) {
      lastMapPointer = null;
      return ev.pointerType;
    }
    if (typeof window.PointerEvent === "function") {
      const pointer = lastMapPointer;
      lastMapPointer = null;
      if (pointer && pointer.tileId === tileId && now() - pointer.at <= MAP_POINTER_SEQUENCE_MAX_AGE_MS) {
        return pointer.pointerType;
      }
      if (ev.sourceCapabilities && ev.sourceCapabilities.firesTouchEvents) return "touch";
      return "mouse";
    }
    if (ev.sourceCapabilities && ev.sourceCapabilities.firesTouchEvents) return "touch";
    if (now() - lastTouchMapAt <= LEGACY_TOUCH_CLICK_WINDOW_MS) return "touch";
    return "mouse";
  }
  function touchFarmActionText(action) {
    if (action === "plant") {
      const crop = window.CROPS[selectedSeed];
      return `種植 ${crop.emoji}${crop.name}（🪙${crop.seedCost}）`;
    }
    if (action === "harvest") return "收成這格作物";
    if (action === "water") return "澆水這格作物";
    return "執行農作";
  }
  function renderTouchFarmPreview() {
    const el = $("touchActionPreview"); if (!el) return;
    if (!pendingTouchFarmAction) { el.hidden = true; el.textContent = ""; return; }
    el.hidden = false;
    el.textContent = "預覽：" + touchFarmActionText(pendingTouchFarmAction.action) + " · 再點同格確認";
  }
  function clearTouchFarmPreview(repaint) {
    if (!pendingTouchFarmAction) return;
    pendingTouchFarmAction = null;
    renderTouchFarmPreview();
    if (repaint !== false) paintGround();
  }
  function hideBuildWheel() {
    const el = $("buildWheel"); if (!el) return;
    el.hidden = true; el.innerHTML = "";
  }
  function hideObjectBubble() {
    const el = $("objectBubble"); if (!el) return;
    el.hidden = true; el.innerHTML = "";
  }
  function hideSceneActions() {
    const el = $("sceneActionBar"); if (!el) return;
    el.hidden = true; el.innerHTML = "";
  }
  function tileViewportPoint(tileId, yf) {
    const scene = $("mapScene"), el = tileElOf(tileId);
    if (!scene || !el) return null;
    const sr = scene.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height * (yf == null ? 0.25 : yf) };
  }
  function elementViewportPoint(el, yf) {
    const scene = $("mapScene");
    if (!scene || !el) return null;
    const sr = scene.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height * (yf == null ? 0.2 : yf) };
  }
  function placeSceneOverlay(el, pt) {
    const scene = $("mapScene");
    if (!scene || !el || !pt) return;
    const pad = 12;
    const x = Math.max(pad, Math.min(scene.clientWidth - pad, pt.x));
    const y = Math.max(74, Math.min(scene.clientHeight - pad, pt.y));
    el.style.left = x + "px";
    el.style.top = y + "px";
  }
  function buildCostText(def) {
    return Object.entries(def.cost || {}).map(([k, v]) => k === "coins" ? "C" + v : v + ((window.MATERIALS[k] && window.MATERIALS[k].emoji) || k)).join(" ");
  }
  function buildOptionsForTile(tile) {
    if (!tile || tile.terrain !== "grass" || tile.object || tile.buildingId || tile.structureId || tile.blocked || tile.station || tile.npc) return [];
    return window.BUILDING_ORDER.filter((type) => {
      const def = window.BUILDINGS[type];
      return def && G.buildingUnlocked(state, type) && G.canAffordCost(state, def.cost) &&
        !(G.buildingAtMaxCount && G.buildingAtMaxCount(state, type));
    });
  }
  function showBuildWheel(tile) {
    const box = $("buildWheel"); if (!box || !tile) return;
    hideObjectBubble(); hideSceneActions();
    const opts = buildOptionsForTile(tile);
    if (!opts.length) { toast("沒有可直接建造的項目"); hideBuildWheel(); return; }
    box.innerHTML = "";
    opts.forEach((type) => {
      const def = window.BUILDINGS[type];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "build-wheel-btn";
      b.dataset.type = type;
      b.title = def.name + " " + buildCostText(def);
      b.innerHTML = `<span class="bw-ic">${def.emoji}</span><span class="bw-t">${escapeHtml(def.name)}</span>`;
      b.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); buildFromWheel(tile.id, type); };
      box.appendChild(b);
    });
    box.hidden = false;
    placeSceneOverlay(box, tileViewportPoint(tile.id, 0.15));
  }
  function buildFromWheel(tileId, type) {
    const def = window.BUILDINGS[type];
    const r = G.buildBuilding(state, tileId, type, now());
    if (r.ok) {
      playAction("hoe");
      playSound("ui");
      spawnVfx(tileId, "soil_dust");
      toast(def.emoji + " " + def.name);
      hideBuildWheel();
      afterChange(true);
      buildMap();
      renderTileContext();
    } else {
      spawnRing(tileId, false);
      toast(r.reason === "cost" ? "資源不足" : r.reason === "locked" ? "等級不足" : r.reason === "max_count" ? "數量已滿" : "不能建造");
    }
  }
  const SCENE_ACTION_META = {
    plant: ["🌱", "種植"], harvest: ["✂", "收成"], water: ["💧", "澆水"], clear: ["⛏", "清除"],
    build: ["🏗", "建造"], collect: ["🧺", "收集"], use: ["●", "使用"], deliver: ["✓", "交付"],
    sell: ["🪙", "賣出"], talk: ["…", "交談"],
  };
  function tileReadyCrop(tile) {
    if (!tile || tile.plotIndex == null || tile.plotIndex >= G.activePlotCount(state)) return false;
    const plot = state.plots[tile.plotIndex];
    return !!(plot && plot.cropId && G.getCropProgress(state, plot, now()).ready);
  }
  function sceneActionsForTile(tile) {
    if (!tile) return [];
    const actions = [];
    const add = (action, enabled) => {
      if (!actions.some((a) => a.action === action)) actions.push({ action, enabled: enabled !== false });
    };
    if (currentTool() === "build" && buildOptionsForTile(tile).length) add("build");
    const active = G.activePlotCount(state);
    if (tile.plotIndex != null && tile.plotIndex < active) {
      const plot = state.plots[tile.plotIndex];
      if (!plot || !plot.cropId) add("plant");
      else {
        const prog = G.getCropProgress(state, plot, now());
        if (prog.ready) add("harvest");
        else if (!prog.wet) add("water");
      }
    }
    if (tile.object) add("clear", currentTool() === "clear" || state.coins >= ((window.OBSTACLES[tile.object] || {}).clearCost || 0));
    if (tile.buildingId) add("collect");
    if (tile.station) {
      if (tile.station === "order_board" && state.orders.some((o) => G.canFulfill(state, o))) add("deliver");
      if (tile.station === "storage") add("sell", G.storageUsed(state) > 0);
      add("use");
    }
    if (tile.structureId && !tile.buildingId) add("use");
    if (tile.bridge || tile.event || tile.forage) add("use");
    if (tile.npc) add("talk");
    return actions.slice(0, 3);
  }
  function renderSceneActionsForSelection() {
    const bar = $("sceneActionBar"); if (!bar) return;
    const tile = selectedTileId ? G.getTileById(state, selectedTileId) : null;
    const actions = sceneActionsForTile(tile);
    if (!tile || !actions.length) { hideSceneActions(); return; }
    bar.innerHTML = "";
    actions.forEach((entry) => {
      const meta = SCENE_ACTION_META[entry.action] || ["●", entry.action];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "scene-action-btn";
      b.dataset.action = entry.action;
      b.disabled = entry.enabled === false;
      b.title = meta[1];
      b.setAttribute("aria-label", meta[1]);
      b.innerHTML = `<span class="sab-ic">${meta[0]}</span><span class="sab-t">${meta[1]}</span>`;
      b.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); runSceneAction(entry.action, tile.id); };
      bar.appendChild(b);
    });
    bar.hidden = false;
  }
  function runSceneAction(action, tileId) {
    const tile = G.getTileById(state, tileId); if (!tile) return;
    hideBuildWheel(); hideObjectBubble(); clearTouchFarmPreview(false);
    if (action === "build") { showBuildWheel(tile); return; }
    if (action === "deliver") { deliverOrderAtBoard(tile); return; }
    if (action === "sell") { sellAtStorage(tile); return; }
    if (action === "use" || action === "talk") {
      if (tile.station) useStation(tile);
      else if (tile.structureId) useStructure(tile);
      else if (tile.bridge) useBridge(tile);
      else if (tile.event) useEvent(tile);
      else if (tile.forage) useForage(tile);
      else if (tile.npc) useNpc(tile);
      return;
    }
    spawnRing(tileId, true);
    moveAndAct(tileId, action);
  }
  function deliverOrderAtBoard(tile) {
    const order = state.orders.find((o) => G.canFulfill(state, o));
    if (!order) { useStation(tile); return; }
    const plan = G.planMoveTo(state, tile.id);
    if (!plan) { toast("走不到交付點"); return; }
    spawnRing(tile.id, true);
    walkPath(plan.path, () => {
      const stand = G.getTileById(state, plan.standId);
      state.player.facing = G.facingTo(stand, tile);
      playAction("station", state.player.facing);
      const r = G.fulfillOrder(state, order.id, now());
      if (r.ok) {
        G.advanceStory(state, "deliver");
        spawnVfx(tile.id, "product_pop");
        playSound("order"); playSound("coin");
        toast("交付 +" + fmtNum(r.coins));
        afterChange(true); renderOrders();
      } else toast("交付條件不足");
    });
  }
  function sellAtStorage(tile) {
    const plan = G.planMoveTo(state, tile.id);
    if (!plan) { toast("走不到出貨箱"); return; }
    spawnRing(tile.id, true);
    walkPath(plan.path, () => {
      const stand = G.getTileById(state, plan.standId);
      state.player.facing = G.facingTo(stand, tile);
      playAction("carry", state.player.facing);
      const r = G.sellAll(state, now());
      if (r.coins > 0) { spawnVfx(tile.id, "product_pop"); playSound("coin"); toast("賣出 +" + fmtNum(r.coins)); afterChange(true); renderOrders(); }
      else toast("沒有可賣出的物品");
    });
  }
  function homeTileIdForAnimal(a) {
    const b = a && state.buildings.find((x) => x.id === a.homeId);
    return b ? b.tileId : state.player.tileId;
  }
  function showBuildingBubble(buildingId, anchorEl) {
    const bld = state.buildings.find((x) => x.id === buildingId); if (!bld) return;
    const def = window.BUILDINGS[bld.type], box = $("objectBubble"); if (!def || !box) return;
    hideBuildWheel(); hideSceneActions();
    box.innerHTML = "";
    const add = (action, icon, label, enabled) => {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "object-bubble-btn"; btn.dataset.action = action; btn.disabled = enabled === false;
      btn.title = label; btn.innerHTML = `<span class="obb-ic">${icon}</span><span class="obb-t">${label}</span>`;
      btn.onclick = (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        if (action === "collect") collectBuildingFromBubble(bld.id);
        if (action === "use") {
          const tile = G.getTileById(state, bld.tileId);
          if (tile && tile.structureId) useStructure(tile);
          hideObjectBubble();
        }
      };
      box.appendChild(btn);
    };
    const isHome = def.effect && def.effect.unlockAnimal;
    add(isHome ? "collect" : "use", isHome ? "🧺" : "●", isHome ? "收集" : "使用", true);
    box.hidden = false;
    placeSceneOverlay(box, elementViewportPoint(anchorEl, 0.08));
  }
  function collectBuildingFromBubble(buildingId) {
    const bld = state.buildings.find((x) => x.id === buildingId); if (!bld) return;
    const tileId = bld.tileId || state.player.tileId;
    const r = G.collectHome(state, bld.id, now());
    if (r.total > 0) {
      playAction("collect"); spawnVfx(tileId, "product_pop"); toast("收集 " + r.total);
      hideObjectBubble(); afterChange(true);
    } else toast("尚無可收集產物");
  }
  function showAnimalBubble(animalId, anchorEl) {
    const a = state.animals.find((x) => x.id === animalId); if (!a) return;
    const def = window.ANIMALS[a.type], box = $("objectBubble"); if (!def || !box) return;
    hideBuildWheel(); hideSceneActions();
    const t = now();
    const prog = G.animalProgress(state, a, t);
    const canFeed = Object.keys(def.feedCost || {}).every((k) => (state.storage.items[k] || 0) >= def.feedCost[k]) && t - (a.lastFedAt || 0) >= window.CARE_COOLDOWN_MS;
    const buttons = [
      { action: "collect", icon: "🧺", label: "收集", enabled: prog.ready },
      { action: "feed", icon: "🌾", label: "餵食", enabled: canFeed },
      { action: "water", icon: "💧", label: "澆水", enabled: t - (a.lastWateredAt || 0) >= window.CARE_COOLDOWN_MS },
      { action: "groom", icon: "🧹", label: "梳理", enabled: t - (a.lastGroomedAt || 0) >= window.CARE_COOLDOWN_MS },
    ];
    box.innerHTML = "";
    buttons.forEach((cfg) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "object-bubble-btn"; b.dataset.action = cfg.action; b.disabled = !cfg.enabled;
      b.title = cfg.label; b.innerHTML = `<span class="obb-ic">${cfg.icon}</span><span class="obb-t">${cfg.label}</span>`;
      b.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); careAnimalFromBubble(animalId, cfg.action); };
      box.appendChild(b);
    });
    box.hidden = false;
    placeSceneOverlay(box, elementViewportPoint(anchorEl, 0.1));
  }
  function careAnimalFromBubble(animalId, action) {
    const a = state.animals.find((x) => x.id === animalId); if (!a) return;
    const tileId = homeTileIdForAnimal(a);
    let r = null;
    if (action === "collect") r = G.collectAnimal(state, animalId, now());
    else if (action === "feed") r = G.feedAnimal(state, animalId, now());
    else if (action === "water") r = G.waterAnimal(state, animalId, now());
    else if (action === "groom") r = G.groomAnimal(state, animalId, now());
    if (!r || !r.ok) { toast("現在不能執行"); renderSceneActionsForSelection(); return; }
    if (action === "collect") { playAction("carry"); playSound("coin"); spawnVfx(tileId, "product_pop"); toast("收集 " + (r.added || 0) + " " + itemName(r.product)); }
    if (action === "feed") { playAction("sow"); playSound("feed"); spawnVfx(tileId, "feed_bits", { sheet: "care_vfx" }); toast("餵食 +" + itemName(r.product)); G.advanceStory(state, "care_animal", now()); }
    if (action === "water") { playAction("water"); playSound("water"); spawnVfx(tileId, "water_splash", { sheet: "care_vfx" }); toast("澆水"); G.advanceStory(state, "care_animal", now()); }
    if (action === "groom") { playAction("build"); playSound("groom"); spawnVfx(tileId, "groom_sparkle", { sheet: "care_vfx" }); toast("梳理"); G.advanceStory(state, "care_animal", now()); }
    hideObjectBubble();
    afterChange(true);
  }
  function confirmTouchFarmAction(tileId, action) {
    const signature = {
      tileId,
      action,
      tool: currentTool(),
      seedId: action === "plant" ? selectedSeed : null,
    };
    const pending = pendingTouchFarmAction;
    const confirmed = !!pending && pending.tileId === signature.tileId && pending.action === signature.action &&
      pending.tool === signature.tool && pending.seedId === signature.seedId;
    if (confirmed) {
      clearTouchFarmPreview(false);
      return true;
    }
    pendingTouchFarmAction = signature;
    renderTouchFarmPreview();
    paintGround();
    toast("👆 " + touchFarmActionText(action) + "；再點同格確認");
    return false;
  }
  // 點地圖磚：桌機保留點擊即操作；觸控先給地圖內 action dock。
  function handleMapClick(tileId, activationType) {
    if (hasOpenModal()) return;
    const isTouch = activationType === "touch";
    if (pendingTouchFarmAction && (!isTouch || pendingTouchFarmAction.tileId !== tileId)) clearTouchFarmPreview(false);
    hideBuildWheel(); hideObjectBubble();
    selectedTileId = tileId; state.interaction.selectedTileId = tileId;
    const tile = G.getTileById(state, tileId);
    const tool = currentTool();
    renderTileContext();
    switchTab("tile"); // 點磚自動顯示磚資訊分頁
    renderSceneActionsForSelection();
    if (tool === "inspect") { updateMap(now()); inspectTile(tile); return; }

    // 站點：任何工具點站點都走過去 + 播站點動作 + 觸發效果
    if (tile.station) { if (isTouch) { spawnRing(tile.id, true); updateMap(now()); return; } useStation(tile); updateMap(now()); return; }
    // 多格建築/結構：走過去互動（雞舍/畜舍收集、市集賣出、農舍歇息）
    if (tile.structureId) { if (isTouch) { spawnRing(tile.id, true); updateMap(now()); return; } useStructure(tile); updateMap(now()); return; }
    // Stage 5：斷橋（走過去修橋 / 過橋）、事件點（走過去觸發）
    if (tile.bridge) { if (isTouch) { spawnRing(tile.id, true); updateMap(now()); return; } useBridge(tile); updateMap(now()); return; }
    if (tile.event) { if (isTouch) { spawnRing(tile.id, true); updateMap(now()); return; } useEvent(tile); updateMap(now()); return; }
    if (tile.forage) { if (isTouch) { spawnRing(tile.id, true); updateMap(now()); return; } useForage(tile); updateMap(now()); return; }
    // Stage 6：NPC（走過去交談）
    if (tile.npc) { if (isTouch) { spawnRing(tile.id, true); updateMap(now()); return; } useNpc(tile); updateMap(now()); return; }

    if (tileReadyCrop(tile) && tool !== "inspect" && tool !== "build" && tool !== "clear") {
      clearTouchFarmPreview(false);
      spawnRing(tileId, true); moveAndAct(tileId, "harvest"); updateMap(now()); return;
    }

    const act = actionTargetFor(tool, tile);
    if (act.invalid && isTouch && sceneActionsForTile(tile).length) {
      clearTouchFarmPreview(false); spawnRing(tileId, true); renderSceneActionsForSelection(); updateMap(now()); return;
    }
    if (act.invalid) { clearTouchFarmPreview(false); toast(act.invalid); state.interaction.lastInvalidReason = act.invalid; spawnRing(tileId, false); updateMap(now()); return; }
    if (act.action) {
      if (act.action === "build") { clearTouchFarmPreview(false); showBuildWheel(tile); updateMap(now()); return; }
      if (isTouch && tile.plotIndex != null) { clearTouchFarmPreview(false); spawnRing(tileId, true); renderSceneActionsForSelection(); updateMap(now()); return; }
      clearTouchFarmPreview(false);
      spawnRing(tileId, true); moveAndAct(tileId, act.action); updateMap(now()); return;
    }
    // 無動作：若可走就走過去
    if (G.isWalkable(state, tile)) {
      const path = G.bfsPath(state, state.player.tileId, tileId);
      if (path) { spawnRing(tileId, true); walkPath(path); } else toast("走不到那裡");
    } else {
      spawnRing(tileId, false); toast(blockedReason(tile));
    }
    updateMap(now());
  }
  // 站點：走到相鄰 → 面向站點 → 播動作 → 觸發效果
  function useStation(tile) {
    const st = window.STATIONS[tile.station]; if (!st) return;
    const plan = G.planMoveTo(state, tile.id);
    if (!plan) { toast("走不到 " + st.name); return; }
    spawnRing(tile.id, true);
    walkPath(plan.path, () => {
      const stand = G.getTileById(state, plan.standId);
      state.player.facing = G.facingTo(stand, tile);
      playAction(st.action, state.player.facing);
      resolveStation(st);
    });
  }
  // 多格結構：走到相鄰 → 面向 → 動作 → 效果
  function useStructure(tile) {
    const s = G.structureAt(state, tile.id); if (!s) return;
    const plan = G.planMoveToStructure(state, s.id);
    if (!plan) { toast("走不到 " + s.name); return; }
    spawnRing(tile.id, true);
    walkPath(plan.path, () => {
      const stand = G.getTileById(state, plan.standId);
      state.player.facing = G.facingTo(stand, { x: s.x + s.w / 2, y: s.y + s.h / 2 });
      resolveStructure(s);
    });
  }
  function resolveStructure(s) {
    const t = now();
    if (s.interaction === "coop" || s.interaction === "barn") {
      const b = state.buildings.find((x) => x.structureId === s.id);
      if (b) {
        const r = G.collectHome(state, b.id, t);
        if (r.total > 0) { playAction("collect"); spawnVfx(state.player.tileId, "product_pop"); toast("🧺 收集 " + r.total + " 份產物"); afterChange(true); }
        else { playAction("use"); toast("還沒有可收集的產物（可在面板買動物/餵食）"); }
      }
    } else if (s.interaction === "shop") {
      playAction("collect");
      const r = G.sellAll(state, t);
      if (r.coins > 0) { spawnVfx(state.player.tileId, "product_pop"); const c = tileCenter(state.player.tileId); flyCoinsToHud(c.x, c.y, 6); playSound("coin"); toast("🪙 市集賣出 " + r.qty + " 個 → +" + fmtNum(r.coins) + " 金"); afterChange(true); renderOrders(); }
      else toast("倉庫沒有可賣的東西");
    } else { // home（農舍）
      playAction("use");
      const cap = G.storageCapacity(state), used = G.storageUsed(state);
      toast("🏠 農舍・Lv " + state.level + "・🪙 " + fmtNum(state.coins) + "・📦 " + used + "/" + cap);
    }
    updateMap(now());
  }
  // Stage 5：斷橋 — 已修好則過橋；未修則走到橋邊，條件足夠就修橋（消耗木材/石頭）
  function useBridge(tile) {
    if (state.flags.bridgeRepaired) {
      const path = G.bfsPath(state, state.player.tileId, tile.id);
      if (path) { spawnRing(tile.id, true); walkPath(path); } else toast("走不到橋上");
      return;
    }
    const plan = G.planMoveTo(state, tile.id); // 橋未修不可走 → 走到西岸相鄰磚
    if (!plan) { toast("走不到斷橋邊"); return; }
    spawnRing(tile.id, true);
    walkPath(plan.path, () => {
      const stand = G.getTileById(state, plan.standId);
      state.player.facing = G.facingTo(stand, tile);
      const chk = G.canRepairBridge(state);
      if (!chk.ok) {
        if (chk.reason === "chapter") toast("⛓️ 先完成序章任務（清開舊路 6/6）才能修橋");
        else if (chk.reason === "materials") toast("🪵 修橋材料不足，跟著任務 Dock 清大樹與巨石");
        else toast("目前無法修橋");
        spawnRing(tile.id, false); renderTileContext(); renderQuestDock(); return;
      }
      playAction("build", state.player.facing); spawnVfx(state.player.tileId, "soil_dust");
      const r = G.repairBridge(state, now());
      if (r.ok) { toast("🌉 斷橋修好了！東林空地解鎖"); buildStaticObjects(); paintGround(); afterChange(true); renderTileContext(); renderQuestDock(); }
    });
  }
  // Stage 5：事件點 — 走過去觸發，首次給一次性獎勵 + 推進故事
  function useEvent(tile) {
    const plan = G.planMoveTo(state, tile.id);
    if (!plan) { toast("先修好斷橋才能過去東林"); spawnRing(tile.id, false); return; }
    spawnRing(tile.id, true);
    walkPath(plan.path, () => {
      const ev = window.EVENTS[tile.event];
      if (tile.event === "east_deep_gate") {
        const st = G.eastDeepStatus ? G.eastDeepStatus(state) : null;
        if (st && st.unlocked) {
          playAction("use", state.player.facing);
          toast("🌲 東林深處小徑已開通");
          renderTileContext(); updateMap(now()); return;
        }
        const r = G.unlockEastDeep ? G.unlockEastDeep(state, now()) : { ok: false, reason: "unknown" };
        if (r.ok) {
          playAction("build", state.player.facing);
          spawnVfx(tile.id, "valid_ring");
          toast("🌲 東林深處開通，收藏「東林年輪拓印」");
          buildStaticObjects(); paintGround(); afterChange(true); renderTileContext(); return;
        }
        if (r.reason === "story") toast("先完成東林採集回報，再整理深處小徑。");
        else if (r.reason === "cost") toast("東林深處材料不足，查看缺口清單。");
        else toast("目前無法整理東林深處。");
        renderTileContext(); renderQuestDock(); return;
      }
      const r = G.triggerEvent(state, tile.event, now());
      if (!r.ok) return;
      if (!r.already && r.reward) {
        playAction("collect", state.player.facing); spawnVfx(state.player.tileId, "product_pop");
        let msg = "🌳 " + ev.name + "：";
        if (r.reward.coins) msg += "+" + fmtNum(r.reward.coins) + " 🪙";
        if (r.reward.materials) for (const k in r.reward.materials) msg += " +" + r.reward.materials[k] + window.MATERIALS[k].emoji;
        toast(msg);
      } else { playAction("use", state.player.facing); toast("🌳 " + ev.name + "：" + ev.desc); }
      afterChange(true); renderTileContext();
    });
  }
  function useForage(tile) {
    const node = (window.FORAGE_NODES || []).find((n) => n.id === tile.forage);
    if (!node) return;
    const plan = G.planMoveTo(state, tile.id);
    if (!plan) { toast("要先修好橋才能靠近採集點"); spawnRing(tile.id, false); return; }
    spawnRing(tile.id, true);
    walkPath(plan.path, () => {
      const cur = G.currentQuest(state);
      if (cur && cur.id === "discover_east_forage" && !state.flags.eastForageDiscovered) {
        const r = G.discoverForage(state, tile.forage, now());
        if (r.ok) {
          playAction("use", state.player.facing);
          spawnVfx(tile.id, "valid_ring");
          toast("📍 已記下採集點：" + node.name);
          afterChange(true); renderTileContext(); return;
        }
      }
      const r = G.gatherForage(state, tile.forage, now());
      if (r.ok) {
        playAction("collect", state.player.facing);
        spawnVfx(tile.id, "product_pop");
        toast("🌿 採集 +" + r.added + " " + itemName(node.itemId) + (r.lost ? "（倉庫滿，遺失 " + r.lost + "）" : ""));
        afterChange(true); renderTileContext();
      } else if (r.reason === "undiscovered") {
        toast("先辨認這個採集點。");
      } else if (r.reason === "cooldown") {
        toast("採集點還在恢復，稍後再來。");
      } else if (r.reason === "locked_deep") {
        toast("先整理東林深處小徑，才能採這裡。");
      } else {
        toast("現在還不能採集。");
      }
    });
  }
  // Stage 6：NPC 對話 — 走到相鄰 → 面向 → 主角互動動作 + NPC talk 動畫 + 地圖泡泡 + 側欄記錄
  const npcLineIdx = {};
  let bubbleTimer = null;
  function useNpc(tile) {
    const npc = window.NPCS[tile.npc]; if (!npc) return;
    const plan = G.planMoveTo(state, tile.id);
    if (!plan) { toast("走不到 " + npc.name); return; }
    spawnRing(tile.id, true);
    walkPath(plan.path, () => {
      const stand = G.getTileById(state, plan.standId);
      state.player.facing = G.facingTo(stand, tile);
      // Stage 10：走到 NPC 時，若目前沒有委託且冷卻已過，自動生成一張新委託（走近即觸發，非按鈕）；
      // 放在 npcDialogue() 之前，這樣這次的台詞就會是新委託的 flavorOffer。
      G.ensureNpcRequestState(state);
      if (G.ensureEastForageReportRequest) G.ensureEastForageReportRequest(state, now());
      if (!state.npcRequests[tile.npc] && G.ensureNpcSideQuestRequest) G.ensureNpcSideQuestRequest(state, tile.npc, now());
      if (!state.npcRequests[tile.npc]) {
        const chk = G.canRequestFrom(state, tile.npc, now());
        if (chk.ok) G.generateNpcRequest(state, tile.npc, now(), Math.random);
      }
      const d = G.npcDialogue(state, tile.npc, npcLineIdx[tile.npc] || 0);
      npcLineIdx[tile.npc] = (npcLineIdx[tile.npc] || 0) + 1;
      activeTalk = { npcId: tile.npc, until: now() + 2600 };
      if (!state.story.dialogueSeen) state.story.dialogueSeen = {};
      state.story.dialogueSeen[tile.npc] = true;
      showDialogueBubble(tile, d);
      pushDialogueLog(d);
      playAction("use", state.player.facing);
      if (tile.npc === "elder") G.advanceStory(state, "npc_elder", now()); // Stage 7：跟老農對話開啟第三章
      renderTileContext(); afterChange(true);
    });
  }
  function showDialogueBubble(tile, d) {
    if (!worldEl || !d) return;
    const old = worldEl.querySelector(".npc-bubble"); if (old) old.remove();
    const b = document.createElement("div");
    b.className = "npc-bubble"; b.dataset.audit = "dialogue-bubble"; b.dataset.npc = d.id;
    b.innerHTML = `<div class="nb-name">${d.name}</div><div class="nb-line">${d.line}</div>`;
    b.style.left = pxv((tile.x + 0.5) * TILE); b.style.top = pxv(tile.y * TILE - 4);
    worldEl.appendChild(b);
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { const e = worldEl && worldEl.querySelector(".npc-bubble"); if (e) e.remove(); }, 2800);
  }
  function pushDialogueLog(d) {
    if (!d) return;
    if (!state.story.dialogueLog) state.story.dialogueLog = [];
    state.story.dialogueLog.push({ name: d.name, line: d.line });
    if (state.story.dialogueLog.length > 12) state.story.dialogueLog.shift();
    renderStory(); // 側欄故事分頁的對話記錄即時更新
  }
  function resolveStation(st) {
    const t = now();
    if (st.effect === "orders") {
      switchTab("orders"); renderOrders(); toast("📜 " + st.name + "：查看市集訂單");
    } else if (st.effect === "sell") {
      const r = G.sellAll(state, t);
      if (r.coins > 0) { const sid = stationTileOf("storage"); spawnVfx(sid, "product_pop"); const c = tileCenter(sid); flyCoinsToHud(c.x, c.y, 6); playSound("coin"); toast("🪙 賣出 " + r.qty + " 個 → +" + fmtNum(r.coins) + " 金"); afterChange(true); renderOrders(); }
      else toast("倉庫沒有可賣的東西");
    } else if (st.effect === "mail") {
      G.advanceStory(state, "read_sign");
      checkNewLetters(t, true);
      openLettersModal();
      renderStory(); renderQuestDock(); updateMap(now());
    } else if (st.effect === "story") {
      // 告示牌：推進序章任務
      const adv = G.advanceStory(state, "read_sign");
      const q = window.QUESTS[adv.completed === "intro_reopen_farm" ? "plant_wheat" : (state.story.questId || "intro_reopen_farm")];
      toast("📖 告示牌：" + (q ? q.title : "陽光農場的近況"));
      renderStory(); renderQuestDock(); updateMap(now());
    } else if (st.effect === "well") {
      let n = 0;
      for (let i = 0; i < G.activePlotCount(state); i++) if (G.waterPlot(state, i, t).ok) n++;
      // 對地圖上每個新濕土作物磚噴水滴
      for (const c of tileEls) {
        const tl = G.getTileById(state, c.tileId);
        if (tl.plotIndex != null && tl.plotIndex < G.activePlotCount(state)) {
          const p = state.plots[tl.plotIndex];
          if (p && p.cropId && G.isWet(p)) spawnVfx(c.tileId, "water_droplets", { scale: 0.8 });
        }
      }
      toast(n > 0 ? "💧 水井替 " + n + " 格作物澆水" : "目前沒有需要澆水的作物");
      let seasonEventClaimed = false;
      if (G.seasonEventStatus && G.claimSeasonEvent) {
        const ev = G.seasonEventStatus(state, t);
        if (ev && ev.eventId === "summer_well_bless" && ev.canClaim) {
          const r = G.claimSeasonEvent(state, "summer_well_bless", t);
          if (r.ok) { seasonEventClaimed = true; toast("💧 " + r.message + (r.watered ? "，額外濕潤 " + r.watered + " 格" : "")); }
        }
      }
      if (n > 0 || seasonEventClaimed) { if (n > 0) G.advanceStory(state, "water"); afterChange(false); }
    }
    updateMap(now());
  }
  function blockedReason(tile) {
    if (tile.terrain === "water") return "🌊 水域擋路（需架橋）";
    if (tile.region === "east_deep" && !(state.flags && state.flags.eastDeepUnlocked)) return "🌲 東林深處尚未開通";
    if (tile.object) return window.OBSTACLES[tile.object].emoji + " 障礙擋路（用清除工具）";
    if (tile.buildingId) return "這裡有建築";
    return "無法前往";
  }
  function inspectTile(tile) {
    const terr = window.TERRAIN[tile.terrain];
    if (tile.plotIndex != null) {
      const plot = state.plots[tile.plotIndex];
      if (tile.plotIndex >= G.activePlotCount(state)) { toast("🔒 升級「開墾農地」解鎖此農土"); return; }
      if (!plot.cropId) { toast("🟫 農土・空地，用手種植"); return; }
      const prog = G.getCropProgress(state, plot, now()); const crop = window.CROPS[plot.cropId];
      toast(`${crop.emoji}${crop.name}・${prog.ready ? "✅可收成" : "⏳" + fmtTime(prog.remainingMs)}${prog.wet ? "・💧濕土" : ""}`);
    } else if (tile.station) { const s = window.STATIONS[tile.station]; toast("🏷️ " + s.name + "・" + s.desc); }
    else if (tile.structureId) { const s = G.structureAt(state, tile.id); toast("🏠 " + (s ? s.name : "建築") + "・點一下走過去互動"); }
    else if (tile.npc) { const n = window.NPCS[tile.npc]; toast("🧑 " + n.name + "・" + n.title + "・走過去交談"); }
    else if (tile.bridge) { toast(state.flags.bridgeRepaired ? "🌉 木橋・通往東林空地" : "🌉 斷橋・走過去用木材石頭修復"); }
    else if (tile.event) { const ev = window.EVENTS[tile.event]; toast("🌳 " + ev.name + "・" + ev.desc); }
    else if (tile.forage) {
      const node = (window.FORAGE_NODES || []).find((n) => n.id === tile.forage);
      toast("🌿 " + (node ? node.name : "採集點") + "・走過去採集");
    }
    else if (tile.region === "east_deep" && !(state.flags && state.flags.eastDeepUnlocked)) { toast("🌲 東林深處未開通・先整理入口小徑"); }
    else if (tile.region === "east" && !state.flags.bridgeRepaired) { toast("⛓️ 東林封鎖中・先修好斷橋才能進入"); }
    else if (tile.object) { const o = window.OBSTACLES[tile.object]; toast(`${o.emoji}${o.name}・${o.desc}`); }
    else { toast(`${terr.name}・${terr.desc}`); }
  }
  // 判斷某工具在某磚的動作 / 無效原因
  function actionTargetFor(tool, tile) {
    const active = G.activePlotCount(state);
    if (tool === "hand") {
      if (tile.plotIndex != null) {
        if (tile.plotIndex >= active) return { invalid: "🔒 此農土未解鎖（升級開墾）" };
        const plot = state.plots[tile.plotIndex];
        if (!plot.cropId) return { action: "plant" };
        return G.getCropProgress(state, plot, now()).ready ? { action: "harvest" } : { invalid: "⏳ 還沒成熟" };
      }
      if (tile.buildingId) return { action: "collect" };
      return {}; // 草地/步道 → 移動
    }
    if (tool === "water") {
      if (tile.plotIndex != null && tile.plotIndex < active && state.plots[tile.plotIndex].cropId) {
        const prog = G.getCropProgress(state, state.plots[tile.plotIndex], now());
        if (prog.ready) return { invalid: "已成熟，不需澆水" };
        if (prog.wet) return { invalid: "💧 已是濕土" };
        return { action: "water" };
      }
      return { invalid: "💧 只能澆種了作物的農土" };
    }
    if (tool === "clear") {
      if (tile.object) return { action: "clear" };
      return { invalid: "這裡沒有障礙可清除" };
    }
    if (tool === "build") {
      if (tile.buildingId) return { invalid: "這裡已有建築" };
      if (tile.object) return { invalid: "先清除障礙才能蓋" };
      if (tile.terrain !== "grass") return { invalid: "只能蓋在草地" };
      return { action: "build" };
    }
    return {};
  }
  // 走到目標（或相鄰）後播動作 + 結算
  function moveAndAct(tileId, action) {
    const plan = G.planMoveTo(state, tileId);
    if (!plan) { toast("走不到那裡"); return; }
    const target = G.getTileById(state, tileId);
    walkPath(plan.path, () => {
      const stand = G.getTileById(state, plan.standId);
      state.player.facing = G.facingTo(stand, target);
      resolveAction(action, tileId);
    });
  }
  function resolveAction(action, tileId) {
    const tile = G.getTileById(state, tileId);
    const t = now();
    const face = state.player.facing;
    if (action === "plant") {
      const r = G.plant(state, tile.plotIndex, selectedSeed, t);
      if (r.ok) { playAction("sow", face); playSound("plant"); spawnVfx(tileId, "seed_scatter"); G.advanceStory(state, "plant"); afterChange(true); }
      else { spawnRing(tileId, false); toast(r.reason === "no_coins" ? "🪙 金幣不足" : r.reason === "locked_crop" ? "🔒 作物未解鎖" : "無法種植"); }
    } else if (action === "harvest") {
      const r = G.harvest(state, tile.plotIndex, t);
      if (r.ok) { playAction("harvest", face); spawnVfx(tileId, "harvest_pop"); G.advanceStory(state, "harvest"); const crop = window.CROPS[r.cropId];
        cropHarvestFx(tileId, crop, r.added); playSound("harvest"); playSound("coin");
        toast("🧺 收成 " + r.added + " " + crop.name); if (r.lost) toast("📦 倉滿損失 " + r.lost); if (r.leveled) { levelUpFx(tileElOf(tileId)); playSound("level"); toast("🎉 升 Lv " + state.level); } afterChange(true); }
    } else if (action === "water") {
      const r = G.waterPlot(state, tile.plotIndex, t);
      if (r.ok) { playAction("water", face); spawnVfx(tileId, "water_droplets"); waterSplashFx(tileId); playSound("water"); G.advanceStory(state, "water"); toast("💧 澆水變濕土加速"); afterChange(false); }
    } else if (action === "clear") {
      const r = G.clearObstacle(state, tileId);
      if (r.ok) { playAction("hoe", face); playSound("ui"); spawnVfx(tileId, "soil_dust"); G.advanceStory(state, "clear"); toast("⛏️ 清除 " + window.OBSTACLES[r.cleared].name + "，得建材"); afterChange(true); buildStaticObjects(); paintGround(); renderTileContext(); }
      else if (r.reason === "no_coins") { spawnRing(tileId, false); toast("🪙 金幣不足"); }
    } else if (action === "build") {
      playAction("hoe", face); spawnVfx(tileId, "soil_dust"); renderTileContext(); // 顯示建築選單（玩家已走到旁邊）
      toast("🏗️ 選一個建築蓋在這裡");
    } else if (action === "collect") {
      const b = state.buildings.find((x) => x.id === tile.buildingId);
      if (b) { const r = G.collectHome(state, b.id, t); // 只收「這一家」（per-building）
        if (r.total > 0) { playAction("collect", face); spawnVfx(tileId, "product_pop"); toast("🧺 收集 " + r.total + " 份產物"); afterChange(true); }
        else { spawnRing(tileId, false); toast("這裡還沒有可收集的產物"); } renderTileContext(); }
    }
    updateMap(now());
  }
  function renderTileContext() {
    const box = $("tileContext"); if (!box) return;
    if (!selectedTileId) { box.innerHTML = `<div class="tc-empty">點一個地圖磚查看資訊與動作</div>`; return; }
    const tile = state.map.tiles.find((x) => x.id === selectedTileId);
    const terr = window.TERRAIN[tile.terrain];

    // 0) 站點 → 走過去使用
    if (tile.station) {
      const st = window.STATIONS[tile.station];
      box.innerHTML = `<div class="tc-title">🏷️ ${st.name}</div><div class="tc-desc">${st.desc}</div>
        <div class="tc-actions"><button class="btn buy small" id="useStBtn">走過去使用</button></div>`;
      $("useStBtn").onclick = () => useStation(tile);
      return;
    }
    // 0.5) 多格結構（農舍/市集，無動物）→ 走過去互動
    if (tile.structureId && !tile.buildingId) {
      const s = G.structureAt(state, tile.id);
      box.innerHTML = `<div class="tc-title">🏠 ${s ? s.name : "建築"}</div>
        <div class="tc-desc">${s && s.interaction === "shop" ? "走過去把庫存賣給市集攤。" : "走過去看看農場概況、稍作歇息。"}</div>
        <div class="tc-actions"><button class="btn buy small" id="useStrBtn">走過去</button></div>`;
      $("useStrBtn").onclick = () => useStructure(tile);
      return;
    }
    // 0.6) Stage 6：NPC 鎮民（走過去交談）；Stage 10：若有進行中委託，附交付卡
    if (tile.npc) {
      const npc = window.NPCS[tile.npc];
      if (G.ensureEastForageReportRequest) G.ensureEastForageReportRequest(state, now());
      const d = G.npcDialogue(state, tile.npc, (npcLineIdx[tile.npc] || 1) - 1);
      const seen = state.story.dialogueSeen && state.story.dialogueSeen[tile.npc];
      const req = d && d.request && d.request.wants ? d.request : null; // 只有進行中委託才有 wants
      const log = (state.npcRequestLog || {})[tile.npc];
      const doneCount = (log && log.fulfilledCount) || 0;
      const sq = G.npcSideQuestStatus ? G.npcSideQuestStatus(state, tile.npc) : null;
      const sqProg = sq && sq.totalSteps ? `（${sq.status === "done" ? sq.totalSteps : sq.stepIndex}/${sq.totalSteps}）` : "";
      const sqText = sq ? (sq.status === "done" ? "支線完成：" + (sq.chainTitle || sq.title) + sqProg
        : sq.status === "active" ? "支線進行中：" + sq.title + sqProg
        : sq.status === "available" ? "支線可接：" + sq.title + sqProg
        : "支線未解鎖：" + sq.title + sqProg) : "";
      const reqHtml = req ? `<div class="npc-request" data-audit="npc-request" data-npc="${tile.npc}">
          <div class="nr-wants">${Object.entries(req.wants).map(([id, q]) => {
            const have = state.storage.items[id] || 0;
            return `<span class="w ${have >= q ? "have" : "miss"}">${itemEmoji(id)} ${have}/${q}</span>`;
          }).join("")}</div>
          <div class="nr-reward">🪙 ${fmtNum(req.rewardCoins)} · ⭐ ${req.rewardXp}</div>
          <div class="nr-actions">
            <button class="btn buy small" id="fulfillReqBtn" ${req.canDeliver ? "" : "disabled"}>交付委託</button>
            <button class="btn small ghost" id="declineReqBtn">放棄</button>
          </div>
        </div>` : "";
      box.innerHTML = `<div class="tc-title">🧑 ${npc.name}</div>
        <div class="tc-desc">${npc.title}${seen && d ? "：「" + d.line + "」" : "・走過去聽聽他要說什麼"}</div>
        ${sq ? `<div class="nr-history" data-audit="npc-sidequest" data-status="${sq.status}">${sqText}</div>` : ""}
        ${reqHtml}
        ${doneCount > 0 ? `<div class="nr-history">已幫忙完成 ${doneCount} 次委託</div>` : ""}
        <div class="tc-actions"><button class="btn buy small" id="talkNpcBtn">${seen ? "再聊一句" : "走過去交談"}</button></div>`;
      $("talkNpcBtn").onclick = () => useNpc(tile);
      if (req) {
        $("fulfillReqBtn").onclick = () => {
          const r = G.fulfillNpcRequest(state, tile.npc, now());
          if (r.ok) {
            const cfg = (window.NPC_REQUESTS || {})[tile.npc];
            const doneLine = r.doneLine || (cfg && cfg.flavorDone && cfg.flavorDone[0]) || "謝謝你！";
            orderCompleteFx($("tileContext"), r.coins); playSound("order"); playSound("coin");
            toast("🎁 " + npc.name + "：「" + doneLine + "」+" + fmtNum(r.coins) + " 🪙");
            pushDialogueLog({ name: npc.name, line: doneLine });
            playAction("use", state.player.facing); afterChange(true); renderTileContext();
          } else toast("作物/產物不足，無法交付");
        };
        $("declineReqBtn").onclick = () => {
          G.declineNpcRequest(state, tile.npc, now());
          toast("已放棄這張委託");
          afterChange(true); renderTileContext();
        };
      }
      return;
    }
    // 0.7) Stage 5：斷橋（修橋 / 過橋）
    if (tile.bridge) {
      if (state.flags.bridgeRepaired) {
        box.innerHTML = `<div class="tc-title">🌉 木橋</div><div class="tc-desc">已修復，通往東林空地。點一下走過去。</div>
          <div class="tc-actions"><button class="btn buy small" id="useBridgeBtn">走過去</button></div>`;
      } else {
        const chk = G.canRepairBridge(state);
        const cost = window.BRIDGE_COST;
        const costTxt = `🪵${cost.wood} 🪨${cost.stone}`;
        const why = chk.ok ? "" : chk.reason === "chapter" ? "（需先完成序章 6/6）" : chk.reason === "materials" ? "（建材不足）" : "";
        box.innerHTML = `<div class="tc-title">🌉 斷橋</div>
          <div class="tc-desc">河上的橋斷了。走過去用建材修復，打通東林封鎖區。需 ${costTxt}${why}</div>
          ${bridgeMaterialRowsHtml(false)}
          <div class="tc-actions"><button class="btn buy small" id="useBridgeBtn" ${chk.ok ? "" : "disabled"}>走過去修橋（${costTxt}）</button></div>`;
      }
      $("useBridgeBtn").onclick = () => useBridge(tile);
      return;
    }
    // 0.8) Stage 5：事件點（東林古樹）
    if (tile.event) {
      const ev = window.EVENTS[tile.event];
      if (tile.event === "east_deep_gate") {
        const st = G.eastDeepStatus ? G.eastDeepStatus(state) : null;
        const lockedWhy = st && !st.prerequisites ? "（需先完成東林採集回報）" : "";
        box.innerHTML = `<div class="tc-title">🌲 ${ev.name}</div>
          <div class="tc-desc">${ev.desc}${st && st.unlocked ? "（已開通）" : lockedWhy}</div>
          ${st && !st.unlocked ? eastDeepCostRowsHtml(false) : `<div class="nr-history">稀有採集點已開放，收藏品已登錄。</div>`}
          <div class="tc-actions"><button class="btn buy small" id="useEventBtn" ${st && (st.ready || st.unlocked) ? "" : "disabled"}>${st && st.unlocked ? "走過去" : "整理小徑"}</button></div>`;
        $("useEventBtn").onclick = () => useEvent(tile);
        return;
      }
      const claimed = state.flags.eventsClaimed && state.flags.eventsClaimed[tile.event];
      box.innerHTML = `<div class="tc-title">🌳 ${ev.name}</div><div class="tc-desc">${ev.desc}${claimed ? "（已探索）" : ""}</div>
        <div class="tc-actions"><button class="btn buy small" id="useEventBtn">走過去</button></div>`;
      $("useEventBtn").onclick = () => useEvent(tile);
      return;
    }
    // 0.85) Stage 12：東林採集點
    if (tile.forage) {
      const node = (window.FORAGE_NODES || []).find((n) => n.id === tile.forage);
      const status = G.forageNodeStatus ? G.forageNodeStatus(state, tile.forage, now()) : null;
      const def = node ? itemDef(node.itemId) : null;
      const locked = !(state.flags && state.flags.bridgeRepaired);
      const deepLocked = status && status.unlocked === false;
      const undiscovered = !locked && !(state.flags && state.flags.eastForageDiscovered);
      const desc = locked ? "先修好斷橋才能靠近東林採集點。"
        : deepLocked ? "這是東林深處的稀有採集點，先整理深處入口。"
        : undiscovered ? "先辨認這處採集點，之後就能定期採樣。"
        : status && !status.ready ? "採集點正在恢復，還要 " + fmtTime(status.remainingMs) + "。"
        : "可採集 " + (def ? def.name : "東林材料") + "，回報後會進入鎮民委託池。";
      box.innerHTML = `<div class="tc-title">${def ? def.emoji : "🌿"} ${node ? node.name : "東林採集點"}</div>
        <div class="tc-desc">${desc}</div>
        <div class="tc-actions"><button class="btn buy small" id="useForageBtn" ${locked || deepLocked ? "disabled" : ""}>${undiscovered ? "走過去辨認" : "走過去採集"}</button></div>`;
      $("useForageBtn").onclick = () => useForage(tile);
      return;
    }
    // 0.9) Stage 5：東林封鎖區（未修橋）
    if (tile.region === "east_deep" && !(state.flags && state.flags.eastDeepUnlocked)) {
      box.innerHTML = `<div class="tc-title">🌲 東林深處（未開通）</div>
        <div class="tc-desc">枝葉和舊踏板擋住路線，先到深處入口整理小徑。</div>
        ${eastDeepCostRowsHtml(false)}`;
      return;
    }
    if (tile.region === "east" && !state.flags.bridgeRepaired) {
      box.innerHTML = `<div class="tc-title">⛓️ 東林（封鎖中）</div>
        <div class="tc-desc">這片東邊的林地被河隔開了。先修好斷橋才能進入探索。</div>`;
      return;
    }
    // 1) 有建築（雞舍/畜舍）→ 建築/動物管理
    if (tile.buildingId) { renderBuildingContext(box, tile); return; }
    // 2) 有障礙 → 清除
    if (tile.object) {
      const ob = window.OBSTACLES[tile.object];
      const canClear = state.coins >= ob.clearCost;
      const grantsTxt = Object.entries(ob.grants).map(([k, v]) => `+${v}${window.MATERIALS[k].emoji}`).join(" ");
      const bridgeNeed = G.currentQuest(state) && G.currentQuest(state).id === "repair_bridge"
        && Object.keys(ob.grants || {}).some((k) => ((G.bridgeMaterialStatus(state).missing || {})[k] || 0) > 0);
      box.innerHTML = `
        <div class="tc-title">${ob.emoji} ${ob.name}</div>
        <div class="tc-desc">${ob.desc}。清除後變草地可興建。${bridgeNeed ? "這是目前修橋材料來源。" : ""}</div>
        ${bridgeNeed ? bridgeMaterialRowsHtml(false) : ""}
        <div class="tc-actions">
          <button class="btn buy small" id="clearBtn" ${canClear ? "" : "disabled"}>清除（🪙${ob.clearCost} → ${grantsTxt}）</button>
        </div>`;
      $("clearBtn").onclick = () => {
        const r = G.clearObstacle(state, tile.id);
        if (r.ok) { playAction("hoe"); toast("⛏️ 已清除，獲得建材"); afterChange(true); renderTileContext(); renderQuestDock(); }
        else if (r.reason === "no_coins") toast("🪙 金幣不足");
      };
      return;
    }
    // 3) 水域 → 說明
    if (tile.terrain === "water") {
      box.innerHTML = `<div class="tc-title">🌊 ${terr.name}</div><div class="tc-desc">${terr.desc}（MVP2 暫不可用）。</div>`;
      return;
    }
    // 4) 空草地 → 建築選單
    renderBuildMenu(box, tile);
  }
  function renderBuildMenu(box, tile) {
    const opts = window.BUILDING_ORDER.map((type) => {
      const def = window.BUILDINGS[type];
      const unlocked = G.buildingUnlocked(state, type);
      const afford = G.canAffordCost(state, def.cost);
      const atMax = G.buildingAtMaxCount && G.buildingAtMaxCount(state, type);
      const costTxt = Object.entries(def.cost).map(([k, v]) => k === "coins" ? `🪙${v}` : `${v}${window.MATERIALS[k].emoji}`).join(" ");
      return `
        <div class="build-opt ${unlocked && afford && !atMax ? "" : "locked"}">
          <span class="bo-ic">${def.emoji}</span>
          <span class="bo-body"><span class="bo-name">${def.name}</span><br>
            <span class="bo-cost">${def.desc} · ${costTxt}${atMax ? " · 已達上限" : unlocked ? "" : " · 🔒Lv" + def.unlockLevel}</span></span>
          <button class="btn buy small bbtn" data-type="${type}" ${unlocked && afford && !atMax ? "" : "disabled"}>蓋</button>
        </div>`;
    }).join("");
    box.innerHTML = `<div class="tc-title">🟩 ${window.TERRAIN.grass.name}</div>
      <div class="tc-desc">可興建建築（影響成長/倉容/解鎖動物）。</div>
      <div class="tc-actions">${opts}</div>`;
    box.querySelectorAll(".bbtn").forEach((b) => {
      b.onclick = () => {
        const r = G.buildBuilding(state, tile.id, b.dataset.type, now());
        if (r.ok) { playAction("hoe"); playSound("ui"); toast(window.BUILDINGS[b.dataset.type].emoji + " 已興建 " + window.BUILDINGS[b.dataset.type].name); afterChange(true); buildMap(); renderTileContext(); }
        else if (r.reason === "cost") toast("資源不足");
        else if (r.reason === "locked") toast("🔒 等級不足");
        else if (r.reason === "max_count") toast("這種建築已達上限");
      };
    });
  }
  // Stage 7：動物照護狀態顯示文案
  const ANIMAL_STATUS_EMOJI = { happy: "😊", hungry: "🍽️", thirsty: "💧", needs_groom: "🧹" };
  const ANIMAL_STATUS_LABEL = { happy: "開心", hungry: "飢餓", thirsty: "口渴", needs_groom: "待梳理" };
  function renderBuildingContext(box, tile) {
    const b = state.buildings.find((x) => x.id === tile.buildingId);
    const def = window.BUILDINGS[b.type];
    const isHome = def.effect && def.effect.unlockAnimal;
    let html = `<div class="tc-title">${def.emoji} ${def.name}</div><div class="tc-desc">${def.desc}</div>`;
    if (isHome) {
      const animals = G.animalsInHome(state, b.id);
      const cap = G.animalCapacity(state, b.id);
      html += `<div class="tc-actions">`;
      animals.forEach((a) => {
        const adef = window.ANIMALS[a.type];
        const prog = G.animalProgress(state, a, now());
        const affinity = G.animalAffinity(state, a, now());
        const status = G.animalStatus(state, a, now());
        const canFeed = now() - (a.lastFedAt || 0) >= window.CARE_COOLDOWN_MS;
        const canWater = now() - (a.lastWateredAt || 0) >= window.CARE_COOLDOWN_MS;
        const canGroom = now() - (a.lastGroomedAt || 0) >= window.CARE_COOLDOWN_MS;
        html += `
          <div class="animal-row">
            <span class="a-ic">${adef.emoji}</span>
            <span class="a-body"><b>${adef.name}</b> → ${itemEmoji(adef.product)}
              <div class="a-prog"><div class="a-fill" style="width:${(prog.ratio * 100).toFixed(0)}%"></div></div>
              <span class="bo-cost">${prog.ready ? "✅ 可收集" : "⏳ " + fmtTime(prog.remainingMs)}</span>
              <div class="a-affinity" title="親密度 ${affinity.toFixed(0)}/100"><div class="a-affinity-fill" style="width:${affinity.toFixed(0)}%"></div></div>
              <span class="bo-cost">${ANIMAL_STATUS_EMOJI[status]} ${ANIMAL_STATUS_LABEL[status]}・親密度 ${affinity.toFixed(0)}</span></span>
            <span class="a-actions-col">
              <button class="btn buy small acol" data-id="${a.id}" ${prog.ready ? "" : "disabled"}>收集</button>
              <button class="btn ghost small afeed" data-id="${a.id}" ${canFeed ? "" : "disabled"}>餵食</button>
              <button class="btn ghost small awater" data-id="${a.id}" ${canWater ? "" : "disabled"}>澆水</button>
              <button class="btn ghost small agroom" data-id="${a.id}" ${canGroom ? "" : "disabled"}>梳理</button>
            </span>
          </div>`;
      });
      // 買動物：Stage 6.5 起畜舍/雞舍地圖常駐不代表解鎖，仍需等級（ANIMALS[type].unlockLevel）；
      // Stage 7.1 修正：畜舍可養牛「和」羊，逐一列出 unlockAnimal 全部類型，不只 [0]（原本羊在 UI 上永遠買不到）
      if (animals.length < cap) {
        html += (def.effect.unlockAnimal || []).map((animalType) => {
          const adef = window.ANIMALS[animalType];
          if (state.level >= adef.unlockLevel) {
            return `<button class="btn buy small abuy" data-bid="${b.id}" data-type="${animalType}">＋ 買一隻${adef.name}（🪙${adef.cost}）</button>`;
          }
          return `<div class="bo-cost">🔒 ${adef.emoji} ${adef.name}・Lv${adef.unlockLevel} 解鎖</div>`;
        }).join("");
      } else {
        html += `<div class="bo-cost">已達容量上限 ${cap} 隻</div>`;
      }
      html += `</div>`;
    }
    box.innerHTML = html;
    box.querySelectorAll(".acol").forEach((btn) => btn.onclick = () => {
      const r = G.collectAnimal(state, btn.dataset.id, now());
      if (r.ok) {
        playAction("carry");
        playSound("coin");
        if (r.tier !== "normal") spawnVfx(tile.id, "quality_sparkle", { scale: 1.1, sheet: "care_vfx" });
        toast((r.tier === "premium" ? "✨ " : r.tier === "good" ? "🌟 " : "🧺 ") + "收集 " + r.added + " " + itemName(r.product));
        afterChange(true); renderTileContext(); updateMap(now());
      }
    });
    box.querySelectorAll(".afeed").forEach((btn) => btn.onclick = () => {
      const r = G.feedAnimal(state, btn.dataset.id, now());
      if (r.ok) {
        playAction("sow"); playSound("feed"); spawnVfx(tile.id, "feed_bits", { sheet: "care_vfx" });
        const extra = r.collectedFirst && r.collectedFirst.added ? "（另收 " + r.collectedFirst.added + " 份已成熟的）" : "";
        toast("🌾 餵食 → +1 " + itemName(r.product) + extra + "・親密度 " + r.affinity.toFixed(0));
        G.advanceStory(state, "care_animal", now());
        afterChange(true); renderTileContext();
      } else if (r.reason === "cooldown") toast("剛餵過，牠還吃得很飽（稍後再來）");
      else toast("飼料不足（需作物）");
    });
    box.querySelectorAll(".awater").forEach((btn) => btn.onclick = () => {
      const r = G.waterAnimal(state, btn.dataset.id, now());
      if (r.ok) {
        playAction("water"); playSound("water"); spawnVfx(tile.id, "water_splash", { sheet: "care_vfx" });
        toast("💧 澆水 → 親密度 " + r.affinity.toFixed(0));
        G.advanceStory(state, "care_animal", now());
        afterChange(true); renderTileContext();
      } else if (r.reason === "cooldown") toast("這隻剛澆過水，等一下再來");
    });
    box.querySelectorAll(".agroom").forEach((btn) => btn.onclick = () => {
      const r = G.groomAnimal(state, btn.dataset.id, now());
      if (r.ok) {
        playAction("build"); playSound("groom"); spawnVfx(tile.id, "groom_sparkle", { sheet: "care_vfx" });
        toast("🧹 梳理 → 親密度 " + r.affinity.toFixed(0));
        G.advanceStory(state, "care_animal", now());
        afterChange(true); renderTileContext();
      } else if (r.reason === "cooldown") toast("這隻剛梳理過，等一下再來");
    });
    box.querySelectorAll(".abuy").forEach((btn) => btn.onclick = () => {
      const r = G.buyAnimal(state, btn.dataset.bid, btn.dataset.type, now());
      if (r.ok) { playSound("ui"); toast("🐣 新動物入住！"); afterChange(true); renderTileContext(); }
      else if (r.reason === "no_coins") toast("🪙 金幣不足");
      else if (r.reason === "full") toast("已達容量上限");
      else if (r.reason === "locked") { toast("🔒 尚未達到解鎖等級"); renderTileContext(); }
    });
  }

  // ====================================================================
  // 玩家 Miri（v3）：走路 4 列×6 幀 + 動作 12 列×6 幀，腳底錨點 [0.5,0.86]
  // ====================================================================
  const pad2 = (n) => String(n).padStart(2, "0");
  const WALK_ROW = { down: "walk_down", left: "walk_left", right: "walk_right", up: "walk_up" };
  // 遊戲動作 → v4 動作基底（四向：down/up/side，左向翻轉 side）
  const ACTION_BASE = { water: "water", hoe: "hoe", clear: "hoe", sow: "sow", plant: "sow",
    harvest: "harvest", carry: "collect", collect: "collect", build: "build", station: "use", use_station: "use" };
  function dirRow(base, facing) {
    const d = facing === "up" ? "up" : facing === "down" ? "down" : "side";
    return base + "_" + d;
  }
  const player = { frame: 0, fps: 6, oneShot: false, actionRow: "use_down", acc: 0, last: 0, flip: false };
  // 畫玩家某 frame（v3 atlas，6 幀/列；side 動作可水平翻轉）
  // 主角性別：男(m)用 walk_m/actions_m，女(f)用 walk/actions（frame 命名相同）
  function pSheet(base) {
    if ((base === "walk" || base === "actions") && state.gender === "m") return base + "_m";
    return base;
  }
  function paintPlayer(sheet, rowName, frame, flip) {
    const sp = $("playerSprite"); if (!sp) return;
    sheet = pSheet(sheet);
    const pe = $("player"); const ew = pe.offsetWidth || 48, eh = pe.offsetHeight || 64;
    if (atlasReady) {
      const stl = window.Atlas.frameStyleFor(sheet, rowName + "_" + pad2(frame), ew, eh);
      if (stl) { sp.style.backgroundImage = stl.backgroundImage; sp.style.backgroundSize = stl.backgroundSize; sp.style.backgroundPosition = stl.backgroundPosition; }
    }
    sp.style.transform = flip ? "scaleX(-1)" : "";
  }
  function setPlayerIdle() { state.player.action = "idle"; }
  function paintIdlePlayer() {
    paintPlayer("walk", WALK_ROW[state.player.facing] || "walk_down", 0, false);
  }
  function playAction(type, facing) {
    const base = ACTION_BASE[type]; if (!base) return;
    const f = facing || state.player.facing;
    state.player.action = type; player.actionRow = dirRow(base, f); player.frame = 0; player.oneShot = true;
    player.fps = base === "collect" ? 6 : 7; player.acc = 0;
    player.flip = (f === "left") && player.actionRow.endsWith("_side"); // side 源圖朝右，左向翻轉
  }
  function tickPlayer(t) {
    if (!player.last) player.last = t;
    const dt = (t - player.last) / 1000; player.last = t;
    const action = state.player.action;
    if (action === "walk") {
      player.fps = 8; player.acc += dt; const step = 1 / player.fps;
      while (player.acc >= step) { player.acc -= step; player.frame = (player.frame + 1) % 6; }
      paintPlayer("walk", WALK_ROW[state.player.facing] || "walk_down", player.frame, false);
      return;
    }
    if (player.oneShot) {
      player.acc += dt; const step = 1 / player.fps;
      while (player.acc >= step) {
        player.acc -= step; player.frame++;
        if (player.frame > 5) { player.frame = 5; player.oneShot = false; state.player.action = "idle"; }
      }
      paintPlayer("actions", player.actionRow, Math.min(player.frame, 5), player.flip);
      return;
    }
    // 待機使用 walk sheet 的站立幀，避免 actions sheet 壞列造成面向上時消失與走路色差。
    paintIdlePlayer();
  }
  // 鍵盤一次走一格（WASD / 方向鍵）
  function isTextEntryTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable === true;
  }
  function hasOpenModal() {
    return !!(typeof document.querySelector === "function" && document.querySelector(".modal.show"));
  }
  function onKeyMove(e) {
    const dirMap = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down",
                     ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
    const dir = dirMap[e.key]; if (!dir) return;
    if (isTextEntryTarget(e.target) || hasOpenModal()) return;
    e.preventDefault();
    const dd = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    state.player.facing = dir;
    const nt = G.getTileXY(state, state.player.x + dd[0], state.player.y + dd[1]);
    if (nt && G.isWalkable(state, nt)) walkPath([nt.id]);
    else { player.frame = 0; paintPlayer("walk", WALK_ROW[dir], 0, false); } // 撞牆只轉向
  }
  function setPrimaryPointerClass() {
    const primaryCoarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    const narrow = window.innerWidth <= 859 || window.innerHeight <= 480; // R70：寬橫式手機（如 932×430）亦屬行動姿勢
    document.documentElement.classList.toggle("primary-coarse", primaryCoarse);
    document.documentElement.classList.toggle("mobile-controls-enabled", primaryCoarse && narrow);
  }
  function stepPlayerDir(dir) {
    if (hasOpenModal() || moveTimer || !state || !state.player) return;
    const dd = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    if (!dd) return;
    state.player.facing = dir;
    const nt = G.getTileXY(state, state.player.x + dd[0], state.player.y + dd[1]);
    if (nt && G.isWalkable(state, nt)) {
      hideBuildWheel(); hideObjectBubble(); hideSceneActions();
      walkPath([nt.id], () => { renderSceneActionsForSelection(); setPlayerIdle(); });
    } else {
      player.frame = 0;
      paintPlayer("walk", WALK_ROW[dir], 0, false);
      if (nt) spawnRing(nt.id, false);
      updateMap(now());
    }
  }
  function facingTile() {
    const dd = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[state.player.facing || "down"];
    return G.getTileXY(state, state.player.x + dd[0], state.player.y + dd[1]);
  }
  function activateFacingTile() {
    if (hasOpenModal()) return;
    const tile = facingTile();
    if (!tile) { toast("前方沒有目標"); return; }
    selectedTileId = tile.id;
    state.interaction.selectedTileId = tile.id;
    renderTileContext();
    renderSceneActionsForSelection();
    const actions = sceneActionsForTile(tile);
    if (actions.length) runSceneAction(actions[0].action, tile.id);
    else if (tile.station || tile.structureId || tile.bridge || tile.event || tile.forage || tile.npc) handleMapClick(tile.id, "direct");
    else toast(blockedReason(tile));
  }
  function stopDpadRepeat() {
    if (dpadRepeatTimer) clearInterval(dpadRepeatTimer);
    dpadRepeatTimer = null;
  }
  function setupSceneControls() {
    if (sceneControlBound) return;
    sceneControlBound = true;
    setPrimaryPointerClass();
    window.addEventListener("resize", setPrimaryPointerClass);
    if (window.matchMedia) {
      const primaryPointer = window.matchMedia("(pointer: coarse)");
      if (primaryPointer.addEventListener) primaryPointer.addEventListener("change", setPrimaryPointerClass);
      else if (primaryPointer.addListener) primaryPointer.addListener(setPrimaryPointerClass);
    }
    document.querySelectorAll(".dpad-btn[data-dir]").forEach((btn) => {
      btn.addEventListener("pointerdown", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        if (hasOpenModal()) { stopDpadRepeat(); return; }
        const dir = btn.dataset.dir;
        stepPlayerDir(dir);
        stopDpadRepeat();
        dpadRepeatTimer = setInterval(() => stepPlayerDir(dir), window.MOVE_MS + 70);
        if (btn.setPointerCapture && ev.pointerId != null) btn.setPointerCapture(ev.pointerId);
      });
      ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"].forEach((name) => {
        btn.addEventListener(name, (ev) => { ev.preventDefault(); ev.stopPropagation(); stopDpadRepeat(); });
      });
    });
    const action = $("actionA");
    if (action) action.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); activateFacingTile(); });
    const fitToggle = $("mapFitToggle");
    if (fitToggle) fitToggle.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); toggleMapViewMode(); });
    const world = $("mapWorld");
    if (world) {
      world.addEventListener("pointerdown", (ev) => {
        if (hasOpenModal()) return;
        const ob = ev.target && ev.target.closest ? ev.target.closest(".ob[data-kind]") : null;
        if (ob && ev.pointerType) lastMapPointer = { pointerType: ev.pointerType, tileId: ob.dataset.tileId || "", at: now() };
      }, { passive: true });
      world.addEventListener("click", (ev) => {
        const ob = ev.target && ev.target.closest ? ev.target.closest(".ob[data-kind]") : null;
        if (!ob) return;
        ev.preventDefault(); ev.stopPropagation();
        if (ob.dataset.animalId) { showAnimalBubble(ob.dataset.animalId, ob); return; }
        if (ob.dataset.buildingId) { showBuildingBubble(ob.dataset.buildingId, ob); return; }
        if (ob.dataset.structureId) {
          const bld = state.buildings.find((x) => x.structureId === ob.dataset.structureId);
          if (bld) { showBuildingBubble(bld.id, ob); return; }
        }
        if (ob.dataset.tileId) handleMapClick(ob.dataset.tileId, mapActivationType(ev, ob.dataset.tileId));
      });
    }
  }

  // ---------- 統一刷新 ----------
  function afterChange(rerenderPanels) {
    const t = now();
    checkNewLetters(t, true);
    renderResBar(); renderSeeds(); updateFarm(t);
    renderStory(); renderQuestDock(); renderSmartAssistant(true); renderJournal(); syncHud(); renderSceneActionsForSelection();
    if (rerenderPanels) { renderUpgrades(); updateMap(t); }
    updateMailBadges();
    scheduleSave();
  }

  // ---------- 離線摘要 ----------
  function showOfflineSummary(summary) {
    if (!summary || summary.offlineMs < OFFLINE_SUMMARY_MIN_MS) return false; // 離線 <5 分鐘不打擾
    const lines = [];
    const minutes = Math.max(5, Math.round(summary.offlineMs / 60000));
    const forageCount = summary.forageReadyCount || (summary.forageReady || []).length || 0;
    lines.push(`<div class="ml" data-audit="offline-head">你離開的 ${minutes} 分鐘：離線收益 <span class="v">+${summary.coins || 0} 金</span></div>`);
    lines.push(`<div class="ml" data-audit="offline-mature">作物成熟 <span class="v">${summary.readyPlots || 0} 株</span></div>`);
    if (forageCount > 0) lines.push(`<div class="ml" data-audit="offline-forage">採集點已刷新 <span class="v">${forageCount} 處</span></div>`);
    if (summary.seasonsAdvanced > 0) {
      const reached = (summary.seasonsReached || []).map((id) => {
        const s = (window.SEASONS || []).find((x) => x.id === id);
        return s ? s.name : id;
      });
      const label = reached.length ? `（${reached.join("、")}）` : "";
      lines.push(`<div class="ml" data-audit="offline-seasons">季節推進 <span class="v">${summary.seasonsAdvanced} 次</span>${escapeHtml(label)}</div>`);
      // R71（B-03 第二 commit）：離線期間有換季時，附上「回來時這一季」的晨光鎮廣播句。
      // 只掛在 seasonsAdvanced > 0 之下——沿用 R70 修正後的 P2-08 條件，勿回退成無條件顯示。
      const curSeasonId = state && G && G.currentSeason ? G.currentSeason(state, now()) : (state && state.season && state.season.id);
      const curSeason = (window.SEASONS || []).find((x) => x.id === curSeasonId);
      if (curSeason && curSeason.broadcast) lines.push(`<div class="ml" data-audit="offline-season-broadcast">📻 ${escapeHtml(curSeason.broadcast)}</div>`);
    }
    if ((summary.skippedSeasonEvents || []).length) {
      const names = summary.skippedSeasonEvents.map((sk) => {
        const ev = Object.values(window.SEASON_EVENTS || {}).find((x) => x.id === sk.eventId);
        return ev ? ev.name : sk.eventId;
      });
      lines.push(`<div class="ml" data-audit="offline-skipped-events">已結束節慶 <span class="v">${names.map(escapeHtml).join("、")}</span></div>`);
    }
    const crops = Object.entries(summary.perCrop || {});
    if (crops.length) {
      crops.forEach(([cid, n]) => lines.push(`<div class="ml">${window.CROPS[cid].emoji} ${window.CROPS[cid].name} 自動收成 <span class="v">+${n}</span></div>`));
    }
    const products = Object.entries(summary.products || {});
    if (products.length) {
      products.forEach(([pid, n]) => lines.push(`<div class="ml">${itemEmoji(pid)} ${itemName(pid)} 動物產出 <span class="v">+${n}</span></div>`));
    }
    if (summary.replanted > 0) lines.push(`<div class="ml">🤖 幫手補種 <span class="v">${summary.replanted} 次</span></div>`);
    if (summary.lost > 0) lines.push(`<div class="ml" style="color:var(--bad)">📦 倉滿損失 <span class="v">${summary.lost}</span></div>`);
    if (!crops.length && !products.length && !summary.readyPlots && !forageCount && !(summary.coins > 0) && !(summary.seasonsAdvanced > 0) && !((summary.skippedSeasonEvents || []).length)) lines.push(`<div class="ml">農場靜悄悄，沒有新進度</div>`);
    if (summary.cappedFromMs > 0) lines.push(`<div class="tip">（離線收益上限 8 小時，實際離開 ${fmtTime(summary.cappedFromMs)}）</div>`);
    $("offlineBody").innerHTML = lines.join("");
    openModal("offlineModal", "#offlineOk");
    return true;
  }

  let errorRecoveryBound = false;
  function safeSaveNow() {
    try {
      if (!state) return { ok: false, reason: "no_state" };
      state.lastSeenAt = now();
      if (window.safeSave) return window.safeSave(state) || { ok: true };
      window.save(state);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: "save_failed", error: e };
    }
  }
  function showErrorRecovery(error) {
    const saveResult = safeSaveNow();
    try {
      const box = $("errorRecovery"); if (!box) return saveResult;
      box.hidden = false;
      box.dataset.saved = saveResult && saveResult.ok ? "true" : "false";
      box.dataset.errorName = error && error.name ? error.name : "error";
    } catch (e) {}
    return saveResult;
  }
  function setupErrorRecovery() {
    if (errorRecoveryBound) return;
    errorRecoveryBound = true;
    window.addEventListener("error", (ev) => { showErrorRecovery(ev.error || ev.message); });
    window.addEventListener("unhandledrejection", (ev) => { showErrorRecovery(ev.reason || ev); });
  }

  // ---------- 主迴圈 ----------
  function loop() {
    if (document.hidden) return;
    const t = now();
    const weatherChanged = G.updateWeather(state, t);
    const seasonChanged = G.updateSeason ? G.updateSeason(state, t) : false;
    if (seasonChanged) {
      const sid = G.currentSeason ? G.currentSeason(state, t) : (state.season && state.season.id);
      seasonTransitionFx(sid);
      const s = (window.SEASONS || []).find((x) => x.id === sid);
      const bias = G.seasonOrderBiasToast ? G.seasonOrderBiasToast(state, t) : "";
      // R71（B-03 第二 commit）：換季 toast 附帶「晨光鎮廣播」一句（純文案，可整段回退）
      if (s) toast(`${s.icon} ${s.name}到了，當季作物收購價提升。${s.broadcast ? " 📻 " + s.broadcast : ""}${bias ? " " + bias : ""}`);
      if (G.seasonEventStatus) {
        const ev = G.seasonEventStatus(state, t);
        if (ev && ev.event && ev.available) toast(`${ev.event.icon} 本季小事：${ev.event.name} 可在信箱查看。`);
      }
    }
    checkNewLetters(t, true);
    const helped = G.runHelperOnline(state, t);
    // 訂單過期補單
    G.refreshOrders(state, t);
    if (orderSig() !== lastOrderSig) renderOrders();
    else {
      // 只更新訂單倒數時間（輕量）
      document.querySelectorAll("#orders .o-meta").forEach((m, idx) => {
        const o = state.orders[idx]; if (!o) return;
        const rarity = window.ORDER_RARITY[o.rarity];
        m.innerHTML = `${rarity.label} · ⏳ ${fmtTime(Math.max(0, o.expiresAt - t))}`;
      });
    }
    // 天氣自然到期改變時，資源列的天氣圖示也要跟著換，不然會跟地圖上的 #weatherLayer 對不上
    if (helped.harvested > 0 || weatherChanged || seasonChanged) { renderResBar(); }
    const lowTier = isLowPerformanceTier();
    const forceRender = helped.harvested > 0 || weatherChanged || seasonChanged;
    if (!lowTier || forceRender || t - lastFarmRenderAt >= 1000) {
      updateFarm(t);
      lastFarmRenderAt = t;
    }
    if (!lowTier || forceRender || t - lastMapRenderAt >= 1000) {
      updateMap(t);       // 地圖：作物/動物成熟
      lastMapRenderAt = t;
    }
    if (!lowTier || t - lastAssistantRenderAt >= 1000) {
      renderSmartAssistant();
      lastAssistantRenderAt = t;
    }
    tickPlayer(t);      // 玩家走路/動作/待機動畫
  }

  function setupVisibilityLifecycle() {
    document.addEventListener("visibilitychange", () => {
      perfNeedsBaseline = true;
      if (document.hidden) {
        state.lastSeenAt = now();
        window.save(state);
        return;
      }
      loop();
      updateMap(now());
      positionPlayer(false);
    });
  }

  // ---------- 初始化 ----------
  // 商店宣傳三連圖 fixture：只由明確的 debug/e2e 呼叫觸發，不改預設存檔或玩法規則。
  function applyPromoScene(id) {
    const scenes = {
      spring: { season: "春", weather: "clear", crops: ["radish", "pea"] },
      summer: { season: "夏", weather: "sunny", crops: ["sunflower", "corn", "bell_pepper"] },
      autumn: { season: "秋", weather: "clear", crops: ["sweet_potato", "grapes", "pumpkin"] },
      winter: { season: "冬", weather: "snow", crops: ["winter_kale"] },
    };
    const scene = scenes[id]; if (!scene) return null;
    const t = now();
    state.level = Math.max(9, state.level || 1);
    state.upgrades.plotCount = 3;
    state.season = { id: scene.season, untilMs: t + (window.SEASON_DURATION_MS || 1200000) };
    state.weather = { id: scene.weather, untilMs: t + (window.WEATHER_DURATION_MS || 180000) };
    for (let i = 0; i < state.plots.length; i++) {
      const cropId = scene.crops[i % scene.crops.length];
      const crop = window.CROPS[cropId];
      state.plots[i].cropId = cropId;
      state.plots[i].plantedAt = t - crop.growMs - 1000;
      state.plots[i].wateredAt = state.plots[i].plantedAt;
    }
    state.player.tileId = "t7_3"; state.player.facing = "left";
    state.camera = Object.assign({}, state.camera, { followPlayer: true, focusTileId: null, focusUntil: 0 });
    document.documentElement.dataset.promoScene = id;
    document.querySelectorAll(".modal.show").forEach((m) => m.classList.remove("show"));
    setModalBackgroundInert(false);
    buildMap(); updateMap(t); positionPlayer(false); syncHud();
    if (worldEl) worldEl.style.transition = "none";
    return { id, season: scene.season, weather: scene.weather, crops: scene.crops.slice() };
  }

  function init() {
    // 先載入存檔，state 必須在任何 render/onload 前就緒
    state = window.load() || window.defaultState(now());
    ensureSettings();
    applyTextSize();
    applyPerformanceMode();
    setupAudioUnlock();
    setupErrorRecovery();
    setupVisibilityLifecycle();
    selectedSeed = state.selectedSeed && window.CROPS[state.selectedSeed] ? state.selectedSeed : "wheat";

    // 舊作物 sheet 僅供隱藏相容農場格（主地圖作物改用 atlas）
    document.documentElement.style.setProperty("--crop-sheet", `url(${ASSETS.crops})`);

    // v3 atlas：載入後用整數 frame 渲染地圖/角色（主地圖無 emoji）
    if (window.Atlas) {
      window.Atlas.load();
      window.Atlas.ready().then((ok) => {
        atlasReady = !!ok;
        if (atlasReady && state) {
          buildMap(); updateMap(now()); positionPlayer(false);
          paintIdlePlayer();
        }
      });
    }

    // 離線結算（在 refreshOrders 前）
    const summary = G.applyOffline(state, now());
    recordOfflineSummary(summary);
    G.refreshOrders(state, now());
    G.updateWeather(state, now());
    if (G.updateSeason) G.updateSeason(state, now());
    checkNewLetters(now(), false);

    buildFarm(); buildMap();
    renderToolbar(); renderResBar(); renderSeeds(); renderOrders(); renderUpgrades(); renderStory(); renderQuestDock(); renderSmartAssistant(true); renderJournal(); syncHud(); syncGenderBtn(); updateFarm(now()); renderTileContext();
    updateMailBadges();
    positionPlayer(false);
    setupSceneControls();
    // 視窗縮放：重新定位玩家
    window.addEventListener("resize", () => { lastMapFitSig = ""; rebuildMapForView(); });
    // 鍵盤 WASD/方向鍵：一次走一格
    document.addEventListener("keydown", onKeyMove);
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && closeOpenModal()) ev.preventDefault();
    });
    const lettersClose = $("lettersClose");
    if (lettersClose) lettersClose.onclick = () => closeModal("lettersModal");

    // sprite 切換鈕初始文字
    $("spriteToggle").textContent = state.useSprites ? "像素圖" : "符號圖";

    // 首次玩顯示引導；否則顯示離線摘要
    function showInitialModal() {
      let shownModal = false;
      if (!state.stats || state.stats.plantCount === 0) {
        if ((state.coins === window.GAME.startCoins) && Object.keys(state.stats.harvested).length === 0) {
          openModal("howToModal", "#howToOk"); shownModal = true;
        }
      }
      if (!shownModal && state.settings.offlineSummary !== false) showOfflineSummary(summary);
    }

    window.save(state);
    setInterval(loop, window.GAME.tickMs);
    setInterval(() => { if (!document.hidden) window.save(state); }, window.GAME.autosaveMs);
    window.addEventListener("beforeunload", () => { state.lastSeenAt = now(); window.save(state); });

    bindToolbar();
    setupSideTabs();
    startPerformanceMonitor();
    setupPwa();

    // 測試/除錯掛鉤
    window.__farm = {
      state: () => state,
      player: () => player,
      playerTileId: () => state.player.tileId,
      playerAction: () => state.player.action,
      refresh: () => { renderToolbar(); renderResBar(); renderSeeds(); renderOrders(); renderUpgrades(); renderStory(); renderQuestDock(); renderSmartAssistant(true); renderJournal(); syncHud(); buildMap(); updateFarm(now()); renderTileContext(); updateMailBadges(); },
      openLetters: () => openLettersModal(),
      clickTile: (id) => handleMapClick(id),
      touchFarmPreview: () => pendingTouchFarmAction ? { ...pendingTouchFarmAction } : null,
      focusTile: (id) => focusCameraOnTile(id),
      assistantSuggestions: () => G.farmActionSuggestions ? G.farmActionSuggestions(state, now(), { limit: 3 }) : [],
      renderSettings: () => renderSettingsPanel(),
      lastOfflineSummary: () => state.lastOfflineSummary,
      exportSaveCode: () => exportSaveCode(),
      importSaveCode: () => importSaveCode(),
      restoreBackupSave: () => restoreBackupSave(),
      performanceInfo: () => performanceInfo(),
      setPerformanceMode: (mode) => { ensureSettings(); state.settings.performanceMode = mode; perfAutoLow = false; applyPerformanceMode(); renderSettingsPanel(); },
      setTextSize: (size) => { ensureSettings(); state.settings.textSize = size; applyTextSize(); renderSettingsPanel(); },
      pwaVersion: () => PWA_CACHE_VERSION,
      safeSaveNow: () => safeSaveNow(),
      showErrorRecovery: () => showErrorRecovery(new Error("test")),
      focusQuestTarget: () => {
        const targetId = G.questMarkerTile ? G.questMarkerTile(state, now()) : null;
        if (targetId) focusCameraOnTile(targetId);
        return targetId;
      },
      setTool: (t) => setTool(t),
      moving: () => !!moveTimer,
      vfxSpawns: () => vfxSpawnCount,
      activeTab: () => { const b = document.querySelector(".side-tab.sel"); return b ? b.dataset.tab : null; },
      stationTile: (type) => stationTileOf(type),
      applyPromoScene,
    };
    let loadingFinished = Promise.resolve(true);
    if (typeof window.__finishFarmLoading === "function") {
      const loadingSeason = G.currentSeason ? G.currentSeason(state, now()) : "春";
      loadingFinished = window.__finishFarmLoading(loadingSeason).catch(() => {
        const loading = document.getElementById("startupLoading");
        if (loading) loading.remove();
        document.body.classList.remove("r68-loading");
        performance.mark("farm-interactive-ready");
        return true;
      });
    }
    loadingFinished.then((finished) => { if (finished) showInitialModal(); });
  }

  function bindToolbar() {
    $("harvestAllBtn").onclick = () => {
      const r = G.harvestAll(state, now());
      if (r.totalAdded > 0) { const c = elementCenter($("mapScene")); screenBurst(c.x, c.y, ["\ud83c\udf3e", "\ud83e\udd55", "\ud83c\udf45"], { count: 16, distance: 88 }); flyCoinsToHud(c.x, c.y, 5); harvestComboText(c.x, c.y); playSound("harvest"); playSound("coin"); toast("🧺 收成 " + r.totalAdded + " 個作物"); if (r.totalLost) toast("📦 倉滿損失 " + r.totalLost); afterChange(true); }
      else toast("沒有成熟的作物");
    };
    $("sellAllBtn").onclick = () => {
      const r = G.sellAll(state, now());
      if (r.coins > 0) { playAction("carry"); const c = elementCenter($("sellAllBtn")); flyCoinsToHud(c.x, c.y, 6); playSound("coin"); toast("🪙 賣出 " + r.qty + " 個，得 " + fmtNum(r.coins) + " 金"); afterChange(true); renderOrders(); }
      else toast("倉庫沒有可賣的作物");
    };
    // 澆水（全部）：對所有可澆的乾土作物澆水變濕土加速（綁角色澆水動畫）
    $("waterAllBtn").onclick = () => {
      const t = now(); let n = 0;
      for (let i = 0; i < G.activePlotCount(state); i++) {
        if (G.waterPlot(state, i, t).ok) n++;
      }
      playAction("water");
      if (n > 0) { const c = elementCenter($("mapScene")); screenBurst(c.x, c.y, ["\ud83d\udca7"], { count: Math.min(16, 4 + n), distance: 82, className: "water-drop-particle" }); playSound("water"); }
      toast(n > 0 ? "💧 澆水 " + n + " 格，變濕土加速成長" : "沒有需要澆水的作物");
      if (n > 0) afterChange(false);
    };
    // 收集全部動物產物
    $("collectAllBtn").onclick = () => {
      const r = G.collectAllAnimals(state, now());
      if (r.total > 0) { playAction("carry"); const c = elementCenter($("collectAllBtn")); screenBurst(c.x, c.y, ["\u2b50"], { count: 10, distance: 58 }); playSound("coin"); toast("🧺 收集 " + r.total + " 份產物"); afterChange(true); renderTileContext(); updateMap(now()); }
      else toast("目前沒有可收集的產物");
    };
    $("spriteToggle").onclick = () => {
      state.useSprites = !state.useSprites;
      $("spriteToggle").textContent = state.useSprites ? "像素圖" : "符號圖";
      updateFarm(now()); scheduleSave();
    };
    // Stage 6：主角性別切換（女 Miri ↔ 男 Kai），即時換 sprite
    $("genderToggle").onclick = () => {
      state.gender = state.gender === "m" ? "f" : "m";
      syncGenderBtn();
      paintIdlePlayer(); positionPlayer(false); toast(state.gender === "m" ? "🧑 主角：Kai（男）" : "👩 主角：Miri（女）");
      scheduleSave();
    };
    $("settingsBtn").onclick = () => {
      renderSettingsPanel();
      openModal("settingsModal", "#settingsOk");
    };
    $("settingsOk").onclick = () => closeModal("settingsModal");
    $("howToBtn").onclick = () => openModal("howToModal", "#howToOk");
    $("howToOk").onclick = () => closeModal("howToModal");
    $("offlineOk").onclick = () => closeModal("offlineModal");
    if ($("errorContinue")) $("errorContinue").onclick = () => { $("errorRecovery").hidden = true; };
    if ($("errorReload")) $("errorReload").onclick = () => window.location.reload();
    $("resetBtn").onclick = () => {
      if (confirm("確定重置存檔？所有進度會消失。")) {
        window.reset(); state = window.defaultState(now());
        selectedSeed = "wheat"; selectedTileId = null; buildFarm(); buildMap();
        renderToolbar(); renderResBar(); renderSeeds(); renderOrders(); renderUpgrades(); renderStory(); renderQuestDock(); renderSmartAssistant(true); updateFarm(now()); renderTileContext();
        G.refreshOrders(state, now()); renderOrders();
        window.save(state); toast("🗑️ 已重置");
      }
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
