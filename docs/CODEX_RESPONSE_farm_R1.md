# Codex 回應 — 像素農場 Grok R1

版本目標：`r49-20260710-1`

## 總結

本輪採納並修正：建築 `maxCount` 與效果封頂、`plotCount` 無效末級、舊開墾等級遷移、離線季節 catch-up、髒 map 健全性、離線 discovery、親密度任務高水位、部分狀態硬化，以及 low performance 下的地圖刷新節流。

本輪沒有把 Grok 全部建議都改完。`readyAt/effectiveGrowMs` 鎖定、RNG 存檔種子化、UI 動態物件節點重用、`game.js/ui.js` 拆檔與任務 DSL 都會改變既有時間語意或模組邊界，列入後續工作。

## 逐條回應

### 正確性 / Bug

| ID | 結論 | 技術理由與處理 |
|---|---|---|
| C-P0-01 成長倍率回溯 | 部分採納，延後實作 | 問題成立：目前仍以查詢當下倍率重算，天氣退場可能讓 ratio 下降。要完整修需在 `plant` 鎖 `readyAt` 或 `effectiveGrowMs` 並設計舊 plot 遷移；這會改變天氣/升級對已種作物的語意，本輪未動。 |
| C-P0-02 growthAura 無上限連乘 | 採納 | `BUILDINGS` 對堆肥場、蜂箱、溫室加 `maxCount: 1`；`buildingGrowthAura` 對舊存檔重複建築只計入每種第一座；`buildBuilding` 擋 `max_count`。 |
| C-P0-03 季節加成建築無限疊加 | 採納 | `festival_stall.maxCount = 1`，`buildingSeasonalBonus` 使用同一套 effect cap。舊存檔重複攤位只給 +0.15。 |
| C-P1-01 migrate 信任髒 map | 採納 | `healthyMap` 驗證尺寸、tile 數、座標、id、terrain、soil/plotIndex 唯一性；不健康就重建 map，但保留金幣、倉庫、故事等進度。 |
| C-P1-02 離線季節只推進一季 | 採納 | `advanceSeasonState` 依 `untilMs` 與季長計算跨越季數，離線 `applyOffline` 也呼叫，並補 `stats.seasonsReached` 與摘要欄位。 |
| C-P1-03 離線天氣語意 | 部分採納 | 註解已改成「離線結束點倍率」，不再宣稱 clear；尚未做整段離線天氣分段積分。 |
| C-P1-04 任務開心用現值 | 採納 | `raise_affinity_happy` 改用 `bestAffinity || animalAffinity(...)`，不因衰減倒卡。 |
| C-P1-05 離線未 recordDiscovery | 採納 | 離線作物、動物產物成功入庫時呼叫 `recordDiscovery(state, id, offlineNow)`。 |
| C-P1-06 RNG 非決定性 | 延後 | 問題成立，但完整修正需要 `rngState`/seeded RNG 遷移與 UI 呼叫端改造；本輪未碰。 |
| C-P1-07 動物 `"happy"` 語意重疊 | 延後 | 現況仍以 `animalStatus` 單字串驅動 UI；拆 mood/careNeed 需調 UI atlas 狀態映射。 |
| C-P1-08 地圖查找 O(n) | 延後 | 小地圖目前可接受；尚未建立 tile index/cache。 |
| C-P1-09 預置雞舍/畜舍 | 設計保留 | 現行是故事常駐結構；動物購買仍受等級與容量限制。保留，並已有測試避免常駐畜舍提前解鎖牛羊。 |
| C-P1-10 數值下限防護 | 部分採納 | `migrate` 夾緊 coins/xp/materials/storage/upgrades；扣款 API 尚未全面改為 assert/apply transaction。 |
| C-P2-01 `wateredAt` 殘留 | 採納 | `plant` 與 `harvest` 清除 `wateredAt`，重種不繼承濕土。 |
| C-P2-02 `addToStorage` 寫 0 鍵 | 採納 | `added > 0` 才寫入 storage。 |
| C-P2-03 東林魔法數 | 延後 | 尚未常數化 `east_deep` rect。 |
| C-P2-04 `farmSeason` 雙軌 | 延後 | 保留舊 API，相依處已多用 `currentSeason`。 |
| C-P2-05 訂單過期不斷連 | 設計保留 | 丟單才斷連仍保留；過期是否懲罰屬玩法決策。 |

### 效能

| ID | 結論 | 技術理由與處理 |
|---|---|---|
| P-P0-01 `updateMap` 全量刷新 | 部分採納 | 地面磚加 `groundSig`，未變更時不重貼 atlas；low tier 下 map/farm/assistant 1Hz 節流。動態作物/動物/NPC 仍整批重建，未算完整節點重用。 |
| P-P1-01 `paintGround` 熱路徑 | 部分採納 | atlas apply/class 寫入已 dirty-skip；autotile 鄰接仍即時計算。 |
| P-P1-02 側欄農地 + 地圖雙重呈現 | 部分採納 | low tier 下側欄農地降到 1Hz；沒有移除側欄農地。 |
| P-P1-03 VFX timer | 延後 | 尚未集中到 rAF。 |
| P-P1-04 Atlas pending flush | 延後 | 尚未加 ResizeObserver/pending flush。 |
| P-P2-01 BFS `queue.shift()` | 延後 | 小地圖暫不改。 |
| P-P2-02 智慧助手主 loop | 部分採納 | low tier 下 1Hz；既有 `lastAssistantSig` 保留。 |
| P-P2-03 效能監控重繪 | 部分採納 | 診斷文字可局部更新，但模式切換仍會重繪設定面板。 |

### 架構

| ID | 結論 | 技術理由與處理 |
|---|---|---|
| A-P1-01 `game.js` 巨型模組 | 延後 | 拆檔會碰全域匯出/測試載入順序；本輪避免擴大 diff。 |
| A-P1-02 任務條件硬編碼 | 延後 | DSL 化需要同步 UI 文案與 story marker。 |
| A-P1-03 `ORDER_QTY` 分離 | 部分採納 | 高價品質品項已有明確範圍；尚未搬到 config 或生成式 schema。 |
| A-P1-04 建築 effect 字串約定 | 部分採納 | 本輪新增 `maxCount` 並讓 effect cap 共用；尚未做完整 schema validator 或美術 frame 補齊。 |
| A-P1-05 `ui.js` 巨型模組 | 延後 | 本輪只改熱路徑，不拆檔。 |
| A-P2-01 保留 config→game→ui 模式 | 採納 | 本輪仍沿用資料層設定、規則層解讀、UI 投影。 |
| A-P2-02 window 匯出面 | 延後 | 尚未命名空間化。 |
| A-P2-03 章節常數/next 雙軌 | 延後 | 現有章節測試覆蓋主要流程；推導式章節清單後續處理。 |

### 平衡

| ID | 結論 | 技術理由與處理 |
|---|---|---|
| B-P0-01 建築堆疊破局 | 採納 | growthAura、silo、festival_stall 均封頂；舊重複建築只計入有效上限。 |
| B-P1-01 `plotCount` 無效級 | 採納 | 開墾改為 6→8→10→12 三級，刪除 1100 金無收益級；舊 `plotCount:4` 遷移夾到現行滿級，仍維持 12 格。 |
| B-P1-02 草莓 CP 偏高 | 延後 | 本輪不改作物售價/時間，避免和建築封頂同時改兩個經濟主因。 |
| B-P1-03 教學訂單 110 金 | 設計保留 | 目前保留早期橋樑/升級導流；經濟測試仍要求第 2 次升級 < 3 分鐘。 |
| B-P1-04 festival 收益方差 | 延後 | 僅封頂攤位，未改 festival 訂單生成。 |
| B-P1-05 季節只影響售價 | 設計保留 | 目前季節是行情系統，不是種植禁令；溫室文案後續可再精修。 |
| B-P1-06 動物照護品質門檻 | 延後 | 不調 CARE_COOLDOWN/CARE_GAIN。 |
| B-P1-07 Lv10 封頂 | 延後 | 不屬本輪 bugfix。 |
| B-P2-01 天氣可見性 | 延後 | HUD/助手文案未擴充。 |
| B-P2-02 成就售價堆疊 | 延後 | 不調成就經濟。 |
| B-P2-03 東林深處 CD | 設計保留 | 測試中的深處採集期望值約 1.4 金/分鐘，不壓過作物主循環。 |

## 經濟回歸說明

growthAura 現在沒有 N 座連乘項。永久建築成長倍率封頂為：

`compostHeap 0.90 × beeBox 0.92 × greenhouse 0.88 = 0.72864`

若玩家同時達到肥沃土壤滿級，永久成長倍率為：

`0.52 × 0.72864 = 0.3788928`

最激進的暫態組合（雨天 × 濕土 × 滿級肥沃土壤 × 全 growthAura）為：

`0.70 × 0.75 × 0.52 × 0.72864 = 0.198978`

因此小麥 15 秒最快約 2.98 秒，草莓 300 秒最快約 59.7 秒；不再能靠重複蓋堆肥場把任意作物推近 1 秒下限。季節作物直售同樣封頂為當季 `1.15 + festival_stall 0.15 = 1.30`，不再因多座攤位線性膨脹。

`plotCount` 改為 6→8→10→12，每級皆增加 2 格；舊版無效 Lv4 遷移為現行 Lv3，因原 Lv4 和 Lv3 同為 12 格，所以不倒退有效農地。

## 目前驗證

- `npm run test:economy`：通過
- `npm run test:systems`：通過
- `npm test`：通過（含 guards、economy、systems、UI smoke、v3/v4 atlas validator）
- `npm run test:e2e`：連跑 3 輪皆通過（RPG v4 E2E + RWD 9 視口矩陣）
