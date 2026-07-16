# farm R64 全面優化輪回報

本輪依 `game-optimization-round` 固定派工技能、`AGENTS.md` 動作品質要求與 `docs/AUDIT_full.md` 的 Top5 x 八面向執行。

## 完成項目

1. 存檔遷移補洞
   - `migrate()` 對健康但半壞的舊 map 重新補齊 derived map fields：水井、信箱、訂單看板、NPC、橋梁、事件點、採集點、structure footprint。
   - 重新接回預置建築 `buildingId` footprint，避免舊存檔漏掉雞舍等 structure/building 關聯。
   - 新增 R64 遷移測試，覆蓋缺 `station`、`structureId`、`npc`、bridge flag 的舊存檔。

2. 鍵盤控制不攔截彈窗與文字輸入
   - 全域 WASD/方向鍵移動處理器遇到 `input`、`textarea`、`select`、`contenteditable` 或開啟中的 `.modal.show` 時直接讓事件回到原控制。
   - E2E 新增設定存檔碼 textarea 聚焦測試：輸入 `wasd` 與 `ArrowLeft` 後，文字與游標正常，玩家 tile/facing 不變。

3. 玩家適應與早期經濟
   - 「怎麼玩」補成 8 段：RPG 移動、工具模式、A 鍵、站點、任務、動物、橋梁、離線上限。
   - 新手保底訂單由 2 小麥 110 金 / 8 XP 改為 45 金 / 3 XP，避免直接跳過早期升級節奏。
   - 為維持真流程可達，早期清障成本同步降為樹樁 8、巨石 12、大樹 18；E2E 仍不灌金幣完成清路與修橋。

4. 程序化音效
   - WebAudio 增補種植、收成、澆水、餵食、梳理、金幣、訂單、信件、升級、UI 短音。
   - 設定新增音效開關與 0-100 音量 slider，舊存檔會補 `soundEnabled` 與夾住 `soundVolume`。

5. 美術資產接線
   - 主畫面 bush 障礙改用 v4 `structures` atlas 的季相 `bush_big_*` frame。
   - E2E 新增主畫面 bush 使用 `data-sheet="structures"` 且 frame 以 `bush_big` 開頭的稽核。

6. 人物 / 角色樣子 / 動作
   - 未更動角色動作管線。
   - 既有 E2E 仍驗證 Miri 使用 atlas sprite、主地圖物件零 emoji、NPC/動物 frame-based 顯示未回歸。

## Gate 結果

- `npm test`: PASS。
- `npm run test:e2e`: PASS，包含 Stage 4-11 RPG v4 E2E、RWD、R64 控制可達性。
- `npm run test:rwd`: PASS，9 視口 x overlay 開/關，互動元素零出界、頁級捲動歸零、水平溢出 <= 2px。
- `node scripts/test-controls-reachability.js`: PASS，7 種裝置/視口，所有關鍵控制 >=44px 且中心命中自身。
- p95 效能閘門：PASS。
  - desktop 1366x700 三輪 p95：16.70ms、16.80ms、16.80ms；中位 16.80ms。
  - mobile 390x844 三輪 p95：16.70ms、16.70ms、16.70ms；中位 16.70ms。
- 版本殘留掃描：active release files/scripts/src 無 `0.1.7`、`r63-20260715-1`、`r63-controls`、`R63 控制`。
- 秘鑰掃描：零命中。
  - `rg -n -i "sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}" -g "!node_modules/**" -g "!.git/**"`

## Before / After 證據

Before 參考 R63 控制截圖：

- `docs/evidence/R63_controls/desktop-1366x600.png`
- `docs/evidence/R63_controls/desktop-1440x780.png`
- `docs/evidence/R63_controls/mobile-390x844.png`

After 本輪產出：

- `docs/evidence/R64/controls/desktop-1366x600.png`
- `docs/evidence/R64/controls/desktop-1440x780.png`
- `docs/evidence/R64/controls/mobile-390x844.png`

## 版本

- `package.json`: `0.1.8`
- `appVersion` / cache / SW / HTML query：`r64-20260716-1`
