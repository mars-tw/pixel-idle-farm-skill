# Muse 第三輪複審看圖索引

下列皆為無頭 Chromium 實際遊玩取得的原尺寸 PNG；主證據 430×932。點檔案可看原圖。`browser-checks.json` 保留每張的居民、台詞流程、位置、真正姿勢、食材、浮標階段與時間。章節、修復釣台與起始材料是明示 fixture，沒有宣稱全新存檔從零取得這些前置。

## 審查清單 1：三魚辨識

**BLOCKED：五名真人盲測。** 以下只能證明實際 UI 軌跡與捕獲，不是 ≥80% 辨識率、錄影或口述驗收。

| 魚種 | 同一竿的連續原圖 | 入簍／專屬筆記 |
| --- | --- | --- |
| 河鯉 | [第一點](phone-rhythm-river_carp-1.png) → [浮回](phone-rhythm-river_carp-2.png) → [第二點](phone-rhythm-river_carp-3.png) → [下沉](phone-rhythm-river_carp-4.png) | [第一尾](phone-pond-river_carp-caught.png)、[第二尾](phone-pond-river_carp-caught-again.png)、[河鯉筆記](phone-note-river_carp-first.png) |
| 銀鯽 | [長停起點](phone-rhythm-silver_dace-1.png) → [長停經過](phone-rhythm-silver_dace-2.png) → [急沉](phone-rhythm-silver_dace-3.png) | [第一尾](phone-pond-silver_dace-caught.png)、[第二尾](phone-pond-silver_dace-caught-again.png)、[銀鯽筆記](phone-note-silver_dace-first.png) |
| 溪鱸 | [橫拉尾流](phone-rhythm-river_perch-1.png) → [側邊停住](phone-rhythm-river_perch-2.png) → [側邊下沉](phone-rhythm-river_perch-3.png) | [第一尾](phone-pond-river_perch-caught.png)、[第二尾](phone-pond-river_perch-caught-again.png)、[溪鱸筆記](phone-note-river_perch-first.png) |

[等待有明確的提前收竿操作](phone-pond-silver_dace-waiting.png)、[早提原因](phone-pond-silver_dace-early.png)、[晚提原因](phone-pond-silver_dace-late.png)、[真正經過秒數與倒數](phone-pond-silver_dace-cooldown.png)。沒有加魚或清掉冷卻，三次均實等 30 秒才釣第二尾。

## 審查清單 2：效能

**BLOCKED：乾淨機況與實體手機。** 本次工作單已排除舊版同樣重現的釣台 33.3ms 根因追查。並發主機參考值與逐筆 rAF 在 [performance-reference.json](performance-reference.json)，不代表實機或正式效能完成。

參考場景原圖：[手機農場](phone-performance-sunpatch-run-1.png)、[手機釣台](phone-performance-pond-run-1.png)。既有 R79 閘門結果及本輪所有 exit code 在 [regression-checks.json](regression-checks.json)。

## 審查清單 3：六圖逐張阻斷與原頁重試

每張失敗頁都可讀原文，有實際生成的手記佔位圖、玩家文案與重試鈕；開發用守門仍回報失敗來源，玩家畫面不露檔名。重試不關頁、不更換文字。

| 來源 | 阻斷後 | 原頁按重試後 |
| --- | --- | --- |
| 蘿拉 | [缺圖](phone-art-merchant-missing.png) | [恢復](phone-art-merchant-restored.png) |
| 班伯 | [缺圖](phone-art-elder-missing.png) | [恢復](phone-art-elder-restored.png) |
| 圖圖 | [缺圖](phone-art-child-missing.png) | [恢復](phone-art-child-restored.png) |
| 河鯉 | [缺圖](phone-art-river_carp-missing.png) | [恢復](phone-art-river_carp-restored.png) |
| 銀鯽 | [缺圖](phone-art-silver_dace-missing.png) | [恢復](phone-art-silver_dace-restored.png) |
| 溪鱸 | [缺圖](phone-art-river_perch-missing.png) | [恢復](phone-art-river_perch-restored.png) |

## 審查清單 4：三人口味與回想

**VERIFIED：本機流程與下表證據。BLOCKED：無攻略玩家口述依據。** 回想頁只有當時坐下的情境，不直接寫甜／酸／熱或配料答案；返回保留原選味。三人九段農場回話互不重複，第一籃說「今天」，不再假設之前已送過。

| 居民 | 首送短篇 | 錯配／配對頁 | 農場實際交談：首送 → 錯配 → 配對 | 手記入口／情境 |
| --- | --- | --- | --- | --- |
| 蘿拉 | [首送](phone-story-merchant-first.png) | [錯配](phone-taste-merchant-wrong.png)、[酸味配對](phone-taste-merchant-matched.png) | [首送](phone-memory-merchant-first.png)、[錯配](phone-memory-merchant-wrong.png)、[配對](phone-memory-merchant-matched.png) | [入口](phone-recall-merchant-entry.png)、[情境](phone-recall-merchant-context.png) |
| 班伯 | [首送](phone-story-elder-first.png) | [錯配](phone-taste-elder-wrong.png)、[熱味配對](phone-taste-elder-matched.png) | [首送](phone-memory-elder-first.png)、[錯配](phone-memory-elder-wrong.png)、[配對](phone-memory-elder-matched.png) | [入口](phone-recall-elder-entry.png)、[情境](phone-recall-elder-context.png) |
| 圖圖 | [首送](phone-story-child-first.png) | [錯配](phone-taste-child-wrong.png)、[甜味配對](phone-taste-child-matched.png) | [首送](phone-memory-child-first.png)、[錯配](phone-memory-child-wrong.png)、[配對](phone-memory-child-matched.png) | [入口](phone-recall-child-entry.png)、[情境](phone-recall-child-context.png) |

熱味完整鏈：[包好熱麥餅與成本](phone-taste-elder-hot-packed.png) → [送到才扣料／配對頁](phone-taste-elder-matched.png) → [回農場找班伯交談](phone-memory-elder-matched.png)。

## 審查清單 5：容量與完成回饋

[取消前 10 份](phone-delivery-cancel-before.png) → [取消後 10 份全數保留](phone-delivery-cancel-after.png)。舊存檔 32 份保留，顯示 30/30 加另存 2 份待整理：[430 寬](phone-capacity-legacy-overflow.png)、[320 寬](phone-capacity-legacy-overflow-small.png)，沒有刪除物品或把容量偷偷改大。

圖圖兩頁並排看：[第一籃](phone-story-child-first.png)、[記住口味](phone-taste-child-matched.png)。首送為手記分隔線；配對有紅格書籤、餐籃圖示、完成文字與不同回話。重載後重讀仍保留配對標題與書籤。

三篇新圖都是完整人偶場景，取代原本大頭近景與細筆觸。原稿、前綴、工具與處理在 [PROMPTS_CONTENT_R3.json](../../art/PROMPTS_CONTENT_R3.json)、[美術 manifest](../../../assets/generated/content-r3/manifest.json)。第八輪地面、暖光與真角色姿勢保留。

離線重載：[蘿拉](phone-story-merchant-offline.png)、[班伯](phone-story-elder-offline.png)、[圖圖](phone-story-child-offline.png)、[魚筆記](phone-note-offline.png)。

新增商店原圖：[iPhone 1290×2796](../../store/screenshots/iphone-09-neighbor-memory.png)、[iPad 2064×2752](../../store/screenshots/ipad-09-neighbor-memory.png)。既有商店圖不替換。
