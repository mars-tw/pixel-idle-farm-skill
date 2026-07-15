# Codex 回應 — Farm R60 素材 P0 清償

版本目標：`R60` / `r60-20260715-1`

## 1. Grok audit 對照

| Audit 項目 | 本輪處理 | 結果 |
|---|---|---|
| P0：`animals-duck-48` 對齊 `animals-48` | 保留前一輪已落地重繪圖，改由高解析 source `animals-duck-48.png` 切 4x2 / 48px atlas。 | `animals_duck` 8 frames，鴨 idle / walk / happy / eating 都走真圖。 |
| P0：`duck-egg-quality-32` 對齊 product quality | 保留前一輪已落地重繪圖，改由高解析 source `duck-egg-quality-32.png` 切 3x1 / 32px atlas。 | normal / good / premium 三品質均有獨立圖示。 |
| P0：`crops3-48` 對齊 `crops-48` | 保留前一輪已落地重繪圖，改由高解析 source `crops3-48x48.png` 切 5x3 / 48px atlas。 | pea / sweet_potato / winter_kale 各 5 階段。 |
| P1：`crops4-48` 併入作物統一重產 | 保留前一輪已落地重繪圖，改由高解析 source `crops4-48x48.png` 切 5x2 / 48px atlas。 | radish / sunflower 各 5 階段，與 crops3/金標同場截圖通過。 |

## 2. 檔案大小對照

| 檔案 | 規格 | R60 大小 | 金標/對照 |
|---|---:|---:|---:|
| `assets/generated/v4/animals-duck-48.png` | 192x96 / 8 frames | 21,629 bytes | `animals-48.png` 192x192 / 16 frames / 60,947 bytes |
| `assets/generated/v4/duck-egg-quality-32.png` | 96x32 / 3 frames | 5,394 bytes | `animal-products-quality-32.png` 96x128 / 12 frames / 21,537 bytes |
| `assets/generated/v4/crops3-48.png` | 240x144 / 15 frames | 39,470 bytes | `crops-48.png` 240x288 / 30 frames / 72,309 bytes |
| `assets/generated/v4/crops4-48.png` | 240x96 / 10 frames | 27,357 bytes | `crops2-48.png` 240x192 / 20 frames / 54,157 bytes |

生成源圖已保留並納入提交：`assets/generated/v4/source/{animals-duck-48.png,crops3-48x48.png,crops4-48x48.png,duck-egg-quality-32.png}`。

## 3. 版本與暫存

- Runtime / PWA / e2e 版本已同步到 `r60-20260715-1`：`package.json`、`index.html`、`manifest.webmanifest`、`sw.js`、`src/ui.js`、`scripts/test-rpg-v4-e2e.js`、`scripts/capture-promo-trio.js`。
- 舊 R59 runtime 版本字串 grep：0 命中。
- `.gitignore` 已加入 `tmp/`；`tmp/imagegen` 與 `tmp/capture-r60-evidence.js` 只作工作暫存，不納入提交。

## 4. 證據截圖

- `docs/evidence/R60/world-crops-r60.png`：同一田區包含 `crops`、`crops2`、`crops3`、`crops4`。
- `docs/evidence/R60/animal-pen-r60.png`：鴨子與雞、牛、羊同框，實際渲染 `animals_duck` 與既有 animal sheets。
- `docs/evidence/R60/duck-egg-quality-r60.png`：鴨蛋 normal / good / premium 三品質並排。

## 5. 測試結果

- `npm test`：PASS。含 guards、economy、systems、UI smoke、v3/v4 atlas validators；v4 validator 確認 `crops3` 15 frames、`crops4` 10 frames、`animals_duck` 8 frames、`product_quality_duck` 3 frames。
- `npm run test:e2e`：PASS。RPG v4 E2E 與 RWD 9 視口矩陣全通過；promo fixture 仍維持 12 格 atlas 作物、主地圖 0 emoji。

## 6. 未做項

無刻意延後項。本輪沒有重繪素材；只做版本同步、ignore、截圖證據、報告、測試與本地提交前檢查。
