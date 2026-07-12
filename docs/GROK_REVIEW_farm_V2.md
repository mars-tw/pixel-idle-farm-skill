# Grok 視覺品質監工 V2 — 像素農場 R56 覆核

- **專案**：pixel-idle-farm-skill（《阿軒割割陽光農場》PWA / vanilla JS）
- **Base**：`80a59c3`（r55 / `r55-20260712-1`）
- **Head**：`5b4b6b1`（`r56-20260713-1`）
- **完整 HEAD**：`5b4b6b1d626de75365817fb3a35d556d1f8bd940`
- **版本錨點**：`package.json` → `appVersion: r56-20260713-1`
- **前輪**：`docs/GROK_REVIEW_farm_V1.md`（視覺 V-P0／V-P1 開單）→ `docs/CODEX_RESPONSE_farm_V1.md`（Codex 施工宣稱）
- **審查角色**：視覺品質監工（像素一致性 × 氛圍層 × 宣傳截圖 ROI）
- **方法**：`80a59c3..5b4b6b1` unified diff 全文 + 現況原始碼靜態讀碼 + 實際檢視 `crops`／`crops2`／`crops3`／`crops4` 點陣圖 + 對照 `references/visual-targets/rpg-desktop-scene-target.png` + 色板／anchor／管線交叉
- **範圍**：**只審不改**；產出本文件。不改遊戲程式／測試／資源／經濟規則
- **優先級**（視覺／宣傳語境）：
  - **V-P0**：地圖層仍混搭 emoji／宣稱完全不成立
  - **V-P1**：季節／天氣靜照仍讀不出、crops4 與主幹同框明顯斷裂
  - **V-P2**：細節密度微差、UI 鉻層 emoji、blend 尖角、下輪 ROI

---

## 0. 執行摘要

| # | 宣稱／主題 | 結論 | 嚴重度 |
|---|------------|------|--------|
| 1 | V-P0：`radish`／`sunflower` 改走 `crops4`，世界地圖 0 emoji 作物 | **成立** — `emojiOnly` 移除、`sheet: "crops4"`；10 幀入管線 | — |
| 2 | crops4 與既有 crops 風格一致性（輪廓／色溫／土台） | **同像素家族、可同框**；細節密度對齊 **crops3** 而非 crops1 | V-P2 微差 |
| 3 | V-P1：四季常駐色調（天空 + 地圖底調） | **主路徑成立** — `html`／`#mapScene` `data-season` 同步 | — |
| 4 | V-P1：雨濕／雪覆等靜態天氣 grade | **主路徑成立** — `#mapScene::after` 靜讀層 + 既有粒子 | — |
| 5 | 規則／經濟零改動 | **成立** — `game.js`／`state.js` quiet diff exit 0；`config` 僅視覺身分 | — |
| 6 | 新引入視覺回歸 | **未見阻擋級回歸**；秋／冬 `mix-blend-mode` 有淡化作物風險 | V-P2 |

**一句話**：R56 **關閉了 V1 的 V-P0 誠信破口**（🔴／🌻 不再上地圖），並把季節／天氣從「只有 HUD」推進到「靜圖可讀的常駐 grade」。crops4 是 **crops3 同系程序化像素**，遠勝 emoji；對 crops1 仍偏標誌化。下一刀應攻 **世界地標（樹／花）與地形靜讀錨點**，而非再補 emoji。

**對 Codex 宣稱的總判決**：**通過（非橡皮圖章）** — 三項 V1 Top 建議皆有對應落地；殘留為 V-P2 與下一輪宣傳 ROI。

---

## 1. R56 修正落地覆核

### 1.1 變更檔清單（`80a59c3..5b4b6b1`）

| 檔案 | 角色 |
|------|------|
| `assets/generated/v4/crops4-48.png`／`.json` | 新 atlas（240×96、2×5、10 幀） |
| `tools/generate-crops4-atlas.py` | Pillow 可重跑生成器 |
| `assets/generated/v4/manifest.json` | 註冊 `crops4` |
| `src/config.js` | `radish`／`sunflower` → `sheet: "crops4"`，移除 `emojiOnly` |
| `src/ui.js` | `updateSeasonAmbient`；`updateWeatherLayer` 寫 `#mapScene.dataset.weather`；版本字串 |
| `index.html` | 四季 CSS 變數、`#mapScene` 季節／天氣靜態罩、`perf-low` 淡化、版本 query |
| `scripts/validate-v4-atlas.js` | REQUIRED／anchor／pixel／edge 納入 `crops4` |
| `scripts/test-economy.js` | 斷言改「crops4 像素作物」 |
| `scripts/test-rpg-v4-e2e.js` | 冬 ambient + 雨 scene 同步；版本 r56 |
| `sw.js`／`manifest.webmanifest`／`package.json` | 快取／版本 |
| `docs/GROK_REVIEW_farm_V1.md`／`docs/CODEX_RESPONSE_farm_V1.md` | 入庫文件 |

**未進 runtime 規則 diff**：`src/game.js`、`src/state.js`（`git diff --quiet 80a59c3 5b4b6b1 -- src/game.js src/state.js` → exit **0**）。

`config.js` 僅改兩作物**視覺身分**（`sheet`／去掉 `emojiOnly`）；`growMs`／`seedCost`／`yield`／`sellValue`／`xp`／`unlockLevel`／`season` 字面值不變。經濟意義上屬「美術接線」，與 V1 開單一致。

### 1.2 V-P0 — emoji 作物下線

#### 設定與渲染閘門

| 檢查 | r55（V1） | r56（本輪） | 判定 |
|------|-----------|-------------|------|
| `CROPS.radish` | `emojiOnly: true`，無 sheet | `sheet: "crops4"`，**無** `emojiOnly` | ✅ |
| `CROPS.sunflower` | 同上 | 同上 | ✅ |
| `updateMap` `hasFrame` | `!emojiOnly && getFrame` 對兩株永遠 false → emoji | sheet 有 frame → `addObjectPx` | ✅ |
| UI 鉻層 emoji | 種子列／訂單仍用 `c.emoji` | **保留**（V1 判定可接受） | ✅ 依約 |
| `radish.emoji` 字面 | `🔴` | 仍 `🔴`（僅 UI，不上地圖） | V-P2 殘留 |

備註：`ui.js` 仍保留 `emojiOnly` 分支與 `addEmojiObjectPx` — 屬**後備管線**，非回歸；目前 `CROPS` 無作物再設 `emojiOnly: true`。

#### 管線／離線／守門

| 節點 | 狀態 |
|------|------|
| SW `CORE_ASSETS` | 已 `versioned` 納入 crops4 png／json |
| v4 manifest | `crops4` frameCount 10 |
| `validate-v4-atlas` | REQUIRED 10 幀 + NEED_ANCHOR + PIXEL_SHEETS + 作物 edge 檢查 |
| economy 斷言 | 改 `sheet === "crops4" && !emojiOnly` |
| e2e 版本 | `r56-20260713-1` |
| 版本殘留 r55 | runtime 主錨（package／sw／html／ui fallback）已切 r56 |

**結論：V-P0 宣稱成立。** 世界地圖物件層不再因這兩株而混入系統 emoji；種子列 `🔴`／`🌻` 屬 UI 鉻層，**不重開 V-P0**（與 V1 §1.2 V-P2-01 一致）。若商店截圖裁到種子列，建議文案裁切避開或日後換語意 emoji（止血級，非本輪失敗）。

### 1.3 V-P1 — 四季常駐色調

#### 資料流

```text
updateMap(t)
  → updateSeasonAmbient(t)
      document.documentElement.dataset.season = currentSeason
      #mapScene.dataset.season = 同上
  → updateWeatherLayer(t)
      #mapScene.dataset.weather = currentWeather
      #weatherLayer class / data-weather（天氣變了才重設 class，避免重啟動畫）
```

#### CSS 落地

| 層 | 機制 | 靜照可讀？ |
|----|------|------------|
| 頁面天空 | `html[data-season]` 覆寫 `--sky-1/2`、`--grass*`；`body` 用這些變數 | **是**（截圖外框天空會變） |
| 地圖底 | `#mapScene[data-season]` 背景漸層（春粉綠／夏深綠／秋金褐／冬灰綠） | **是** |
| 季節 ambient | `#mapScene::before` 半透明 gradient（秋 `mix-blend-mode: color`；冬 `saturation`） | **中～是** |
| 轉場 wash | 既有 1s `season-wash` **保留**（peak）；常駐不再只靠它 | ✅ 分層正確 |
| `perf-low` | `::before`／`::after` opacity 略降、`transition: none`；**不停掉表意** | ✅ |

e2e 新增：強制 `season=冬` 後斷言 `documentElement` 與 `#mapScene` 皆 `dataset.season === "冬"`。

#### 對抗尖角（非失敗）

1. **地形 atlas 本身不隨季換色** — `terrain-organic` 仍是常綠 tile；季節主要靠 scene 底＋罩層。農土格密集時，靜圖的「秋／冬」感弱於目標圖的粉樹／枯感，但**已勝過 r55「永遠春末綠」**。
2. **冬 `mix-blend-mode: saturation`** 會作用在整塊 scene（含作物／角色像素）— 可能把向日葵金黃也壓灰。屬 V-P2 調參風險，建議下輪用 multiply 冷罩取代 saturation，或把 blend 限在地面層。
3. **秋 `color` blend** 同理可能染偏葉綠；宣傳秋圖需實機目檢。

**結論：V-P1 季節宣稱成立**；表達強度為「場景 grade + 頁面天空」，尚未到「世界物件換裝」。

### 1.4 V-P1 — 雨濕／雪覆靜態天氣

| 天氣 | `#mapScene::after` 靜態 grade | 與粒子層關係 |
|------|-------------------------------|--------------|
| clear | 極淡暖 vignette | 無粒子 |
| sunny | 暖金角光 | 既有光斑粒子 |
| rain | 水平細紋 + 深藍 multiply（濕冷暗） | 斜雨線仍在 `#weatherLayer` |
| storm | 更深 multiply + 更密細紋 | 既有暴雨粒子 |
| snow | 底部橢圓白覆蓋 + 冷白罩 | 既有雪點 |
| fog / windy | haze／斜向淡綠 | 既有 |

e2e：雨天斷言 `#weatherLayer` class／data 與 `#mapScene.dataset.weather === "rain"` 同步。

**靜照可讀性相對 r55**：明顯提升 — 不再「只靠動畫粒子、PNG 幾乎看不出」。  
**仍非「濕土 tile」**：反光是全畫面 CSS 紋理，不是農土像素變暗藍；與 V1 建議的「真雪斑／濕土 frame」相比屬正確的低成本解，但宣傳「雨中泥地」仍偏濾鏡感。

**結論：V-P1 天氣靜照宣稱成立。**

### 1.5 版本與文件口徑

| 項 | 結果 |
|----|------|
| Codex 目標版 `r56-20260713-1` | 與 package／sw／html／e2e 一致 |
| 宣稱「種子列保留 emoji」 | 與實作一致 |
| 宣稱「`performanceMode=low` 保留淡表意」 | CSS 有對應 |
| 宣稱「規則經濟未改」 | game／state 零 diff；config 僅視覺欄位 |

---

## 2. crops4 atlas 風格一致性（核心審查）

### 2.1 規格對齊表

| 規格 | crops | crops2 | crops3 | **crops4** | 判定 |
|------|-------|--------|--------|------------|------|
| frame | 48×48 | 48×48 | 48×48 | **48×48** | ✅ |
| 階段 | seed→ready ×5 | 同 | 同 | **同** | ✅ |
| sheet 尺寸邏輯 | 5×N 列 | 5×4 | 5×3 | **5×2** | ✅ |
| anchor | [0.5, 0.9] | 同 | 同 | **同** | ✅ |
| 命名 | `{id}_{stage}` | 同 | 同 | `radish_*`／`sunflower_*` | ✅ |
| 生成系 | AI + process | AI 系 | 程序化 JS | **程序化 Pillow** | 同 crops3 哲學 |
| 驗證 | pixel + edge | 同 | 同 | **已納入** | ✅ |

### 2.2 輪廓（outline）

| 來源 | 輪廓色 |
|------|--------|
| crops3 `P.outline` | `[54, 44, 28]` |
| crops4 `P["outline"]` | `#362c1c` = **rgb(54, 44, 28)** |

**完全對齊 crops3 暖棕輪廓常數。** 葉緣多用 `stem_dark`／`petal_dark` 作第二輪廓，與 crops3 的 `outlineEllipse(..., P.stemDark)` 習慣一致。

視覺閱讀（實際開圖）：

- crops1：輪廓較柔、有環境陰影與體積感（AI 筆觸）
- crops2：輪廓較薄、葉塊更扁平
- crops3／**crops4**：硬邊橢圓＋小 hi-light 點，**標誌化但統一**

**同框判決**：crops4 與 crops3 並肩幾乎無語言衝突；與 crops1 並肩時細節密度落差仍在（V1 已標為可接受微差），**遠小於 emoji 斷裂**。

### 2.3 色溫

| 語意 | crops4 色票 | 與既有關係 |
|------|-------------|------------|
| 土 | `#84552f`／hi `#bc8248`／dark `#432d18` | = crops3 soil／soilHi／shadow 系 |
| 莖葉 | `#477730`／`#4f9b43`／hi `#91cf58` | 與全表暖綠家族一致 |
| 蘿蔔 | `#d94b58` 系（對齊 config `color`） | 語意正確；**不再是純紅圓** |
| 花盤／花瓣 | 棕盤 `#895124` + 金黃 `#f0bd35` | 夏日遠讀足夠；比 🌻 emoji 像素 |

色溫：**暖田園、非冷灰、非 UI 高飽和霓虹** — 與 terrain／建築 cozy 調一致。

### 2.4 土台構圖

| 檢查 | crops4 | 對照 |
|------|--------|------|
| 腳底土條 | `soil()` 約 y=38–41，寬 11–15px | crops3 `soil` y≈38–39；crops1 為圓丘土堆 |
| 置中 | 主體約 x=24（半格） | 與 0.5 anchor 一致 |
| 成長弧線 | seed 小粒 → sprout 葉 → young 成形 → mature → ready 最大 | 五段可讀；emoji 路徑已死 |
| 格邊 | validator edge 門檻與其他 crops 相同 | 生成器內容內縮，未貼死 0／47 |

**構圖判決**：土台語言是 **crops3 式細土條**，不是 crops1 的立體土丘。同框時腳底「重量感」略輕於小麥／胡蘿蔔，但 **y-sort 與 baseline 一致**，不會像 emoji `drop-shadow` 那樣浮空。

### 2.5 逐作物可讀性

| 階段感 | radish | sunflower |
|--------|--------|-----------|
| seed | 暗紅小粒＋土 | 棕小粒＋土 |
| sprout | 小球根＋雙葉 | 莖＋雙葉 |
| young | 根變大、葉多 | 閉合花苞 |
| mature | 根明顯、多葉 | 開花（較小） |
| ready | 大紅根＋茂葉（遠讀 OK） | 大花盤＋8 瓣（田間成排符號強） |

對標目標圖（`rpg-desktop-scene-target.png`）：左上成排**紫紅球根＋綠葉**、中下**黃花作物田** — 正是 radish／sunflower 的內容位。r56 後**第一次具備「用 atlas 排成目標構圖」的素材條件**。

### 2.6 一致性總分（宣傳向）

| 維度 | 分（1–5） | 說明 |
|------|----------:|------|
| 規格／管線完整性 | 5.0 | 與 v4 作物契約一致 |
| 輪廓／色溫對齊 | 4.5 | 與 crops3 常數級對齊 |
| 土台／baseline | 4.0 | 同系細土條；弱於 crops1 土丘 |
| 細節密度 vs crops1 | 3.0 | 程序化橢圓感；同框可接受 |
| 消滅 emoji 混搭 | 5.0 | V-P0 關閉 |
| **同框可用性** | **4.5** | **可進宣傳主畫面** |

**風格結論**：**通過「同一像素家族」測試**。若未來要付費美術 pass，優先把 sunflower ready 的花瓣從「放射橢圓」略收成更像素鋸齒、土台略加 hi／shadow 點，即可再貼近 crops1；**非本輪阻擋**。

---

## 3. 氛圍層健康度（R56 後重評）

| 維度 | V1 分 | **V2 分** | 說明 |
|------|------:|----------:|------|
| 像素主體（角色／建築／主作物） | 3.5 | **3.5** | 未重畫主幹 |
| 作物全集一致性 | 2.0 | **4.0** | 兩株入 atlas；細節階梯仍在 |
| 天氣可玩提示 | 3.0 | **3.5** | 粒子＋靜態雙通道 |
| 天氣靜照可讀 | 1.5 | **3.0** | rain／snow／sunny 可靜讀 |
| 季節世界表達 | 1.0 | **3.0** | 常駐 grade；尚無季相樹 |
| 光影／時刻 | 1.0 | **1.0** | 仍無 |
| 對標 cozy RPG 目標圖 | 2.0 | **3.0** | 作物位補上；地標／野花密度仍缺 |

---

## 4. 下一批 3 個宣傳截圖提升點

評估軸：**截圖瞬間收益 ÷ 工程／美術成本**（R56 已關 V-P0 與主 V-P1 後的下一刀）。

### 🥇 下一步 1 — `structures-nature` 季節變體（春櫻／秋葉為主）

| 項 | 內容 |
|----|------|
| **嚴重度** | V-P1（地標層；氛圍可讀性的下一個天花板） |
| **為何現在最划算** | 目標圖左右 **粉櫻** 是「一眼四季／夢幻農場」的符號；R56 色罩改的是 grade，**樹仍四季同綠**時，商店輪播仍難做出「春夏秋冬四張真的不一樣」 |
| **做法** | 既有 structures-nature 加 1–2 季相 frame（春花、秋紅／枯），layout 或 season 選擇器切 frame；冬可先用冷罩+常綠 |
| **成本** | **中**（出圖 4–8 幀 + 接線） |
| **宣傳收益** | **極高** — 與 V1 目標圖直接對齊；比再調 CSS opacity 更像「內容」 |
| **驗證** | 同一鏡頭春／秋各一張，不看 HUD chip 也能分季 |

### 🥈 下一步 2 — 地形靜讀錨點（濕土／雪斑／地面季相，而不只 scene 濾鏡）

| 項 | 內容 |
|----|------|
| **嚴重度** | V-P1 |
| **為何** | R56 雨濕／雪覆是 **全畫面 CSS**；農土 pixel 本身仍乾、仍同一片綠。靜圖放大農田時，「雨中收成」仍偏濾鏡海報 |
| **做法（由低到高）** | (A) `#groundLayer` 季節／天氣專用 multiply（避開角色層，減輕冬 saturation 染作物）；(B) 少數 terrain 變體 frame：濕土暗藍、雪邊白點；(A) 可半日，(B) 1–2 日 |
| **成本** | **低～中** |
| **宣傳收益** | **高** — 與 R56 天氣罩正交相乘；順便可修 V-P2 冬 blend 染黃花 |
| **注意** | 分層建議：season base（地）× weather overlay（天／濕）× 粒子（動） |

### 🥉 下一步 3 — 固化「商店三連圖」示範田腳本（鏡頭 + 成排 atlas 作物）

| 項 | 內容 |
|----|------|
| **嚴重度** | 宣傳營運／V-P2（工程量低、CTR 直接） |
| **為何** | R56 **第一次**讓「春蘿蔔田／夏向日葵田」可全像素入鏡；若截圖仍是雜亂空田或 HUD 滿版，資產收益兌現不了 |
| **做法** | 固定桌機鏡頭（農舍前農土 + 角色半身）：(1) 春晴・radish+pea 成排；(2) 夏豔陽・sunflower+corn／bell_pepper；(3) 冬雪／霧・winter_kale + 冷 ambient。可選：debug／seed 存檔或 e2e 截圖 fixture |
| **成本** | **極低～低**（編導 + 可選自動化截圖；幾乎不改玩法） |
| **宣傳收益** | **高且立即** — 驗證 R56 投資；失敗條件寫死：地圖層出現系統 emoji 作物則拒收 |
| **附加小刀** | 種子列若入鏡，將 `radish.emoji` 自 `🔴` 改為語意植物 emoji（UI only）— 避免審核者誤讀 bug |

### 刻意不進本輪 Top 3

| 項目 | 原因 |
|------|------|
| 重畫 crops4 對齊 crops1 全細節 | 同框已過關；ROI 低於地標季相 |
| 種子列全面改 atlas icon | 主裁切在地圖；V1 已定鉻層可接受 |
| 全日夜循環 + 方向光 | 氣氛佳、成本高；非放置核心 |
| 再加新作物 emoji 佔位 | **禁止重開 V-P0**；新作物應直接 atlas 或至少程序化 sheet |

---

## 5. 殘留清單（非本輪阻擋）

| ID | 嚴重度 | 說明 |
|----|--------|------|
| V2-P2-01 | V-P2 | UI 鉻層 `radish.emoji === "🔴"` 仍可能入非地圖裁切 |
| V2-P2-02 | V-P2 | 秋 `mix-blend-mode: color`／冬 `saturation` 可能染作物與角色 |
| V2-P2-03 | V-P2 | 地形 tile 不隨季換色；季節表達上限被 scene 罩綁住 |
| V2-P2-04 | V-P2 | crops4 土台為細條、細節密度≈crops3＜crops1 |
| V2-P2-05 | V-P2 | 無光影／時刻；「黃金時刻」截圖仍靠後製 |
| V2-P2-06 | V-P2 | `emojiOnly` 後備分支仍在（健康），但 CONTENT 路線若再加 emojiOnly 會重開 V-P0 |
| V2-P2-07 | V-P2 | e2e 驗證 dataset，**未**對截圖像素／視覺回歸做快照（可接受） |

---

## 6. 總評與監工結論

| 面向 | 判決 |
|------|------|
| V1 V-P0（地圖 emoji 作物） | **已關閉** |
| V1 V-P1（季節 ambient） | **已關閉主缺口**（常駐 grade 成立） |
| V1 V-P1（天氣靜照） | **已關閉主缺口**（雨濕／雪覆可靜讀） |
| crops4 風格一致性 | **通過** — 輪廓／色溫／土台與 crops3 同系，可與全表同框 |
| Codex 施工誠信 | **通過** — 資產／config／CSS／SW／validator／測試口徑一致；無暗改經濟 |
| 是否可拍上架三連圖 | **可以開拍** — 建議用 §4 步驟 3 腳本驗收 |
| 本輪是否改碼 | **否**（只審不改） |

**監工立場**：r56 是一輪**對症且單位成本正確**的視覺修復 — 先補像素身分，再用 CSS 把既有季節／天氣規則畫進靜圖。不必為此重開大美術專案。下一輪若目標是商店 CTR，優先序應為：

1. **季相地標（樹）**  
2. **地面級天氣／季節錨點**  
3. **示範田截圖腳本兌現 R56**

---

## 附錄 A — 關鍵索引

| 主題 | 位置 |
|------|------|
| crops4 生成 | `tools/generate-crops4-atlas.py` |
| crops4 資產 | `assets/generated/v4/crops4-48.png`／`.json` |
| 作物 sheet | `src/config.js` `CROPS.radish`／`sunflower` |
| 季節 ambient | `src/ui.js` `updateSeasonAmbient`；`index.html` `html[data-season]`／`#mapScene[data-season]` |
| 天氣靜態罩 | `index.html` `#mapScene[data-weather]::after` |
| 地圖渲染閘門 | `src/ui.js` `updateMap` `hasFrame` |
| 色板對照 | crops3 `scripts/generate-crops3-atlas.js` `P.outline`／`soil` |
| V1 開單 | `docs/GROK_REVIEW_farm_V1.md` |
| Codex 回應 | `docs/CODEX_RESPONSE_farm_V1.md` |
| 視覺目標 | `references/visual-targets/rpg-desktop-scene-target.png` |

## 附錄 B — 作物渲染身分一覽（r56）

| id | 名稱 | 視覺身分 |
|----|------|----------|
| wheat…pumpkin | （主表） | atlas `crops` |
| bell_pepper…melon | （次表） | atlas `crops2` |
| pea…winter_kale | （三表） | atlas `crops3` |
| **radish** | **櫻桃蘿蔔** | **atlas `crops4`**（UI emoji 仍 🔴） |
| **sunflower** | **向日葵** | **atlas `crops4`**（UI emoji 仍 🌻） |

*文件結束。視覺監工 V2 — 只審不改。*
