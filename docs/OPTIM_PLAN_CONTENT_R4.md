# 陽光農場｜新內容第四輪計畫

PREPARED，2026-10-19，main；唯一驗收來源為 `docs/content/CONTENT_REVIEW_R3_MUSE.md` 第四節五項。保留工作區起點所有未提交檔案。只本機、背景／無頭，不派工、不發布。

| 三項內容 | 設計與 Muse 驗收 | 預定檔案 |
| --- | --- | --- |
| 餐籃送到以後 | 新增裝籃近景、圖圖配對圖；花放空椅、紅格書籤放桌上，台詞呼應。交餐籃／首送／配對原尺寸手機圖；320×568 固定操作列改主鈕整行＋次鈕三顆，橫排可讀，對照 430×932 四操作實點。 | `src/content-r1.js`、`src/content-r1.css`、生成圖與 manifest／PROMPTS |
| 池塘的三種脾氣 | 第一次保留節奏字，該魚筆記解鎖後只留提早收竿後果；河鯉連環紋、銀鯽靜止後窄水花、溪鱸橫拖尾流，使用同一動作時鐘。各魚實際捕獲、重載、實等冷卻，交解鎖後無答案圖、三格軌跡、同階段遮字圖、正確魚名結果與筆記。 | `src/content-r1.js`、`src/content-r1.css`、`src/adventure.js`（唯讀觀察資料） |
| 鄰居的口味記憶 | 三人回想只給情境，不出現口味或食材名；保留先前農場回話作記憶來源。圖圖拿掉烤菜暗示，三人各交首送／錯配／配對、回想與農場回話證據，配對書籤與回話唯一。 | `src/adventure.js`、`src/content-r1.js` |

新增 `scripts/test-content-r4.js`、`scripts/test-content-r4-e2e.js`，接入 npm／browser gates，驗證正常入口、完成、成本時點、取消、存檔、離線缺圖重試、版型及觸控至少44px。本作沿用一般農場門檻，非兒童專屬分類；不增加戰鬥。既有真姿勢、physics root 與碰撞不改。八大面向沿用 R89 無縫地面、暖光、角色及圖示；新美術使用 image_gen.imagegen 與既有完整風格前綴、256×128 原生密度／受管色盤，不用程式圖冒充素材。

原尺寸圖存 `docs/content/r4/phone-<內容>-<狀態>.png`，同階段遮字圖僅隱藏文字，不改水面或時鐘。新增商店圖 1290×2796 與2064×2752，既有圖完整保留。測試重產歷史證據先備份，跑後歸檔並逐bytes還原，包含起點已修改 R68 manifest。

回歸：`npm test`、`npm run test:e2e`（內含 R79、全部現行 browser gates）、water guide、night gate、JS語法與版本鏈。桌機／手機模擬農場與釣台各三跑 rAF 原始量測、p95≤18ms，標明共享主機參考。版本 bump、repo 範圍秘密掃描零命中、明確路徑 git add、本機繁中 commit。

BLOCKED 項目如實列明：實體手機／iPad、乾淨機況效能、真人辨識／選味口述、Muse獨立複審≥8。需要實體裝置、測試者與審查回覆。本機檢查不冒充上述結果。

收尾：五項本機驗收VERIFIED，詳見 `CODEX_RESPONSE_CONTENT_R4.md` 與 `content/r4/REVIEW_INDEX.md`。349項瀏覽器檢查、20支CI守門、92份JS語法全綠；四組效能參考三跑中位≤18ms，釣台桌機一跑33.3ms，全單跑≤18ms仍BLOCKED。
