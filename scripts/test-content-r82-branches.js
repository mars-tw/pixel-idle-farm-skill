"use strict";
/* R82B：從 R81 的二選一一路模擬到兩條新結尾。
   種植線：專用田種藍布老麥 → 兩個不同遊戲日各接一次現有光斑 → 收成 → 專屬訂單。
   封存線：三個不同遊戲日各找一件鎮誌舊物 → 三段鎮長葛瑞回憶 → 封存箱旁永久擺飾。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
global.window = global;
const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const A = require("../src/adventure.js");
const State = require("../src/state.js");
const G = require("../src/game.js");
const H = require("../src/heirloom.js");
const M = require("../src/midgame-r66.js");
const K = require("../src/cooking-r75.js");
const R = require("../src/story-r76.js");
const Q = require("../src/choices-r77.js");
Q.install();

const T0 = Date.parse("2026-11-09T08:00:00Z"), DAY = 86400000;
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("PASS " + name); }
  catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; }
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
  assert.equal(R.r81Stage(s), "done");
  return s;
}
function shineOnBlueField(state, now) {
  state.sun = { plots: [R.R82_BLUE_LIGHT_PLOT], startsAt: now - 1000, endsAt: now + 10000, nextAt: 0, used: [], introduced: true };
  assert.equal(G.isSunlit(state, R.R82_BLUE_LIGHT_PLOT, now), true, "使用遊戲既有 isSunlit 判斷");
}

test("第 1、5 項：二選一只寫地圖改變與後續玩法，選項文字不出現「金」", () => {
  const source = read("src/story-r76.js");
  const block = (source.match(/const choiceOptions = \[[\s\S]*?\n    \];/) || [""])[0];
  assert.ok(block, "找到 R82B 二選一文案");
  assert.doesNotMatch(block, /金/);
  assert.match(block, /藍布老麥田[\s\S]*傳家作物「藍布老麥」[\s\S]*專屬訂單/);
  assert.match(block, /鎮公所封存箱[\s\S]*分天找鎮誌舊物[\s\S]*永久擺飾/);
  assert.notEqual(R.R81_OPTIONS.plant.label, R.R81_OPTIONS.seal.label);
});

test("第 2 項：種植線從選擇走到藍布老麥收成，必須在兩個不同遊戲日各照到一次現有光斑", () => {
  const s = finishR81("plant", T0);
  assert.equal(R.r82PlantStatus(s, T0 + 4000).stage, "empty");
  assert.equal(R.r82Plant(s, T0 + 5000).ok, true);
  assert.equal(R.r82Plant(s, T0 + 6000).reason, "already_planted", "專用田只有這一格、只種一次");

  shineOnBlueField(s, T0 + 7000);
  const first = R.r82CatchLight(s, T0 + 7000);
  assert.deepEqual({ ok: first.ok, ripe: first.ripe, lightDays: first.lightDays }, { ok: true, ripe: false, lightDays: 1 });
  assert.equal(R.r82CatchLight(s, T0 + 8000).reason, "same_day", "同一天重照不算第二次");

  const savedMidway = State.migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(R.r82PlantStatus(savedMidway, T0 + 9000).lightDays, 1, "存讀檔保留第一天日照");
  shineOnBlueField(savedMidway, T0 + DAY + 7000);
  const second = R.r82CatchLight(savedMidway, T0 + DAY + 7000);
  assert.deepEqual({ ok: second.ok, ripe: second.ripe, lightDays: second.lightDays }, { ok: true, ripe: true, lightDays: 2 });
  assert.equal(R.r82PlantStatus(savedMidway, T0 + DAY + 8000).stage, "ripe");

  const harvested = R.r82HarvestBlueWheat(savedMidway, T0 + DAY + 9000);
  assert.equal(harvested.ok, true);
  assert.equal(harvested.cropId, "blue_cloth_wheat");
  assert.equal(R.r82PlantStatus(savedMidway, T0 + DAY + 10000).stage, "order");
  const order = R.r82BlueOrder(savedMidway);
  assert.equal(order.have, 1, "專屬收成留在這條支線，不會被一般市集誤賣");
  assert.equal(order.name, "班伯的第一穗留種單"); /* R83B 同步：專屬訂單改由做選擇的老農班伯具名 */
  assert.equal(order.enough, true, "收成後接的是專屬訂單");
  assert.equal(R.r82DeliverBlueOrder(savedMidway, T0 + DAY + 11000).ok, true);
  assert.equal(R.r82PlantStatus(savedMidway, T0 + DAY + 12000).stage, "done");
});

test("第 2 項：藍布老麥有正式圖路徑、可用後備，以及三段不同的成長外觀", () => {
  /* R82 整合同步：MUSE 已補齊九張正式圖，改驗換圖清單跟檔案在不在一致（同 R81 故事物件的做法），不再寫死「缺圖」。 */
  for (const [key, file] of Object.entries(R.R82_ART)) {
    assert.equal(R.R82_ART_READY.includes(key), fs.existsSync(path.join(ROOT, file)), key + " 換圖清單要跟檔案在不在一致");
    assert.ok(fs.existsSync(path.join(ROOT, R.R82_ART_FALLBACK[key])), key + " 後備圖存在");
  }
  const growth = [R.r82Art("cropSprout"), R.r82Art("cropOneLight"), R.r82Art("cropRipe")];
  assert.equal(new Set(growth).size, 3, "發芽、照過一天光、成熟的外觀不同");
  assert.equal(new Set(["cropSprout", "cropOneLight", "cropRipe"].map((k) => R.R82_ART_FALLBACK[k])).size, 3, "後備外觀也彼此不同");
  const css = read("src/content-r58b.css");
  assert.match(css, /R82B（舊麥種兩條專屬玩法）開始/);
  assert.match(css, /\.r82b-crop-icon/);
  assert.match(css, /\[data-r82b-fallback\]/);
});

test("第 3 項：封存線的三樣舊物分三個遊戲日出現，走完後留下永久擺飾", () => {
  const s = finishR81("seal", T0);
  const expected = R.R82_RELICS.map((row) => row.id);
  for (let i = 0; i < expected.length; i++) {
    const now = T0 + i * DAY + 5000;
    const open = R.r82AvailableRelics(s, now).filter((row) => !row.found);
    assert.deepEqual(open.map((row) => row.id), [expected[i]], "第 " + (i + 1) + " 個遊戲日只新增當天那件舊物");
    const mapRow = R.r82SceneRows(s, now).find((row) => row.relicId === expected[i]);
    assert.ok(mapRow && mapRow.marker.anchor && mapRow.marker.art, "舊物在地圖上有可走近的物件");
    const found = R.r82FindRelic(s, expected[i], now);
    assert.equal(found.ok, true);
    assert.ok(found.memory.length >= 3, "每件舊物都有一小段回憶");
    assert.equal(R.r82FindRelic(s, expected[i], now + 1).reason, "found");
    if (i < expected.length - 1) assert.equal(R.r82SceneRows(s, now).some((row) => row.r82bKind === "decoration"), false);
  }
  const status = R.r82SealStatus(s, T0 + 2 * DAY + 6000);
  assert.equal(status.foundCount, 3);
  assert.equal(status.decorated, true);
  const decoration = R.r82SceneRows(s, T0 + 2 * DAY + 6000).find((row) => row.r82bKind === "decoration");
  assert.equal(decoration.label, "壓穗鎮誌牌・鎮誌留存");
  assert.equal(decoration.marker.anchor, "station:sign", "永久擺飾在封存箱旁");
  assert.ok(R.r82SceneRows(s, T0 + 20 * DAY).some((row) => row.r82bKind === "decoration"), "之後的遊戲日仍永久存在");
});

test("第 3 項：葛瑞的三段回憶只講心情，不把規則數字塞進對白", () => {
  const ruleWords = /\d|每天|遊戲日|份|金幣|陽光點數|解鎖|獎勵/;
  for (const relic of R.R82_RELICS) {
    const mayor = relic.memory.filter((line) => line.by === "mayor");
    assert.ok(mayor.length >= 2);
    for (const line of mayor) assert.doesNotMatch(line.text, ruleWords, relic.name + "：" + line.text);
  }
});

test("第 4 項：選完聚焦新物件約兩秒，沿用不加遮罩、不中斷點擊的 focusTile", () => {
  const story = read("src/story-r76.js"), ui = read("src/ui.js");
  assert.match(story, /onClose: \(\) => \{ saveNow\(\); if \(picked\) \{ focusR82Choice/);
  assert.match(story, /typeof f\.focusTile === "function" && f\.focusTile\(tile\.id\)/);
  assert.match(ui, /state\.camera\.focusUntil = now\(\) \+ 2600;/, "現有鏡頭停留約 2.6 秒");
  const focus = (story.match(/function focusR82Choice[\s\S]*?\n  \}/) || [""])[0];
  assert.doesNotMatch(focus, /overlay|pointer|onclick|setTimeout/, "聚焦本身不蓋遮罩、不接管點擊、不排隊強制切回");
});

test("第 5 項：兩條路線有互斥操作，地圖點擊會走近後再執行", () => {
  const story = read("src/story-r76.js"), choices = read("src/choices-r77.js");
  assert.match(story, /function r82Plant\(/);
  assert.match(story, /function r82CatchLight\(/);
  assert.match(story, /function r82HarvestBlueWheat\(/);
  assert.match(story, /function r82FindRelic\(/);
  assert.match(story, /f\.travelAndDo\(tile\.id, "collect", effect\)/);
  assert.match(choices, /row\.r82b && R && typeof R\.r82Go === "function"/);
  const plant = finishR81("plant", T0), seal = finishR81("seal", T0);
  assert.equal(R.r82FindRelic(plant, "old_seed_tag", T0 + 5000).reason, "wrong_route");
  assert.equal(R.r82Plant(seal, T0 + 5000).reason, "wrong_route");
});

test("存檔相容：兩條新進度可讀回，R81 已選過但沒有 R82 欄位的舊存檔也會接上", () => {
  const plant = finishR81("plant", T0); R.r82Plant(plant, T0 + 5000); shineOnBlueField(plant, T0 + 6000); R.r82CatchLight(plant, T0 + 6000);
  const plantSaved = State.migrate(JSON.parse(JSON.stringify(plant)));
  assert.equal(R.r82PlantStatus(plantSaved, T0 + 7000).lightDays, 1);

  const seal = finishR81("seal", T0); R.r82FindRelic(seal, "old_seed_tag", T0 + 5000);
  const sealSaved = State.migrate(JSON.parse(JSON.stringify(seal)));
  assert.equal(R.r82SealStatus(sealSaved, T0 + 6000).foundCount, 1);

  for (const route of ["plant", "seal"]) {
    const old = fresh(T0); old.heirloom = { started: true, sunWheat: 2, delivered: true, choice: "table", deliveredAt: T0 }; old.r81story = { choice: route, choiceAt: T0, shownAt: T0, orderAt: T0 + 1, sceneAt: T0 + 2 };
    delete old.r82branches;
    const loaded = State.migrate(JSON.parse(JSON.stringify(old)));
    const branch = R.r82Ensure(loaded, T0 + 10 * DAY);
    assert.equal(branch.route, route);
    if (route === "plant") assert.equal(R.r82PlantStatus(loaded, T0 + 10 * DAY).stage, "empty");
    else assert.deepEqual(R.r82AvailableRelics(loaded, T0 + 10 * DAY).map((row) => row.id), ["old_seed_tag"], "舊存檔從本次讀檔日起逐日接支線，不一次補發三件");
  }
});

test("第 6 項：新測試已接到 unit 清單最後", () => {
  const guard = read("scripts/guard-validation-writes.js");
  /* R82 整合同步：同輪 C 線的 test-content-r82-play.js 也接在清單尾，B 線測試緊接在 r81-story 後面、後面只允許同輪 R82 測試。 */
  /* R83C 同步：R83 各線的新測試也接在清單尾，r82-branches 後面只允許 R82、R83 的測試。 */
  assert.match(guard, /"node scripts\/test-content-r81-story\.js",\s*"node scripts\/test-content-r82-branches\.js",(\s*"node scripts\/test-content-r8[23]-[a-z-]+\.js",)*\s*\];/);
  /* R83B 同步：R83 各線的新測試依規定接在清單尾，只允許 R83 測試排在 R82 這幾支後面。 */
  assert.match(guard, /"node scripts\/test-content-r81-story\.js",\s*"node scripts\/test-content-r82-branches\.js",(\s*"node scripts\/test-content-r82-[a-z-]+\.js",)*(\s*"node scripts\/test-content-r83-[a-z-]+\.js",)*\s*\];/);
  assert.match(guard, /"node scripts\/test-content-r81-story\.js",\s*"node scripts\/test-content-r82-branches\.js",(\s*"node scripts\/test-content-r8[23]-[a-z-]+\.js",)*\s*\];/); /* R83A 同步：R83 的新測試依規定接在清單尾 */
});

if (!process.exitCode) console.log("VERIFIED content R82B branches (" + passed + " tests)");
