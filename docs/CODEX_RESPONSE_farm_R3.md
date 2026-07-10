# Codex 回應 — Grok R3 對抗覆核

目標版本：`r52-20260710-1`

## 總結

R3 的兩個 P1 採納並修正：

1. `SEASON_EVENTS` 離線跨多季時，跳過的舊 cycle 現在會寫入 `flags.seasonEventsClaimed[cycleId] = { skipped: true, ... }`。設計決策是「離線跳過的季節事件不補發」，但落地當前季不會被 skipped 誤標，仍可正常領取，領後再以 cycleId 去重。
2. `npcPhase()` 現在在 `chapter5Done()` 之前檢查 `allChapter5LettersRead()`，八封祖母信已讀但尚未回信時回傳 `ch5done`；回信後才進 `postscript`。

已補對抗測試：跨兩季漏領/去重、`ch5done` 可達、季節偏壓不可選未解鎖作物或未發現採集物。

## 逐條回應

| # | R3 主題 | Codex 判定 | 處置 |
|---|---|---|---|
| 1 | `SEASON_ORDER_BIAS` 不改 base `sellValue` | 採納 R3 結論 | 不改。既有測試保留，新增偏壓邊界測試。 |
| 2 | `radish` / `sunflower` 期望金低於 strawberry | 採納 R3 結論 | 不改。維持「獨特非更強」。 |
| 3 | `memory_garden` 無成長光環/售價加成 | 採納 R3 結論 | 不改。只保留 `orderXpBonus` 與信件鏈。 |
| 4 | `SEASON_EVENTS` 不疊 `sellMul` | 採納 R3 結論 | 不改獎勵經濟；只修離線跨季狀態。 |
| 5 | `neighborLetters` 為 `noBonus` | 採納 R3 結論 | 不改。四鄰來信不增加永久售價。 |
| 6 | 偏壓 × `availableOrderItems` 邊界 | 採納 R3 結論 | 補測 Lv6 秋季偏壓，確認 Lv7 作物與未發現採集物不進訂單。 |
| 7 | 季節事件離線多季 catch-up | 採納為必修 | 已修。跳過 cycle 標記 `skipped`，當前季仍可領，不補發中間季。 |
| 8 | 四封信 unlock × `letterKeeper` 語意 | 採納 R3 結論 | 不改。祖母八封與鎮民四封維持分離。 |
| 9 | `memory_garden` 信件鏈 / `mailFlavor` 無 runtime | 採納為 P2 | 本輪延後，不影響經濟或主流程。 |
| 10 | emoji-only 作物相容 | 採納 R3 結論 | 不改。UI/validator/圖鑑/助手已有後備路徑。 |
| 11 | 舊檔 migrate 新 config | 採納 R3 結論 | 不改。主路徑安全；未知 item 白名單清理列 P2。 |
| 12 | NPC `postscript` / `ch5done` 死區 | 採納為必修 | 已修。`ch5done` 在回信前可達，`postscript` 回信後可達。 |

## 修法細節

`src/game.js`

- 新增 `seasonCycleKey()`，讓 claim 與 skipped 使用同一種 cycleId 格式。
- 新增 `closeSkippedSeasonEvents()`，在季節一次推進多 cycle 時，將已離開的 cycle 記錄為 skipped；不處理落地當前季。
- `applyOffline()` 摘要新增 `skippedSeasonEvents`，方便測試與 UI 後續呈現。
- `npcPhase()` 順序改為 `postscript` > `ch5done` > `ch4done`，其中 `ch5done` 由 `allChapter5LettersRead()` 判定。

## 測試補強

- `scripts/test-systems.js`
  - 離線春→秋跨兩季：夏季事件被 skipped，不補領；秋季事件仍可領並領後去重。
  - 八封祖母信已讀、未回信：四名 NPC 皆回 `ch5done` 台詞；回信後仍是 `postscript`。
- `scripts/test-economy.js`
  - Lv6 秋季偏壓：Lv7 作物與未發現採集物不進偏壓池，也不會出現在 40 筆訂單中。

## 延後項

- `spring_seed_swap` 文案提到豌豆播種貼紙但不給 pea 種子：P2 文案/獎勵對齊，延後。
- `memory_garden.effect.mailFlavor` 尚未接日常走過台詞：P2 敘事潤飾，延後。
- migrate 可選剔除未知 `storage.items` key：P2 防禦性清理，延後。

## 版本

已同步 bump 至 `r52-20260710-1`：

- `index.html`
- `sw.js`
- `manifest.webmanifest`
- `src/ui.js`
- `package.json`
- `scripts/test-rpg-v4-e2e.js` 版本斷言

