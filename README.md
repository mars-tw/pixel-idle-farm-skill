# 🌅 阿軒割割陽光農場開源遊戲世界

[![CI & Deploy Pages](https://github.com/mars-tw/pixel-idle-farm-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/mars-tw/pixel-idle-farm-skill/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Play Online](https://img.shields.io/badge/🎮_線上試玩-Pages-brightgreen)](https://mars-tw.github.io/pixel-idle-farm-skill/)

一個 [Claude Code](https://claude.com/claude-code) **Skill**，也是一個**已上線、可玩、可測**的純原生網頁
RPG 像素放置農場。只用 HTML + CSS + 原生 JavaScript + localStorage——零框架、零 npm 依賴、零建置步驟。
主畫面是 16×12 大世界 tile map、camera 跟隨角色、地圖驅動的故事任務，作物/動物/建築全用 gpt-image-2 生成、
精切成 frame atlas 的像素美術。

> 作者：**阿軒** ([@mars-tw](https://github.com/mars-tw)) · 授權：**MIT**（程式碼與素材皆可自由使用/修改）

### 🎮 線上直接玩（不用安裝）

**👉 https://mars-tw.github.io/pixel-idle-farm-skill/**

---

## 📖 這個 repo 是什麼？

它同時是三樣東西，你可以只取你要的：

1. **一個可玩的開源遊戲** — clone 下來用任意 HTTP server 打開就能玩，存檔在 localStorage、離線也累積進度。
2. **一份「用 Claude Code + gpt-image-2 做遊戲」的實戰範本** — 從企劃包一路做到上線 RPG，全程用
   **Stage Gate**（階段門檻）管理，每一階段都「可玩、可測、可上線」，不交概念稿。下面的〈製作流程〉
   就是這套方法的真實紀錄。
3. **一個 Claude Code Skill** — `SKILL.md` 描述觸發時機與工作流，`references/` 是各階段的製作端規格與驗收門檻，
   可被其他 repo 重用來規劃同類遊戲。

> 想做自己的遊戲？跳到〈🎨 用我的素材改造〉與〈🧭 自選設計方向清單〉。

---

## 🏗️ 製作流程（Stage Gate 實戰紀錄）

這個遊戲不是一次寫完的，而是**一階段一上線**。每個 Stage 都必須通過 Gate（可玩、`npm test` 全綠、
真瀏覽器 E2E 通過、線上 Pages 可玩）才進下一階段。這也是建議你 fork 後沿用的節奏。

| 階段 | 狀態 | 目標 | 主要交付 | 通過 Gate |
|---|---|---|---|---|
| Stage 1 | ✅ | 從規劃包變成可玩放置農場 | 作物、倉庫、訂單、升級、離線收益 | `npm test` 全綠、線上可玩 |
| Stage 2 | ✅ | 主畫面從儀表板改為可走地圖 | tile map、角色座標、點地移動、工具互動 | 角色可走、可種/澆/收 |
| Stage 3 | ✅ | 導入 RPG 美術與動作 | gpt-image-2 素材、atlas、角色動畫、VFX、站點 | 主地圖 0 emoji、角色不消失、無格線 |
| Stage 4 | ✅ | RPG 大世界與故事任務 | 16×12 世界、camera、任務箭頭、故事鏈 | 桌機/手機 E2E 通過 |
| Stage 4.5 | ✅ | 修任務完成度、改名、場景打磨 | `syncStoryProgress`、0/6→6/6、荒草鎖定格、`data-audit` hook | 線上 Pages 驗證通過 |
| Stage 5 | 🔜 | 世界可探索 | 橋、封路、解鎖區、事件點、第二章任務 | 須走到地圖互動才能解鎖新區 |
| Stage 6 | 📋 | NPC 與對話系統 | NPC 實體、對話泡泡、交付反應 | NPC 可見、可走近交談 |
| Stage 7 | 📋 | 動物深化 | 地圖餵食、親密度、產物品質 | 動物不只是產蛋計時器 |
| Stage 8 | 📋 | 開源遊戲設計技能化 | SKILL.md、製作端規格、素材產線、測試 gate | 可被其他 repo 重用 |

**Gate 固定要求**（每階段都要過）：

| 類型 | 必跑內容 |
|---|---|
| 單元/系統 | `npm test` |
| 真瀏覽器 | `npm run test:e2e` |
| RWD | 桌機 `1280×900`、手機 `390×844` |
| 視覺 | 主地圖 0 emoji、無格線、無水平溢出 |
| 互動 | 主要功能必須「走到地圖目標 → 播動作 → 結算」 |
| 線上 | GitHub Pages 200、JS/素材載入成功、無 console error |

各階段的詳細製作端規格在 [`references/`](references/)（例如 `production-directive-stage4-game-audit.md`、
`rpg-action-map-gate.md`、`sprite-cutting-method-v3.md`）。

---

## 🧱 技術架構（零依賴）

```text
index.html        單頁遊戲 + 全部 CSS（含 RPG 場景 / camera / y-sort 樣式）
src/config.js     ★ 資料層：作物/升級/訂單/天氣/地圖/建築/動物/站點/故事任務（QUESTS）
src/state.js      存檔結構、localStorage 讀寫、版本遷移（地圖維度變更會自動重建）
src/game.js       核心規則：成長/收成/賣出/訂單/升級/離線/移動/故事推進（純邏輯、可 Node 測）
src/ui.js         DOM 渲染、分層場景渲染器、camera、互動路由、render loop
src/atlas.js      讀 v4 manifest，把整數像素 frame 縮放貼到任意尺寸元素（image-rendering:pixelated）
```

**分層場景渲染**：固定像素世界（`16*48 × 12*48`）放在 `#mapScene`（overflow:hidden）內，camera 平移
`#mapWorld`。圖層：地面層 → y-sort 物件/角色（`z-index = 腳底 baseline` 做前景遮擋）→ 任務標記 → VFX。

**穩定稽核 hook**：地面磚/物件/角色/任務標記都掛 `data-audit` / `data-kind` / `data-sheet` /
`data-frame` / `data-tile-id`，外部自動稽核地圖、動物、建築、任務不需依賴內部函式。

---

## 🎨 像素美術產線（gpt-image-2 → atlas）

素材已切好、附在 `assets/generated/v4/`，**遊戲開箱即用，不需任何 API 金鑰**。要重生或換風格才需要金鑰。

產線四步（v4）：

```bash
# 1) 生成源圖（呼叫 gpt-image-2；需「你自己的」OpenAI 金鑰，見下方安全說明）
OPENAI_API_KEY="你的金鑰" node scripts/gen-art-v4.js          # → assets/generated/v4/source/*.png

# 2) 精切成 frame atlas（去背 + 內容帶偵測 + 連通元件 + 多步高品質縮放）
node scripts/process-v4-atlas.js                              # → v4/*.png + *.json + manifest.json

# 3) 驗證 atlas 品質（尺寸/必要 frame/錨點/空白幀/作物觸邊；需 chromium）
node scripts/validate-v4-atlas.js

# 4) 程序化地形（草/土/水/步道 autotile）在 process 步驟一併產生
```

> 切割原理見 [`references/sprite-cutting-method-v3.md`](references/sprite-cutting-method-v3.md)。
> 源圖規格在 [`art-config-rpg-v4.json`](art-config-rpg-v4.json)。

### 🔒 安全：API 金鑰請用你自己的

- **本 repo 不含、git 歷史也從未含任何 OpenAI 金鑰。** 產線腳本只從環境變數 `OPENAI_API_KEY` 讀取，
  絕不寫入檔案或 commit。
- 你要重生素材時，請用**自己的**金鑰，並**只透過環境變數**傳入（例如上面的 `OPENAI_API_KEY=... node ...`），
  不要貼進任何檔案。
- `.gitignore` 已忽略 `.env`、`.env.*`、`*.key`，避免不小心提交金鑰。
- 提交前可自我檢查：`grep -rniE "sk-[a-z0-9-]{20,}" . | grep -v node_modules`（應為空）。

---

## 🖼️ 用我的素材改造（MIT，可自由使用/修改）

所有 `assets/generated/` 下的圖（含 v4 角色/作物/動物/建築/結構）與源圖 `assets/generated/v4/source/`
都是 **MIT 授權**，你可以直接拿去用、改、重切：

- **直接換圖**：替換 `assets/generated/v4/source/*.png`（保持同樣的格數排版），再跑
  `node scripts/process-v4-atlas.js` 重切，遊戲就吃新圖。
- **改切割規格**：角色/作物/動物的格數、錨點、命名在 `art-config-rpg-v4.json` 與 `scripts/gen-v4/processor.html`。
- **只改某張**：`node scripts/gen-art-v4.js miri-walk-48x64-v4`（只重生指定 sheet），再重切。
- **完全換風格**：改 `art-config-rpg-v4.json` 的提示詞（風格、調色盤、視角），重生整套。
- **不想用 gpt-image-2**：手繪同規格 spritesheet 丟進 `source/`，照樣可切。
- 素材缺檔時遊戲會優雅退場（作物退回 Emoji），不會白畫面。

---

## 🧭 自選設計方向清單（fork 前先決定）

這份遊戲是「像素放置農場 RPG」，但這套零依賴 + Stage Gate + atlas 產線可以做很多種遊戲。
fork 後先勾選你的方向，再動手：

- [ ] **主題/世界觀**：農場 / 太空殖民 / 地城探險 / 城鎮經營 / 釣魚 / 寵物養成？
- [ ] **核心循環**：純放置（離線為主）/ 主動操作 / 混合？決定 `Date.now()` 時間差的權重。
- [ ] **美術風格**：沿用本 repo 像素風 / 重生新風格（改 `art-config-rpg-v4.json` 提示詞）/ 手繪 / 向量？
- [ ] **世界規模**：單畫面 / 大世界 + camera（本 repo 是 16×12，可調 `MAP_W/MAP_H`）？
- [ ] **故事**：無 / 任務鏈（本 repo 的 `QUESTS`）/ NPC 對話 / 分支劇情？
- [ ] **經濟**：作物+訂單 / 製造鏈 / 多貨幣 / 市場波動？數值都集中在 `src/config.js`。
- [ ] **互動模型**：點哪走哪 + 工具模式（本 repo）/ 直接點擊 / 拖放？
- [ ] **進度系統**：升級樹 / 解鎖區域（Stage 5）/ 成就 / 等級天氣？
- [ ] **平台**：純網頁 / PWA 離線安裝 / 包成手機殼？
- [ ] **測試嚴格度**：要保留哪些 Gate（單元、E2E、RWD、線上 smoke）？建議至少留 `npm test` + 一條 E2E。

> 決定後，把它寫成一份 `references/your-directive.md`，每個 Stage 對著它驗收——這就是本 repo 的做法。

---

## 🚀 本地執行

```bash
# 在 repo 根目錄起 HTTP server（localStorage + 相對載入素材，需 HTTP 而非 file://）
python -m http.server 8000
# 開 http://localhost:8000/index.html
```

> ⚠️ 一定要用 HTTP server 開（不要 `file://`），且 server 開在 **repo 根目錄**，否則素材圖 404 只剩 Emoji。

---

## ✅ 測試（CI 把關）

```bash
npm test            # 經濟模擬 + 系統(地圖/動物/建築/訂單) + UI 煙霧(mock DOM) + v3/v4 atlas 驗證
npm run test:e2e    # 真瀏覽器 Stage 4 場景 E2E（桌機 1280×900 + 手機 390×844 完整任務鏈）
```

E2E 用 Playwright 在真實 chromium 驗證：大世界 ≥16×12、camera 跟隨、地面磚全用 atlas、主地圖 0 emoji、
動作走位路由、序章任務 `0/6 → 6/6`、`data-audit` 稽核 hook、無水平溢出、無 console error。
CI（`.github/workflows/ci.yml`）會自動安裝 chromium、跑全部測試並部署 Pages。

---

## 📁 結構

| 路徑 | 說明 |
|------|------|
| `SKILL.md` | Claude Code Skill 主檔（觸發時機與工作流） |
| `index.html` | 單頁遊戲 + 全部 CSS |
| `src/config.js` | ★ 資料層：作物/升級/訂單/天氣/地圖/建築/動物/站點/`QUESTS` 故事任務 |
| `src/state.js` | 存檔結構、localStorage、版本遷移 |
| `src/game.js` | 核心規則（純邏輯，可 Node 測）：成長/訂單/升級/離線/移動/故事 |
| `src/ui.js` | DOM 渲染、分層場景、camera、互動路由 |
| `src/atlas.js` | v4 frame atlas 渲染器 |
| `art-config-rpg-v4.json` | gpt-image-2 v4 源圖規格（角色/動作/作物/動物/建築/結構） |
| `scripts/gen-art-v4.js` | 呼叫 gpt-image-2 生成 v4 源圖（讀 `OPENAI_API_KEY`） |
| `scripts/process-v4-atlas.js` | 精切 v4 atlas（去背/切割/縮放/錨點）+ 程序化地形 |
| `scripts/validate-v4-atlas.js` | v4 atlas 品質驗證（尺寸/必要 frame/空白幀/作物觸邊） |
| `scripts/test-*.js` | 經濟/系統/UI 煙霧/E2E 測試 |
| `references/` | 各 Stage 製作端規格、資料模型、美術流程、驗收 gate、Claude handoff |

---

## 🛠️ 加作物 / 加升級 / 調平衡

改 `src/config.js` 即可（細節見 [references/data-model.md](references/data-model.md)）。
**改完數值務必跑 `node scripts/test-economy.js`** 確認進度節奏沒被破壞（CI 已內建把關）。

## 🤝 貢獻

歡迎 issue 與 PR！各階段企劃與製作端規格見 [references/](references/)。請維持「可玩、可測、可上線」的 Stage Gate 節奏。

## 📄 授權

[MIT](LICENSE) © 2026 阿軒 ([@mars-tw](https://github.com/mars-tw))　程式碼與素材皆採 MIT，歡迎自由使用與改造。
