"use strict";
/* R85B 第 4 項：壞天氣也有事做（雨水桶與雨後虹光，src/rainplay-r85.js）。
 * 1 觸發：新存檔第 15 分鐘（第一次光裡收成以後；最晚第 25 分鐘）來一陣 2 分半的過雲雨，前 30 分鐘一定遇得到；之前遇過壞天氣、或舊存檔，不安排。
 *   第一次遇到壞天氣只跳一則短提示；任務卡與右下大鈕不改（不另開一條下一步）。
 * 2 操作：壞天氣時田邊立一個雨水桶，開著遊戲 40 秒接滿；點一下倒進田裡。
 * 3 獎勵：還在長、還沒澆的田一次澆好（跟手動澆水同一條規則），陽光 +1；這段壞天氣倒過至少一桶，放晴時落下一次虹光：照 4 格、停 30 秒，
 *   在光裡種、澆、收的加成跟一般的光一樣。一段壞天氣最多倒 3 桶、最多一次虹光。
 * 4 離線不累積：接水每次更新最多記 2 秒；離線時雨停了也只補一次虹光，好幾段壞天氣也不會疊。
 * 5 版面：1366×768、1366×600、390×844、844×390 實際開瀏覽器量：提示、雨水桶命中區至少 44px、在畫面內、不蓋任務卡與大鈕（也不被蓋住）、點了會倒、放晴有虹光。
 * 6 素材與接線：MUSE 新圖（雨水桶三種水量、虹光）尺寸、透明、manifest；樣式與程式接進 index.html、sw.js。 */
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
global.window = global;
const ROOT = path.join(__dirname, ".."), read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const State = require("../src/state.js"), Sun = require("../src/sunplay-r75.js"), Game = require("../src/game.js"), A = require("../src/adventure.js");
const H = require("../src/heirloom.js"), W = require("../src/waitplay-r82.js"), Q = require("../src/choices-r77.js"), Rain = require("../src/rainplay-r85.js");
Q.install();
const T = 1794172800000, MIN = 60000;
let passed = 0;
const pending = [];
function test(name, fn) { pending.push([name, fn]); }
function fresh(now = T) { const s = State.defaultState(now); Sun.normalize(s); A.ensure(s, now); return s; }
function seeded(seed) { let x = seed; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; }
function lessonDone(s) { s.flags.r79FirstLightHarvest = true; s.adventure.claimed.c1_first_harvest = true; }
/* 從 from 到 to 每 step 毫秒更新一次（光與雨都更新），回傳每一拍的事件。 */
function tickRange(s, from, to, step, onTick) {
  const events = [];
  for (let t = from; t <= to; t += step) { Game.updateSunpatch(s, t, () => 0.5); const r = Rain.update(s, t); events.push(Object.assign({ t }, r)); if (onTick) onTick(t, r); }
  return events;
}
/* 一場已經開始的過雲雨（跳過 15 分鐘的等待，直接從現在開始下）。 */
function showerNow(s, t) { Rain.update(s, t); Object.assign(s.r85Rain, { showerAt: t, showerDone: false, seenBad: false }); return Rain.update(s, t); }
const NO_EN = /[A-Za-z]/;

/* ---------- 1 觸發 ---------- */
test("1a 新存檔第 15 分鐘來過雲雨（第一次光裡收成以後），下 2 分半；前 30 分鐘一定遇得到", () => {
  const s = fresh(); lessonDone(s); s.coins = 50; Game.plant(s, 0, "wheat", T);
  Rain.update(s, T); assert.equal(s.r85Rain.showerAt, T + 15 * MIN, "排在第 15 分鐘");
  const ev = tickRange(s, T, T + 30 * MIN, 1000);
  const start = ev.find((e) => e.shower), end = ev.find((e) => e.ended);
  assert.ok(start && start.t >= T + 15 * MIN && start.t <= T + 15 * MIN + 60000, "第 15 分鐘開始下：" + (start && (start.t - T) / 1000));
  assert.equal(Game.currentWeather(s, start.t + 1000), "rain", "過雲雨算雨天（天氣還沒解鎖也一樣）");
  assert.ok(end && end.t - start.t >= Rain.SHOWER_MS && end.t - start.t <= Rain.SHOWER_MS + 2000, "下 2 分半");
  assert.equal(ev.filter((e) => e.shower).length, 1, "只下一次"); assert.equal(ev.filter((e) => e.hint).length, 1, "只跳一次提示");
  assert.ok(end.t < T + 30 * MIN, "前 30 分鐘內下完");
  assert.equal(Game.currentWeather(s, T + 29 * MIN), "clear", "下完就放晴");
});

test("1b 還沒走完光裡收成教學：第 15 分鐘先不下，最晚第 25 分鐘下；舊存檔、遇過壞天氣的存檔不安排", () => {
  const slow = fresh(); slow.coins = 50; Game.plant(slow, 0, "wheat", T);
  const ev = tickRange(slow, T, T + 30 * MIN, 1000), start = ev.find((e) => e.shower);
  assert.ok(start && start.t >= T + 25 * MIN && start.t <= T + 26 * MIN, "教學還沒完，第 25 分鐘下（光在田上就等光散了）：" + (start && (start.t - T) / MIN));
  /* 沒種過田（還沒開始玩）不下。 */
  const idle = fresh(); assert.equal(tickRange(idle, T, T + 30 * MIN, 5000).some((e) => e.shower), false, "還沒種過田不下");
  /* 舊存檔：第一次讀到時存檔已經建立超過一分鐘。 */
  const old = fresh(T - 3600000); lessonDone(old); old.coins = 50; Game.plant(old, 0, "wheat", T);
  assert.equal(tickRange(old, T, T + 30 * MIN, 5000).some((e) => e.shower), false, "舊存檔不安排"); assert.equal(old.r85Rain.showerAt, 0);
  /* 第 5 分鐘就升到 5 級、遇到真的下雨：第 15 分鐘不再另外下。 */
  const lucky = fresh(); lessonDone(lucky); lucky.coins = 50; Game.plant(lucky, 0, "wheat", T); Rain.update(lucky, T);
  tickRange(lucky, T, T + 5 * MIN, 1000); lucky.level = 5; lucky.weather = { id: "rain", untilMs: T + 8 * MIN };
  const ev2 = tickRange(lucky, T + 5 * MIN, T + 30 * MIN, 1000);
  assert.ok(ev2.some((e) => e.started), "真的下雨也開始接水"); assert.equal(ev2.some((e) => e.shower), false, "不再另外安排過雲雨");
  /* 光還在田上時先不下，等光散了才下。 */
  const lit = fresh(); lessonDone(lit); lit.coins = 50; Game.plant(lit, 0, "wheat", T); Rain.update(lit, T);
  const at = T + 15 * MIN; Object.assign(lit.sun, { plots: [0], used: [], startsAt: at - 1000, endsAt: at + 10000, previewPlots: [], previewAt: 0, nextAt: at + 30000 });
  assert.equal(Rain.update(lit, at).shower, false, "光還在田上不下"); assert.equal(Rain.update(lit, at + 11000).shower, true, "光散了才下");
});

test("1c 下雨時光暫停：過雲雨那 2 分半沒有新的光，也沒有預告", () => {
  const s = fresh(); lessonDone(s); s.coins = 50; Game.plant(s, 0, "wheat", T); Game.plant(s, 1, "wheat", T);
  const t0 = T + 20 * MIN; s.sun.nextAt = t0 + 5000; s.sun.spawned = 9; s.sun.introduced = true; showerNow(s, t0);
  let lit = 0, previewed = 0;
  tickRange(s, t0, t0 + Rain.SHOWER_MS - 1000, 250, (t) => { if (Game.sunpatchActive(s, t)) lit++; if (Game.sunpatchStatus(s, t).preview) previewed++; });
  assert.equal(lit, 0, "沒有光"); assert.equal(previewed, 0, "沒有預告");
});

/* ---------- 2、3 操作與獎勵 ---------- */
test("2a 雨水桶：開著遊戲 40 秒接滿，名牌寫進度；沒接滿點了寫還要幾秒", () => {
  const s = fresh(); lessonDone(s); s.coins = 50; Game.plant(s, 0, "wheat", T);
  const t0 = T + 20 * MIN; showerNow(s, t0);
  let b = Rain.barrel(s, t0); assert.equal(b.stage, "empty"); assert.match(b.label, /^接雨水・\d+%$/);
  tickRange(s, t0, t0 + 20000, 500); b = Rain.barrel(s, t0 + 20000);
  assert.equal(b.stage, "half"); assert.equal(b.label, "接雨水・50%");
  const early = Rain.pour(s, t0 + 20000); assert.equal(early.ok, false); assert.equal(early.reason, "filling"); assert.equal(early.message, "還沒接滿，再等 20 秒。");
  const ev = tickRange(s, t0 + 20500, t0 + 40000, 500); assert.equal(ev.filter((e) => e.filled).length, 1, "接滿那一拍通知一次");
  b = Rain.barrel(s, t0 + 40000); assert.equal(b.full, true); assert.equal(b.label, "雨水滿了・點一下倒"); assert.equal(b.art, Rain.ART.full);
  for (const text of [b.label, b.aria, Rain.HINT]) assert.doesNotMatch(text, NO_EN);
  assert.ok(Rain.HINT.length <= 30, "第一次的提示夠短：" + Rain.HINT.length);
});

test("2b 倒進田裡：還在長、還沒澆的田一次澆好（長快四分之一），陽光 +1；熟了的、澆過的不動", () => {
  const s = fresh(); lessonDone(s); s.coins = 80; Sun.addSunlight(s, 1);
  ["wheat", "wheat", "wheat", "wheat"].forEach((c, i) => Game.plant(s, i, c, T + 20 * MIN - 5000));
  const t0 = T + 20 * MIN; Game.waterPlot(s, 1, t0 - 4000); s.plots[2].plantedAt = t0 - 3600000;
  showerNow(s, t0); tickRange(s, t0, t0 + 40000, 500);
  /* 小麥 15 秒就熟，接水的 40 秒裡會長好；倒水前把 0、3 兩格當成剛種下（還在長、還沒澆），1 已澆、2 熟了。 */
  for (const i of [0, 3]) { s.plots[i].plantedAt = t0 + 39000; delete s.plots[i].wateredAt; }
  s.plots[1].plantedAt = t0 + 39000; s.plots[1].wateredAt = t0 + 39500;
  const before = Game.getCropProgress(s, s.plots[0], t0 + 40000).remainingMs, sun0 = Sun.sunlight(s);
  const r = Rain.pour(s, t0 + 40000);
  assert.equal(r.ok, true); assert.deepEqual(r.watered, [0, 3], "只澆還在長、還沒澆的那兩格");
  assert.equal(s.plots[0].wateredAt, t0 + 40000); assert.ok(Game.getCropProgress(s, s.plots[0], t0 + 40000).remainingMs < before, "澆了長得快");
  assert.equal(Sun.sunlight(s), sun0 + 1, "陽光 +1"); assert.equal(r.sunlight, 1);
  assert.equal(r.message, "倒進田裡：澆好 2 格田，陽光 +1。還能接 2 桶。"); assert.ok((r.message.match(/[一-鿿]/g) || []).length <= 20, "一次讀得完（中文不超過 20 字）");
  assert.doesNotMatch(r.message, NO_EN);
  assert.equal(Rain.barrel(s, t0 + 40000).stage, "empty", "倒完桶子空了，重新接");
});

test("3a 一段壞天氣最多倒 3 桶；倒滿 3 桶後桶子不再接水", () => {
  const s = fresh(); lessonDone(s); s.coins = 50; Game.plant(s, 0, "wheat", T);
  const t0 = T + 20 * MIN; showerNow(s, t0); s.r85Rain.showerUntil = t0 + 10 * MIN;
  let t = t0, pours = 0;
  for (let i = 0; i < 6; i++) { tickRange(s, t, t + 40000, 500); t += 40500; const r = Rain.pour(s, t); if (r.ok) pours++; else assert.equal(r.reason, "cap"); }
  assert.equal(pours, Rain.SPELL_CAP, "最多 3 桶");
  const b = Rain.barrel(s, t); assert.equal(b.capped, true); assert.equal(b.label, "接了 3 桶・等放晴");
  assert.equal(Rain.pour(s, t).message, "這段壞天氣已經倒了 3 桶，等放晴的虹光。");
  tickRange(s, t, t + 60000, 500); assert.equal(s.r85Rain.spell.filledMs, 0, "接滿 3 桶後不再接水");
});

test("3b 放晴有虹光：照 4 格、停 30 秒，在光裡收成多 1 份＋陽光；不能折；之後的光照舊最多 2 格", () => {
  const s = fresh(); lessonDone(s); s.coins = 80;
  for (let i = 0; i < 6; i++) Game.plant(s, i, "wheat", T + 20 * MIN - 1000);
  const t0 = T + 20 * MIN; s.plots[0].plantedAt = t0 - 3600000; showerNow(s, t0);
  tickRange(s, t0, t0 + 40000, 500); assert.equal(Rain.pour(s, t0 + 40000).ok, true);
  const end = s.r85Rain.showerUntil, ev = tickRange(s, t0 + 40500, end + 2000, 500), rb = ev.find((e) => e.rainbow);
  assert.ok(rb && rb.t >= end && rb.t <= end + 1000, "雨一停就落下虹光");
  assert.equal(rb.rainbow.length, Rain.RAINBOW_PLOTS, "照 4 格"); assert.ok(rb.rainbow.includes(0), "熟了的那格一定照到");
  assert.equal(s.sun.rainbow, true); assert.equal(s.sun.endsAt - s.sun.startsAt, Rain.RAINBOW_MS, "停 30 秒");
  assert.deepEqual(Game.sunpatchStatus(s, rb.t + 1000).plots.length, 4, "光的狀態也是 4 格（光斑規則接得住）");
  Game.updateSunpatch(s, rb.t + 1000, () => 0.5); assert.equal(s.sun.plots.length, 4, "整理光的狀態時不會被砍成 2 格");
  const inLight = Game.harvest(s, 0, rb.t + 2000, () => 0.5);
  assert.equal(inLight.ok, true); assert.ok(inLight.sun && inLight.sun.bonus >= 1, "在虹光裡收成多 1 份"); assert.ok(inLight.sun.sunlight >= 1, "也接到陽光");
  const free = [0, 1, 2, 3, 4, 5].find((i) => !s.sun.plots.includes(i));
  if (free != null) { const c = Sun.refractCheck(s, free, rb.t + 3000); assert.equal(c.reason, "rainbow", "虹光不能折"); assert.equal(Sun.refractPreview(s, free, rb.t + 3000).text, "虹光一次照好幾格，不用折"); }
  assert.equal(ev.filter((e) => e.rainbow).length, 1, "一段壞天氣只有一次虹光");
  /* 虹光散了以後，下一道一般的光照舊最多 2 格。 */
  const normal = [];
  const after = tickRange(s, rb.t + 1000, rb.t + 3 * MIN, 500, (t) => { if (Game.sunpatchActive(s, t) && !s.sun.rainbow) normal.push(s.sun.plots.length); });
  assert.ok(normal.length > 0, "之後照常有光"); assert.ok(Math.max(...normal) <= Game.SUNPATCH.maxPlots, "一般的光最多 2 格");
  assert.equal(after.some((e) => e.rainbow), false, "不會再落一次虹光");
});

test("3c 沒倒過桶子就沒有虹光；壞天氣的種類照實寫（雨水、雪水、露水）", () => {
  const s = fresh(); lessonDone(s); s.coins = 50; Game.plant(s, 0, "wheat", T);
  const t0 = T + 20 * MIN; showerNow(s, t0);
  const ev = tickRange(s, t0, s.r85Rain.showerUntil + 5000, 1000);
  assert.ok(ev.some((e) => e.ended), "雨停了"); assert.equal(ev.some((e) => e.rainbow), false, "沒倒過桶子就沒有虹光");
  for (const [weather, water] of [["storm", "雨水"], ["snow", "雪水"], ["fog", "露水"]]) {
    const n = fresh(); lessonDone(n); n.coins = 50; Game.plant(n, 0, "wheat", T); n.level = 5; n.weather = { id: weather, untilMs: T + 10 * MIN };
    Rain.update(n, T); tickRange(n, T, T + 40000, 500);
    const b = Rain.barrel(n, T + 40000); assert.equal(b.water, water); assert.equal(b.label, water + "滿了・點一下倒");
    assert.equal(Game.updateSunpatch(n, T + 41000, () => 0.5).spawned, false, weather + " 不出光");
  }
});

/* ---------- 4 離線不累積 ---------- */
test("4a 離線不累積：接水每次最多記 2 秒；離線時雨停了只補一次虹光，好幾段壞天氣也不疊", () => {
  const s = fresh(); lessonDone(s); s.coins = 50; Game.plant(s, 0, "wheat", T);
  const t0 = T + 20 * MIN; showerNow(s, t0); s.r85Rain.showerUntil = t0 + 30 * MIN;
  tickRange(s, t0, t0 + 10000, 500); const before = s.r85Rain.spell.filledMs;
  Rain.update(s, t0 + 10000 + 9 * MIN); assert.equal(s.r85Rain.spell.filledMs - before, Rain.STEP_CAP_MS, "離開 9 分鐘只記 2 秒");
  /* 倒過一桶以後離開；離開時雨停、又來一段壞天氣、又停：回來只落一次虹光。 */
  const n = fresh(); lessonDone(n); n.coins = 50; Game.plant(n, 0, "wheat", T); n.level = 5;
  n.weather = { id: "rain", untilMs: T + 10 * MIN }; Rain.update(n, T); tickRange(n, T, T + 40000, 500); assert.equal(Rain.pour(n, T + 40000).ok, true);
  n.weather = { id: "clear", untilMs: T + 3 * 3600000 };
  const back = T + 2 * 3600000, out = Rain.update(n, back);
  assert.ok(out.ended && out.rainbow && out.rainbow.length === 4, "回來時補一次虹光");
  assert.equal(Rain.update(n, back + 40000).rainbow, null, "不會再補第二次"); assert.equal(n.r85Rain.rainbows, 1);
  /* 離開時的那段壞天氣沒倒過桶子：回來沒有虹光。 */
  const m = fresh(); lessonDone(m); m.coins = 50; Game.plant(m, 0, "wheat", T); m.level = 5; m.weather = { id: "snow", untilMs: T + 10 * MIN };
  Rain.update(m, T); tickRange(m, T, T + 60000, 500); m.weather = { id: "clear", untilMs: T + 3 * 3600000 };
  assert.equal(Rain.update(m, T + 3600000).rainbow, null);
});

test("4b 存檔讀回來：雨水桶的進度跟著存檔走，欄位壞了會整理好", () => {
  const s = fresh(); lessonDone(s); s.coins = 50; Game.plant(s, 0, "wheat", T);
  const t0 = T + 20 * MIN; showerNow(s, t0); tickRange(s, t0, t0 + 20000, 500);
  const back = JSON.parse(JSON.stringify(s)); Rain.normalize(back, t0 + 20500);
  assert.deepEqual(back.r85Rain.spell, s.r85Rain.spell);
  back.r85Rain.spell.filledMs = -5; back.r85Rain.spell.buckets = 99; back.r85Rain.junk = 1; Rain.normalize(back, t0 + 21000);
  assert.equal(back.r85Rain.spell.filledMs, 0); assert.equal(back.r85Rain.spell.buckets, Rain.SPELL_CAP); assert.equal(back.r85Rain.junk, undefined);
});

/* ---------- 1d 新存檔一路玩：前 30 分鐘遇到雨、倒得到桶子、看得到虹光；前十分鐘的光照舊 ---------- */
function play(heirloom, untilMs) {
  const rng = seeded(85), s = fresh(T); s.coins = 16; if (heirloom) H.start(s);
  let busyUntil = T + 3000; const log = { lights: [], hint: 0, shower: 0, pours: 0, rainbow: 0, firstShower: 0, firstRainbow: 0 }; let was = false;
  const record = (event, t) => { A.record(s, event, t); A.finishTutorial(s, t); };
  const harvest = (i, t) => { const r = Game.harvest(s, i, t, rng); if (r.ok) record({ type: "harvest", cropId: r.cropId, count: r.added }, t); return r; };
  function farmAct(step, t) {
    if (!step) return 0; const i = step.plotIndex;
    switch (step.action) {
      case "plant": { const r = Game.plant(s, i, step.cropId || "wheat", t); if (r.ok) record({ type: "plant", cropId: step.cropId || "wheat" }, t); return r.ok ? 1500 : 0; }
      case "tend": { const r = Game.waterPlot(s, i, t); if (r.ok) record({ type: "water" }, t); return r.ok ? 1500 : 0; }
      case "harvest": return harvest(i, t).ok ? 1500 : 0;
      case "refract": return Sun.refract(s, i, t).ok ? 1500 : 0;
      case "ripen": { const r = Sun.ripen(s, i, t); return r && r.ok ? 1500 : 0; }
      case "catch_sun": { const c = Game.lightHarvestChoice(s, i, t), q = Game.lightHarvestQueue(s); if (!c.ok || (q && q.plotIndex === i)) return 0; return Game.queueLightHarvest(s, i, t).ok ? 500 : 0; }
      case "report": { if (step.target && step.target !== "field") record({ type: "talk", npcId: step.target }, t); return A.claim(s, step.questId || "c1_homecoming", t).ok ? 6000 : 0; }
      case "deliver": return A.claim(s, "c1_first_harvest", t).ok ? 6000 : 0;
      case "cook": return A.cook(s, "rustic_bread", t).ok ? 4000 : 0;
      case "eat": return A.eatMeal(s, "rustic_bread", t).ok ? 6000 : 0;
      case "explore": return A.restore(s, "fishing_dock", t).ok ? 6000 : 0;
      default: return 0;
    }
  }
  function questAct(t) {
    const q = A.summary(s, t).currentQuest; if (!q) return 0;
    if (q.canClaim) { record({ type: "talk", npcId: q.npcId }, t); return A.claim(s, q.id, t).ok ? 6000 : 0; }
    const row = (q.objectives || []).concat(q.requirements || []).find((r) => !r.complete); if (!row) return 0;
    if (row.type === "talk") { record({ type: "talk", npcId: row.id }, t); return 4000; }
    return 0;
  }
  for (let t = T; t <= T + untilMs; t += 250) {
    Game.updateSunpatch(s, t, rng);
    const r = Rain.update(s, t);
    if (r.hint) log.hint++; if (r.shower) { log.shower++; log.firstShower = log.firstShower || t; } if (r.rainbow) { log.rainbow++; log.firstRainbow = log.firstRainbow || t; }
    const active = Game.sunpatchActive(s, t); if (active && !was) log.lights.push({ start: t, end: s.sun.endsAt }); if (!active && was) log.lights[log.lights.length - 1].end = t; was = active;
    const queued = Game.lightHarvestQueue(s); if (queued && queued.autoHarvest && Game.isSunlit(s, queued.plotIndex, t)) harvest(queued.plotIndex, t);
    W.update(s, t);
    if (t < busyUntil) continue;
    /* 桶子滿了，玩家點一下倒（田邊的物件，不經過任務卡）。 */
    const b = Rain.barrel(s, t); if (b && b.full) { if (Rain.pour(s, t).ok) { log.pours++; busyUntil = t + 1500; continue; } }
    const h = H.status(s), farm = A.nextFarmStep(s, t); let cost = 0;
    if (heirloom && h.started && !h.delivered) cost = h.ready ? (H.deliver(s, "table", t).ok ? 6000 : 0) : farmAct(farm, t);
    else cost = farmAct(farm, t) || questAct(t);
    if (cost) busyUntil = t + cost;
  }
  return { s, log };
}
test("1d 兩種開場照任務卡玩 30 分鐘：前十分鐘沒有雨、光照舊；第 15～25 分鐘遇到雨，倒得到桶子，30 分鐘內看得到虹光", () => {
  for (const heirloom of [true, false]) {
    const name = heirloom ? "祖母手記開場" : "一般開場", run = play(heirloom, 30 * MIN), L = run.log;
    assert.equal(L.shower, 1, `${name}：遇到一次過雲雨`); assert.equal(L.hint, 1, `${name}：提示只跳一次`);
    assert.ok(L.firstShower >= T + 15 * MIN && L.firstShower <= T + 25 * MIN + 2000, `${name}：第 ${((L.firstShower - T) / MIN).toFixed(1)} 分鐘下雨`);
    assert.ok(L.pours >= 1 && L.pours <= Rain.SPELL_CAP, `${name}：倒了 ${L.pours} 桶`);
    assert.equal(L.rainbow, 1, `${name}：看到一次虹光`); assert.ok(L.firstRainbow < T + 30 * MIN, `${name}：30 分鐘內看到虹光`);
    const early = L.lights.filter((l) => l.start < T + 10 * MIN);
    for (let i = 1; i < early.length; i++) assert.ok(early[i].start - early[i - 1].end <= 20000, `${name}：前十分鐘兩道光最多隔 20 秒`);
  }
});

/* ---------- 6 素材與接線 ---------- */
test("6a MUSE 新圖：雨水桶三種水量 64×64、虹光 192×96，都有透明背景；manifest 寫 MUSE CLI 與模型未回報", () => {
  const dir = path.join(ROOT, "assets/generated/content-r85b"), man = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  assert.match(man.model, /MUSE CLI/); assert.match(man.model, /模型未回報/);
  const want = { "rain-barrel-empty.png": [64, 64], "rain-barrel-half.png": [64, 64], "rain-barrel-full.png": [64, 64], "rainbow-light.png": [192, 96] };
  for (const [file, size] of Object.entries(want)) {
    const buf = fs.readFileSync(path.join(dir, file)), row = man.files.find((f) => f.file === file);
    assert.equal(buf.slice(1, 4).toString(), "PNG"); assert.deepEqual([buf.readUInt32BE(16), buf.readUInt32BE(20)], size, file + " 尺寸");
    assert.equal(buf[25], 6, file + " 是 RGBA（有透明）");
    assert.ok(row && row.bytes === buf.length && row.sha256 === require("node:crypto").createHash("sha256").update(buf).digest("hex"), file + " manifest 雜湊相符");
  }
  for (const key of ["empty", "half", "full", "rainbow"]) assert.ok(fs.existsSync(path.join(ROOT, Rain.ART[key])), "程式指到的圖存在：" + Rain.ART[key]);
  assert.match(read("CREDITS.md"), /content-r85b/);
});
test("6b 接線：rainplay 接在 waitplay 後面、sw.js 有快取；game.js 的過雲雨與虹光掛鉤；不改版本號", () => {
  const html = read("index.html"); assert.match(html, /<script src="src\/rainplay-r85\.js\?v=/); assert.ok(html.indexOf("rainplay-r85.js") > html.indexOf("waitplay-r82.js"));
  const sw = read("sw.js"); assert.match(sw, /"\.\/src\/rainplay-r85\.js"/); assert.match(sw, /CACHE_VERSION = "content-r86-20261119-1"/);
  const game = read("src/game.js"); assert.match(game, /shower\.showerUntil > now/); assert.match(game, /rainbowMaxPlots: 4/);
  assert.match(read("src/waitplay-r82.js"), /state\.r85Rain && state\.r85Rain\.spell/, "田邊小事讓開雨水桶那一格");
  /* 任務卡、右下大鈕不另開一條：adventure.js、world-ui.js 沒有雨水桶的字。 */
  for (const file of ["src/adventure.js", "src/world-ui.js"]) assert.doesNotMatch(read(file), /雨水桶|r85b-barrel|FarmRainplay/, file + " 不另開一條下一步");
});

/* ---------- 5 版面：四種尺寸實際開瀏覽器量 ---------- */
const VIEWS = [[1366, 768, false], [1366, 600, false], [390, 844, true], [844, 390, true]];
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
function serve() { return new Promise((resolve, reject) => { const server = http.createServer((req, res) => { const u = new URL(req.url, "http://127.0.0.1"), file = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))); if (path.relative(ROOT, file).startsWith("..") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(file).pipe(res); }); server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server)); }); }
async function launch(chromium) { const opts = { headless: true, args: ["--no-sandbox", "--disable-gpu"] }; try { return await chromium.launch(opts); } catch (_) { /* 換系統瀏覽器 */ } for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) { /* 下一個 */ } throw Error("No browser available"); }

function install() {
  const shown = (el) => { if (!el) return false; const own = el.getBoundingClientRect(); if (own.width <= 2 || own.height <= 2) return false; for (let p = el; p && p !== document.body; p = p.parentElement) { if (p.hidden) return false; const c = getComputedStyle(p); if (c.display === "none" || c.visibility === "hidden" || c.opacity === "0") return false; } return true; };
  const rect = (e) => { if (!e) return null; const z = e.getBoundingClientRect(); return { l: z.left, t: z.top, r: z.right, b: z.bottom, w: z.width, h: z.height }; };
  const ov = (a, b) => (a && b ? Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t)) : 0);
  window.__r85w = {
    shown, rect, ov,
    /* 走完光裡收成教學、三格田在長（兩格還沒澆）、光還要很久才來；然後讓過雲雨從現在開始下。 */
    setup() {
      document.querySelectorAll(".modal.show").forEach((n) => n.classList.remove("show")); const d = document.querySelector("#worldDialogue"); if (d) d.hidden = true; document.querySelectorAll(".r76b-dialogue,.npc-bubble").forEach((n) => n.remove());
      const s = __farm.state(), t = Date.now(); AdventureAPI.ensure(s, t); s.coins = 80; s.flags.r79FirstLightHarvest = true; s.adventure.claimed.c1_first_harvest = true; s.stats.plantCount = Math.max(3, s.stats.plantCount || 0);
      for (let i = 0; i < 3; i++) { const p = s.plots[i]; p.cropId = null; plant(s, i, "wheat", t); } s.plots[2].wateredAt = t;
      Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000, spawned: 9, introduced: true });
      /* 角色站在田邊（第一格田），鏡頭跟著角色；1.5 秒後開始下雨。 */
      FarmRainplay.normalize(s, t); Object.assign(s.r85Rain, { showerAt: t + 1500, showerDone: false, seenBad: false, hinted: false, spell: null });
      const p0 = s.map.tiles.find((x) => x.plotIndex === 0); s.player.tileId = p0.id; s.player.x = p0.x; s.player.y = p0.y; s.interaction.selectedTileId = null; __farm.cancelJourney(); __farm.refresh(); __farm.followPlayer();
      return { quest: (document.querySelector("#questDock") || {}).textContent || "", thumb: (document.querySelector("#actionA") || {}).textContent || "" };
    },
    look() {
      const node = document.querySelector("#mapWorld .r85b-barrel"), tag = node && node.querySelector(".r85b-barrel-tag"), r = rect(node);
      const hit = r ? document.elementFromPoint(r.l + r.w / 2, r.t + r.h / 2) : null;
      const huds = ["#questDock", "#actionA", "#mobileControls", ".toolbar", "#farmDock", "#seedHud", "#sceneActionBar", "#worldMinimap", "#sunChip", "#resBar"].map((sel) => [sel, document.querySelector(sel)]).filter(([, el]) => shown(el)).map(([sel, el]) => ({ sel, r: rect(el) }));
      const player = rect(document.querySelector("#player .p-sprite") || document.getElementById("player"));
      return { barrel: r, shown: shown(node), tag: rect(tag), tagText: tag ? tag.textContent : "", stage: node ? node.dataset.stage : "", topHit: !!(hit && node && node.contains(hit)), huds, player,
        toasts: [...document.querySelectorAll("#toast-zone .toast")].map((n) => n.textContent), weather: currentWeather(__farm.state(), Date.now()), layer: (document.getElementById("weatherLayer") || {}).className || "",
        quest: (document.querySelector("#questDock") || {}).textContent || "", thumb: (document.querySelector("#actionA") || {}).textContent || "", vw: innerWidth, vh: innerHeight };
    },
  };
}

async function weatherChecks(page, tag, mobile) {
  const before = await page.evaluate(() => __r85w.setup());
  /* 一、下雨了：短提示、雨的畫面、田邊的雨水桶。 */
  let toastSeen = "", m = null;
  /* 雨水桶第一次出現時，看不到就把鏡頭帶過去；被固定介面蓋住會換到看得到的那格。最多等 8 秒讓它站定。 */
  for (let i = 0; i < 32; i++) {
    await page.clock.runFor(250); m = await page.evaluate(() => __r85w.look()); if (!toastSeen) toastSeen = m.toasts.find((x) => /雨水桶/.test(x)) || "";
    if (i >= 12 && m.shown && m.topHit) break;
  }
  assert.equal(toastSeen, "下雨了，光暫停。田邊雨水桶接滿點一下，雨停有虹光。", `${tag} 第一次下雨跳一則短提示`);
  assert.equal(m.weather, "rain"); assert.match(m.layer, /rain/, `${tag} 畫面在下雨`);
  assert.ok(m.shown, `${tag} 看得到雨水桶`);
  assert.ok(m.barrel.w >= 44 && m.barrel.h >= 44, `${tag} 雨水桶命中區至少 44px ${JSON.stringify(m.barrel)}`);
  const inView = (r) => r && r.l >= 0 && r.t >= 0 && r.r <= m.vw && r.b <= m.vh;
  assert.ok(inView(m.barrel) && inView(m.tag), `${tag} 雨水桶與名牌都在畫面內 ${JSON.stringify([m.barrel, m.tag])}`);
  assert.ok(m.topHit, `${tag} 雨水桶沒被別的東西蓋住，點得到`);
  for (const h of m.huds) { assert.equal(await page.evaluate(([a, b]) => __r85w.ov(a, b), [m.barrel, h.r]), 0, `${tag} 雨水桶不疊 ${h.sel}`); assert.equal(await page.evaluate(([a, b]) => __r85w.ov(a, b), [m.tag, h.r]), 0, `${tag} 名牌不疊 ${h.sel}`); }
  assert.doesNotMatch(m.quest + m.thumb, /雨水桶|虹光/, `${tag} 任務卡與右下大鈕不另開一條`);
  assert.equal(await page.evaluate(([a, b, c]) => __r85w.ov(a, c) + __r85w.ov(b, c), [m.barrel, m.tag, m.player]), 0, `${tag} 雨水桶與名牌不壓在角色身上 ${JSON.stringify([m.barrel, m.player])}`);
  /* 二、接滿：開著遊戲 40 秒。 */
  await page.clock.runFor(40500);
  m = await page.evaluate(() => __r85w.look());
  assert.equal(m.stage, "full", `${tag} 40 秒接滿`); assert.equal(m.tagText, "雨水滿了・點一下倒");
  /* 三、點一下倒進田裡（手機用點按）。小麥 15 秒就熟，接水的時候已經長好；把 0、1 兩格當成剛種下、還沒澆，2 已澆。 */
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); for (const i of [0, 1, 2]) { s.plots[i].plantedAt = t; delete s.plots[i].wateredAt; } s.plots[2].wateredAt = t; __farm.refresh(); });
  await page.clock.runFor(300);
  const loc = page.locator("#mapWorld .r85b-barrel");
  if (mobile) await loc.tap(); else await loc.click();
  await page.clock.runFor(400);
  const after = await page.evaluate(() => { const s = __farm.state(); return { spell: s.r85Rain.spell, wet: [0, 1, 2].map((i) => (s.plots[i].wateredAt || 0) >= s.plots[i].plantedAt), toasts: [...document.querySelectorAll("#toast-zone .toast")].map((n) => n.textContent), sun: FarmSunplay.sunlight(s) }; });
  assert.equal(after.spell.buckets, 1, `${tag} 倒了一桶`); assert.deepEqual(after.wet, [true, true, true], `${tag} 三格都澆好了`);
  assert.ok(after.toasts.some((x) => /^倒進田裡：澆好 2 格田，陽光 \+1。還能接 2 桶。$/.test(x)), `${tag} 寫澆了幾格、陽光幾點 ${JSON.stringify(after.toasts)}`);
  /* 四、雨停：虹光照 4 格，鏡頭帶到田上，看得到彩虹。 */
  await page.evaluate(() => { const r = __farm.state().r85Rain; r.showerUntil = Date.now() + 600; });
  const seen = new Set();
  for (let i = 0; i < 24; i++) { await page.clock.runFor(250); (await page.evaluate(() => [...document.querySelectorAll("#toast-zone .toast")].map((n) => n.textContent))).forEach((x) => seen.add(x)); }
  const rb = await page.evaluate(() => { const s = __farm.state(), node = document.querySelector("#mapWorld .r85b-rainbow"), r = __r85w.rect(node); return { plots: s.sun.plots.slice(), rainbow: s.sun.rainbow, shown: __r85w.shown(node), r, barrel: !!document.querySelector("#mapWorld .r85b-barrel"), toasts: [...document.querySelectorAll("#toast-zone .toast")].map((n) => n.textContent), vw: innerWidth, vh: innerHeight }; });
  assert.equal(rb.rainbow, true, `${tag} 雨停落下虹光`); assert.equal(rb.plots.length, 4, `${tag} 虹光照 4 格`);
  assert.equal(rb.shown, true, `${tag} 看得到彩虹`); assert.ok(rb.r.r > 0 && rb.r.l < rb.vw && rb.r.b > 0 && rb.r.t < rb.vh, `${tag} 彩虹在畫面上 ${JSON.stringify(rb.r)}`);
  assert.equal(rb.barrel, false, `${tag} 放晴後雨水桶收起來`);
  assert.ok(seen.has("放晴了！虹光照 4 格田 30 秒，光裡種、澆、收都有加成。"), `${tag} 虹光提示 ${JSON.stringify([...seen])}`);
}

async function browserChecks() {
  let chromium; try { ({ chromium } = require("playwright")); } catch (_) { throw Error("playwright 不可用"); }
  const server = await serve(), origin = "http://127.0.0.1:" + server.address().port, browser = await launch(chromium); let checks = 0;
  try {
    for (const [width, height, mobile] of VIEWS) {
      const tag = width + "x" + height;
      const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", reducedMotion: "reduce" });
      const page = await context.newPage(), errors = []; page.on("pageerror", (e) => errors.push(String(e)));
      await page.clock.install({ time: T });
      await page.goto(origin);
      for (let i = 0; i < 60 && !(await page.evaluate(() => !!(window.__farm && window.AdventureAPI && window.FarmRainplay && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading")))); i++) await page.clock.runFor(500);
      await page.evaluate(() => document.querySelector("#worldBegin")?.click());
      await page.clock.runFor(600); await page.evaluate(install);
      await weatherChecks(page, tag, mobile); checks++;
      assert.deepEqual(errors, [], tag + " 沒有頁面錯誤");
      await context.close();
    }
  } finally { await browser.close(); server.close(); }
  return checks;
}

(async () => {
  for (const [name, fn] of pending) { try { await fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
  if (process.argv.includes("--rules-only")) {
    if (!process.exitCode) console.log(`R85 weather rules: ${passed} passed (no browser)`);
    return;
  }
  try { const checks = await browserChecks(); passed++; console.log(`PASS 5 實拍 ${VIEWS.map((v) => v[0] + "×" + v[1]).join("、")}：提示、雨水桶 44px 在畫面內不疊介面、接滿點了會倒、放晴有虹光（${checks} 組）`); }
  catch (error) { console.error("FAIL 5 實拍\n" + error.stack); process.exitCode = 1; }
  if (!process.exitCode) console.log(`R85B weather: ${passed} passed`);
})();
