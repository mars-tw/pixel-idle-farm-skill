/*
 * rainplay-r85.js — R85B 第 4 項：壞天氣也有事做（雨水桶與雨後虹光）。
 * 雨、暴風雨、雪、霧不出光斑（game.js SUNPATCH.blockedWeather），招牌玩法在壞天氣整段停擺；這一支補上壞天氣專屬的小玩法：
 *   1 壞天氣一來，田邊立起一個雨水桶。遊戲開著的時候才接得到水（每次更新最多記 2 秒，離線、切到背景都不算），40 秒接滿一桶。
 *   2 接滿點一下「倒進田裡」：還在長、還沒澆的田一次澆好（長快四分之一，跟手動澆水同一條規則），蓄光瓶陽光 +1。
 *     一段壞天氣最多倒 3 桶，接滿 3 桶後桶子就不再接水，不能一直刷。
 *   3 這段壞天氣倒過至少一桶，天氣一轉好就落下一次「虹光」：照 4 格田、停 30 秒（一般的光照 1～2 格、停 16 秒），
 *     在光裡種、澆、收的加成跟一般的光完全一樣（共用 game.js 的光斑規則）。一段壞天氣最多一次，離線時雨停了也只補一次。
 *   4 新存檔前 30 分鐘一定遇得到：天氣要 5 級才解鎖，新玩家前半小時通常遇不到壞天氣，所以新存檔在第 15 分鐘（第一次光裡收成以後；
 *     最晚第 25 分鐘）來一陣 2 分半的過雲雨。之前已經遇過壞天氣就不再安排。舊存檔不安排。
 *   5 第一次遇到壞天氣時只跳一則短提示，不開對話框、不改任務卡與右下大鈕；雨水桶是地圖上的物件，點擊範圍至少 44×44。
 * 規則全在這支（沒有 DOM 也能跑，Node 測試直接用遊戲時鐘模擬）；瀏覽器端只負責畫雨水桶、虹光與提示。
 */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const Game = isNode ? require("./game.js") : root;
  const Sunplay = isNode ? require("./sunplay-r75.js") : root.FarmSunplay;

  /* 壞天氣與桶裡接到的水。 */
  const BAD = { rain: "雨水", storm: "雨水", snow: "雪水", fog: "露水" };
  const FILL_MS = 40000;                    // 開著遊戲、壞天氣下接滿一桶
  const STEP_CAP_MS = 2000;                 // 每次更新最多記這麼多（離線、切到背景不算）
  const SPELL_CAP = 3;                      // 一段壞天氣最多倒幾桶
  const POUR_SUNLIGHT = 1;                  // 每倒一桶，蓄光瓶 +1
  const RAINBOW_PLOTS = 4;                  // 虹光照幾格
  const RAINBOW_MS = 30000;                 // 虹光停多久
  const SHOWER_AT_MS = 15 * 60 * 1000;      // 新存檔第幾分鐘來過雲雨
  const SHOWER_LATEST_MS = 25 * 60 * 1000;  // 教學還沒走完，最晚這時也來
  const SHOWER_MS = 150000;                 // 過雲雨下多久
  const NEW_SAVE_MS = 60000;                // 第一次讀到這支時，存檔建立不到這麼久才算新存檔
  const ART = {
    empty: "assets/generated/content-r85b/rain-barrel-empty.png",
    half: "assets/generated/content-r85b/rain-barrel-half.png",
    full: "assets/generated/content-r85b/rain-barrel-full.png",
    rainbow: "assets/generated/content-r85b/rainbow-light.png",
  };
  const HINT = "下雨了，光暫停。田邊雨水桶接滿點一下，雨停有虹光。";
  function rainbowText(n) { return `放晴了！虹光照 ${n} 格田 ${Math.round(RAINBOW_MS / 1000)} 秒，光裡種、澆、收都有加成。`; }

  const whole = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const plain = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const isBad = (w) => Object.prototype.hasOwnProperty.call(BAD, w);

  function normalize(state, now) {
    const t = whole(now) || Date.now();
    if (!plain(state.r85Rain)) {
      const born = whole(state.createdAt);
      /* 只有剛建立的存檔才排過雲雨：舊存檔、測試擺好的存檔不會突然下雨。 */
      state.r85Rain = { showerAt: born && t >= born && t - born < NEW_SAVE_MS ? born + SHOWER_AT_MS : 0 };
    }
    const r = state.r85Rain;
    const spell = plain(r.spell) && isBad(r.spell.weather) && whole(r.spell.startedAt)
      ? { weather: r.spell.weather, startedAt: whole(r.spell.startedAt), filledMs: Math.min(FILL_MS, whole(r.spell.filledMs)), buckets: Math.min(SPELL_CAP, whole(r.spell.buckets)), tileId: typeof r.spell.tileId === "string" ? r.spell.tileId : "" }
      : null;
    const clean = {
      showerAt: whole(r.showerAt), showerStartedAt: whole(r.showerStartedAt), showerUntil: whole(r.showerUntil), showerDone: !!r.showerDone,
      seenBad: !!r.seenBad, hinted: !!r.hinted, lastAt: whole(r.lastAt), spell, pendingRainbow: !!r.pendingRainbow,
      rainbows: whole(r.rainbows), lastRainbowAt: whole(r.lastRainbowAt), pours: whole(r.pours),
    };
    Object.keys(r).forEach((key) => { if (!Object.prototype.hasOwnProperty.call(clean, key)) delete r[key]; });
    return Object.assign(r, clean);
  }

  /* game.js currentWeather 讀這個：過雲雨下著的時候算雨天（不管天氣解鎖了沒）。 */
  function showerActive(state, now) {
    const r = state && state.r85Rain; if (!plain(r)) return false;
    const t = Number.isFinite(now) ? now : Date.now();
    return whole(r.showerUntil) > t && t >= whole(r.showerStartedAt);
  }
  function weatherAt(state, now) { try { return typeof Game.currentWeather === "function" ? Game.currentWeather(state, now) : "clear"; } catch (_) { return "clear"; } }
  function lightActive(state, now) { try { return typeof Game.sunpatchActive === "function" && Game.sunpatchActive(state, now); } catch (_) { return false; } }
  function firstLightDone(state) {
    return !!(state && ((state.flags && state.flags.r79FirstLightHarvest === true) || (state.adventure && state.adventure.claimed && state.adventure.claimed.c1_first_harvest)));
  }
  function planted(state) { return (state.plots || []).some((p) => p && p.cropId) || whole(state.stats && state.stats.plantCount) > 0; }

  function maybeStartShower(state, r, t) {
    if (!r.showerAt || r.showerDone || r.seenBad || t < r.showerAt || !planted(state)) return false;
    if (!firstLightDone(state) && t < whole(state.createdAt) + SHOWER_LATEST_MS) return false;
    if (lightActive(state, t)) return false; /* 光還在田上，等它散了再下 */
    r.showerStartedAt = t; r.showerUntil = t + SHOWER_MS; r.showerDone = true;
    return true;
  }

  /* 虹光的落點：可收成 > 生長中沒澆 > 已澆生長中 > 空地，同分照田的順序；最多 4 格。 */
  function rainbowPlots(state, t) {
    const active = typeof Game.activePlotCount === "function" ? Game.activePlotCount(state) : 6;
    const rows = [];
    for (let i = 0; i < Math.min(active, (state.plots || []).length); i++) {
      const p = state.plots[i]; let score = 1;
      if (p && p.cropId) { let prog = null; try { prog = Game.getCropProgress(state, p, t); } catch (_) { prog = null; } score = prog && prog.ready ? 4 : prog && prog.wet ? 2 : 3; }
      rows.push({ i, score });
    }
    rows.sort((a, b) => (b.score - a.score) || (a.i - b.i));
    return rows.slice(0, RAINBOW_PLOTS).map((row) => row.i).sort((a, b) => a - b);
  }
  function spawnRainbow(state, t) {
    const plots = rainbowPlots(state, t); if (!plots.length) return [];
    const sun = typeof Game.ensureSunState === "function" ? Game.ensureSunState(state) : state.sun;
    const interval = Game.SUNPATCH ? Game.SUNPATCH.intervalMs : 40000;
    Object.assign(sun, { plots, used: [], startsAt: t, endsAt: t + RAINBOW_MS, durationMs: RAINBOW_MS, previewPlots: [], previewAt: 0, nextAt: t + RAINBOW_MS + interval, refractions: 0, rainbow: true });
    if (Sunplay) Sunplay.noteRainEvent(state, "lit");
    try { if (typeof Game.clearLightHarvestQueue === "function") Game.clearLightHarvestQueue(state); } catch (_) { /* 沒有等光排程 */ }
    return plots;
  }

  /* 每次畫面更新呼叫一次。回傳這一拍發生的事：shower（過雲雨開始）、hint（第一次壞天氣，跳提示）、started／ended（一段壞天氣開始、結束）、filled（桶子剛接滿）、rainbow（虹光落在哪幾格）。 */
  function update(state, now) {
    const t = whole(now) || Date.now(), r = normalize(state, t), out = { shower: false, hint: false, started: false, ended: false, filled: false, rainbow: null };
    const step = r.lastAt ? Math.max(0, Math.min(STEP_CAP_MS, t - r.lastAt)) : 0;
    r.lastAt = t;
    if (maybeStartShower(state, r, t)) out.shower = true;
    const w = weatherAt(state, t), bad = isBad(w);
    if (bad) {
      r.seenBad = true;
      if (!r.hinted) { r.hinted = true; out.hint = true; }
      if (!r.spell) { r.spell = { weather: w, startedAt: t, filledMs: 0, buckets: 0, tileId: "" }; out.started = true; }
      else r.spell.weather = w;
      if (r.spell.buckets < SPELL_CAP && r.spell.filledMs < FILL_MS) {
        r.spell.filledMs = Math.min(FILL_MS, r.spell.filledMs + step);
        if (r.spell.filledMs >= FILL_MS) out.filled = true;
      }
    } else if (r.spell) {
      if (r.spell.buckets > 0) r.pendingRainbow = true;
      r.spell = null; out.ended = true;
    }
    if (!bad && r.pendingRainbow && !lightActive(state, t)) {
      const plots = spawnRainbow(state, t);
      if (plots.length) { r.pendingRainbow = false; r.rainbows += 1; r.lastRainbowAt = t; out.rainbow = plots; }
    }
    return out;
  }

  /* 桶子現在的樣子（畫面與測試共用）。 */
  function barrel(state, now) {
    const t = whole(now) || Date.now(), r = normalize(state, t), sp = r.spell;
    if (!sp) return null;
    const capped = sp.buckets >= SPELL_CAP, full = !capped && sp.filledMs >= FILL_MS;
    const ratio = capped ? 1 : sp.filledMs / FILL_MS, water = BAD[sp.weather] || "雨水";
    const secs = Math.max(1, Math.ceil((FILL_MS - sp.filledMs) / 1000));
    const stage = capped || full ? "full" : ratio >= 0.5 ? "half" : "empty";
    const label = capped ? `接了 ${SPELL_CAP} 桶・等放晴` : full ? `${water}滿了・點一下倒` : `接${water}・${Math.round(ratio * 100)}%`;
    const aria = capped ? `雨水桶：這段壞天氣已經倒了 ${SPELL_CAP} 桶，天氣轉好會有虹光照 ${RAINBOW_PLOTS} 格田` : full ? `雨水桶接滿了，點一下倒進田裡：還沒澆的田一次澆好，陽光加 ${POUR_SUNLIGHT}` : `雨水桶正在接${water}，還要 ${secs} 秒接滿`;
    return { weather: sp.weather, water, ratio, full, capped, stage, art: ART[stage], label, aria, seconds: full || capped ? 0 : secs, buckets: sp.buckets, cap: SPELL_CAP, tileId: sp.tileId };
  }

  /* 點一下倒進田裡。 */
  function pour(state, now) {
    const t = whole(now) || Date.now(), r = normalize(state, t), sp = r.spell;
    if (!sp) return { ok: false, reason: "dry", message: "天氣好的時候雨水桶是空的，下雨再來接。" };
    if (sp.buckets >= SPELL_CAP) return { ok: false, reason: "cap", message: `這段壞天氣已經倒了 ${SPELL_CAP} 桶，等放晴的虹光。` };
    if (sp.filledMs < FILL_MS) { const secs = Math.max(1, Math.ceil((FILL_MS - sp.filledMs) / 1000)); return { ok: false, reason: "filling", seconds: secs, message: `還沒接滿，再等 ${secs} 秒。` }; }
    const active = typeof Game.activePlotCount === "function" ? Game.activePlotCount(state) : 6, watered = [];
    for (let i = 0; i < Math.min(active, (state.plots || []).length); i++) {
      const p = state.plots[i]; if (!p || !p.cropId) continue;
      let res = null; try { res = Game.waterPlot(state, i, t); } catch (_) { res = null; }
      if (res && res.ok) watered.push(i);
    }
    const gained = Sunplay && typeof Sunplay.addSunlight === "function" ? Sunplay.addSunlight(state, POUR_SUNLIGHT) : 0;
    sp.buckets += 1; sp.filledMs = 0; r.pours += 1;
    if (watered.length && Sunplay) Sunplay.noteRainEvent(state, "watered");
    const left = SPELL_CAP - sp.buckets;
    /* 手機一次讀得完：先寫拿到什麼，再寫還能接幾桶。 */
    const head = watered.length ? `倒進田裡：澆好 ${watered.length} 格田` : "田都澆過了";
    const sun = gained > 0 ? `，陽光 +${gained}` : "，蓄光瓶滿了";
    const tail = left > 0 ? `。還能接 ${left} 桶。` : `。接滿 ${SPELL_CAP} 桶了，放晴有虹光。`;
    return { ok: true, watered, sunlight: gained, buckets: sp.buckets, left, message: head + sun + tail };
  }

  const API = { BAD, FILL_MS, STEP_CAP_MS, SPELL_CAP, POUR_SUNLIGHT, RAINBOW_PLOTS, RAINBOW_MS, SHOWER_AT_MS, SHOWER_LATEST_MS, SHOWER_MS, NEW_SAVE_MS, ART, HINT,
    normalize, showerActive, isBad, update, barrel, pour, rainbowPlots, spawnRainbow, firstLightDone, rainbowText };
  if (isNode) { module.exports = API; return; }
  root.FarmRainplay = API;
  if (typeof document === "undefined") return;

  /* ---------- 瀏覽器：田邊的雨水桶與天上的虹光 ---------- */
  const farm = () => root.__farm || null;
  function liveState() { const f = farm(); try { return f && typeof f.state === "function" ? f.state() : null; } catch (_) { return null; } }
  function tileNode(tileId) { return document.querySelector('.gtile[data-tile-id="' + tileId + '"]'); }
  /* 固定介面：雨水桶不放在這些東西底下。 */
  const HUD = ["#questDock", "#seedHud", "#sceneActionBar", "#farmDock", ".toolbar", "#worldMinimap", "header", "#mobileControls", "#actionA", "#sunChip"];
  function hudRects() { return HUD.map((sel) => document.querySelector(sel)).filter((el) => el && !el.hidden && getComputedStyle(el).display !== "none").map((el) => el.getBoundingClientRect()).filter((b) => b.width && b.height); }
  function free(rect, rects) { return !rects.some((b) => b.left < rect.right && b.right > rect.left && b.top < rect.bottom && b.bottom > rect.top); }
  /* 雨水桶放在田邊空地（跟田邊小事同一套空地），不放在花叢這類擺飾後面。畫面上看得到、沒被固定介面（任務卡、種子欄、工具列、手機大鈕）
     蓋住的格子優先，其中挑離角色最近的；都看不到就挑離角色最近的那格（第一次出現時鏡頭會帶過去）。一段壞天氣裡位置固定，
     只有被固定介面蓋住、又有別格看得到時才換（每 3 秒最多檢查一次）。 */
  function underProp(tileId) {
    const n = tileNode(tileId); if (!n) return false; const r = n.getBoundingClientRect(), area = r.width * r.height; if (!area) return false;
    return [...document.querySelectorAll("#mapWorld .garden-prop")].some((el) => { const b = el.getBoundingClientRect(); return Math.max(0, Math.min(b.right, r.right) - Math.max(b.left, r.left)) * Math.max(0, Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top)) > area * 0.15; });
  }
  function tileShown(tileId) {
    const n = tileNode(tileId); if (!n) return false; const b = n.getBoundingClientRect();
    /* 名牌在桶子上方約 22px，一起算進去。 */
    const box = { left: b.left, right: b.right, top: b.top - 24, bottom: b.bottom };
    return box.left >= 4 && box.top >= 4 && box.right <= root.innerWidth - 4 && box.bottom <= root.innerHeight - 4 && free(box, hudRects());
  }
  function pickBarrelTile(state) {
    const W = root.FarmWaitplay; if (!W || typeof W.fieldEdgeTiles !== "function") return "";
    /* 讓開角色（角色在田上工作時畫在左邊那格）、任務那一格旁邊與田邊小事，跟田邊小事同一套避讓。 */
    let busy = new Set(); const player = state.player || {};
    try { const A = root.AdventureAPI, t = Date.now(); busy = W.avoidTiles(state, A && A.nextFarmStep ? A.nextFarmStep(state, t) : null, t); } catch (_) { busy = new Set(); }
    if (player.tileId) busy.add(player.tileId);
    const chore = state.flags && state.flags.r82Chores && state.flags.r82Chores.active; if (chore && chore.tileId) busy.add(chore.tileId);
    const seen = new Set(), list = W.fieldEdgeTiles(state, 1).concat(W.fieldEdgeTiles(state, 2)).filter((t) => !busy.has(t.id) && !seen.has(t.id) && seen.add(t.id) && !underProp(t.id));
    if (!list.length) return "";
    const px = Number.isFinite(player.x) ? player.x : 0, py = Number.isFinite(player.y) ? player.y : 0;
    const dist = (t) => Math.max(Math.abs(t.x - px), Math.abs(t.y - py)) + Math.abs(t.x - px) * 0.01;
    list.sort((a, b) => dist(a) - dist(b));
    return (list.find((t) => tileShown(t.id)) || list[0]).id;
  }
  /* 第一次壞天氣（每段壞天氣第一次畫桶子）：桶子或名牌不在畫面上、或被固定介面蓋住，就把鏡頭帶過去一次（不加遮罩、不接管點擊）。 */
  let focusedFor = 0;
  function inView(b) { return !!b && b.width > 0 && b.left >= 4 && b.top >= 4 && b.right <= root.innerWidth - 4 && b.bottom <= root.innerHeight - 4; }
  function barrelSeen(node) {
    if (!node) return false; const rects = hudRects(), parts = [node, node.querySelector(".r85b-barrel-tag")].filter(Boolean).map((n) => n.getBoundingClientRect());
    return parts.every((b) => inView(b) && free(b, rects));
  }
  function bringIntoView(node, tileId, key) {
    if (focusedFor === key) return; focusedFor = key;
    const f = farm(); if (!node || !f || typeof f.focusTile !== "function" || barrelSeen(node)) return;
    try { f.focusTile(tileId); } catch (_) { /* 鏡頭帶不過去就算了 */ }
  }
  let coverCheckedAt = 0;
  function paintBarrel(state, now) {
    const world = document.getElementById("mapWorld"); if (!world) return;
    let node = world.querySelector(".r85b-barrel");
    const view = barrel(state, now);
    if (!view || document.querySelector(".modal.show")) { if (node) node.remove(); return; }
    const r = state.r85Rain;
    if (!r.spell.tileId || !tileNode(r.spell.tileId)) r.spell.tileId = pickBarrelTile(state);
    /* 任務卡展開、手機大鈕出現等等把桶子蓋住時，換到畫面上看得到的另一格（每 3 秒最多檢查一次，不會一直跳）。 */
    if (node && now - coverCheckedAt > 3000) {
      coverCheckedAt = now; const b = node.getBoundingClientRect();
      if (b.width && b.right > 0 && b.left < root.innerWidth && b.bottom > 0 && b.top < root.innerHeight && !barrelSeen(node)) { const alt = pickBarrelTile(state); if (alt && alt !== r.spell.tileId && tileShown(alt)) r.spell.tileId = alt; }
    }
    const tile = r.spell.tileId && typeof Game.getTileById === "function" ? Game.getTileById(state, r.spell.tileId) : null, tn = tile && tileNode(tile.id);
    if (!tile || !tn) { if (node) node.remove(); return; }
    if (!node) {
      node = document.createElement("button"); node.type = "button"; node.className = "r85b-barrel is-new"; node.dataset.audit = "r85b-barrel";
      node.innerHTML = '<span class="r85b-barrel-art"><img alt="" draggable="false"></span><b class="r85b-barrel-tag"></b><i class="r85b-barrel-meter" aria-hidden="true"><i></i></i>';
      node.onclick = (event) => { event.stopPropagation(); pourNow(); };
      world.appendChild(node); setTimeout(() => node.classList.remove("is-new"), 450);
    }
    const T = parseFloat(tn.style.width) || tn.offsetWidth || 48, hit = Math.max(44, Math.round(T * 0.9)), art = Math.max(36, Math.round(T * 0.82));
    const left = Math.round((tile.x + 0.5) * T - hit / 2), top = Math.round((tile.y + 1) * T - hit - T * 0.04);
    const sig = [left, top, hit, art].join("|");
    if (node.dataset.box !== sig) { node.dataset.box = sig; node.style.cssText = `left:${left}px;top:${top}px;width:${hit}px;height:${hit}px;z-index:${Math.round((tile.y + 1) * T - T * 0.3)};--r85b-art:${art}px;`; }
    const img = node.querySelector("img"), src = view.art + (root.FARM_VERSION_QUERY || "");
    if (img.dataset.src !== src) { img.dataset.src = src; img.src = src; }
    const tag = node.querySelector(".r85b-barrel-tag"); if (tag.textContent !== view.label) tag.textContent = view.label;
    node.querySelector(".r85b-barrel-meter > i").style.width = Math.round(view.ratio * 100) + "%";
    node.dataset.stage = view.capped ? "capped" : view.full ? "full" : "filling"; node.dataset.tileId = tile.id;
    if (node.getAttribute("aria-label") !== view.aria) node.setAttribute("aria-label", view.aria);
    bringIntoView(node, tile.id, r.spell.startedAt);
  }
  /* 虹光：照著的那幾格上方掛一道彩虹，光散了就收掉（光柱、亮斑照舊由 ui.js 的光斑畫法負責）。 */
  function paintRainbow(state, now) {
    const world = document.getElementById("mapWorld"); if (!world) return;
    let node = world.querySelector(".r85b-rainbow");
    const sun = state.sun || {}, on = !!sun.rainbow && lightActive(state, now) && (sun.plots || []).length;
    if (!on) { if (node) node.remove(); return; }
    const tiles = (sun.plots || []).map((i) => state.map.tiles.find((t) => t.plotIndex === i)).filter(Boolean).map((t) => ({ t, n: tileNode(t.id) })).filter((x) => x.n);
    if (!tiles.length) { if (node) node.remove(); return; }
    if (!node) { node = document.createElement("div"); node.className = "r85b-rainbow"; node.dataset.audit = "r85b-rainbow"; node.setAttribute("aria-hidden", "true"); node.innerHTML = '<img alt="" draggable="false">'; world.appendChild(node); }
    const T = parseFloat(tiles[0].n.style.width) || tiles[0].n.offsetWidth || 48;
    const xs = tiles.map((x) => x.t.x), ys = tiles.map((x) => x.t.y), minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys);
    const w = Math.max(T * 2.4, (maxX - minX + 1) * T), h = Math.round(w / 2), left = Math.round((minX + (maxX - minX + 1) / 2) * T - w / 2), top = Math.round(minY * T - h * 0.92);
    /* 矮螢幕（手機橫放）田貼著畫面上緣時，田上方那道彩虹會被任務卡蓋住；這時改成跨在田上（下緣對齊田的下緣、淡一點）。 */
    const dock = document.getElementById("questDock"), worldBox = world.getBoundingClientRect(), scale = world.offsetWidth ? worldBox.width / world.offsetWidth : 1;
    let lowered = false;
    if (dock && !dock.hidden) { const d = dock.getBoundingClientRect(), screenTop = worldBox.top + top * scale, screenBottom = worldBox.top + (top + h) * scale; if (d.height && screenTop < d.bottom && screenBottom > d.top) lowered = true; }
    const finalTop = lowered ? Math.round((minY + 1) * T - h) : top;
    const sig = [left, finalTop, Math.round(w), lowered ? 1 : 0].join("|");
    if (node.dataset.box !== sig) { node.dataset.box = sig; node.style.cssText = `left:${left}px;top:${finalTop}px;width:${Math.round(w)}px;height:${h}px;`; node.classList.toggle("is-lowered", lowered); }
    const img = node.querySelector("img"), src = ART.rainbow + (root.FARM_VERSION_QUERY || ""); if (img.dataset.src !== src) { img.dataset.src = src; img.src = src; }
  }
  function toast(text) { const f = farm(); if (f && typeof f.toast === "function") f.toast(text); }
  function pourNow() {
    const s = liveState(); if (!s) return { ok: false, reason: "state" };
    const t = Date.now(), res = pour(s, t); toast(res.message);
    if (res.ok) {
      try { const A = root.AdventureAPI; if (res.watered.length && A && typeof A.record === "function") A.record(s, { type: "water", count: res.watered.length }, t); } catch (_) { /* 任務沒有澆水這一步 */ }
      const f = farm(); if (f && f.safeSaveNow) { try { f.safeSaveNow(); } catch (_) { /* 存檔失敗由主程式提示 */ } }
      if (f && f.refresh) { try { f.refresh(); } catch (_) { /* 重畫失敗不影響規則 */ } }
    }
    paintBarrel(s, Date.now());
    return res;
  }
  API.pourNow = pourNow;
  function tick() {
    if (document.hidden) return;
    const s = liveState(); if (!s || !s.map) return;
    try {
      const t = Date.now(), r = update(s, t);
      if (r.hint) toast(HINT);
      if (r.rainbow) {
        toast(rainbowText(r.rainbow.length));
        const f = farm(); if (f && f.sunTick) { try { f.sunTick(); } catch (_) { /* 光斑下一拍自己會畫 */ } }
        /* 虹光落下時鏡頭帶到田上一次（不加遮罩、不接管點擊）。 */
        const first = s.map.tiles.find((x) => x.plotIndex === r.rainbow[0]); if (first && f && typeof f.focusTile === "function") { try { f.focusTile(first.id); } catch (_) { /* 帶不過去就算了 */ } }
        if (f && f.renderSceneActions) { try { f.renderSceneActions(); } catch (_) { /* 動作列下一拍自己會畫 */ } }
      }
      if (r.shower || r.started || r.ended || r.rainbow) { const f = farm(); if (f && f.safeSaveNow) { try { f.safeSaveNow(); } catch (_) { /* 存檔失敗由主程式提示 */ } } }
      paintBarrel(s, t); paintRainbow(s, t);
    } catch (_) { /* 雨天玩法出錯不影響主遊戲 */ }
  }
  setInterval(tick, 500);
})(typeof window !== "undefined" ? window : globalThis);
