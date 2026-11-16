"use strict";
/* R83C：教學一套說法、田邊小事長在地圖上。
 * 1 前十分鐘的任務卡、祖母手記、田上標籤、提示訊息講光只用「折光／等光再收／在光裡收成／在光裡澆水」；
 *   不再出現「光到了再澆水」「看見光落下再去澆水」「趁光」這類說法；教等光時頂部陽光籤不跳「手鏡可折 1 次」。
 * 2 田邊小事畫在田邊地上（#mapWorld 裡、跟地圖一起捲動縮放、pixelated、點擊範圍至少 44×44），名稱只在靠近或點選時出現；
 *   不壓角色、不壓田、不壓任何按鈕；麻雀跳、雜草晃，尊重 prefers-reduced-motion。
 * 3 麻雀二選一：趕走拿陽光 1；留一把穗之後偶爾叼回一顆小麥種子（有間隔、一天有上限）；結果寫進手札一行。全部用遊戲時鐘驗。
 * 4 接線：測試排進 unit 清單、樣式標 R83C。 */
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const State = require("../src/state.js"), Sun = require("../src/sunplay-r75.js"), Game = require("../src/game.js"), A = require("../src/adventure.js");
const H = require("../src/heirloom.js"), W = require("../src/waitplay-r82.js");
const ROOT = path.join(__dirname, ".."), read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const T = 1794172800000;
let passed = 0;
const pending = [];
function test(name, fn) { pending.push([name, fn]); }
function fresh(now = T) { const s = State.defaultState(now); Sun.normalize(s); A.ensure(s, now); return s; }
function seeded(seed) { let x = seed; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; }
const tileOf = (s, i) => s.map.tiles.find((t) => t.plotIndex === i);
const clone = (s) => JSON.parse(JSON.stringify(s));
function preview(s, plots, at) { Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: plots, previewAt: at, nextAt: at, refractions: 0 }); }
function lit(s, plots, from, until) { Object.assign(s.sun, { plots, used: [], startsAt: from, endsAt: until, previewPlots: [], previewAt: 0, nextAt: until + 40000 }); }

/* ---------- 第 1 項：一套說法 ---------- */
/* 跟教學順序衝突、或同一件事的另一種說法。 */
const BANNED = /光到了再|看見光落下|落下再澆|落下再收|等光落下再|光落下，再去|趁光|光到再/;
const SAYS_LIGHT_WATER = /光.*澆|澆.*光/, SAYS_LIGHT_HARVEST = /光.*收|收.*光/;
const CANON_WATER = /在光裡澆水/, CANON_HARVEST = /等光再收|在光裡收成|已選等光|現在收或等光|等光自動收成/;
function collect(bag, step, where) {
  if (!step) return;
  for (const key of ["text", "short", "actionLabel", "title", "detail", "label"]) if (typeof step[key] === "string" && step[key]) bag.push({ where, key, text: step[key], action: step.action });
  if (step.alternative) collect(bag, step.alternative, where + "・另一件");
}
/* 照任務卡做的新玩家，從開場一路玩十分鐘（兩種開場），每 250 毫秒把畫面上會出現的下一步全部收下來。 */
function playTenMinutes(heirloom) {
  const rng = seeded(83), s = fresh(T); s.coins = 16; if (heirloom) H.start(s);
  const bag = [], order = [];
  let busyUntil = T + 3000;
  const record = (event, t) => { A.record(s, event, t); A.finishTutorial(s, t); };
  const harvest = (i, t) => { const r = Game.harvest(s, i, t, rng); if (r.ok) record({ type: "harvest", cropId: r.cropId, count: r.added }, t); return r; };
  function farmAct(step, t) {
    const i = step.plotIndex;
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
  for (let t = T; t <= T + 600000; t += 250) {
    Game.updateSunpatch(s, t, rng); Sun.refreshLightCountdown(s.sun, t);
    const queued = Game.lightHarvestQueue(s); if (queued && queued.autoHarvest && Game.isSunlit(s, queued.plotIndex, t)) harvest(queued.plotIndex, t);
    W.update(s, t);
    const guide = A.nextGuidance(s, t), farm = A.nextFarmStep(s, t);
    collect(bag, guide, heirloom ? "祖母手記" : "任務卡"); collect(bag, farm, "農務下一步");
    const e = A.earlyGoals(s, t); (e.goals || []).forEach((g) => collect(bag, { text: g.detail, actionLabel: g.actionLabel }, "今日三件事")); if (e.nextStep) collect(bag, { text: e.nextStep.detail, actionLabel: e.nextStep.actionLabel }, "主線下一步");
    const tag = farm.action + (farm.sunlit ? "*" : ""); if (order[order.length - 1] !== tag) order.push(tag);
    for (const p of [0, 1, 2, 3, 4, 5]) { const c = Game.lightHarvestChoice(s, p, t); if (c.ok) bag.push({ where: "田邊等光", key: "tutorialText", text: c.tutorialText }, { where: "田邊等光", key: "helpText", text: c.helpText }); }
    if (t < busyUntil) continue;
    const h = H.status(s);
    let cost = 0;
    if (heirloom && h.started && !h.delivered) cost = h.ready ? (H.deliver(s, "table", t).ok ? 6000 : 0) : farmAct(farm, t);
    else { const step = farm; cost = farmAct(step, t) || questAct(t); }
    if (cost) busyUntil = t + cost;
  }
  return { s, bag, order };
}
/* 祖母手記與任務卡每一個講光的分支，直接擺出那個狀態收下來（模擬不一定每支都走到）。 */
function branchStates() {
  const bag = [];
  const heir = (fn) => { const s = fresh(); s.coins = 30; H.start(s); fn(s); return s; };
  const grab = (s, t, where) => { collect(bag, A.nextGuidance(s, t), where); collect(bag, A.nextFarmStep(s, t), where + "・農務"); };
  /* 祖母手記：還沒種、種了乾的／濕的、折過光／還沒折、光快落在這株、光正照著、熟了光快到。 */
  for (const refracted of [false, true]) for (const wet of [false, true]) {
    grab(heir((s) => { s.r75Sunplay.firstRefracted = refracted; }), T, "祖母手記・還沒種");
    const s = heir((s) => { s.r75Sunplay.firstRefracted = refracted; Game.plant(s, 0, "wheat", T); if (wet) Game.waterPlot(s, 0, T); Object.assign(s.sun, { previewPlots: [], previewAt: 0, nextAt: T + 600000 }); });
    grab(s, T + 10, "祖母手記・等第一道光");
    preview(s, [0], T + 5000); grab(s, T + 20, "祖母手記・光快落在這株");
    preview(s, [1], T + 5000); grab(s, T + 30, "祖母手記・光快落在空田");
    lit(s, [0], T + 40, T + 20000); grab(s, T + 50, "祖母手記・光正照著");
  }
  const ripe = heir((s) => { Game.plant(s, 0, "wheat", T); s.plots[0].plantedAt = T - 3600000; preview(s, [0], T + 7000); }); grab(ripe, T, "祖母手記・熟了光快到");
  lit(ripe, [0], T, T + 20000); grab(ripe, T + 10, "祖母手記・熟了光正照著");
  /* 任務卡：光快落在乾的那株（等光，在光裡澆水）、教學等光再收、早市選了等光、光落在空田要折光。 */
  const dry = fresh(); dry.coins = 30; Game.plant(dry, 0, "wheat", T); dry.r75Sunplay.firstRefracted = true; preview(dry, [0], T + 6000); grab(dry, T, "任務卡・光快落在乾的那株");
  const tut = fresh(); tut.coins = 30; Game.plant(tut, 0, "wheat", T, "water"); tut.plots[0].plantedAt = T - 3600000; preview(tut, [0], T + 7000); grab(tut, T, "任務卡・教學等光再收");
  Game.queueLightHarvest(tut, 0, T); grab(tut, T + 1, "任務卡・教學已按等光");
  const market = fresh(); market.coins = 30; market.stats.harvested.wheat = 3; market.sun.spawned = 1; market.flags.r79FirstLightHarvest = true; Game.plant(market, 0, "wheat", T, "water"); market.plots[0].plantedAt = T - 3600000; preview(market, [0], T + 7000);
  grab(market, T, "任務卡・早市二選一"); Game.queueLightHarvest(market, 0, T); grab(market, T + 1, "任務卡・早市已選等光");
  const empty = fresh(); empty.coins = 30; Game.plant(empty, 0, "wheat", T); preview(empty, [1], T + 6000); grab(empty, T, "任務卡・光快落在空田");
  lit(empty, [0], T + 10, T + 20000); grab(empty, T + 20, "任務卡・光落在乾的那株");
  /* 提示訊息：折光後的提示、等光再收的提示。 */
  for (const r of [{ ok: true, remaining: 0, active: false }, { ok: true, remaining: 0, active: true }, { ok: true, remaining: 1, active: false }, { ok: false }]) bag.push({ where: "折光提示", key: "toast", text: Sun.refractToastText(r) });
  return bag;
}
/* 原始碼裡玩家看得到的字（字串常值，不含註解）。 */
function playerStrings(file) {
  const src = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
  return src.match(/`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g) || [];
}

test("1a 前十分鐘兩種開場：講光只用折光／等光再收／在光裡收成／在光裡澆水，沒有跟教學順序衝突的說法", () => {
  const runs = [playTenMinutes(true), playTenMinutes(false)];
  const bag = runs.flatMap((r) => r.bag).concat(branchStates());
  const bad = bag.filter((row) => BANNED.test(row.text));
  assert.deepEqual([...new Set(bad.map((row) => `${row.where}・${row.key}：${row.text}`))], [], "不能出現的說法");
  /* 短句與按鈕：講到光又講到澆水的，一律寫「在光裡澆水」；講到光又講到收的，一律是「等光再收／在光裡收成」這一組。 */
  const shortish = bag.filter((row) => ["short", "actionLabel", "label"].includes(row.key));
  const offWater = shortish.filter((row) => SAYS_LIGHT_WATER.test(row.text) && !CANON_WATER.test(row.text));
  const offHarvest = shortish.filter((row) => SAYS_LIGHT_HARVEST.test(row.text) && !SAYS_LIGHT_WATER.test(row.text) && !CANON_HARVEST.test(row.text));
  assert.deepEqual([...new Set(offWater.concat(offHarvest).map((row) => `${row.where}・${row.key}：${row.text}`))], [], "短句與按鈕要用同一組說法");
  /* 四種說法都真的教到了。 */
  const all = bag.map((row) => row.text).join("\n");
  for (const word of [/折光|把光折/, /等光再收/, /在光裡收成/, /在光裡澆水/]) assert.match(all, word, "前十分鐘有用到 " + word);
  /* 教學順序：兩種開場都是先折光，才在光裡澆水。 */
  for (const r of runs) {
    const refract = r.order.indexOf("refract"), water = r.order.indexOf("tend*");
    assert.ok(refract >= 0 && water > refract, "先折光再在光裡澆水：" + r.order.slice(0, 12).join(" → "));
    assert.ok(r.s.adventure.claimed.c1_first_meal || r.s.heirloom.delivered, "照著下一步走得完第一章或送出餐籃");
  }
  /* 等光再收的提示跟田邊鈕同一種說法。 */
  const tut = fresh(); Game.plant(tut, 0, "wheat", T, "water"); tut.plots[0].plantedAt = T - 3600000; preview(tut, [0], T + 7000);
  assert.equal(Game.lightHarvestChoice(tut, 0, T).tutorialText, "等光再收：等 7 秒，3 份＋陽光 2（現在收只有 2 份）");
});

test("1b 原始碼：任務卡、田上標籤、祖母手記、提示訊息的字串都沒有舊說法", () => {
  const files = ["src/adventure.js", "src/ui.js", "src/world-ui.js", "src/sunplay-r75.js", "src/game.js", "src/heirloom-ui.js", "src/heirloom.js", "src/sunbook-r76.js", "src/waitplay-r82.js"];
  const hits = files.flatMap((file) => playerStrings(file).filter((s) => BANNED.test(s)).map((s) => file + "：" + s.slice(0, 80)));
  assert.deepEqual(hits, [], "字串裡還有舊說法");
  const ui = read("src/ui.js"), world = read("src/world-ui.js");
  assert.match(ui, /`在光裡澆水・\$\{name\}` \+ "\\n光快落在這格了"/, "光快落在乾的那格：田上標籤寫在光裡澆水");
  assert.match(ui, /"光快落在這格了，等光再收。"/);
  assert.match(world, /"已選等光再收，光落下後回田邊在光裡收成。"/);
  assert.match(world, /queuedLight\.autoHarvest \? "等光自動收成" : "等光再收"/);
  assert.match(world, /"陽光正在田上，到田邊在光裡收成。"/); assert.match(world, /"陽光正在田上，到田邊在光裡澆水。"/);
});

test("1c 教等光時頂部陽光籤不提手鏡；只有任務卡在教折光、或折光交給玩家後沒叫玩家等光時才提", () => {
  /* 第一道光落在空田：任務卡教折光，籤上可以寫手鏡還能折幾次。 */
  const first = fresh(); first.coins = 30; Game.plant(first, 0, "wheat", T); preview(first, [1], T + 6000);
  const refractStep = A.nextGuidance(first, T); assert.equal(refractStep.action, "refract");
  assert.equal(Sun.mirrorHint(first, refractStep, T), "手鏡可折 1 次");
  /* 光快落在這株：任務卡叫玩家等光、在光裡澆水，不提手鏡。 */
  Sun.refract(first, 0, T); const hold = A.nextGuidance(first, T + 1); assert.equal(hold.action, "catch_sun");
  assert.equal(Sun.mirrorHint(first, hold, T + 1), "");
  /* 第一次等光再收（教學）：不提手鏡。 */
  const tut = fresh(); Game.plant(tut, 0, "wheat", T, "water"); tut.plots[0].plantedAt = T - 3600000; preview(tut, [0], T + 7000);
  const tutStep = A.nextGuidance(tut, T); assert.equal(Sun.mirrorHint(tut, tutStep, T), "", "教等光再收時：" + tutStep.text);
  Game.queueLightHarvest(tut, 0, T); assert.equal(Sun.mirrorHint(tut, A.nextGuidance(tut, T + 1), T + 1), "", "按了等光以後也不提");
  /* 祖母手記等光的那幾步：不提手鏡。 */
  const heir = fresh(); H.start(heir); Game.plant(heir, 0, "wheat", T); heir.r75Sunplay.firstRefracted = true; preview(heir, [0], T + 6000);
  assert.equal(Sun.mirrorHint(heir, A.nextGuidance(heir, T), T), "");
  /* 教學走完、選了早市等光：不提；任務卡在做別的事、光要落在別格：才把手鏡交還給玩家。 */
  const market = fresh(); market.coins = 30; market.stats.harvested.wheat = 3; market.sun.spawned = 1; market.flags.r79FirstLightHarvest = true;
  Game.plant(market, 0, "wheat", T, "water"); market.plots[0].plantedAt = T - 3600000; preview(market, [0], T + 7000);
  assert.equal(Sun.mirrorHint(market, A.nextGuidance(market, T), T), "", "早市二選一時不提");
  Game.queueLightHarvest(market, 0, T); assert.equal(Sun.mirrorHint(market, A.nextGuidance(market, T + 1), T + 1), "", "選了等光以後不提");
  const later = fresh(); later.coins = 30; later.flags.r79FirstLightHarvest = true; A.record(later, { type: "talk", npcId: "mayor" }, T); Game.plant(later, 0, "wheat", T); Game.waterPlot(later, 0, T); preview(later, [3], T + 6000);
  const laterStep = A.nextGuidance(later, T); assert.notEqual(laterStep.action, "catch_sun");
  assert.equal(Sun.mirrorHint(later, laterStep, T), "手鏡可折 1 次", "折光交給玩家、光落在別格：" + laterStep.action + " " + laterStep.text);
  /* 頂部陽光籤真的照這個規則寫。 */
  const world = read("src/world-ui.js");
  assert.match(world, /sp\.mirrorHint\(s, nextGuidance\(s, now\), now\)/); assert.match(world, /const mirror = sun\.refractionsLeft > 0 && mirrorText \? `・\$\{mirrorText\}` : "";/);
  assert.doesNotMatch(world, /const mirror = sun\.refractionsLeft > 0 \? `・手鏡可折/);
});

/* ---------- 第 2 項：小事長在地圖上 ---------- */
test("2a 放的格子讓開角色站的位置、角色畫在左邊的那格、任務那一格左邊；緊貼的一圈都被佔走才往外一圈", () => {
  const s = fresh(); s.coins = 50; s.stats.plantCount = 9; A.record(s, { type: "talk", npcId: "mayor" }, T);
  Game.plant(s, 0, "wheat", T); Game.waterPlot(s, 0, T); Game.plant(s, 4, "wheat", T); Game.waterPlot(s, 4, T);
  Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: T + 600000 });
  const ring1 = W.fieldEdgeTiles(s, 1).map((t) => t.id), ring2 = W.fieldEdgeTiles(s, 2).map((t) => t.id);
  assert.ok(ring1.length >= 2 && ring2.length >= 2, `兩圈都有空地：${ring1}｜${ring2}`);
  assert.deepEqual(W.fieldEdgeTiles(s).map((t) => t.id), ring1, "沒帶圈數就是緊貼的那一圈（R82 照舊）");
  assert.ok(ring2.every((id) => !ring1.includes(id)), "外圈不重複");
  const p0 = tileOf(s, 0), left0 = s.map.tiles.find((t) => t.x === p0.x - 1 && t.y === p0.y);
  s.player.tileId = p0.id; s.player.x = p0.x; s.player.y = p0.y;
  const step = A.nextFarmStep(s, T + 1), busy = W.avoidTiles(s, step, T + 1);
  assert.ok(busy.has(p0.id) && busy.has(left0.id), "角色在田上工作時身體畫在左邊那格，那格也讓開");
  const target = s.map.tiles.find((t) => t.id === step.tileId);
  if (target && target.plotIndex != null) { const tl = s.map.tiles.find((t) => t.x === target.x - 1 && t.y === target.y); if (tl) assert.ok(busy.has(tl.id), "任務那一格左邊也讓開"); }
  for (let i = 0; i < 6; i++) { const t = W.pickTile(s, step, i, T + 1); assert.ok(t && !busy.has(t.id), "挑到的格子不在讓開的位置：" + (t && t.id)); assert.equal(t.plotIndex == null, true, "不放在田格上"); }
  /* 緊貼的一圈全被佔走：往外一圈找。 */
  let outer = null;
  try { W.setTilePreference(null); for (const id of ring1) s.map.tiles.find((t) => t.id === id).object = "r83_test_stone"; outer = W.pickTile(s, step, 0, T + 1); }
  finally { for (const id of ring1) delete s.map.tiles.find((t) => t.id === id).object; }
  assert.ok(outer && ring2.includes(outer.id), "外圈接手：" + (outer && outer.id));
  /* 偏好只挑，不會讓小事消失：偏好全不合時照原本的輪替。 */
  W.setTilePreference(() => false); assert.ok(W.pickTile(s, step, 0, T + 1)); W.setTilePreference(null);
});

test("2b 小事有地圖名稱與輕微動作；樣式是地上的東西：沒有框和底色、pixelated、點擊範圍至少 44、名牌預設藏著、尊重減少動態", () => {
  const motions = Object.fromEntries(W.CHORES.map((c) => [c.id, c.motion]));
  assert.deepEqual(motions, { glean: "sway", sparrow: "hop", weed: "sway", twig: "still" });
  for (const c of W.CHORES) { assert.ok(c.label && c.label.length <= 3, "地圖小名牌是短名稱：" + c.label); assert.doesNotMatch(c.label + c.name, /[A-Za-z]/); }
  const css = read("src/content-r58b.css"), block = css.slice(css.indexOf("/* ===== R83C"), css.indexOf("/* ===== R83C 結束 ===== */"));
  assert.ok(block.length > 200, "R83C 樣式區塊在檔尾"); assert.ok(css.lastIndexOf("R83C") > css.lastIndexOf("R82C"), "R83C 接在 R82C 後面");
  assert.match(block, /#mapWorld \.r83c-chore \{[^}]*min-width: 44px; min-height: 44px;[^}]*border: 0;[^}]*background: transparent; box-shadow: none;/);
  assert.match(block, /\.r83c-chore-art \{[^}]*image-rendering: pixelated;/);
  assert.match(block, /\.r83c-chore-tag \{[^}]*opacity: 0; visibility: hidden;/);
  assert.match(block, /\.r83c-chore:is\(\.is-near, \.is-claimed, :hover, :focus-visible, \.is-missing-art\) \.r83c-chore-tag \{ opacity: 1; visibility: visible; \}/);
  assert.match(block, /\[data-motion="hop"\] \.r83c-chore-sprite \{ animation: r83c-chore-hop/); assert.match(block, /\[data-motion="sway"\] \.r83c-chore-sprite \{ animation: r83c-chore-sway/);
  assert.match(block, /@media \(prefers-reduced-motion: reduce\) \{\s*#mapWorld \.r83c-chore, #mapWorld \.r83c-chore \.r83c-chore-sprite \{ animation: none !important; \}/);
  assert.equal((block.match(/{/g) || []).length, (block.match(/}/g) || []).length);
  const src = read("src/waitplay-r82.js");
  assert.match(src, /document\.getElementById\("mapWorld"\)/, "畫在地圖世界裡，跟地圖一起捲動縮放"); assert.match(src, /Math\.max\(44, Math\.round\(T \* 0\.7\)\)/, "點擊範圍至少 44");
  assert.match(src, /is-missing-art/); assert.match(src, /travelAndDo/); assert.doesNotMatch(src, /className = "r82c-chore"/, "不再是介面小方塊");
});

/* ---------- 第 3 項：麻雀二選一 ---------- */
function sparrowAt(s, t) { const st = W.normalize(s), tile = W.fieldEdgeTiles(s)[0]; st.active = { id: "sparrow", tileId: tile.id, startedAt: t, expiresAt: t + W.LIFE_MS, kind: "grow", claimedAt: 0, goneAt: 0 }; return W.view(s, t); }
function sparrowState() { const s = fresh(); s.coins = 50; s.r75Sunplay.firstCaught = true; s.r75Sunplay.sunlight = 1; return s; }
const packs = (s) => ((s.adventure.r58.r59.seedPacks || {}).wheat || 0);
test("3a 麻雀兩個做法：趕走拿陽光 1；留一把穗當下不拿，四十秒後叼回一顆小麥種子；兩邊都寫進手札一行", () => {
  const s = sparrowState(); const v = sparrowAt(s, T);
  assert.deepEqual(v.choices.map((c) => c.id), ["shoo", "share"]); assert.deepEqual(v.choices.map((c) => c.label), ["趕走", "留一把穗給牠"]);
  assert.match(v.choices[0].detail, /陽光 1/); assert.match(v.choices[1].detail, /偶爾叼回種子/);
  /* 趕走 */
  const a = clone(s), sunA = Sun.sunlight(a), r1 = W.resolve(a, T + 2000, { choice: "shoo" });
  assert.equal(r1.ok, true); assert.equal(r1.choice, "shoo"); assert.equal(Sun.sunlight(a) - sunA, 1); assert.equal(a.flags.r82Chores.sparrow.giftAt, 0);
  assert.deepEqual(W.journalLines(a, 3), ["田邊小事：把麻雀趕走了，麥穗多接到一點光（陽光 1）。"]);
  /* 沒帶做法就是趕走（R82 的呼叫照舊）。 */
  const d = clone(s), sunD = Sun.sunlight(d); assert.equal(W.resolve(d, T + 2000).choice, "shoo"); assert.equal(Sun.sunlight(d) - sunD, 1);
  /* 留一把穗 */
  const b = clone(s), sunB = Sun.sunlight(b), seedB = packs(b), coinsB = b.coins, r2 = W.resolve(b, T + 2000, { choice: "share" });
  assert.equal(r2.ok, true); assert.equal(r2.giftScheduled, true); assert.equal(Sun.sunlight(b), sunB, "當下不拿陽光"); assert.equal(packs(b), seedB, "當下也不拿種子"); assert.equal(b.coins, coinsB);
  assert.doesNotMatch(r2.message, /\d/, "旁白不寫數字"); assert.equal(W.view(b, T + 2001), null, "做完就收起來");
  assert.equal(b.flags.r82Chores.sparrow.giftAt, T + 2000 + W.SPARROW_GIFT_DELAY_MS);
  /* 遊戲時鐘走到時間才叼回來，只有一顆、只來一次。 */
  assert.equal(W.update(b, T + 2000 + W.SPARROW_GIFT_DELAY_MS - 250).gift, null, "時間還沒到");
  const g = W.update(b, T + 2000 + W.SPARROW_GIFT_DELAY_MS);
  assert.ok(g.gift, "時間到了叼回來"); assert.equal(packs(b) - seedB, 1); assert.deepEqual(g.gift.seeds, { wheat: 1 }); assert.equal(b.coins, coinsB, "不給金幣");
  assert.equal(W.update(b, T + 2000 + W.SPARROW_GIFT_DELAY_MS + 250).gift, null, "只來一次"); assert.equal(packs(b) - seedB, 1);
  assert.deepEqual(W.journalLines(b, 3), ["田邊小事：留了一把穗給麻雀，牠吃飽飛走前回頭看了你一眼。", "田邊小事：留穗的那隻麻雀飛回來，叼來一顆小麥種子（小麥種子 1 包）。"]);
  assert.ok(b.adventure.r58.r59.journal.every((row) => typeof row.text === "string" && Number.isSafeInteger(row.at)), "手札紀錄格式跟農場小事一樣");
  /* 存檔讀回來仍記得還有一包在路上。 */
  const c = clone(s); W.resolve(c, T + 2000, { choice: "share" }); const loaded = State.migrate(clone(c)); W.normalize(loaded); Sun.normalize(loaded); A.ensure(loaded, T + 3000);
  assert.equal(loaded.flags.r82Chores.sparrow.giftAt, T + 2000 + W.SPARROW_GIFT_DELAY_MS, "存檔記得麻雀什麼時候回來");
  assert.ok(W.update(loaded, T + 2000 + W.SPARROW_GIFT_DELAY_MS + 10).gift, "讀檔後照樣叼回來");
});

test("3b 偶爾、有上限：兩包之間至少隔五分鐘、往回 24 小時最多兩包；選項會老實寫這次只是請牠吃", () => {
  const s = sparrowState(); let t = T;
  const share = (at) => { sparrowAt(s, at); return W.resolve(s, at, { choice: "share" }); };
  assert.equal(share(t).giftScheduled, true); W.update(s, t + W.SPARROW_GIFT_DELAY_MS);
  t += 120000; sparrowAt(s, t); assert.equal(W.view(s, t).choices[1].detail, "這次只是請牠吃", "離上一包不到五分鐘");
  assert.equal(W.resolve(s, t, { choice: "share" }).giftScheduled, false); assert.equal(W.update(s, t + W.SPARROW_GIFT_DELAY_MS).gift, null);
  t = T + W.SPARROW_GIFT_DELAY_MS + W.SPARROW_GIFT_GAP_MS; assert.equal(share(t).giftScheduled, true, "隔五分鐘以後又會叼回來"); assert.ok(W.update(s, t + W.SPARROW_GIFT_DELAY_MS).gift);
  t += W.SPARROW_GIFT_DELAY_MS + W.SPARROW_GIFT_GAP_MS + 1000; assert.equal(share(t).giftScheduled, false, "24 小時內已經兩包");
  t = T + W.SPARROW_GIFT_DAY_MS + 60000; assert.equal(share(t).giftScheduled, true, "隔天又可以");
  assert.equal(W.SPARROW_GIFT_DAY_CAP, 2); assert.ok(W.SPARROW_GIFT_GAP_MS >= 5 * 60000);
});

test("3c 經濟：一直留穗給麻雀，前十分鐘最多多兩包種子、往回 24 小時也最多兩包；陽光、金幣不變多", () => {
  /* 規則上限：麻雀每兩分鐘就出現一次（比實際冷卻還密）、每次都留穗，走 30 小時的遊戲時鐘。 */
  const s = sparrowState(); const gifts = [];
  for (let t = T; t <= T + 30 * 3600000; t += 1000) {
    const u = W.update(s, t); if (u.gift) gifts.push(t);
    if ((t - T) % 120000 === 0) { sparrowAt(s, t); W.resolve(s, t, { choice: "share" }); }
  }
  assert.ok(gifts.filter((at) => at - T <= 600000).length <= 2, "前十分鐘最多兩包");
  for (const at of gifts) assert.ok(gifts.filter((x) => x > at - W.SPARROW_GIFT_DAY_MS && x <= at).length <= W.SPARROW_GIFT_DAY_CAP, "任何 24 小時內最多兩包");
  for (let i = 1; i < gifts.length; i++) assert.ok(gifts[i] - gifts[i - 1] >= W.SPARROW_GIFT_GAP_MS, "兩包之間至少隔五分鐘");
  assert.ok(gifts.length >= 3 && gifts.length <= 4, `30 小時大約三、四包：${gifts.length}`);
  assert.equal(s.coins, 50, "不給金幣"); assert.equal(Sun.sunlight(s), 1, "留穗不給陽光");
  /* 實際流程：新存檔等小麥長大的十分鐘，田邊小事照做、麻雀一律留穗；種子多的那幾包都來自麻雀，最多兩包。 */
  const g = fresh(); g.coins = 200; A.record(g, { type: "talk", npcId: "mayor" }, T); A.claim(g, "c1_homecoming", T); g.stats.plantCount = 9; g.flags.r79FirstLightHarvest = true; g.r75Sunplay.firstCaught = true;
  g.adventure.r58.r59.seedPacks.wheat = 0;
  for (let i = 0; i < Game.activePlotCount(g); i++) { Game.plant(g, i, "wheat", T); Game.waterPlot(g, i, T); }
  Object.assign(g.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: T + 3600000 });
  let busy = T, shares = 0, got = 0, giftSeeds = 0;
  for (let t = T; t <= T + 600000; t += 250) {
    const u = W.update(g, t); if (u.gift) { got++; giftSeeds += u.gift.seeds.wheat; }
    if (t < busy) continue;
    const step = A.nextFarmStep(g, t), v = W.view(g, t);
    if (step.action === "harvest" && Game.harvest(g, step.plotIndex, t, () => 1).ok) { busy = t + 1500; continue; }
    if (step.action === "plant" && Game.plant(g, step.plotIndex, "wheat", t).ok) { busy = t + 1500; continue; }
    if (step.action === "tend" && Game.waterPlot(g, step.plotIndex, t).ok) { busy = t + 1500; continue; }
    if (v) { W.claim(g, t); const r = W.resolve(g, t + 2000, v.id === "sparrow" ? { choice: "share" } : undefined); if (r.choice === "share") shares++; busy = t + 2000; }
  }
  assert.ok(shares >= 1, `十分鐘裡真的遇到麻雀並留穗 ${shares} 次`); assert.ok(got >= 1 && got <= 2, `叼回 ${got} 包`); assert.equal(giftSeeds, got);
  assert.equal(W.journalLines(g, 40).filter((line) => /叼來一顆小麥種子/.test(line)).length, got, "每一包都記進手札");
});

/* ---------- 第 4 項：接線 ---------- */
test("4a 接線：測試排進 unit 清單最後；頁面照舊載入小事", () => {
  const guard = read("scripts/guard-validation-writes.js"), list = guard.slice(guard.indexOf("const unit=["), guard.indexOf("];", guard.indexOf("const unit=[")));
  assert.match(list, /"node scripts\/test-content-r83-play\.js"/); assert.ok(list.indexOf("test-content-r83-play") > list.indexOf("test-content-r82-guidance-layout"));
  const html = read("index.html"); assert.match(html, /<script src="src\/waitplay-r82\.js\?v=[^"]+"><\/script>/);
  for (const c of W.CHORES) assert.ok(fs.existsSync(path.join(ROOT, c.art)), "現有素材 " + c.art);
});

/* ---------- 瀏覽器：四種畫面實拍檢查 ---------- */
const VIEWS = [[1366, 768, false], [390, 844, true]];
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
function serve() { return new Promise((resolve, reject) => { const server = http.createServer((req, res) => { const u = new URL(req.url, "http://127.0.0.1"), file = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))); if (path.relative(ROOT, file).startsWith("..") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(file).pipe(res); }); server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server)); }); }
async function launch(chromium) { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) { /* 換系統瀏覽器 */ } for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) { /* 下一個 */ } throw Error("No browser available"); }
/* 把一件小事擺到 W.pickTile 挑的格子上（跟遊戲同一條路），回傳量測結果。 */
const MEASURE = async (choreId) => {
  const s = __farm.state(), W = FarmWaitplay, now = Date.now(), st = W.normalize(s);
  const step = AdventureAPI.nextFarmStep(s, now), tile = W.pickTile(s, step, 0, now);
  st.active = { id: choreId, tileId: tile.id, startedAt: now, expiresAt: now + 600000, kind: "grow", claimedAt: 0, goneAt: 0 };
  await new Promise((r) => setTimeout(r, 800));
  const rect = (e) => { if (!e) return null; const z = e.getBoundingClientRect(); return { l: z.left, t: z.top, r: z.right, b: z.bottom, w: z.width, h: z.height }; };
  const ov = (a, b) => (a && b ? Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t)) : 0);
  const node = document.querySelector("#mapWorld .r83c-chore"), sprite = node && node.querySelector(".r83c-chore-sprite"), img = node && node.querySelector("img"), tag = node && node.querySelector(".r83c-chore-tag");
  const active = window.activePlotCount(s), plots = s.map.tiles.filter((t) => t.plotIndex != null && t.plotIndex < active).map((t) => rect(document.querySelector('.gtile[data-tile-id="' + t.id + '"]')));
  const nr = rect(node), sr = rect(sprite), tr = rect(document.querySelector('.gtile[data-tile-id="' + tile.id + '"]')), pr = rect(document.querySelector("#player .p-sprite") || document.getElementById("player"));
  const cs = node && getComputedStyle(node);
  /* 畫面上看得到的按鈕（地圖外的介面），中心點不能是小事。 */
  const buttons = [...document.querySelectorAll("button")].filter((b) => !b.closest("#mapWorld")).filter((b) => { const z = b.getBoundingClientRect(), c = getComputedStyle(b); return z.width > 4 && z.height > 4 && c.display !== "none" && c.visibility !== "hidden" && z.right > 0 && z.bottom > 0 && z.left < innerWidth && z.top < innerHeight; });
  const coveredButtons = buttons.filter((b) => { const z = b.getBoundingClientRect(), hit = document.elementFromPoint(z.left + z.width / 2, z.top + z.height / 2); return hit && hit.closest && hit.closest(".r83c-chore"); }).map((b) => b.textContent.trim());
  return { tile: tile.id, inWorld: !!node && node.parentElement && node.parentElement.id === "mapWorld", node: nr, sprite: sr, tileRect: tr, bg: cs && cs.backgroundColor, borderW: cs && cs.borderTopWidth, shadow: cs && cs.boxShadow,
    render: img && getComputedStyle(img).imageRendering, anim: sprite && getComputedStyle(sprite).animationName, tagShown: tag && getComputedStyle(tag).visibility === "visible",
    overPlayer: ov(sr, pr), nodeOverPlayer: ov(nr, pr), overPlots: plots.reduce((a, p) => a + ov(sr, p), 0), hitOverPlots: plots.reduce((a, p) => a + ov(nr, p), 0), coveredButtons, near: node && node.classList.contains("is-near") };
};
async function browserChecks() {
  let chromium; try { ({ chromium } = require("playwright")); } catch (_) { throw Error("playwright 不可用"); }
  const server = await serve(), origin = "http://127.0.0.1:" + server.address().port, browser = await launch(chromium); let checks = 0;
  try {
    for (const [width, height, mobile] of VIEWS) {
      const tag = width + "x" + height;
      for (const reduced of [false, true]) {
        const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", reducedMotion: reduced ? "reduce" : "no-preference" });
        const page = await context.newPage(), errors = []; page.on("pageerror", (e) => errors.push(String(e)));
        await page.goto(origin);
        await page.waitForFunction(() => window.__farm && window.AdventureAPI && window.FarmWaitplay && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
        await page.evaluate(() => document.querySelector("#worldSunBegin,#worldBegin")?.click()); await page.waitForTimeout(250);
        await page.evaluate(() => {
          document.querySelectorAll(".r76b-dialogue,.npc-bubble").forEach((n) => n.remove()); const d = document.querySelector("#worldDialogue"); if (d) d.hidden = true;
          const s = __farm.state(), now = Date.now(); s.coins = 50; s.stats.plantCount = 9; s.flags.r79FirstLightHarvest = true; s.r75Sunplay.firstCaught = true;
          for (const i of [0, 1]) { s.plots[i].cropId = "wheat"; s.plots[i].plantedAt = now; s.plots[i].wateredAt = now; }
          Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: now + 600000 });
          const p0 = s.map.tiles.find((t) => t.plotIndex === 0); s.player.tileId = p0.id; s.player.x = p0.x; s.player.y = p0.y;
          __farm.refresh(); __farm.focusTile(p0.id);
        });
        await page.waitForTimeout(500);
        for (const choreId of reduced ? ["sparrow"] : ["sparrow", "weed", "glean", "twig"]) {
          const m = await page.evaluate(MEASURE, choreId), t2 = `${tag}${reduced ? "・減少動態" : ""}・${choreId}`;
          assert.equal(m.inWorld, true, t2 + " 畫在地圖世界裡");
          assert.equal(m.bg, "rgba(0, 0, 0, 0)", t2 + " 沒有底色"); assert.equal(m.borderW, "0px", t2 + " 沒有框"); assert.equal(m.shadow, "none", t2 + " 沒有方塊陰影");
          assert.equal(m.render, "pixelated", t2 + " 像素圖不糊");
          assert.ok(m.node.w >= 44 && m.node.h >= 44, t2 + " 點擊範圍至少 44×44：" + JSON.stringify(m.node));
          assert.equal(m.overPlayer, 0, t2 + " 不壓角色：" + JSON.stringify(m)); assert.equal(m.overPlots, 0, t2 + " 圖不壓田"); assert.equal(m.hitOverPlots, 0, t2 + " 點擊範圍不壓田");
          assert.deepEqual(m.coveredButtons, [], t2 + " 不壓任何按鈕");
          const cx = m.sprite.l + m.sprite.w / 2, cy = m.sprite.t + m.sprite.h / 2;
          assert.ok(cx > m.tileRect.l && cx < m.tileRect.r && cy > m.tileRect.t && cy < m.tileRect.b, t2 + " 圖站在自己那一格上");
          assert.equal(m.tagShown, m.near, t2 + " 名牌只在角色靠近時出現（靠近：" + m.near + "）");
          const expectAnim = reduced ? "none" : { sparrow: "r83c-chore-hop", weed: "r83c-chore-sway", glean: "r83c-chore-sway", twig: "none" }[choreId];
          assert.equal(m.anim, expectAnim, t2 + " 動作");
          checks++;
        }
        if (!reduced) {
          /* 角色走遠：名牌收起；滑鼠停留或點選才出現。 */
          const far = await page.evaluate(async () => { const s = __farm.state(), far = s.map.tiles.find((t) => t.id === "t7_5") || s.map.tiles.find((t) => t.plotIndex == null && t.x > 6); s.player.tileId = far.id; s.player.x = far.x; s.player.y = far.y; await new Promise((r) => setTimeout(r, 450)); const tag = document.querySelector(".r83c-chore .r83c-chore-tag"); return getComputedStyle(tag).visibility; });
          assert.equal(far, "hidden", tag + " 角色走遠，名牌收起");
          /* 跟地圖一起縮放：切到整張地圖，小事仍站在自己那一格。 */
          const zoom = await page.evaluate(async () => { const before = document.querySelector(".gtile").style.width; document.getElementById("mapFitToggle").click(); await new Promise((r) => setTimeout(r, 700)); const node = document.querySelector("#mapWorld .r83c-chore"), sp = node.querySelector(".r83c-chore-sprite").getBoundingClientRect(), tile = document.querySelector('.gtile[data-tile-id="' + node.dataset.tileId + '"]').getBoundingClientRect(); const cx = sp.left + sp.width / 2, cy = sp.top + sp.height / 2, n = node.getBoundingClientRect(); const out = { before, after: document.querySelector(".gtile").style.width, inside: cx > tile.left && cx < tile.right && cy > tile.top && cy < tile.bottom, w: n.width, h: n.height }; document.getElementById("mapFitToggle").click(); await new Promise((r) => setTimeout(r, 500)); return out; });
          assert.notEqual(zoom.before, zoom.after, tag + " 切換了地圖大小"); assert.equal(zoom.inside, true, tag + " 縮放後小事仍在自己那一格：" + JSON.stringify(zoom)); assert.ok(zoom.w >= 44 && zoom.h >= 44, tag + " 縮小後點擊範圍仍至少 44");
          /* 麻雀二選一：小框兩顆鈕至少 44 高，不蓋角色、不蓋田；選留穗後手札多一行。 */
          await page.evaluate(async (fn) => { const s = __farm.state(), p0 = s.map.tiles.find((t) => t.plotIndex === 0); s.player.tileId = p0.id; s.player.x = p0.x; s.player.y = p0.y; __farm.refresh(); __farm.focusTile(p0.id); await new Promise((r) => setTimeout(r, 400)); }, null);
          await page.evaluate(MEASURE, "sparrow");
          await page.locator("#mapWorld .r83c-chore").click({ force: true });
          await page.waitForTimeout(350);
          const pop = await page.evaluate(() => { const p = document.querySelector("#mapWorld .r83c-chore-choice"), rect = (e) => { const z = e.getBoundingClientRect(); return { l: z.left, t: z.top, r: z.right, b: z.bottom }; }, ov = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t)); if (!p) return null; const s = __farm.state(), pr = rect(document.querySelector("#player .p-sprite") || document.getElementById("player")), plots = s.map.tiles.filter((t) => t.plotIndex != null && t.plotIndex < window.activePlotCount(s)).map((t) => rect(document.querySelector('.gtile[data-tile-id="' + t.id + '"]'))), r = rect(p); return { labels: [...p.querySelectorAll("button")].map((b) => b.querySelector("span").textContent.trim()), heights: [...p.querySelectorAll("button")].map((b) => b.getBoundingClientRect().height), overPlayer: ov(r, pr), overPlots: plots.reduce((a, q) => a + ov(r, q), 0), inView: r.l >= 0 && r.t >= 0 && r.r <= innerWidth && r.b <= innerHeight }; });
          assert.ok(pop, tag + " 點麻雀出現二選一");
          assert.deepEqual(pop.labels, ["趕走", "留一把穗給牠"]); assert.ok(pop.heights.every((h) => h >= 44), tag + " 兩顆鈕至少 44 高");
          assert.equal(pop.overPlayer, 0, tag + " 小框不蓋角色"); assert.equal(pop.overPlots, 0, tag + " 小框不蓋田"); assert.equal(pop.inView, true, tag + " 小框在畫面內");
          await page.locator('[data-r83c-choice="share"]').click();
          await page.waitForFunction(() => FarmWaitplay.journalLines(__farm.state(), 3).length > 0, null, { timeout: 8000 });
          await page.evaluate(() => FarmWorld.openPanel("story")); await page.waitForTimeout(400);
          const log = await page.evaluate(() => { const c = document.querySelector("#adventurePanel [data-r83c-chore-log]"); return c ? c.textContent : ""; });
          assert.match(log, /田邊小事：留了一把穗給麻雀/, tag + " 手札多一行");
          await page.evaluate(() => document.querySelector(".side-panel")?.classList.remove("world-panel-open"));
          /* 第 1 項：教等光時頂部陽光籤不提手鏡；光快落在乾的那格，田上標籤寫「在光裡澆水」。 */
          const sun = await page.evaluate(async () => {
            const s = __farm.state(), now = Date.now(); s.flags.r79FirstLightHarvest = false; s.stats.harvested = {}; delete s.flags.r79WaitHarvest;
            s.plots[0].plantedAt = now - 3600000; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: now + 9000, nextAt: now + 9000, refractions: 0 });
            __farm.refresh(); await new Promise((r) => setTimeout(r, 900)); const chip = document.getElementById("sunChip"); const waitChip = chip && !chip.hidden ? chip.textContent : "";
            s.plots[1].plantedAt = now; delete s.plots[1].wateredAt; Object.assign(s.sun, { previewPlots: [1], previewAt: now + 9000, nextAt: now + 9000 });
            const tile = s.map.tiles.find((t) => t.plotIndex === 1); __farm.cancelJourney(); __farm.setTool("water"); __farm.clickTile(tile.id); __farm.cancelJourney(); await new Promise((r) => setTimeout(r, 500));
            const label = document.querySelector('[data-audit="tile-state-label"]');
            return { waitChip, label: label && !label.hidden ? label.textContent.trim() : "" };
          });
          assert.match(sun.waitChip, /光快落下/, tag + " 頂部籤在預告"); assert.doesNotMatch(sun.waitChip, /手鏡/, tag + " 教等光時不提手鏡：" + sun.waitChip);
          assert.match(sun.label, /^在光裡澆水・小麥/, tag + " 田上標籤用同一種說法：" + sun.label);
          checks++;
        }
        assert.deepEqual(errors, [], tag + " 沒有頁面錯誤");
        await context.close();
      }
    }
  } finally { await browser.close(); server.close(); }
  return checks;
}

(async () => {
  for (const [name, fn] of pending) { try { await fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
  try { const checks = await browserChecks(); passed++; console.log(`PASS 2c 實拍 ${VIEWS.map((v) => v[0] + "×" + v[1]).join("、")}（含減少動態）：小事是地上的東西，不壓角色、田與按鈕，名牌靠近才出現，跟地圖一起縮放；麻雀二選一與手札（${checks} 項）`); }
  catch (error) { console.error("FAIL 2c 實拍\n" + error.stack); process.exitCode = 1; }
  if (!process.exitCode) console.log(`R83C play: ${passed} passed`);
})();
