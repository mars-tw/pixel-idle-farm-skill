---
name: pixel-idle-farm
description: 規劃、製作或稽核純網頁像素放置農場/RPG 遊戲。當使用者想做 pixel idle farm、放置農場、種田收成、離線收益、可走動地圖 RPG、用 gpt-image-2 生成遊戲素材、或要用 Stage Gate 方法論管理多階段遊戲開發（含多 agent 協作審核）時觸發。提供核心循環、資料模型、地圖/角色/動物 RPG 架構、美術產線、E2E 驗收與零依賴 HTML/CSS/JS 實作基線；可作為新專案的模板或既有專案的稽核參考。
---

# Pixel Idle Farm

用這個 skill 規劃、製作或稽核一個可在瀏覽器直接執行的像素放置農場/RPG 遊戲。預設技術
路線是純 HTML/CSS/JavaScript、localStorage 存檔、時間差計算離線收益，除非既有專案已經
使用其他框架。

**這個 repo 同時是三樣東西**：(1) 一個已上線、可玩的開源遊戲，可直接 clone 來玩或改；
(2) 這套 Stage Gate 方法論的實戰紀錄，示範怎麼用多 agent 協作一階段一階段把遊戲做完；
(3) 這個 skill 本身。想單純玩遊戲或改數值，看 README 就夠；想複製這套**方法**去做別的
遊戲，才需要讀完下面的工作流跟 `references/`。

新專案只讀這份 SKILL.md 加下方「reference 導覽」就該能規劃出一個完整 Stage（世界探索、
NPC、動物照護、品質經濟都涵蓋在內），不需要先讀 README 的 Stage 表格或本專案的歷史紀錄。

## 適用 / 不適用場景

**適用**：放置類經營遊戲、可走動地圖 RPG（農場/城鎮/地城）、需要 gpt-image-2 生成並精確
切割像素素材的專案、需要用 Stage Gate（一階段一上線）管理進度的多階段開發、需要多 agent
協作（審核/企劃/美術 + 實作）並要求「先驗證再動手」紀律的專案。

**不適用**：需要伺服器端運算/多人連線的遊戲（這套架構是純前端+localStorage）、3D 或
非像素美術風格（切割產線是為 2D top-down 像素設計的）、單次一次性腳本工具（Stage Gate
方法論的價值在多輪迭代，一次性任務不需要）。

## 工作流

1. 先定義核心承諾：玩家 30 秒內要完成一次核心循環（例如「種植 → 等待 → 收成 → 賣出 →
   升級」），閉環要素見下方「核心不可違反原則」。
2. 建立資料層：所有數值（作物、升級、訂單、地圖、任務…）都要是可序列化設定，集中在
   `config.js`，不散落在 UI 邏輯裡；存檔遷移（`migrate()`）從第一天就要設計。
3. 設計放置邏輯：核心規則函式吃 `(state, now, ...)`，純函式、不碰 DOM/`Date.now()`，
   才能被 Node 單元測試精準驗證數值。
4. **用 Stage Gate 方法論推進**：讀 `references/stage-gate-playbook.md`，一階段一上線，
   每階段都要「可玩、可測、可上線」才算完成。若有多 agent 協作（審核/企劃/美術 + 實作），
   一樣照這份文件的分工與「先驗證再動手」紀律走。
5. 先做可玩 MVP，再加內容量：農地/場景、3-5 種基礎項目、市場出口、升級、離線進度、
   簡單自動化是最低線。
6. 若要接會動的角色或用 gpt-image-2 生成/切割素材，讀 `references/character-animation.md`
   與 `references/art-pipeline-v4.md`（規格→生圖→切割→驗證四步，含常見陷阱表）。
7. 若要做可走動大世界（camera、y-sort 遮擋、多格建築）或世界探索/NPC 對話/動物照護/
   品質經濟這類深化系統，讀 `references/world-interaction-systems.md`——每個系統都拆成
   資料層/state 遷移/核心邏輯/UI/美術/測試/E2E gate 給可套用的做法。
8. 補測試：核心邏輯用 Node 單元測試，互動與視覺用 Playwright E2E（桌機+手機都要跑）。
   E2E 具體要驗什麼、怎麼延伸現有測試，讀 `references/e2e-gate-checklist.md`。
9. 交接給其他 agent 或下一輪工作時，讀 `references/claude-handoff.md`。
10. 完成後務必實測：核心循環、離線重新載入、手機版操作、Console error、真的開瀏覽器
    截圖看一次（不要只看 E2E 綠燈）。
11. 具體的引擎級細節（存檔遷移寫法、CSS 像素設定、素材生成指令、本 repo 現成程式碼怎麼
    改）見 `references/implementation-baseline.md`，不在這份文件重複。

## Reference 導覽

**可重用方法文件**（跨專案適用的做法，新專案照著讀就能複製這套流程，內容不綁定
這個遊戲的具體設定）：

| 文件 | 用途 |
|---|---|
| [`references/stage-gate-playbook.md`](references/stage-gate-playbook.md) | Stage Gate 節奏、次版本號慣例、多 agent 分工與「先驗證再動手」 |
| [`references/world-interaction-systems.md`](references/world-interaction-systems.md) | 世界解鎖區、NPC 對話、動物照護、品質經濟——四個系統的通用 recipe |
| [`references/art-pipeline-v4.md`](references/art-pipeline-v4.md) | gpt-image-2 生圖 → 切割 → 驗證的完整產線與常見陷阱 |
| [`references/e2e-gate-checklist.md`](references/e2e-gate-checklist.md) | E2E 具體要驗什麼、怎麼延伸現有測試、可複製的樣板程式碼 |
| [`references/implementation-baseline.md`](references/implementation-baseline.md) | 引擎級工程基線：核心循環、存檔遷移、CSS 像素設定、素材生成指令 |
| [`references/data-model.md`](references/data-model.md) | 資料結構與計算範例 |
| [`references/claude-handoff.md`](references/claude-handoff.md) | agent 交接：先讀順序、角色分工、驗收檢查 |

**案例研究／歷史稽核紀錄**（這個專案實際跑過的紀錄，可當範本，但內容是專案特定的
歷史決策或具體角色/數值設定，不是抽象方法——新專案不需要讀這些也能規劃 Stage；
讀的時候把裡面的角色名、working title、檔名換成自己專案的東西）：

- [`references/game-design.md`](references/game-design.md)、
  [`references/character-animation.md`](references/character-animation.md)、
  [`references/asset-gameplay-integration.md`](references/asset-gameplay-integration.md)
  ——本專案實際的遊戲設計/角色美術規格/素材對玩法映射表，方法（核心循環要素、
  JSON 命名契約、「素材必須接玩法」規則）是通用的，但範例內容（working title、
  角色 Miri Rowan、`miri-rowan-*.png` 檔名）是這個遊戲的具體決策，抄的時候只抄
  結構、不要照搬名字。
- [`references/production-directive-stage3-rpg-actions.md`](references/production-directive-stage3-rpg-actions.md)、
  [`references/production-directive-stage4-game-audit.md`](references/production-directive-stage4-game-audit.md)、
  [`references/production-directive-rpg-rework.md`](references/production-directive-rpg-rework.md)、
  [`references/rpg-action-map-gate.md`](references/rpg-action-map-gate.md)、
  [`references/rpg-quality-rework-brief.md`](references/rpg-quality-rework-brief.md)、
  [`references/playable-map-movement-acceptance.md`](references/playable-map-movement-acceptance.md)
  ——各 Stage 實際的稽核/驗收紀錄。
- [`references/gameplay-interactions-roadmap.md`](references/gameplay-interactions-roadmap.md)
  ——Stage 5-7 的舊版路線圖，已被 `world-interaction-systems.md` 的通用整理取代，
  留著當歷史對照。
- [`references/sprite-cutting-method-v3.md`](references/sprite-cutting-method-v3.md)、
  [`references/art-generation.md`](references/art-generation.md)、
  [`references/asset-production-spec-v2.md`](references/asset-production-spec-v2.md)
  ——三份都是 v4 產線之前的舊版美術方法，已被 `art-pipeline-v4.md` 取代。

## 核心不可違反原則

- **核心邏輯是純函式**：吃 `(state, now, ...)`，不碰 DOM、不在內部呼叫 `Date.now()`，
  才能單元測試、才能離線收益跟上線行為共用同一套規則。
- **一階段一上線**：每個 Stage 做完當下就要可玩、可測、可上線，不留半成品跨階段。
- **互動走「選動作 → 走到目標 → 播動作 → 結算」**：不開全域捷徑當正式入口。
- **解鎖條件用真資源/真進度**：不能只是面板開關，判斷函式要同時檢查等級/資源/故事旗標。
- **多 agent 協作先驗證再動手**：審核端的每個具體主張都要讀程式碼/跑腳本驗證過，才能
  動手修；無法用證據判定的主觀項目交給人類決定。
- **素材要接玩法才算做完**：新素材如果沒有接上實際遊戲邏輯與渲染，等於沒做。
- **API 金鑰只能用環境變數傳入**，絕不寫進檔案或 commit；提交前用
  `grep -rniE "sk-[a-z0-9-]{20,}" . | grep -v node_modules` 自我檢查。
