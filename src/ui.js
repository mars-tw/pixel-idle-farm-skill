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
  let lastAssistantSig = "";
  let saveTimer = null;
  let selectedTileId = null;
  let moveTimer = null;
  let atlasReady = false;
  let journalDetailSelection = null;
  const plotEls = []; // 農地格 DOM 快取
  const tileEls = []; // 地圖磚 DOM 快取

  const $ = (id) => document.getElementById(id);
  const now = () => Date.now();
  const escapeHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));

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
    if (name === "story") renderStory();
    if (name === "journal") renderJournal();
  }
  function setupSideTabs() {
    document.querySelectorAll(".side-tab").forEach((b) => { b.onclick = () => switchTab(b.dataset.tab); });
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
    b.textContent = state.gender === "m" ? "👦 主角" : "👧 主角";
  }

  // ---------- 工具列（roadmap：工具模式）----------
  function currentTool() { return (state.interaction && state.interaction.tool) || "hand"; }
  function setTool(t) { state.interaction.tool = t; renderToolbar(); renderQuestDock(); $("farmHint").textContent = window.TOOLS[t].icon + " " + window.TOOLS[t].desc; scheduleSave(); }
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
      const narrative = G.orderNarrative ? G.orderNarrative(state, o) : null;
      const wantsHtml = Object.entries(o.wants).map(([cid, q]) => {
        const have = state.storage.items[cid] || 0;
        const ok = have >= q;
        return `<span class="w ${ok ? "have" : "miss"}">${itemEmoji(cid)}${have}/${q}</span>`;
      }).join("");
      const el = document.createElement("div");
      el.className = "order";
      if (narrative) el.dataset.npc = narrative.npcId;
      el.innerHTML = `
        <div class="o-rarity" style="background:${rarity.color}"></div>
        <div class="o-body">
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
        if (r.ok) { G.advanceStory(state, "deliver"); toast((narrative ? narrative.npcName + "：「" + narrative.thanks + "」 +" : "📜 訂單完成！+") + fmtNum(r.coins) + " 🪙" + (r.streakMul > 1 ? " (×" + r.streakMul.toFixed(2) + ")" : "")); afterChange(true); renderOrders(); }
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

  // ---------- 故事 / 任務（地圖驅動：state.story 任務鏈）----------
  // 第一章＝序章 6 關（主完成度面板 0/6→6/6）；第二章＝Stage 5 探索 2 關；第三章＝Stage 7 動物照護 5 關，各自另計。
  const QUEST_ORDER = ["intro_reopen_farm", "plant_wheat", "first_water", "first_harvest", "first_delivery", "clear_old_path"];
  const CHAPTER2_ORDER = (typeof window !== "undefined" && window.CHAPTER2_QUESTS) || ["repair_bridge", "explore_new_area"];
  const CHAPTER3_ORDER = (typeof window !== "undefined" && window.CHAPTER3_QUESTS) ||
    ["learn_animal_care", "feed_care_animal", "raise_affinity_happy", "collect_quality_product", "deliver_quality_order"];
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
    if (id === "raise_affinity_happy") return { done: (state.animals || []).some((a) => G.animalAffinity(state, a, now()) >= window.AFFINITY_HAPPY_THRESHOLD) ? 1 : 0, total: 1 };
    if (id === "collect_quality_product") return { done: G.hasCollectedQuality(state) ? 1 : 0, total: 1 };
    if (id === "deliver_quality_order") return { done: (state.stats && state.stats.qualitySold || 0) > 0 ? 1 : 0, total: 1 };
    return { done: 0, total: 1 };
  }
  function questRow(id, completed, cur) {
    const q = window.QUESTS[id]; const done = !!completed[id]; const active = cur && cur.id === id;
    const step = questStepProgress(id, completed);
    return `<div class="quest ${done ? "done" : ""} ${active ? "active" : ""}">
      <span class="qmark">${done ? "✓" : active ? "➤" : "□"}</span>
      <span class="qtext"><span>${q.title}</span><em>${step.done}/${step.total}</em></span></div>`;
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
    return "主動作：" + cur.desc;
  }
  function renderQuestDock() {
    const box = $("questDock"); if (!box) return;
    if (G.syncStoryProgress) G.syncStoryProgress(state);
    const cur = G.currentQuest(state);
    const targetId = G.questMarkerTile ? G.questMarkerTile(state, now()) : null;
    const title = cur ? cur.title : "自由經營";
    const action = questActionText(cur);
    box.dataset.quest = cur ? cur.id : "free";
    box.dataset.targetId = targetId || "";
    box.innerHTML = `<div class="qd-body">
        <div class="qd-title"><span>📍</span><span>${title}</span></div>
        <div class="qd-action">${action}</div>
        ${cur && cur.id === "repair_bridge" ? bridgeMaterialRowsHtml(true) : ""}
        ${cur && (cur.id === "collect_east_forage") ? forageRowsHtml(true) : ""}
      </div>
      <button class="qd-meta qd-go" data-audit="quest-dock-go" ${targetId ? "" : "disabled"}>${targetId ? "前往" : "探索"}</button>`;
    const go = box.querySelector(".qd-go");
    if (go && targetId) go.onclick = (ev) => { ev.stopPropagation(); focusCameraOnTile(targetId); };
  }
  function syncAssistantToggle() {
    const btn = $("assistantToggle"); if (!btn || !state) return;
    const on = !state.settings || state.settings.smartAssistant !== false;
    btn.textContent = on ? "助手" : "助手關";
    if (btn.setAttribute) btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  function renderSmartAssistant(force) {
    const box = $("smartAssistant"); if (!box || !state || !G.farmActionSuggestions) return;
    if (!state.settings) state.settings = { smartAssistant: true, smartAssistantCollapsed: false };
    const enabled = state.settings.smartAssistant !== false;
    syncAssistantToggle();
    if (!enabled) {
      box.className = "smart-assistant hidden";
      box.innerHTML = "";
      lastAssistantSig = "off";
      return;
    }
    const collapsed = !!state.settings.smartAssistantCollapsed;
    const suggestions = G.farmActionSuggestions(state, now(), { limit: 3 });
    const sig = [collapsed ? "c" : "o"].concat(suggestions.map((s) => [s.id, s.type, s.tileId, Math.round(s.valueScore || 0)].join(":"))).join("|");
    if (!force && sig === lastAssistantSig) return;
    lastAssistantSig = sig;
    box.className = "smart-assistant" + (collapsed ? " collapsed" : "");
    const rows = suggestions.length ? suggestions.map((s, idx) => `
      <div class="sa-row" data-audit="assistant-row" data-rank="${idx + 1}" data-suggestion-id="${escapeHtml(s.id)}" data-suggestion-type="${escapeHtml(s.type)}" data-target-id="${escapeHtml(s.tileId)}">
        <div>
          <div class="sa-title">${escapeHtml(s.title)}</div>
          <div class="sa-detail">${escapeHtml(s.detail || "")}</div>
        </div>
        <button class="sa-go" data-audit="assistant-go" data-target-id="${escapeHtml(s.tileId)}" data-suggestion-type="${escapeHtml(s.type)}">${escapeHtml(s.actionLabel || "前往")}</button>
      </div>`).join("")
      : `<div class="sa-row" data-audit="assistant-empty"><div><div class="sa-title">目前沒有急件</div><div class="sa-detail">可以整理倉庫、探索地圖或等待作物成熟。</div></div></div>`;
    box.innerHTML = `
      <div class="sa-head">
        <button class="sa-icon-btn" data-audit="assistant-collapse" title="${collapsed ? "展開" : "收合"}">${collapsed ? "▴" : "▾"}</button>
        <b>智慧農務助手</b>
        <button class="sa-icon-btn" data-audit="assistant-close" title="關閉">×</button>
      </div>
      <div class="sa-list">${rows}</div>`;
    const collapse = box.querySelector('[data-audit="assistant-collapse"]');
    if (collapse) collapse.onclick = (ev) => {
      ev.stopPropagation();
      state.settings.smartAssistantCollapsed = !state.settings.smartAssistantCollapsed;
      scheduleSave();
      renderSmartAssistant(true);
    };
    const close = box.querySelector('[data-audit="assistant-close"]');
    if (close) close.onclick = (ev) => {
      ev.stopPropagation();
      state.settings.smartAssistant = false;
      scheduleSave();
      renderSmartAssistant(true);
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
    const kicker = doneCount === 0 ? "序章" : ch2AllDone ? "第三章" : ch1Done ? "第二章" : "第一章";
    const title = cur ? cur.title : "陽光農場的新篇章";
    const copy = cur ? cur.desc
      : "阿軒割割陽光農場開源遊戲世界重新熱鬧了起來。東林已通，繼續開墾田地、迎接更多動物與市集訂單，讓這座農場成為玩家共創的 RPG 世界。";
    const quests = QUEST_ORDER.map((id) => questRow(id, completed, cur)).join("");
    // 第二章：序章 6/6 後才顯示，獨立完成度（不影響主面板 0/6 讀值）
    const ch2Html = ch1Done ? `
      <div class="chapter2">
        <div class="story-kicker">第二章 · 世界可探索</div>
        <div class="story-progress chapter2-progress" data-progress2="${ch2Done}/${CHAPTER2_ORDER.length}">
          <div class="story-progress-head"><span>探索完成度</span><b>${ch2Done}/${CHAPTER2_ORDER.length}</b></div>
          <div class="story-progress-track"><i style="width:${ch2Pct}%"></i></div>
        </div>
        <div class="quest-list">${CHAPTER2_ORDER.map((id) => questRow(id, completed, cur)).join("")}</div>
      </div>` : "";
    // 第三章：第二章 2/2 後才顯示，獨立完成度（Stage 7 動物照護）
    const ch3Html = ch2AllDone ? `
      <div class="chapter2 chapter3">
        <div class="story-kicker">第三章 · 動物照護</div>
        <div class="story-progress chapter3-progress" data-progress3="${ch3Done}/${CHAPTER3_ORDER.length}">
          <div class="story-progress-head"><span>照護完成度</span><b>${ch3Done}/${CHAPTER3_ORDER.length}</b></div>
          <div class="story-progress-track"><i style="width:${ch3Pct}%"></i></div>
        </div>
        <div class="quest-list">${CHAPTER3_ORDER.map((id) => questRow(id, completed, cur)).join("")}</div>
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
      ${cur ? `<div class="quest-hint">📍 ${cur.desc}　地圖上的 <b>金色箭頭</b> 會指向目標。${cur.id === "repair_bridge" ? bridgeMaterialRowsHtml(false) : ""}${cur.id === "collect_east_forage" ? forageRowsHtml(false) : ""}</div>` : ""}
      ${dialogueLogHtml()}
    </div>`;
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
        <div class="jd-row"><b>首次發現</b><span data-audit="journal-first-seen">${fmtDate(entry.firstDiscoveredAt)}</span></div>
      </div>`;
    };
    const cropRows = j.crops.map((c) => {
      if (!c.unlocked) return item(false, "🔒 未解鎖", "crop", c.id);
      if (!c.discovered) return item(false, "❔ 尚未發現", "crop", c.id);
      return item(true, `${c.emoji} ${c.name}`, "crop", c.id);
    }).join("");
    const productRows = j.products.map((p) =>
      item(p.discovered, p.discovered ? `${p.emoji} ${p.name}` : "❔ 尚未發現", "product", p.id)).join("");
    const forageRows = (j.forage || []).map((f) =>
      item(f.discovered, f.discovered ? `${f.emoji} ${f.name}${f.season ? "・" + f.season : ""}` : "◼ 未採集", "forage", f.id)).join("");
    const npcMetCount = j.npcs.filter((n) => n.met).length;
    const npcRows = j.npcs.map((n) => item(n.met,
      n.met ? `🧑 ${n.name}・${n.title}${n.requestsCompleted > 0 ? "・已完成 " + n.requestsCompleted + " 次委託" : ""}${n.sideQuest && n.sideQuest.completed ? "・支線完成" : ""}` : "❔ 尚未遇見", "npc", n.id)).join("");
    // discovered 要用 everGood||everHappy，不能只看 everHappy——不然「曾達良好」的文字
    // 顯示了，但 CSS class/data-discovered 卻標成 undiscovered，兩者互相矛盾
    const animalRows = j.animals.map((a) => item(a.everGood || a.everHappy,
      `${a.everHappy ? "💛" : a.everGood ? "🤍" : "⬜"} ${a.name}${a.everHappy ? "・曾達開心" : a.everGood ? "・曾達良好" : "・尚未達標"}`, "animal", a.id)).join("");
    const achRows = j.achievements.map((a) => item(a.unlocked,
      a.unlocked ? `${a.icon} ${a.name}` : "❔ 未解鎖成就", "achievement", a.id)).join("");
    const collectibleRows = (j.collectibles || []).map((c) => item(c.unlocked,
      c.unlocked ? `${c.emoji} ${c.name}` : "◼ 未取得收藏品", "collectible", c.id)).join("");
    const chapterLine = (label, ch) => ch.unlocked ? `<div>${label} ${ch.done}/${ch.total}</div>` : `<div>🔒 ${label}未解鎖</div>`;
    box.innerHTML = `<div class="story-card journal-card">
      <div class="story-kicker">章節完成度</div>
      <div class="journal-chapters">
        ${chapterLine("第一章", j.chapters.chapter1)}
        ${chapterLine("第二章", j.chapters.chapter2)}
        ${chapterLine("第三章", j.chapters.chapter3)}
      </div>
      ${detailHtml()}
      ${head("🌾 作物圖鑑", "crops")}<div class="journal-grid">${cropRows}</div>
      ${head("🥚 產物與品質圖鑑", "products")}<div class="journal-grid">${productRows}</div>
      ${head("🌲 東林採集", "forage")}<div class="journal-grid" data-audit="journal-forage">${forageRows}</div>
      ${head("🧑 鎮民名錄（" + npcMetCount + "/" + j.npcs.length + "）", "npcs")}<div class="journal-grid">${npcRows}</div>
      ${head("📬 鎮民支線", "npcSideQuests")}<div class="journal-grid">${j.npcs.map((n) => {
        const sq = n.sideQuest;
        const lore = sq && sq.loreUnlocked ? `<span class="sq-lore">・${sq.lore}</span>` : "";
        return item(!!(sq && sq.completed), sq ? `${sq.completed ? "✅" : sq.status === "active" ? "📌" : sq.status === "available" ? "📮" : "🔒"} ${n.name}・${sq.chainTitle || sq.title} ${sq.completedSteps}/${sq.totalSteps}${lore}` : "❔ 尚無支線", "npc-sidequest", n.id);
      }).join("")}</div>
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
  }

  // ====================================================================
  // 地圖 / 障礙 / 建築 / 動物 UI
  // ====================================================================
  // ===== v3 frame 對應 =====
  const STAGE_NAME = ["seed", "sprout", "young", "mature", "ready"];
  // 遊戲建築 type → props atlas frame（v3 無 silo/bee_box 專屬圖，沿用近似物件）
  const BUILDING_FRAME = { chickenCoop: "chicken_coop", barn: "barn", beeBox: "compost_heap",
    silo: "storage_crate", compostHeap: "compost_heap" };
  // 障礙 → props frame（同名）
  const OBSTACLE_FRAME = { rock: "rock", stump: "stump", bush: "bush" };
  // ===== Stage 4：像素世界 + camera + 分層 y-sort 渲染器 =====
  const TILE = window.TILE_PX || 48;
  let worldEl = null, groundEl = null;
  const obStatic = [], obDyn = [];   // 物件層 sprite（靜態：建築/障礙/站點；動態：作物/動物/狀態）
  const pxv = (n) => n + "px";

  function buildMap() { buildScene(); }          // 相容舊呼叫名
  function buildScene() {
    const scene = $("mapScene"); if (!scene) return;
    worldEl = $("mapWorld"); groundEl = $("groundLayer");
    if (!worldEl || !groundEl) return;
    const W = state.map.width * TILE, H = state.map.height * TILE;
    worldEl.style.width = pxv(W); worldEl.style.height = pxv(H);
    groundEl.style.width = pxv(W); groundEl.style.height = pxv(H);
    groundEl.innerHTML = ""; tileEls.length = 0;
    for (const tile of state.map.tiles) {
      const el = document.createElement("div");
      el.className = "gtile " + tile.terrain;
      el.dataset.tileId = tile.id;
      el.dataset.audit = "ground-tile"; el.dataset.terrain = tile.terrain;
      el.style.left = pxv(tile.x * TILE); el.style.top = pxv(tile.y * TILE);
      el.style.width = pxv(TILE); el.style.height = pxv(TILE);
      el.addEventListener("click", () => handleMapClick(tile.id));
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
      if (locked) cls += " locked";
      if (lockedArea) cls += " locked-area";
      if (prog && prog.wet && !prog.ready) cls += " wet";
      if (cell.tileId === selectedTileId) cls += " sel";
      cell.el.className = cls;
      cell.el.dataset.kind = lockedArea ? "locked-area" : "";
      window.Atlas.applyTo(cell.el, "terrain", terrainFrame(tile, prog));
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
  // 多格建築：寬=footprint 寬，底=footprint 底，sprite 依 frame 比例自然向上延伸（遮擋）
  function addStructure(s) {
    const cx = (s.x + s.w / 2) * TILE;
    const baselineY = (s.y + s.h) * TILE;
    const el = addObjectPx(obStatic, s.sheet, s.frame, cx, baselineY, s.w * TILE, "shadowed", 0, "structure");
    if (el) el.dataset.structureId = s.id;
  }
  const OBSTACLE_SHEET = { rock: "props", stump: "props", bush: "props", tree: "structures" };
  const OBSTACLE_FRAME2 = { rock: "rock", stump: "stump", bush: "bush", tree: "oak" };
  const OBSTACLE_SCALE = { rock: 1.05, stump: 1.0, bush: 1.1, tree: 1.8 };
  // 靜態物件：多格建築 / 障礙 / 站點（buildScene 與清障時重建）
  function buildStaticObjects() {
    for (const e of obStatic) e.remove(); obStatic.length = 0;
    if (!atlasReady || !worldEl) return;
    for (const s of (window.STRUCTURES || [])) addStructure(s);
    for (const tile of state.map.tiles) {
      if (!tile.object) continue;
      const sheet = OBSTACLE_SHEET[tile.object] || "props";
      const frame = OBSTACLE_FRAME2[tile.object] || tile.object;
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
      const el = addObjectPx(obStatic, "structures", "oak", (tile.x + 0.5) * TILE, (tile.y + 1) * TILE, TILE * 2.0, "shadowed", 0, "event-point");
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
  // Stage 9：天氣視覺化——只在天氣真的變了才切 class，避免每個 tick 重啟 CSS 動畫
  function updateWeatherLayer(t) {
    const el = $("weatherLayer"); if (!el || !state) return;
    const wId = G.currentWeather(state, t);
    if (el.dataset.weather === wId) return;
    el.dataset.weather = wId;
    el.className = wId === "clear" ? "" : wId;
  }
  function updateMap(t) {
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
        if (!plot.cropId) continue;
        const prog = G.getCropProgress(state, plot, t);
        const frame = plot.cropId + "_" + STAGE_NAME[prog.stage];
        const el = addObjectPx(obDyn, "crops", frame, (tile.x + 0.5) * TILE, (tile.y + 1) * TILE, TILE * 0.92, "crop", -2, "crop");
        if (el) { el.dataset.crop = plot.cropId; el.dataset.tileId = tile.id; }
        if (prog.ready) addDot((tile.x + 0.5) * TILE, tile.y * TILE + 2);
        else addBar(tile.x * TILE + TILE * 0.12, (tile.y + 1) * TILE - 6, TILE * 0.76, prog.ratio);
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
        const sheet = (!moving && status === "happy") ? "animals_care" : "animals";
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
    if (!atlasReady || !vfxRow) return;
    const layer = $("vfxLayer"); const el = tileElOf(tileId); if (!layer || !el) return;
    const sheet = (opts && opts.sheet) || "vfx"; // Stage 7：動物照護 VFX 用獨立的 care_vfx sheet
    vfxSpawnCount++;
    const size = el.offsetWidth * ((opts && opts.scale) || 0.95);
    const sp = document.createElement("div"); sp.className = "map-vfx";
    sp.style.width = size + "px"; sp.style.height = size + "px";
    sp.style.left = (el.offsetLeft + el.offsetWidth / 2) + "px";
    sp.style.top = (el.offsetTop + el.offsetHeight * ((opts && opts.yf) || 0.5)) + "px";
    layer.appendChild(sp);
    let f = 0;
    const paint = () => { const stl = window.Atlas.frameStyleFor(sheet, vfxRow + "_" + String(f).padStart(2, "0"), size, size);
      if (stl) { sp.style.backgroundImage = stl.backgroundImage; sp.style.backgroundSize = stl.backgroundSize; sp.style.backgroundPosition = stl.backgroundPosition; } };
    paint();
    const iv = setInterval(() => { f++; if (f > 5) { clearInterval(iv); sp.remove(); return; } paint(); }, 75);
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
  // 點地圖磚：依工具決定移動或動作
  function handleMapClick(tileId) {
    selectedTileId = tileId; state.interaction.selectedTileId = tileId;
    const tile = G.getTileById(state, tileId);
    const tool = currentTool();
    renderTileContext();
    switchTab("tile"); // 點磚自動顯示磚資訊分頁
    if (tool === "inspect") { updateMap(now()); inspectTile(tile); return; }

    // 站點：任何工具點站點都走過去 + 播站點動作 + 觸發效果
    if (tile.station) { useStation(tile); updateMap(now()); return; }
    // 多格建築/結構：走過去互動（雞舍/畜舍收集、市集賣出、農舍歇息）
    if (tile.structureId) { useStructure(tile); updateMap(now()); return; }
    // Stage 5：斷橋（走過去修橋 / 過橋）、事件點（走過去觸發）
    if (tile.bridge) { useBridge(tile); updateMap(now()); return; }
    if (tile.event) { useEvent(tile); updateMap(now()); return; }
    if (tile.forage) { useForage(tile); updateMap(now()); return; }
    // Stage 6：NPC（走過去交談）
    if (tile.npc) { useNpc(tile); updateMap(now()); return; }

    const act = actionTargetFor(tool, tile);
    if (act.invalid) { toast(act.invalid); state.interaction.lastInvalidReason = act.invalid; spawnRing(tileId, false); updateMap(now()); return; }
    if (act.action) { spawnRing(tileId, true); moveAndAct(tileId, act.action); updateMap(now()); return; }
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
      if (r.coins > 0) { spawnVfx(state.player.tileId, "product_pop"); toast("🪙 市集賣出 " + r.qty + " 個 → +" + fmtNum(r.coins) + " 金"); afterChange(true); renderOrders(); }
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
      if (r.coins > 0) { spawnVfx(stationTileOf("storage"), "product_pop"); toast("🪙 賣出 " + r.qty + " 個 → +" + fmtNum(r.coins) + " 金"); afterChange(true); renderOrders(); }
      else toast("倉庫沒有可賣的東西");
    } else if (st.effect === "story" || st.effect === "mail") {
      // 信箱/告示牌：推進序章任務
      const adv = G.advanceStory(state, "read_sign");
      const q = window.QUESTS[adv.completed === "intro_reopen_farm" ? "plant_wheat" : (state.story.questId || "intro_reopen_farm")];
      toast("📖 " + (st.effect === "mail" ? "信箱" : "告示牌") + "：" + (q ? q.title : "陽光農場的近況"));
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
      if (n > 0) { G.advanceStory(state, "water"); afterChange(false); }
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
      if (r.ok) { playAction("sow", face); spawnVfx(tileId, "seed_scatter"); G.advanceStory(state, "plant"); afterChange(true); }
      else { spawnRing(tileId, false); toast(r.reason === "no_coins" ? "🪙 金幣不足" : r.reason === "locked_crop" ? "🔒 作物未解鎖" : "無法種植"); }
    } else if (action === "harvest") {
      const r = G.harvest(state, tile.plotIndex, t);
      if (r.ok) { playAction("harvest", face); spawnVfx(tileId, "harvest_pop"); G.advanceStory(state, "harvest"); const crop = window.CROPS[r.cropId];
        toast("🧺 收成 " + r.added + " " + crop.name); if (r.lost) toast("📦 倉滿損失 " + r.lost); if (r.leveled) toast("🎉 升 Lv " + state.level); afterChange(true); }
    } else if (action === "water") {
      const r = G.waterPlot(state, tile.plotIndex, t);
      if (r.ok) { playAction("water", face); spawnVfx(tileId, "water_droplets"); G.advanceStory(state, "water"); toast("💧 澆水變濕土加速"); afterChange(false); }
    } else if (action === "clear") {
      const r = G.clearObstacle(state, tileId);
      if (r.ok) { playAction("hoe", face); spawnVfx(tileId, "soil_dust"); G.advanceStory(state, "clear"); toast("⛏️ 清除 " + window.OBSTACLES[r.cleared].name + "，得建材"); afterChange(true); buildStaticObjects(); paintGround(); renderTileContext(); }
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
        if (r.tier !== "normal") spawnVfx(tile.id, "quality_sparkle", { scale: 1.1, sheet: "care_vfx" });
        toast((r.tier === "premium" ? "✨ " : r.tier === "good" ? "🌟 " : "🧺 ") + "收集 " + r.added + " " + itemName(r.product));
        afterChange(true); renderTileContext(); updateMap(now());
      }
    });
    box.querySelectorAll(".afeed").forEach((btn) => btn.onclick = () => {
      const r = G.feedAnimal(state, btn.dataset.id, now());
      if (r.ok) {
        playAction("sow"); spawnVfx(tile.id, "feed_bits", { sheet: "care_vfx" });
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
        playAction("water"); spawnVfx(tile.id, "water_splash", { sheet: "care_vfx" });
        toast("💧 澆水 → 親密度 " + r.affinity.toFixed(0));
        G.advanceStory(state, "care_animal", now());
        afterChange(true); renderTileContext();
      } else if (r.reason === "cooldown") toast("這隻剛澆過水，等一下再來");
    });
    box.querySelectorAll(".agroom").forEach((btn) => btn.onclick = () => {
      const r = G.groomAnimal(state, btn.dataset.id, now());
      if (r.ok) {
        playAction("build"); spawnVfx(tile.id, "groom_sparkle", { sheet: "care_vfx" });
        toast("🧹 梳理 → 親密度 " + r.affinity.toFixed(0));
        G.advanceStory(state, "care_animal", now());
        afterChange(true); renderTileContext();
      } else if (r.reason === "cooldown") toast("這隻剛梳理過，等一下再來");
    });
    box.querySelectorAll(".abuy").forEach((btn) => btn.onclick = () => {
      const r = G.buyAnimal(state, btn.dataset.bid, btn.dataset.type, now());
      if (r.ok) { toast("🐣 新動物入住！"); afterChange(true); renderTileContext(); }
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
  function onKeyMove(e) {
    const dirMap = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down",
                     ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
    const dir = dirMap[e.key]; if (!dir) return;
    e.preventDefault();
    const dd = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    state.player.facing = dir;
    const nt = G.getTileXY(state, state.player.x + dd[0], state.player.y + dd[1]);
    if (nt && G.isWalkable(state, nt)) walkPath([nt.id]);
    else { player.frame = 0; paintPlayer("walk", WALK_ROW[dir], 0, false); } // 撞牆只轉向
  }

  // ---------- 統一刷新 ----------
  function afterChange(rerenderPanels) {
    renderResBar(); renderSeeds(); updateFarm(now());
    renderStory(); renderQuestDock(); renderSmartAssistant(true); renderJournal(); syncHud();
    if (rerenderPanels) { renderUpgrades(); updateMap(now()); }
    scheduleSave();
  }

  // ---------- 離線摘要 ----------
  function showOfflineSummary(summary) {
    if (!summary || summary.offlineMs < 5 * 60 * 1000) return false; // 離線 <5 分鐘不打擾
    const lines = [];
    const minutes = Math.max(5, Math.round(summary.offlineMs / 60000));
    const forageCount = summary.forageReadyCount || (summary.forageReady || []).length || 0;
    lines.push(`<div class="ml" data-audit="offline-head">你離開的 ${minutes} 分鐘：離線收益 <span class="v">+${summary.coins || 0} 金</span></div>`);
    lines.push(`<div class="ml" data-audit="offline-mature">作物成熟 <span class="v">${summary.readyPlots || 0} 株</span></div>`);
    if (forageCount > 0) lines.push(`<div class="ml" data-audit="offline-forage">採集點已刷新 <span class="v">${forageCount} 處</span></div>`);
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
    if (!crops.length && !products.length && !summary.readyPlots && !forageCount && !(summary.coins > 0)) lines.push(`<div class="ml">農場靜悄悄，沒有新進度</div>`);
    if (summary.cappedFromMs > 0) lines.push(`<div class="tip">（離線收益上限 8 小時，實際離開 ${fmtTime(summary.cappedFromMs)}）</div>`);
    $("offlineBody").innerHTML = lines.join("");
    $("offlineModal").classList.add("show");
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
    const t = now();
    const weatherChanged = G.updateWeather(state, t);
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
    if (helped.harvested > 0 || weatherChanged) { renderResBar(); }
    updateFarm(t);
    updateMap(t);       // 地圖：作物/動物成熟
    renderSmartAssistant();
    tickPlayer(t);      // 玩家走路/動作/待機動畫
  }

  // ---------- 初始化 ----------
  function init() {
    // 先載入存檔，state 必須在任何 render/onload 前就緒
    state = window.load() || window.defaultState(now());
    setupErrorRecovery();
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
    G.refreshOrders(state, now());
    G.updateWeather(state, now());

    buildFarm(); buildMap();
    renderToolbar(); renderResBar(); renderSeeds(); renderOrders(); renderUpgrades(); renderStory(); renderQuestDock(); renderSmartAssistant(true); renderJournal(); syncHud(); syncGenderBtn(); updateFarm(now()); renderTileContext();
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
      refresh: () => { renderToolbar(); renderResBar(); renderSeeds(); renderOrders(); renderUpgrades(); renderStory(); renderQuestDock(); renderSmartAssistant(true); renderJournal(); syncHud(); buildMap(); updateFarm(now()); renderTileContext(); },
      clickTile: (id) => handleMapClick(id),
      focusTile: (id) => focusCameraOnTile(id),
      assistantSuggestions: () => G.farmActionSuggestions ? G.farmActionSuggestions(state, now(), { limit: 3 }) : [],
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
    // Stage 6：主角性別切換（女 Miri ↔ 男 Kai），即時換 sprite
    $("genderToggle").onclick = () => {
      state.gender = state.gender === "m" ? "f" : "m";
      syncGenderBtn();
      paintIdlePlayer(); positionPlayer(false); toast(state.gender === "m" ? "🧑 主角：Kai（男）" : "👩 主角：Miri（女）");
      scheduleSave();
    };
    $("assistantToggle").onclick = () => {
      if (!state.settings) state.settings = { smartAssistant: true, smartAssistantCollapsed: false };
      state.settings.smartAssistant = state.settings.smartAssistant === false;
      if (state.settings.smartAssistant) state.settings.smartAssistantCollapsed = false;
      renderSmartAssistant(true);
      scheduleSave();
    };
    $("howToBtn").onclick = () => $("howToModal").classList.add("show");
    $("howToOk").onclick = () => $("howToModal").classList.remove("show");
    $("offlineOk").onclick = () => $("offlineModal").classList.remove("show");
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
