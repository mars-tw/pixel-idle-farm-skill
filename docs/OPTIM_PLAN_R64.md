# farm R64 全面優化計畫

本輪代號：farm R64
依據：`game-optimization-round` 固定派工技能、`AGENTS.md`、`docs/AUDIT_full.md`
注意：進場時工作樹已有 R63 證據圖修改與未追蹤 `docs/AUDIT_full.md`，本輪不回復既有變更。

## 本輪優先修正

1. 【選單/存檔】修補半壞舊存檔地圖遷移：`migrate()` 必須逐一補回必要 `station`、`structureId`、`npc`、橋梁、事件與採集欄位，並新增缺水井/信箱/訂單板/NPC/橋梁的遷移測試。
2. 【按鈕/輸入】全域鍵盤移動必須尊重 modal 與文字輸入焦點：設定存檔碼 `textarea` 聚焦時，WASD/方向鍵不得 `preventDefault()` 或移動玩家，Escape 仍可關閉 modal。
3. 【玩家適應】補強遊戲內「怎麼玩」：分段說明 RPG 移動、工具模式、行動鍵、站點、任務、動物、橋梁與 8 小時離線上限；新手教學訂單從 2 小麥 110 金調整為不跳過早期經濟壓力的報酬。
4. 【技能/音效】保留零依賴架構，補完整輕量 WebAudio 程序化音效與音量設定，覆蓋種植、收成、澆水、餵食、升級、訂單、UI。
5. 【美術/地圖模型】把 v4 `bush_big_*` 季相素材接到主畫面 bush 障礙，回收閒置資產；保持地圖與角色既有像素語言一致。
6. 【人物/腳色樣子/動作】僅驗證不回歸：維持角色 frame-based 走路/動作，不以整張圖位移冒充動畫。

## 八大面向驗收清單

- 美術：主地圖 bush 使用 `structures-nature` 的 `bush_big` 季相 frame；不新增占位圖。
- 按鈕：鍵盤 guard、設定音量控制命中區、既有控制守門 `scripts/test-controls-reachability.js` 全綠。
- 選單：設定 modal 文字輸入不被移動熱鍵污染，modal 仍可用 Escape 關閉。
- 人物：只驗證角色 sprite atlas 與 frame animation gate，不改角色素材。
- 地圖模型：半壞地圖遷移會補回水井/信箱/訂單板/NPC/橋梁與 derived map 欄位。
- 技能：程序化音效對主要操作提供確認回饋，並可在設定中調整音量或關閉。
- 腳色樣子：沿用 R62/R63 已達標角色素材；不引入低飽和或過暗替代素材。
- 動作流暢度：不修改物理 root/碰撞與視覺動畫分離架構；跑 E2E 驗證角色仍使用 atlas 幀。

## 固定閘門

- `npm test`
- `npm run test:e2e`
- `npm run test:rwd`
- `node scripts/test-controls-reachability.js`
- 效能 p95 三跑中位：以既有 E2E/RWD gate 與本機瀏覽器證據記錄可取得的量測；若測試環境缺瀏覽器，先修復環境再跑。
- 版本 bump 至 R64，並讓舊 `r63-20260715-1` cache/version 查詢歸零。
- 秘密掃描：排除 `.git`、`node_modules` 後掃 `sk-proj-*` / `sk-*`，零命中。
- before/after 與三視口證據存入 `docs/evidence/R64/`。
- 產出 `docs/CODEX_RESPONSE_farm_R64.md`。
- 本地 commit，繁中訊息，不 push。
