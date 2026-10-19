# R82 美術重做計畫

日期：2026-10-16。狀態：VERIFIED（本機範圍，缺件另列 BLOCKED）。基線：main／0.1.15。僅本 repo、本機 commit；不派工、不 push、不部署。

已讀：共用 core-rules、token-efficient-ai-dispatch、game-optimization-round、本 repo AGENTS、R79／R80／R81 報告、VISUAL_REFRESH_PLAN、ART_REVIEW_MUSE。當次指令禁止外部派工及秘密目錄，優先於常駐派工與憑證流程。

- 美術：先擷取四視口 welcome／farm／daily／basket，寫 ART_REVIEW_R82；以同一像素前綴生成背景、角色、故事物件、面板、圖示、Logo、App 圖示，原圖與後處理雜湊可追溯。
- 按鈕：保留既有互動契約，44px、可見、可點、無遮擋，跑 CI 控制守門。
- 選單：日誌改紙本插圖與書籤，短橫向壓縮插圖；返回與關閉固定可達。
- 人物：新增可辨識農夫肖像；既有地圖人物保留真逐幀，不以單圖移動冒充動畫。量測亮度／飽和度並審查 64px 縮圖。
- 地圖：保留真農場地形與建物、作物各生長階段；改善暖光與光池，不用新插畫遮住可玩地圖。
- 技能：播種／澆水／收成、陽光加成仍在原作用幀結算；跑 R79 及原有流程。
- 角色樣子：新圖原生低解析度定色盤、透明切圖檢查、邊緣色與 64px 預覽；地圖與 UI 共用暖陽色盤。
- 動作：保留現有走路／use／收成逐幀；本作無敵人，不新增虛構戰鬥。新肖像與故事為靜態插圖，明記未補的持籃幀。
- 驗證：npm test、npm run test:e2e、其他既有獨立 browser gates，版本鏈、語法、秘密掃描。瀏覽器逐次關閉；不常駐 dev server。
- 證據：docs/art/compare 前後同視口、docs/evidence/r82-art、1290×2796／2064×2752 真實遊戲商店截圖。rAF p95 三跑中位並註明並發載僅供參考。
- 授權與包體：新增 manifest、PROMPTS.json、CREDITS，列 runtime 增量；既有未追蹤檔及修改保留不納入提交。
- 收尾：0.1.16／r82-20261016-1，CODEX_RESPONSE_R82_ART.md，Apple 4.3 風險僅本地產品判斷，不冒稱已獲商店核准。

實際結果與逐項證據：見 [CODEX_RESPONSE_R82_ART.md](CODEX_RESPONSE_R82_ART.md) 與 `docs/evidence/r82-art/verification.json`。專用持籃動作、全套地圖衣裝、原生包／實機與真人盲測仍為 BLOCKED，未標成通過。
