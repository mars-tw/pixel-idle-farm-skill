/*
 * waitplay-r82.js — R82C 第 1 項：等待中的田邊小事。
 * 等光、等成熟、等曬乾的倒數期間，田邊會冒出一件順手的小事（撿落穗、趕麻雀、拔雜草、撿枯枝）。
 * 點一下，角色走過去做完，拿一點小收穫；沒點也會自己消失；同一時間最多一件，也不跟農場小事（烏鴉、小雞）同時出現。
 * 新存檔的前十分鐘（實際遊玩時間）每段倒數都會補上一件，不留超過三秒只能看倒數的空檔；之後改成偶爾才出現。
 * 「現在是不是在等」只讀 AdventureAPI.nextFarmStep：任務卡說要等，才算在等；任務卡有別的事可做、或光快到了要玩家選，都不算。
 * 規則（何時出現、放在哪一格、給什麼）全在這支，沒有 DOM 也能跑，Node 測試直接用遊戲時鐘模擬。
 */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const Game = isNode ? require("./game.js") : root;
  const Sunplay = isNode ? require("./sunplay-r75.js") : root.FarmSunplay;
  const adventure = () => (isNode ? require("./adventure.js") : root.AdventureAPI);

  const ONBOARD_MS = 10 * 60 * 1000;        // 前十分鐘：每段倒數都補一件
  const ONBOARD_AFTER_MS = 1500;            // 開始等之後多久冒出來
  const ONBOARD_COOLDOWN_MS = 600;          // 做完或消失後，下一件最快多久
  const LATER_AFTER_MS = 6000;              // 十分鐘以後：等了 6 秒才可能出現
  const LATER_GAP_MS = 60000;               // 十分鐘以後：兩件之間至少隔一分鐘
  const MIN_LEFT_MS = 1800;                 // 倒數只剩不到這麼久就不出（冷卻＋這段＋一次更新間隔仍在三秒內）
  const LIFE_MS = 18000;                    // 沒點，最多留這麼久
  const GRACE_MS = 1200;                    // 不用再等了（光到了、熟了），再留一下就收起來
  const CLAIM_HOLD_MS = 8000;               // 點了正在走過去，這段時間不收起來
  const PLAY_STEP_CAP_MS = 2000;            // 遊玩時間每次最多記這麼多（切到背景不算）
  const HISTORY_CAP = 20;

  /* 小收穫都只有一份。陽光、木料、堆肥另有冷卻，十分鐘裡最多幾份，不會變成另一條賺錢的路。 */
  const CHORES = [
    { id: "glean", name: "撿落穗", art: "assets/generated/r83/wheat-32.png", reward: { seeds: "wheat" }, rewardText: "小麥種子 1 包", cooldownMs: 0,
      doneText: "你把田埂上的落穗撿起來，收進種子袋。" },
    { id: "sparrow", name: "趕麻雀", art: "assets/generated/content-r82/chore-sparrow.png", reward: { sunlight: 1 }, rewardText: "陽光 1", cooldownMs: 120000,
      doneText: "麻雀拍拍翅膀飛走了，麥穗多接到一點光。" },
    { id: "weed", name: "拔雜草", art: "assets/generated/content-r82/chore-weed.png", reward: { compost: 1 }, rewardText: "堆肥 1", cooldownMs: 180000,
      doneText: "你把田邊那株雜草連根拔起，丟進堆肥。" },
    { id: "twig", name: "撿枯枝", art: "assets/generated/content-r73/item-fallen_branch.png", reward: { wood: 1 }, rewardText: "木料 1", cooldownMs: 120000,
      doneText: "你把吹到田邊的枯枝撿回來，捆成一小把木料。" },
  ];
  const MISSING_ART = ["assets/generated/content-r82/chore-sparrow.png", "assets/generated/content-r82/chore-weed.png"];
  const byId = (id) => CHORES.find((row) => row.id === id) || null;
  const whole = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const plain = (v) => !!v && typeof v === "object" && !Array.isArray(v);

  function normalize(state) {
    if (!state.flags || !plain(state.flags)) state.flags = {};
    const raw = plain(state.flags.r82Chores) ? state.flags.r82Chores : {};
    /* 舊存檔第一次讀到這支：已經走完第一章、或存檔建立超過一小時，就不是新存檔，直接用「偶爾出現」的步調。 */
    if (!plain(state.flags.r82Chores)) {
      const old = !!(state.adventure && state.adventure.claimed && state.adventure.claimed.c1_first_meal) || (whole(state.createdAt) && whole(state.lastSeenAt) - whole(state.createdAt) > 3600000);
      if (old) raw.playMs = ONBOARD_MS;
    }
    const active = plain(raw.active) && byId(raw.active.id) && typeof raw.active.tileId === "string" && whole(raw.active.startedAt) && whole(raw.active.expiresAt) > whole(raw.active.startedAt)
      ? { id: raw.active.id, tileId: raw.active.tileId, startedAt: whole(raw.active.startedAt), expiresAt: whole(raw.active.expiresAt), kind: ["light", "grow", "dry"].includes(raw.active.kind) ? raw.active.kind : "grow",
        claimedAt: whole(raw.active.claimedAt), goneAt: whole(raw.active.goneAt) }
      : null;
    const rewardAt = {}; CHORES.forEach((row) => { if (plain(raw.rewardAt) && whole(raw.rewardAt[row.id])) rewardAt[row.id] = whole(raw.rewardAt[row.id]); });
    const clean = {
      playMs: whole(raw.playMs), lastSeenAt: whole(raw.lastSeenAt), waitSince: whole(raw.waitSince), cooldownUntil: whole(raw.cooldownUntil), lastSpawnAt: whole(raw.lastSpawnAt),
      spawned: whole(raw.spawned), done: whole(raw.done), expired: whole(raw.expired), lastId: byId(raw.lastId) ? raw.lastId : "", rewardAt, active,
      history: (Array.isArray(raw.history) ? raw.history : []).filter((h) => plain(h) && byId(h.id) && whole(h.at)).slice(-HISTORY_CAP).map((h) => ({ id: h.id, at: whole(h.at), result: h.result === "done" ? "done" : "gone" })),
    };
    /* 就地整理，同一份物件一直掛在存檔上：呼叫端手上拿著的參考不會因為別處再整理一次而失效。 */
    const target = plain(state.flags.r82Chores) ? state.flags.r82Chores : (state.flags.r82Chores = {});
    Object.keys(target).forEach((key) => { if (!Object.prototype.hasOwnProperty.call(clean, key)) delete target[key]; });
    return Object.assign(target, clean);
  }

  function onboarding(state) { return normalize(state).playMs < ONBOARD_MS; }

  /* 任務卡現在是不是叫玩家「等」。只有等成熟（wait）與等光（catch_sun）算；光快到了、熟的那格還要玩家選現在收或等光，不算在等。
     nextFarmStep 掛了另一個可以先做的目標（R82C 第 2 項），也不算在等。 */
  function waitStatus(state, now) {
    const none = { waiting: false, kind: null, endsAt: 0, step: null };
    const A = adventure(); if (!A || typeof A.nextFarmStep !== "function") return none;
    let step = null; try { step = A.nextFarmStep(state, now); } catch (_) { return none; }
    if (!step || step.alternative) return Object.assign({}, none, { step });
    const plot = step.plotIndex != null && Array.isArray(state.plots) ? state.plots[step.plotIndex] : null;
    const progress = (p) => { try { return p && p.cropId && typeof Game.getCropProgress === "function" ? Game.getCropProgress(state, p, now) : null; } catch (_) { return null; } };
    let kind = null, endsAt = 0;
    if (step.action === "wait") {
      const prog = progress(plot);
      kind = "grow"; endsAt = prog && Number.isFinite(prog.remainingMs) ? now + Math.max(0, prog.remainingMs) : 0;
    } else if (step.action === "catch_sun") {
      const prog = progress(plot), queued = typeof Game.lightHarvestQueue === "function" ? Game.lightHarvestQueue(state) : null;
      if (prog && prog.ready && !(queued && queued.plotIndex === step.plotIndex)) {
        let choice = null; try { choice = typeof Game.lightHarvestChoice === "function" ? Game.lightHarvestChoice(state, step.plotIndex, now) : null; } catch (_) { choice = null; }
        if (choice && choice.ok) return Object.assign({}, none, { step });
      }
      const sun = state.sun || {};
      kind = "light"; endsAt = whole(sun.previewAt) > now ? whole(sun.previewAt) : 0;
    } else return Object.assign({}, none, { step });
    /* 曬架正在曬、而且比上面那段更早曬好：這段等待算「等曬乾」。 */
    try {
      const rack = Sunplay && typeof Sunplay.rackStatus === "function" ? Sunplay.rackStatus(state, now) : null;
      if (rack && !rack.empty && !rack.ready && rack.remainingMs > 0 && (!endsAt || now + rack.remainingMs < endsAt)) kind = "dry";
    } catch (_) { /* 曬架讀不到就照原本那段 */ }
    return { waiting: true, kind, endsAt, step };
  }

  /* 田邊空地：緊貼已開墾田格、走得到、上面沒有東西，也不在田的上方（那裡是田上標籤的位置）。 */
  function fieldEdgeTiles(state) {
    const tiles = (state.map && state.map.tiles) || [];
    const active = typeof Game.activePlotCount === "function" ? Game.activePlotCount(state) : 6;
    const plots = tiles.filter((t) => t.plotIndex != null && t.plotIndex < active);
    if (!plots.length) return [];
    const topY = Math.min.apply(null, plots.map((t) => t.y));
    const a = state.adventure || {}, siteIds = new Set(Object.values(a.siteTiles || {}).concat(Object.values(root.WORLD_PROJECT_SITES || {})));
    try { const A = adventure(); (A && A.projects ? A.projects(state) : []).forEach((p) => { if (p.target && p.target.tileId) siteIds.add(p.target.tileId); }); } catch (_) { /* 讀不到修復點就照原本 */ }
    /* 修復點（花園、釣台）的圖比一格大，連它旁邊那一格也讓開。 */
    const siteTiles = tiles.filter((t) => siteIds.has(t.id));
    const nearSite = (t) => siteTiles.some((s) => Math.max(Math.abs(s.x - t.x), Math.abs(s.y - t.y)) <= 1);
    const walkable = (t) => { try { return typeof Game.isWalkable === "function" ? !!Game.isWalkable(state, t) : true; } catch (_) { return false; } };
    return tiles.filter((t) => t.plotIndex == null && t.y >= topY && !t.npc && !t.structureId && !t.station && !t.object && !t.buildingId && !t.forage && !t.event && !t.bridge && !t.adventureSite && !nearSite(t)
      && walkable(t) && plots.some((p) => Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y)) === 1))
      .sort((x, y) => (x.x - y.x) || (x.y - y.y));
  }
  function pickTile(state, step, count, now) {
    const busy = new Set([state.player && state.player.tileId, step && step.tileId].filter(Boolean));
    try { const A = adventure(), ev = A && A.worldEventObject ? A.worldEventObject(state, now) : null; if (ev && ev.tileId) busy.add(ev.tileId); } catch (_) { /* 沒有農場小事 */ }
    const free = fieldEdgeTiles(state).filter((t) => !busy.has(t.id));
    return free.length ? free[count % free.length] : null;
  }

  function rewardReady(state, chore, now) {
    const st = normalize(state), last = st.rewardAt[chore.id] || 0;
    if (chore.cooldownMs && last && now - last < chore.cooldownMs) return false;
    const sun = state.r75Sunplay || {};
    /* 陽光要等玩家第一次在光裡接過光才給，不搶追光教學；堆肥等第一次收成介紹過照顧方式才給。 */
    if (chore.reward.sunlight) return !!sun.firstCaught && Sunplay && Sunplay.sunlight(state) < Sunplay.bottleCapacity(state);
    if (chore.reward.compost) return !!(state.flags && state.flags.r78CareIntro);
    return true;
  }
  function pickChore(state, now) {
    const st = normalize(state), start = st.spawned % CHORES.length;
    for (let i = 0; i < CHORES.length; i++) {
      const chore = CHORES[(start + i) % CHORES.length];
      if (chore.id === st.lastId && CHORES.length > 1) continue;
      if (rewardReady(state, chore, now)) return chore;
    }
    return CHORES[0];
  }

  function view(state, now) {
    const st = normalize(state); if (!st.active) return null;
    const chore = byId(st.active.id); if (!chore) return null;
    return { id: chore.id, key: st.active.id + "@" + st.active.startedAt, name: chore.name, art: chore.art, artMissing: MISSING_ART.includes(chore.art), rewardText: chore.rewardText,
      tileId: st.active.tileId, kind: st.active.kind, claimed: !!st.active.claimedAt, remainingMs: Math.max(0, st.active.expiresAt - now) };
  }
  function expire(st, now) {
    st.history.push({ id: st.active.id, at: now, result: "gone" }); st.history = st.history.slice(-HISTORY_CAP);
    st.lastId = st.active.id; st.active = null; st.expired += 1;
    st.cooldownUntil = now + ONBOARD_COOLDOWN_MS;
  }

  /* 每次畫面更新呼叫一次：記遊玩時間、收起過期的那件、該出現時冒出一件。回傳 { spawned, expired, active }。 */
  function update(state, now) {
    const st = normalize(state), t = whole(now) || Date.now();
    if (st.lastSeenAt) st.playMs += Math.max(0, Math.min(PLAY_STEP_CAP_MS, t - st.lastSeenAt));
    st.lastSeenAt = t;
    const wait = waitStatus(state, t);
    let expired = false, spawned = false;
    if (st.active) {
      const holding = st.active.claimedAt && t - st.active.claimedAt < CLAIM_HOLD_MS;
      if (wait.waiting) st.active.goneAt = 0; else if (!st.active.goneAt) st.active.goneAt = t;
      if (!holding && (t >= st.active.expiresAt || (st.active.goneAt && t - st.active.goneAt >= GRACE_MS))) { expire(st, t); expired = true; }
    }
    if (!wait.waiting) { st.waitSince = 0; return { spawned, expired, active: view(state, t) }; }
    if (!st.waitSince) st.waitSince = t;
    if (st.active || t < st.cooldownUntil) return { spawned, expired, active: view(state, t) };
    try { const A = adventure(); if (A && A.worldEventObject && A.worldEventObject(state, t)) return { spawned, expired, active: null }; } catch (_) { /* 沒有農場小事 */ }
    const early = st.playMs < ONBOARD_MS;
    if (t - st.waitSince < (early ? ONBOARD_AFTER_MS : LATER_AFTER_MS)) return { spawned, expired, active: null };
    if (!early && st.lastSpawnAt && t - st.lastSpawnAt < LATER_GAP_MS) return { spawned, expired, active: null };
    if (wait.endsAt && wait.endsAt - t < MIN_LEFT_MS) return { spawned, expired, active: null };
    const tile = pickTile(state, wait.step, st.spawned, t); if (!tile) return { spawned, expired, active: null };
    const chore = pickChore(state, t);
    st.active = { id: chore.id, tileId: tile.id, startedAt: t, expiresAt: t + LIFE_MS, kind: wait.kind, claimedAt: 0, goneAt: 0 };
    st.spawned += 1; st.lastSpawnAt = t; spawned = true;
    return { spawned, expired, active: view(state, t) };
  }

  /* 玩家點了：先記下來，走過去的這幾秒不會被收走。 */
  function claim(state, now) {
    const st = normalize(state); if (!st.active) return { ok: false, reason: "gone", message: "這件小事已經過去了。" };
    st.active.claimedAt = whole(now) || Date.now();
    return { ok: true, active: view(state, now) };
  }

  /* 走到了：給小收穫，收起這件。 */
  function resolve(state, now) {
    const st = normalize(state), t = whole(now) || Date.now();
    if (!st.active) return { ok: false, reason: "gone", message: "這件小事已經過去了。" };
    const chore = byId(st.active.id); const reward = {};
    if (chore.reward.seeds) {
      const A = adventure(); if (A && A.ensure) A.ensure(state, t);
      const r59 = state.adventure && state.adventure.r58 && state.adventure.r58.r59;
      if (r59) { if (!plain(r59.seedPacks)) r59.seedPacks = {}; const before = whole(r59.seedPacks[chore.reward.seeds]); r59.seedPacks[chore.reward.seeds] = Math.min(99, before + 1); reward.seeds = { [chore.reward.seeds]: r59.seedPacks[chore.reward.seeds] - before }; }
    }
    if (chore.reward.sunlight && Sunplay) reward.sunlight = Sunplay.addSunlight(state, chore.reward.sunlight);
    ["wood", "compost"].forEach((id) => {
      if (!chore.reward[id]) return;
      if (!plain(state.materials)) state.materials = {};
      const before = whole(state.materials[id]); state.materials[id] = Math.min(999, before + chore.reward[id]); reward[id] = state.materials[id] - before;
    });
    st.rewardAt[chore.id] = t; st.done += 1; st.lastId = chore.id;
    st.history.push({ id: chore.id, at: t, result: "done" }); st.history = st.history.slice(-HISTORY_CAP);
    st.active = null; st.cooldownUntil = t + ONBOARD_COOLDOWN_MS;
    const got = Object.values(reward).some((v) => (plain(v) ? Object.values(v).some((n) => n > 0) : v > 0));
    return { ok: true, id: chore.id, name: chore.name, reward, message: chore.doneText + (got ? "（" + chore.rewardText + "）" : "") };
  }

  const API = { CHORES, MISSING_ART, ONBOARD_MS, ONBOARD_AFTER_MS, ONBOARD_COOLDOWN_MS, LATER_AFTER_MS, LATER_GAP_MS, MIN_LEFT_MS, LIFE_MS, GRACE_MS, CLAIM_HOLD_MS,
    normalize, onboarding, waitStatus, fieldEdgeTiles, update, view, claim, resolve };
  if (isNode) { module.exports = API; return; }
  root.FarmWaitplay = API;
  if (typeof document === "undefined") return;

  /* ---------- 瀏覽器：田邊那一件小事 ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const farm = () => root.__farm || null;
  function liveState() { const f = farm(); try { return f && typeof f.state === "function" ? f.state() : null; } catch (_) { return null; } }
  function tileBox(tileId) {
    const node = document.querySelector('.gtile[data-tile-id="' + tileId + '"]');
    const size = node ? parseFloat(node.style.width) : NaN; const tile = typeof Game.getTileById === "function" ? Game.getTileById(liveState(), tileId) : null;
    return node && tile && size > 0 ? { size, x: tile.x, y: tile.y } : null;
  }
  function paint(state, now) {
    const world = document.getElementById("mapWorld"); if (!world) return;
    let node = world.querySelector(".r82c-chore");
    const current = view(state, now);
    if (!current || document.querySelector(".modal.show")) { if (node) node.remove(); return; }
    if (node && node.dataset.r82cChoreKey !== current.key) { node.remove(); node = null; }
    const box = tileBox(current.tileId); if (!box) { if (node) node.remove(); return; }
    if (!node) {
      node = document.createElement("button"); node.type = "button"; node.className = "r82c-chore"; node.dataset.r82cChore = current.id; node.dataset.r82cChoreKey = current.key; node.dataset.tileId = current.tileId;
      node.dataset.audit = "r82c-chore";
      node.setAttribute("aria-label", current.name + "，點一下走過去，可以拿到" + current.rewardText);
      node.title = current.name + "：" + current.rewardText;
      /* 缺圖時（麻雀、雜草還沒畫）只留名牌，不顯示破圖。 */
      node.innerHTML = '<img class="r82c-chore-art" src="' + esc(current.art + (root.FARM_VERSION_QUERY || "")) + '" alt="" draggable="false"><b>' + esc(current.name) + "</b>";
      const img = node.querySelector("img"); img.onerror = () => { node.classList.add("is-missing-art"); img.remove(); };
      node.onclick = (event) => { event.stopPropagation(); go(); };
      world.appendChild(node);
    }
    node.classList.toggle("is-claimed", current.claimed);
    node.style.cssText = "left:" + ((box.x + 0.5) * box.size) + "px;top:" + ((box.y + 0.92) * box.size) + "px;z-index:" + Math.round((box.y + 1) * box.size) + ";";
  }
  function go() {
    const s = liveState(), f = farm(); if (!s || !f) return;
    const current = view(s, Date.now()); if (!current) return;
    claim(s, Date.now());
    const started = typeof f.travelAndDo === "function" && f.travelAndDo(current.tileId, "collect", () => {
      const r = resolve(s, Date.now());
      if (f.toast) f.toast(r.ok ? r.message : r.message);
      if (r.ok && f.safeSaveNow) { try { f.safeSaveNow(); } catch (_) { /* 存檔失敗由主程式提示 */ } }
      paint(s, Date.now());
    });
    if (!started) { const st = normalize(s); if (st.active) st.active.claimedAt = 0; }
    paint(s, Date.now());
  }
  function tick() {
    if (document.hidden) return;
    const s = liveState(); if (!s || !s.map) return;
    try { update(s, Date.now()); paint(s, Date.now()); } catch (_) { /* 小事出錯不影響主遊戲 */ }
  }
  setInterval(tick, 300);
})(typeof window !== "undefined" ? window : globalThis);
