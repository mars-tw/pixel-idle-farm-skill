"use strict";
/* R83B：兩條舊麥種路線看得到成果。
   種植線：名牌與外觀都跟著 r82PlantStatus 的同一個階段換（等你播種／剛種下／照過 1 次光／可以收成／已收成），成熟時 64px 縮圖分得出來；
   收成與交單由老農班伯本人回話（帶頭像），專屬訂單以老農班伯具名。
   封存線：三樣鎮誌舊物是至少跟藍布舊麥種包一樣大的地圖物件，名牌「鎮誌 N／3」，避開市集攤、鄰居站位與其他名牌，鏡頭帶過去時整個在畫面內；
   回憶由鎮長葛瑞本人帶頭像說，旁白只補動作。
   版面在 1366×768、390×844、844×390 實際開瀏覽器量。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
global.window = global;
const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const A = require("../src/adventure.js");
const State = require("../src/state.js");
const H = require("../src/heirloom.js");
const M = require("../src/midgame-r66.js");
const K = require("../src/cooking-r75.js");
const R = require("../src/story-r76.js");
const Q = require("../src/choices-r77.js");
Q.install();

const T0 = Date.parse("2026-11-09T08:00:00Z"), DAY = 86400000;
let passed = 0;
const pending = [];
function test(name, fn) {
  const done = () => { passed++; console.log("PASS " + name); };
  const fail = (error) => { console.error("FAIL " + name + "\n" + (error && error.stack || error)); process.exitCode = 1; };
  try { const r = fn(); if (r && typeof r.then === "function") pending.push(r.then(done, fail)); else done(); }
  catch (error) { fail(error); }
}
function fresh(now) { const s = State.defaultState(now); A.ensure(s, now); M.ensure(s, now); K.ensure(s, now); return s; }
function finishR81(choice, now) {
  const s = fresh(now);
  s.heirloom.sunWheat = 2; s.storage.items.wheat = 4;
  assert.equal(H.deliver(s, "table", now).ok, true);
  assert.equal(R.r81Choose(s, choice, now + 1000).ok, true);
  s.storage.items.wheat = 2;
  assert.equal(R.r81Deliver(s, now + 2000).ok, true);
  assert.equal(R.r81SceneSeen(s, now + 3000), true);
  return s;
}
function shine(state, now) {
  state.sun = { plots: [R.R82_BLUE_LIGHT_PLOT], startsAt: now - 1000, endsAt: now + 10000, nextAt: 0, used: [], introduced: true };
}
function plantRow(state) { return R.r81SceneRows(state).find((row) => row.r82bKind === "plant"); }
/* 鄰居親口說的話：不講數字、份數、金幣、陽光點數這類規則字。 */
const RULE_WORDS = /\d|份|金|陽光點數|秒|遊戲日|每天|獎勵|報酬|解鎖/;

test("第 1 項：名牌、正式圖與成熟效果都由 r82PlantStatus 的同一個階段決定，五個階段的名牌與外觀都不同", () => {
  const s = finishR81("plant", T0);
  const seen = [];
  const check = (now, stage, label, art) => {
    const view = R.r82PlantPresentation(s, now), row = plantRow(s);
    assert.equal(view.stageKey, stage);
    assert.deepEqual([row.label, row.r82bStage, row.marker.art, row.marker.displaySize], [label, stage, art, 64], stage + " 地圖物件跟畫面資料一致");
    assert.equal(row.label, view.label, "名牌直接用畫面資料的那一句，不另寫一套");
    seen.push([stage, label, art]);
  };
  check(T0 + 4000, "empty", "藍布老麥田・等你播種", R.r85FieldArt("seedbag")); /* R85C 同步：等你播種改畫「翻好的土上放著藍布種子包」的 2×2 田圖（content-r85），跟其他階段同一套畫法；原為 R.r81Art("pending") 單獨一包種子 */
  assert.equal(R.r82Plant(s, T0 + 5000).ok, true);
  check(T0 + 5001, "planted", "藍布老麥田・剛種下", R.r82Art("cropSprout"));
  shine(s, T0 + 6000); assert.equal(R.r82CatchLight(s, T0 + 6000).ok, true);
  check(T0 + 6001, "one-light", "藍布老麥田・照過 1 次光", R.r82Art("cropOneLight"));
  shine(s, T0 + DAY + 6000); assert.equal(R.r82CatchLight(s, T0 + DAY + 6000).ok, true);
  check(T0 + DAY + 6001, "ripe", "藍布老麥田・可以收成", R.r82Art("cropRipe"));
  assert.equal(R.r82HarvestBlueWheat(s, T0 + DAY + 7000).ok, true);
  check(T0 + DAY + 7001, "harvested", "藍布老麥田・已收成", R.r82Art("cropHarvested"));
  assert.equal(R.r82DeliverBlueOrder(s, T0 + DAY + 8000).ok, true);
  check(T0 + DAY + 8001, "harvested", "藍布老麥田・已收成", R.r82Art("cropHarvested"));
  assert.equal(new Set(seen.map((r) => r[1])).size, 5, "五種名牌");
  assert.equal(new Set(seen.map((r) => r[2])).size, 5, "五種外觀（還沒播種畫種子包，不借用長滿麥穗的田圖）");

  /* 名牌不再一直寫舊的那一句；外觀與名牌只走 r82PlantPresentation → r82PlantStatus 這一條。 */
  const story = read("src/story-r76.js");
  assert.doesNotMatch(story, /葛瑞明天來翻土/);
  const fnPresent = (story.match(/function r82PlantPresentation[\s\S]*?\n  \}/) || [""])[0];
  assert.match(fnPresent, /const status = r82PlantStatus\(state, now\)/);
  assert.doesNotMatch(fnPresent, /lightDays\.length|plantedAt|harvestedAt/, "不另外讀存檔算進度");
  const rows = (story.match(/function r81SceneRows[\s\S]*?\n  \}/) || [""])[0];
  assert.match(rows, /label: plantView \? plantView\.label/);
  assert.match(rows, /art: plantView \? plantView\.art/);
  assert.match(rows, /r82bStage: plantView \? plantView\.stageKey/);

  const css = read("src/content-r58b.css"), renderer = read("src/choices-r77.js");
  assert.match(renderer, /if \(row\.r82bStage\) node\.dataset\.r82bStage = row\.r82bStage;/);
  assert.match(renderer, /row\.r82bStage \|\| ""/, "階段換了就重畫物件");
  const block = (css.match(/R83B：兩條舊麥種路線的階段成果[\s\S]*R83B 結束/) || [""])[0];
  assert.match(block, /data-r82b-stage="ripe"\] \{[^}]*scale\(1\.18\)[^}]*radial-gradient/, "成熟：略放大＋金色光暈");
  assert.match(block, /data-r82b-stage="ripe"\] img \{[^}]*drop-shadow\(0 0 6px #ffcf33\)/, "成熟：沿著麥穗的發光外框");
  assert.match(block, /data-r82b-stage="ripe"\]::after \{[\s\S]*?radial-gradient[\s\S]*?animation: r83b-ripe-glint/, "成熟：會閃的光點");
  assert.match(block, /prefers-reduced-motion: reduce/);
});

test("第 2 項：收成與交單是老農班伯本人帶頭像回一句，規則句改成提示；專屬訂單以老農班伯具名", () => {
  const s = finishR81("plant", T0);
  R.r82Plant(s, T0 + 5000);
  shine(s, T0 + 6000); R.r82CatchLight(s, T0 + 6000);
  shine(s, T0 + DAY + 6000); R.r82CatchLight(s, T0 + DAY + 6000);
  const harvested = R.r82HarvestBlueWheat(s, T0 + DAY + 7000);
  assert.equal(harvested.ok, true);
  assert.equal(R.R81_OPTIONS.plant.side, "elder", "種回田裡是老農班伯那一邊");
  assert.equal(harvested.speakerLine.by, "elder");
  assert.doesNotMatch(harvested.speakerLine.text, RULE_WORDS, "老農班伯只講心情：" + harvested.speakerLine.text);
  assert.match(harvested.message, /專屬訂單「班伯的第一穗留種單」/, "規則句留在提示訊息");
  assert.equal(R.R82_BLUE_ORDER.name, "班伯的第一穗留種單");
  assert.equal(R.R82_BLUE_ORDER.side, "elder");
  assert.notEqual(R.R82_BLUE_ORDER.name, R.R81_OPTIONS.plant.order.name, "跟 R81 那張老農班伯的訂單分得開");
  assert.equal(R.r82BlueOrder(s).name, "班伯的第一穗留種單");
  assert.match(R.r82Today(s, T0 + DAY + 7500).title, /班伯的第一穗留種單/, "手札寫同一個名字");
  const delivered = R.r82DeliverBlueOrder(s, T0 + DAY + 8000);
  assert.equal(delivered.ok, true);
  assert.equal(delivered.speakerLine.by, "elder");
  assert.doesNotMatch(delivered.speakerLine.text, RULE_WORDS);
  assert.match(delivered.message, /\d+ 金/);
  assert.equal(R.PORTRAITS.elder, "assets/generated/content-r76/portrait-elder.png");
  assert.ok(fs.existsSync(path.join(ROOT, R.PORTRAITS.elder)));

  const story = read("src/story-r76.js"), marker = (story.match(/function openR82PlantMarker[\s\S]*?\n  \}/) || [""])[0];
  assert.match(marker, /if \(result\.ok && result\.speakerLine\) note = result\.message;/);
  assert.match(marker, /onClose: \(\) => \{ if \(note\) toast81\(note\); \}/, "規則句等對話框關掉再出提示，不被對話框蓋住");
  assert.match(marker, /showReply\(r83ResultLine\(result\)\)/, "沒有鄰居台詞的結果用旁白，不掛在老農班伯頭像底下");
  assert.doesNotMatch(marker, /鎮誌登記單/, "種植線交單畫面不再提鎮誌登記單");
  assert.match(story, /function r83ResultLine\(result\) \{ return result && result\.ok && result\.speakerLine \? result\.speakerLine : \{ by: "", text: \(result && result\.message\) \|\| "" \}; \}/);
});

test("第 3 項：三樣鎮誌舊物各在一格空草地、名牌「鎮誌 N／3」不撞號，回憶由鎮長葛瑞帶頭像先開口", () => {
  const s = finishR81("seal", T0);
  const map = State.defaultState(T0).map, tileAt = (x, y) => map.tiles.find((t) => t.x === x && t.y === y);
  const npcTiles = map.tiles.filter((t) => t.npc), avoid = map.tiles.filter((t) => t.structureId === "shop" || t.station === "order_board");
  const spawn = State.defaultState(T0).player;
  for (const relic of R.R82_RELICS) {
    const m = /^tile:(\d+),(\d+)$/.exec(relic.anchor);
    assert.ok(m, relic.name + " 指定一格");
    const t = tileAt(Number(m[1]), Number(m[2]));
    assert.ok(t && t.terrain === "grass" && !t.station && !t.structureId && !t.npc && !t.object && !t.blocked, relic.name + " 在空草地上 " + JSON.stringify(t));
    for (const n of npcTiles) assert.ok(Math.max(Math.abs(n.x - t.x), Math.abs(n.y - t.y)) >= 2, relic.name + " 離 " + n.npc + " 的站位至少兩格");
    for (const n of avoid) assert.ok(Math.max(Math.abs(n.x - t.x), Math.abs(n.y - t.y)) >= 3, relic.name + " 離市集攤與訂單看板至少三格");
    assert.ok(Math.max(Math.abs(spawn.x - t.x), Math.abs(spawn.y - t.y)) >= 2, relic.name + " 不放在玩家起點旁");
  }
  assert.equal(new Set(R.R82_RELICS.map((r) => r.anchor)).size, 3, "三件不共用位置");

  /* 支線第一天開始後隔了好幾天才回來，三件同時出現：名牌各自編號，不會三塊都寫 1／3。 */
  assert.equal(R.r82SealStatus(s, T0 + 4000).startDay, "2026-11-09");
  const all =R.r82SceneRows(s, T0 + 3 * DAY).filter((row) => row.r82bKind === "relic");
  assert.deepEqual(all.map((row) => row.label), ["鎮誌 1／3", "鎮誌 2／3", "鎮誌 3／3"]);
  assert.deepEqual(all.map((row) => row.hint), ["鎮誌 1／3・舊種子籤", "鎮誌 2／3・褪色照片", "鎮誌 3／3・帳本一頁"], "舊物名字放在點下去的提示");
  for (const row of all) assert.equal(row.marker.displaySize, 64, "64px，比藍布舊麥種包（最多 48px）大");
  assert.deepEqual(all.map((row) => row.marker.anchor), R.R82_RELICS.map((r) => r.anchor), "沒被占用時就在指定的那一格");
  /* 玩家在那一格蓋了東西：舊物改放最近的一格空草地，不壓建築、不踩路，也不跟另一件同格。 */
  const blocked = s.map.tiles.find((t) => "tile:" + t.x + "," + t.y === R.R82_RELICS[0].anchor);
  blocked.buildingId = "b_test_1";
  const moved = R.r82SceneRows(s, T0 + 3 * DAY).filter((row) => row.r82bKind === "relic");
  const mt = /^tile:(\d+),(\d+)$/.exec(moved[0].marker.anchor), nt = s.map.tiles.find((t) => t.x === Number(mt[1]) && t.y === Number(mt[2]));
  assert.notEqual(moved[0].marker.anchor, R.R82_RELICS[0].anchor);
  assert.ok(nt.terrain === "grass" && !nt.buildingId && !nt.station && !nt.structureId && !nt.npc && !nt.object && !nt.forage, "改放的那一格是空草地 " + JSON.stringify(nt));
  assert.ok(Math.max(Math.abs(nt.x - blocked.x), Math.abs(nt.y - blocked.y)) <= 1, "就在原本那一格旁邊");
  assert.equal(new Set(moved.map((row) => row.marker.anchor)).size, 3, "三件仍各占一格");
  delete blocked.buildingId;

  const s2 = finishR81("seal", T0);
  for (let i = 0; i < R.R82_RELICS.length; i++) {
    const now = T0 + i * DAY + 5000, relic = R.R82_RELICS[i];
    const row = R.r82SceneRows(s2, now).find((item) => item.r82bKind === "relic");
    assert.equal(row.relicId, relic.id);
    assert.equal(row.label, "鎮誌 " + (i + 1) + "／3");
    assert.match(R.r82Today(s2, now).line, new RegExp("「鎮誌 " + (i + 1) + "／3」是" + relic.name), "手札跟名牌同一個編號");
    assert.equal(relic.memory[0].by, "mayor", relic.name + "由鎮長葛瑞先開口，不先跳旁白");
    assert.ok(relic.memory.filter((line) => line.by === "mayor").length >= 2);
    assert.ok(relic.memory.filter((line) => line.by === "").length <= 1, "旁白只補充動作");
    for (const line of relic.memory) if (line.by === "mayor") assert.doesNotMatch(line.text, RULE_WORDS);
    assert.equal(R.r82FindRelic(s2, relic.id, now).ok, true);
  }
  assert.equal(R.PORTRAITS.mayor, "assets/generated/content-r77/portrait-mayor.png");
  assert.ok(fs.existsSync(path.join(ROOT, R.PORTRAITS.mayor)));
  const story = read("src/story-r76.js"), choices = read("src/choices-r77.js");
  assert.match(story, /openDialogue\(s, "mayor", result\.memory, \{ speaker: speakerOf81\("mayor"\)/);
  assert.match(story, /onRender: \(overlay\) => addR83RelicIcon\(overlay, relic\.artKey, relic\.name\)/, "回憶時旁邊擺著那件舊物的正式圖");
  assert.match(story, /if \(kind === "tile"\)/, "走過去用同一個格子");
  assert.match(choices, /if \(kind === "tile"\)/, "地圖物件畫在同一個格子");
});

test("第 4 項：二選一只講地圖新增物與之後能做的事；兩條路線上鄰居親口說的話沒有規則數字", () => {
  const source = read("src/story-r76.js");
  const block = (source.match(/function openR81Conflict[\s\S]*?const choiceOptions = \[([\s\S]*?)\n    \];/) || ["", ""])[1];
  assert.ok(block);
  assert.equal((block.match(/immediate: "地圖上：/g) || []).length, 2);
  assert.equal((block.match(/longTerm: "之後可/g) || []).length, 2);
  const visible = [...block.matchAll(/(?:label|immediate|longTerm): "([^"]*)"/g)].map((match) => match[1]).join("\n");
  assert.doesNotMatch(visible, /\d|金|陽光點數|獎勵|拿到|份/);
  for (const key of ["plant", "seal"]) assert.doesNotMatch(R.R81_OPTIONS[key].label, /\d|金/);
  /* 檢查有沒有漏的：兩條路線上所有鄰居台詞（選邊後的回話、交單前的那一句、收尾、之後的招呼、R82／R83 新台詞）。 */
  const lines = [];
  for (const opt of Object.values(R.R81_OPTIONS)) [opt.reply, opt.order.line, opt.after].concat(opt.scene).forEach((l) => lines.push(l));
  for (const relic of R.R82_RELICS) relic.memory.forEach((l) => lines.push(l));
  const s = finishR81("plant", T0); R.r82Plant(s, T0 + 5000); shine(s, T0 + 6000); R.r82CatchLight(s, T0 + 6000); shine(s, T0 + DAY + 6000); R.r82CatchLight(s, T0 + DAY + 6000);
  lines.push(R.r82HarvestBlueWheat(s, T0 + DAY + 7000).speakerLine, R.r82DeliverBlueOrder(s, T0 + DAY + 8000).speakerLine);
  const fixed = [...source.matchAll(/\{ by: "(?:mayor|elder)", text: "([^"]+)" \}/g)].map((m) => m[1]);
  assert.ok(fixed.length >= 20);
  for (const line of lines) if (line && line.by) assert.doesNotMatch(line.text, RULE_WORDS, "鄰居台詞不講規則：" + line.text);
  for (const text of fixed) assert.doesNotMatch(text, RULE_WORDS, "鄰居台詞不講規則：" + text);
  /* R81 交單不夠時的「還差幾份」也改用旁白，不掛在鄰居頭像底下。 */
  assert.match(source, /const r = r81Deliver\(state, Date\.now\(\)\); if \(!r\.ok\) \{ showReply\(r83ResultLine\(r\)\); return; \}/);
});

test("第 5 項：R83B 樣式接在 R82A 後面；測試接在 unit 清單；沿用的正式圖都在", () => {
  const css = read("src/content-r58b.css");
  assert.ok(css.indexOf("/* ===== R82A 結束 ===== */") < css.indexOf("/* ===== R83B：兩條舊麥種路線的階段成果 ===== */"), "R83B 追加在 R82A 之後");
  assert.match(css, /\/\* ===== R83B：兩條舊麥種路線的階段成果 ===== \*\/[\s\S]*\/\* ===== R83B 結束 ===== \*\//);
  assert.match(css.trimEnd(), /\/\* ===== R8[34][ABC] 結束 ===== \*\/$/, "檔尾是 R83 的段落"); /* R84A 同步：R84 各線的新樣式依規定接在 R83 後面，檔尾可以是 R84 的段落 */
  assert.match(css.trimEnd(), /\/\* ===== R8[34][ABC] 結束 ===== \*\/$/, "檔尾是 R83 的段落"); /* R84 同步：R84 的樣式照規定追加在檔尾 */
  assert.match(css.trimEnd(), /\/\* ===== R8[34][ABC] 結束 ===== \*\/$/, "檔尾是 R83 的段落（R84B 同步：R84 各線依規定接在檔尾）");
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
  for (const key of ["cropSprout", "cropOneLight", "cropRipe", "cropHarvested", "oldSeedTag", "fadedPhoto", "ledgerPage", "townJournalDecoration"]) {
    assert.ok(R.R82_ART_READY.includes(key) && fs.existsSync(path.join(ROOT, R.R82_ART[key])), key + " 沿用的 R82 正式圖存在");
  }
  assert.ok(fs.existsSync(path.join(ROOT, R.r81Art("pending"))), "還沒播種時的種子包正式圖存在");
  const guard = read("scripts/guard-validation-writes.js");
  assert.match(guard, /"node scripts\/test-content-r82-guidance-layout\.js",(\s*"node scripts\/test-content-r83-[a-z-]+\.js",)*\s*"node scripts\/test-content-r83-branches\.js",(\s*"node scripts\/test-content-r83-[a-z-]+\.js",)*(\s*"node scripts\/test-content-r84-[a-z-]+\.js",)*\s*\];/); /* R84A 同步：R84 的新測試依規定接在清單尾 */
  assert.match(guard, /"node scripts\/test-content-r82-guidance-layout\.js",(\s*"node scripts\/test-content-r83-[a-z-]+\.js",)*\s*"node scripts\/test-content-r83-branches\.js",(\s*"node scripts\/test-content-r8[34]-[a-z-]+\.js",)*\s*\];/); /* R84 同步：R84 的測試照規定排在清單最後 */
  assert.match(guard, /"node scripts\/test-content-r82-guidance-layout\.js",(\s*"node scripts\/test-content-r83-[a-z-]+\.js",)*\s*"node scripts\/test-content-r83-branches\.js",(\s*"node scripts\/test-content-r8[34]-[a-z-]+\.js",)*\s*\];/); /* R84B 同步：R84 的新測試依規定接在清單尾（原為只容許 r83） */
  assert.match(read("sw.js"), /CACHE_VERSION = "content-r84-20261117-1"/, "版本字串沒動");
});

/* ---------- 版面：實際開瀏覽器量 ---------- */
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
function serve() { return new Promise((resolve, reject) => { const server = http.createServer((req, res) => { const u = new URL(req.url, "http://127.0.0.1"), file = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))); if (path.relative(ROOT, file).startsWith("..") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(file).pipe(res); }); server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server)); }); }
async function launch(chromium) { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("No browser available"); }

/* 在頁面裡設好某條路線、某個階段（或封存線三件同時出現），重畫場景物件並把彈窗關掉。 */
async function setRoute(page, route, stage) {
  await page.evaluate(([route, stage]) => {
    const s = __farm.state(), now = Date.now(), DAY = 86400000, day = (t) => new Date(t).toISOString().slice(0, 10);
    s.heirloom.started = true; s.heirloom.sunWheat = 2; s.storage.items.wheat = 2;
    if (!s.heirloom.delivered) FarmHeirloom.deliver(s, "table", now - 3 * DAY);
    s.r81story = { choice: route, choiceAt: now - 3 * DAY, shownAt: now - 3 * DAY, orderAt: now - 3 * DAY + 1, sceneAt: now - 3 * DAY + 2 };
    const plant = route !== "plant" || stage === "empty" ? {} : { plantedAt: now - 2 * DAY, lightDays: stage === "planted" ? [] : stage === "one-light" ? [day(now - DAY)] : [day(now - 2 * DAY), day(now - DAY)], harvestedAt: stage === "harvested" ? now - 1000 : 0, stock: stage === "harvested" ? 1 : 0 };
    s.r82branches = { route, plant, seal: route === "seal" ? { startDay: day(now - 2 * DAY), found: {} } : {} };
    __farm.refresh();
    document.querySelectorAll(".r76b-dialogue,.npc-bubble").forEach((n) => n.remove());
    for (const id of ["dailyModal", "worldModal", "settingsModal"]) document.getElementById(id)?.classList.remove("show");
    document.querySelector(".side-panel")?.classList.remove("world-panel-open");
    ChoicesR77.paintScenes(s);
  }, [route, stage]);
}
async function focusOn(page, selector, anchor) {
  /* 鏡頭帶到那一格（跟走過去時鏡頭跟著玩家一樣，物件會在畫面中央附近）。剛改完存檔時遊戲自己可能再移一次鏡頭，
     所以等鏡頭停下來後確認物件真的在中央附近，不是就再帶一次，最多三次。 */
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate((anchor) => {
      const s = __farm.state(), [kind, id] = anchor.split(":");
      const xy = kind === "tile" ? id.split(",").map(Number) : null;
      const t = kind === "tile" ? s.map.tiles.find((t) => t.x === xy[0] && t.y === xy[1]) : s.map.tiles.find((t) => t.station === id);
      __farm.focusTile(t.id);
    }, anchor);
    let last = "", centered = false;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(150);
      const pos = await page.evaluate((sel) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r ? [Math.round(r.left), Math.round(r.top), Math.abs(r.left + r.width / 2 - innerWidth / 2) <= innerWidth * .2 && Math.abs(r.top + r.height / 2 - innerHeight / 2) <= innerHeight * .2].join(",") : ""; }, selector);
      if (pos && pos === last) { centered = pos.endsWith("true"); break; }
      last = pos;
    }
    if (centered) return;
  }
}
/* 物件與名牌：整個在畫面內、最上面點得到的是自己（沒被介面蓋住）、名牌不壓其他名牌、物件不壓鄰居與市集攤。 */
async function measureMarker(page, route) {
  return page.evaluate((route) => {
    const node = document.querySelector('.r78c-scene-change[data-r78c-route="' + route + '"]'), tag = document.querySelector('.r78c-scene-label[data-r78c-route="' + route + '"]');
    if (!node || !tag) return null;
    const r = node.getBoundingClientRect(), l = tag.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
    const inside = (b) => b.left >= 0 && b.top >= 0 && b.right <= vw && b.bottom <= vh;
    const hit = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    /* 名牌本身不接點擊（pointer-events: none），量的時候暫時打開，量完還原。 */
    const topAt = (x, y, own) => { const prev = own.style.pointerEvents; own.style.pointerEvents = "auto"; const e = document.elementFromPoint(x, y); own.style.pointerEvents = prev; return e && own.contains(e) ? "" : (e ? (e.id || e.className || e.tagName) + "" : "none"); };
    const visible = (n) => n.getClientRects().length && getComputedStyle(n).visibility !== "hidden" && getComputedStyle(n).display !== "none";
    const labels = [...document.querySelectorAll("#mapWorld .r78c-scene-label, #mapWorld .npc-footname, #mapWorld .npc-nameplate, #mapWorld .world-site-label, #mapWorld [class*=map-node] span, #markerLayer .npc-nameplate")].filter((n) => n !== tag && visible(n));
    const blockers = [...document.querySelectorAll('#mapWorld .ob[data-kind="npc"], #mapWorld .ob[data-structure-id="shop"], #mapWorld .ob[data-station="order_board"], #mapWorld .r78c-scene-change')].filter((n) => n !== node && visible(n));
    const pouchPx = Math.max(32, Math.min(48, Math.round(Math.round(document.getElementById("mapWorld").offsetWidth / __farm.state().map.width) * .64)));
    return { w: parseFloat(node.style.width), pouchPx, inside: inside(r) && inside(l), coveredBy: [topAt(r.left + r.width / 2, r.top + r.height * .6, node), topAt(l.left + l.width / 2, l.top + l.height / 2, tag)].filter(Boolean),
      labelHits: labels.filter((n) => hit(l, n.getBoundingClientRect())).map((n) => n.className + ":" + n.textContent.trim()),
      markerHits: blockers.filter((n) => hit(r, n.getBoundingClientRect())).map((n) => n.className + ":" + (n.dataset.npc || n.dataset.r78cRoute || n.dataset.structureId || n.dataset.station || "")),
      label: tag.textContent, stage: node.dataset.r82bStage || "", box: [r.left, r.top, r.width, r.height].map(Math.round) };
  }, route);
}
/* 把物件附近截下來縮成 64×64，算金黃色亮點比例與兩張縮圖的平均差。 */
async function thumb64(page, route) {
  const box = await page.evaluate((route) => { const r = document.querySelector('.r78c-scene-change[data-r78c-route="' + route + '"]').getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2, h = Math.max(r.width, r.height) * .75; return { x: Math.max(0, cx - h), y: Math.max(0, cy - h), width: h * 2, height: h * 2 }; }, route);
  const png = await page.screenshot({ clip: box });
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, 64, 64);
    return Array.from(g.getImageData(0, 0, 64, 64).data);
  }, png.toString("base64"));
}
const warmRatio = (px) => { let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] > 200 && px[i + 1] > 160 && px[i + 2] < 150 && px[i] - px[i + 2] > 80) n++; return n / (px.length / 4); };
const meanDiff = (a, b) => { let d = 0, n = 0; for (let i = 0; i < a.length; i += 4) { d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); n += 3; } return d / n; };

test("第 1～3 項版面：三種尺寸實際量麥田階段、64px 縮圖、班伯與葛瑞帶頭像的對話、三件舊物的位置", async () => {
  const { chromium } = require("playwright");
  const server = await serve(), origin = "http://127.0.0.1:" + server.address().port, browser = await launch(chromium);
  try {
    for (const [w, h, mobile] of [[1366, 768, false], [390, 844, true], [844, 390, true]]) {
      const tag = w + "x" + h;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", reducedMotion: "reduce" }), page = await ctx.newPage(), errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(origin);
      await page.waitForFunction(() => window.__farm && window.ChoicesR77 && window.StoryR76 && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
      await page.evaluate(() => { const b = document.querySelector("#worldSunBegin, #worldBegin"); if (b && b.offsetParent) b.click(); });
      await page.waitForTimeout(400);

      /* 種植線：五個階段的名牌跟著換，物件與名牌在畫面內、不被蓋、不壓別的名牌。 */
      const thumbs = {};
      for (const stage of ["empty", "planted", "one-light", "ripe", "harvested"]) {
        await setRoute(page, "plant", stage);
        await focusOn(page, '.r78c-scene-change[data-r78c-route="r81c_story:plant"]', "station:well");
        const m = await measureMarker(page, "r81c_story:plant");
        const expected = await page.evaluate(() => StoryR76.r82PlantPresentation(__farm.state(), Date.now()).label);
        assert.ok(m, tag + " " + stage + " 有麥田物件");
        assert.equal(m.stage, stage, tag + " 物件階段");
        assert.equal(m.label, expected, tag + " " + stage + " 名牌跟同一份畫面資料");
        assert.equal(m.inside, true, tag + " " + stage + " 物件與名牌在畫面內 " + JSON.stringify(m));
        assert.deepEqual(m.coveredBy, [], tag + " " + stage + " 物件與名牌沒被介面蓋住 " + JSON.stringify(m));
        assert.deepEqual(m.labelHits, [], tag + " " + stage + " 名牌不壓其他名牌");
        if (stage === "one-light" || stage === "ripe" || stage === "planted") thumbs[stage] = await thumb64(page, "r81c_story:plant");
      }
      const warm = { oneLight: warmRatio(thumbs["one-light"]), ripe: warmRatio(thumbs.ripe) };
      const diff = meanDiff(thumbs["one-light"], thumbs.ripe);
      assert.ok(warm.ripe >= 0.05 && warm.ripe >= warm.oneLight * 2, tag + " 64px 縮圖：成熟的金黃亮點明顯比照過 1 次光多 " + JSON.stringify(warm));
      assert.ok(diff >= 15, tag + " 64px 縮圖：照過 1 次光與成熟的平均差夠大 " + diff.toFixed(1));
      assert.ok(meanDiff(thumbs.planted, thumbs.ripe) >= 15, tag + " 64px 縮圖：剛種下與成熟分得出");

      /* 收成：老農班伯帶頭像回一句，規則句改成提示。 */
      await setRoute(page, "plant", "ripe");
      await page.evaluate(() => StoryR76.openR82PlantMarker(__farm.state()));
      await page.locator('.r76b-dialogue [data-r76b-choice="harvest"]').click();
      const reply = await page.evaluate(() => {
        const head = document.querySelector(".r76b-dialogue .r76b-dialogue-head"), img = head && head.querySelector("img.r76b-portrait"), card = document.querySelector(".r76b-dialogue-card").getBoundingClientRect();
        return { who: head && head.querySelector("b").textContent, portrait: img ? img.getAttribute("src") : "", line: document.querySelector(".r76b-dialogue-line").textContent,
          cardInside: card.left >= 0 && card.top >= 0 && card.right <= innerWidth && card.bottom <= innerHeight };
      });
      await page.waitForFunction(() => document.querySelector(".r76b-dialogue img.r76b-portrait")?.naturalWidth > 0, null, { timeout: 5000 }).catch(() => {});
      const loaded = await page.evaluate(() => document.querySelector(".r76b-dialogue img.r76b-portrait")?.naturalWidth > 0);
      await page.locator(".r76b-dialogue [data-r76b-next]").click();
      const toastSeen = await page.waitForFunction(() => /班伯的第一穗留種單/.test(document.getElementById("toast-zone")?.textContent || ""), null, { timeout: 6000 }).then(() => true, () => false);
      assert.equal(reply.who, "老農班伯", tag + " 收成後是老農班伯說話");
      assert.match(reply.portrait, /portrait-elder\.png/, tag + " 帶老農班伯頭像");
      assert.equal(loaded, true, tag + " 頭像載得到");
      assert.match(reply.line, /這一穗總算回家了/);
      assert.equal(toastSeen, true, tag + " 規則句（專屬訂單名稱）在提示訊息");
      assert.equal(reply.cardInside, true, tag + " 對話框在畫面內");
      assert.equal(await page.evaluate(() => StoryR76.r82BlueOrder(__farm.state()).name), "班伯的第一穗留種單");

      /* 封存線：三件同時出現時，每件都比種子包大、名牌各自編號、在畫面內不被蓋、不壓名牌、不壓鄰居與市集攤。 */
      await setRoute(page, "seal", "");
      const pouch = await page.evaluate(() => { const n = document.querySelector('.r78c-scene-change[data-r78c-route="r81c_story:seal"]'); return n ? parseFloat(n.style.width) : 0; });
      for (const relic of await page.evaluate(() => StoryR76.R82_RELICS.map((r) => ({ id: r.id, anchor: r.anchor, number: r.number, name: r.name })))) {
        const route = "r82b_relic_" + relic.id + ":" + relic.id;
        await focusOn(page, '.r78c-scene-change[data-r78c-route="' + route + '"]', relic.anchor);
        const m = await measureMarker(page, route);
        assert.ok(m, tag + " " + relic.name + " 畫在地圖上");
        assert.equal(m.label, "鎮誌 " + relic.number + "／3", tag + " 名牌");
        assert.ok(m.w >= 64 && m.w >= m.pouchPx && m.w >= pouch, tag + " " + relic.name + " 至少跟藍布舊麥種包一樣大 " + JSON.stringify([m.w, m.pouchPx, pouch]));
        assert.equal(m.inside, true, tag + " " + relic.name + " 物件與名牌完整在畫面內 " + JSON.stringify(m));
        assert.deepEqual(m.coveredBy, [], tag + " " + relic.name + " 沒被介面蓋住 " + JSON.stringify(m));
        assert.deepEqual(m.labelHits, [], tag + " " + relic.name + " 名牌不壓其他名牌");
        assert.deepEqual(m.markerHits, [], tag + " " + relic.name + " 不壓鄰居、市集攤與其他物件");
      }
      /* 回憶：鎮長葛瑞先開口帶頭像，旁邊擺著舊物圖；一句一句點下去是 葛瑞 → 旁白 → 葛瑞。 */
      await page.evaluate(() => StoryR76.openR82Relic(__farm.state(), "faded_photo"));
      await page.waitForFunction(() => document.querySelector('.r76b-dialogue[data-r82b-relic="faded_photo"] img.r83b-relic-icon')?.naturalWidth > 0 && document.querySelector(".r76b-dialogue img.r76b-portrait")?.naturalWidth > 0, null, { timeout: 5000 });
      const speakers = [];
      for (let i = 0; i < 6 && await page.locator(".r76b-dialogue").count(); i++) {
        const row = await page.evaluate(() => {
          const d = document.querySelector(".r76b-dialogue"), card = d.querySelector(".r76b-dialogue-card").getBoundingClientRect(), icon = d.querySelector("img.r83b-relic-icon"), line = d.querySelector(".r76b-dialogue-line");
          const ir = icon.getBoundingClientRect(), lr = line.getBoundingClientRect(), portrait = d.querySelector("img.r76b-portrait");
          return { who: d.querySelector(".r76b-dialogue-head b").textContent, portrait: portrait ? portrait.getAttribute("src") : "", icon: icon.naturalWidth > 0 && ir.width >= 36,
            iconBeside: ir.right <= lr.left + 1, inside: card.left >= 0 && card.top >= 0 && card.right <= innerWidth && card.bottom <= innerHeight, last: d.querySelector("[data-r76b-next]").textContent };
        });
        speakers.push(row.who);
        if (row.who === "鎮長葛瑞") assert.match(row.portrait, /portrait-mayor\.png/, tag + " 鎮長葛瑞帶頭像");
        assert.equal(row.icon, true, tag + " 舊物圖擺在對話框");
        assert.equal(row.iconBeside, true, tag + " 舊物圖在台詞旁邊，不壓字");
        assert.equal(row.inside, true, tag + " 回憶對話框在畫面內");
        await page.locator(".r76b-dialogue [data-r76b-next]").click();
        if (row.last === "聽完了") break;
      }
      assert.deepEqual(speakers, ["鎮長葛瑞", "旁白", "鎮長葛瑞"], tag + " 回憶由鎮長葛瑞說，旁白只補一句");
      const gone = await page.waitForFunction(() => !document.querySelector('.r78c-scene-change[data-r78c-route="r82b_relic_faded_photo:faded_photo"]'), null, { timeout: 4000 }).then(() => true, () => false);
      assert.equal(gone, true, tag + " 找到後物件收進鎮誌（地圖下一次重畫就拿掉）");
      assert.deepEqual(errors, [], tag + " 不可有頁面錯誤");
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
});

Promise.all(pending).then(() => { if (!process.exitCode) console.log("VERIFIED content R83B branches (" + passed + " tests)"); });
