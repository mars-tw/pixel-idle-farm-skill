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
  const secondTile = firstBuildable(st);
  const second = G.buildBuilding(st, secondTile.id, "compostHeap", T0 + 1);
  assert(second.reason === "max_count", "同類成長光環建築達 maxCount 後不可再蓋");
  st.buildings.push({ id: "legacy_compost_dup", type: "compostHeap", tileId: secondTile.id, builtAt: T0 + 2, level: 1 });
  assert(Math.abs(G.buildingGrowthAura(st) - 0.90) < 1e-9, "舊存檔重複堆肥場只計入 1 座效果");
  st.buildings.push(
    { id: "legacy_bee_a", type: "beeBox", tileId: secondTile.id, builtAt: T0 + 3, level: 1 },
    { id: "legacy_bee_b", type: "beeBox", tileId: secondTile.id, builtAt: T0 + 4, level: 1 },
    { id: "legacy_greenhouse_a", type: "greenhouse", tileId: secondTile.id, builtAt: T0 + 5, level: 1 },
    { id: "legacy_greenhouse_b", type: "greenhouse", tileId: secondTile.id, builtAt: T0 + 6, level: 1 },
  );
  const cappedAura = 0.90 * 0.92 * 0.88;
  assert(Math.abs(G.buildingGrowthAura(st) - cappedAura) < 1e-9,
    `全部 growthAura 建築各只計 1 座，總倍率封頂 ${cappedAura.toFixed(4)}`);
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
  st.buildings.push({ id: "legacy_silo_dup", type: "silo", tileId: firstBuildable(st).id, builtAt: T0 + 1, level: 1 });
  assert(G.storageCapacity(st) === capBefore + 90, "舊存檔重複筒倉不再無限增加倉容");
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

console.log("\n== 5a. R50：動物產能建築 maxCount 封頂 ==");
{
  const st = S.defaultState(T0);
  st.level = 8; st.coins = 9999; st.materials.wood = 99; st.materials.stone = 99;
  assert(G.buildingCount(st, "chickenCoop") === 1 && C.BUILDINGS.chickenCoop.maxCount === 2,
    "雞舍含地圖常駐 1 座，全場 maxCount=2");
  const coop1 = G.buildBuilding(st, firstBuildable(st).id, "chickenCoop", T0);
  assert(coop1.ok, "雞舍可在常駐 1 座外再建 1 座");
  assert(G.buildBuilding(st, firstBuildable(st).id, "chickenCoop", T0 + 1).reason === "max_count",
    "第 3 座雞舍被 maxCount 擋下");
  assert(G.buildingCount(st, "barn") === 1 && C.BUILDINGS.barn.maxCount === 2,
    "畜舍含地圖常駐 1 座，全場 maxCount=2");
  const barn1 = G.buildBuilding(st, firstBuildable(st).id, "barn", T0 + 2);
  assert(barn1.ok, "畜舍可在常駐 1 座外再建 1 座");
  assert(G.buildBuilding(st, firstBuildable(st).id, "barn", T0 + 3).reason === "max_count",
    "第 3 座畜舍被 maxCount 擋下");
  assert(C.BUILDINGS.duckPen.maxCount === 1, "鴨舍無常駐建築，全場 maxCount=1");
  const duck1 = G.buildBuilding(st, firstBuildable(st).id, "duckPen", T0 + 4);
  assert(duck1.ok, "鴨舍可建第 1 座");
  assert(G.buildBuilding(st, firstBuildable(st).id, "duckPen", T0 + 5).reason === "max_count",
    "第 2 座鴨舍被 maxCount 擋下");
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

console.log("\n== 5c. Stage 7.1：同一建築有多種 unlockAnimal 時都能買（原本 UI 只賣 [0]，羊永遠買不到）==");
{
  const st = S.defaultState(T0);
  st.level = 5; st.coins = 9999;
  const barn = st.buildings.find((b) => b.type === "barn");
  assert(JSON.stringify(C.BUILDINGS.barn.effect.unlockAnimal) === JSON.stringify(["cow", "sheep"]), "畜舍設定同時解鎖牛與羊");
  assert(G.isAnimalUnlocked(st, "cow") && G.isAnimalUnlocked(st, "sheep"), "牛與羊在 Lv5 都判定為已解鎖");
  const buyCow = G.buyAnimal(st, barn.id, "cow", T0);
  const buySheep = G.buyAnimal(st, barn.id, "sheep", T0 + 1000);
  assert(buyCow.ok && buyCow.animal.type === "cow", "可以買牛");
  assert(buySheep.ok && buySheep.animal.type === "sheep", "可以買羊（Stage 7.1 前 UI 邏輯永遠買不到）");
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
  assert(wet.discoveries.items.carrot === T0 + wetMs + 500, "離線自動收成會記錄作物首次發現時間");
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

  G.refreshOrders(st, T0 + 2500, () => 0.2);
  const tutorial = st.orders.find((o) => o.id === "tutorial_first_delivery");
  assert(tutorial && tutorial.wants.wheat === C.CROPS.wheat.yield, "首收後生成 2 小麥新手保底訂單");
  assert(G.canFulfill(st, tutorial), "首收後新手保底訂單立即可交付");

  G.fulfillOrder(st, tutorial.id, T0 + 3000);
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

console.log("\n== 13b. Stage 5/12：修橋解鎖東林 + 採集鏈 + 商人回報 ==");
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
  let ms = G.bridgeMaterialStatus(st);
  assert(ms.missing.wood === 6 && ms.missing.stone === 4, "修橋材料清單顯示木6石4缺口");
  st.coins = 999;
  const stump = st.map.tiles.find((t) => t.object === "stump");
  G.clearObstacle(st, stump.id);
  ms = G.bridgeMaterialStatus(st);
  assert(ms.have.wood === 2 && ms.missing.wood === 4, "清樹樁後材料清單更新為木材 2/6");
  const treeTarget = G.bridgeMaterialTargetTile(st);
  assert(treeTarget && treeTarget.object === "tree", "木材不足時任務目標轉向大樹");
  G.clearObstacle(st, treeTarget.id);
  ms = G.bridgeMaterialStatus(st);
  assert(ms.have.wood === 6 && ms.missing.wood === 0 && ms.missing.stone === 4, "清大樹後木材備齊，仍缺石頭 4");
  for (let i = 0; i < 2; i++) {
    const rockTarget = G.bridgeMaterialTargetTile(st);
    assert(rockTarget && rockTarget.object === "rock", `石頭不足時第 ${i + 1} 個任務目標轉向巨石`);
    G.clearObstacle(st, rockTarget.id);
  }
  ms = G.bridgeMaterialStatus(st);
  assert(ms.ready && ms.have.wood === 6 && ms.have.stone === 4, "依材料導引清障後湊齊木6石4");
  const rep = G.repairBridge(st, T0);
  assert(rep.ok && st.flags.bridgeRepaired, "序章完成 + 木6石4 → 修橋成功");
  assert((st.materials.wood === 0) && (st.materials.stone === 0), "修橋消耗木材 6、石頭 4");
  assert(st.story.questId === "explore_new_area", `修橋推進到「探索新區」（${st.story.questId}）`);
  // 修橋後：可走、BFS 可達
  assert(G.isWalkable(st, bridge) && G.isWalkable(st, event), "修橋後：橋可走、東林解鎖");
  assert(G.bfsPath(st, st.player.tileId, event.id) !== null, "修橋後：BFS 可抵達東林事件點");
  // 事件點：首次給獎勵，並接上東林採集鏈
  const coinsBefore = st.coins;
  const ev = G.triggerEvent(st, "east_clearing", T0);
  assert(ev.ok && !ev.already && ev.reward, "首次抵達東林古樹給一次性獎勵");
  assert(st.coins === coinsBefore + 120, "事件獎勵 +120 金");
  assert(st.story.questId === "discover_east_forage", `探索新區後接東林採集鏈（${st.story.questId}）`);
  // 重複觸發不再給獎
  assert(G.triggerEvent(st, "east_clearing", T0).already === true, "事件獎勵僅一次");

  const forageTarget = G.eastForageTargetTile(st, T0 + 1000);
  assert(forageTarget && forageTarget.forage, "東林採集鏈 marker 指向採集點");
  const beforeUnlockPool = G.availableOrderItems(st);
  assert(beforeUnlockPool.indexOf("forest_herb") === -1 && beforeUnlockPool.indexOf("glow_mushroom") === -1,
    "回報前東林採集物不進訂單/委託池");
  const discover = G.discoverForage(st, forageTarget.forage, T0 + 1000);
  assert(discover.ok && st.flags.eastForageDiscovered && st.story.questId === "collect_east_forage",
    "辨認採集點後推進到收集樣品");

  const herbTile = G.forageTile(st, "east_herb_patch");
  const mushroomTile = G.forageTile(st, "east_mushroom_log");
  const berryTile = G.forageTile(st, "east_berry_thicket");
  const mintTile = G.forageTile(st, "east_mint_spring");
  assert(herbTile && mushroomTile && berryTile && mintTile, "東林有 4 個限定採集點（R15 新增野莓/薄荷）");
  const g1 = G.gatherForage(st, herbTile.forage, T0 + 2000);
  const g2 = G.gatherForage(st, mushroomTile.forage, T0 + 3000);
  const g3 = G.gatherForage(st, berryTile.forage, T0 + 3500);
  const g4 = G.gatherForage(st, mintTile.forage, T0 + 3600);
  const fs = G.eastForageStatus(st, T0 + 3000);
  assert(g1.ok && g2.ok && fs.collectedAll && fs.readyForReport,
    "可依 UI 採集東林藥草與螢光菇各 1 份");
  assert(g3.ok && g4.ok && (st.storage.items.wild_berry || 0) === 1 && (st.storage.items.river_mint || 0) === 1,
    "R15 新增東林野莓與溪畔薄荷可採集並入庫");
  assert((st.storage.items.forest_herb || 0) === 1 && (st.storage.items.glow_mushroom || 0) === 1,
    "東林限定材料進入倉庫");
  assert(st.story.questId === "report_east_forage", `收集完成後接商人回報（${st.story.questId}）`);

  const req = G.ensureEastForageReportRequest(st, T0 + 4000);
  assert(req && req.npcId === "merchant" && req.storyEvent === "report_forage",
    "回報任務建立商人特殊委託");
  assert(G.canFulfillNpcRequest(st, "merchant"), "材料齊全時商人回報委託可交付");
  const reportCoinsBefore = st.coins;
  const report = G.fulfillNpcRequest(st, "merchant", T0 + 5000);
  assert(report.ok && report.coins === 18 && st.coins === reportCoinsBefore + 18,
    "商人回報獎勵 +18 金，使用 NPC 委託結算");
  assert((st.storage.items.forest_herb || 0) === 0 && (st.storage.items.glow_mushroom || 0) === 0,
    "商人回報消耗東林樣品");
  assert(st.flags.eastForageReported && st.story.questId === "learn_animal_care" && G.chapter2Done(st),
    "回報後完成第二章，接上第三章「跟老農學動物照護」");
  const afterUnlockPool = G.availableOrderItems(st);
  assert(["forest_herb", "glow_mushroom", "wild_berry", "river_mint"].every((id) => afterUnlockPool.indexOf(id) !== -1),
    "回報後已採集的東林採集物進入訂單/委託池");
}

console.log("\n== 13b2. R19：東林深處（成本門檻 + 稀有採集 + 收藏品）==");
{
  const st = S.defaultState(T0);
  C.PROLOGUE_QUESTS.concat(C.CHAPTER2_QUESTS).forEach((id) => (st.story.completed[id] = true));
  st.flags.bridgeRepaired = true;
  st.flags.eventsClaimed.east_clearing = true;
  st.flags.eastForageDiscovered = true;
  st.flags.eastForageReported = true;
  st.story.questId = "learn_animal_care";

  const gate = G.eventTile(st, "east_deep_gate");
  const moonTile = G.forageTile(st, "deep_mooncap_ring");
  const amberTile = G.forageTile(st, "deep_amber_root");
  assert(gate && gate.region === "east_deep", "地圖有東林深處入口（east_deep）");
  assert(moonTile && amberTile && moonTile.region === "east_deep" && amberTile.region === "east_deep",
    "東林深處有 2 個稀有採集點且位於子區域");
  assert(G.bfsPath(st, st.player.tileId, moonTile.id) === null, "未解鎖前深處採集點 BFS 不可達");
  assert(G.gatherForage(st, moonTile.forage, T0 + 1).reason === "locked_deep", "未解鎖前不可採深處稀有物");

  let ds = G.eastDeepStatus(st);
  assert(!ds.ready && ds.prerequisites && ds.missing.coins > 0 && ds.missing.wood > 0 && ds.missing.stone > 0,
    "東林深處顯示明確成本缺口");
  st.coins = 90; st.materials.wood = 4; st.materials.stone = 2;
  ds = G.eastDeepStatus(st);
  assert(ds.ready && G.canUnlockEastDeep(st).ok, "補齊 90 金/木4/石2 後可解鎖東林深處");
  const unlock = G.unlockEastDeep(st, T0 + 2);
  assert(unlock.ok && st.flags.eastDeepUnlocked && st.collections.east_deep_rubbing,
    "解鎖深處後寫入旗標與非通膨收藏品");
  assert(st.coins === 0 && st.materials.wood === 0 && st.materials.stone === 0, "東林深處解鎖消耗 90 金、木4、石2");
  assert(G.bfsPath(st, st.player.tileId, moonTile.id) !== null, "解鎖後深處採集點 BFS 可達");

  const gMoon = G.gatherForage(st, moonTile.forage, T0 + 3);
  const gAmber = G.gatherForage(st, amberTile.forage, T0 + 4);
  assert(gMoon.ok && gAmber.ok && st.storage.items.mooncap_spore === 1 && st.storage.items.amber_resin === 1,
    "可採集月帽菇孢與古樹琥珀脂並入庫");
  assert(G.gatherForage(st, moonTile.forage, T0 + 5).reason === "cooldown", "深處稀有採集點有低頻冷卻");
  assert(G.journalSummary(st, T0).completion.collectibles.done === 1, "收藏品完成度記錄東林年輪拓印");
  const expectedPerMin = (C.FORAGE_ITEMS.mooncap_spore.sellValue + C.FORAGE_ITEMS.amber_resin.sellValue) / (C.EAST_DEEP_FORAGE_COOLDOWN_MS / 60000);
  assert(expectedPerMin > 1 && expectedPerMin < 2, `深處稀有採集期望值 ${expectedPerMin.toFixed(1)} 金/分鐘，低頻高價但不壓過作物曲線`);
}

console.log("\n== 13c. Stage 7：動物照護（親密度/品質分級/冷卻/衰減）==");
{
  const CD = C.CARE_COOLDOWN_MS;
  const st = S.defaultState(T0);
  const chicken = st.animals[0];
  assert(G.animalAffinity(st, chicken, T0) === 0, "初始親密度 0");
  assert(G.qualityTierFor(0) === "normal", "0 親密度 = normal 品質");

  st.storage.items.wheat = 20;
  const f1 = G.feedAnimal(st, chicken.id, T0);
  assert(f1.ok && f1.tier === "normal" && f1.product === "egg", "第 1 次餵食：normal 品質，item id 為 egg");
  // Stage 7.1：餵食現在也有冷卻（防偷跑衝親密度），立即再餵一次應被擋
  const fBlocked = G.feedAnimal(st, chicken.id, T0 + 1000);
  assert(!fBlocked.ok && fBlocked.reason === "cooldown", "冷卻中重複餵食被擋（Stage 7.1 新增，防止免成本狂點衝品質）");
  const f2 = G.feedAnimal(st, chicken.id, T0 + CD + 1000);
  assert(f2.ok && f2.tier === "good" && f2.product === "egg_good", `冷卻後第 2 次餵食（親密度 ${f2.affinity.toFixed(0)}）：good 品質，item id 為 egg_good`);

  // 免費照護動作（澆水/梳理）各自獨立冷卻，不受餵食冷卻影響
  const w1 = G.waterAnimal(st, chicken.id, T0 + CD + 2000);
  assert(w1.ok, "澆水成功（跟餵食是不同動作類型，不受餵食冷卻影響）");
  const w2 = G.waterAnimal(st, chicken.id, T0 + CD + 3000);
  assert(!w2.ok && w2.reason === "cooldown", "冷卻中重複澆水被擋");
  const w3 = G.waterAnimal(st, chicken.id, T0 + CD + 2000 + CD + 1000);
  assert(w3.ok, "冷卻結束後可再次澆水");
  const g1 = G.groomAnimal(st, chicken.id, T0 + CD + 5000);
  assert(g1.ok && g1.affinity >= C.AFFINITY_HAPPY_THRESHOLD, `梳理後達到開心門檻（${g1.affinity.toFixed(0)} >= ${C.AFFINITY_HAPPY_THRESHOLD}）`);
  assert(G.animalStatus(st, chicken, T0 + CD + 5000) === "happy", "開心門檻以上狀態為 happy");

  // 衰減：離峰很久後親密度應該掉回 0（決定下次收成品質降回 normal）
  const farFuture = T0 + CD + 5000 + 24 * 3600 * 1000; // 24 小時沒照護
  assert(G.animalAffinity(st, chicken, farFuture) === 0, "24 小時沒照護，親密度衰減回 0");
  assert(G.qualityTierFor(G.animalAffinity(st, chicken, farFuture)) === "normal", "衰減後品質回到 normal");

  // 收集：親密度即時決定這次收成品質（不看上次品質）
  const highAffinitySt = S.defaultState(T0);
  const c2 = highAffinitySt.animals[0];
  c2.affinity = 90; c2.lastCaredAt = T0;
  const col = G.collectAnimal(highAffinitySt, c2.id, T0 + C.ANIMALS.chicken.produceMs);
  assert(col.ok && col.tier === "premium" && col.product === "egg_premium", "高親密度時收集得 premium 品質");

  // Stage 7.1 修 A：餵食前若已有自然累積的待收產物，應先自動收集，不能被覆蓋吞掉
  const st4 = S.defaultState(T0);
  const c4 = st4.animals[0];
  st4.storage.items.wheat = 20;
  c4.lastProducedAt = T0 - C.ANIMALS.chicken.produceMs * 3; // 累積 3 輪待收
  const f4 = G.feedAnimal(st4, c4.id, T0);
  assert(f4.ok && f4.collectedFirst && f4.collectedFirst.cycles === 3, "餵食前自動收集 3 輪已累積的待收產物");
  assert((st4.storage.items.egg || 0) === 4, "倉庫拿到 3（自動收集）+1（餵食獎勵）= 4 顆蛋，沒有被吞掉");

  // Stage 7.1 修 D：離線動物產出依當下親密度結算品質，不是固定 normal
  const st5 = S.defaultState(T0);
  const c5 = st5.animals[0];
  c5.affinity = 90; c5.lastCaredAt = T0; c5.lastProducedAt = T0;
  const off5 = G.applyOffline(st5, T0 + C.ANIMALS.chicken.produceMs * 2);
  assert((off5.products.egg_premium || 0) === 2, `離線收成依高親密度給 premium 品質（實際 ${JSON.stringify(off5.products)}）`);
  assert(st5.discoveries.items.egg_premium === T0 + C.ANIMALS.chicken.produceMs * 2,
    "離線動物產物會記錄首次發現時間");

  const decayedQuest = S.defaultState(T0);
  C.PROLOGUE_QUESTS.concat(C.CHAPTER2_QUESTS).forEach((id) => (decayedQuest.story.completed[id] = true));
  decayedQuest.story.completed.learn_animal_care = true;
  decayedQuest.story.completed.feed_care_animal = true;
  decayedQuest.story.questId = "raise_affinity_happy";
  decayedQuest.animals[0].bestAffinity = C.AFFINITY_HAPPY_THRESHOLD;
  decayedQuest.animals[0].affinity = 0;
  decayedQuest.animals[0].lastCaredAt = T0 - 24 * 3600 * 1000;
  const advHappy = G.syncStoryProgress(decayedQuest, null, T0);
  assert(advHappy.ok && advHappy.completedIds.includes("raise_affinity_happy"),
    "養到開心任務看 bestAffinity，不因現值衰減而卡關");
}

console.log("\n== 13d. Stage 7：第三章任務鏈（老農對話 → 照護 → 開心 → 優質品 → 賣出）==");
{
  const st = S.defaultState(T0);
  C.PROLOGUE_QUESTS.concat(C.CHAPTER2_QUESTS).forEach((id) => (st.story.completed[id] = true));
  st.story.questId = "learn_animal_care"; st.flags.bridgeRepaired = true; st.flags.eventsClaimed.east_clearing = true;

  const elderTile = st.map.tiles.find((t) => t.npc === "elder");
  assert(!!elderTile, "地圖有老農 NPC");
  assert(G.questMarkerTile(st, T0) === elderTile.id, "任務標記指向老農");

  const adv1 = G.advanceStory(st, "npc_elder", T0);
  assert(adv1.ok && st.story.questId === "feed_care_animal", "跟老農對話推進到「餵食/澆水/梳理」任務");
  const coopStructTile = st.map.tiles.find((t) => t.structureId === "coop");
  assert(G.questMarkerTile(st, T0) === coopStructTile.id, "任務標記指向雞舍（structure marker kind）");

  st.storage.items.wheat = 20;
  const chicken = st.animals[0];
  const CD = C.CARE_COOLDOWN_MS;
  G.feedAnimal(st, chicken.id, T0);
  const adv2 = G.advanceStory(st, "care_animal", T0);
  assert(adv2.ok && st.story.questId === "raise_affinity_happy", "照護動物後推進到「養到開心」任務");

  // Stage 7.1：餵食有冷卻，後續每次餵食要間隔 >= CARE_COOLDOWN_MS 才會成功（4 次 * 22 = 88，跨過開心門檻 70）
  let lastT = T0;
  for (let i = 0; i < 3; i++) { lastT += CD + 1000; G.feedAnimal(st, chicken.id, lastT); }
  const adv3 = G.syncStoryProgress(st, null, lastT);
  assert(adv3.ok && adv3.completedIds.includes("raise_affinity_happy") && adv3.completedIds.includes("collect_quality_product"),
    "親密度衝高並已收集優質品後，一次連跳兩關（不需分開觸發）");
  assert(st.story.questId === "deliver_quality_order", "接下來是「賣出優質品」任務");

  const qualKey = Object.keys(st.storage.items).find((k) => k.endsWith("_good") || k.endsWith("_premium"));
  assert(!!qualKey, "倉庫已有優質/頂級品項");
  G.sellItem(st, qualKey, st.storage.items[qualKey], lastT);
  assert((st.stats.qualitySold || 0) > 0, "賣出優質品後 qualitySold 計數增加");
  const adv4 = G.syncStoryProgress(st, null, lastT);
  assert(adv4.ok && st.story.questId === "prepare_four_seasons", "R47 routes completed chapter 3 into chapter 4");
}

console.log("\n== 13e. Stage 10.0：NPC 對話階段補上 ch3done（第三章動物照護全完成後）==");
{
  const st = S.defaultState(T0);
  assert(G.npcPhase(st) === "start", "初始階段 start");
  C.PROLOGUE_QUESTS.forEach((id) => (st.story.completed[id] = true));
  assert(G.npcPhase(st) === "ch1done", "序章完成後進 ch1done");
  st.flags.bridgeRepaired = true;
  assert(G.npcPhase(st) === "bridge", "修橋後進 bridge");
  st.flags.eventsClaimed.east_clearing = true;
  assert(G.npcPhase(st) === "bridge", "只探索東林古樹但尚未回報採集前仍維持 bridge");
  C.CHAPTER2_QUESTS.forEach((id) => (st.story.completed[id] = true));
  st.flags.eastForageReported = true;
  assert(G.chapter2Done(st) === true, "第二章任務鏈全部完成後 chapter2Done() 為 true");
  assert(G.npcPhase(st) === "ch2done", "採集並回報東林後進 ch2done");
  assert(G.chapter3Done(st) === false, "第三章任務鏈尚未完成前 chapter3Done() 為 false");
  C.CHAPTER3_QUESTS.forEach((id) => (st.story.completed[id] = true));
  assert(G.chapter3Done(st) === true, "第三章任務鏈全部完成後 chapter3Done() 為 true");
  assert(G.npcPhase(st) === "ch3done", "第三章動物照護全完成後進 ch3done（優先於 ch2done）");
  for (const npcId of Object.keys(C.NPCS)) {
    const d = G.npcDialogue(st, npcId, 0);
    assert(d.phase === "ch3done" && !!C.NPCS[npcId].lines.ch3done, `${npcId} 有 ch3done 台詞（${d.line}）`);
  }
  assert(G.npcDialogue(st, "not_a_real_npc", 0) === null, "不存在的 NPC id 回傳 null");
}

console.log("\n== 14. 存檔遷移補齊 MVP2 欄位 ==");
{
  const old = { version: 1, coins: 5, plots: [{ id: "p01", cropId: "wheat", plantedAt: 1 }] };
  const m = S.migrate(old);
  assert(m.materials && m.map && Array.isArray(m.map.tiles) && Array.isArray(m.buildings) && Array.isArray(m.animals), "舊存檔補齊 materials/map/buildings/animals");
  assert(m.interaction && m.interaction.tool === "hand", "舊存檔補齊 interaction.tool");
  assert(m.map.tiles.length === C.MAP_DEFAULT.width * C.MAP_DEFAULT.height, "地圖磚數正確");
  assert(m.map.tiles.some((t) => t.event === "east_deep_gate"), "R19 舊存檔地圖補上東林深處入口事件點");
  assert(m.map.tiles.some((t) => t.forage === "deep_mooncap_ring"), "R19 舊存檔地圖補上東林深處稀有採集點");
  assert(m.flags.eastDeepUnlocked === false && m.discoveries && m.discoveries.items && m.collections, "舊存檔補齊 eastDeepUnlocked/discoveries/collections");
  const oldFound = { version: 1, createdAt: T0 - 999, coins: 5, stats: { harvested: { wheat: 2 }, collected: { wild_berry: 1 } } };
  const mf = S.migrate(oldFound);
  assert(mf.discoveries.items.wheat === oldFound.createdAt && mf.discoveries.items.wild_berry === oldFound.createdAt,
    "舊存檔用既有收成/收集紀錄回填首次發現時間");
}

console.log("\n== 14b. Stage 7：舊存檔的動物物件補齊照護欄位 ==");
{
  // 模擬 Stage 6.5（尚無照護欄位）存檔的動物形狀
  const oldAnimal = { id: "a_coop_1", type: "chicken", homeId: "b_coop", lastProducedAt: 12345 };
  const old = { version: 1, coins: 5, animals: [oldAnimal], map: S.defaultState(T0).map };
  const m = S.migrate(old);
  const a = m.animals.find((x) => x.id === "a_coop_1");
  assert(a && typeof a.affinity === "number" && a.affinity === 0, "舊動物補齊 affinity（預設 0）");
  assert(a && typeof a.lastCaredAt === "number", "舊動物補齊 lastCaredAt");
  assert(a && a.lastFedAt === 0 && a.lastWateredAt === 0 && a.lastGroomedAt === 0, "舊動物補齊 lastFedAt/lastWateredAt/lastGroomedAt");
  assert(m.stats.qualitySold === 0, "舊存檔補齊 stats.qualitySold");
}

console.log("\n== 14c. R49：髒 map 不再因維度相符而被信任 ==");
{
  const dirty = {
    version: 1,
    coins: 77,
    storage: { items: { wheat: 3 } },
    story: { questId: "repair_bridge", completed: { clear_old_path: true } },
    map: { width: C.MAP_W, height: C.MAP_H, tiles: [] },
  };
  const m = S.migrate(dirty);
  assert(m.map.tiles.length === C.MAP_W * C.MAP_H && m.map.soilCount === C.GAME.maxPlots,
    "空 tiles 髒地圖會重建為完整新版地圖");
  assert(m.map.tiles.some((t) => t.station === "order_board") && m.map.tiles.some((t) => t.structureId === "coop")
    && m.map.tiles.some((t) => t.event === "east_deep_gate"),
    "重建地圖含站點、常駐結構與事件點");
  assert(m.coins === 77 && m.storage.items.wheat === 3 && m.story.questId === "repair_bridge"
    && m.story.completed.clear_old_path === true,
    "髒 map 重建不倒退金幣、倉庫與故事進度");
  const base = S.defaultState(T0);
  const legalTile = base.map.tiles.find((t) => t.terrain === "grass" && !t.object && !t.station
    && !t.structureId && !t.blocked && !t.buildingId && !t.npc);
  const preserved = S.migrate({
    version: 1,
    coins: 88,
    map: { width: C.MAP_W, height: C.MAP_H, tiles: [] },
    buildings: [
      { id: "b_keep_coop", type: "chickenCoop", tileId: legalTile.id, builtAt: T0 - 1000, level: 1 },
      { id: "b_bad_silo", type: "silo", tileId: "t99_99", builtAt: T0 - 1000, level: 1 },
    ],
    animals: [
      { id: "a_keep_chicken", type: "chicken", homeId: "b_keep_coop", lastProducedAt: T0 - 5000 },
      { id: "a_bad_duck", type: "duck", homeId: "missing_home", lastProducedAt: T0 - 5000 },
    ],
    player: { tileId: "t7_5", x: 0, y: 0, facing: "left", action: "idle" },
  });
  const keptTile = preserved.map.tiles.find((t) => t.id === legalTile.id);
  const keptAnimal = preserved.animals.find((a) => a.id === "a_keep_chicken");
  assert(preserved.buildings.some((b) => b.id === "b_keep_coop") && keptTile.buildingId === "b_keep_coop"
    && !preserved.buildings.some((b) => b.id === "b_bad_silo"),
    "髒 map 重建會保留可對應座標的合法建築，只移除無法落點的個別建築");
  assert(keptAnimal && keptAnimal.homeId === "b_keep_coop" && !preserved.animals.some((a) => a.id === "a_bad_duck"),
    "髒 map 重建會保留可對應家園的合法動物，只移除無家園動物");
  assert(preserved.player.tileId === "t7_5" && preserved.player.x === 7 && preserved.player.y === 5,
    "髒 map 重建保留合法玩家位置並重算座標");
}

console.log("\n== 15. Stage 10.1：NPC 重複委託（core logic）==");
{
  const st = S.defaultState(T0);
  const chk = G.canRequestFrom(st, "not_a_real_npc", T0);
  assert(chk.ok === false && chk.reason === "no_npc", `不存在的 NPC id 回傳 reason=no_npc（實際 ${chk.reason}）`);
  assert(G.canRequestFrom(st, "elder", T0).reason === "story", "第三章未完成前，NPC 不會開委託（reason=story）");

  C.PROLOGUE_QUESTS.concat(C.CHAPTER2_QUESTS).concat(C.CHAPTER3_QUESTS).forEach((id) => (st.story.completed[id] = true));
  st.flags.bridgeRepaired = true; st.flags.eventsClaimed.east_clearing = true;
  assert(G.chapter3Done(st), "測試前置：第三章已標記完成");

  const chk0 = G.canRequestFrom(st, "elder", T0);
  assert(chk0.ok === false && chk0.reason === "no_pool", `玩家尚未發現任何可委託品項時不生成委託（實際 reason=${chk0.reason}）`);
  assert(G.generateNpcRequest(st, "elder", T0) === null, "no_pool 時 generateNpcRequest 回傳 null（不強行生成）");

  st.stats.collected.egg = 1; // 模擬玩家已收集過雞蛋
  const chk1 = G.canRequestFrom(st, "elder", T0);
  assert(chk1.ok === true, "已發現 elder 委託池內至少一項品項後，canRequestFrom 為 true");
  const req = G.generateNpcRequest(st, "elder", T0);
  assert(!!req && req.npcId === "elder", "generateNpcRequest 產生委託物件");
  assert(Object.keys(req.wants).length === 1 && req.wants.egg > 0, "委託只要求已發現的品項（egg），數量>0");
  assert(req.rewardCoins > 0 && req.rewardXp > 0, "委託有正報酬");
  assert(st.npcRequests.elder === req, "委託存進 state.npcRequests[npcId]");

  assert(G.canFulfillNpcRequest(st, "elder") === false, "庫存不足時 canFulfillNpcRequest 為 false");
  st.storage.items.egg = req.wants.egg;
  assert(G.canFulfillNpcRequest(st, "elder") === true, "補足庫存後 canFulfillNpcRequest 為 true");

  const beforeCoins = st.coins;
  const r = G.fulfillNpcRequest(st, "elder", T0 + 1000);
  assert(r.ok === true, "fulfillNpcRequest 成功");
  assert(st.coins === beforeCoins + r.coins, "coins 正確入帳");
  assert((st.storage.items.egg || 0) === 0, "委託扣除庫存正確（egg 用完後歸零/移除）");
  assert(!st.npcRequests.elder, "交付後委託從 state.npcRequests 移除");
  assert(st.npcRequestLog.elder.fulfilledCount === 1, "npcRequestLog 完成次數遞增為 1");
  assert(st.npcRequestLog.elder.lastRequestAt === T0 + 1000, "npcRequestLog 記錄最後交付時間");
  assert(st.stats.npcRequestsCompleted === 1, "stats.npcRequestsCompleted 遞增");

  const chkCooldown = G.canRequestFrom(st, "elder", T0 + 1000);
  assert(chkCooldown.ok === false && chkCooldown.reason === "cooldown", `交付後立刻詢問應在冷卻中（實際 reason=${chkCooldown.reason}）`);
  const chkReady = G.canRequestFrom(st, "elder", T0 + 1000 + C.NPC_REQUEST_COOLDOWN_MS + 1);
  assert(chkReady.ok === true, "冷卻時間過後可再接新委託（時間戳現算，不用計數器）");

  const r2 = G.fulfillNpcRequest(st, "elder", T0);
  assert(r2.ok === false && r2.reason === "none", "沒有進行中委託時 fulfillNpcRequest 回傳 reason=none（實際 " + r2.reason + "）");
}

console.log("\n== 15b. Stage 10.1：舊存檔補齊 NPC 委託欄位 ==");
{
  const old = { version: 1, coins: 5, map: { width: C.MAP_W, height: C.MAP_H, tiles: [] } };
  const m = S.migrate(old);
  assert(typeof m.npcRequests === "object" && Object.keys(m.npcRequests).length === 0, "舊存檔補齊空的 npcRequests");
  assert(typeof m.npcRequestLog === "object" && Object.keys(m.npcRequestLog).length === 0, "舊存檔補齊空的 npcRequestLog");
  assert(typeof m.npcSideQuests === "object" && Object.keys(m.npcSideQuests).length === 0, "舊存檔補齊空的 npcSideQuests");
  assert(m.stats.npcRequestsCompleted === 0, "舊存檔補齊 stats.npcRequestsCompleted");
}

console.log("\n== 15c. Stage 10 審核修正：品質委託計數、放棄委託、報酬吃 sellBonus ==");
{
  const st = S.defaultState(T0);
  C.PROLOGUE_QUESTS.concat(C.CHAPTER2_QUESTS).concat(C.CHAPTER3_QUESTS).forEach((id) => (st.story.completed[id] = true));

  // 品質分級品項交付要計入 qualitySold（原本只有 sellItem/fulfillOrder 有算，NPC 委託漏了）
  st.stats.collected.egg_good = 1;
  const req1 = G.generateNpcRequest(st, "elder", T0);
  assert(!!req1, "elder 委託池含品質分級品項時可正常生成");
  const itemId1 = Object.keys(req1.wants)[0];
  st.storage.items[itemId1] = req1.wants[itemId1];
  const qsBefore = st.stats.qualitySold || 0;
  const r1 = G.fulfillNpcRequest(st, "elder", T0 + 1);
  assert(r1.ok === true, "交付含品質品項的委託成功");
  if (itemId1.endsWith("_good") || itemId1.endsWith("_premium")) {
    assert((st.stats.qualitySold || 0) > qsBefore, `交付品質分級品項後 qualitySold 增加（實際 ${st.stats.qualitySold}）`);
  }

  // 放棄委託：清掉進行中委託，並跟交付一樣進冷卻（不能無成本棄了重抽找更好賠率）
  // 冷卻要等 T0+1（上一張交付時間）過了 NPC_REQUEST_COOLDOWN_MS 才能再生成
  const T_ready = T0 + 1 + C.NPC_REQUEST_COOLDOWN_MS + 10;
  const req2 = G.generateNpcRequest(st, "elder", T_ready);
  assert(!!req2, "冷卻已過後可再生成新委託（放棄測試前置）");
  const dec = G.declineNpcRequest(st, "elder", T_ready);
  assert(dec.ok === true, "declineNpcRequest 成功");
  assert(!st.npcRequests.elder, "放棄後委託從 state.npcRequests 移除");
  const chkAfterDecline = G.canRequestFrom(st, "elder", T_ready);
  assert(chkAfterDecline.ok === false && chkAfterDecline.reason === "cooldown", `放棄後立即詢問應在冷卻中（實際 reason=${chkAfterDecline.reason}）`);
  assert(G.declineNpcRequest(st, "elder", T_ready).ok === false, "沒有進行中委託時 declineNpcRequest 回傳 ok=false");

  // 報酬基準應該吃 sellBonus 升級（不是原始 sellValue），否則升了市集人脈後直接賣反而更划算
  // 用 egg（起始雞舍已預置雞，unlockedProducts 只會列出玩家「實際擁有的動物」對應的產品，
  // 沒有牛/羊/蜂就不會列出 milk/wool/honey，即使 stats.collected 裡有記錄也一樣）
  const stPlain = S.defaultState(T0);
  C.PROLOGUE_QUESTS.concat(C.CHAPTER2_QUESTS).concat(C.CHAPTER3_QUESTS).forEach((id) => (stPlain.story.completed[id] = true));
  stPlain.stats.collected.egg = 1;
  const stBoosted = S.defaultState(T0);
  C.PROLOGUE_QUESTS.concat(C.CHAPTER2_QUESTS).concat(C.CHAPTER3_QUESTS).forEach((id) => (stBoosted.story.completed[id] = true));
  stBoosted.stats.collected.egg = 1;
  stBoosted.upgrades.sellBonus = 1; // 市集人脈 Lv1：+15% 售價
  // 兩邊 elder pool 都只有 egg 一項可選（都只收集過 egg），必然抽到同一品項；
  // rng 固定回傳 0.5 讓兩邊抽到的數量也一致，才能單獨看出 sellBonus 對報酬的影響
  const fixedRng = () => 0.5;
  const reqPlain = G.generateNpcRequest(stPlain, "elder", T0, fixedRng);
  const reqBoosted = G.generateNpcRequest(stBoosted, "elder", T0, fixedRng);
  assert(!!reqPlain && !!reqBoosted, "兩邊都能成功生成委託（比較報酬前置）");
  assert(reqBoosted.rewardCoins > reqPlain.rewardCoins,
    `sellBonus 升級後委託報酬跟著提升（${reqPlain.rewardCoins} → ${reqBoosted.rewardCoins}），報酬基準吃當下 sellUnitValue`);
}

console.log("\n== 15d. R19：鎮民三段連鎖支線（固定報酬 + 背景文本）==");
{
  const st = S.defaultState(T0);
  C.PROLOGUE_QUESTS.concat(C.CHAPTER2_QUESTS).concat(C.CHAPTER3_QUESTS).forEach((id) => (st.story.completed[id] = true));
  st.flags.bridgeRepaired = true; st.flags.eventsClaimed.east_clearing = true; st.flags.eastForageReported = true;
  st.stats.collected.forest_herb = 1; st.stats.collected.glow_mushroom = 1; st.stats.collected.wild_berry = 1; st.stats.collected.river_mint = 1;
  assert(G.npcSideQuestStatus(st, "mayor").status === "available", "第三章完成後鎮長支線可接");
  let expectedCoins = 0, expectedXp = 0;
  for (const npcId of Object.keys(C.NPC_SIDE_QUESTS)) {
    const def = C.NPC_SIDE_QUESTS[npcId];
    assert(def.steps && def.steps.length === 3, `${npcId} 支線設定為 3 段`);
    for (let i = 0; i < def.steps.length; i++) {
      const step = def.steps[i];
      const req = G.ensureNpcSideQuestRequest(st, npcId, T0 + expectedCoins + i + 1);
      assert(req && req.sideQuestId === def.id && req.sideQuestStepId === step.id, `${npcId} 生成第 ${i + 1}/3 段支線委託`);
      for (const [id, qty] of Object.entries(req.wants)) st.storage.items[id] = (st.storage.items[id] || 0) + qty;
      const before = st.coins;
      const done = G.fulfillNpcRequest(st, npcId, T0 + expectedCoins + i + 2);
      expectedCoins += step.rewardCoins; expectedXp += step.rewardXp;
      const sq = G.npcSideQuestStatus(st, npcId);
      assert(done.ok && done.sideQuestId === def.id && st.coins === before + step.rewardCoins, `${npcId} 第 ${i + 1}/3 段交付固定報酬`);
      assert(sq.completedSteps === i + 1, `${npcId} 完成步數更新為 ${i + 1}/3`);
      assert(i < 2 ? sq.status === "available" : sq.completed === true, `${npcId} 第 ${i + 1}/3 段完成後狀態正確`);
    }
    const final = G.npcSideQuestStatus(st, npcId);
    assert(final.completed && final.loreUnlocked && final.lore.length > 10, `${npcId} 完成三段後解鎖小鎮背景文本`);
    assert(G.ensureNpcSideQuestRequest(st, npcId, T0 + expectedCoins + 3) === null, `${npcId} 三段完成後不重複生成`);
  }
  const completed = G.journalSummary(st, T0).completion.npcSideQuests;
  assert(completed.done === Object.keys(C.NPC_SIDE_QUESTS).length && completed.pct === 100, "圖鑑支線完成度統計全部完成");
  assert(expectedCoins === 133 && expectedXp === 36, `R19 四條三段支線總增發 ${expectedCoins} 金 / ${expectedXp} XP（固定值可審）`);

  const oldDone = S.defaultState(T0);
  C.PROLOGUE_QUESTS.concat(C.CHAPTER2_QUESTS).concat(C.CHAPTER3_QUESTS).forEach((id) => (oldDone.story.completed[id] = true));
  oldDone.npcSideQuests.mayor = { id: C.NPC_SIDE_QUESTS.mayor.id, status: "done", completedAt: T0 };
  const migratedSq = G.npcSideQuestStatus(oldDone, "mayor");
  assert(migratedSq.completedSteps === 1 && migratedSq.status === "available",
    "R15 舊支線 done 紀錄在 R19 視為第一段完成，可續接第二章");
}

console.log("\n== 16. Stage 11.1：Farm Journal（journalSummary 唯讀彙總層）==");
{
  const st = S.defaultState(T0);
  const j0 = G.journalSummary(st, T0);

  // 作物：unlockLevel > 目前等級 → unlocked=false；解鎖但沒收成過 → discovered=false
  const wheatEntry = j0.crops.find((c) => c.id === "wheat");
  const pumpkinEntry = j0.crops.find((c) => c.id === "pumpkin"); // unlockLevel 5，Lv1 不會解鎖
  assert(wheatEntry.unlocked === true && wheatEntry.discovered === false, "Lv1 小麥已解鎖但尚未發現（沒收成過）");
  assert(pumpkinEntry.unlocked === false, "Lv1 南瓜（unlockLevel 5）尚未解鎖");
  // 邊界值：胡蘿蔔 unlockLevel=2，等級剛好卡在邊界兩側都要驗證（避免 unlockedCrops 的
  // <= 比較被改成 < 這種 off-by-one 沒被抓到）
  assert(j0.crops.find((c) => c.id === "carrot").unlocked === false, "Lv1 時胡蘿蔔（unlockLevel 2）尚未解鎖");
  const stLv2 = S.defaultState(T0); stLv2.level = 2;
  assert(G.journalSummary(stLv2, T0).crops.find((c) => c.id === "carrot").unlocked === true, "Lv2 時胡蘿蔔剛好解鎖（邊界值）");

  // 成就：未解鎖成就在圖鑑裡要有對應項目（但顯示邏輯是 UI 層的事，這裡只驗證資料本身）
  assert(j0.achievements.length === Object.keys(C.ACHIEVEMENTS).length, "成就總數與 ACHIEVEMENTS 設定一致");
  assert(j0.achievements.every((a) => a.unlocked === false), "全新存檔沒有任何成就解鎖");
  st.achievements.firstHarvest = true;
  const jAch = G.journalSummary(st, T0);
  assert(jAch.achievements.find((a) => a.id === "firstHarvest").unlocked === true, "解鎖後的成就 unlocked 正確反映（實際讀 state.achievements）");
  assert(jAch.achievements.filter((a) => a.unlocked).length === 1, "只有解鎖的那一項是 true，其餘成就仍是 false（不會互相污染）");
  st.achievements = {}; // 還原，避免影響後續斷言

  // 收成小麥後，作物圖鑑該項目變成已發現，其餘不受影響
  st.stats.harvested.wheat = 1;
  const j1 = G.journalSummary(st, T0);
  assert(j1.crops.find((c) => c.id === "wheat").discovered === true, "收成小麥後作物圖鑑該項目變已發現");
  assert(j1.crops.find((c) => c.id === "carrot").discovered === false, "沒收成過的作物仍是未發現（不會被連帶洩漏）");

  // 收集 egg 後，只有 egg 變已發現，egg_good/egg_premium 仍未發現（不連帶洩漏同 baseProduct 的其他 tier）
  st.stats.collected.egg = 1;
  const j2 = G.journalSummary(st, T0);
  assert(j2.products.find((p) => p.id === "egg").discovered === true, "收集 egg 後產物圖鑑該項目變已發現");
  assert(j2.products.find((p) => p.id === "egg_good").discovered === false, "egg_good 不因為 egg 已發現而連帶曝光");
  assert(j2.products.find((p) => p.id === "egg_premium").discovered === false, "egg_premium 不因為 egg 已發現而連帶曝光");

  // R15：東林採集獨立分類與各分類完成度
  assert(j2.forage.length === Object.keys(C.FORAGE_ITEMS).length, "東林採集圖鑑總數與 FORAGE_ITEMS 對得上");
  assert(j2.completion.forage.done === 0 && j2.completion.forage.pct === 0, "未採集前東林採集完成度 0%");
  st.stats.collected.wild_berry = 1;
  G.recordDiscovery(st, "wild_berry", T0 + 2222);
  const j2b = G.journalSummary(st, T0);
  assert(j2b.forage.find((f) => f.id === "wild_berry").discovered === true, "採集東林野莓後該圖鑑項目揭露");
  assert(j2b.forage.find((f) => f.id === "river_mint").discovered === false, "未採集的溪畔薄荷仍維持隱藏");
  assert(j2b.completion.forage.done === 1 && j2b.completion.forage.total === Object.keys(C.FORAGE_ITEMS).length,
    `東林採集完成度可回報 1/${Object.keys(C.FORAGE_ITEMS).length}`);
  assert(j2b.completion.crops.total === Object.keys(C.CROPS).length, "作物圖鑑完成度 total 會隨 R15 新作物玉米更新");
  const berryDetail = j2b.forage.find((f) => f.id === "wild_berry");
  assert(berryDetail.firstDiscoveredAt === T0 + 2222 && berryDetail.source.includes("東林野莓叢") && berryDetail.usage.some((u) => u.includes("鎮民委託")),
    "收藏冊詳情資料含首次發現時間、來源與用途");
  const hiddenDeep = j2b.forage.find((f) => f.id === "mooncap_spore");
  assert(hiddenDeep.discovered === false && hiddenDeep.sourceHint.includes("東林深處") && hiddenDeep.firstDiscoveredAt === 0,
    "未發現的深處採集物只提供來源提示，不提供首次發現時間");

  const stHarvest = S.defaultState(T0);
  G.plant(stHarvest, 0, "wheat", T0);
  G.harvest(stHarvest, 0, T0 + C.CROPS.wheat.growMs);
  const wheatDetail = G.journalSummary(stHarvest, T0).crops.find((c) => c.id === "wheat");
  assert(wheatDetail.discovered && wheatDetail.firstDiscoveredAt === T0 + C.CROPS.wheat.growMs && wheatDetail.usage.includes("市集訂單"),
    "作物收成會寫入首次發現時間，詳情用途含市集訂單");

  // NPC 名錄：只有互動過的 NPC met=true，總數對得上 NPCS 設定數量
  st.story.dialogueSeen = { elder: true };
  const j3 = G.journalSummary(st, T0);
  assert(j3.npcs.length === Object.keys(C.NPCS).length, "NPC 名錄總數與 NPCS 設定一致");
  assert(j3.npcs.find((n) => n.id === "elder").met === true, "已互動過的老農 met=true");
  assert(j3.npcs.filter((n) => n.met).length === 1, "只有互動過的那位 NPC met=true，其餘仍未遇見");
  assert(j3.npcs.find((n) => n.id === "elder").requestsCompleted === 0, "尚未完成過委託時，NPC 名錄的完成次數為 0");
  st.npcRequestLog = { elder: { lastRequestAt: T0, fulfilledCount: 3 } };
  const j3b = G.journalSummary(st, T0);
  assert(j3b.npcs.find((n) => n.id === "elder").requestsCompleted === 3,
    "NPC 名錄的完成次數讀 npcRequestLog[npcId].fulfilledCount（不是隨便一個計數器）");
  assert(j3b.npcs.find((n) => n.id === "mayor").requestsCompleted === 0, "沒交過委託的其他 NPC 完成次數仍是 0（不會互相污染）");
  st.npcRequestLog = {}; // 還原，避免影響後續斷言

  // 動物親密度里程碑：bestAffinity 是歷史最高值，不受之後 affinity 衰減影響
  const chicken = st.animals[0];
  chicken.bestAffinity = 80; // 高於 AFFINITY_HAPPY_THRESHOLD(70)
  chicken.affinity = 5; chicken.lastCaredAt = T0; // 模擬現值已經很低
  const j4 = G.journalSummary(st, T0 + 999999999); // 拉長時間讓現值進一步衰減趨近 0
  const chickenEntry = j4.animals.find((a) => a.id === chicken.id);
  assert(chickenEntry.everHappy === true, "bestAffinity 曾達開心門檻，即使現值已衰減仍算數");
  assert(chickenEntry.bestAffinity === 80, "bestAffinity 不隨時間衰減");
  assert(chickenEntry.everGood === true, "曾達開心門檻的動物，同時也滿足較低的 everGood 門檻");
  assert(chickenEntry.currentTier === "normal", "currentTier 讀現值（已大幅衰減至 0），跟 bestAffinity 的歷史高水位是兩回事");
  // currentTier 獨立驗證：剛照護完、還沒經過衰減時，應反映當下親密度而非歷史值
  const freshHappyAnimal = { id: "test_fresh", type: "chicken", affinity: 80, lastCaredAt: T0 };
  assert(G.journalAnimals({ animals: [freshHappyAnimal] }, T0).find((a) => a.id === "test_fresh").currentTier === "premium",
    "剛照護完、尚未衰減時，currentTier 反映當下親密度（premium，門檻 70，現值 80）");

  // Codex 審核 Stage 11：everGood-only（未達開心但達良好）也要算「已發現」，
  // 不能只看 everHappy——不然文字顯示「曾達良好」但 data-discovered 卻是 false
  const onlyGoodAnimal = { id: "test_only_good", type: "chicken", affinity: 0, bestAffinity: 40 }; // 高於 GOOD(35) 低於 HAPPY(70)
  const goodEntry = G.journalAnimals({ animals: [onlyGoodAnimal] }, T0).find((a) => a.id === "test_only_good");
  assert(goodEntry.everGood === true && goodEntry.everHappy === false, "bestAffinity 40 只達 good 門檻，未達 happy");

  // 章節完成度：計算方式跟既有 Story 面板一致（done/total），且要有 unlocked 閥門——
  // Codex 審核 Stage 11 抓到：Journal 原本不管解鎖狀態就把三章進度都顯示出來，
  // 跟 renderStory() 的既有規則（序章全完成才顯示第二章）不一致
  assert(j4.chapters.chapter1.unlocked === true, "第一章一開始就看得到");
  assert(j4.chapters.chapter2.unlocked === false, "序章尚未全部完成前，第二章維持未解鎖");
  C.PROLOGUE_QUESTS.forEach((id) => (st.story.completed[id] = true));
  const j5 = G.journalSummary(st, T0);
  assert(j5.chapters.chapter1.done === C.PROLOGUE_QUESTS.length && j5.chapters.chapter1.total === C.PROLOGUE_QUESTS.length,
    "第一章完成度算法跟 PROLOGUE_QUESTS 對得上");
  assert(j5.chapters.chapter2.unlocked === true, "序章全部完成後，第二章解鎖");
  assert(j5.chapters.chapter2.done === 0, "第二章剛解鎖，完成度 0");
  assert(j5.chapters.chapter3.unlocked === false, "第二章尚未完成前，第三章維持未解鎖");
  // chapter2→chapter3 的解鎖轉換跟 chapter1→chapter2 結構一樣，但沒有對稱測過「解鎖後」
  // 的正向案例（只測過 false），複製貼上寫錯題庫或比較運算子不會被抓到
  C.CHAPTER2_QUESTS.forEach((id) => (st.story.completed[id] = true));
  const j5b = G.journalSummary(st, T0);
  assert(j5b.chapters.chapter2.done === C.CHAPTER2_QUESTS.length, "第二章全部完成後，完成度對得上 CHAPTER2_QUESTS 長度");
  assert(j5b.chapters.chapter3.unlocked === true, "第二章全部完成後，第三章解鎖（chapter2→chapter3 的正向轉換，不只測過 false）");
  assert(j5b.chapters.chapter3.done === 0, "第三章剛解鎖，完成度 0");

  // 世界旗標：明確用 eastClearingClaimed，不要用「任一事件已領取」這種會隨事件數增加而
  // 誤判的通用邏輯（Codex 審核 Stage 11 指出的潛在坑）
  st.flags.bridgeRepaired = true;
  st.flags.eventsClaimed.east_clearing = true;
  st.flags.eastDeepUnlocked = true;
  st.collections.east_deep_rubbing = true;
  const j6 = G.journalSummary(st, T0);
  assert(j6.world.bridgeRepaired === true, "世界旗標讀取正確（東橋）");
  assert(j6.world.eastClearingClaimed === true, "世界旗標讀取正確（東林空地，明確欄位而非事件清單長度）");
  assert(j6.world.eastDeepUnlocked === true && j6.completion.collectibles.done === 1,
    "世界旗標與收藏品讀取東林深處解鎖/拓印紀錄");

  // journalSummary 頂層的 npcRequestsCompleted 要跟 stats.npcRequestsCompleted 同步
  // （這是 Journal 包裝過的複本，不能悄悄接到別的來源或漏接）
  st.stats.npcRequestsCompleted = 7;
  const j7 = G.journalSummary(st, T0);
  assert(j7.npcRequestsCompleted === 7, "journalSummary 頂層 npcRequestsCompleted 讀 stats.npcRequestsCompleted（實際 " + j7.npcRequestsCompleted + "）");

  // 純讀取：journalSummary 不應該修改 state（唯讀彙總層不該有副作用）
  const before = JSON.stringify(st);
  G.journalSummary(st, T0);
  const after = JSON.stringify(st);
  assert(before === after, "journalSummary 不會 mutate state（純讀取彙總）");
}

console.log("\n== 16b. Stage 11.1：舊存檔動物物件補齊 bestAffinity ==");
{
  const oldAnimal = { id: "a_coop_1", type: "chicken", homeId: "b_coop", lastProducedAt: 12345, affinity: 42 };
  const old = { version: 1, coins: 5, animals: [oldAnimal], map: S.defaultState(T0).map };
  const m = S.migrate(old);
  const a = m.animals.find((x) => x.id === "a_coop_1");
  assert(a.bestAffinity === 42, "舊動物沒有 bestAffinity 時，用舊 affinity 值當合理預設（實際 " + a.bestAffinity + "）");
}

console.log("\n== 17. R23：智慧助手 / 離線摘要 / 安全存檔 ==");
{
  const st = S.defaultState(T0);
  st.storage.items.wheat = 4;
  st.orders = [{ id: "order_r23", wants: { wheat: 2 }, rarity: "common", rewardCoins: 20, rewardXp: 2, expiresAt: T0 + 999999 }];
  st.plots[0].cropId = "wheat";
  st.plots[0].plantedAt = T0 - C.CROPS.wheat.growMs - 1000;
  st.animals[0].lastWateredAt = T0 - C.CARE_COOLDOWN_MS - 1;
  const frozen = JSON.stringify(st);
  const suggestions = G.farmActionSuggestions(st, T0, { limit: 3 });
  assert(suggestions[0] && suggestions[0].type === "harvest", "智慧助手排序優先成熟作物收成");
  assert(suggestions[0].reason && suggestions[0].reason.includes("收成") && suggestions[0].reason.includes("+" + Math.round(suggestions[0].valueScore)) && suggestions[0].reason.includes("金"),
    "智慧助手 valueScore 可直接轉成收成量化理由");
  assert(suggestions.some((s) => s.type === "order"), "智慧助手列出可交付市集委託");
  const orderSuggestion = suggestions.find((s) => s.type === "order");
  assert(orderSuggestion && orderSuggestion.reason.includes("+20 金"), "智慧助手委託建議顯示量化獎勵理由");
  assert(JSON.stringify(st) === frozen, "farmActionSuggestions 為純讀取，不 mutate state");

  const migrated = S.migrate({ version: 1, coins: 5, settings: { smartAssistant: false }, map: { width: C.MAP_W, height: C.MAP_H, tiles: [] } });
  assert(migrated.settings.smartAssistant === false && migrated.settings.offlineSummary === true && migrated.settings.performanceMode === "auto" && migrated.settings.textSize === "medium",
    "舊存檔設定遷移保留助手偏好並補離線摘要/效能模式/文字大小預設");
  assert(migrated.map.tiles.length === C.MAP_W * C.MAP_H && migrated.map.soilCount === C.GAME.maxPlots,
    "空 tiles 髒存檔會重建成完整地圖與正確農土數");
  assert(new Set(migrated.map.tiles.map((t) => t.id)).size === C.MAP_W * C.MAP_H,
    "遷移後地圖 tile id 完整且不重複");
  const badPerf = S.migrate({ version: 1, coins: 5, settings: { performanceMode: "turbo", textSize: "huge" }, map: { width: C.MAP_W, height: C.MAP_H, tiles: [] } });
  assert(badPerf.settings.performanceMode === "auto" && badPerf.settings.textSize === "medium", "舊存檔非法效能/文字設定會回復預設");
  assert(migrated.lastOfflineSummary === null, "舊存檔遷移補 lastOfflineSummary 空值");

  const off = S.defaultState(T0);
  off.stats.plantCount = 1;
  off.flags.bridgeRepaired = true;
  off.flags.eastForageDiscovered = true;
  off.flags.forageNodes.east_herb_patch = T0 - C.FORAGE_NODE_COOLDOWN_MS + 60000;
  const sum = G.applyOffline(off, T0 + 6 * 60 * 1000);
  assert(sum.offlineMs === 6 * 60 * 1000, "離線摘要計入 6 分鐘離開時間");
  assert(sum.forageReadyCount === 1 && sum.forageReady[0].nodeId === "east_herb_patch",
    "離開期間採集點冷卻完成會進入摘要");

  const oldLs = global.localStorage;
  const store = { [C.GAME.saveKey]: "old-good-save" };
  global.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
  };
  const good = S.safeSave(S.defaultState(T0));
  const savedRaw = store[C.GAME.saveKey];
  assert(good && good.ok && /"coins"/.test(savedRaw), "safeSave 可寫入正常存檔");
  const circular = { version: C.GAME.version }; circular.self = circular;
  const oldWarn = console.warn;
  console.warn = () => {};
  const bad = S.safeSave(circular);
  assert(bad && bad.ok === false && store[C.GAME.saveKey] === savedRaw,
    "safeSave 遇到不可序列化資料不覆蓋既有存檔");
  const badState = S.safeSave(null);
  console.warn = oldWarn;
  assert(badState && badState.ok === false && store[C.GAME.saveKey] === savedRaw,
    "safeSave 遇到壞 state 不覆蓋既有存檔");
  if (oldLs) global.localStorage = oldLs; else delete global.localStorage;
}

console.log("\n== 18. R47: four-season crops, ducks, festival story ==");
{
  assert(C.CROPS.bell_pepper.sheet === "crops2" && C.CROPS.potato.sheet === "crops2"
    && C.CROPS.grapes.sheet === "crops2" && C.CROPS.melon.sheet === "crops2",
    "R47 crops route to crops2 sheet");
  assert(Object.keys(C.CROPS).length === 13, "crop config includes 13 crops after R48");
  assert(C.ANIMALS.duck.sheet === "animals_duck" && C.ANIMALS.duck.careSheet === "animals_duck",
    "duck uses animals_duck for base and care frames");
  assert(C.PRODUCTS.duck_egg.qualitySheet === "product_quality_duck"
    && C.PRODUCTS.duck_egg_good.qualitySheet === "product_quality_duck"
    && C.PRODUCTS.duck_egg_premium.qualitySheet === "product_quality_duck",
    "duck egg quality products route to product_quality_duck");

  const duckSt = S.defaultState(T0);
  duckSt.level = 8; duckSt.coins = 9999; duckSt.materials.wood = 20; duckSt.materials.stone = 20;
  duckSt.storage.items.potato = 10;
  const duckPen = G.buildBuilding(duckSt, firstBuildable(duckSt).id, "duckPen", T0);
  assert(duckPen.ok, "duckPen can be built at level 8");
  const duck = G.animalsInHome(duckSt, duckPen.building.id).find((a) => a.type === "duck");
  assert(!!duck, "duckPen auto-adds one duck");
  const t1 = T0 + C.CARE_COOLDOWN_MS + 1;
  const f1 = G.feedAnimal(duckSt, duck.id, t1);
  const w1 = G.waterAnimal(duckSt, duck.id, t1 + 1);
  const g1 = G.groomAnimal(duckSt, duck.id, t1 + 2);
  const f2 = G.feedAnimal(duckSt, duck.id, t1 + C.CARE_COOLDOWN_MS + 3);
  assert(f1.ok && w1.ok && g1.ok && f2.ok && f2.product === "duck_egg_premium",
    "duck care chain reaches premium duck egg");
  duckSt.orders = [{ id: "duck_quality_order", wants: { duck_egg_premium: 1 }, rarity: "common", rewardCoins: 42, rewardXp: 8, expiresAt: T0 + 999999 }];
  const soldBefore = duckSt.stats.qualitySold || 0;
  const duckOrder = G.fulfillOrder(duckSt, "duck_quality_order", T0 + 999, () => 0.1);
  assert(duckOrder.ok && (duckSt.stats.qualitySold || 0) > soldBefore, "duck premium egg can fulfill quality order");
  assert(duckSt.achievements.duckKeeper === true, "duckKeeper achievement unlocks after duck egg collection");

  const festivalSt = S.defaultState(T0);
  festivalSt.level = 8; festivalSt.coins = 9999;
  const festivalSeq = [0.99, 0.99, 0.0, 0.0, 0.22, 0.0, 0.44, 0.0];
  let festivalIx = 0;
  const festivalOrder = G.makeOrder(festivalSt, T0, () => festivalSeq[festivalIx++ % festivalSeq.length], "r47");
  assert(festivalOrder.rarity === "festival" && Object.keys(festivalOrder.wants).length >= 2
    && Object.keys(festivalOrder.wants).length <= 3,
    "festival generated order requests 2-3 item kinds");

  const storySt = S.defaultState(T0);
  storySt.level = 8; storySt.coins = 9999;
  C.PROLOGUE_QUESTS.concat(C.CHAPTER2_QUESTS).concat(C.CHAPTER3_QUESTS)
    .forEach((id) => (storySt.story.completed[id] = true));
  storySt.story.questId = "prepare_four_seasons";
  ["potato", "bell_pepper", "grapes", "melon"].forEach((id) => (storySt.stats.harvested[id] = 1));
  const ch4a = G.syncStoryProgress(storySt, null, T0);
  assert(ch4a.ok && ch4a.completedIds.includes("prepare_four_seasons") && storySt.story.questId === "welcome_ducks",
    "chapter 4 advances after harvesting all four seasons");
  storySt.stats.collected.duck_egg = 1;
  const ch4b = G.syncStoryProgress(storySt, null, T0);
  assert(ch4b.ok && ch4b.completedIds.includes("welcome_ducks") && storySt.story.questId === "finish_festival_order",
    "chapter 4 advances after collecting duck egg");
  storySt.storage.items.duck_egg = 2;
  storySt.storage.items.potato = 1;
  storySt.orders = [{ id: "festival_finish", wants: { duck_egg: 2, potato: 1 }, rarity: "festival", rewardCoins: 120, rewardXp: 20, expiresAt: T0 + 999999 }];
  const ch4c = G.fulfillOrder(storySt, "festival_finish", T0 + 1, () => 0.1);
  assert(ch4c.ok && ch4c.story && ch4c.story.completedIds.includes("finish_festival_order") && G.chapter4Done(storySt),
    "festival order completes chapter 4");
  assert(G.npcPhase(storySt) === "ch4done", "npc phase reaches ch4done");
  assert(storySt.collections.festival_lantern === true, "festival order grants festival lantern collectible");
  assert(storySt.achievements.seasonalTable && storySt.achievements.festivalDeal,
    "seasonalTable and festivalDeal achievements unlock");

  const journal = G.journalSummary(storySt, T0);
  assert(journal.achievements.length === Object.keys(C.ACHIEVEMENTS).length, "journal achievement count follows config");
  assert(journal.collectibles.length === Object.keys(C.COLLECTIBLES).length
    && journal.collectibles.find((c) => c.id === "festival_lantern").unlocked === true,
    "journal collectible count includes unlocked festival lantern");
  assert(journal.chapters.chapter4.done === C.CHAPTER4_QUESTS.length && journal.chapters.chapter4.unlocked === true,
    "journal chapter 4 completion is tracked");
}

console.log("\n== 19. R48: grandma letters, crops3, festival stall ==");
{
  assert(["pea", "sweet_potato", "winter_kale"].every((id) => C.CROPS[id] && C.CROPS[id].sheet === "crops3"),
    "R48 crops route to crops3 sheet");
  assert(C.BUILDINGS.festival_stall && C.BUILDINGS.festival_stall.effect.seasonalSellBonus === 0.15,
    "festival_stall building has seasonal sell bonus");
  assert(C.COLLECTIBLES.grandma_hat && C.COLLECTIBLES.seed_pouch && C.ACHIEVEMENTS.letterKeeper
    && C.ACHIEVEMENTS.fullPantry && C.ACHIEVEMENTS.stallOwner,
    "R48 collectibles and achievements are registered");
  assert(C.LETTERS.length === 8 && C.CHAPTER5_LETTERS.length === 8
    && C.LETTERS.every((l) => Array.isArray(l.body) && l.body.length >= 3 && l.body.length <= 6),
    "chapter 5 includes eight complete 3-6 sentence letters");

  const letterSt = S.defaultState(T0);
  letterSt.level = 8;
  assert(G.evaluateLetters(letterSt, T0).length === 0, "letters stay locked before unlock conditions");
  letterSt.story.completed.first_delivery = true;
  assert(G.evaluateLetters(letterSt, T0).includes("letter_first_delivery"), "first delivery unlocks first letter");
  letterSt.flags.bridgeRepaired = true;
  assert(G.evaluateLetters(letterSt, T0).includes("letter_bridge"), "bridge repair unlocks bridge letter");
  if (!letterSt.animals.length) letterSt.animals.push({ id: "a_test", type: "chicken", homeId: "b_test" });
  letterSt.animals[0].bestAffinity = C.AFFINITY_HAPPY_THRESHOLD;
  assert(G.evaluateLetters(letterSt, T0).includes("letter_animals"), "happy animal unlocks animal letter");
  letterSt.stats.seasonsReached.春 = true;
  assert(G.evaluateLetters(letterSt, T0).includes("letter_spring"), "spring reached unlocks spring letter");
  letterSt.stats.seasonsReached.夏 = true;
  assert(G.evaluateLetters(letterSt, T0).includes("letter_summer"), "summer reached unlocks summer letter");
  letterSt.stats.seasonsReached.秋 = true;
  assert(G.evaluateLetters(letterSt, T0).includes("letter_autumn"), "autumn reached unlocks autumn letter");
  letterSt.stats.seasonsReached.冬 = true;
  assert(G.evaluateLetters(letterSt, T0).includes("letter_winter"), "winter reached unlocks winter letter");
  letterSt.stats.festivalOrders = 1;
  assert(G.evaluateLetters(letterSt, T0).includes("letter_festival"), "festival order unlocks festival letter");

  const animalRead = G.readLetter(letterSt, "letter_animals");
  assert(animalRead.ok && letterSt.collections.grandma_hat === true, "reading animal letter unlocks grandma_hat");
  for (const id of C.CHAPTER5_LETTERS) {
    letterSt.mail.unlocked[id] = true;
    G.readLetter(letterSt, id);
  }
  assert(letterSt.achievements.letterKeeper === true, "reading all letters unlocks letterKeeper");
  const reply = G.replyLetter(letterSt);
  assert(reply.ok && letterSt.mail.replied === true && letterSt.collections.seed_pouch === true,
    "replyLetter requires all read and unlocks seed_pouch");

  for (const id of Object.keys(C.CROPS)) letterSt.stats.harvested[id] = 1;
  letterSt.buildings.push({ id: "b_stall", type: "festival_stall" });
  G.checkAchievements(letterSt);
  assert(letterSt.achievements.fullPantry && letterSt.achievements.stallOwner,
    "fullPantry and stallOwner achievements unlock");

  const bonusSt = S.defaultState(T0);
  bonusSt.level = 8;
  bonusSt.weather = { id: "clear", untilMs: T0 + 999999 };
  bonusSt.season = { id: "春", untilMs: T0 + 999999 };
  bonusSt.buildings.push({ id: "stall_a", type: "festival_stall" }, { id: "stall_b", type: "festival_stall" });
  assert(Math.abs(G.buildingSeasonalBonus(bonusSt) - 0.15) < 1e-9,
    "legacy duplicate festival_stall is capped to one +0.15 seasonal bonus");
  assert(G.sellUnitValue(bonusSt, "pea", T0) > C.CROPS.pea.sellValue,
    "festival stall bonus applies to in-season crop sell value");

  const migrated = S.migrate({ version: 1, coins: 5, map: { width: C.MAP_W, height: C.MAP_H, tiles: [] } });
  assert(migrated.mail && migrated.mail.unlocked && migrated.mail.read && migrated.mail.replied === false
    && migrated.stats && migrated.stats.seasonsReached,
    "old saves migrate mail and seasonsReached safely");

  const chapterSt = S.defaultState(T0);
  C.PROLOGUE_QUESTS.concat(C.CHAPTER2_QUESTS).concat(C.CHAPTER3_QUESTS).concat(C.CHAPTER4_QUESTS)
    .forEach((id) => (chapterSt.story.completed[id] = true));
  for (const id of C.CHAPTER5_LETTERS) {
    chapterSt.mail.unlocked[id] = true;
    chapterSt.mail.read[id] = true;
  }
  chapterSt.mail.replied = true;
  const j = G.journalSummary(chapterSt, T0);
  assert(j.chapters.chapter5.unlocked === true && j.chapters.chapter5.done === C.CHAPTER5_LETTERS.length
    && j.chapters.chapter5.replied === true && j.chapters.chapter5.complete === true,
    "journal chapter 5 completion tracks letters and reply");
  assert(G.chapter5Done(chapterSt) && G.npcPhase(chapterSt) === "ch5done",
    "chapter5Done drives NPC phase ch5done");
}

console.log("");
if (failed === 0) { console.log("✅ 全部 MVP2 系統測試通過"); process.exit(0); }
else { console.error(`❌ ${failed} 項失敗`); process.exit(1); }
