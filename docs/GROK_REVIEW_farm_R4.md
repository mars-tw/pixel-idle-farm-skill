# Grok 對抗性覆核 — 像素農場 R4（r53 爽度層）

- **專案**：pixel-idle-farm-skill（《阿軒割割陽光農場》PWA / vanilla JS）
- **對照版本**：`previous-build`（commit `30d7e55`；父 commit `93d2b98` = r52）
- **宣稱**：收成粒子／金幣飛欄／成熟閃光／澆水水花／季節過場／訂單慶祝／新信鈴鐺／WebAudio；**`game.js`／`config.js`／`state.js` 零 diff、全 UI 層**
- **審查角色**：監工／對抗覆核（只審不改）
- **方法**：`git diff` 雜湊比對 + 靜態讀碼（`src/ui.js`、`index.html` 與既有規則層）
- **範圍**：只產出本文件；不改遊戲程式／測試／資源
- **優先級**：
  - **P0**：規則層暗改、可感知長期 DOM 膨脹、明顯壞體驗
  - **P1**：降級／過場／Audio 實質缺口、長掛機可重現失效
  - **P2**：品質債、文案、邊界硬化、文件口徑不一致

---

## 執行摘要

| # | 主題 | 結論 | 嚴重度 |
|---|------|------|--------|
| 1 | 純規則層零 diff（`game.js`／`config.js`／`state.js`） | **成立**（blob 雜湊與 r52 完全相同；R53 只動 UI／版本／文件） | — |
| 2 | 長掛機粒子／動畫節點洩漏（8h DOM 膨脹） | **主路徑不膨脹**（節點皆 `setTimeout`／`setInterval` 自清；`cropReadySeen` 鍵有界） | P2 尖角 |
| 3 | `performanceMode low` 與 `prefers-reduced-motion` 降級完整度 | **主粒子／map-vfx 有擋**；**成熟彈跳／金幣 HUD pop 在 low 仍動**；reduced-motion 亦未蓋 `.float`／既有 infinite 動畫 | **P1** |
| 4 | 季節過場 × 離線／多季 catch-up 同時發生 | **過場只接 live `loop` 單次 `changed`**；離線多季 **無洗色**；中間季 **不播過場** | **P1** |
| 5 | WebAudio 解鎖與長掛機 `AudioContext` 狀態 | **手勢 once 解鎖可被 loop 音效搶先毒化**；**已 unlock 後 suspended 不再 resume** | **P1** |

**Top 殘留（建議下一輪優先）**

1. **P1** `playSound` 可在無手勢（例：時間解鎖新信）路徑建立／標記 `audioUnlocked`，且長掛機 `AudioContext` suspended 後無 `visibilitychange`／播放前 re-resume。
2. **P1** 離線 `applyOffline` 多季推進與 live 一次 `advance≥2` 時，季節過場只（可能）播落地季一次，或 **完全不播**；`skippedSeasonEvents` 也未進離線摘要 UI。
3. **P1** `performanceMode: low` 未關閉 `crop-mature-pop`／`coin-pop`；與「low 模式降級」宣稱不完全對齊。
4. **P2** 設定面板音效文案為英文；`docs/CODEX_RESPONSE_farm_R3.md` 把規則層 R3 修法寫進 r53 口徑，與 git 實際「r53 零規則 diff」易混淆。

---

## 1. git diff 驗證：純規則層是否真零改動

### 1.1 變更檔清單（`93d2b98..30d7e55`）

| 檔案 | 行數變化 | 角色 |
|------|----------:|------|
| `src/ui.js` | +262 / −14 | 爽度／音效／降級閘門主體 |
| `index.html` | +52 / −8 | CSS 動畫、`#screenFxLayer`、版本 query |
| `package.json` | appVersion → `previous-build` | 版本 |
| `sw.js` / `manifest.webmanifest` | CACHE／icon query | PWA 快取 |
| `scripts/test-rpg-v4-e2e.js` | 版本斷言 | 測試 |
| `docs/CODEX_RESPONSE_farm_R3.md` | 文件 | 非 runtime |

**未出現在 R53 diff**：`src/game.js`、`src/config.js`、`src/state.js`、`src/atlas.js`。

### 1.2 雜湊／quiet diff

| 檔案 | r52 blob | r53 blob | `git diff --quiet` |
|------|----------|----------|--------------------|
| `src/game.js` | `27c746e…` | `27c746e…` | exit 0（無 diff） |
| `src/config.js` | `f9d9389…` | `f9d9389…` | exit 0 |
| `src/state.js` | `76592aa…` | `76592aa…` | exit 0 |

working tree clean；`main` @ `30d7e55`。

### 1.3 宣稱邊界

- **成立**：R53 不改經濟／季節規則／存檔 schema 本體；爽度皆在 `ui.js` + `index.html` CSS。
- **注意（P2，文件）**：`docs/CODEX_RESPONSE_farm_R3.md:33-37` 描述 `closeSkippedSeasonEvents` 等 **game.js 修法並 bump 至 r53**，但該邏輯實際已在 **r52**（`game.js:310-324`）落地；r53 對 `game.js` 零 diff。監工以 **git 為準**：規則層零改動 **通過**。

**結論：宣稱「game.js／config.js／state.js 零 diff、全 UI 層」對 R53 commit 本身成立。**

---

## 2. 放置遊戲長掛機：粒子／動畫節點是否會膨脹

### 2.1 節點生命週期（create → remove）

| 效果 | 建立 | 移除 | 單次上限 |
|------|------|------|----------|
| 收成／水花等 burst | `ui.js:143-162` `screenBurst` → `#screenFxLayer` | `setTimeout(..., 980)` `p.remove()` | `min(count, FX_MAX_PARTICLES=28)`（`ui.js:63,147`） |
| 金幣飛欄 | `ui.js:172-193` | `setTimeout(..., 900)` | `min(count, 8)`（`ui.js:179`） |
| combo 字 | `ui.js:195-208` | `setTimeout(..., 820)` | 1 |
| 升級 fanfare | `ui.js:252-262` | `setTimeout(..., 1150)` | 1 |
| 季節 wash | `ui.js:275-282` | `setTimeout(..., 1050)` | 1／次觸發 |
| 成熟 flash | `ui.js:225-231` 掛在 tile DOM | `setTimeout(..., 620)` | 1／cue |
| 地圖 atlas VFX | `ui.js:2070-2086` `#vfxLayer` | `setInterval` 6 幀後 `sp.remove()` | 每 action 1 |
| 既有 float／toast | `ui.js:102-113` | 900ms／2100ms | 無硬頂，但短命 |

CSS：`index.html:301-319`（`#screenFxLayer` `pointer-events: none`、`overflow: hidden`）。

### 2.2 長掛機（純放置）來源

| 來源 | 是否每 tick 噴粒子 | 依據 |
|------|-------------------|------|
| `loop` 250ms（`config.js:16`，`ui.js:3094`） | **否**（helper 收成只 `renderResBar`／`updateFarm`） | `ui.js:2986-3024`；`runHelperOnline` 無 juice hook（`game.js:739+`） |
| 季節推進（20 min，`config.js:51`） | 最多 1 個 wash／次 | `ui.js:2989-2992` |
| 作物成熟 cue | 每格就緒 **一次**（`cropReadySeen`） | `ui.js:70,233-246,510-511,1933-1947` |
| 新信通知 | 解鎖當下 burst + 音效 | `ui.js:738-744` |

`cropReadySeen` 鍵為 `"plot:"+i`／`"map:"+plotIndex`（`ui.js:504-511,1933-1947`），`resetCropMatureCue` 在未就緒／空地時 delete → **集合大小 ≤ 農地格數量級**，非隨 8h 單調成長。

### 2.3 8 小時膨脹估量

- 離線／在線季節上界：`offlineCapMs` 8h（`config.js:15`）÷ 20 min ≈ **24 季**；即使每季一個 wash，仍是 **序列短命節點**，非累積。
- 高峰（玩家連點收成）：單次 burst ≤28 + 金幣 ≤8 + combo／float；毫秒級並存可到數十，**非 8h 線性累積**。
- 背景分頁：timer 可能延遲，節點多留幾秒～數分鐘，**最終仍會 remove**；未見「永不 remove」路徑。
- **診斷計數** `vfxSpawnCount++`（`ui.js:2069-2075`）只增不減——**非整 DOM 洩漏**，僅 debug 欄位。

### 2.4 殘留尖角（P2，非 8h 膨脹）

1. **無全域 FX 併發池／硬頂總節點數**：極端連點可短暫堆高主執行緒與 compositor（`will-change` 於 `index.html:305`）。
2. **`setTimeout` 清理 vs CSS `animationend`**：若未來動畫時長改長於 timeout，可能「早砍」；目前 timeout ≥ 動畫時長，方向安全。
3. **`updateMap` 每幀拆建 `obDyn`**（`ui.js:1926-1941`）：成熟 flash 可能隨 parent 被拆掉，timeout 仍對 detached node `remove()`——無害。
4. 舊路徑 **`floatText` 不經 `shouldUseJuiceFx`**（例：`ui.js:554,580`）：low／reduced 下仍可能短暫插 body 節點（短命）。

**結論：8 小時放置下 DOM 粒子層預期不會單調膨脹；主風險是尖峰連點，不是掛機洩漏。**

---

## 3. `performanceMode low` 與 `prefers-reduced-motion` 降級完整度

### 3.1 共同閘門

```text
shouldUseJuiceFx = !reducedMotion() && !isLowPerformanceTier()
```

| 函式 | 位置 | 行為 |
|------|------|------|
| `reducedMotion` | `ui.js:115-120` | `matchMedia('(prefers-reduced-motion: reduce)')` |
| `shouldUseJuiceFx` | `ui.js:122-123` | 雙條件 AND |
| `isLowPerformanceTier` | `ui.js:1205-1206` | `documentElement.dataset.performanceTier === "low"` |
| `applyPerformanceMode` | `ui.js:1194-1203` | `mode==="low"` 或 `auto && perfAutoLow` → class `perf-low`、tier `low` |

套用處（節選）：`screenBurst` `ui.js:144`；`flyCoinsToHud` 粒子段 `174`；`harvestComboText` `196`；`softFlashAt` `226`；`levelUpFx` fanfare `254`；`mailArriveFx` 鈴鐺 `267`；`seasonTransitionFx` `276`；**`spawnVfx` 新增閘門** `2071`（R53 相對 r52 強化）。

### 3.2 CSS 層

| 規則 | 位置 | 覆蓋 |
|------|------|------|
| `html.perf-low #screenFxLayer, .mature-flash { display:none }` | `index.html:338` | 螢幕層 + flash |
| `@media (prefers-reduced-motion: reduce)` 對 juice 類 `animation:none` + `#screenFxLayer { display:none }` | `index.html:339-343` | 粒子／coin／combo／fanfare／coin-pop／mature-pop／flash／season／bell |
| 天氣 reduced | `index.html:599` | `#weatherLayer` 偽元素停動畫 |
| 天氣 low 密度 | `index.html:588-597` | 預既有 |

### 3.3 完整度對照（對抗表）

| 爽度項目 | low 時 | reduced-motion 時 | 判定 |
|----------|--------|-------------------|------|
| juice 粒子／金幣飛／combo／wash | JS 不建立（`shouldUseJuiceFx`） | 同左 + CSS 隱藏層 | ✅ |
| map `spawnVfx` | 不建立 `2071` | 同左 | ✅ |
| 季節過場 | 不建立 | 同左 | ✅ |
| 新信鈴鐺 class | 不加 class | CSS 停動畫 | ✅ |
| **成熟 `crop-mature-pop`** | **`cropMatureCue` 未閘門**（`233-241`）仍加 class；low CSS **未**禁 | CSS `animation:none` | **low 缺口 P1** |
| **`popCoinHud`／`coin-pop`** | `flyCoinsToHud` **先** `popCoinHud()` 再 return（`172-174`）；賣出等路徑仍觸發 | CSS 停動畫 | **low 仍彈 HUD P1** |
| 訂單／升級 burst | 被 `screenBurst` 擋 | 同左 | ✅ |
| WebAudio | **不受** juice／low 影響，只看 `soundEnabled`（`302-303`） | 同左 | 設計可議 P2 |
| 既有 `.float` | 仍 append（`108-113,554,580`） | **不在** reduce 列表 | P2 |
| `.plot.ready` `readyBob`、任務 `qbob`、ready 點 `readyPulse` | 仍 infinite（`index.html:141-142,520-534`） | **未**停 | P2（預既有） |
| low 地圖 1Hz 節流 | 仍在（`ui.js:3016-3028`） | 無關 | ✅ 預既有 |

### 3.4 auto 降級與 juice

- FPS&lt;45 連續約 30 frame → `perfAutoLow`（`ui.js:1226-1231`）→ 同上 low 閘門，**新 juice 會停**。
- 回穩 120 frame 恢復（`1233-1238`）。

**結論：新粒子／map-vfx／季節洗色主路徑降級成立；「low 模式降級」對成熟彈跳與金幣 HUD 不完整（P1）。reduced-motion 對 R53 新 class 較完整，但未收斂舊 float／無限 bob。**

---

## 4. 季節過場 × 離線 catch-up 多季推進

### 4.1 規則層（未改，但決定 UI 輸入）

| 行為 | 位置 |
|------|------|
| 一次可 `advance = floor((now-until)/duration)+1` | `game.js:240-259` |
| 回傳 `{ changed, advanced, reached, skippedSeasonEvents }` | `game.js:257-259` |
| `updateSeason` **只回 boolean `changed`** | `game.js:264-265` |
| 離線：`applyOffline` → `advanceSeasonState(offlineNow)`，摘要含 `seasonsAdvanced`／`skippedSeasonEvents` | `game.js:2141-2144` |
| 跳過季事件標記 `skipped: true` | `game.js:310-324` |

### 4.2 UI 過場接線

**Live `loop` only：**

```text
seasonChanged = G.updateSeason(state, t)   // ui.js:2989
if (seasonChanged) {
  seasonTransitionFx(currentSeason id)     // ui.js:2990-2992
  toast 季節名 + 偏壓 + 可選季節事件提示   // ui.js:2993-2998
}
```

`seasonTransitionFx`：單層 `.season-wash`，色票 `FX_SEASON_COLORS`（`ui.js:64-68,275-282`），約 1s 後 remove。

### 4.3 離線 init 路徑

| 步驟 | 位置 | 過場？ |
|------|------|--------|
| `applyOffline` 已推進多季 | `ui.js:3060` | **無** FX |
| 再 `G.updateSeason(state, now())` | `ui.js:3064` | 通常 `changed=false`（已對齊 now）→ **仍無** FX |
| `showOfflineSummary` | `ui.js:2931-2953,3091` | **不顯示** `seasonsAdvanced`／`skippedSeasonEvents` |

→ 玩家離開 8h 回來（最多約 24 季）：**規則 catch-up 有、爽度過場零、摘要不提跳過季事件**。

### 4.4 同 tick 多季（分頁回前景／時鐘跳躍）

| 情境 | `advance` | UI 表現 |
|------|----------:|---------|
| 正常準時換季 | 1 | 1 次 wash + toast，色為**新季** |
| 一次跨 2+ 季 | ≥2 | **仍只 1 次** wash（落地季色）；中間季無過場 |
| 離線多季 + 再開頁 | ≥1 於 applyOffline | **0 次** wash；toast 季節也不走 loop 分支 |

與規則層「中間季事件 skipped、不補領」（r52／`game.js:310-324`）一致：**UX 上「多季同時發生」被壓成單次或零次演出**，易感覺「什麼都沒發生」或「只閃了落地季一下」。

### 4.5 與新信／摘要疊加

- 換季同 tick 仍 `checkNewLetters(t, true)`（`ui.js:3001`）→ 可能 **季節 toast + 新信 toast + 鈴鐺 + mail 音效** 疊加；wash `z-index:245`（`index.html:301`）高於 modal `150`（`index.html:345-346`），pointer-events none 不挡操作，但全屏色洗可能蓋在已開 modal 上（若未來 init 也接 FX 會更明顯）。
- 離線摘要與季節洗色目前 **不會** 同時（因 init 無 FX）——屬「漏演出」而非「撞車」。

**結論：過場未與離線多季 catch-up 對齊；多季推進只有落地季最多一次視覺。P1 體驗缺口（非經濟錯誤）。**

---

## 5. WebAudio 解鎖與長掛機 `AudioContext` 狀態

### 5.1 實作摘要

| 項目 | 位置 | 行為 |
|------|------|------|
| 狀態 | `ui.js:73-74` | `audioCtx`、`audioUnlocked` |
| 設定預設 | `ui.js:984`；面板 `1394` | `soundEnabled` 預設 true；**文案英文** P2 |
| `setupAudioUnlock` | `ui.js:296-300` | `pointerdown`／`keydown`／`touchstart`，`{ once:true, passive:true }` |
| `unlockAudio` | `ui.js:284-294` | 建 `AudioContext`／`webkitAudioContext`，`resume()`，**立即** `audioUnlocked = true` |
| `playSound` | `ui.js:302-329` | 關音則 return；未 unlock 則呼叫 `unlockAudio`；oscillator 短音序 |
| init | `ui.js:3040` | `setupAudioUnlock()` |
| 觸發例 | 收成／澆水／訂單／升級／新信／賣出等 | 多處 `playSound(...)` |

**無** `visibilitychange`／`pageshow`／`audioCtx.state` 輪詢／播放前強制 `resume`（全 `ui.js` 僅 `292` 一處 `resume`）。

### 5.2 解鎖正確性（對抗）

| 情境 | 結果 | 判定 |
|------|------|------|
| 使用者先點一下再操作 | once 手勢 → resume 多半 running → 後續 `playSound` OK | ✅ 主路徑 |
| **loop 先解鎖新信** `checkNewLetters(..., true)` → `playSound("mail")`（`738-744,3001`）且尚無手勢 | `playSound` → `unlockAudio` 無手勢建 context，常為 **suspended**，仍設 `audioUnlocked=true`（`285-293`） | **P1 毒化** |
| 上述後使用者第一次手勢 | once listener 呼叫 `unlockAudio`，但 **`if (audioUnlocked) return`** 直接離開 → **可能永不 resume** | **P1** |
| 設定 `soundEnabled=false` 時首次手勢 | `unlockAudio` 早退（`287`）；once 已消耗；之後開音效靠 `playSound` 無手勢建 ctx | **P1 尖角** |
| 長掛機／背景分頁後瀏覽器 suspend context | `playSound` **不**檢查 `ctx.state`，不 re-resume | **P1** |
| `soundEnabled` 關閉 | 不播；不關 context | P2 |
| 不支援 WebAudio | 靜默 return | ✅ 安全 |

### 5.3 與「放置 8 小時」關係

- 音效節點：oscillator 以 `stop(t0+…)` 結束，**非 DOM**，無 DOM 膨脹。
- 長掛機真正風險是 **靜音失效**（suspended），不是洩漏。
- 新信時間鎖在 AFK 中途觸發時，最容易踩「無手勢 unlock 毒化」；回座後點擊收成仍可能無聲直到整頁重載。

**結論：WebAudio 主路徑「首次點擊後有聲」大致成立；對抗性下解鎖旗標與長掛機 resume 不完整（P1）。**

---

## 6. 附帶觀察（非五題核心，供排程）

| 項 | 說明 | 級別 |
|----|------|------|
| 規則零 diff 與 CODEX 文件 | 見 §1.3 | P2 |
| 設定「Sound effects」英文化 | `ui.js:1394`；其餘 UI 繁中 | P2 |
| 澆水雙 VFX | map `spawnVfx` 水滴 + `waterSplashFx` emoji（`2526`） | 設計、非 bug |
| 左欄農地 vs 地圖 | 兩邊皆接 juice（`554-582` vs `2521-2526`） | 一致 |
| 經濟／存檔 | R53 未改 `sellValue`／訂單／離線公式 | 與宣稱一致 |
| 自動化測試 | 無針對 juice 洩漏／Audio resume／季節 FX 的單元測試；e2e 僅版本與既有 `perf-low` class | P2 |

---

## 7. 總評

| 宣稱 | 監工判定 |
|------|----------|
| 純規則與經濟不動 | **通過**（git 硬證據） |
| 全 UI 層爽度 | **大致通過**（實作集中 `ui.js` + `index.html`） |
| low 模式降級 | **部分通過**（粒子／vfx 有；成熟 pop／coin HUD 漏） |
| reduced-motion | **粒子層通過**；舊 bob／float 未收斂 |
| 長掛機不炸 DOM | **通過**（短命節點 + 有界 seen set） |
| 季節過場體驗完整 | **未通過多季／離線場景** |
| WebAudio 穩健 | **主路徑可；AFK／無手勢／suspend 不穩** |

**整體**：R53 作為「只加爽度、不動規則」的交付，**規則邊界可信**；爽度工程在清理與主閘門上有基本素養（timeout 移除、`FX_MAX_PARTICLES`、`spawnVfx` 接 low／a11y）。對抗覆核下，**Audio 解鎖狀態機**、**離線／多季過場缺席**、**low 降級尾部** 是下一輪最值得打的三個 P1，無需為了本輪回頭改經濟。

---

## 8. 建議驗收指令（人工／下輪，本文件不執行改碼）

```bash
# 規則層零 diff
git diff 93d2b98..30d7e55 -- src/game.js src/config.js src/state.js

# 長掛機（DevTools）
# 1) 開 Performance / 數 #screenFxLayer 子節點與 #vfxLayer
# 2) AFK 30–60 min（或把 SEASON_DURATION 暫改短做本地驗證）後再數；應接近 0～個位數
# 3) 狂點收成 5s：尖峰上升後 1s 內回落

# low / reduced-motion
# settings → performance low：收成應無粒子，但觀察 .crop-mature-pop 與 .res.coins.coin-pop
# OS 開 prefers-reduced-motion：#screenFxLayer 應 display:none

# 離線多季
# lastSeenAt 回撥 >40min、Lv≥6：重載後應有季節狀態推進，但無 season-wash；摘要無 seasonsAdvanced

# Audio
# 冷啟動不點擊，調系統時間觸發新信；再點擊操作——是否長期無聲
# 播放過音效後切背景 10+ min 回前景再收成——是否無聲
```

---

*報告結束。版本錨點：`previous-build` / `30d7e55`。只審不改。*
