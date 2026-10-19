"use strict";
// R79 招牌玩法「陽光光斑」規則測試（DOM-free）。
const assert = require("node:assert/strict");
global.window = undefined;
const C = require("../src/config.js");
Object.assign(globalThis, C);
const State = require("../src/state.js");
const G = require("../src/game.js");

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log("  ✓ " + name);
}
const fixed = (v) => () => v;
const T0 = 1_800_000_000_000;
function fresh() {
  const s = State.defaultState(T0);
  s.coins = 500;
  return s;
}

console.log("R79 陽光光斑");

check("沒有種過作物時不會出現光斑", () => {
  const s = fresh();
  for (let t = 0; t < 120000; t += 1000) assert.equal(G.updateSunpatch(s, T0 + t, fixed(0.5)).spawned, false);
  assert.equal(G.sunpatchActive(s, T0 + 120000), false);
});

check("種下第一株後約 4 秒出現第一道光，且只第一次標記 first", () => {
  const s = fresh();
  assert.equal(G.plant(s, 0, "wheat", T0).ok, true);
  assert.equal(G.updateSunpatch(s, T0, fixed(0.5)).spawned, false);
  assert.equal(G.updateSunpatch(s, T0 + G.SUNPATCH.firstDelayMs - 1, fixed(0.5)).spawned, false);
  const r = G.updateSunpatch(s, T0 + G.SUNPATCH.firstDelayMs, fixed(0.5));
  assert.equal(r.spawned, true);
  assert.equal(r.first, true);
  assert.equal(G.sunpatchActive(s, T0 + G.SUNPATCH.firstDelayMs + 1), true);
  assert.ok(s.sun.plots.includes(0), "優先照在有作物的田上");
  assert.ok(s.sun.plots.length >= 1 && s.sun.plots.length <= G.SUNPATCH.maxPlots);
});

check("光斑 16 秒後消失，間隔後再出現，第二次不再標記 first", () => {
  const s = fresh();
  G.plant(s, 0, "wheat", T0);
  G.updateSunpatch(s, T0, fixed(0.5));
  const start = T0 + G.SUNPATCH.firstDelayMs;
  G.updateSunpatch(s, start, fixed(0.5));
  const end = start + G.SUNPATCH.durationMs;
  assert.equal(G.updateSunpatch(s, end, fixed(0.5)).expired, true);
  assert.equal(G.sunpatchActive(s, end), false);
  assert.equal(G.updateSunpatch(s, end + G.SUNPATCH.intervalMs - 1, fixed(0.5)).spawned, false);
  const again = G.updateSunpatch(s, end + G.SUNPATCH.intervalMs, fixed(0.5));
  assert.equal(again.spawned, true);
  assert.equal(again.first, false);
});

function sunOn(s, plots, now) {
  G.ensureSunState(s);
  Object.assign(s.sun, { plots, used: [], startsAt: now - 1, endsAt: now + G.SUNPATCH.durationMs, nextAt: now + 60000 });
}

check("在光裡收成多 1 份、多 2 經驗，統計 +1，同一格不能重複領", () => {
  const s = fresh();
  G.plant(s, 0, "wheat", T0);
  const t = T0 + 20000;
  sunOn(s, [0, 1], t);
  const xpBefore = s.xp;
  const r = G.harvest(s, 0, t);
  assert.equal(r.ok, true);
  assert.equal(r.added, C.CROPS.wheat.yield + 1);
  assert.equal(s.xp - xpBefore, C.CROPS.wheat.xp + 2);
  assert.deepEqual(r.sun, { kind: "harvest", bonus: 1, xpBonus: 2 });
  assert.equal(s.stats.sunCatches, 1);
  assert.equal(G.isSunlit(s, 0, t), false, "這一格已用過這道光");
  G.plant(s, 0, "wheat", t);
  assert.equal(G.harvest(s, 0, t + 20000).sun, undefined);
});

check("光外收成維持原本產量", () => {
  const s = fresh();
  G.plant(s, 2, "wheat", T0);
  sunOn(s, [0, 1], T0 + 20000);
  const r = G.harvest(s, 2, T0 + 20000);
  assert.equal(r.added, C.CROPS.wheat.yield);
  assert.equal(r.sun, undefined);
});

check("在光裡澆水：立刻推進 30% 成長時間，且仍是濕土", () => {
  const s = fresh();
  G.plant(s, 0, "wheat", T0);
  const t = T0 + 1000;
  sunOn(s, [0], t);
  const before = G.getCropProgress(s, s.plots[0], t).ratio;
  const r = G.waterPlot(s, 0, t);
  assert.equal(r.ok, true);
  assert.equal(r.sun.kind, "growth");
  const after = G.getCropProgress(s, s.plots[0], t);
  assert.equal(after.wet, true);
  assert.ok(after.ratio - before >= 0.29, `ratio ${before} -> ${after.ratio}`);
});

check("在光裡種下：作物一開始就長了 30%", () => {
  const s = fresh();
  sunOn(s, [3], T0);
  const r = G.plant(s, 3, "wheat", T0);
  assert.equal(r.sun.kind, "growth");
  const prog = G.getCropProgress(s, s.plots[3], T0);
  assert.ok(Math.abs(prog.ratio - 0.3) < 0.01, String(prog.ratio));
});

check("長週期作物的加速有 3 分鐘上限", () => {
  const s = fresh();
  s.level = 10;
  sunOn(s, [0], T0);
  const r = G.plant(s, 0, "pumpkin", T0);
  assert.equal(r.ok, true);
  assert.equal(r.sun.boostMs, G.SUNPATCH.growthBoostCapMs);
});

check("雨天、雪天、霧、暴風雨不出光斑，會延後重試", () => {
  for (const w of ["rain", "snow", "fog", "storm"]) {
    const s = fresh();
    s.level = 10;
    G.plant(s, 0, "wheat", T0);
    G.updateSunpatch(s, T0, fixed(0.5));
    s.weather = { id: w, untilMs: T0 + 10 * 60000 };
    const r = G.updateSunpatch(s, T0 + G.SUNPATCH.firstDelayMs, fixed(0.5));
    assert.equal(r.spawned, false, w);
    assert.ok(s.sun.nextAt > T0 + G.SUNPATCH.firstDelayMs, w);
  }
});

check("晴朗天氣間隔較短", () => {
  const s = fresh();
  s.level = 10;
  G.plant(s, 0, "wheat", T0);
  G.updateSunpatch(s, T0, fixed(0.5));
  s.weather = { id: "sunny", untilMs: T0 + 10 * 60000 };
  const start = T0 + G.SUNPATCH.firstDelayMs;
  G.updateSunpatch(s, start, fixed(0.5));
  assert.equal(s.sun.nextAt - start, G.SUNPATCH.durationMs + G.SUNPATCH.sunnyIntervalMs);
});

check("離線很久回來只補一道光，不會連續觸發", () => {
  const s = fresh();
  G.plant(s, 0, "wheat", T0);
  G.updateSunpatch(s, T0, fixed(0.5));
  const back = T0 + 6 * 3600000;
  assert.equal(G.updateSunpatch(s, back, fixed(0.5)).spawned, true);
  assert.equal(G.updateSunpatch(s, back + 1000, fixed(0.5)).spawned, false);
});

check("優先照在可收成的田", () => {
  const s = fresh();
  G.plant(s, 0, "wheat", T0);
  G.plant(s, 4, "wheat", T0 + 30000);
  G.plant(s, 5, "wheat", T0 + 30000);
  s.sun = { plots: [], used: [], startsAt: 0, endsAt: 0, nextAt: T0 + 30000, introduced: true };
  G.updateSunpatch(s, T0 + 30000, fixed(0.5));
  assert.ok(s.sun.plots.includes(0), JSON.stringify(s.sun.plots));
});

check("壞掉的存檔欄位會被修正，不會丟例外", () => {
  for (const bad of [null, 5, "x", [], { plots: "a", used: [99, -1, 1.5], startsAt: NaN, endsAt: -3, nextAt: "1" }]) {
    const s = fresh();
    s.sun = bad;
    const sun = G.ensureSunState(s);
    assert.ok(Array.isArray(sun.plots) && Array.isArray(sun.used));
    assert.equal(sun.used.every((i) => Number.isInteger(i) && i >= 0 && i < s.plots.length), true);
    assert.equal(sun.startsAt, 0); assert.equal(sun.endsAt, 0); assert.equal(sun.nextAt, 0);
  }
  const migrated = State.migrate(Object.assign(fresh(), { sun: { plots: [0, 1], used: [], startsAt: T0, endsAt: T0 + 1000, nextAt: T0 + 5000, introduced: true } }));
  assert.deepEqual(migrated.sun.plots, [0, 1], "遷移保留合法光斑");
});

check("離線結算不會吃到過期光斑的加成", () => {
  const s = fresh();
  G.plant(s, 0, "wheat", T0);
  sunOn(s, [0], T0 + 1000);
  s.lastSeenAt = T0 + 2000;
  const r = G.harvest(s, 0, T0 + 3600000);
  assert.equal(r.added, C.CROPS.wheat.yield);
});

console.log(`\n✅ R79 sunpatch PASS (${passed} checks)`);
