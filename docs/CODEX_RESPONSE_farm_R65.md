# 《晨光農場》farm R65 地圖完整顯示＋列表瘦身回報

## 版本

- 版本：`r65-20260716-1`
- 基底：R64 後續工作樹（R64 里程碑 commit `d9456d4` 之後）
- 本輪目標：地圖在各設備完整顯示、零內捲；右側列表預設瘦身。

## 核心修復

- 地圖新增預設「整圖模式」：依 `#mapScene` 可用寬高自動計算 tile 尺寸，完整優先；保留「原尺寸」切換，原尺寸模式維持場景內捲動與玩家跟隨。
- 修正座標、玩家、物件、點擊命中與 fit tile 同步，避免只縮視覺但互動座標錯位。
- 回收垂直空間：任務 Dock 預設一行，可展開詳情；智慧助手預設收合；工具列、資源列與地圖外框更緊湊。
- 右側欄瘦身：訂單、升級、故事、圖鑑等清單預設只顯示前幾項，使用「顯示更多」展開；已完成/不可用項目排序到後面。
- 修正 390px 手機下 `.panel`/`#mapScene` 被 min-content 撐寬，導致 A 鍵跑出視口的問題。
- v4 atlas pixel check 改載入同源最小檢查頁，避免測試載入完整首頁造成不穩定逾時。

## Before / After

1366×600 before：

- `#mapScene` client：約 `978×259`
- `#mapScene` scroll：`1075×442`
- 世界：`1056×576`
- 結果：右側與下方需要內捲才看得到。

1366×600 after：

- `#mapScene` client：`990×289`
- `#mapScene` scroll：`990×289`
- 世界視覺框：`484×264`
- tile：`22px`
- 結果：整圖模式完整可見，零內捲。

R65 指定視口 after：

| 視口 | scene client | scene scroll | world | tile | 結果 |
|---|---:|---:|---:|---:|---|
| 1920×1080 | 1298×769 | 1299×769 | 1254×684 | 57 | pass |
| 1440×780 | 1046×469 | 1046×469 | 814×444 | 37 | pass |
| 1366×600 | 990×289 | 990×289 | 484×264 | 22 | pass |
| 1280×640 | 925×329 | 925×329 | 550×300 | 25 | pass |
| 390×844 | 346×456 | 346×456 | 308×168 | 14 | pass |

## 證據

- Before：`docs/evidence/R65_map/before-1366x600.png`
- Before metrics：`docs/evidence/R65_map/before-1366x600.json`
- After screenshots：`docs/evidence/R65_map/after-*.png`
- After metrics：`docs/evidence/R65_map/after-*.json`
- After summary：`docs/evidence/R65_map/after-summary.json`
- Controls gate screenshots：`docs/evidence/R65_map/controls/`

## Gate 結果

- `npm test`：通過
- `npm run test:e2e`：通過
- RWD matrix：通過（由 `npm run test:e2e` 串跑）
- Controls / 世界完整可見守門：通過（由 `npm run test:e2e` 串跑）
- 秘掃：零命中

## 備註

- 整圖模式若縮到辨識下限附近，玩家仍可用右上切換鈕回到原尺寸捲動模式。
- 本輪未改角色動畫資產或動畫管線。
