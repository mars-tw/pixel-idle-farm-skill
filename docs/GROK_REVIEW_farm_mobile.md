# Grok 手機端體驗監工 — 像素農場 `r55-20260712-1`

- **專案**：pixel-idle-farm-skill（《阿軒割割陽光農場》vanilla JS PWA）
- **版本**：`r55-20260712-1`（`sw.js` / `index.html` / `package.json` 對齊）
- **審查角色**：手機玩家視角體驗監工（**只審不改**）
- **方法**：靜態讀碼（`index.html`、`src/ui.js`、`src/config.js`、`src/game.js`）＋對照 R53/R54 既有監工報告（`docs/GROK_REVIEW_farm_R4.md`、`docs/GROK_REVIEW_farm_R5.md`）＋ R47 RWD 守門設計（`scripts/test-rwd-matrix.js`）
- **範圍四軸**：
  1. 種田／澆水／收成觸控目標（264 磚、格子大小、誤觸相鄰格）
  2. 手機直式版面（農場視圖／側欄面板／信箱切換）
  3. R53–R54 特效在低階機負擔與 `low` 模式自動偵測
  4. 長掛機手機省電（背景 tab 節流）
- **優先級定義（本報告）**：
  - **P0**：核心種田循環在手機上明顯壞掉／不可達，或誤觸會**直接扣資源**且無緩衝
  - **P1**：手機主路徑可玩但明顯損 UX、低階機可感知卡頓、背景耗電未節流
  - **P2**：品質債、邊緣情況、與桌機對齊不足、既有殘留未在本輪惡化

---

## 執行摘要

| # | 主題 | 結論 | 最高嚴重度 |
|---|------|------|------------|
| 1 | 264 磚觸控／種田誤觸 | 單格 **48 CSS px、零間距**；可點即動作（走過去種／澆／收），誤點相鄰農土會**走錯並可能扣種子金** | **P0** |
| 2 | 直式農場／面板／信箱 | 單欄上下堆疊 + 側欄分頁 + 信箱 modal；**無底部主切換**；點磚後磚資訊常在 fold 下且**不自動捲入** | **P1** |
| 3 | R53–54 特效／low 自動 | juice 主路徑有 gate；auto 只靠 **前台 FPS**；真正熱路徑是 **每 tick 重建地圖 DOM**，低階機仍重 | **P1** |
| 4 | 背景 tab 省電 | `loop`／autosave **無 `document.hidden` 節流**；visibility 幾乎只服務 Audio；長掛機會持續耗電並可能誤觸發 auto-low | **P1** |

**本輪未見「完全不能點地圖」級別的死鎖**（`touch-action: none` 擋瀏覽器手勢、`click` 仍通），但 **種田誤觸成本** 與 **背景無節流** 是手機長線體驗的兩大硬傷。

### Top 建議（給下輪實作，本報告不改碼）

1. **P0** 農土連點確認／預覽高亮，或「僅選取、側欄確認再種」；至少對手工具 plant 加二次確認或 300ms 選取延遲。
2. **P1** 手機：點磚後 `scrollIntoView` 磚資訊／提供「地圖 ⇄ 面板」主切換（底部 dock）。
3. **P1** `document.hidden` 時停 `setInterval(loop)` 或降到 ≥1s，並暫停 FPS auto 降級計數。
4. **P1** low 模式除 1s 地圖節流外，跳過 `obDyn` 全量 remove/recreate 的漫遊動物重建頻率。
5. **P2** 智慧助手預設收合、手機不鋪滿地圖底緣；`perf-low` 停 `readyPulse`／`qbob`。

---

## 0. 地圖與手機幾何（事實基線）

| 項目 | 值 | 證據 |
|------|----|------|
| 地圖尺寸 | **22 × 12 = 264 磚** | `src/config.js:463` `MAP_W = 22, MAP_H = 12` |
| 邏輯磚邊長 | **48 CSS px（固定，無 scale）** | `src/config.js:465` `TILE_PX = 48`；`src/ui.js:1773,1792-1793` |
| 世界像素 | 1056 × 576 | `22*48` × `12*48` |
| 手機視口高度 | `#mapScene` **52vh / min 300px**（≤859px） | `index.html:481` |
| 典型 390×844 可見磚數（約） | 寬 ≈ `~360/48 ≈ 7–8 格`；高 ≈ `300–440/48 ≈ 6–9 格` | 推導：固定 48px + 相機置中 clamp（`ui.js:2175-2195`） |
| 農土配置 | **4×3 = 12 plots**（cols 2–5, rows 1–3） | `src/config.js:471-472` |
| 移動格時 | 200ms／格 | `src/config.js:497` `MOVE_MS = 200` |
| 主迴圈 | 250ms | `src/config.js:16` `tickMs: 250`；`ui.js:3159` |

**解讀**：手機上看不到整張 264 磚，只能透過 **camera 跟隨玩家** 探索；農土區在視野內時，每格約 **48×48 CSS px**，數值剛好貼近 iOS HIG 44pt 下限，但 **磚與磚零 gap、無 hit-slop**，肥指誤觸相鄰格機率高。

---

## 1. 種田／澆水／收成觸控目標

### 1.1 命中路徑（玩家手指 → 動作）

```
手指 tap → .gtile click（ui.js:1794）
  → handleMapClick(tileId)（2220）
  → switchTab("tile")（2225）  // 強制切側欄
  → actionTargetFor(tool, tile)（2239, 2517）
  → moveAndAct → walkPath → resolveAction（2551-2590）
     plant / harvest / water 在「走到目標後」結算
```

| 步驟 | 檔案:行號 | 行為 |
|------|-----------|------|
| 每磚一個 `div.gtile` | `ui.js:1787-1796` | 264 個獨立 click listener；`width/height = TILE(48)` |
| 物件不攔截點擊 | `index.html:512-513` `.ob { pointer-events: none }` | 作物／建築 sprite 不搶事件（優點） |
| 地圖禁瀏覽器預設手勢 | `index.html:476` `touch-action: none` | 避免捲動搶手勢；**也沒有自訂 pan／pinch** |
| 手工具空土 → plant | `ui.js:2519-2523` | **直接** `moveAndAct(..., "plant")`，到達即 `G.plant` 扣種子金 |
| 手工具成熟 → harvest | `ui.js:2524` | 到達即收成 |
| 澆水工具 | `ui.js:2529-2536` | 僅已種且未濕；誤點他格多為 toast invalid（成本低） |
| 選取高亮 | `ui.js:1819` + `index.html:497` `.gtile.sel` | 有 sel 框，但 **同一 click 已排程動作**，不是「先選再確認」 |

### 1.2 格子大小與誤觸

| 觀察 | 嚴重度 | 證據 |
|------|--------|------|
| 邏輯命中區 **剛好 48×48、零間距、無 padding hit area** | **P0**（農土叢集） | `ui.js:1792-1793`；`.gtile` 無 gap（`index.html:495`） |
| 農土 4×3 緊密相鄰；誤點相鄰空土會 **走路＋種植＋扣 `seedCost`** | **P0** | `actionTargetFor` plant 分支 `ui.js:2523`；`resolveAction` plant `ui.js:2565-2568`；種子成本 `config.js:27+` |
| 誤點未成熟作物 → toast「還沒成熟」，不走路 | P2（安全） | `ui.js:2524` |
| 誤點草地 → 純走路，無扣資源 | P2 | `ui.js:2242-2245` |
| 無拖曳平移、無捏合縮放；遠距農土需先走過去才進視口 | **P1** | 僅 `updateCamera` 跟隨（`ui.js:2175-2195`）；無 pointer pan |
| 智慧助手預設開、手機 **左右貼齊地圖底** 且 `z-index: 9900` | **P1** | `index.html:262-264,487`；`ui.js:1023,1498-1513` |
| 助手展開時可擋掉地圖下半部可點磚 | **P1** | 同上；收合後仍佔一列 `min-height: 44` 的 header 條 |
| 工具列／種子鈕本身達標（≥44–48 高） | OK | `.tool` `index.html:453`；`.seed` `165-166`；`.btn` `181` |

### 1.3 種田迴圈手機體感

1. 選種子（上方 seed-row，可 wrap）→ 選手工具 → 點農土。
2. 角色以 200ms／格路徑移動；途中玩家若連點其他格會清 `moveTimer` 重規劃（`ui.js:2198-2199`）。
3. **連點多格農土＝連續排程走＋種**，在小螢幕極易「想收成 A 卻種了 B」。
4. 澆水有專用工具或水井站點（`useStation`），誤觸成本低於種植。
5. 收成誤觸未成熟只 toast；誤觸空土卻會種——**不對稱**，種植風險最高。

### 1.4 本節 P0–P2 清單

| ID | 嚴重度 | 問題 | 檔案:行號 |
|----|--------|------|-----------|
| M-P0-01 | **P0** | 農土格 48px 零間距；單次 tap 即承諾 plant／harvest／water 路徑，無確認 | `ui.js:1792-1794,2220-2241,2517-2525,2551-2576` |
| M-P0-02 | **P0** | 誤點相鄰空農土會扣金幣種下當前種子（核心經濟誤操作） | `ui.js:2565-2568` + `config.js:27+` seedCost |
| M-P1-01 | **P1** | 無 map pan／zoom；相機僅跟隨；264 磚探索全靠走路 | `ui.js:2175-2195`；`index.html:476` |
| M-P1-02 | **P1** | 智慧助手蓋住地圖底緣可點區（手機全寬） | `index.html:262-264,487`；`ui.js:1498-1513` |
| M-P2-01 | **P2** | 僅 `click`、無 touch 座標容錯／最近格吸附 | `ui.js:1794` |
| M-P2-02 | **P2** | 舊 `#farm` plot 格仍建 DOM 但 `display:none`（多餘工作、非玩家可見） | `index.html:735`；`ui.js:508-519,3083-3085` |

---

## 2. 手機直式版面：農場視圖／面板／信箱

### 2.1 實際資訊架構（直式）

```
┌ header 資源列 ─────────────────┐
│ .main（overflow-y 內捲）        │
│  ┌ farm-panel ───────────────┐  │
│  │ 工具列 + 種子 + quest-dock │  │
│  │ #mapScene ~52vh           │  │  ← 主要「農場視圖」
│  │ （助手浮在地圖上）          │  │
│  └───────────────────────────┘  │
│  ┌ side-panel ───────────────┐  │  ← 常在 fold 下方
│  │ side-tabs×5（可 wrap）     │  │
│  │ 磚資訊 / 訂單 / 升級 /     │  │
│  │ 故事 / 圖鑑               │  │
│  └───────────────────────────┘  │
├ toolbar（設定／玩法…）──────────┤
└ footer 系列連結 ────────────────┘
信箱 = #lettersModal 全螢幕遮罩（非獨立路由）
```

| 機制 | 證據 | 手機影響 |
|------|------|----------|
| 單欄 grid | `index.html:91-93` `<860px` 無雙欄 | 農場與面板**垂直串聯**，非左右並存 |
| app-shell 禁頁捲 | `index.html:673-677` `body` 100dvh + `.main` 內捲 | R47 守門友善；但「切換」= **在 .main 內捲動** |
| 側欄分頁 | `switchTab` `ui.js:462-470`；`.side-pane` 顯隱 `index.html:106` | 5 tab min-height 44 OK |
| 點地圖強制磚資訊 tab | `ui.js:2225` | 會蓋掉故事／訂單選取狀態（視覺上）；**不捲到面板** |
| 信箱 | modal `index.html:823-828`；故事內按鈕 `ui.js:1626,1644-1645`；站點 mailbox | 非主列入口，新手難找 |
| 桌機 vs 手機地圖高度 | 桌機 flex 自適應 `index.html:682-689`；手機固定 52vh `481` | 短機（640 高）地圖吃掉大半，面板更遠 |

### 2.2 玩家任務流斷點

| 玩家意圖 | 現況 | 嚴重度 |
|----------|------|--------|
| 種完想看磚資訊／建築選單 | tab 已切 tile，但 **面板在地圖下方**，需手動上滑 `.main` | **P1** |
| 邊看訂單邊種田 | 訂單在下方 side-panel；地圖在上方；**無法並排** | **P1**（設計取捨，可接受但應有快捷回頂／回地圖） |
| 打開信箱 | 地圖 mailbox 站點或故事分頁「打開信箱」；無頂欄固定入口 | **P2** |
| 5 個 side-tab 文案＋圖示 | min-width 62 + wrap，可點 | OK（`index.html:99-100,681`） |
| 信箱窄螢幕 | list 上／paper 下 `index.html:386` | OK |
| RWD 矩陣含 390×844／360×640 | `scripts/test-rwd-matrix.js:35-36` | 驗「可點元素可達」，**不驗誤觸與任務流距離** |

### 2.3 本節 P0–P2 清單

| ID | 嚴重度 | 問題 | 檔案:行號 |
|----|--------|------|-----------|
| L-P1-01 | **P1** | 無「農場／面板／信箱」一級切換；直式僅靠長頁捲動 | `index.html:91-93,707-769` |
| L-P1-02 | **P1** | `switchTab("tile")` 不 `scrollIntoView` 側欄，點磚後資訊常不可見 | `ui.js:2225,462-470` |
| L-P1-03 | **P1** | 手機地圖 52vh + 工具 + 種子 + dock 疊加，有效「操作帶」被擠壓 | `index.html:452-453,163,250,481` |
| L-P2-01 | **P2** | 信箱入口分散（站點／故事），無常駐 mailbox 角標按鈕（僅 story badge） | `ui.js:1626,1644-1645`；badge `updateMailBadges` 路徑 |
| L-P2-02 | **P2** | 玩法 modal 文案仍像舊「點農場空地」grid，未對齊 RPG「走過去種」 | `index.html:810-815` |
| L-P2-03 | **P2** | 橫向手機 844×390 在 RWD 矩陣內，但地圖高度規則以 max-width 為主，橫向體感未專修 | `index.html:481` vs `test-rwd-matrix.js:37` |

**未列 P0 原因**：面板與信箱皆可經捲動／modal 抵達，屬「費力」非「斷死」。

---

## 3. R53–R54 特效負擔與 low 模式自動偵測

### 3.1 特效表面積（R53 juice + R54 cap）

| 效果 | Gate | 建立位置 | 清理／上限 |
|------|------|----------|------------|
| 粒子 burst／金幣飛／combo／季節 wash | `shouldUseJuiceFx` | `ui.js:109-125,167-314` | `FX_MAX_NODES=72`、`trimFxLayer`、`removeFxNode`（`63-64,137-158`） |
| map `spawnVfx` | `shouldUseJuiceFx` | `ui.js:2118-2136` | interval + 650ms timeout |
| 天氣 CSS 動畫 | `html.perf-low` 降密度／停 animation | `index.html:552-599` | low 仍顯示靜態 wash |
| 成熟 ready 點／任務標記 | **low 未停** | `index.html:520-535` `readyPulse`／`qbob` | reduced-motion 有部分覆蓋（`340-343`） |
| `updateMap` 全量重建動態物件 | **每 tick／low 每 1s** | `ui.js:1970-2011`：`obDyn` remove 全刪再建 | **主 CPU／DOM 成本，非 juice** |

### 3.2 auto / high / low 行為

| 項目 | 行為 | 檔案:行號 |
|------|------|-----------|
| 設定三態 | `auto` / `high` / `low`，預設 auto | `ui.js:1027,1236-1246` |
| auto 降級條件 | EMA FPS **&lt; 45 連續 30 幀** → `perfAutoLow` | `ui.js:1264-1272` |
| auto 恢復 | FPS **&gt; 53 連續 120 幀** | `ui.js:1275-1280` |
| low 實質節流 | `updateFarm`／`updateMap`／`renderSmartAssistant` **≥1000ms**（除非 force） | `ui.js:3081-3094` |
| juice 關閉 | `isLowPerformanceTier()` 或 reduced-motion | `ui.js:124-125,1247-1248` |
| **無**裝置預判 | 無 `navigator.deviceMemory`／`hardwareConcurrency`／`saveData` | 全 `src/` grep 無匹配 |
| 監測本身 | **永久 `requestAnimationFrame` 迴圈** | `ui.js:1250-1288` |

### 3.3 低階機真實負擔（對抗評估）

1. **264 個地面 DOM + atlas 背景** 常駐（`buildScene`），合理但偏重。
2. **高成本是 `updateMap`**：每個 refresh 刪除並重建作物／動物／bar／dot／NPC 動態節點（`1974-2009`），動物還含 Lissajous 漫遊（`2041+`）。  
   - high：約每 **250ms**（loop）+ 互動強制刷新。  
   - low：約每 **1s**——有幫助，但 **1 秒一次全量 DOM 仍不輕**。
3. R53–54 juice 在 low 下大多關閉 → **低階機瓶頸已不是粒子**，而是地圖刷新與 250ms 邏輯 loop。
4. auto 偵測只看 **raf 幀距**；熱節流（thermal）或「看起來卡但平均 FPS 剛好 46」可能不降級；反之背景 tab 幀距爆炸會**誤降級**（見 §4）。
5. 設定文案宣稱「節流地圖刷新並降級天氣動畫」（`ui.js:1044-1045`）——**大致成立**；未提 DOM 重建與無限 CSS 動畫殘留。

### 3.4 本節 P0–P2 清單

| ID | 嚴重度 | 問題 | 檔案:行號 |
|----|--------|------|-----------|
| F-P1-01 | **P1** | 低階主負擔是 `updateMap` 全量 DOM 重建，low 僅拉到 1s，無「靜止幀跳過／分層 dirty」 | `ui.js:1970-2011,3087-3090` |
| F-P1-02 | **P1** | auto-low **僅 FPS 反應式**，無開機硬體預判；低階機前 N 秒可能先卡再降 | `ui.js:1250-1288` |
| F-P1-03 | **P1** | `tickPlayer` 在 low 仍每 250ms 跑（走路／動作幀） | `ui.js:3095,2934-2955` |
| F-P2-01 | **P2** | `perf-low` 未停 `.ob-dot` `readyPulse`、`.qmarker` `qbob`（與 R5 殘留一致） | `index.html:520-535,338-339` |
| F-P2-02 | **P2** | `cropMatureCue` 先 `cropReadySeen.add` 再 juice gate → low→high 不重播 | `ui.js:261-265`（R5 已記） |
| F-P2-03 | **P2** | `floatText` 不進 `FX_MAX_NODES` 池（短命） | `ui.js:109-115` |
| F-P2-04 | **P2** | `#mapWorld { transition: transform .2s }` 與每步 camera 疊加，低階機平移可能拖泥帶水 | `index.html:492-493`；`ui.js:2194` |

**未列 P0**：high／auto 在中高階可玩；low 有實際降載，未到「不可遊玩」門檻（靜態評估）。

---

## 4. 長掛機與背景 tab 省電

### 4.1 背景行為現況

| 機制 | 背景 tab 時 | 檔案:行號 |
|------|-------------|-----------|
| 遊戲主 loop | `setInterval(loop, tickMs=250)` **持續註冊**；瀏覽器可能把 interval 夾到 ≥1s，但**程式未主動 pause** | `ui.js:3159`；`config.js:16` |
| 自動存檔 | `setInterval(..., autosaveMs=5000)` **持續** | `ui.js:3160`；`config.js:17` |
| FPS 監測 rAF | 背景通常被瀏覽器降到 ~1fps；**仍跑 frame 回呼** | `ui.js:1257-1288` |
| visibility API | **僅** Audio resume | `ui.js:333-334`（+ `pageshow` 338） |
| 離線收益 | 靠 `lastSeenAt` + 重開 `applyOffline`（設計正確） | `game.js` 時間推導模型；`ui.js:3125` |
| Wake Lock | 無 | —（掛機遊戲不鎖亮屏，正向） |

### 4.2 後果（手機玩家）

1. **耗電**：即使玩家只是「開著 PWA 切去 LINE」，JS 仍可能每秒觸發 helper／訂單刷新／（節流後）地圖 DOM 工作。  
2. **auto-low 誤觸發**：背景 rAF 幀距很大 → `perfAvgFps` 暴跌 → 30 幀後 `perfAutoLow=true`（`ui.js:1268-1272`）。回前台需 120 幀 &gt;53fps 才恢復，低階機可能**長期卡在 low**。  
3. **省電宣稱缺口**：設定 low 文案寫「降低耗電」（`ui.js:1045`），但 **hidden 狀態沒有比 visible 更省** 的專用路徑。  
4. R54 Audio guard 對「回前景有聲」有幫助，**與 GPU／主執行緒省電無關**。

### 4.3 本節 P0–P2 清單

| ID | 嚴重度 | 問題 | 檔案:行號 |
|----|--------|------|-----------|
| B-P1-01 | **P1** | `document.hidden` 時未暫停／降頻 `loop` 與 autosave | `ui.js:3051-3095,3159-3160` |
| B-P1-02 | **P1** | 背景 tab 會污染 auto FPS → 誤降級／回前景恢復慢 | `ui.js:1250-1288` |
| B-P1-03 | **P1** | 長掛機 online helper 在背景仍可能跑（瀏覽器允許時） | `ui.js:3067` `G.runHelperOnline` |
| B-P2-01 | **P2** | visibility 用途過窄（只 Audio），沒有統一 `onForeground` 刷新相機／layout | `ui.js:333-334,3137` |
| B-P2-02 | **P2** | 無「省電模式＝隱藏時完全凍結模擬」選項（idle 遊戲可選） | settings `ui.js:1020-1030` |

**未列 P0**：背景節流缺失是耗電／品質問題，通常不直接導致存檔損毀（仍有 autosave + beforeunload `ui.js:3161`）。

---

## 5. 彙總表（P0 → P2，可開票）

### P0

| ID | 摘要 | 主要錨點 |
|----|------|----------|
| M-P0-01 | 264 磚 48px 零間距，tap 即動作 | `ui.js:1792-1794,2220-2241` |
| M-P0-02 | 誤點相鄰空農土扣費種植 | `ui.js:2523,2565-2568` |

### P1

| ID | 摘要 | 主要錨點 |
|----|------|----------|
| M-P1-01 | 無 pan／zoom，探索全靠走 | `ui.js:2175-2195` |
| M-P1-02 | 智慧助手遮擋地圖底 | `index.html:262-264,487` |
| L-P1-01 | 無農場／面板／信箱一級切換 | `index.html:707-769` |
| L-P1-02 | 點磚不捲到磚資訊 | `ui.js:2225` |
| L-P1-03 | 直式垂直空間被地圖吃掉 | `index.html:481` |
| F-P1-01 | low 未解決 updateMap DOM 熱路徑 | `ui.js:1970-2011,3087-3090` |
| F-P1-02 | auto 無硬體預判 | `ui.js:1250-1288` |
| F-P1-03 | low 仍 250ms tickPlayer | `ui.js:3095` |
| B-P1-01 | 背景未停 loop／autosave | `ui.js:3159-3160` |
| B-P1-02 | 背景誤觸發 auto-low | `ui.js:1264-1280` |
| B-P1-03 | 背景仍可能 runHelperOnline | `ui.js:3067` |

### P2

| ID | 摘要 | 主要錨點 |
|----|------|----------|
| M-P2-01 | 無觸控 hit-slop | `ui.js:1794` |
| M-P2-02 | 隱藏舊 farm grid 仍 update | `index.html:735`；`ui.js:3083-3085` |
| L-P2-01 | 信箱入口弱 | `ui.js:1626` |
| L-P2-02 | 玩法文案未對齊 RPG | `index.html:810-815` |
| L-P2-03 | 橫向手機未專修 | `index.html:481` |
| F-P2-01 | low 殘留 infinite CSS | `index.html:520-535` |
| F-P2-02 | mature cue seen-before-gate | `ui.js:261-265` |
| F-P2-03 | floatText 池外 | `ui.js:109-115` |
| F-P2-04 | camera CSS transition | `index.html:492-493` |
| B-P2-01 | visibility 過窄 | `ui.js:333-334` |
| B-P2-02 | 無凍結模擬設定 | `ui.js:1020-1030` |

---

## 6. 已做得好的部分（監工對帳，避免只罵）

| 優點 | 證據 |
|------|------|
| 主要 CTA／tab／設定鈕多半 ≥44px | `index.html:100,181,256,265-275,363,393-397` |
| 物件 sprite 不搶點擊 | `index.html:512-513` |
| R47 app-shell 避免整頁亂捲、有 RWD 矩陣 | `index.html:664-697`；`scripts/test-rwd-matrix.js` |
| juice 受 `shouldUseJuiceFx` + R54 DOM cap | `ui.js:124-125,63-64,137-158` |
| low 節流地圖／助手至 1s + 天氣 CSS 降級 | `ui.js:3081-3094`；`index.html:589-599` |
| 信箱用 modal，閱讀體驗可接受 | `index.html:823-828,386` |
| 時間模型用 timestamp，不靠背景 tick 累積成長 | `game.js` 檔頭註解；離線 `applyOffline` |
| Audio 前景 resume（R54） | `ui.js:333-334` |

---

## 7. 建議驗收腳本（下輪實作後，非本輪執行）

1. **真機 360×640／390×844**：連續點 4×3 農土邊界，統計誤種次數（P0 回歸）。  
2. 點農土後 **不手動捲動**，磚資訊是否自動進入可視區（L-P1-02）。  
3. Chrome remote：背景 tab 60s，確認 `loop` 頻率與 `performanceInfo().autoLow`（B-P1-01/02）。  
4. 設定強制 low：收成連點，DevTools 看 `#screenFxLayer` 子節點 ≤72，且 `updateMap` 間隔 ≥1s。  
5. 助手展開／收合時，地圖南側站點是否仍可點。

---

## 8. 結論

以 **r55-20260712-1** 的手機玩家視角：

- **能玩**：地圖點得下去、工具／種子觸控面積合格、有 low 模式與 R53–54 juice 閘門。  
- **不夠「手機農作」**：264 磚 **48px 無間距 + tap 即種植** 使誤觸有真實金幣成本（**P0**）；直式 **農場與面板脫節**（**P1**）；特效已降，但 **DOM 地圖熱路徑與背景 tab 不節流** 才是低階機與長掛機的主因（**P1**）。

本報告 **只審不改**；修復優先序建議：`M-P0-01/02` → `B-P1-01/02` → `L-P1-02` → `F-P1-01` → 其餘 P2。

---

*審查者：Grok 手機端體驗監工 · 只讀覆核 · 2026-07-11*
