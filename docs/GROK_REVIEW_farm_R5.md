# Grok 對抗性覆核 — 像素農場 R5（r54 監工修正）

- **專案**：pixel-idle-farm-skill（《阿軒割割陽光農場》PWA / vanilla JS）
- **Base**：`30d7e55`（r53 / `previous-build`）
- **Head**：`9171599`（`r55-20260712-1`）
- **完整 HEAD**：`9171599ff29dc99f18a444a3381e9f509ab6b6ce`
- **宣稱**（commit message + `docs/CODEX_RESPONSE_farm_R4.md`）：
  1. FX DOM cap／long-idle cleanup（`FX_MAX_NODES`、`trimFxLayer`、`removeFxNode`、vfx timeout fallback）
  2. `low` + `prefers-reduced-motion` 降級缺口（`floatText`／`popCoinHud`／`cropMatureCue` + CSS）
  3. 離線季節摘要（`seasonsAdvanced`／`seasonsReached`／`skippedSeasonEvents` 進 offline modal + settings review）
  4. AudioContext guard（`forceResume`、`visibilitychange`／`pageshow`、closed reset、sound toggle unlock）
  5. 規則／經濟零改動（`game.js`／`config.js`／`state.js`）
- **審查角色**：監工／對抗覆核（只審不改；不橡皮圖章 Codex）
- **方法**：unified diff 全文 + 現況原始碼靜態讀碼 + `git diff --quiet`／blob 雜湊比對 + 對照 `docs/GROK_REVIEW_farm_R4.md` 各 P1
- **範圍**：只產出本文件（與 temp 副本）；不改遊戲程式／測試／資源
- **優先級**：
  - **P0**：規則層暗改、可感知長期 DOM 膨脹、明顯壞體驗／宣稱完全不成立
  - **P1**：降級／摘要／Audio 實質缺口、長掛機可重現失效、R54 引入之使用者可見回歸
  - **P2**：品質債、文案、邊界硬化、文件口徑不完全對齊、R4 已知殘留且本輪未宣稱修完者

---

## 執行摘要

| # | 宣稱／主題 | 結論 | 嚴重度 |
|---|------------|------|--------|
| 1 | 規則層零改動（`game.js`／`config.js`／`state.js`） | **成立**（blob 雜湊 r53＝r54；quiet diff exit 0） | — |
| 2 | FX DOM cap／long-idle cleanup | **主路徑成立**；`floatText`／tile 上 flash 不在 `FX_MAX_NODES` 池內 | P2 尖角 |
| 3 | low + reduced-motion 降級缺口 | **R4 P1 主缺口已修**（JS gate + CSS）；殘留 seen-before-gate、`perf-low` 仍允許 `.plot.ready` bob | P2 殘留 |
| 4 | 離線季節摘要 UI | **宣稱成立**（modal + settings 皆呈現）；空狀態「靜悄悄」未排除季節線；live 多季 wash 仍單次（非本輪宣稱失敗） | P2 殘留 |
| 5 | AudioContext guard | **R4 P1 毒化／長掛機 resume 主路徑已修**；仍未 await `resume()` 再播 oscillator | P2 殘留 |
| 6 | 新引入回歸 | **未見功能性回歸**；e2e atlas wait 屬硬化 | — |

**Top 殘留（建議下輪／非本輪阻擋）**

1. **P2** `cropMatureCue` 仍先 `cropReadySeen.add` 再 juice gate → low→high 不重播成熟 cue（`ui.js:261-265`）。
2. **P2** 離線空狀態仍可能在「僅季節推進」時追加「農場靜悄悄」（`ui.js:3014`）。
3. **P2** `playSound` 不 await `resume()`；closed context 當次播放直接 return。
4. **P2** `floatText` 掛 `document.body`、不進 `FX_MAX_NODES`；`perf-low` 未停 `.plot.ready`／任務 `qbob`。
5. **P2** 設定「Sound effects」英文文案；無 FX／Audio／季節摘要自動化測試。

---

## 1. 規則層零改動 git 驗證

### 1.1 變更檔清單（`30d7e55..9171599`）

| 檔案 | 角色 |
|------|------|
| `src/ui.js` | FX／降級／離線摘要／Audio guard 主體 |
| `index.html` | low／reduced CSS、版本 query |
| `package.json` | `appVersion` → `r55-20260712-1` |
| `sw.js`／`manifest.webmanifest` | CACHE／icon query |
| `scripts/test-rpg-v4-e2e.js` | 版本斷言 + SW offline atlas ready wait |
| `docs/CODEX_RESPONSE_farm_R3.md` | 文件微調 |
| `docs/CODEX_RESPONSE_farm_R4.md` | 本輪 Codex 回應（新增） |
| `docs/GROK_REVIEW_farm_R4.md` | 上一輪監工報告（入庫） |

**未出現在 runtime 規則 diff**：`src/game.js`、`src/config.js`、`src/state.js`、`src/atlas.js`。

### 1.2 雜湊／quiet diff

| 檔案 | r53 (`30d7e55`) blob | r54 (`9171599`) blob | `git diff --quiet 30d7e55 9171599 -- <file>` |
|------|----------------------|----------------------|-----------------------------------------------|
| `src/game.js` | `27c746eedb13b59827fe6b746465c1e78a341a10` | **相同** | exit **0** |
| `src/config.js` | `f9d9389de1622f755a4a380bc6d062eab79bb9e5` | **相同** | exit **0** |
| `src/state.js` | `76592aa9a279c9d0160934299823454f890b17c7` | **相同** | exit **0** |

合併驗證：`git diff --quiet 30d7e55 9171599 -- src/game.js src/config.js src/state.js` → exit **0**。

working tree 於 HEAD `9171599` clean；`stat` 約 9 files / +443 / −29。

### 1.3 規則層輸入（read-only 交叉）

`applyOffline` 仍（未改）寫入：

- `summary.seasonsAdvanced`／`seasonsReached`／`skippedSeasonEvents`（`game.js:2141-2144`）
- 來源 `advanceSeasonState`（`game.js:223-262`）

R54 **只消費**既有欄位做 UI 呈現，未改結算／季節推進公式。

**結論：宣稱「規則／經濟零改動」成立（git 硬證據）。**

---

## 2. FX DOM cap／long-idle cleanup

### 2.1 新增機制

| 機制 | 位置 | 行為 |
|------|------|------|
| `FX_MAX_NODES = 72` | `ui.js:64` | 硬頂常數 |
| `trimFxLayer(layer, room)` | `ui.js:137-147` | 進場前若 `children + room > 72` 由舊到新 `remove()` |
| `removeFxNode(el, ms)` | `ui.js:148-158` | `animationend` once + `setTimeout` fallback；`done` 防雙清 |
| vfx timeout | `ui.js:2135-2136` | `setInterval` 幀播 + `setTimeout(..., 650)` 清 interval／節點 |

套用 `trimFxLayer` 的路徑：`screenBurst`（172）、`flyCoinsToHud`（206）、`harvestComboText`（234）、`levelUpFx`（290）、`seasonTransitionFx`（311）、`spawnVfx`（2129）。

套用 `removeFxNode`：粒子／金幣／combo／mature-flash／fanfare／season-wash（原僅 `setTimeout`）。

### 2.2 對抗表

| 壓力情境 | 結果 | 判定 |
|----------|------|------|
| 連點收成尖峰 | 單層 ≤72 子節點；舊節點被 trim | ✅ cap 有用 |
| 長 AFK 無操作 | loop 不每 tick 噴 juice；節點仍有 timeout／animationend | ✅ 不預期 8h 單調膨脹 |
| map VFX interval 卡死 | 650ms fallback 清掉 | ✅ R54 強化 |
| `floatText` | 掛 `document.body`（`ui.js:109-115`），**不經** `trimFxLayer`／`FX_MAX_NODES` | P2（短命 900ms） |
| `softFlashAt`／mature-flash | 掛 tile DOM，不在 `#screenFxLayer` 池 | P2（單次 + removeFxNode） |
| toast | 仍 2100ms 自清、無硬頂 | 預既有 P2 |
| trim 砍掉仍在播的舊粒子 | 可接受 degradation；非洩漏 | 設計取捨 |

### 2.3 與 R4 對照

R4 評「主路徑不膨脹、無全域硬頂」為 **P2 尖角**。R54 補了層級硬頂與雙通道清理——**對 R4 建議屬加分，宣稱成立**。

**結論：FX DOM cap／cleanup 宣稱通過；池外短命節點為殘留 P2，非失敗。**

---

## 3. low + prefers-reduced-motion 降級

### 3.1 R4 P1 缺口是否關閉

| R4 問題 | R54 修法 | 證據 | 判定 |
|---------|----------|------|------|
| `popCoinHud` 在 juice gate 前被呼叫 | `flyCoinsToHud` 先 `shouldUseJuiceFx` 再 `popCoinHud`；`popCoinHud` 自身 gate | `ui.js:189-200` | ✅ 修 |
| `cropMatureCue` 無 juice gate | `if (!shouldUseJuiceFx()) return`（在 add seen **之後**） | `ui.js:261-265` | ✅ 動畫不跑；見 §3.3 殘留 |
| `floatText` 無 gate | 開頭 `shouldUseJuiceFx` | `ui.js:109-110` | ✅ 修 |
| CSS low 未停 coin-pop／mature-pop | `html.perf-low .coin-pop, .crop-mature-pop, .float, .mail-bell-ring { animation: none }` | `index.html:339` | ✅ 修 |
| reduced 未蓋 `.float`／`.plot.ready` | reduce 列表加 `.float, .plot.ready, .ob-dot` | `index.html:340-343` | ✅ 部分（見下） |

### 3.2 Codex 口徑壓力測試

Codex 寫：「CSS 也補 `.float`、`.plot.ready`、`.ob-dot`、`.coin-pop`、`.crop-mature-pop` 的降級保險。」

| 選擇器 | `html.perf-low` | `prefers-reduced-motion` |
|--------|-----------------|--------------------------|
| `.coin-pop`／`.crop-mature-pop`／`.float` | ✅ | ✅ |
| `.mail-bell-ring` | ✅ | ✅（列表原有） |
| `.plot.ready` | **❌ 仍 readyBob**（`index.html:141`） | ✅ |
| `.ob-dot` | **❌** | ✅ |
| 任務 `qbob`／ready 點 `readyPulse` | **未收** | **未收** |

→ Codex 對 **low 模式含 `.plot.ready`** 屬 **輕微超述**；reduced 側較接近事實。因 JS 已擋主要 juice，且 R4 的「成熟 pop／coin HUD 在 low 仍動」已關，**主宣稱仍評通過**，超述記 P2 文件／殘留。

### 3.3 殘留行為

1. **`cropReadySeen` 先寫後 gate**（`ui.js:263-265`）：low／reduced 期間成熟的格被標記 seen → 玩家改 high／關 reduced 後 **不重播** mature cue。非經濟錯誤；屬降級切換體驗尖角（P2）。
2. **`perf-low` 仍允許 `.plot.ready` bob** 與任務標記無限動畫（P2，與 R4 §3.3 預既有同類）。
3. **WebAudio 仍不受 juice／low 影響**（只看 `soundEnabled`）——R4 已標設計可議 P2，R54 未改、亦未宣稱改。

**結論：R4 P1「low／reduced 降級缺口」已實質關閉；殘留為切換／舊 infinite 動畫 P2。**

---

## 4. 離線季節摘要（vs 多季過場）

### 4.1 宣稱邊界（重要）

Codex：**規則層已有 catch-up；UI 呈現季節推進與 skipped；不在重開時補播多段過場 FX**。

→ 本輪成功標準是 **摘要可見性**，不是 live／offline 多段 `season-wash`。

### 4.2 UI 接線（成立）

| 路徑 | 位置 | 內容 |
|------|------|------|
| compact 存檔 | `ui.js:1398-1400` | `seasonsAdvanced`、`seasonsReached`（≤8）、`skippedSeasonEvents`（≤8） |
| settings 回顧 | `ui.js:1428-1429` | 「季節推進 N 次」「已結束節慶 N 個」 |
| offline modal | `ui.js:2989-3002` | 推進次數 + 到達季名；跳過節慶名稱（`SEASON_EVENTS` lookup + `escapeHtml`） |
| 規則輸入 | `game.js:2141-2144` | 未改，欄位齊全 |

### 4.3 對抗表

| 情境 | 表現 | 判定 |
|------|------|------|
| 離線跨多季、Lv≥6 | modal 有季節／節慶行；**無** init wash（`ui.js:3125-3129` 仍無 `seasonTransitionFx`） | ✅ 符合「摘要、不補播 FX」 |
| settings 回顧 | 有次數；節慶僅計數（無名稱列表） | ✅ 可用；名稱細緻度 P2 |
| 僅季節推進、無幣／無收成 | 有季節行，但 **仍可能** 追加「農場靜悄悄，沒有新進度」（`ui.js:3014` 未把 `seasonsAdvanced`／skipped 納入 empty 判定） | **P2 文案矛盾** |
| live 一次 `advance≥2` | loop 仍只 `updateSeason`→boolean→**單次** wash（`ui.js:3054-3057`） | R4 P1 的「多季洗色」**殘留**；**非 R54 宣稱失敗**（Codex 明示不補播） |
| 離線 0 季推進 | 不顯示季節行 | ✅ |

### 4.4 與 R4 P1 #4 對照

| R4 子項 | R54 |
|---------|-----|
| 摘要不提 `seasonsAdvanced`／`skippedSeasonEvents` | **已修** |
| 離線無 wash／中間季不播 | **刻意維持**（文件化） |
| live 多季單次 wash | **未動**（合理降為 P2 產品債） |

**結論：離線季節摘要宣稱通過；空狀態文案與 live 多季演出為殘留 P2。**

---

## 5. AudioContext guard

### 5.1 R4 P1 毒化路徑是否關閉

| R4 問題 | R54 | 判定 |
|---------|-----|------|
| `unlockAudio` 在 `audioUnlocked` 後直接 return，手勢無法 re-resume | 改 `unlockAudio(forceResume)`；條件 `!audioUnlocked \|\| forceResume \|\| state==="suspended"`（`ui.js:315-325`） | ✅ |
| once 手勢在毒化後無效 | once 傳入的是 **Event**（truthy）→ 等價 `forceResume`；且 `playSound` 每次 `unlockAudio(true)`（`ui.js:329-330,345`） | ✅ Event-as-flag **可接受** |
| 無 `visibilitychange`／`pageshow` | 已加；visible／pageshow 且已 unlock → `unlockAudio(true)`（`ui.js:332-340`） | ✅ |
| `soundEnabled` 關時 once 消耗後再開無聲 | toggle 開音效時 `unlockAudio(true)`（`ui.js:1456`）；點設定本身是 user gesture | ✅ 主路徑 |
| 長掛機 suspended | play 前 + visibility／pageshow force resume | ✅ 主路徑 |

### 5.2 殘留尖角（非宣稱失敗）

| 項 | 說明 | 級別 |
|----|------|------|
| 不 await `resume()` | `resume().catch(...)` 後立刻建 oscillator（`ui.js:323,359-369`）；極短窗可能仍靜音一拍 | P2 |
| `state === "closed"` | 當次 null 並 return，**丟掉該次** SFX；下次 `playSound` 重建（`ui.js:347`） | P2 罕見 |
| `audioCtx = audioCtx \|\| new Ctx()` | closed 物件若未被 playSound 清掉會卡死；目前 play 路徑會清 | 與上同 |
| 無手勢首次 `playSound`（mail） | 仍可能建 suspended context 並 `audioUnlocked=true`，但後續手勢／visibility／每次 play 的 force resume **可救**——R4 永久毒化已解 | ✅ 相對 R4 |

### 5.3 與「放置 8 小時」

- 音效節點仍非 DOM；風險是靜音非洩漏。
- R54 把「AFK 回前景無聲」主因對準了；監工評 **P1 關閉**。

**結論：AudioContext guard 宣稱通過；await／closed 當次丟音為 P2。**

---

## 6. 附帶變更與新風險掃描

| 項 | 說明 | 級別 |
|----|------|------|
| e2e atlas ready wait | `test-rpg-v4-e2e.js` offline 前後等 `Atlas.isReady` | 硬化，非回歸 |
| 版本 bump | `r55-20260712-1` 同步 html／sw／manifest／package／e2e | 預期 |
| trim 刪舊 FX | 尖峰時視覺被截斷，非邏輯錯 | 可接受 |
| `removeFxNode` + 無 CSS animation 的節點 | 依 timeout fallback，安全 | ✅ |
| 雙重 `sp.remove()`（interval 與 timeout） | 冪等無害 | ✅ |
| 經濟／存檔 schema | 未改 sell／訂單／offline 公式 | ✅ |
| 自動化測試 | 仍無 FX cap／Audio resume／offline 季節行單元測試 | P2 |
| 設定音效英文 | `ui.js:1441`「Sound effects」 | P2／nit（R4 已列、本輪延後） |

**未發現 R54 引入的功能性回歸（bug 級）。**

---

## 7. 新引入風險／殘留彙整

### 7.1 本輪引入或暴露的殘留

| ID | 說明 | 建議嚴重度 |
|----|------|------------|
| R5-A | offline empty-state 未排除季節／節慶 → 可能「有季節推進 + 靜悄悄」並存（`ui.js:3014`） | P2 |
| R5-B | `cropMatureCue` seen-before-gate（`ui.js:263-265`） | P2 |
| R5-C | `floatText` 池外；`perf-low` 未停 `.plot.ready` | P2 |
| R5-D | Audio 不 await resume；closed 丟當次音 | P2 |
| R5-E | live 多季仍單 wash（預既有；本輪明示不修 FX 補播） | P2 產品債 |
| R5-F | Sound 文案英文；缺針對性測試 | P2／nit |

### 7.2 R4 P1 關閉狀態

| R4 P1 | R5 判定 |
|-------|---------|
| Audio 毒化／長掛機 resume | **關閉** |
| 離線摘要缺季節／skipped | **關閉** |
| low 成熟 pop／coin HUD | **關閉** |
| （延伸）離線／多季無多段 wash | **降為 P2 殘留**（R54 明確不修演出、只修呈現） |

---

## 8. 總評

| 宣稱 | 監工判定 |
|------|----------|
| 規則／經濟零改動 | **通過**（blob + quiet diff） |
| FX DOM cap／long-idle cleanup | **通過**（硬頂 + 雙清 + vfx fallback） |
| low + reduced 降級缺口 | **通過**（R4 P1 已關；切換／bob 殘留 P2） |
| 離線季節摘要 | **通過**（modal + settings；空狀態文案 P2） |
| AudioContext guard | **通過**（R4 毒化路徑已關；await P2） |
| 零新回歸 | **通過**（靜態審查未見 bug 級回歸） |

**整體**：**R54 宣稱「通過」**。這是一輪對準 R4 三個 P1 的最小 UI 修正，規則邊界可信，對抗覆核下 **沒有把宣稱判假**；剩餘皆為 P2 品質／邊界／文件超述（Codex 對 low×`.plot.ready` 略滿），**不阻擋** r54 作為監工修正版的驗收。

不建議為本輪回頭改 `game.js` 經濟。下輪若排程，優先空狀態文案、`cropMatureCue` gate 順序、音效 i18n、以及可選的 live 多季提示（toast 即可，不必多段 wash）。

---

## 9. 建議驗收指令（不執行改碼）

```bash
# 規則層零 diff
git diff --quiet 30d7e55 9171599 -- src/game.js src/config.js src/state.js; echo $?
git rev-parse 30d7e55:src/game.js 9171599:src/game.js
git rev-parse 30d7e55:src/config.js 9171599:src/config.js
git rev-parse 30d7e55:src/state.js 9171599:src/state.js

# FX cap（DevTools）
# 1) 狂點收成：#screenFxLayer 子節點應 ≤72，尖峰後 1s 內回落
# 2) AFK 後回前景：層內接近 0～個位數

# low / reduced
# settings → performance low：無粒子、無 coin-pop／crop-mature-pop／float
# 仍可能見 .plot.ready bob（已知殘留）
# OS prefers-reduced-motion：#screenFxLayer display:none；.plot.ready 停動畫

# 離線季節摘要
# lastSeenAt 回撥 >40min、Lv≥6：重載 modal 應有 data-audit="offline-seasons"
# 可選：僅季節、無收益時是否仍出現「靜悄悄」

# Audio
# 冷啟動不點擊觸發 mail 音路徑後再點擊：應能恢復有聲（對照 R4 永久無聲）
# 播過音效後背景 10+ min 回前景再收成：應有聲
# 關 Sound effects 再開：點 toggle 後應嘗試 unlock
```

---

## Issues

### Issue 1 -- Severity: suggestion
- File: src/ui.js:3014
- Description: 離線摘要 empty-state 判定未納入 `seasonsAdvanced`／`skippedSeasonEvents`。僅季節 catch-up、無幣／無收成時仍會追加「農場靜悄悄，沒有新進度」，與上方季節行文案矛盾。
- Suggestion: empty 條件加上 `!(summary.seasonsAdvanced > 0)` 與 `!(summary.skippedSeasonEvents || []).length`，或改寫為中性提示。
- Status: open

### Issue 2 -- Severity: suggestion
- File: src/ui.js:263-265
- Description: `cropMatureCue` 在 `shouldUseJuiceFx()` 之前就 `cropReadySeen.add(key)`。low／reduced 期間成熟的格子之後切回 high 不會再播 mature pop／flash。
- Suggestion: 僅在實際播放 cue 成功後 add；或在 performance tier／reduced 變更時選擇性 clear ready seen。
- Status: open

### Issue 3 -- Severity: suggestion
- File: src/ui.js:343-371
- Description: `playSound` 呼叫 `unlockAudio(true)` 後不 await `audioCtx.resume()` 即建立 oscillator；`state === "closed"` 時當次直接 return，丟掉一次 SFX。
- Suggestion: resume then play（then／async）；closed 時重置後重試建立 context 再播。
- Status: open

### Issue 4 -- Severity: suggestion
- File: src/ui.js:109-115
- Description: `floatText` 雖已接 `shouldUseJuiceFx`，但仍 append 到 `document.body`，不受 `FX_MAX_NODES`／`trimFxLayer` 約束（與 screen／vfx 池不一致）。
- Suggestion: 改掛 `#screenFxLayer` 並走 `removeFxNode`，或維持現狀但文件化為可接受短命例外。
- Status: open

### Issue 5 -- Severity: suggestion
- File: index.html:141
- Description: `html.perf-low` 未停用 `.plot.ready` 的 `readyBob`（僅 `prefers-reduced-motion` 有停）。Codex 回覆暗示 low 也覆蓋 `.plot.ready`，與 CSS 不完全一致；任務 `qbob`／`readyPulse` 兩側皆未收。
- Suggestion: 若產品要 low＝少動效，於 `html.perf-low` 加 `.plot.ready, .qmarker, .ob-dot` 的 `animation: none`。
- Status: open

### Issue 6 -- Severity: nit
- File: src/ui.js:1441
- Description: 設定列「Sound effects」與英文說明，與面板其餘繁中不一致（R4 已列、R54 明示延後）。
- Suggestion: 改為「音效」／繁中說明。
- Status: open

### Issue 7 -- Severity: suggestion
- File: scripts/test-rpg-v4-e2e.js:274
- Description: 無針對 `FX_MAX_NODES`、`visibilitychange` resume、offline `data-audit="offline-seasons"` 的自動化斷言；回歸仍靠人工。
- Suggestion: 加最小 e2e／單元：mock offline summary 欄位渲染；可選 stub AudioContext state。
- Status: open

### Issue 8 -- Severity: suggestion
- File: src/ui.js:3054-3057
- Description: live 路徑 `updateSeason` 只回 boolean，一次跨多季仍最多一次 `seasonTransitionFx`（R4 已述）。R54 宣稱範圍是離線摘要而非多段 FX，故不列宣稱失敗，但體驗債仍在。
- Suggestion: 若要加強：toast 註明「推進 N 季」即可，不必多段 wash。
- Status: open

---

*報告結束。版本錨點：`r55-20260712-1` / `9171599` vs `30d7e55`。只審不改。整體宣稱：通過。*
