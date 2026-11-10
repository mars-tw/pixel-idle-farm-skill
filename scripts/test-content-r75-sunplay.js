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

test("下一步包含折光與催熟，舊存檔補安全預設", () => {
  const old = State.migrate({ version: 1, lastSeenAt: 1000, storage: { items: {} }, upgrades: {}, stats: {}, flags: {} }); assert.equal(old.r75Sunplay.sunlight, 0); assert.equal(old.r75Sunplay.mirrorLevel, 0); assert.equal(old.r75Sunplay.rack.cropId, null);
  const s = fresh(); s.coins = 99; Game.plant(s, 0, "wheat", 1000); s.sun.previewPlots = [1]; s.sun.previewAt = 9000; assert.equal(Adventure.nextFarmStep(s, 2000).action, "refract"); Sun.refract(s, 0, 2000); assert.equal(Adventure.nextFarmStep(s, 2001).action, "tend"); Sun.addSunlight(s, 2); assert.equal(Adventure.nextFarmStep(s, 2002).action, "ripen");
});

console.log(`VERIFIED R75A sunplay ${passed} tests`);
