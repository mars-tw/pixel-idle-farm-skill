/* R75A 驗收：追光、作物光性、蓄光瓶、曬架與舊存檔相容。 */
const assert = require("assert");
const State = require("../src/state.js");
const Game = require("../src/game.js");
const Adventure = require("../src/adventure.js");
const Sun = require("../src/sunplay-r75.js");
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS", name); } catch (error) { console.error("FAIL", name); throw error; } }
function fresh(now = 1000) { const s = State.defaultState(now); Sun.normalize(s); return s; }
function ready(s, index, cropId, now) { s.coins = 999; assert.equal(Game.plant(s, index, cropId, now).ok, true); s.plots[index].plantedAt = now - Game.plotGrowMs(s, s.plots[index], now) - 1; }

test("預告先鎖定落點，出光沿用同一格，惡劣天氣不預告", () => {
  const s = fresh(); s.coins = 99; Game.plant(s, 0, "wheat", 1000); Game.updateSunpatch(s, 1000, () => 0.5);
  const preview = Game.updateSunpatch(s, 1001, () => 0.5); assert.equal(preview.previewed, true); assert.deepEqual(s.sun.previewPlots, [1]);
  const planned = s.sun.previewPlots.slice(); const spawn = Game.updateSunpatch(s, s.sun.nextAt, () => 0); assert.equal(spawn.spawned, true); assert.deepEqual(s.sun.plots, planned);
  const bad = fresh(); bad.level = 5; bad.weather = { id: "fog", untilMs: 999999 }; bad.coins = 99; Game.plant(bad, 0, "wheat", 1000); Game.updateSunpatch(bad, 1000, () => 0); Game.updateSunpatch(bad, 1001, () => 0); assert.deepEqual(bad.sun.previewPlots, []);
});

test("手鏡每道一次，升級後兩次；折走前不算照到", () => {
  const s = fresh(); s.level = 3; s.upgrades.plotCount = 1; s.coins = 100; ready(s, 0, "carrot", 1000); s.sun.previewPlots = [0]; s.sun.previewAt = 9000; s.sun.nextAt = 9000;
  assert.equal(Sun.refract(s, 1, 2000).ok, true); assert.equal(Sun.refract(s, 2, 2000).ok, false); assert.equal(s.plots[0].r75SunHits, 0);
  Sun.settleBeam(s, s.sun.previewPlots); assert.equal(s.plots[0].r75SunHits, 0);
  s.sun.refractions = 0; assert.equal(Sun.buyMirror(s).ok, true); s.sun.previewPlots = [0]; assert.equal(Sun.refract(s, 1, 2000).ok, true); assert.equal(Sun.refract(s, 2, 2000).ok, true);
});

test("三種光性分別給產量、一次保證優質與陰涼機率", () => {
  const sun = fresh(); ready(sun, 0, "wheat", 1000); sun.plots[0].sunGrown = true; const wheat = Game.harvest(sun, 0, 20000, () => 1); assert.equal(wheat.added, 3); assert.equal(wheat.lightTrait.source, "喜光豐收");
  const partial = fresh(); partial.level = 2; partial.upgrades.plotCount = 1; ready(partial, 0, "carrot", 1000); Sun.recordExposure(partial, 0); const carrot = Game.harvest(partial, 0, 60000, () => 1); assert.equal(carrot.quality, true); assert.equal((partial.storage.quality || {}).carrot, 1); assert.equal(partial.storage.items.carrot, 2);
  const over = fresh(); over.level = 2; over.upgrades.plotCount = 1; ready(over, 0, "carrot", 1000); Sun.recordExposure(over, 0); Sun.recordExposure(over, 0); const overResult = Game.harvest(over, 0, 60000, () => 1); assert.equal(overResult.quality, false);
  const shade = fresh(); shade.level = 4; ready(shade, 0, "strawberry", 1000); const berry = Game.harvest(shade, 0, 400000, () => 0.2); assert.equal(berry.quality, true); assert.equal(berry.lightTrait.source, "陰涼熟成");
});

test("蓄光上限、升級、晨光催熟", () => {
  const s = fresh(); assert.equal(Sun.addSunlight(s, 20), 5); assert.equal(Sun.sunlight(s), 5); s.level = 4; s.coins = 100; assert.equal(Sun.buyBottle(s).ok, true); assert.equal(Sun.addSunlight(s, 20), 3); assert.equal(Sun.sunlight(s), 8);
  s.coins = 999; Game.plant(s, 0, "wheat", 1000); const before = Sun.sunlight(s); assert.equal(Sun.ripen(s, 0, 2000).ok, true); assert.equal(Sun.sunlight(s), before - 2); assert.equal(Game.getCropProgress(s, s.plots[0], 2000).ready, true);
});

test("曬架耗 2 份與 1 點，30 秒產出，乾貨直售三倍且訂單池可用", () => {
  const s = fresh(); s.level = 2; s.storage.items.wheat = 2; Sun.addSunlight(s, 1); assert.equal(Sun.startDrying(s, "wheat", 1000).ok, true); assert.equal(Sun.collectDrying(s, 30999).ok, false); assert.equal(Sun.collectDrying(s, 31000).ok, true); assert.equal(s.storage.items.sun_wheat, 1);
  assert.equal(Sun.driedDef("sun_wheat").sellValue, 3 * globalSell("wheat")); assert(Game.availableOrderItems(s).includes("sun_wheat")); assert.deepEqual(Sun.festivalBonus("sun_wheat"), { points: 1, source: "日曬乾貨 +1" });
});
function globalSell(id) { return require("../src/config.js").CROPS[id].sellValue; }

test("下一步包含折光、等光與催熟，舊存檔補安全預設", () => {
  const old = State.migrate({ version: 1, lastSeenAt: 1000, storage: { items: {} }, upgrades: {}, stats: {}, flags: {} }); assert.equal(old.r75Sunplay.sunlight, 0); assert.equal(old.r75Sunplay.mirrorLevel, 0); assert.equal(old.r75Sunplay.rack.cropId, null);
  const s = fresh(); s.coins = 99; Game.plant(s, 0, "wheat", 1000); s.sun.previewPlots = [1]; s.sun.previewAt = 9000; s.sun.nextAt = 9000; assert.equal(Adventure.nextFarmStep(s, 2000).action, "refract"); Sun.refract(s, 0, 2000);
  /* R75 整合時規則改了：光折過去之後還沒落下，下一步是「等光」。原本這裡直接回「去澆水」，玩家照做就會在光到之前把水澆掉，接不到第一點陽光。 */
  const hold = Adventure.nextFarmStep(s, 2001); assert.equal(hold.action, "catch_sun"); assert.equal(hold.plotIndex, 0); assert.match(hold.text, /等光到了再澆水/);
  assert.equal(Game.updateSunpatch(s, 9000, () => 0).spawned, true);
  const lit = Adventure.nextFarmStep(s, 9001); assert.equal(lit.action, "tend"); assert.equal(lit.sunlit, true); assert.equal(lit.plotIndex, 0);
  assert.equal(Game.waterPlot(s, 0, 9001).ok, true); assert.equal(Sun.sunlight(s), 1); assert.equal(s.r75Sunplay.firstCaught, true);
  /* 在光裡澆過水的那格長得快，接著就能收；收成再接 1 點，湊滿 2 點才提示催熟另一格。 */
  Game.plant(s, 1, "wheat", 9001); const reap = Adventure.nextFarmStep(s, 9002); assert.equal(reap.action, "harvest"); assert.equal(reap.plotIndex, 0); assert.equal(Game.harvest(s, 0, 9002).ok, true); assert.equal(Sun.sunlight(s), 2);
  const ripen = Adventure.nextFarmStep(s, 9003); assert.equal(ripen.action, "ripen"); assert.equal(ripen.plotIndex, 1);
});

test("光快落在已經熟的作物上：先留著等光，光到了才叫玩家收", () => {
  const s = fresh(); ready(s, 0, "wheat", 1000); s.sun.previewPlots = [0]; s.sun.previewAt = 9000; s.sun.nextAt = 9000;
  const hold = Adventure.nextFarmStep(s, 2000); assert.equal(hold.action, "catch_sun"); assert.equal(hold.plotIndex, 0); assert.match(hold.text, /等光到了再收成/);
  /* R76 整合：手上還有種子包時，這幾秒先叫玩家去種別格；等光的那一格要一起帶出去，田上才會寫「先別收」、收成鈕先收起來（原本手機上任務卡說去種小麥、田上卻寫可收成）。 */
  s.adventure.r58.r59.seedPacks.wheat = 2;
  const sow = Adventure.nextFarmStep(s, 2000); assert.equal(sow.action, "plant"); assert.notEqual(sow.plotIndex, 0, "種的是別格，不是等光的那一格"); assert.equal(sow.holdPlotIndex, 0, "去種別格時，等光的那一格仍標成留著"); s.adventure.r58.r59.seedPacks.wheat = 0;
  const uiSrc = require("fs").readFileSync(require("path").join(__dirname, "../src/ui.js"), "utf8"); assert.equal((uiSrc.match(/nextStep\.holdPlotIndex === tile\.plotIndex/g) || []).length, 2, "田上標籤與動作鈕都要認得留著等光的那一格");
  Game.plant(s, 1, "wheat", 2000); s.plots[1].plantedAt = 2000 - Game.plotGrowMs(s, s.plots[1], 2000) - 1; const other = Adventure.nextFarmStep(s, 2001); assert.equal(other.action, "harvest"); assert.equal(other.plotIndex, 1, "光還沒到時先收別格"); assert.equal(other.holdPlotIndex, 0, "先收別格時，等光的那一格仍標成留著");
  assert.equal(Game.harvest(s, 1, 2002).ok, true); assert.equal(Game.updateSunpatch(s, 9000, () => 0).spawned, true);
  const lit = Adventure.nextFarmStep(s, 9001); assert.equal(lit.action, "harvest"); assert.equal(lit.sunlit, true); assert.equal(lit.plotIndex, 0);
});

/* 照「下一步」一路做到底，回傳每一步的動作（連續相同的只記一次；光裡做的加 *）。成熟時間用遊戲本身的算法，跟瀏覽器一致。 */
function followSteps(waterFirst) {
  const had = Object.prototype.hasOwnProperty.call(global, "window"), saved = global.window; global.window = { getCropProgress: Game.getCropProgress };
  try {
    const T0 = 1794172800000; let now = T0; const s = State.defaultState(T0); Sun.normalize(s); assert.equal(Adventure.ensure(s, T0).ok, true); Adventure.record(s, { type: "talk", npcId: "mayor" }, now);
    const seq = []; const done = (r, step) => assert.equal(r.ok, true, `${step.action} 做不成：${JSON.stringify(r)}`);
    for (let i = 0; i < 200; i++) {
      if (!(waterFirst && i === 1)) Game.updateSunpatch(s, now, () => 0.5);
      const step = Adventure.nextFarmStep(s, now); const name = step.action + (step.sunlit ? "*" : ""); if (seq[seq.length - 1] !== name) seq.push(name);
      if (step.action === "explore") return { seq, state: s, ms: now - T0 };
      if (step.action === "catch_sun" || step.action === "wait") { now += 250; continue; }
      if (step.action === "plant") { done(Game.plant(s, step.plotIndex, "wheat", now), step); Adventure.record(s, { type: "plant", cropId: "wheat" }, now); if (!s.adventure.claimed.c1_homecoming) done(Adventure.finishTutorial(s, now), step); if (!waterFirst) { Game.updateSunpatch(s, now, () => 0.5); Game.updateSunpatch(s, now + 1, () => 0.5); } }
      else if (step.action === "refract") done(Sun.refract(s, step.plotIndex, now), step);
      else if (step.action === "tend") { done(Game.waterPlot(s, step.plotIndex, now), step); Adventure.record(s, { type: "water" }, now); }
      else if (step.action === "harvest") { const r = Game.harvest(s, step.plotIndex, now); done(r, step); Adventure.record(s, { type: "harvest", cropId: r.cropId, count: r.added }, now); }
      else if (step.action === "ripen") done(Sun.ripen(s, step.plotIndex, now), step);
      else if (step.action === "deliver") { Adventure.record(s, { type: "talk", npcId: "elder" }, now); done(Adventure.claim(s, "c1_first_harvest", now), step); }
      else if (step.action === "cook") done(Adventure.cook(s, "rustic_bread", now), step);
      else if (step.action === "eat") done(Adventure.eatMeal(s, "rustic_bread", now), step);
      else assert.fail(`沒見過的下一步：${step.action}`);
      now += 500;
    }
    assert.fail(`走了 200 步還沒走完：${seq.join(" → ")}`);
  } finally { if (had) global.window = saved; else delete global.window; }
}

test("新存檔照下一步走：種下 → 折光 → 種完種子包 → 等光 → 光裡澆水 → 收成 → 催熟 → 交付 → 第一餐", () => {
  const run = followSteps(false);
  assert.deepEqual(run.seq.slice(0, 12), ["plant", "refract", "plant", "tend", "catch_sun", "tend*", "harvest", "ripen", "harvest", "deliver", "cook", "eat"]);
  /* 吃完之後，第三格小麥可能剛好熟了，先收掉再去河邊，這是正常的。 */
  assert.deepEqual(run.seq.slice(12).filter((x) => x !== "harvest"), ["explore"]);
  assert.equal(run.state.r75Sunplay.firstRefracted, true); assert.equal(run.state.r75Sunplay.firstCaught, true); assert.equal(run.state.r75Sunplay.firstRipened, true); assert.equal(run.state.adventure.claimed.c1_first_meal, true);
  assert.ok(run.ms <= 60000, `照提示走，第一餐要在一分鐘內吃到（不含走路），實際 ${run.ms}ms`);
});

test("新存檔先澆水、沒折到光也走得完，一樣接得到陽光並學到催熟", () => {
  const run = followSteps(true);
  assert.equal(run.seq[0], "plant"); assert.equal(run.seq[1], "tend"); assert.ok(run.seq.includes("tend*") || run.seq.includes("harvest*"), run.seq.join(" → ")); assert.ok(run.seq.includes("ripen"), run.seq.join(" → "));
  assert.deepEqual(run.seq.filter((x) => ["deliver", "cook", "eat", "explore"].includes(x)), ["deliver", "cook", "eat", "explore"]); assert.equal(run.state.r75Sunplay.firstCaught, true);
});

test("介面用的資料：蓄光瓶籤、升級卡、田格動作", () => {
  const s = fresh(); assert.equal(Sun.jarChipHtml(s), "", "還沒接過陽光時不顯示蓄光瓶"); Sun.addSunlight(s, 1); assert.match(Sun.jarChipHtml(s), /陽光 1\/5/);
  s.level = 2; s.coins = 50; let cards = Sun.upgradeCards(s); assert.deepEqual(cards.map((c) => c.id), ["mirror", "bottle"]); assert.equal(cards[0].locked, true); assert.equal(cards[0].canBuy, false); assert.match(cards[0].buttonText, /等級 3/);
  s.level = 4; cards = Sun.upgradeCards(s); assert.equal(cards[0].canBuy, false); assert.equal(cards[0].short, 10); assert.equal(cards[0].affordability, "near"); assert.equal(cards[1].affordability, "long-term");
  s.coins = 60; cards = Sun.upgradeCards(s); assert.equal(cards[0].canBuy, true); assert.equal(cards[0].buy().ok, true); assert.equal(s.coins, 0); assert.equal(Sun.upgradeCards(s)[0].done, true);
  const p = fresh(); p.coins = 99; Game.plant(p, 0, "wheat", 1000); assert.deepEqual(Sun.plotActions(p, 0, 2000), [], "沒有光也沒有陽光時不多按鈕");
  p.sun.previewPlots = [1]; p.sun.previewAt = 9000; p.sun.nextAt = 9000; assert.deepEqual(Sun.plotActions(p, 0, 2000).map((a) => a.action), ["refract"]); assert.deepEqual(Sun.plotActions(p, 1, 2000), [], "光本來就要落在這格時不用折");
  Sun.addSunlight(p, 2); assert.deepEqual(Sun.plotActions(p, 0, 2000).map((a) => a.action), ["refract", "ripen"]); assert.deepEqual(Sun.plotActions(p, 2, 2000).map((a) => a.action), ["refract"], "空田不能催熟");
});

console.log(`VERIFIED R75A sunplay ${passed} tests`);
