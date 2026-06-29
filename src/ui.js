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
  };

  let state = null;
  let selectedSeed = "wheat";
  let spritesReady = false;
  let lastOrderSig = "";
  let saveTimer = null;
  const plotEls = []; // 農地格 DOM 快取

  const $ = (id) => document.getElementById(id);
  const now = () => Date.now();

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
      ${weatherUnlocked ? `<div class="res weather" title="${w.name}"><span class="ic">${w.icon}</span><span class="sub">${w.name}</span></div>` : ""}`;
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
      el.className = "plot" + (prog.ready ? " ready" : " growing");

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
    if (!plot.cropId) {
      const r = G.plant(state, i, selectedSeed, t);
      if (!r.ok) {
        if (r.reason === "no_coins") toast("🪙 金幣不足，先賣點作物");
        else if (r.reason === "locked_crop") toast("🔒 此作物尚未解鎖");
        return;
      }
      afterChange(true);
    } else {
      const prog = G.getCropProgress(state, plot, t);
      if (!prog.ready) { toast("⏳ 還要 " + fmtTime(prog.remainingMs)); return; }
      const crop = window.CROPS[plot.cropId];
      const r = G.harvest(state, i, t);
      if (r.ok) {
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
        return `<span class="w ${ok ? "have" : "miss"}">${window.CROPS[cid].emoji}${have}/${q}</span>`;
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

  // ---------- 統一刷新 ----------
  function afterChange(rerenderPanels) {
    renderResBar(); renderSeeds(); updateFarm(now());
    if (rerenderPanels) { renderUpgrades(); }
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
    if (summary.replanted > 0) lines.push(`<div class="ml">🤖 幫手補種 <span class="v">${summary.replanted} 次</span></div>`);
    if (summary.readyPlots > 0) lines.push(`<div class="ml">🌾 已成熟待收 <span class="v">${summary.readyPlots} 格</span></div>`);
    if (summary.lost > 0) lines.push(`<div class="ml" style="color:var(--bad)">📦 倉滿損失 <span class="v">${summary.lost}</span></div>`);
    if (!crops.length && !summary.readyPlots) lines.push(`<div class="ml">農場靜悄悄，沒有新進度</div>`);
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

    // 離線結算（在 refreshOrders 前）
    const summary = G.applyOffline(state, now());
    G.refreshOrders(state, now());
    G.updateWeather(state, now());

    buildFarm();
    renderResBar(); renderSeeds(); renderOrders(); renderUpgrades(); updateFarm(now());

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
  }

  function bindToolbar() {
    $("harvestAllBtn").onclick = () => {
      const r = G.harvestAll(state, now());
      if (r.totalAdded > 0) { toast("🧺 收成 " + r.totalAdded + " 個作物"); if (r.totalLost) toast("📦 倉滿損失 " + r.totalLost); afterChange(true); }
      else toast("沒有成熟的作物");
    };
    $("sellAllBtn").onclick = () => {
      const r = G.sellAll(state, now());
      if (r.coins > 0) { toast("🪙 賣出 " + r.qty + " 個，得 " + fmtNum(r.coins) + " 金"); afterChange(true); renderOrders(); }
      else toast("倉庫沒有可賣的作物");
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
        selectedSeed = "wheat"; buildFarm();
        renderResBar(); renderSeeds(); renderOrders(); renderUpgrades(); updateFarm(now());
        G.refreshOrders(state, now()); renderOrders();
        window.save(state); toast("🗑️ 已重置");
      }
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
