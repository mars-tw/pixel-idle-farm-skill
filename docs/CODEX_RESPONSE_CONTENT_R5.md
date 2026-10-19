# 陽光農場｜新內容第五輪

2026-10-19，main，起點 `9965109`。版本 **0.1.28／content-r5-20261019-1**。本輪唯一驗收清單是 `content/CONTENT_REVIEW_R4_MUSE.md`「下一輪最該做的 5 件事」。

**VERIFIED：五項本機驗收、126項新增瀏覽器檢查、21支完整瀏覽器守門、npm test與補充守門、95份JS語法、秘密掃描零命中、3,972份歷史檔案逐bytes保留。** 三人九次實際送餐、三魚各兩次捕獲、離線首次開圖、15張精選與兩張商店圖均已讀回。**BLOCKED：本輪共享桌機農場p95三跑中位33.3ms未達18ms；實體裝置、真人／親子試玩、乾淨專用主機效能、Muse獨立複審≥8分。** 沒有把自審當成Muse分數。

| 三項內容 | 本輪修正與玩法 | 正常入口 |
| --- | --- | --- |
| 餐籃送到以後 | 正文可捲到規則全文，底部顯示還有文字／已到底；固定送餐與三顆次鈕保持完整。選居民與原味／甜／酸／熱，送到本人手上才扣料，短篇與回話留下。 | 「更多」→「故事」→「裝一份鄰居餐籃」；灶台亦有同名入口。先跟班伯學農家麥餅、在灶台烹調。 |
| 池塘的三種脾氣 | 河鯉寬圓同心紋、銀鯽窄直痕與直水花、溪鱸右移雙環與長尾流。只保留一個即時狀態區，秒數另作小字；親手釣到並重載後不再提示魚名與節奏，觀察浮標下沉再提竿。 | 修好地圖「河畔釣台」後點釣台；「河畔筆記」回看已釣到的觀察。 |
| 鄰居的口味記憶 | 蘿拉、班伯配對補上專屬再訪插圖、敘事與對話，與圖圖同樣有紅格書籤。先聽首送回話，再翻只寫相處情境的手記，自己選搭配；錯配會收下但不完成配對。 | 餐籃頁選已拜訪居民→「翻手記回想」→「回餐籃，接著搭配」→送到；農場點本人也能聽見這次回話。 |

## 五項驗收與原尺寸路徑

原圖均在 `docs/content/r5/`；下列連結可直接開啟，主手機430×932，小手機320×568。[完整證據索引](content/r5/REVIEW_INDEX.md)依五項列出每張圖，包括故事頁頂部／底部。

**1．320寬餐籃說明截斷：VERIFIED。** 兩尺寸三人均實點四個功能與送餐；四鈕高度≥48px，主鈕≤2行、次鈕各1行，字形範圍沒有超出按鈕。正文捲到底時說明整段在可視區，沒有半句消失。

| 居民 | 320頂部／底部 | 430頂部／底部 |
| --- | --- | --- |
| 蘿拉 | [頂](content/r5/phone-basket-merchant-320-top.png)／[底](content/r5/phone-basket-merchant-320-bottom.png) | [頂](content/r5/phone-basket-merchant-430-top.png)／[底](content/r5/phone-basket-merchant-430-bottom.png) |
| 班伯 | [頂](content/r5/phone-basket-elder-320-top.png)／[底](content/r5/phone-basket-elder-320-bottom.png) | [頂](content/r5/phone-basket-elder-430-top.png)／[底](content/r5/phone-basket-elder-430-bottom.png) |
| 圖圖 | [頂](content/r5/phone-basket-child-320-top.png)／[底](content/r5/phone-basket-child-320-bottom.png) | [頂](content/r5/phone-basket-child-430-top.png)／[底](content/r5/phone-basket-child-430-bottom.png) |

**2．三魚遮字仍有不同水面：VERIFIED。** 每對原圖／遮字圖均來自同一竿、同一phase；只是CSS隱去文字與Logo，沒有停時鐘、換圖或修改浮標。索引將原尺寸成對並排。河鯉是三個封閉環＋對稱寬圓面；銀鯽是窄直中軸＋縱向水線／飛濺；溪鱸是右端雙環＋由左向右的長三角尾流。實際Canvas輪廓亦有量測；未宣稱真人盲辨率。

| 魚 | 沉前原圖／遮字 | 下沉原圖／遮字 |
| --- | --- | --- |
| 河鯉 | [原](content/r5/phone-pond-river_carp-pre-sink-original.png)／[遮](content/r5/phone-pond-river_carp-pre-sink-masked.png) | [原](content/r5/phone-pond-river_carp-sinking-original.png)／[遮](content/r5/phone-pond-river_carp-sinking-masked.png) |
| 銀鯽 | [原](content/r5/phone-pond-silver_dace-pre-sink-original.png)／[遮](content/r5/phone-pond-silver_dace-pre-sink-masked.png) | [原](content/r5/phone-pond-silver_dace-sinking-original.png)／[遮](content/r5/phone-pond-silver_dace-sinking-masked.png) |
| 溪鱸 | [原](content/r5/phone-pond-river_perch-pre-sink-original.png)／[遮](content/r5/phone-pond-river_perch-pre-sink-masked.png) | [原](content/r5/phone-pond-river_perch-sinking-original.png)／[遮](content/r5/phone-pond-river_perch-sinking-masked.png) |

**3．重複釣魚狀態句：VERIFIED。** 刪除另一個`.pond-state`狀態行，等待／可提竿／結果使用同一區。學會後進行畫面全文檢查不出現魚名、輕點、橫拉、停得、浮回、忽然等答案字。捕獲結束保留魚名與數量，讓玩家確認入簍。關閉鈕沒有殘留紅色焦點框。

| 魚 | 等待 | 沉前 | 結束 |
| --- | --- | --- | --- |
| 河鯉 | [原圖](content/r5/phone-pond-river_carp-waiting.png) | [原圖](content/r5/phone-pond-river_carp-pre-sink.png) | [原圖](content/r5/phone-pond-river_carp-ended.png) |
| 銀鯽 | [原圖](content/r5/phone-pond-silver_dace-waiting.png) | [原圖](content/r5/phone-pond-silver_dace-pre-sink.png) | [原圖](content/r5/phone-pond-silver_dace-ended.png) |
| 溪鱸 | [原圖](content/r5/phone-pond-river_perch-waiting.png) | [原圖](content/r5/phone-pond-river_perch-pre-sink.png) | [原圖](content/r5/phone-pond-river_perch-ended.png) |

學會後等待：[河鯉](content/r5/phone-pond-river_carp-learned-waiting.png)、[銀鯽](content/r5/phone-pond-silver_dace-learned-waiting.png)、[溪鱸](content/r5/phone-pond-river_perch-learned-waiting.png)；上表第2項沉前／下沉亦全是已賺得筆記並重載後的畫面。

**4．正常離線不走缺圖fallback：VERIFIED。** 先證明裝籃、首送與配對所需七張圖都在預快取，再真正切離線、重載、首次打開該頁，不靠先逛完圖片才快取。三人裝籃、首送及配對均成功解碼。異常阻斷／原頁重試另驗，居民、口味、說明、麥餅與原料全部不變。

| 居民 | 離線裝籃 | 離線首次短篇 | 離線配對 | 原頁重試復原 |
| --- | --- | --- | --- | --- |
| 蘿拉 | [原圖](content/r5/phone-basket-merchant-offline.png) | [原圖](content/r5/phone-story-merchant-offline-first.png) | [原圖](content/r5/phone-memory-merchant-offline.png) | [原圖](content/r5/phone-basket-merchant-retry-restored.png) |
| 班伯 | [原圖](content/r5/phone-basket-elder-offline.png) | [原圖](content/r5/phone-story-elder-offline-first.png) | [原圖](content/r5/phone-memory-elder-offline.png) | [原圖](content/r5/phone-basket-elder-retry-restored.png) |
| 圖圖 | [原圖](content/r5/phone-basket-child-offline.png) | [原圖](content/r5/phone-story-child-offline-first.png) | [原圖](content/r5/phone-memory-child-offline.png) | [原圖](content/r5/phone-basket-child-retry-restored.png) |

**5．三人完整記憶線與洩題檢查：VERIFIED。** 每人都實玩首送、錯配、配對，回想全文搜尋甜／酸／熱與食材字零命中。蘿拉呼應秤與陽光裡的凳子，班伯呼應牆邊魚竿與灶旁盤子，圖圖呼應空椅與壓花。三人的配對敘事、回話都點出這兩個物品／動作；畫面各有紅格書籤。

| 居民 | 首送 | 錯配 | 回想 | 配對 |
| --- | --- | --- | --- | --- |
| 蘿拉 | [原圖](content/r5/phone-story-merchant-first.png) | [原圖](content/r5/phone-memory-merchant-wrong.png) | [原圖](content/r5/phone-memory-merchant-recall.png) | [原圖](content/r5/phone-memory-merchant-matched.png) |
| 班伯 | [原圖](content/r5/phone-story-elder-first.png) | [原圖](content/r5/phone-memory-elder-wrong.png) | [原圖](content/r5/phone-memory-elder-recall.png) | [原圖](content/r5/phone-memory-elder-matched.png) |
| 圖圖 | [原圖](content/r5/phone-story-child-first.png) | [原圖](content/r5/phone-memory-child-wrong.png) | [原圖](content/r5/phone-memory-child-recall.png) | [原圖](content/r5/phone-memory-child-matched.png) |

## 精選、美術與商店圖

審查只需看 [review-set](content/r5/review-set/)：15張、三項各5張，01–05餐籃、06–10池塘、11–15口味記憶。03–04為同一次送餐的不同真逐幀姿勢；06–07及09–10為同一竿沉前／下沉；13為回想後、送出前的搭配決策。原尺寸直接複製，未裁切、縮放或拼貼；沒有缺圖、容量異常、效能與收據圖。[尺寸與SHA-256](content/r5/screenshot-readback.json)逐張讀回。

新增生成美術**2張**：蘿拉、班伯配對再訪。實際工具`image_gen.imagegen`，模型slug未揭露，manifest記null。各用第三輪同居民作參考，R89完整風格前綴、精確色盤、右上暖光，256×128原生採樣再nearest放大為512×256無損WebP。原稿、提示詞、來源hash、runtime輸出均保留，見`docs/art/PROMPTS_CONTENT_R5.json`、`docs/art/masters/content-r5/`、`assets/generated/content-r5/manifest.json`。角色真姿勢、physics root與碰撞不改；水紋是狀態效果，不計入生成圖數。

新增商店圖：[iPhone](store/screenshots/iphone-11-stove-return.png) **1290×2796**、[iPad](store/screenshots/ipad-11-stove-return.png) **2064×2752**。本輪實玩存檔直接擷取班伯配對，分別DPR3／DPR2，沒有加畫UI。保留全部舊商店圖。

## 測試與保存邊界

新測試為`test-content-r5.js`與`test-content-r5-e2e.js`，接入npm test、CI與序列瀏覽器runner。瀏覽器全程headless，逐一關閉context及browser；每次只有一支本線路server。R5起點只提供第一章解鎖、已修釣台與小麥20／胡蘿蔔4／野莓4；十份麥餅由灶台煮出，九次送餐與六次捕獲都用正常UI。固定亂數僅選魚種，不直接發魚、不改時鐘、不重設冷卻；三魚各真等滿30秒。一般前置縮短走路間隔，走路三格證據恢復原170ms；版型、離線、商店沿用當次賺得存檔。

R5主實玩：[126項收據與逐圖狀態](content/r5/browser-checks.json)，零page error；初次測試的通用`.modal-body`選擇器撞到五個視窗，改為`#worldModal .modal-body`後完整重跑，原失敗日誌保留。既有測試不刪除、不放寬斷言。全部舊測試產物生成器只在本repo的隔離副本執行，避免重寫原歷史截圖與起點未提交檔案。

驗證收據：`content/r5/regression-checks.json`、`logs/npm-test.txt`、`logs/browser-gates.txt`、`historical-readback.json`。收尾的效能、語法、秘密掃描與版本讀回另外列在`release-readback.json`。歷史對照`before-*.png`直接複製R4原圖，來源與hash在截圖收據，沒有冒稱本輪重新拍攝。

四筆序列命令退出碼均0：`npm test`、`npm run test:e2e`、water-guide、night-gate。完整瀏覽器runner共21支；其中指定R79原44項、世界主線370項均通過。R5在主工作區實玩與隔離副本完整回歸各通過一次；最終runtime、測試腳本與新素材均逐檔比對隔離副本一致，見`release-readback.json`。原有測試及斷言未改，起點未提交與未追蹤資料未納入提交。

**效能量測EXECUTED，參考門檻BLOCKED。** 每組新Chromium／DPR1三跑、4秒原始rAF、去掉前5幀、p95取ceil(n×0.95)-1；保留全部視覺層，沒有調低品質或改18ms門檻。12跑有3跑33.3ms，桌機農場三跑中位亦超標；其餘三組中位≤18ms。這是共享並發主機參考，原因尚未隔離，不能宣稱乾淨主機或實體裝置通過。R79在前段完整回歸的桌機／手機中位為16.8／16.7ms，與後段結果一併保留。

| 場景 | 桌機1366×768三跑p95 | 手機模擬390×844三跑p95 |
| --- | --- | --- |
| 農場 | 16.8／33.3／33.3ms（中位33.3，BLOCKED） | 16.8／16.8／16.7ms（中位16.8） |
| 釣台 | 16.7／33.3／16.8ms（中位16.8） | 16.8／16.7／16.7ms（中位16.7） |

原始每幀資料與12張場景圖在`content/r5/performance-reference.json`及`phone-performance-<sunpatch或pond>-run-1.png`至`-3.png`、`desktop-performance-<sunpatch或pond>-run-1.png`至`-3.png`；這些不放入精選集。JS語法、版本鏈、runtime舊版本字串歸零與秘密掃描收據均VERIFIED，歷史版本文件保留。

## 文案mode 2修改摘要

| 原句 | 原因 | 改成什麼 |
| --- | --- | --- |
| 等待・還沒下沉，提前收竿會空手＋還沒下沉，提前收竿會空手。 | 同一時刻念兩遍 | 移除另一個狀態行，只留原狀態區一句。 |
| 輕點、橫拉，都還沒咬穩。等浮標下沉，再提竿。每種魚的動靜不一樣。 | 與即時節奏重複 | 拋竿後改「先看水面的動靜，親手釣到後，就能留下河畔筆記。」 |
| 看水面的動靜，等浮標下沉再提竿。 | 學會後再次重述當下狀態 | 「憑上回記下的動靜，認認這一竿。」 |
| 這一尾已收好。翻開河畔筆記，留住剛剛看見的動靜。 | 結果區已確認入簍 | 「河畔筆記收著沿岸的觀察，下回還能翻看。」 |
| 你還記得那口酸！我今天特地早收一會兒攤，野莓餅一人一半，這次換我請你喝茶。 | 缺少與回想一致的兩個物品與書籤 | 保留記得口味與分餅，補秤放回攤上、兩張凳子拉到陽光裡、紅格書籤留手記。 |
| 還熱著呢，你一路護著帶來的吧？坐過來，灶邊這個位子暖。我那支魚竿，吃完再教你怎麼修。 | 缺少灶旁盤子與書籤呼應 | 保留護著餐籃，補魚竿靠牆、兩盤擺好、紅格書籤與飯後看河。 |

## 未完成與風險

Apple 4.3風險自評**中**：第一眼仍是同類像素農場；觀察魚的動靜、居民相處記憶與實際送餐有作品特色。這是開發判斷，不是Apple審核或Muse獨立結論。維持MIT、免費、離線；沒有廣告、內購、帳號、外部連結、第三方runtime SDK或線上功能。

BLOCKED項目及所需條件：實體手機／iPad觸控與裝置效能需要對應硬體；真人／親子試玩需要實際受試者；乾淨效能需要專用無並發主機；Muse≥8分需要審查員重新看精選集。本機未假造這些結果。正常流程與離線圖片均已驗證，fallback仍保留處理檔案損壞、儲存被清除等異常。只做本機commit，沒有push、部署、商店後台或對外訊息。
