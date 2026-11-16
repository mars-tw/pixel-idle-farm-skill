"use strict";
/* R77A 追光本體：折光預覽、照顧方式的實際數字、曬架翻面、右下互動鈕、三種火性。
 * 寫在畫面上的每個數字都拿真的收成／真的一局來對，不只檢查字串。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const C = require("../src/config.js");
const State = require("../src/state.js");
const Sun = require("../src/sunplay-r75.js");
const Game = require("../src/game.js");
const Adventure = require("../src/adventure.js");
const Cooking = require("../src/cooking-r75.js");
/* 追光手冊（C 線的檔）只載入、只呼叫，用來確認「曬成乾貨」的取得條件沒變。 */
const Book = require("../src/sunbook-r76.js");

const T = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS", name); } catch (error) { console.error("FAIL", name); throw error; } }
/* 等級由經驗值算，收成加經驗時會重算，所以兩個一起設。 */
function setLevel(s, level) { s.level = level; s.xp = C.xpForLevel(level); }
function fresh(level) {
  const s = State.defaultState(T); Sun.normalize(s); Adventure.ensure(s, T);
  /* 教學小麥會被調成剛好 10 秒成熟，先把教學標成完成，數字才乾淨。 */
  s.adventure.claimed.c1_first_harvest = true;
  s.coins = 9999; setLevel(s, level || 1);
  s.weather = { id: "clear", untilMs: T + 3600000 };
  return s;
}
const clone = (s) => JSON.parse(JSON.stringify(s));
function plantReady(s, index, cropId) {
  assert.equal(Game.plant(s, index, cropId, T).ok, true, "種得下 " + cropId);
  s.plots[index].plantedAt = T - Game.plotGrowMs(s, s.plots[index], T) - 1;
}
/* 預告光落在 plots，T+8000 落下。 */
function preview(s, plots) { Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: plots.slice(), previewAt: T + 8000, nextAt: T + 8000, refractions: 0 }); }
/* 讓預告的光真的落下、照完、結算，回傳光走掉的時間。 */
function landAndSettle(s) {
  assert.equal(Game.updateSunpatch(s, T + 8000, () => 0).spawned, true, "光要落下");
  const end = s.sun.endsAt; Game.updateSunpatch(s, end, () => 0);
  assert.equal(s.sun.plots.length, 0, "光要走掉");
  return end;
}
const noLatin = (text, what) => assert.equal(/[A-Za-z]/.test(text), false, what + " 不夾英文：" + text);
function stamps(s, cropId) { Book.sync(s); return Object.keys(s.sunbook.stamps[cropId] || {}).sort().join(","); }

/* ---------- 第 1 項：折光之前先看到結果 ---------- */
test("折光預覽：小麥（喜光）寫的份數與陽光，跟真的折過去再收成一樣", () => {
  const s = fresh(1); plantReady(s, 0, "wheat"); preview(s, [1]);
  const before = JSON.stringify(s);
  const p = Sun.refractPreview(s, 0, T + 1000);
  assert.equal(JSON.stringify(s), before, "預覽不改存檔");
  assert.equal(p.can, true); assert.equal(p.reason, "");
  assert.equal(p.text, "折過來：小麥（喜光）會照到光，收成多 1 份・光裡收成得陽光 2");
  assert.equal(p.buttonText, "手鏡還能折 1 次");
  assert.deepEqual([p.yieldGain, p.sunlightGain, p.to], [1, 1, 0]); assert.deepEqual(p.from, [1]);
  noLatin(p.text, "預覽"); noLatin(p.buttonText, "按鈕");

  const base = clone(s); const baseEnd = landAndSettle(base);
  const baseOut = Game.harvest(base, 0, baseEnd + 1, () => 1); const baseSun = Sun.sunlight(base);
  const lit = clone(s); assert.equal(Sun.refract(lit, 0, T + 1000).ok, true); const litEnd = landAndSettle(lit);
  assert.equal(lit.plots[0].r75SunHits, 1, "光走時有照到這格");
  const litOut = Game.harvest(lit, 0, litEnd + 1, () => 1);
  assert.equal(litOut.added - baseOut.added, p.yieldGain, "多收的份數跟預覽一樣");
  assert.equal(Sun.sunlight(lit) - baseSun, p.sunlightGain, "多的陽光跟預覽一樣");

  /* 光還在的時候親手收：份數一樣多 1，另外再接到 1 點陽光（預覽寫的不含這 1 點）。 */
  const hand = clone(s); Sun.refract(hand, 0, T + 1000); Game.updateSunpatch(hand, T + 8000, () => 0);
  assert.equal(Game.isSunlit(hand, 0, T + 9000), true);
  const handOut = Game.harvest(hand, 0, T + 9000, () => 1);
  assert.equal(handOut.added - baseOut.added, p.yieldGain);
  assert.equal(Sun.sunlight(hand) - baseSun, p.sunlightGain + 1);
});

test("折光預覽：胡蘿蔔（半日照）剛好 1 次得優質、第 2 次曬過頭，跟實際收成一致", () => {
  /* 胡蘿蔔要開墾過一次才買得到種子。 */
  const s = fresh(2); s.upgrades.plotCount = 1; plantReady(s, 0, "carrot"); preview(s, [1]);
  const gain = Sun.refractPreview(s, 0, T + 1000);
  assert.equal(gain.text, "折過來：胡蘿蔔（半日照）會照到光，照到剛好 1 次，收成保證 1 份優質・光裡收成得陽光 1");
  assert.equal(gain.qualityChange, "gain"); assert.equal(gain.yieldGain, 0);
  const base = clone(s); const baseOut = Game.harvest(base, 0, landAndSettle(base) + 1, () => 1);
  const lit = clone(s); Sun.refract(lit, 0, T + 1000); const litOut = Game.harvest(lit, 0, landAndSettle(lit) + 1, () => 1);
  assert.equal(baseOut.quality, false); assert.equal(litOut.quality, true, "折過去照到 1 次就有優質");
  assert.equal(litOut.added, baseOut.added, "份數不變");

  const once = fresh(2); once.upgrades.plotCount = 1; plantReady(once, 0, "carrot"); Sun.recordExposure(once, 0); preview(once, [1]);
  const lose = Sun.refractPreview(once, 0, T + 1000);
  assert.equal(lose.text, "折過來：胡蘿蔔（半日照）會照到光，照到第 2 次，曬過頭，保證優質就沒了・光裡收成得陽光 1");
  assert.equal(lose.qualityChange, "lose");
  const keep = clone(once); const keepOut = Game.harvest(keep, 0, landAndSettle(keep) + 1, () => 1);
  const over = clone(once); Sun.refract(over, 0, T + 1000); const overOut = Game.harvest(over, 0, landAndSettle(over) + 1, () => 1);
  assert.equal(keepOut.quality, true); assert.equal(overOut.quality, false, "第 2 次照到就沒有保證優質");
});

test("折光預覽：草莓（耐陰）照到會失去陰涼加成；一般作物寫收成跟現在一樣；空田寫在光裡種", () => {
  const s = fresh(4); plantReady(s, 0, "strawberry"); preview(s, [1]);
  const p = Sun.refractPreview(s, 0, T + 1000);
  assert.equal(p.text, "折過來：草莓（耐陰）會照到光，陰涼的優質加成就沒了・光裡收成得陽光 1"); assert.equal(p.qualityChange, "lose");
  const base = clone(s); const baseOut = Game.harvest(base, 0, landAndSettle(base) + 1, () => 0.2);
  const lit = clone(s); Sun.refract(lit, 0, T + 1000); const litOut = Game.harvest(lit, 0, landAndSettle(lit) + 1, () => 0.2);
  assert.equal(baseOut.quality, true); assert.equal(litOut.quality, false);

  const r = fresh(5); plantReady(r, 0, "radish"); preview(r, [1]);
  const plain = Sun.refractPreview(r, 0, T + 1000);
  assert.equal(Sun.trait("radish"), "neutral");
  assert.equal(plain.text, `折過來：${C.CROPS.radish.name}會照到光，收成跟現在一樣・光裡收成得陽光 1`);
  const rBase = clone(r); const rBaseOut = Game.harvest(rBase, 0, landAndSettle(rBase) + 1, () => 1);
  const rLit = clone(r); Sun.refract(rLit, 0, T + 1000); const rLitOut = Game.harvest(rLit, 0, landAndSettle(rLit) + 1, () => 1);
  assert.equal(rLitOut.added, rBaseOut.added); assert.equal(rLitOut.quality, rBaseOut.quality);

  const e = fresh(1); preview(e, [1]);
  assert.equal(Sun.refractPreview(e, 2, T + 1000).text, "折過來：這格會照到光，在光裡種下去長得快");
});

test("不能折的時候寫原因；能不能折只有一份規則；手鏡次數照實寫", () => {
  const s = fresh(1); plantReady(s, 0, "wheat");
  const none = Sun.refractPreview(s, 0, T + 1000);
  assert.equal(none.can, false); assert.equal(none.reason, "none"); assert.equal(none.text, "");
  preview(s, [1]);
  const lit = Sun.refractPreview(s, 1, T + 1000);
  assert.equal(lit.can, false); assert.equal(lit.reason, "lit"); assert.equal(lit.text, "這格本來就會照到光，不用折");
  const locked = Sun.refractPreview(s, Game.activePlotCount(s), T + 1000);
  assert.equal(locked.reason, "plot"); assert.equal(locked.text, "");
  for (let i = 0; i < 8; i++) {
    const check = Sun.refractCheck(s, i, T + 1000);
    assert.equal(Sun.canRefract(s, i, T + 1000), check.ok); assert.equal(Sun.refractPreview(s, i, T + 1000).can, check.ok);
  }
  assert.equal(Sun.refract(s, 0, T + 1000).ok, true);
  const used = Sun.refractPreview(s, 2, T + 1000);
  assert.equal(used.can, false); assert.equal(used.reason, "used"); assert.equal(used.text, "這道光已經折過了，等下一道光");
  assert.equal(Sun.refract(s, 2, T + 1000).ok, false, "預覽說不能折，真的也折不了");

  const m = fresh(3); m.r75Sunplay.mirrorLevel = 1; plantReady(m, 0, "wheat"); preview(m, [1]);
  assert.equal(Sun.refractPreview(m, 0, T + 1000).buttonText, "手鏡還能折 2 次");
  Sun.refract(m, 0, T + 1000);
  assert.equal(Sun.refractPreview(m, 2, T + 1000).buttonText, "手鏡還能折 1 次");

  /* 光已經落下、這格在光裡收過了：寫「用過了」。 */
  const a = fresh(1); plantReady(a, 0, "wheat"); preview(a, [0]); Game.updateSunpatch(a, T + 8000, () => 0);
  Game.harvest(a, 0, T + 9000, () => 1);
  const spent = Sun.refractPreview(a, 0, T + 9500);
  assert.equal(spent.reason, "lit"); assert.equal(spent.spent, true); assert.equal(spent.text, "這道光在這格已經用過了");
});

/* ---------- 第 3 項：照顧方式寫出這一株的實際數字 ---------- */
/* 三列各換成那一種照顧方式，實際算成熟時間與收成，跟寫出來的數字比。 */
function checkRows(s, index, now) {
  const f = Game.careForecast(s, index, now);
  assert.equal(f.ok, true); assert.deepEqual(f.rows.map((r) => r.id), ["water", "compost", "natural"]);
  for (const row of f.rows) {
    noLatin(row.text, row.id);
    const c = clone(s); c.plots[index].careMode = row.id; const plot = c.plots[index];
    assert.equal(Game.plotGrowMs(c, plot, now), row.growMs, row.id + " 秒數用 plotGrowMs");
    assert.equal(row.seconds, Math.ceil(row.remainingMs / 1000));
    if (row.remainingMs > 0) assert.equal(Game.getCropProgress(c, plot, now + row.remainingMs - 1).ready, false, row.id + " 早 1 毫秒還沒熟");
    assert.equal(Game.getCropProgress(c, plot, now + row.remainingMs).ready, true, row.id + " 時間到就熟");
    const packs = () => (c.adventure.r58.r59.seedPacks[c.plots[index].cropId || f.cropId] || 0);
    const seedBefore = packs();
    const out = Game.harvest(c, index, now + row.remainingMs, () => 1);
    assert.equal(out.ok, true); assert.equal(out.added + out.lost, row.qty, row.id + " 收成份數跟寫的一樣");
    assert.equal(out.seedBack, row.seedBack); assert.equal(packs() - seedBefore, row.seedBack, row.id + " 帶回的種子");
  }
  return f;
}

test("照顧方式：小麥三列寫出實際秒數與份數，換成那種方式真的就是那樣", () => {
  const s = fresh(1); s.materials.compost = 2; assert.equal(Game.plant(s, 0, "wheat", T).ok, true);
  const f = checkRows(s, 0, T);
  /* R81A 同步：growMul 不動，畫面改用實際秒數和勤澆水相差幾秒。 */
  assert.deepEqual(f.rows.map((r) => r.text), [
    "勤澆水：約 12 秒成熟・收 2 份",
    "施堆肥：約 19 秒（比勤澆水慢 7 秒）・收 3 份，三成機率優質（用 1 份堆肥，現有 2）",
    "放著長：約 18 秒（比勤澆水慢 6 秒）・收 2 份，帶回 2 包種子",
  ]);
  assert.equal(f.rows[1].qualityChance, Game.FARM_CARE.compost.qualityChance);
  /* 澆過水的濕土：沒選勤澆水的兩種也會變快，數字跟著變。 */
  assert.equal(Game.waterPlot(s, 0, T).ok, true);
  const wet = checkRows(s, 0, T);
  /* R78B 第 3 項同步：施堆肥的生長時間改成 1.25 倍，濕土上從 12 秒變 15 秒；另外兩種沒變。 */
  assert.deepEqual(wet.rows.map((r) => r.seconds), [12, 15, 14]);
  /* 堆肥已經施了、沒有堆肥，各寫各的。 */
  const applied = clone(s); applied.plots[0].careMode = "compost";
  const a = Game.careForecast(applied, 0, T).rows[1]; assert.equal(a.compostCost, 0); assert.match(a.text, /（堆肥已經施了）$/);
  const empty = clone(s); empty.materials.compost = 0;
  const e = Game.careForecast(empty, 0, T).rows[1]; assert.equal(e.available, false); assert.match(e.text, /（要 1 份堆肥，現在沒有）$/);
  /* 熟了就寫現在就能收。 */
  const ripe = clone(s); ripe.plots[0].plantedAt = T - 600000;
  assert.equal(Game.careForecast(ripe, 0, T).rows[0].text, "勤澆水：現在就能收・收 2 份");
  assert.deepEqual(Game.careForecast(s, 3, T), { ok: false, rows: [] }, "空田沒有照顧預測");
});

test("照顧方式：超過 60 秒寫成分秒；季節、料理、光都算進去", () => {
  assert.equal(Game.careDurationText(72000), "1 分 12 秒"); assert.equal(Game.careDurationText(60000), "60 秒");
  assert.equal(Game.careDurationText(61000), "1 分 1 秒"); assert.equal(Game.careDurationText(120000), "2 分鐘");
  assert.equal(Game.careDurationText(59001), "60 秒");
  const tomato = fresh(3); assert.equal(Game.plant(tomato, 0, "tomato", T).ok, true);
  /* R78B 第 3 項同步：施堆肥的生長時間改成 1.25 倍，番茄從 2 分鐘變 2 分 30 秒；另外兩種沒變。 */
  assert.deepEqual(checkRows(tomato, 0, T).rows.map((r) => r.timeText), ["約 1 分 30 秒", "約 2 分 30 秒", "約 2 分 24 秒"]);

  /* 季節：白蘿蔔是春天的作物，春天比夏天快，兩個都跟實際一樣。 */
  const spring = fresh(6); spring.season = { id: "春", untilMs: T + 3600000 }; assert.equal(Game.plant(spring, 0, "radish", T).ok, true);
  const summer = clone(spring); summer.season.id = "夏";
  const sp = checkRows(spring, 0, T), su = checkRows(summer, 0, T);
  assert.ok(sp.rows[0].remainingMs < su.rows[0].remainingMs, "當季比較快");
  assert.equal(sp.rows[0].timeText, "約 58 秒"); assert.equal(su.rows[0].timeText, "約 1 分 18 秒");

  /* 料理：收成多 1 份、成長 ×0.8。 */
  const meal = fresh(1); assert.equal(Game.plant(meal, 0, "wheat", T).ok, true);
  meal.adventure.r58.buffs.harvest = { until: T + 600000, bonus: 1 }; meal.adventure.r58.buffs.growth = { until: T + 600000, mul: 0.8 };
  const m = checkRows(meal, 0, T);
  assert.deepEqual(m.rows.map((r) => r.qty), [3, 4, 3]); assert.equal(m.rows[0].text, "勤澆水：約 9 秒成熟・收 3 份");

  /* 在光裡的喜光作物：份數含光性加成，收成時也真的在光裡。 */
  const sunny = fresh(1); assert.equal(Game.plant(sunny, 0, "wheat", T).ok, true);
  Object.assign(sunny.sun, { plots: [0], used: [], startsAt: T - 1, endsAt: T + 60000, durationMs: 60001 });
  const lit = checkRows(sunny, 0, T);
  assert.deepEqual(lit.rows.map((r) => r.qty), [3, 4, 3]);
});

/* ---------- 第 4 項：曬架要顧 ---------- */
function dryingState() {
  const s = fresh(2); s.storage.items.wheat = 4; Sun.addSunlight(s, 2);
  assert.equal(Sun.startDrying(s, "wheat", T).ok, true); return s;
}
test("曬架翻面：曬到一半起 10 秒可以翻，翻了多收 1 份，標籤照實寫", () => {
  const s = dryingState();
  assert.deepEqual(Sun.flipWindow(s.r75Sunplay.rack), { from: T + 15000, until: T + 25000 });
  const early = Sun.rackStatus(s, T + 14999);
  assert.equal(early.flip, "early"); assert.equal(Sun.rackLabel(s, early), "曬架・16 秒"); assert.equal(Sun.rackTimeText(early), "還要 16 秒");
  assert.equal(Sun.flipRack(s, T + 14999).reason, "early");
  const open = Sun.rackStatus(s, T + 15000);
  assert.equal(open.flip, "open"); assert.equal(open.flipRemainingMs, 10000); assert.equal(open.quantity, 1);
  assert.equal(Sun.rackLabel(s, open), "還要 15 秒・可以翻面"); assert.equal(Sun.rackTimeText(open), "還要 15 秒・可以翻面");
  assert.deepEqual(Sun.flipRack(s, T + 15000), { ok: true, itemId: "sun_wheat", quantity: 2 });
  assert.equal(Sun.flipRack(s, T + 15500).reason, "flipped", "一批只能翻一次");
  const done = Sun.rackStatus(s, T + 19000);
  assert.equal(done.flip, "done"); assert.equal(done.quantity, 2); assert.equal(Sun.rackLabel(s, done), "翻過了・還要 11 秒");
  assert.equal(Sun.collectDrying(s, T + 29999).reason, "not_ready");
  assert.deepEqual(Sun.collectDrying(s, T + 30000), { ok: true, itemId: "sun_wheat", quantity: 2 });
  assert.equal(s.storage.items.sun_wheat, 2);
  assert.equal(Sun.flipRack(s, T + 30001).reason, "empty"); assert.equal(Sun.rackLabel(s, Sun.rackStatus(s, T + 30001)), "曬架");
});

test("曬架翻面：錯過照常曬好、不扣；曬好後不能再翻", () => {
  const s = dryingState();
  const missed = Sun.rackStatus(s, T + 25000);
  assert.equal(missed.flip, "missed"); assert.equal(Sun.rackLabel(s, missed), "曬架・5 秒");
  assert.equal(Sun.flipRack(s, T + 25000).reason, "missed");
  const ready = Sun.rackStatus(s, T + 30000); assert.equal(Sun.rackLabel(s, ready), "曬架・可收");
  assert.equal(Sun.flipRack(s, T + 30000).reason, "ready");
  assert.deepEqual(Sun.collectDrying(s, T + 30000), { ok: true, itemId: "sun_wheat", quantity: 1 }, "沒翻照原本收 1 份");
  assert.equal(s.storage.items.sun_wheat, 1);
});

test("曬架翻面：翻面狀態存進存檔，重新載入後接續；舊存檔沒有這欄當成沒翻", () => {
  const s = dryingState(); Sun.flipRack(s, T + 16000);
  const back = State.migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(back.r75Sunplay.rack.flippedAt, T + 16000);
  assert.equal(Sun.rackStatus(back, T + 20000).flip, "done");
  assert.equal(Sun.collectDrying(back, T + 30000).quantity, 2);

  const old = dryingState(); const raw = JSON.parse(JSON.stringify(old)); delete raw.r75Sunplay.rack.flippedAt;
  const oldBack = State.migrate(raw);
  assert.equal(oldBack.r75Sunplay.rack.flippedAt, 0);
  assert.equal(Sun.rackStatus(oldBack, T + 16000).flip, "open", "舊存檔載入後照樣可以翻");
});

test("曬架翻面：追光手冊「曬成乾貨」照舊在收下時蓋一次，翻不翻都一樣", () => {
  const original = Sun.onDried; let calls = 0;
  Sun.onDried = function (state, itemId) { calls++; return original(state, itemId); };
  try {
    const flipped = dryingState(); Sun.flipRack(flipped, T + 15000);
    assert.equal(stamps(flipped, "wheat"), "", "翻面不蓋章");
    Sun.collectDrying(flipped, T + 30000); assert.equal(calls, 1); assert.equal(stamps(flipped, "wheat"), "dried");
    const plain = dryingState(); Sun.collectDrying(plain, T + 30000); assert.equal(calls, 2); assert.equal(stamps(plain, "wheat"), "dried");
  } finally { Sun.onDried = original; }
});

/* ---------- 第 5 項：右下互動鈕講清楚 ---------- */
test("右下互動鈕：田的各種狀態寫出按下去會做什麼，既有寫法不變", () => {
  const s = fresh(1); const tile = s.map.tiles.find((t) => t.plotIndex === 0);
  assert.equal(Game.interactionLabelForTile(s, tile, T), "種植・空田");
  assert.equal(Game.plant(s, 0, "wheat", T).ok, true);
  assert.equal(Game.interactionLabelForTile(s, tile, T), "澆水・小麥田");
  assert.equal(Game.waterPlot(s, 0, T).ok, true);
  assert.equal(Game.interactionLabelForTile(s, tile, T + 1000), "互動", "澆過還沒熟，沒有新寫法");
  s.plots[0].plantedAt = T - 600000;
  assert.equal(Game.interactionLabelForTile(s, tile, T), "收成・小麥田");
  const lockedTile = s.map.tiles.find((t) => t.plotIndex === Game.activePlotCount(s));
  if (lockedTile) assert.equal(Game.interactionLabelForTile(s, lockedTile, T), "互動", "還沒開墾的田不寫種植");
  assert.equal(Game.interactionLabelForTile(s, s.map.tiles.find((t) => t.npc === "mayor"), T), "交談・鎮長葛瑞");
});

test("右下互動鈕：站在曬架旁，可以翻面寫「翻面・曬架」、曬好寫「收乾貨・曬架」", () => {
  const s = fresh(2); s.player.x = 14; s.player.y = 5;
  assert.equal(Sun.rackNear(s), true);
  assert.equal(Sun.rackInteraction(s, T), null, "空架不搶互動鈕");
  s.storage.items.wheat = 2; Sun.addSunlight(s, 1); Sun.startDrying(s, "wheat", T);
  assert.equal(Sun.rackInteraction(s, T + 1000), null, "還沒到一半");
  assert.deepEqual(Sun.rackInteraction(s, T + 15000), { action: "flip", label: "翻面・曬架" });
  Sun.flipRack(s, T + 15000);
  assert.equal(Sun.rackInteraction(s, T + 16000), null, "翻過了");
  assert.deepEqual(Sun.rackInteraction(s, T + 30000), { action: "collect", label: "收乾貨・曬架" });
  const far = clone(s); far.player.x = 7; far.player.y = 5;
  assert.equal(Sun.rackNear(far), false); assert.equal(Sun.rackInteraction(far, T + 30000), null, "離曬架遠就不顯示");
  const ui = fs.readFileSync(path.join(ROOT, "src/ui.js"), "utf8");
  assert.ok(ui.includes("action.dataset.rack = !busy && rack ? rack.action"), "互動鈕標出曬架動作");
  assert.ok(ui.includes("window.FarmSunplay.runRackInteraction()"), "互動鈕按下去走曬架同一個函式");
  assert.equal(ui.split("nextStep.holdPlotIndex === tile.plotIndex").length - 1, 3, "R79B 三個選取面都認得等光田");
  assert.equal(ui.split("G.quickHarvestStatus(state, now())").length - 1, 0, "R75 釘點不變");
  const css = fs.readFileSync(path.join(ROOT, "src/content-r58b.css"), "utf8").split(/\r?\n/);
  assert.match(css[191], /#actionA/, "手機中央有收成鈕時藏右下鈕的規則還在原位");
});

/* ---------- 第 6 項：看火候三種火性 ---------- */
test("火性：三種火的金色區與衰減；沒指定時跟原本一樣", () => {
  const K = Cooking.FIRE_KINDS;
  assert.deepEqual(Object.keys(K).sort(), ["gentle", "shift", "strong"]);
  assert.deepEqual([K.gentle.label, K.gentle.startHeat, K.gentle.decayPerSec, K.gentle.zones], ["文火", 35, 3.2, [{ fromMs: 0, min: 26, max: 44 }]]);
  assert.deepEqual([K.strong.label, K.strong.startHeat, K.strong.decayPerSec, K.strong.zones], ["大火", 74, 8.5, [{ fromMs: 0, min: 62, max: 86 }]]);
  assert.deepEqual([K.shift.label, K.shift.startHeat, K.shift.decayPerSec, K.shift.zones], ["先大後小", 72, 5.2, [{ fromMs: 0, min: 60, max: 84 }, { fromMs: 6000, min: 30, max: 52 }]]);
  const d = Cooking.createFireSession({}).snapshot();
  assert.deepEqual([d.goldMin, d.goldMax, d.heat, d.decayPerSec, d.fire, d.durationMs], [42, 68, 55, 5.2, "", 12000]);
  assert.deepEqual([Cooking.GOLD_MIN, Cooking.GOLD_MAX, Cooking.START_HEAT, Cooking.DURATION_MS], [42, 68, 55, 12000]);
  for (const id of Object.keys(K)) {
    const session = Cooking.createFireSession({ fire: id }); const start = session.snapshot();
    assert.equal(start.heat, K[id].startHeat); assert.equal(start.fire, id); assert.equal(start.fireLabel, K[id].label);
    const after = session.tick(1000);
    assert.ok(Math.abs(after.heat - (K[id].startHeat - K[id].decayPerSec)) < 1e-9, id + " 每秒掉 " + K[id].decayPerSec);
    assert.equal(after.remainingMs, 11000);
  }
  const w = Cooking.createFireSession({ fire: "strong" });
  assert.equal(w.addWood().heat, 90); assert.equal(w.vent().heat, 74); assert.equal(w.openLid().heat, 58);
  w.addWood(); w.addWood(); assert.equal(w.addWood().heat, 100, "火力最多 100");
  /* 等級門檻不變：七成絕品、四成好吃。 */
  assert.deepEqual([0.7, 0.69, 0.4, 0.39].map(Cooking.gradeForRatio), ["perfect", "tasty", "tasty", "home"]);
});

test("火性：先大後小在第 6 秒換位置，換之前預告、換之後不再預告", () => {
  const s = Cooking.createFireSession({ fire: "shift" });
  const before = s.tick(5999);
  assert.deepEqual([before.goldMin, before.goldMax], [60, 84]); assert.deepEqual(before.nextZone, { min: 30, max: 52, inMs: 1 });
  const after = s.tick(1);
  assert.deepEqual([after.goldMin, after.goldMax, after.elapsedMs], [30, 52, 6000]); assert.equal(after.nextZone, null);
  /* 一步跨過換位置的時間點：前半段用舊位置算、後半段用新位置算。 */
  /* 起始 95：第 6 秒時 63.8 在舊位置裡（算 6 秒），第 7 秒 58.6 不在新位置裡（不算）。 */
  const high = Cooking.createFireSession({ fire: "shift", startHeat: 95 }).tick(7000);
  assert.deepEqual([high.goldMin, high.goldMax], [30, 52]); assert.ok(Math.abs(high.inZoneMs - 6000) < 1e-9, "前 6 秒用舊位置");
  /* 起始 70：第 6 秒時 38.8 不在舊位置裡，第 7 秒 33.6 在新位置裡（只算 1 秒）。 */
  const low = Cooking.createFireSession({ fire: "shift", startHeat: 70 }).tick(7000);
  assert.ok(Math.abs(low.inZoneMs - 1000) < 1e-9, "後 1 秒用新位置");
  assert.equal(Math.ceil(Cooking.createFireSession({}).tick(500).remainingMs / 1000), 12, "還剩幾秒由程式算");
});

test("火性：放著不管只有家常，照著金色區顧可以到絕品", () => {
  for (const id of ["", "gentle", "strong", "shift"]) {
    const idle = Cooking.createFireSession(id ? { fire: id } : {}); let snap = idle.snapshot();
    while (!snap.finished) snap = idle.tick(100);
    assert.equal(snap.grade, "home", (id || "預設") + " 放著不管");
    const care = Cooking.createFireSession(id ? { fire: id } : {}); snap = care.snapshot();
    while (!snap.finished) {
      snap = care.tick(100); if (snap.finished) break;
      if (snap.heat > snap.goldMax - 1) snap = care.vent(); else if (snap.heat < snap.goldMin + 1) snap = care.addWood();
    }
    assert.equal(snap.grade, "perfect", (id || "預設") + " 顧好了");
  }
});

test("火性：10 道料理各指定一種，灶台寫得出來，對照表只在 cooking-r75.js", () => {
  const s = fresh(1); const ids = Adventure.recipes(s, T).map((r) => r.id);
  assert.equal(ids.length, 10);
  assert.deepEqual(Object.keys(Cooking.RECIPE_FIRE).sort(), ids.slice().sort());
  for (const id of ids) {
    const kind = Cooking.RECIPE_FIRE[id]; assert.ok(Cooking.FIRE_KINDS[kind], id + " 有火性");
    assert.equal(Cooking.fireKindOf(id), Cooking.FIRE_KINDS[kind]);
    const text = Cooking.fireLabelText(id); assert.ok(text.startsWith(Cooking.FIRE_KINDS[kind].label + "："), text); noLatin(text, id);
  }
  assert.equal(new Set(Object.values(Cooking.RECIPE_FIRE)).size, 3, "三種火都有料理用到");
  assert.equal(Cooking.fireLabelText("rustic_bread"), "大火：金色區高，火掉得快");
  assert.equal(Cooking.fireLabelText("mint_tea"), "文火：金色區低而窄，火掉得慢");
  assert.equal(Cooking.fireLabelText("carrot_wheat_stew"), "先大後小：第 6 秒金色區從高移到低");
  const adventure = fs.readFileSync(path.join(ROOT, "src/adventure.js"), "utf8");
  const block = adventure.slice(adventure.indexOf("const RECIPES = ["), adventure.indexOf("];", adventure.indexOf("const RECIPES = [")));
  assert.equal((block.match(/\{ id: "/g) || []).length, 10); assert.equal(/\bfire\s*:/.test(block), false, "RECIPES 欄位不動");
  const cooking = fs.readFileSync(path.join(ROOT, "src/cooking-r75.js"), "utf8");
  assert.ok(cooking.includes("添柴・火變大") && cooking.includes("掀蓋・火變小"));
  assert.ok(cooking.includes("--r77a-gold-left") && cooking.includes("--r77a-gold-width"), "金色區位置由程式寫進 CSS 變數");
  assert.equal(cooking.includes("還剩 12 秒"), false, "倒數不寫死");
  const css = fs.readFileSync(path.join(ROOT, "src/content-r58b.css"), "utf8");
  assert.ok(css.includes(`var(--r77a-gold-left, ${Cooking.GOLD_MIN}%)`) && css.includes(`var(--r77a-gold-width, ${Cooking.GOLD_MAX - Cooking.GOLD_MIN}%)`), "CSS 預設跟原本 42～68 一樣");
});

console.log(`VERIFIED R77A sunplay ${passed} tests`);
