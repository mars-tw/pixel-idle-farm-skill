# Grok 審查報告 — 像素農場 R1

- **專案**：pixel-idle-farm-skill（《像素農場》）
- **審查基準**：`src/` 全檔（`config.js` / `game.js` / `state.js` / `ui.js` / `atlas.js`），對照現行 r48-20260709-1 結構與既有守門語意
- **審查角色**：資深遊戲工程師 × 正確性／效能對抗式審查
- **範圍**：只產出本文件；不改遊戲程式碼／測試／資源
- **優先級**：
  - **P0**：會造成錯誤進度、可被穩定利用的經濟破局、或明顯壞體驗（進度倒退／存檔半壞）
  - **P1**：實質正確性缺口、可感知效能成本、架構擴充摩擦
  - **P2**：品質債、邊界硬化、平衡微調、可讀性

---

## 執行摘要（Top 5 最有價值優化）

| # | 面向 | 項目 | 優先級 | 預期效益 |
|---|------|------|--------|----------|
| 1 | 正確性 | 成長時間倍率「回溯重算」導致進度倒退 | P0 | 消除雨後／升級後作物倒退的核心放置信任危機 |
| 2 | 效能 | `updateMap` 每 250ms 全圖 DOM 重建＋全磚 `paintGround` | P0 | 低階裝置穩定幀率；讓 performanceMode 真正降成本 |
| 3 | 經濟 | 建築無數量上限，光環／倉容／季節加成無限堆疊 | P0 | 堵住後期成長時間趨近歸零與賣價膨脹破局 |
| 4 | 正確性 | 離線季節／天氣不 catch-up；`migrate` 維度相符即信任 map | P1 | 章節信箋／季節統計可信；髒存檔不進半壞地圖 |
| 5 | 架構／平衡 | `game.js` 職責過載＋`ORDER_QTY`／任務條件硬編碼；`plotCount` 末級無效 | P1 | 降新作物／章節成本；回收無效升級支出 |

---

## 1. 正確性／潛在 Bug

### P0

#### C-P0-01　成長倍率以「當下」重算，成熟進度可倒退
- **檔案:問題:建議＋效益**
  - `src/game.js`:`getCropProgress`／`effectiveGrowMs`／`growthMultiplier`：`elapsed / growMs(now)`，`growMs` 吃**當下**天氣、肥沃升級、建築光環、濕土。降雨（`growthMul: 0.7`）結束、或玩家中途買肥沃土壤後，同一格 `elapsed` 不變但分母變大 → **ratio 下降、已近成熟變未熟**。
  - **建議**：鎖定種植當下的有效週期（`plot.effectiveGrowMs` 或 `plot.readyAt`），或只允許倍率「加速方向」即時生效、減速則凍結至下輪；離線路徑共用同一公式。
  - **效益**：放置遊戲最重要的時間信任；避免「看著進度條倒退」。

#### C-P0-02　建築可無限興建，成長光環連乘無上限
- **檔案:問題:建議＋效益**
  - `src/game.js`:`buildBuilding` 無 `buildingCount` 上限；`buildingGrowthAura` 對每棟 `growthAura` **連乘**（堆肥 0.90、蜂箱 0.92、溫室 0.88）。
  - `src/config.js`:`BUILDINGS.*.effect.growthAura`。
  - 玩家可堆 N 座堆肥場使成長時間趨近下限 `1000ms`，離線＋幫手時產能爆炸。
  - **建議**：每 type 上限 1（或 config `maxCount`）；光環改 `min`／遞減疊加；或僅「鄰近田」生效（與文案 beeBox 一致）。
  - **效益**：堵住後期經濟破局；讓升級曲線與作物 CP 表有意義。

#### C-P0-03　季節加成建築同樣可無限疊加（測試已固化疊加語意）
- **檔案:問題:建議＋效益**
  - `src/game.js`:`buildingSeasonalBonus` 累加 `seasonalSellBonus`。
  - `scripts/test-systems.js` 明示兩座 `festival_stall` → +0.30（設計／漏洞邊界模糊）。
  - **建議**：`festival_stall`／`silo`／光環建築統一 `maxCount:1`；測例改「不可蓋第二座」或「第二座無額外效果」。
  - **效益**：季節經濟可控；成就「四季攤主」與「蓋十座攤」脫鉤。

### P1

#### C-P1-01　`migrate` 只比對地圖寬高，空／髒 tiles 也當合法
- **檔案:問題:建議＋效益**
  - `src/state.js`:`sameDims = width===MAP_W && height===MAP_H && Array.isArray(tiles)`；**不**檢查 `tiles.length === W*H`、plot 對應、結構／站點完整性。
  - 空 `tiles: []` 仍走保留分支 → 半壞存檔（測例 `test-systems.js` 甚至用此型別只驗 mail 欄位）。
  - `GAME.version` 恆為 `1`，內容改版無法靠 version 觸發重建。
  - **建議**：健全性檢查失敗則 `makeMap()` 重建並保留 coins／story／storage；引入 `mapRevision` 或 bump `GAME.version` 遷移表。
  - **效益**：避免上線後改 layout 讓老玩家卡死在幽靈地圖。

#### C-P1-02　離線期間季節只會在上線後「推進一季」
- **檔案:問題:建議＋效益**
  - `src/game.js`:`updateSeason` 每次呼叫最多把 `season` 往前 **一格** 並設 `untilMs = now + SEASON_DURATION_MS`。
  - 離線 2 小時（季長 20 分）應跨多季，實際上線只進一季 → `stats.seasonsReached`／信箋 `season_reached` 解鎖延遲。
  - **建議**：依 `lastSeenAt`／`untilMs` while-loop catch-up（設安全上限 4～N 季），離線摘要可列「經過的季節」。
  - **效益**：第四章／第五章季節信節奏與真實離線時間一致。

#### C-P1-03　離線天氣語意不一致；成長幾乎總是 clear
- **檔案:問題:建議＋效益**
  - `applyOffline` 註解寫「天氣視為 clear」，實作卻 `effectiveGrowMs(..., offlineNow)` → 若 `weather.untilMs` 仍有效會吃舊天氣，過期則 `currentWeather` 回 `"clear"`。
  - 離線上限 8h、天氣段 10 分 → 長離線幾乎總 clear，與線上雨天種下的預期不符（又與 C-P0-01 疊加）。
  - **建議**：離線明確鎖定 clear，或依時間軸分段積分；註解與實作對齊並加測。
  - **效益**：離線結算可解釋、可測。

#### C-P1-04　章節任務「養到開心」用現值親密度，易因衰減卡關
- **檔案:問題:建議＋效益**
  - `src/game.js`:`questSatisfied` → `raise_affinity_happy` 用 `animalAffinity(...) >= 70`。
  - 信箋 `animal_happy`／Journal 已正確用 `bestAffinity`；任務卻用會衰減的現值。
  - 玩家衝到 70 後離開／忙訂單，回來衰減＜70 且未再觸發同步 → 任務不完成。
  - **建議**：條件改 `bestAffinity`（或首次跨門檻時寫 `flags.animalHappyOnce`）。
  - **效益**：第三章節奏穩定，與 Journal 語意一致。

#### C-P1-05　`applyOffline` 未呼叫 `recordDiscovery`
- **檔案:問題:建議＋效益**
  - `harvest`／`collectAnimal` 線上會 `recordDiscovery`；離線收成／產物只改 `stats.harvested`／`collected`。
  - Journal「首次發現時間」依賴 `discoveries.items`，離線首獲作物時間會缺或落到之後 migrate 回填。
  - **建議**：離線成功入庫時對每個 itemId 呼叫 `recordDiscovery(state, id, offlineNow)`。
  - **效益**：圖鑑時間軸正確。

#### C-P1-06　RNG 非決定性：訂單／天氣／委託預設 `Math.random`
- **檔案:問題:建議＋效益**
  - `src/game.js`:`makeOrder`／`updateWeather`／`generateNpcRequest` 的 `rng || Math.random`。
  - `refreshOrders` idSeed 用 `now + seed`，**內容**不可重現；`ui.js` loop 每 tick 呼叫 `refreshOrders` 不傳 rng。
  - **建議**：存檔帶 `rngState`；或 `seededRng(hash(saveId, ordersSeededAt, dayBucket))`；測試路徑已有 `makeRng` 可沿用。
  - **效益**：支援重現 bug、經濟模擬、反作弊稽核。

#### C-P1-07　動物狀態預設字串 `"happy"` 與親密度門檻語意重疊
- **檔案:問題:建議＋效益**
  - `src/game.js`:`animalStatus`：親和 ≥70 → `"happy"`；三項照護皆未過期也回 `"happy"`（即使親和 0）。
  - UI 用同一 status 切 `animals_care` 開心幀 → 剛全套照護的低親和動物也顯示開心姿態。
  - **建議**：拆 `mood`（親和）與 `careNeed`（hungry/thirsty/…）；或低親和時回 `"content"`／`"idle"`。
  - **效益**：照護回饋可讀，避免「看起來很開心但其實普通蛋」。

#### C-P1-08　地圖索引 O(n) 查找在 BFS／autotile 熱路徑重複
- **檔案:問題:建議＋效益**
  - `src/game.js`:`getTileXY`／`getTileById` 每次 `tiles.find`；BFS 每鄰居一次。
  - 地圖 22×12 尚可，但與每 tick 渲染疊加後在低階機放大。
  - **建議**：建 `tileGrid[y][x]`／`tileById` 於 `makeMap`／migrate 後快取（屬正確性周邊的結構健全）。
  - **效益**：尋路與渲染穩定性；為未來大地圖預留。

#### C-P1-09　預置結構給予免費雞舍／畜舍建築實體
- **檔案:問題:建議＋效益**
  - `src/state.js`:`seedStructures` 依 `STRUCTURES[].building` 直接塞 `buildings`＋起始雞。
  - `isAnimalUnlocked` 註解已承認「家已存在不能再當解鎖」——經濟上等於跳過 `BUILDINGS.chickenCoop`／`barn` 成本。
  - **建議**：預置結構僅視覺／互動殼，產能建築仍需 `build` 解鎖；或明確標「故事贈與」並從商店移除重複項。
  - **效益**：建築成本表與真實進度一致（設計決策，但現況易誤導平衡）。

#### C-P1-10　數值無下限防護（依賴呼叫順序）
- **檔案:問題:建議＋效益**
  - `spendCost`／`plant`／`clearObstacle` 直接 `-=`；`materials[k]` 缺失時理論可 NaN（正常路徑有 `canAffordCost`）。
  - 無 `coins`／`materials` 的 `Math.max(0, …)` 歸一；匯入髒存檔可能負金幣。
  - **建議**：`migrate` 夾緊非負整數；所有扣款 API 統一 `assertAfford + apply`。
  - **效益**：存檔／匯入邊界硬化。

### P2

#### C-P2-01　濕土旗標 `wateredAt` 收成後殘留
- **檔案:問題:建議＋效益**
  - `harvest` 只清 `cropId`／`plantedAt`；`isWet` 需 `cropId` 故線上多半安全。
  - **建議**：收成時 `delete plot.wateredAt`；離線多輪補種時明確「新輪不繼承濕土」（若為設計則寫進註解）。
  - **效益**：狀態機單純、除錯友善。

#### C-P2-02　`addToStorage` 在 `added=0` 時可能寫入 0 數量鍵
- **檔案:問題:建議＋效益**
  - `state.storage.items[cropId] = (…||0) + added` 在 added=0 仍可能建立鍵。
  - **建議**：`if (added>0)` 才寫入。
  - **效益**：倉庫 UI／序列化更乾淨。

#### C-P2-03　東林區域魔法數與 config 常數不完全同源
- **檔案:問題:建議＋效益**
  - `EAST_REGION_MIN_X = 17`，但 `east_deep` 使用硬編碼 `x>=19 && y>=8`（`state.js` makeMap／applyRegions 與 layout `D` 點）。
  - **建議**：`EAST_DEEP_RECT` 常數化並單一來源。
  - **效益**：改地圖不再漏改封鎖邏輯。

#### C-P2-04　`farmSeason(now)` 與 `currentSeason` 兩套季節語意
- **檔案:問題:建議＋效益**
  - `src/game.js`:`farmSeason` 用絕對時間／`SEASON_DURATION_MS` 取模；`farmActionSuggestions` 已改用 `currentSeason`。
  - **建議**：刪除或標 deprecated，避免未來誤用。
  - **效益**：減少季節 bug 面。

#### C-P2-05　訂單過期丟棄不重置連單、丟單才重置
- **檔案:問題:建議＋效益**
  - `refreshOrders` 過濾過期；`trashOrder` 才 `orderStreak=0`。
  - 可能為設計（鼓勵接單不丟），但玩家放著過期可保連單。
  - **建議**：若要懲罰怠惰，過期也衰減 streak；否則在 UI 說明「過期不斷連單」。
  - **效益**：預期一致。

---

## 2. 效能

### P0

#### P-P0-01　主迴圈每 250ms 全量 `updateMap`：拆 DOM＋重貼 atlas
- **檔案:問題:建議＋效益**
  - `src/ui.js`:`loop` → `updateMap` → `paintGround`（**全部** ground tile `Atlas.applyTo`）＋清空 `obDyn` 後重建作物／自建建築／動物／NPC／標記。
  - 22×12=264 磚 × 每秒 4 次 ≈ **1000+ 次** style/background 寫入，外加數十動態節點 GC。
  - `performanceMode` 只調天氣 CSS class（`applyPerformanceMode`），**不**降地圖 tick 成本。
  - **建議**：
    1. 地面：只在 wet／sel／region lock／季節視覺變時 dirty-paint；
    2. 作物：進度條用 CSS 或重用節點改 width，成熟前降頻（1s）；
    3. 動物／NPC 動畫幀改 class／transform，勿每 tick `remove`+`create`；
    4. `perf-low`：地圖 tick 500–1000ms、關動物漫遊、簡化 autotile。
  - **效益**：行動裝置可玩性與電池；PWA 低階機不再靠運氣。

### P1

#### P-P1-01　`paintGround` 內每磚呼叫 `getCropProgress`＋四向 `getTileXY` autotile
- **檔案:問題:建議＋效益**
  - `terrainFrame`／`edgeSidesFor` 每 tick 重算鄰接；鎖定農地數不變時 suffix 穩定。
  - **建議**：`terrainFrameId` 快取於 tile 或 side-table，soil wet 變時失效。
  - **效益**：主執行緒 CPU 明顯下降。

#### P-P1-02　雙重農地呈現：`buildFarm` 側欄格 + 地圖作物
- **檔案:問題:建議＋效益**
  - `updateFarm` 與 `updateMap` 作物邏輯並行；維護與每 tick 成本加倍。
  - **建議**：側欄改摘要（成熟數／一鍵操作），細節只留地圖；或側欄 1Hz 更新。
  - **效益**：降 tick 成本、單一真相來源。

#### P-P1-03　VFX 使用 `setInterval` 逐幀改 background
- **檔案:問題:建議＋效益**
  - `spawnVfx`：75ms × 6 幀獨立 timer；連點清障／收成可堆疊多 timer。
  - **建議**：共享 rAF 排程、上限 N 個 VFX、low 模式改單次粒子 CSS。
  - **效益**：避免互動尖峰掉幀。

#### P-P1-04　Atlas `applyTo` 在 `clientWidth===0` 只設 `pendingFrame` 無統一 flush
- **檔案:問題:建議＋效益**
  - `src/atlas.js`：尺寸為 0 時 pending；依賴之後再次 `applyTo`。
  - **建議**：`ResizeObserver` 或 atlas ready／layout 後掃 `pendingFrame`。
  - **效益**：首屏／tab 切回少空白磚。

### P2

#### P-P2-01　`bfsPath` 使用 `queue.shift()`（O(n)）
- **檔案:問題:建議＋效益**
  - 小地圖可接受；**建議** head index 或 typed queue。
  - **效益**：大地圖／多 NPC 尋路預留。

#### P-P2-02　`renderSmartAssistant`／信件檢查在主 loop
- **檔案:問題:建議＋效益**
  - 每 250ms 可能重算建議列表；已有 `lastAssistantSig` 宜確保涵蓋所有依賴。
  - **建議**：1s 節流或 state 雜湊變更才算。
  - **效益**：降 JS 時間。

#### P-P2-03　效能監控自身每幀 `requestAnimationFrame` + 可能重繪設定面板
- **檔案:問題:建議＋效益**
  - 降級／恢復時 `renderSettingsPanel()` 全量 HTML。
  - **建議**：只更新診斷字串節點。
  - **效益**：避免監控反而製造 jank。

---

## 3. 架構可維護性

### P1

#### A-P1-01　`game.js` 已成「規則巨型模組」（~1980 行）
- **檔案:問題:建議＋效益**
  - 同檔包含：經濟、訂單、天氣季節、建築動物、BFS、故事任務、信箋、NPC 委託／支線、Journal、智慧助手、離線結算。
  - Node 測試友好是優點，但 code review／回歸定位成本高。
  - **建議**：維持「純函式＋state」風格，物理拆檔：`rules/crops.js`、`animals.js`、`orders.js`、`story.js`、`world.js`、`offline.js`、`journal.js`，由 `game.js` facade 匯出（瀏覽器可用 bundle 或多 script 順序）。
  - **效益**：章節／系統平行開發；縮小 review  diff。

#### A-P1-02　任務完成條件硬編碼 switch，非資料驅動
- **檔案:問題:建議＋效益**
  - `questSatisfied` 依 `q.id` 分支；`QUESTS` 雖有 `objective`／`trigger` 字串，執行仍靠 id 特判。
  - 新章節 ≈ 改 config **加** game 分支 **加** UI 文案。
  - **建議**：`objective: { type: "stat_gte", path: "stats.fulfilledOrders", n: 1 }` 等小型 DSL；id 特判僅留 prologue 例外。
  - **效益**：新任務多半只改 `config.js`。

#### A-P1-03　`ORDER_QTY` 與物品表分離，新作物易漏
- **檔案:問題:建議＋效益**
  - `src/game.js` 內硬編碼各 crop／product／forage 數量區間；漏列 fallback `[2,5]`（高單價 premium 曾因此過寬，註解已警示）。
  - **建議**：`CROPS[id].orderQty`／`PRODUCTS` 生成時帶入；缺省用 `f(sellValue)`。
  - **效益**：擴作物單點修改；守門可靜態檢查「每個可進訂單池的 id 皆有 qty」。

#### A-P1-04　建築 effect 解讀分散字串約定
- **檔案:問題:建議＋效益**
  - `growthAura`／`storageBonus`／`unlockAnimal`／`seasonalSellBonus` 靠慣例；無 schema／validator 在 runtime。
  - UI `BUILDING_FRAME` 把 `greenhouse`／`duckPen` 等映射到 placeholder frame（`compost_heap`／`chicken_coop`）。
  - **建議**：config 側 `effect` 白名單 + `scripts/test-guards` 擴充；美術 frame 缺則明確 fallback 標記。
  - **效益**：少「蓋了溫室看起來像堆肥」的內容债。

#### A-P1-05　`ui.js` 職責過重（~2750 行）
- **檔案:問題:建議＋效益**
  - 地圖、HUD、PWA、存檔匯出、設定、信件 modal、Journal、工具列全塞一 IIFE。
  - **建議**：`ui/map-render.js`、`ui/hud.js`、`ui/pwa.js`、`ui/journal.js`（即使仍掛 window）。
  - **效益**：渲染優化可局部進行，降低回歸面。

### P2

#### A-P2-01　資料驅動已做得好的部分（應保留）
- **檔案:問題:建議＋效益**
  - `config.js`：作物／動物／建築／NPC 台詞／支線 steps／LETTERS／FORAGE_NODES／MAP layout 函式化——擴內容主路徑正確。
  - `state.js` 只負責存檔與 map 組裝；`atlas.js` 小而專注。
  - **建議**：新系統繼續「config 資料 + game 解讀 + ui 投影」，避免再把規則寫進 `ui.js`。
  - **效益**：維持現有可測性優勢。

#### A-P2-02　全域 `window` 匯出面過大
- **檔案:問題:建議＋效益**
  - game／config 數十 API 掛 window；`ui` 用 `G = window`。
  - **建議**：`window.FarmGame = { ... }` 命名空間（漸進）。
  - **效益**：減少與擴充腳本衝突。

#### A-P2-03　章節常數與 `QUESTS.next` 雙軌
- **檔案:問題:建議＋效益**
  - `PROLOGUE_QUESTS` 等陣列用於完成度；實際串接靠 `next` 欄位——二者可能漂移。
  - **建議**：由 `QUESTS` 推導章節列表，或 CI 斷言陣列與鏈一致（部分 guard 可能已有，宜鞏固）。
  - **效益**：加任務不漏面板計數。

---

## 4. 玩法／經濟平衡（明顯問題）

### 計算基準（無升級、晴朗、無建築光環）

| 作物 | 成本 | 產值 (yield×sell) | 淨利 | growMs | 約 net 金/分 |
|------|------|-------------------|------|--------|----------------|
| wheat | 1 | 2 | +1 | 15s | 4.0 |
| carrot | 4 | 9 | +5 | 45s | 6.7 |
| tomato | 12 | 32 | +20 | 120s | 10.0 |
| strawberry | 30 | 110 | +80 | 300s | 16.0 |
| corn | 20 | 48 | +28 | 210s | 8.0 |
| pumpkin | 85 | 240 | +155 | 900s | 10.3 |
| bell_pepper | 38 | 96 | +58 | 360s | 9.7 |
| potato | 45 | 110 | +65 | 480s | 8.1 |
| grapes | 72 | 220 | +148 | 720s | 12.3 |
| melon | 90 | 270 | +180 | 840s | 12.9 |
| pea | 54 | 140 | +86 | 540s | 9.6 |
| sweet_potato | 68 | 192 | +124 | 660s | 11.3 |
| winter_kale | 84 | 256 | +172 | 780s | 13.2 |

季節同季直售 ×1.15（＋攤位可再加）會再拉開中後期作物。

### P0

#### B-P0-01　建築堆疊破局（同 C-P0-02／03）
- **檔案:問題:建議＋效益**
  - 成長光環連乘 + 季節攤位累加 + 無上限 silo → 中後期「堆建築」優於玩作物節奏。
  - **建議**：上限與遞減；光環與文案一致。
  - **效益**：恢復作物 CP 表與升級曲線的主導地位。

### P1

#### B-P1-01　`plotCount` 第 4 級完全無效
- **檔案:問題:建議＋效益**
  - `src/config.js`:`UPGRADES.plotCount.levels` 第 3、4 級 `value` 皆為 **12**（`maxPlots` 上限），第 4 級成本 1100 無收益。
  - **建議**：刪第 4 級，或提高 `maxPlots`／地圖 soil 至 14–16 並給 value 14/16。
  - **效益**：不騙玩家金幣；開墾線有終局回報。

#### B-P1-02　草莓相對同階作物 CP 偏高
- **檔案:問題:建議＋效益**
  - Lv4 strawberry ~16 金/分淨利，顯著高於 corn／後續多種；南瓜長週期但金/分僅約 10。
  - **建議**：微降 strawberry `sellValue` 或 `yield`，或拉長 `growMs`；或提高 pumpkin 中段回報。
  - **效益**：作物選擇多樣化，而非「解鎖草莓後單一線」。

#### B-P1-03　新手教學訂單報酬極高
- **檔案:問題:建議＋效益**
  - `makeTutorialDeliveryOrder`：`wheat×2` 換 **110** 金 + 8 XP（直售僅 2）。
  - 有助過橋材料／升級，但可能一次跳過早期資源焦慮（若與 startCoins=16 疊加）。
  - **建議**：報酬改 20–40 或改發材料券；測經濟節奏是否仍達 design 目標。
  - **效益**：前 3 分鐘決策仍有意義。

#### B-P1-04　訂單 vs 直售結構整體健康，但 festival 權重需盯
- **檔案:問題:建議＋效益**
  - 契約價生成時鎖定、`payMult` 1.35–2.8 + 連單上限 +100% + sellBonus——訂單應為主收入（設計正確）。
  - `festival` weight 5／總 105，偏稀有；但一經刷出且多品項，獎勵跳躍大。
  - **建議**：festival 需求強制含當季或品質物；或 cap 單筆 payout。
  - **效益**：終局收入方差可控。

#### B-P1-05　季節只影響售價、不限制種植
- **檔案:問題:建議＋效益**
  - `plant` 只檢查 `unlockLevel`；`crop.season` 僅 `sellUnitValue` 與助手加權。
  - 溫室文案「全年控溫」卻只給 `growthAura`，無季節種植權差。
  - **建議**：非當季懲罰成長或禁種，溫室解除；或接受「季節=行情」並改文案。
  - **效益**：四季與溫室系統名實相符。

#### B-P1-06　動物餵食產出 vs 作物機會成本
- **檔案:問題:建議＋效益**
  - 雞：6 分/蛋 sell 6；餵食 2 麥（成本約 2+）立即 1 蛋 + 親密度——合理。
  - 羊 30 分/毛 24、牛 20 分/奶 18；品質 ×1.6／2.6 後訂單很香。
  - 免費 water/groom 20s CD，約 1–2 分鐘可滿開心 → 品質門檻偏低。
  - **建議**：提高 `CARE_COOLDOWN` 或降 `CARE_GAIN`；premium 需維持開心而非瞬間堆疊。
  - **效益**：照護系統有長期黏著，而非章節打卡。

#### B-P1-07　等級曲線在 Lv10 封頂，內容 unlock 在 Lv8
- **檔案:問題:建議＋效益**
  - `LEVEL_XP` 10 段；作物／建築多在 8 前結束 → 終盤只剩訂單刷金與收集。
  - **建議**：Lv11+ 聲望式目標，或 prestige／新地區與 XP 曲線延伸。
  - **效益**：章節 5 之後仍有進度感。

### P2

#### B-P2-01　天氣雙刃不夠直覺
- **檔案:問題:建議＋效益**
  - fog／snow 減速但漲價；storm 小加速微降價——玩家難無 UI 理解淨期望。
  - **建議**：HUD 簡短「成長 ×／售價 ×」已有則強化；助手可提示「豔陽宜賣」。
  - **效益**：系統可見性。

#### B-P2-02　成就售價 +2%/個 可疊到可觀
- **檔案:問題:建議＋效益**
  - 10 成就 = +20% 永久，與 sellBonus 疊加。
  - **建議**：軟上限或遞減；或部分成就改非經濟獎勵。
  - **效益**：避免收集系統變成必刷倍率。

#### B-P2-03　東林深處 CD 30 分 vs 普通 10 分
- **檔案:問題:建議＋效益**
  - 高價 forage（18–28）+ 委託池；節奏偏放置友好。
  - **建議**：觀察是否排擠田地玩法；必要時降 sell 或限日採集次數。
  - **效益**：區域獎勵不壓過主循環。

---

## 5. 交叉矩陣（問題 × 面向）

| ID | 正確性 | 效能 | 架構 | 平衡 |
|----|:------:|:----:|:----:|:----:|
| 成長倍率回溯 | ● | | | ○ |
| 建築無限堆疊 | ● | | ○ | ● |
| updateMap 全量刷新 | | ● | ○ | |
| migrate 維度信任 | ● | | ● | |
| 季節離線 catch-up | ● | | | ○ |
| plotCount 無效級 | | | ○ | ● |
| quest 開心現值 | ● | | ○ | ○ |
| game.js 巨型模組 | | | ● | |
| ORDER_QTY 硬編碼 | ○ | | ● | ○ |
| RNG 非決定性 | ● | | ○ | |

（● 主責，○ 次要）

---

## 6. 建議修復順序（不實作，僅排序）

1. **成長鎖定 readyAt／effectiveGrowMs**（C-P0-01）— 信任根基  
2. **建築 maxCount + 光環／季節規則**（C-P0-02／03）— 經濟封板  
3. **地圖 dirty render + perf-low 真降頻**（P-P0-01）— 裝置覆蓋  
4. **migrate 健全性 + 季節 catch-up + discovery 離線**（C-P1-01／02／05）  
5. **plotCount 修正 + 任務 happy 用 bestAffinity + ORDER_QTY 資料化**（平衡／擴充）  
6. **中期**：拆 `game.js`／`ui.js`；RNG 種子化  

---

## 7. 審查方法與邊界

- **已讀**：`src/config.js`、`game.js`、`state.js`、`ui.js`、`atlas.js` 全文結構與關鍵路徑；抽樣 `scripts/test-economy.js`、`test-systems.js` 以確認「已知測到的行為」vs「未覆蓋的破局」。
- **未做**：實機 profiling、完整 E2E 重跑、數值蒙特卡羅長模擬（表內 CP 為靜態推導）。
- **刻意不列**：純風格偏好、emoji／文案潤飾、與本次四面向無關的美術像素級問題（除建築 frame 誤用影響系統可讀性者）。

---

## 8. 結語

本專案在「時間戳放置哲學、訂單契約價、品質與 bestAffinity、Journal 只讀彙總、Node 可測規則層」上已相當成熟，CI 與 atlas／經濟守門也反映多輪實戰修補。R1 對抗式審查的核心結論是：

> **最危險的不是缺系統，而是「即時倍率回溯」「建築無限連乘」「每 tick 全圖 DOM 重建」三條線在正確性、經濟與效能上同時放大。**

優先封這三條，再收 migrate／季節／任務門檻與資料驅動缺口，即可在不傷現有內容產能的前提下，把 r48 的穩定度再往上推一階。

— Grok Review R1 · 僅文件交付 · 未修改任何遊戲原始碼
