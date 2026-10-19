# 第五輪原尺寸證據索引

VERIFIED：本機實際UI旅程126項檢查、92次原尺寸擷取。本頁是開發驗證索引，不是獨立評分。

精選集只有15張、三項各5張：`review-set/`。每張逐bytes複製原始擷取，無裁切、縮放、拼貼。01–02為同一次送餐真走路姿勢，07–08與09–10為同一竿沉前／下沉，14為口味決策進行中。其餘完整驗收圖保存在本目錄。

## 1．320／430三人餐籃與故事全文

頂部／底部是同一正文的捲動位置，固定四鈕均≥48px，主鈕≤2行、次鈕各1行；已實點送出、回灶台、重讀、回想。

| 居民／寬度 | 餐籃頂部 | 餐籃到底 | 故事頂部 | 故事到底 |
| --- | --- | --- | --- | --- |
| 蘿拉／320 | [原圖](phone-basket-merchant-320-top.png) | [原圖](phone-basket-merchant-320-bottom.png) | [原圖](phone-story-merchant-320-top.png) | [原圖](phone-story-merchant-320-bottom.png) |
| 蘿拉／430 | [原圖](phone-basket-merchant-430-top.png) | [原圖](phone-basket-merchant-430-bottom.png) | [原圖](phone-story-merchant-430-top.png) | [原圖](phone-story-merchant-430-bottom.png) |
| 班伯／320 | [原圖](phone-basket-elder-320-top.png) | [原圖](phone-basket-elder-320-bottom.png) | [原圖](phone-story-elder-320-top.png) | [原圖](phone-story-elder-320-bottom.png) |
| 班伯／430 | [原圖](phone-basket-elder-430-top.png) | [原圖](phone-basket-elder-430-bottom.png) | [原圖](phone-story-elder-430-top.png) | [原圖](phone-story-elder-430-bottom.png) |
| 圖圖／320 | [原圖](phone-basket-child-320-top.png) | [原圖](phone-basket-child-320-bottom.png) | [原圖](phone-story-child-320-top.png) | [原圖](phone-story-child-320-bottom.png) |
| 圖圖／430 | [原圖](phone-basket-child-430-top.png) | [原圖](phone-basket-child-430-bottom.png) | [原圖](phone-story-child-430-top.png) | [原圖](phone-story-child-430-bottom.png) |

## 2．三魚同階段原圖／遮字並排

只以CSS隱藏DOM文字及Logo，不替換水面，不改時鐘或魚種；同一竿兩張均驗證phase相同。形狀測量來自實際Canvas像素。

| 魚／階段與兩個差異點 | 原圖 | 遮字原圖 |
| --- | --- | --- |
| 河鯉／沉前：三個封閉同心圓、左右對稱寬圓面 | ![原圖](phone-pond-river_carp-pre-sink-original.png) | ![遮字](phone-pond-river_carp-pre-sink-masked.png) |
| 河鯉／下沉：三個封閉同心圓、左右對稱寬圓面 | ![原圖](phone-pond-river_carp-sinking-original.png) | ![遮字](phone-pond-river_carp-sinking-masked.png) |
| 銀鯽／沉前：窄直中軸、縱向水線／飛濺，沒有側向尾流 | ![原圖](phone-pond-silver_dace-pre-sink-original.png) | ![遮字](phone-pond-silver_dace-pre-sink-masked.png) |
| 銀鯽／下沉：窄直中軸、縱向水線／飛濺，沒有側向尾流 | ![原圖](phone-pond-silver_dace-sinking-original.png) | ![遮字](phone-pond-silver_dace-sinking-masked.png) |
| 溪鱸／沉前：向右的長三角尾流、右端雙環及斜浮標 | ![原圖](phone-pond-river_perch-pre-sink-original.png) | ![遮字](phone-pond-river_perch-pre-sink-masked.png) |
| 溪鱸／下沉：向右的長三角尾流、右端雙環及斜浮標 | ![原圖](phone-pond-river_perch-sinking-original.png) | ![遮字](phone-pond-river_perch-sinking-masked.png) |

## 3．等待、沉前與結束的單一狀態

學會後等待／沉前／下沉不出現魚名與節奏答案。捕獲結果保留魚名與數量，讓玩家確認入簍。

| 魚 | 首次等待 | 首次沉前 | 首次結束 | 學會等待 | 學會結束 |
| --- | --- | --- | --- | --- | --- |
| 河鯉 | [原圖](phone-pond-river_carp-waiting.png) | [原圖](phone-pond-river_carp-pre-sink.png) | [原圖](phone-pond-river_carp-ended.png) | [原圖](phone-pond-river_carp-learned-waiting.png) | [原圖](phone-pond-river_carp-learned-ended.png) |
| 銀鯽 | [原圖](phone-pond-silver_dace-waiting.png) | [原圖](phone-pond-silver_dace-pre-sink.png) | [原圖](phone-pond-silver_dace-ended.png) | [原圖](phone-pond-silver_dace-learned-waiting.png) | [原圖](phone-pond-silver_dace-learned-ended.png) |
| 溪鱸 | [原圖](phone-pond-river_perch-waiting.png) | [原圖](phone-pond-river_perch-pre-sink.png) | [原圖](phone-pond-river_perch-ended.png) | [原圖](phone-pond-river_perch-learned-waiting.png) | [原圖](phone-pond-river_perch-learned-ended.png) |

## 4．真正離線首次開圖與重試

Service Worker完成預快取後切斷網路並重載；三人裝籃、首送、配對圖第一次開啟即解碼成功。異常注入只測原頁重試，不放精選集；重試前後的居民、口味、說明、麥餅及原料逐項相等。

| 居民 | 離線裝籃 | 離線首次短篇 | 離線配對 | 原頁重試復原 |
| --- | --- | --- | --- | --- |
| 蘿拉 | [原圖](phone-basket-merchant-offline.png) | [原圖](phone-story-merchant-offline-first.png) | [原圖](phone-memory-merchant-offline.png) | [原圖](phone-basket-merchant-retry-restored.png) |
| 班伯 | [原圖](phone-basket-elder-offline.png) | [原圖](phone-story-elder-offline-first.png) | [原圖](phone-memory-elder-offline.png) | [原圖](phone-basket-elder-retry-restored.png) |
| 圖圖 | [原圖](phone-basket-child-offline.png) | [原圖](phone-story-child-offline-first.png) | [原圖](phone-memory-child-offline.png) | [原圖](phone-basket-child-retry-restored.png) |

## 5．三人記憶線齊全

回想全文搜尋甜／酸／熱與食材字零命中。蘿拉以秤與陽光下的凳子、班伯以牆邊魚竿與灶旁盤子、圖圖以空椅與壓花呼應，各有不同的配對回話與紅格書籤。

| 居民 | 首送 | 回想 | 錯配 | 配對前決策 | 配對 | 農場回話 |
| --- | --- | --- | --- | --- | --- | --- |
| 蘿拉 | [原圖](phone-story-merchant-first.png) | [原圖](phone-memory-merchant-recall.png) | [原圖](phone-memory-merchant-wrong.png) | [原圖](phone-memory-merchant-choosing.png) | [原圖](phone-memory-merchant-matched.png) | [原圖](phone-memory-merchant-farm-response.png) |
| 班伯 | [原圖](phone-story-elder-first.png) | [原圖](phone-memory-elder-recall.png) | [原圖](phone-memory-elder-wrong.png) | [原圖](phone-memory-elder-choosing.png) | [原圖](phone-memory-elder-matched.png) | [原圖](phone-memory-elder-farm-response.png) |
| 圖圖 | [原圖](phone-story-child-first.png) | [原圖](phone-memory-child-recall.png) | [原圖](phone-memory-child-wrong.png) | [原圖](phone-memory-child-choosing.png) | [原圖](phone-memory-child-matched.png) | [原圖](phone-memory-child-farm-response.png) |

## 補充與資料邊界

- [瀏覽器收據](browser-checks.json)：每張的真實時間、拋竿、phase、sprite、餐籃與魚簍狀態。
- [精選集及商店圖尺寸／雜湊](screenshot-readback.json)：15張均為原尺寸、來源逐bytes相等，每項5張。
- 商店圖：[iPhone 1290×2796](../../store/screenshots/iphone-11-stove-return.png)、[iPad 2064×2752](../../store/screenshots/ipad-11-stove-return.png)。
- 橫式844×390、iPad768×1024、矮筆電1366×600：`layout-basket-<尺寸>.png`。
- `before-*.png`直接複製R4原圖，來源與雜湊在截圖收據，沒有冒稱本輪之前重新實玩。
- [最終讀回](release-readback.json)：21支瀏覽器守門、npm與補充守門全綠；95份JS、秘密零命中、3,972份歷史檔不變，runtime與驗證副本一致。
- [效能原始資料](performance-reference.json)：12跑有3跑33.3ms，桌機農場中位33.3ms未達18ms，參考門檻BLOCKED；其餘三組中位16.8／16.8／16.7ms。共享主機原因尚未隔離。
- 精選集不含缺圖、容量異常、效能與收據畫面。實體裝置、真人試玩、乾淨主機效能、Muse獨立≥8分仍BLOCKED。
