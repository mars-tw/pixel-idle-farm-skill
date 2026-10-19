# 陽光農場｜新內容第四輪

2026-10-19，main，起點 `43b92c9`。版本 **0.1.27／content-r4-20261019-1**。唯一驗收清單是 `docs/content/CONTENT_REVIEW_R3_MUSE.md` 第四節五項。

**VERIFIED：五項本機修訂、349項瀏覽器檢查、20支CI瀏覽器守門、92份JS語法、144張最終原尺寸證據／商店圖、版本鏈、秘密掃描零命中、3,000份起點歷史檔逐bytes保留。** 完整收據在 `content/r4/release-readback.json`。**BLOCKED：實體裝置、真人試玩、乾淨機況效能、所有單跑均≤18ms、Muse獨立複審≥8分。** 釣台桌機其中一跑33.3ms，四組三跑中位均≤18ms，詳見下表。

| 三項內容 | 做了什麼、怎麼玩 | 正常入口 |
| --- | --- | --- |
| 餐籃送到以後 | 裝籃頁使用灶邊藤籃近景；圖圖首送保留分點心的場景，配對改為空椅上的壓花、桌上手記與紅格書籤，敘事與回話一併改成已準備禮物。固定底列是整行送餐主鈕，下排三顆次鈕，每顆至少48px高。 | 「更多」→「故事」→「裝一份鄰居餐籃」，或灶台同名入口。學會麥餅後，烹調、選居民與搭配、裝籃送到。 |
| 池塘的三種脾氣 | 首次保留節奏提示；釣到並解鎖該魚筆記後，後續該魚進行畫面收起節奏與魚名，只留提早收竿後果、下沉時機。河鯉是三圈連環紋、銀鯽長停後窄直水花、溪鱸側移及長尾流，直接受同一拋竿狀態控制。 | 修好地圖「河畔釣台」後點釣台，觀察下沉再提竿；「河畔筆記」可回看觀察。 |
| 鄰居的口味記憶 | 三人的回想只保留當時的動作與相處情境；圖圖拿掉烤菜暗示，蘿拉拿掉果子。回想返回保留搭配，首送／錯配／配對回話分別留在農場；配對有紅格書籤。 | 同一餐籃頁選已拜訪居民→「翻手記回想」→返回搭配→送到；農場點本人再交談。 |

## 五項驗收與原尺寸手機圖

全部在 `docs/content/r4/`，主證據430×932；小手機320×568另列。[REVIEW_INDEX.md](content/r4/REVIEW_INDEX.md) 依五項列出可點原圖，並排呈現三魚與圖圖三場景。遮字圖只將DOM文字與Logo隱藏，水面、浮標、時間、狀態機保持實際運作；不是新圖或替換水面。

1. 提示退場：`phone-learned-river_carp-1-tap-49.png`、`phone-learned-silver_dace-0-still-66.png`、`phone-learned-river_perch-1-pull-82.png` 是筆記已解鎖、重載後的進行畫面；`phone-pond-river_carp-caught-again.png`、`phone-pond-silver_dace-caught-again.png`、`phone-pond-river_perch-caught-again.png` 是第二次實際捕獲結果。解鎖前節奏字仍保留。
2. 水面差異：`phone-water-<魚>-pre-sink-masked.png` 是沉前階段，`phone-water-<魚>-submerging.png` 與 `phone-water-<魚>-masked.png` 是下沉階段原圖與遮字版。`phone-rhythm-<魚>-1.png` 起的連續圖對應河鯉點／回浮／再點／下沉、銀鯽長停／急沉、溪鱸橫拉／停／側沉。三魚筆記各有 `phone-note-<魚>-first.png` 可對照口訣。這是開發端看圖自檢，沒有宣稱真人辨識率。
3. 圖圖三場景：`phone-taste-child-plain-packed.png`（灶邊裝籃）、`phone-story-child-first.png`（首送分點心）、`phone-taste-child-matched.png`（配對的花與書籤）。插圖可指出空椅座面與桌上手記兩處差異；配對敘事和回話都提到這兩件物品。
4. 窄手機操作列：`phone-basket-320x568.png` 與 `phone-basket-430x932.png`。送餐至多兩行，三次鈕各一行、不截斷；兩尺寸都實點送餐、回灶台、重讀、回想，不只檢查CSS。居民與搭配選中態保留。
5. 三人線索與配對：`phone-recall-merchant-context.png`、`phone-recall-elder-context.png`、`phone-recall-child-context.png`；對照 `phone-taste-merchant-matched.png`、`phone-taste-elder-matched.png`、`phone-taste-child-matched.png`。頁內沒有甜／酸／熱或食材名；三人配對回話各自不同，書籤齊全。

前輪標「未見證據」的項目另補：三人首送／錯配／配對為 `phone-story-<居民>-first.png`、`phone-taste-<居民>-wrong.png`、`phone-taste-<居民>-matched.png`；農場回話為 `phone-memory-<居民>-first|wrong|matched.png`。三人完整場景與新配對圖可在這些原圖看到。六張短篇／魚筆記逐張缺圖與原頁重試用 `phone-art-<居民或魚>-missing|restored.png`。離線重載為 `phone-story-<居民>-offline.png`、`phone-note-offline.png`。冷卻是 `phone-pond-<魚>-caught.png`、`phone-pond-<魚>-cooldown.png`、`phone-cooldown-<魚>-ready.png`，真實等30秒，沒有快轉。

## 測試與資料邊界

測試起始提供已完成第一章三個claim、修好的釣台、小麥20／胡蘿蔔4／野莓4；麥餅由正常灶台操作煮出，九次送餐、三魚各兩次捕獲與30秒冷卻都由UI完成。固定抽樣亂數只選魚種，不注入魚、不調時鐘、不清冷卻；移動速度在前置加快，三格步行證據另恢復原170ms。完工後的版型／離線／商店擷取重用這次實玩存檔，逐視口獨立副本。

新測試 `test-content-r4.js` 與 `test-content-r4-e2e.js` 接入 `npm test`、`npm run test:e2e`。保留所有既有測試與斷言。回歸按CI現行browser runner逐支執行，包含指定R79與R1–R3、RWD、控制可達性、第82–89輪美術；另跑water-guide與night-gate。R79原44項、世界流程370項、控制可達性339項／七裝置皆通過。每次只開一支瀏覽器測試、單一server，結束關閉。初次截圖及幾何失敗保留 `initial-attempt/` 與 `browser-initial.txt`；修正操作列佈局後完整重跑。

另以 `test-content-r4-assets.js` 補驗兩張新圖離線解碼、裝籃圖逐張阻斷／原頁重試與食物／回話狀態不變，共7項；同一模組也接入本輪E2E供後續CI執行。本次補驗命令與最後一次 `npm test` 一併記錄，`regression-checks.json` 共7筆命令退出碼全為0，`logs/browser-gates.txt` 列出20支守門結果。`syntax-checks.json` 記錄92份JS。原尺寸測試收據圖 `phone-receipt-checks.png`，前輪三圖來源／hash `phone-receipt-art-r3.png`，本輪兩圖來源／hash `phone-receipt-art-r4.png`；這些是實際收據的本機視覺索引，不冒充獨立審查。

新增水紋是以原生兩螢幕像素為一格的canvas動態效果，使用既有色盤、既有生成水面與浮標；只在動作階段或尺寸改變時重畫。水圈與水花屬狀態效果，不計入生成美術。角色仍使用R89真逐幀姿勢；不改physics root、碰撞、動作作用幀，沒有把角色單圖位移當動畫。戰鬥／攻擊／受擊／死亡不適用。

共享主機桌機／手機模擬、農場／釣台各三跑保留每幀rAF，未降載或放寬18ms。原始資料 `performance-reference.json`，場景圖 `phone-performance-<sunpatch或pond>-run-1.png` 起；完整檔名見索引。三跑中位參考門檻VERIFIED；所有單跑均≤18ms為BLOCKED，因下列33.3ms實測超標。乾淨主機與實體裝置效能仍BLOCKED，沒有宣稱舊釣台間歇問題已排除。

| 場景 | 桌機1366×768三跑p95 | 手機模擬390×844三跑p95 |
| --- | --- | --- |
| 陽光農場 | 16.8／16.8／16.8ms | 16.7／16.7／16.7ms |
| 釣台 | 16.8／33.3／16.8ms | 16.7／16.7／16.8ms |

## 美術、商店圖與保存

新增 **2張**，實際工具 `image_gen.imagegen`，模型slug未提供，manifest記null；提示詞完整沿用 `PROMPTS_R89.json` 風格前綴，既有圖圖場景作參考。原稿在 `docs/art/masters/content-r4/`，256×128原生採樣、精確R89色盤、nearest放大至512×256無損WebP，來源／輸出hash與尺寸在 `assets/generated/content-r4/manifest.json`。兩圖加入SW離線預快取；原始生成圖與歷史授權保留。

新增商店圖 `docs/store/screenshots/iphone-10-remembered-gift.png`（1290×2796）及 `ipad-10-remembered-gift.png`（2064×2752），使用本輪實際九次送餐存檔直接擷取配對畫面，DPR3／DPR2，沒有縮放、裁切、拼貼或加畫UI。所有既有商店圖與起點未提交檔案保留；444份重產歷史證據歸檔後還原，8份起點不存在的舊測試輸出移入本輪歸檔，3,000份起點檔案逐bytes一致，收據 `historical-readback.json`。最終144張原圖不含初跑與回歸歸檔。

## 未完成與風險

**Apple 4.3風險：中，本線自評。** 拜訪、回話記憶與看水辨魚提供本作差異，常見農場外觀仍有風險；尚未逐一檢查同開發者全部原生Bundle。此為依 [Apple官方4.3(a)(b)](https://developer.apple.com/app-store/review/guidelines/#spam)（2026-10-19查閱）對重複Bundle與無法區辨作品規定所做的推論，並非Apple審查結果。

**BLOCKED：** 實體iPhone／iPad／Android及Safari、真人或親子試玩、無攻略魚種辨識與選味口述、乾淨機況效能、Muse獨立複審≥8。需要相應裝置、測試者與審查回覆。本機截圖不能取代這些驗收，不自報已達8分。

MIT、免費、離線；未增加廣告、內購、帳號、外部連結、第三方SDK或線上功能。只本repo／main、本機commit，沒有push、部署、商店後台、訊息或服務派工。秘密掃描只讀repo，未讀秘密目錄。

繁中文案mode2：原「剛烤好的那根菜」過度指向答案→改成分點心與護花的情境；原「剩下的果子」直接指食材→改成收攤後放下秤的動作；圖圖配對仍說「花乾了以後」與新圖時序不合→改為花和書籤都已準備好；已解鎖魚的進行中節奏字改為中性等待與操作後果。
