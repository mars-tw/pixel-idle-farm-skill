# R76 Release Review

範圍：`src/adventure.js`、`src/world-ui.js`、`src/state.js`、`src/game.js` 的新增 diff 與必要呼叫脈絡，以及 `.github/workflows/ci.yml`。
只新增本文件；未派工、未讀憑證、未修改主檔、未讀取或修改指定保留檔案。未重跑既有 370 E2E、21 rules 或 CI。
以下以指定來源檔搭配合成 CONFIG 做記憶體內狹窄驗證；未讀取 `config.js`，不宣稱已重現於實際地圖或玩家存檔。

## Findings

### [P1] 野餐後在搬空的 NPC 原站位建屋，回讀會刪除建屋與動物

- 位置：`src/world-ui.js:320-321`；相關讀檔流程：`src/state.js:124`、`:149-151`、`:187`、`:441-442`；建造條件：`src/game.js:829`。
- `arrangePicnic` 清除原 NPC 站位並搬到野餐座位，原本的草地因此可以建屋。回讀時 `refreshDerivedMapFields` 卻恢復 canonical NPC；建物重建因該格已有 NPC 而拒收建屋，隨後動物清理也移除其動物。之後存檔會固化資料遺失。
- 狹窄重現：完成野餐後，於搬空的原 NPC 草地建一座動物家再 migrate；建造條件為 true，建屋與動物保留結果皆為 false，原格 NPC 被恢復。
- 修復方向：在重建建物前，依已完成野餐的存檔狀態還原搬遷後 NPC；衝突時移動 NPC 或保留建物，不要把合法建屋當成髒資料刪除。

### [P2] 新場址直接占用舊建屋地格，兩個實體重疊

- 位置：`src/world-ui.js:48-50`；場址渲染：`:365-378`；新建造防護：`src/game.js:829`。
- `prepare` 不檢查場址是否已有 `buildingId`／障礙，直接設定 `adventureSite` 與 `blocked`。新 `canBuildOn` 只防止日後建造，沒有處理載入前已存在的建屋；`paintWorld` 仍在同一格建立場址實體。
- 狹窄重現：讓舊建屋位於 `t10_10` 的合法草地再 prepare，該格同時保留 `buildingId=b_old`、`adventureSite=picnic_table`、`blocked=true`。
- 修復方向：標記場址前先處理占用；保留建屋 ID、等級及動物關聯，統一遷移建屋或選擇合法替代場址，再同步互動目標及碰撞格。

其餘指定範圍：未確認其他新增 P1/P2。CI 部署仍限制為 main 分支 push，且依賴 test、e2e；artifact 的 `path: "."` 上傳整個 checkout，並非網站檔案白名單，但本次 diff 未新增這項範圍設定，亦未檢查範圍外檔案內容。

## Bounded Follow-Up Review (2026-10-02)

結論：上列原 P1、P2 均已修正並結案。本次指定範圍內，這兩點的具體未解 P1/P2：**none**。前節保留為修正前紀錄，行號屬當時版本。

- **原 P1 已關閉**：`src/state.js:151-165` 搬遷 NPC 時避開原始建屋與場址，並保存 `partyTiles`；健康地圖於 `:498-501`、重建地圖於 `:293-294` 都先搬遷 NPC、保護既有建屋地形，再重建建物及動物。原 NPC 格不再因回讀恢復 NPC 而排除合法建屋。`scripts/test-world-migration.js:19-33` 使用實際 CONFIG，斷言原 mayor 格的 coop、動物及四位 NPC 經三次 JSON 回讀後仍保留。
- **原 P2 已關閉**：`src/state.js:140-143` 的空地判定排除建物、NPC、障礙及其他占用；`:176-192` 會選擇合法替代場址並保存 `siteTiles`。`:167-174` 保護因新版道路／岸線改動而受影響的舊建屋草地。`src/world-ui.js:22` 統一解析 `siteTileId`，目標提示 `:80、:82`、使用／修復 `:236、:252`、渲染及快取 `:355、:360` 均使用搬遷座標。`scripts/test-world-migration.js:35-58` 涵蓋 garden 占用搬遷與回讀，以及 R74 野餐桌原位建屋在新版道路下的保留。
- **補充防護**：`scripts/test-world-migration.js:60-72` 涵蓋 dirty map 重建、場址不與建物／NPC 重疊、禁止占用格建造，以及非法 adventure 型別不拋錯；`src/state.js:177` 也阻擋非法 adventure 進入場址配置。

本次為程式與回歸斷言的有界唯讀覆核。四組實際 CONFIG 回歸已通過的執行結果由主線提供，本次未重跑該腳本、370 大測或 CI；僅補寫本文件，未修改主程式、未派工。
