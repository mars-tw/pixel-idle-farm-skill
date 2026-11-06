"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const C = require("../src/config.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const D = require("../src/daily.js");
const A = require("../src/adventure.js");

const T = Date.parse("2026-11-05T09:00:00+08:00");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }
const source = (path) => fs.readFileSync(path, "utf8");

test("A1 Lv1 first-day orders stay closed until the main wheat delivery, then contain only unlocked crops", () => {
  const s = S.defaultState(T);
  assert.deepEqual(G.refreshOrders(s, T, () => 0.1), []);
  A.ensure(s, T); s.adventure.claimed.c1_first_harvest = true;
  const orders = G.refreshOrders(s, T, () => 0.1);
  assert.equal(orders.length, C.GAME.orderSlots);
  for (const order of orders) for (const id of Object.keys(order.wants)) {
    assert.ok(C.CROPS[id], `${id} must be a crop`);
    assert.ok(C.CROPS[id].unlockLevel <= s.level, `${id} must be unlocked at Lv${s.level}`);
  }
});

test("A1 market gate replaces reserve labels and confirmation", () => {
  const s = S.defaultState(T); G.refreshOrders(s, T, () => 0.1);
  assert.equal(s.orders.length, 0);
  const ui = source("src/ui.js");
  assert.match(ui, /把 2 份小麥交給老農班伯後開放/);
  assert.doesNotMatch(ui, /主線保留 2 份小麥|交付後會動用主線保留/);
});

test("A2 upgrade shortfall is exact and affordable upgrades have no shortfall", () => {
  const s = S.defaultState(T);
  s.coins = 25;
  assert.equal(C.UPGRADES.growthSpeed.levels[0].cost, 50);
  assert.equal(G.upgradeShortfall(s, "growthSpeed"), 25);
  assert.equal(G.canBuyUpgrade(s, "growthSpeed"), false);
  s.coins = 50;
  assert.equal(G.upgradeShortfall(s, "growthSpeed"), 0);
  assert.equal(G.canBuyUpgrade(s, "growthSpeed"), true);
  assert.doesNotMatch(source("src/ui.js"), /先累積 \$\{fmtNum\(next\.cost - state\.coins\)\}/);
});

test("A2 first completed order makes at least one upgrade affordable", () => {
  const s = S.defaultState(T); A.ensure(s, T); s.adventure.claimed.c1_first_harvest = true; G.refreshOrders(s, T, () => 0.1);
  for (let i = 0; i < 3; i++) assert.equal(G.plant(s, i, "wheat", T).ok, true);
  for (let i = 0; i < 3; i++) assert.equal(G.harvest(s, i, T + C.CROPS.wheat.growMs + 1).ok, true);
  const first = s.orders.find((order) => order.id === "beginner_wheat_2");
  assert.equal(G.fulfillOrder(s, first.id, T + C.CROPS.wheat.growMs + 2, () => 0.1).ok, true);
  assert.ok(C.UPGRADE_ORDER.some((key) => G.canBuyUpgrade(s, key)), `coins after first order: ${s.coins}`);
});

test("A3 material HUD and gain feedback name the resource clearly", () => {
  const ui = source("src/ui.js");
  assert.match(ui, /class="material-name">🪵 木料/);
  assert.match(ui, /class="material-name">🪨 石材/);
  assert.match(ui, /title="材料：\$\{detail\}"/);
  assert.match(ui, /＋\$\{v\} \$\{k === "wood" \? "木料"/);
});

test("A4 daily goals are distinct from chapter-one harvest and wheat delivery", () => {
  const s = S.defaultState(T);
  const tasks = D.status(s, T).tasks;
  assert.deepEqual(tasks.map((task) => task.id), ["water", "talk", "sell"]);
  const text = tasks.map((task) => `${task.title} ${task.detail}`).join(" ");
  assert.doesNotMatch(text, /收成 6|交 2 份小麥|小麥餐籃/);
  assert.equal(new Set(tasks.map((task) => task.id)).size, 3);
});

test("A5 Bamber has named quest data, a marker, routing, and grandma note portrait", () => {
  assert.equal(C.NPCS.elder.name, "老農班伯");
  assert.deepEqual(C.QUESTS.first_delivery.marker, { kind: "npc", type: "elder" });
  const ui = source("src/ui.js"), world = source("src/world-ui.js");
  assert.match(ui, /quest-npc-nameplate/);
  assert.match(world, /if \(q\.canClaim\) return npcTile\(q\.npcId\)/);
  assert.match(world, /guide\.route === "order" \? openPanel\("orders"\) : q \? goQuest\(q\)/);
  assert.match(world, /r84\/grandma-0\.png/);
  assert.doesNotMatch(world.match(/hero\.innerHTML =[^;]+;/)[0], /miri-0\.png/);
});

console.log(`R29 content systems: ${passed} passed`);
