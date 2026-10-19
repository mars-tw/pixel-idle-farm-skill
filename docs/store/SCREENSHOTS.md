# 真實遊戲截圖清單

R82 美術輪已重擷取下表十張，版本為 `r82-20261016-1`。本輪核對只涵蓋清單內十張；兩張早期 `earned-*` 輔助圖保留歷史用途，不列入 R82 商店提案。新圖為真實遊戲內插畫與 UI，不以宣傳合成畫冒充遊玩畫面。

狀態：VERIFIED；逐檔尺寸、SHA-256 與最終測試狀態另見 [screenshots-manifest.json](screenshots-manifest.json)。全部使用本機頁面與 headless Chromium，未開可見視窗，未製作宣傳合成圖。

iPhone：邏輯 430×932，deviceScaleFactor 3，實檔 **1290×2796**。
iPad 13 吋比例：邏輯 1032×1376，deviceScaleFactor 2，實檔 **2064×2752**。

| 畫面 | iPhone 檔名 | iPad 檔名 | 一句說明 |
|---|---|---|---|
| 新玩家開場 | iphone-01-welcome.png | ipad-01-welcome.png | 祖母留下一籃收穫，邀你先做第一份陽光餐籃。 |
| 實際光斑農田 | iphone-02-sunlight.png | ipad-02-sunlight.png | 在短暫落下的光裡種麥或澆水，作物多長一截。 |
| 備齊後選送法 | iphone-03-basket.png | ipad-03-basket.png | 真正收成後，從倉庫留兩份，選擇把餐籃送到門邊或一起坐下。 |
| 已取得手記 | iphone-04-note.png | ipad-04-note.png | iPhone 顯示「多擺一張椅子」，iPad 顯示「門邊那一籃」，各自走完真實交付路徑。 |
| 當日農務 | iphone-05-daily.png | ipad-05-daily.png | 三項農務與印章進度，依實際當天存檔顯示。 |

檔案位於 [screenshots/](screenshots/)。新玩家路徑不回填成熟時間、不加庫存、不注入農務或手記。iPhone 與 iPad 各自從全新存檔實際播種、等待光、收成與交付；每日農務畫面沒有假裝蓋章或完成七天。

早期補驗另外保留 `ipad-01-earned-farm.png`、`ipad-02-earned-note.png`：它們來自本輪真實取得的 iPhone 存檔轉入另一瀏覽器 context，用於同一存檔跨版面觀察，**不是 iPad 獨立進度證據**。上表十張才是建議商店草稿組；原始輔助圖保留，沒有冒充不同裝置的新內容。

版面矩陣、改前／改後農場與便箋、離線重開、橫向旋轉截圖在 [../evidence/r81-store/](../evidence/r81-store/)。無頭 Chromium 畫面不等於 iOS Simulator 或真實 iOS 截圖；正式商店提交前仍需比對新版原生包。
