# Codex Response farm R4

目標版本：`r54-20260711-1`

## 結論

- P0：報告未列實質 P0 修改項；長掛機 DOM 膨脹被列為 P2 觀察。本輪仍補了最小 FX 節點上限與清理 guard。
- P1：已修 low/reduced 降級缺口、離線季節 catch-up 呈現缺口、AudioContext 長掛機 resume 缺口。
- 規則/經濟：未改 `src/game.js`、`src/config.js`、`src/state.js` 的結算與資料表。
- P2：文件敘述落差、音效設定文案、更多手動長掛機量測列入延後。

## 逐條回應

| # | 監工項目 | 回應 |
|---|---|---|
| 1 | 規則層 diff / 暗改 | 已確認本輪不動規則與經濟層。季節 catch-up 只使用既有 `advanceSeasonState`、`skippedSeasonEvents`，沒有改數值或結算。 |
| 2 | 長掛機 DOM 節點膨脹 | 報告評級為 P2，但已補 guard：`#screenFxLayer`/`#vfxLayer` 進場前修剪節點數，FX node 使用 `animationend` + timeout fallback 清理，map VFX 加 timeout fallback 清 interval。 |
| 3 | `performanceMode low` / `prefers-reduced-motion` 缺口 | 已修 P1。low/reduced 下不再生成 float、coin HUD pop、crop mature pop；CSS 也補 `.float`、`.plot.ready`、`.ob-dot`、`.coin-pop`、`.crop-mature-pop` 的降級保險。 |
| 4 | 季節過場 × 離線 catch-up | 已修 P1。規則層已有 catch-up；UI 現在在離線摘要與設定回顧中呈現季節推進與 skipped season event，不在重開時補播多段過場 FX，避免離線恢復疊加動畫。 |
| 5 | WebAudio 長掛機狀態 | 已修 P1。`playSound` 每次播放前都會嘗試 resume；`visibilitychange`/`pageshow` 會對已 unlock 的 context 重新 resume；closed context 會重置狀態；重新開啟 sound setting 時會嘗試 unlock。 |

## 修改檔案

- `src/ui.js`：FX 節點上限與清理、low/reduced JS guard、離線季節摘要、AudioContext resume guard。
- `index.html`：low/reduced CSS guard。
- `scripts/test-rpg-v4-e2e.js`：真 SW 離線測試在切 offline 前後等待 atlas ready，避免 headless 連跑競態。
- `package.json`、`index.html`、`manifest.webmanifest`、`sw.js`、`scripts/test-rpg-v4-e2e.js`：版本同步到 `r54-20260711-1`。

## 延後項

- P2：完整 8h/30min DevTools DOM heap 量測。
- P2：音效設定文案本地化與更細的 WebAudio 診斷 UI。
- P2：舊回覆文件敘述落差的歷史修辭整理。
