/* =========================================================================
 * sunbook-r76.js — R76C 追光手冊（手札圖鑑頁最上面的集章冊）
 * 每種已解鎖作物一列，最多四格印章：光裡收成／光性達成／曬成乾貨／煮成絕品。
 * 純規則可由 Node 測試；瀏覽器段只負責手冊區塊與集章小卡。
 * 接線：
 *   收成　　＝從外面包住 FarmSunplay.harvestEffects（game.js 每次真的收成都會呼叫一次），
 *   　　　　　光性有沒有達成直接看它回傳的結果，這裡不另寫一份光性判定。
 *   曬架收下＝sunplay-r75.js collectDrying 的一行掛勾（onDried）。
 *   絕品料理＝cooking-r75.js recordGrade 的一行掛勾（onPerfect）。
 *   里程碑的永久加成存在 state.sunbook.bonus，由 sunplay-r75.js 的容量與折光次數讀取。
 * ========================================================================= */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const C = isNode ? require("./config.js") : (root.CONFIG || root);
  const Sunplay = isNode ? require("./sunplay-r75.js") : (root.FarmSunplay || null);
  const Game = isNode ? require("./game.js") : (root.Game || root);
  const Adventure = isNode ? require("./adventure.js") : (root.AdventureAPI || null);
  const Cooking = isNode ? require("./cooking-r75.js") : (root.CookingR75 || null);

  const STAMP_ORDER = ["lit", "trait", "dried", "perfect"];
  const STAMPS = {
    lit: { id: "lit", name: "光裡收成" },
    trait: { id: "trait", name: "光性達成" },
    dried: { id: "dried", name: "曬成乾貨" },
    perfect: { id: "perfect", name: "煮成絕品" },
  };
  /* R78C：第一份改為非金幣獎勵，不再用 120 金壓過 Lv 2 經濟；舊存檔已領的 120 金仍照實保留。 */
  const MILESTONES = [
    { count: 3, coins: 0, sunlight: 1, jar: 1 },
    { count: 6, coins: 240, seedPacks: 6 },
    { count: 10, coins: 400, mirror: 1 },
    { count: 15, coins: 800, jar: 1, fillJar: true },
  ];
  const LAST_COUNT = MILESTONES[MILESTONES.length - 1].count;
  const SEED_PACK_CAP = 99;

  function plain(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
  function whole(value) { return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0; }
  function stampTime(value) { return value === true ? 1 : whole(value); }
  function crops() { return (C && C.CROPS) || {}; }
  function cropIds() { return Object.keys(crops()); }
  function cropName(cropId) { return (crops()[cropId] || {}).name || "作物"; }
  function isUnlocked(state, cropId) {
    const crop = crops()[cropId]; if (!crop) return false;
    if (Game && typeof Game.isCropUnlocked === "function") return !!Game.isCropUnlocked(state, cropId);
    return (crop.unlockLevel || 1) <= (state.level || 1);
  }
  function traitOf(cropId) { return Sunplay && typeof Sunplay.trait === "function" ? Sunplay.trait(cropId) : "neutral"; }
  function traitInfo(kind) { return (Sunplay && Sunplay.TRAIT_INFO && Sunplay.TRAIT_INFO[kind]) || { icon: "", name: "", text: "" }; }
  function driedFor(cropId) {
    const table = (Sunplay && Sunplay.DRIED) || {};
    for (const id of Object.keys(table)) if (table[id].cropId === cropId) return table[id];
    return null;
  }

  /* 食譜材料表是固定資料，讀到一次就記著，不必每次重跑冒險狀態檢查。 */
  let recipeDefs = null;
  function recipeList(state) {
    if (recipeDefs) return recipeDefs;
    if (!Adventure || typeof Adventure.recipes !== "function" || !state) return [];
    let list = [];
    try { list = Adventure.recipes(state) || []; } catch (_) { list = []; }
    if (list.length) recipeDefs = list.map(function (r) { return { id: r.id, name: r.name, ingredients: Object.assign({}, r.ingredients) }; });
    return recipeDefs || [];
  }
  function recipesUsing(state, cropId) { return recipeList(state).filter(function (r) { return (r.ingredients[cropId] || 0) > 0; }); }

  /* ---------- 存檔欄位 state.sunbook ----------
   * stamps ：{ 作物: { lit, trait, dried, perfect: 蓋章時間 } }，只記拿到的
   * claimed：{ "3": { at, coins, sunlight, jar, mirror, seeds } }，領過的里程碑與實際拿到的東西
   * bonus  ：{ jar, mirror }，由 claimed 推出來的永久加成
   * hinted ：第一次提示給過了　folded：手冊收合中 */
  const cleaned = typeof WeakSet === "function" ? new WeakSet() : null;
  function bonusFrom(claimed) {
    const bonus = { jar: 0, mirror: 0 };
    for (const m of MILESTONES) if (claimed[m.count]) { bonus.jar += m.jar || 0; bonus.mirror += m.mirror || 0; }
    return bonus;
  }
  function normalize(state) {
    if (!state || typeof state !== "object") return state;
    if (cleaned && state.sunbook && cleaned.has(state.sunbook)) return state;
    const old = plain(state.sunbook), oldStamps = plain(old.stamps), oldClaimed = plain(old.claimed);
    const stamps = {};
    for (const cropId of cropIds()) {
      const row = plain(oldStamps[cropId]), keep = {};
      for (const id of STAMP_ORDER) { const at = stampTime(row[id]); if (at) keep[id] = at; }
      if (Object.keys(keep).length) stamps[cropId] = keep;
    }
    const claimed = {};
    for (const m of MILESTONES) {
      const raw = oldClaimed[m.count]; if (!raw) continue;
      const rec = plain(raw), seeds = {}, oldSeeds = plain(rec.seeds);
      for (const cropId of cropIds()) { const n = whole(oldSeeds[cropId]); if (n) seeds[cropId] = n; }
      claimed[m.count] = { at: whole(rec.at), coins: whole(rec.coins), sunlight: whole(rec.sunlight), jar: m.jar || 0, mirror: m.mirror || 0, seeds: seeds };
    }
    const book = { stamps: stamps, claimed: claimed, bonus: bonusFrom(claimed), hinted: !!old.hinted, folded: old.folded === true };
    state.sunbook = book;
    if (cleaned) cleaned.add(book);
    return state;
  }

  /* ---------- 哪些格子看得到 ---------- */
  function slotIds(state, cropId) {
    if (!crops()[cropId]) return [];
    const out = ["lit"];
    if (traitOf(cropId) !== "neutral") out.push("trait");
    if (driedFor(cropId)) out.push("dried");
    if (recipesUsing(state, cropId).length) out.push("perfect");
    return out;
  }
  function countsRaw(state) {
    const book = state.sunbook; let got = 0, total = 0;
    for (const cropId of cropIds()) {
      if (!isUnlocked(state, cropId)) continue;
      const row = book.stamps[cropId] || {};
      for (const id of slotIds(state, cropId)) { total += 1; if (row[id]) got += 1; }
    }
    return { got: got, total: total };
  }
  function counts(state) { normalize(state); flush(); return countsRaw(state); }
  /* R82C 第 4 項：一種作物蓋了幾枚，寫成「小麥 1／4 枚」。 */
  function cropCountText(state, cropId) {
    const row = (state.sunbook && state.sunbook.stamps && state.sunbook.stamps[cropId]) || {}, ids = slotIds(state, cropId);
    return cropName(cropId) + " " + ids.filter(function (id) { return !!row[id]; }).length + "／" + ids.length + " 枚";
  }

  /* ---------- 還沒拿到的印章：一句話寫怎麼拿 ---------- */
  function hintFor(state, cropId, stampId) {
    const name = cropName(cropId);
    if (stampId === "lit") return "等陽光照到田上，在光裡收成" + name + "。"; /* R83C：統一說法 */
    if (stampId === "trait") {
      const kind = traitOf(cropId);
      if (kind === "sun") return "在光裡種下、照料或收成" + name + "，收成時會多收 1 份。";
      if (kind === "partial") return "從種下到收成，讓" + name + "剛好照到 1 次光，就會收到 1 份優質；照到第 2 次不算。";
      if (kind === "shade") return "從種下到收成都別讓" + name + "照到光，收成時整批都是優質就蓋章，沒中就再種一批。";
      return traitInfo(kind).text || "";
    }
    if (stampId === "dried") { const dried = driedFor(cropId); return "帶 2 份" + name + "和 1 點陽光到曬架，曬成" + (dried ? dried.name : "乾貨") + "以後收下來。"; }
    if (stampId === "perfect") { const recipe = recipesUsing(state, cropId)[0]; return "在灶台煮用到" + name + "的料理" + (recipe ? "（像是" + recipe.name + "）" : "") + "，把火候顧到絕品。"; }
    return "";
  }
  /* 印章與封面的專用圖（R76，MUSE 出圖後去背縮小），放在 content-r76。 */
  const ART_DIR = "assets/generated/content-r76/";
  const COVER_ART = ART_DIR + "sunbook_cover.png";
  function iconFor(cropId, stampId) {
    if (stampId === "lit") return ART_DIR + "stamp_lit.png";
    if (stampId === "trait") { const kind = traitOf(cropId); return kind === "sun" || kind === "partial" || kind === "shade" ? ART_DIR + "stamp_trait_" + kind + ".png" : ""; }
    if (stampId === "dried") return ART_DIR + "stamp_dried.png";
    if (stampId === "perfect") return ART_DIR + "stamp_perfect.png";
    return "";
  }

  /* ---------- 蓋章與通知事件 ---------- */
  const events = [];
  function stamp(state, cropId, stampId, at) {
    normalize(state);
    if (!crops()[cropId] || !STAMPS[stampId]) return false;
    if (slotIds(state, cropId).indexOf(stampId) < 0) return false;
    const book = state.sunbook, row = book.stamps[cropId] || (book.stamps[cropId] = {});
    if (row[stampId]) return false;
    const visible = isUnlocked(state, cropId);
    const before = visible ? countsRaw(state).got : 0;
    row[stampId] = whole(at) || Date.now();
    /* 還沒解鎖的作物先記著，等那一列出現時就已經蓋好，不另外通知。 */
    if (!visible) return true;
    const now = countsRaw(state), first = !book.hinted;
    book.hinted = true;
    let milestone = 0;
    for (const m of MILESTONES) if (!book.claimed[m.count] && before < m.count && now.got >= m.count) milestone = m.count;
    /* R77C 第 15 項：畫面上看到的分母統一用里程碑的 15 枚，不再跟已解鎖格數混用。 */
    const nextMile = MILESTONES.filter(function (m) { return !book.claimed[m.count] && m.count > now.got; })[0] || null;
    /* R82C 第 4 項：小卡改按作物計（「小麥 1／4 枚」），跟手冊那一列同一種寫法；全冊枚數只留在里程碑。 */
    const cropText = cropCountText(state, cropId);
    events.push({ state: state, cropId: cropId, stampId: stampId, cropName: cropName(cropId), stampName: STAMPS[stampId].name, got: now.got, total: now.total,
      displayGot: Math.min(now.got, LAST_COUNT), displayTotal: LAST_COUNT,
      nextCount: nextMile ? nextMile.count : 0, nextRemaining: nextMile ? nextMile.count - now.got : 0, nextRewardText: nextMile ? rewardParts(state, nextMile).join("、") : "",
      cropCountText: cropText,
      text: "追光手冊：" + cropName(cropId) + "・" + STAMPS[stampId].name + "（" + cropText + "）", first: first, milestone: milestone });
    if (events.length > 40) events.shift();
    return true;
  }
  function takeEvents(state) {
    flush();
    const mine = [];
    for (let i = 0; i < events.length;) {
      if (!state || events[i].state === state) { const e = Object.assign({}, events[i]); delete e.state; mine.push(e); events.splice(i, 1); } else i += 1;
    }
    return mine;
  }

  /* 收成：harvestEffects 被呼叫時先記一筆，等田格真的被收掉才蓋章。
     只是試算（田格沒變）或倉庫全滿一份都沒收進來，就不蓋。 */
  let pending = null, drainTimer = 0, drainFn = null;
  function harvestedCount(state, cropId) { return whole(((state.stats || {}).harvested || {})[cropId]); }
  function qualityCount(state, cropId) { return whole(((state.storage || {}).quality || {})[cropId]); }
  function flush() {
    const p = pending; pending = null;
    if (!p) return;
    try {
      if (p.plot.cropId === p.cropId && p.plot.plantedAt === p.plantedAt) return;
      if (harvestedCount(p.state, p.cropId) <= p.harvested) return;
      if (p.lit) stamp(p.state, p.cropId, "lit");
      /* 光性有沒有達成，直接讀這次收成 harvestEffects 回的結果：
         喜光＝多收（yieldBonus）；半日照＝保證 1 份優質（guaranteedQuality）；
         耐陰＝全程沒照到（qualityBonusChance 有值）而且這批真的進了優質倉。 */
      const e = p.effect || {};
      if (e.yieldBonus > 0 || e.guaranteedQuality || (e.qualityBonusChance > 0 && qualityCount(p.state, p.cropId) > p.quality)) stamp(p.state, p.cropId, "trait");
    } catch (_) { /* 手冊出錯不影響收成 */ }
  }
  function schedule() {
    if (typeof document === "undefined" || drainTimer || typeof drainFn !== "function") return;
    drainTimer = setTimeout(function () { drainTimer = 0; drainFn(); }, 0);
  }
  function noteDried(state, itemId) {
    const dried = Sunplay && Sunplay.DRIED ? Sunplay.DRIED[itemId] : null;
    return dried ? stamp(state, dried.cropId, "dried") : false;
  }
  function notePerfect(state, recipeId) {
    const recipe = recipeList(state).filter(function (r) { return r.id === recipeId; })[0];
    if (!recipe) return false;
    let any = false;
    for (const id of Object.keys(recipe.ingredients)) if (crops()[id] && stamp(state, id, "perfect")) any = true;
    return any;
  }
  function install() {
    if (Sunplay && !Sunplay.__r76cSunbook && typeof Sunplay.harvestEffects === "function") {
      const original = Sunplay.harvestEffects;
      Sunplay.__r76cSunbook = true;
      Sunplay.harvestEffects = function (state, plot, rng, exposedNow) {
        try { flush(); } catch (_) { /* 手冊出錯不影響收成 */ }
        const effect = original.apply(this, arguments);
        try {
          if (state && typeof state === "object" && plot && plot.cropId) {
            pending = { state: state, plot: plot, cropId: plot.cropId, plantedAt: plot.plantedAt, lit: !!exposedNow, effect: effect,
              harvested: harvestedCount(state, plot.cropId), quality: qualityCount(state, plot.cropId) };
            schedule();
          }
        } catch (_) { pending = null; }
        return effect;
      };
      Sunplay.onDried = function (state, itemId) { try { noteDried(state, itemId); schedule(); } catch (_) { /* 手冊出錯不影響曬架 */ } };
    }
    if (Cooking && !Cooking.__r76cSunbook) {
      Cooking.__r76cSunbook = true;
      Cooking.onPerfect = function (state, recipeId) { try { notePerfect(state, recipeId); schedule(); } catch (_) { /* 手冊出錯不影響料理 */ } };
    }
  }

  /* ---------- 手冊內容 ---------- */
  function rows(state) {
    normalize(state); flush();
    const book = state.sunbook;
    return cropIds().filter(function (id) { return isUnlocked(state, id); }).map(function (cropId) {
      const crop = crops()[cropId], got = book.stamps[cropId] || {}, kind = traitOf(cropId);
      const cells = slotIds(state, cropId).map(function (id) {
        return { id: id, name: STAMPS[id].name, got: !!got[id], at: got[id] || 0, hint: got[id] ? "" : hintFor(state, cropId, id),
          icon: iconFor(cropId, id), glyph: id === "trait" ? traitInfo(kind).icon : "" };
      });
      return { cropId: cropId, name: crop.name, emoji: crop.emoji || "", trait: kind, traitName: kind === "neutral" ? "" : traitInfo(kind).name,
        cells: cells, got: cells.filter(function (c) { return c.got; }).length, total: cells.length };
    });
  }

  /* 種子包：送給已解鎖的喜光作物，挑解鎖等級最高的兩種平分；只有一種就全給它。 */
  function seedPlan(state, total) {
    const pick = cropIds().filter(function (id) { return traitOf(id) === "sun" && isUnlocked(state, id); })
      .sort(function (a, b) { return (crops()[b].unlockLevel || 0) - (crops()[a].unlockLevel || 0); }).slice(0, 2);
    if (!pick.length) pick.push(cropIds()[0]);
    const plan = {}, each = Math.floor(total / pick.length); let rest = total - each * pick.length;
    for (const id of pick) { plan[id] = each + (rest > 0 ? 1 : 0); rest -= 1; }
    return plan;
  }
  function rewardParts(state, m) {
    const parts = [];
    if (m.coins) parts.push("金幣 " + m.coins);
    if (m.sunlight) parts.push("陽光 " + m.sunlight + " 點");
    if (m.jar) parts.push(m.fillJar ? "蓄光瓶永久再多裝 " + m.jar + " 點並直接裝滿" : "蓄光瓶永久多裝 " + m.jar + " 點");
    if (m.seedPacks) {
      const plan = seedPlan(state, m.seedPacks);
      parts.push("喜光作物的種子 " + m.seedPacks + " 包（" + Object.keys(plan).map(function (id) { return cropName(id) + " " + plan[id] + " 包"; }).join("、") + "）");
    }
    if (m.mirror) parts.push("手鏡每道光永久多折 " + m.mirror + " 次");
    return parts;
  }
  function gotParts(rec) {
    const parts = [];
    if (rec.coins > 0) parts.push("金幣 " + rec.coins);
    if (rec.sunlight > 0) parts.push("陽光 " + rec.sunlight + " 點");
    if (rec.jar > 0) parts.push("蓄光瓶永久多裝 " + rec.jar + " 點");
    for (const id of Object.keys(rec.seeds || {})) if (rec.seeds[id] > 0) parts.push(cropName(id) + "種子 " + rec.seeds[id] + " 包");
    if (rec.mirror > 0) parts.push("手鏡每道光永久多折 " + rec.mirror + " 次");
    return parts;
  }
  function summary(state) {
    normalize(state); flush();
    const c = countsRaw(state), book = state.sunbook;
    const milestones = MILESTONES.map(function (m) {
      const rec = book.claimed[m.count] || null;
      return { count: m.count, claimed: !!rec, claimable: !rec && c.got >= m.count, remaining: Math.max(0, m.count - c.got),
        rewardText: rewardParts(state, m).join("、"), gotText: rec ? gotParts(rec).join("、") : "" };
    });
    const next = milestones.filter(function (m) { return !m.claimed && !m.claimable; })[0] || null;
    const unlockedCount = cropIds().filter(function (id) { return isUnlocked(state, id); }).length;
    return { got: c.got, total: c.total, milestones: milestones,
      claimable: milestones.filter(function (m) { return m.claimable; }).map(function (m) { return m.count; }),
      next: next ? { count: next.count, remaining: next.remaining } : null,
      lockedCrops: cropIds().length - unlockedCount, hinted: book.hinted, folded: book.folded, bonus: { jar: book.bonus.jar, mirror: book.bonus.mirror } };
  }

  /* 領里程碑獎勵：領過不重複領，實際拿到的東西記在 claimed，畫面照這份紀錄寫。 */
  function claim(state, count, now) {
    normalize(state); flush();
    const m = MILESTONES.filter(function (x) { return x.count === Number(count); })[0];
    if (!m) return { ok: false, reason: "unknown" };
    const book = state.sunbook;
    if (book.claimed[m.count]) return { ok: false, reason: "claimed" };
    const c = countsRaw(state);
    if (c.got < m.count) return { ok: false, reason: "not_yet", remaining: m.count - c.got };
    const at = whole(now) || Date.now();
    const rec = { at: at, coins: 0, sunlight: 0, jar: m.jar || 0, mirror: m.mirror || 0, seeds: {} };
    const seeds = m.seedPacks ? seedPlan(state, m.seedPacks) : null;
    /* 先記領取與永久加成，蓄光瓶變大以後再倒陽光進去，送的陽光才裝得下。 */
    book.claimed[m.count] = rec;
    book.bonus = bonusFrom(book.claimed);
    if (m.coins) {
      state.coins = (state.coins || 0) + m.coins;
      if (!state.stats || typeof state.stats !== "object") state.stats = {};
      state.stats.totalCoinsEarned = (state.stats.totalCoinsEarned || 0) + m.coins;
      rec.coins = m.coins;
    }
    if (Sunplay && (m.sunlight || m.fillJar)) rec.sunlight = whole(Sunplay.addSunlight(state, m.fillJar ? Sunplay.bottleCapacity(state) : m.sunlight));
    if (seeds) {
      if (Adventure && typeof Adventure.ensure === "function") { try { Adventure.ensure(state, at); } catch (_) { /* 沒有冒險資料時下面自己補 */ } }
      const adventure = state.adventure = plain(state.adventure) === state.adventure ? state.adventure : {};
      const r58 = adventure.r58 = plain(adventure.r58) === adventure.r58 ? adventure.r58 : {};
      const r59 = r58.r59 = plain(r58.r59) === r58.r59 ? r58.r59 : {};
      const packs = r59.seedPacks = plain(r59.seedPacks) === r59.seedPacks ? r59.seedPacks : {};
      for (const id of Object.keys(seeds)) {
        const before = whole(packs[id]), after = Math.min(SEED_PACK_CAP, before + seeds[id]);
        packs[id] = after;
        if (after > before) rec.seeds[id] = after - before;
      }
    }
    return { ok: true, count: m.count, reward: rec, text: gotParts(rec).join("、") };
  }
  function sync(state) { flush(); return normalize(state); }

  const API = { STAMPS: STAMPS, STAMP_ORDER: STAMP_ORDER, MILESTONES: MILESTONES, LAST_COUNT: LAST_COUNT, normalize: normalize, slotIds: slotIds, rows: rows, counts: counts, summary: summary,
    claim: claim, sync: sync, takeEvents: takeEvents, cropCountText: cropCountText, noteDried: noteDried, notePerfect: notePerfect, hintFor: hintFor, install: install };
  install();
  if (isNode) { module.exports = API; return; }
  root.FarmSunbook = API;
  if (typeof document === "undefined") return;

  /* ---------- 瀏覽器：手冊區塊 ---------- */
  const esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); };
  const versionQuery = function () { return root.FARM_VERSION_QUERY || ""; };
  const farm = function () { return root.__farm || null; };
  function liveState() {
    const f = farm();
    try { return f && typeof f.state === "function" ? f.state() : null; } catch (_) { return null; }
  }
  function toast(text) { const f = farm(); if (f && f.toast) f.toast(text); }
  function save() { const f = farm(); if (f && f.safeSaveNow) { try { f.safeSaveNow(); } catch (_) { /* 存檔失敗由主程式提示 */ } } }
  function art(path) { return esc(path + versionQuery()); }

  function sealHtml(cell) {
    /* 還沒蓋的格子放一枚淡淡的灰章，看得出這一格要集的是哪一枚。 */
    if (!cell.got) return '<span class="r76c-seal is-empty" aria-hidden="true">' + (cell.icon ? '<img src="' + art(cell.icon) + '" alt="">' : "") + "</span>";
    if (cell.icon) return '<span class="r76c-seal is-got has-art" aria-hidden="true"><img src="' + art(cell.icon) + '" alt=""></span>';
    return '<span class="r76c-seal is-got" aria-hidden="true"><span class="r76c-glyph">' + esc(cell.glyph || "✓") + "</span></span>";
  }
  function bookHtml(state) {
    const sum = summary(state), list = rows(state);
    const shown = Math.min(LAST_COUNT, sum.got), percent = Math.round(shown / LAST_COUNT * 1000) / 10;
    let nextText = "";
    if (sum.claimable.length) nextText = "有獎勵可以領了，打開下方里程碑領取。";
    else if (sum.next) {
      const target = sum.milestones.filter(function (m) { return m.count === sum.next.count; })[0];
      nextText = "再蓋 " + sum.next.remaining + " 枚可領：" + (target ? target.rewardText : "下一份里程碑獎勵");
    }
    else nextText = "四份獎勵都領完了，剩下的印章可以慢慢蓋。";
    /* R78C：摘要只報已蓋枚數；「再幾枚領什麼」全頁只在進度區出現一次。 */
    const topText = "已蓋 " + sum.got + " 枚";
    const miles = sum.milestones.map(function (m) {
      const cls = m.claimed ? "is-claimed" : m.claimable ? "is-ready" : "is-wait";
      const detail = m.claimed ? "拿到：" + m.gotText : m.rewardText;
      const side = m.claimed ? '<span class="r76c-mile-state">已領取</span>'
        : m.claimable ? '<button type="button" class="r76c-claim" data-r76c-claim="' + m.count + '">領取</button>'
          : '<span class="r76c-mile-state">還差 ' + m.remaining + " 枚</span>";
      return '<li class="r76c-mile ' + cls + '" data-r76c-mile="' + m.count + '"><div class="r76c-mile-text"><b>集滿 ' + m.count + " 枚</b><span>" + esc(detail) + "</span></div>" + side + "</li>";
    }).join("");
    const ticks = MILESTONES.map(function (m) {
      const done = sum.got >= m.count;
      return '<span class="r76c-tick' + (done ? " is-done" : "") + (m.count === LAST_COUNT ? " is-last" : "") + '" style="left:' + (Math.round(m.count / LAST_COUNT * 1000) / 10) + '%">' + m.count + "</span>";
    }).join("");
    const cropRows = list.map(function (row) {
      const cells = row.cells.map(function (cell) {
        return '<li class="r76c-cell' + (cell.got ? " is-got" : "") + '" data-r76c-cell="' + cell.id + '" data-got="' + (cell.got ? "1" : "0") + '" aria-label="' + esc(cell.name + (cell.got ? "，已蓋章" : "，還沒蓋")) + '">'
          + sealHtml(cell) + '<span class="r76c-cell-name">' + esc(cell.name) + "</span></li>";
      }).join("");
      const hints = row.cells.filter(function (cell) { return !cell.got; }).map(function (cell) {
        return '<li data-r76c-hint="' + cell.id + '"><b>' + esc(cell.name) + "：</b>" + esc(cell.hint) + "</li>";
      }).join("");
      return '<li class="r76c-row' + (row.got === row.total ? " is-full" : "") + '" data-r76c-row="' + esc(row.cropId) + '">'
        /* R82C 第 4 項：列首直接寫「小麥 1／4 枚」，一眼看出是這種作物蓋了幾枚。 */
        + '<div class="r76c-row-head"><span class="r76c-crop">' + (row.emoji ? esc(row.emoji) + " " : "") + '<span class="r82c-crop-count" data-r82c-crop-count>' + esc(row.name + " " + row.got + "／" + row.total + " 枚") + "</span></span>"
        + (row.traitName ? '<span class="r76c-trait">' + esc(row.traitName) + "</span>" : "") + "</div>"
        + '<ul class="r76c-cells">' + cells + "</ul>"
        + (hints ? '<details class="r78c-row-help"><summary>怎麼拿還缺的印章</summary><ul class="r76c-hints">' + hints + "</ul></details>" : '<p class="r76c-row-done">這一列蓋滿了。</p>')
        + "</li>";
    }).join("");
    return '<section class="r76c-book" data-r76c-sunbook aria-label="追光手冊"><details class="r76c-fold"' + (sum.folded ? "" : " open") + ">"
      + '<summary class="r76c-sum"><img class="r76c-sum-icon" src="' + art(COVER_ART) + '" alt="">'
      + '<span class="r76c-sum-text"><b class="r76c-sum-title">追光手冊</b><span class="r76c-sum-count" data-r76c-count>' + esc(topText) + "</span></span>"
      + (sum.claimable.length ? '<span class="r76c-sum-flag" data-r76c-flag>有獎勵可領</span>' : "")
      + '<span class="r76c-sum-arrow" aria-hidden="true"></span></summary>'
      + '<div class="r76c-body"><p class="r76c-lead">每種作物的印章格都在這裡；點「怎麼拿」才展開詳細提示。</p>'
      + '<ul class="r76c-rows r78c-first-stamps" data-r78c-first-stamps>' + cropRows + "</ul>"
      + '<div class="r76c-progress"><div class="r76c-bar" role="progressbar" aria-label="集章進度" aria-valuemin="0" aria-valuemax="' + LAST_COUNT + '" aria-valuenow="' + shown + '"><span class="r76c-bar-fill" style="width:' + percent + '%"></span></div>'
      + '<div class="r76c-ticks" aria-hidden="true">' + ticks + "</div>"
      + '<p class="r76c-next" data-r76c-next>' + esc(nextText) + "</p></div>"
      + '<details class="r78c-mile-fold"' + (sum.claimable.length || sum.milestones.some(function (m) { return m.claimed; }) ? " open" : "") + '><summary>里程碑獎勵</summary><ul class="r76c-miles">' + miles + "</ul></details>"
      + (sum.lockedCrops > 0 ? '<p class="r76c-more">還有 ' + sum.lockedCrops + " 種作物沒解鎖，解鎖以後各多一列。</p>" : "")
      + "</div></details></section>";
  }
  /* 手札每次重畫都會清空圖鑑頁，這裡把手冊補回最上面；沒帶 state 而且區塊還在就不重畫。 */
  function inject(stateArg) {
    const panel = document.getElementById("journalPanel");
    if (!panel) return;
    const existing = panel.querySelector("[data-r76c-sunbook]");
    if (!stateArg && existing) return;
    const state = stateArg || liveState();
    if (!state) return;
    let section = null;
    try { const host = document.createElement("div"); host.innerHTML = bookHtml(state); section = host.firstElementChild; } catch (_) { section = null; }
    if (!section) return;
    panel.querySelectorAll("[data-r76c-sunbook]").forEach(function (node) { node.remove(); });
    panel.insertBefore(section, panel.firstChild);
    const fold = section.querySelector("details");
    if (fold) fold.addEventListener("toggle", function () { normalize(state); state.sunbook.folded = !fold.open; });
    section.querySelectorAll("[data-r76c-claim]").forEach(function (button) {
      button.addEventListener("click", function () {
        const result = claim(state, Number(button.getAttribute("data-r76c-claim")), Date.now());
        button.disabled = true;
        if (result.ok) { toast("追光手冊獎勵：" + result.text + "。"); save(); }
        else toast(result.reason === "claimed" ? "這份獎勵已經領過了。" : "印章還不夠，再蓋幾枚就能領。");
        /* 重畫要等這一下點擊跑完：按鈕如果在點擊途中就被換掉，頁面會把它當成「點在面板外面」而把手札關掉，玩家就看不到剛領了什麼。 */
        setTimeout(function () {
          const f = farm();
          if (result.ok && f && f.refresh) { try { f.refresh(); } catch (_) { /* 重畫失敗不影響已入帳的獎勵 */ } }
          inject(state);
          /* R78 整合：印章格移到最上面後，重畫會把里程碑那一列推出畫面；領完把剛領的那一列捲回來。 */
          const mile = document.querySelector('[data-r76c-mile="' + Number(button.getAttribute("data-r76c-claim")) + '"]');
          if (mile && mile.scrollIntoView) mile.scrollIntoView({ block: "nearest" });
        }, 0);
      });
    });
  }
  function open() {
    const state = liveState();
    if (!state) return false;
    normalize(state); state.sunbook.folded = false;
    hideCard();
    if (root.FarmWorld && typeof root.FarmWorld.openPanel === "function") root.FarmWorld.openPanel("journal");
    else { const f = farm(); if (f && f.selectTab) f.selectTab("journal"); }
    inject(state);
    /* 手冊就在圖鑑頁最上面：捲回頂端，面板右上角的關閉鈕和手冊標題都留在畫面裡。 */
    const jump = function () {
      inject();
      const section = document.querySelector("[data-r76c-sunbook]");
      const body = section && section.closest ? section.closest(".side-body") : null;
      if (body) body.scrollTop = 0;
      else if (section && section.scrollIntoView) section.scrollIntoView({ block: "start" });
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(function () { setTimeout(jump, 30); }); else jump();
    return true;
  }

  /* ---------- 瀏覽器：集章小卡 ----------
   * 自己一張卡，不擠進一般提示列。位置每次都重算：排在頂欄、任務卡、種子籤的下面，
   * 碰到下方工具列或手機操作鍵就縮短，幾秒後自己收掉，也可以點掉。 */
  let cardTimer = 0, cardWatch = 0, cardWait = 0, cardFrame = 0, cardQueue = [], cardShown = [];
  /* R84B 第 2 項：同一枚印章只跳一次（圖 19、23）。小卡在畫面上停過 1.2 秒就算看過：之後被對話、手札或結算卡蓋過去就直接收掉、不再排隊重跳，
     印章本身已經蓋在追光手冊裡，玩家隨時翻得到；剛冒出來不到 1.2 秒就被蓋掉的才排回去，等畫面空出來再出一次（排隊的不丟）。 */
  const CARD_SEEN_MS = 1200, cardSeen = new Set();
  let cardShownAt = 0;
  const cardKey = (e) => (e && (e.cropId || "") + ":" + (e.stampId || "")) || "";
  /* 升級卡、結算卡跟小卡都排在右上角，同時出來會疊在一起（小卡整張蓋住升級卡）；它們 2.5 秒就收，小卡排在後面等。 */
  /* R78B 第 5 項：最後兩個是互動層級的掛點——照顧方式彈窗還在、或 <html data-r78-focus> 標著有主要面板開著時，集章小卡先收起來排隊。 */
  const BLOCKERS = ".r75b-cook-overlay, .r75a-rack-overlay, .r76b-dialogue, .modal.show, #toast-zone .settlement-card, .r74a-care-popover, html[data-r78-focus]:not([data-r78-focus=\"\"]) body";
  /* R84B 第 2 項：手札、鄰居順口一句也算（R78B 的焦點記號每 250 毫秒才更新一次，這裡直接看）。 */
  function blocked() { return !!document.querySelector(BLOCKERS + ", .side-panel.world-panel-open, #worldDialogue:not([hidden])") || !!(root.FarmLayers && typeof root.FarmLayers.mustWait === "function" && root.FarmLayers.mustWait("stamp")); }
  function cardNode() {
    let node = document.getElementById("r76cStampCard");
    if (!node) {
      node = document.createElement("div");
      node.id = "r76cStampCard"; node.className = "r76c-card"; node.hidden = true;
      node.setAttribute("role", "status"); node.setAttribute("aria-live", "polite");
      /* 頁面上「點面板外面就關面板」的規則不該算到小卡：點掉小卡不會順手關掉手札，「打開手冊」也才開得起來。 */
      node.addEventListener("click", function (event) { event.stopPropagation(); });
      document.body.appendChild(node);
    }
    return node;
  }
  function boxOf(selector) {
    const node = document.querySelector(selector);
    if (!node || node.hidden) return null;
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return null;
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r : null;
  }
  function placeCard() {
    const node = document.getElementById("r76cStampCard");
    if (!node || node.hidden) return;
    const vw = document.documentElement.clientWidth || root.innerWidth || 0, vh = root.innerHeight || document.documentElement.clientHeight || 0;
    const margin = vw < 480 ? 8 : 12, width = Math.max(200, Math.min(320, vw - margin * 2));
    let left = vw - margin - width;
    /* 側邊面板開著時，卡片排在面板左邊，不擋手札；左邊放不下（手機直向）就排在面板關閉鈕的下面。 */
    const side = boxOf(".side-panel.world-panel-open .side-body");
    const beside = !!side && side.left - 12 - width >= margin;
    if (beside) left = side.left - 12 - width;
    const overlapsX = function (r) { return r.right > left - 4 && r.left < left + width + 4; };
    let top = margin;
    /* 上面要讓開：資源列、任務卡、種子欄、地點標籤，還有「光幾秒後落下」的陽光標籤（追光時最需要看到的那一行）。 */
    ["header", "#questDock", "#seedHud", "#sunChip", "#worldLocation"].forEach(function (selector) { const r = boxOf(selector); if (r && overlapsX(r) && r.top < vh / 2) top = Math.max(top, r.bottom + 8); });
    if (side && !beside) {
      document.querySelectorAll(".side-panel.world-panel-open .world-close").forEach(function (button) {
        const r = button.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && overlapsX(r) && r.bottom < vh - 120) top = Math.max(top, r.bottom + 8);
      });
    }
    /* 下面要讓開：工具列，以及手機上的方向鍵與「使用」鈕（外框是整條透明的，要看裡面真的看得到的按鈕）。 */
    let bottom = vh - margin;
    const lower = [boxOf("#farmDock")];
    document.querySelectorAll("#mobileControls > *").forEach(function (button) {
      if (getComputedStyle(button).display === "none") return;
      const r = button.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) lower.push(r);
    });
    /* R85A 第 4 項：一般提示（例如「祖母寄來一封信」）也要讓開。手機橫式第一次在光裡收成時，來信提示跟第一枚印章小卡同時出現在右上，
       小卡原本只讓開任務卡，會壓在提示上（r76-sunbook-layout 偶發失敗的原因）。上半部的提示當成上面的東西、下半部的當成下面的東西。 */
    document.querySelectorAll("#toast-zone > *").forEach(function (toast) {
      if (toast.classList && toast.classList.contains("settlement-card")) return;
      const style = getComputedStyle(toast); if (style.display === "none" || style.visibility === "hidden") return;
      const r = toast.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0) || !overlapsX(r)) return;
      if ((r.top + r.bottom) / 2 < vh / 2) top = Math.max(top, r.bottom + 8); else lower.push(r);
    });
    lower.forEach(function (r) { if (r && overlapsX(r) && r.top > top + 60) bottom = Math.min(bottom, r.top - 8); });
    const next = { left: Math.round(left) + "px", top: Math.round(top) + "px", width: Math.round(width) + "px", maxHeight: Math.max(60, Math.round(bottom - top)) + "px" };
    Object.keys(next).forEach(function (key) { if (node.style[key] !== next[key]) node.style[key] = next[key]; });
  }
  /* 小卡開著的那幾秒，每一格畫面都跟著旁邊的東西挪位置：任務卡長高、陽光標籤冒出來時不會被蓋到。 */
  function followCard() {
    cardFrame = 0;
    const node = document.getElementById("r76cStampCard");
    if (!node || node.hidden) return;
    placeCard();
    if (typeof root.requestAnimationFrame === "function") cardFrame = root.requestAnimationFrame(followCard);
  }
  function hideCard(interrupted) {
    const node = document.getElementById("r76cStampCard");
    /* 被蓋過去時：看過的記成看過；剛冒出來的排回去。其他收法（點掉、時間到、打開手冊）都算看過。 */
    const early = interrupted === true && cardShownAt && Date.now() - cardShownAt < CARD_SEEN_MS;
    const shownNow = cardShown.slice();
    if (early) cardQueue = shownNow.concat(cardQueue.filter((q) => !shownNow.some((e) => cardKey(e) === cardKey(q)))).slice(-12);
    else shownNow.forEach((e) => { const key = cardKey(e); if (key) cardSeen.add(key); });
    cardShownAt = 0;
    if (cardTimer) { clearTimeout(cardTimer); cardTimer = 0; }
    if (cardWatch) { clearInterval(cardWatch); cardWatch = 0; }
    if (cardFrame && typeof root.cancelAnimationFrame === "function") { root.cancelAnimationFrame(cardFrame); cardFrame = 0; }
    cardShown = [];
    if (node) { node.hidden = true; node.innerHTML = ""; }
  }
  /* 料理成果卡、曬架這類整面蓋住畫面的視窗開著時，小卡先排隊，等它關掉才出來，不跟它搶位置。 */
  function showCard(list) {
    if (list && list.length) cardQueue = cardQueue.concat(list.filter((e) => !cardSeen.has(cardKey(e)) && !cardQueue.some((q) => cardKey(q) === cardKey(e)))).slice(-12);
    if (!cardQueue.length) return;
    if (blocked()) {
      if (!cardWait) cardWait = setInterval(function () { if (!blocked()) { clearInterval(cardWait); cardWait = 0; showCard(); } }, 300);
      return;
    }
    const batch = cardShown.concat(cardQueue).slice(-12); cardQueue = [];
    paintCard(batch);
  }
  function watchCard() {
    if (blocked() && cardShown.length) { const again = cardShownAt && Date.now() - cardShownAt < CARD_SEEN_MS; hideCard(true); if (again) showCard(); return; } /* R84B：看過的被蓋過去就收掉，不重跳 */
    placeCard();
  }
  function paintCard(list) {
    const node = cardNode(), compact = (root.innerHeight || 0) < 480, limit = compact ? 1 : 3;
    cardShown = list; cardShownAt = Date.now();
    const lines = list.slice(-limit).map(function (e) { return '<span class="r76c-card-line">' + esc(e.text) + "</span>"; }).join("");
    const extra = list.length - Math.min(limit, list.length);
    let milestone = 0, first = false;
    list.forEach(function (e) { if (e.milestone > milestone) milestone = e.milestone; if (e.first) first = true; });
    const note = milestone ? "集滿 " + milestone + " 枚了，到追光手冊領獎勵。" : first ? "手札的圖鑑頁最上面多了一本追光手冊，集章可以換獎勵。" : "";
    const latest = list[list.length - 1] || {};
    /* R77C 第 15 項：小卡也寫再幾枚領什麼。 */
    /* R77 整合：矮螢幕（手機橫式）一次只留一段說明；第一次拿章時「手冊在哪」比「再幾枚領什麼」要緊，差額改到手冊標題看。 */
    /* R82C 第 4 項：括號裡改按作物計，這一句講的是整本手冊，寫明「全冊」免得跟作物的枚數混在一起。 */
    const nextNote = !milestone && !(compact && note) && latest.nextRemaining > 0 && latest.nextRewardText ? "全冊再 " + latest.nextRemaining + " 枚領：" + latest.nextRewardText : "";
    node.innerHTML = '<button type="button" class="r76c-card-main" data-r76c-card-close title="點一下關閉">'
      + '<img src="' + art(iconFor(latest.cropId, latest.stampId) || COVER_ART) + '" alt="">'
      + '<span class="r76c-card-text">' + lines
      + (extra > 0 ? '<span class="r76c-card-more">另外還有 ' + extra + " 枚新印章。</span>" : "")
      + (nextNote ? '<span class="r76c-card-note r77c-card-next" data-r77c-card-next>' + esc(nextNote) + "</span>" : "")
      + (note ? '<span class="r76c-card-note">' + esc(note) + "</span>" : "") + "</span></button>"
      + (note ? '<button type="button" class="r76c-card-open" data-r76c-card-open>打開手冊</button>' : "");
    node.classList.toggle("is-compact", compact);
    node.hidden = false;
    node.querySelector("[data-r76c-card-close]").addEventListener("click", hideCard);
    const openButton = node.querySelector("[data-r76c-card-open]");
    if (openButton) openButton.addEventListener("click", function () { open(); });
    placeCard();
    if (cardTimer) clearTimeout(cardTimer);
    cardTimer = setTimeout(hideCard, note ? 8000 : 5000);
    if (!cardWatch) cardWatch = setInterval(watchCard, 300);
    if (!cardFrame && typeof root.requestAnimationFrame === "function") cardFrame = root.requestAnimationFrame(followCard);
  }

  drainFn = function () {
    const state = liveState();
    let fresh = [];
    try { fresh = state ? takeEvents(state) : []; events.length = 0; } catch (_) { fresh = []; }
    if (!fresh.length) return;
    save();
    showCard(fresh);
    inject(state);
  };

  function start() {
    const panel = document.getElementById("journalPanel");
    if (panel && typeof MutationObserver === "function") new MutationObserver(function () { inject(); }).observe(panel, { childList: true });
    root.addEventListener("resize", placeCard);
    /* 遊戲還沒準備好時先等一下，準備好就補上手冊。 */
    const boot = setInterval(function () {
      const state = liveState();
      if (!state) return;
      normalize(state); inject();
      if (document.querySelector("[data-r76c-sunbook]") || !document.getElementById("journalPanel")) clearInterval(boot);
    }, 500);
    inject();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();

  API.inject = inject;
  API.open = open;
  API.showCard = showCard;
  API.hideCard = hideCard;
  API.placeCard = placeCard;
})(typeof window !== "undefined" ? window : globalThis);
