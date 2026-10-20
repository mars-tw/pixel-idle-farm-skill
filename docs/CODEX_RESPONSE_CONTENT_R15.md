# 陽光農場｜新內容第15輪

VERIFIED：既有三項內容修正、38條適用驗證指令、原尺寸精選、商店圖與舊證據清理完成。版本 `0.1.38`／`content-r15-20261019-1`，僅本機 `main`。工單日期 2026-10-18，執行日期 2026-10-19。最終讀回見 [release-checks.json](content/r15/release-checks.json)；實機、真人與獨立 Muse 複審另列 BLOCKED。

## 三項內容、玩法與入口

1. **餐籃送到以後**：從「故事 → 鄰居餐籃」選人、搭配口味，沿地面路徑親手送達。步數改讀角色畫面上正在經過的格子，避免物理格已先更新、人物還在前一格時顯示太少；每個路徑點都可走，取消、抵達後移除。米莉走路與交籃固定草帽、紅辮、奶油襯衫、綠吊帶褲，交接加上「親手交籃・近景」框，不把放大的角色直接貼進世界。接觸才扣料，取消全數保留。
2. **池塘的三種脾氣**：從地圖「河畔釣台」看水紋再提竿。釣線每個畫面更新都重新接到浮標的實際不透明頂點。河鯉使用中空閉合環，銀鯽保留短直水花，溪鱸保留側流；小魚影移到浮標下方，三種輪廓都可見。實釣、重播與練習共用現行細緻水面背景。進「河畔筆記」，選已釣到的魚，再按「遮字練習，只看水面」，先不顯示魚名或提示，結束才揭曉；不耗料、不增魚、不增筆記。
3. **鄰居的口味記憶**：記住三人口味、備好三籃後，從「聚餐桌」選人、選點心、看他接住。移除大型選人占位按鈕；合味卡寫姓名與點心，仍須自己點選，其他口味由「換一種味道」進入，也可查記過的口味。錯味留在中央分食，目標仍等待；補備有實際扣料。端盤加淡亮盤緣與抬起陰影，路徑避開中央共享盤。三人都收到後，同一位置按「收進手記」，收錄後顯示「已收進手記」，重開不再扣料；「重讀回話」另有入口。

採用 imagegen、遊戲引擎、Playwright 與繁中文案技能。沒有派工、推送、部署、商店後台操作或發訊。MIT、免費、無廣告、無內購、離線、無帳號與第三方 runtime SDK。

## R14 Muse 唯一五項驗收

|項目|實作與原尺寸證據|
|---|---|
|1．屋後仍能定位|屋頂與露台保持不透明，另外描繪當前真姿勢的柔和角色輪廓與腳底標記，不再只露一團紅色。小屋：[前](content/r15/phone-basket-farmhouse-front.png)／[後](content/r15/phone-basket-farmhouse-behind.png)／[離開](content/r15/phone-basket-farmhouse-leave.png)；攤位：[前](content/r15/phone-basket-shop-front.png)／[後](content/r15/phone-basket-shop-behind.png)／[離開](content/r15/phone-basket-shop-leave.png)；穀倉：[前](content/r15/phone-basket-barn-front.png)／[後](content/r15/phone-basket-barn-behind.png)／[離開](content/r15/phone-basket-barn-leave.png)。[送籃途中屋後](content/r15/phone-basket-house-delivery-behind.png)／[取消保料](content/r15/phone-basket-house-delivery-cancelled.png)。|
|2．選人 → 選味|三人的姓名、口味、點心與換味入口：[蘿拉](content/r15/phone-memory-merchant-select.png)、[班伯](content/r15/phone-memory-elder-select.png)、[圖圖](content/r15/phone-memory-child-select.png)。[選人](content/r15/phone-memory-person.png)、[換味展開](content/r15/phone-memory-other-taste.png)、[真正錯味回饋](content/r15/phone-memory-wrong.png)、[付料補備](content/r15/phone-memory-refill.png)。|
|3．移動盤子可辨|蘿拉：[端起](content/r15/phone-memory-merchant-lift.png)／[中段](content/r15/phone-memory-merchant-mid.png)／[接住](content/r15/phone-memory-merchant-received.png)；班伯：[端起](content/r15/phone-memory-elder-lift.png)／[中段](content/r15/phone-memory-elder-mid.png)／[接住](content/r15/phone-memory-elder-received.png)；圖圖：[端起](content/r15/phone-memory-child-lift.png)／[中段](content/r15/phone-memory-child-mid.png)／[接住](content/r15/phone-memory-child-received.png)。途中不結算，接住才增加一份，四人腳底與座位固定。|
|4．距離與路徑相符|三人均有 `phone-basket-<merchant／elder／child>-far.png`、`-walking.png`、`-near.png`、`-approach.png`、`-contact.png`、`-received.png`。數字計算走到相鄰交籃站位的可走格；地面路徑點逐格對應。另以獨立曼哈頓距離斷言，兩人相隔三格以上時，路徑不得少於兩格。出畫面時才用方向箭頭；同框補圖 `phone-basket-<id>-same-frame.png`。精選用同一位蘿拉的 [2格](content/r15/phone-basket-merchant-distance-2.png)→[1格](content/r15/phone-basket-merchant-distance-1.png) 原圖，避免檔名「遠／近」與實際距離順序相反。|
|5．隱藏說明練習|三魚各三張：`phone-pond-<river_carp／silver_dace／river_perch>-practice-pre.png`、`-practice-active.png`、`-practice-missed.png`，共九張；結束揭曉 `-practice-reveal.png`。三種水形與方向不同，練習前後魚簍、累計、頁數及材料逐值相同。|

遮字九張原圖：河鯉 [前兆](content/r15/phone-pond-river_carp-practice-pre.png)／[作用](content/r15/phone-pond-river_carp-practice-active.png)／[錯過](content/r15/phone-pond-river_carp-practice-missed.png)；銀鯽 [前兆](content/r15/phone-pond-silver_dace-practice-pre.png)／[作用](content/r15/phone-pond-silver_dace-practice-active.png)／[錯過](content/r15/phone-pond-silver_dace-practice-missed.png)；溪鱸 [前兆](content/r15/phone-pond-river_perch-practice-pre.png)／[作用](content/r15/phone-pond-river_perch-practice-active.png)／[錯過](content/r15/phone-pond-river_perch-practice-missed.png)。

## 指定修正、GPT 扣分與補證

- **距離與造型**：三人遠、中、近逐格驗證；交接使用同一套米莉服裝、髮型與色盤，並明確標示近景。三格不是整張圖片晃動，手臂姿勢不同，腳底固定。
- **釣線與水紋**：每種魚各有 `phone-pond-<id>-early-regression.png`、`-active-regression.png`、`-late-regression.png`、`-replay-regression.png`，共十二張，逐次量測線端到浮標頂點 ≤3px。三種實釣仍只有準時成功才加魚；新存檔 1→2→3 尾與 1→2→3 頁由本輪完整旅程取得。
- **畫面複查修正**：重播原先仍套用舊粗水面，且小魚影被浮標擋住；現已與實釣共用 `quiet-water.webp`，魚影下移十二個原生像素。尺寸、魚形、物理與結算規則不變；水面逐 byte 驗證同步更新期望位置，維持零容差。這兩處及狀態用詞的精確修改、重跑收據均列在 `runtime-delta.json`。
- **主動選擇與收尾**：合味卡不自動選取，換味後仍須確認送給誰。收尾按鈕固定為收錄、重讀回話、回農場；收錄完成後第一個按鈕顯示已收錄並停用。[收錄前](content/r15/phone-memory-complete-before-record.png)、[收錄後](content/r15/phone-memory-recorded.png)、[重載](content/r15/phone-memory-recorded-reloaded.png)。
- **狀態用詞一致**：人物按鈕與狀態列都統一為「等待／已吃到」，與主進度一致；不再混用「已端」。這兩處文字的修改與第6、7輪重跑收據記在 `runtime-delta.json`。
- **承接玩家做過的事**：三人保留不同回話；曾錯味分食時會提到桌中央那盤，與全程合味的流程不同，重載手記仍保留。[共享手記](content/r15/phone-memory-journal-shared.png)與全程合味 `phone-memory-order-a-journal.png` 可對照。圖圖回話刪去重述完整品項，文件名稱統一以 runtime 的「圖圖」為準。
- **窄手機與觸控**：320、390、430、844×390、1032×1376、1366×600 實際選味、展開換味與端送；主要操作與關閉按鈕在畫面內，命中區 ≥44px，手機不顯示鍵盤提示。這是無頭模擬視口，沒有冒充實體手機。

## 精選、美術、商店與舊檔

精選 `content/r15/review-set/` 固定十五張，三項各五張，原尺寸 430×932，逐 bytes 複製、不裁切、不拼接、不縮圖；來源、尺寸與 SHA-256 在 `review-set-manifest.json`。包含屋後送籃、實際路徑、兩格交籃、三種水形、遮字三階段、選味、錯味與端盤三格。十五張容量不足以放入所有人的全部連拍，完整逐項序列都在本輪根目錄，未冒稱全部已在精選中。`before/` 保留必要的第14輪原圖，僅供本輪回歸比較。

精選以 `review-set-manifest.json` 為最後清單。完整旅程與補證若重拍同名畫面，先封存原始 bytes 至 `journey-frames/`，對應在 `journey-frame-archives.json`；最後讀回已驗證完整旅程每一筆截圖雜湊都能找到原圖。回歸新產出的商店畫面封存於 `regression-outputs/docs/store/screenshots/`，原有44張商店圖全部還原原 bytes。

新增美術為 **2 張生成原圖、4 張遊戲用圖**：捧籃、伸手、收手與閉合水環。實際工具 `image_gen.imagegen`，模型識別未提供，manifest 記 `null`。提示詞、來源、處理及雜湊見 `art/PROMPTS_CONTENT_R15.json`、`assets/generated/content-r15/manifest.json`。米莉三格統一 R89 原生色盤與腳底，沒有拿蹲下採集冒充遞籃。沿用第八輪無縫地面與暖光。

新增商店圖 `store/screenshots/iphone-20-hand-served-r15.png`（1290×2796）、`ipad-20-hand-served-r15.png`（2064×2752），取自真實端盤中段。既有商店圖保留。

舊證據已刪 **1,826 檔、662,940,682 bytes（約632.23 MiB）**；保留 **2,402 檔**有歷史驗證器消費的舊圖，逐檔原因在 `cleanup-plan.json`。不刪原有未追蹤檔、Markdown 評審與報告、商店圖或測試輸入。清理後重跑回歸；測試重新生成的舊輪輸出另做收尾清理，保護起點未提交檔並讀回雜湊。

## 驗證狀態

VERIFIED：38條適用驗證指令全綠，含 `npm test`、CI browser gates、R79實玩、R10～R14實玩、第14輪畫面守門、首次快取離線、用水／夜間回歸、本輪完整旅程、逐項補證與效能。142份JS語法通過；秘密掃描零命中；起點334份保護檔（含先建立的計畫）與44張原有商店圖逐 bytes 不變。完整命令、exit code及log雜湊在 [regression-reconciled.json](content/r15/regression-reconciled.json)，總讀回在 [release-checks.json](content/r15/release-checks.json)。

沒有宣稱首遍一次全過。第4輪的舊提示句斷言已改驗證精確中性文字及說明預設收起；第12輪有一次擷取跨入回話階段，保留原斷言重跑通過。失敗原始收據與觸發畫面在 `failed-receipts/`。完整回歸期間及後續讀圖校正的精確差異僅為兩個狀態詞、魚影繪製Y座標與重播背景；`runtime-delta.json` 逐 bytes 驗證差異範圍。受影響的原生像素、介面、離線與效能共10條指令在最終檔案上重跑通過，沒有把先前版本的測試冒稱為同一份hash。

效能為池塘／端盤 × 桌機／手機 × 三跑，共12跑。p95三跑中位數：池塘桌機16.7ms、手機16.7ms；端盤桌機16.7ms、手機16.8ms，均≤18ms。原始rAF樣本在 `performance-reference.json`。這是並發主機參考量測，不代表乾淨機或實體裝置過關。

既有斷言未刪除或放寬。配合介面修正，等待選人占位按鈕改為等待 DOM 掛載；收尾斷言改驗證「已收進手記」、停用及存檔旗標，強度增加。原生水面驗證保留逐 RGBA byte 零容差，僅更新新閉合環來源與合法渲染參數；舊屋頂淡化預期改為驗證完整不透明屋頂與獨立角色定位層。

繁中文案 mode 2 直接套用：大型「先選一位鄰居」改為一行選人提示；重述點心全名的圖圖回話改為回憶上次餐籃；數種收尾說法統一為「收進手記／已收進手記」。原因是減少重複說明，保留玩家目前要做的事。

|原句|原因|改成什麼|
|---|---|---|
|先選一位鄰居（大型停用按鈕）|占住主要動作位置，卻不能按|選一位鄰居，再選一份點心。（一行提示）|
|甜味胡蘿蔔點心！你記得我的甜味餐籃，花椅旁也留一份給朋友。|重述品項，回話像任務說明|你還記得上回的甜味餐籃！花椅旁這一份，留給晚到的朋友。|
|繼續，收好這個下午／收進手記|同一收尾有不同說法|收進手記；完成後為已收進手記。|
|已端／已吃到|同一完成狀態混用詞彙|等待／已吃到。|
|看寬圈如何聚攏，再看浮標。等三種預設提示|尚未打開說明就先指出答案|看水面，再決定什麼時候提竿。詳細線索由玩家主動展開。|

## 未完成與風險

**Apple 4.3 風險：中。** 親手交籃、看水紋、按記憶共餐有本作的因果鏈，像素農場題材仍常見；本輪沒有 Apple 審核結果，不保證過審。

BLOCKED：Muse ≥8 需獨立複審；實體 iPhone／iPad 與飛航觸控需設備；真人／親子試玩、30秒理解與遮字辨魚需受測者；乾淨機效能需獨立測試時段。並發主機量測僅供參考，不替代上述項目。
