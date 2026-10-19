# 隱私與資料安全檢查

日期：2026-10-15。狀態：VERIFIED（原始碼、無頭路徑與本機歷史表單快照）；未連入商店後台。

## 實際資料流

| 行為／檔案 | 用途 | 是否離開裝置 |
|---|---|---|
| src/state.js 的 localStorage 存檔與備份 | 作物、材料、角色、任務、餐籃、手記選擇、設定與離線時間 | 遊戲不自動上傳 |
| src/ui.js 的存檔匯入／匯出 | 使用者自行備份文字代碼 | 沒有傳送 API；使用者另行分享不在遊戲控制範圍 |
| src/atlas.js fetch、載入圖片、音訊與 JS/CSS | 取得同站遊戲靜態檔案 | 網頁版本首次需下載；快取後可離線；沒有遠端分析事件 |
| sw.js fetch 與 CacheStorage | 同源網頁／資產快取、離線重開 | 連線時會向當前網站取檔，斷網時讀本機快取 |
| index.html 的 canonical／OG URL | 網頁分享與索引中繼資料 | 不是遊戲主動上傳端點；分享平台讀取由該平台決定 |
| 設定內三個頁內連結 | 查看本機存檔、資料用途、離線說明 | 只改同頁片段；原本跨遊戲外連已移除 |
| native-kit App／Preferences 外掛 | 宿主生命週期及本機設定 | 原始碼未見追蹤或廣告 SDK；不等同簽章成品逐 SDK 稽核 |

沒有登入、廣告、真錢購買、評分請求、定位、相機、麥克風、通訊錄或推播功能。新手記不用姓名、Email 或裝置 ID。網路觀察只涵蓋自動審查路徑；[review-results.json](../evidence/r81-store/review-results.json) 列出實際請求，均為測試同源，沒有 HTTP 錯誤或第三方請求。

網頁部署站的伺服器存取日誌不在本 repo 控制範圍；下載靜態資源會有一般 HTTP 連線資訊，不能據此宣稱主機商不留 IP 紀錄。原生打包預期從包內讀檔，還需對新版簽章包做斷網實機與封包驗證。

## iOS 與 Android 唯讀檢查

檢查根目錄：`../game-store-publisher/native-kit/`，未修改。精確 SHA-256：[shared-assets-audit.json](shared-assets-audit.json)。

- iOS `apps/pixel-idle-farm-skill/ios/App/App/PrivacyInfo.xcprivacy` 存在：`NSPrivacyTracking=false`，`NSPrivacyCollectedDataTypes=[]`，UserDefaults 理由為 `CA92.1`。與已檢查的本機存檔／不追蹤設計一致；沒有杜撰新增收集類型。
- native-kit 的 runtime dependencies 為 Capacitor core/android/ios、App、Preferences。沒有在這份清單看到分析或廣告套件；Playwright 是本 repo 的測試開發依賴，不是遊戲 runtime SDK。
- Android 本作來源 `AndroidManifest.xml` 沒有 uses-permission；既有 release 合併 manifest 只有本 App 的 signature 級 `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`，沒有 `INTERNET` 或敏感感測器權限，`allowBackup=false`。這是舊 release 中繼資料，不是本輪新 AAB 驗證。
- 自家 `native-host.js` 與八款其他網頁 App 完全相同，含背景通知與 Android 返回處理，已在共用稽核揭露。宿主主要關閉原生 `<dialog>`，農場使用 `.modal.show`，Android 硬體返回的實機路徑仍需打包線覆核。
- 本作 native-kit `public/index.html` **沒有 R81 版本**，原生顯示名稱也仍是舊長名稱。本輪僅改本 repo，不能宣稱新玩法或新名稱已進入既有 IPA／AAB。

## Google 資料安全宣告比對

唯讀參考本機 `../game-store-publisher/output/google-farm-data-safety-saved-current-ax.txt`。這是先前官方頁面儲存的文字快照，**不是本輪線上讀回**。快照顯示「聲明不會收集資料」「不會與第三方分享資料」，與本輪觀察到的遊戲資料流一致；快照也顯示已儲存變更，不能推論目前線上發布狀態。

快照中的隱私政策 URL 為 `https://mars-tw.github.io/taiwan-train-math/games/pixel-idle-farm-skill/privacy.html`。對應本機 `output/store-pages-reviewed/pixel-idle-farm-skill/privacy.html`（2026-10-07）說明本機進度、不自動上傳、無帳號／分析／廣告／真錢購買及主動客服資料。新手記選擇仍屬本機遊戲紀錄，建議由商店線在下次政策修訂列明；本輪沒有改網站或政策。

快照另有「已承諾遵守 Play 家庭政策」。本輪工作單把本作列為一般休閒農場，無法由 repo 確認實際 Play 目標年齡與家庭設定。**BLOCKED：由帳號擁有人核對實際目標族群與家庭宣告**，不可自行視為兒童分類或替後台改選。遊戲 runtime 已移除跨遊戲外連，沒有購買或評分請求；本輪未新增第三方 SDK。

依 [Google 官方資料安全說明](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)，需連同實際分發版本與 SDK 行為確認。可準備的答案是「遊戲不自動收集／分享使用者資料；不建帳號；本機進度與使用者自行匯出」。沒有登入後台、送出表單，或把歷史快照標成當前表單驗證。

## 缺件

BLOCKED：新版 IPA／AAB、原生 privacy report／最終 SDK 與 Required Reason API 整包檢查、Safari／iOS／Android 實機斷網與背景／返回驗證、實際已發布 App Privacy／Data safety 表單讀回、目前公開隱私政策可用性與目標年齡設定確認。以上屬打包／商店線，受本輪唯讀與不操作商店限制，沒有變更。
