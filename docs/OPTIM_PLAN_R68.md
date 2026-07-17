# R68 晨光農場視覺優化與驗收計畫

日期：2026-07-17
範圍：四季 loading 畫面與既有季節活動卡底圖；僅視覺，不新增活動玩法、作物或數值。

## 前置與 before 基線

- 已全文讀取 `C:/Users/digimkt/Desktop/遊戲/WAVE2_PROTOCOL.md`、`AGENTS.md`、`docs/AUDIT_full.md`。
- Wave 1 production fallback：R68 新增素材目標為 0；正式資產必須全部經 R68 manifest 指向真實 low/med/high PNG。既有 v4/R66 manifest 仍在。
- 歷史稽核的三項 P1 已於後續輪次處理：R64 修復半壞地圖遷移與 modal/input 鍵盤隔離；R67 恢復 Chromium 全套守門與 modal inert 互斥。
- 不在本輪視覺範圍的歷史 P2（新手經濟、how-to 完整度等）列入交付報告，不改玩法或數值。
- 工作樹開工時已有 `docs/evidence/R67_menu/controls/` 三張控制證據圖修改；視為使用者既有變更，本輪不覆寫、不納入 commit。
- Fast 3G／4x CPU／1366×768 before（本機 6 線併發機況，標註「併發、不可信」）：
  - `interactiveReadyMs = 5915`
  - `mainVisualReadyMs = 6342`
  - after 首屏可互動上限：`5915 × 1.10 = 6506.5ms`
  - 證據：`docs/evidence/R68/before-baseline.json`

## 可驗收目標

| 閘門 | before | after 上限／斷言 |
|---|---:|---:|
| imagegen C2PA | 無 R68 資產 | 5/5 master 的 Python 驗證皆為 `softwareAgent = gpt-image 2.x` |
| runtime 色盤 | 無 R68 資產 | 66 色固定 palette；每 tier `outOfPalettePixels = 0` |
| 像素風格 | 無 R68 資產 | 多階明度 ≥6、深色 outline pixels ≥16、hue-shift 與選擇性 dither 步驟固定記錄 |
| 解壓貼圖記憶體 | 0MiB R68 | 全 tier 合計 ≤32MiB 行動／≤64MiB 桌機 |
| loading 主視覺 | 6342ms（既有地圖） | Fast 3G／4x CPU 的 `farm-visual-focus-ready ≤3000ms` |
| 首屏可互動 | 5915ms | `farm-interactive-ready ≤6506.5ms`（不得退步 >10%） |
| frame p95 | 待 after 同腳本量測 | `requestAnimationFrame p95 ≤18ms`；本機結果標註「併發、不可信」 |
| loading 安全裁切 | 無 | 4 季 × 12 視口＝48 筆；主體 bbox `[.35,.32,.65,.68]` 完整落在視口 8% safe area |
| 活動面板文字對比 | 舊純色卡 | low/med/high 每 tier 的 title/body/meta 對底圖文字區最差值皆 `≥4.5:1` |
| 品質檔一致性 | 無 R68 tier | low/med/high 都是不同 hash 的真素材；同場景並排證據存在 |
| 控制可達性 | R67 7 視口 | 精確 164 項、每顆 ≥44px、中心命中、非 modal 零相交 |
| modal 互斥 | R67 inert 守門 | loading 顯示時 0 個 `.modal.show`；一般 modal 背景 inert、輸入零 mutation |
| 全量回歸 | R67 全綠 | `npm run test:ci`（`npm test`＋線內單併發 browser gates）全綠 |
| 快取／回滾 | r67 | `r68-20260717-1`、每張 R68 runtime URL 使用 SHA-256 前 8 碼、SW 離線清單同步 |

## 實作與證據

1. 內建 imagegen 產出 5 張原始 master，保存在 `docs/evidence/R68/masters/`；runtime 與 master 分軌。
2. `tools/process-r68-visuals.py` 執行固定 BOX pixel grid、每季 hue-shift shadow tint、R62 66 色量化、局部 dither mask、panel text-zone normalization。
3. loading 使用 spring/summer/autumn/winter 與 low/med/high 真素材；既有 `.season-event-card` 只換背景與字色。
4. 量化輸出：`c2pa-verification.json`、`contrast-gate.json`、`texture-memory.json`、`safe-crop-gate.json`、`performance-gate.json`、`browser-gates.json`。
5. 三視口 after、活動卡 after、low/med/high 並排、style board、palette、before 截圖皆置於 `docs/evidence/R68/`。

## 回滾

以本輪本地 commit 的父 commit 回切即可完整恢復 R67；若只回退視覺，移除 `assets/generated/r68/`、`docs/evidence/R68/` 與 R68 CSS/markup/UI 掛載，將 `package.json`、`manifest.webmanifest`、`sw.js`、script query 版本改回 R67。舊資產與舊 manifest 不刪除。
