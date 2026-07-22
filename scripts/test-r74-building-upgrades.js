/* R74：單棟建物等級、成本、效果與 R73 舊存檔遷移守門（純邏輯）。 */
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const C = require(path.join(ROOT, "src", "config.js"));
const S = require(path.join(ROOT, "src", "state.js"));
const G = require(path.join(ROOT, "src", "game.js"));

const T0 = 3_000_000;
let failed = 0;
function assert(condition, message) {
  if (condition) console.log("  ✓ " + message);
  else { console.error("  ✗ " + message); failed++; }
}
function firstBuildable(state) {
  return state.map.tiles.find((tile) => G.canBuildOn(state, tile));
}
function richState() {
  const state = S.defaultState(T0);
  state.level = 10;
  state.coins = 100_000;
  state.materials = { wood: 1000, stone: 1000, compost: 1000 };
  return state;
}

console.log("== R74-1. 建物逐級資料與有限成本曲線 ==");
for (const type of C.BUILDING_ORDER) {
  const def = C.BUILDINGS[type];
  const coinCosts = def.levels.map((level) => (level.cost && level.cost.coins) || 0);
  assert(def.levels.length === 3 && def.levels.every((level) => level.cost && level.effect && level.effectLabel),
    `${def.name} 有 Lv1～Lv3 成本、效果與說明`);
  assert(def.cost === def.levels[0].cost && def.effect === def.levels[0].effect,
    `${def.name} 建造成本/基礎效果由 levels[0] 單一來源衍生`);
  assert(coinCosts[1] > coinCosts[0] && coinCosts[2] > coinCosts[1],
    `${def.name} 金幣成本逐級上升（${coinCosts.join("→")}）`);
}

console.log("\n== R74-2. 堆肥場升級扣資源、改效果且三級封頂 ==");
{
  const state = richState();
  const built = G.buildBuilding(state, firstBuildable(state).id, "compostHeap", T0);
  assert(built.ok && built.building.level === 1 && G.buildingGrowthAura(state) === 0.90,
    "新建堆肥場是 Lv1，成長倍率 ×0.90");
  const next = G.nextBuildingUpgrade(state, built.building.id);
  const coinsBefore = state.coins;
  const compostBefore = state.materials.compost;
  assert(next && next.level === 2 && next.effect.growthAura === 0.84,
    "Lv1 明確指向 Lv2 與下一級 ×0.84 效果");
  const upgraded = G.upgradeBuilding(state, built.building.id);
  assert(upgraded.ok && built.building.level === 2
    && state.coins === coinsBefore - next.cost.coins
    && state.materials.compost === compostBefore - next.cost.compost,
  "升級只扣該級金幣與堆肥成本");
  assert(G.buildingGrowthAura(state) === 0.84, "堆肥場 Lv2 即時套用成長倍率 ×0.84");
  assert(G.upgradeBuilding(state, built.building.id).ok && built.building.level === 3
    && G.buildingGrowthAura(state) === 0.78, "堆肥場可升到 Lv3，倍率 ×0.78");
  const maxAttempt = G.upgradeBuilding(state, built.building.id);
  assert(!maxAttempt.ok && maxAttempt.reason === "maxed" && built.building.level === 3,
    "Lv3 封頂，不會出現無限升級");
}

console.log("\n== R74-3. 不足時 fail-closed；筒倉與動物舍有真實逐棟增益 ==");
{
  const poor = S.defaultState(T0);
  const coop = poor.buildings.find((building) => building.type === "chickenCoop");
  const snapshot = JSON.stringify({ coins: poor.coins, materials: poor.materials, level: coop.level });
  const denied = G.upgradeBuilding(poor, coop.id);
  assert(!denied.ok && denied.reason === "cost"
    && JSON.stringify({ coins: poor.coins, materials: poor.materials, level: coop.level }) === snapshot,
    "資源不足不扣款、不升級");

  const state = richState();
  const silo = G.buildBuilding(state, firstBuildable(state).id, "silo", T0 + 1).building;
  const cap1 = G.storageCapacity(state);
  G.upgradeBuilding(state, silo.id);
  const cap2 = G.storageCapacity(state);
  G.upgradeBuilding(state, silo.id);
  const cap3 = G.storageCapacity(state);
  assert(cap1 === C.GAME.baseStorage + 90 && cap2 === C.GAME.baseStorage + 170 && cap3 === C.GAME.baseStorage + 300,
    `筒倉逐級提高總倉容（${cap1}→${cap2}→${cap3}）`);

  const barn = state.buildings.find((building) => building.type === "barn");
  assert(G.animalCapacity(state, barn.id) === 4, "預置畜舍 Lv1 容量 4");
  G.upgradeBuilding(state, barn.id);
  assert(G.animalCapacity(state, barn.id) === 5, "只升這棟畜舍後容量成為 5");
}

console.log("\n== R74-4. R73 舊存檔缺 level 安全遷移 ==");
{
  const old = richState();
  const compost = G.buildBuilding(old, firstBuildable(old).id, "compostHeap", T0 + 10).building;
  const silo = G.buildBuilding(old, firstBuildable(old).id, "silo", T0 + 11).building;
  const idsBefore = old.buildings.map((building) => building.id).sort();
  const bindingsBefore = old.map.tiles.filter((tile) => tile.buildingId)
    .map((tile) => `${tile.id}:${tile.buildingId}`).sort();
  old.buildings.forEach((building) => { delete building.level; });

  const migrated = S.migrate(JSON.parse(JSON.stringify(old)));
  const idsAfter = migrated.buildings.map((building) => building.id).sort();
  const bindingsAfter = migrated.map.tiles.filter((tile) => tile.buildingId)
    .map((tile) => `${tile.id}:${tile.buildingId}`).sort();
  assert(JSON.stringify(idsAfter) === JSON.stringify(idsBefore),
    `缺 level 的舊存檔保留全部 ${idsAfter.length} 棟建物（含 ${compost.id}、${silo.id}）`);
  assert(JSON.stringify(bindingsAfter) === JSON.stringify(bindingsBefore),
    "舊存檔遷移保留每棟建物與原地圖 footprint/磚綁定");
  assert(migrated.buildings.every((building) => building.level === 1),
    "舊建物缺 level 時一致安全預設 Lv1");
  assert(G.buildingGrowthAura(migrated) === 0.90
    && G.storageCapacity(migrated) === C.GAME.baseStorage + 90,
    "遷移後 Lv1 堆肥與筒倉效果可正常計算");
}

console.log("\n== R74-5. 已有等級保留，髒等級夾回合法範圍 ==");
{
  const source = S.defaultState(T0);
  source.buildings[0].level = 2;
  source.buildings[1].level = 99;
  const migrated = S.migrate(source);
  assert(migrated.buildings.find((building) => building.id === source.buildings[0].id).level === 2,
    "合法 Lv2 在遷移後保留");
  assert(migrated.buildings.find((building) => building.id === source.buildings[1].id).level === 3,
    "超過上限的髒 level 夾回 Lv3");
}

console.log("");
if (failed === 0) { console.log("✅ R74 單棟建物成長線與舊存檔遷移測試通過"); process.exit(0); }
console.error(`❌ R74 有 ${failed} 項失敗`);
process.exit(1);
