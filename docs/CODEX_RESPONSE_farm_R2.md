# Codex 回應：Grok R2 對抗性再審

版本目標：`r51-20260710-1`（從磁碟版 `r49-20260710-1` bump，日期段不倒退）

## 總結

本輪採納並修正 Grok R2 的三個 P1：

1. `advanceSeasonState` catch-up 會記錄「已過期的出發季」。
2. `healthyMap` 失敗時不再整包重置 `buildings` / `animals` / `player`。
3. 動物產能建築補 `maxCount`，避免無限堆疊容量。

## 逐條回應

| # | Grok 判斷 | Codex 回應 |
|---|---|---|
| 1 | growthAura / seasonalSellBonus / silo 的 `maxCount` 封頂成立 | 採納為已成立；本輪未再改光環/攤位/筒倉效果封頂，只維持既有測試。 |
| 2 | 開墾等級 6→8→10→12 與舊 Lv4 clamp 成立 | 採納為已成立；本輪未改 plot 曲線。 |
| 3 | `plotCount` 無效末級已修 | 採納為已成立；本輪未改。 |
| 4 | 離線季節 catch-up 尚漏出發季 | 採納並修正。過期分支現在先記錄 `state.season.id`，再記錄跨過的後續季節。 |
| 5 | 髒 map 重建會 wipe buildings/animals/player | 採納並修正。髒 map 仍重建新版 tiles，但會逐項保留可落點建築、可對應家園動物與合法玩家位置。 |
| 6 | low performance 節流大致成立，但仍可再觀察 | 採納為 P2 觀察；本輪不擴大修改 UI loop。 |
| 7 | 動物家無 `maxCount` 可堆產能 | 採納並修正。雞舍/畜舍/鴨舍補上產能封頂。 |

## 修正內容

### 1. 出發季 seasonsReached

- 修改：`src/game.js` 的 `advanceSeasonState` 在 `now >= untilMs` 時先將出發季寫入 `stats.seasonsReached`。
- 結果：舊檔或首次 tick 已過期時，`夏` 這類出發季不會等到下一輪循環才解鎖信件條件。
- 測試：`scripts/test-economy.js` 新增「夏季已過期、`seasonsReached={}`、一次跨三季」案例，確認 `letter_summer` 可立即由 `evaluateLetters` 解鎖。

### 2. 髒 map 保留進度

- 修改：`src/state.js` 新增髒 map 重建保留流程。
- 保留條件：
  - `buildings`：type 存在、id 合法、座標可落在新版 map；常駐 structure 建築可依 `structureId` / `b_<structureId>` / 原 anchor tile 重新對應。
  - `animals`：type 存在，且能找到可容納該動物的 home building；缺 home 的個別動物移除。
  - `player`：tile 可站立時保留，並以新版 tile 重算 `x/y`；不可站立才回預設。
- 測試：`scripts/test-systems.js` 新增髒 map 案例，確認合法自建雞舍、雞與玩家位置保留，非法建築/無家園動物只被個別移除。

### 3. 動物產能建築封頂

- 修改：`src/config.js`
  - `chickenCoop.maxCount = 2`
  - `barn.maxCount = 2`
  - `duckPen.maxCount = 1`
- 原因：雞舍與畜舍已有 Stage 4 地圖常駐 1 座；設 2 代表玩家仍可各加蓋 1 座，但不能無限堆。鴨舍沒有常駐建築，因此設 1。
- 測試：`scripts/test-systems.js` 新增動物建築封頂案例，確認第 3 座雞舍/畜舍與第 2 座鴨舍回 `max_count`。

## 產能天花板

封頂後的 raw animal production 上限（不含倉庫、照護成本、操作頻率）：

| 類型 | 建築上限 | 容量/座 | 產能上限 |
|---|---:|---:|---:|
| 雞舍 | 2 | 3 | 6 隻雞，普通雞蛋約 6 金/分鐘 |
| 畜舍 | 2 | 4 | 8 格牛/羊容量；全牛普通牛奶約 7.2 金/分鐘 |
| 鴨舍 | 1 | 3 | 3 隻鴨，普通鴨蛋約 2.7 金/分鐘 |
| 蜂箱 | 1 | 2 | 2 隻蜂，普通蜂蜜約 2 金/分鐘 |

普通品質、最佳配置估算合計約 17.9 金/分鐘。若全部以 premium 品質收成，理論上限約 46.9 金/分鐘，但需要照護與飼料節奏支撐。

## 版本與守門

- Runtime 版本同步：`index.html` / `sw.js` / `manifest.webmanifest` / `src/ui.js` / `package.json` / `package-lock.json` / E2E 版本斷言皆更新為 `r51-20260710-1`。
- `package.json` / `package-lock.json` 套件版同步為 `0.1.3`。
- 非 docs runtime grep：`rg "r49-20260710-1" -g "!docs/**" .` 無結果。
- 守門：`npm test` 通過；`npm run test:e2e` 連跑 3 輪通過；未發現測試殘留的 headless/Playwright/http server 程序。

## 與 Grok 不同處

- Grok 建議動物家可設 `maxCount: 1`；本輪對雞舍/畜舍採 `maxCount: 2`，因為它們已各有 1 座常駐地圖結構。設 1 會讓玩家完全不能加蓋同類，和既有玩法不相容。
- Grok 提到可放寬/修復 dirty `plotIndex`；本輪沒有做字串 plotIndex coercion，而是維持嚴格 `healthyMap` 判斷：map 髒就重建新版 map，但保留可對應的建築/動物/玩家資料，降低誤判成本。
- 本輪沒有把 `evaluateLetters` 塞進 `advanceSeasonState`，避免吞掉 UI 的新信件提示流程；季節推進負責寫入 `seasonsReached`，既有 UI 啟動流程會在離線結算後呼叫信件評估。
