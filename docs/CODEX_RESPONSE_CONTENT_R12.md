# 陽光農場｜新內容第十二輪交付

VERIFIED：0.1.35／content-r12-20261019-1；只修既有三項內容，未加新玩法。Muse 八分複審尚未取得，不把本機驗證當成評分。

## 三項內容與正常入口

1. **餐籃送到以後**：故事頁→送鄰居餐籃→選人／口味→送出。仍真的走到本人面前，接觸才扣料；近景人物約 106×142px、唯一籃子 66×66px，三種接法保留，背景告示／物件不遮交接。取消保留原料。
2. **池塘的三種脾氣**：河畔釣台→看浮標→提竿→河畔筆記。水面換成生成的連續像素水花、扇形波紋、側向渦流；同魚前後共用同一原生剪影與尺寸。浮標 CSS 寬48px，半沉可見像素寬30px；移動後仍保留標身。筆記只顯示自己釣到的觀察。
3. **鄰居的口味記憶**：三人各收到合味餐籃→回話頁「約三位鄰居一起吃」→備三籃→赴約；之後可直接點農場餐桌。盤子經手邊、中途、居民前方，三張真上身姿勢、不同短句；錯味移中央共享，已端份數與已招待人數分開，可以補送正確口味，最後收進手記。四人、杯盤、腳底與座位維持連續，存檔全景／手記也依實際分食放盤。

## Muse 唯一五項驗收與原尺寸證據

全部手機圖均為430×932 PNG，無縮圖、裁切、拼貼。以下路徑均從repo根目錄起算。

| 驗收 | 已驗證結果 | 截圖 |
|---|---|---|
| 1．筆記不洩底 | 新存檔三格均僅剪影＋還沒觀察到；第一尾只開一格，重開仍一格 | `docs/content/r12/phone-pond-comparison.png`、`phone-pond-river_carp-note.png`、`phone-pond-river_carp-note-reloaded.png` |
| 2．真正水紋與三魚辨識 | 去除整排白方點；三魚作用水紋不同；前後剪影來源不變、尺寸差0％，半沉位移30px | `docs/content/r12/phone-pond-{river_carp,silver_dace,river_perch}-{pre-sink,sinking}.png`，大括號展開為六張實檔 |
| 3．放大交籃 | 三人均留接觸前、接觸中、接住；唯一同像素籃子依序右移，接住後只扣一次 | `docs/content/r12/phone-basket-{merchant,elder,child}-{approach,contact,received}.png`，九張實檔 |
| 4．錯味去向 | 共享盤有大家分食標示；錯配後已端1、已招待0／3；圖圖仍可選，補正後4份、3／3完成 | `docs/content/r12/phone-memory-wrong-child-reply.png`、`phone-memory-wrong-next.png`、`phone-memory-corrected-child-received.png`、`phone-memory-corrected-complete.png` |
| 5．盤子經過桌面 | 三位各有端起、中途、接住，橫向位置依序靠近本人，三段文案不同；四人腳底位移小於0.1px，完成三盤落在三人前方 | `docs/content/r12/phone-memory-{merchant,elder,child}-{lift,carry,received}.png`，九張實檔；`phone-memory-complete.png` |

指定七項問題逐一對應：端送瞬移與重複說明→第5項；溪鱸換魚影、浮標太小、白方點→第2項；筆記洩底→第1項；交籃不清→第3項；解說過多→等待只留一行、交接短句、線索收合按鈕、三格待填筆記。沒有修改魚群冷卻或作用窗長度。

### 原尺寸連拍路徑（全部430×932）

| 鄰居 | 交籃前 | 接觸中 | 接住 |
|---|---|---|---|
| 蘿拉 | [approach](content/r12/phone-basket-merchant-approach.png) | [contact](content/r12/phone-basket-merchant-contact.png) | [received](content/r12/phone-basket-merchant-received.png) |
| 班伯 | [approach](content/r12/phone-basket-elder-approach.png) | [contact](content/r12/phone-basket-elder-contact.png) | [received](content/r12/phone-basket-elder-received.png) |
| 圖圖 | [approach](content/r12/phone-basket-child-approach.png) | [contact](content/r12/phone-basket-child-contact.png) | [received](content/r12/phone-basket-child-received.png) |

| 鄰居 | 端起 | 移動中 | 接住 |
|---|---|---|---|
| 蘿拉 | [lift](content/r12/phone-memory-merchant-lift.png) | [carry](content/r12/phone-memory-merchant-carry.png) | [received](content/r12/phone-memory-merchant-received.png) |
| 班伯 | [lift](content/r12/phone-memory-elder-lift.png) | [carry](content/r12/phone-memory-elder-carry.png) | [received](content/r12/phone-memory-elder-received.png) |
| 圖圖 | [lift](content/r12/phone-memory-child-lift.png) | [carry](content/r12/phone-memory-child-carry.png) | [received](content/r12/phone-memory-child-received.png) |

| 魚 | 前兆 | 作用幀 | 早拉 | 晚拉 | 成功 | 重開筆記 |
|---|---|---|---|---|---|---|
| 河鯉 | [pre-sink](content/r12/phone-pond-river_carp-pre-sink.png) | [sinking](content/r12/phone-pond-river_carp-sinking.png) | [early-failure](content/r12/phone-pond-river_carp-early-failure.png) | [late-failure](content/r12/phone-pond-river_carp-late-failure.png) | [caught](content/r12/phone-pond-river_carp-caught.png) | [note-reloaded](content/r12/phone-pond-river_carp-note-reloaded.png) |
| 銀鯽 | [pre-sink](content/r12/phone-pond-silver_dace-pre-sink.png) | [sinking](content/r12/phone-pond-silver_dace-sinking.png) | [early-failure](content/r12/phone-pond-silver_dace-early-failure.png) | [late-failure](content/r12/phone-pond-silver_dace-late-failure.png) | [caught](content/r12/phone-pond-silver_dace-caught.png) | [note-reloaded](content/r12/phone-pond-silver_dace-note-reloaded.png) |
| 溪鱸 | [pre-sink](content/r12/phone-pond-river_perch-pre-sink.png) | [sinking](content/r12/phone-pond-river_perch-sinking.png) | [early-failure](content/r12/phone-pond-river_perch-early-failure.png) | [late-failure](content/r12/phone-pond-river_perch-late-failure.png) | [caught](content/r12/phone-pond-river_perch-caught.png) | [note-reloaded](content/r12/phone-pond-river_perch-note-reloaded.png) |

## 第十輪回歸與未見證據補圖

- 四人完整入座、無空椅遮臉、常駐杯盤、獨立回話：三組端送四態及 `phone-memory-merchant-reply.png`。這四人是米莉、蘿拉、班伯、圖圖；未宣稱村長參加。
- 沒有預選、完成入口與逐人已端標示：`phone-memory-next-1.png`、`phone-memory-next-2.png`、`phone-memory-complete.png`；精選14／15也有對應狀態。
- 真行走三格、取消材料前後：`phone-basket-{merchant,elder,child}-walking-{1,2,3}.png`、`phone-basket-cancel-before.png`、`phone-basket-cancel-after.png`、`phone-basket-cancel.png`。
- 三魚早拉、晚拉、成功全彩：`phone-pond-{river_carp,silver_dace,river_perch}-{early-failure,late-failure,caught}.png`。早晚均不給魚，已學會後仍保留原作用窗。
- 重載／離線／手記保存：`phone-gathering-daily-reloaded.png`、`phone-memory-journal-reloaded.png`、`phone-memory-complete-reloaded.png`、`phone-offline-{memory,gathering,pond}.png`。三種魚另各有 `phone-pond-<id>-note-reloaded.png`。
- 有框可展開的水面線索與分食紀錄，以及完整RWD補充圖，見根目錄 `phone-pond-help-open.png`、`phone-memory-history-open.png`、`layout-*.png`。

## 精選集與商店

`docs/content/r12/review-set/` 僅15張手機直式原尺寸圖，01–15排序，直接複製並比對SHA-256。交籃4張、池塘6張、聚餐5張，每項都有遊玩中畫面。包含交籃三格、溪鱸前後、三魚作用幀、筆記零／一頁、端送三格、錯味共享、無預選與四人完成，涵蓋本輪七項與第十輪回歸。15張不能容納三人各九格等全部補充序列；未把根目錄的完整連拍冒稱全在精選內。

池塘精選05–10來自同一段連續存檔，魚簍尾數依序為0→0→1→1→2→2，與捕獲、筆記解鎖及原圖hash綁定；沒有用別的fixture覆蓋當段照片。

商店新增 `docs/store/screenshots/iphone-17-shared-afternoon-r12.png`（1290×2796）及 `ipad-17-shared-afternoon-r12.png`（2064×2752），為實際遊玩回話階段的DPR3／DPR2擷取；舊商店圖全部保留。

美術實際工具 **image_gen.imagegen**，新增 **2張母圖／12張原生素材**（9張水紋、3張上身姿勢）。完整R89前綴、來源、裁切、色盤、hash見 `docs/art/PROMPTS_CONTENT_R12.json`、`assets/generated/content-r12/manifest.json`。工具未揭露模型slug，記null。18行腳底原生RGBA與既有坐姿逐bytes相同；未以整張角色平移晃動冒充肢體動畫。第八輪無縫地面與暖光保留。

## 測試與資料保護

VERIFIED：`npm test`、CI25支瀏覽器腳本（含指定 `test-r79-fun-e2e.js`）、R10／R11 E2E、水井／夜景守門，共30條命令成功，最終來源hash一致；收據 `docs/content/r12/regression-reconciled.json`。R12 UI實玩完成、錯配補正、存檔、離線、手機直橫及平板均通過；527筆實玩檢查與88筆動作補驗見 `browser-checks.json`、`animation-audit.json`。R12單元額外驗六種順序下錯味補正、拒絕重送不改紀錄、重載及來源。

觸控：選人與點心至少60px；其餘主要控制至少44px且可達；手機無鍵盤說明。320×568、430×932、844×390、768×1024、1032×1376、1366×600保留實拍。全部125份JS語法通過，秘密掃描零命中，沒有讀取秘密目錄。

共用並發主機：池塘／端送、桌機／手機各三跑，共12跑，各組p95中位數為 {"pond/1366x768": 16.8, "pond/390x844": 16.8, "serving/1366x768": 16.7, "serving/390x844": 16.7} ms，全部≤18ms。保留原始幀於 `performance-reference.json`；只當參考，未宣稱乾淨機或實機效能通過。

起點323份原有dirty／未追蹤檔逐bytes保留；保護快照另含本輪先建立的計畫與保護工具兩檔。回歸覆寫的歷史產物先歸檔再還原，見 `protected-readback.json`。舊測試未刪、斷言未放寬：交籃尺寸由精確40更新為精確66px；錯味落點仍精確比對；魚影與水紋RGBA仍零容差，參考改為同魚固定剪影＋實際生成水紋；盤子查詢限定可見聚餐，避免把存檔農場桌的盤子誤認第二份。舊三份API與其測試保留，修正版目前UI另用 `serveGatheringTaste`，並新增完整驗收測試。

失敗與續驗如實保留：第一次新單元把作用窗時間寫在窗口後，校正測試時間後通過；首次R12實玩抓到畫面／農場兩個盤子使未限定場景的locator嚴格失敗，改為聚餐場景查詢後接續同次實玩已賺得的存檔；盤子起點、浮標裁切經原尺寸檢視校正後重拍。各次log及失敗JSON保留，不冒稱一次全過。

繁中文案mode2：原「米莉端起…，送向…」兩態重複，改「米莉端起…」／「沿著桌面，推向…手邊」／「接到手邊，嚐了一口」；原錯味計入招待，改「這份大家分食，不算圖圖的那一份」與分開計數；原未捕獲先列全部線索，改「還沒觀察到」，釣到才解鎖。人名、口味、材料與承諾不變。

補驗腳本首次重載把fixture再寫回，因而抓到「筆記回到零頁」的測試設定錯誤；改成每個context只初始化一次後，三種魚皆實際驗證一頁筆記保存。原 `animation-audit-failed-1.json` 與兩次補驗log保留，沒有隱藏失敗。

完整回歸的第七輪守門仍寫死40px餐籃而逾時；依本輪拉近比例改為430寬精確66px、320寬精確60.625px，仍逐項要求同一來源、唯一籃子、完整落在接收者邊界、只扣一次材料。重跑後由 `regression-reconciled.json` 合併真實成功收據，原失敗log與原30條收據完整保留。

歷史產物首次還原因Git正規化CRLF而被起點hash守門擋下，見 `protection.log`。改由 `restore-content-r12-history.py` 逐檔比對HEAD／LF／CRLF，只有能重建成起點SHA-256的bytes才寫回；成功收據為 `protection-final.log`、`protected-readback.json`，原有未提交資料全部一致。

**Apple 4.3風險：中。** 依本機內容判斷，特色仍為材料→親手交籃→口味記憶→共同聚餐，以及水面觀察；沒有把本機自測當作Apple審核或跨陣容盲測。維持MIT、離線、免費、無廣告／內購／外連／第三方runtime SDK／帳號／線上功能。僅本機繁中commit，未push、部署、動商店後台、傳訊或派工。

**BLOCKED／未完成**：實體手機／iPad觸控與飛航需實際裝置；真人親子及遮字辨魚需受測者；乾淨機效能需獨立時段；Muse≥8需實際獨立複審。自動化與模擬視窗不代替以上驗證。
