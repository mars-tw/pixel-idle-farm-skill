# 陽光農場｜新內容第14輪

VERIFIED：六項指定修正、Muse五項的本機可做部分、無頭實玩、原尺寸精選、商店圖及舊證據清理完成。真人與實機項目另列BLOCKED；最終讀回見 `docs/content/r14/release-checks.json`。版本 `0.1.37`／`content-r14-20261019-1`，只在本機 main，未發布。

## 三項內容與入口

1. **餐籃送到以後**：從「故事 → 鄰居餐籃」選人、選口味，米莉照正常尋路親手送達。距離改讀同一套 BFS 路徑；遠處保留名字、口味與餐籃標記，出畫面才顯示方向箭頭。房子與露台只開同位置的局部遮擋窗，下半屋頂仍遮住屋後角色的腳；聚餐桌只留一行、依手機邊界收進來的標籤。
2. **池塘的三種脾氣**：從地圖「河畔釣台」觀察水紋、判斷提竿。魚影縮小淡化，以同一個原生像素畫布呈現；三魚作用幀各用既有的不同持竿姿勢，釣線接住竿尖與浮標，提示分別描述寬圈、短水花與側流。筆記分清「累計釣獲」「目前魚簍」「河畔筆記」，已送出的魚不會讓歷史筆記變得矛盾。
3. **鄰居的口味記憶**：記住三人的口味、備齊三籃後，從「聚餐桌」進入。先選人，再只顯示該人的合味點心；其他味道收在「換一種味道」。補備與上菜紀錄移到次頁。主畫面直接說還差誰，端盤經桌面中段再送到手邊，途中收起共享標籤，接住當下就有「繼續」；錯味、付料補備、個別回話與共享紀錄仍保留。

本輪只修既有三項內容。沿用 R89 無縫地面、暖光、色盤與受管真姿勢；**新增生成美術 0 張**，沒有用色塊或整張角色晃動冒充動作。沿用圖的原工具 `image_gen.imagegen` 與本輪零生成紀錄見 `docs/art/PROMPTS_CONTENT_R14.json`。

## Muse 唯一五項驗收

|項目|本機驗證與原尺寸截圖|狀態|
|---|---|---|
|1．屋簷、攤位、穀倉行走與距離|`docs/content/r14/phone-basket-route-farmhouse-1.png`、`-2.png`、`-3.png`；同資料夾 `phone-basket-route-shop-1.png`～`-3.png`、`phone-basket-route-barn-1.png`～`-3.png`。另有 `phone-basket-house-front.png`、`phone-basket-house-behind.png`。走路到實際可站立格，角色 collider 不進家具，腳底排序不改；三人距離比對實際 BFS。|VERIFIED|
|2．遠處同框與親手交籃|`docs/content/r14/phone-basket-merchant-far.png`、`phone-basket-elder-far.png`、`phone-basket-child-far.png`；三人各有 `phone-basket-<id>-walking-1.png`～`-walking-3.png`、`-approach.png`、`-contact.png`、`-received.png`。同框看得到對象、口味與主角手上的籃子。|VERIFIED|
|3．三種水形|`docs/content/r14/phone-pond-river_carp-active-final.png`、`phone-pond-silver_dace-active-final.png`、`phone-pond-river_perch-active-final.png`。寬環／短柱／側流、三種持竿肢體與釣線分開可見，魚影顯示寬約為持竿者身長的0.5～0.7倍。另有各魚 `-pre-sink.png`、`-early-failure.png`、`-late-failure.png` 與 `-replay-final.png`。|本機 VERIFIED；陌生人遮字分類 BLOCKED，需受測者|
|4．三人連續端盤|`docs/content/r14/phone-memory-merchant-lift.png`、`-mid.png`、`-received.png`；班伯 `phone-memory-elder-lift.png`／`-mid.png`／`-received.png`；圖圖 `phone-memory-child-lift.png`／`-mid.png`／`-received.png`。中點盤子可見，未先結算，四人腳底／座位固定；接觸才增加一筆。`phone-memory-skip-once.png`補略過一次結算。|VERIFIED|
|5．選人 → 選味 → 看他吃|`docs/content/r14/phone-memory-choose.png`、`phone-memory-wrong-simple.png`、`phone-memory-materials-secondary.png`、三人的 `phone-memory-<id>-reply.png`、`phone-memory-shared-complete-reloaded.png`、`phone-memory-journal-shared-reloaded.png`。補備與紀錄不搶主畫面，回話可重讀。|本機 VERIFIED；真人30秒理解測試 BLOCKED，需第一次玩的受測者|

## 六項指定修正與 R12／R13 回歸

- 房前／房後與同位置屋頂回歸見上表；房子、露台保持一致不透明度，只在同一世界座標局部遮擋，腳底不透過屋頂。
- 新存檔依序釣到三種魚，`docs/content/r14/phone-pond-count-1.png`、`phone-pond-count-2.png`、`phone-pond-count-3.png` 同時呈現魚簍／累計釣獲／筆記的 1→2→3。早提、錯過不加魚或筆記；重播不耗料、不增魚；重複釣獲只加魚、不重複筆記。舊存檔保留真實現存魚，累計數承接原有釣魚事件與筆記。
- 320／390／430 寬標籤：`docs/content/r14/phone-basket-label-320.png`、`phone-basket-label-390.png`、`phone-basket-label-430.png`。自動檢查文字盒在視口內、無舊雙重標籤與橫向截斷。
- 三魚前兆／作用／錯過、未知剪影／解鎖彩魚與原有離線預快取保留。釣線為畫面內 SVG 細線，非新增美術；角色確實切換既有三張肢體姿勢，沒有旋轉整張人物。
- 端盤中點從主角手邊先上桌，再往對方手邊；共享標籤在端送中隱藏，移動盤子層級高於標籤。接住畫面可按「繼續」，等待狀態統一為「等待」。
- `phone-basket-cancel-before.png`、`phone-basket-cancel-after.png`補取消保料；三人 `phone-memory-<id>-matched.png` 與各接籃幀補 1／3→2／3→3／3。未集滿餐桌、第一籃／錯味／合味、共享不算個人招待、付料補成四份／三人、三人不同回話、重載及離線均納入實玩。

## 精選、商店與清理

審查只看 `docs/content/r14/review-set/`：15 張原尺寸手機直式，三項各5張，包含屋後遮擋、320標籤、遠處同框、交籃兩格、三種水形／持竿、三尾／三頁、失敗、錯味去向、端盤三格與重載結尾。`review-set-manifest.json`記來源及SHA-256，逐bytes複製，沒有裁切、合成或縮放。所有補證原圖均在 `docs/content/r14/`。

端盤精選依序呈現端起、桌面中段、接住後的個別回話。兩張交籃近景取自本輪重新執行R13回歸所產生的R14畫面，來源、時點與原始檔hash見 `capture-promotions.json`；最早的R14擷取另留在 `initial-captures/`。動態截圖使用等待真實畫面更新後的原生PNG擷取；商店圖使用device尺度的DPR3／DPR2輸出，尺寸逐張驗證。

新增商店原圖 `docs/store/screenshots/iphone-19-shared-afternoon-r14.png`（1290×2796）及 `ipad-19-shared-afternoon-r14.png`（2064×2752），由真實聚餐回話用DPR3／DPR2擷取；舊商店圖全部保留。

清理已驗證為 **5,562 個舊證據媒體檔、2,325,711,672 bytes，約2.17 GiB**。保留各輪 Markdown、原有未追蹤檔、商店圖、測試／歷史release驗證器仍會讀的精選與來源圖；`cleanup-plan.json`逐檔列出刪除目標、hash及保留消費程式。第一遍測試抓到 `tools/process-r68-visuals.py` 的兩張參考輸入 `docs/evidence/R62_polish/overall-after.png`、`docs/evidence/R62_polish/palette-r62.png`，已原bytes恢復並加入明確例外；不改斷言來避開依賴。刪除後的回歸及最終不存在檢查已通過，結果見下節。

回歸重生的24張R80輸出已收進本輪 `regression-outputs/`，原刪除清單最後為0檔存在。歷史文字檔依Git checkout-filter還原Windows換行後，再比對保護快照的原始bytes；所有原有商店圖與未提交檔雜湊不變。

## 測試與證據邊界

VERIFIED：33條既有適用回歸指令全綠，含npm test（保留全部原單元測試並增加R14五組）、R79實玩、CI browser gates、R10～R13實玩、首次快取離線、用水引導與R72夜間。R14另完成主流程及最後補驗：三人各三連拍、三魚新存檔成功／失敗／重播、六種視口實際選味與端送、補備即時HUD、略過一次結算、重載與離線。秘密掃描零命中、JS語法及版本鏈通過；原有329份未提交／未追蹤檔逐bytes讀回，所有舊商店圖雜湊不變。

效能為池塘／端送×桌機／手機×三跑，共12跑；p95中位數ms：`{"pond/1366x768":16.8,"pond/390x844":16.7,"serving/1366x768":16.7,"serving/390x844":16.8}`，皆≤18ms。原始rAF樣本見 `performance-reference.json`。這是並發主機的參考量測，沒有宣稱乾淨機或實體裝置過關。

完整命令、exit code與log hash在 `regression-reconciled.json`。首遍失敗收據保留；需要保留的R62輸入已恢復，筆記尺寸與水面可視度修正後，受影響的R2～R5及初期通用閘門重新跑過。廣泛回歸的起跑hash沒有偽改：端盤路徑與HUD／筆記尺寸／魚影／竿尖的受限差異由 `serving-path-delta.json`、`hud-refresh-delta.json` 逐bytes銜接；最後R14補驗直接檢查修正後畫面與控制。不宣稱首遍一次全過，也不把各時點的所有指令冒稱為同一份hash。所有執行使用無頭 Chromium；同時只跑一個本線瀏覽器／server，結束即關。不開可見視窗，不透過任何服務派工。

既有測試沒有刪除或放寬：水面仍逐RGBA byte零容差與禁止平滑，只更新魚影合理比例；舊聚餐操作透過真實UI展開次要口味／補備頁；份數及人數精確斷言保留，另核對自然語句與data計數；快取測試維持精確版本斷言，改讀本輪版本。

繁中文案mode2直接套用4處，名稱與口味不變。

|原句|原因|改成什麼|
|---|---|---|
|約N步|曼哈頓距離沒有算繞路|同句改讀實際可行走格數|
|已端N份／已招待N位|主操作像管理表單|主畫面說還差誰，精確帳目留在紀錄|
|魚簍累計（單一魚種現存數）|和歷史筆記混用|累計釣獲／目前魚簍／河畔筆記各列真實數字|
|還沒招待／等待|同一狀態兩種說法|統一為等待|

## 未完成與風險

**Apple 4.3 風險：中（本機內容判斷）**。親手送籃、讀水面、記住口味再共餐仍是本作的因果鏈；像素農場題材常見，沒有 Apple 審核或跨作品真人辨識結果，不能保證過審。

BLOCKED：實體 iPhone／iPad 觸控及飛航測試需實機；陌生人遮字辨魚、第一次玩30秒理解及親子試玩需受測者；乾淨機效能需獨立測試時段；Muse≥8需獨立複審。以上未假造。維持MIT、免費、無廣告、無內購、離線、無帳號／線上／第三方runtime SDK；沒有push、部署、操作商店後台或發訊。

?????????????R8???????15?????????????bytes??????????R81?R88???????8??????????? `regression-outputs/docs/store/screenshots/`????????????????23??????????????????????????????? `regression-output-housekeeping.json`?
