"use strict";
/* R84C：前幾分鐘的節奏與舊麥種成果。
 * 1 同一畫面「等光再收」最多出現一次：只寫在田邊動作列那一顆鈕，帶秒數與收益；任務卡、祖母手記、田上標籤、右下大鈕、提示只寫狀態。
 * 2 沒有道具時，新存檔前十分鐘下一道光最多等 30 秒（遊戲時鐘模擬兩種開場）；十分鐘以後、天氣解鎖以後照舊。
 * 3 田邊小事：一般視角下圖至少 40px、短名牌常駐；圖與名牌不壓角色、田與按鈕（沿用 R83C 的避讓）。
 * 4 藍布老麥田至少 2×2 格；照過 1 次光是青綠色、還沒熟；四個階段外形明顯不同；新圖路徑接好、缺圖有後備。
 * 5 鎮誌舊物出現當下鏡頭帶過去（focusTile，不加遮罩、不接管點擊）、小地圖有標記；找齊後的擺飾至少跟告示牌一樣大。
 * 6 接線：測試排在 unit 清單最後；樣式標 R84C、追加在 content-r58b.css 檔尾。
 * 版面在 1366×768、1366×600、390×844、844×390 實際開瀏覽器量。 */
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
global.window = global;
const ROOT = path.join(__dirname, ".."), read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const State = require("../src/state.js"), Sun = require("../src/sunplay-r75.js"), Game = require("../src/game.js"), A = require("../src/adventure.js");
const H = require("../src/heirloom.js"), W = require("../src/waitplay-r82.js"), M = require("../src/midgame-r66.js"), K = require("../src/cooking-r75.js");
const R = require("../src/story-r76.js"), Q = require("../src/choices-r77.js");
Q.install();
const T = 1794172800000, DAY = 86400000, TEN_MIN = 10 * 60 * 1000;
let passed = 0;
const pending = [];
function test(name, fn) { pending.push([name, fn]); }
function fresh(now = T) { const s = State.defaultState(now); Sun.normalize(s); A.ensure(s, now); return s; }
function seeded(seed) { let x = seed; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; }
const tileOf = (s, i) => s.map.tiles.find((t) => t.plotIndex === i);
function preview(s, plots, at) { Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: plots, previewAt: at, nextAt: at, refractions: 0 }); }
function ripeWheat(s, i, at) { Game.plant(s, i, "wheat", at, "water"); s.plots[i].plantedAt = at - 3600000; }
const WAIT_WORD = /等光再收/;
function collect(bag, step, where) {
  if (!step) return;
  for (const key of ["text", "short", "actionLabel", "title", "detail", "label"]) if (typeof step[key] === "string" && step[key]) bag.push({ where, key, text: step[key] });
  if (step.alternative) collect(bag, step.alternative, where + "・另一件");
}
/* 原始碼裡玩家看得到的字（字串常值，不含註解）。 */
function playerStrings(file) {
  const src = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
  return src.match(/`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g) || [];
}

/* 照任務卡做的新玩家，從開場用遊戲時鐘一路玩（兩種開場），每 250 毫秒收下畫面上的下一步，並記下每一道光的起訖。 */
function play(heirloom, untilMs) {
  const rng = seeded(84), s = fresh(T); s.coins = 16; if (heirloom) H.start(s);
  const bag = [], lights = [], countdowns = [];
  let busyUntil = T + 3000, firstPlantAt = 0, wasActive = false;
  const record = (event, t) => { A.record(s, event, t); A.finishTutorial(s, t); };
  const harvest = (i, t) => { const r = Game.harvest(s, i, t, rng); if (r.ok) record({ type: "harvest", cropId: r.cropId, count: r.added }, t); return r; };
  function farmAct(step, t) {
    const i = step.plotIndex;
    switch (step.action) {
      case "plant": { const r = Game.plant(s, i, step.cropId || "wheat", t); if (r.ok) { record({ type: "plant", cropId: step.cropId || "wheat" }, t); if (!firstPlantAt) firstPlantAt = t; } return r.ok ? 1500 : 0; }
      case "tend": { const r = Game.waterPlot(s, i, t); if (r.ok) record({ type: "water" }, t); return r.ok ? 1500 : 0; }
      case "harvest": return harvest(i, t).ok ? 1500 : 0;
      case "refract": return Sun.refract(s, i, t).ok ? 1500 : 0;
      case "ripen": { const r = Sun.ripen(s, i, t); return r && r.ok ? 1500 : 0; }
      /* 任務卡的「看看這株」帶玩家到田邊，玩家在田邊動作列按「等光再收」。 */
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
    Game.updateSunpatch(s, t, rng); Sun.refreshLightCountdown(s.sun, t);
    const active = Game.sunpatchActive(s, t);
    if (active && !wasActive) lights.push({ start: t, end: s.sun.endsAt });
    if (!active && wasActive) lights[lights.length - 1].end = t;
    wasActive = active;
    const queued = Game.lightHarvestQueue(s); if (queued && queued.autoHarvest && Game.isSunlit(s, queued.plotIndex, t)) harvest(queued.plotIndex, t);
    W.update(s, t);
    const guide = A.nextGuidance(s, t), farm = A.nextFarmStep(s, t);
    collect(bag, guide, heirloom ? "祖母手記" : "任務卡"); collect(bag, farm, "農務下一步");
    const e = A.earlyGoals(s, t); (e.goals || []).forEach((g) => collect(bag, { text: g.detail, actionLabel: g.actionLabel }, "今日三件事"));
    /* 預告期間玩家看到的倒數（田邊動作列、頂部陽光籤都讀這一個數）。 */
    if (Game.sunpatchStatus(s, t).preview) countdowns.push(Sun.lightSecondsLeft(s.sun, t));
    for (const p of [0, 1, 2, 3, 4, 5]) { const c = Game.lightHarvestChoice(s, p, t); if (c.ok) bag.push({ where: "田邊動作列", key: "facing", text: Game.facingPlotLabel(s, tileOf(s, p), t) }); }
    if (t < busyUntil) continue;
    const h = H.status(s);
    let cost = 0;
    if (heirloom && h.started && !h.delivered) cost = h.ready ? (H.deliver(s, "table", t).ok ? 6000 : 0) : farmAct(farm, t);
    else cost = farmAct(farm, t) || questAct(t);
    if (cost) busyUntil = t + cost;
  }
  return { s, bag, lights, countdowns, firstPlantAt };
}
/* 每一段「沒有光、在等下一道光」的時間：從第一次播種（或上一道光結束）到下一道光落下。 */
function waits(run) {
  const rows = []; let from = run.firstPlantAt;
  for (const light of run.lights) { rows.push({ from, ms: light.start - from }); from = light.end; }
  return rows;
}

/* ---------- 第 1 項：「等光再收」只在田邊動作列 ---------- */
test("1a 規則：任務卡、祖母手記、右下大鈕在每一種等光狀態都只寫狀態；田邊動作列那一顆鈕拿得到秒數與收益", () => {
  const bag = [];
  const grab = (s, t, where) => { collect(bag, A.nextGuidance(s, t), where); collect(bag, A.nextFarmStep(s, t), where + "・農務"); const e = A.earlyGoals(s, t); (e.goals || []).forEach((g) => collect(bag, { text: g.detail, actionLabel: g.actionLabel }, where + "・今日三件事")); };
  /* 教學：熟了、光快到。 */
  const tut = fresh(); tut.coins = 30; ripeWheat(tut, 0, T); preview(tut, [0], T + 7000); grab(tut, T, "教學等光");
  const step = A.nextFarmStep(tut, T);
  assert.equal(step.action, "catch_sun"); assert.equal(step.holdPlotIndex, 0, "等光的那一格照樣留著");
  assert.equal(step.actionLabel, "看看這株小麥", "任務卡的鈕帶玩家到田邊看，不替玩家按等光");
  assert.equal(step.short, "小麥熟了・留著等光");
  assert.equal(Game.facingPlotLabel(tut, tileOf(tut, 0), T), "等光・小麥田", "右下大鈕跟面向田同一種寫法");
  const choice = Game.lightHarvestChoice(tut, 0, T);
  assert.equal(choice.ok, true); assert.equal(choice.seconds, 7); assert.ok(choice.waitQty > choice.nowQty && choice.waitSunlight > 0, "田邊動作列有收益可寫");
  /* 教學已按等光、手上還有種子包（先去種別格）。 */
  Game.queueLightHarvest(tut, 0, T); grab(tut, T + 1, "教學已按等光");
  const sow = fresh(); sow.coins = 30; ripeWheat(sow, 0, T); sow.adventure.r58.r59.seedPacks.wheat = 2; sow.stats.harvested = { wheat: 3 }; sow.flags.r79FirstLightHarvest = true; sow.sun.spawned = 1;
  preview(sow, [0], T + 7000); Game.queueLightHarvest(sow, 0, T); grab(sow, T + 1, "早市已選等光・先種別格");
  assert.match(A.nextFarmStep(sow, T + 1).text, /^已選等光。/);
  /* 早市二選一、選了等光。 */
  const market = fresh(); market.coins = 30; market.stats.harvested = { wheat: 3 }; market.flags.r79FirstLightHarvest = true; market.sun.spawned = 1; ripeWheat(market, 0, T); preview(market, [0], T + 7000);
  grab(market, T, "早市二選一"); Game.queueLightHarvest(market, 0, T); grab(market, T + 1, "早市已選等光");
  /* 祖母手記：熟了光快到、澆過水在等光。 */
  const heir = fresh(); heir.coins = 30; H.start(heir); ripeWheat(heir, 0, T); preview(heir, [0], T + 7000); grab(heir, T, "祖母手記・熟了光快到");
  assert.equal(A.nextGuidance(heir, T).short, "麥穗熟了・留著等光");
  const wet = fresh(); wet.coins = 30; H.start(wet); Game.plant(wet, 0, "wheat", T); Game.waterPlot(wet, 0, T); preview(wet, [0], T + 6000); grab(wet, T, "祖母手記・澆過水在等光");
  assert.equal(A.nextGuidance(wet, T).short, "小麥在等光");
  /* 兩種開場照任務卡玩十分鐘，畫面上的下一步全部收下來。 */
  const runs = [play(true, TEN_MIN), play(false, TEN_MIN)];
  const all = bag.concat(...runs.map((r) => r.bag));
  const hits = all.filter((row) => WAIT_WORD.test(row.text));
  assert.deepEqual([...new Set(hits.map((row) => `${row.where}・${row.key}：${row.text}`))], [], "任務卡、祖母手記、右下大鈕不寫「等光再收」");
});

test("1b 原始碼：「等光再收」只剩田邊動作列那一顆鈕（與藏起來的舊同步節點）；田上標籤、提示、任務卡改寫狀態", () => {
  const ui = read("src/ui.js"), world = read("src/world-ui.js"), game = read("src/game.js");
  assert.match(ui, /wait_light: \["☀", "等光再收"\]/, "田邊動作列那一顆鈕");
  assert.match(ui, /actionDetail = lightChoice\.hasTradeoff[\s\S]{0,200}`等 \$\{lightChoice\.seconds\} 秒・\$\{lightChoice\.waitQty\} 份＋陽光 \$\{lightChoice\.waitSunlight\}・光到自動收成`/, "鈕上寫秒數與收益");
  assert.match(ui, /heldForLight \? `\$\{name\}・留著等光` : `\$\{name\}・可收成`/, "田上標籤寫狀態");
  assert.match(ui, /"光快落在這格了，先留著這株。"/, "提示寫狀態");
  assert.doesNotMatch(ui, /toast\(choice && choice\.ok \? choice\.tutorialText/, "提示不再重複秒數與收益");
  assert.match(ui, /sceneBar\.dataset\.r80bYieldToThumb = "false"/, "田邊動作列不再讓給右下大鈕（讓了就看不到秒數與收益）");
  assert.match(game, /return choice\.ok && !choice\.hasTradeoff \? `等光・\$\{crop\.name\}田`/);
  assert.match(world, /farm\(\)\.selectTile && farm\(\)\.selectTile\(step\.tileId\)/, "任務卡「看看這株」選取那一格、打開田邊動作列");
  assert.match(ui, /selectTile: \(id\) =>/);
  for (const file of ["src/adventure.js", "src/world-ui.js", "src/heirloom-ui.js", "src/heirloom.js"]) {
    const bad = playerStrings(file).filter((s) => WAIT_WORD.test(s));
    assert.deepEqual(bad, [], file + " 玩家看得到的字不再寫「等光再收」");
  }
  /* ui.js 只剩動作列那一顆鈕，以及 R81B 起就藏起來（裁成 1px）的舊同步節點。 */
  const uiHits = playerStrings("src/ui.js").filter((s) => WAIT_WORD.test(s));
  const allowed = new Set(['"等光再收"', '"等光再收：等 "']);
  assert.deepEqual(uiHits.filter((s) => !allowed.has(s)), [], "ui.js 只剩動作列的鈕與藏起來的同步節點：" + uiHits.join("｜"));
  assert.match(read("src/content-r58b.css"), /#tileStateLabel :is\(\.r78b-wait-choice, \.r77a-refract-note\) \{\s*position: absolute !important; width: 1px !important; height: 1px !important;/, "舊同步節點仍是藏起來的");
});

/* ---------- 第 2 項：前十分鐘的光 ---------- */
test("2a 遊戲時鐘：沒有道具的新存檔，兩種開場前十分鐘每一段等光都不超過 30 秒，倒數也不超過 30 秒", () => {
  for (const heirloom of [true, false]) {
    const run = play(heirloom, TEN_MIN + 5 * 60000), name = heirloom ? "祖母手記開場" : "一般開場";
    assert.equal(run.s.r75Sunplay.mirrorLevel, 0, "沒有升級手鏡"); assert.equal(run.s.r75Sunplay.bottleLevel, 0, "沒有升級蓄光瓶");
    assert.ok(!(run.s.sunbook && run.s.sunbook.bonus && Object.keys(run.s.sunbook.bonus).length), "沒有追光手冊加成");
    const early = waits(run).filter((w) => w.from < T + TEN_MIN);
    assert.ok(early.length >= 15, `${name}：前十分鐘有 ${early.length} 道光`);
    const worst = Math.max(...early.map((w) => w.ms));
    assert.ok(worst <= 30000, `${name}：前十分鐘最久等 ${worst / 1000} 秒：` + early.map((w) => Math.round(w.ms / 1000)).join("、"));
    assert.ok(run.countdowns.length > 0 && Math.max(...run.countdowns) <= 30, `${name}：預告倒數最多 ${Math.max(...run.countdowns)} 秒`);
    /* 十分鐘以後照原本節奏：自然散掉的光之後隔 40 秒（天氣還沒解鎖，算晴朗以外的一般天）；光照的田都用掉時照舊 15 秒後再來。 */
    const later = waits(run).filter((w) => w.from >= T + TEN_MIN + 1000 && w.from !== run.firstPlantAt);
    assert.ok(later.length >= 3, `${name}：十分鐘以後也有光`);
    for (const w of later) assert.ok(Math.abs(w.ms - Game.SUNPATCH.intervalMs) <= 250 || Math.abs(w.ms - 15000) <= 250, `${name}：十分鐘以後照舊的間隔，實際 ${w.ms / 1000} 秒`);
    assert.ok(later.some((w) => Math.abs(w.ms - Game.SUNPATCH.intervalMs) <= 250), `${name}：十分鐘以後回到 ${Game.SUNPATCH.intervalMs / 1000} 秒：` + later.map((w) => Math.round(w.ms / 1000)).join("、"));
  }
});

test("2b 只動前十分鐘：常數照舊；舊存檔、天氣解鎖以後不套用；R83 圖 37 那種 86 秒的等法不會出現在前十分鐘", () => {
  const P = Game.SUNPATCH;
  assert.deepEqual([P.intervalMs, P.sunnyIntervalMs, P.durationMs, P.firstDelayMs, P.firstDurationMs], [40000, 28000, 16000, 8000, 40000], "十分鐘以後的節奏與第一道光不變");
  assert.ok(P.earlyGapMs + Sun.PREVIEW_MS <= 30000 && P.earlyGapMs <= 20000, "前十分鐘兩道光之間最多 20 秒");
  assert.equal(P.earlyWindowMs, TEN_MIN);
  const s = fresh(T);
  assert.equal(Game.earlyLightWindow(s, T + 1000), true); assert.equal(Game.earlyLightWindow(s, T + TEN_MIN - 1), true); assert.equal(Game.earlyLightWindow(s, T + TEN_MIN), false, "十分鐘整就結束");
  s.level = 5; assert.equal(Game.earlyLightWindow(s, T + 1000), false, "天氣解鎖以後照天氣算");
  const old = fresh(T - 3600000); assert.equal(Game.earlyLightWindow(old, T), false, "舊存檔不套用");
  /* 舊存檔：兩道光之間仍是 40 秒。 */
  Game.plant(old, 0, "wheat", T); Game.updateSunpatch(old, T, () => 0.5);
  const first = old.sun.nextAt; Game.updateSunpatch(old, first, () => 0.5);
  const second = old.sun.nextAt; Game.updateSunpatch(old, second - P.durationMs - 1, () => 0.5); Game.updateSunpatch(old, second, () => 0.5);
  assert.equal(old.sun.nextAt - second, P.durationMs + P.intervalMs, "舊存檔第二道光之後照舊");
  /* 新存檔同樣的步驟：第二道光之後只隔 20 秒。 */
  const neu = fresh(T); Game.plant(neu, 0, "wheat", T); Game.updateSunpatch(neu, T, () => 0.5);
  const f2 = neu.sun.nextAt; Game.updateSunpatch(neu, f2, () => 0.5); const s2 = neu.sun.nextAt; Game.updateSunpatch(neu, s2 - P.durationMs - 1, () => 0.5); Game.updateSunpatch(neu, s2, () => 0.5);
  assert.equal(neu.sun.nextAt - s2, P.durationMs + P.earlyGapMs, "新存檔前十分鐘只隔 20 秒");
});

/* ---------- 第 3 項：田邊小事 ---------- */
test("3a 小事的短名牌、圖的最小尺寸與常駐樣式", () => {
  assert.deepEqual(Object.fromEntries(W.CHORES.map((c) => [c.id, c.label])), { glean: "撿落穗", sparrow: "麻雀", weed: "拔雜草", twig: "撿枯枝" });
  for (const c of W.CHORES) { assert.ok(c.label.length >= 2 && c.label.length <= 3, "短名牌：" + c.label); assert.doesNotMatch(c.label, /[A-Za-z0-9]/); }
  assert.equal(W.R84C_ART_MIN, 40); assert.ok(W.R84C_ART_TILE <= 64, "一般視角都套用");
  const src = read("src/waitplay-r82.js");
  assert.match(src, /T >= R84C_ART_TILE \? Math\.min\(Math\.floor\(T \* 0\.9\), Math\.max\(R84C_ART_MIN, Math\.round\(T \* 0\.62\)\)\)/, "一般視角至少 40px、最多九成格子");
  const css = read("src/content-r58b.css"), block = css.slice(css.indexOf("/* ===== R84C"), css.indexOf("/* ===== R84C 結束 ===== */"));
  assert.match(block, /#mapWorld \.r83c-chore \.r83c-chore-tag \{ opacity: 1; visibility: visible; \}/, "名牌常駐");
  assert.match(block, /#mapWorld \.r83c-chore\.r84c-small-tile:not\(\.is-near\)[^{]*\.r83c-chore-tag \{ opacity: 0; visibility: hidden; \}/, "縮放看整張地圖時名牌比格子寬，照 R83C 靠近才出現，不蓋旁邊的田");
  assert.match(src, /node\.classList\.toggle\("r84c-small-tile", T < R84C_ART_TILE\)/);
});

/* ---------- 第 4 項：藍布老麥田 ---------- */
function freshStory(now) { const s = State.defaultState(now); A.ensure(s, now); M.ensure(s, now); K.ensure(s, now); return s; }
function finishR81(choice, now) {
  const s = freshStory(now);
  s.heirloom.sunWheat = 2; s.storage.items.wheat = 4;
  assert.equal(H.deliver(s, "table", now).ok, true);
  assert.equal(R.r81Choose(s, choice, now + 1000).ok, true);
  s.storage.items.wheat = 2;
  assert.equal(R.r81Deliver(s, now + 2000).ok, true);
  assert.equal(R.r81SceneSeen(s, now + 3000), true);
  return s;
}
function shine(state, now) { state.sun = { plots: [R.R82_BLUE_LIGHT_PLOT], startsAt: now - 1000, endsAt: now + 10000, nextAt: 0, used: [], introduced: true }; }
test("4a 藍布老麥田從班伯在等開始就是水井右邊 2×2；照過 1 次光不再用金黃那張；新圖路徑接好、缺圖有後備", () => {
  const T0 = Date.parse("2026-11-09T08:00:00Z");
  /* 還在等交單（R81 階段）就已經是 2×2。 */
  const early = freshStory(T0); early.heirloom.sunWheat = 2; early.storage.items.wheat = 4; H.deliver(early, "table", T0); R.r81Choose(early, "plant", T0 + 1000);
  assert.deepEqual(R.r81SceneRows(early)[0].marker.footprint, { dx: 1, dy: 0, w: 2, h: 2 }, "班伯在等時就是 2×2");
  const sealRow = (() => { const s = freshStory(T0); s.heirloom.sunWheat = 2; s.storage.items.wheat = 4; H.deliver(s, "table", T0); R.r81Choose(s, "seal", T0 + 1000); return R.r81SceneRows(s)[0]; })();
  assert.equal(sealRow.marker.footprint, undefined, "封存那一邊不變");
  const s = finishR81("plant", T0), arts = {};
  const check = (now, stage) => { const row = R.r81SceneRows(s).find((r) => r.r82bKind === "plant"); assert.equal(row.r82bStage, stage); assert.equal(row.marker.footprint.w, 2); assert.equal(row.marker.footprint.h, 2); arts[stage] = row.marker.art; };
  check(T0 + 4000, "empty");
  R.r82Plant(s, T0 + 5000); check(T0 + 5001, "planted");
  shine(s, T0 + 6000); R.r82CatchLight(s, T0 + 6000); check(T0 + 6001, "one-light");
  shine(s, T0 + DAY + 6000); R.r82CatchLight(s, T0 + DAY + 6000); check(T0 + DAY + 6001, "ripe");
  R.r82HarvestBlueWheat(s, T0 + DAY + 7000); check(T0 + DAY + 7001, "harvested");
  assert.equal(new Set(["planted", "one-light", "ripe", "harvested"].map((k) => arts[k])).size, 4, "四個階段四張不同的圖");
  assert.notEqual(arts["one-light"], R.R82_ART.cropOneLight, "照過 1 次光不再用金黃的那一張");
  /* 新圖：路徑接在 content-r84；換圖清單跟檔案在不在一致；沒到之前的後備都存在。 */
  for (const [key, file] of Object.entries(R.R84_ART)) {
    assert.match(file, /^assets\/generated\/content-r84\/blue-cloth-wheat-field-[a-z-]+\.png$/, key);
    assert.equal(R.R84_ART_READY.includes(key), fs.existsSync(path.join(ROOT, file)), key + " 換圖清單跟檔案在不在一致");
    const shown = R.r82Art(key); assert.ok(fs.existsSync(path.join(ROOT, shown)), key + " 現在畫的圖存在：" + shown);
  }
  for (const file of Object.values(R.R84_ART_FALLBACK)) assert.ok(fs.existsSync(path.join(ROOT, file)), "後備圖存在 " + file);
  const renderer = read("src/choices-r77.js");
  assert.match(renderer, /col = tile\.x \+ \(Number\(fp\.dx\) \|\| 0\) \+ tilesWide \/ 2;/, "2×2 物件照 footprint 擺");
  assert.match(renderer, /row\.marker\.displayTiles \|\| 0, row\.marker\.footprint \|\| null/, "大小換了就重畫");
});

/* ---------- 第 5 項：鎮誌舊物 ---------- */
test("5a 舊物一出現就交給鏡頭（每件只帶一次，存檔記得）；小地圖記號跟著還沒撿的舊物；擺飾畫 1.15 格", () => {
  const T0 = Date.parse("2026-11-09T08:00:00Z"), s = finishR81("seal", T0);
  assert.deepEqual(R.r84RelicsToAnnounce(s, T0 + 4000).map((r) => r.relicId), ["old_seed_tag"], "第一天出現第一件");
  R.r84MarkRelicsSeen(s, ["old_seed_tag"], T0 + 4000);
  assert.deepEqual(R.r84RelicsToAnnounce(s, T0 + 5000), [], "帶過就不再帶");
  const saved = State.migrate(JSON.parse(JSON.stringify(s)));
  assert.ok(saved.flags.r84cRelicSeen && saved.flags.r84cRelicSeen.old_seed_tag, "存檔記得帶過哪一件");
  assert.deepEqual(R.r84RelicsToAnnounce(s, T0 + DAY + 5000).map((r) => r.relicId), ["faded_photo"], "隔天出現第二件");
  assert.deepEqual(R.r84MinimapMarks(s, T0 + DAY + 5000).map((m) => [m.relicId, m.x, m.y]), [["old_seed_tag", 12, 8], ["faded_photo", 14, 7]], "小地圖記號在舊物那一格");
  R.r82FindRelic(s, "old_seed_tag", T0 + DAY + 6000);
  assert.deepEqual(R.r84MinimapMarks(s, T0 + DAY + 7000).map((m) => m.relicId), ["faded_photo"], "撿走的那一件就拿掉記號");
  R.r82FindRelic(s, "faded_photo", T0 + DAY + 8000); R.r82FindRelic(s, "ledger_page", T0 + 2 * DAY + 8000);
  const deco = R.r82SceneRows(s, T0 + 2 * DAY + 9000).find((r) => r.r82bKind === "decoration");
  assert.ok(deco && deco.marker.displayTiles >= 1.1, "擺飾至少跟告示牌（約 1.1 格）一樣大");
  const story = read("src/story-r76.js"), world = read("src/world-ui.js");
  assert.match(story, /StoryR76\.r84FocusHoldUntil = Date\.now\(\) \+ 2600; f\.focusTile\(tile\.id\)/, "用 focusTile 帶鏡頭（不加遮罩、不接管點擊）");
  assert.match(world, /const relicHold = !!\(window\.StoryR76 && window\.StoryR76\.r84FocusHoldUntil > nowMs\);/, "鏡頭帶過去那幾秒不被任務目標搶回");
  assert.match(world, /window\.StoryR76\.r84MinimapMarks\(s, Date\.now\(\)\)/, "小地圖畫記號");
});

/* ---------- 第 6 項：接線 ---------- */
test("6a 接線：測試排在 unit 清單最後；R84C 樣式追加在 content-r58b.css 檔尾、括號成對", () => {
  const guard = read("scripts/guard-validation-writes.js"), list = guard.slice(guard.indexOf("const unit=["), guard.indexOf("];", guard.indexOf("const unit=[")));
  assert.match(list, /"node scripts\/test-content-r84-pace\.js"/);
  assert.ok(list.indexOf("test-content-r84-pace") > list.indexOf("test-content-r83-card-layout"), "接在 R83 最後一支後面");
  const css = read("src/content-r58b.css");
  assert.ok(css.indexOf("/* ===== R84C：前幾分鐘的節奏與舊麥種成果 開始 ===== */") > css.lastIndexOf("/* ===== R83A 結束 ===== */"), "R84C 追加在 R83 後面");
  assert.match(css.trimEnd(), /\/\* ===== R84[ABC] 結束 ===== \*\/$/, "檔尾是 R84 的段落");
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
  assert.match(read("sw.js"), /CACHE_VERSION = "content-r83-20261117-1"/, "版本字串沒動");
});

/* ---------- 瀏覽器：四種尺寸實拍量測 ---------- */
const VIEWS = [[1366, 768, false], [1366, 600, false], [390, 844, true], [844, 390, true]];
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
function serve() { return new Promise((resolve, reject) => { const server = http.createServer((req, res) => { const u = new URL(req.url, "http://127.0.0.1"), file = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))); if (path.relative(ROOT, file).startsWith("..") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(file).pipe(res); }); server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server)); }); }
async function launch(chromium) { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) { /* 換系統瀏覽器 */ } for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) { /* 下一個 */ } throw Error("No browser available"); }

/* 頁面裡的量測工具：真的看得到（有大小、沒被藏、祖先沒被裁成 1px）的字與方框。 */
function install() {
  const shown = (el) => { const own = el.getBoundingClientRect(); if (own.width <= 2 || own.height <= 2) return false; for (let p = el; p && p !== document.body; p = p.parentElement) { if (p.hidden) return false; const c = getComputedStyle(p), r = p.getBoundingClientRect(); if (c.display === "none" || c.visibility === "hidden" || c.opacity === "0") return false; if (c.clipPath && c.clipPath !== "none" && r.width <= 2) return false; } return true; };
  const rect = (e) => { if (!e) return null; const z = e.getBoundingClientRect(); return { l: z.left, t: z.top, r: z.right, b: z.bottom, w: z.width, h: z.height }; };
  const ov = (a, b) => (a && b ? Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t)) : 0);
  window.__r84c = {
    rect, ov, shown,
    /* 畫面上看得到的「等光再收」：每一處記下在哪、那一顆鈕上寫了什麼。 */
    waitWords() {
      const out = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = walker.nextNode())) {
        if (!/等光再收/.test(n.textContent) || !n.parentElement || !shown(n.parentElement)) continue;
        const el = n.parentElement, btn = el.closest("button");
        out.push({ where: el.closest("#sceneActionBar") ? "bar" : el.closest("#questDock") ? "card" : el.closest("#tileStateLabel") ? "label" : el.closest("#actionA") ? "thumb" : el.closest("#toast-zone") ? "toast" : (el.id || String(el.className)), action: btn ? btn.dataset.action || "" : "", button: btn ? btn.textContent.replace(/\s+/g, " ").trim() : "" });
      }
      return out;
    },
    /* 把狀態擺成「熟了、光快到」：教學（自動收）、早市二選一；selectPlot 表示田已經選取。 */
    prepareWait(mode, selectPlot) {
      const s = __farm.state(), t = Date.now(), Adv = AdventureAPI, active = activePlotCount(s), plotTile = (i) => s.map.tiles.find((x) => x.plotIndex === i);
      document.querySelectorAll(".modal.show").forEach((n) => n.classList.remove("show")); const d = document.querySelector("#worldDialogue"); if (d) d.hidden = true;
      document.querySelectorAll(".r76b-dialogue,.npc-bubble").forEach((n) => n.remove());
      Adv.ensure(s, t); s.coins = 200; s.stats.plantCount = 9; s.stats.harvested = {}; s.orders = []; s.flags.r79FirstLightHarvest = false; s.flags.r79LightChoiceCount = 0; delete s.flags.r79WaitHarvest;
      for (let i = 0; i < active; i++) { s.plots[i].cropId = null; s.plots[i].plantedAt = 0; delete s.plots[i].wateredAt; }
      s.plots[0].cropId = "wheat"; s.plots[0].careMode = "water"; s.plots[0].plantedAt = t - 3600000; s.plots[0].wateredAt = t - 3600000;
      if (mode === "market") { s.stats.harvested = { wheat: 3 }; s.flags.r79FirstLightHarvest = true; s.sun.spawned = 1; }
      Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: t + 9000, nextAt: t + 9000, refractions: 0, introduced: true });
      FarmSunplay.refreshLightCountdown(s.sun, t);
      s.interaction.selectedTileId = selectPlot ? plotTile(0).id : null;
      __farm.refresh(); FarmWorld.refresh(s);
      if (selectPlot) { __farm.focusTile(plotTile(0).id); __farm.clickTile(plotTile(0).id); __farm.cancelJourney(); __farm.renderSceneActions(); }
      return plotTile(0).id;
    },
  };
}

async function waitChecks(page, tag, opening) {
  /* 一、熟了光快到，田已選取：「等光再收」只有田邊動作列那一顆鈕，帶秒數與收益。 */
  await page.evaluate(() => __r84c.prepareWait("tutorial", true)); await page.waitForTimeout(1300);
  let words = await page.evaluate(() => __r84c.waitWords());
  assert.equal(words.length, 1, `${tag}・${opening} 教學等光：畫面上「等光再收」只有一處 ${JSON.stringify(words)}`);
  assert.equal(words[0].where, "bar"); assert.equal(words[0].action, "wait_light");
  assert.match(words[0].button, /等光再收\s*等 \d+ 秒・\d+ 份＋陽光 \d+・光到自動收成$/, `${tag} 那一顆鈕寫秒數與收益：${words[0].button}`);
  const label = await page.evaluate(() => { const l = document.querySelector("#tileStateLabel"); return l && !l.hidden ? l.textContent.split("\n")[0] : ""; });
  assert.match(label, /^小麥・留著等光/, `${tag} 田上標籤寫狀態：${label}`);
  /* 一之二、手機站在田邊面向那一格：動作列照樣顯示（秒數與收益不藏），右下大鈕寫「等光・小麥田」，兩者不疊。 */
  if (await page.evaluate(() => matchMedia("(pointer: coarse)").matches || innerWidth < 860)) {
    const f = await page.evaluate(() => {
      const s = __farm.state(), tile = s.map.tiles.find((x) => x.plotIndex === 0), adj = s.map.tiles.find((x) => x.x === tile.x && x.y === tile.y + 1) || s.map.tiles.find((x) => x.x === tile.x + 1 && x.y === tile.y);
      Object.assign(s.player, { tileId: adj.id, x: adj.x, y: adj.y, facing: window.facingTo(adj, tile) }); __farm.cancelJourney(); __farm.refresh();
      return new Promise((done) => setTimeout(() => { const u = __r84c, bar = document.querySelector("#sceneActionBar"), thumb = document.querySelector("#actionA"); done({ words: u.waitWords(), thumb: thumb && u.shown(thumb) ? thumb.textContent.trim() : "", over: u.ov(u.rect(bar), thumb && u.shown(thumb) ? u.rect(thumb) : null) }); }, 800));
    });
    assert.equal(f.words.length, 1, `${tag}・${opening} 面向那一格：「等光再收」只有一處 ${JSON.stringify(f.words)}`); assert.equal(f.words[0].where, "bar", `${tag} 面向那一格時秒數與收益仍在田邊動作列`);
    if (f.thumb) { assert.equal(f.thumb, "等光・小麥田", `${tag} 右下大鈕寫狀態`); assert.equal(f.over, 0, `${tag} 動作列與右下大鈕不疊`); }
  }
  /* 二、早市二選一：兩顆鈕各寫結果，「等光再收」仍只有那一顆。 */
  await page.evaluate(() => __r84c.prepareWait("market", true)); await page.waitForTimeout(1300);
  words = await page.evaluate(() => __r84c.waitWords());
  assert.equal(words.length, 1, `${tag}・${opening} 早市二選一：「等光再收」只有一處 ${JSON.stringify(words)}`); assert.equal(words[0].where, "bar");
  assert.match(words[0].button, /等 \d+ 秒・\d+ 份小麥＋陽光 \d+・錯過早市/);
  /* 三、田還沒選：任務卡的「看看這株小麥」帶玩家去看，不替玩家按等光；按了以後田邊動作列出現，畫面上仍只有那一處。 */
  await page.evaluate(() => __r84c.prepareWait("tutorial", false)); await page.waitForTimeout(1300);
  words = await page.evaluate(() => __r84c.waitWords());
  assert.ok(words.length === 0 || (words.length === 1 && words[0].where === "bar"), `${tag}・${opening} 田還沒選：任務卡與標籤不寫「等光再收」 ${JSON.stringify(words)}`);
  const go = page.locator('#questDock button:has-text("看看這株小麥")').first();
  if (await go.count() && await go.isVisible()) {
    await go.click(); await page.waitForTimeout(900);
    const after = await page.evaluate(() => ({ queued: !!__farm.state().flags.r79WaitHarvest, words: __r84c.waitWords(), selected: __farm.state().interaction.selectedTileId }));
    assert.equal(after.queued, false, `${tag} 「看看這株小麥」不替玩家按等光`);
    assert.equal(after.words.length, 1, `${tag} 按了以後田邊動作列出現 ${JSON.stringify(after.words)}`); assert.equal(after.words[0].where, "bar");
  }
  /* 四、選了等光以後：任務卡寫已選，動作列那顆鈕改成等光中，畫面上不再有「等光再收」。 */
  await page.evaluate(() => __r84c.prepareWait("market", true)); await page.waitForTimeout(1000);
  await page.locator('#sceneActionBar [data-action="wait_light"]').click(); await page.waitForTimeout(900);
  words = await page.evaluate(() => __r84c.waitWords());
  assert.deepEqual(words, [], `${tag}・${opening} 選了等光以後不再出現「等光再收」 ${JSON.stringify(words)}`);
}
async function choreChecks(page, tag) {
  await page.evaluate(() => {
    document.querySelectorAll(".r76b-dialogue,.npc-bubble").forEach((n) => n.remove()); const d = document.querySelector("#worldDialogue"); if (d) d.hidden = true;
    const s = __farm.state(), now = Date.now(); s.coins = 50; s.stats.plantCount = 9; s.flags.r79FirstLightHarvest = true; s.r75Sunplay.firstCaught = true; delete s.flags.r79WaitHarvest;
    for (const i of [0, 1]) { s.plots[i].cropId = "wheat"; s.plots[i].plantedAt = now; s.plots[i].wateredAt = now; }
    Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: now + 600000 });
    const p0 = s.map.tiles.find((t) => t.plotIndex === 0); s.player.tileId = p0.id; s.player.x = p0.x; s.player.y = p0.y; s.interaction.selectedTileId = null;
    __farm.refresh(); __farm.focusTile(p0.id);
  });
  await page.waitForTimeout(500);
  for (const choreId of ["glean", "sparrow", "weed", "twig"]) {
    for (const far of [false, true]) {
      const m = await page.evaluate(async ([choreId, far]) => {
        const s = __farm.state(), Wp = FarmWaitplay, now = Date.now(), st = Wp.normalize(s), u = __r84c;
        /* 靠近：角色站回第一格田、鏡頭帶回田邊；走遠：角色站到右邊的空地。 */
        const home = far ? (s.map.tiles.find((x) => x.id === "t7_5") || s.map.tiles.find((x) => x.plotIndex == null && x.x > 6)) : s.map.tiles.find((x) => x.plotIndex === 0);
        s.player.tileId = home.id; s.player.x = home.x; s.player.y = home.y;
        if (!far) { __farm.refresh(); __farm.focusTile(home.id); await new Promise((r) => setTimeout(r, 500)); }
        const step = AdventureAPI.nextFarmStep(s, now), tile = Wp.pickTile(s, step, 0, now);
        st.active = { id: choreId, tileId: tile.id, startedAt: now, expiresAt: now + 600000, kind: "grow", claimedAt: 0, goneAt: 0 };
        await new Promise((r) => setTimeout(r, 700));
        const node = document.querySelector("#mapWorld .r83c-chore"), sprite = node && node.querySelector(".r83c-chore-sprite"), tagEl = node && node.querySelector(".r83c-chore-tag");
        const active = window.activePlotCount(s), plots = s.map.tiles.filter((t) => t.plotIndex != null && t.plotIndex < active).map((t) => u.rect(document.querySelector('.gtile[data-tile-id="' + t.id + '"]')));
        const pr = u.rect(document.querySelector("#player .p-sprite") || document.getElementById("player")), sr = u.rect(sprite), tr = u.rect(tagEl);
        const buttons = [...document.querySelectorAll("button")].filter((b) => !b.closest("#mapWorld")).filter((b) => { const z = b.getBoundingClientRect(), c = getComputedStyle(b); return z.width > 4 && z.height > 4 && c.display !== "none" && c.visibility !== "hidden" && z.right > 0 && z.bottom > 0 && z.left < innerWidth && z.top < innerHeight; });
        const covered = buttons.filter((b) => { const z = b.getBoundingClientRect(), hit = document.elementFromPoint(z.left + z.width / 2, z.top + z.height / 2); return hit && hit.closest && hit.closest(".r83c-chore"); }).map((b) => b.textContent.trim());
        return { T: parseFloat(document.querySelector(".gtile").style.width), sprite: sr, tag: tr, tagText: tagEl ? tagEl.textContent : "", tagShown: !!tagEl && u.shown(tagEl), near: node.classList.contains("is-near"),
          overPlayer: u.ov(sr, pr) + u.ov(tr, pr), overPlots: plots.reduce((a, p) => a + u.ov(sr, p) + u.ov(tr, p), 0), covered, inView: !!tr && tr.l >= 0 && tr.t >= 0 && tr.r <= innerWidth && tr.b <= innerHeight };
      }, [choreId, far]);
      const t2 = `${tag}・${choreId}${far ? "・角色走遠" : ""}`;
      assert.ok(m.T >= 48, t2 + " 一般視角");
      assert.ok(m.sprite.w >= 40 && m.sprite.h >= 40, t2 + " 圖至少 40px：" + JSON.stringify(m.sprite));
      assert.equal(m.tagShown, true, t2 + " 名牌常駐（靠近：" + m.near + "）"); assert.equal(m.tagText, { glean: "撿落穗", sparrow: "麻雀", weed: "拔雜草", twig: "撿枯枝" }[choreId]);
      if (!far) { assert.equal(m.overPlayer, 0, t2 + " 圖與名牌不壓角色"); assert.equal(m.inView, true, t2 + " 名牌在畫面內 " + JSON.stringify(m)); }
      assert.equal(m.overPlots, 0, t2 + " 圖與名牌不壓田");
      assert.deepEqual(m.covered, [], t2 + " 不壓任何按鈕");
    }
  }
  await page.evaluate(() => { const st = FarmWaitplay.normalize(__farm.state()); st.active = null; });
}
async function setRoute(page, route, stage) {
  await page.evaluate(([route, stage]) => {
    const s = __farm.state(), now = Date.now(), DAY = 86400000, day = (t) => new Date(t).toISOString().slice(0, 10);
    s.heirloom.started = true; s.heirloom.sunWheat = 2; s.storage.items.wheat = 2;
    if (!s.heirloom.delivered) FarmHeirloom.deliver(s, "table", now - 3 * DAY);
    s.r81story = { choice: route, choiceAt: now - 3 * DAY, shownAt: now - 3 * DAY, orderAt: now - 3 * DAY + 1, sceneAt: now - 3 * DAY + 2 };
    const plant = route !== "plant" || stage === "empty" ? {} : { plantedAt: now - 2 * DAY, lightDays: stage === "planted" ? [] : stage === "one-light" ? [day(now - DAY)] : [day(now - 2 * DAY), day(now - DAY)], harvestedAt: stage === "harvested" ? now - 1000 : 0, stock: stage === "harvested" ? 1 : 0 };
    const found = stage === "decorated" ? { old_seed_tag: now - 3000, faded_photo: now - 2000, ledger_page: now - 1000 } : {};
    s.r82branches = { route, plant, seal: route === "seal" ? { startDay: day(now - 2 * DAY), found, decoratedAt: stage === "decorated" ? now - 1000 : 0 } : {} };
    s.flags.r84cRelicSeen = { old_seed_tag: now, faded_photo: now, ledger_page: now };
    __farm.refresh();
    document.querySelectorAll(".r76b-dialogue,.npc-bubble").forEach((n) => n.remove());
    for (const id of ["dailyModal", "worldModal", "settingsModal"]) document.getElementById(id)?.classList.remove("show");
    document.querySelector(".side-panel")?.classList.remove("world-panel-open");
    ChoicesR77.paintScenes(s);
  }, [route, stage]);
}
async function focusStation(page, station) {
  await page.evaluate((station) => { const s = __farm.state(), t = s.map.tiles.find((x) => x.station === station); __farm.focusTile(t.id); }, station);
  let last = "";
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(150); const pos = await page.evaluate(() => document.getElementById("mapWorld").style.transform); if (pos === last) break; last = pos; }
}
/* 圖片本身的顏色：不透明像素的平均 RGB，以及縮成 16×16 的像素（比較四個階段外形差多少）。 */
async function artInfo(page, src) {
  return page.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement("canvas"); c.width = c.height = 16; const g = c.getContext("2d"); g.imageSmoothingEnabled = true; g.drawImage(img, 0, 0, 16, 16);
    const px = Array.from(g.getImageData(0, 0, 16, 16).data);
    const big = document.createElement("canvas"); big.width = img.naturalWidth; big.height = img.naturalHeight; const bg = big.getContext("2d"); bg.drawImage(img, 0, 0);
    const d = bg.getImageData(0, 0, big.width, big.height).data; let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    /* 「植株」的顏色：只算明顯有色的像素（排掉泥土的暗褐色），看是綠還是金黃。 */
    let cr = 0, cg = 0, cn = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] <= 128) continue; const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx < 90 || mx - mn < 50) continue; cr += d[i]; cg += d[i + 1]; cn++; }
    return { px, mean: [r / n, gg / n, b / n], plant: cn ? [cr / cn, cg / cn] : [0, 0], plantPx: cn };
  }, src);
}
const meanDiff = (a, b) => { let d = 0, n = 0; for (let i = 0; i < a.length; i += 4) { const wa = a[i + 3] / 255, wb = b[i + 3] / 255; d += Math.abs(a[i] * wa - b[i] * wb) + Math.abs(a[i + 1] * wa - b[i + 1] * wb) + Math.abs(a[i + 2] * wa - b[i + 2] * wb); n += 3; } return d / n; };
async function fieldChecks(page, tag) {
  const arts = {};
  for (const stage of ["planted", "one-light", "ripe", "harvested"]) {
    await setRoute(page, "plant", stage); await focusStation(page, "well"); await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const u = __r84c, s = __farm.state(), node = document.querySelector('.r78c-scene-change[data-r78c-route="r81c_story:plant"]'), tagEl = node && document.querySelector('.r78c-scene-label[data-r78c-route="' + node.dataset.r78cRoute + '"]');
      const T = parseFloat(document.querySelector(".gtile").style.width), well = u.rect(document.querySelector('.ob[data-station="well"]')), nr = u.rect(node), ir = u.rect(node && node.querySelector("img")), lr = u.rect(tagEl);
      const npcs = [...document.querySelectorAll('#mapWorld .ob[data-kind="npc"]')].map(u.rect);
      const labels = [...document.querySelectorAll("#mapWorld .r78c-scene-label, #mapWorld .npc-footname, #mapWorld .npc-nameplate, #mapWorld .world-site-label")].filter((n) => n !== tagEl && u.shown(n)).map(u.rect);
      return { T, node: nr, img: ir, field: node && node.dataset.r84cField, stage: node && node.dataset.r82bStage, src: node && node.querySelector("img").getAttribute("src"), label: tagEl && tagEl.textContent,
        overWell: u.ov(nr, well), overNpc: npcs.reduce((a, r) => a + u.ov(nr, r), 0), labelHits: labels.filter((r) => u.ov(lr, r) > 1).length,
        inView: !!nr && !!lr && nr.l >= 0 && nr.r <= innerWidth && lr.t >= 0 && lr.l >= 0 && lr.r <= innerWidth && nr.b <= innerHeight };
    });
    const t2 = `${tag}・${stage}`;
    assert.equal(m.field, "2x2", t2 + " 標成 2×2 的田"); assert.equal(m.stage, stage);
    assert.ok(m.node.w >= 2 * m.T - 1 && m.node.h >= 2 * m.T - 1, t2 + " 物件至少 2×2 格：" + JSON.stringify([m.node.w, m.node.h, m.T]));
    assert.ok(m.img.w >= 1.9 * m.T && m.img.h >= 1.9 * m.T, t2 + " 圖撐滿 2×2 的範圍：" + JSON.stringify(m.img));
    assert.ok(m.overWell <= m.node.w * m.node.h * 0.05, t2 + " 不蓋水井：" + m.overWell);
    assert.equal(m.overNpc, 0, t2 + " 不壓鄰居"); assert.equal(m.labelHits, 0, t2 + " 名牌不壓其他名牌");
    assert.equal(m.inView, true, t2 + " 鏡頭帶到水井時田與名牌在畫面內 " + JSON.stringify(m));
    assert.match(m.label, /^藍布老麥田・/);
    if (!arts[stage]) arts[stage] = await artInfo(page, m.src);
  }
  /* 照過 1 次光：植株是青綠色；成熟：金黃。四個階段縮成 16×16 彼此差得夠多。 */
  const green = arts["one-light"].plant, gold = arts.ripe.plant;
  assert.ok(arts["one-light"].plantPx > 20 && green[1] > green[0], tag + " 照過 1 次光是青綠色、還沒熟 " + JSON.stringify(green));
  assert.ok(gold[0] > gold[1], tag + " 成熟是金黃色 " + JSON.stringify(gold));
  /* 照過 1 次光、成熟這兩個階段跟其他階段的 16×16 縮圖要差得夠多（R83 圖 149、150 的問題）。
     剛種下與已收成目前都是 R82 那兩張土堆圖（一個長芽、一個留麥稈和一束麥），只驗不是同一張；2×2 新圖到了再拉開。 */
  const keys = ["planted", "one-light", "ripe", "harvested"];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const d = meanDiff(arts[keys[i]].px, arts[keys[j]].px), key = keys[i] + "/" + keys[j];
    assert.ok(d >= (key === "planted/harvested" ? 5 : 15), `${tag} ${keys[i]} 與 ${keys[j]} 外形差 ${d.toFixed(1)}`);
  }
}
async function relicChecks(page, tag) {
  /* 舊物剛出現：鏡頭帶過去、物件在畫面內沒被介面蓋住、沒有遮罩接管點擊；小地圖有記號。 */
  /* 先擺好封存線（三件都已帶過）、鏡頭帶回田邊，再把「帶過」清掉，等遊戲自己發現舊物出現。 */
  await setRoute(page, "seal", "");
  await page.evaluate(() => { const s = __farm.state(), p = s.map.tiles.find((t) => t.plotIndex === 0); __farm.focusTile(p.id); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { __farm.state().flags.r84cRelicSeen = {}; });
  await page.waitForFunction(() => { const s = __farm.state(); return s.flags.r84cRelicSeen && s.flags.r84cRelicSeen.old_seed_tag; }, null, { timeout: 5000 });
  await page.waitForTimeout(1300);
  const m = await page.evaluate(() => {
    const u = __r84c, s = __farm.state(), node = document.querySelector('.r78c-scene-change[data-r78c-route="r82b_relic_old_seed_tag:old_seed_tag"]'), r = u.rect(node);
    const hit = r ? document.elementFromPoint(r.l + r.w / 2, r.t + r.h * 0.6) : null;
    const mini = document.getElementById("worldMinimap"), canvas = mini && mini.querySelector("canvas"), ctx = canvas && canvas.getContext("2d"), px = ctx ? Array.from(ctx.getImageData(12 * 10 + 5, 8 * 10 + 5, 1, 1).data) : [];
    const masks = [...document.querySelectorAll(".modal.show, .r76b-dialogue, [data-audit='focus-mask']")].length;
    const center = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return { focus: s.camera.focusTileId, relicTile: s.map.tiles.find((t) => t.x === 12 && t.y === 8).id, inView: !!r && r.l >= 0 && r.t >= 0 && r.r <= innerWidth && r.b <= innerHeight,
      top: hit && node && node.contains(hit), marks: mini && mini.dataset.r84cMarks, gold: px, masks, centerInMap: !!(center && center.closest && center.closest("#mapScene")), seen: Object.keys(s.flags.r84cRelicSeen || {}) };
  });
  assert.equal(m.focus, m.relicTile, `${tag} 舊物一出現，鏡頭帶到那一格`);
  assert.equal(m.inView, true, `${tag} 舊物完整在畫面內`); assert.equal(m.top, true, `${tag} 舊物沒被介面蓋住`);
  assert.equal(m.masks, 0, `${tag} 沒有遮罩或對話框`); assert.equal(m.centerInMap, true, `${tag} 畫面中央點下去仍是地圖（不接管點擊）`);
  assert.match(m.marks || "", /(^|;)12,8(;|$)/, `${tag} 小地圖有記號：${m.marks}`);
  assert.ok(m.gold[0] > 200 && m.gold[1] > 150 && m.gold[2] < 120, `${tag} 小地圖記號是金色 ${m.gold}`);
  assert.deepEqual(m.seen.sort(), ["faded_photo", "ledger_page", "old_seed_tag"], `${tag} 同時出現的幾件一起記下，不連續帶三次`);
  /* 找齊後的擺飾：至少跟告示牌一樣大。 */
  await setRoute(page, "seal", "decorated"); await focusStation(page, "sign"); await page.waitForTimeout(300);
  const d = await page.evaluate(() => { const u = __r84c; return { deco: u.rect(document.querySelector('.r78c-scene-change[data-r82b-branch="decoration"]')), sign: u.rect(document.querySelector('.ob[data-station="sign"]')), seal: u.rect(document.querySelector('.r78c-scene-change[data-r78c-route="r81c_story:seal"]')) }; });
  assert.ok(d.deco && d.sign && d.deco.w >= d.sign.w - 0.5 && d.deco.h >= d.sign.h - 0.5, `${tag} 壓穗鎮誌牌至少跟告示牌一樣大 ${JSON.stringify(d)}`);
  assert.equal(await page.evaluate(([a, b]) => __r84c.ov(a, b), [d.deco, d.seal]), 0, `${tag} 擺飾不疊在封存箱上`);
}

async function browserChecks() {
  let chromium; try { ({ chromium } = require("playwright")); } catch (_) { throw Error("playwright 不可用"); }
  const server = await serve(), origin = "http://127.0.0.1:" + server.address().port, browser = await launch(chromium); let checks = 0;
  try {
    for (const [width, height, mobile] of VIEWS) {
      const tag = width + "x" + height;
      for (const opening of (width === 1366 && height === 600) || width === 844 ? ["一般開場"] : ["一般開場", "祖母手記開場"]) {
        const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", reducedMotion: "reduce" });
        const page = await context.newPage(), errors = []; page.on("pageerror", (e) => errors.push(String(e)));
        await page.goto(origin);
        await page.waitForFunction(() => window.__farm && window.AdventureAPI && window.FarmWaitplay && window.StoryR76 && window.ChoicesR77 && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
        await page.evaluate((sel) => document.querySelector(sel)?.click(), opening === "一般開場" ? "#worldBegin" : "#worldSunBegin");
        await page.waitForTimeout(300); await page.evaluate(install);
        await waitChecks(page, tag, opening); checks++;
        if (opening === "一般開場") {
          await choreChecks(page, tag); checks++;
          await fieldChecks(page, tag); checks++;
          await relicChecks(page, tag); checks++;
        }
        assert.deepEqual(errors, [], tag + " " + opening + " 沒有頁面錯誤");
        await context.close();
      }
    }
  } finally { await browser.close(); server.close(); }
  return checks;
}

(async () => {
  for (const [name, fn] of pending) { try { await fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
  try { const checks = await browserChecks(); passed++; console.log(`PASS 7 實拍 ${VIEWS.map((v) => v[0] + "×" + v[1]).join("、")}：等光只有一處、小事名牌常駐、2×2 藍布老麥田、舊物鏡頭與小地圖、擺飾大小（${checks} 組）`); }
  catch (error) { console.error("FAIL 7 實拍\n" + error.stack); process.exitCode = 1; }
  if (!process.exitCode) console.log(`R84C pace: ${passed} passed`);
})();
