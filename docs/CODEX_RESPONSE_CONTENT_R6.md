# 陽光農場｜新內容第六輪

2026-10-19，main；版本 **0.1.29／content-r6-20261019-1**。驗收唯一依據為 `content/CONTENT_REVIEW_R5_MUSE.md`「下一輪最該做的5件事」。五項設計與預定檔案先記於 `OPTIM_PLAN_CONTENT_R6.md`。

**VERIFIED：五項本機驗收、131項本輪瀏覽器檢查、22支瀏覽器守門的分段覆核、release版npm test、水井引導與夜景守門。** 118份原尺寸畫面包含兩張商店圖，另複製15張精選；每張來源、尺寸與hash均列入讀回。收據在 `content/r6/regression-checks.json`、`browser-checks.json`、`release-readback.json`。**BLOCKED：實體裝置、真人／親子試玩、Muse獨立複審≥8分**，未冒稱通過。

| 三項內容 | 本輪完成與玩法 | 正常入口 |
| --- | --- | --- |
| 餐籃送到以後 | 窄送餐列顯示居民、約剩幾步與取消；邊緣箭頭指路，居民頭頂有餐籃。走路保留既有真逐幀肢體，居民用新生成的伸手、接籃、回話三個真姿勢。接籃作用幀才扣麥餅／配料，取消不扣料。四味有不同籃內成品，底列持續顯示送誰、哪一味、送出後剩餘材料。 | 「更多」→「故事」→「裝一份鄰居餐籃」；灶台同名入口。先跟班伯學做農家麥餅，再在灶台烹調。 |
| 池塘的三種脾氣 | 河鯉等寬圓紋合攏；銀鯽在短促直水花內提竿，水花散了就晚；溪鱸先下沉、尾流仍彎，等尾流拉直才提。銀鯽水花加大，保留窄直輪廓。遊玩移除即時秒數；學會後不提示魚名、節奏或用按鈕變色報答案。河畔筆記同步改為真正的提竿判斷。 | 修好地圖「河畔釣台」後點釣台；捕獲後可點「河畔筆記」。 |
| 鄰居的口味記憶 | 錯味各有茶、冷手、分點心的反應，不直接公布口味；回想不洩食材。配對後分別留下蘿拉的陽光茶凳、班伯的魚竿盤架、圖圖的壓花空椅，農場可見且可點。三人都配對後，親手準備三籃、實走赴約，回收三個生活位置到同一場聚餐；三頁總手記與永久聚餐桌可重看。 | 餐籃頁→「翻手記回想」→回餐籃搭配→送到本人。三人配對後，「故事」新增「三個位子，一起吃」，成功頁也有聚餐入口。 |

## 五項驗收與原尺寸截圖

[完整逐項原圖索引](content/r6/REVIEW_INDEX.md)列出全部組合。手機主尺寸430×932，小尺寸320×568；未裁切、縮放或拼貼。精選限制15張，不能把完整索引裡未入選的圖說成審查員都已親眼看過。

| Muse驗收 | 修改與驗證 | 原圖例與完整組合 |
| --- | --- | --- |
| 1．完整走路送餐 | 三人各在320／430實走，剛拿籃、半路、居民伸手、交手、回話連續畫面；接籃前後材料對帳。屋後保留角色與建物深度，重疊屋頂淡出，角色不再陷進屋頂；碰撞與root不移動。 | [蘿拉半路](content/r6/phone-basket-merchant-430-halfway.png)／[伸手](content/r6/phone-basket-merchant-430-resident.png)／[交手](content/r6/phone-basket-merchant-430-handover.png)；三人兩尺寸共六組見索引§1。[屋後320](content/r6/phone-basket-roof-320.png)／[430](content/r6/phone-basket-roof-430.png)。 |
| 2．小尺寸不用猜 | 三人各原味；四味有麥餅、橘色胡蘿蔔、紫紅野莓杯、保溫布銅罐的可辨差別。捲到底仍顯示居民、口味與剩餘材料；正文說明持有／本次需要。 | [蘿拉320底部](content/r6/phone-basket-merchant-320-bottom.png)／[班伯](content/r6/phone-basket-elder-320-bottom.png)／[圖圖](content/r6/phone-basket-child-320-bottom.png)。[原味](content/r6/phone-basket-flavor-plain-320.png)／[甜](content/r6/phone-basket-flavor-sweet-320.png)／[酸](content/r6/phone-basket-flavor-sour-320.png)／[熱](content/r6/phone-basket-flavor-hot-320.png)。 |
| 3．三種圖案變三種咬法 | 三魚各實點過早失敗，再於實際作用窗捕獲；銀鯽晚提也有規則測試。捕獲與筆記重載保存，完整30秒冷卻未倒填。六張遮字圖與原圖逐phase對帳，沒有停時鐘；未宣稱真人盲辨通過。 | [河鯉沉前](content/r6/phone-pond-river_carp-pre-sink-masked.png)／[沉](content/r6/phone-pond-river_carp-sinking-masked.png)；[銀鯽前](content/r6/phone-pond-silver_dace-pre-sink-masked.png)／[沉](content/r6/phone-pond-silver_dace-sinking-masked.png)；[溪鱸前](content/r6/phone-pond-river_perch-pre-sink-masked.png)／[沉](content/r6/phone-pond-river_perch-sinking-masked.png)。 |
| 4．拆掉共用配對模板 | 三種不同紀念物與成功樣式、三種不洩答案的錯味。農場真正新增可互動物件，重載保留，點本人聽這次回話。成功頁寬圖沿用既有生成故事圖；圖圖舊圖裡的書籤可保留為細節，沒有再給三人同種書籤獎勵。 | [蘿拉錯](content/r6/phone-memory-merchant-wrong.png)／[對](content/r6/phone-memory-merchant-matched.png)；[班伯錯](content/r6/phone-memory-elder-wrong.png)／[對](content/r6/phone-memory-elder-matched.png)；[圖圖錯](content/r6/phone-memory-child-wrong.png)／[對](content/r6/phone-memory-child-matched.png)。地景與本人回話見索引§4。 |
| 5．共同小收束 | 三籃各自決策與一次扣料，各籃分開存檔、重開接續；全齊才實走赴約。共同圖裡三位居民各就座，三個舊細節同時回來；總手記各列口味、細節、不同完成圖。農場留下可再點的聚餐桌。共同就座是生成插圖，未宣稱另做坐下動畫。 | [蘿拉備籃](content/r6/phone-gathering-merchant-decision.png)／[班伯](content/r6/phone-gathering-elder-decision.png)／[圖圖](content/r6/phone-gathering-child-decision.png)；[聚餐完成](content/r6/phone-gathering-complete.png)／[農場改變](content/r6/phone-gathering-farm-after.png)。三頁總回顧見索引§5。 |

## 精選與商店

[review-set](content/r6/review-set/)恰15張；01–04餐籃、05–10池塘、11–15記憶與聚餐，維持4／6／5的接近平均分配，完整保留三魚的六張遮字對照。01–03含同趟半路、伸手、接籃；05–06、07–08、09–10各為同竿水面變化，皆有遊玩進行中畫面。精選直接複製原檔；逐圖尺寸、來源與SHA-256另見`screenshot-readback.json`。

新增商店圖：[iPhone](store/screenshots/iphone-12-shared-afternoon.png) **1290×2796**、[iPad](store/screenshots/ipad-12-shared-afternoon.png) **2064×2752**。使用本輪親手完成的聚餐存檔，DPR3／DPR2直接擷取，沒有補畫UI，全部舊商店圖保留。

## 美術、資料與測試邊界

新增生成美術 **4張原稿、17個執行素材**：四味籃子atlas、三居民三姿勢接籃atlas、三紀念物atlas、共同聚餐插圖。實際工具`image_gen.imagegen`，模型slug未揭露，manifest記null。沿用R89完整風格前綴、精確色盤、右上暖光；native64×64籃子／紀念物、48×64接籃角色、256×128共同故事，nearest放大；透明背景先去掉極低alpha暈邊再取剪影，沒有重繪假肢體。原稿、提示詞、runtime與hash在`docs/art/masters/content-r6/`、`docs/art/PROMPTS_CONTENT_R6.json`與`assets/generated/content-r6/manifest.json`。

R1–R5既有敘事API欄位與phase時序保留作相容契約；目前畫面與本人回話讀取新增的各人記憶呈現。R6會把`observationVersion=2`存進實際釣竿，使銀鯽短作用窗在存檔遷移後仍有效。沒有刪除既有測試或放寬斷言，R6另以三種物件、三種錯味、作用窗與共同聚餐的測試約束新行為。

新增`test-content-r6.js`與`test-content-r6-e2e.js`，接入npm test、CI與序列browser runner。規則測試涵蓋鎖定、缺料原子性、防重複、壞存檔、逐籃存檔、完成重入、捕獲作用窗與筆記教學。瀏覽器全程headless，一次一個server，context與browser用完關閉。

本輪6組規則與131項實玩檢查全過，最終`npm test`退出碼0；既有世界主線370項、指定R79共44項均通過，water-guide與night-gate也退出碼0。22支瀏覽器腳本以先前16支及修正後6輪內容的通過收據合併；圖圖站位最後修正後，再完整重跑R6、release版npm test並重拍全部118份畫面。最後另檢查98份JS語法、runtime舊版字串零命中、秘密掃描零命中，以及原有檔案逐bytes保存。

收尾讀回確認：5,537份原有檔案保持逐bytes不變，18份既有程式／版本檔為本輪授權修改；起點已修改的R68來源清單與原有未追蹤審查資料都完整保留，未納入本輪提交。

實玩fixture只提供第一章／釣台可用與小麥36、胡蘿蔔8、野莓8；16份麥餅由灶台實際烹調，九次鄰居送餐與三籃聚餐備料都從正常按鈕執行。320驗收沿用當次煮好的存檔重新送三人。後續版型、離線與商店沿用實玩賺得的存檔；固定亂數只選魚種，不發魚、不改鐘、不倒填冷卻。一般前置走路間隔縮短；送餐連續證據先沿正常尋路走回公共田徑t7_3，開餐籃後恢復原170ms真逐幀，沒有直接改角色座標。圖圖接籃時，沿用既有visual stance讓玩家往旁邊站，避免男孩原本的視覺上移與玩家重疊；兩人的tile與collider都不移動。

離線會先等PWA更新／自動重載穩定，再真正切offline與重載，首次打開四味與共同聚餐，檢查17個新素材全部預快取。修正PWA的完成旗標：先用pending防重入，等替換頁面的load完成才記錄已重載，避免自動／手動導覽互撞；本輪另檢查實際navigation與loadEventEnd。截圖本身不能證明離線或快取來源，這部分以自動化狀態收據證明。重載後點本人使用既有遊戲點擊入口，不刪斷言、不直接賦予完成狀態。

既有產物生成測試一律在本repo的`.audit-tmp/r6-regression`隔離副本跑，避免重寫歷史圖與他人檔案。完整runner初跑在第一輪內容回歸抓到連點穿透：視窗關閉後，第二下誤點地圖、取消送餐。已補350ms起手防護，取消鈕仍可立即用，並保留原斷言重跑全部六輪內容。先前已通過的16支世界／R79／RWD／控制／美術守門與後續6支內容守門分開記錄，沒有把初次runner退出碼1改寫成0。`baseline.json`保留起點逐檔hash；`release-readback.json`核對未授權異動為零、最終runtime／測試／素材與受測副本相同。

效能依本輪明確指示不另追修；既有R79守門量測桌機／手機三跑p95中位數均為**16.7ms**，通過原18ms斷言。這是本機並發參考，未當作實體裝置或乾淨機況證明。

## 繁中文案mode 2

| 原句 | 原因 | 改成什麼 |
| --- | --- | --- |
| 農家麥餅2/1 | 持有與需求容易混淆 | 持有農家麥餅2份，本次需要1份；固定底列另顯示送出後剩餘。 |
| 記住口味・紅格書籤已夾好 | 三人同型收尾 | 蘿拉把茶杯留在陽光裡／班伯掛起魚竿，留下兩只盤子／圖圖替空椅子放了一朵花。 |
| 錯味直接再說酸野莓、熱餅、甜胡蘿蔔 | 直接公布答案，缺少人物反應 | 茶杯、冷手與分三份點心的情境回話，讓玩家再想一次。 |
| 這一竿X秒；按鈕同步變色 | 計時與按鈕提示代替觀察 | 移除即時秒數與學會後的按鈕變色；保留簡短下沉狀態，各魚的水面判斷時機不同。 |
| 等浮標下沉就提竿 | 與本輪三種咬法不符 | 筆記明寫等圓紋合攏、趁短水花、等尾流拉直。 |

## 未完成與風險

Apple4.3風險自評 **中**：第一眼仍是同類像素農場；居民的生活記憶、送到手上的作用幀、三種觀察咬法與共同收束讓玩法更具本作特色。這是開發判斷，不是Apple審核或Muse分數。

BLOCKED：實體手機／iPad觸控與裝置效能需要對應硬體；真人／親子試玩需要受試者；Muse≥8分需要獨立審查員重新看精選集。沒有假造這些結果。維持MIT、免費、離線，未加入廣告、付費、帳號、外連、第三方runtime SDK或線上玩法；只做本機commit，未push、部署、操作商店後台或對外發訊息。
