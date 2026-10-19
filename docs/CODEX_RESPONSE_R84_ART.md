# 陽光農場 R84｜美術第三輪

2026-10-16；版本 `0.1.18`／`r84-20261016-1`；分支 main。狀態：VERIFIED（本機範圍）；`docs/evidence/r84-art/verification.json` 已讀回。起點 `085fad0`。沒有獨立複評，不宣稱已達 8 分。

本輪只處理 ART_RESCORE2_MUSE 第四節的五項，延續 R82／R83「日光餐籃與祖母剪貼簿」，未新增系統或畫面。前 3 分鐘的農場、餐籃與結果頁是主範圍。

## Muse 五項驗收與原尺寸證據

| 唯一清單 | 實作、驗收邊界 | 改後原尺寸截圖 |
|---|---|---|
| 1. 不讀字也能看見陽光 | EXECUTED：每塊光區 10 枚大小不同的暖黃羽化光斑、漂塵、地面斜樹影；刪除平均星點與持續選取框。受光小麥有高光及較飽滿輪廓，同作物／同播種時間的光內外對照另外標明 fixture。**BLOCKED：未執行真人三秒辨識盲測，不能稱該人類驗收條件已通過。** | `docs/evidence/r84-art/390x844-sunlight-no-text.png`、`390x844-sunlight.png`；參數在同目錄 `sun-comparison.json`；真實遊玩商店圖 `docs/store/screenshots/iphone-02-sunlight.png`。 |
| 2. 主角三件套、乾淨輪廓與表情 | VERIFIED：不透明角色與地面光分層，移除腳邊長駐白框；沿用草帽、紅巾、藤簍及 R83 四向／澆水／農務真幀，不用單張晃動冒充。新增 Miri、葛瑞、祖母各 3 表情，葛瑞用於陽光對話／送達，祖母用於手記／備籃。 | `docs/evidence/r84-art/390x844-dialogue.png`、`390x844-world-keepsakes.png`、`390x844-table-result.png`；`character-64.png`、`character-three-views.png`、`farm-after-64.png`、`expressions-80.png`。64px 圖已輸出，辨識仍屬本機自審。 |
| 3. 拆掉三頁共用骨架 | VERIFIED：結果頁只有新插圖、台詞、麥穗章及返回，無任何分頁；每日三牌直接選取／領取，刪除今日農務翻頁及停用領取鈕，完成就在牌上蓋章；備籃是兩格實體庫存。收藏冊保留原本兩頁導覽，不混入今日農務。 | `docs/evidence/r84-art/390x844-table-result.png`、`390x844-doorstep-result.png`、`320x568-daily-stamped.png`；`docs/art/compare/r84/after/390x844-basket.png`、`390x844-daily.png`。 |
| 4. 農場單排操作與對話收合 | VERIFIED：五工具＋日誌＋更多共一排，其他既有入口進更多抽屜；對話期間收起操作列、方向盤與情境列。320 至 iPad／桌機逐一檢查 44px 命中、無遮擋。390 寬預設可視世界 74.77%，實值以最終 `art-validation.json` 為準。 | `docs/art/compare/r84/after/390x844-farm.png`、`844x390-farm.png`、`1032x1376-farm.png`；`docs/evidence/r84-art/390x844-dialogue.png`。 |
| 5. 世界承接故事與清掉測試式 UI | VERIFIED：餐籃／紅格布、雙椅／空杯門廊是世界座標中的兩件物件；餐籃隨交付切換為送達狀態。門邊與共坐結果各自生成新構圖，與選擇卡不同。正式畫面沒有右上直向工具列與原尺寸浮鈕；地圖顯示選項仍可從更多進入。 | `docs/evidence/r84-art/390x844-world-keepsakes.png`、`390x844-table-result.png`、`390x844-doorstep-result.png`；十張正式商店圖在 `docs/store/screenshots/`。 |

## 新素材與模型

實際工具 **`image_gen.imagegen`**；精確模型 slug 未揭露，manifest 記 `null`，沒有猜測 API 型號。**9 張生成母圖、29 張 runtime 圖片輸出**（包含兩張相容路徑副本，不灌入 JSON／QA 圖）。

- 主要背景：安靜草地、土壟、步道、水面六材質；保留既有 autotile 邊界。
- 角色：三位各三表情；地圖角色真幀沿用 R83，沒有把肖像當成走路動畫。
- 關鍵物件：藤籃／送達籃、紅格布、雙椅空杯門廊、樹冠斜影圖集。
- 敘事：共坐後的茶桌與門邊收到便箋，兩張獨立母圖，與原選擇卡分開。
- UI：格布紙面／木邊、八圖示、繁中字標、三尺寸 App／PWA 圖示提案。

來源：`docs/art/masters/r84/`；共同前綴及逐圖提示詞：`docs/art/PROMPTS_R84.json`（由 PROMPTS.json 索引）。來源／輸出 SHA-256、尺寸、alpha、色盤及亮度／飽和：`assets/generated/r84/manifest.json`。CREDITS 追加本輪來源，原有授權保留。

後製保留工具真 alpha，native 縮圖、二值 alpha、透明 RGB 清空、最近鄰與 PNG／無損 WebP。共用 68 色包含原 66 色及兩個草地中間綠色，避免原色盤把低對比草地切成重複的高頻雜紋。9 個新人物表情雙閘門通過。紙面、紙紋、白瓷杯與手記圖示有低飽和失敗值，`pixel-readback.json` 保留原值與用途說明；沒有把這四張列成人物雙閘門通過。

新圖約 240 KiB；Web runtime 增加 **310,257 bytes（約 0.30 MiB）**，差額見 `docs/evidence/r84-art/package-size.json`，docs 母圖／截圖不在既有網站 runtime allowlist。未重建原生 IPA／AAB，不能把 Web 差額冒稱原生包體。

## 測試與截圖

同場景四視口 16 組：`docs/art/compare/r84/before/`／`after/`，另有 `overview.webp`。前輪十張商店原尺寸圖先保存在 `before/store/`；本輪商店十張由無頭 Chromium 的實際遊戲與真實收成／交付流程重擷取，iPhone 1290×2796、iPad 2064×2752，非原生實機或宣傳合成。

最終單一入口：`python scripts/verify-r84-release.py`。它依序執行 npm test、實際 CI 的 npm run test:e2e、夜間／澆水引導、比較擷取、像素讀回，再核對版本、語法、秘密、商店尺寸／雜湊。全程一次只有一支瀏覽器腳本／伺服器；每支 finally 關閉。

回歸遷移保留斷言強度：今日農務的舊前後頁改為三牌逐一點擊；原設定／側欄入口經真正的更多按鈕進入，不 force click。控制守門精確覆蓋由 305 增至 339；modal 現在檢查全部背景控制（包含隱藏控制）均受 inert 保護，並保留可見控制攔截與焦點斷言。送達頁改用返回後重開日誌，保留故事、重複交付、庫存、離線重開、旋轉驗證。R84 新增 166 項檢查，包含三項同時可領的真按鈕命中與卡上蓋章。未刪除既有測試或放寬命中尺寸／碰撞／時序／庫存斷言。

既有守門實際抓出並修正：小螢幕底欄換行／溢出、側欄無可點擊的地圖背景、三牌領取被截斷、320 種子與任務重疊、世界修復標記落到新工具列／抽屜下方；圖層修正保留原有防穿透檢查。回歸產生的歷史 evidence 先封存至本輪 regression，再恢復本輪開始的原檔；起始使用者 R68 修改也以原始 bytes 保留。

## 最終實跑結果

| 檢查 | 結果 |
|---|---|
| npm test／npm run test:e2e | 均 exit 0；實際 CI 守門全綠；R75 370、R79 44、R80 62、R82 74、R83 116 項，R81 真實雙送法／離線重開／旋轉通過。 |
| 最後呈現修正後的針對回歸 | 世界流程再跑 370 項、兩送法再實跑、美術 166 項、控制精確 339 項全綠；新增逐畫面標題／台詞內容未被插圖遮擋的命中與裁切驗證。 |
| 夜間／澆水 | 4 季 × 7 天氣通過；桌機／手機共六個澆水情境通過，成熟作物不被水壺誤收。 |
| 像素／表情 | 9 母圖、29 輸出 SHA-256、尺寸、68 色盤、二值 alpha、透明 RGB 全部讀回；9 新人物表情雙閘門通過。 |
| 效能 | 桌機三跑 p95 中位 **16.7ms**、手機 **16.8ms**；並發載參考，非乾淨實機出貨證明。 |
| 商店／版本／秘密 | 十張商店圖尺寸及 SHA-256 通過；版本鏈一致，runtime 舊版字串 0，秘密指定模式 0；全部 JS 語法通過。 |
| 歷史證據 | 71 個回歸產物封存及起始原檔逐 bytes 還原，索引 `docs/evidence/r84-art/regression-index.json`；未刪除任何既有未追蹤檔。 |

## 未完成與風險

**Apple 4.3 風險：中。** 專屬陽光、草帽紅巾、餐籃、手記與不同結果構圖已進入玩法；帳號級重複體驗仍需獨立審查及 Apple 審核，不能只憑本機美術測試判低。

BLOCKED：真人三秒光區辨識、新一輪獨立 8 分複評、原生 iOS／Android／Safari／iPad 實機。本機自審及程式無法替代真人計時判讀；本次沒有真人樣本、原生裝置驗證或新獨立評分，且依工作單未對外傳訊或派工取得這些結果。第一項的真人驗收仍未完成，不能把五條全部寫成完整通過。

沿用缺件：男主角 Kai 與斧頭／建造／釣魚／遞籃專用新衣裝、部分後期冬季物件尚未全面換裝，保留可替換 Atlas 與來源。本輪沒有把這些非五項範圍改做新系統來充數。本作無戰鬥，未新增攻擊、受擊、死亡動畫；原有農務／交付作用時序與存檔規則維持。

繁中文案 mode 2：原「前一頁／下一頁／停用領取」介面依三牌行為移除；原因為後台式翻頁及無效按鈕；改為牌上進度、可領獎勵與麥穗章。原「前往」在收合後不夠具體，改成當前任務動作（例如「澆水農地」）；新「更多」只作既有入口名稱。故事台詞、任務數值與送法未更動。

無 push、部署、App Store Connect／Google Play 操作、DevSpace／其他代理派工或對外傳訊。原有未追蹤 Muse／audit_openclose／playtest／audit-oc 檔案保留，未納入本輪 commit。
