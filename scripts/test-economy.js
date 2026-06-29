/* =========================================================================
 * test-economy.js — Pixel Idle Farm 經濟與進度模擬測試（CI/開發用，零依賴）
 *
 * 放置遊戲的核心是「時間 × 經濟」，比視覺更該被驗證。本檔用純邏輯：
 *   - 驗證成長/收成/賣出/訂單/升級/離線回補的正確性
 *   - 模擬理想玩法，檢查 game-design.md 的節奏目標：
 *       首次收成 < 20s、第 2 次升級 < 3min、新作物解鎖 < 8min
 * 執行：node scripts/test-economy.js
 * ========================================================================= */

const path = require("path");
const C = require(path.join(__dirname, "..", "src", "config.js"));
const S = require(path.join(__dirname, "..", "src", "state.js"));
const G = require(path.join(__dirname, "..", "src", "game.js"));

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.error("  ✗ " + msg); failed++; }
}
// 可重現 RNG（線性同餘），測試用固定 seed
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const T0 = 1_000_000; // 固定起始 timestamp

console.log("== 1. 成長與收成 ==");
{
  const st = S.defaultState(T0);
  const r = G.plant(st, 0, "wheat", T0);
  assert(r.ok, "可種小麥");
  assert(st.coins === C.GAME.startCoins - 1, "種小麥扣 1 金");
  let p = G.getCropProgress(st, st.plots[0], T0 + 7000);
  assert(!p.ready && p.ratio > 0.4 && p.ratio < 0.6, "7.5s 時約半熟、未成熟");
  p = G.getCropProgress(st, st.plots[0], T0 + 15000);
  assert(p.ready && p.stage === 4, "15s 後成熟、階段 4");
  const h = G.harvest(st, 0, T0 + 15000);
  assert(h.ok && h.added === 2, "收成得 2 小麥");
  assert((st.storage.items.wheat || 0) === 2, "倉庫有 2 小麥");
  assert(st.xp === 1, "收成得 1 XP");
}

console.log("\n== 2. 賣出與經濟為正 ==");
{
  const st = S.defaultState(T0);
  G.plant(st, 0, "wheat", T0);
  G.harvest(st, 0, T0 + 15000);
  const coinsBefore = st.coins;
  const sell = G.sellItem(st, "wheat", 2, T0 + 15000);
  assert(sell.ok && sell.coins === 2, "賣 2 小麥得 2 金");
  // 一輪小麥：成本1 + 收入2 = 淨 +1
  assert(st.coins - (coinsBefore) === 2, "賣出加 2 金");
  assert(st.coins === C.GAME.startCoins - 1 + 2, "一輪小麥淨 +1 金");
}

console.log("\n== 3. 理想玩法進度節奏（首收 <20s / 升級 <3min / 新作物 <8min）==");
{
  const st = S.defaultState(T0);
  let now = T0;
  const STEP = 1000; // 每秒一個模擬步
  let firstHarvestSec = null, secondUpgradeSec = null, carrotSec = null;
  let upgradesBought = 0;

  for (let sec = 0; sec <= 600; sec++) { // 模擬最多 10 分鐘
    now = T0 + sec * STEP;
    // 策略：先把買得起的升級買掉（plotCount→growthSpeed 優先），再賣庫存、補種
    // 1) 收成所有成熟
    const before = st.stats.harvested.wheat || 0;
    G.harvestAll(st, now);
    if (firstHarvestSec === null && Object.keys(st.stats.harvested).length > 0) firstHarvestSec = sec;
    // 2) 賣掉所有庫存換金
    G.sellAll(st, now);
    // 3) 嘗試買升級（便宜優先）
    for (const key of ["plotCount", "growthSpeed", "sellBonus"]) {
      const nx = G.nextUpgrade(st, key);
      if (nx && st.coins >= nx.cost) {
        const b = G.buyUpgrade(st, key);
        if (b.ok) { upgradesBought++; if (upgradesBought === 2 && secondUpgradeSec === null) secondUpgradeSec = sec; }
      }
    }
    // 4) 補種：早期衝升級的理想玩法是種「便宜快速」作物維持現金週轉。
    //    保留一格不種以維持升級存款的流動性（其餘格子持續循環產出收入）。
    const active = G.activePlotCount(st);
    const liquidPicks = ["carrot", "wheat"].filter((id) => G.isCropUnlocked(st, id));
    const cap = Math.min(st.plots.length, active);
    const emptyIdx = [];
    for (let i = 0; i < cap; i++) if (!st.plots[i].cropId) emptyIdx.push(i);
    // 接近升級門檻時，留 1 格空著存錢；否則全種滿
    const cheapestNext = ["plotCount", "growthSpeed", "sellBonus"]
      .map((k) => G.nextUpgrade(st, k)).filter(Boolean).map((u) => u.cost).sort((a, b) => a - b)[0];
    const reserveOne = cheapestNext && st.coins >= 0.5 * cheapestNext && emptyIdx.length > 1;
    const plantCount = reserveOne ? emptyIdx.length - 1 : emptyIdx.length;
    for (let k = 0; k < plantCount; k++) {
      const pick = liquidPicks.find((id) => st.coins >= C.CROPS[id].seedCost);
      if (pick) G.plant(st, emptyIdx[k], pick, now);
    }
    // 記錄胡蘿蔔（lv2）解鎖
    if (carrotSec === null && st.level >= 2) carrotSec = sec;
  }

  console.log(`    首次收成: ${firstHarvestSec}s, 第2次升級: ${secondUpgradeSec}s, 解鎖胡蘿蔔(lv2): ${carrotSec}s, 等級: ${st.level}, 金幣: ${st.coins}`);
  assert(firstHarvestSec !== null && firstHarvestSec < 20, `首次收成 < 20s（實際 ${firstHarvestSec}s）`);
  assert(secondUpgradeSec !== null && secondUpgradeSec < 180, `第 2 次升級 < 3min（實際 ${secondUpgradeSec}s）`);
  assert(carrotSec !== null && carrotSec < 480, `新作物(胡蘿蔔)解鎖 < 8min（實際 ${carrotSec}s）`);
  assert(st.level >= 2, "10 分鐘內至少 lv2");
}

console.log("\n== 4. 倉庫容量與溢出 ==");
{
  const st = S.defaultState(T0);
  assert(G.storageCapacity(st) === C.GAME.baseStorage, `初始容量 ${C.GAME.baseStorage}`);
  // 塞爆倉庫
  st.storage.items.wheat = C.GAME.baseStorage;
  const add = G.addToStorage(st, "wheat", 5);
  assert(add.added === 0 && add.lost === 5, "倉滿時新增全溢出");
  // 升級擴倉
  st.coins = 9999;
  G.buyUpgrade(st, "storageLevel");
  assert(G.storageCapacity(st) === C.GAME.baseStorage + C.UPGRADES.storageLevel.levels[0].value, "擴倉後容量提高");
}

console.log("\n== 5. 訂單：生成 / 完成優於直售 / 連單 ==");
{
  const st = S.defaultState(T0);
  st.level = 2; // 解鎖胡蘿蔔，讓訂單更有料
  const rng = makeRng(42);
  G.refreshOrders(st, T0, rng);
  assert(st.orders.length === C.GAME.orderSlots, `生成 ${C.GAME.orderSlots} 筆訂單`);
  const order = st.orders[0];
  assert(Object.keys(order.wants).length >= 1, "訂單要求至少一種作物");
  // 訂單獎金應高於同作物直售（payMult >= 1.35）
  let directValue = 0;
  for (const [cid, q] of Object.entries(order.wants)) directValue += C.CROPS[cid].sellValue * q;
  assert(order.rewardCoins > directValue, `訂單獎金(${order.rewardCoins}) > 直售(${directValue})`);
  // 備齊作物並完成
  for (const [cid, q] of Object.entries(order.wants)) st.storage.items[cid] = q;
  const f = G.fulfillOrder(st, order.id, T0, rng);
  assert(f.ok && f.coins > 0, "完成訂單得金幣");
  assert(st.orderStreak === 1, "連單 +1");
  assert(st.orders.length === C.GAME.orderSlots, "完成後自動補單");
  // 丟單斷連
  G.trashOrder(st, st.orders[0].id, T0, rng);
  assert(st.orderStreak === 0, "丟單後連單歸零");
}

console.log("\n== 6. 升級扣費與數值變動 ==");
{
  const st = S.defaultState(T0);
  st.coins = 10000;
  const cap0 = G.activePlotCount(st);
  G.buyUpgrade(st, "plotCount");
  assert(G.activePlotCount(st) > cap0, "開墾後農地數增加");
  assert(st.plots.length >= G.activePlotCount(st), "plots 陣列已補足");
  const mult0 = G.growthMultiplier(st, T0);
  G.buyUpgrade(st, "growthSpeed");
  assert(G.growthMultiplier(st, T0) < mult0, "肥沃土壤後成長倍率下降（更快）");
  const sell0 = G.sellUnitValue(st, "wheat", T0);
  st.coins = 10000;
  // 衝高 sellBonus 需要 tomato 價格才看得出（wheat=1 取整可能不變），改用 tomato
  const v0 = G.sellUnitValue(st, "tomato", T0);
  G.buyUpgrade(st, "sellBonus");
  assert(G.sellUnitValue(st, "tomato", T0) > v0, "市集人脈後番茄售價提高");
}

console.log("\n== 7. 離線進度：無幫手成熟 / 幫手自動收 / 自動補種多輪 / 上限 ==");
{
  // 無幫手：離線後成熟但未收
  const a = S.defaultState(T0);
  G.plant(a, 0, "wheat", T0);
  const sumA = G.applyOffline(a, T0 + 60000); // 離線 60s
  assert(sumA.readyPlots === 1, "無幫手：成熟格數記為 1");
  assert((a.storage.items.wheat || 0) === 0, "無幫手：未自動入庫");

  // 幫手 autoHarvest（lv1）：自動收一輪
  const b = S.defaultState(T0);
  b.upgrades.helperLevel = 1;
  G.plant(b, 0, "wheat", T0);
  const sumB = G.applyOffline(b, T0 + 60000);
  assert((sumB.perCrop.wheat || 0) === 2, "幫手 lv1：自動收成 2 小麥");
  assert(b.plots[0].cropId === null, "幫手 lv1：收成後格子清空（不自動補種）");

  // 幫手 autoPlant（lv2）：60s 內小麥(15s)約 4 輪
  const c = S.defaultState(T0);
  c.upgrades.helperLevel = 2;
  c.coins = 1000; // 確保有種子錢
  G.plant(c, 0, "wheat", T0);
  const sumC = G.applyOffline(c, T0 + 60000);
  assert((sumC.perCrop.wheat || 0) >= 6, `幫手 lv2：60s 自動補種多輪收成（實際 ${sumC.perCrop.wheat || 0}）`);
  assert(sumC.replanted >= 3, `幫手 lv2：補種多次（實際 ${sumC.replanted}）`);
  assert(c.plots[0].cropId === "wheat", "幫手 lv2：結束時仍有作物在長");

  // 離線上限 8h
  const d = S.defaultState(T0);
  d.upgrades.helperLevel = 2; d.coins = 1e9;
  G.plant(d, 0, "wheat", T0);
  const sumD = G.applyOffline(d, T0 + 48 * 60 * 60 * 1000); // 離線 48h
  assert(sumD.offlineMs === C.GAME.offlineCapMs, "離線時間被截到 8h 上限");
  assert(sumD.cappedFromMs > C.GAME.offlineCapMs, "有記錄超出上限的原始時間");
}

console.log("\n== 8. 等級曲線與作物解鎖 ==");
{
  const st = S.defaultState(T0);
  assert(G.unlockedCrops(st).length === 1, "lv1 只解鎖小麥");
  st.xp = C.LEVEL_XP[1]; st.level = C.levelFromXp(st.xp);
  assert(st.level === 2 && G.unlockedCrops(st).includes("carrot"), "達門檻升 lv2 解鎖胡蘿蔔");
  st.xp = C.LEVEL_XP[4]; st.level = C.levelFromXp(st.xp);
  assert(G.unlockedCrops(st).length === 5, "lv5 解鎖全部 5 作物");
}

console.log("\n== 9. 天氣（lv5 解鎖）==");
{
  const st = S.defaultState(T0);
  st.level = 1;
  assert(G.currentWeather(st, T0) === "clear", "lv1 永遠晴朗（天氣未解鎖）");
  st.level = 5;
  const rng = makeRng(7);
  G.updateWeather(st, T0, rng);
  assert(["clear", "rain", "sunny"].includes(st.weather.id), "lv5 後天氣會變化");
  // rain 加速成長
  st.weather = { id: "rain", untilMs: T0 + 1e9 };
  const growRain = G.effectiveGrowMs(st, "wheat", T0);
  st.weather = { id: "clear", untilMs: T0 + 1e9 };
  const growClear = G.effectiveGrowMs(st, "wheat", T0);
  assert(growRain < growClear, "降雨時成長更快");
}

console.log("\n== 10. 存檔遷移（向後相容）==");
{
  const old = { version: 0, coins: 5, plots: [{ id: "p01", cropId: "wheat", plantedAt: 123 }] };
  const m = S.migrate(old);
  assert(m.coins === 5 && m.storage && m.storage.items && m.upgrades && m.stats, "舊存檔欄位補齊不崩");
  assert(m.version === C.GAME.version, "版本號更新");
}

console.log("");
if (failed === 0) { console.log("✅ 全部經濟測試通過"); process.exit(0); }
else { console.error(`❌ ${failed} 項失敗`); process.exit(1); }
