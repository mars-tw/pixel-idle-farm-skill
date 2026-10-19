# 共用素材與框架稽核

狀態：VERIFIED（原始碼／素材靜態比對範圍）。其他 repo 與 native-kit 只讀；沒有檢查簽章二進位。並行線路的檔案可能在本次快照後改變。

本作候選檔案 332 個。完整 SHA-256、檔名與掃描範圍：[shared-assets-audit.json](shared-assets-audit.json)。

| 同帳號作品 | 比對候選檔案數 | 狀態 |
|---|---:|---|
| Crackveil Vanguard | 239 | VERIFIED: tracked candidate runtime/source/assets; not a signed-binary audit |
| 暴風啟示錄 | 79 | VERIFIED: tracked candidate runtime/source/assets; not a signed-binary audit |
| 灰燼護航 | 109 | VERIFIED: tracked candidate runtime/source/assets; not a signed-binary audit |
| 無盡塔防 | 188 | VERIFIED: tracked candidate runtime/source/assets; not a signed-binary audit |
| 裂潮卡牌 | 133 | VERIFIED: tracked candidate runtime/source/assets; not a signed-binary audit |
| 村莊攻防 | 262 | VERIFIED: tracked candidate runtime/source/assets; not a signed-binary audit |
| 七期：斷鏈行動 | 494 | VERIFIED: tracked candidate runtime/source/assets; not a signed-binary audit |
| Rift Forge 3D | 7 | VERIFIED: tracked candidate runtime/source/assets; not a signed-binary audit |
| 島嶼交通學院 | 166 | VERIFIED: tracked candidate runtime/source/assets; not a signed-binary audit |
| 小小列車長 | 179 | VERIFIED: tracked candidate runtime/source/assets; not a signed-binary audit |
| 夜行列車 | 319 | VERIFIED: tracked candidate runtime/source/assets; not a signed-binary audit |
| 島嶼飛行學校 | 19 | VERIFIED: tracked candidate runtime/source/assets; not a signed-binary audit |
| 島嶼鐵道學校 | 15 | VERIFIED: tracked candidate runtime/source/assets; not a signed-binary audit |

## 完全相同的檔案

| 本作檔案 | 與哪款／檔案重複 | SHA-256 | 處理方式 |
|---|---|---|---|
| 本次候選範圍沒有逐位元相同檔案 | 13 款已定位資料夾 | 見 JSON 清冊 | 不將零雜湊重複解讀為零概念或架構共用 |

## 同內容的 CSS 規則

正規化空白後，長度超過 90 字元的完整 selector＋declarations 沒有相同項目。這不證明版型與視覺印象獨立。

## 逐項判讀與處理

| 本作檔案／元件 | 與哪款重複或相似 | 處理方式 |
|---|---|---|
| index.html、manifest.webmanifest、src/ui.js 對外名稱與結語 | 舊版用「開源遊戲世界」系列宣傳，接近同帳號模板系列語氣 | 改為「籃底的手記」，結語改為實際農務與分享，不宣稱玩家共創 |
| index.html footer、src/ui.js 設定導流 | 裂潮卡牌、無盡塔防、灰燼護航的系列互推版型 | 移除跨遊戲連結；原有三個設定連結改成本機存檔、資料用途與離線說明的頁內導覽，保留原控制可達測試 |
| src/world.css、src/heirloom-ui.js、src/daily-ui.js | 窗口與分頁是常見 UI 模式；沒有逐位元或長 CSS 規則重複 | 光斑任務用麥黃與棕墨色，餐籃以便箋、麥穗照料記錄和兩種送法呈現；不把換色本身當重大玩法差異 |
| assets/generated/r68/loading-*、assets/icons/*、assets/generated/v4/*、assets/audio/r79-* | 已對 13 款可定位 repo 的候選檔案做 SHA-256 比對，沒有完全相同素材 | 沿用本作四季載入插畫、農場圖示、角色／地圖圖集與 R79 農場曲；新手記插畫與持籃動作缺件見 assets/heirloom/manifest.json |
| index.html、offline.html 的 Segoe UI／PingFang TC／Microsoft JhengHei／system-ui／sans-serif | 裂潮卡牌、無盡塔防等同樣使用部分系統字型家族 | 標準作業系統第三方字型，沒有打包或下載字型檔；列出共用，不假稱專屬字型 |
| SKILL.md、art-config*.json 與 src/ 拆模組慣例 | 多個網頁遊戲採相似作者工作架構；此項不在 runtime 雜湊零重複的結論內 | 保留開發文件與來源，正式 Pages allowlist 僅 runtime／assets／LICENSE／CREDITS；原生 public 根目錄也沒有 SKILL.md。框架相似必須如實揭露 |
| native-kit：Capacitor 8、App／Preferences 外掛 | 同帳號使用同一 native-kit 的網頁遊戲 | 標準第三方包裝；唯讀保留，沒有將換個 App 名當原生獨立性證據 |
| native-kit/public/native-host.js，SHA-256 `62b5d205324d95578a79dbead4b0f60cf15415e0929f9e81edbf3cffb0fd8e25` | ashes-convoy, island-flight-school, night-train-watch-protocol, storm-apocalypse, taiwan-train-school, tower-defense-skill, village-siege, web-card-game-skill | 自家共用宿主程式，含原生判斷、返回與背景通知；不是第三方標準引擎本體。唯讀不得修改，完整揭露於審查草稿，不聲稱已消除這項共用 |
| native-kit 的本作 public/index.html | 本作舊網頁快照，沒有 r81-20261015-1 | BLOCKED：仍需由打包線重新建置與實機驗證；本輪沒有修改 native-kit |

界線：掃描排除 docs、scripts、references、node_modules、build、dist、android／ios 等目錄。Godot、Unity 等第三方引擎可能存在於其他作品，但本作 runtime 為原生 HTML/CSS/JS；沒有把引擎差異當作玩法創新。未做函式 AST 相似度或所有歷史版本與第三方 App 二進位比較。
