"use strict";
const assert = require("node:assert/strict");
const C = require("../src/config.js"), S = require("../src/state.js"), G = require("../src/game.js"), D = require("../src/daily.js");
const T = Date.parse("2026-10-15T10:00:00+08:00"), DAY = 86400000;
let passed = 0;
function test(label, fn) { fn(); passed++; console.log("PASS " + label); }
function fresh() { return S.defaultState(T); }
function complete(s, now) {
  const st = D.status(s, now);
  D.record(s, "water", 3, now); D.record(s, "talk", 1, now); D.record(s, "sell", 1, now);
  return ["water", "talk", "sell"].map((id) => D.claim(s, id, st.day, now));
}
test("new farmer gets three distinct reachable chores and no free rewards", () => {
  const s = fresh(), coins = s.coins, st = D.status(s, T);
  assert.deepEqual(st.tasks.map((task) => task.id), ["water", "talk", "sell"]); assert.equal(st.done, 0); assert.equal(s.coins, coins);
  assert.equal(D.claim(s, "water", st.day, T).ok, false);
});
test("daily chores do not consume main-story crops", () => {
  const s = fresh(); s.storage.items.wheat = 2; const before = JSON.stringify(s.storage.items);
  D.record(s, "talk", 1, T); D.record(s, "sell", 1, T);
  assert.equal(D.claim(s, "talk", s.daily.day, T).ok, true); assert.equal(D.claim(s, "sell", s.daily.day, T).ok, true);
  assert.equal(JSON.stringify(s.storage.items), before);
});
test("successful watering counts once; invalid and repeated watering do not count", () => {
  const s = fresh(); G.waterPlot(s, 0, T); assert.equal(D.status(s, T).tasks[0].have, 0);
  G.plant(s, 0, "wheat", T); assert.equal(G.waterPlot(s, 0, T + 1).ok, true);
  assert.equal(G.waterPlot(s, 0, T + 2).ok, false); assert.equal(D.status(s, T + 2).tasks[0].have, 1);
});
test("talk progress counts once", () => {
  const s = fresh(); D.record(s, "talk", 1, T); D.record(s, "talk", 1, T);
  assert.equal(D.status(s, T).tasks[1].have, 1);
});
test("successful direct sale counts and reward pays only once", () => {
  const s = fresh(), st = D.status(s, T), coins = s.coins; s.storage.items.wheat = 1;
  assert.equal(G.sellItem(s, "wheat", 1, T).ok, true); assert.equal(D.status(s, T).tasks[2].have, 1);
  const r = D.claim(s, "sell", st.day, T); assert.equal(r.ok, true);
  assert.equal(D.claim(s, "sell", st.day, T).reason, "claimed"); assert.ok(s.coins > coins);
});
test("all three real tasks grant exactly one stamp and compost", () => {
  const s = fresh(), rewards = complete(s, T);
  assert.equal(rewards.filter((r) => r.stamp).length, 1); assert.equal(s.daily.stamps, 1); assert.equal(s.materials.compost, 1);
  assert.equal(D.claim(s, "sell", s.daily.day, T).ok, false); assert.equal(s.daily.stamps, 1);
});
test("Taiwan midnight resets progress and preserves earned stamps", () => {
  const a = Date.parse("2026-10-15T23:59:59+08:00"), b = a + 1000, s = fresh();
  complete(s, a); const st = D.status(s, b);
  assert.equal(st.date, "2026-10-16"); assert.equal(st.done, 0); assert.equal(st.stamps, 1);
  assert.equal(st.nextAt, Date.parse("2026-10-17T00:00:00+08:00"));
});
test("a stale previous-day claim cannot consume produce or give coins", () => {
  const s = fresh(), old = D.status(s, T); D.record(s, "water", 3, T);
  const coins = s.coins; assert.equal(D.claim(s, "water", old.day, T + DAY).reason, "new_day"); assert.equal(s.coins, coins);
});
test("clock rollback cannot replay a stamped day", () => {
  const s = fresh(); complete(s, T);
  const day = s.daily.day; assert.equal(D.status(s, T - DAY).day, day);
  assert.equal(D.claim(s, "water", day, T - DAY).ok, false); assert.equal(s.daily.stamps, 1);
});
test("missing several days grants no free stamps and no streak penalty", () => {
  const s = fresh(); complete(s, T); const st = D.status(s, T + 20 * DAY);
  assert.equal(st.stamps, 1); assert.equal(st.done, 0); assert.equal(st.tasks[0].have, 0);
});
test("three nonconsecutive visits unlock the first story memento", () => {
  const s = fresh(); let result;
  for (let i = 0; i < 3; i++) result = complete(s, T + i * 2 * DAY);
  assert.equal(s.daily.stamps, 3); assert.deepEqual(result[2].unlocked, ["祖母壓的小麥"]);
  assert.equal(D.status(s, T + 6 * DAY).keepsakes[0].owned, true);
  assert.equal(D.status(s, T + 6 * DAY).keepsakes[1].owned, false);
});
test("seven days unlock both text collectibles and persist through migration", () => {
  const s = fresh(); for (let i = 0; i < 7; i++) complete(s, T + i * DAY);
  const migrated = S.migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(migrated.daily.stamps, 7); assert.ok(D.status(migrated, T + 10 * DAY).keepsakes.every((k) => k.owned));
});
test("old saves have no fabricated daily progress; malformed fields are repaired", () => {
  const s = fresh(); delete s.daily; const m = S.migrate(s);
  assert.equal(D.status(m, T).stamps, 0);
  m.daily = { day: "broken", stamps: -3, talk: Infinity, claimed: { water: "yes" }, cropId: "missing" };
  const st = D.status(S.migrate(m), T); assert.equal(st.tasks[0].have, 0); assert.equal(st.stamps, 0); assert.equal(st.done, 0);
});
test("quick harvest ignores locked and unripe plots", () => {
  const s = fresh(); s.plots[0] = { cropId: "wheat", plantedAt: T };
  s.plots[20] = { cropId: "wheat", plantedAt: T - 60000 };
  assert.equal(G.quickHarvestStatus(s, T).count, 0);
});
test("quick harvest chooses sunshine over distance and yields no immediate mutation", () => {
  const s = fresh(); for (let i = 0; i < 2; i++) s.plots[i] = { cropId: "wheat", plantedAt: T - 60000 };
  G.ensureSunState(s); Object.assign(s.sun, { plots: [1], used: [], startsAt: T - 1, endsAt: T + 10000 });
  const raw = JSON.stringify(s), st = G.quickHarvestStatus(s, T);
  assert.equal(st.tileId, s.map.tiles.find((t) => t.plotIndex === 1).id); assert.equal(st.count, 2); assert.equal(JSON.stringify(s), raw);
});
test("quick harvest never selects produce that cannot entirely fit", () => {
  const s = fresh(); s.plots[0] = { cropId: "wheat", plantedAt: T - 60000 }; s.storage.items.wheat = G.storageCapacity(s) - 1;
  assert.equal(G.quickHarvestStatus(s, T).tileId, null); assert.equal(G.quickHarvestStatus(s, T).noRoom, true); assert.equal(s.plots[0].cropId, "wheat");
});
test("offline return never creates stamps or claims rewards automatically", () => {
  const s = fresh(); complete(s, T); const coins = s.coins;
  const m = S.migrate(JSON.parse(JSON.stringify(s)));
  G.applyOffline(m, T + 3 * DAY);
  const st = D.status(m, T + 3 * DAY);
  assert.equal(st.stamps, 1); assert.equal(st.done, 0); assert.ok(m.coins >= coins);
});
test("unknown daily actions and invalid quantities never grant progress", () => {
  const s = fresh(); for (const n of [-1, NaN, Infinity, "3"]) { D.record(s, "water", n, T); D.record(s, "harvest", n, T); }
  const st = D.status(s, T); assert.equal(st.tasks[0].have, 0); assert.equal(st.tasks[1].have, 0);
  assert.equal(D.claim(s, "missing", st.day, T).ok, false);
});
test("daily action set stays distinct across several days", () => {
  const s = fresh();
  for (let i = 0; i < 6; i++) assert.deepEqual(D.status(s, T + i * DAY).tasks.map((task) => task.id), ["water", "talk", "sell"]);
});
console.log(`R80 daily: ${passed} passed`);
