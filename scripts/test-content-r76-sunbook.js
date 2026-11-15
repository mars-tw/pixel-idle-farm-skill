"use strict";
/* R76C 追光手冊：四種印章怎麼拿、哪些格子看得到、小卡文字、里程碑獎勵、首次提示與舊存檔相容。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const C = require("../src/config.js");
const State = require("../src/state.js");
const Sun = require("../src/sunplay-r75.js");
/* 先記下原本的收成效果函式，等手冊包住它以後拿來比對回傳值。 */
const originalEffects = Sun.harvestEffects;
const Game = require("../src/game.js");
const Adventure = require("../src/adventure.js");
const Cooking = require("../src/cooking-r75.js");
const Book = require("../src/sunbook-r76.js");

const T = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS", name); } catch (error) { console.error("FAIL", name); throw error; } }
/* 等級是從經驗值算出來的，收成加經驗時會重算，所以兩個一起設。 */
function setLevel(s, level) { s.level = level; s.xp = C.xpForLevel(level); }
function fresh(level) {
  const s = State.defaultState(T); Sun.normalize(s);
  s.coins = 9999; setLevel(s, level || 1); s.upgrades.plotCount = 1;
  return s;
}
function grow(s, index, cropId, hits, care) {
  if (s.level < C.CROPS[cropId].unlockLevel) setLevel(s, C.CROPS[cropId].unlockLevel);
  assert.equal(Game.plant(s, index, cropId, T).ok, true, "種得下" + cropId);
  s.plots[index].plantedAt = T - Game.plotGrowMs(s, s.plots[index], T) - 1;
  for (let i = 0; i < (hits || 0); i++) Sun.recordExposure(s, index);
  /* R78B 第 3 項：施堆肥改成長得比較慢（1.25 倍時間），換了照顧方式要照新的時間重算，這一格才是熟的。 */
  if (care) { s.plots[index].careMode = care; s.plots[index].plantedAt = T - Game.plotGrowMs(s, s.plots[index], T) - 1; }
}
function light(s, plots) { Object.assign(s.sun, { plots: plots, used: [], startsAt: T - 1, endsAt: T + 10000, durationMs: 10001 }); }
function stamps(s, cropId) { Book.sync(s); return Object.keys(s.sunbook.stamps[cropId] || {}).sort().join(","); }
function seq(list) { let i = 0; return () => list[Math.min(i++, list.length - 1)]; }
/* 還沒解鎖的食譜沒辦法在測試裡真的下鍋，直接呼叫料理記下絕品時會叫的那個掛勾。 */
function perfect(s, recipeId) { assert.equal(typeof Cooking.onPerfect, "function"); Cooking.onPerfect(s, recipeId); }
function kitchen(s) { Adventure.ensure(s, T); s.adventure.claimed.c1_first_harvest = true; Adventure.ensure(s, T); return s; }

test("手冊包住收成效果以後，回傳值和原本一模一樣", () => {
  assert.equal(Sun.__r76cSunbook, true); assert.notEqual(Sun.harvestEffects, originalEffects);
  const cases = [["wheat", 0, true], ["wheat", 0, false], ["carrot", 1, false], ["carrot", 1, true], ["carrot", 0, false], ["strawberry", 0, false], ["strawberry", 1, false], ["radish", 0, true]];
  for (const [cropId, hits, exposed] of cases) {
    const s = fresh(8); grow(s, 0, cropId, hits);
    assert.deepEqual(Sun.harvestEffects(s, s.plots[0], () => 0.2, exposed), originalEffects(s, s.plots[0], () => 0.2, exposed), cropId + " 的回傳要原樣");
  }
  const s = fresh(); grow(s, 0, "wheat", 0); light(s, [0]);
  const r = Game.harvest(s, 0, T, () => 1);
  assert.equal(r.sun.bonus, 1); assert.equal(r.sun.sunlight, 2); assert.equal(r.sun.source, "喜光豐收"); assert.equal(r.sun.bottleFull, false); assert.equal(r.added, C.CROPS.wheat.yield + 1);
});

test("光裡收成：光還照著時收成才蓋；喜光作物同時拿到光性達成", () => {
  const s = fresh(); grow(s, 0, "wheat", 0); light(s, [0]);
  assert.equal(Game.harvest(s, 0, T, () => 1).ok, true);
  assert.equal(stamps(s, "wheat"), "lit,trait");
  const events = Book.takeEvents(s);
  /* R77C 同步：小卡分母統一為里程碑 15 枚（原為已解鎖格數 4），counts() 的 total 不變。 */
  assert.deepEqual(events.map((e) => e.text), ["追光手冊：小麥・光裡收成（1／15）", "追光手冊：小麥・光性達成（2／15）"]);
  assert.deepEqual(events.map((e) => e.first), [true, false]);
  assert.deepEqual(Book.takeEvents(s), [], "事件拿過就清掉");

  const dark = fresh(); grow(dark, 0, "wheat", 0);
  assert.equal(Game.harvest(dark, 0, T, () => 1).ok, true);
  assert.equal(stamps(dark, "wheat"), "", "沒照到光的小麥什麼章都沒有");

  const grown = fresh(); grow(grown, 0, "wheat", 0); grown.plots[0].sunGrown = true;
  assert.equal(Game.harvest(grown, 0, T, () => 1).added, C.CROPS.wheat.yield + 1);
  assert.equal(stamps(grown, "wheat"), "trait", "光裡種下、暗處收成：只有光性達成");
});

test("半日照：剛好照 1 次才蓋，照 2 次就算靠堆肥收到優質也不蓋", () => {
  const once = fresh(2); grow(once, 0, "carrot", 1);
  assert.equal(Game.harvest(once, 0, T, () => 1).quality, true); assert.equal(stamps(once, "carrot"), "trait");

  const none = fresh(2); grow(none, 0, "carrot", 0);
  Game.harvest(none, 0, T, () => 1); assert.equal(stamps(none, "carrot"), "");

  const litNow = fresh(2); grow(litNow, 0, "carrot", 0); light(litNow, [0]);
  Game.harvest(litNow, 0, T, () => 1); assert.equal(stamps(litNow, "carrot"), "lit,trait", "收成當下照到的那 1 次也算");

  const over = fresh(2); grow(over, 0, "carrot", 1); light(over, [0]);
  const overResult = Game.harvest(over, 0, T, () => 1);
  assert.equal(overResult.lightTrait.source, "半日照曬過頭"); assert.equal(stamps(over, "carrot"), "lit");

  const compost = fresh(2); grow(compost, 0, "carrot", 2, "compost");
  const compostResult = Game.harvest(compost, 0, T, () => 0);
  assert.equal(compostResult.quality, true, "堆肥讓這批變優質"); assert.ok((compost.storage.quality || {}).carrot > 0);
  assert.equal(stamps(compost, "carrot"), "", "曬過頭的不算光性達成");
});

test("耐陰：全程沒照到而且整批優質才蓋", () => {
  const hit = fresh(4); grow(hit, 0, "strawberry", 0);
  const r = Game.harvest(hit, 0, T, () => 0.2);
  assert.equal(r.quality, true); assert.equal(r.added, (hit.storage.quality || {}).strawberry); assert.equal(stamps(hit, "strawberry"), "trait");

  const miss = fresh(4); grow(miss, 0, "strawberry", 0);
  assert.equal(Game.harvest(miss, 0, T, () => 0.9).quality, false); assert.equal(stamps(miss, "strawberry"), "", "沒收到優質就不蓋");

  const sunned = fresh(4); grow(sunned, 0, "strawberry", 1, "compost");
  assert.equal(Game.harvest(sunned, 0, T, () => 0).quality, true, "堆肥讓這批變優質");
  assert.equal(stamps(sunned, "strawberry"), "", "照過光的草莓不算");

  const litNow = fresh(4); grow(litNow, 0, "strawberry", 0); light(litNow, [0]);
  Game.harvest(litNow, 0, T, () => 0); assert.equal(stamps(litNow, "strawberry"), "lit", "在光裡收成就不是全程沒照到");

  const viaCompost = fresh(4); grow(viaCompost, 0, "strawberry", 0, "compost");
  const mixed = Game.harvest(viaCompost, 0, T, seq([0.9, 0.1]));
  assert.equal(mixed.quality, true); assert.equal(mixed.added, (viaCompost.storage.quality || {}).strawberry);
  assert.equal(stamps(viaCompost, "strawberry"), "trait", "全程沒照到、整批優質");
});

test("沒有光性的作物只有光裡收成一格", () => {
  const s = fresh(5); grow(s, 0, "radish", 0); light(s, [0]);
  assert.equal(Game.harvest(s, 0, T, () => 0).ok, true);
  assert.equal(stamps(s, "radish"), "lit"); assert.deepEqual(Book.slotIds(s, "radish"), ["lit"]);
});

test("只是試算、還沒熟、倉庫全滿，都不蓋章", () => {
  const s = fresh(); grow(s, 0, "wheat", 0); light(s, [0]);
  Sun.harvestEffects(s, s.plots[0], () => 0, true); Sun.harvestPreview(s, s.plots[0], true);
  assert.equal(stamps(s, "wheat"), "", "只呼叫試算不算收成"); assert.equal(s.plots[0].cropId, "wheat");

  const young = fresh(); assert.equal(Game.plant(young, 0, "wheat", T).ok, true); light(young, [0]);
  assert.equal(Game.harvest(young, 0, T, () => 0).ok, false); assert.equal(stamps(young, "wheat"), "");

  const full = fresh(); grow(full, 0, "wheat", 0); light(full, [0]);
  full.storage.items.wheat = Game.storageCapacity(full);
  const r = Game.harvest(full, 0, T, () => 1);
  assert.equal(r.added, 0); assert.equal(stamps(full, "wheat"), "", "一份都沒收進倉庫就不蓋");
});

test("一次收全部：每一格各自判定", () => {
  const s = fresh(4);
  grow(s, 0, "wheat", 0); grow(s, 1, "carrot", 1); grow(s, 2, "carrot", 2); grow(s, 3, "tomato", 0);
  light(s, [0]);
  const all = Game.harvestAll(s, T);
  assert.ok(all.totalAdded > 0);
  assert.equal(stamps(s, "wheat"), "lit,trait"); assert.equal(stamps(s, "carrot"), "trait"); assert.equal(stamps(s, "tomato"), "");
  assert.equal(Book.takeEvents(s).length, 3);
});

test("曬成乾貨：從曬架收下來才蓋，只有四種作物有這格", () => {
  const s = fresh(4);
  s.storage.items.wheat = 2; Sun.addSunlight(s, 1);
  assert.equal(Sun.startDrying(s, "wheat", T).ok, true);
  assert.equal(Sun.collectDrying(s, T + Sun.DRYING_MS - 1).ok, false); assert.equal(stamps(s, "wheat"), "", "還沒曬好不蓋");
  assert.equal(Sun.collectDrying(s, T + Sun.DRYING_MS).ok, true); assert.equal(s.storage.items.sun_wheat, 1);
  assert.equal(stamps(s, "wheat"), "dried");
  for (const cropId of ["carrot", "tomato", "strawberry"]) {
    s.storage.items[cropId] = 2; Sun.addSunlight(s, 1);
    assert.equal(Sun.startDrying(s, cropId, T).ok, true); assert.equal(Sun.collectDrying(s, T + Sun.DRYING_MS).ok, true);
    assert.equal(stamps(s, cropId), "dried");
  }
  const withDried = Object.keys(C.CROPS).filter((id) => Book.slotIds(s, id).includes("dried")).sort();
  assert.deepEqual(withDried, ["carrot", "strawberry", "tomato", "wheat"]);
  assert.equal(Book.noteDried(s, "sun_corn"), false);
});

test("煮成絕品：絕品才蓋，用到的每種作物都蓋；沒有食譜用到的作物沒有這格", () => {
  const s = kitchen(fresh(4)); s.storage.items.wheat = 20; s.storage.items.carrot = 20;
  assert.equal(Cooking.cookWithGrade(s, "rustic_bread", "home", T).ok, true);
  assert.equal(Cooking.cookWithGrade(s, "rustic_bread", "tasty", T).ok, true);
  assert.equal(stamps(s, "wheat"), "", "家常和好吃都不蓋");
  assert.equal(Cooking.cookWithGrade(s, "rustic_bread", "perfect", T).ok, true);
  assert.equal(stamps(s, "wheat"), "perfect"); assert.equal(stamps(s, "carrot"), "");
  assert.equal(Cooking.cookWithGrade(s, "wheat_carrot_pancake", "perfect", T).ok, true);
  assert.equal(stamps(s, "carrot"), "perfect");
  perfect(s, "mint_tea");
  assert.equal(s.sunbook.stamps.river_mint, undefined, "不是作物的材料不進手冊");
  const withPerfect = Object.keys(C.CROPS).filter((id) => Book.slotIds(s, id).includes("perfect")).sort();
  assert.deepEqual(withPerfect, ["carrot", "strawberry", "tomato", "wheat"]);
  assert.deepEqual(Book.slotIds(s, "corn"), ["lit", "trait"]);
});

test("每種已解鎖作物一列，沒有對應玩法的格子不出現", () => {
  const one = fresh(1);
  assert.deepEqual(Book.rows(one).map((r) => r.cropId), ["wheat"]); assert.deepEqual(Book.counts(one), { got: 0, total: 4 });
  const noPlot = fresh(3); noPlot.upgrades.plotCount = 0;
  assert.deepEqual(Book.rows(noPlot).map((r) => r.cropId), ["wheat", "tomato"], "還買不到胡蘿蔔種子時不列胡蘿蔔");
  const three = fresh(3);
  assert.deepEqual(Book.rows(three).map((r) => r.cropId), ["wheat", "carrot", "tomato"]); assert.equal(Book.counts(three).total, 12);
  assert.equal(Book.summary(three).lockedCrops, Object.keys(C.CROPS).length - 3);
  const all = fresh(10);
  const shape = {}; for (const row of Book.rows(all)) shape[row.cropId] = row.cells.map((c) => c.id).join(",");
  assert.deepEqual(shape, {
    wheat: "lit,trait,dried,perfect", carrot: "lit,trait,dried,perfect", tomato: "lit,trait,dried,perfect", strawberry: "lit,trait,dried,perfect",
    corn: "lit,trait", pumpkin: "lit,trait", radish: "lit", bell_pepper: "lit", potato: "lit,trait", sunflower: "lit,trait",
    grapes: "lit", melon: "lit,trait", pea: "lit", sweet_potato: "lit", winter_kale: "lit",
  });
  assert.equal(Book.counts(all).total, 32); assert.equal(Book.summary(all).lockedCrops, 0);
  for (const row of Book.rows(all)) {
    assert.ok(row.cells.length >= 1 && row.cells.length <= 4);
    for (const cell of row.cells) {
      assert.equal(cell.got, false); assert.ok(cell.hint.length >= 12 && cell.hint.includes(row.name), row.name + cell.name + " 要寫怎麼拿");
      assert.match(cell.hint, /。$/);
    }
  }
  assert.match(Book.hintFor(all, "wheat", "dried"), /2 份小麥和 1 點陽光.*日曬麥穗/);
  assert.match(Book.hintFor(all, "wheat", "perfect"), /農家麥餅.*絕品/);
  assert.match(Book.hintFor(all, "carrot", "trait"), /剛好照到 1 次/);
  assert.match(Book.hintFor(all, "strawberry", "trait"), /別讓草莓照到光.*整批都是優質/);
});

test("小卡文字的分母統一為 15 枚（R77C 同步，原為已解鎖格數）；還沒解鎖的作物先記著、不通知", () => {
  const s = kitchen(fresh(1)); s.upgrades.plotCount = 0;
  perfect(s, "baked_carrot");
  const events = Book.takeEvents(s);
  assert.deepEqual(events.map((e) => e.text), ["追光手冊：小麥・煮成絕品（1／15）"]);
  assert.deepEqual(Book.counts(s), { got: 1, total: 4 });
  setLevel(s, 2); s.upgrades.plotCount = 1;
  assert.deepEqual(Book.counts(s), { got: 2, total: 8 }, "胡蘿蔔那一列出現時章已經蓋好");
  assert.equal(Book.rows(s)[1].cells.filter((c) => c.got).map((c) => c.id).join(","), "perfect");
  grow(s, 0, "wheat", 0); light(s, [0]); Game.harvest(s, 0, T, () => 1);
  assert.deepEqual(Book.takeEvents(s).map((e) => e.text), ["追光手冊：小麥・光裡收成（3／15）", "追光手冊：小麥・光性達成（4／15）"]);
});

test("第一次拿到印章只提示一次，存檔讀回來也不再提示", () => {
  const s = fresh(2);
  assert.equal(Book.summary(s).hinted, false);
  s.storage.items.wheat = 2; Sun.addSunlight(s, 1); Sun.startDrying(s, "wheat", T); Sun.collectDrying(s, T + Sun.DRYING_MS);
  const first = Book.takeEvents(s); assert.equal(first.length, 1); assert.equal(first[0].first, true); assert.equal(s.sunbook.hinted, true);
  const back = State.migrate(JSON.parse(JSON.stringify(s)));
  grow(back, 0, "wheat", 0); light(back, [0]); Game.harvest(back, 0, T, () => 1);
  const later = Book.takeEvents(back); assert.equal(later.length, 2); assert.ok(later.every((e) => e.first === false));
});

test("里程碑 3、6、10、15 枚：獎勵入帳、畫面寫得出拿到什麼、領過不重複領", () => {
  assert.deepEqual(Book.MILESTONES.map((m) => m.count), [3, 6, 10, 15]);
  const s = kitchen(fresh(4)); s.coins = 100;
  const before = Book.summary(s);
  assert.deepEqual(before.milestones.map((m) => m.count), [3, 6, 10, 15]);
  assert.ok(before.milestones.every((m) => m.rewardText.length > 6 && !m.claimed && !m.claimable));
  assert.doesNotMatch(before.milestones[0].rewardText, /金幣/, "R78C：3 枚改成非金幣獎勵");
  assert.ok(before.milestones.slice(1).every((m) => /金幣/.test(m.rewardText)));
  assert.deepEqual(before.next, { count: 3, remaining: 3 });
  assert.deepEqual(Book.claim(s, 3, T), { ok: false, reason: "not_yet", remaining: 3 }); assert.equal(s.coins, 100);
  assert.equal(Book.claim(s, 4, T).reason, "unknown");

  /* 第 1～3 枚：小麥光裡收成、光性達成、煮成絕品。第三枚的事件會帶著「集滿 3 枚」。 */
  grow(s, 0, "wheat", 0); light(s, [0]); Game.harvest(s, 0, T, () => 1);
  perfect(s, "rustic_bread");
  const three = Book.takeEvents(s);
  assert.deepEqual(three.map((e) => e.milestone), [0, 0, 3]); assert.equal(three[2].got, 3);
  assert.deepEqual(Book.summary(s).claimable, [3]);

  Sun.addSunlight(s, 99); assert.equal(Sun.sunlight(s), 5); assert.equal(Sun.bottleCapacity(s), 5);
  const coins3 = s.coins, earned3 = s.stats.totalCoinsEarned || 0;
  const got3 = Book.claim(s, 3, T);
  assert.equal(got3.ok, true); assert.equal(s.coins, coins3); assert.equal(s.stats.totalCoinsEarned || 0, earned3);
  assert.equal(Sun.bottleCapacity(s), 6, "蓄光瓶永久多裝 1 點"); assert.equal(Sun.sunlight(s), 6, "送的 1 點陽光裝得下");
  assert.equal(got3.text, "陽光 1 點、蓄光瓶永久多裝 1 點");
  assert.equal(Book.claim(s, 3, T + 1).reason, "claimed"); assert.equal(s.coins, coins3, "領過不重複領");
  Sun.normalize(s); assert.equal(Sun.sunlight(s), 6, "重新整理存檔不會把多出來的陽光削掉");
  const after3 = Book.summary(s).milestones[0];
  assert.equal(after3.claimed, true); assert.equal(after3.gotText, got3.text);

  /* 第 4～6 枚：小麥乾貨、胡蘿蔔絕品、胡蘿蔔光性。 */
  s.storage.items.wheat = 2; Sun.startDrying(s, "wheat", T); Sun.collectDrying(s, T + Sun.DRYING_MS);
  perfect(s, "baked_carrot");
  grow(s, 1, "carrot", 1); Game.harvest(s, 1, T, () => 1);
  assert.equal(Book.counts(s).got, 6);
  const packsBefore = Object.assign({}, s.adventure.r58.r59.seedPacks), coins6 = s.coins;
  const got6 = Book.claim(s, 6, T);
  assert.equal(got6.ok, true); assert.equal(s.coins, coins6 + 240);
  const packs = s.adventure.r58.r59.seedPacks; let gained = 0;
  for (const id of Object.keys(packs)) { const add = packs[id] - (packsBefore[id] || 0); if (add > 0) { gained += add; assert.equal(Sun.trait(id), "sun", "送的是喜光作物的種子"); assert.ok(Game.isCropUnlocked(s, id)); } }
  assert.equal(gained, 6); assert.deepEqual(got6.reward.seeds, { corn: 3, tomato: 3 });
  assert.equal(got6.text, "金幣 240、玉米種子 3 包、番茄種子 3 包");

  /* 第 7～10 枚：胡蘿蔔光裡收成與乾貨、番茄光裡收成與光性。 */
  /* 光要等兩格都種好再照下來：種在光裡會先把那一格的光用掉。 */
  grow(s, 2, "carrot", 2); grow(s, 3, "tomato", 0); light(s, [2, 3]);
  Game.harvest(s, 2, T, () => 1); Game.harvest(s, 3, T, () => 1);
  s.storage.items.carrot = 2; Sun.addSunlight(s, 1); Sun.startDrying(s, "carrot", T); Sun.collectDrying(s, T + Sun.DRYING_MS);
  assert.equal(Book.counts(s).got, 10);
  assert.equal(Sun.mirrorLimit(s), 1); const coins10 = s.coins;
  const got10 = Book.claim(s, 10, T);
  assert.equal(got10.ok, true); assert.equal(s.coins, coins10 + 400); assert.equal(Sun.mirrorLimit(s), 2, "手鏡每道光永久多折 1 次");
  s.r75Sunplay.mirrorLevel = 1; assert.equal(Sun.mirrorLimit(s), 3); s.r75Sunplay.mirrorLevel = 0;
  assert.equal(got10.text, "金幣 400、手鏡每道光永久多折 1 次");

  /* 第 11～15 枚：番茄乾貨與絕品、草莓光性、乾貨與絕品。 */
  s.storage.items.tomato = 2; Sun.addSunlight(s, 1); Sun.startDrying(s, "tomato", T); Sun.collectDrying(s, T + Sun.DRYING_MS);
  perfect(s, "tomato_harvest_stew");
  light(s, []); grow(s, 4, "strawberry", 0); Game.harvest(s, 4, T, () => 0.1);
  s.storage.items.strawberry = 2; Sun.addSunlight(s, 1); Sun.startDrying(s, "strawberry", T); Sun.collectDrying(s, T + Sun.DRYING_MS);
  perfect(s, "strawberry_market_tart");
  assert.equal(Book.counts(s).got, 15);
  Sun.spendSunlight(s, Sun.sunlight(s)); assert.equal(Sun.sunlight(s), 0);
  const coins15 = s.coins, got15 = Book.claim(s, 15, T);
  assert.equal(got15.ok, true); assert.equal(s.coins, coins15 + 800);
  assert.equal(Sun.bottleCapacity(s), 7, "蓄光瓶永久再多裝 1 點"); assert.equal(Sun.sunlight(s), 7, "而且直接裝滿");
  assert.equal(got15.text, "金幣 800、陽光 7 點、蓄光瓶永久多裝 1 點");
  s.r75Sunplay.bottleLevel = 1; assert.equal(Sun.bottleCapacity(s), 10); s.r75Sunplay.bottleLevel = 0;

  const done = Book.summary(s);
  assert.ok(done.milestones.every((m) => m.claimed && m.gotText.length > 6)); assert.equal(done.next, null); assert.deepEqual(done.claimable, []);
  assert.deepEqual(done.bonus, { jar: 2, mirror: 1 });
  /* 獎勵一份比一份多，而且每一份都有跟追光有關的東西。 */
  const coins = Book.MILESTONES.map((m) => m.coins); assert.deepEqual(coins.slice().sort((a, b) => a - b), coins);
  for (const m of Book.MILESTONES) assert.ok(m.sunlight || m.jar || m.mirror || m.seedPacks, "集滿 " + m.count + " 枚要有追光獎勵");
  assert.doesNotMatch(JSON.stringify([before, done, got3, got6, got10, got15, Book.rows(s)]), /\+0|\b0 點|\b0 包|\b0 次/);

  /* 存檔讀回來：印章、領取紀錄、永久加成都還在，也不能再領一次。 */
  const back = State.migrate(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.sunbook, s.sunbook);
  assert.equal(Book.counts(back).got, 15); assert.equal(Sun.bottleCapacity(back), 7); assert.equal(Sun.mirrorLimit(back), 2); assert.equal(Sun.sunlight(back), 7);
  assert.equal(Book.claim(back, 15, T).reason, "claimed");
});

test("種子包獎勵：只解鎖一種喜光作物時全給它，背包快滿時照實際拿到的寫", () => {
  const s = kitchen(fresh(2)); Book.normalize(s);
  s.sunbook.stamps.wheat = { lit: T, trait: T, dried: T, perfect: T }; s.sunbook.stamps.carrot = { lit: T, trait: T };
  assert.equal(Book.counts(s).got, 6);
  s.adventure.r58.r59.seedPacks.wheat = 97;
  const r = Book.claim(s, 6, T);
  assert.equal(r.ok, true); assert.equal(s.adventure.r58.r59.seedPacks.wheat, 99); assert.deepEqual(r.reward.seeds, { wheat: 2 });
  assert.equal(r.text, "金幣 240、小麥種子 2 包");
});

test("舊存檔：補一本空白手冊，不回溯以前的紀錄，壞資料也不報錯", () => {
  const old = State.migrate({ version: 1, lastSeenAt: 1000, level: 6, storage: { items: { sun_wheat: 3 }, quality: { carrot: 5 } }, upgrades: { plotCount: 2 }, stats: { harvested: { wheat: 50, carrot: 20 } }, flags: {} });
  assert.equal(old.sunbook, undefined, "讀檔本身不動這個欄位");
  kitchen(old); Cooking.ensure(old); old.adventure.r75b.best.rustic_bread = "perfect";
  assert.doesNotThrow(() => Book.normalize(old));
  assert.deepEqual(old.sunbook, { stamps: {}, claimed: {}, bonus: { jar: 0, mirror: 0 }, hinted: false, folded: false });
  assert.equal(Book.counts(old).got, 0, "以前收過、曬過、煮過的都不補蓋"); assert.ok(Book.counts(old).total > 0);
  assert.deepEqual(Book.takeEvents(old), []);
  assert.equal(Sun.bottleCapacity(old), 5); assert.equal(Sun.mirrorLimit(old), 1);

  for (const bad of ["壞掉", 7, null, [], { stamps: [1, 2], claimed: "x", bonus: { jar: 99, mirror: 99 }, hinted: "yes" }]) {
    const s = fresh(3); s.sunbook = bad;
    assert.equal(Sun.bottleCapacity(s) <= 7, true, "亂填的加成最多只算到上限");
    assert.doesNotThrow(() => Book.summary(s)); assert.doesNotThrow(() => Book.rows(s));
    assert.deepEqual(s.sunbook.stamps, {}); assert.deepEqual(s.sunbook.claimed, {}); assert.deepEqual(s.sunbook.bonus, { jar: 0, mirror: 0 });
    assert.equal(Sun.bottleCapacity(s), 5); assert.equal(Sun.mirrorLimit(s), 1);
  }
  const partial = fresh(3); partial.sunbook = { stamps: { wheat: { lit: true, bogus: 9, trait: -3 }, nothing: { lit: 5 }, carrot: "x" }, claimed: { 3: true, 99: true } };
  Book.normalize(partial);
  assert.deepEqual(partial.sunbook.stamps, { wheat: { lit: 1 } }); assert.deepEqual(Object.keys(partial.sunbook.claimed), ["3"]);
  assert.deepEqual(partial.sunbook.bonus, { jar: 1, mirror: 0 });
});

test("存檔、讀檔都不會把手冊洗掉", () => {
  const store = {}; const hadStorage = Object.prototype.hasOwnProperty.call(global, "localStorage"), oldStorage = global.localStorage;
  global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  try {
    const s = fresh(2); grow(s, 0, "wheat", 0); light(s, [0]); Game.harvest(s, 0, T, () => 1); Book.sync(s); Book.takeEvents(s);
    s.sunbook.folded = false;
    State.save(s);
    assert.ok(Object.keys(store).length >= 1, "真的有寫進存檔");
    const loaded = State.load();
    assert.deepEqual(loaded.sunbook, s.sunbook);
    assert.deepEqual(Book.counts(loaded), { got: 2, total: 8 }); assert.equal(Book.summary(loaded).folded, false); assert.equal(Book.summary(loaded).hinted, true);
  } finally { if (hadStorage) global.localStorage = oldStorage; else delete global.localStorage; }
});

test("接線：頁面與離線快取都有載入手冊，樣式標了 R76C，驗收清單有這兩支測試", () => {
  const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
  const html = read("index.html"), sw = read("sw.js"), css = read("src/content-r58b.css"), guard = read("scripts/guard-validation-writes.js"), src = read("src/sunbook-r76.js");
  assert.match(html, /<script src="src\/sunbook-r76\.js\?v=[^"]+"><\/script>/);
  assert.ok(html.indexOf("src/sunbook-r76.js") > html.indexOf("src/cooking-r75.js") && html.indexOf("src/sunbook-r76.js") > html.indexOf("src/sunplay-r75.js"), "要排在追光與料理後面載入");
  assert.match(sw, /versioned\("\.\/src\/sunbook-r76\.js"\)/);
  assert.match(css, /\/\* R76C：追光手冊/); assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length, "樣式檔大括號要平衡");
  assert.ok(css.indexOf("R76C") > css.indexOf("R76A") && css.indexOf("R76C") > css.indexOf("R76B"), "R76C 樣式接在檔尾");
  assert.match(guard, /"node scripts\/test-content-r76-sunbook\.js"/); assert.match(guard, /"node scripts\/test-content-r76-sunbook-layout\.js"/);
  assert.match(read("src/sunplay-r75.js"), /API\.onDried/); assert.match(read("src/cooking-r75.js"), /CookingR75\.onPerfect/);
  assert.doesNotMatch(src, /data-list-more|data-audit=/, "不借用圖鑑自己的統計標記");
  assert.doesNotMatch(src, /<header/, "頁面的 header 是固定頂欄，手冊裡不能用");
  assert.doesNotMatch(src, /\+0/);
});

test("印章與封面有專用圖：每一格都對得到檔案，離線快取也有收", () => {
  const sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
  const dir = path.join(__dirname, "..", "assets", "generated", "content-r76");
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const listed = manifest.files.map((f) => f.file);
  const all = fresh(30), seen = new Set();
  for (const row of Book.rows(all)) for (const cell of row.cells) {
    assert.match(cell.icon, /^assets\/generated\/content-r76\/stamp_[a-z_]+\.png$/, row.cropId + "・" + cell.id + " 要有印章圖");
    seen.add(path.basename(cell.icon));
  }
  assert.deepEqual([...seen].sort(), ["stamp_dried.png", "stamp_lit.png", "stamp_perfect.png", "stamp_trait_partial.png", "stamp_trait_shade.png", "stamp_trait_sun.png"]);
  for (const name of [...seen, "sunbook_cover.png"]) {
    assert.ok(fs.existsSync(path.join(dir, name)), name + " 檔案要在");
    assert.ok(sw.includes('"' + name + '"'), name + " 要在離線快取清單");
    assert.ok(listed.includes(name), name + " 要記在 manifest");
  }
});

console.log("VERIFIED content R76C sunbook (" + passed + " 項)");
