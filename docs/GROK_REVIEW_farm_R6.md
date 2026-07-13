# Grok 全面健檢監工 — 像素農場 R58（R6 報告）

- **專案**：pixel-idle-farm-skill（《阿軒割割陽光農場》PWA / vanilla JS）
- **版本錨**：`r58-20260713-1`（`package.json`／`index.html`／`sw.js`／`manifest`／`ui.js` fallback／e2e 斷言對齊）
- **HEAD**：`645a1b2`（封面圖提交；功能主線止於 `408c283` R58）
- **審核窗**：R55（觸控二段）→ R56（crops4／季相 grade）→ R57（季相樹／地面錨點／promo）→ R58（formfactor pointer 判別）
- **審查角色**：全面健檢監工（**只審不改**；不橡皮圖章）
- **方法**：
  1. 現況靜態讀碼（`src/ui.js`、`config.js`、`game.js`、`state.js`、`atlas.js`、`index.html`）
  2. git 雜湊／quiet diff 驗證規則層純度（R55 `80a59c3`…HEAD）
  3. 對照既有監工：`GROK_REVIEW_farm_R5`、`mobile`、`formfactor`、`V1–V3` 與 Codex 回應
  4. 守門／e2e 靜態斷言閱讀（本輪**未重跑** `npm test`／`test:e2e`）
- **範圍**：只產出本文件；**不改**遊戲程式、測試、資源、經濟規則
- **優先級**：
  - **P0**：核心循環損壞／誤扣資源無緩衝／規則經濟暗改
  - **P1**：主路徑可玩但明顯損 UX、整合半截、混合裝置可重現誤分類
  - **P2**：品質債、曝光不足、文件尖角、已知延後項

---

## 0. 執行摘要

| # | 主題 | 結論 | 最高嚴重度 |
|---|------|------|------------|
| 1 | 觸控確認流（R55＋R58 formfactor） | **主路徑成立**；R58 關閉 700ms 混合裝置誤傷；殘留為舊瀏覽器 350ms 窗、非農土單擊、pending 邊界 | **P2**（P1 主缺口已關） |
| 2 | crops4（radish／sunflower） | **世界地圖 atlas 路徑成立**；`emojiOnly` 已除；UI 鉻層仍用 emoji（刻意） | **V-P2** 密度階梯 |
| 3 | 季相整合（ambient／地標／地面） | **可靜讀**；oak 主戰場 OK；`bush_big_*` 資產閒置；地形磚四季同款 | **V-P2**（內容密度另見缺口表） |
| 4 | 經濟／規則純度 | **`game.js`／`state.js` 自 R53 起 blob 未變**；R55–R58 無結算暗改；config 僅 sheet／emoji 呈現 | — |
| 5 | 三線交叉整合殘留 | **無阻擋級斷裂**；各自殘留互不引爆經濟 | P2 為主 |

**一句話**：R55–R58 把「手機誤種扣金」「crops4 emoji 田」「混合裝置誤兩段」「四季只靠 HUD」四條主傷線都關到可結案；全面健檢**無新 P0**。下一輪最高 ROI 不在再修 pointer 啟發式，而在 **內容密度／地圖資產曝光** 與少量 **手機面板 UX**。

### Top 殘留（全專案，含歷史未關）

| 順位 | ID | 嚴重度 | 殘留 |
|------|-----|--------|------|
| 1 | GAP-01 | **V-P1／產品** | 世界內容密度與 promo 編導（空草多、缺籬／水／裝飾層） |
| 2 | GAP-02 | **P1** | 手機點磚後磚資訊／側欄不自動進視口；助手仍可能壓地圖底緣 |
| 3 | GAP-03 | **V-P2** | `bush_big_*` 季相幀在庫、主地圖幾乎不曝光 |
| 4 | GAP-04 | **V-P2** | 地形 tile 四季同磚；雪／濕是 CSS 斑紋非 brick |
| 5 | GAP-05 | **P2** | R54 系：`cropReadySeen` 先寫後 juice gate、離線「靜悄悄」與季節摘要矛盾、`floatText` 池外 |
| 6 | GAP-06 | **P2** | 觸控：legacy 350ms、非農土無二段、種子列改種時 pending 仍顯示舊預覽直到再點圖 |

---

## 1. 版本與變更地圖（R55→R58）

### 1.1 提交鏈（功能相關）

| Commit | 標籤 | 宣稱重點 |
|--------|------|----------|
| `80a59c3` | R55 | 農土首點預覽＋同格確認；farm-plot gap；背景 tab 節流；mouse 直作 |
| `5b4b6b1` | R56 | crops4 atlas；四季色調；雨濕雪覆氛圍 |
| `33e7046` | R57 | 季相樹六幀；ground 錨點；crops4 polish；promo 三連圖 |
| `408c283` | **R58** | pointerType 優先；移除 700ms 全域誤判窗；混合裝置 mouse 單擊直作 |
| `645a1b2` | 封面 | README／og 圖；**不進玩法** |

### 1.2 R58 變更檔（`fda1d35`…`408c283` 主體）

| 檔案 | 角色 |
|------|------|
| `src/ui.js` | `lastMapPointer`、`mapActivationType(ev, tileId)`、350ms 序列／legacy 窗 |
| `scripts/test-rpg-v4-e2e.js` | 混合裝置：`touchend` + 純 `MouseEvent("click")` 應直作 |
| `scripts/test-guards.js` | 靜態鎖 pointer 優先、禁止 `< 700` |
| `package.json`／`index.html`／`sw.js`／`manifest` | 版本 `r58-20260713-1` |
| `docs/GROK_REVIEW_farm_formfactor.md`／`CODEX_RESPONSE_farm_formfactor.md` | 入庫 |

**未進 R58 runtime 規則 diff**：`game.js`、`config.js`、`state.js`、atlas 二進位。

---

## 2. 觸控確認流 — 整合與殘留

### 2.1 現行呼叫鏈（HEAD）

```text
.gtile pointerdown → lastMapPointer = { pointerType, tileId, at }   (ui.js ~1806)
.gtile touchend    → lastTouchMapAt = now()                         (legacy 用)
.gtile click       → mapActivationType(ev, tileId)
                   → handleMapClick(tileId, type)
                        isTouch = (type === "touch")
                        農土 + 有 action → confirmTouchFarmAction
                          首點：pending + .touch-pending + 預覽，不 moveAndAct
                          同簽名第二點：清除 pending → moveAndAct
                        非 touch → 單擊直作
```

### 2.2 `mapActivationType` 判決表（R58）

| 順序 | 條件 | 回傳 | 備註 |
|------|------|------|------|
| 1 | `!ev` | `"direct"` | 程式化 |
| 2 | `ev.pointerType` truthy | 原字串 | 真 PointerEvent click |
| 3a | 有 `PointerEvent` 建構子 + `lastMapPointer` 同格且 ≤350ms | 該 `pointerType` | **主路徑：click 常無 pointerType** |
| 3b | 有 `PointerEvent` + `firesTouchEvents` | `"touch"` | 觸控合成 click |
| 3c | 有 `PointerEvent` 其餘 | `"mouse"` | **不再看 700ms／lastTouchMapAt** |
| 4 | 無 `PointerEvent` + firesTouchEvents | `"touch"` | 舊瀏覽器 |
| 5 | 無 `PointerEvent` + lastTouchMapAt ≤350ms | `"touch"` | **唯一時間啟發式** |
| 6 | 其餘 | `"mouse"` | 桌面直作 |

**對 formfactor 監工（F-P1-01／02）**：R58 **宣稱成立**。混合裝置「剛 touchend 立刻用滑鼠點」在現代瀏覽器應回 `"mouse"` → 單擊直作；e2e 已改真實形狀覆蓋此回歸。

### 2.3 確認簽名與安全邊界

| 欄位 | 用途 |
|------|------|
| `tileId` | 改點他格只改 pending，不執行 |
| `action` | plant／harvest／water |
| `tool` | 中途換工具 → 簽名變 → 重進預覽 |
| `seedId` | 僅 plant；換種子 → 不誤用舊種扣金 |

首點 **不** 呼叫 `moveAndAct`／`G.plant` → **不扣 `seedCost`**（R55 P0 關閉維持）。

### 2.4 對抗表（R58 後）

| 情境 | 預期 | 判定 |
|------|------|------|
| 真 touch 農土首點 | 預覽＋高亮，coins／crop 不變 | ✅ 主路徑＋e2e |
| 真 touch 同格二點 | 走＋種／收／澆 | ✅ |
| 改點相鄰農土 | 只換 pending | ✅ |
| 桌面 mouse 農土 | 單擊直作 | ✅ |
| 觸控筆電：touch 後 mouse | 現代路徑單擊直作 | ✅ R58 |
| pen | `pointerType === "pen"` ≠ touch → 直作 | ✅ 設計 |
| 非農土（NPC／站點／建築） | **無**二段 | 設計；誤觸成本低於種田 |
| 極慢裝置：pointerdown→click >350ms 且 click 無 pointerType／firesTouchEvents | 可能誤判 mouse → **單擊扣種** | **P2 窄窗**（真機 touch 多半有 firesTouchEvents） |
| 無 PointerEvent 舊瀏覽器 | 350ms lastTouchMapAt | P2 相容 |

### 2.5 整合殘留清單（觸控）

| ID | 嚴重度 | 殘留 | 證據 |
|----|--------|------|------|
| T-P2-01 | P2 | `touchend` 仍全圖寫 `lastTouchMapAt`，現代路徑幾乎不用 | `ui.js:1810` |
| T-P2-02 | P2 | 全域單槽 `lastMapPointer`；理論多指／跨格競態 | `ui.js:33,1806-1808` |
| T-P2-03 | P2 | 種子列／工具列改選後，預覽文案要等再點地圖才更新 | `confirmTouchFarmAction` 僅 map click 路徑 |
| T-P2-04 | P2 | e2e 主路徑仍多用合成 `PointerEvent('click', {pointerType:'touch'})`，與真機 `MouseEvent` 合成鏈不同（混合案例已補） | `test-rpg-v4-e2e.js:224-230` |
| T-P2-05 | P2 | 非農土無確認（可接受；若未來「誤觸賣出」再評估） | `handleMapClick` 站點等先 return |

**結論**：觸控確認流 **可結案主線**；R58 為正確加固，非半整合。殘留不構成 P0／P1 阻擋。

---

## 3. crops4 — 整合與殘留

### 3.1 資料與 atlas

| 作物 | `sheet` | 幀 | 數值（seed／yield／sell／grow） |
|------|---------|-----|--------------------------------|
| `radish` | `crops4` | `radish_{seed…ready}` ×5 | **與 emojiOnly 時代相同**（僅 sheet／emoji 字面變） |
| `sunflower` | `crops4` | `sunflower_*` ×5 | 同上；`orderXp: 40` 維持 |

- 資產：`assets/generated/v4/crops4-48.png`／`.json`（240×96、48×48、anchor `[0.5,0.9]`）
- SW 快取含 crops4（`sw.js`）
- 經濟測試斷言 `sheet === "crops4" && !emojiOnly`（`test-economy.js`）

### 3.2 渲染路徑

| 層 | 行為 | 判定 |
|----|------|------|
| 世界地圖 `updateMap` | `sheet = crop.sheet \|\| "crops"`；`Atlas.getFrame` 有則 pixel，否則 emoji 後備 | ✅ radish／sunflower 走 atlas |
| 種子列／訂單／toast | 仍用 `crop.emoji`（🌱／🌻） | ✅ 刻意 UI 鉻；非地圖誠信破口 |
| 隱藏舊 `#farm` plot 格 | `crop.sheet` 存在 → **走 emoji 分支**（非 crops4 sprite 列） | P2：DOM 多餘；玩家主視圖是地圖 |

```2027:2032:src/ui.js
        const sheet = (crop && crop.sheet) || "crops";
        const frame = plot.cropId + "_" + STAGE_NAME[prog.stage];
        const hasFrame = crop && !crop.emojiOnly && window.Atlas.getFrame(sheet, frame);
        const el = hasFrame
          ? addObjectPx(obDyn, sheet, frame, ...)
          : addEmojiObjectPx(...);
```

### 3.3 與季相／promo 的交叉

- promo spring／summer fixture 含 radish／sunflower → **依賴 crops4 幀**；e2e 拒收地圖 emoji 作物
- 當季賣價 ×1.15 仍純規則層（`sellUnitValue`）；crops4 **只換皮**

### 3.4 殘留

| ID | 嚴重度 | 殘留 |
|----|--------|------|
| C-VP2-01 | V-P2 | 細節密度 crops1 ≫ crops4≈crops3；可同框非旗艦均一（V3 已記） |
| C-P2-02 | P2 | 舊 plot 面板對 sheet 作物顯示 emoji（隱藏 UI） |
| C-P2-03 | P2 | `emojiOnly` 欄位語意仍殘在分支條件，全集已無 true 值 |

**結論**：crops4 **整合完成**，無「半 sheet／半 emoji 田」回歸。下一刀是美術均一或乾脆刪死碼 plot 路徑，非救火。

---

## 4. 季相整合 — 落地與殘留

### 4.1 分層現況（正確架構）

```text
規則季          → game.currentSeason / advanceSeasonState / 賣價 1.15
html[data-season] → 天空 CSS 變數
#mapScene[data-season|weather] → scene grade + 天氣粒子 after
#groundLayer::before/after     → 地面季色／雨紋／雪斑（isolation，不蓋角色）
structures oak_* / bush_big_*  → seasonalStructureFrame + 轉季 rebuild 靜態物件
轉場 FX                       → season-wash（live 單次；離線摘要不補播）
```

### 4.2 接線健康度

| 子系統 | 狀態 | 備註 |
|--------|------|------|
| `updateSeasonAmbient` 寫 dataset + 轉季 `buildStaticObjects` | ✅ | 地標幀會刷新 |
| `seasonalStructureFrame` 春／秋／冬 suffix，夏 base | ✅ | e2e oak 四季 |
| 障礙 `tree` → `oak` 季相 | ✅ | **主曝光** |
| 事件點 oak | ✅ | |
| `bush` 障礙 → **props `bush`** | ⚠️ | **不走** `bush_big_*` |
| ground 雨濕雪斑 | ✅ | 靜照可讀；非 terrain frame |
| 離線 `seasonsAdvanced`／skipped 摘要 | ✅ R54 | 空狀態文案尖角仍在 |
| live 一次 advance≥2 | 單次 wash | R4/R5 已知 P2 |

### 4.3 殘留

| ID | 嚴重度 | 殘留 |
|----|--------|------|
| S-VP2-01 | V-P2 | `bush_big_spring/autumn/winter` 資產就緒、validator 要求，**玩法主畫面幾乎看不到** |
| S-VP2-02 | V-P2 | 草／土／水 brick 四季同幀；冬腳下仍是「冷罩春草」 |
| S-VP2-03 | V-P2 | scene 級秋 color／冬 saturation blend 仍可能輕染全景（含角色）— V2-P2-02 部分殘 |
| S-P2-04 | P2 | 離線僅季節推進時仍可能出現「農場靜悄悄」（R5） |
| S-P2-05 | P2 | live 多季 catch-up 單次洗色（產品債，非 bug） |

**結論**：季相 **不是半整合**；規則、ambient、地標、地面、摘要四層齊。殘留是 **曝光與地形深度**，不是缺接線。

---

## 5. 經濟／規則純度快檢

### 5.1 Git 硬證據

| 檔案 | R53 `30d7e55` blob | HEAD blob | R55…HEAD quiet |
|------|--------------------|-----------|----------------|
| `src/game.js` | `27c746ee…` | **相同** | exit **0** |
| `src/state.js` | `76592aa9…` | **相同** | exit **0** |
| `src/config.js` | `f9d9389d…` | `447950af…` | **有 diff**（僅呈現） |

自 **R53 起 `game.js`／`state.js` 未再改**（最近規則提交仍為 R52 `93d2b98`）。

### 5.2 `config.js` 僅允許的呈現 diff（R56–R57）

| 欄位 | radish | sunflower |
|------|--------|-----------|
| `growMs`／`seedCost`／`yield`／`sellValue`／`xp`／`unlockLevel`／`season` | **未改** | **未改** |
| `emojiOnly: true` | **移除** | **移除** |
| `sheet` | → `"crops4"` | → `"crops4"` |
| `emoji` | `🔴`→`🌱`（UI） | 維持 `🌻` |

→ **賣價、成長時間、產量、訂單 XP 公式入口未變**。

### 5.3 規則層關鍵常數（未在 R55–R58 動）

| 項目 | 行為 |
|------|------|
| 當季賣價 | `1.15 + buildingSeasonalBonus`（Lv≥`SEASON_UNLOCK_LEVEL`） |
| 濕土 | `MOISTURE_MUL` 縮 grow |
| 季節長度 | `SEASON_DURATION_MS = 20min` |
| 離線季節 catch-up | `advanceSeasonState` + skipped events 去重（R52） |

### 5.4 UI 層「碰規則」邊界

| UI 行為 | 是否改結算 |
|---------|------------|
| 觸控二段確認 | **否** — 只延後呼叫 `G.plant` 等 |
| crops4 sheet | **否** — 渲染 |
| 季相 ambient／地標 | **否** — 渲染；轉季仍走 `G.updateSeason` |
| promo `applyPromoScene` | 調 level／plots 僅 debug／e2e 入口；**非預設存檔路徑** |

**純度判決：通過。** R55–R58 無經濟暗改；config 變更屬「美術呈現欄位」，應用經濟測試鎖 sheet 而非數值漂移。

---

## 6. 三線交叉整合健檢

| 交叉 | 風險假設 | 實測（靜態） | 結果 |
|------|----------|--------------|------|
| 觸控 × 經濟 | 預覽誤扣金 | 首點不進 `moveAndAct` | ✅ 關 |
| 觸控 × 季相 | 轉季清／不清 pending | pending 不自動清；簽名仍有效 | ✅ 可接受 |
| crops4 × 當季加成 | sheet 改壞 sell | sell 讀 `CROPS` 數值＋season id | ✅ 無關 sheet |
| crops4 × promo | 回歸 emoji 田 | fixture + e2e 0 emoji | ✅ |
| 季相 × 靜態物件 | 轉季不換樹 | `updateSeasonAmbient` rebuild | ✅ |
| 季相 × 離線 | 摘要缺欄 | R54 已接 `seasonsAdvanced` | ✅ 主路徑 |
| formfactor × 手機 P0 | 修 hybrid 時弄壞 touch 二段 | 分支仍 `=== "touch"` | ✅ 語意分離 |

**無「三線互相踩壞」的整合殘留。** 各自 P2 可獨立排程。

---

## 7. 歷史 P0／P1 結案表（健檢用）

| 來源 | 項 | R58 狀態 |
|------|-----|----------|
| mobile M-P0 誤種扣金 | 二段確認 | **關** |
| mobile M-P1 背景節流 | `document.hidden` loop／autosave | **關**（R55） |
| formfactor F-P1 700ms 誤兩段 | R58 移除現代路徑時間窗 | **關** |
| V1 V-P0 地圖 emoji 作物 | crops4 + e2e | **關** |
| V2 Top3 季相樹／地面／promo | R57 | **關**（bush 曝光弱） |
| R4/R5 FX／Audio／季節摘要 | 主路徑關；P2 尖角殘 | **維持** |
| mobile 點磚捲動／一級切換 | Codex 明示延後 | **仍開** → GAP-02 |
| 世界密度 | V3 🥇 | **仍開** → GAP-01 |

---

## 8. 缺口排序（全專案 ROI 視角）

嚴重度 × 玩家可感知 × 工程成本（主觀 1–5，成本低＝划算）：

| 順位 | ID | 嚴重度 | 可感知 | 成本 | 划算分* | 說明 |
|------|-----|--------|--------|------|--------:|------|
| 1 | GAP-03 | V-P2 | 中高（靜照／散步） | **1** | **4.5** | 把既有 `bush_big_*` 接到障礙或 STRUCTURES，零新美術 |
| 2 | GAP-02 | P1 | 高（手機日用） | **2** | **4.2** | 點磚 `scrollIntoView` 磚資訊／弱化助手預設擋圖（避開打斷二段確認） |
| 3 | GAP-01 | V-P1 | 高（商店／首印象） | **3–4** | **3.8** | 用現有 props／花床／圍籬提高密度；promo 加秋卡、2× 輸出 |
| 4 | GAP-05 | P2 | 低–中 | **1** | **3.5** | 離線空狀態文案、`cropReadySeen` 順序、英文 Sound 文案 |
| 5 | GAP-04 | V-P2 | 中（放大截圖） | **3** | **3.0** | 少數 winter grass／edge 雪 frame |
| 6 | GAP-06 | P2 | 低 | **1–2** | **2.5** | 觸控尖角硬化（seed 變更刷新預覽、legacy 窗文件化） |
| 7 | crops 密度均一 | V-P2 | 中 | **4+** | **2.0** | 重畫 crops2/3/4 對齊 crops1 — 昂貴 |

\*划算分僅供排序，非正式度量。

---

## 9. 下一輪最划算 3 步（建議實作順序）

> 原則：**不碰** `game.js` 結算；優先「資產已在庫／小 diff／高可見」。

### 🥇 步驟 1 — 季相灌木曝光（GAP-03）

- **做什麼**：障礙 `bush` 改走 `structures`／`bush_big` + `seasonalStructureFrame`，或在地圖加 2–4 個 `bush_big` 實體；e2e 斷言秋／冬可見 suffix 幀。
- **為什麼划算**：R57 已付生成器與 6 幀成本，**主畫面卻幾乎領不到**；改動集中 `ui.js` 常數表，無經濟風險。
- **驗收**：春／秋／冬截圖灌木可分；夏回 base；`validate-v4` 仍綠。
- **預估**：0.5–1 人日。

### 🥈 步驟 2 — 手機點磚資訊可達（GAP-02 縮小版）

- **做什麼**：農土確認後或桌面直作後，對 `#tileContext`／側欄 `scrollIntoView({ block: "nearest" })`；智慧助手預設收合或縮小手機底緣佔位（**不要**在首點預覽時強制切走焦點打斷二段）。
- **為什麼划算**：R55 已修扣金 P0，日用痛點轉為「種完看不到結果／面板在 fold 下」；純 UI，規則零碰。
- **驗收**：390×844 點農土二段完成後，磚資訊或資源回饋在一屏內可讀；二段 e2e 仍綠。
- **預估**：0.5–1 人日。

### 🥉 步驟 3 — 文案／降級尖角三連修（GAP-05 打包）

- **做什麼**（同一小 PR）：
  1. 離線 modal：有 `seasonsAdvanced`／skipped 時不要再寫「農場靜悄悄」
  2. `cropMatureCue`：juice gate **先於** `cropReadySeen.add`
  3. 設定「Sound effects」→「音效」
- **為什麼划算**：R54/R5 已標、改動行數少、直接提升 polish 與無障礙／降級體驗，零美術依賴。
- **驗收**：單元敘述或手動離線跨季；low→high 可再播成熟 cue。
- **預估**：≤0.5 人日。

**刻意不放進「最划算 3 步」**：全面地形換季 brick、crops 全表重繪、map pan/zoom、updateMap dirty-layer — ROI 差或風險高，應獨立里程碑。

---

## 10. 對 Codex／前輪宣稱的總判決

| 輪次 | 監工判決 |
|------|----------|
| R55 手機 P0 | **通過**（維持） |
| R56–R57 視覺主線 | **通過**（V3 收官 7.2/10 維持） |
| R58 formfactor P1 | **通過**（靜態＋e2e 形狀對齊） |
| 經濟零暗改 R53–R58 | **通過**（blob 硬證） |
| 「已無可做」 | **否** — 見 §8–9；但 **無 P0 火場** |

---

## 11. 本輪未做／限制

- **未**實機手指點測平板／觸控筆電；混合路徑依碼＋e2e 合成事件推論
- **未**重跑 `npm test`／`npm run test:e2e`（以入庫腳本與 Codex 自述為輔證）
- **未**開圖像素級重評 crops4／promo（沿用 V3 開圖結論）
- **未**改任何產品碼

---

## 12. 附錄：關鍵錨點

| 項目 | 值 |
|------|-----|
| appVersion | `r58-20260713-1` |
| HEAD | `645a1b24648fb73717d1d5a60332e6fefb72e305` |
| R58 功能 commit | `408c283` |
| game.js blob | `27c746eedb13b59827fe6b746465c1e78a341a10` |
| state.js blob | `76592aa9a279c9d0160934299823454f890b17c7` |
| 觸控核心 | `src/ui.js` `mapActivationType`／`confirmTouchFarmAction`／`handleMapClick` |
| crops4 | `config.js` CROPS + `assets/generated/v4/crops4-48.*` |
| 季相地標 | `seasonalStructureFrame` + `structures-nature` 六幀 |
| 前輪文件 | `docs/GROK_REVIEW_farm_{R5,mobile,formfactor,V3}.md` |

---

**報告結束。** 只審不改；建議下輪依 §9 三步推進，完成後可再開 R7 對抗覆核。
