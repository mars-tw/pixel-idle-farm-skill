# Claude / Codex Handoff

這份文件是給接手這個 repo（或用它當模板開新專案）的 agent 看的交接指南：先讀什麼、
目前狀態是什麼、不同角色怎麼分工。

## 先讀順序

1. `SKILL.md` — 觸發時機、適用場景、工作流程總覽。
2. `references/stage-gate-playbook.md` — Stage Gate 方法論，怎麼跑一輪「規劃→實作→測試→上線」。
3. `references/game-design.md` + `references/data-model.md` — 改玩法/數值前必讀。
4. 若涉及美術：`references/art-pipeline-v4.md` — gpt-image-2 → 切割 → 驗證的完整產線。
5. 若涉及測試：`references/e2e-gate-checklist.md` — E2E 具體要驗什麼、怎麼延伸現有測試。
6. README 的 Stage Gate 表格 — 目前每個 Stage 實際做了什麼、通過了什麼 gate。

## 目前狀態（Stage 1–7.1 已上線）

- 純原生 HTML/CSS/JS 零依賴，localStorage 存檔，`Date.now()` 時間戳計算成長與離線收益。
- 主畫面是 22×12 大世界 tile map，camera 跟隨角色，地圖驅動的故事任務鏈（三章，共 13 個任務）。
- 全部像素美術來自 gpt-image-2，用 `art-config-rpg-v4.json` 規格生成、精確切割成 frame atlas
  （16 張 sheet，含角色雙性別/四向動作、NPC、作物、動物、建築、動物照護系列）。
- 4 位原創 NPC、地圖對話系統、動物親密度/產物品質系統。
- 測試：`npm test`（經濟模擬 + 系統邏輯 + UI 煙霧 + atlas 驗證）+ `npm run test:e2e`
  （真瀏覽器桌機/手機完整任務鏈）。CI 每次 push 自動跑並部署 GitHub Pages。

## 建置目標

```text
index.html              單頁遊戲 + 全部 CSS
src/config.js            ★ 資料層：作物/升級/訂單/天氣/地圖/建築/動物/站點/NPC/故事任務
src/state.js              存檔結構、localStorage、版本遷移
src/game.js               核心規則（純邏輯，可 Node 測，無 DOM 依賴）
src/ui.js                 DOM 渲染、分層場景、camera、互動路由
src/atlas.js               v4 frame atlas 渲染器
art-config-rpg-v4.json    gpt-image-2 素材規格
assets/generated/v4/*.png+*.json  已切割驗證的 atlas（開箱即用，不需 API 金鑰）
```

零建置步驟，`python -m http.server 8000` 就能跑（一定要用 HTTP server，不能 `file://`）。

## 角色分工（多 agent 協作時）

這個專案從 Stage 6.5 起採用「審核/企劃/美術 agent（Codex）+ 實作 agent（Claude）+
人類仲裁」的三方協作模式，詳細方法論見 `stage-gate-playbook.md`。簡述分工：

| 角色 | 職責 | 不負責 |
|---|---|---|
| 人類 | 設計意圖仲裁、真實資源花費授權（API 額度）、優先順序決定 | 寫程式碼 |
| 審核/企劃/美術 | 獨立讀 repo 給意見、規劃路線圖、草擬可直接生圖的美術規格 JSON | 不直接改 repo、不執行測試 |
| 實作 | 驗證審核端每個具體主張、寫程式碼、補測試、跑 gate、commit/push/上線 | 不對主觀設計判斷（如數值平衡方向）自行拍板，交人類決定 |

**核心規則**：審核端的意見一律先驗證再動手（讀程式碼或跑腳本確認屬實），不要照單全收，
也不要因為「聽起來合理」就直接改程式碼。

## 產出交付規則

- 新增/修改的遊戲系統一定要「玩家能感受到」才算完成——資料模型改完沒有接 UI 不算數，
  美術生成/切割完沒有接玩法不算數。
- 每個 Stage（或修補用的 X.1/X.5）結束時，`npm test` 與 `npm run test:e2e` 都要全綠
  才能 commit/push；push 後要盯著 CI 跑到綠燈、確認線上真的部署新版本。
- Commit 訊息要講清楚「為什麼」（設計動機、修正了什麼問題），不要只條列「改了哪些檔案」。
- API 金鑰只透過環境變數傳入，絕不寫進任何檔案或 commit；提交前可用
  `grep -rniE "sk-[a-z0-9-]{20,}" . | grep -v node_modules` 自我檢查。

## 驗收檢查（做完一輪修改前務必確認）

- 種植、收成、訂單、升級、離線重新載入全部正常。
- 手機寬度（390px）無水平溢出。
- Console 無 runtime error。
- `npm test` 全綠。
- 若改動涉及地圖/互動/視覺，額外跑 `npm run test:e2e` 並實際開瀏覽器截圖看一次
  （E2E 綠燈只證明 DOM 結構對，不能證明畫面好不好看）。
