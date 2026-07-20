# OPTIM_PLAN R73（PLAYTEST-R1 缺陷修正輪）

2026-07-20。實作者：Codex（GPT-5）。輸入：`docs/playtest/PLAYTEST_R1.md` §5、§6、§9 與 `docs/playtest/shots/`。

## 本輪修正（P1 → P2）

| ID | 優先級 | 修正 | 驗收 |
|---|---:|---|---|
| FARM-R1-01 | P1 | coarse + short landscape 的 `.toolbar` 固定於頁籤上方，左右避開 D-pad／A；沿用 `--tabs-inset` 定位與 `--fixed-bottom-inset` 實測總高 | 844×390 三顆系統鍵真實 click；390×844→844×390→390×844 往返旋轉仍可達 |
| FARM-R1-02 | P1 | `addStructure()` 為大型結構圖像掛上代表 footprint 的 `data-tile-id`；固定結構 click handler 另帶 fallback 解析 | 先開信箱→關閉→點市集→使用，執行市集賣出且不重開信箱 |
| FARM-R1-03 | P2 | 設定內新增木牌式「其他遊戲」區，保留三條系列連結與 44px 觸控目標 | 390×844 與 768×1024 三連結可見、中心命中、真實 click |
| FARM-R1-05 | P2 | 訂單丟棄改 5 秒二段確認：第一次只展開「保留／確認丟棄」，第二次明確確認才替換訂單 | 取消保留原單；逾時復位；確認後才呼叫 `trashOrder()` |

## Backlog（本輪不做）

- **FARM-R1-04｜單棟建物升級成長線**：為玩家已放置建物補 `level` 顯示、下一級效果、成本與升級動作；堆肥屋優先連結產率，穀倉優先連結容量。這是產品成長深度，不在本輪缺陷修復範圍，留待專門的內容／經濟設計輪。

## 守門與版本

- 新增 `scripts/test-r73-playtest.js`，納入 `npm run test:e2e` 串行瀏覽器守門。
- `EXPECTED_REACHABLE_CONTROLS`：224 → 236；差異為 4 個行動視口 × 設定內 3 條系列連結。
- `r73-20260720-1` 版本鏈涵蓋 package appVersion、index runtime、UI fallback、SW、manifest 與 runtime query；R68 SHA-8 內容定址資產維持豁免。
- evidence 僅寫入 `docs/evidence/r73/`，不覆寫歷史 evidence；任何既有守門產生的歷史檔案變動在提交前還原。
