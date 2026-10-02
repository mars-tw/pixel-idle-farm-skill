"use strict";
// Run: node scripts/test-adventure.js. No browser, storage, or generated files.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const A = require("../src/adventure.js");
const S = require("../src/state.js");
const G = require("../src/game.js");
const C = require("../src/config.js");
const T0 = 2000000;
let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("PASS " + name); }
  catch (error) { failed++; console.error("FAIL " + name + "\n" + error.stack); }
}
function good(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result; }
function fresh() { const state = S.defaultState(T0); good(A.ensure(state, T0)); return state; }
function snapshot(value) { return JSON.stringify(value); }
function q(state, id) { return A.quests(state, T0).find((entry) => entry.id === id); }
function unlockThrough(state, id) {
  for (const entry of A.quests(state, T0)) { state.adventure.claimed[entry.id] = true; if (entry.id === id) break; }
  good(A.ensure(state, T0));
}
function wakeFarm(state) {
  good(A.record(state, { type: "talk", npcId: "mayor" }, T0));
  good(A.record(state, { type: "plant", count: 3 }, T0));
  good(A.record(state, { type: "water", count: 3 }, T0));
}
function fishable() {
  const state = fresh();
  state.adventure.projects.fishing_dock = { restored: true, restoredAt: T0 };
  good(A.ensure(state, T0));
  return state;
}

test("new state is additive, deterministic, and has nine causally ordered quests", () => {
  const state = S.defaultState(T0); const before = snapshot(state);
  good(A.ensure(state, T0));
  const { adventure, ...unchanged } = state;
  assert.equal(snapshot(unchanged), before);
  const once = snapshot(state); good(A.ensure(state, T0)); assert.equal(snapshot(state), once);
  const list = A.quests(state, T0);
  assert.equal(list.length, 9);
  assert.deepEqual(list.map((entry) => entry.status), ["active", ...Array(8).fill("locked")]);
  for (let chapter = 1; chapter <= 3; chapter++) assert.equal(list.filter((entry) => entry.chapter === chapter).length, 3);
  for (const entry of list) {
    assert.ok(C.NPCS[entry.npcId]);
    assert.ok(entry.name && entry.description && entry.target);
    assert.ok(entry.objectives.length);
    assert.ok(entry.objectives.every((objective) => Number.isFinite(objective.current) && objective.required > 0));
    assert.ok(entry.reward.materials);
  }
  assert.equal(adventure.counts.care, 0, "initial lastCaredAt is not evidence of care");
});

test("old save migration uses harvested quantities, not map key counts", () => {
  const state = S.defaultState(T0);
  state.stats = { harvested: { wheat: 12, carrot: 3, bad: NaN }, totalHarvested: 10, plantCount: 8, fulfilledOrders: 4, collected: { river_mint: 2, egg: 7 } };
  state.storage.items = { wheat: 4, carrot: 2 };
  state.story.dialogueSeen = { mayor: true, elder: true };
  state.story.completed = { first_water: true };
  const story = snapshot(state.story); const before = snapshot(state);
  good(A.ensure(state, T0));
  assert.equal(state.adventure.counts.harvest, 15);
  assert.equal(state.adventure.counts.plant, 8);
  assert.equal(state.adventure.counts.water, 1, "do not invent untracked historical watering");
  assert.equal(state.adventure.counts.forage, 2);
  assert.equal(state.adventure.byTarget.forage.river_mint, 2);
  assert.equal(state.adventure.counts.order, 4);
  assert.equal(snapshot(state.story), story);
  const { adventure, ...rest } = state; assert.equal(snapshot(rest), before);
  const counts = snapshot(adventure.counts);
  good(A.ensure(state, T0 + 1)); good(A.ensure(S.migrate(state), T0 + 2));
  assert.equal(snapshot(adventure.counts), counts);
  assert.deepEqual(adventure.claimed, {});
});

test("minimal legacy saves and care lower bounds migrate without resetting the save", () => {
  const state = { coins: 45, stats: { harvested: 6, totalHarvested: 9, careCount: 5 }, plots: {}, animals: {}, story: { completed: {}, dialogueSeen: {} } };
  good(A.ensure(state, 0)); assert.equal(state.adventure.counts.harvest, 9); assert.equal(state.adventure.counts.care, 5);
  assert.equal(state.coins, 45); assert.equal(state.adventure.createdAt, 0);
  const other = S.defaultState(T0);
  other.animals[0].lastFedAt = T0; other.animals[0].lastWateredAt = T0; other.animals[0].lastGroomedAt = T0;
  good(A.ensure(other, T0)); assert.equal(other.adventure.counts.care, 3);
});

test("pre-accumulated actions are visible while locked and survive quest activation", () => {
  const state = fresh();
  good(A.record(state, { type: "harvest", cropId: "wheat", added: 6 }, T0));
  good(A.record(state, { type: "talk", npcId: "elder" }, T0)); state.storage.items.wheat = 2;
  const second = q(state, "c1_first_harvest"); assert.equal(second.status, "locked");
  assert.equal(second.objectives[0].current, 6);
  assert.equal(A.claim(state, second.id, T0).reason, "locked");
  wakeFarm(state); good(A.claim(state, "c1_homecoming", T0));
  assert.equal(q(state, second.id).status, "ready"); good(A.claim(state, second.id, T0));
  assert.equal(state.adventure.counts.harvest, 6);
});

test("repeated claims and save reloads grant rewards only once", () => {
  const state = fresh(); wakeFarm(state);
  const coins = state.coins; const xp = state.xp;
  good(A.claim(state, "c1_homecoming", T0));
  assert.equal(state.coins, coins + 12); assert.equal(state.xp, xp + 2);
  assert.equal(state.materials.wood, 6); assert.equal(state.materials.stone, 2);
  const before = snapshot(state);
  assert.equal(A.claim(state, "c1_homecoming", T0).reason, "already_claimed"); assert.equal(snapshot(state), before);
  const reloaded = S.migrate(JSON.parse(before)); good(A.ensure(reloaded, T0));
  assert.equal(A.claim(reloaded, "c1_homecoming", T0).reason, "already_claimed");
  assert.equal(reloaded.coins, state.coins);
  reloaded.adventure.quests.c1_homecoming.status = "ready";
  good(A.ensure(reloaded, T0)); assert.equal(q(reloaded, "c1_homecoming").status, "claimed");
  delete reloaded.adventure.quests.c1_homecoming;
  good(A.ensure(reloaded, T0)); assert.equal(q(reloaded, "c1_homecoming").status, "claimed");
});

test("ready state persists, but missing delivery items cannot be claimed", () => {
  const state = fresh(); wakeFarm(state); good(A.claim(state, "c1_homecoming", T0));
  good(A.record(state, { type: "harvest", qty: 6 }, T0)); good(A.record(state, { type: "talk", npcId: "elder" }, T0));
  state.storage.items.wheat = 2; assert.equal(q(state, "c1_first_harvest").status, "ready");
  const readyAt = state.adventure.quests.c1_first_harvest.readyAt;
  delete state.storage.items.wheat;
  assert.equal(q(state, "c1_first_harvest").status, "ready"); assert.equal(q(state, "c1_first_harvest").canClaim, false);
  const coins = state.coins;
  assert.equal(A.claim(state, "c1_first_harvest", T0).reason, "missing_resources"); assert.equal(state.coins, coins);
  assert.equal(state.adventure.quests.c1_first_harvest.readyAt, readyAt);
  state.storage.items.wheat = 2; good(A.claim(state, "c1_first_harvest", T0)); assert.equal(state.storage.items.wheat, undefined);
});

test("all project resource checks are atomic and restoration is one-time", () => {
  for (const [id, previous, supplies] of [
    ["fishing_dock", "c1_first_meal", { wood: 4, stone: 1 }],
    ["picnic_table", "c2_river_basket", { wood: 6, wheat: 3 }],
    ["garden", "c3_good_neighbors", { coins: 79, wood: 4 }],
  ]) {
    const state = fresh(); unlockThrough(state, previous);
    for (const [key, amount] of Object.entries(supplies)) {
      if (key === "coins") state.coins = amount;
      else if (C.MATERIALS[key]) state.materials[key] = amount;
      else state.storage.items[key] = amount;
    }
    const before = snapshot([state.coins, state.materials, state.storage]);
    assert.equal(A.restore(state, id, T0).reason, "missing_resources");
    assert.equal(snapshot([state.coins, state.materials, state.storage]), before);
    const p = A.projects(state).find((entry) => entry.id === id);
    for (const need of p.requirements) {
      if (need.source === "coins") state.coins = need.required;
      else if (need.source === "materials") state.materials[need.id] = need.required;
      else state.storage.items[need.id] = need.required;
    }
    good(A.restore(state, id, T0)); const once = snapshot(state);
    assert.equal(A.restore(state, id, T0).reason, "already_restored"); assert.equal(snapshot(state), once);
  }
});

test("cooking checks all ingredients, consumes once, and never pollutes crop storage", () => {
  const state = fresh(); state.storage.items = { wheat: 5, carrot: 1, river_mint: 1 };
  assert.equal(A.cook(state, "rustic_bread", T0).reason, "locked");
  unlockThrough(state, "c1_first_harvest");
  good(A.cook(state, "rustic_bread", T0)); assert.equal(state.storage.items.wheat, 3); assert.equal(state.adventure.meals.rustic_bread, 1);
  assert.equal(state.adventure.counts.cook, 1); assert.equal(state.adventure.byTarget.cook.rustic_bread, 1);
  assert.equal(state.storage.items.rustic_bread, undefined);
  assert.equal(A.cook(state, "baked_carrot", T0).reason, "locked");
  state.adventure.projects.picnic_table.restored = true;
  const before = snapshot(state.storage);
  assert.equal(A.cook(state, "baked_carrot", T0).reason, "missing_resources"); assert.equal(snapshot(state.storage), before);
  state.storage.items.carrot = 2;
  good(A.cook(state, "baked_carrot", T0)); good(A.cook(state, "mint_tea", T0));
  assert.deepEqual(state.storage.items, { wheat: 1 });
  assert.equal(state.adventure.meals.baked_carrot, 1); assert.equal(state.adventure.meals.mint_tea, 1);
  state.adventure.meals.rustic_bread = 99;
  assert.equal(A.cook(state, "rustic_bread", T0).reason, "meals_full"); assert.equal(state.storage.items.wheat, 1);
});

test("fish requires a real restored dock, respects 30s cooldown, and pays no coins", () => {
  const state = fresh();
  assert.equal(A.fish(state, T0, () => 0).reason, "locked");
  good(A.record(state, { type: "restore", projectId: "fishing_dock" }, T0));
  assert.equal(A.fish(state, T0, () => 0).reason, "locked", "record must not fake a restored project");
  state.adventure.projects.fishing_dock.restored = true;
  const economy = snapshot([state.coins, state.xp, state.storage, state.stats.totalCoinsEarned]);
  const first = good(A.fish(state, 0, () => 0)); assert.equal(first.catch.qty, 1); assert.equal(first.catch.id, "river_carp");
  assert.equal(first.catch.quality, "normal"); assert.equal(state.adventure.lastFishAt, 0);
  assert.equal(A.fish(state, 29999, () => 0).remainingMs, 1);
  assert.equal(A.fish(state, -1, () => 0).reason, "bad_time");
  good(A.fish(state, 30000, () => 1)); assert.equal(state.adventure.catch.river_perch, 1);
  assert.equal(A.fish(state, 29999, () => 0).reason, "cooldown", "time rollback cannot reset cooldown");
  assert.equal(snapshot([state.coins, state.xp, state.storage, state.stats.totalCoinsEarned]), economy);
});

test("eight-hour absence does not bank casts; catch capacity bounds every quantity", () => {
  const state = fishable(); good(A.fish(state, T0, () => 0));
  let now = T0 + 8 * 60 * 60 * 1000;
  good(A.fish(state, now, () => 0)); assert.equal(state.adventure.catch.river_carp, 2);
  assert.equal(A.fish(state, now, () => 0).reason, "cooldown");
  for (let i = 2; i < 99; i++) { now += 30000; good(A.fish(state, now, () => 0)); }
  assert.equal(A.summary(state, now).fishing.used, 99);
  const count = state.adventure.counts.fish;
  assert.equal(A.fish(state, now + 30000, () => { throw new Error("must not draw RNG when full"); }).reason, "catch_full");
  assert.equal(state.adventure.counts.fish, count);
});

test("injected RNG is bounded and invalid RNG does not add a catch or start cooldown", () => {
  const state = fishable();
  for (const rng of [() => NaN, () => Infinity, () => { throw new Error("rng unavailable"); }, 42]) {
    assert.equal(A.fish(state, T0, rng).reason, "bad_rng"); assert.equal(state.adventure.lastFishAt, null);
    assert.equal(A.summary(state, T0).fishing.used, 0);
  }
  let calls = 0; const values = [-8, 0.8];
  const result = good(A.fish(state, T0, () => values[calls++]));
  assert.equal(calls, 2); assert.equal(result.catch.id, "river_carp"); assert.equal(result.catch.quality, "good");
  assert.equal(A.fish(state, T0 + 1, () => { throw new Error("cooldown must not draw RNG"); }).reason, "cooldown");
});

test("unknown IDs, invalid counts, failed actions, and NaN time cannot grant rewards", () => {
  const state = fresh(); const before = snapshot(state);
  for (const id of ["unknown", "__proto__", "constructor", NaN, null]) {
    assert.equal(A.claim(state, id, T0).ok, false); assert.equal(A.restore(state, id, T0).ok, false); assert.equal(A.cook(state, id, T0).ok, false);
  }
  for (const count of [NaN, Infinity, -1, 0, 1.5, "3"]) assert.equal(A.record(state, { type: "plant", count }, T0).reason, "bad_count");
  assert.equal(A.record(state, "bad", T0).reason, "unknown_event");
  assert.equal(A.record(state, { type: "talk", npcId: "farmer" }, T0).reason, "unknown_target");
  assert.equal(A.record(state, { type: "forage", itemId: "__proto__" }, T0).reason, "unknown_target");
  assert.equal(A.record(state, { type: "harvest", cropId: NaN }, T0).reason, "unknown_target");
  assert.equal(A.record(state, { type: "plant", cropId: "unknown" }, T0).reason, "unknown_target");
  assert.equal(A.record(state, { type: "fish", id: "unknown" }, T0).reason, "unknown_target");
  assert.equal(A.record(state, { type: "care", ok: false }, T0).reason, "failed_event");
  for (const result of [A.ensure(state, NaN), A.record(state, "care", NaN), A.claim(state, "c1_homecoming", NaN), A.restore(state, "garden", NaN), A.cook(state, "mint_tea", NaN), A.fish(state, NaN), A.summary(state, NaN)]) assert.equal(result.reason, "bad_time");
  assert.equal(snapshot(state), before);
  for (const bad of [null, [], 3]) { assert.equal(A.ensure(bad, T0).reason, "bad_state"); assert.deepEqual(A.quests(bad, T0), []); }
  good(A.record(state, { type: "harvest", count: 1000000 }, T0)); assert.equal(state.adventure.counts.harvest, 100);
  good(A.record(state, { type: "forage", id: "river_mint" }, T0)); assert.equal(state.adventure.byTarget.forage.river_mint, 1);
});

test("mixed meal/catch delivery does not consume any resource when one is missing", () => {
  const state = fresh(); unlockThrough(state, "c3_garden");
  for (const project of Object.values(state.adventure.projects)) project.restored = true;
  good(A.record(state, { type: "talk", npcId: "child" }, T0));
  state.adventure.meals = { rustic_bread: 1, baked_carrot: 1, mint_tea: 1 };
  state.adventure.catch.river_carp = 1;
  const before = snapshot([state.adventure.meals, state.adventure.catch, state.coins, state.xp]);
  assert.equal(A.claim(state, "c3_harvest_picnic", T0).reason, "missing_resources");
  assert.equal(snapshot([state.adventure.meals, state.adventure.catch, state.coins, state.xp]), before);
  state.adventure.catch.silver_dace = 1; good(A.claim(state, "c3_harvest_picnic", T0));
  assert.equal(A.summary(state, T0).fishing.used, 0);
});

test("extreme legacy balances cannot overflow into non-finite or unsafe reward quantities", () => {
  const state = fresh(); wakeFarm(state);
  state.coins = Number.MAX_SAFE_INTEGER; state.xp = Number.MAX_SAFE_INTEGER;
  state.materials.wood = Number.MAX_SAFE_INTEGER; state.stats.totalCoinsEarned = Number.MAX_SAFE_INTEGER;
  good(A.claim(state, "c1_homecoming", T0));
  for (const value of [state.coins, state.xp, state.materials.wood, state.stats.totalCoinsEarned]) assert.equal(value, Number.MAX_SAFE_INTEGER);
});

test("corrupt adventure quantities are finite and bounded; NaN resources are not spendable", () => {
  const state = fresh(); state.adventure.counts.care = NaN; state.adventure.counts.plant = Infinity;
  state.adventure.meals.rustic_bread = Infinity; state.adventure.catch = { river_carp: 100000, river_perch: 100000, bogus: 77 }; state.adventure.lastFishAt = NaN;
  good(A.ensure(state, T0)); assert.equal(state.adventure.counts.care, 0); assert.equal(state.adventure.counts.plant, 0);
  assert.equal(state.adventure.meals.rustic_bread, 0); assert.equal(state.adventure.lastFishAt, null);
  assert.equal(A.summary(state, T0).fishing.used, 99); assert.equal(state.adventure.catch.bogus, undefined);
  unlockThrough(state, "c3_good_neighbors"); state.coins = NaN; state.materials.wood = 4;
  assert.equal(A.restore(state, "garden", T0).reason, "missing_resources"); assert.equal(state.materials.wood, 4);
  state.adventure.projects.picnic_table.restored = true; state.storage.items = { wheat: 2, carrot: NaN };
  assert.equal(A.cook(state, "baked_carrot", T0).reason, "missing_resources"); assert.equal(state.storage.items.wheat, 2);
});

test("ready and claimed partial adventure saves retain their status and cooldown", () => {
  const state = S.defaultState(T0);
  state.adventure = { quests: { c1_homecoming: { status: "claimed" }, c1_first_harvest: { status: "ready" } }, projects: { fishing_dock: { status: "restored" } }, lastFishAt: T0 };
  const coins = state.coins; good(A.ensure(state, T0));
  assert.equal(q(state, "c1_homecoming").status, "claimed"); assert.equal(q(state, "c1_first_harvest").status, "ready");
  assert.equal(state.coins, coins); assert.equal(A.fish(state, T0 + 1, () => 0).reason, "cooldown");
  const reloaded = S.migrate(JSON.parse(snapshot(state))); good(A.ensure(reloaded, T0 + 2));
  assert.equal(q(reloaded, "c1_first_harvest").status, "ready"); assert.equal(reloaded.adventure.unlocks.fishingRod, true);
});

test("query descriptors are detached and project sites match the new world", () => {
  const state = fresh(); const list = A.quests(state, T0); list[0].reward.coins = 99999; list[0].goals[0].count = 999;
  assert.equal(q(state, "c1_homecoming").reward.coins, 12); assert.equal(q(state, "c1_homecoming").goals[0].count, 1);
  assert.deepEqual(A.projects(state).map((p) => p.target.tileId), ["t2_9", "t10_10", "t6_2"]);
  assert.ok(A.recipes(state).every((r) => r.target.tileId === "t10_10"));
  const view = A.summary(state, T0); view.catch.river_carp = 999;
  assert.equal(state.adventure.catch.river_carp, 0);
});

test("CommonJS and browser window.AdventureAPI have the same pure API", () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/config.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/adventure.js"), "utf8"), context);
  const B = context.window.AdventureAPI;
  assert.deepEqual(Object.keys(B).sort(), Object.keys(A).sort());
  const state = S.defaultState(T0); const other = JSON.parse(snapshot(state));
  good(A.ensure(state, T0)); good(B.ensure(other, T0));
  assert.equal(snapshot(B.summary(other, T0)), snapshot(A.summary(state, T0)));
  assert.equal(context.window.claim, undefined, "no collision with existing game globals");
});

test("full three-chapter run uses real crops, care, orders and forage; no material injection", () => {
  const state = fresh(); let now = T0;
  const storyGuard = () => snapshot(state.story);
  function action(fn) { const before = storyGuard(); const result = fn(); assert.equal(storyGuard(), before, "AdventureAPI must not modify existing story"); return good(result); }
  function talk(id) { state.story.dialogueSeen[id] = true; action(() => A.record(state, { type: "talk", npcId: id }, now)); }
  function harvestBatch(cropId, count) {
    for (let i = 0; i < count; i++) {
      good(G.plant(state, i, cropId, now)); action(() => A.record(state, "plant", now)); G.advanceStory(state, "plant", now);
      good(G.waterPlot(state, i, now)); action(() => A.record(state, "water", now)); G.advanceStory(state, "water", now);
    }
    now += C.CROPS[cropId].growMs;
    for (let i = 0; i < count; i++) {
      const harvested = good(G.harvest(state, i, now)); action(() => A.record(state, { type: "harvest", cropId, added: harvested.added }, now)); G.advanceStory(state, "harvest", now);
    }
  }
  function deliverExistingOrder() {
    G.refreshOrders(state, now, () => 0);
    const order = state.orders.find((entry) => G.canFulfill(state, entry)); assert.ok(order, "a real existing order is affordable");
    good(G.fulfillOrder(state, order.id, now, () => 0)); action(() => A.record(state, "order", now)); G.advanceStory(state, "deliver", now);
  }
  G.advanceStory(state, "read_sign", now);
  talk("mayor"); talk("elder"); talk("merchant"); talk("child");
  harvestBatch("wheat", 3);
  action(() => A.claim(state, "c1_homecoming", now)); action(() => A.claim(state, "c1_first_harvest", now));
  action(() => A.cook(state, "rustic_bread", now)); action(() => A.claim(state, "c1_first_meal", now));
  assert.equal(A.summary(state, now).unlocks.fishingRod, true);
  action(() => A.restore(state, "fishing_dock", now)); action(() => A.claim(state, "c2_fishing_dock", now));
  deliverExistingOrder();
  // Bridge's existing chapter gate needs one clear action, but the adventure funds ALL bridge/project materials.
  const bush = state.map.tiles.find((tile) => tile.object === "bush" && tile.x < 16);
  assert.ok(bush); good(G.clearObstacle(state, bush.id)); G.advanceStory(state, "clear", now);
  assert.ok(state.materials.wood >= C.BRIDGE_COST.wood && state.materials.stone >= C.BRIDGE_COST.stone);
  good(G.repairBridge(state, now));
  const mint = C.FORAGE_NODES.find((node) => node.itemId === "river_mint"); good(G.discoverForage(state, mint.id, now));
  const gathered = good(G.gatherForage(state, mint.id, now)); action(() => A.record(state, { type: "forage", itemId: "river_mint", added: gathered.added }, now));
  action(() => A.fish(state, now, () => 0)); now += 30000; action(() => A.fish(state, now, () => 0.9));
  action(() => A.claim(state, "c2_river_basket", now));
  harvestBatch("wheat", 4); harvestBatch("carrot", 2);
  action(() => A.restore(state, "picnic_table", now)); action(() => A.claim(state, "c2_picnic_table", now));
  const animalId = state.animals[0].id;
  for (const care of [G.waterAnimal, G.groomAnimal, G.feedAnimal]) { good(care(state, animalId, now)); action(() => A.record(state, "care", now)); }
  harvestBatch("wheat", 4);
  deliverExistingOrder();
  if ((state.storage.items.wheat || 0) < 7) harvestBatch("wheat", 4);
  action(() => A.claim(state, "c3_good_neighbors", now));
  action(() => A.restore(state, "garden", now));
  now += C.FORAGE_NODE_COOLDOWN_MS;
  const teaMint = good(G.gatherForage(state, mint.id, now)); action(() => A.record(state, { type: "forage", itemId: "river_mint", added: teaMint.added }, now));
  if ((state.storage.items.carrot || 0) < 2) harvestBatch("carrot", 1);
  action(() => A.cook(state, "baked_carrot", now)); action(() => A.cook(state, "mint_tea", now)); action(() => A.cook(state, "rustic_bread", now));
  action(() => A.claim(state, "c3_garden", now)); action(() => A.fish(state, now, () => 0));
  const economy = snapshot([state.coins, state.xp, state.materials]);
  assert.ok(A.quests(state, now).at(-1).canClaim); action(() => A.claim(state, "c3_harvest_picnic", now));
  const view = A.summary(state, now); assert.equal(view.complete, true); assert.equal(view.claimed, 9);
  assert.ok(view.chapters.every((chapter) => chapter.status === "complete")); assert.ok(A.projects(state).every((p) => p.restored));
  assert.equal(view.unlocks.gardenGuestbook, true); assert.equal(view.collectibles.length, 2);
  assert.equal(view.fishing.used, 0); assert.deepEqual(view.meals, { rustic_bread: 0, baked_carrot: 0, mint_tea: 0 });
  assert.ok(state.materials.wood >= 0 && state.materials.stone >= 0); assert.equal(state.stats.cleared, 1);
  assert.ok(!Object.keys(state.storage.items).some((id) => id === "rustic_bread" || id === "river_carp"));
  assert.notEqual(snapshot([state.coins, state.xp, state.materials]), economy);
  const finalEconomy = snapshot([state.coins, state.xp, state.materials]);
  for (const entry of A.quests(state, now)) assert.equal(A.claim(state, entry.id, now).reason, "already_claimed");
  assert.equal(snapshot([state.coins, state.xp, state.materials]), finalEconomy);
  const reloaded = S.migrate(JSON.parse(snapshot(state))); assert.equal(A.summary(reloaded, now).complete, true);
});

test("renewable material purchases are atomic, bounded and never free", () => {
  const state = fresh(); state.coins = 20;
  const before = snapshot(state.materials);
  assert.equal(A.buyMaterial(state, "wood", 10, T0).reason, "missing_resources");
  assert.equal(snapshot(state.materials), before); assert.equal(state.coins, 20);
  good(A.buyMaterial(state, "wood", 2, T0)); assert.equal(state.coins, 8); assert.equal(state.materials.wood, 2);
  good(A.buyMaterial(state, "stone", 1, T0)); assert.equal(state.coins, 0); assert.equal(state.materials.stone, 1);
  for (const count of [0, -1, NaN, 1.5, 11]) assert.equal(A.buyMaterial(state, "wood", count, T0).reason, "bad_purchase");
  assert.equal(A.buyMaterial(state, "unknown", 1, T0).reason, "bad_purchase");
});
test("river commissions consume meals and fish once per cycle and survive reload", () => {
  const state = fishable(); state.adventure.meals.rustic_bread = 1; state.adventure.catch.river_carp = 1;
  const before = state.coins;
  good(A.deliverCommission(state, "elder_supper", T0)); assert.equal(state.coins, before + 14); assert.equal(state.materials.wood, 2);
  assert.equal(state.adventure.meals.rustic_bread, 0); assert.equal(state.adventure.catch.river_carp, 0);
  assert.equal(A.deliverCommission(state, "elder_supper", T0).reason, "already_claimed");
  const loaded = S.migrate(JSON.parse(snapshot(state))); assert.equal(A.deliverCommission(loaded, "elder_supper", T0).reason, "already_claimed");
  assert.equal(A.deliverCommission(loaded, "elder_supper", T0 - 10000).reason, "already_claimed");
  loaded.adventure.meals.rustic_bread = 1; loaded.adventure.catch.river_carp = 1;
  good(A.deliverCommission(loaded, "elder_supper", T0 + 300000));
  const frozen = snapshot([loaded.coins, loaded.materials, loaded.adventure.catch]);
  assert.equal(A.deliverCommission(loaded, "river_market", T0 + 300000).reason, "missing_resources");
  assert.equal(snapshot([loaded.coins, loaded.materials, loaded.adventure.catch]), frozen);
});

console.log("\nAdventure tests: " + passed + " passed, " + failed + " failed.");
if (failed) process.exitCode = 1;
