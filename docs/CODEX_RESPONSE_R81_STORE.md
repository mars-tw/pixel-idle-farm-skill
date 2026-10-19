# R81 上架可能性優化驗收

版本：package `0.1.15`／runtime `r81-20261015-1`。起點：`3172b8c`。範圍：陽光農場 repo；只做本機變更，未 push、部署、打包、操作商店或派工。計畫：[OPTIM_PLAN_R81.md](OPTIM_PLAN_R81.md)。

## 上架風險評估

**Apple 4.3：高。** 光斑已連成玩家能立即操作與讀到結果的餐籃故事，但放置農場仍是飽和類型；兩則分歧便箋與紙箋介面不足以證明重大市場差異。共用 native-kit 不只標準 Capacitor，還有八款使用相同自家 native-host。專用手記插畫、持籃動作、真人 beta 與權利／提交者身分證據仍缺。沒有把修 bug、換名字或自動測試當成 4.3／4.2.6 已解決的證據。

[逐款差異](store/DIFFERENTIATION.md) 包含工作單全部同帳號作品與 R80 基準，並以官方 Hay Day／Stardew Valley 介紹區分「類型常見內容」與本作實際組合。[共用稽核](store/SHARED_ASSETS_AUDIT.md) 揭露比對範圍、系統字型、開發架構與原生包裝共用，不從零相同雜湊推論完全原創。

## 三項最大改進

1. **第一份陽光餐籃**：新玩家開場直接選擇。用真實光斑照料小麥、收成入庫後留兩份，走到葛瑞身邊，在作用幀才交付。選「留在門邊」或「一起坐下」，得到不同祖母便箋與 NPC 回應；手記永久保留，不能重領。舊存檔可從日誌開始；每日農務與 3／7 枚印章收藏保留。
2. **重開與第一下點按**：首次離線快取的自動重載暴露中途走路存檔會留下沒有計時器的 walk 狀態。遷移現在在最後抵達的物理格回復 idle，清掉失效動作／路徑，保留真正進度。另修正啟動後日誌在第一個 tick 前點按無效；增加 pagehide 存檔。
3. **作品識別與審查證據**：改為「籃底的手記」、麥黃任務卡與便箋呈現；移除開源世界／玩家共創等不符實際功能的標語，以及跨遊戲系列導流。設定改為同頁資料說明。完成商店繁中文案、英文審查備註、隱私比對與指定尺寸真實截圖。

## 驗證與證據

最終狀態：**VERIFIED（本機範圍）**。`npm test`、`npm run test:e2e`、水務引導與夜間閘均 exit 0；新增 17 項規則、91 項審查路徑檢查。iPhone 冷啟動至手記 16,882ms，iPad 16,700ms。這是自動操作路徑耗時，不是玩家平均時間或出貨效能分數。統計以 [verification.json](evidence/r81-store/verification.json) 為準；審查路徑以 [review-results.json](evidence/r81-store/review-results.json) 為準。

| 工作 | 狀態 | 驗證方式與證據 |
|---|---|---|
| 餐籃規則與遷移 | VERIFIED | [17 項規則測試](../scripts/test-r81-heirloom.js)：缺料、普通／陽光作物區分、滿倉零入庫、兩種手記、消耗恰兩份、防重領、換日／回撥、存檔、重開中途動作 |
| 冷啟動至第一目標 | VERIFIED | [真實 UI 路徑](../scripts/test-r81-review.js)：iPhone／iPad 各自全新存檔，以真時間與真觸控種植、等光、照料、收成與交付；無成熟時間／庫存／收藏注入 |
| 離線與生命週期 | VERIFIED（瀏覽器範圍） | 真正關閉 Chromium process、相同持久化 profile 斷網重開；保留手記選擇、庫存與不可重領狀態；CDP frozen／active、reload 與設定阻擋移動／返回測試 |
| 版面與控制 | VERIFIED（Chromium 範圍） | R81 十視口：375×667、390×844、844×390、430×932、768×1024、1024×768、1032×1376、1376×1032、1366×600、1280×640；按鈕 ≥44px、中心命中、無頁面溢出；另有既有 RWD／控制閘 |
| 既有回歸 | VERIFIED | [npm-test.txt](evidence/r81-store/npm-test.txt)、[e2e.txt](evidence/r81-store/e2e.txt)、水務引導六個情境與四季夜間閘；舊主線 370、陽光 44、手機 62、RWD 96 項及控制可達 305 項全綠 |
| 素材與共用程式 | VERIFIED（靜態範圍） | 本作 332 個候選檔案對照 13 款資料夾，無完全相同 runtime 素材或長 CSS 規則；字型／開發結構／Capacitor／自家共用宿主另列，不以雜湊掩蓋共用 |
| 商店與隱私 | PREPARED／VERIFIED | [繁中草稿](store/METADATA_ZH_TW.md)、[英文審查備註](store/APP_REVIEW_NOTES_EN.md)、[隱私報告](store/PRIVACY_AUDIT.md)、[截圖清單](store/SCREENSHOTS.md)；只寫檔，沒有上傳 |

改前／改後：`docs/evidence/r81-store/before/`、`after/`。商店候選十張為 1290×2796 與 2064×2752 原尺寸畫面，SHA-256 見 [screenshots-manifest.json](store/screenshots-manifest.json)。圖片是無頭瀏覽器的真實遊戲畫面，不是 iOS 實機畫面或宣傳合成圖。每日農務截圖沒有冒充已集滿三／七天。

既有測試與斷言保留，沒有降低 44px、命中、零出界、modal 隔離、消耗或作用幀要求。原設定三個連結仍通過既有可達性測試，內容改為真正可操作的頁內資料導覽。R81 規則接入 npm test 與 CI；審查路徑接入既有 browser gate runner。

## 八大面向與美術缺件

- 美術、按鈕、選單：新增本作便箋／光斑任務介面，檢查小手機、矮桌面與 iPad 直橫；返回與兩種交付選項可達。
- 人物、地圖與角色外觀：保留既有農場、NPC、角色圖集與四季素材，跑原有 atlas／透明度／夜間品質閘，沒有冒稱完成新人物插畫。
- 技能與動作：沿用真逐幀走路、播種、澆水、收成、use 互動；交付使用既有六幀 use，430ms 作用幀才取庫存。物理位置與視覺幀保持分離。農場沒有戰鬥，不新增攻擊、hurt、death 假動畫。
- **BLOCKED：祖母手記專用插畫、持籃／遞籃／持竿真姿勢幀仍缺。** [素材合同](../assets/heirloom/manifest.json) 列出缺件、尺寸、方向、錨點、接入既有 atlas 的方式與兩個插畫空槽。空槽只顯示已完成的文字，沒有程序化方塊插畫或單圖晃動冒充完成。
- 內建 image_gen 可呼叫，但本次介面無法指定或事前核對 `gpt-image-2` slug；本輪沒有生成新 raster，manifest 的 actualModelSlug 為 null。這不是宣稱整個平台沒有該模型，也沒有改走憑證或外部派工。

## 尚未完成與限制

1. **BLOCKED：原生包與商店狀態。** native-kit 仍是舊版網頁快照與舊長名稱；本輪沒有產生 IPA／AAB。App Review Notes 必須等新版二進位與實機證據齊備才使用。程式 package 版本 bump 不等於原生商店版本已更新。
2. **BLOCKED：Safari／iOS／Android 實機。** Chromium frozen／active 和重開測試不等於手機切背景；Android 硬體返回與宿主對 `.modal.show` 的處理仍需原生線驗證。
3. **BLOCKED：真人 beta、權利與提交者資料。** 未招募測試者，未虛構回饋、留存或所有權證明；4.2.6 身分與是否代製由帳號擁有人補證。
4. **BLOCKED：當前線上隱私表單與政策。** iOS xcprivacy 與本機設計相符；Google 歷史官方頁面快照顯示不收集／不分享，另有家庭政策承諾，需核對實際年齡設定。沒有把歷史快照當本輪後台讀回。
5. **效能：並發載量測，僅供參考。** 既有光斑＋環境光測試仍跑三次 p95 中位數斷言，桌機與手機皆為 16.7ms（三跑中位，**並發載量測，僅供參考**）；原始資料見 [performance-reference.json](evidence/r81-store/performance-reference.json)。不能認定閒置機器的出貨效能閘已通過；待總稽核重測。

本輪使用狀態詞 PREPARED／EXECUTED／VERIFIED／BLOCKED 區分草稿、執行、實證與缺件。起始已修改的 R68 manifest 與既有未追蹤稽核／試玩檔不納入提交，沒有刪除。
