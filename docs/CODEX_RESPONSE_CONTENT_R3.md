# 陽光農場｜新內容第三輪

2026-10-19，main，起點 `31821ef`。版本 **0.1.26／content-r3-20261019-1**。唯一清單為 `content/CONTENT_REVIEW_R2_MUSE.md` 最後五項；本次工作單明確排除舊版同樣重現的釣台 33.3ms 根因追查。

**VERIFIED：三項本機修訂、273 項瀏覽器檢查、23 支驗證命令的最終結果與原尺寸截圖。BLOCKED：真人盲測、真人選味口述、實體裝置／乾淨機況效能、Muse 獨立複審 8 分。** 不將本機操作或連續圖當作真人驗收。

## 三項做了什麼、怎麼玩、入口在哪

| 內容 | 本輪修訂與操作 | 正常入口 |
| --- | --- | --- |
| 餐籃送到以後 | 蘿拉、班伯、圖圖各重新生成完整人偶場景，對齊世界角色比例、256×128 原生像素群與第八輪色盤。送到居民的作用幀才扣一份麥餅；取消後在農場顯示保留份數與配料未取用，六秒後收起。首次說「今天」，不再誤稱之前送過。 | 底列「更多」→「故事」→「裝一份鄰居餐籃」，或灶台同名入口。學會麥餅後烹調、選居民與口味、裝籃送到。 |
| 池塘的三種脾氣 | 等待寫清楚「提前收竿會空手」，按鈕改為可理解的「提前收竿」；真正下沉才出現金色「提竿」。加入這一竿實際經過秒數，補銀鯽與三魚各階段原圖。六張短篇／魚筆記讀不到時，保留文字、生成手記佔位圖與「重試插圖」，不露檔名、不必重開頁。 | 修復地圖「河畔釣台」後點釣台；等下沉再提竿。釣到後可從「河畔筆記」重讀。 |
| 鄰居的口味記憶 | 已送過餐籃者多了固定底列「翻手記回想」，每人只給當天情境，不直接標甜／酸／熱或配料答案；返回保留選味。首送是手記分隔線，配對是紅格書籤、餐籃圖示與「記住口味」標記。重載重讀也保留標題與書籤。舊存檔超量物品完整保留，以「30/30・另存 2 份待整理」說明容量。 | 同一餐籃頁選居民→「翻手記回想」→返回搭配→送到。農場點原居民，再按「交談」，可聽見最近一次餐籃回話。 |

## 五項清單與原尺寸截圖

主證據為 430×932 PNG，均在 `docs/content/r3/`。完整可點索引見 [REVIEW_INDEX.md](content/r3/REVIEW_INDEX.md)，可直接開啟每張原圖。

1. **三魚真人盲測：BLOCKED。** 需要 5 名沒看過筆記的新玩家，各釣三魚兩次，全程錄影與口述，辨識 ≥80%，每人至少一次遮住狀態文字說對魚種。已補本機軌跡與捕獲證據：河鯉 `phone-rhythm-river_carp-1.png` 至 `-4.png`（點→浮回→再點→下沉）；銀鯽 `phone-rhythm-silver_dace-1.png` 至 `-3.png`（經過秒數不同的長停→急沉）；溪鱸 `phone-rhythm-river_perch-1.png` 至 `-3.png`（橫拉尾流→側停→側沉）。銀鯽補證 `phone-note-silver_dace-first.png`、`phone-pond-silver_dace-caught.png`、`phone-pond-silver_dace-caught-again.png`。這些不是真人辨識率或影片。
2. **效能：並發參考量測 EXECUTED；完整驗收 BLOCKED。** 本輪依指定不再追釣台既有環境干擾根因。原始每幀時間戳／間隔在 `performance-reference.json`，三跑各自的場景截圖以 `phone-performance-sunpatch-run-1.png`、`phone-performance-pond-run-1.png` 為例。乾淨主機、實體手機各三跑 ≤18ms 及完整渲染／DOM／存檔歸因尚缺，版本頁與報告不宣稱效能完成。
3. **六圖善後：本機 VERIFIED。** 每張都刻意阻斷、檢查開發守門仍拋出失敗來源、玩家畫面不露檔名、佔位圖已解碼，再在同頁按重試，確認恢復且原文不變。原尺寸逐組為 `phone-art-merchant-missing.png`／`-restored.png`、`phone-art-elder-missing.png`／`-restored.png`、`phone-art-child-missing.png`／`-restored.png`、`phone-art-river_carp-missing.png`／`-restored.png`、`phone-art-silver_dace-missing.png`／`-restored.png`、`phone-art-river_perch-missing.png`／`-restored.png`。
4. **口味記憶：本機 VERIFIED；真人口述 BLOCKED。** 三人首送／錯配／配對與農場交談皆有原圖，見下表。回想入口與情境為 `phone-recall-merchant-entry.png`／`-context.png`，班伯與圖圖將 `merchant` 換為 `elder`、`child`。真人仍需在第二次送餐前、沒有攻略時口述選味的依據來源。
5. **可見破口：本機 VERIFIED。** 全流程截圖檢查容量不再出現超上限比例；故意用舊 32 份存檔測保留與重載，證據 `phone-capacity-legacy-overflow.png`。取消前後同為 10 份：`phone-delivery-cancel-before.png`／`-after.png`。圖圖首送與配對：`phone-story-child-first.png`、`phone-taste-child-matched.png`，配對的紅格書籤、圖示、標題、回話均有差別。三篇大頭細筆觸圖已換成完整人偶場景；美術是否達到 Muse 8 分仍待獨立評分。

### 三人完整證據

下表每個檔案都在 `docs/content/r3/`，均為手機直式原圖。

| 居民 | 首送／錯配／配對餐籃頁 | 農場首送／錯配／配對回話 |
| --- | --- | --- |
| 蘿拉 | `phone-story-merchant-first.png`、`phone-taste-merchant-wrong.png`、`phone-taste-merchant-matched.png` | `phone-memory-merchant-first.png`、`phone-memory-merchant-wrong.png`、`phone-memory-merchant-matched.png` |
| 班伯 | `phone-story-elder-first.png`、`phone-taste-elder-wrong.png`、`phone-taste-elder-matched.png` | `phone-memory-elder-first.png`、`phone-memory-elder-wrong.png`、`phone-memory-elder-matched.png` |
| 圖圖 | `phone-story-child-first.png`、`phone-taste-child-wrong.png`、`phone-taste-child-matched.png` | `phone-memory-child-first.png`、`phone-memory-child-wrong.png`、`phone-memory-child-matched.png` |

班伯熱味另有成本／選取原圖 `phone-taste-elder-hot-packed.png`，接配對與農場交談兩張。三人的台詞各自驗證，手記頁的居民識別也會與截圖檔名對帳。

## 測試與資料邊界

新增三組單元驗證：九段台詞唯一與回想資訊、舊存檔溢出無損、三張實際生成圖的來源／hash／尺寸／離線入口。瀏覽器使用正常故事／灶台入口、實際烹調十份麥餅、九次走到居民交付、實際點居民交談，三魚各兩次真正下沉捕獲、每魚實等 30 秒冷卻與重載。

章節一的三個 claim、修好釣台與起始小麥 20／胡蘿蔔 4／野莓 4 是測試前置，起始背包 28/30。沒有加魚、快轉時鐘或清冷卻；所有送餐與捕獲是 UI 行為。搬送連續三格記錄實際 limb frame 與扣料前份數，沒有把單張人物位移當作動畫。world 角色、physics root／collider 與既有肢體姿勢未改；無戰鬥，攻擊／受擊／死亡不適用。

新增版型檢查涵蓋 320×568、430×932、844×390、768×1024、1366×600 的餐籃、手記與固定底列，所有被檢查操作中心可點、尺寸 ≥44px，沒有手機鍵盤提示。既有 RWD／控制可達性與第八輪美術測試仍保留。

最終 VERIFIED：`npm test`、全部 19 支現行 browser gates（含 R79、R1／R2／R3）、water-guide、night-gate 與並發參考量測，共 23 支命令。RWD 九視口／overlay 開關零違規，控制可達性 339 項／七裝置，第 82 至 89 輪美術守門全部通過。本輪交付 118 張原尺寸證據圖：104 張操作／版型圖、12 張效能場景圖、2 張商店圖；前述初次失敗紀錄亦保留。

R79 原有 44 項全通過；桌機三跑 p95 為 16.8／16.8／16.8ms，手機模擬為 16.8／16.7／16.8ms，中位皆 16.8ms。另以原始 R79 前置與完整釣台前置各跑三次，保存每一幀原始時間戳，12 次參考值全部 ≤18ms：

| 並發主機參考場景 | 桌機 1366×768 三跑 p95 | 手機模擬 390×844 三跑 p95 |
| --- | --- | --- |
| 農場陽光 | 16.8／16.7／16.8ms | 16.8／16.7／16.7ms |
| 釣台 | 16.8／16.8／16.8ms | 16.8／16.8／16.8ms |

這次釣台未重現 33.3ms；共享主機結果不能證明舊問題根因已排除，也不能取代乾淨主機或實體手機。量測沒有加降載旗標、關掉農場視覺或放寬 18ms，所有瀏覽器按次關閉。

R2 原測試曾要求玩家錯誤訊息包含檔名，與本輪明文要求相反。本輪保留六圖逐張阻斷與診斷檔名守門，將玩家端斷言改為「禁止外露、生成佔位圖可見、原頁重試成功」，增加檢查而未刪測試或放寬成允許缺圖。R2 單元的插圖路徑同步改為實際 R3 路徑，來源 hash 與舊美術驗證仍在。

既有 R1 離線測試初跑及原檔重跑，皆在 Service Worker 初次接管觸發自動重載期間發生 `Execution context was destroyed`。測試原本在 activation 完成、但 controllerchange 尚未結束時又要求手動重載；本輪在原手動重載前增加「已受控、已有自動重載記號、本文件確實是 reload」等待條件。控制接管、預快取、離線故事／魚、存檔等原斷言全部保留，三輪內容測試同步加入此條件，重跑與每次失敗輸出分別保留於命令收據。

逐張看圖另發現手記背後的上一段居民對話會洩漏口味答案；已在紙頁開啟時隱藏背景對話，關閉後回復，新增可見性斷言並完整重跑 R3，交付原圖採修正後版本。

完整命令、exit code、耗時與 log 在 `content/r3/regression-checks.json`；本輪操作／原尺寸截圖與狀態在 `content/r3/browser-checks.json`。初跑紀錄 `content/r3/logs/browser-initial.txt` 保留，之後補上每張回想頁的居民識別對帳及新圖真正離線重載檢查，交付截圖以最終完整重跑為準。

## 美術、商店圖與保留

新增 **3 張美術**，實際工具 `image_gen.imagegen`，未揭露模型 slug，manifest 記 null。完整沿用 `PROMPTS_R89.json` 的風格前綴，以現行 `r89/walk.png` 作比例／風格參考；原稿各 1774×887，原檔保留在 `docs/art/masters/content-r3/`，原生 256×128 像素採樣、精確第八輪色盤、nearest 2 倍為 512×256 無損 WebP。沒有用方塊、emoji 或純色冒充美術，佔位圖重用既有生成手記。

提示詞與來源 `docs/art/PROMPTS_CONTENT_R3.json`；runtime 圖與 SHA-256 `assets/generated/content-r3/manifest.json`。三張新圖均另外驗證 Service Worker 控制下斷網重載，證據 `phone-story-merchant-offline.png`、`phone-story-elder-offline.png`、`phone-story-child-offline.png`。

商店新增 `docs/store/screenshots/iphone-09-neighbor-memory.png`（1290×2796）、`ipad-09-neighbor-memory.png`（2064×2752）。直接擷取已完成配對的圖圖紙頁，DPR3／DPR2，沒有縮放、拼貼或補畫 UI。清單 `docs/store/screenshots-content-r3-manifest.json`。

既有商店圖、歷史測試證據與起點未提交檔案保留。2,486 份起點檔案逐 bytes 驗證一致；347 份重產物先歸檔再還原，另有 8 份起點不存在的舊測試輸出移入本輪歸檔。保存收據 `content/r3/historical-readback.json`；118 張原圖尺寸、三張美術來源、版本鏈、原始 rAF 重算與秘密掃描零命中均已讀回，見 `content/r3/release-readback.json`。

## 未完成與風險

**Apple 4.3 風險：中，本線自評。** 送到鄰居、從生活回話搭配口味、觀察不同浮標動靜，提供本作的操作差異；農場外觀仍在常見類型中，且未檢查同開發者全部原生 Bundle 或完成市場逐款比較。此為依 [Apple 官方 4.3(a)(b)](https://developer.apple.com/app-store/review/guidelines/#spam) 對重複 Bundle 與難以區辨作品規定所做的風險推論（2026-10-19查閱），不是 Apple 審查結果。

**BLOCKED：**五名新玩家的魚種辨識／遮字口述／全程錄影；無攻略玩家選味來源口述；乾淨主機與實體手機各三跑 p95≤18ms、實體 iPad／iOS Safari／Android 操作；Muse 獨立複審 ≥8 分。需要相應裝置、測試者與複審結果。未宣稱已達 8 分或可上架。

本輪只在本 repo 的 main、背景／無頭執行與本機 commit，無 push、部署、商店後台、對外訊息或派工。遊戲仍為 MIT、免費與離線，未加入廣告、內購、帳號、第三方 SDK 或線上功能；秘密掃描只讀 repo，不讀秘密目錄。

繁中文案 mode2：原「插圖未能開啟：檔名，重新開啟這一頁」→「插圖讀不到，先看文字筆記」＋重試，讓玩家可繼續閱讀；原「等浮標下沉」灰鈕→「提前收竿」＋等待原因，讓操作後果可預期；原首次「上回那籃」→「今天這籃」，修正時間順序；新增手記只寫當天情境，沒有編造真人回饋。
