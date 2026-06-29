/* =========================================================================
 * ui.js — DOM 渲染與互動（瀏覽器專用）
 * 依賴 config.js / game.js / state.js 先載入。
 * 渲染原則：畫面從 state + config 推導；計時靠 Date.now() 與 plantedAt。
 * ========================================================================= */
(function () {
  "use strict";
  const G = window;          // game.js 把函式掛在 window
  const CROP_SHEET = window.CROP_SHEET;
  const ASSETS = {
    crops: "assets/generated/crop-growth.png",
    terrain: "assets/generated/terrain-tileset.png",
    icons: "assets/generated/ui-icons.png",
    // 角色圖：優先用去背 cutout，失敗退原圖
    actions: "assets/generated/characters/miri-rowan-farm-actions-cutout.png",
    actionsRaw: "assets/generated/characters/miri-rowan-farm-actions.png",
    walk: "assets/generated/characters/miri-rowan-walk-cycle-cutout.png",
    walkRaw: "assets/generated/characters/miri-rowan-walk-cycle.png",
  };

  let state = null;
  let selectedSeed = "wheat";
  let spritesReady = false;
  let lastOrderSig = "";
  let saveTimer = null;
  let selectedTileId = null;
  let moveTimer = null;
  let atlasReady = false;
  const plotEls = []; // 農地格 DOM 快取
  const tileEls = []; // 地圖磚 DOM 快取

  const $ = (id) => document.getElementById(id);
  const now = () => Date.now();

  // ---------- 物品/建材顯示 ----------
  function itemDef(id) { return window.getItemDef ? window.getItemDef(id) : (window.CROPS[id] || (window.PRODUCTS || {})[id]); }
  function itemEmoji(id) { const d = itemDef(id); if (d) return d.emoji; const m = (window.MATERIALS || {})[id]; return m ? m.emoji : "❔"; }
  function itemName(id) { const d = itemDef(id); if (d) return d.name; const m = (window.MATERIALS || {})[id]; return m ? m.name : id; }

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
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    $("toast-zone").appendChild(t);
    setTimeout(() => t.remove(), 2100);
  }
  function floatText(x, y, text, color) {
    const f = document.createElement("div");
    f.className = "float"; f.textContent = text; f.style.color = color || "#fff";
    f.style.left = x + "px"; f.style.top = y + "px";
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }
  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => { saveTimer = null; window.save(state); }, 600);
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
    $("resBar").innerHTML = `
      <div class="res coins"><span class="ic">🪙</span> ${fmtNum(state.coins)}</div>
      <div class="res level"><span class="ic">⭐</span>
        <div><div>Lv ${state.level}</div><div class="xp-track"><div class="xp-fill" style="width:${xpPct}%"></div></div></div>
        <span class="sub">${nextXp != null ? xpInLv + "/" + xpNeed : "MAX"}</span>
      </div>
      <div class="res"><span class="ic">📦</span> ${used}<span class="sub">/${cap}</span></div>
      ${weatherUnlocked ? `<div class="res weather" title="${w.name}"><span class="ic">${w.icon}</span><span class="sub">${w.name}</span></div>` : ""}
      ${matChips()}`;
  }
  // 建材顯示（>0 才顯示，省空間）
  function matChips() {
    const mats = state.materials || {};
    return Object.keys(window.MATERIALS).filter((k) => (mats[k] || 0) > 0)
      .map((k) => `<div class="res mat" title="${window.MATERIALS[k].name}"><span class="ic">${window.MATERIALS[k].emoji}</span> ${mats[k]}</div>`).join("");
  }

  // ---------- 種子選擇 ----------
  function renderSeeds() {
    const row = $("seedRow"); row.innerHTML = "";
    Object.values(window.CROPS).forEach((c) => {
      const unlocked = c.unlockLevel <= state.level;
      const el = document.createElement("div");
      el.className = "seed" + (selectedSeed === c.id && unlocked ? " sel" : "") + (unlocked ? "" : " locked");
      el.innerHTML = unlocked
        ? `<span class="se">${c.emoji}</span><span class="sn">${c.name}</span><span class="sc">🪙${c.seedCost}</span>`
        : `<span class="se">🔒</span><span class="sn">${c.name}</span><span class="sc">Lv${c.unlockLevel}</span>`;
      if (unlocked) el.onclick = () => { selectedSeed = c.id; state.selectedSeed = c.id; renderSeeds(); };
      row.appendChild(el);
    });
  }

  // ---------- 側欄分頁 ----------
  function switchTab(name) {
    document.querySelectorAll(".side-tab").forEach((b) => b.classList.toggle("sel", b.dataset.tab === name));
    document.querySelectorAll(".side-pane").forEach((p) => p.classList.toggle("sel", p.dataset.pane === name));
  }
  function setupSideTabs() {
    document.querySelectorAll(".side-tab").forEach((b) => { b.onclick = () => switchTab(b.dataset.tab); });
  }

  // ---------- 工具列（roadmap：工具模式）----------
  function currentTool() { return (state.interaction && state.interaction.tool) || "hand"; }
  function setTool(t) { state.interaction.tool = t; renderToolbar(); $("farmHint").textContent = window.TOOLS[t].icon + " " + window.TOOLS[t].desc; scheduleSave(); }
  function renderToolbar() {
    const bar = $("toolBar"); if (!bar) return; bar.innerHTML = "";
    window.TOOL_ORDER.forEach((id) => {
      const t = window.TOOLS[id];
      const el = document.createElement("div");
      el.className = "tool" + (currentTool() === id ? " sel" : "");
      el.title = t.desc;
      el.innerHTML = `<span class="ti">${t.icon}</span><span class="tn">${t.name}</span>`;
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
        sprite.style.display = emoji.style.display = bar.style.display = timer.style.display = readyTag.style.display = "none";
        continue;
      }
      const crop = window.CROPS[plot.cropId];
      const prog = G.getCropProgress(state, plot, t);
      el.className = "plot" + (prog.ready ? " ready" : " growing") + (prog.wet && !prog.ready ? " wet" : "");
      // 濕土水滴標記
      let wd = el.querySelector(".wet-drop");
      if (prog.wet && !prog.ready) { if (!wd) { wd = document.createElement("div"); wd.className = "wet-drop"; wd.textContent = "💧"; el.appendChild(wd); } wd.style.display = "block"; }
      else if (wd) wd.style.display = "none";

      if (state.useSprites && spritesReady) {
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
      if (r.ok) { playAction("water"); floatText(cx, cy, "💧", "#bfe6f7"); afterChange(false); }
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
      afterChange(true);
    } else {
      const prog = G.getCropProgress(state, plot, t);
      if (!prog.ready) { toast("⏳ 還要 " + fmtTime(prog.remainingMs)); return; }
      const crop = window.CROPS[plot.cropId];
      const r = G.harvest(state, i, t);
      if (r.ok) {
        playAction("harvest");
        floatText(cx, cy, "+" + r.added + " " + crop.emoji, "#dff5c8");
        if (r.lost > 0) toast("📦 倉庫滿了，損失 " + r.lost + " " + crop.name);
        if (r.leveled > 0) toast("🎉 升到 Lv " + state.level + "！");
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
    state.orders.forEach((o) => {
      const rarity = window.ORDER_RARITY[o.rarity];
      const pay = G.orderPayout(state, o);
      const can = G.canFulfill(state, o);
      const wantsHtml = Object.entries(o.wants).map(([cid, q]) => {
        const have = state.storage.items[cid] || 0;
        const ok = have >= q;
        return `<span class="w ${ok ? "have" : "miss"}">${itemEmoji(cid)}${have}/${q}</span>`;
      }).join("");
      const el = document.createElement("div");
      el.className = "order";
      el.innerHTML = `
        <div class="o-rarity" style="background:${rarity.color}"></div>
        <div class="o-body">
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
        if (r.ok) { toast("📜 訂單完成！+" + fmtNum(r.coins) + " 🪙" + (r.streakMul > 1 ? " (×" + r.streakMul.toFixed(2) + ")" : "")); afterChange(true); renderOrders(); }
        else toast("作物不足，無法交付");
      };
      el.querySelector(".trash").onclick = () => {
        G.trashOrder(state, o.id, now()); toast("🗑️ 已丟棄（連單中斷）"); afterChange(true); renderOrders();
      };
      box.appendChild(el);
    });
    lastOrderSig = orderSig();
  }

  // ---------- 升級 ----------
  function renderUpgrades() {
    const box = $("upgrades"); box.innerHTML = "";
    window.UPGRADE_ORDER.forEach((key) => {
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
            toast(def.icon + " " + def.name + " → Lv " + r.level);
            if (key === "plotCount") buildFarm();
            afterChange(true); renderUpgrades(); renderSeeds();
          } else if (r.reason === "no_coins") toast("🪙 金幣不足");
        };
      }
      box.appendChild(el);
    });
  }

  // ====================================================================
  // 地圖 / 障礙 / 建築 / 動物 UI
  // ====================================================================
  // v2 frame 對應
  const STAGE_NAME = ["seed", "sprout", "young", "mature", "ready"];
  const BUILDING_FRAME = { chickenCoop: "chicken_coop", barn: "barn", beeBox: "bee_box", silo: "silo", compostHeap: "compost_heap",
    orderBoard: "order_board", mailbox: "mailbox", well: "well", storage: "storage_crate", farmhouse: "farmhouse" };
  const ANIMAL_FRAME = { chicken: "chicken", cow: "cow", sheep: "sheep", bee: "bee" };
  // 建立統一地圖場景（磚 + 持久子層 + 玩家），磚 DOM 快取於 tileEls
  function buildMap() {
    const grid = $("mapScene"); if (!grid) return;
    grid.innerHTML = ""; tileEls.length = 0;
    grid.style.gridTemplateColumns = "repeat(" + state.map.width + ", 1fr)";
    state.map.tiles.forEach((tile) => {
      const el = document.createElement("div");
      el.className = "tile " + tile.terrain;
      el.dataset.tileId = tile.id;
      // 持久子層：地形上的物件 sprite + 狀態
      el.innerHTML = `<div class="t-obj"></div><div class="t-bar"><i></i></div><div class="t-dot"></div><div class="t-wet">💧</div>`;
      el.addEventListener("click", () => handleMapClick(tile.id));
      grid.appendChild(el);
      tileEls.push({ el, tileId: tile.id, obj: el.querySelector(".t-obj"), bar: el.querySelector(".t-bar"),
        barFill: el.querySelector(".t-bar > i"), dot: el.querySelector(".t-dot"), wet: el.querySelector(".t-wet") });
    });
    document.documentElement.style.setProperty("--move-ms", window.MOVE_MS + "ms");
    updateMap(now());
    positionPlayer(false);
  }
  // 地形 → v2 terrain frame
  function terrainFrame(tile, prog) {
    if (tile.terrain === "soil") {
      if (prog && prog.wet && !prog.ready) return "soil_wet";
      if (prog) return "soil_seeded";
      return "soil_dry";
    }
    if (tile.terrain === "water") return "water_center";
    if (tile.terrain === "path") return "path_center";
    // grass：依座標小變化
    const v = (tile.x * 3 + tile.y * 7) % 5;
    return v === 0 ? "grass_flower_01" : v === 1 ? "grass_02" : v === 4 ? "grass_tall" : "grass_01";
  }
  function buildingEmoji(tile) {
    const b = state.buildings.find((x) => x.id === tile.buildingId); const def = b && window.BUILDINGS[b.type];
    return def ? def.emoji : "🏠";
  }
  // 設定物件 sprite 層：優先 v2 atlas frame，未就緒退 emoji
  function setObjSprite(cell, sheet, frameId, emojiFallback) {
    const o = cell.obj;
    if (atlasReady && window.Atlas.applyTo(o, sheet, frameId)) { o.classList.add("spr"); o.textContent = ""; }
    else { o.classList.remove("spr"); o.style.backgroundImage = "none"; o.textContent = emojiFallback || ""; }
  }
  function clearObjSprite(cell) { const o = cell.obj; o.classList.remove("spr"); o.style.backgroundImage = "none"; o.textContent = ""; }
  // 渲染所有地圖磚（地形/作物/障礙/建築/動物/狀態，皆 v2 sprite）+ 定位玩家
  function updateMap(t) {
    if (!state.map || tileEls.length === 0) return;
    const active = G.activePlotCount(state);
    for (const cell of tileEls) {
      const { el } = cell;
      const tile = state.map.tiles.find((x) => x.id === cell.tileId);
      const plot = tile.plotIndex != null ? state.plots[tile.plotIndex] : null;
      const prog = plot && plot.cropId ? G.getCropProgress(state, plot, t) : null;
      const locked = tile.plotIndex != null && tile.plotIndex >= active;

      // 地形背景（atlas，否則 CSS class fallback）
      let cls = "tile " + tile.terrain;
      if (tile.object) cls += " has-object";
      if (tile.buildingId) cls += " has-building";
      if (cell.tileId === selectedTileId) cls += " sel";
      if (locked) cls += " locked";
      if (prog && prog.wet && !prog.ready) cls += " wet";
      el.className = cls;
      if (atlasReady) window.Atlas.applyTo(el, "terrain", terrainFrame(tile, prog));

      // 物件層 + 狀態
      let ready = false;
      cell.bar.style.display = "none"; cell.dot.style.display = "none"; cell.wet.style.display = "none";
      if (tile.buildingId) {
        const home = state.buildings.find((b) => b.id === tile.buildingId);
        const frame = BUILDING_FRAME[home ? home.type : ""] || "farmhouse";
        setObjSprite(cell, "buildings", frame, window.BUILDINGS[home && home.type] ? window.BUILDINGS[home.type].emoji : "🏠");
        if (home) ready = G.animalsInHome(state, home.id).some((a) => G.animalProgress(state, a, t).ready);
        // 動物 sprite（疊在建築上緣，成熟換 product_ready）
        if (home) { const an = G.animalsInHome(state, home.id)[0]; if (an) { /* 動物層由 updateAnimals 負責 */ } }
      } else if (tile.object) {
        setObjSprite(cell, "buildings", tile.object, window.OBSTACLES[tile.object].emoji);
      } else if (plot && plot.cropId) {
        const frame = plot.cropId + "_" + STAGE_NAME[prog.stage];
        setObjSprite(cell, "crops", frame, prog.stage <= 1 ? "🌱" : window.CROPS[plot.cropId].emoji);
      } else {
        clearObjSprite(cell);
      }
      // 狀態：成熟亮點 / 成長條 / 濕土
      if (ready || (prog && prog.ready)) { cell.dot.style.display = "block"; }
      else if (prog) { cell.bar.style.display = "block"; cell.barFill.style.width = (prog.ratio * 100).toFixed(0) + "%"; if (prog.wet) cell.wet.style.display = "block"; }
    }
    updateAnimals(t);
    positionPlayer(true);
  }
  // 動物 sprite 疊層（在 home 磚附近顯示一隻，成熟時 product_ready）
  function updateAnimals(t) {
    const layer = $("animalLayer"); if (!layer) return;
    layer.innerHTML = "";
    if (!atlasReady) return;
    for (const home of state.buildings) {
      const animals = G.animalsInHome(state, home.id); if (!animals.length) continue;
      const cell = tileEls.find((c) => { const tl = state.map.tiles.find((x) => x.id === c.tileId); return tl.buildingId === home.id; });
      if (!cell) continue;
      const a = animals[0]; const ready = G.animalProgress(state, a, t).ready;
      const sp = document.createElement("div"); sp.className = "map-animal";
      const size = cell.el.offsetWidth * 0.7;
      const st = window.Atlas.frameStyleFor("animals", ANIMAL_FRAME[a.type] + "_" + (ready ? "product_ready" : "idle_a"), size, size);
      if (st) { Object.assign(sp.style, st); sp.style.width = size + "px"; sp.style.height = size + "px";
        sp.style.left = (cell.el.offsetLeft + cell.el.offsetWidth * 0.55) + "px"; sp.style.top = (cell.el.offsetTop + cell.el.offsetWidth * 0.45) + "px"; layer.appendChild(sp); }
    }
  }

  // ---------- 玩家定位 / 移動 ----------
  function tileElOf(tileId) { const r = tileEls.find((x) => x.tileId === tileId); return r ? r.el : null; }
  function positionPlayer(animate) {
    const pl = $("player"); if (!pl) return;
    const el = tileElOf(state.player.tileId); if (!el) return;
    const size = el.offsetWidth * 1.45;
    pl.style.width = size + "px"; pl.style.height = size + "px";
    if (!animate) pl.style.transition = "none"; else pl.style.transition = "";
    pl.style.left = (el.offsetLeft + el.offsetWidth / 2) + "px";
    pl.style.top = (el.offsetTop + el.offsetWidth / 2) + "px";
    if (!animate) { void pl.offsetWidth; pl.style.transition = ""; }
  }
  function walkPath(path, onArrive) {
    if (moveTimer) { clearTimeout(moveTimer); moveTimer = null; }
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
  // 點地圖磚：依工具決定移動或動作
  function handleMapClick(tileId) {
    selectedTileId = tileId; state.interaction.selectedTileId = tileId;
    const tile = G.getTileById(state, tileId);
    const tool = currentTool();
    renderTileContext();
    switchTab("tile"); // 點磚自動顯示磚資訊分頁
    if (tool === "inspect") { updateMap(now()); inspectTile(tile); return; }

    const act = actionTargetFor(tool, tile);
    if (act.invalid) { toast(act.invalid); state.interaction.lastInvalidReason = act.invalid; updateMap(now()); return; }
    if (act.action) { moveAndAct(tileId, act.action); updateMap(now()); return; }
    // 無動作：若可走就走過去
    if (G.isWalkable(state, tile)) {
      const path = G.bfsPath(state, state.player.tileId, tileId);
      if (path) walkPath(path); else toast("走不到那裡");
    } else {
      toast(blockedReason(tile));
    }
    updateMap(now());
  }
  function blockedReason(tile) {
    if (tile.terrain === "water") return "🌊 水域擋路（需架橋）";
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
    } else if (tile.object) { const o = window.OBSTACLES[tile.object]; toast(`${o.emoji}${o.name}・${o.desc}`); }
    else if (tile.buildingId) { const b = state.buildings.find((x) => x.id === tile.buildingId); toast(window.BUILDINGS[b.type].emoji + window.BUILDINGS[b.type].name); }
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
    if (action === "plant") {
      const r = G.plant(state, tile.plotIndex, selectedSeed, t);
      if (r.ok) { playAction("sow"); afterChange(true); }
      else toast(r.reason === "no_coins" ? "🪙 金幣不足" : r.reason === "locked_crop" ? "🔒 作物未解鎖" : "無法種植");
    } else if (action === "harvest") {
      const r = G.harvest(state, tile.plotIndex, t);
      if (r.ok) { playAction("harvest"); const crop = window.CROPS[r.cropId];
        toast("🧺 收成 " + r.added + " " + crop.name); if (r.lost) toast("📦 倉滿損失 " + r.lost); if (r.leveled) toast("🎉 升 Lv " + state.level); afterChange(true); }
    } else if (action === "water") {
      const r = G.waterPlot(state, tile.plotIndex, t);
      if (r.ok) { playAction("water"); toast("💧 澆水變濕土加速"); afterChange(false); }
    } else if (action === "clear") {
      const r = G.clearObstacle(state, tileId);
      if (r.ok) { playAction("hoe"); toast("⛏️ 清除 " + window.OBSTACLES[r.cleared].name + "，得建材"); afterChange(true); buildMap(); renderTileContext(); }
      else if (r.reason === "no_coins") toast("🪙 金幣不足");
    } else if (action === "build") {
      playAction("hoe"); renderTileContext(); // 顯示建築選單（玩家已走到旁邊）
      toast("🏗️ 選一個建築蓋在這裡");
    } else if (action === "collect") {
      const b = state.buildings.find((x) => x.id === tile.buildingId);
      if (b) { const r = G.collectAllAnimals(state, t); // 收這家（簡化：收全部成熟）
        if (r.total > 0) { playAction("carry"); toast("🧺 收集 " + r.total + " 份產物"); afterChange(true); }
        else toast("還沒有可收集的產物"); renderTileContext(); }
    }
    updateMap(now());
  }
  function renderTileContext() {
    const box = $("tileContext"); if (!box) return;
    if (!selectedTileId) { box.innerHTML = `<div class="tc-empty">點一個地圖磚查看資訊與動作</div>`; return; }
    const tile = state.map.tiles.find((x) => x.id === selectedTileId);
    const terr = window.TERRAIN[tile.terrain];

    // 1) 有建築 → 建築/動物管理
    if (tile.buildingId) { renderBuildingContext(box, tile); return; }
    // 2) 有障礙 → 清除
    if (tile.object) {
      const ob = window.OBSTACLES[tile.object];
      const canClear = state.coins >= ob.clearCost;
      const grantsTxt = Object.entries(ob.grants).map(([k, v]) => `+${v}${window.MATERIALS[k].emoji}`).join(" ");
      box.innerHTML = `
        <div class="tc-title">${ob.emoji} ${ob.name}</div>
        <div class="tc-desc">${ob.desc}。清除後變草地可興建。</div>
        <div class="tc-actions">
          <button class="btn buy small" id="clearBtn" ${canClear ? "" : "disabled"}>清除（🪙${ob.clearCost} → ${grantsTxt}）</button>
        </div>`;
      $("clearBtn").onclick = () => {
        const r = G.clearObstacle(state, tile.id);
        if (r.ok) { playAction("hoe"); toast("⛏️ 已清除，獲得建材"); afterChange(true); renderTileContext(); }
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
      const costTxt = Object.entries(def.cost).map(([k, v]) => k === "coins" ? `🪙${v}` : `${v}${window.MATERIALS[k].emoji}`).join(" ");
      return `
        <div class="build-opt ${unlocked && afford ? "" : "locked"}">
          <span class="bo-ic">${def.emoji}</span>
          <span class="bo-body"><span class="bo-name">${def.name}</span><br>
            <span class="bo-cost">${def.desc} · ${costTxt}${unlocked ? "" : " · 🔒Lv" + def.unlockLevel}</span></span>
          <button class="btn buy small bbtn" data-type="${type}" ${unlocked && afford ? "" : "disabled"}>蓋</button>
        </div>`;
    }).join("");
    box.innerHTML = `<div class="tc-title">🟩 ${window.TERRAIN.grass.name}</div>
      <div class="tc-desc">可興建建築（影響成長/倉容/解鎖動物）。</div>
      <div class="tc-actions">${opts}</div>`;
    box.querySelectorAll(".bbtn").forEach((b) => {
      b.onclick = () => {
        const r = G.buildBuilding(state, tile.id, b.dataset.type, now());
        if (r.ok) { playAction("hoe"); toast(window.BUILDINGS[b.dataset.type].emoji + " 已興建 " + window.BUILDINGS[b.dataset.type].name); afterChange(true); buildMap(); renderTileContext(); }
        else if (r.reason === "cost") toast("資源不足");
        else if (r.reason === "locked") toast("🔒 等級不足");
      };
    });
  }
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
        html += `
          <div class="animal-row">
            <span class="a-ic">${adef.emoji}</span>
            <span class="a-body"><b>${adef.name}</b> → ${itemEmoji(adef.product)}${adef.name === "蜜蜂" ? "" : ""}
              <div class="a-prog"><div class="a-fill" style="width:${(prog.ratio * 100).toFixed(0)}%"></div></div>
              <span class="bo-cost">${prog.ready ? "✅ 可收集" : "⏳ " + fmtTime(prog.remainingMs)}</span></span>
            <span style="display:flex;flex-direction:column;gap:4px">
              <button class="btn buy small acol" data-id="${a.id}" ${prog.ready ? "" : "disabled"}>收集</button>
              <button class="btn ghost small afeed" data-id="${a.id}">餵食</button>
            </span>
          </div>`;
      });
      // 買動物
      const animalType = def.effect.unlockAnimal[0];
      if (animals.length < cap) {
        const adef = window.ANIMALS[animalType];
        html += `<button class="btn buy small abuy" data-bid="${b.id}" data-type="${animalType}">＋ 買一隻${adef.name}（🪙${adef.cost}）</button>`;
      } else {
        html += `<div class="bo-cost">已達容量上限 ${cap} 隻</div>`;
      }
      html += `</div>`;
    }
    box.innerHTML = html;
    box.querySelectorAll(".acol").forEach((btn) => btn.onclick = () => {
      const r = G.collectAnimal(state, btn.dataset.id, now());
      if (r.ok) { playAction("carry"); toast("🧺 收集 " + r.added + " " + itemName(r.product)); afterChange(true); renderTileContext(); updateMap(now()); }
    });
    box.querySelectorAll(".afeed").forEach((btn) => btn.onclick = () => {
      const r = G.feedAnimal(state, btn.dataset.id, now());
      if (r.ok) { playAction("sow"); toast("🌾 餵食 → +1 " + itemName(r.product)); afterChange(true); renderTileContext(); }
      else toast("飼料不足（需作物）");
    });
    box.querySelectorAll(".abuy").forEach((btn) => btn.onclick = () => {
      const r = G.buyAnimal(state, btn.dataset.bid, btn.dataset.type, now());
      if (r.ok) { toast("🐣 新動物入住！"); afterChange(true); renderTileContext(); }
      else if (r.reason === "no_coins") toast("🪙 金幣不足");
      else if (r.reason === "full") toast("已達容量上限");
    });
  }

  // ====================================================================
  // 玩家 Miri：走路(walk-cycle 4列×4幀) + 動作(farm-actions 6列×4幀)
  // ====================================================================
  const ACTION_ROW = { idle: 0, hoe: 1, water: 2, sow: 3, harvest: 4, carry: 5 };
  const WALK_COL = ["idle", "stepa", "idle2", "stepb"], ACT_COL = ["anticipation", "action", "contact", "recovery"];
  const player = { frame: 0, fps: 6, oneShot: false, actionRow: 0, actionName: "idle", acc: 0, last: 0 };
  // 畫玩家某 frame：優先 v2 atlas（整數 frame），未就緒退舊 CSS-var 百分比
  function paintPlayer(which, rowName, rowIdx, frame) {
    const sp = $("playerSprite"); if (!sp) return;
    const size = ($("player").offsetWidth) || 64;
    if (atlasReady) {
      const sheet = which === "walk" ? "walk" : "actions";
      const frameId = which === "walk" ? rowName + "_" + WALK_COL[frame] : rowName + "_" + ACT_COL[frame];
      const stl = window.Atlas.frameStyleFor(sheet, frameId, size, size);
      if (stl) { sp.style.backgroundImage = stl.backgroundImage; sp.style.backgroundSize = stl.backgroundSize; sp.style.backgroundPosition = stl.backgroundPosition; return; }
    }
    // fallback：舊 cutout sheet（百分比）
    if (which === "walk") { sp.style.backgroundImage = "var(--walk-sheet)"; sp.style.backgroundSize = "400% 400%"; sp.style.backgroundPosition = (frame / 3 * 100) + "% " + (rowIdx / 3 * 100) + "%"; }
    else { sp.style.backgroundImage = "var(--actions-sheet)"; sp.style.backgroundSize = "400% 600%"; sp.style.backgroundPosition = (frame / 3 * 100) + "% " + (rowIdx / 5 * 100) + "%"; }
  }
  function setPlayerIdle() { state.player.action = "idle"; }
  const ACTION_NAME = { hoe: "hoe", water: "water", sow: "sow", harvest: "harvest", carry: "carry" };
  function playAction(type) {
    const row = ACTION_ROW[type]; if (row == null) return;
    state.player.action = type; player.actionRow = row; player.actionName = ACTION_NAME[type] || "idle"; player.frame = 0; player.oneShot = true;
    player.fps = type === "carry" ? 5 : 6; player.acc = 0;
  }
  function tickPlayer(t) {
    if (!player.last) player.last = t;
    const dt = (t - player.last) / 1000; player.last = t;
    const action = state.player.action;
    if (action === "walk") {
      player.fps = 8; player.acc += dt; const step = 1 / player.fps;
      while (player.acc >= step) { player.acc -= step; player.frame = (player.frame + 1) % 4; }
      paintPlayer("walk", state.player.facing, window.FACING_ROW[state.player.facing] || 0, player.frame);
      return;
    }
    if (player.oneShot) {
      player.acc += dt; const step = 1 / player.fps;
      while (player.acc >= step) {
        player.acc -= step; player.frame++;
        if (player.frame > 3) { player.frame = 0; player.oneShot = false; state.player.action = "idle"; }
      }
      paintPlayer("actions", player.oneShot ? player.actionName : "idle", player.oneShot ? player.actionRow : 0, player.frame);
      return;
    }
    paintPlayer("actions", "idle", 0, 0); // 待機
  }
  // 鍵盤一次走一格（WASD / 方向鍵）
  function onKeyMove(e) {
    const dirMap = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down",
                     ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
    const dir = dirMap[e.key]; if (!dir) return;
    e.preventDefault();
    const dd = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    state.player.facing = dir;
    const nt = G.getTileXY(state, state.player.x + dd[0], state.player.y + dd[1]);
    if (nt && G.isWalkable(state, nt)) walkPath([nt.id]);
    else { player.frame = 0; paintPlayer("walk", dir, window.FACING_ROW[dir], 0); } // 撞牆只轉向
  }

  // ---------- 統一刷新 ----------
  function afterChange(rerenderPanels) {
    renderResBar(); renderSeeds(); updateFarm(now());
    if (rerenderPanels) { renderUpgrades(); updateMap(now()); }
    scheduleSave();
  }

  // ---------- 離線摘要 ----------
  function showOfflineSummary(summary) {
    if (summary.offlineMs < 30000) return false; // 離線 <30s 不打擾
    const lines = [];
    lines.push(`<div class="ml">離開時間 <span class="v">${fmtTime(summary.offlineMs)}</span></div>`);
    const crops = Object.entries(summary.perCrop);
    if (crops.length) {
      crops.forEach(([cid, n]) => lines.push(`<div class="ml">${window.CROPS[cid].emoji} ${window.CROPS[cid].name} 自動收成 <span class="v">+${n}</span></div>`));
    }
    const products = Object.entries(summary.products || {});
    if (products.length) {
      products.forEach(([pid, n]) => lines.push(`<div class="ml">${itemEmoji(pid)} ${itemName(pid)} 動物產出 <span class="v">+${n}</span></div>`));
    }
    if (summary.replanted > 0) lines.push(`<div class="ml">🤖 幫手補種 <span class="v">${summary.replanted} 次</span></div>`);
    if (summary.readyPlots > 0) lines.push(`<div class="ml">🌾 已成熟待收 <span class="v">${summary.readyPlots} 格</span></div>`);
    if (summary.lost > 0) lines.push(`<div class="ml" style="color:var(--bad)">📦 倉滿損失 <span class="v">${summary.lost}</span></div>`);
    if (!crops.length && !products.length && !summary.readyPlots) lines.push(`<div class="ml">農場靜悄悄，沒有新進度</div>`);
    if (summary.cappedFromMs > 0) lines.push(`<div class="tip">（離線收益上限 8 小時，實際離開 ${fmtTime(summary.cappedFromMs)}）</div>`);
    $("offlineBody").innerHTML = lines.join("");
    $("offlineModal").classList.add("show");
    return true;
  }

  // ---------- 主迴圈 ----------
  function loop() {
    const t = now();
    G.updateWeather(state, t);
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
    if (helped.harvested > 0) { renderResBar(); }
    updateFarm(t);
    updateMap(t);       // 地圖：作物/動物成熟
    tickPlayer(t);      // 玩家走路/動作/待機動畫
  }

  // ---------- 初始化 ----------
  function init() {
    // 先載入存檔，state 必須在任何 render/onload 前就緒
    state = window.load() || window.defaultState(now());
    selectedSeed = state.selectedSeed && window.CROPS[state.selectedSeed] ? state.selectedSeed : "wheat";

    document.documentElement.style.setProperty("--crop-sheet", `url(${ASSETS.crops})`);
    // 預載 crop sheet 判斷可用性（onload 可能同步觸發，故 state 須先就緒）
    const img = new Image();
    img.onload = () => { spritesReady = true; if (state) updateFarm(now()); };
    img.onerror = () => { spritesReady = false; if (state) updateFarm(now()); };
    img.src = ASSETS.crops;

    // 角色雙 sheet：動作圖 + 走路圖（優先去背 cutout，404 退原圖）
    const setSheetVar = (varName, cutout, raw) => {
      document.documentElement.style.setProperty(varName, `url(${cutout})`);
      const im = new Image();
      im.onerror = () => document.documentElement.style.setProperty(varName, `url(${raw})`);
      im.src = cutout;
    };
    setSheetVar("--actions-sheet", ASSETS.actions, ASSETS.actionsRaw);
    setSheetVar("--walk-sheet", ASSETS.walk, ASSETS.walkRaw);
    paintPlayer("actions", "idle", 0, 0);

    // v2 atlas：載入後改用整數 frame 渲染地圖/角色（主地圖無 emoji）
    if (window.Atlas) {
      window.Atlas.load();
      window.Atlas.ready().then((ok) => {
        atlasReady = !!ok;
        if (atlasReady && state) { buildMap(); updateMap(now()); positionPlayer(false); }
      });
    }

    // 離線結算（在 refreshOrders 前）
    const summary = G.applyOffline(state, now());
    G.refreshOrders(state, now());
    G.updateWeather(state, now());

    buildFarm(); buildMap();
    renderToolbar(); renderResBar(); renderSeeds(); renderOrders(); renderUpgrades(); updateFarm(now()); renderTileContext();
    positionPlayer(false);
    // 視窗縮放：重新定位玩家
    window.addEventListener("resize", () => { updateMap(now()); positionPlayer(false); });
    // 鍵盤 WASD/方向鍵：一次走一格
    document.addEventListener("keydown", onKeyMove);

    // sprite 切換鈕初始文字
    $("spriteToggle").textContent = state.useSprites ? "🎨 像素圖" : "🔤 Emoji";

    // 首次玩顯示引導；否則顯示離線摘要
    let shownModal = false;
    if (!state.stats || state.stats.plantCount === 0) {
      if ((state.coins === window.GAME.startCoins) && Object.keys(state.stats.harvested).length === 0) {
        $("howToModal").classList.add("show"); shownModal = true;
      }
    }
    if (!shownModal) showOfflineSummary(summary);

    window.save(state);
    setInterval(loop, window.GAME.tickMs);
    setInterval(() => window.save(state), window.GAME.autosaveMs);
    window.addEventListener("beforeunload", () => { state.lastSeenAt = now(); window.save(state); });

    bindToolbar();
    setupSideTabs();

    // 測試/除錯掛鉤
    window.__farm = {
      state: () => state,
      player: () => player,
      playerTileId: () => state.player.tileId,
      playerAction: () => state.player.action,
      refresh: () => { renderToolbar(); renderResBar(); renderSeeds(); renderOrders(); renderUpgrades(); buildMap(); updateFarm(now()); renderTileContext(); },
      clickTile: (id) => handleMapClick(id),
      setTool: (t) => setTool(t),
      moving: () => !!moveTimer,
    };
  }

  function bindToolbar() {
    $("harvestAllBtn").onclick = () => {
      const r = G.harvestAll(state, now());
      if (r.totalAdded > 0) { toast("🧺 收成 " + r.totalAdded + " 個作物"); if (r.totalLost) toast("📦 倉滿損失 " + r.totalLost); afterChange(true); }
      else toast("沒有成熟的作物");
    };
    $("sellAllBtn").onclick = () => {
      const r = G.sellAll(state, now());
      if (r.coins > 0) { playAction("carry"); toast("🪙 賣出 " + r.qty + " 個，得 " + fmtNum(r.coins) + " 金"); afterChange(true); renderOrders(); }
      else toast("倉庫沒有可賣的作物");
    };
    // 澆水（全部）：對所有可澆的乾土作物澆水變濕土加速（綁角色澆水動畫）
    $("waterAllBtn").onclick = () => {
      const t = now(); let n = 0;
      for (let i = 0; i < G.activePlotCount(state); i++) {
        if (G.waterPlot(state, i, t).ok) n++;
      }
      playAction("water");
      toast(n > 0 ? "💧 澆水 " + n + " 格，變濕土加速成長" : "沒有需要澆水的作物");
      if (n > 0) afterChange(false);
    };
    // 收集全部動物產物
    $("collectAllBtn").onclick = () => {
      const r = G.collectAllAnimals(state, now());
      if (r.total > 0) { playAction("carry"); toast("🧺 收集 " + r.total + " 份產物"); afterChange(true); renderTileContext(); updateMap(now()); }
      else toast("目前沒有可收集的產物");
    };
    $("spriteToggle").onclick = () => {
      state.useSprites = !state.useSprites;
      $("spriteToggle").textContent = state.useSprites ? "🎨 像素圖" : "🔤 Emoji";
      updateFarm(now()); scheduleSave();
    };
    $("howToBtn").onclick = () => $("howToModal").classList.add("show");
    $("howToOk").onclick = () => $("howToModal").classList.remove("show");
    $("offlineOk").onclick = () => $("offlineModal").classList.remove("show");
    $("resetBtn").onclick = () => {
      if (confirm("確定重置存檔？所有進度會消失。")) {
        window.reset(); state = window.defaultState(now());
        selectedSeed = "wheat"; selectedTileId = null; buildFarm(); buildMap();
        renderToolbar(); renderResBar(); renderSeeds(); renderOrders(); renderUpgrades(); updateFarm(now()); renderTileContext();
        G.refreshOrders(state, now()); renderOrders();
        window.save(state); toast("🗑️ 已重置");
      }
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
