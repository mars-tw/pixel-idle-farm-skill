"use strict";
/* R82C：前幾分鐘有得選、等待時有事做。
 * 1 等光、等成熟、等曬乾時田邊冒出順手小事；用遊戲時鐘模擬新存檔前十分鐘，不出現超過三秒只能看倒數的空檔。
 * 2 第一次收成後任務卡同時給兩個一樣有效的目標（主線那一步，或先修河畔釣台），兩邊都通往主線、不會卡。
 * 3 早市取捨兩邊都寫最後拿到什麼，換算後價值差距在 15% 以內；還沒選之前田上與任務卡都不先寫「等光再收」。
 * 4 擺攤商品卡有品名；追光手冊按作物寫「小麥 1／4 枚」。 */
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const State = require("../src/state.js"), Sun = require("../src/sunplay-r75.js"), Game = require("../src/game.js"), A = require("../src/adventure.js");
const H = require("../src/heirloom.js"), W = require("../src/waitplay-r82.js"), Book = require("../src/sunbook-r76.js");
const ROOT = path.join(__dirname, ".."), read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const T = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function fresh(now = T) { const s = State.defaultState(now); Sun.normalize(s); A.ensure(s, now); return s; }
function seeded(seed) { let x = seed; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; }
const tileOf = (s, i) => s.map.tiles.find((t) => t.plotIndex === i);
const clone = (s) => JSON.parse(JSON.stringify(s));

/* ---------- 第 1 項：田邊小事 ---------- */
/* 一位手很快的玩家：任務卡給什麼就做什麼（快手最容易撞上「只能等」）。每個動作花的時間含走路。 */
const BASE_COST = { field: 1500, npc: 4000, site: 6000, chore: 2000, read: 2500 };
function playTenMinutes({ doChores, seed = 82, speed = 1, heirloom = true, chooseDock = true, chooseMarket = "wait" }) {
  const rng = seeded(seed), COST = Object.fromEntries(Object.entries(BASE_COST).map(([k, v]) => [k, Math.round(v * speed)]));
  const s = fresh(T); s.coins = 16; if (heirloom) H.start(s);
  const out = { gaps: [], waitMs: 0, waitPhases: 0, spawned: 0, chores: 0, rewards: { seeds: 0, sunlight: 0, wood: 0, compost: 0 }, log: [], picks: 0, dockFirst: false, maxActive: 0, expired: 0 };
  let busyUntil = T + 3000, idleSince = null, idleText = "", wasWaiting = false;
  const closeGap = (t) => { const g = t - idleSince; out.gaps.push(g); if (g > 3000) out.log.push(`${(idleSince - T) / 1000} 秒起等了 ${g / 1000} 秒：${idleText}`); idleSince = null; };
  const record = (event, t) => { A.record(s, event, t); A.finishTutorial(s, t); };
  const harvest = (i, t) => { const r = Game.harvest(s, i, t, rng); if (r.ok) record({ type: "harvest", cropId: r.cropId, count: r.added }, t); return r; };
  function farmAct(step, t) {
    const i = step.plotIndex;
    switch (step.action) {
      case "plant": { const r = Game.plant(s, i, step.cropId || "wheat", t); if (r.ok) record({ type: "plant", cropId: step.cropId || "wheat" }, t); return r.ok ? COST.field : 0; }
      case "tend": { const r = Game.waterPlot(s, i, t); if (r.ok) record({ type: "water" }, t); return r.ok ? COST.field : 0; }
      case "harvest": return harvest(i, t).ok ? COST.field : 0;
      case "refract": return Sun.refract(s, i, t).ok ? COST.field : 0;
      case "ripen": { const r = Sun.ripen(s, i, t); return r && r.ok ? COST.field : 0; }
      case "catch_sun": {
        const c = Game.lightHarvestChoice(s, i, t), queued = Game.lightHarvestQueue(s);
        if (!c.ok || (queued && queued.plotIndex === i)) return 0;
        if (c.hasTradeoff && chooseMarket === "now") return harvest(i, t).ok ? COST.field : 0;
        return Game.queueLightHarvest(s, i, t).ok ? 500 : 0;
      }
      case "report": { if (step.target && step.target !== "field") record({ type: "talk", npcId: step.target }, t); return A.claim(s, step.questId || "c1_homecoming", t).ok ? COST.npc + COST.read : 0; }
      case "deliver": return A.claim(s, "c1_first_harvest", t).ok ? COST.npc + COST.read : 0;
      case "cook": return A.cook(s, "rustic_bread", t).ok ? COST.npc : 0;
      case "eat": return A.eatMeal(s, "rustic_bread", t).ok ? COST.npc + COST.read : 0;
      case "explore": return A.restore(s, "fishing_dock", t).ok ? COST.site : 0;
      default: return 0;
    }
  }
  /* 任務卡沒有接手的那段（找鎮長說話、第 2 章的釣魚採集），照任務列表做。 */
  function questAct(t) {
    const q = A.summary(s, t).currentQuest; if (!q) return 0;
    if (q.canClaim) { record({ type: "talk", npcId: q.npcId }, t); return A.claim(s, q.id, t).ok ? COST.npc + COST.read : 0; }
    const row = (q.objectives || []).concat(q.requirements || []).find((r) => !r.complete); if (!row) return 0;
    if (row.type === "talk") { record({ type: "talk", npcId: row.id }, t); return COST.npc; }
    if (row.type === "restore") return A.restore(s, row.id, t).ok ? COST.site : 0;
    if (row.type === "fish" || row.source === "catch") return A.fish(s, t, rng).ok ? COST.site : 0;
    if (row.type === "forage" || row.id === "river_mint") { const node = Game.FORAGE_NODES && Game.FORAGE_NODES.find((n) => n.itemId === row.id); const r = node ? Game.gatherForage(s, node.id, t) : { ok: false }; if (r.ok) record({ type: "forage", itemId: row.id, count: r.added }, t); return r.ok ? COST.site : 0; }
    if (row.type === "cook") return A.cook(s, row.id, t).ok ? COST.npc : 0;
    return 0;
  }
  function decide(t) {
    const h = H.status(s);
    if (h.started && !h.delivered) { if (h.ready) return H.deliver(s, "table", t).ok ? COST.npc + COST.read : 0; return farmAct(A.nextFarmStep(s, t), t); }
    const step = A.nextFarmStep(s, t);
    if (step.alternative) { out.picks++; if (chooseDock && (step.action === "wait" || step.action === "plant")) { out.dockFirst = true; return A.restore(s, step.alternative.id, t).ok ? COST.site : 0; } }
    const early = A.earlyGoals(s, t);
    const q = A.summary(s, t).currentQuest;
    if (early.available && !early.complete) return farmAct(step, t) || questAct(t);
    if (step.questAware || ["refract", "catch_sun", "harvest", "tend", "ripen"].includes(step.action) || !q) return farmAct(step, t) || questAct(t);
    return questAct(t) || farmAct(step, t);
  }
  for (let t = T; t <= T + 600000; t += 250) {
    Game.updateSunpatch(s, t, rng); Sun.refreshLightCountdown(s.sun, t);
    const queued = Game.lightHarvestQueue(s); if (queued && queued.autoHarvest && Game.isSunlit(s, queued.plotIndex, t)) harvest(queued.plotIndex, t);
    const u = W.update(s, t); if (u.spawned) out.spawned++; if (u.expired) out.expired++;
    const wait = W.waitStatus(s, t), chore = W.view(s, t);
    if (wait.waiting && !wasWaiting) out.waitPhases++; wasWaiting = wait.waiting; if (wait.waiting) out.waitMs += 250;
    out.maxActive = Math.max(out.maxActive, (s.flags.r82Chores.active ? 1 : 0));
    if (t < busyUntil) { idleSince = null; continue; }
    let cost = decide(t);
    if (!cost && chore && doChores) { W.claim(s, t); const r = W.resolve(s, t + COST.chore); if (r.ok) { out.chores++; Object.entries(r.reward).forEach(([k, v]) => { out.rewards[k] += typeof v === "object" ? Object.values(v).reduce((a, b) => a + b, 0) : v; }); cost = COST.chore; } }
    if (cost) { busyUntil = t + cost; if (idleSince != null) closeGap(t); continue; }
    /* 只算「任務卡叫你等、而且田邊沒有小事」的時間；任務卡有別的事、或田邊有小事，都不算只能看倒數。 */
    const onlyCountdown = wait.waiting && !chore;
    if (onlyCountdown) { if (idleSince == null) { idleSince = t; idleText = wait.step ? wait.step.text : ""; } }
    else if (idleSince != null) closeGap(t);
  }
  if (idleSince != null) closeGap(T + 600000);
  out.state = s; out.maxGap = Math.max(0, ...out.gaps);
  return out;
}

test("1a 等成熟時冒出一件田邊小事：放在田邊空地、不在要操作的那格，點了給一點小收穫", () => {
  const s = fresh(); s.coins = 50; A.record(s, { type: "talk", npcId: "mayor" }, T);
  assert.equal(Game.plant(s, 0, "wheat", T).ok, true); s.stats.plantCount = 9; assert.equal(Game.waterPlot(s, 0, T).ok, true);
  const step = A.nextFarmStep(s, T + 100); assert.equal(step.action, "wait", "測試前置：任務卡叫玩家等田裡的小麥 " + step.text);
  assert.equal(W.update(s, T + 100).spawned, false, "剛開始等，不馬上冒出來");
  const r = W.update(s, T + 100 + W.ONBOARD_AFTER_MS + 50); assert.equal(r.spawned, true, "等了一下子就冒出一件");
  const v = W.view(s, T + 2000); const tile = s.map.tiles.find((t) => t.id === v.tileId);
  assert.equal(tile.plotIndex == null, true, "小事不放在田格上"); assert.notEqual(v.tileId, step.tileId, "不擋住要操作的那一格");
  assert.ok(W.fieldEdgeTiles(s).some((t) => t.id === v.tileId), "放在緊貼田格的空地");
  assert.equal(W.update(s, T + 2500).spawned, false, "同一時間最多一件");
  const before = clone(s), done = W.resolve(s, T + 3000);
  assert.equal(done.ok, true); assert.equal(W.view(s, T + 3000), null, "做完就收起來");
  const gained = (s.adventure.r58.r59.seedPacks.wheat || 0) - (before.adventure.r58.r59.seedPacks.wheat || 0) + ((s.materials.wood || 0) - (before.materials.wood || 0))
    + ((s.materials.compost || 0) - (before.materials.compost || 0)) + (Sun.sunlight(s) - Sun.sunlight(before));
  assert.equal(gained, 1, "小收穫只有一份：" + done.message); assert.equal(s.coins, before.coins, "不給金幣");
  assert.doesNotMatch(done.message, /[A-Za-z]/, "玩家看到的字不夾英文");
});

test("1b 沒點也會自己消失；倒數結束就收起來，不擋光到之後的事", () => {
  const s = fresh(); s.coins = 50; assert.equal(Game.plant(s, 0, "wheat", T).ok, true); s.stats.plantCount = 9; Game.waterPlot(s, 0, T);
  W.update(s, T); W.update(s, T + 1600); assert.ok(W.view(s, T + 1600), "前置：冒出一件");
  const left = Game.getCropProgress(s, s.plots[0], T + 1600).remainingMs;
  let t = T + 1600; while (t < T + 1600 + left + W.GRACE_MS + 600) { t += 250; W.update(s, t); if (!W.view(s, t)) break; }
  assert.equal(W.view(s, t), null, "沒點的小事會自己消失");
  assert.ok(t <= T + 1600 + Math.min(W.LIFE_MS, left + W.GRACE_MS) + 500, `最晚在倒數結束後一下子或 ${W.LIFE_MS / 1000} 秒內收起 (${t - T})`);
  assert.equal(s.flags.r82Chores.expired, 1); assert.deepEqual(s.flags.r82Chores.history.map((h) => h.result), ["gone"]);
  /* 點了正在走過去：倒數剛好結束也不會在半路被收走。 */
  const k = fresh(); k.coins = 50; Game.plant(k, 0, "wheat", T); k.stats.plantCount = 9; Game.waterPlot(k, 0, T); W.update(k, T); W.update(k, T + 1600); W.claim(k, T + 1700);
  const end = T + Game.getCropProgress(k, k.plots[0], T).remainingMs + W.GRACE_MS + 200; W.update(k, end); assert.ok(W.view(k, end), "點了以後，走過去的路上不會消失");
  assert.equal(W.resolve(k, end + 200).ok, true);
});

test("1c 要玩家選擇、有別的事可做、或農場小事正在等人時，不冒出田邊小事", () => {
  /* 光快到了、熟的那格要選現在收或等光：這不是等，是做決定。 */
  const s = fresh(); s.coins = 50; s.stats.plantCount = 9; Game.plant(s, 0, "wheat", T); s.plots[0].plantedAt = T - 3600000;
  Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: T + 9000, nextAt: T + 9000 });
  assert.equal(W.waitStatus(s, T).waiting, false); W.update(s, T); assert.equal(W.update(s, T + 3000).spawned, false);
  /* 選了等光，才算在等。 */
  Game.queueLightHarvest(s, 0, T + 3000); assert.equal(W.waitStatus(s, T + 3100).kind, "light"); W.update(s, T + 3100); assert.equal(W.update(s, T + 4700).spawned, true);
  /* 烏鴉、小雞這類農場小事正在等人處理：同一時間只留一件。 */
  const e = fresh(); e.coins = 50; Game.plant(e, 0, "wheat", T); e.stats.plantCount = 9;
  e.adventure.r58.activeEvent = { id: "lost_chick", startedAt: T, expiresAt: T + 180000 };
  W.update(e, T); assert.equal(W.update(e, T + 3000).spawned, false);
});

/* 一段「任務卡只叫你等、田裡也沒別的事」的長等待，用遊戲時鐘一格一格走。玩家可以去做小事，也可以完全不理。 */
function coverWait(s, from, { doChores, until = from + 120000, rng = seeded(5) }) {
  const out = { waitMs: 0, gaps: [], chores: 0, expired: 0, spawned: 0, end: from };
  let busyUntil = from, idleSince = null;
  for (let t = from; t <= until; t += 250) {
    Game.updateSunpatch(s, t, rng); Sun.refreshLightCountdown(s.sun, t);
    const u = W.update(s, t); if (u.spawned) out.spawned++; if (u.expired) out.expired++;
    const wait = W.waitStatus(s, t), chore = W.view(s, t);
    if (t < busyUntil) { if (wait.waiting) out.waitMs += 250; if (idleSince != null) { out.gaps.push(t - idleSince); idleSince = null; } continue; }
    if (!wait.waiting) {
      /* 小事給的種子讓田邊多了一件事（把種子種下、澆水）：照任務卡做完，再接著等。 */
      const step = wait.step || A.nextFarmStep(s, t);
      if (step && step.action === "plant" && Game.plant(s, step.plotIndex, "wheat", t).ok) { busyUntil = t + BASE_COST.field; if (idleSince != null) { out.gaps.push(t - idleSince); idleSince = null; } continue; }
      if (step && step.action === "tend" && Game.waterPlot(s, step.plotIndex, t).ok) { busyUntil = t + BASE_COST.field; if (idleSince != null) { out.gaps.push(t - idleSince); idleSince = null; } continue; }
      out.end = t; break;
    }
    out.waitMs += 250;
    if (t < busyUntil) { if (idleSince != null) { out.gaps.push(t - idleSince); idleSince = null; } continue; }
    if (chore && doChores) { W.claim(s, t); if (W.resolve(s, t + BASE_COST.chore).ok) out.chores++; busyUntil = t + BASE_COST.chore; continue; }
    if (!chore) { if (idleSince == null) idleSince = t; } else if (idleSince != null) { out.gaps.push(t - idleSince); idleSince = null; }
    out.end = t;
  }
  if (idleSince != null) out.gaps.push(out.end - idleSince);
  out.maxGap = Math.max(0, ...out.gaps);
  return out;
}
/* 前十分鐘會遇到的幾種長等待：等小麥長大、第一道光教學選了等光、早市選了等光、第 2 章等胡蘿蔔、等曬架曬乾。 */
const LONG_WAITS = {
  "等小麥長大": () => {
    const s = fresh(); s.coins = 30; A.record(s, { type: "talk", npcId: "mayor" }, T); Game.plant(s, 0, "wheat", T); A.record(s, { type: "plant", cropId: "wheat" }, T); A.claim(s, "c1_homecoming", T);
    s.adventure.r58.r59.seedPacks.wheat = 0; s.stats.plantCount = 9; s.flags.r79FirstLightHarvest = true;
    for (let i = 0; i < Game.activePlotCount(s); i++) { if (!s.plots[i].cropId) Game.plant(s, i, "wheat", T); s.plots[i].plantedAt = T; Game.waterPlot(s, i, T); }
    Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: T + 600000 });
    return s;
  },
  "第一道光選了等光": () => {
    const s = fresh(); s.coins = 30; s.stats.plantCount = 9; Game.plant(s, 0, "wheat", T); s.plots[0].plantedAt = T - 3600000; s.adventure.r58.r59.seedPacks.wheat = 0;
    Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: T + 29000, nextAt: T + 29000 }); Game.queueLightHarvest(s, 0, T);
    return s;
  },
  "早市選了等光": () => {
    const s = fresh(); s.coins = 30; s.stats.plantCount = 9; s.stats.harvested.wheat = 3; s.sun.spawned = 1; s.flags.r79FirstLightHarvest = true; s.adventure.r58.r59.seedPacks.wheat = 0;
    Game.plant(s, 0, "wheat", T); s.plots[0].plantedAt = T - 3600000;
    Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: T + 25000, nextAt: T + 25000 }); Game.queueLightHarvest(s, 0, T);
    return s;
  },
  "第 2 章等胡蘿蔔": () => {
    const s = fresh(); W.normalize(s); /* 新存檔一路玩到第 2 章：小事的紀錄從第一章就開始了 */ s.coins = 200; s.level = 3; s.storage.items.wheat = 12; s.materials.wood = 30; s.materials.stone = 10; s.flags.r79FirstLightHarvest = true; s.stats.harvested.wheat = 6;
    ["c1_homecoming", "c1_first_harvest", "c1_first_meal", "c2_fishing_dock", "c2_river_basket"].forEach((id) => { s.adventure.claimed[id] = true; });
    A.ensure(s, T); A.restore(s, "fishing_dock", T); A.restore(s, "picnic_table", T); A.record(s, { type: "talk", npcId: "merchant" }, T);
    s.adventure.r58.r59.seedPacks.carrot = 2; assert.equal(Game.plant(s, 0, "carrot", T).ok, true); Game.waterPlot(s, 0, T);
    Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: T + 600000 });
    return s;
  },
};
test("1d 前十分鐘的長等待：每一種都不出現超過三秒只能看倒數的空檔（去做小事、不理小事都一樣）", () => {
  let covered = 0;
  for (const [name, make] of Object.entries(LONG_WAITS)) {
    const probe = make(); const step = A.nextFarmStep(probe, T + 1);
    assert.equal(W.waitStatus(probe, T + 1).waiting, true, `${name}：前置是任務卡叫玩家等（${step.action}：${step.text}）`);
    for (const doChores of [true, false]) {
      const run = coverWait(make(), T + 1, { doChores });
      assert.ok(run.waitMs >= 5000, `${name}：真的等了一段（${run.waitMs / 1000} 秒）`);
      assert.ok(run.maxGap <= 3000, `${name}${doChores ? "" : "（不理小事）"}：最長只能看倒數 ${run.maxGap} 毫秒`);
      if (doChores) { assert.ok(run.chores >= 2, `${name}：等待中做了 ${run.chores} 件小事`); covered += run.waitMs; }
      else assert.ok(run.spawned >= 1 && (run.waitMs <= W.LIFE_MS + 2000 || (run.expired >= 1 && run.spawned >= 2)), `${name}：沒點的小事自己消失，下一件再補上（等 ${run.waitMs / 1000} 秒、消失 ${run.expired}、出現 ${run.spawned}）`);
    }
  }
  assert.ok(covered >= 60000, `幾種長等待合計 ${covered / 1000} 秒，不是空跑`);
});

test("1e 新存檔前十分鐘：不同步調的玩家跟著任務卡做，整段都沒有超過三秒只能看倒數", () => {
  const runs = [];
  for (const speed of [1, 2]) for (const heirloom of [true, false]) for (const doChores of [true, false]) {
    const run = playTenMinutes({ doChores, speed, heirloom, chooseMarket: doChores ? "wait" : "now", chooseDock: doChores });
    const tag = `${speed === 1 ? "快手" : "慢慢讀"}・${heirloom ? "祖母手記開場" : "先找鎮長開場"}・${doChores ? "會點小事" : "不理小事"}`;
    assert.ok(run.maxGap <= 3000, `${tag}：最長只能看倒數 ${run.maxGap} 毫秒：${run.log.join("；")}`);
    assert.ok(run.state.adventure.claimed.c1_first_meal, `${tag}：照著任務卡走完第一章`);
    assert.equal(run.maxActive <= 1, true, "同一時間最多一件");
    /* 小收穫加起來仍很小：陽光、木料、堆肥各有冷卻，一件最多一份。 */
    assert.ok(run.rewards.sunlight <= 5 && run.rewards.wood <= 5 && run.rewards.compost <= 4, `${tag}：十分鐘的小收穫 ${JSON.stringify(run.rewards)}`);
    assert.ok(run.rewards.seeds + run.rewards.sunlight + run.rewards.wood + run.rewards.compost <= run.chores);
    runs.push(run);
  }
  assert.ok(runs.reduce((sum, run) => sum + run.waitMs, 0) >= 20000, "八種玩法合計有遇到等待");
  assert.ok(runs.some((run) => run.chores >= 1) && runs.some((run) => run.expired >= 1), "有人點了小事，也有人沒點、讓它自己消失");
});

test("1f 十分鐘以後改成偶爾出現：兩件之間至少隔一分鐘；舊存檔第一次讀到也直接用這個步調", () => {
  const old = fresh(); old.adventure.claimed.c1_first_meal = true; assert.equal(W.onboarding(old), false, "走完第一章的舊存檔不算新存檔");
  const aged = fresh(); aged.lastSeenAt = aged.createdAt + 7200000; assert.equal(W.onboarding(aged), false, "建立超過一小時的存檔不算新存檔");
  assert.equal(W.onboarding(fresh()), true);
  const s = fresh(); s.coins = 50; s.stats.plantCount = 9; Game.plant(s, 0, "wheat", T); W.normalize(s).playMs = W.ONBOARD_MS + 1;
  s.plots[0].plantedAt = T; s.plots[0].careMode = undefined; W.update(s, T);
  const growMs = Game.plotGrowMs(s, s.plots[0], T);
  let spawned = 0; for (let t = T + 250; t < T + growMs - 4000; t += 250) { const r = W.update(s, t); if (r.spawned) { spawned++; W.resolve(s, t + 10); } }
  assert.ok(spawned <= Math.ceil(growMs / W.LATER_GAP_MS), `一段 ${growMs / 1000} 秒的等待只出現 ${spawned} 件`);
});

test("1g 接線：頁面與離線快取載入小事、缺圖有後備樣子、樣式標了 R82C", () => {
  const html = read("index.html"), sw = read("sw.js"), css = read("src/content-r58b.css"), src = read("src/waitplay-r82.js");
  assert.match(html, /<script src="src\/waitplay-r82\.js\?v=[^"]+"><\/script>/); assert.ok(html.indexOf("waitplay-r82.js") > html.indexOf("src/ui.js"));
  assert.match(sw, /versioned\("\.\/src\/waitplay-r82\.js"\)/);
  assert.match(css, /R82C：前幾分鐘有得選/); assert.ok(css.lastIndexOf("R82C") > css.lastIndexOf("R81C"), "R82C 樣式接在檔尾");
  assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length);
  assert.match(src, /is-missing-art/); assert.match(src, /travelAndDo/);
  for (const chore of W.CHORES) { assert.match(chore.art, /^assets\/generated\//); if (!W.MISSING_ART.includes(chore.art)) assert.ok(fs.existsSync(path.join(ROOT, chore.art)), "現有素材 " + chore.art); }
  assert.match(read("scripts/guard-validation-writes.js"), /"node scripts\/test-content-r82-play\.js"/);
});

/* ---------- 第 2 項：第一次收成後兩件挑一件 ---------- */
function afterFirstHarvest() {
  const s = fresh(); s.coins = 50; A.record(s, { type: "talk", npcId: "mayor" }, T); Game.plant(s, 0, "wheat", T); A.record(s, { type: "plant", cropId: "wheat" }, T);
  assert.equal(A.claim(s, "c1_homecoming", T).ok, true); s.plots[0].plantedAt = T - 3600000;
  const r = Game.harvest(s, 0, T + 1, () => 1); A.record(s, { type: "harvest", cropId: "wheat", count: r.added }, T + 1);
  return s;
}
test("2a 第一次收成後：主線那一步照舊，另掛「先修河畔釣台」，兩個一樣有效", () => {
  const s = afterFirstHarvest(); const step = A.nextFarmStep(s, T + 2);
  assert.equal(step.action, "deliver"); assert.ok(step.alternative, "掛了另一個選項");
  assert.equal(step.alternative.action, "restore"); assert.equal(step.alternative.target, "fishing_dock"); assert.equal(step.alternative.actionLabel, "去修釣台");
  assert.match(step.alternative.text, /木料 4、石材 2/); assert.doesNotMatch(step.alternative.text, /[A-Za-z]/);
  /* 還沒收成過、鎮長的開工任務沒交、光正在等人處理時都不掛。 */
  const before = fresh(); assert.equal(A.nextFarmStep(before, T).alternative, undefined);
  const lit = afterFirstHarvest(); Game.plant(lit, 1, "wheat", T + 2); lit.plots[1].plantedAt = T - 3600000; lit.storage.items.wheat = 0;
  Object.assign(lit.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [1], previewAt: T + 9000, nextAt: T + 9000 });
  const held = A.nextFarmStep(lit, T + 3); assert.ok(held.holdPlotIndex != null || held.action === "catch_sun"); assert.equal(held.alternative, undefined, "光要來了，先不分心");
});
test("2b 先修釣台：主線照走、第 2 章釣台任務直接算完成，不會卡", () => {
  const s = afterFirstHarvest(); assert.equal(A.restore(s, "fishing_dock", T + 3).ok, true);
  assert.equal(A.nextFarmStep(s, T + 4).alternative, undefined, "修好了就不再掛");
  assert.equal(A.claim(s, "c1_first_harvest", T + 5).ok, true); s.storage.items.wheat = 2;
  assert.equal(A.cook(s, "rustic_bread", T + 6).ok, true); assert.equal(A.eatMeal(s, "rustic_bread", T + 7).ok, true);
  const next = A.nextFarmStep(s, T + 8); assert.equal(next.action, "report", "吃完第一餐直接回報釣台任務：" + next.text); assert.equal(next.questId, "c2_fishing_dock");
  assert.equal(A.claim(s, "c2_fishing_dock", T + 9).ok, true); assert.equal(A.summary(s, T + 10).currentQuest.id, "c2_river_basket");
});
test("2c 先走主線：吃完第一餐照舊去河邊修釣台，兩條路最後接在一起", () => {
  const s = afterFirstHarvest(); assert.equal(A.claim(s, "c1_first_harvest", T + 5).ok, true); s.storage.items.wheat = 2;
  assert.ok(A.nextFarmStep(s, T + 5).alternative, "交完小麥、還沒吃第一餐，釣台仍可以先做");
  assert.equal(A.cook(s, "rustic_bread", T + 6).ok, true); assert.equal(A.eatMeal(s, "rustic_bread", T + 7).ok, true);
  const next = A.nextFarmStep(s, T + 8); assert.equal(next.action, "explore"); assert.equal(next.alternative, undefined);
  assert.equal(A.restore(s, "fishing_dock", T + 9).ok, true); assert.equal(A.claim(s, "c2_fishing_dock", T + 10).ok, true);
});
test("2d 任務卡顯示層：兩顆一樣大的選項、都不是黃色主鈕，另一邊走去修釣台", () => {
  const world = read("src/world-ui.js"), css = read("src/content-r58b.css"), adv = read("src/adventure.js");
  assert.match(world, /function r82cApplyPick\(box, step\)/); assert.match(world, /r82cApplyPick\(box, nextFarm\)/); assert.match(world, /r82cApplyPick\(box, farmNow\)/);
  assert.match(world, /main\.classList\.remove\("r63-primary"\)/); assert.match(world, /visitSite\("fishing_dock"\)/);
  assert.match(css, /\[data-r82c-pick\] \.r82c-pick-row \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  /* 下一步只有 nextFarmStep 一個來源：二選一是掛在它回傳值上的。 */
  assert.match(adv, /const r82cBaseFarmStep = nextFarmStep;/); assert.match(adv, /nextFarmStep = function \(state, now\) \{ return r82cFirstPick\(state, r82cBaseFarmStep\(state, now\), now\); \};/);
});

/* ---------- 第 3 項：早市取捨 ---------- */
function marketState({ orders = [], care, sunSpawned = 1, meal = false } = {}) {
  const s = fresh(); s.coins = 200; s.stats.plantCount = 9; s.stats.harvested.wheat = 3; s.sun.spawned = sunSpawned; s.orders = orders;
  if (care === "compost") s.materials.compost = 2;
  assert.equal(Game.plant(s, 0, "wheat", T, care || "water").ok, true); s.plots[0].plantedAt = T - 3600000;
  if (meal) s.adventure.r58.buffs.harvest = { until: T + 600000, bonus: 1, meal: "rustic_bread" };
  Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: T + 6000, nextAt: T + 6000 }); Sun.refreshLightCountdown(s.sun, T);
  return s;
}
/* 換算：作物照畫面上第一張要這種作物的訂單算每份價；陽光 2 點能讓 1 格立刻成熟，算 1 份作物。 */
function worth(choice, side) {
  const u = choice.orderUnitCoins;
  return side === "now" ? choice.nowQty * u + choice.nowCoins + choice.nowSunlight / 2 * u : choice.waitQty * u + choice.waitSunlight / 2 * u;
}
test("3a 早市兩邊換算後價值差距在 15% 以內（多種訂單、堆肥、料理加成都一樣）", () => {
  const cases = [
    marketState(),
    marketState({ orders: [{ id: "w4", wants: { wheat: 4 }, rewardCoins: 29 }] }),
    marketState({ orders: [{ id: "w4", wants: { wheat: 4 }, rewardCoins: 16 }] }),
    marketState({ orders: [{ id: "mix", wants: { wheat: 2, carrot: 2 }, rewardCoins: 20 }] }),
    marketState({ care: "compost" }),
    marketState({ meal: true, orders: [{ id: "w4", wants: { wheat: 4 }, rewardCoins: 22 }] }),
  ];
  for (const s of cases) {
    const c = Game.lightHarvestChoice(s, 0, T); assert.equal(c.kind, "market"); assert.equal(c.hasTradeoff, true);
    const now = worth(c, "now"), wait = worth(c, "wait"), gap = Math.abs(now - wait) / Math.max(now, wait);
    assert.ok(gap <= 0.15, `價值差 ${Math.round(gap * 100)}%：現在收 ${now}、等光 ${wait}（${c.nowText}｜${c.waitText}）`);
    assert.ok(c.valueGapRatio <= 0.15);
  }
  /* 之後每隔三道光的限時收購也一樣。 */
  const order = marketState({ sunSpawned: 5 }); order.flags.r79LightChoiceCount = 1; order.flags.r79LightChoiceLastBeam = 2;
  const oc = Game.lightHarvestChoice(order, 0, T); assert.equal(oc.kind, "order"); assert.ok(Math.abs(worth(oc, "now") - worth(oc, "wait")) / Math.max(worth(oc, "now"), worth(oc, "wait")) <= 0.15);
  assert.match(oc.nowShort, /收購 \d+ 金/); assert.match(oc.waitShort, /錯過限時收購/);
});
test("3b 兩邊都寫最後拿到什麼，數字跟真的收成一樣", () => {
  const s = marketState(); const c = Game.lightHarvestChoice(s, 0, T);
  assert.equal(c.nowText, `現在收：${c.nowQty} 份小麥＋老農班伯早市 ${c.nowCoins} 金`);
  assert.equal(c.waitText, `等光再收：${c.waitQty} 份小麥＋陽光 ${c.waitSunlight}（可催熟 1 格），但錯過早市`);
  assert.equal(c.nowShort, `${c.nowQty} 份小麥＋早市 ${c.nowCoins} 金`); assert.equal(c.waitShort, `${c.waitQty} 份小麥＋陽光 ${c.waitSunlight}・錯過早市`);
  assert.doesNotMatch(c.nowText + c.waitText + c.nowShort + c.waitShort, /訂單每份/, "不再寫會被誤讀成賣價的每份單價");
  const nowState = clone(s), coins = nowState.coins, nowOut = Game.harvest(nowState, 0, T + 1, () => 1);
  assert.equal(nowOut.added, c.nowQty); assert.equal(nowState.coins - coins, c.nowCoins, "現在收：作物留著，另外拿早市的錢");
  const waitState = clone(s); Game.queueLightHarvest(waitState, 0, T); Game.updateSunpatch(waitState, T + 6000, () => 0);
  const sunBefore = Sun.sunlight(waitState), waitOut = Game.harvest(waitState, 0, T + 6001, () => 1);
  assert.equal(waitOut.added, c.waitQty); assert.equal(Sun.sunlight(waitState) - sunBefore, c.waitSunlight); assert.equal(waitOut.marketBonus, 0, "等光就錯過早市");
  const ui = read("src/ui.js"); assert.match(ui, /actionDetail = lightChoice\.nowShort/); assert.match(ui, /`等 \$\{lightChoice\.seconds\} 秒・\$\{lightChoice\.waitShort\}`/);
});
test("3c 還沒選之前，田上標籤、右下大鈕、任務卡都不先寫「等光再收」", () => {
  const s = marketState(); const step = A.nextFarmStep(s, T);
  assert.equal(step.action, "catch_sun"); assert.equal(step.actionLabel, "到田邊選一個"); assert.doesNotMatch(step.text + step.actionLabel, /等光再收/);
  assert.equal(Game.facingPlotLabel(s, tileOf(s, 0), T), "收成・小麥田");
  const ui = read("src/ui.js"); assert.match(ui, /`\$\{name\}・現在收或等光`/); assert.match(ui, /`已選等光・\$\{name\}`/);
  /* 選了等光以後才講等光；第一次的教學只有等光一條路，照舊直接寫。 */
  Game.queueLightHarvest(s, 0, T); assert.match(A.nextFarmStep(s, T + 1).text, /已選等光再收/);
  const tutorial = marketState(); tutorial.stats.harvested = {}; assert.equal(Game.lightHarvestChoice(tutorial, 0, T).kind, "tutorial");
  assert.equal(Game.facingPlotLabel(tutorial, tileOf(tutorial, 0), T), "等光再收");
});

/* ---------- 第 4 項：擺攤品名、追光手冊按作物計 ---------- */
test("4a 擺攤商品卡有品名，番茄、草莓一眼分得出來", () => {
  const src = read("src/festival-stall-r72.js"), game = src.slice(src.indexOf("function renderGame"), src.indexOf("function renderResult"));
  assert.match(game, /<b class="r82c-item-name" data-r82c-item-name>\$\{esc\(row\.name\)\}<\/b><small><span class="r79a-count">\$\{count\}<\/span><\/small>/);
  assert.match(read("src/content-r58b.css"), /\.r72b-item \.r82c-item-name \{[^}]*text-overflow: ellipsis/);
});
test("4b 追光手冊按作物寫「小麥 1／4 枚」：列首與小卡同一種寫法", () => {
  const s = fresh(); s.level = 1; Book.normalize(s); Book.takeEvents(s);
  assert.equal(Book.cropCountText(s, "wheat"), "小麥 0／4 枚");
  const r = Game.plant(s, 0, "wheat", T); assert.equal(r.ok, true); s.plots[0].plantedAt = T - 3600000;
  Object.assign(s.sun, { plots: [0], used: [], startsAt: T - 1000, endsAt: T + 10000 }); Game.harvest(s, 0, T, () => 1);
  const events = Book.takeEvents(s); assert.ok(events.length >= 1, "光裡收成會蓋章");
  assert.match(events[0].text, /^追光手冊：小麥・光裡收成（小麥 \d／4 枚）$/); assert.doesNotMatch(events[0].text, /／15/);
  assert.match(Book.cropCountText(s, "wheat"), /^小麥 [1-4]／4 枚$/);
  const src = read("src/sunbook-r76.js"); assert.match(src, /data-r82c-crop-count>' \+ esc\(row\.name \+ " " \+ row\.got \+ "／" \+ row\.total \+ " 枚"\)/);
});

if (!process.exitCode) console.log(`R82C play: ${passed} passed`);
