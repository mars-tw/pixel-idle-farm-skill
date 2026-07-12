# Grok 視覺品質監工 V3 — 像素農場 R57 收官審

- **專案**：pixel-idle-farm-skill（《阿軒割割陽光農場》PWA / vanilla JS）
- **Base**：`5b4b6b1`（r56 / `r56-20260713-1`）
- **Head**：`33e7046`（`r57-20260713-1`）
- **完整 HEAD**：`33e70460b64c2e654fe845ad4a1e484ea612472c`
- **版本錨點**：`package.json` → `appVersion: r57-20260713-1`
- **前輪鏈**：`GROK_REVIEW_farm_V1` → `CODEX_RESPONSE_farm_V1` → `GROK_REVIEW_farm_V2` → `CODEX_RESPONSE_farm_V2` → **本文件**
- **審查角色**：視覺品質監工（收官：落地覆核 × promo 靜照品質 × 1–10 總評 × 剩餘最大缺口）
- **方法**：
  1. `5b4b6b1..33e7046` 變更清單與關鍵 diff 全文（ui／CSS／生成器／e2e／atlas JSON）
  2. 實際開圖：`crops4-48.png`、`structures-nature.png` 季相區、`references/promo/r57-20260713-1/{spring,summer,winter}.png`
  3. 對照 `references/visual-targets/rpg-desktop-scene-target.png`
  4. 規則層零改動核對：`game.js`／`state.js` quiet diff
- **範圍**：**只審不改**；產出本文件。不改遊戲程式／測試／資源／經濟規則
- **優先級**（視覺／宣傳語境）：
  - **V-P0**：宣稱完全不成立／地圖再混 emoji／promo 誠信破口
  - **V-P1**：V2 Top3 落地不完整、靜照仍難分季、同框明顯斷裂
  - **V-P2**：密度微差、未用到的 frame 庫存、下輪 ROI

---

## 0. 執行摘要

| # | 宣稱／主題 | 結論 | 嚴重度 |
|---|------------|------|--------|
| 1 | V2 🥇 季相地標：oak／bush 春花、秋紅、冬霜 6 幀並依季切換 | **主路徑成立** — 6 幀入 atlas；`seasonalStructureFrame` 春／秋／冬切 suffix，夏回 base；e2e 驗 oak 四季 | 見 §1.3 bush 曝光 |
| 2 | V2 🥈 地面級雨濕／雪斑／季相，且不染作物與角色 | **成立** — `#groundLayer::before/::after` + `isolation`；scene 級 ambient 仍在（R56 殘） | V-P2 疊層 |
| 3 | V2 🥉 商店三連圖腳本 + 成排 atlas 作物 | **成立** — `applyPromoScene` + `promo:capture` + 入庫 PNG；e2e 12 格／0 emoji | — |
| 4 | crops4 一致性修正（蘿蔔副根／向日葵縮頭） | **成立且可見** — ready 可讀性↑；仍屬 crops3 系程序化 | V-P2 密度 |
| 5 | `radish.emoji` 止血 `🔴`→`🌱`（UI only） | **成立** | — |
| 6 | 規則／經濟零改動 | **成立** — `game.js`／`state.js` quiet exit 0；config 僅 emoji 字面 | — |
| 7 | promo 三連圖靜照品質 | **可上架輪播**；構圖空曠、解析度偏小、秋卡未出 | V-P2 |
| 8 | 新引入阻擋級回歸 | **未見** | — |

**一句話**：R57 **兌現了 V2 開出的 Top 3**，把「四季可靜讀」從色罩推進到**可換裝地標 + 地面錨點 + 可重製宣傳三連圖**；V1→V2 的誠信破口保持關閉。收官視覺總分約 **7.2／10** — 已過「可公開 demo／軟上架」門檻，距離目標圖的 **內容密度與地形真實感** 仍是最大天花板。

**對 Codex 宣稱的總判決**：**通過（收官可結案本輪視覺主線）** — 非橡皮圖章；殘留為 V-P2 與「下一階段美術內容」而非未交付的 V-P0。

---

## 1. R57 落地覆核（對 V2 Top 3）

### 1.1 變更檔清單（`5b4b6b1..33e7046`）

| 檔案 | 角色 |
|------|------|
| `assets/generated/v4/structures-nature.png`／`.json` | +6 季相幀（oak／bush_big × 春秋冬）；atlas 1024×412→1024×784 |
| `assets/generated/v4/crops4-48.png` | 蘿蔔／向日葵 ready 重畫 |
| `assets/generated/v4/manifest.json` | structures frameCount 10→16、rows 4→6 |
| `tools/generate-seasonal-structures.py` | 自 base 幀衍生季相（無重採樣） |
| `tools/generate-crops4-atlas.py` | 副根、碎亮面、花盤縮小、葉層 |
| `src/ui.js` | `seasonalStructureFrame`、轉季重建靜態物件、`applyPromoScene` |
| `src/config.js` | `radish.emoji`：`🔴`→`🌱` |
| `index.html` | `#groundLayer` 季／天氣靜讀層、`data-promo-scene` 隱藏 HUD 雜訊、版本 r57 |
| `scripts/capture-promo-trio.js` | Playwright 固定鏡頭截 `#mapScene` |
| `scripts/test-rpg-v4-e2e.js` | §29 promo／地標幀／ground 層斷言 |
| `scripts/validate-v4-atlas.js` | REQUIRED 納入 6 季相幀 |
| `package.json`／`sw.js`／`manifest.webmanifest` | 版本 + npm scripts |
| `docs/GROK_REVIEW_farm_V2.md`／`CODEX_RESPONSE_farm_V2.md` | 入庫 |
| `references/promo/r57-20260713-1/*.png` | 春／夏／冬成品 |

**未進 runtime 規則 diff**：`src/game.js`、`src/state.js`（`git diff --quiet 5b4b6b1 33e7046 -- src/game.js src/state.js` → exit **0**）。

`config.js` 僅改 `radish.emoji` 字面；`growMs`／`seedCost`／`yield`／`sellValue`／`xp`／`sheet` 未動。

### 1.2 版本與管線

| 檢查 | 結果 |
|------|------|
| `appVersion` / SW / html query / ui fallback | 皆 `r57-20260713-1` |
| e2e 版本錨 | 同步 r57 |
| runtime 主路徑殘留 r56 字串 | 未見（html／src／sw／package） |
| `npm run promo:capture` / `art:seasonal-structures` / `art:crops4` | 已掛 scripts |
| 經濟／規則 | 靜默 |

### 1.3 🥇 季相樹叢六幀 + 切幀

#### 資產

| frame | 語意（開圖） | anchor |
|-------|--------------|--------|
| `oak_spring` | 綠冠上白／粉花簇（非整樹染粉） | [0.5, 0.97] 繼承 |
| `oak_autumn` | 橙褐紅葉 | 同 |
| `oak_winter` | 灰藍霜冠 + 頂緣雪點 | 同 |
| `bush_big_spring` | 綠叢＋粉花 | 同 |
| `bush_big_autumn` | 褐紅叢＋殘花 | 同 |
| `bush_big_winter` | 霜白／冷灰叢 | 同 |

生成策略（`generate-seasonal-structures.py`）正確：

- 自 base 裁切後像素著色，**不 resample** → 與 AI 原幀同硬邊語言。
- 春：綠葉上「成簇花點」而非全粉濾鏡 — 與目標圖「實心粉櫻」不同路，但 **宣傳可讀、不髒**。
- 冬：只在「上方無不透明鄰點」的冠緣鋪雪 — 靜照可讀、不糊。

#### 接線

```text
SEASON_FRAME_SUFFIX = { 春: spring, 秋: autumn, 冬: winter }  // 夏 → 無 suffix → base
candidate = frame + "_" + suffix
Atlas.hasFrame("structures", candidate) ? candidate : frame
```

套用點：

- `addStructure`（STRUCTURES 表；目前主建築多走 buildings sheet）
- 障礙 `tree` → base `oak` → 季相
- 東林／事件地標 `oak`
- 動態 building 且 `sheet === "structures"` 時（如 memory_garden 的 flower_bed **無** 季相幀 → 安全回退 base）
- `updateSeasonAmbient`：季變更時 `buildStaticObjects()` — **轉季會刷新地標幀**（必要）

e2e：

- spring → `oak_spring`；summer → `oak`；winter → `oak_winter`；autumn fixture → `oak_autumn` ✅

#### 曝光尖角（非失敗，記 V-P2）

| 點 | 說明 |
|----|------|
| **oak 是主戰場** | 地圖障礙樹與 event-point 皆 oak；promo 三連圖的「一眼分季」幾乎全靠這棵／幾棵橡樹 |
| **bush_big 幀庫存偏閒** | 障礙 `bush` 走 **props** sheet 的 `bush`，**不**走 `bush_big_*`；主 STRUCTURES 表也無 bush_big 實體。六幀「都生成且 validator 要求」，但 **玩法主畫面可能幾乎看不到 bush 季相** |
| **春樹 ≠ 目標粉櫻** | 目標圖是實心粉冠；R57 是綠＋白花粉點。語意「春」成立，夢幻度低於 target |
| **夏無專用幀** | 設計正確（回 base 綠）；夏差異改靠金暖 ambient + 向日葵田 |

**結論：V2 🥇 宣稱對 oak 地標主路徑成立；bush 為「資產就緒、地圖曝光不足」。** 不重開 V-P0／V-P1 阻擋，但收官時應誠實標註。

### 1.4 🥈 地面雨濕／雪斑／季相（限 groundLayer）

#### 分層（R57 設計意圖 — 正確）

```text
season base     → #groundLayer::before（multiply 淡色）
weather ground  → #groundLayer::after（雨斜紋／雪點斑／霧）
sky / 粒子      → #weatherLayer + 既有 #mapScene::after
物件／角色      → 不在 ground 偽元素覆蓋範圍內（isolation: isolate）
```

| 天氣 | ground `::after` | 靜照可讀？ |
|------|------------------|------------|
| rain / storm | 135° 深藍細紋 multiply | **是**（濕冷暗） |
| snow | 32／48px 白點 radial 網格，opacity 高 | **是**（地斑） |
| fog | 淡白綠 haze | 中 |
| 其他 | opacity 0 | — |

| 季節 | ground `::before` |
|------|-------------------|
| 春 | 淺綠粉乘算 |
| 夏 | 暖綠 |
| 秋 | 金褐 |
| 冬 | 冷青灰 |

`perf-low`：降低 ground 偽元素 opacity、停 transition；雪仍保留較淡表意。  
`prefers-reduced-motion`：停 ground transition。  
promo winter：略壓 weatherLayer／scene after／ground snow，避免靜照過曝成「白霧海報」。

e2e：春 groundSeasonColor ≠ transparent；冬 groundWeatherImage ≠ none。

#### 與 R56 的關係

- R56 已在 `#mapScene` 做季節底與 `::before` ambient（秋 `color`／冬 `saturation` blend）及天氣 `::after`。
- R57 **加** ground 錨點，並宣稱「角色與作物不吃地面染色」— **對 ground 偽元素成立**。
- **未移除** scene 級 `mix-blend-mode` — 冬 promo 中建築／作物仍帶一層冷灰，屬全景 grade，不是 ground 漏染。V2-P2-02 **部分緩解、未根除**。

**結論：V2 🥈 成立。** 靜圖放大農田時，「雪地斑點／雨濕紋」比純 scene 濾鏡更像世界。仍 **不是** 濕土／雪地 **terrain frame** 換磚。

### 1.5 🥉 商店三連圖腳本

| 元件 | 狀態 |
|------|------|
| `applyPromoScene(id)` | spring／summer／autumn／winter；固定 12 格 ready atlas 作物、季／天氣、鏡頭 `t7_3`、關 modal、`data-promo-scene` |
| `html[data-promo-scene]` | 藏助手／血條／qmarker／觸控預覽 — **裁切乾淨** |
| `scripts/capture-promo-trio.js` | 起 local server → chromium → `#mapScene` screenshot |
| 成品路徑 | `references/promo/r57-20260713-1/{spring,summer,winter}.png` |
| 尺寸 | **738×373** RGB（三張一致） |
| e2e | 12 格、`!cropEmoji`、overflow≤2、地標幀、ground 靜讀 |

Fixture 作物對齊 V1／V2 腳本意圖：

| 場景 | 季／天氣 | 作物 |
|------|----------|------|
| spring | 春 clear | radish + pea |
| summer | 夏 sunny | sunflower + corn + bell_pepper |
| winter | 冬 snow | winter_kale |
| autumn | 秋 clear（e2e／API 有，**未截入 promo 三連**） | sweet_potato + grapes + pumpkin |

**結論：V2 🥉 成立。** 失敗條件「地圖出現系統 emoji 作物」在 fixture 與 e2e 雙鎖下已拒收。

### 1.6 crops4 一致性修正

開圖對照（R57 atlas）：

| 項 | R56 取向（V2 評） | R57 | 判決 |
|----|-------------------|-----|------|
| radish ready | 單大紅根＋葉 | **主根 + 右側副根**、莖分叉、多葉、碎 hi | ✅ 遠讀更像「一叢根菜」 |
| sunflower ready | 花盤 radius 6 偏大黃盤 | **radius 5** + 更多莖葉承載細節 | ✅ 質量感更貼 crops 系 |
| 葉 hi | 較平 | 多 1px 碎亮 | 微升 |
| 土台 | 細條 | 仍細條（crops3 系） | 未變家族 |
| 管線 | 48×48×5、anchor 0.5/0.9 | 同 | ✅ |

與 `crops-48`（AI 主幹）並肩：細節密度仍 **crops1 > crops4 ≈ crops3**；與「emoji 斷裂」比已是另一個數量級問題。  
**同框可用性維持 V2 的通過判決**；本輪是 polish，不是救火。

### 1.7 Codex 宣稱逐條對表

| Codex（`CODEX_RESPONSE_farm_V2`） | 監工 |
|----------------------------------|------|
| oak／bush 6 幀並依季節切換 | **部分偏完整**：切換機制 + oak 曝光完整；bush_big 幀在主地圖曝光弱 |
| 地面季相與雨濕／雪斑限 `#groundLayer` | **成立** |
| 角色與作物不吃地面染色 | **對 ground 層成立**；scene blend 仍可能全景染色 |
| 固定鏡頭、12 格成排 atlas 三連圖 | **成立**（秋有 fixture、未出 PNG） |
| crops4 副根／縮花盤／validators | **成立**（靜態開圖 + validate REQUIRED） |
| `radish.emoji` UI 幼苗、地圖強制 crops4 | **成立** |
| perf-low／reduced-motion | **成立** |
| 版本 r57、舊版 runtime 0 | **成立**（主錨） |
| 規則經濟未動 | **成立** |
| 測試全綠（Codex 自述） | 本輪監工 **未重跑** npm test／e2e；以 diff 內 e2e 斷言與管線完整性為準 |

---

## 2. Promo 三連圖品質評語（核心收官材料）

### 2.1 總表

| 圖 | 檔案 | 季／天（fixture） | 一眼可讀賣點 | 品質評語（1–5） |
|----|------|-------------------|--------------|----------------:|
| 春 | `spring.png` | 春／clear | 白花粉橡樹 + 紅根蘿蔔田 | **4.0** |
| 夏 | `summer.png` | 夏／sunny | 金暖地色 + 向日葵／玉米成排 | **4.2** |
| 冬 | `winter.png` | 冬／snow | 霜樹 + 冷灰 + 雪粒／地斑 + 甘藍田 | **4.3** |

三張 **色調與地標可分**，滿足「不看 HUD chip 也能分季」的 V2 驗收句。  
**零地圖 emoji 作物** — V-P0 在宣傳成品上保持關閉。

### 2.2 逐張評語

#### 春 `spring.png`

- **優**：畫面上方與近景橡樹呈 **春花冠**；12 格 radish／pea 成排，crops4 紅根遠讀 OK；草地仍偏「春末嫩綠」，與粉花地標相乘有效。
- **優**：無種子列 🔴、無系統 🌻；建築／NPC 與作物同宇宙。
- **弱**：中景大片空草；目標圖的野花密度、圍籬、水體、雙田構圖都沒有 → **像「系統截圖」勝過「編導海報」**。
- **弱**：春樹是「綠底撒白粉」不是目標圖實心粉櫻；夢幻 CTR 符號弱一階。
- **弱**：738×373 偏小；商店列表放大後像素可接受（pixel art），但裁切資訊量有限。

#### 夏 `summer.png`

- **優**：**最像「有在種田的農場」** — 向日葵金盤 + 玉米交替成排，對齊 V1 目標構圖的黃花田位；scene／ground 金綠暖 grade 強。
- **優**：橡樹回 base 綠，靠作物與光色分季，邏輯正確。
- **弱**：同樣中下大片空地；雞舍／畜舍／NPC 在，但缺乏目標圖的河、橋、圍欄動物區敘事密度。
- **弱**：sunny 靜態高光在小圖上偏「整片暖黃」，與「角光 vignette」理想略糊成一層 — 仍明顯優於 r55。

#### 冬 `winter.png`

- **優**：**三張中季節反差最強** — 霜藍橡樹、雪點粒子、冷灰 scene、地層雪斑；甘藍 crosp3 成排語意正確。
- **優**：promo 專用略降雪層 opacity，避免死白；建築紅頂仍可辨，未完全被 saturation 吃掉。
- **弱**：草地 pixel 仍是綠 tile + 冷罩，不是「雪覆蓋地形」；放大農土格仍偏乾。
- **弱**：全景冷灰讓向日葵以外的暖色道具略悶 — 可接受的冬 grade 代價。

### 2.3 三連圖作為「商店輪播」的編導分

| 維度 | 分（1–5） | 說明 |
|------|----------:|------|
| 季節可分性（無 HUD） | **4.5** | 樹＋色＋作物三位一體 |
| 作物像素誠信 | **5.0** | 全 atlas，無 emoji 田 |
| 構圖／密度 | **2.5** | 空草多、單田一區、缺水景與圍籬層次 |
| 解析度／輸出規格 | **3.0** | 一致但偏小；僅 mapScene 裁切 |
| 與目標圖距離 | **2.5** | 語言同系 cozy pixel，內容密度差一截 |
| 可重製性／回歸 | **5.0** | 腳本 + e2e + 版本目錄 |
| **綜合 promo 成品** | **3.8** | **可上架作「真實遊戲畫面」**；難當「旗艦 key art」 |

### 2.4 拒收／放行

| 條件 | 結果 |
|------|------|
| 地圖系統 emoji 作物 | **放行**（無） |
| 三季靜照不可分 | **放行**（可分） |
| crops4 明顯 bug 幀（紅點／巨大黃盤） | **放行**（已修） |
| 僅 UI chip 假裝有季節 | **放行**（世界有證據） |

**監工放行：三連圖可作為 r57 宣傳基線入庫。** 建議下一輪若重拍：加秋卡、略抬 camera 資訊密度（或 fixture 多放 structures／野花）、輸出至少 1280 寬或 2× deviceScaleFactor。

---

## 3. 氛圍與一致性重評（V1→V3）

| 維度 | V1 | V2 | **V3** | 說明 |
|------|---:|---:|-------:|------|
| 像素主體（角色／建築／主作物） | 3.5 | 3.5 | **3.6** | 主幹未重畫；crops4 polish 微升 |
| 作物全集一致性 | 2.0 | 4.0 | **4.2** | ready 可讀性↑ |
| 天氣可玩提示 | 3.0 | 3.5 | **3.7** | ground 錨點 |
| 天氣靜照可讀 | 1.5 | 3.0 | **3.6** | 雪斑／雨紋入地 |
| 季節世界表達 | 1.0 | 3.0 | **4.0** | **季相樹是關鍵跳升** |
| 光影／時刻 | 1.0 | 1.0 | **1.0** | 仍無 |
| 對標 cozy RPG 目標圖 | 2.0 | 3.0 | **3.4** | 地標＋示範田；密度仍缺 |
| 宣傳可重製性 | — | 1.0 | **4.5** | 腳本化三連圖 |

---

## 4. 視覺總分 1–10（收官）

### 4.1 評分定義（本文件口徑）

| 分帶 | 意義 |
|------|------|
| 1–3 | 原型／混搭破綻明顯，不宜公開宣傳圖 |
| 4–5 | 可內部 demo；商店圖需大量免責 |
| 6–7 | **可軟上架**；真實遊戲畫面能撐文案，仍見內容／密度缺口 |
| 8–9 | 接近目標圖語言；商店 CTR 主力靠遊戲內截圖即可 |
| 10 | 目標圖級內容密度 + 全季節地形換裝 + 統一光影 |

### 4.2 加權總分

| 權重維度 | 權重 | 分（1–10） | 加權 |
|----------|-----:|-----------:|-----:|
| 地圖像素誠信（無 emoji 混搭、atlas 同框） | 25% | **8.5** | 2.13 |
| 季節／天氣靜照可讀（世界層） | 25% | **7.5** | 1.88 |
| 宣傳成品（三連圖編導與輸出） | 20% | **6.5** | 1.30 |
| 與目標圖／品類期望的內容密度 | 20% | **5.5** | 1.10 |
| 管線可重製／不回歸（腳本・e2e・版本） | 10% | **9.0** | 0.90 |
| **加權總分** | 100% | | **≈ 7.3** |

**收官視覺總分：7.2／10**（敘事取整；工程誠信略拉高、內容密度略拉低 → 報告主分 **7.2**）。

### 4.3 一句定位

> **「誠實的中上像素農場」**：系統與 atlas 管線已產品化，四季有畫面證據，宣傳圖不再靠謊；尚未成為目標圖那種「處處有花、有水、有籬、有故事密度」的旗艦 cozy 場景。

---

## 5. 剩餘最大缺口（收官後只留真問題）

### 5.1 最大缺口（單一排序）

#### 🥇 世界內容密度與佈局敘事（非再一層濾鏡）

- **現象**：promo 與實機主畫面中景空草比例高；目標圖有雙田圍籬、溪流、橋、畜欄、井、工具散景、野花簇。
- **為何是最大缺口**：R55–R57 已把 **誠信（emoji）** 與 **grade（季／天）** 補齊；玩家／商店審核者下一眼會問的是 **「這農場好不好玩、好不好看的豐富」**，不是「還有沒有 🔴」。
- **不是**再調 `opacity` 能解決；需要 layout／props 密度、可選地形裝飾、或 promo fixture 更積極擺設既有 atlas（花床、乾草、路燈、果樹）。
- **嚴重度**：V-P1（宣傳 CTR／品類期望），非經濟 P0。

#### 🥈 地形 tile 仍「四季同磚」

- 草／土／水 atlas 不換季；冬雪是 CSS 斑點不是雪地 brick。
- 季相樹再漂亮，腳下仍在「永遠春天的草」上站霜樹 → 放大截圖時上限被鎖。
- 方向：少數 `grass_winter`／`soil_wet` frame，或 ground 上更局部的 edge 雪，而非再加全螢幕 blend。

#### 🥉 細節密度階梯 + 未用季相資產

- crops1（AI）≫ crops2／3／4（標誌化）；可同框但不夠「旗艦均一」。
- `bush_big_*` 與多種 structures 裝飾 **資產在庫、主地圖曝光低**；props `bush` 不參與季相。
- scene 級秋 `color`／冬 `saturation` 仍可能染角色（V2-P2-02 殘）。

### 5.2 刻意不再列為「本階段主線」者

| 項目 | 原因 |
|------|------|
| 地圖 emoji 作物 | **已關閉**（維持禁止重開） |
| 無任何季節表達 | **已關閉** |
| 天氣純粒子、靜照空白 | **已明顯改善** |
| 全日夜＋方向光 | 高成本；非放置核心；排在密度之後 |
| 種子列全面 atlas icon | 鉻層可接受；ROI 低於世界密度 |

### 5.3 殘留清單（非阻擋）

| ID | 嚴重度 | 說明 |
|----|--------|------|
| V3-P2-01 | V-P2 | `bush_big_*` 主地圖曝光不足 |
| V3-P2-02 | V-P2 | `#mapScene` 秋／冬 blend 仍染全景 |
| V3-P2-03 | V-P2 | terrain 無真濕土／雪地 frame |
| V3-P2-04 | V-P2 | crops 細節階梯 crops1 > 2/3/4 |
| V3-P2-05 | V-P2 | promo 無秋卡；輸出 738×373 偏小 |
| V3-P2-06 | V-P2 | promo 構圖空曠，未挖滿既有 props |
| V3-P2-07 | V-P2 | 無光影／時刻系統 |
| V3-P2-08 | V-P2 | 春樹花點 ≠ 目標實心粉櫻（風格選擇） |
| V3-P2-09 | V-P2 | e2e 驗 DOM／CSS 計算值，非像素快照回歸 |

---

## 6. 總評與監工結論

| 面向 | 判決 |
|------|------|
| V1 V-P0（地圖 emoji） | **維持關閉** |
| V2 🥇 季相地標 | **主路徑關閉**（oak）；bush 資產備而未顯 |
| V2 🥈 地面天氣／季相錨點 | **關閉** |
| V2 🥉 三連圖腳本 | **關閉** |
| crops4 polish | **通過** |
| Codex 施工誠信 | **通過** — 無暗改經濟；版本／e2e／生成器對齊 |
| 是否可軟上架宣傳 | **可以** — 用 `references/promo/r57-20260713-1` 作基線 |
| 是否達目標圖旗艦 | **否** — 差在密度與地形真實感 |
| **視覺總分** | **7.2／10** |
| **剩餘最大缺口** | **世界內容密度／佈局敘事**（其次：terrain 季相真磚） |
| 本輪是否改碼 | **否**（只審不改） |

### 監工立場（收官）

R55–R57 視覺主線是一條 **單位成本正確的修復弧**：

1. **R56**：補像素身分 + 常駐季／天 grade  
2. **R57**：補可換裝地標 + 地面靜讀 + 可重製宣傳證據  

至此，**「四季天氣農場」文案不再只有系統、沒有畫面**。  
收官後若還要加分，應把預算從「再一層 CSS」轉向 **把已有 atlas 種進世界、讓 truncation 後的截圖仍然滿**——那是 7.2 → 8+ 的路徑。

**V3 收官：本輪視覺 P0／主 V-P1 可結案；剩餘為內容密度與地形真實感的下一階段，而非未完成的 R57 交付。**

---

## 附錄 A — 關鍵索引

| 主題 | 位置 |
|------|------|
| 季相生成 | `tools/generate-seasonal-structures.py` |
| 季相資產 | `assets/generated/v4/structures-nature.png`／`.json`（`oak_*`／`bush_big_*`） |
| 切幀 | `src/ui.js` `seasonalStructureFrame`／`updateSeasonAmbient` → `buildStaticObjects` |
| 地面靜讀 | `index.html` `#groundLayer::before`／`::after` |
| promo fixture | `src/ui.js` `applyPromoScene` |
| 截圖腳本 | `scripts/capture-promo-trio.js`（`npm run promo:capture`） |
| 成品 | `references/promo/r57-20260713-1/` |
| crops4 | `tools/generate-crops4-atlas.py`、`assets/generated/v4/crops4-48.png` |
| e2e §29 | `scripts/test-rpg-v4-e2e.js` |
| V2 開單 | `docs/GROK_REVIEW_farm_V2.md` |
| Codex R57 回應 | `docs/CODEX_RESPONSE_farm_V2.md` |
| 視覺目標 | `references/visual-targets/rpg-desktop-scene-target.png` |

## 附錄 B — 作物渲染身分（r57，無變更結構）

| id | 視覺身分 |
|----|----------|
| wheat…pumpkin | atlas `crops` |
| bell_pepper…melon | atlas `crops2` |
| pea…winter_kale | atlas `crops3` |
| radish | atlas `crops4`（UI emoji **🌱**） |
| sunflower | atlas `crops4`（UI emoji 🌻） |

## 附錄 C — 三連圖速查

| 檔 | 尺寸 | 預期地標幀 |
|----|------|------------|
| spring.png | 738×373 | `oak_spring` |
| summer.png | 738×373 | `oak` |
| winter.png | 738×373 | `oak_winter` |

*文件結束。視覺監工 V3 收官審 — 只審不改。*
