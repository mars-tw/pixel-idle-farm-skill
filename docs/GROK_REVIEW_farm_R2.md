# Grok 對抗性覆核 — 像素農場 R2（對 R49 修正）

- **專案**：pixel-idle-farm-skill（《像素農場》PWA / vanilla JS）
- **對照版本宣稱**：`r49-20260710-1`（見 `docs/CODEX_RESPONSE_farm_R1.md`）
- **審查基準**：`src/config.js`、`src/game.js`、`src/state.js`、`src/ui.js`（**無** `src/rules.js`；規則在 `game.js`）
- **審查角色**：資深遊戲經濟／系統稽核（對抗性、只審不改）
- **方法**：靜態讀碼 + Node 載入真實模組最小重現（非改碼）
- **範圍**：只產出本文件；不改遊戲程式／測試／資源
- **優先級**：
  - **P0**：錯誤進度、可穩定利用的經濟破局、明顯壞體驗（進度倒退／半壞存檔）
  - **P1**：實質正確性缺口、可感知效能成本、存檔相容尖角
  - **P2**：品質債、邊界硬化、可讀性

---

## 執行摘要

| # | 主題 | 結論 | 嚴重度 |
|---|------|------|--------|
| 1 | `maxCount` 擋住 growthAura／seasonalSellBonus／silo 連乘 | **成立**（效果層＋建蓋層皆封頂；舊重複建築只算 1 次效果） | — |
| 2 | 舊存檔已有兩座同類是否仍被計兩次 | **效果不計兩次**；實體仍佔兩格且 `buildingCount` 仍為 2（阻擋再建） | P2 殘留 |
| 3 | `plotCount` 6→8→10→12 與遷移 | **成立**（舊 Lv4 夾到 Lv3，有效農地 12 不倒退） | — |
| 4 | 離線季節 catch-up | **未完全修好**（季數／`untilMs` 推算正確；`seasonsReached` 在「直接跨季」時可能漏掉**出發季**→信箋延遲） | P1 |
| 5 | 髒 map 遷移 | **主路徑成立**；**殘留**誤殺合法／半合法 map 時**整包 wipe buildings/animals** | P1 |
| 6 | low 效能節流 | **部分成立**（1Hz 地圖／農地／助手）；動態 DOM 仍整批重建 | P2 殘留 |
| 7 | 新引入決定性／相容 | 無新 RNG 決定性問題；**動物家（雞舍等）仍無 `maxCount`** 可堆容量 | P1 殘留 |

**Top 殘留（建議下一輪優先）**

1. **P1** `advanceSeasonState` 跨季時不把「當下已過期的出發季」寫入 `seasonsReached` → 舊檔／首 tick 已過期時季節信箋可漏解鎖（最多拖延到該季再次被 step 到）。
2. **P1** `healthyMap` 失敗時重建 map **並重置** `buildings`／`animals`／`player`（金幣／倉庫／故事保留）→ 誤判成本高。
3. **P1** `chickenCoop`／`barn`／`duckPen` 無 `maxCount`，仍可多蓋堆動物產能（R49 經濟封頂未覆蓋此面）。

---

## 1. maxCount 封頂與成長／售價連乘

### 1.1 設定面

| 建築 | `maxCount` | 效果 | 檔案 |
|------|------------|------|------|
| `compostHeap` | 1 | `growthAura: 0.90` | `src/config.js:289-292` |
| `beeBox` | 1 | `growthAura: 0.92`（+動物） | `src/config.js:303-306` |
| `greenhouse` | 1 | `growthAura: 0.88` | `src/config.js:310-313` |
| `festival_stall` | 1 | `seasonalSellBonus: 0.15` | `src/config.js:314-317` |
| `silo` | 1 | `storageBonus: 90` | `src/config.js:293-296` |
| `chickenCoop`／`barn`／`duckPen` | **無** | capacity 等 | `src/config.js:297-309` |

### 1.2 執行面

- **建蓋擋第二座**：`buildingAtMaxCount` → `buildBuilding` 回 `max_count`  
  - `src/game.js:623-634`
- **效果封頂（含舊存檔重複）**：`effectBuildingAllowed` 依 `def.maxCount` 每 type 只放行 N 次  
  - `src/game.js:69-92`（`buildingGrowthAura`／`buildingSeasonalBonus`）  
  - `src/game.js:122-130`（`storageCapacity` 的 `storageBonus`）

永久成長光環理論封頂：

`0.90 × 0.92 × 0.88 = 0.72864`（與 Codex 經濟說明一致；Node 實測相同）

季節直售攤位加成封頂：`+0.15`（兩座 legacy stall 仍為 0.15）

### 1.3 舊存檔兩座同類會不會仍被計兩次？

| 面向 | 行為 | 結論 |
|------|------|------|
| `buildingGrowthAura` | `seen[type]` 達 `maxCount` 後略過 | **不計兩次效果** |
| `buildingSeasonalBonus` | 同上 | **不計兩次效果** |
| `storageCapacity` | 同上 | **不計兩次倉容** |
| `buildingCount` | 仍 `filter` 全數 | 仍為 2（用來擋再建） |
| 地圖實體 | **不遷移刪除**多餘建築 | 占格／視覺殘留 |

**結論：成立（經濟連乘已堵住）。**  
舊兩座堆肥不會變成 `0.90²`；只會有 1 座生效。

**最小重現（Node）**

```js
const st = S.defaultState(T0);
st.level = 3; st.coins = 9999; st.materials.compost = 5;
G.buildBuilding(st, firstBuildable(st).id, "compostHeap", T0);
// 第二座 → reason: "max_count"
st.buildings.push({ id: "legacy_dup", type: "compostHeap", tileId: "...", builtAt: T0, level: 1 });
// buildingGrowthAura(st) === 0.90  （不是 0.81）
```

（與 `scripts/test-systems.js` §2、§4 一致。）

### 1.4 殘留：動物家仍可無限蓋

- `chickenCoop`／`barn`／`duckPen` **沒有** `maxCount`。
- 實測可連續 `buildBuilding(..., "chickenCoop")` 多座；每座 `capacity: 3` 且蓋成時自動 +1 雞。
- `animalCapacity` 按 **單一 buildingId** 計算（`src/game.js:654-659`），多座 ⇒ 總產能線性堆疊。

**結論：R49 對「光環／攤位／筒倉」成立；對「動物產能堆疊」未覆蓋（P1 殘留，非回歸，是封頂範圍不完整）。**

---

## 2. plotCount 曲線與遷移

### 2.1 現行曲線

- `GAME.startPlots = 6`，`maxPlots = 12`（`src/config.js:12-13`）
- `UPGRADES.plotCount.levels`：`8 → 10 → 12` 三級（`src/config.js:66-72`）
- `activePlotCount`：`lv>0 ? levels[lv-1].value : startPlots`（`src/game.js:261-263`）

每級 +2 格，滿級 = `maxPlots`。Codex「無效末級」已消除。

### 2.2 遷移夾緊

`src/state.js:228-232`：

```text
raw = floor(upgrades[key])（非 finite 則用預設 0）
upgrades[key] = clamp(raw, 0, levels.length)
```

| 舊 `plotCount` | 遷移後 | `activePlotCount` | 農地是否倒退 |
|----------------|--------|-------------------|--------------|
| 0 | 0 | 6 | 否 |
| 1 | 1 | 8 | 否 |
| 2 | 2 | 10 | 否 |
| 3 | 3 | 12 | 否 |
| 4（舊無效滿級） | **3** | **12** | **否**（與舊滿級同為 12） |
| 5／過大 | 3 | 12 | 否 |
| -1 | 0 | 6 | 異常值歸零（可接受） |

`plots[]` 不足時補到 `maxPlots`（`src/state.js:277-279`）；**不刪**既有格子上的作物。滿級後 `plant(11, …)` 可用。

**結論：成立。** 舊滿開墾存檔不會農地倒退或超界（上限仍 12；`plant` 用 `activePlotCount` 鎖）。

**最小重現**

```js
const m = S.migrate({ version: 1, upgrades: { plotCount: 4 }, map: S.defaultState(T0).map });
// m.upgrades.plotCount === 3
// G.activePlotCount(m) === 12
```

---

## 3. 離線季節 catch-up

### 3.1 已修好的部分

`advanceSeasonState`（`src/game.js:210-244`）：

- 過期時：`advance = floor((now - untilMs) / duration) + 1`（含恰在邊界的 +1）
- 新季：`id = (fromIdx + advance) % len`
- 新截止：`untilMs' = untilMs + advance * duration`（**保留季內相位**，非粗暴 `now+duration`）
- `applyOffline` 在作物結算前呼叫（`src/game.js:1957-1961`）
- 登入後 `ui.js` 再 `updateSeason(now)`（`src/ui.js:2738-2742`）→ 離線上限 8h 之外的牆鐘時間會被線上 tick 補完

**邊界實測（成立）**

| 情境 | 結果 |
|------|------|
| `until=T0+D`，`now=T0+D` | 進 1 季，相位正確 |
| `until=T0+D`，`now=T0+3D+500` | `seasonsAdvanced=3`，落在冬，與 economy 測例一致 |
| 離線 cap 後 `lastSeenAt=now`，再 `updateSeason(far)` | 補上 cap 外剩餘季 |

### 3.2 未完全修好：`seasonsReached` 漏出發季

跨季分支只對 **step = 1…min(advance,4)** 的**目標季**呼叫 `recordSeasonReached`，**不**先記錄「當下已過期、正要離開」的 `state.season.id`。

全季掃過的保底僅在 `advance >= SEASONS.length`（`src/game.js:237-238`）。

因此當 `seasonsReached` 尚空、且第一次結算就已 `now >= untilMs` 時：

| 出發季 | advance | 寫入的 reached | 漏掉 |
|--------|---------|----------------|------|
| 春 | 1 | 夏 | **春** |
| 春 | 2 | 夏、秋 | **春** |
| 春 | 3 | 夏、秋、冬 | **春** |
| 春 | ≥4 | 四季（保底） | 無 |
| 夏 | 3 | 秋、冬、春 | **夏** |

**實測（信箋）**

```text
migrate 舊檔：level=8, season={id:'夏', untilMs:T0}, seasonsReached={}
applyOffline(..., T0+2*D)
→ seasonsReached = {秋,冬,春}，缺「夏」
→ evaluateLetters 解鎖 letter_spring/autumn/winter，**不解鎖 letter_summer**
```

常規在線遊玩：每 tick 未過期時會 `recordSeasonReached(當季)`（`src/game.js:242-243`），多半已寫入出發季，問題較少。  
**高風險路徑**：舊存檔無 `seasonsReached`、或首次載入時 `untilMs` 已過期並一次 catch-up 多季。

信件解鎖本身幂等（`mail.unlocked[id]=true` 一次），**不會**因 catch-up 重複發獎；問題是**漏解鎖／延後**（等到該季再次成為 step 目標，最多約再繞一圈季節）。

**off-by-one 對「目前是哪一季」？** 實測公式對 id／untilMs **無** off-by-one。  
**off-by-one／語意缺口在「reached 集合是否含出發季」。**

### 3.3 其他季節邊角

- **離線 cap**：摘要只反映 cap 窗內跨季；cap 外靠登入後 `updateSeason` — 可接受，但摘要 `seasonsAdvanced` 可能小於真實牆鐘跨季（P2）。
- **Lv&lt;6 離線**：季節鎖春且 `untilMs=0`；升級到 6 後才開 timer，**不會**回補升級前牆鐘（設計／P2）。
- **`currentSeason` 純讀 vs `advanceSeasonState` 寫入**：售價可「預覽」未 commit 的季；主 loop 先 `updateSeason` 再 UI，主路徑安全。

**結論：未完全修好（P1）。** 多季推進與經濟季別正確；`seasonsReached`／季節信箋在「空統計 + 直接跨季」不完整。

---

## 4. 髒 map 遷移健全性

### 4.1 已修好

`healthyMap`（`src/state.js:71-91`）檢查：

- `width/height`、`tiles` 為陣列且 `length === MAP_W * MAP_H`
- 座標在界、無重複 coord
- `id === "t"+x+"_"+y`、id 唯一
- `terrain ∈ TERRAIN`
- soil：`plotIndex` 為整數且 ∈ `[0, maxPlots)`、唯一；非 soil 不得帶 `plotIndex`
- 最終 `plotIndexes.size === maxPlots`

失敗則（`src/state.js:268-270`）：

- 換新 `makeMap()` 地圖
- **重置** `buildings`／`animals`／`player` 為預設種子
- 保留金幣、倉庫、故事等（經 `Object.assign` 合併）

空 `tiles: []` 且維度相符 → 重建：有測（`scripts/test-systems.js` §14c）。

**結論（主宣稱）：成立。** 不再「只認寬高就信任髒 tiles」。

### 4.2 殘留／風險

#### A. 誤殺合法或半合法 map → 建築／動物歸零（P1）

`Number.isInteger(tile.plotIndex)` 拒絕字串 `"0"` 等。若匯入／手改／工具鏈把 plotIndex 序列成字串：

- `healthyMap` → false  
- **玩家自建 silo／堆肥／動物全消失**（金幣還在）

實測：`plotIndex` 改字串 → rebuild 且 `buildings` 被 wipe。

同樣：任一 soil 缺損導致 `plotIndexes.size !== 12`（例如 11 塊 soil）→ 整圖重建 + wipe。

#### B. 漏掉某種「壞 map」（P1／P2）

通過 terrain／座標檢查後**仍可能**：

| 壞法 | 是否擋下 |
|------|----------|
| 空 tiles／缺磚 | 是 |
| 重複座標／錯 id | 是 |
| 錯 terrain 名 | 是 |
| soil 數量不對 | 是 |
| **部分** `structureId`（footprint 殘缺） | **否** — `refreshDerivedMapFields` 僅在「完全沒有 structureId」時才 `applyStructures`（`src/state.js:96`） |
| station／NPC 殘缺但「有一個」 | **否** — 同上 early-out |
| `buildingId` 孤兒、與 `buildings[]` 不一致 | **否** |
| layout 與正式 MAP 座標不同但 12 soil 自洽 | **否**（視為自訂合法） |
| `bridgeRepaired` 與磚旗標 | 可行走性讀 `flags`（`game.js:809-810`），重建後旗標仍在通常 OK |

#### C. wipe 策略與文案

Codex：「不健康就重建 map，但保留金幣、倉庫、故事」。  
**未提** buildings／animals 會回到種子雞舍。對「僅 map 髒、建築陣列完好」的存檔過於兇（P1 產品風險）。

**結論：主修復成立；健全性仍偏「全有或全無」，誤殺代價高，且半殘 structure 可能漏網。**

---

## 5. low 效能模式節流

### 5.1 已做

- `performanceMode`: `auto|high|low`（`state.js` migrate 夾緊；`ui.js` 設定）
- low／auto 降級：`dataset.performanceTier=low`（`ui.js:912-921`）
- 主 loop（`ui.js:2695-2708`）：
  - `updateFarm`／`updateMap`：**≥1000ms** 或 force（幫手收成／天氣／季節變）
  - `renderSmartAssistant`：1Hz
- `paintGround`：`groundSig` 未變 skip atlas 重貼（`ui.js:1474-1497`）

### 5.2 未完成（相對 R1 P-P0-01）

- `updateMap` 觸發時仍 **整批刪除重建** 作物／動物／NPC DOM（`ui.js:1626-1658`）
- `tickPlayer`、helper、訂單仍 250ms
- 成熟 UI 最多延遲 ~1s（low 可接受）

**結論：部分成立（節流有接上；非完整渲染架構修復）。** 無發現因此引入的決定性／經濟錯誤。

---

## 6. 新引入的決定性／存檔相容

| 項目 | 判定 |
|------|------|
| RNG 仍 `Math.random` 預設 | **未改**（R1 延後；非 R49 新引入） |
| `GAME.version` 仍為 1 | 靠 `healthyMap`+欄位 migrate，無 mapRevision |
| plotCount 長度 4→3 | clamp 相容，**不倒退**有效格數 |
| maxCount 效果 cap | 舊重複建築經濟**變弱**（有意 nerf，非存檔損毀） |
| 髒 map wipe 建築 | **相容尖角**：進度子集可能被清 |
| 成長倍率仍「當下重算」 | C-P0-01 **仍未修**（Codex 已承認延後） |
| 無 `src/rules.js` | 規則集中 `game.js`；審查範圍以實檔為準 |

**結論：R49 未引入新的 RNG 非決定性；主要相容風險在「map 不健康 ⇒ 建築動物重置」與「季節 reached 漏記」。**

---

## 7. 逐條對 R1／R49 宣稱

| R1 ID | R49 宣稱 | 本輪結論 | 證據 |
|-------|----------|----------|------|
| C-P0-02 growthAura 無限連乘 | maxCount + effect cap | **成立** | `config.js:289-313`，`game.js:69-85` |
| C-P0-03 季節攤位疊加 | maxCount + effect cap | **成立** | `config.js:314-317`，`game.js:87-92` |
| B-P0-01 建築堆疊破局 | 含 silo | **部分成立** | silo／光環／攤位 OK；**動物家仍可堆** |
| B-P1-01 plotCount 無效級 | 6→8→10→12 + 遷移 | **成立** | `config.js:66-72`，`state.js:228-232` |
| C-P1-01 髒 map | healthyMap | **成立（主）／未完全（wipe／半殘）** | `state.js:71-91,261-270` |
| C-P1-02 離線只進一季 | advanceSeasonState | **未完全修好** | 季別 OK；`seasonsReached` 漏出發季 |
| P-P0-01 地圖刷新 | low 1Hz + groundSig | **部分成立** | `ui.js:2695-2708,1474-1497` |
| C-P0-01 成長回溯 | 延後 | **仍開著** | `getCropProgress` 仍用當下 `effectiveGrowMs` |

---

## 8. 建議修補方向（只建議不實作）

1. **季節 reached**：在 `now >= untilMs` 分支**先** `recordSeasonReached(state, state.season.id)`，再 step 後續季；或 `reached` 含 closed interval 出發季。補測：空 `seasonsReached` + 過期 `untilMs` + multi-advance ⇒ 出發季信箋可解鎖。
2. **map 遷移**：不健康時可「只換 tiles／layout」，**保留**可校對的 `buildings`/`animals` 或做 buildingId 重綁；`plotIndex` 接受 `Number(x)` 後再 `Number.isInteger`。
3. **動物家 `maxCount: 1`**（或全服 capacity 聚合上限），與光環建築一致。
4. **半殘 structure**：`refreshDerivedMapFields` 改為校驗 footprint 完整性，失敗再 full apply。

---

## 9. 審查環境備註

- 已讀：`src/config.js`、`src/game.js`、`src/state.js`、`src/ui.js`、R1 報告與 Codex R49 回應、相關 `scripts/test-*.js` 片段。
- 以 Node `require` 真實模組做最小重現；**未**改任何程式檔。
- 本文件路徑：`docs/GROK_REVIEW_farm_R2.md`。

---

## 10. 一句話總評

R49 對「光環／攤位／筒倉連乘」與「plotCount 無效級」的經濟封頂**站得住**；離線多季推進的**時鐘語意正確**，但 **`seasonsReached`／季節信箋在直接跨季時仍可能漏出發季**；髒 map 檢查**有比 R1 前嚴格**，但失敗時 **wipe 建築動物** 過重，且半殘 structure 可能漏檢。動物家無 `maxCount` 仍是產能堆疊口。下一輪應優先修季節 reached 與 map 遷移保留策略，而非再動 plot 曲線。
