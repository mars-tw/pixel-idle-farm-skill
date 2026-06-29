---
name: pixel-idle-farm
description: 規劃與製作純網頁像素放置農場遊戲。當使用者想做 pixel idle farm、放置農場、種田收成、離線收益、農場經營、Web pixel game、用 gpt-image-2 生成遊戲素材、或要把遊戲企劃整理成 Claude/Codex 可用的開源技能時觸發。提供核心循環、資料模型、美術提示詞、Claude handoff 與零依賴 HTML/CSS/JS 實作基線。
---

# Pixel Idle Farm

用這個 skill 規劃或製作一個可在瀏覽器直接執行的像素放置農場遊戲。預設技術路線是純 HTML/CSS/JavaScript、localStorage 存檔、時間差計算離線收益，除非既有專案已經使用其他框架。

## 工作流

1. 先定義核心承諾：玩家 30 秒內要完成「種植 -> 等待 -> 收成 -> 賣出 -> 升級」一次循環。
2. 建立資料層： crops、plots、inventory、orders、upgrades、automation、achievements 必須是可序列化設定，不把數值散落在 UI 邏輯。
3. 設計放置邏輯：用 `Date.now()` 或可注入 clock 計算成長與離線收益，不依賴單次 `setInterval` 當真實進度來源。
4. 先做可玩 MVP，再加內容量：農地、3-5 種作物、市集訂單、升級、離線進度、簡單自動化是最低線。
5. 接美術：使用 `art-config.json` 產生像素素材，或讀取 `assets/manifest.json` 接入已生成的 spritesheet。
6. 若要接會動的人物，讀 `references/character-animation.md`，使用原創角色三視圖、走路循環與農場動作命名。
7. 交給 Claude/Codex 時讀 `references/claude-handoff.md`，保持資料檔、素材檔、驗收步驟一致。
8. 完成後務必實測：種植、收成、訂單、升級、離線重新載入、手機版操作、Console error。

## 必備遊戲循環

不要只做計時器。放置農場必須有以下閉環：

- 種植成本：種子、金幣或能量，讓選作物有取捨。
- 時間收益：短作物給頻繁回饋，長作物給高額離線收益。
- 訂單出口：市場訂單消耗作物，給金幣、XP 或稀有材料。
- 升級出口：收益提升、成長加速、更多農地、自動收成。
- 內容解鎖：玩家升級後解鎖新作物、動物、建築或天氣事件。
- 離線收益：回來時顯示摘要並套用上限，避免無限膨脹。

詳見 `references/game-design.md`。

## 參考實作（已可玩，直接拿來改）

本 repo 已附**完整可玩的零依賴實作**，可作為生成新農場遊戲的基線：

- `index.html` + `src/{config,state,game,ui}.js`：完整放置循環（5 作物、訂單、5 升級、離線收益、天氣、幫手自動化）。
- `src/game.js` 是**純邏輯**（無 DOM、可注入 clock/rng），所有規則集中於此，方便測試與改平衡。
- 改數值只動 `src/config.js`，**改完務必跑測試**：

```bash
node scripts/test-economy.js   # 經濟/進度節奏：首收<20s、2次升級<3min、新作物<8min、離線回補、訂單、上限
node scripts/test-ui-smoke.js  # 無瀏覽器 UI 煙霧測試（mock DOM 抓 render 崩潰）
```

CI（`.github/workflows/ci.yml`）會在每次 push 跑這兩個測試 + JSON 驗證，再部署 GitHub Pages。
**核心心法：放置遊戲的靈魂是「時間 × 經濟」，要用模擬測試驗證進度節奏，不要只看畫面。**

## 實作基線

- 預設零依賴：單頁 HTML + CSS + JS 即可跑；Canvas 或 DOM grid 都可以。
- 存檔 key 使用命名空間，例如 `pixel_idle_farm_save_v1`。
- 所有成長、價格、收益、訂單權重放進資料設定，避免硬編碼在 render 函式。
- 所有時間以毫秒 timestamp 儲存，渲染時再轉成秒數或進度百分比。
- 用整數處理貨幣與產量，避免浮點誤差造成玩家存檔漂移。
- 圖像接點必須有 fallback：素材缺失時仍能以色塊或 emoji debug，但成品要用像素圖。

資料結構與計算範例見 `references/data-model.md`。

## 視覺基線

- 使用 top-down 或輕微 3/4 視角的像素美術，格子尺寸固定為 16x16 或 32x32。
- CSS 要設 `image-rendering: pixelated;`，並用整數倍縮放，避免像素糊掉。
- UI 不做巨大 landing page。第一屏就是農場、資源列、訂單/升級入口。
- 色彩要有土壤、作物、木材、天空/水等多個色系，不要只有綠色變體。
- 按鈕、圖示、數字回饋要清楚，手機觸控目標至少 44px。

## 素材生成

用 `art-config.json` 作為單一素材清單。預設工作流：

```powershell
cd pixel-idle-farm
.\scripts\gen-art-openai.ps1 -DryRun
.\scripts\gen-art-openai.ps1 -Only terrain-tileset,crop-growth
```

腳本預設使用 `gpt-image-2`，需要本機設定 `OPENAI_API_KEY`。如果沒有 API key，先用 dry-run 交給 Claude 或其他工具生成，再把檔案放到 `assets/generated/` 並更新 `assets/manifest.json`。

素材提示詞與裁切規則見 `references/art-generation.md`。
角色三視圖與動作切圖規格見 `references/character-animation.md`。

## 開源技能規則

- `SKILL.md` 保持精簡，只放核心流程與資源導覽。
- 詳細企劃、資料模型、素材流程、Claude handoff 分別放在 `references/`。
- 生成素材與可重跑提示詞都要保留，讓貢獻者能替換或重生資產。
- 不把 API key、私有路徑、不可重散布素材放進 repo。
- 修改數值後，至少手動跑一次 10 分鐘內的 progression 檢查與離線回補檢查。
