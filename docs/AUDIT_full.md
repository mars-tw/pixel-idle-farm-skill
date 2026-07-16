# Pixel Idle Farm 全面稽核報告

稽核日期：2026-07-16
稽核角色：資深遊戲 QA 兼製作人
稽核對象：Pixel Idle Farm Web 版，線上入口 https://mars-tw.github.io/pixel-idle-farm-skill/

本次依要求只稽核、只新增本報告，未修改任何遊戲程式、素材或測試檔。Codex 內建瀏覽器安全政策封鎖了線上 GitHub Pages 與本機 127.0.0.1 實測，因此無法在瀏覽器內重跑互動與 console 驗證；以下結論以原始碼、文件、既有截圖證據、素材檔與測試輸出為依據，並把瀏覽器驗證缺口列入風險。

## 實際稽核紀錄

- 已讀主要程式：src/config.js、src/state.js、src/game.js、src/ui.js、src/atlas.js、index.html。
- 已讀文件：README.md、SKILL.md、docs/CODEX_RESPONSE_farm_R60.md、docs/CODEX_RESPONSE_farm_R61_ux.md、docs/CODEX_RESPONSE_farm_R62_polish.md、docs/CODEX_RESPONSE_farm_R63_controls.md、docs/REFERENCE_RWD_OVERLAYS.md、docs/evidence/ 既有截圖。
- 已檢視像素素材：assets/generated/v4/terrain-organic-32.png、assets/generated/v4/crops3-48.png、assets/generated/v4/crops4-48.png、assets/generated/v4/animals-duck-48.png。
- 已跑 npm test：通過。涵蓋守門、經濟、系統、UI smoke、v3/v4 atlas 驗證；但輸出中 Playwright Chromium 缺失，pixel-level check 被略過。
- 已跑 npm run test:e2e：失敗。原因為 Playwright Chromium 執行檔不存在，測試未進入遊戲斷言。

## Top 5 優先修正

1. P1-01：恢復 E2E/RWD/控制可達性瀏覽器驗證。npm run test:e2e 目前因缺 Chromium 直接失敗，R63 近期硬化的 D-pad、桌機底部按鈕、響應式行為無法重新驗證。
2. P1-02：修補存檔遷移的半壞地圖缺口。舊存檔若只缺一個 station、structureId 或 npc，migrate() 可能不會補回，導致水井、信箱、訂單板、NPC 或橋梁永久消失。
3. P1-03：鍵盤移動不得攔截彈窗與文字輸入。設定彈窗的存檔碼 textarea 聚焦時，W/A/S/D 與方向鍵仍會被全域移動處理器攔截。
4. P2-01：調整新手教學訂單獎勵。2 個小麥換 110 金幣會大幅跳過前期經濟壓力，削弱第一批升級與作物選擇的決策感。
5. P2-05：補強遊戲內「怎麼玩」。目前教學彈窗沒有解釋 RPG 移動、工具模式、行動鍵、站點、任務、動物、橋梁與離線上限。

## P0/P1/P2 彙總

- P0：0
- P1：3
- P2：9

---

## 1. 可玩性

### P0

未發現阻斷核心循環的 P0。npm test 的經濟與系統測試通過，種植、收成、訂單、升級、離線 helper、章節任務與動物系統均有自動測試覆蓋。

### P1

無新增 P1 可玩性缺陷。主要風險在 P1-01 的瀏覽器 E2E 無法執行，代表實際操作手感與跨視口流程未被重新確認。

### P2

#### P2-01 新手教學訂單獎勵過高，前期節奏被跳過

- 證據：src/game.js:572-583 固定第一張教學訂單只要求 wheat: CROPS.wheat.yield，也就是 2 個小麥，獎勵 rewardCoins: 110、rewardXp: 8。
- 證據：src/config.js:147-190 前期升級成本分別為 40、50、80、50、300。110 金幣足以立即覆蓋多個早期升級門檻。
- 證據：npm test 經濟測試輸出顯示第一收成 15 秒、第二格升級 166 秒、胡蘿蔔解鎖 30 秒，數值本身可通過，但該測試沒有衡量玩家是否因教學訂單直接跳過早期決策。
- 影響：新玩家第一輪「種植、等待、收成、選擇先買什麼」的經濟壓力太快消失，放置農場的成長回饋會變得偏平。
- 建議修法：把教學訂單拆成較小獎勵，例如 35-50 金幣加少量 XP，或改為分段任務獎勵。若仍要保留爽感，建議用一次性新手禮包明確標示，而不是放在市場訂單價格中，以免污染玩家對訂單價值的理解。

#### P2-02 主線任務足夠，但長期目標呈現仍偏功能性

- 證據：src/config.js:695-763 已有 prologue、chapter2、chapter3、chapter4 任務；src/ui.js:1039-1063 任務 dock 會顯示目前目標與獎勵。
- 證據：src/config.js:759 註解仍寫「第二章 X/2」，但 CHAPTER2_QUESTS 實際有 5 個任務，顯示設計文件/程式註解已有輕微落差。
- 影響：任務鏈已可支撐前中期，但中後段的章節期待、區域解鎖與角色動機主要仍靠功能描述，較少提供「下一個大目標」的情感包裝。
- 建議修法：維持現有任務架構，補一層章節標題、短信件或 NPC 導語，把橋梁、東森林、動物照護、季節活動串成更明確的里程碑。

---

## 2. 畫質

### P0

未發現素材缺失導致不可辨識或阻斷遊玩的 P0。

### P1

未發現 R62 主要地形、作物、動物、鴨素材的 P1 畫質問題。檢視 assets/generated/v4/terrain-organic-32.png、crops3-48.png、crops4-48.png、animals-duck-48.png 後，素材已是可辨識的像素風，不是純占位色塊。

### P2

#### P2-03 主地圖素材已精緻化，但 UI icon 仍混用 emoji 與像素素材

- 證據：docs/CODEX_RESPONSE_farm_R62_polish.md:5-18 記錄 R62 已重製 terrain、作物、鴨等視覺；docs/evidence/R62_polish/overall-after.png 可見主地圖畫面比早期版本細緻。
- 證據：src/ui.js:486-488 種子清單仍直接使用 c.emoji；index.html:161-165 與 index.html:595 仍有多處 emoji 作為 UI 圖示或隱藏 fallback。
- 影響：主地圖已經接近一致的像素農場風格，但側欄、種子、工具按鈕仍有 emoji UI 語彙。這不影響功能，但在商店截圖或正式宣傳圖上會降低整體一致性。
- 建議修法：保留 emoji 作為文字 fallback，但正式 UI 改用小型像素 icon atlas，例如 assets/generated/ui-icons.png，並讓作物、工具、訂單、設定 icon 走同一套尺寸與描邊規格。

#### P2-04 手機首屏的智慧助理預設展開，遮住地圖視覺焦點

- 證據：src/state.js:321 預設 smartAssistant: true；src/ui.js:1570-1602 會渲染智慧助理卡片。
- 證據：index.html:293-307 定義 .smart-assistant 為浮層；index.html:849-851 手機寬度仍允許其高度達 42vh。
- 證據：docs/evidence/R63_controls/mobile-390x844.png 可見手機畫面中央被智慧助理佔據，D-pad 與底部工具雖可用，但農場可視區被壓縮。
- 影響：新玩家第一眼看到的像素農場與角色被 UI 蓋住，畫面賣點被弱化。這是畫面呈現與首玩 UX 的交界問題。
- 建議修法：手機首局預設收合智慧助理，或在完成第一個任務、第一次打開行動 dock 後自動收合。若保留展開，建議改成底部短訊息列，不要覆蓋角色附近的地圖中心。

---

## 3. 玩家適應性

### P0

未發現完全沒有新手引導的 P0。第一次進入會顯示 how-to 彈窗，任務 dock 也會給出下一步。

### P1

#### P1-03 鍵盤移動會攔截彈窗與文字輸入

- 證據：src/ui.js:1185-1190 設定彈窗提供 saveCodeBox textarea 用於複製、貼上存檔碼。
- 證據：src/ui.js:3411-3416 的 onKeyMove() 對 W/A/S/D 與方向鍵直接 e.preventDefault()，未檢查事件來源是否為 input、textarea、select、contenteditable，也未檢查是否有 modal 開啟。
- 證據：src/ui.js:3727-3729 全域 keydown 同時綁定移動與 Escape 關彈窗。
- 可重現步驟：開啟遊戲；點底部「設定」；聚焦存檔碼 textarea；嘗試輸入 w/a/s/d 或用方向鍵移動游標。預期 textarea 正常輸入或移動游標；實際會被遊戲移動邏輯攔截，並可能移動角色。
- 影響：鍵盤玩家、桌機玩家與需要手動複製存檔碼的玩家會被破壞操作。這也會影響無障礙與測試穩定性。
- 建議修法：在 onKeyMove() 最前面加入 guard：若 e.target 是 input、textarea、select、isContentEditable，或 .modal.show 存在且按鍵不是 Escape，直接 return。補一個 UI smoke 測試覆蓋設定 textarea 的 WASD/方向鍵。

### P2

#### P2-05 「怎麼玩」彈窗不足以解釋目前版本的 RPG 農場操作

- 證據：index.html:998-1012 的 how-to 只列出選種子、點地塊、等待、收成/賣出/訂單、升級五點。
- 證據：README.md:38-58 則提到更完整的玩法，包括移動、橋梁、東森林、動物、季節、天氣、離線進度與行動裝置控制。
- 影響：遊戲已從單純點地塊農場演進成 RPG 地圖農場，但遊戲內說明仍像早期版本。新玩家可能不知道 D-pad/A、WASD/方向鍵、工具模式、信箱/訂單板/倉庫/水井、橋梁修復、動物照護與離線上限。
- 建議修法：把 how-to 改為短分段：基本農作、移動與互動、工具模式、訂單與升級、離線收益、手機控制。不要做長篇教學，用 6-8 條短句即可，並保留任務 dock 當即時引導。

#### P2-06 部分 UI 文案仍是英文，不利繁中玩家與無障礙朗讀一致性

- 證據：index.html:2 頁面語系宣告為 zh-Hant。
- 證據：src/ui.js:1511-1513 設定列仍使用 “Sound effects” 與 “Tiny WebAudio feedback after the first tap or key press.”。
- 影響：主要玩家語言是繁中時，設定彈窗混入英文會降低完成度，也讓螢幕閱讀器語言切換不一致。
- 建議修法：改為「音效」與「首次點擊或按鍵後播放短音效回饋」。順手掃描所有 visible strings，將 aria-label 也納入繁中一致性檢查。

---

## 4. BUG

### P0

未發現已證實的 P0 崩潰、無法進入遊戲或存檔必定毀損問題。

### P1

#### P1-01 E2E 與跨平台瀏覽器驗證目前不可執行

- 證據：package.json:14 定義 test:e2e 會跑 scripts/test-rpg-v4-e2e.js、scripts/test-rwd-matrix.js、scripts/test-controls-reachability.js。
- 證據：scripts/test-rpg-v4-e2e.js:340 需要啟動 Chromium。
- 實測輸出：npm run test:e2e 失敗，訊息為 browserType.launch: Executable doesn't exist at ... chromium_headless_shell-1228...，並提示 npx playwright install。測試未進入任何遊戲斷言。
- 證據：npm test 雖通過，但 stderr 也出現無法啟動 Chromium，pixel-level check 被略過。
- 影響：R63 最近硬化的「D-pad 只在真觸控」、「桌機底部按鈕可點」、「各視口無遮擋/無 overflow」無法在本次環境被重新驗證。對 web 遊戲 release 而言，這是高風險 QA 缺口。
- 建議修法：在專案或 CI 文件中固定 Playwright browser 安裝步驟，至少確保 npx playwright install chromium 在 CI/setup 階段必跑；若 CI 不允許下載，改為 pin 到可用的系統瀏覽器 channel，並讓 test:e2e 缺 browser 時明確 fail，不要 silently skip 關鍵視覺檢查。

#### P1-02 半壞舊存檔可能永久缺少站點、結構或 NPC

- 證據：src/state.js:71-91 的 healthyMap() 主要驗證尺寸、座標、terrain 與土壤 plotIndex，未驗證必要 station、structureId、npc 是否完整。
- 證據：src/state.js:93-100 的 refreshDerivedMapFields() 只有在「完全沒有任何 structureId / station / npc」時才套回預設結構、站點、NPC；若只缺其中一個站點，會保留半壞狀態。
- 證據：src/state.js:375-386 的 migrate() 在 healthyMap() 通過時只 refresh derived fields，不會強制重建地圖。
- 可重現步驟：建立預設存檔；將水井 tile 的 station 改為 null，其他 station 保留；執行 migrate()。實測結果：遷移前 station 為 [mailbox, order_board, sign, storage, well]，遷移後變成 [mailbox, order_board, sign, storage]，水井沒有補回。
- 影響：舊版本、手動匯入或部分損壞的存檔可能失去水井、信箱、訂單板、NPC、橋梁等核心互動點。玩家不一定知道如何重置，會形成軟鎖或功能缺失。
- 建議修法：讓 refreshDerivedMapFields() 以 idempotent 方式逐一補齊設定檔中的必要 derived entities，而不是只檢查是否存在任何同類欄位。或把必要 station/structure/NPC 完整性納入 healthyMap()，缺失即重建或修補。新增單元測試覆蓋「只缺一個 station」、「只缺一個 NPC」、「只缺橋梁 structure」。

### P2

#### P2-07 核心建造判定比 UI 判定寬鬆，可程式化蓋到站點/NPC/結構上

- 證據：src/game.js:804-817 的 canBuildOn() 只檢查 terrain === "grass"、!object、!buildingId。
- 證據：src/ui.js:2403-2409 的 UI 建造選項額外排除 structureId、blocked、station、npc，所以一般點擊流程有保護，但核心 game API 沒有。
- 可重現步驟：在預設狀態給足資源與等級後，直接呼叫 buildBuilding() 對水井 tile、長老 NPC tile、農舍結構 tile 建造，皆回傳成功。
- 影響：目前正常 UI 路徑大多擋住，因此不是 P1；但未來新增快捷鍵、自動建造、測試工具或存檔匯入時，可能製造不可預期重疊狀態。
- 建議修法：把 canBuildOn() 的條件提升到與 UI 相同，至少排除 tile.structureId、tile.blocked、tile.station、tile.npc、鎖定區域與特殊事件 tile，並新增 game 層測試，不只測 UI 層。

#### P2-08 離線摘要在季節/活動有變化時仍可能顯示「沒有新進度」

- 證據：src/ui.js:3530-3544 離線摘要會加入季節推進與錯過事件的訊息。
- 證據：src/ui.js:3555 空狀態只檢查 crops、products、readyPlots、forageCount、coins，沒有把 summary.seasonsAdvanced 或 summary.skippedEvents 納入排除。
- 影響：玩家離線回來可能同時看到季節或活動變化，卻又看到「農場靜悄悄，沒有新進度」，訊息互相矛盾。
- 建議修法：空狀態條件加入 !(summary.seasonsAdvanced > 0) 與 !summary.skippedEvents?.length。補一個 UI 測試：只有季節推進、無作物/產品/金幣時，不應顯示無進度文案。

---

## 5. 說明

### P0

未發現 README 或遊戲內說明嚴重誤導到無法遊玩的 P0。

### P1

無新增 P1 說明缺陷。最嚴重的說明問題是 P2-05，屬於新手理解成本上升，而不是阻斷。

### P2

#### P2-05 遊戲內 how-to 與 README 功能範圍不一致

- 證據：index.html:998-1012 的 how-to 沒有覆蓋 RPG 移動、NPC、橋梁、動物、季節/天氣、離線上限、行動控制。
- 證據：README.md:38-58 已描述上述較完整功能。
- 影響：外部文件比遊戲內說明完整，但玩家在遊戲內最需要即時說明。尤其手機玩家不一定知道 D-pad/A 的對應關係。
- 建議修法：以 README 為源頭抽一版「遊戲內短說明」，每次新增主系統時同步更新 how-to。可以在測試中加入 visible strings guard，避免 README 與 how-to 長期分岔。

#### P2-06 語系一致性不足

- 證據：src/ui.js:1511-1513 設定中仍有英文。
- 影響：繁中遊戲內文案品質不一致，對非英語玩家不友善。
- 建議修法：補齊繁中文案，並把 aria-label、title、button text 一起掃描。

---

## 6. 選單

### P0

未發現死路選單或無法返回的 P0。主要彈窗都有關閉按鈕，Escape 也會嘗試關閉彈窗。

### P1

#### P1-03 設定彈窗文字輸入被全域鍵盤移動污染

- 證據與重現步驟同「玩家適應性」章節 P1-03。
- 選單面影響：設定中的存檔匯出/匯入是高信任功能，若 textarea 操作不穩，玩家會對存檔安全失去信心。
- 建議修法：彈窗開啟時暫停地圖移動熱鍵，或只允許 Escape 走全域處理。

### P2

#### P2-09 側欄分頁完整，但設定/說明在底部工具列，資訊架構略分散

- 證據：index.html:933-939 側欄分頁包含 tile、orders、upgrades、story、journal。
- 證據：index.html:964-970 how-to、settings、reset 位於底部工具列。
- 影響：桌機上功能分布尚可；手機上底部工具列同時承擔工具、模式、設定、說明，初玩時容易不知道「教學與設定不是側欄的一部分」。
- 建議修法：保留底部快捷按鈕，但在側欄或任務 dock 增加小型「?」或設定 icon 入口，或在 how-to 首次彈出時明確提供重新打開位置。

---

## 7. 全平台 UX

### P0

未發現由原始碼直接證實的 P0 響應式阻斷。既有 R63 截圖顯示桌機 D-pad 隱藏、手機 D-pad 顯示，底部工具列可見。

### P1

#### P1-01 E2E/RWD/控制可達性測試未能執行，跨平台結論不能視為已驗證

- 證據：scripts/test-rwd-matrix.js:28-38 定義 9 個視口矩陣；scripts/test-rwd-matrix.js:142-145 會檢查 overlay 開關狀態。
- 證據：scripts/test-controls-reachability.js:36-44 覆蓋桌機、觸控筆電、手機、平板；scripts/test-controls-reachability.js:73-80 檢查關鍵控制至少 44px 並可點中；scripts/test-controls-reachability.js:143-148 檢查 action dock 與 D-pad 不重疊、智慧助理在 action dock 開啟時隱藏。
- 實測結果：npm run test:e2e 因 Chromium 缺失失敗，以上矩陣沒有被跑完。
- 影響：全平台 UX 近期才硬化，但本次不能用實機瀏覽器或 Playwright 重新確認。這不代表功能壞了，但代表 release confidence 不足。
- 建議修法：先修測試環境，再把 R63 的三個重點列為 release gate：真觸控才顯示 D-pad、桌機底部按鈕可點、手機/平板 overlay 不遮蔽核心操作。

#### P1-03 鍵盤輸入焦點未隔離，桌機可及性受損

- 證據與重現步驟同 P1-03。
- 影響：桌機鍵盤玩家與使用輔助輸入的玩家會遇到彈窗內輸入被遊戲攔截。
- 建議修法：全域快捷鍵必須尊重 focus target 與 modal state，並新增自動測試。

### P2

#### P2-04 手機智慧助理浮層壓縮核心操作視野

- 證據：docs/evidence/R63_controls/mobile-390x844.png 顯示手機首屏中智慧助理佔據中央地圖區域。
- 證據：index.html:849-851 手機 .smart-assistant 最大高度設定為 42vh。
- 影響：觸控控制存在，但視覺可讀性與操作信心下降。對放置農場而言，玩家應先看到農地、角色、任務目標，而不是大型浮層。
- 建議修法：手機預設收合，或將智慧助理改為可滑出的底部 sheet，開啟 action dock 時保持隱藏並避免覆蓋玩家附近 3x3 地圖格。

---

## 結論

目前 Pixel Idle Farm 的核心農場循環、RPG 地圖、章節任務、動物照護、季節天氣與 R62 像素素材已具備可玩的中期雛形；npm test 也證明多數純邏輯系統可通過。最大問題不在「遊戲不能玩」，而在 release 前信心與邊界品質：瀏覽器 E2E 無法執行、半壞存檔不會完整修補、全域鍵盤事件沒有尊重 modal/input focus。

建議先處理 3 個 P1，再修 P2 中的新手說明、前期經濟、手機浮層與文案一致性。完成後應重新跑 npm test 與 npm run test:e2e，並至少保留桌機 1366x768、手機 390x844、平板 820x1180 三組截圖與 console 無錯紀錄。
