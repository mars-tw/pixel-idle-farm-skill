# R76 素材優化與開源更新

版本：`r76-20261002-1`。

## 本輪交付

釣台改用專用木平台、釣具與桶子，野餐桌改用桌椅、餐籃、桌布與花瓶。兩種物件各有損壞／修復圖，不再借用橋梁和市集攤位。釣台從岸邊互動，圖像向池塘延伸；邏輯座標和視覺錨點分開記錄。

四張來源圖由 Codex 內建 `image_gen` 產出。這條路徑不需要 OpenAI API key。來源 metadata 只揭露 `ChatGPT / gpt-image`，沒有足夠證據確認精確模型版本，因此本輪不宣稱使用 `gpt-image-2` API。先前 R75 的 API 401 保留在歷史紀錄，本輪素材已實際完成。

## 重製與裁切契約

來源：`assets/generated/r76/source/`。完整提示詞及參考關係：`assets/generated/r76/prompts.json`。

```bash
node scripts/process-world-project-art.js
node scripts/test-world-project-art.js
```

處理器只打包生成物件，不手繪替代內容：讀真正的 alpha，以 alpha ≥128 求主體範圍，損壞與修復圖共用同一個 family bbox、縮放比例與腳底線。採 nearest-neighbor 縮成 96×96 frame，保留六個透明像素的安全邊界，再對齊既有 R62／R68 共用 66 色盤。來源母版保留不覆寫。

| 物件 | 原生 frame | 腳底錨點 | runtime |
|---|---|---|---|
| 釣台損壞／修復 | 96×96，各 1 frame | `[0.5, 0.9375]` | `world_projects` 圖集上列 |
| 野餐桌損壞／修復 | 96×96，各 1 frame | `[0.5, 0.9375]` | `world_projects` 圖集下列 |

runtime sheet 為 192×192、四個精確 frame。PNG、JSON、palette、bbox、sourceScale、來源與 runtime SHA-256 都寫在 `assets/generated/r76/manifest.json`，並加入 Service Worker 預快取。

## 發布前資料修正

獨立審查發現兩項遷移風險。本輪改由 `configureWorld()` 共用世界綁定：完成野餐的居民搬遷先還原，再保留建物與動物；如果舊建物占了復興場址，保留建物，替計畫選最近的空地，並保存新的互動座標。道路改版也不能把合法舊建物刪掉。

`scripts/test-world-migration.js` 使用實際 CONFIG 驗證四組案例：居民舊站位建雞舍後重載、花園場址已有雞舍、R74 餐桌區已有建物，以及髒 map 重建。不是只驗合成資料模型。

## 驗證與範圍

發布前需通過 `npm test`、`npm run test:e2e`、`test-world-project-art` 與 `test-world-migration`。新增美術不得造成空白 frame、半透明暈邊、觸邊裁切、修復後比例跳動或站點不可互動。

這次發布一併包含已在本機完成的 R75 世界、三章九任務、料理、釣魚、河畔委託及 RWD 改版。沒有重畫角色的所有動作，也沒有交付四向持竿動畫；既有角色逐幀動畫繼續使用。
