# 陽光農場｜新內容第十三輪交付

VERIFIED：0.1.36／content-r13-20261019-1，main，本機提交。只修原有三項內容，沒有新增任務、徽章、抽卡、線上或付費功能。Muse≥8尚未取得獨立複審，不以本機自測當評分。

## 三項做了什麼、怎麼玩、入口

1. **餐籃送到以後**：故事頁→送鄰居餐籃→選人、口味→送出。保留真行走、同一餐籃、接觸扣料與取消保料；上緣新增已記住1／3至3／3，集滿時提示聚餐。右側河道改為同色盤、帶不規則草岸的生成長圖，碰撞與橋梁不變。未備齊三籃仍進準備頁；未記住三人時餐桌只說缺哪幾位。
2. **池塘的三種脾氣**：河畔釣台→觀察→提竿→河畔筆記。三魚改為彩魚同alpha輪廓，水面魚影不換種；河鯉橫向濁水環、銀鯽窄直水柱、溪鱸側尾流，紅標仍露出。觀察圖內有米莉坐在釣台持竿的三張肢體姿勢。解鎖格為彩魚，未解鎖只留剪影；學到後可點「重看水紋」，不投餌、不給魚。
3. **鄰居的口味記憶**：三人各收到合味餐籃→回話頁「約三位鄰居一起吃」→備三籃→赴約，之後可點農場餐桌。端送時紙頁依內容縮短，字幕旁有招待狀態與可用略過鈕；盤子連續經桌面、收到才記一份。未招待者保持等待，合味收到才吃。錯味用掉實體份數，剩0鎖住；「再備一份」明列並扣麥餅／配料，第四份有來源。紀錄改「今天的上菜紀錄」，共享與個別招待分開，補備來源、人物回話均保存。

## 唯一驗收：R12 Muse原「下一輪最該做的5件事」

以下手機截圖皆為430×932原尺寸PNG；未重複寫資料夾的檔名一律位於`docs/content/r13/`，`<id>`為`river_carp`、`silver_dace`、`river_perch`。沒有裁切、縮圖或拼貼。

|Muse原項目|VERIFIED結果|原尺寸證據|
|---|---|---|
|1．拉開河鯉／銀鯽水面差異|寬橫環、窄直柱、側尾流分開；三種作用幀都保留紅標|`phone-pond-river_carp-sinking-final.png`、`phone-pond-silver_dace-sinking-final.png`、`phone-pond-river_perch-sinking-final.png`|
|2．已學水紋可重播|新存檔三格無名、無重播；第一次只開該魚，其餘未知；重播不加魚|`phone-pond-river_carp-locked.png`、`phone-pond-river_carp-unlocked.png`、`phone-pond-river_carp-note-replay-final.png`；三魚皆有同名序列，`phone-pond-learned-three-replay.png`另呈現實際三魚全解鎖|
|3．走近可辨、取消保料|三人從遠處走到兩人同時入鏡，保留一只主角持籃；真幀與實際距離縮短均檢查|`phone-basket-<resident>-walking-2.png`、`-walking-3.png`；`phone-basket-cancel-before.png`、`phone-basket-cancel.png`、`phone-basket-cancel-after.png`|
|4．盤子連續滑動中段|班伯／圖圖在第二段CSS滑動途中另留一格，未提前結算；接住才抬手，四人根節點不動|`phone-memory-elder-mid-slide.png`、`phone-memory-elder-received-final.png`、`phone-memory-corrected-child-mid-slide.png`、`phone-memory-corrected-child-received-final.png`，配合各人的lift／carry／received三格|
|5．交籃預告記憶進度|實際六次送籃逐人學會1／3→2／3→3／3；未滿時桌子只列缺人，集滿提示聚餐|`phone-basket-memory-progress-1.png`、`phone-basket-memory-progress-2.png`、`phone-basket-memory-progress-3.png`、`phone-basket-table-missing-neighbors.png`|

## 本線路另列的畫面、帳目問題與評分修正

以下對照使用者逐列問題及R12 Claude／GPT評分，與上方Muse唯一五項分開列示。

|項目|VERIFIED結果|原尺寸截圖路徑|
|---|---|---|
|1．收合聚餐空白|三位端起／運送／接住均實測字幕到底列距離≤60px；演出中有「略過這次端送」|`docs/content/r13/phone-memory-merchant-lift.png`、`phone-memory-merchant-carry.png`、`phone-memory-merchant-received.png`；班伯、圖圖同名序列|
|2．姿勢對應招待|錯味後三人均等待；補正後只有已接收者為吃的姿勢，計數0／3→1／3→3／3|`docs/content/r13/phone-memory-wrong-next.png`、`phone-memory-corrected-child-received.png`、`phone-memory-corrected-complete.png`|
|3．同魚剪影／彩圖／插圖|三魚的灰影直接沿用彩魚alpha，外框誤差0％；彩魚格、小圖與重播魚影一致，無舊殘線|`docs/content/r13/phone-pond-river_carp-locked.png`、`phone-pond-river_carp-unlocked.png`；銀鯽、溪鱸各有`phone-pond-<id>-locked.png`／`-unlocked.png`，以及`-note-replay-final.png`|
|4．第四份有來源、標籤不混淆|錯味酸點剩0，補備顯示農家麥餅4→3、東林野莓5→4；之後4份／3人，紀錄記4次實際上菜|`docs/content/r13/phone-memory-wrong-next.png`、`phone-memory-refill-source.png`、`phone-memory-corrected-child-carry.png`、`phone-memory-corrected-child-received.png`、`phone-memory-corrected-complete.png`；無共享完成為`phone-memory-complete.png`|
|5．釣台與可辨魚影|三魚作用幀都能看到持竿米莉、魚尾與紅標；內部64px縮看仍可辨魚體，不拿縮圖充交付|`docs/content/r13/phone-pond-river_carp-sinking-final.png`、`phone-pond-silver_dace-sinking-final.png`、`phone-pond-river_perch-sinking-final.png`|

## 其他指定問題與前兩輪回歸

- 河道硬切：`phone-basket-merchant-walking-2.png`及三人的交籃圖可見新草岸，長圖延伸至畫面外；第八輪無縫地面與暖光仍保留。正常橋梁與水域碰撞未改。
- 三人走近、接觸、接住：`phone-basket-{merchant,elder,child}-walking-{1,2,3}.png`與各人的`-approach.png`、`-contact.png`、`-received.png`。補拍中段僅將MOVE_MS放慢至600ms，等待兩人同時入鏡與真實距離縮短，不改座標或進度。每位唯一同源66px交接籃子、接觸前不扣、接觸後只扣一次；班伯仍低提、圖圖仍抱籃。大括號為實檔展開，不是單一檔名。
- 取消前後：`phone-basket-cancel-before.png`、`phone-basket-cancel.png`、`phone-basket-cancel-after.png`；原料及麥餅逐數一致。最終來源另從原料烤六份麥餅、實送三位各兩籃，逐步拍得`phone-basket-memory-progress-1.png`、`-2.png`、`-3.png`的1／3→2／3→3／3；未滿時餐桌列班伯／圖圖缺席，見`phone-basket-table-missing-neighbors.png`。其他追加交籃截圖是已賺得三人記憶後的再次送達，沒有把3／3冒稱第一次送出。
- R11／R12人物與道具連續：`phone-memory-{merchant,elder,child}-{lift,carry,received,reply}.png`。三段字幕各異、盤子途中落點連續、四人腳底／座位位移<0.1px，常駐茶杯保留，圖圖的盤子收回桌緣內。審查精選13→14為補正圖圖的運送→接住；完整班伯序列在根目錄。
- 三魚早／中／晚：`phone-pond-<id>-early-failure.png`、`-pre-sink.png`、`-sinking-final.png`、`-late-failure.png`、`-caught.png`。實際早晚不給魚；成功才加魚及一頁筆記；重載仍同頁。三種完整過程另存`videos/river_carp-early-active-late-success.webm`、`videos/silver_dace-early-active-late-success.webm`、`videos/river_perch-early-active-late-success.webm`。未解鎖無名、無重播；已解鎖重播不增加魚。
- 三位回話各自呼應酸味茶杯、熱餅與修魚竿、甜味與替朋友留花椅；不是只換人名。回話截圖`phone-memory-<resident>-reply.png`，重載紀錄`phone-memory-journal-reloaded.png`。錯配四份實際重載為`phone-memory-corrected-complete-reloaded.png`、`phone-memory-shared-journal-reloaded.png`、`phone-gathering-shared-table-reloaded.png`，各記錄一次共享、三次個別招待與一次補備材料。無錯配手記不寫共享事件。
- 略過只結算一次、離開頁面不留延遲扣料：`phone-memory-skip-received.png`與`final-evidence.json`、`animation-audit.json`。
- 離線與版面：`phone-offline-memory.png`、`phone-offline-gathering.png`、`phone-offline-pond.png`；`layout-*.png`涵蓋320×568、844×390、768×1024、1032×1376、1366×600。主要操作≥44px，選人／選點心≥60px；手機無鍵盤說明。

## 審查只看這15張

交籃6張、池塘5張、聚餐4張，原尺寸直接複製且SHA-256與來源相同。保留三位走近、班伯完整交接及右側河岸修正；聚餐4張涵蓋錯味等待、連續滑動、接住與重載完成，最後一張直接列出第四份的實際補備扣料。三項都有遊玩進行中及前兩輪回歸。15張無法同時容納三人各九格及所有釣魚分支；完整序列誠實列在上方，未冒稱全部在精選中。

|順序|內容|精選路徑|
|---|---|---|
|01|交籃|`docs/content/r13/review-set/01-phone-basket-merchant-walking-2.png`|
|02|交籃|`docs/content/r13/review-set/02-phone-basket-elder-walking-2.png`|
|03|交籃|`docs/content/r13/review-set/03-phone-basket-elder-contact.png`|
|04|交籃|`docs/content/r13/review-set/04-phone-basket-elder-received.png`|
|05|交籃|`docs/content/r13/review-set/05-phone-basket-child-walking-2.png`|
|06|交籃|`docs/content/r13/review-set/06-phone-basket-merchant-received.png`|
|07|池塘|`docs/content/r13/review-set/07-phone-pond-river_carp-locked.png`|
|08|池塘|`docs/content/r13/review-set/08-phone-pond-river_carp-sinking-final.png`|
|09|池塘|`docs/content/r13/review-set/09-phone-pond-silver_dace-sinking-final.png`|
|10|池塘|`docs/content/r13/review-set/10-phone-pond-river_perch-sinking-final.png`|
|11|池塘|`docs/content/r13/review-set/11-phone-pond-learned-three-replay.png`|
|12|口味記憶|`docs/content/r13/review-set/12-phone-memory-wrong-next-final.png`|
|13|口味記憶|`docs/content/r13/review-set/13-phone-memory-corrected-child-mid-slide.png`|
|14|口味記憶|`docs/content/r13/review-set/14-phone-memory-corrected-child-received-final.png`|
|15|口味記憶|`docs/content/r13/review-set/15-phone-memory-corrected-complete-reloaded.png`|

## 測試、素材、版本與資料保護

VERIFIED：`npm test`與CI25支瀏覽器腳本（含指定`test-r79-fun-e2e.js`），另含R10／R11／R12 E2E、水井與夜景守門，共31條命令有成功收據，逐條log／exit code見`docs/content/r13/regression-reconciled.json`。最後掃描另抓到新手圖／日誌頭像共3個舊快取URL，只替換版本字串並逐bytes比對；已再跑npm test、R80手機、R81商店流程及首次離線入口。影像複核也抓到漏改的河道14格邊界，修為地圖外緣20格後再跑npm test、R79實玩、339項控制、交籃邊界補圖與效能量測。`version-query-delta.json`、`river-grid-delta.json`證明這些字面差異以外的狀態、碰撞、操作與經濟程式皆未變；沒有宣稱31條全都在最後這幾個純視覺／快取字面修正後再次執行。

各收據記錄：主流程含補拍555筆檢查、動作補驗104筆、最後來源補圖42筆，有重複回歸項目，不相加為獨立案例數。主實玩確實從材料備餐、九次送籃賺記憶、釣魚、備三籃、錯味補備與合味完成。章節／釣台存取與原料、魚種RNG為明示fixture，匹配、捕獲、上菜與完成沒有直接授予。

原測試未刪除或放寬：R6仍精確核對溪鱸提示，改為本輪一致的「V形尾流向兩側展開」；R8非同步姿勢／固定腳底及R9三人各三種真姿勢、同尺寸／腳底斷言均保留，移到三人實際收到點心之後，另加未招待者必須等待；R12的4份／3位完成斷言保留，先加補備UI及每項材料精確扣除。R4／R5共用的水面驗證仍逐RGBA byte零差異、128×112原生且禁止平滑，只將參考來源與擺放改為本輪同魚體灰影及三種水形。舊三份API與歷史重播API未刪，本輪UI另用有實體帳目的`serveGatheringPortion`。

新增美術：實際工具`image_gen.imagegen`，**2張母圖／4張使用中的原生生成圖**（持竿3姿勢、草岸河道1張）；另9張衍生／沿用圖（3彩魚、3同alpha灰影、3逐bytes原坐姿）。三位等待用既有坐姿，維持人物同臉；不把來源拷貝算成新生成。R89完整前綴、色盤、真RGBA與來源hash見`docs/art/PROMPTS_CONTENT_R13.json`及`assets/generated/content-r13/manifest.json`；工具未揭露模型slug，記null。沒有整張人物晃動冒充肢體動畫。

商店新增`docs/store/screenshots/iphone-18-shared-afternoon-r13.png`（1290×2796）與`ipad-18-shared-afternoon-r13.png`（2064×2752），均為真實遊玩回話的DPR3／DPR2原尺寸擷取，所有舊圖保留；來源與hash見`docs/store/screenshots-content-r13-manifest.json`。

JS語法全綠、版本鏈一致、秘密掃描零命中。沒有讀取秘密目錄，也沒有寫入金鑰。保護快照逐bytes讀回326份原有dirty／未追蹤檔；本輪自行建立的計畫／保護工具另記在`scaffoldsCreatedThisRound`，沒有混算成他人原檔。回歸改寫的歷史產物先收進本輪`regression-outputs/`再還原，原始審查、商店圖及他人未提交檔不變。計畫與本報告已補正Muse唯一五項／Claude與GPT補充評分的來源歸屬，兩組驗收皆逐項附圖。現行圖像hash以`artifact-manifest.json`為準；原始主實玩收據的早期hash保留，後續實際補拍不偽改成第一次擷取。

效能：池塘／端送×桌機／手機×三跑，共12跑，p95中位數ms為`{"pond/1366x768": 16.8, "pond/390x844": 16.8, "serving/1366x768": 16.8, "serving/390x844": 16.7}`，皆≤18ms。原始rAF樣本在`performance-reference.json`。本機有其他線路並發，只作參考，未宣稱乾淨機或實體裝置過關。

失敗記錄保留：首次npm經PowerShell重新導向時，Pillow棄用警告被標成NativeCommandError；改由子程序保存真實exit code。首次回歸抓到R6仍斷言舊提示字串，依本輪統一時機語言改為同等精確新句後重跑；也抓到未開席的餐桌攔住班伯點擊，修正桌子圖層後停止本線路測試樹、完整重跑，保留原中止收據與BLOCKED原因。R4／R5抓到參考仍是舊剪影，改用本輪受管魚體與水形、保留零容差後重跑。單元初稿把銀鯽成功時間寫在前兆內，校正為實際作用窗2400ms後通過。所有回歸失敗log及原收據保留，不冒稱一次全過。

繁中文案mode2直接套用，4處摘要如下；名稱、口味與原有作用窗不變。

|原句|原因|改成什麼|
|---|---|---|
|翻開剛才分過的點心（N）|把全部上菜與中央共享混在一起|翻開今天的上菜紀錄（N）|
|酸味野莓|錯味後仍可直接選，缺少剩量與補備來源|同名選項加「剩0份」，另顯示「再備酸味野莓一份」與實際取用材料|
|魚影衝向一側，尾流散開了，現在提竿。|成功與錯過都用「散開」，時機語言含糊|魚影衝向一側，尾流展開了，現在提竿。|
|三位都接到了，把這個下午收進手記。|沒有回扣本次是否共享|依實際事件顯示「桌中央還留著大家分食的那份」或「今天三份都送到了本人手邊」|

## Apple4.3與未完成

**Apple4.3風險：中（本機內容判斷）**。已核對[Apple官方4.3](https://developer.apple.com/app-store/review/guidelines/#spam)：避免同一App多個Bundle ID，也要與既有大量同類App有可辨差異。本作仍以「材料→走到本人面前交籃→記住口味→共同聚餐」及讀水面為主，沒有改成其他陣容的通用任務框架；但像素農場仍是常見類型，沒有跨陣容實機盲測或Apple審核結果，不能評為保證低風險。

BLOCKED：實體iPhone／iPad觸控與飛航測試需實機；真人親子及遮字辨魚需受測者；乾淨機效能需獨立時段；Muse≥8需老闆安排獨立複審。以上未假造。維持MIT、免費、離線、無廣告／內購／帳號／線上／第三方runtime SDK／新增外連；未push、部署、動商店後台、傳訊或派工。
