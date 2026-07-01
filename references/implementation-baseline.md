# Implementation Baseline

這份文件是「動手刻程式碼時的具體工程基線」，從 `SKILL.md` 移出來的細節都在這裡。
`SKILL.md` 只留工作流跟不可違反原則的指標；這裡是照著做的清單本身。

## 必備遊戲循環

不要只做計時器。放置類遊戲必須有以下閉環：

- 投入成本：讓「選擇要投入什麼」有取捨。
- 時間收益：短週期給頻繁回饋，長週期給高額離線收益。
- 市場出口：消耗產出，換取貨幣/經驗/稀有材料。
- 升級出口：收益提升、成長加速、更多產能、自動化。
- 內容解鎖：玩家進度推進後解鎖新項目、新系統、新區域。
- 離線收益：回來時顯示摘要並套用合理上限，避免無限膨脹。

詳見 `references/game-design.md`。

## 本 repo 的參考實作（已可玩，直接拿來改）

本 repo 已附**完整可玩的零依賴實作**，Stage 1–7.1 皆已上線，可作為生成新遊戲的基線：

- `index.html` + `src/{config,state,game,ui,atlas}.js`：完整放置循環 + 可走動大世界 +
  地圖驅動故事 + 動物照護系統。
- `src/game.js` 是**純邏輯**（無 DOM、可注入 clock/rng），所有規則集中於此，方便測試
  與改平衡。
- 改數值只動 `src/config.js`，**改完務必跑測試**：

```bash
npm test            # 經濟模擬 + 系統邏輯（地圖/動物/建築/訂單）+ UI 煙霧 + atlas 驗證
npm run test:e2e    # 真瀏覽器完整任務鏈 E2E（桌機 1280×900 + 手機 390×844）
```

CI（`.github/workflows/ci.yml`）會在每次 push 自動跑上述測試 + JSON 驗證，再部署
GitHub Pages。**核心心法：放置遊戲的靈魂是「時間 × 經濟」，要用模擬測試驗證進度節奏，
不要只看畫面。**

## 實作基線

- 預設零依賴：單頁 HTML + CSS + JS 即可跑。
- 存檔 key 使用命名空間，並在 `state.js` 內做版本遷移（`migrate()`），保證舊存檔欄位
  補齊、不因新增系統而炸掉。
- 所有數值放進資料設定（`config.js`），避免硬編碼在 render 函式。
- 所有時間以毫秒 timestamp 儲存，渲染時再轉成秒數或進度百分比；核心邏輯函式一律吃
  `(state, now, ...)` 參數，不在內部呼叫 `Date.now()`（要能測試才能注入固定時間）。
- 用整數處理貨幣與產量，避免浮點誤差造成玩家存檔漂移。
- 大世界版本：地圖必須大於視口、有 camera 跟隨；建築用多格 footprint + z-layer 遮擋；
  角色/物件走「選動作 → 走到目標 → 播動作 → 結算」，不用可繞過地圖的全域捷徑當早期
  唯一入口（見 `references/world-interaction-systems.md`）。
- 素材必須有玩法用途，不可只放在 repo 當裝飾或閒置檔案。
- 素材要用整數 frame size + atlas JSON（不是概念圖配百分比切片）；生成/切割/驗證流程
  見 `references/art-pipeline-v4.md`。
- 多 agent 協作時，審核端的每個具體主張都要先驗證（讀程式碼/跑腳本）再動手，詳見
  `references/stage-gate-playbook.md`。

資料結構與計算範例見 `references/data-model.md`。

## 視覺基線

- 使用 top-down 或輕微 3/4 視角的像素美術，格子尺寸固定。
- CSS 要設 `image-rendering: pixelated;`，並用整數倍縮放，避免像素糊掉。
- UI 不做巨大 landing page。第一屏就是遊戲場景、資源列、主要互動入口。
- 大世界版本應該 world-first：地圖是主角，HUD/面板是輔助，不讓大卡片壓過場景。
- 地圖不能只顯示固定方塊；需要 terrain edge/corner 自然過渡、路徑、水岸、植物雜訊、
  陰影和站點。
- 色彩要有多個色系（土壤/作物/木材/天空/水），不要只有單一色相變體。
- 按鈕、圖示、數字回饋要清楚，手機觸控目標至少 44px。

## 素材生成指令

用 `art-config-rpg-v4.json` 作為單一素材清單，四步產線見
`references/art-pipeline-v4.md`：

```bash
OPENAI_API_KEY="你的金鑰" node scripts/gen-art-v4.js      # 1) 生源圖（金鑰只用環境變數，絕不寫檔案）
node scripts/process-v4-atlas.js                          # 2) 精切成 frame atlas
node scripts/validate-v4-atlas.js                          # 3) 品質驗證（結構+像素）
```

沒有 API key 時，遊戲仍可用已附的 `assets/generated/v4/` 素材開箱即玩；要換風格或加新
sheet，照 `art-pipeline-v4.md` 的「新增一張 sheet 的具體步驟」走。

角色動作切圖規格見 `references/character-animation.md`。
地圖、動物、建築素材如何轉成玩法見 `references/asset-gameplay-integration.md`。

## 開源技能規則

- `SKILL.md` 保持精簡，只放核心流程與資源導覽；詳細方法論、規格、驗收清單分別放在
  `references/`。
- 生成素材與可重跑提示詞都要保留（`art-config-rpg-v4.json`），讓貢獻者能替換或重生資產。
- 不把 API key、私有路徑、不可重散布素材放進 repo；提交前用
  `grep -rniE "sk-[a-z0-9-]{20,}" . | grep -v node_modules` 自我檢查。
- 修改數值或行為後，至少跑一次 `npm test`，涉及互動/視覺再跑 `npm run test:e2e` 並實際
  開瀏覽器看一次。
