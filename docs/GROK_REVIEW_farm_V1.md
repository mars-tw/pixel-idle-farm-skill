# Grok 視覺品質監工 — 像素農場 V1（r55 / v4 atlas）

- **專案**：pixel-idle-farm-skill（《阿軒割割陽光農場》PWA / vanilla JS）
- **版本錨點**：`package.json` → `appVersion: r55-20260712-1`；工作樹 HEAD 約 `80a59c3`
- **審查角色**：視覺品質監工（像素一致性 × 氛圍層 × 宣傳截圖 ROI）
- **方法**：靜態讀碼（`config.js` / `ui.js` / `index.html` / atlas JSON）＋實際檢視 v4 作物／地形 atlas 點陣圖＋對照 `references/visual-targets/rpg-desktop-scene-target.png` 與 `artifacts/rpg-rework-desktop.png`
- **範圍**：**只審不改**；產出本文件。不改遊戲程式／測試／資源／經濟規則
- **優先級**（視覺／宣傳語境，非經濟 P0）：
  - **V-P0**：宣傳主畫面一眼看出「未完成／混搭」的破綻
  - **V-P1**：氛圍層讀不出季節／天氣，截圖與商店頁賣點脫節
  - **V-P2**：次級 UI 後備、風格微差、可選 polish

---

## 0. 執行摘要

| # | 主題 | 結論 | 嚴重度 |
|---|------|------|--------|
| 1 | v4 atlas 主幹作物一致性 | **成立** — `crops` / `crops2` / `crops3` 同為 48×48、5 階段、暖棕輪廓＋土台，可同框 | — |
| 2 | `radish` / `sunflower` emoji-only | **明顯違和** — 地圖上走系統字形 emoji，且櫻桃蘿蔔用 **🔴** 而非蘿蔔語意 | **V-P0** |
| 3 | 種子列／訂單／HUD 全作物 emoji | **可接受後備**（UI 鉻層）；問題在**世界地圖物件層**混搭 | V-P2（地圖外） |
| 4 | 天氣視覺 | **有動有效果、靜照偏弱** — CSS 粒子／漸層在動畫面可讀，靜態宣傳截圖幾乎只剩淡色罩 | **V-P1** |
| 5 | 季節氛圍 | **幾乎只有 HUD + 1 秒 wash** — 草地／天空／地形不隨季變色 | **V-P1** |
| 6 | 對照視覺目標 | 目標圖有春櫻、成排黃花／根菜田、暖光；現況年年同綠＋兩株 emoji 作物 | V-P1 |

**一句話**：v4 像素農場的「主菜」已經像一款遊戲；宣傳截圖仍會被 **兩株 emoji 作物** 與 **無持久季節／天氣色調** 拉回原型感。

---

## 1. 像素美術一致性（atlas vs emoji）

### 1.1 現況資產分層（作物）

| 來源 | 作物 | 渲染路徑（地圖 `updateMap`） | 備註 |
|------|------|------------------------------|------|
| `assets/generated/v4/crops-48` | wheat / carrot / tomato / strawberry / corn / pumpkin | `Atlas` frame `{id}_{stage}` | 最完整、AI 生成感最重，五階段辨識度高 |
| `crops2-48` | bell_pepper / potato / grapes / melon | 同上，`sheet: "crops2"` | 同語言；成熟色塊略簡，仍可同框 |
| `crops3-48` | pea / sweet_potato / winter_kale | 同上，`sheet: "crops3"` | 程序化腳本（`generate-crops3-atlas.js`），色板刻意對齊 outline/soil；略扁、略塊，**仍屬同一像素家族** |
| **emojiOnly** | **radish** / **sunflower** | `addEmojiObjectPx` → `.ob.emoji-ob` | **脫離 atlas 管線** |

設定證據（`src/config.js`）：

- `radish`：`emoji: "🔴"`, `emojiOnly: true`, 春、Lv5
- `sunflower`：`emoji: "🌻"`, `emojiOnly: true`, 夏、Lv6

渲染閘門（`src/ui.js` `updateMap`）：

```text
hasFrame = !crop.emojiOnly && Atlas.getFrame(sheet, frame)
→ 有 frame：addObjectPx（pixelated atlas）
→ 否則：addEmojiObjectPx（系統 emoji 字型 + drop-shadow）
```

`validate-v4-atlas.js` 明確 `if (crop.emojiOnly) continue` — 管線**正式豁免**這兩株，不是意外漏圖。

### 1.2 混搭違和感（嚴重度排序）

#### V-P0-01　世界地圖上 emoji 與 pixel 同層 y-sort

- **現象**：農土上小麥／胡蘿蔔是 48px 暖色像素株；隔壁櫻桃蘿蔔是 **紅色實心圓 emoji**、向日葵是 **黃花 emoji**。
- **為何傷宣傳**：
  1. **解析度語言衝突**：emoji 抗鋸齒、圓角、平台字型（Windows Segoe / iOS Apple Color Emoji）與 `image-rendering: pixelated` 硬邊衝突。
  2. **陰影語意不同**：`.ob.emoji-ob` 用 CSS `drop-shadow`；atlas 作物多半自帶腳底土台／像素陰影，並肩時「浮」感不一致。
  3. **成長表演斷裂**：emoji 路徑 stage≤1 全是 🌱，stage≥2 直接跳到成品 emoji；atlas 有 seed→sprout→young→mature→ready 可讀弧線。截圖若抓「半熟田」，emoji 作物沒有中段姿態。
- **櫻桃蘿蔔特別傷**：`🔴` 不是植物，是 UI 指示色。成熟田看起來像「地上放了紅點／錯誤標記」，比缺圖更糟。
- **向日葵次傷但更高宣傳價值**：🌻 語意正確，卻是夏日市集偏壓與「河岸甜椒週」招牌作物；字段裡一排 emoji 向日葵會直接寫進商店預覽的「未完成」判讀。

#### V-P0-02　內容路線把 emoji 當合法佔位，但已進主循環

- `docs/CONTENT_PLAN_farm_R1.md` 允許「新作物優先 emoji 後備」。
- `scripts/test-economy.js` 把 `emojiOnly` 寫成 **P0 斷言**（經濟身份鎖定），美術仍停在佔位。
- 季節訂單偏壓、NPC pool 已大量引用 `radish` / `sunflower` → **玩家中後期會穩定看到混搭**，不是邊緣內容。

#### V-P2-01　種子列／資源列本來就是 emoji 鉻層

- `renderSeeds` 一律 `<span class="se">${c.emoji}</span>` — 連 wheat 也用 🌾。
- 天氣／季節 chip 用 ⛅🌧️🌸☀️ 等。
- **判定**：商店截圖若裁「地圖主畫面」，種子列小 emoji 可接受（Stardew 類產品常見 icon 與 world art 分層）。**不要**把種子列 emoji 與地圖 emoji-crop 混為同一嚴重度。

#### V-P2-02　legacy 農地 grid（`#farm` / `updateFarm`）

- 仍保留 `crop-sprite`（舊 sheet 列）vs `crop-emoji` 雙路徑；`emojiOnly` 與 `sheet` 作物在此也走 emoji。
- 現行主玩法是 RPG `#mapScene`；legacy grid 若仍露出，會加重混搭，但宣傳主視覺應以地圖為準。

### 1.3 atlas 內部風格健康度（通過項）

| 檢查項 | 結果 |
|--------|------|
| 畫框規格 | 48×48、anchor 約 (0.5, 0.9)、五階段命名一致 |
| 輪廓／土台 | 暖棕 outline + 小土條；crops3 色板常量對齊 |
| 成熟可讀性 | 金麥穗、橙蘿蔔、紅番茄、南瓜、甜椒色塊、葡萄串皆可遠讀 |
| 與地形 | terrain-organic 草地／土／水為 32px 軟邊，作物疊上合理 |
| 與角色／建築 | 角色 48×64、建築 atlas 同為 cozy pixel；作物尺度約 0.92 TILE 可接受 |

**次要微差（不擋宣傳）**：`crops` 細節密度 > `crops2` > `crops3`。crops3 較「標誌化」但同色溫；**遠不如 emoji 斷裂嚴重**。不建議為此重畫全表，除非要做付費美術 pass。

### 1.4 對照視覺目標

`references/visual-targets/rpg-desktop-scene-target.png`：

- 成排根菜（紫紅球根＋綠葉）、黃花作物田、春櫻樹、成片野花。
- 全畫面**零 emoji**；光是暖午後、草地有冷暖變化。

現況（`artifacts/rpg-rework-desktop.png` 與程式現況）：

- 地形方、綠單一；作物若全 atlas 尚可，一旦種 radish/sunflower 立刻破功。
- 目標裡「向日葵／根菜成排」正是現在兩株 emoji 的空缺位。

---

## 2. 農場氛圍層（天氣／季節 · 光影／色調）

### 2.1 已有能力盤點

| 層級 | 實作 | 持久？ | 靜照可讀？ |
|------|------|--------|------------|
| 天氣粒子／罩層 | `#weatherLayer` class：`rain` `sunny` `windy` `fog` `snow` `storm`（`clear` 清空） | 天氣段內是 | **弱**（雨線／雪點動畫；靜照常只剩淡 multiply） |
| 天氣 HUD | 資源列 emoji + 名稱 | 是 | 中（靠 UI 標籤，不靠畫面） |
| 季節 HUD | `season-chip` 名＋倒數 | 是 | 中 |
| 季節轉場 | `seasonTransitionFx` 全螢幕 `season-wash` 1s | **否**（僅過渡） | 幾乎不入宣傳照 |
| 當季種子 badge | `.seed-season.active` | UI | 與地圖無關 |
| 地形季節重色 | **無** | — | 否 |
| 日夜／方向光 | **無** | — | 否 |
| 頁面／場景底色隨季候 | body 固定 `--sky-1/2`；`#mapScene` 固定綠漸層 | 固定 | 永遠「晴朗春末」 |

天氣 CSS 本質（`index.html`）：

- 雨／暴雨：斜線 repeating-gradient + 深藍 multiply
- 豔陽：暖色 soft-light + 幾顆 screen 光斑
- 微風：淡綠條紋滑動
- 晨霧：白綠薄霧
- 雪：1–2px 白點 + 冷藍罩

`perf-low` 會關掉動畫並稀釋粒子 — 低階裝置上天氣更「像淡濾鏡」。

### 2.2 缺口（對宣傳截圖的意義）

#### V-P1-01　季節沒有「落地」到世界色調

- 邏輯季節（春夏秋冬、20 分鐘一輪、訂單偏壓、事件卡）很完整。
- 視覺季節 ≈ **頂欄一顆 emoji** + **偶爾 1 秒色洗**。
- 結果：截「冬季霜葉鍋物」與「夏季河岸甜椒週」的地圖底圖幾乎同一張綠。玩家／商店審核者**無法從靜圖讀出季節賣點**。

建議方向（僅審，不實作）：

1. **`#mapScene` / `#groundLayer` 季節 CSS 變數**  
   - 春：綠偏青＋輕粉高光  
   - 夏：高飽和、偏金  
   - 秋：hue 偏暖橙、略降綠  
   - 冬：desaturate + 冷藍、略亮  
   用 `filter` 或半透明 multiply 層即可，**零新 atlas**。
2. **structures-nature 季節變體（中成本）**：櫻／綠／紅葉／枯枝 — 對標目標圖粉樹；ROI 高但需出圖。
3. **wash 改「短過渡 + 長 ambient」**：轉季 wash 後留下 `data-season` 常駐罩，而非 opacity→0 消失。

#### V-P1-02　天氣在靜照上「認不出」

- 動畫雨線在 GIF／實機漂亮；**PNG 宣傳圖**常常只剩 10–20% 透明度色罩，與 clear 難分。
- `clear` 完全無層 → 與 `sunny` 差異全靠幾顆光斑；小圖更糊。
- 沒有「地面濕反光／積雪 edge／樹葉搖曳」等**靜態錨點**（可不做全動畫，至少要有可靜讀的 grade）。

建議方向：

| 天氣 | 低成本靜讀強化 |
|------|----------------|
| rain / storm | 加深 multiply + 地磚略暗藍；角落雨幕 opacity 提高（靜照仍可見） |
| sunny | 左上暖 vignette + 輕 contrast；可選「光柱」假陰影方向 |
| fog | 提高整體 haze，壓遠景對比（地圖邊緣霧帶） |
| snow | 冷級 + 白 edge；未來可疊 terrain 雪斑 frame |
| windy | 靜照最難；可接受用 UI 標籤 + 微斜紋，勿過度投資 |
| clear | 給極淡環境光，避免「沒天氣＝沒美術」 |

#### V-P1-03　光影系統缺席

- 無統一光源方向；角色 `drop-shadow` 與作物土台各做各的。
- 無時間帶（晨昏／夜晚）— 對放置農場非必須，但 **「黃金時刻截圖」** 是商店 CTR 常見技巧；目前只能靠系統截圖時的螢幕亮度。
- 目標圖的午後暖光／水面高光，現況水域偏平（terrain 純色藍塊）。

#### V-P2-03　天氣與季節正交但視覺未組合

- 規則上可「冬 + 雨」等；視覺上兩套 class 若未來疊加，需定義 **season grade × weather grade** 乘積，避免雙濾鏡過曝。現在季節幾乎不套地圖，尚未爆，但做 ambient 時要先定層級（建議：season 底調 × weather 疊層）。

### 2.3 氛圍評分（1–5，宣傳向）

| 維度 | 分 | 說明 |
|------|---:|------|
| 像素主體（角色／建築／主作物） | 3.5 | v4 已達「可公開 demo」 |
| 作物全集一致性 | 2.0 | 兩株 emoji-only 拖垮整田 |
| 天氣可玩提示 | 3.0 | 動畫面 OK |
| 天氣靜照可讀 | 1.5 | 宣傳圖弱 |
| 季節世界表達 | 1.0 | 幾乎只有 UI |
| 光影／時刻 | 1.0 | 無系統 |
| 對標 cozy RPG 目標圖 | 2.0 | 骨架在，氛圍與作物完整度未到 |

---

## 3. 宣傳截圖標準下 — 3 個最划算下一步

評估軸：**截圖瞬間收益 ÷ 工程／美術成本**（不改經濟、不開新系統為佳）。

### 🥇 下一步 1 — 關閉 `radish` / `sunflower` 的 emojiOnly（出 2×5 幀 atlas）

| 項 | 內容 |
|----|------|
| **嚴重度** | V-P0 |
| **做法** | 新增 `crops4-48`（或併入擴充 sheet）：`radish_*` / `sunflower_*` 各 seed→ready；`config` 改 `sheet`、移除 `emojiOnly`；沿用 `generate-crops3-atlas.js` 程序化色板 **或** 小幅 AI sheet + process-v4 |
| **整合點** | 既有 `updateMap` / `validate-v4-atlas` 已支援 sheet；測例改「有 frame」而非 `emojiOnly === true` |
| **成本** | **低～中**（10 幀；程序化可 0.5–1 日，含調色；AI 產線約 1 日含裁切驗證） |
| **宣傳收益** | **極高**。夏日向日葵田、春日紅蘿蔔成排是目標圖與商店縮圖的「內容密度」符號；消掉 🔴／🌻 混搭等於消掉「未完成」標籤 |
| **不做的代價** | 任何含季節市集／中後期田的截圖都可能中槍 |

**額外小刀**：即便暫時不重畫，也應把 `radish.emoji` 從 `🔴` 改成語意植物（如 大根／櫻桃蘿蔔近似 emoji）— 仍是 emoji，但降低「紅點 bug」誤讀（屬止血，**不能**取代 atlas）。

### 🥈 下一步 2 — 常駐季節色調（`data-season` ambient，零新圖）

| 項 | 內容 |
|----|------|
| **嚴重度** | V-P1 |
| **做法** | `updateSeason`／render 時設 `#mapScene`（與可選 `document.body`）`data-season="春|夏|秋|冬"`；CSS：`#groundLayer` 或 scene 遮罩 `filter` / 半透明 gradient；保留現有 1s wash 作轉場 peak |
| **成本** | **極低**（半日含四套色票試玩與 low-perf 關閉 animation 相容） |
| **宣傳收益** | **高**。同一存檔四張季截圖可當商店輪播；文案「四季農場」第一次有畫面證據 |
| **注意** | 勿過重 filter 導致像素糊（優先 multiply 色層，其次 hue-rotate）；perf-low 用靜態較淡版本 |

### 🥉 下一步 3 — 天氣「靜照可讀」級色罩（強化現有 `#weatherLayer`，少做粒子）

| 項 | 內容 |
|----|------|
| **嚴重度** | V-P1 |
| **做法** | 提高 rain/storm/snow/fog/sunny 的 **after 層不透明與對比**；`clear` 給極淡環境；可選 `#mapScene` 外框光暈跟天氣色；粒子動畫維持但**不依賴粒子當唯一訊號** |
| **成本** | **低**（CSS 調參 + e2e 既有 class 斷言仍過） |
| **宣傳收益** | **中高**。可產出「雨中收成」「雪季訂單」差異圖；與步驟 2 正交可乘算 |
| **注意** | 與季節 ambient 分層（season base × weather overlay）；避免雙乘變泥 |

### 刻意不進 Top 3（高成本或次 ROI）

| 項目 | 原因 |
|------|------|
| 全圖日夜循環 + 方向光 | 氣氛佳，但 shader／多層 shadow 成本高，且放置節奏非核心 |
| 全季節樹／花 atlas 變體 | 對標目標圖很美，但出圖＋ layout 遠高於色調層；排在 emoji  cro p 與 ambient **之後** |
| 種子列全面改 atlas icon | 宣傳主裁切在地圖；ROI 低於世界作物 |
| 重畫 crops2/3 對齊 crops1 細節 | 微差可接受；機會成本應給 radish/sunflower |
| 真雪地砖／濕土專用 frame | 加分項；可在步驟 3 之後當 V2 |

---

## 4. 建議的「商店三連圖」腳本（驗證上述步驟有效）

實作後用同一鏡頭（農舍前農土 + 角色半身入鏡）拍：

1. **春 · 晴**：成排 atlas 櫻桃蘿蔔 + 豌豆；粉綠 ambient  
2. **夏 · 豔陽**：向日葵 + 甜椒／玉米；金暖 ambient + sunny 罩  
3. **冬 · 雪或霧**：冬羽甘藍 + 冷色 ambient；證明季節不是只有 chip  

若第 1 張仍出現 🔴／🌻，則步驟 1 未完成，勿上架該組圖。

---

## 5. 總評與監工結論

| 面向 | 判決 |
|------|------|
| v4 atlas 體系是否可當產品主美術 | **可以** — 主幹作物／地形／角色已同宇宙 |
| 目前最大視覺誠信破口 | **`emojiOnly` 的 radish（🔴）與 sunflower（🌻）上地圖** |
| 氛圍層是否撐得起「四季天氣農場」文案 | **尚未** — 系統有、畫面幾乎無持久表達 |
| 最划算修復序 | **(1) 兩作物 atlas → (2) 季節 ambient → (3) 天氣靜照級色罩** |
| 本輪是否改碼 | **否**（只審不改） |

**監工立場**：r55 工程與系統完成度已高；視覺上不需要「再做一套大美術」，而需要 **補齊兩株公開作物的像素身分**，並用 **CSS 級色調把既有季節／天氣規則畫進靜圖**。這三步是宣傳截圖標準下單位成本最高的提升。

---

## 附錄 A — 關鍵程式／資產索引

| 主題 | 位置 |
|------|------|
| 作物定義含 emojiOnly | `src/config.js` `CROPS.radish` / `CROPS.sunflower` |
| 地圖作物渲染分流 | `src/ui.js` `updateMap`（`hasFrame` / `addEmojiObjectPx`） |
| emoji 物件樣式 | `index.html` `.ob.emoji-ob` |
| 天氣層 | `index.html` `#weatherLayer.*`；`src/ui.js` `updateWeatherLayer` |
| 季節 wash | `src/ui.js` `FX_SEASON_COLORS` / `seasonTransitionFx` |
| crops3 程序化 | `scripts/generate-crops3-atlas.js` |
| atlas 驗證跳過 emojiOnly | `scripts/validate-v4-atlas.js` |
| 視覺目標 | `references/visual-targets/rpg-desktop-scene-target.png` |

## 附錄 B — 作物渲染身分一覽（審查時點）

| id | 名稱 | 視覺身分 |
|----|------|----------|
| wheat | 小麥 | atlas crops |
| carrot | 胡蘿蔔 | atlas crops |
| tomato | 番茄 | atlas crops |
| strawberry | 草莓 | atlas crops |
| corn | 玉米 | atlas crops |
| pumpkin | 南瓜 | atlas crops |
| **radish** | **櫻桃蘿蔔** | **emoji 🔴 only** |
| bell_pepper | 甜椒 | atlas crops2 |
| potato | 馬鈴薯 | atlas crops2 |
| **sunflower** | **向日葵** | **emoji 🌻 only** |
| grapes | 葡萄 | atlas crops2 |
| melon | 溫室甜瓜 | atlas crops2 |
| pea | 豌豆 | atlas crops3 |
| sweet_potato | 地瓜 | atlas crops3 |
| winter_kale | 冬羽甘藍 | atlas crops3 |

---

*文件結束。視覺監工 V1 — 只審不改。*
