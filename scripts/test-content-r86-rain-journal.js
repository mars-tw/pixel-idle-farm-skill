"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const State = require("../src/state.js");
const Game = require("../src/game.js");
const Sun = require("../src/sunplay-r75.js");
const Rain = require("../src/rainplay-r85.js");

const T = Date.UTC(2026, 10, 19, 7);
const inspect = Sun.rainNotesPage;
const checked = state => inspect(state).rows.map(row => row.done);

function fresh() {
  const state = State.defaultState(T);
  state.coins = 150;
  state.level = 5;
  return state;
}

function plant(state, index, cropId, time) {
  assert.equal(Game.plant(state, index, cropId, time).ok, true);
}

function fillBarrel(state) {
  state.weather = { id: "rain", untilMs: T + Rain.FILL_MS + 30000 };
  assert.equal(Rain.update(state, T).started, true);
  assert.equal(Rain.pour(state, T).ok, false);
  for (let dt = 1000; dt <= Rain.FILL_MS; dt += 1000) Rain.update(state, T + dt);
  return T + Rain.FILL_MS;
}

function roundtrip(state) {
  return State.migrate(JSON.parse(JSON.stringify(state)));
}

test("雨水澆到缺水作物、虹光落田、虹光下入倉依序寫進手記", () => {
  let state = fresh();
  assert.deepEqual(checked(state), [false, false, false]);
  const fullAt = fillBarrel(state);
  plant(state, 0, "wheat", fullAt - 1000);
  const bucket = Rain.pour(state, fullAt);
  assert.deepEqual(bucket.watered, [0]);
  assert.deepEqual(checked(state), [true, false, false]);
  assert.equal(Rain.pour(state, fullAt).ok, false);
  state = roundtrip(state);
  const clearAt = fullAt + 31000;
  const light = Rain.update(state, clearAt);
  assert.ok(light.rainbow.includes(0));
  assert.deepEqual(checked(state), [true, true, false]);
  assert.equal(Rain.update(state, clearAt + 1).rainbow, null);
  state = roundtrip(state);
  Sun.harvestPreview(state, state.plots[0], true);
  assert.equal(inspect(state).count, 2, "只看收成預估不算進度");
  const result = Game.harvest(state, 0, clearAt + 2, () => 1);
  assert.ok(result.ok && result.added > 0);
  assert.equal(inspect(state).count, 3);
  assert.match(inspect(state).memory, /小麥/);
  const first = structuredClone(state.r86RainNotes);
  assert.equal(Game.harvest(state, 0, clearAt + 2).ok, false);
  assert.deepEqual(roundtrip(state).r86RainNotes, first);
});

test("空田、已澆田與成熟作物都不能取得澆水紀錄；倒過桶仍可取得虹光紀錄", () => {
  for (const already of ["empty", "wet", "ripe"]) {
    const state = fresh();
    const fullAt = fillBarrel(state);
    if (already === "wet") {
      plant(state, 0, "wheat", fullAt - 1000);
      Game.waterPlot(state, 0, fullAt - 500);
    }
    if (already === "ripe") plant(state, 0, "wheat", T - 100000);
    assert.deepEqual(Rain.pour(state, fullAt).watered, [], already);
    assert.equal(inspect(state).count, 0, already);
    const drop = Rain.update(state, fullAt + 31000);
    assert.ok(drop.rainbow.length > 0);
    assert.deepEqual(checked(state), [false, true, false], already);
    assert.equal(inspect(state).memory, "");
  }
});

test("普通日照、預告、光照過的作物、未照到的田、用過或消失的虹光都不算", () => {
  for (const kind of ["ordinary", "preview", "sunGrown", "other", "used", "expired", "notYet", "corrupt"]) {
    const state = fresh();
    plant(state, 0, "wheat", T - 100000);
    const sun = Game.ensureSunState(state);
    Object.assign(sun, { startsAt: T - 500, endsAt: T + 1000, plots: [0], used: [], rainbow: true });
    if (kind === "ordinary") sun.rainbow = false;
    if (kind === "preview") Object.assign(sun, { plots: [], previewPlots: [0], previewAt: T + 200 });
    if (kind === "sunGrown") { sun.plots = []; state.plots[0].sunGrown = true; }
    if (kind === "other") sun.plots = [1];
    if (kind === "used") sun.used = [0];
    if (kind === "expired") sun.endsAt = T;
    if (kind === "notYet") sun.startsAt = T + 1;
    if (kind === "corrupt") sun.rainbow = "false";
    assert.ok(Game.harvest(state, 0, T, () => 1).added > 0, kind);
    assert.equal(inspect(state).count, 0, kind);
  }
});

test("未熟與倉滿不記，批次收成只留第一種入倉作物", () => {
  const state = fresh();
  state.upgrades.plotCount = 1;
  plant(state, 0, "wheat", T - 1000);
  plant(state, 1, "carrot", T - 100000);
  plant(state, 2, "wheat", T - 100000);
  assert.equal(Rain.spawnRainbow(state, T).length, 4);
  assert.equal(Game.harvest(state, 0, T).reason, "not_ready");
  const full = roundtrip(state);
  full.storage.items.wheat = Game.storageCapacity(full);
  assert.equal(Game.harvest(full, 1, T, () => 1).added, 0);
  assert.equal(inspect(full).count, 1);
  const batch = Game.harvestAll(state, T);
  assert.ok(batch.perCrop.carrot > 0 && batch.perCrop.wheat > 0);
  assert.deepEqual(checked(state), [false, true, true]);
  assert.equal(state.r86RainNotes.crop, "carrot");
  assert.match(inspect(state).rows[2].text, /胡蘿蔔/);
  assert.equal(roundtrip(state).r86RainNotes.crop, "carrot");
});

test("舊檔只採用已落田的虹光次數，格式錯誤或不明作物不冒領", () => {
  const old = fresh();
  old.r85Rain = { pours: 8, hinted: true, pendingRainbow: true, rainbows: 0 };
  old.stats.sunCatches = 20;
  old.stats.harvested.wheat = 500;
  assert.deepEqual(checked(roundtrip(old)), [false, false, false]);
  old.r85Rain.rainbows = 2;
  assert.deepEqual(checked(roundtrip(old)), [false, true, false]);
  old.r85Rain.rainbows = "2";
  old.r86RainNotes = { watered: "true", lit: "true", crop: "__proto__" };
  assert.deepEqual(checked(roundtrip(old)), [false, false, false]);
});

test("手冊重建與切換存檔，各自保留雨後手記的開合", () => {
  const fs = require("node:fs");
  const vm = require("node:vm");
  let live = fresh(), section = null;
  const panel = {
    querySelector: () => section,
    querySelectorAll: () => section ? [section] : [],
    insertBefore(node) { section = node; },
  };
  const doc = {
    readyState: "loading",
    addEventListener() {},
    getElementById: id => id === "journalPanel" ? panel : null,
    createElement() {
      return {
        set innerHTML(html) {
          assert.match(html, /<details[^>]*data-r86-rain-notes/);
          const rain = { open: false };
          this.firstElementChild = {
            rain,
            querySelector: selector => selector === "[data-r86-rain-notes]" ? rain : null,
            querySelectorAll: () => [],
            remove() { section = null; },
          };
        },
      };
    },
  };
  const window = { __farm: { state: () => live }, CONFIG: require("../src/config.js"),
    FarmSunplay: { rainNotesPage: inspect } };
  vm.runInNewContext(fs.readFileSync(require.resolve("../src/sunbook-r76.js"), "utf8"), { window, document: doc });
  const rebuild = state => {
    live = state;
    window.FarmSunbook.inject(state);
    assert.ok(section, "正式手冊模板應插回圖鑑頁");
    return section.rain;
  };
  const first = live, second = fresh();
  const original = rebuild(first);
  assert.equal(original.open, false);
  original.open = true;
  assert.equal(rebuild(first).open, true, "集章重畫時保持展開");
  section = null;
  window.FarmSunbook.inject();
  assert.equal(section.rain.open, true, "圖鑑先清空、未帶參數補畫時保持展開");
  assert.equal(rebuild(second).open, false, "另一份存檔從收合狀態開始");
  assert.equal(rebuild(first).open, true);
  section.rain.open = false;
  section = null;
  assert.equal(rebuild(first).open, false, "使用者主動闔上後，重畫也保持收合");
});
