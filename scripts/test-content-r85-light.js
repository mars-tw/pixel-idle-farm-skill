"use strict";
/* R85B 第 1、2 項：看得懂的光、不空等。
 * 1 折光前看得到「折過來會怎樣」：瞄準時（選了一格能折的田，或任務卡正在教折光）落點那一格畫光斑，底下一行寫這格的光性與照到後的實際收益，
 *   數字跟遊戲規則同一套（在光裡種、澆：生長時間立刻少三成；收成多幾份、陽光幾點、優質會不會沒了）。
 * 2 同一時間只有一個預告圈：光要落在兩格時，圈只畫在一格，另一格只鋪淡淡的光暈。
 * 3 同一格田不疊多個教學元素：有預告圈或折光落點的那一格，任務標記與「下一格」先藏起來。
 * 4 等光間隔：新存檔前十分鐘兩道光最多隔 20 秒。前十分鐘除了看存檔建立後的牆上時間，新存檔另外記「開著遊戲的時間」；
 *   連續玩的話四種尺寸本來就都在 20 秒內；遊戲時鐘裡找得到的「新存檔等超過 20 秒」只有一條：存檔建立後隔一段時間才繼續玩
 *   （手機切到背景、玩幾分鐘離開再回來、截圖換尺寸沿用同一份存檔），牆上時間先過十分鐘，第二道光起就回到 40 秒，
 *   R84 圖 106（1366×600）的 29 秒等光最可能就是這樣。現在照實際玩的時間算；遊戲時鐘模擬兩種開場，四種尺寸實際開瀏覽器量。
 * 5 手機閱讀量（R85B 第 3 項）：鎮長第一次講光的那一句、雨天的提示改短；手機上追光手冊小卡只留印章那一行與「打開手冊」，其餘收進「說明」，點了才展開。
 *   手機麻雀二選一（R84 圖 163）：查過是真的會點不到——844×390 時麻雀被放到花叢後面，點到花叢那半邊不會跳出；現在小事讓開擺飾、畫在擺飾上面。
 * 6 接線：排進 unit 清單；樣式在 src/content-r85b.css。 */
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
global.window = global;
const ROOT = path.join(__dirname, ".."), read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const State = require("../src/state.js"), Sun = require("../src/sunplay-r75.js"), Game = require("../src/game.js"), A = require("../src/adventure.js");
const H = require("../src/heirloom.js"), W = require("../src/waitplay-r82.js"), Q = require("../src/choices-r77.js");
Q.install();
const T = 1794172800000, TEN_MIN = 10 * 60 * 1000;
let passed = 0;
const pending = [];
function test(name, fn) { pending.push([name, fn]); }
function fresh(now = T) { const s = State.defaultState(now); Sun.normalize(s); A.ensure(s, now); return s; }
function seeded(seed) { let x = seed; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; }
function preview(s, plots, at) { Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: plots, previewAt: at, nextAt: at, refractions: 0 }); }
function lessonDone(s) { s.flags.r79FirstLightHarvest = true; s.adventure.claimed.c1_first_harvest = true; }

/* ---------- 第 1 項：瞄準預覽的字 ---------- */
test("1a 瞄準預覽：空地、還沒澆、已澆、熟了四種情況都寫光性與實際數字，跟遊戲規則同一套", () => {
  const s = fresh(); s.coins = 100; lessonDone(s);
  Game.plant(s, 0, "wheat", T); Game.plant(s, 1, "wheat", T); Game.waterPlot(s, 1, T); Game.plant(s, 2, "wheat", T); s.plots[2].plantedAt = T - 3600000;
  preview(s, [4], T + 6000);
  const boost = Math.round(Math.min(Game.SUNPATCH.growthBoostCapMs, Math.round(Math.max(1000, Math.floor(Game.effectiveGrowMs(s, "wheat", T) * 0.75)) * Game.SUNPATCH.growthBoost)) / 1000);
  const dry = Sun.aimPreview(s, 0, T), wet = Sun.aimPreview(s, 1, T), ripe = Sun.aimPreview(s, 2, T), empty = Sun.aimPreview(s, 3, T);
  assert.equal(dry.ok, true); assert.equal(dry.trait, "sun");
  assert.equal(dry.tag, "☀喜光・長快三成", "還沒澆：這格是喜光作物，在光裡澆水長快三成");
  assert.match(dry.line, new RegExp(`^喜光小麥：在光裡澆水，馬上長快 ${boost} 秒（三成），收成多 1 份$`));
  assert.equal(wet.tag, "☀喜光・收成多 1 份", "已澆：照到後收成多 1 份（喜光）");
  const lit = Sun.harvestOutcome(s, s.plots[2], { exposedNow: true, caughtSunlight: 1 });
  assert.equal(ripe.tag, `☀喜光・多 ${lit.yieldBonus} 份＋陽光 ${lit.sunlightTotal}`, "熟了：在光裡收成多幾份＋陽光幾點");
  assert.equal(empty.tag, "種下長快三成"); assert.equal(empty.trait, null);
  for (const p of [dry, wet, ripe, empty]) { assert.ok(p.tag.length <= 14, "光斑底下那行夠短：" + p.tag); assert.doesNotMatch(p.tag + p.line, /[A-Za-z]/); assert.ok(p.text.startsWith("折過來：")); }
  /* 不能折的格子沒有預覽；本來就會照到的那一格也沒有。 */
  assert.equal(Sun.aimPreview(s, 4, T).ok, false, "光本來就落在這格"); assert.equal(Sun.aimPreview(s, 9, T).ok, false, "不是開墾好的田");
});

test("1b 光性：半日照與耐陰寫優質的變化", () => {
  const s = fresh(); s.coins = 500; s.level = 9; lessonDone(s);
  s.adventure.r58.r59.seedPacks = Object.assign({}, s.adventure.r58.r59.seedPacks, { carrot: 1, strawberry: 1 });
  ["carrot", "strawberry"].forEach((id, i) => { const r = Game.plant(s, i, id, T); assert.equal(r.ok, true, "種得下 " + id + " " + JSON.stringify(r)); Game.waterPlot(s, i, T); });
  preview(s, [4], T + 6000);
  const partial = Sun.aimPreview(s, 0, T), shade = Sun.aimPreview(s, 1, T);
  assert.equal(partial.trait, "partial"); assert.equal(partial.tag, "◐半日照・保證 1 份優質", "半日照照到剛好一次保證優質");
  assert.equal(shade.trait, "shade"); assert.equal(shade.tag, "☂耐陰・陰涼優質會沒了", "耐陰照到就沒了陰涼優質");
});

test("1c 一個預告圈：兩格要照時，圈給最值得照顧的那一格（熟了 > 還沒澆 > 已澆 > 空地）", () => {
  const s = fresh(); s.coins = 100;
  Game.plant(s, 1, "wheat", T); Game.waterPlot(s, 1, T); Game.plant(s, 3, "wheat", T);
  assert.equal(Sun.previewPrimary(s, [1, 3], T), 3, "還沒澆的比已澆的優先");
  assert.equal(Sun.previewPrimary(s, [0, 1], T), 1, "已澆的比空地優先");
  s.plots[1].plantedAt = T - 3600000; assert.equal(Sun.previewPrimary(s, [1, 3], T), 1, "熟了最優先");
  assert.equal(Sun.previewPrimary(s, [0, 2], T), 0, "同分取前面那格");
  assert.equal(Sun.previewPrimary(s, [], T), null);
});

/* ---------- 第 4 項：前十分鐘照實際玩的時間算 ---------- */
/* 照任務卡做的新玩家（跟 R84 節奏測試同一套玩法），可以在中間離開一段時間（offline：[從第幾毫秒, 離開多久]）。每 250 毫秒更新一次。 */
function play(heirloom, untilMs, offline) {
  const rng = seeded(85), s = fresh(T); s.coins = 16; if (heirloom) H.start(s);
  const lights = []; let busyUntil = T + 3000, firstPlantAt = 0, was = false, shift = 0;
  const record = (event, t) => { A.record(s, event, t); A.finishTutorial(s, t); };
  const harvest = (i, t) => { const r = Game.harvest(s, i, t, rng); if (r.ok) record({ type: "harvest", cropId: r.cropId, count: r.added }, t); return r; };
  function farmAct(step, t) {
    if (!step) return 0; const i = step.plotIndex;
    switch (step.action) {
      case "plant": { const r = Game.plant(s, i, step.cropId || "wheat", t); if (r.ok) { record({ type: "plant", cropId: step.cropId || "wheat" }, t); if (!firstPlantAt) firstPlantAt = t; } return r.ok ? 1500 : 0; }
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
  for (let i = 0; i * 250 <= untilMs; i++) {
    if (offline && i * 250 === offline[0]) { shift = offline[1]; busyUntil += shift; if (was && lights.length) lights[lights.length - 1].end = Math.min(lights[lights.length - 1].end, T + i * 250); was = false; lights.push({ gap: true }); }
    const t = T + i * 250 + shift;
    Game.updateSunpatch(s, t, rng); Sun.refreshLightCountdown(s.sun, t);
    const active = Game.sunpatchActive(s, t);
    if (active && !was) lights.push({ start: t, end: s.sun.endsAt, early: Game.earlyLightWindow(s, t) });
    if (!active && was) lights[lights.length - 1].end = t;
    was = active;
    const queued = Game.lightHarvestQueue(s); if (queued && queued.autoHarvest && Game.isSunlit(s, queued.plotIndex, t)) harvest(queued.plotIndex, t);
    W.update(s, t);
    if (t < busyUntil) continue;
    const farm = A.nextFarmStep(s, t), h = H.status(s);
    let cost = 0;
    if (heirloom && h.started && !h.delivered) cost = h.ready ? (H.deliver(s, "table", t).ok ? 6000 : 0) : farmAct(farm, t);
    else cost = farmAct(farm, t) || questAct(t);
    if (cost) busyUntil = t + cost;
  }
  return { s, lights, firstPlantAt, shift };
}
/* 每一段「沒有光、在等下一道光」：上一道光散掉到下一道光落下（離開遊戲的那一段不算）。 */
function waits(run) {
  const rows = []; let from = run.firstPlantAt;
  for (const light of run.lights) { if (light.gap) { from = 0; continue; } if (from) rows.push({ from, ms: light.start - from, early: light.early }); from = light.end; }
  return rows;
}
const playedMs = (run, w) => w.from - T - (w.from - T >= (run.offlineAt || Infinity) ? run.shift : 0);

test("4a 遊戲時鐘：兩種開場一路玩，前十分鐘每一段等光都不超過 20 秒（R84 只要求 30 秒）", () => {
  for (const heirloom of [true, false]) {
    const run = play(heirloom, TEN_MIN), name = heirloom ? "祖母手記開場" : "一般開場";
    const early = waits(run).filter((w) => w.from < T + TEN_MIN - 1000);
    assert.ok(early.length >= 15, `${name}：前十分鐘有 ${early.length} 段等光`);
    const worst = Math.max(...early.map((w) => w.ms));
    assert.ok(worst <= 20000, `${name}：前十分鐘最久等 ${worst / 1000} 秒：` + early.map((w) => Math.round(w.ms / 1000)).join("、"));
  }
});

test("4b R84 圖 106：存檔建立後隔一段時間才繼續玩，仍照實際玩的時間算前十分鐘（改前會回到 40 秒）", () => {
  for (const heirloom of [true, false]) for (const [at, away] of [[3 * 60000, 60 * 60000], [30000, 11 * 60000], [6 * 60000, 24 * 3600000]]) {
    const run = play(heirloom, 9 * 60000, [at, away]); run.offlineAt = at;
    const name = `${heirloom ? "祖母手記開場" : "一般開場"}・玩 ${at / 60000} 分鐘離開 ${Math.round(away / 60000)} 分鐘`;
    const ws = waits(run).filter((w) => playedMs(run, w) < TEN_MIN - 30000);
    const after = ws.filter((w) => w.from >= T + at + away);
    assert.ok(after.length >= 5, `${name}：回來後有 ${after.length} 段等光`);
    const worst = Math.max(...ws.map((w) => w.ms));
    assert.ok(worst <= 20000, `${name}：實際玩的前十分鐘最久等 ${worst / 1000} 秒：` + ws.map((w) => Math.round(w.ms / 1000)).join("、"));
    assert.ok(run.s.sun.earlyPlayMs > 0 && run.s.sun.earlyPlayMs < TEN_MIN, `${name}：只記開著遊戲的時間 ${run.s.sun.earlyPlayMs}`);
  }
  /* 對照：把「開著遊戲的時間」關掉（等於改前只看牆上時間），同樣的玩法回來後就是 40 秒。 */
  const keep = Game.SUNPATCH.earlyNewSaveMs; Game.SUNPATCH.earlyNewSaveMs = -1;
  try {
    const run = play(false, 9 * 60000, [3 * 60000, 60 * 60000]);
    const after = waits(run).filter((w) => w.from >= T + 63 * 60000);
    assert.ok(after.some((w) => Math.abs(w.ms - Game.SUNPATCH.intervalMs) <= 250), "改前：回來後回到 40 秒（R84 圖 106）：" + after.map((w) => Math.round(w.ms / 1000)).join("、"));
  } finally { Game.SUNPATCH.earlyNewSaveMs = keep; }
});

test("4c 只延長新存檔：舊存檔、天氣解鎖以後、玩滿十分鐘以後照舊；離線再久也只記 2 秒", () => {
  const P = Game.SUNPATCH;
  assert.deepEqual([P.intervalMs, P.sunnyIntervalMs, P.durationMs, P.firstDelayMs, P.firstDurationMs, P.earlyGapMs, P.earlyWindowMs], [40000, 28000, 16000, 8000, 40000, 20000, TEN_MIN], "節奏常數不變");
  /* 舊存檔：第一次更新時存檔已經建立超過一分鐘，不記開著遊戲的時間。 */
  const old = fresh(T - 3600000); Game.updateSunpatch(old, T, () => 0.5);
  assert.equal(old.sun.earlyPlayMs, -1); assert.equal(Game.earlyLightWindow(old, T + 1000), false);
  /* 新存檔：開著 30 秒、離開 2 小時，回來只多記 2 秒。 */
  const neu = fresh(T); for (let t = T; t <= T + 30000; t += 500) Game.updateSunpatch(neu, t, () => 0.5);
  assert.equal(neu.sun.earlyPlayMs, 30000);
  Game.updateSunpatch(neu, T + 2 * 3600000, () => 0.5); assert.equal(neu.sun.earlyPlayMs, 32000, "離開兩小時只記 2 秒");
  assert.equal(Game.earlyLightWindow(neu, T + 2 * 3600000 + 1000), true, "回來還在前十分鐘");
  neu.level = 5; assert.equal(Game.earlyLightWindow(neu, T + 2 * 3600000 + 1000), false, "天氣解鎖以後照天氣算"); neu.level = 1;
  neu.sun.earlyPlayMs = TEN_MIN; assert.equal(Game.earlyLightWindow(neu, T + 2 * 3600000 + 1000), false, "玩滿十分鐘就結束");
  /* R84 的規則照舊：沒有更新過的新存檔，牆上時間十分鐘整結束。 */
  const s = fresh(T); assert.equal(Game.earlyLightWindow(s, T + TEN_MIN - 1), true); assert.equal(Game.earlyLightWindow(s, T + TEN_MIN), false);
});

/* ---------- 第 5 項：手機閱讀量 ---------- */
test("5a 手機閱讀量：鎮長第一次講光的那一句不超過 26 字、數字照規則；雨天的提示不超過 26 字", () => {
  const ui = read("src/ui.js"), m = ui.match(/const line = "(看，陽光照到田上了！[^"]*)";/);
  assert.ok(m, "找得到那一句"); const cjk = (t) => (t.match(/[一-鿿]/g) || []).length;
  assert.ok(cjk(m[1]) <= 26, "鎮長那一句 " + cjk(m[1]) + " 字（R84 是 35 字）：" + m[1]);
  assert.match(m[1], /長快三成/); assert.match(m[1], /多收一份/); assert.equal(Math.round(Game.SUNPATCH.growthBoost * 10), 3); assert.equal(Game.SUNPATCH.harvestBonus, 1);
  const Rain = require("../src/rainplay-r85.js");
  for (const text of [Rain.HINT, Rain.rainbowText(4)]) assert.ok(cjk(text) <= 26, "雨天的提示夠短：" + text);
});

/* ---------- 第 6 項：接線 ---------- */
test("6a 接線：測試排進 unit 清單；樣式在 content-r85b.css、括號成對；不改版本號", () => {
  const guard = read("scripts/guard-validation-writes.js"), list = guard.slice(guard.indexOf("const unit=["), guard.indexOf("];", guard.indexOf("const unit=[")));
  assert.match(list, /"node scripts\/test-content-r85-light\.js"/); assert.match(list, /"node scripts\/test-content-r85-weather\.js"/);
  assert.ok(list.indexOf("test-content-r85-light") > list.indexOf("test-content-r84-pace"), "接在 R84 後面");
  const css = read("src/content-r85b.css"); assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
  assert.match(css, /\.r77a-refract-ghost \.r85b-aim-tag/); assert.match(css, /\.r85b-sun-also/);
  const html = read("index.html"); assert.match(html, /src\/content-r85b\.css\?v=/); assert.ok(html.indexOf("content-r85b.css") > html.indexOf("content-r58b.css"), "排在 content-r58b.css 後面");
  assert.match(read("sw.js"), /"\.\/src\/content-r85b\.css"/);
  assert.match(read("sw.js"), /CACHE_VERSION = "content-r84-20261117-1"/, "版本字串沒動");
});

/* ---------- 瀏覽器：四種尺寸實際開瀏覽器量 ---------- */
const VIEWS = [[1366, 768, false], [1366, 600, false], [390, 844, true], [844, 390, true]];
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
function serve() { return new Promise((resolve, reject) => { const server = http.createServer((req, res) => { const u = new URL(req.url, "http://127.0.0.1"), file = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))); if (path.relative(ROOT, file).startsWith("..") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(file).pipe(res); }); server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server)); }); }
async function launch(chromium) { const opts = { headless: true, args: ["--no-sandbox", "--disable-gpu"] }; try { return await chromium.launch(opts); } catch (_) { /* 換系統瀏覽器 */ } for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) { /* 下一個 */ } throw Error("No browser available"); }

/* 頁面裡：量測工具與擺狀態。 */
function install() {
  const shown = (el) => { if (!el) return false; const own = el.getBoundingClientRect(); if (own.width <= 2 || own.height <= 2) return false; for (let p = el; p && p !== document.body; p = p.parentElement) { if (p.hidden) return false; const c = getComputedStyle(p); if (c.display === "none" || c.visibility === "hidden" || c.opacity === "0") return false; } return true; };
  const rect = (e) => { if (!e) return null; const z = e.getBoundingClientRect(); return { l: z.left, t: z.top, r: z.right, b: z.bottom, w: z.width, h: z.height }; };
  const ov = (a, b) => (a && b ? Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t)) : 0);
  window.__r85b = {
    rect, ov, shown,
    clear() { document.querySelectorAll(".modal.show").forEach((n) => n.classList.remove("show")); const d = document.querySelector("#worldDialogue"); if (d) d.hidden = true; document.querySelectorAll(".r76b-dialogue,.npc-bubble").forEach((n) => n.remove()); },
    /* 已經學過折光：四格作物（0 還沒澆、1 已澆、2 熟了、3 空地），光要落在 previewPlots。 */
    field(previewPlots, lesson) {
      this.clear();
      const s = __farm.state(), t = Date.now(); AdventureAPI.ensure(s, t); s.coins = 200; s.stats.plantCount = 12; s.stats.harvested = { wheat: 6 }; s.sun.spawned = 5; s.sun.introduced = true; delete s.flags.r79WaitHarvest;
      if (lesson) { s.flags.r79FirstLightHarvest = false; FarmSunplay.normalize(s); s.r75Sunplay.firstRefracted = false; delete s.adventure.claimed.c1_first_harvest; }
      else { s.flags.r79FirstLightHarvest = true; s.adventure.claimed.c1_first_harvest = true; }
      for (let i = 0; i < 6; i++) { const p = s.plots[i]; p.cropId = null; p.plantedAt = 0; p.wateredAt = 0; delete p.sunGrown; }
      if (!lesson) { plant(s, 0, "wheat", t); plant(s, 1, "wheat", t); s.plots[1].wateredAt = t; plant(s, 2, "wheat", t); s.plots[2].plantedAt = t - 3600000; }
      else plant(s, 0, "wheat", t);
      Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots, previewAt: t + 600000, nextAt: t + 600000, refractions: 0 });
      s.interaction.selectedTileId = null; const p0 = s.map.tiles.find((x) => x.plotIndex === 0); __farm.refresh(); __farm.focusTile(p0.id);
    },
    look() {
      const q = (sel) => [...document.querySelectorAll(sel)].filter(shown);
      const ghost = q(".r77a-refract-ghost")[0], tag = ghost && ghost.querySelector(".r85b-aim-tag"), label = document.querySelector("#tileStateLabel:not([hidden])");
      const tileOf = (i) => document.querySelector('.gtile[data-tile-id="' + __farm.state().map.tiles.find((x) => x.plotIndex === i).id + '"]');
      const marker = q(".qmarker")[0];
      return { rings: q(".r75a-sun-preview").map((n) => Number(n.dataset.plotIndex)), also: q(".r85b-sun-also").map((n) => Number(n.dataset.plotIndex)),
        ghost: ghost ? Number(ghost.dataset.plotIndex) : null, ghostRect: rect(ghost), tag: tag && shown(tag) ? tag.textContent : "", tagRect: rect(tag), after: ghost ? getComputedStyle(ghost, "::after").content : "",
        label: label && shown(label) ? rect(label) : null, marker: marker ? marker.dataset.tileId : null, tile0: rect(tileOf(0)),
        bar: [...document.querySelectorAll("#sceneActionBar:not([hidden]) button")].filter(shown).map((b) => ({ action: b.dataset.action, text: b.innerText.replace(/\s+/g, " ").trim(), r: rect(b) })),
        hud: ["#questDock", "#actionA", "#sceneActionBar", ".toolbar", "#farmDock", "#seedHud", "#sunChip"].map((sel) => document.querySelector(sel)).filter(shown).map(rect) };
    },
    /* 這一格上看得到的教學元素：預告圈、折光落點、任務標記（點、針、地面圈）、「下一格」。 */
    teaching(i) {
      const s = __farm.state(), tile = s.map.tiles.find((x) => x.plotIndex === i), out = [];
      if ([...document.querySelectorAll('.r75a-sun-preview[data-plot-index="' + i + '"]')].some(shown)) out.push("預告圈");
      if ([...document.querySelectorAll('.r77a-refract-ghost[data-plot-index="' + i + '"]')].some(shown)) out.push("折光落點");
      document.querySelectorAll('.qmarker[data-tile-id="' + tile.id + '"]').forEach((m) => { if (shown(m) && [...m.querySelectorAll("*")].concat([m]).some((n) => shown(n) && getComputedStyle(n).visibility !== "hidden")) out.push("任務標記"); });
      const g = document.querySelector('.gtile[data-tile-id="' + tile.id + '"].next-plot'); if (g && getComputedStyle(g, "::after").visibility !== "hidden" && getComputedStyle(g, "::after").content !== "none") out.push("下一格");
      return out;
    },
  };
}
/* 頁面裡：照任務卡做的玩家（同 4a），動作直接呼叫遊戲函式，畫面自己的更新照常跑。 */
function installBrain() {
  const A = AdventureAPI, Sp = FarmSunplay, s = () => __farm.state();
  let busyUntil = 0, firstPlantAt = 0, was = false; const lights = [];
  const record = (event, t) => { A.record(s(), event, t); if (A.finishTutorial) A.finishTutorial(s(), t); };
  const doHarvest = (i, t) => { const r = harvest(s(), i, t, Math.random); if (r.ok) record({ type: "harvest", cropId: r.cropId, count: r.added }, t); return r; };
  function act(step, t) {
    if (!step) return 0; const i = step.plotIndex, st = s();
    switch (step.action) {
      case "plant": { const r = plant(st, i, step.cropId || "wheat", t); if (r.ok) { record({ type: "plant", cropId: step.cropId || "wheat" }, t); if (!firstPlantAt) firstPlantAt = t; } return r.ok ? 1500 : 0; }
      case "tend": { const r = waterPlot(st, i, t); if (r.ok) record({ type: "water" }, t); return r.ok ? 1500 : 0; }
      case "harvest": return doHarvest(i, t).ok ? 1500 : 0;
      case "refract": return Sp.refract(st, i, t).ok ? 1500 : 0;
      case "ripen": { const r = Sp.ripen(st, i, t); return r && r.ok ? 1500 : 0; }
      case "catch_sun": { const c = lightHarvestChoice(st, i, t), q = lightHarvestQueue(st); if (!c.ok || (q && q.plotIndex === i)) return 0; return queueLightHarvest(st, i, t).ok ? 500 : 0; }
      case "report": { if (step.target && step.target !== "field") record({ type: "talk", npcId: step.target }, t); return A.claim(st, step.questId || "c1_homecoming", t).ok ? 6000 : 0; }
      case "deliver": return A.claim(st, "c1_first_harvest", t).ok ? 6000 : 0;
      default: return 0;
    }
  }
  window.__brain = {
    lights, get firstPlantAt() { return firstPlantAt; },
    tick() {
      const st = s(), t = Date.now(), active = sunpatchActive(st, t);
      if (active && !was) lights.push({ start: t, end: st.sun.endsAt });
      if (!active && was && lights.length) lights[lights.length - 1].end = t;
      was = active;
      if (t < busyUntil) return;
      document.querySelectorAll(".r76b-dialogue").forEach((n) => { const b = [...n.querySelectorAll("button")].find((x) => /晚點再說/.test(x.textContent)); if (b) b.click(); });
      const cost = act(A.nextFarmStep(st, t), t);
      if (cost) { busyUntil = t + cost; __farm.refresh(); }
    },
  };
}

async function lightChecks(page, tag, mobile) {
  /* 一、兩格要照：只有一個預告圈，另一格是光暈。 */
  await page.evaluate(() => { __r85b.field([1, 3], false); });
  await page.clock.runFor(1200);
  let m = await page.evaluate(() => __r85b.look());
  assert.deepEqual(m.rings, [1], `${tag} 只有一個預告圈，畫在還沒澆的那一格（1 已澆、3 空地 → 選 1）`);
  assert.deepEqual(m.also, [3], `${tag} 另一格只鋪光暈`);
  /* 二、選一格能折的田：落點光斑底下一行寫光性與收益，跟規則同一套；折光鈕照舊寫手鏡次數。 */
  await page.evaluate(() => { const s = __farm.state(), tile = s.map.tiles.find((x) => x.plotIndex === 0); __farm.selectTile(tile.id); });
  await page.clock.runFor(800);
  m = await page.evaluate(() => __r85b.look());
  const want = await page.evaluate(() => FarmSunplay.aimPreview(__farm.state(), 0, Date.now()));
  assert.equal(m.ghost, 0, `${tag} 落點光斑在選的那一格`);
  assert.equal(m.tag, want.tag, `${tag} 光斑底下寫這格的光性與收益`); assert.equal(m.tag, "☀喜光・長快三成");
  assert.equal(m.after, "none", `${tag} 不再寫跟折光鈕重複的「把光折到這裡」`);
  assert.ok(m.tagRect.w <= 150 && m.tagRect.l >= 0 && m.tagRect.r <= (await page.evaluate(() => innerWidth)), `${tag} 那一行在畫面內 ${JSON.stringify(m.tagRect)}`);
  if (m.label) assert.equal(await page.evaluate(([a, b]) => __r85b.ov(a, b), [m.tagRect, m.label]), 0, `${tag} 那一行不壓田上標籤`);
  for (const b of m.bar) assert.equal(await page.evaluate(([a, c]) => __r85b.ov(a, c), [m.tagRect, b.r]), 0, `${tag} 那一行不壓動作鈕「${b.text}」`);
  const refract = m.bar.find((b) => b.action === "refract"); assert.ok(refract && /手鏡還能折 1 次/.test(refract.text), `${tag} 折光鈕照舊：${JSON.stringify(m.bar)}`);
  assert.deepEqual(await page.evaluate(() => __r85b.teaching(0)), ["折光落點"], `${tag} 選的那一格只有一個教學元素`);
  /* 三、任務卡在教第一次折光（按任務卡的鈕就直接折）：按之前就看得到落點與收益；那一格不再疊任務標記。 */
  await page.evaluate(() => { __r85b.field([1], true); });
  await page.clock.runFor(1500);
  const lesson = await page.evaluate(() => ({ step: AdventureAPI.nextFarmStep(__farm.state(), Date.now()), look: __r85b.look(), teach0: __r85b.teaching(0), teach1: __r85b.teaching(1), marker: FarmWorld.markerTile ? FarmWorld.markerTile(__farm.state()) : null, tile0: __farm.state().map.tiles.find((x) => x.plotIndex === 0).id }));
  assert.equal(lesson.step.action, "refract", `${tag} 任務卡在教折光`); assert.equal(lesson.step.plotIndex, 0);
  assert.equal(lesson.look.ghost, 0, `${tag} 教折光時落點光斑畫在要折過去的那一格`);
  assert.equal(lesson.look.tag, "☀喜光・長快三成", `${tag} 教折光時也寫光性與收益：${lesson.look.tag}`);
  assert.deepEqual(lesson.teach0, ["折光落點"], `${tag} 要折過去的那一格只有落點光斑（任務標記在 ${lesson.marker}）`);
  assert.deepEqual(lesson.teach1, ["預告圈"], `${tag} 光原本要落的那一格只有預告圈`);
  /* 四、按任務卡折過去以後：落點收掉、圈移到那一格，仍然只有一個圈。 */
  await page.evaluate(() => { FarmSunplay.refract(__farm.state(), 0, Date.now()); __farm.refresh(); });
  await page.clock.runFor(800);
  m = await page.evaluate(() => __r85b.look());
  assert.equal(m.ghost, null, `${tag} 折完落點光斑收掉`); assert.deepEqual(m.rings, [0], `${tag} 預告圈移到折過去的那一格`);
}

/* 四、手機：第一枚印章的小卡只留印章那一行與「打開手冊」，其餘收進「說明」；點「說明」展開、文字都還在。 */
async function foldChecks(page, tag) {
  await page.evaluate(() => {
    __r85b.clear(); const s = __farm.state(), now = Date.now(), plot = s.plots[0];
    s.adventure.r58.r59.seedPacks.wheat = 1; plot.cropId = null; s.sun.plots = [];
    const planted = Game.plant(s, 0, "wheat", now); if (!planted.ok) throw new Error("種不下去 " + JSON.stringify(planted));
    plot.plantedAt = now - Game.plotGrowMs(s, plot, now) - 1000;
    Object.assign(s.sun, { plots: [0], used: [], startsAt: now - 1, endsAt: now + 60000, durationMs: 60001 });
    const r = Game.harvest(s, 0, now); if (!r.ok) throw new Error("收不起來 " + JSON.stringify(r));
    s.sun.plots = []; __farm.refresh();
  });
  let card = null;
  for (let i = 0; i < 24 && !(card && card.toggle); i++) {
    await page.clock.runFor(250);
    card = await page.evaluate(() => {
      const c = document.querySelector("#r76cStampCard"); if (!c || c.hidden) return null;
      const t = c.querySelector(".r85b-fold-toggle"), shownText = [...c.querySelectorAll("*")].filter((n) => n.children.length === 0 && __r85b.shown(n)).map((n) => n.textContent).join("");
      return { text: c.textContent, shown: (shownText.match(/[一-鿿]/g) || []).length, notes: [...c.querySelectorAll(".r76c-card-note")].filter(__r85b.shown).length, toggle: t ? __r85b.rect(t) : null, label: t ? getComputedStyle(t, "::before").content : "", open: __r85b.rect(c.querySelector("[data-r76c-card-open]")) };
    });
  }
  assert.ok(card, `${tag} 第一枚印章的小卡出來了`);
  assert.match(card.text, /手札的圖鑑頁最上面多了一本追光手冊/, `${tag} 說明文字還在（讀屏照樣讀得到）`);
  assert.equal(card.notes, 0, `${tag} 手機上說明先收起來`); assert.ok(card.shown <= 34, `${tag} 小卡上看得到的字 ${card.shown} 個（改前第一枚章約 70 個）`);
  assert.ok(card.toggle && card.toggle.w >= 44 && card.toggle.h >= 44, `${tag} 「說明」鈕至少 44px ${JSON.stringify(card.toggle)}`); assert.match(card.label, /說明/);
  assert.ok(card.open && card.open.h >= 44, `${tag} 「打開手冊」還在`);
  await page.locator("#r76cStampCard .r85b-fold-toggle").click();
  await page.clock.runFor(300);
  const opened = await page.evaluate(() => { const c = document.querySelector("#r76cStampCard"); return { notes: [...c.querySelectorAll(".r76c-card-note")].filter(__r85b.shown).length, hidden: c.hidden, label: getComputedStyle(c.querySelector(".r85b-fold-toggle"), "::before").content }; });
  assert.equal(opened.hidden, false, `${tag} 點「說明」不會關掉小卡`); assert.ok(opened.notes >= 1, `${tag} 點了展開說明`); assert.match(opened.label, /收起/);
}

/* 四之二、手機田邊麻雀：不放在花叢這類擺飾後面、整個點擊範圍都點得到；點按後二選一確實跳出、整個在畫面內（R84 圖 163）。 */
async function sparrowChecks(page, tag) {
  await page.evaluate(() => {
    __r85b.clear(); const s = __farm.state(), now = Date.now(); s.coins = 50; s.stats.plantCount = 9; s.flags.r79FirstLightHarvest = true; FarmSunplay.normalize(s); s.r75Sunplay.firstCaught = true; delete s.flags.r79WaitHarvest;
    for (const i of [0, 1]) { s.plots[i].cropId = "wheat"; s.plots[i].plantedAt = now; s.plots[i].wateredAt = now; }
    Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: now + 600000 });
    const p0 = s.map.tiles.find((t) => t.plotIndex === 0); s.player.tileId = p0.id; s.player.x = p0.x; s.player.y = p0.y; s.interaction.selectedTileId = null; __farm.cancelJourney(); __farm.refresh(); __farm.focusTile(p0.id);
  });
  await page.clock.runFor(800);
  await page.evaluate(() => { const s = __farm.state(), Wp = FarmWaitplay, now = Date.now(), st = Wp.normalize(s); const tile = Wp.pickTile(s, AdventureAPI.nextFarmStep(s, now), 0, now); st.active = { id: "sparrow", tileId: tile.id, startedAt: now, expiresAt: now + 600000, kind: "grow", claimedAt: 0, goneAt: 0 }; });
  await page.clock.runFor(900);
  const m = await page.evaluate(() => {
    const node = document.querySelector("#mapWorld .r83c-chore"), r = node.getBoundingClientRect(), tile = document.querySelector('.gtile[data-tile-id="' + node.dataset.tileId + '"]').getBoundingClientRect();
    const props = [...document.querySelectorAll("#mapWorld .garden-prop")].map((el) => el.getBoundingClientRect()).filter((b) => Math.max(0, Math.min(b.right, tile.right) - Math.max(b.left, tile.left)) * Math.max(0, Math.min(b.bottom, tile.bottom) - Math.max(b.top, tile.top)) > tile.width * tile.height * 0.15).length;
    const pts = [[0.2, 0.2], [0.8, 0.2], [0.5, 0.5], [0.2, 0.8], [0.8, 0.8]].map(([x, y]) => document.elementFromPoint(r.left + r.width * x, r.top + r.height * y)).map((e) => !!(e && e.closest(".r83c-chore")));
    return { props, pts, r: { l: r.left, t: r.top, r: r.right, b: r.bottom } };
  });
  assert.equal(m.props, 0, `${tag} 麻雀不放在擺飾後面`); assert.deepEqual(m.pts, [true, true, true, true, true], `${tag} 麻雀整個點擊範圍都點得到`);
  await page.locator("#mapWorld .r83c-chore").tap(); await page.clock.runFor(300);
  const pop = await page.evaluate(() => { const p = document.querySelector("#mapWorld .r83c-chore-choice"); if (!p) return null; const r = p.getBoundingClientRect(), mid = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { r: { l: r.left, t: r.top, r: r.right, b: r.bottom }, vw: innerWidth, vh: innerHeight, top: !!(mid && mid.closest(".r83c-chore-choice")), labels: [...p.querySelectorAll("button span")].map((n) => n.textContent) }; });
  assert.ok(pop, `${tag} 點按麻雀跳出二選一`); assert.deepEqual(pop.labels, ["趕走", "留一把穗給牠"]);
  assert.ok(pop.r.l >= 0 && pop.r.t >= 0 && pop.r.r <= pop.vw && pop.r.b <= pop.vh && pop.top, `${tag} 二選一整個在畫面內、沒被蓋住 ${JSON.stringify(pop)}`);
}

/* 五、R84 圖 106：新存檔種下第一株、遊戲在背景擱了 11 分鐘（計時器停著），回來照任務卡玩 100 秒，兩道光最多隔 20 秒。 */
async function paceChecks(page, tag) {
  await page.evaluate(installBrain);
  for (let i = 0; i < 8; i++) { await page.clock.runFor(1000); await page.evaluate(() => __brain.tick()); }
  const planted = await page.evaluate(() => (__farm.state().plots || []).some((p) => p && p.cropId));
  assert.ok(planted, `${tag} 種下第一株`);
  /* 手機切到背景：計時器停著、牆上時間照走（setSystemTime 只改時間，不補跑計時器）。 */
  await page.clock.setSystemTime(await page.evaluate(() => Date.now()) + 11 * 60000);
  /* 每秒照任務卡做一次事、記一次光（量到的光起訖誤差在 1 秒內，下面多給 1.1 秒）。 */
  for (let i = 0; i < 100; i++) { await page.clock.runFor(1000); await page.evaluate(() => __brain.tick()); }
  const r = await page.evaluate(() => ({ lights: __brain.lights.slice(), created: __farm.state().createdAt, played: __farm.state().sun.earlyPlayMs, now: Date.now() }));
  assert.ok(r.now - r.created > 11 * 60000, `${tag} 牆上時間已經過了十分鐘`);
  assert.ok(r.played > 0 && r.played < 3 * 60000, `${tag} 只記開著遊戲的時間 ${r.played}`);
  const back = r.lights.filter((l) => l.start > r.created + 11 * 60000);
  assert.ok(back.length >= 3, `${tag} 回來後有 ${back.length} 道光`);
  const gaps = []; for (let i = 1; i < back.length; i++) gaps.push(back[i].start - back[i - 1].end);
  assert.ok(gaps.length >= 2 && Math.max(...gaps) <= 20000 + 1100, `${tag} 回來後兩道光最多隔 20 秒：${gaps.map((g) => (g / 1000).toFixed(1)).join("、")}`);
}

async function browserChecks() {
  let chromium; try { ({ chromium } = require("playwright")); } catch (_) { throw Error("playwright 不可用"); }
  const server = await serve(), origin = "http://127.0.0.1:" + server.address().port, browser = await launch(chromium); let checks = 0;
  try {
    for (const [width, height, mobile] of VIEWS) {
      const tag = width + "x" + height;
      for (const part of mobile ? ["light", "fold", "pace"] : ["light", "pace"]) {
        const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", reducedMotion: "reduce" });
        const page = await context.newPage(), errors = []; page.on("pageerror", (e) => errors.push(String(e)));
        await page.clock.install({ time: T });
        await page.goto(origin);
        for (let i = 0; i < 60 && !(await page.evaluate(() => !!(window.__farm && window.AdventureAPI && window.FarmSunplay && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading")))); i++) await page.clock.runFor(500);
        await page.evaluate(() => document.querySelector("#worldBegin")?.click());
        await page.clock.runFor(600); await page.evaluate(install);
        if (part === "light") await lightChecks(page, tag, mobile); else if (part === "fold") { await foldChecks(page, tag); await sparrowChecks(page, tag); } else await paceChecks(page, tag);
        checks++;
        assert.deepEqual(errors, [], tag + " 沒有頁面錯誤");
        await context.close();
      }
    }
  } finally { await browser.close(); server.close(); }
  return checks;
}

(async () => {
  for (const [name, fn] of pending) { try { await fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
  try { const checks = await browserChecks(); passed++; console.log(`PASS 6 實拍 ${VIEWS.map((v) => v[0] + "×" + v[1]).join("、")}：一個預告圈、瞄準預覽寫光性與收益、教學元素不疊、手機小卡說明收進「說明」、麻雀二選一點得出來、隔了一段時間回來仍 20 秒一道光（${checks} 組）`); }
  catch (error) { console.error("FAIL 6 實拍\n" + error.stack); process.exitCode = 1; }
  if (!process.exitCode) console.log(`R85B light: ${passed} passed`);
})();
