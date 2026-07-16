# Credits

本文件盤點《晨光農場》R66（`r66-20260716-1`）在 repo 內使用的素材、字型、圖示與第三方開發工具。最後檢查日期：2026-07-16。

## 視覺素材與 AI 揭露

- `assets/generated/` 下的角色、作物、動物、建築、場景物件與 VFX，主要由 OpenAI 圖像生成工具協助製作。repo 內的 `art-config*.json`、素材 manifest 與生成腳本將主要模型記為 `gpt-image-2`；R59 的 Miri／Kai 動作圖集與 `crops2` 作物圖集，以及 R60 的鴨子、鴨蛋品質與 `crops3`／`crops4` 作物圖集，均由內建 `imagegen` 工作流程重繪。
- R66 正式 UI 使用 `gpt-image-2` 經 Codex 內建 `image_gen` 製作 512px 概念母版：15 個作物、6 個工具、5 個分頁、6 個系統圖示，以及 3 張智慧農務助手狀態皮膚。金色南瓜沿用已通過 Wave 0 校準的同模型母版；其餘 34 張為 R66 生成。完整 prompt、來源／中間層／runtime SHA-256、模型與 C2PA 偵測結果記於 `assets/generated/r66/manifest.json`。
- R66 runtime 載入 `assets/generated/r66/ui-icons-32.png`（8×4、native 32px）與 `assets/generated/r66/native/assistant_*-64.png`。生成母版均先以 `#ff00ff` matte 去背、邊緣去汙，再經 R62 限定 palette、1px 深色輪廓與原生像素清稿；遊戲不直接載入 512px 模型輸出。
- 生成後的來源圖會經專案內腳本去背、裁切、縮放、像素修整、anchor 設定與 JSON frame map 產生；部分地形、季相與補充圖集由 JavaScript／Python 程序化產生或修整。因此執行時 atlas 並非未處理的模型輸出。
- `assets/cover.png` 為專案的 AI 輔助像素風封面。`references/visual-targets/` 內圖片是製作參考，不是直接載入遊戲的 runtime atlas。
- `references/promo/` 與 `artifacts/` 內圖片為本遊戲畫面截圖；README 使用其中的春、夏、冬季宣傳截圖。
- 圖像提示詞、模型設定與可重製流程可參考 `art-config-rpg-v4.json`、`assets/manifest.json`、`assets/generated/v4/manifest.json` 與 `references/art-pipeline-v4.md`。

## 字型與圖示

- 專案沒有綁入或從 CDN 載入第三方 Web Font。介面使用作業系統字型堆疊：`Segoe UI`、`PingFang TC`、`Microsoft JhengHei` 與 `system-ui`；這些字型檔不隨 repo 散布。
- 專案沒有使用 Font Awesome、Material Icons、Lucide 等第三方圖示套件。R66 的主要 UI chrome 已改用專案自有像素 atlas；天氣、季節、物品後備與敘事內容仍可能使用 Unicode emoji，因此這些非正式 chrome 的符號在不同平台外觀可能略有差異。
- `assets/icons/icon-192.png` 與 `assets/icons/icon-512.png` 是本專案的 PWA 圖示，不含第三方商標或外部 icon pack。

## 第三方開發工具

- [Playwright](https://playwright.dev/) `1.61.1`：僅作為開發依賴，用於 E2E、RWD 與素材驗證；Playwright 採 Apache License 2.0。遊戲執行時不會載入 Playwright。

除上述 Playwright 外，本次盤點未發現隨遊戲載入的第三方 JavaScript 套件、遠端字型或圖示庫。未來若加入第三方素材或套件，請在合併時同步更新本文件及對應授權條款。

## 專案授權

專案程式、文件與 repo 內一併散布的專案素材依根目錄 [MIT License](LICENSE) 提供，Copyright © 2026 mars-tw。AI 生成內容的使用仍應遵守適用的生成服務條款與所在地法規。
