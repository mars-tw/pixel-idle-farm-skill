/* =========================================================================
 * test-systems.js — MVP2 系統測試（地圖/障礙/建築/動物/產品訂單，CI 用）
 *
 * 對應 asset-gameplay-integration.md 的「Tests Required」與 acceptance gate：
 *   - 地圖磚效果會改變作物成長
 *   - 清障礙改變磚狀態並給建材
 *   - 動物產品計時 online + offline
 *   - 動物產品可滿足訂單
 *   - 建築解鎖動物 / 倉儲行為
 *   - manifest 路徑有效
 * 執行：node scripts/test-systems.js
 * ========================================================================= */
const path = require("path");
const fs = require("fs");
const C = require(path.join(__dirname, "..", "src", "config.js"));
const S = require(path.join(__dirname, "..", "src", "state.js"));
const G = require(path.join(__dirname, "..", "src", "game.js"));

let failed = 0;
function assert(cond, msg) { if (cond) console.log("  ✓ " + msg); else { console.error("  ✗ " + msg); failed++; } }
const T0 = 2_000_000;
// 找第一個可建草地磚
function firstBuildable(st) { return st.map.tiles.find((t) => G.canBuildOn(st, t)); }

console.log("== 1. manifest 資源路徑有效 ==");
{
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "assets", "manifest.json"), "utf8"));
  let bad = 0;
  m.assets.forEach((a) => { if (!fs.existsSync(path.join(__dirname, "..", a.file))) { console.error("    缺檔:", a.file); bad++; } });
  assert(bad === 0, `manifest 全部 ${m.assets.length} 個素材檔存在`);
}

console.log("\n== 2. 地圖磚效果改變作物成長（堆肥場 growthAura）==");
{
  const st = S.defaultState(T0);
  st.level = 3; st.coins = 9999; st.materials.compost = 5;
  const growBefore = G.effectiveGrowMs(st, "wheat", T0);
  const tile = firstBuildable(st);
  const r = G.buildBuilding(st, tile.id, "compostHeap", T0);
  assert(r.ok, "可蓋堆肥場");
  const growAfter = G.effectiveGrowMs(st, "wheat", T0);
  assert(growAfter < growBefore, `堆肥場讓小麥成長更快（${growBefore}→${growAfter}ms）`);
  assert(Math.abs(G.buildingGrowthAura(st) - 0.90) < 1e-9, "成長光環 = 0.90");
}

console.log("\n== 3. 清障礙改變磚狀態並給建材 ==");
{
  const st = S.defaultState(T0);
  st.coins = 9999;
  const objTile = st.map.tiles.find((t) => t.object === "stump"); // 樹樁 → 木材
  assert(!!objTile, "地圖有樹樁障礙");
  const woodBefore = st.materials.wood;
  const r = G.clearObstacle(st, objTile.id);
  assert(r.ok, "可清除樹樁");
  assert(objTile.object === null, "清除後磚變草地（object=null）");
  assert(st.materials.wood === woodBefore + 2, "清樹樁得 2 木材");
  assert(st.stats.cleared === 1, "清障計數 +1");
  assert(G.canBuildOn(st, objTile), "清除後該磚可興建");
}

console.log("\n== 4. 建築解鎖：倉儲行為（筒倉）==");
{
  const st = S.defaultState(T0);
  st.level = 3; st.coins = 9999; st.materials.stone = 6;
  const capBefore = G.storageCapacity(st);
  const tile = firstBuildable(st);
  const r = G.buildBuilding(st, tile.id, "silo", T0);
  assert(r.ok, "可蓋筒倉");
  assert(G.storageCapacity(st) === capBefore + 90, `筒倉倉容 +90（${capBefore}→${G.storageCapacity(st)}）`);
}

console.log("\n== 5. 建築解鎖動物 + 容量限制 ==");
{
  const st = S.defaultState(T0);
  st.level = 3; st.coins = 9999; st.materials.wood = 10;
  // 等級不足時鎖定
  const lowLv = S.defaultState(T0); lowLv.level = 1; lowLv.coins = 9999; lowLv.materials.wood = 10;
  const tileLow = firstBuildable(lowLv);
  assert(G.buildBuilding(lowLv, tileLow.id, "chickenCoop", T0).ok === false, "等級不足無法蓋雞舍");
  // 正常蓋
  const tile = firstBuildable(st);
  const r = G.buildBuilding(st, tile.id, "chickenCoop", T0);
  assert(r.ok, "lv3 可蓋雞舍");
  assert(G.animalsInHome(st, r.building.id).length === 1, "蓋雞舍自動入住 1 隻雞");
  assert(G.isAnimalUnlocked(st, "chicken"), "雞已解鎖");
  // 補到容量上限（3）
  G.buyAnimal(st, r.building.id, "chicken", T0);
  G.buyAnimal(st, r.building.id, "chicken", T0);
  assert(G.animalsInHome(st, r.building.id).length === 3, "可買到容量上限 3 隻");
  assert(G.buyAnimal(st, r.building.id, "chicken", T0).reason === "full", "超過容量被擋");
}

console.log("\n== 6. 動物產品計時（online）+ 收集 ==");
{
  const st = S.defaultState(T0);
  st.level = 3; st.coins = 9999; st.materials.wood = 10;
  const tile = firstBuildable(st);
  const r = G.buildBuilding(st, tile.id, "chickenCoop", T0);
  const chicken = G.animalsInHome(st, r.building.id)[0];
  const produceMs = C.ANIMALS.chicken.produceMs;
  assert(!G.animalProgress(st, chicken, T0 + produceMs - 1000).ready, "未到週期不產出");
  assert(G.animalProgress(st, chicken, T0 + produceMs).ready, "到週期後成熟");
  const col = G.collectAnimal(st, chicken.id, T0 + produceMs);
  assert(col.ok && col.product === "egg" && col.added === 1, "收集得 1 顆蛋");
  assert((st.storage.items.egg || 0) === 1, "蛋進倉庫");
}

console.log("\n== 7. 動物產品（offline）多輪 + 上限 ==");
{
  const st = S.defaultState(T0);
  st.level = 3; st.coins = 9999; st.materials.wood = 10;
  const tile = firstBuildable(st);
  const r = G.buildBuilding(st, tile.id, "chickenCoop", T0);
  const produceMs = C.ANIMALS.chicken.produceMs;
  // 離線 5 個週期
  const sum = G.applyOffline(st, T0 + produceMs * 5);
  assert((sum.products.egg || 0) === 5, `離線自動產 5 顆蛋（實際 ${sum.products.egg || 0}）`);
  assert((st.storage.items.egg || 0) === 5, "離線蛋入倉");
}

console.log("\n== 8. 餵食立即產出（花作物）==");
{
  const st = S.defaultState(T0);
  st.level = 3; st.coins = 9999; st.materials.wood = 10;
  const tile = firstBuildable(st);
  const r = G.buildBuilding(st, tile.id, "chickenCoop", T0);
  const chicken = G.animalsInHome(st, r.building.id)[0];
  st.storage.items.wheat = 5; // 餵食成本 2 小麥
  const f = G.feedAnimal(st, chicken.id, T0);
  assert(f.ok && f.product === "egg", "餵食立即產蛋");
  assert((st.storage.items.wheat || 0) === 3, "餵食扣 2 小麥");
  assert((st.storage.items.egg || 0) === 1, "餵食得 1 蛋");
}

console.log("\n== 9. 動物產品可滿足訂單 ==");
{
  const st = S.defaultState(T0);
  st.level = 3; st.coins = 9999; st.materials.wood = 10;
  const tile = firstBuildable(st);
  G.buildBuilding(st, tile.id, "chickenCoop", T0);
  assert(G.availableOrderItems(st).indexOf("egg") !== -1, "解鎖雞後訂單池含雞蛋");
  // 直接構造一張要蛋的訂單並完成
  st.storage.items.egg = 5;
  st.orders = [{ id: "order_test", wants: { egg: 3 }, rarity: "common", rewardCoins: 30, rewardXp: 6, expiresAt: T0 + 1e9 }];
  const before = st.coins;
  const f = G.fulfillOrder(st, "order_test", T0);
  assert(f.ok && f.coins > 0, "用雞蛋完成訂單得金幣");
  assert((st.storage.items.egg || 0) === 2, "完成訂單扣 3 蛋");
  assert(st.coins > before, "金幣增加");
}

console.log("\n== 10. 賣出動物產品（價格用產品定義）==");
{
  const st = S.defaultState(T0);
  st.storage.items.milk = 3;
  const sell = G.sellItem(st, "milk", 3, T0);
  assert(sell.ok && sell.coins === 3 * C.PRODUCTS.milk.sellValue, `賣 3 牛奶得 ${3 * C.PRODUCTS.milk.sellValue} 金`);
}

console.log("\n== 11. 存檔遷移補齊 MVP2 欄位 ==");
{
  const old = { version: 1, coins: 5, plots: [{ id: "p01", cropId: "wheat", plantedAt: 1 }] };
  const m = S.migrate(old);
  assert(m.materials && m.map && Array.isArray(m.map.tiles) && Array.isArray(m.buildings) && Array.isArray(m.animals), "舊存檔補齊 materials/map/buildings/animals");
  assert(m.map.tiles.length === C.MAP_DEFAULT.width * C.MAP_DEFAULT.height, "地圖磚數正確");
}

console.log("");
if (failed === 0) { console.log("✅ 全部 MVP2 系統測試通過"); process.exit(0); }
else { console.error(`❌ ${failed} 項失敗`); process.exit(1); }
