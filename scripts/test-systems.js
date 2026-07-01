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
  assert(st.story.questId === "learn_animal_care", "探索新區完成第二章任務鏈，接上第三章「跟老農學動物照護」");
  // 重複觸發不再給獎
  assert(G.triggerEvent(st, "east_clearing", T0).already === true, "事件獎勵僅一次");
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
  assert(adv4.ok && st.story.questId === null, "賣出優質品後完成第三章任務鏈");
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
  assert(G.npcPhase(st) === "ch2done", "探索東林後進 ch2done");
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
}

console.log("\n== 14b. Stage 7：舊存檔的動物物件補齊照護欄位 ==");
{
  // 模擬 Stage 6.5（尚無照護欄位）存檔的動物形狀
  const oldAnimal = { id: "a_coop_1", type: "chicken", homeId: "b_coop", lastProducedAt: 12345 };
  const old = { version: 1, coins: 5, animals: [oldAnimal], map: { width: C.MAP_W, height: C.MAP_H, tiles: [] } };
  const m = S.migrate(old);
  const a = m.animals.find((x) => x.id === "a_coop_1");
  assert(a && typeof a.affinity === "number" && a.affinity === 0, "舊動物補齊 affinity（預設 0）");
  assert(a && typeof a.lastCaredAt === "number", "舊動物補齊 lastCaredAt");
  assert(a && a.lastFedAt === 0 && a.lastWateredAt === 0 && a.lastGroomedAt === 0, "舊動物補齊 lastFedAt/lastWateredAt/lastGroomedAt");
  assert(m.stats.qualitySold === 0, "舊存檔補齊 stats.qualitySold");
}

console.log("\n== 15. Stage 10.1：NPC 重複委託（core logic）==");
{
  const st = S.defaultState(T0);
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
  assert(m.stats.npcRequestsCompleted === 0, "舊存檔補齊 stats.npcRequestsCompleted");
}

console.log("");
if (failed === 0) { console.log("✅ 全部 MVP2 系統測試通過"); process.exit(0); }
else { console.error(`❌ ${failed} 項失敗`); process.exit(1); }
