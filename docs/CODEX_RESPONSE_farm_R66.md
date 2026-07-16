# 《晨光農場》farm R66 — UI icon 正式化報告

日期：2026-07-16  
版本：`0.1.9`／`r66-20260716-1`  
結論：**PASS，可交付**

## 1. 完成範圍

- 32 個正式 UI icon：15 作物、6 工具、5 分頁、6 系統。
- 3 張智慧農務助手皮膚：`idle`、`tip`、`alert`。
- 512px 概念母版、matte mask、去汙 RGBA、native 像素清稿與 runtime atlas 全部入庫。
- 作物 quickbar／drawer、工具列、批次收成、資源列、側欄分頁、設定／玩法／重置與 modal 標題已接正式圖示。
- 智慧助手保留 R65 的首局預設收合；依最高優先建議切換皮膚：無建議 `idle`、一般建議 `tip`、priority ≥ 100 `alert`。
- 更新 `assets/manifest.json`、`CREDITS.md`、PWA cache 與 R66 版本鍵。

## 2. 圖像生產與可追溯性

生成模型與介面：

- requested model：`gpt-image-2`
- actual model：`gpt-image-2`
- interface：Codex 內建 `image_gen`
- prompt version：`farm-r66-ui-v1.0`
- 來源 C2PA `gpt-image 2.0` 偵測：35/35
- `crop_pumpkin` 沿用 Wave 0 已驗證金色南瓜；其餘 34 張為 R66 生成。

輸出結構：

- `assets/generated/r66/source/`：35 張生成來源。
- `assets/generated/r66/masters_opaque/`：35 張正規化 512×512 母版。
- `assets/generated/r66/masks/`：35 張 matte mask。
- `assets/generated/r66/rgba/`：35 張邊緣去汙 RGBA。
- `assets/generated/r66/native/`：32 張 32×32 icon 與 3 張 64×64 助理皮膚。
- `assets/generated/r66/ui-icons-32.png`：256×128、8×4 runtime atlas。
- `assets/generated/r66/ui-icons-32.json`：32 frame 座標、source size 與 anchor。
- `assets/generated/r66/manifest.json`：逐資產 slug、完整 prompt、模型、來源方式、C2PA、各層路徑與 SHA-256。

關鍵 hash：

- atlas SHA-256：`89315b2f696644c79b50d2554fc3f3280a9f5d2ab8eb6be0fffc930e718f4ad3`
- frame map SHA-256：`87b9d22e563a97634e5f04f200460aa2010b4f3c9e08f124cf9dce21c0bfef85`
- Wave 0 金色南瓜 native SHA-256：`cc28b1631b18b229dc50bbe4544bc85b255e4358454ab809e82220ed7795a426`

## 3. 像素清稿規則

`tools/generate-r66-ui.py` 可重跑完整流程：

1. 將生成來源正規化為 512×512、保留純 `#ff00ff` matte。
2. 以邊界估色產生 alpha，反算 matte 合成以去除粉色邊汙。
3. 依可見 bbox 裁切並縮至 native 32px／64px。
4. 可見色量化到 R62 66 色 palette。
5. 加一像素 `#251d35` 深色外輪廓；保留來源左上暖光／右下冷影。
6. 全透明像素 RGB 歸零，組裝 8×4 icon atlas。

alpha／palette gate 檢查 native 尺寸與 mode、四角透明、透明 RGB 歸零、palette 無越界、可見占比與 hash。結果：**35/35 PASS**。

## 4. UI 接線與手機收合態

- 作物：15 個 `crop_*` 由 seed HUD 依 crop id 取 atlas。
- 工具：`hand` 使用 `tool_plant`，另接 `water`、`clear`、`build`、`inspect`；`tool_harvest` 用於批次收成／收產物。
- 分頁：地塊、訂單、升級、故事、圖鑑均改用 `tab_*`。
- 系統：金幣、XP、倉庫、設定、玩法、重置均改用 `system_*`。
- 原本依狀態回寫的主角／像素圖按鈕已移除 emoji，避免 runtime 把舊符號寫回。
- 手機 390×844 實測：收合助手 238×63、水平溢出 0；位於 seed／控制區與實際地圖世界之間。action dock 出現時沿用既有規則暫時隱藏助手，不與 D-pad／A 鍵重疊。

## 5. 證據

- emoji before：`docs/evidence/R66_art/before-emoji-1366x768.png`
- 正式 icon after：`docs/evidence/R66_art/after-formal-icons-1366x768.png`
- 手機助理收合 after：`docs/evidence/R66_art/after-assistant-collapsed-390x844.png`
- 32 icon native contact sheet：`docs/evidence/R66_art/icon-contact-sheet-native.png`
- 3 助理皮膚 contact sheet：`docs/evidence/R66_art/assistant-skins-native.png`
- alpha gate 明細：`docs/evidence/R66_art/alpha-gate.json`
- controls 實畫：`docs/evidence/R66_art/controls/`

## 6. 閘門結果

| Gate | 結果 |
|---|---|
| `python tools/generate-r66-ui.py --check` | PASS，35/35 |
| `node scripts/test-r66-ui-art.js` | PASS，32 icon＋3 skins 契約、prompt/hash/wiring 全通過 |
| `npm test` | PASS |
| `npm run test:e2e` | PASS；含主 E2E、RWD、controls |
| `npm run test:rwd` | PASS；9 視口 × overlay 開／關，出界與水平溢出皆 0 |
| `npm run test:controls` | PASS；7 種裝置／視口，44px 命中、整圖、modal、pageerror 全通過 |
| `git diff --check` | PASS |
| 秘密掃描 | PASS，0 命中 |

## 7. 版本與交付

- npm package：`0.1.9`
- app／SW／HTML／manifest cache key：`r66-20260716-1`
- `npm test` 已納入 R66 alpha／palette 與 manifest／atlas 接線 gate。
- 本輪只建立本地 commit，不 push。
