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

console.log("\n== 5b. Stage 6.5：畜舍地圖常駐不代表動物解鎖，仍需等級（修正 Stage 4 迴歸）==");
{
  const st = S.defaultState(T0); // Lv1（預設）；farmhouse/coop/barn/shop 從地圖建立就常駐（Stage 4 設計）
  st.coins = 9999;
  const barn = st.buildings.find((b) => b.type === "barn");
  assert(!!barn, "畜舍從地圖常駐建築就已存在（Stage 4 設計，不需玩家另外建造）");
  assert(!G.isAnimalUnlocked(st, "cow"), "Lv1 畜舍雖已存在，牛尚未解鎖（ANIMALS.cow.unlockLevel=5）");
  assert(G.buyAnimal(st, barn.id, "cow", T0).reason === "locked", "Lv1 即使金幣足夠也買不到牛");
  const seededChicken = st.animals[0];
  assert(seededChicken && seededChicken.type === "chicken", "起始雞不受此檢查影響（seedStructures 直接塞入，非經 buyAnimal）");
  assert(G.collectAnimal(st, seededChicken.id, T0 + C.ANIMALS.chicken.produceMs).ok, "Lv1 仍可收集起始雞的蛋");
  st.level = 5;
  assert(G.isAnimalUnlocked(st, "cow"), "Lv5 牛解鎖");
  assert(G.buyAnimal(st, barn.id, "cow", T0).ok, "Lv5 可以買牛");
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
  st.animals = []; // 清掉 Stage 4 預置的起始雞，隔離測單一新雞的產出
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

console.log("\n== 9. 動物產品可滿足訂單（Stage 6.5：須先收集過才進訂單池）==");
{
  const st = S.defaultState(T0);
  st.level = 3; st.coins = 9999; st.materials.wood = 10;
  const tile = firstBuildable(st);
  G.buildBuilding(st, tile.id, "chickenCoop", T0);
  assert(G.availableOrderItems(st).indexOf("egg") === -1, "蓋雞舍但還沒收過蛋，訂單池不含雞蛋（避免 Lv1 隨機訂單一開局就要蛋）");
  const chicken = G.animalsInHome(st, st.buildings.find((b) => b.type === "chickenCoop").id)[0];
  const col = G.collectAnimal(st, chicken.id, T0 + C.ANIMALS.chicken.produceMs);
  assert(col.ok, "收集一次蛋");
  assert(G.availableOrderItems(st).indexOf("egg") !== -1, "收過蛋後訂單池才含雞蛋");
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

console.log("\n== 11. 濕土澆水：比乾土更快成長 ==");
{
  const st = S.defaultState(T0);
  st.level = 2; st.coins = 100; // 解鎖胡蘿蔔 + 種子錢
  G.plant(st, 0, "carrot", T0); // 乾土
  G.plant(st, 1, "carrot", T0); // 將澆水
  const w = G.waterPlot(st, 1, T0);
  assert(w.ok, "可對種植中的乾土澆水");
  assert(G.getCropProgress(st, st.plots[1], T0).wet === true, "澆水後變濕土");
  const dryRemain = G.getCropProgress(st, st.plots[0], T0).remainingMs;
  const wetRemain = G.getCropProgress(st, st.plots[1], T0).remainingMs;
  assert(wetRemain < dryRemain, `濕土剩餘時間更短（乾 ${dryRemain} > 濕 ${wetRemain}）`);
  // 邊界
  assert(G.waterPlot(st, 1, T0).reason === "already_wet", "同輪不可重複澆水");
  assert(G.waterPlot(st, 5, T0).reason === "empty", "空地不可澆水");
  // 收成後重種 → 濕土重置
  const grow = C.CROPS.carrot.growMs;
  G.harvest(st, 1, T0 + grow);
  G.plant(st, 1, "carrot", T0 + grow);
  assert(G.getCropProgress(st, st.plots[1], T0 + grow).wet === false, "收成重種後恢復乾土");
}

console.log("\n== 11b. Stage 6.5：離線收益也要吃到濕土加速（修正 applyOffline 沒套用 MOISTURE_MUL）==");
{
  const grow = C.CROPS.carrot.growMs;
  const wetMs = Math.max(1000, Math.floor(grow * C.MOISTURE_MUL));
  // 乾土：offline 到「濕土才會熟」的時間點，乾土應該還沒熟
  const dry = S.defaultState(T0);
  dry.level = 2; dry.coins = 100;
  G.plant(dry, 0, "carrot", T0);
  const dryOff = G.applyOffline(dry, T0 + wetMs + 500);
  assert((dryOff.perCrop.carrot || 0) === 0 && dryOff.readyPlots === 0, "乾土在濕土成熟時間點離線結束時還沒熟");
  // 濕土：同樣的離線時長，應該已經自動收成（幫手解鎖時）或至少標記待收
  const wet = S.defaultState(T0);
  wet.level = 2; wet.coins = 100; wet.upgrades.helperLevel = 1; // 解鎖離線自動收成
  G.plant(wet, 0, "carrot", T0);
  G.waterPlot(wet, 0, T0);
  const wetOff = G.applyOffline(wet, T0 + wetMs + 500);
  assert((wetOff.perCrop.carrot || 0) === C.CROPS.carrot.yield, `濕土離線也吃到加速，同時間已自動收成一輪（yield ${C.CROPS.carrot.yield}，實際 ${JSON.stringify(wetOff.perCrop)}）`);
}

console.log("\n== 12. 工具模式 state.interaction ==");
{
  const st = S.defaultState(T0);
  assert(st.interaction && st.interaction.tool === "hand", "預設工具為 hand");
  assert(C.TOOL_ORDER.length === 5 && C.TOOLS.water && C.TOOLS.clear, "工具集含 water/clear 等 5 種");
}

console.log("\n== 13. 故事任務完成度同步（作物先完成也會補進度）==");
{
  const st = S.defaultState(T0);
  st.coins = 9999;

  G.plant(st, 0, "wheat", T0);
  assert(G.advanceStory(st, "plant").ok === false, "未讀告示前種植不會跳過序章");

  const intro = G.advanceStory(st, "read_sign");
  assert(intro.ok && intro.completedIds.includes("intro_reopen_farm") && intro.completedIds.includes("plant_wheat"),
    "讀告示後補認已種小麥，完成度從序章推到澆水");
  assert(st.story.questId === "first_water", `下一任務是澆水（${st.story.questId}）`);

  G.waterPlot(st, 0, T0 + 1000);
  const water = G.syncStoryProgress(st);
  assert(water.ok && water.completedIds.includes("first_water") && st.story.questId === "first_harvest",
    "已澆水的小麥會補進 first_water 完成度");

  st.plots[0].plantedAt = T0 - C.CROPS.wheat.growMs - 5000;
  G.harvest(st, 0, T0 + 2000);
  const harvest = G.syncStoryProgress(st);
  assert(harvest.ok && harvest.completedIds.includes("first_harvest") && st.story.questId === "first_delivery",
    "收成小麥後 first_harvest 完成度增加");

  st.orders = [{ id: "order_story", wants: { wheat: 1 }, rarity: "common", rewardCoins: 20, rewardXp: 4, expiresAt: T0 + 999999 }];
  G.fulfillOrder(st, "order_story", T0 + 3000);
  const delivery = G.syncStoryProgress(st);
  assert(delivery.ok && delivery.completedIds.includes("first_delivery") && st.story.questId === "clear_old_path",
    "交付訂單後 first_delivery 完成度增加");

  const stump = st.map.tiles.find((t) => t.object === "stump");
  G.clearObstacle(st, stump.id);
  const clear = G.syncStoryProgress(st);
  assert(clear.ok && clear.completedIds.includes("clear_old_path"), "清掉樹樁完成序章最後一關");
  assert(C.PROLOGUE_QUESTS.every((id) => st.story.completed[id]), "序章 6 關全部完成");
  assert(st.story.questId === "repair_bridge", `序章後接第二章「修橋」（${st.story.questId}）`);
}

console.log("\n== 13b. Stage 5：修橋解鎖東林封鎖區 + 事件點獎勵 ==");
{
  const st = S.defaultState(T0);
  const bridge = G.bridgeTile(st), event = G.eventTile(st, "east_clearing");
  assert(bridge && bridge.terrain === "water" && bridge.bridge, "地圖有斷橋（水上、bridge=true）");
  assert(event && event.region === "east", "地圖有東林事件點（region=east）");
  // 封鎖前：橋與東林不可走、BFS 不可達
  assert(!G.isWalkable(st, bridge) && !G.isWalkable(st, event), "修橋前：斷橋與東林封鎖區不可走");
  assert(G.bfsPath(st, st.player.tileId, event.id) === null, "修橋前：BFS 無法抵達東林");
  // 條件不足擋下（序章未完成）
  assert(G.repairBridge(st, T0).reason === "chapter", "序章未完成不能修橋");
  C.PROLOGUE_QUESTS.forEach((id) => (st.story.completed[id] = true)); st.story.questId = "repair_bridge";
  assert(G.repairBridge(st, T0).reason === "materials", "建材不足不能修橋（需真資源）");
  st.materials.wood = 6; st.materials.stone = 4;
  const rep = G.repairBridge(st, T0);
  assert(rep.ok && st.flags.bridgeRepaired, "序章完成 + 木6石4 → 修橋成功");
  assert((st.materials.wood === 0) && (st.materials.stone === 0), "修橋消耗木材 6、石頭 4");
  assert(st.story.questId === "explore_new_area", `修橋推進到「探索新區」（${st.story.questId}）`);
  // 修橋後：可走、BFS 可達
  assert(G.isWalkable(st, bridge) && G.isWalkable(st, event), "修橋後：橋可走、東林解鎖");
  assert(G.bfsPath(st, st.player.tileId, event.id) !== null, "修橋後：BFS 可抵達東林事件點");
  // 事件點：首次給獎勵 + 完成第二章
  const coinsBefore = st.coins;
  const ev = G.triggerEvent(st, "east_clearing", T0);
  assert(ev.ok && !ev.already && ev.reward, "首次抵達東林古樹給一次性獎勵");
  assert(st.coins === coinsBefore + 120, "事件獎勵 +120 金");
  assert(st.story.questId === null, "探索新區完成第二章任務鏈");
  // 重複觸發不再給獎
  assert(G.triggerEvent(st, "east_clearing", T0).already === true, "事件獎勵僅一次");
}

console.log("\n== 14. 存檔遷移補齊 MVP2 欄位 ==");
{
  const old = { version: 1, coins: 5, plots: [{ id: "p01", cropId: "wheat", plantedAt: 1 }] };
  const m = S.migrate(old);
  assert(m.materials && m.map && Array.isArray(m.map.tiles) && Array.isArray(m.buildings) && Array.isArray(m.animals), "舊存檔補齊 materials/map/buildings/animals");
  assert(m.interaction && m.interaction.tool === "hand", "舊存檔補齊 interaction.tool");
  assert(m.map.tiles.length === C.MAP_DEFAULT.width * C.MAP_DEFAULT.height, "地圖磚數正確");
}

console.log("");
if (failed === 0) { console.log("✅ 全部 MVP2 系統測試通過"); process.exit(0); }
else { console.error(`❌ ${failed} 項失敗`); process.exit(1); }
