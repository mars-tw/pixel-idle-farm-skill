/*
 * waitplay-r82.js — R82C 第 1 項：等待中的田邊小事。
 * 等光、等成熟、等曬乾的倒數期間，田邊會冒出一件順手的小事（撿落穗、趕麻雀、拔雜草、撿枯枝）。
 * 點一下，角色走過去做完，拿一點小收穫；沒點也會自己消失；同一時間最多一件，也不跟農場小事（烏鴉、小雞）同時出現。
 * 新存檔的前十分鐘（實際遊玩時間）每段倒數都會補上一件，不留超過三秒只能看倒數的空檔；之後改成偶爾才出現。
 * 「現在是不是在等」只讀 AdventureAPI.nextFarmStep：任務卡說要等，才算在等；任務卡有別的事可做、或光快到了要玩家選，都不算。
 * 規則（何時出現、放在哪一格、給什麼）全在這支，沒有 DOM 也能跑，Node 測試直接用遊戲時鐘模擬。
 *
 * R83C 第 2 項：小事不再是介面小方塊，改成畫在田邊地上的東西（跟地圖一起捲動、縮放），麻雀會跳、雜草會晃；
 *   名稱只在角色靠近、滑鼠停留或點選時才冒出小名牌。放的格子會讓開角色站的位置與任務那一格旁邊（角色在田上工作時站在左邊那格）。
 * R83C 第 3 項：麻雀二選一——「趕走」拿陽光 1；「留一把穗給牠」當下不拿東西，之後偶爾叼回一顆小麥種子（有間隔、一天有上限）。
 *   結果寫進手札一行（state.adventure.r58.r59.journal，eventId 以 r83c_ 開頭）。
 * R84C 第 3 項：一般視角下圖至少畫 40px；小名牌（撿落穗、麻雀、拔雜草、撿枯枝）常駐顯示，不再等角色靠近。
 *   位置沿用 R83C 的避讓規則（讓開角色、任務那一格旁邊、田格與固定介面）。
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
  const R84C_ART_MIN = 40;                  // R84C 第 3 項：一般視角下小事的圖至少畫這麼大
  const R84C_ART_TILE = 48;                 // 格子至少這麼大才算一般視角（縮放看整張地圖時不放大）
  /* R83C 第 3 項：留穗給麻雀之後，牠多久叼回種子、兩次之間至少隔多久、一天（往回算 24 小時）最多幾次。 */
  const SPARROW_GIFT_DELAY_MS = 40000;
  const SPARROW_GIFT_GAP_MS = 5 * 60 * 1000;
  const SPARROW_GIFT_DAY_MS = 24 * 60 * 60 * 1000;
  const SPARROW_GIFT_DAY_CAP = 2;
  const SPARROW_GIFT_SEED = "wheat";
  const JOURNAL_PREFIX = "r83c_";

  /* 小收穫都只有一份。陽光、木料、堆肥另有冷卻，十分鐘裡最多幾份，不會變成另一條賺錢的路。
     label 是地圖上小名牌寫的名稱；name 是要做的事（讀屏與提示用）。 */
  const CHORES = [
    { id: "glean", label: "撿落穗", name: "撿落穗", art: "assets/generated/content-r83/chore-glean.png", motion: "sway", reward: { seeds: "wheat" }, rewardText: "小麥種子 1 包", cooldownMs: 0,
      doneText: "你把田埂上的落穗撿起來，收進種子袋。" },
    { id: "sparrow", label: "麻雀", name: "趕麻雀", art: "assets/generated/content-r82/chore-sparrow.png", motion: "hop", reward: { sunlight: 1 }, rewardText: "陽光 1", cooldownMs: 120000,
      doneText: "麻雀拍拍翅膀飛走了，麥穗多接到一點光。" },
    { id: "weed", label: "拔雜草", name: "拔雜草", art: "assets/generated/content-r82/chore-weed.png", motion: "sway", reward: { compost: 1 }, rewardText: "堆肥 1", cooldownMs: 180000,
      doneText: "你把田邊那株雜草連根拔起，丟進堆肥。" },
    { id: "twig", label: "撿枯枝", name: "撿枯枝", art: "assets/generated/content-r83/chore-twig.png", motion: "still", reward: { wood: 1 }, rewardText: "木料 1", cooldownMs: 120000,
      doneText: "你把吹到田邊的枯枝撿回來，捆成一小把木料。" },
  ];
  /* R83C 第 3 項：麻雀的兩個做法。數字只寫在選項小字與手札，不寫進旁白。 */
  const SPARROW_CHOICES = [
    { id: "shoo", label: "趕走", detail: "陽光 1" },
    { id: "share", label: "留一把穗給牠", detail: "之後偶爾叼回種子" },
  ];
  /* R82 整合：麻雀與雜草的正式圖已由 MUSE 補上。 */
  const MISSING_ART = [];
  const byId = (id) => CHORES.find((row) => row.id === id) || null;
  const whole = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const plain = (v) => !!v && typeof v === "object" && !Array.isArray(v);

  function normalizeSparrow(raw) {
    const r = plain(raw) ? raw : {};
    return { shared: whole(r.shared), shooed: whole(r.shooed), given: whole(r.given), giftAt: whole(r.giftAt),
      gifts: (Array.isArray(r.gifts) ? r.gifts : []).map(whole).filter(Boolean).slice(-10), lastChoice: r.lastChoice === "share" ? "share" : r.lastChoice === "shoo" ? "shoo" : "" };
  }
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
      sparrow: normalizeSparrow(raw.sparrow),
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

  /* 田邊空地：緊貼已開墾田格（ring＝1）、走得到、上面沒有東西，也不在田的上方（那裡是田上標籤的位置）。
     R83C：ring＝2 時再往外一圈，只在緊貼的那一圈全被角色或任務那一格旁邊佔走時才用。 */
  function fieldEdgeTiles(state, ring) {
    const reach = ring === 2 ? 2 : 1;
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
    const dist = (t) => Math.min.apply(null, plots.map((p) => Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y))));
    return tiles.filter((t) => t.plotIndex == null && t.y >= topY && !t.npc && !t.structureId && !t.station && !t.object && !t.buildingId && !t.forage && !t.event && !t.bridge && !t.adventureSite && !nearSite(t)
      && walkable(t) && dist(t) === reach)
      .sort((x, y) => (x.x - y.x) || (x.y - y.y));
  }
  /* R83C 第 2 項：角色站在田上工作時，身體畫在那一格左邊（ui.js positionPlayer 的 stance）；所以除了角色站的格子，
     也讓開角色現在畫的位置、以及任務那一格（角色等一下要去的地方）左邊那一格，小事才不會疊在角色身上。 */
  function avoidTiles(state, step, now) {
    const tiles = (state.map && state.map.tiles) || [], byXY = (x, y) => tiles.find((t) => t.x === x && t.y === y);
    const busy = new Set();
    const standLeft = (tile) => { if (!tile) return; busy.add(tile.id); if (tile.plotIndex != null) { const left = byXY(tile.x - 1, tile.y); if (left) busy.add(left.id); } };
    const player = state.player || {};
    standLeft(player.tileId ? tiles.find((t) => t.id === player.tileId) : byXY(player.x, player.y));
    if (step && step.tileId) standLeft(tiles.find((t) => t.id === step.tileId));
    if (step && step.holdPlotIndex != null) standLeft(tiles.find((t) => t.plotIndex === step.holdPlotIndex));
    try { const A = adventure(), ev = A && A.worldEventObject ? A.worldEventObject(state, now) : null; if (ev && ev.tileId) busy.add(ev.tileId); } catch (_) { /* 沒有農場小事 */ }
    /* R85B 第 4 項：壞天氣時田邊立著雨水桶，小事讓開那一格。 */
    const rain = state.r85Rain && state.r85Rain.spell; if (rain && rain.tileId) busy.add(rain.tileId);
    return busy;
  }
  /* 瀏覽器可以掛一個偏好（例如畫面上看得到、沒被任務卡蓋住的格子）；沒掛或全不合時照原本的輪替。 */
  let tilePreference = null;
  function setTilePreference(fn) { tilePreference = typeof fn === "function" ? fn : null; }
  /* R85B 第 3 項：瀏覽器另外掛一個「一定要讓開」的檢查（被花叢這類擺飾蓋住的格子）。手機橫放（844×390）時田邊三格常有兩格在畫面外，
     原本偏好全部落空就照輪替放，麻雀會被放到花叢後面：圖被蓋住、點到花叢那半邊也不會跳出二選一（R84 圖 163）。
     先拿掉被蓋住的格子，再照原本的偏好挑；全部都被蓋住才照舊。 */
  let tileAvoid = null;
  function setTileAvoid(fn) { tileAvoid = typeof fn === "function" ? fn : null; }
  function pickTile(state, step, count, now) {
    const busy = avoidTiles(state, step, now);
    let free = fieldEdgeTiles(state, 1).filter((t) => !busy.has(t.id));
    if (!free.length) free = fieldEdgeTiles(state, 2).filter((t) => !busy.has(t.id));
    if (tileAvoid && free.length) {
      /* 緊貼的一圈與外一圈都先拿掉被擺飾蓋住的格子；再照偏好（畫面上看得到、沒被固定介面蓋住）先找緊貼的一圈、再找外一圈。 */
      const keep = (list) => { try { return list.filter((t) => !tileAvoid(t)); } catch (_) { return list; } };
      const like = (list) => { if (!tilePreference) return []; try { return list.filter((t) => tilePreference(t)); } catch (_) { return []; } };
      const ring1 = keep(free), ring2 = keep(fieldEdgeTiles(state, 2).filter((t) => !busy.has(t.id)));
      const liked = like(ring1).length ? like(ring1) : like(ring2);
      if (liked.length) return liked[count % liked.length];
      if (ring1.length) free = ring1; else if (ring2.length) free = ring2;
    }
    if (tilePreference && free.length > 1) { let liked = []; try { liked = free.filter((t) => tilePreference(t)); } catch (_) { liked = []; } if (liked.length) free = liked; }
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

  /* R83C 第 3 項：留穗之後，這一次會不會叼回種子——前一包還沒送到、離上一包不到五分鐘、或往回 24 小時已經兩包，就不會。 */
  function sparrowCanGift(state, now) {
    const sp = normalize(state).sparrow, t = whole(now);
    if (sp.giftAt) return false;
    const recent = sp.gifts.filter((at) => t - at < SPARROW_GIFT_DAY_MS);
    if (recent.length >= SPARROW_GIFT_DAY_CAP) return false;
    const last = sp.gifts.length ? Math.max.apply(null, sp.gifts) : 0;
    return !last || t - last >= SPARROW_GIFT_GAP_MS;
  }
  function sparrowChoices(state, now) {
    return SPARROW_CHOICES.map((row) => Object.assign({}, row, row.id === "share" && !sparrowCanGift(state, now) ? { detail: "這次只是請牠吃" } : {}));
  }

  /* 手札一行：記在農場小事的紀錄（r59.journal），手札「農場小事」那一區列最近幾行。 */
  function writeJournal(state, t, choiceId, text) {
    try {
      const A = adventure(); if (A && A.ensure) A.ensure(state, t);
      const r59 = state.adventure && state.adventure.r58 && state.adventure.r58.r59;
      if (!r59) return false;
      if (!Array.isArray(r59.journal)) r59.journal = [];
      r59.journal.push({ eventId: JOURNAL_PREFIX + "sparrow", choiceId, at: t, text }); r59.journal = r59.journal.slice(-40);
      return true;
    } catch (_) { return false; }
  }
  function journalLines(state, limit) {
    const r59 = state && state.adventure && state.adventure.r58 && state.adventure.r58.r59;
    const rows = r59 && Array.isArray(r59.journal) ? r59.journal.filter((row) => row && String(row.eventId || "").indexOf(JOURNAL_PREFIX) === 0) : [];
    return rows.slice(-(limit || 3)).map((row) => row.text);
  }

  function view(state, now) {
    const st = normalize(state); if (!st.active) return null;
    const chore = byId(st.active.id); if (!chore) return null;
    return { id: chore.id, key: st.active.id + "@" + st.active.startedAt, name: chore.name, label: chore.label, motion: chore.motion, art: chore.art, artMissing: MISSING_ART.includes(chore.art), rewardText: chore.rewardText,
      tileId: st.active.tileId, kind: st.active.kind, claimed: !!st.active.claimedAt, remainingMs: Math.max(0, st.active.expiresAt - now),
      choices: chore.id === "sparrow" ? sparrowChoices(state, now) : null };
  }
  function expire(st, now) {
    st.history.push({ id: st.active.id, at: now, result: "gone" }); st.history = st.history.slice(-HISTORY_CAP);
    st.lastId = st.active.id; st.active = null; st.expired += 1;
    st.cooldownUntil = now + ONBOARD_COOLDOWN_MS;
  }

  /* R83C 第 3 項：留穗的那隻麻雀回來了——到時間就把種子放進種子袋，寫進手札。 */
  function settleSparrowGift(state, t) {
    const st = normalize(state), sp = st.sparrow;
    if (!sp.giftAt || t < sp.giftAt) return null;
    sp.giftAt = 0;
    const A = adventure(); if (A && A.ensure) A.ensure(state, t);
    const r59 = state.adventure && state.adventure.r58 && state.adventure.r58.r59;
    let added = 0;
    if (r59) { if (!plain(r59.seedPacks)) r59.seedPacks = {}; const before = whole(r59.seedPacks[SPARROW_GIFT_SEED]); r59.seedPacks[SPARROW_GIFT_SEED] = Math.min(99, before + 1); added = r59.seedPacks[SPARROW_GIFT_SEED] - before; }
    sp.gifts.push(t); sp.gifts = sp.gifts.slice(-10); sp.given += 1;
    const text = added > 0 ? "田邊小事：留穗的那隻麻雀飛回來，叼來一顆小麥種子（小麥種子 1 包）。" : "田邊小事：留穗的那隻麻雀飛回來，叼來一顆小麥種子，可是種子袋已經滿了。";
    writeJournal(state, t, "gift", text);
    return { seeds: { [SPARROW_GIFT_SEED]: added }, message: added > 0 ? "麻雀飛回田邊，叼來一顆小麥種子。（小麥種子 1 包）" : "麻雀飛回田邊叼來種子，可是種子袋滿了。", journalText: text };
  }

  /* 每次畫面更新呼叫一次：記遊玩時間、收起過期的那件、該出現時冒出一件。回傳 { spawned, expired, active, gift }。 */
  function update(state, now) {
    const st = normalize(state), t = whole(now) || Date.now();
    if (st.lastSeenAt) st.playMs += Math.max(0, Math.min(PLAY_STEP_CAP_MS, t - st.lastSeenAt));
    st.lastSeenAt = t;
    const gift = settleSparrowGift(state, t);
    const wait = waitStatus(state, t);
    let expired = false, spawned = false;
    if (st.active) {
      const holding = st.active.claimedAt && t - st.active.claimedAt < CLAIM_HOLD_MS;
      if (wait.waiting) st.active.goneAt = 0; else if (!st.active.goneAt) st.active.goneAt = t;
      if (!holding && (t >= st.active.expiresAt || (st.active.goneAt && t - st.active.goneAt >= GRACE_MS))) { expire(st, t); expired = true; }
    }
    if (!wait.waiting) { st.waitSince = 0; return { spawned, expired, active: view(state, t), gift }; }
    if (!st.waitSince) st.waitSince = t;
    if (st.active || t < st.cooldownUntil) return { spawned, expired, active: view(state, t), gift };
    try { const A = adventure(); if (A && A.worldEventObject && A.worldEventObject(state, t)) return { spawned, expired, active: null, gift }; } catch (_) { /* 沒有農場小事 */ }
    const early = st.playMs < ONBOARD_MS;
    if (t - st.waitSince < (early ? ONBOARD_AFTER_MS : LATER_AFTER_MS)) return { spawned, expired, active: null, gift };
    if (!early && st.lastSpawnAt && t - st.lastSpawnAt < LATER_GAP_MS) return { spawned, expired, active: null, gift };
    if (wait.endsAt && wait.endsAt - t < MIN_LEFT_MS) return { spawned, expired, active: null, gift };
    const tile = pickTile(state, wait.step, st.spawned, t); if (!tile) return { spawned, expired, active: null, gift };
    const chore = pickChore(state, t);
    st.active = { id: chore.id, tileId: tile.id, startedAt: t, expiresAt: t + LIFE_MS, kind: wait.kind, claimedAt: 0, goneAt: 0 };
    st.spawned += 1; st.lastSpawnAt = t; spawned = true;
    return { spawned, expired, active: view(state, t), gift };
  }

  /* 玩家點了：先記下來，走過去的這幾秒不會被收走。 */
  function claim(state, now) {
    const st = normalize(state); if (!st.active) return { ok: false, reason: "gone", message: "這件小事已經過去了。" };
    st.active.claimedAt = whole(now) || Date.now();
    return { ok: true, active: view(state, now) };
  }
  function unclaim(state) { const st = normalize(state); if (st.active) st.active.claimedAt = 0; }

  /* 走到了：給小收穫，收起這件。麻雀可以帶 { choice: "shoo" | "share" }；沒帶就是趕走（跟 R82 一樣）。 */
  function resolve(state, now, options) {
    const st = normalize(state), t = whole(now) || Date.now();
    if (!st.active) return { ok: false, reason: "gone", message: "這件小事已經過去了。" };
    const chore = byId(st.active.id); const reward = {};
    const choice = chore.id === "sparrow" ? (options && options.choice === "share" ? "share" : "shoo") : "";
    let message = "", journalText = "", giftScheduled = false;
    if (choice === "share") {
      /* 留一把穗：當下不拿東西；這次能叼回種子的話，記下牠回來的時間。 */
      giftScheduled = sparrowCanGift(state, t);
      if (giftScheduled) st.sparrow.giftAt = t + SPARROW_GIFT_DELAY_MS;
      st.sparrow.shared += 1; st.sparrow.lastChoice = "share";
      message = "你在田埂留了一把穗，麻雀低頭啄了幾口才飛走。" + (giftScheduled ? "牠好像記住你了。" : "");
      journalText = "田邊小事：留了一把穗給麻雀" + (giftScheduled ? "，牠吃飽飛走前回頭看了你一眼。" : "，牠吃飽就飛走了。");
    } else {
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
      const got = Object.values(reward).some((v) => (plain(v) ? Object.values(v).some((n) => n > 0) : v > 0));
      message = chore.doneText + (got ? "（" + chore.rewardText + "）" : "");
      if (choice === "shoo") { st.sparrow.shooed += 1; st.sparrow.lastChoice = "shoo"; journalText = "田邊小事：把麻雀趕走了" + (got ? "，麥穗多接到一點光（陽光 1）。" : "。"); }
    }
    if (journalText) writeJournal(state, t, choice, journalText);
    st.rewardAt[chore.id] = t; st.done += 1; st.lastId = chore.id;
    st.history.push({ id: chore.id, at: t, result: "done" }); st.history = st.history.slice(-HISTORY_CAP);
    st.active = null; st.cooldownUntil = t + ONBOARD_COOLDOWN_MS;
    return { ok: true, id: chore.id, name: chore.name, choice: choice || null, reward, giftScheduled, journalText, message };
  }

  const API = { CHORES, SPARROW_CHOICES, MISSING_ART, R84C_ART_MIN, R84C_ART_TILE, ONBOARD_MS, ONBOARD_AFTER_MS, ONBOARD_COOLDOWN_MS, LATER_AFTER_MS, LATER_GAP_MS, MIN_LEFT_MS, LIFE_MS, GRACE_MS, CLAIM_HOLD_MS,
    SPARROW_GIFT_DELAY_MS, SPARROW_GIFT_GAP_MS, SPARROW_GIFT_DAY_MS, SPARROW_GIFT_DAY_CAP, SPARROW_GIFT_SEED,
    normalize, onboarding, waitStatus, fieldEdgeTiles, avoidTiles, pickTile, setTilePreference, setTileAvoid, update, view, claim, unclaim, resolve, sparrowCanGift, sparrowChoices, journalLines };
  if (isNode) { module.exports = API; return; }
  root.FarmWaitplay = API;
  if (typeof document === "undefined") return;

  /* ---------- 瀏覽器：田邊地上的那一件小事（R83C 第 2 項） ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const farm = () => root.__farm || null;
  function liveState() { const f = farm(); try { return f && typeof f.state === "function" ? f.state() : null; } catch (_) { return null; } }
  function tileBox(tileId) {
    const node = document.querySelector('.gtile[data-tile-id="' + tileId + '"]');
    const size = node ? parseFloat(node.style.width) : NaN; const tile = typeof Game.getTileById === "function" ? Game.getTileById(liveState(), tileId) : null;
    return node && tile && size > 0 ? { size, x: tile.x, y: tile.y, tile } : null;
  }
  /* 點擊範圍至少 44×44。格子比 44 小（縮放看整張地圖）時，多出來的那一截往離開田的方向推，不蓋到田格。 */
  function hitShift(state, tile) {
    const active = typeof Game.activePlotCount === "function" ? Game.activePlotCount(state) : 6;
    let dx = 0, dy = 0;
    ((state.map && state.map.tiles) || []).forEach((t) => {
      if (t.plotIndex == null || t.plotIndex >= active) return;
      const ox = t.x - tile.x, oy = t.y - tile.y; if (Math.max(Math.abs(ox), Math.abs(oy)) !== 1) return;
      dx -= Math.sign(ox); dy -= Math.sign(oy);
    });
    return { x: Math.sign(dx), y: Math.sign(dy) };
  }
  /* 偏好畫面上看得到、沒被固定介面（任務卡、種子欄、田邊動作列、工具列、小地圖、手機按鈕）蓋住、也沒有花叢水桶這類擺飾的格子。 */
  const HUD = ["#questDock", "#seedHud", "#sceneActionBar", "#farmDock", ".toolbar", "#worldMinimap", "header", "#mobileControls", "#actionA", "#sunChip", "#toast-zone .toast"];
  function tileOnScreen(tile) {
    try {
      const node = document.querySelector('.gtile[data-tile-id="' + tile.id + '"]'); if (!node) return false;
      const r = node.getBoundingClientRect(), pad = 4;
      if (r.left < pad || r.top < pad || r.right > root.innerWidth - pad || r.bottom > root.innerHeight - pad) return false;
      const area = r.width * r.height;
      if ([...document.querySelectorAll("#mapWorld .garden-prop")].some((el) => { const b = el.getBoundingClientRect(); return Math.max(0, Math.min(b.right, r.right) - Math.max(b.left, r.left)) * Math.max(0, Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top)) > area * 0.15; })) return false;
      return !HUD.some((sel) => [...document.querySelectorAll(sel)].some((el) => {
        if (el.hidden) return false; const b = el.getBoundingClientRect(); if (!b.width || !b.height) return false;
        const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") return false;
        return b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top;
      }));
    } catch (_) { return true; }
  }
  setTilePreference(tileOnScreen);
  /* R85B 第 3 項：被花叢、水桶這類擺飾蓋住超過一成五的格子，小事一定讓開（不只是偏好）。 */
  function tileUnderProp(tile) {
    const node = document.querySelector('.gtile[data-tile-id="' + tile.id + '"]'); if (!node) return false;
    const r = node.getBoundingClientRect(), area = r.width * r.height; if (!area) return false;
    return [...document.querySelectorAll("#mapWorld .garden-prop")].some((el) => { const b = el.getBoundingClientRect(); return Math.max(0, Math.min(b.right, r.right) - Math.max(b.left, r.left)) * Math.max(0, Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top)) > area * 0.15; });
  }
  setTileAvoid(tileUnderProp);

  function closeChoice(unclaimToo) {
    const pop = document.querySelector(".r83c-chore-choice"); if (pop) pop.remove();
    if (unclaimToo) { const s = liveState(); if (s) unclaim(s); }
  }
  function paint(state, now) {
    const world = document.getElementById("mapWorld"); if (!world) return;
    let node = world.querySelector(".r83c-chore");
    const current = view(state, now);
    if (!current || document.querySelector(".modal.show")) { if (node) node.remove(); closeChoice(false); return; }
    if (node && node.dataset.r83cChoreKey !== current.key) { node.remove(); node = null; closeChoice(false); }
    const box = tileBox(current.tileId); if (!box) { if (node) node.remove(); closeChoice(false); return; }
    if (!node) {
      node = document.createElement("button"); node.type = "button"; node.className = "r83c-chore is-new"; node.dataset.r83cChore = current.id; node.dataset.r83cChoreKey = current.key; node.dataset.tileId = current.tileId;
      node.dataset.audit = "r83c-chore"; node.dataset.motion = current.motion || "still";
      node.setAttribute("aria-label", current.choices ? current.label + "：點一下，選要趕走牠還是留一把穗給牠" : current.name + "：點一下走過去，可以拿到" + current.rewardText);
      /* 缺圖時只留小名牌與一顆小圓點，不顯示破圖。 */
      node.innerHTML = '<span class="r83c-chore-sprite"><img class="r83c-chore-art" src="' + esc(current.art + (root.FARM_VERSION_QUERY || "")) + '" alt="" draggable="false"></span><b class="r83c-chore-tag">' + esc(current.label) + "</b>";
      const img = node.querySelector("img"); img.onerror = () => { node.classList.add("is-missing-art"); img.remove(); };
      node.onclick = (event) => { event.stopPropagation(); const s = liveState(); const v = s && view(s, Date.now()); if (v && v.choices) openChoice(); else go(); };
      world.appendChild(node);
      setTimeout(() => node.classList.remove("is-new"), 450);
    }
    node.classList.toggle("is-claimed", current.claimed);
    const player = state.player || {}, ptile = player.tileId && typeof Game.getTileById === "function" ? Game.getTileById(state, player.tileId) : null;
    node.classList.toggle("is-near", !!(ptile && Math.max(Math.abs(ptile.x - box.x), Math.abs(ptile.y - box.y)) <= 1));
    /* 圖跟著格子大小；點擊範圍至少 44×44，底部貼著這一格的地面。疊放順序比同一列的角色低，角色走過去時畫在小事前面。 */
    /* R84C 第 3 項：一般視角（格子至少 48px）圖至少畫 40px，64px 縮圖也認得出是什麼；最大不超過格子的九成，不壓到隔壁的田。
       縮放看整張地圖時格子很小，照原本比例縮小，不蓋到旁邊的田。 */
    const T = box.size, hit = Math.max(44, Math.round(T * 0.7)), artBase = Math.round(T * (current.id === "sparrow" || current.id === "weed" ? 0.62 : 0.5));
    const art = T >= R84C_ART_TILE ? Math.min(Math.floor(T * 0.9), Math.max(R84C_ART_MIN, Math.round(T * 0.62))) : Math.max(Math.min(16, Math.floor(T * 0.9)), artBase);
    /* 縮放看整張地圖（格子小於一般視角）時名牌比格子還寬，常駐會蓋到旁邊的田；這時照 R83C 只在靠近、停留或點選時出現。 */
    node.classList.toggle("r84c-small-tile", T < R84C_ART_TILE);
    const shift = hit > T ? hitShift(state, box.tile) : { x: 0, y: 0 }, over = Math.max(0, (hit - T) / 2);
    const left = Math.round((box.x + 0.5) * T - hit / 2 + shift.x * over);
    const top = Math.round(hit <= T ? (box.y + 1) * T - hit - T * 0.04 : (box.y + 0.5) * T - hit / 2 + shift.y * over);
    /* 圖永遠站在自己那一格的地上：點擊範圍被推開時，圖不跟著跑（--r83c-cx 是格子中心離點擊範圍左邊多遠、--r83c-by 是格子地面離點擊範圍底邊多遠）。 */
    const cx = Math.round((box.x + 0.5) * T - left), by = Math.max(0, Math.round(top + hit - ((box.y + 1) * T - T * 0.04))) + 2;
    const sig = [left, top, hit, art, cx, by, Math.round((box.y + 1) * T - T * 0.3)].join("|");
    if (node.dataset.r83cBox !== sig) {
      node.dataset.r83cBox = sig;
      /* R85B 第 3 項：跟擺飾疊到時畫在擺飾上面，整個點擊範圍都點得到（R84 圖 163 點到花叢那半邊不會跳出二選一）。 */
      const r = { left, top, right: left + hit, bottom: top + hit }; let z = Math.round((box.y + 1) * T - T * 0.3);
      document.querySelectorAll("#mapWorld .garden-prop").forEach((el) => { const l = parseFloat(el.style.left) || 0, t = parseFloat(el.style.top) || 0, w = parseFloat(el.style.width) || 0, h = parseFloat(el.style.height) || 0; if (l < r.right && l + w > r.left && t < r.bottom && t + h > r.top) z = Math.max(z, (parseInt(getComputedStyle(el).zIndex, 10) || 0) + 1); });
      node.style.cssText = "left:" + left + "px;top:" + top + "px;width:" + hit + "px;height:" + hit + "px;z-index:" + z + ";--r83c-art:" + art + "px;--r83c-cx:" + cx + "px;--r83c-by:" + by + "px;";
    }
    const pop = document.querySelector(".r83c-chore-choice");
    if (pop) { if (pop.dataset.r83cChoreKey !== current.key) closeChoice(false); else placeChoice(pop, node); }
  }
  /* 小框先放在離開田的那一側，畫面放不下、或會蓋到角色、田格、固定介面時，依序換到另一側、下方、上方。 */
  function placeChoice(pop, node) {
    const l = parseFloat(node.style.left) || 0, t = parseFloat(node.style.top) || 0, w = parseFloat(node.style.width) || 44, h = parseFloat(node.style.height) || 44;
    const s = liveState(), tile = s && typeof Game.getTileById === "function" ? Game.getTileById(s, node.dataset.tileId) : null, away = s && tile ? hitShift(s, tile) : { x: 0, y: 0 };
    const spots = {
      left: [l - 6, t + h / 2, "translate(-100%, -50%)"], right: [l + w + 6, t + h / 2, "translate(0, -50%)"],
      below: [l + w / 2, t + h + 6, "translate(-50%, 0)"], above: [l + w / 2, t - 6, "translate(-50%, -100%)"],
    };
    const order = (away.x > 0 ? ["right", "left"] : ["left", "right"]).concat(away.y < 0 ? ["above", "below"] : ["below", "above"]);
    const active = s && typeof Game.activePlotCount === "function" ? Game.activePlotCount(s) : 6;
    const blockers = [document.getElementById("player")].concat(s && s.map ? s.map.tiles.filter((x) => x.plotIndex != null && x.plotIndex < active).map((x) => document.querySelector('.gtile[data-tile-id="' + x.id + '"]')) : [])
      .concat(HUD.map((sel) => document.querySelector(sel))).filter((el) => el && !el.hidden).map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height);
    const fits = () => { const r = pop.getBoundingClientRect(); return r.left >= 4 && r.top >= 4 && r.right <= root.innerWidth - 4 && r.bottom <= root.innerHeight - 4 && !blockers.some((b) => b.left < r.right - 1 && b.right > r.left + 1 && b.top < r.bottom - 1 && b.bottom > r.top + 1); };
    const put = (key) => { const p = spots[key]; pop.style.left = Math.round(p[0]) + "px"; pop.style.top = Math.round(p[1]) + "px"; pop.style.transform = p[2]; pop.dataset.r83cSide = key; };
    const same = pop.dataset.r83cSide && spots[pop.dataset.r83cSide];
    if (same) { put(pop.dataset.r83cSide); if (fits()) return; }
    for (const key of order) { put(key); if (fits()) return; }
    put(order[0]);
  }
  /* R83C 第 3 項：麻雀二選一。小框貼在麻雀上方，兩顆一樣大的次要鈕。 */
  function openChoice() {
    const s = liveState(), world = document.getElementById("mapWorld"), node = world && world.querySelector(".r83c-chore"); if (!s || !node) return;
    const current = view(s, Date.now()); if (!current || !current.choices) return;
    closeChoice(false); claim(s, Date.now()); node.classList.add("is-claimed");
    const pop = document.createElement("div"); pop.className = "r83c-chore-choice"; pop.dataset.audit = "r83c-chore-choice"; pop.dataset.r83cChoreKey = current.key;
    pop.setAttribute("role", "group"); pop.setAttribute("aria-label", current.label + "：選一個做法");
    pop.innerHTML = current.choices.map((c) => '<button type="button" data-r83c-choice="' + esc(c.id) + '"><span>' + esc(c.label) + "</span><small>" + esc(c.detail) + "</small></button>").join("");
    pop.addEventListener("click", (event) => { event.stopPropagation(); const b = event.target.closest("[data-r83c-choice]"); if (!b) return; const id = b.dataset.r83cChoice; closeChoice(false); go(id); });
    world.appendChild(pop); placeChoice(pop, node);
    const first = pop.querySelector("button"); if (first && first.focus) try { first.focus({ preventScroll: true }); } catch (_) { first.focus(); }
  }
  document.addEventListener("click", (event) => { const pop = document.querySelector(".r83c-chore-choice"); if (pop && !pop.contains(event.target) && !(event.target.closest && event.target.closest(".r83c-chore"))) closeChoice(true); }, true);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && document.querySelector(".r83c-chore-choice")) closeChoice(true); });

  /* 手札「農場小事」那一區加一張小卡，列最近三行田邊小事的結果。手札每次重畫完會發 farm-panel-rendered。 */
  function paintJournal() {
    const s = liveState(); if (!s) return;
    const host = document.querySelector("#adventurePanel .r58-section"); if (!host) return;
    const lines = journalLines(s, 3); let card = host.querySelector("[data-r83c-chore-log]");
    if (!lines.length) { if (card) card.remove(); return; }
    if (!card) {
      card = document.createElement("div"); card.className = "r58-card r83c-chore-log"; card.dataset.r83cChoreLog = "";
      const note = host.querySelector(".r60-event-note, .r60-event-card"); if (note) note.after(card); else host.prepend(card);
    }
    const html = "<h4>田邊小事</h4>" + lines.map((line) => "<p>" + esc(line) + "</p>").join("");
    if (card.innerHTML !== html) card.innerHTML = html;
  }
  root.addEventListener("farm-panel-rendered", () => { try { paintJournal(); } catch (_) { /* 手札畫不出來不影響主遊戲 */ } });

  function go(choice) {
    const s = liveState(), f = farm(); if (!s || !f) return;
    const current = view(s, Date.now()); if (!current) return;
    claim(s, Date.now());
    const started = typeof f.travelAndDo === "function" && f.travelAndDo(current.tileId, "collect", () => {
      const r = resolve(s, Date.now(), choice ? { choice } : undefined);
      if (f.toast) f.toast(r.message);
      if (r.ok && f.safeSaveNow) { try { f.safeSaveNow(); } catch (_) { /* 存檔失敗由主程式提示 */ } }
      paint(s, Date.now()); paintJournal();
    });
    if (!started) unclaim(s);
    paint(s, Date.now());
  }
  function tick() {
    if (document.hidden) return;
    const s = liveState(); if (!s || !s.map) return;
    try {
      const r = update(s, Date.now()); paint(s, Date.now());
      if (r && r.gift) { const f = farm(); if (f && f.toast) f.toast(r.gift.message); if (f && f.safeSaveNow) { try { f.safeSaveNow(); } catch (_) { /* 存檔失敗由主程式提示 */ } } paintJournal(); }
    } catch (_) { /* 小事出錯不影響主遊戲 */ }
  }
  setInterval(tick, 300);
})(typeof window !== "undefined" ? window : globalThis);
