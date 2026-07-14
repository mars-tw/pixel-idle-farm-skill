# Grok 素材品質監工 — 農場 Atlas 審核（v3 / v4）

| 項目 | 內容 |
|------|------|
| **角色** | 素材品質監工（只審不改） |
| **範圍** | `assets/generated/v3/*` runtime 表、`assets/generated/v4/*` runtime 表（含 v4 沿用 v3 的 `props` / `vfx`） |
| **不在範圍** | 改圖、改切割腳本、改 `src/*`、重跑 API 生圖 |
| **Runtime 接線** | `src/atlas.js` 固定讀 `assets/generated/v4/manifest.json` |
| **對照基準** | `references/visual-targets/rpg-asset-atlas-direction.png`、`references/sprite-cutting-method-v3.md`、walk 主表尺度、`crops-48` / `animals-48` / `buildings` 高品質錨 |
| **方法** | 全表開圖目視 + PIL 逐格不透明密度／內容 bbox／列尺度 + SHA256 同源比對 + config 接線交叉 |
| **日期** | 2026-07-14 |

---

## 0. 執行摘要

### 一句話

v4 **建築／主線作物／動物主表／自然結構** 已達可 demo 的 cozy pixel 水準；真正拖垮「同框一致性」的是 **動作表尺度崩壞**、**擴充作物（crops2–4）程序化草稿**、**鴨系 placeholder**，以及 **地形仍是扁平程序化色塊**（v3≡v4 同一檔）。

### 最該重繪的表（由急到緩）

| 順位 | Sheet | 優先級 | 一句理由 |
|------|--------|--------|----------|
| 1 | `v4/miri-actions-48x64.png` | **P0** | 耕作主循環每下都播；`hoe_up` 半身碎幀、`idle_*` 巨臉特寫與 walk 尺度斷裂 |
| 2 | `v4/max-actions-48x64.png` | **P0** | 男主同一套問題；切換性別即曝光 |
| 3 | `v4/crops2-48.png` | **P0** | 甜椒／馬鈴薯／葡萄／甜瓜 全是色塊棍棒；與 `crops-48` 同田並排即「兩款遊戲」 |
| 4 | `v4/crops3-48.png` | **P0** | 豌豆／地瓜／冬甘藍 程序化灌木；略優於 crops2 仍不合格 |
| 5 | `v4/animals-duck-48.png` + `duck-egg-quality-32.png` | **P0** | 2KB 級超低解析黃色塊 vs `animals-48` 完整描邊 |
| 6 | `v4/terrain-organic-32.png`（≡ v3） | **P1** | 對標目標圖差距最大；地圖「底盤」空洞、無有機紋理 |
| 7 | `v4/crops4-48.png` | **P1** | 蘿蔔／向日葵可讀但語言仍屬程序化系，需併入 crops 統一重畫 |
| 8 | `v3/miri-actions-48x64.png` | **P2** | 已非 runtime 主路徑；`idle_up` 整列近空（僅帽）可當歷史債 |

### 品質帶狀分佈（主觀 1–10，對「同框可混用」）

| 帶 | 分 | Sheets |
|----|----|--------|
| A 錨點級 | 8–9 | `buildings`、`crops-48`、`animals-48`、`animals-care-48`、`structures-nature`、`animal-care-props-64`、`miri-walk` / `max-walk`、`props-stations`(v3) |
| B 可用 | 6.5–7.5 | `npcs`、`animal-products-quality`、`animal-status-icons`、`animal-care-vfx`、`action-vfx`(v3)、`crops-32`(v3 archive) |
| C 危險 | 3–5 | `miri-actions` / `max-actions`、`crops4`、`terrain-organic`、`miri-actions` v3 |
| D 不合格 | 1–2.5 | `crops2`、`crops3`、`animals-duck`、`duck-egg-quality` |

### 跨表一致性總結

| 檢查項 | 結果 |
|--------|------|
| v3 terrain ≡ v4 terrain | **完全相同**（SHA256 一致）— v4 未升級地形 |
| 角色 walk 男女 | **可接受** — 服裝對稱、比例接近 walk 錨 |
| 角色 walk ↔ actions | **斷裂** — actions 多列密度 0.45–0.53 vs walk ~0.28；特寫列 / 半身列 |
| 作物 crops vs crops2–4 | **嚴重斷裂** — AI 體積渲染 vs 扁色塊程序化 |
| 動物 animals vs duck | **嚴重斷裂** |
| 建築 buildings ↔ structures ↔ props | **大致同語言**（暖描邊、腳底陰影、上左光） |
| 產線「validate 通過」≠ 美術合格 | **成立** — 格數／frame id 對了，不等於尺度／可讀性合格 |

---

## 1. 審核標準（本報告用）

| ID | 標準 | 過關門檻 |
|----|------|----------|
| S1 | **格線與 metadata** | sheet = cols×frameW × rows×frameH；JSON frame 對齊 |
| S2 | **全身尺度一致** | 同表角色 bbox 高約 48–54px／48×64 格；列間密度差 ≲ 0.12 |
| S3 | **腳底 baseline** | 腳落在格下緣附近；與 `anchor ≈ [0.5, 0.86–0.9]` 相容 |
| S4 | **無碎幀** | 禁止半身、斷肢、空格、工具漂浮無身體 |
| S5 | **無特寫混入全身表** | 禁止頭肩特寫與全身 walk 同表混用 |
| S6 | **成長／狀態可讀** | 作物 seed→ready 階差清楚；ready 一眼可辨 |
| S7 | **同家族語言** | 線寬、調色、陰影、像素硬度與錨表一致 |
| S8 | **對標目標圖** | 地形／作物／建築對 `rpg-asset-atlas-direction.png` 有「同宇宙」感 |

優先級定義：

- **P0**：runtime 玩家必見，且同框會立刻覺得「素材沒做完」或動畫壞掉  
- **P1**：常駐畫面（地形）或次級內容；品質落後但尚可辨識  
- **P2**：細節、季相邊角、archive、低頻 UI  

---

## 2. v3 Runtime 表逐張

> Runtime 主路徑已切 v4；v3 仍有 **完整 atlas 資產**，且 v4 **直接 reuse** `props-stations` 與 `action-vfx-32`。

### 2.1 `terrain-organic-32.png` — 品質 **3／10** — **P1（與 v4 同源）**

| 項 | 值 |
|----|-----|
| 尺寸 | 512×512，32×32，16×16 格 |
| 不透明占比 | ~17.7%（大量空白格） |
| 生成感 | 程序化色塊 + 極簡裝飾點 |

**問題**

- 草地／土／水為**平塗矩形**，無目標圖的草紋、濕土反光、水草／石頭邊緣。
- 路徑與土壤邊角組數量足夠跑 logic，但**視覺像 debug tileset**。
- 與 `buildings`／`structures-nature` 同框時，地面是最大的「廉價感」來源。

**優點**

- 乾土／濕土／水／橋／路徑色相可分。
- 格線 metadata 乾淨。

### 2.2 `crops-32.png` — **7.5／10** — P2（archive；runtime 用 v4 `crops-48`）

- 六作物 × 五階段完整、baseline 大致穩定、ready 可讀。
- 較 v4 `crops-48` 略擠、略「貼紙感」，但仍屬同一 AI 語言。
- **不需優先重繪**（除非要回退 v3 管線）。

### 2.3 `miri-walk-48x64.png` — **8／10** — 通過

- 4 向 × 6 幀完整；列密度 ~0.28 穩定。
- 服裝（奶白衫、綠吊帶、紅巾、棕靴、側袋）一致。
- 可作角色尺度**金標**。

### 2.4 `miri-actions-48x64.png` — **5.5／10** — P2（非 runtime）

| 問題 | 說明 |
|------|------|
| **r03 `idle_up` 近空** | 6 格密度 ~0.018，僅帽／碎點 — 整列失效 |
| 工具列尚可 | hoe／water／sow／harvest 多數可讀 |
| 與 walk 比 | 略胖、略亮，但仍比 v4 actions 穩 |

### 2.5 `action-vfx-32.png` — **7／10** — 通過（v4 reuse）

- 水滴、土塵、種子、pop、有效／無效圈完整。
- 風格偏「彩色 icon 動畫」，與角色硬邊像素可共存。
- P2：部分中段帧語意略雜（多色 pop）。

### 2.6 `props-stations.png` — **8／10** — 通過（v4 reuse）

- 告示板、箱、信箱、井、門、橋、小屋、雞舍、紅穀倉、池、樹樁、岩、灌木、木堆、石堆、堆肥 — **可讀、風格統一**。
- 與 v4 `buildings` 略有「同題材雙版本」（雞舍／穀倉），但尚可接受。

---

## 3. v4 Runtime 表逐張

### 3.1 角色

#### `miri-walk-48x64.png` — **8／10** — 通過

- 與 v3 walk 同結構；SHA 不同但是同級品質。
- 列密度 0.28±0.01，bboxH≈52，尺度穩定。

#### `max-walk-48x64.png` — **8／10** — 通過

- Kai 短髮／同套工裝，與 Miri 可並存。
- 側向 idle 略瘦（bboxW≈19）仍可接受。

#### `miri-actions-48x64.png` — **4／10** — **P0 重繪**

**結構**：24 列 × 6 幀（a/b 源合併）：water／hoe／sow／harvest × down,up,side + idle／collect／build／use × 向。

**量化異常（PIL）**

| 列 | frame 前綴 | dens | top | bboxH | 判定 |
|----|------------|------|-----|-------|------|
| r04 | `hoe_up_*` | **0.21** | **29** | **26** | **半身／碎幀**（內容貼中下，非全身） |
| r03 | `hoe_down_*` | 0.44 | 10 | 45 | 過寬過密，部分幀工具比例失控 |
| r12 | `idle_down_*` | **0.53** | 5 | 50 | **巨臉特寫**（dens 近 walk 的 1.9 倍） |
| r13 | `idle_up_*` | **0.48** | 10 | 45 | 同上 |
| walk 對照 | — | ~0.28 | 3 | 52 | 金標 |

**目視問題清單**

1. **尺度斷裂**：特寫 idle 與全身耕作同表；若未來接 breathing idle 會爆。  
2. **`hoe_up` 不可播**：面對北方鋤地會出現殘缺身體。  
3. **工具越格／漂浮**：澆水壺、鋤、種子弧在部分幀貼邊或與身體脫節。  
4. **同動作三向不對稱**：down 尚可、up／side 品質落差大。  
5. **切割後果**：源圖 a/b 合併後，部分列被「最大內容塊」放大，破壞統一 fill。

**玩家影響**：澆水／鋤地／播种／收穫為核心循環 → **最高曝光壞素材**。

#### `max-actions-48x64.png` — **4／10** — **P0 重繪**

| 列 | 前綴 | 異常 |
|----|------|------|
| r11 | `harvest_side_*` | top≈20、bboxH≈35 — 偏半身 |
| r12–13 | `idle_down/up` | dens 0.51／0.46 — 巨臉特寫 |
| 多列 | sow／water | 幀間姿態跳、工具比例不穩 |

與 Miri actions **同一病徵**；應**同規格一次重產**，避免男女再分叉。

#### `npcs-48x64.png` — **7.5／10** — 通過（P2 微調）

- 鎮長／商販／老農／小孩 身份清楚；talk 手勢可讀。
- 體型略「圓潤於 Miri walk」，但同宇宙。
- P2：商販提籃左右幀道具略跳；可接受。

---

### 3.2 作物

#### `crops-48.png` — **8.5／10** — **作物金標**

- 小麥／胡蘿蔔／番茄／草莓／玉米／南瓜，五階段完整。
- 土壤小丘 + 透明底 + 體積感；ready 明顯。
- 草莓 mature/ready 略滿格（dens≈0.45）仍可讀。

#### `crops2-48.png` — **2／10** — **P0 重繪**

- 檔案 ~4.5KB；目視為**綠矩形葉 + 色點果實**。
- 列：bell_pepper、potato、grapes、melon（config unlock 5–8，**中後期主田**）。
- seed 格密度僅 ~0.026（幾乎空）。
- **與 crops-48 並排是全專案最大一致性破口之一**。

#### `crops3-48.png` — **3／10** — **P0 重繪**

- 程序化圓葉灌木；豌豆／地瓜／冬甘藍辨識度低。
- 比 crops2 密一點，但仍是另一套渲染器。

#### `crops4-48.png` — **4／10** — **P1（建議與 2/3 同批）**

- 蘿蔔／向日葵 ready 可讀（曾做修正），花盤比例改善。
- 仍屬「扁色塊管線」，陰影／線寬不及 `crops-48`。
- 建議 **併入統一 crops 擴充表** 一次重畫，不要單獨微調。

---

### 3.3 動物與照護

#### `animals-48.png` — **8／10** — 通過

- 雞／牛／羊／蜂 × idle/walk；比例、陰影、描邊統一。

#### `animals-care-48.png` — **8／10** — 通過

- happy／eating 可讀；與主動物表匹配。

#### `animals-duck-48.png` — **1.5／10** — **P0 重繪**

- ~2.5KB；粗塊黃鴨，無羽紋、無正確腳、動畫僅平移感。
- dens≈0.20 vs animals≈0.38。
- config：`sheet: "animals_duck"`，unlockLevel 6 — **會進地圖**。

#### `duck-egg-quality-32.png` — **1.5／10** — **P0 重繪**

- 三階幾乎同一白蛋 + 小點；無 normal／good／premium 階層語言。
- 應對齊 `animal-products-quality-32` 的蛋列風格。

#### `animal-care-props-64.png` — **8.5／10** — 通過

- 飼槽／水槽／刷具／墊料 狀態清楚、光影佳。

#### `animal-products-quality-32.png` — **7.5／10** — 通過

- 蛋／奶／毛／蜜 × 3 品質；premium 有金光。
- P2：蜜列「罐／堆」形變略大。

#### `animal-care-vfx-32.png` — **7.5／10** — 通過

- 飼料粒、水花、梳毛、愛心、金光、地環完整。

#### `animal-status-icons-32.png` — **7.5／10** — 通過

- 飢／渴／梳／開心遞進清楚；適 UI 氣泡。

---

### 3.4 建築與自然

#### `buildings.png` — **9／10** — 全庫最佳錨之一

- 農舍／穀倉／雞舍圍場／市集攤 — 細節、透視、陰影完整。
- 可作「世界物件」品質上限參考。

#### `structures-nature.png` — **8／10** — 通過（P2 小修）

- oak／pine／果樹／大灌木／市集攤／風車／路牌／乾草／花圃／路燈 + 季相 6 幀。
- 春花／秋紅／冬霜 **大方向可讀**。
- **P2**：`bush_big_winter` 仍帶粉花（霜冠 + 春花邏輯衝突）；冬灌木應去花或改霜枝。
- JSON 無 scarecrow 等（若源圖有零散物，未進 runtime names）— 屬內容缺口非本表壞畫。

#### `terrain-organic-32.png` — **3／10** — **P1**（見 §2.1）

- 與 v3 **byte-identical**；v4 未做地形美術升級。

---

### 3.5 v4 沿用 v3

| Sheet | 路徑 | 評分 | 備註 |
|-------|------|------|------|
| props | `v3/props-stations.png` | 8 | 可用；長期可與 buildings 統一光影 |
| vfx | `v3/action-vfx-32.png` | 7 | 可用 |

---

## 4. 跨表一致性矩陣（重點）

| 對照 | 一致？ | 說明 |
|------|--------|------|
| Miri walk ↔ Max walk | ✅ | 同裝同分鏡 |
| Walk ↔ Actions（Miri/Max） | ❌ | 特寫列、半身列、密度飆升 |
| crops-48 ↔ crops2/3/4 | ❌ | AI 體積 vs 程序化色塊 |
| animals-48 ↔ animals-duck | ❌ | 完整像素 vs placeholder |
| products-quality ↔ duck-egg | ❌ | |
| buildings ↔ structures ↔ props | ✅～ | 同 cozy 硬邊；props 略小一號 icon 感 |
| terrain ↔ 所有地上物 | ❌ | 地面扁平，物件精緻 → 「貼紙貼在色紙上」 |
| care 系列內部 | ✅ | props／vfx／status／products 同語言 |
| v3 crops ↔ v4 crops-48 | ✅～ | 同系，v4 更鬆更清楚 |

---

## 5. P0–P2 清單與重繪規格

> 規格供下一輪產線（`art-config` + `process-v4-atlas` + 人工抽樣）使用。**本文件不改資產。**

### 5.1 P0

---

#### P0-1 — `miri-actions-48x64`（女主動作 24 列）

| 欄位 | 規格 |
|------|------|
| **輸出** | `assets/generated/v4/miri-actions-48x64.png` + `.json` |
| **格** | 48×64，**6 列幀 × 24 列動作**，sheet **288×1536** |
| **列序（鎖定現有 frame id）** | `water_{down,up,side}` → `hoe_*` → `sow_*` → `harvest_*` → `idle_*` → `collect_*` → `build_*` → `use_*` 各 6 幀 `_00.._05` |
| **角色錨** | **必須逐幀對齊 `miri-walk-48x64`**：髮髻、腮紅、奶白衫、綠吊帶、紅巾、棕靴、側袋、頭身比 |
| **尺度** | 全身高度目標 **50–54px**；列均 dens 落在 **0.28–0.38**；禁止 dens>0.45 的特寫 |
| **baseline** | 腳底落在格底以上 **8–12px 內**；`anchor [0.5, 0.86]` |
| **工具** | 壺／鋤／種子／作物／籃／錘／工作台 **不得切斷身體**；特效可出格但本體不可裁頭 |
| **禁止** | 頭肩特寫、空格、斷肢、左右 mirror 當 up、與 walk 不同服裝 |
| **驗收** | (1) 逐列開圖無半身 (2) `hoe_up_00..05` 可辨鋤地 (3) 與 walk_down_00 並排尺度差 ≤ 10% (4) validate-v4-atlas 通過 |

**建議產線**：維持 a/b 兩張 12 列源圖，但 **processor 強制 per-row 與 walk 同 scale cap**（勿對單列內容塊過度 fill）。壞列優先重生：`hoe_up`、`idle_down`、`idle_up`。

---

#### P0-2 — `max-actions-48x64`（男主動作 24 列）

| 欄位 | 規格 |
|------|------|
| **輸出** | `assets/generated/v4/max-actions-48x64.png` + `.json` |
| **格／列序／anchor** | **與 P0-1 完全相同** |
| **角色錨** | `max-walk-48x64`：短棕髮、同工裝、紅巾、無髮髻 |
| **額外** | 與 Miri actions **同動作時間軸**（同幀工具相位），方便維護 |
| **驗收** | 同 P0-1；另：性別切換播同一 action 無尺度跳變 |

---

#### P0-3 — `crops2-48`（擴充作物 A）

| 欄位 | 規格 |
|------|------|
| **輸出** | `assets/generated/v4/crops2-48.png` + `.json` |
| **格** | 48×48，5 欄 × 4 列 = **240×192** |
| **列（現有 id）** | `bell_pepper`、`potato`、`grapes`、`melon` |
| **欄** | `seed` → `sprout` → `young` → `mature` → `ready` |
| **風格錨** | **`crops-48.png` 逐像素語言**：小土丘底座、透明底、上左光、2 段陰影、硬邊、**禁止**純色矩形葉 |
| **可讀性** | ready：甜椒彩色燈籠果、馬鈴薯露土塊莖、葡萄串、網紋甜瓜 — 32–48px 縮圖可辨 |
| **baseline** | 作物底對齊格底上 ~4–8px；`anchor [0.5, 0.9]` |
| **禁止** | 扁 2D 火柴、無輪廓線、seed 空格、與土壤 tile 畫進 frame |
| **驗收** | 與 `crops-48` 同圖拼貼「看不出兩張表」；mean dens 進入 0.18–0.35 帶 |

---

#### P0-4 — `crops3-48`（擴充作物 B）

| 欄位 | 規格 |
|------|------|
| **輸出** | `crops3-48.png` 240×144（5×3） |
| **列** | `pea`、`sweet_potato`、`winter_kale` |
| **風格／階段／驗收** | **同 P0-3**，錨 `crops-48` |
| **品種提示** | 豌豆：藤／莢；地瓜：心葉＋塊根暗示；冬甘藍：藍綠皺葉球 |

---

#### P0-5 — `animals-duck-48` + `duck-egg-quality-32`

| 欄位 | 規格 |
|------|------|
| **鴨表輸出** | `animals-duck-48.png` **192×96**，48×48，4×2 |
| **幀** | 對齊現有 id：`duck_idle_a/b`、`duck_walk_a/b` + care 列若共用需補 `happy_*`／`eating_*`（若 runtime 只吃 8 幀則維持 2 列，但 **畫質必須達 animals-48**） |
| **風格錨** | `animals-48` 雞列：描邊、腳底陰影、側視 3/4、可愛比例 |
| **鴨特徵** | 黃／米羽、扁喙、腳蹼可讀；walk 有位移感 |
| **蛋表** | `duck-egg-quality-32.png` 96×32，3 階；錨 `animal-products-quality` 蛋列，可偏青綠殼以區分雞蛋白 |
| **驗收** | 與雞同框不顯 placeholder；檔案體積應接近 animals 級（數十 KB），非 2KB 色塊 |

---

### 5.2 P1

---

#### P1-1 — `terrain-organic-32`（v3/v4 同源，一次升級兩路徑）

| 欄位 | 規格 |
|------|------|
| **輸出** | 覆寫 `v4/terrain-organic-32.png`（並同步 v3 或改 manifest 只指 v4） |
| **格** | 32×32，512×512，保留現有 **frame id 集合**（49+ 已接線 id） |
| **風格錨** | `references/visual-targets/rpg-asset-atlas-direction.png` 上兩排：草紋、碎花、濕土反光、水邊石、橋板木紋 |
| **必要視覺** | grass 8 變體有微差；wet ≠ dry；water 非純藍矩形；path 有顆粒 |
| **禁止** | 整格單色、無 alpha 邊緣雜訊、畫上角色／建築 |
| **驗收** | promo 截圖中地面不再像「色板」；與 buildings 同框不搶戲也不塌 |

---

#### P1-2 — `crops4-48`（蘿蔔／向日葵）

| 欄位 | 規格 |
|------|------|
| **建議** | 與 P0-3/4 **同批 AI 重產**，廢除程序化 `generate-crops4-atlas.py` 作為最終美術 |
| **格** | 240×96，`radish` / `sunflower` × 5 階段 |
| **重點** | 向日葵 ready 花盤比例、蘿蔔 ready 根＋葉層次；語言 = `crops-48` |

---

#### P1-3 — Actions 產線護欄（非畫，但是 P0 防回歸）

| 項 | 規格 |
|----|------|
| 切割 | per-row scale 鎖定 walk 中位身高；`fill` 上限避免特寫放大 |
| CI 建議 | 任 frame dens>0.45 或 bboxH<36 或 foot12==0 → fail |
| 源圖 prompt | 明確「full body only, no portrait, feet on baseline, headroom 4px」 |

---

### 5.3 P2

| ID | 項目 | 規格摘要 |
|----|------|----------|
| P2-1 | `bush_big_winter` | 去粉花或改霜枝／雪點；保持 bbox 與 base bush 對齊 |
| P2-2 | `animal-products` 蜜列 | 三階同罐形，僅光澤／蓋色遞進 |
| P2-3 | `npcs` 商販道具 | talk 幀提籃左右一致 |
| P2-4 | v3 `miri-actions` idle_up | archive 修或標 deprecated；勿再被腳本引用 |
| P2-5 | props ↔ buildings 雞舍／穀倉 | 長期統一為 buildings 風格，props 改小裝飾 |
| P2-6 | care_vfx 地環 | 補滿 6 幀 alpha 節奏，避免末幀過空 |

---

## 6. 建議施工順序（仍只審；供排程）

```text
Week A  P0-1 + P0-2  動作表（男女並行，同一 processor 設定）
Week A  P0-5         鴨 + 鴨蛋（量小，立刻消 placeholder）
Week B  P0-3 + P0-4 + P1-2  全部擴充作物對齊 crops-48
Week C  P1-1         地形（影響所有 promo／截圖）
Week D  P2           季相灌木／蜜／NPC 微修
```

**不要**在 P0 動作表修好前，優先刷更多 structures 變體 — ROI 較低。

---

## 7. 各表總表（速查）

| Sheet | 版 | 分數 | 優先 | 最該做的事 |
|-------|----|------|------|------------|
| miri-actions-48x64 | v4 | 4 | **P0** | 全表重產 + 尺度鎖 walk |
| max-actions-48x64 | v4 | 4 | **P0** | 同上 |
| crops2-48 | v4 | 2 | **P0** | 對齊 crops-48 重畫 |
| crops3-48 | v4 | 3 | **P0** | 同上 |
| animals-duck-48 | v4 | 1.5 | **P0** | 對齊 animals-48 |
| duck-egg-quality-32 | v4 | 1.5 | **P0** | 對齊 products-quality |
| terrain-organic-32 | v3=v4 | 3 | **P1** | 有機 tileset 重產 |
| crops4-48 | v4 | 4 | **P1** | 併入作物統一重產 |
| miri-actions | v3 | 5.5 | P2 | archive；修 idle_up |
| crops-32 | v3 | 7.5 | — | 保持 |
| miri-walk / max-walk | v4 | 8 | — | 金標，勿動除非連動 |
| npcs-48x64 | v4 | 7.5 | P2 | 微修 |
| animals / animals-care | v4 | 8 | — | 金標 |
| buildings | v4 | 9 | — | 金標 |
| structures-nature | v4 | 8 | P2 | 冬灌木 |
| care_props / care_vfx / status / products | v4 | 7.5–8.5 | P2 | 微修 |
| props-stations | v3→v4 | 8 | P2 | 長期統一 |
| action-vfx | v3→v4 | 7 | — | 可用 |
| crops-48 | v4 | 8.5 | — | **作物金標** |

---

## 8. 結論

1. **驗證腳本通過 ≠ 美術過關** — 最糟的 duck／crops2 仍可能「frame 齊全」。  
2. **品質天花板已在庫內**：`buildings`、`crops-48`、`animals-48`、`miri-walk` — 重繪規格應 **複製這些表的語言**，不要開新風格。  
3. **P0 五項**修完後，中後期田地與角色動作會立刻脫離「demo 素材混用」狀態；**P1 地形**則是 promo／第一印象的下一步。  
4. 本報告 **只審不改**；未修改任何 atlas、腳本或遊戲碼。

---

*Grok Asset Audit · pixel-idle-farm-skill · 2026-07-14*
