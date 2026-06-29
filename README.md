# 🌅 pixel-idle-farm — 像素放置農場的 Claude Code Skill

[![CI & Deploy Pages](https://github.com/mars-tw/pixel-idle-farm-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/mars-tw/pixel-idle-farm-skill/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Play Online](https://img.shields.io/badge/🎮_線上試玩-Pages-brightgreen)](https://mars-tw.github.io/pixel-idle-farm-skill/)

一個 [Claude Code](https://claude.com/claude-code) **Skill**，幾分鐘內生出**純原生（零依賴）**的
網頁像素放置農場遊戲。只用 HTML + CSS + 原生 JavaScript + localStorage——零框架、零 npm、零建置。
時間差計算離線收益，回來就有進度。

> 作者：**阿軒** ([@mars-tw](https://github.com/mars-tw)) · 授權：MIT

### 🎮 線上直接玩（不用安裝）

**👉 https://mars-tw.github.io/pixel-idle-farm-skill/**

---

## ✨ 功能特色

- **🌱 完整放置循環**：種植 → 等待成長 → 收成 → 賣出/交訂單 → 升級 → 解鎖新作物 → 離開回來拿離線收益
- **5 種作物**：小麥 🌾 / 胡蘿蔔 🥕 / 番茄 🍅 / 草莓 🍓 / 南瓜 🎃，短作物頻繁回饋、長作物高額離線收益
- **📜 市集訂單**：3 筆輪替訂單，比直售更划算（1.35×～2.2×），連續完成有連單加成
- **⬆️ 5 種升級**：開墾農地、肥沃土壤（加速）、市集人脈（加價）、擴建穀倉、幫手機器人（自動收成）
- **🌙 離線收益**：時間戳計算，上限 8 小時；幫手可離線自動收成甚至自動補種，回來看摘要
- **⛅ 天氣系統**：Lv5 解鎖，降雨加速成長、豔陽提高售價
- **🎨 像素美術**：作物用 spritesheet 切圖（5 階段成長），一鍵切換 Emoji 後備，手機觸控友善

## 🎯 玩法

1. 選種子 → 點農場空地種下
2. 等作物成長（成熟會發光跳動）→ 點它收成進倉庫
3. 「全部賣出」換金幣，或交「市集訂單」拿更多
4. 買升級：開更多地、加速、擴倉、**幫手機器人自動收成**
5. 升級解鎖新作物與天氣 → 離開再回來拿離線收益！

> 訣竅：訂單比直售划算且連單有加成；升「幫手機器人」後離線也會幫你收成、補種。

## 🚀 本地執行

```bash
# 在 repo 根目錄起 server（localStorage + 相對載入素材，需用 HTTP server）
python -m http.server 8000
# 開 http://localhost:8000/index.html
```

> ⚠️ 用 HTTP server 開（不要 file://），server 開在 repo 根目錄，否則素材圖會 404 只剩 Emoji。

## 📁 結構

| 路徑 | 說明 |
|------|------|
| `SKILL.md` | Skill 主檔（工作流與資源導覽） |
| `index.html` | 單頁遊戲 + 全部 CSS |
| `src/config.js` | ★ 資料層：作物/升級/訂單/天氣/遊戲常數 |
| `src/state.js` | 存檔結構、localStorage 讀寫、版本遷移 |
| `src/game.js` | 核心規則：成長/收成/賣出/訂單/升級/離線（純邏輯） |
| `src/ui.js` | DOM 渲染、互動、render loop、spritesheet 切圖 |
| `scripts/test-economy.js` | 經濟與進度模擬測試（CI 把關） |
| `scripts/test-ui-smoke.js` | 無瀏覽器 UI 煙霧測試（mock DOM） |
| `art-config.json` | gpt-image-2 素材生成統一設定 |
| `scripts/gen-art-openai.ps1` | 用 OpenAI gpt-image-2 生成素材 |
| `references/` | 企劃、資料模型、美術流程、Claude handoff |

## ✅ 已驗證（Node 測試，CI 把關）

跑 `npm test` 或：

```bash
node scripts/test-economy.js   # 經濟/進度模擬
node scripts/test-ui-smoke.js  # UI 煙霧測試
```

- **進度節奏**：首次收成 < 20s、第 2 次升級 < 3min、新作物解鎖 < 8min ✅
- **離線收益**：無幫手成熟待收、幫手自動收成、自動補種多輪、8h 上限 ✅
- **訂單經濟**：訂單獎金 > 直售、連單加成、丟單斷連 ✅
- **倉庫/升級/天氣/存檔遷移** ✅
- **UI 接線**：種植/收成/賣出/切換不崩、render 無 runtime error ✅

## 🎨 生成素材（gpt-image-2）

預覽素材已附在 `assets/generated/`，遊戲開箱即用。要生正式版：

```powershell
cd pixel-idle-farm
$env:OPENAI_API_KEY = "sk-..."        # 設定金鑰
.\scripts\gen-art-openai.ps1 -DryRun  # 預覽提示詞
.\scripts\gen-art-openai.ps1 -Only crop-growth,terrain-tileset
```

未生圖或圖檔缺失時，作物自動退回 Emoji 顯示，遊戲完整可玩。詳見
[references/art-generation.md](references/art-generation.md)。

## 🛠️ 加作物 / 加升級 / 調平衡

改 `src/config.js` 即可，細節見 [references/data-model.md](references/data-model.md)。
**改完數值務必跑 `node scripts/test-economy.js`** 確認進度節奏沒被破壞（CI 已內建把關）。

## 🤝 貢獻

歡迎 issue 與 PR！企劃與資料規格見 [references/](references/)。

## 📄 授權

[MIT](LICENSE) © 2026 阿軒 ([@mars-tw](https://github.com/mars-tw))
