const assert = require("node:assert/strict");
const S = require("../src/state.js");
const G = require("../src/game.js");
const A = require("../src/adventure.js");
const C = require("../src/config.js");
const now = 2000000;
function fresh() {
  const s = S.defaultState(now); A.ensure(s, now);
  s.coins = 10000; s.level = 8; s.xp = C.LEVEL_XP[7];
  s.materials = { wood: 1000, stone: 1000, compost: 1000 };
  return s;
}
function reload(s) { return S.migrate(JSON.parse(JSON.stringify(s))); }
function customCoop(s, tileId) {
  const r = G.buildBuilding(s, tileId, "chickenCoop", now);
  assert.equal(r.ok, true, JSON.stringify(r));
  return s.buildings.find((b) => b.tileId === tileId && !b.structureId);
}
{
  const s = fresh(); s.adventure.claimed.c3_harvest_picnic = true; S.configureWorld(s);
  const originalMayor = "t" + C.NPC_PLACEMENT.find((p) => p.type === "mayor").x + "_" + C.NPC_PLACEMENT.find((p) => p.type === "mayor").y;
  assert.equal(G.getTileById(s, originalMayor).npc, null);
  const b = customCoop(s, originalMayor), animals = s.animals.filter((a) => a.homeId === b.id);
  assert.equal(animals.length, 1);
  for (let i = 0; i < 3; i++) {
    const loaded = reload(s);
    assert(loaded.buildings.some((other) => other.id === b.id && other.tileId === b.tileId));
    assert.equal(loaded.animals.filter((a) => a.homeId === b.id).length, 1);
    assert.equal(G.getTileById(loaded, originalMayor).npc, null);
    assert.equal(loaded.map.tiles.filter((t) => t.npc).length, 4);
    Object.assign(s, loaded);
  }
  console.log("PASS actual CONFIG: picnic relocation preserves a new coop and its animal across repeated reloads.");
}
{
  const s = fresh(), b = customCoop(s, C.WORLD_PROJECT_SITES.garden);
  S.configureWorld(s);
  const moved = s.adventure.siteTiles.garden;
  assert.notEqual(moved, C.WORLD_PROJECT_SITES.garden);
  assert.equal(G.getTileById(s, b.tileId).adventureSite, undefined);
  assert.equal(G.getTileById(s, moved).adventureSite, "garden");
  assert(G.pathToAdjacent(s, s.player.tileId, moved));
  const loaded = reload(s);
  assert(loaded.buildings.some((other) => other.id === b.id));
  assert.equal(loaded.animals.filter((a) => a.homeId === b.id).length, 1);
  assert.equal(loaded.adventure.siteTiles.garden, moved);
  assert.equal(A.projects(loaded).find((p) => p.id === "garden").target.tileId, moved);
  console.log("PASS actual CONFIG: occupied garden site relocates, retains building/animal, and keeps its interaction target after reload.");
}
{
  const s = fresh(), tile = G.getTileById(s, C.WORLD_PROJECT_SITES.picnic_table);
  tile.terrain = "grass"; // This was valid ground in the R74 layout.
  const b = customCoop(s, tile.id);
  const loaded = reload(s);
  assert(loaded.buildings.some((other) => other.id === b.id));
  assert.equal(G.getTileById(loaded, b.tileId).terrain, "grass");
  assert.notEqual(loaded.adventure.siteTiles.picnic_table, b.tileId);
  console.log("PASS R74 shoreline/road fixture: existing building wins over new landscape and picnic site.");
}
{
  const s = fresh(); s.adventure.claimed.c3_harvest_picnic = true; S.configureWorld(s);
  s.map.tiles = []; const loaded = reload(s);
  assert.equal(loaded.map.tiles.length, C.MAP_W * C.MAP_H);
  assert.equal(loaded.map.tiles.filter((t) => t.npc).length, 4);
  for (const [id, tileId] of Object.entries(loaded.adventure.siteTiles)) {
    const tile = G.getTileById(loaded, tileId);
    assert.equal(tile.adventureSite, id); assert.equal(tile.buildingId, null); assert.equal(tile.npc, null);
    assert.equal(G.canBuildOn(loaded, tile), false);
  }
  for (const tile of loaded.map.tiles.filter((t) => t.npc || t.station)) assert.equal(G.canBuildOn(loaded, tile), false);
  for (const value of ["bad", 7, []]) { const dirty = fresh(); dirty.adventure = value; assert.doesNotThrow(() => reload(dirty)); }
  console.log("PASS corrupt map and invalid adventure fixture: world bindings rebuild without overlapping entities or new construction on NPCs/stations.");
}
