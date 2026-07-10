# Grok 對抗性覆核 — 像素農場 R3（r51 內容擴充 P0）

- **專案**：pixel-idle-farm-skill（《阿軒割割陽光農場》PWA / vanilla JS）
- **對照版本**：`r51-20260710-1`（`index.html` / `sw.js` / `package.json.appVersion`）
- **對照計畫**：`docs/CONTENT_PLAN_farm_R1.md` §5 P0-1～P0-6
- **審查基準**：`src/config.js`、`src/game.js`、`src/state.js`、`src/ui.js`、atlas validators、既有 Node 測試（**無** `src/rules.js`）
- **審查角色**：資深遊戲系統稽核（對抗性、只審不改）
- **方法**：靜態讀碼 + Node 載入真實模組最小重現（非改碼）
- **範圍**：只產出本文件；不改遊戲程式／測試／資源
- **優先級**：
  - **P0**：錯誤進度、可穩定利用的經濟破局、明顯壞體驗
  - **P1**：實質正確性缺口、內容承諾未達、存檔相容尖角
  - **P2**：品質債、敘事／文案落差、邊界硬化

---

## 執行摘要

| # | 主題 | 結論 | 嚴重度 |
|---|------|------|--------|
| 1 | `SEASON_ORDER_BIAS` 不改 base `sellValue` | **成立**（只改抽選；`makeOrder` 用 raw `sellValue`；合約價仍不吃天氣） | — |
| 2 | `radish`／`sunflower` 期望金 ≤ strawberry | **成立**（單次直售與金／分鐘皆低於草莓） | — |
| 3 | `memory_garden` 無成長光環／售價加成 | **成立**（僅 `orderXpBonus: 0.05` + 信件） | — |
| 4 | `SEASON_EVENTS` 不疊 `sellMul` | **成立**（獎勵為 XP／收藏／小額固定幣／waterAll） | — |
| 5 | 新成就 `neighborLetters` 真 `noBonus` | **成立**（`achievementBonus` 跳過；讀四封信 bonus 不變） | — |
| 6 | 偏壓 × `availableOrderItems` 邊界 | **成立**（`preferred ∩ pool`；未解鎖作物不會被偏壓選中） | — |
| 7 | 季節事件去重 × 離線多季 catch-up | **同 cycle 不重複**；**跨多季中間季事件永久漏領** | **P1** |
| 8 | 四封信 unlock × `letterKeeper` 語意 | **成立**（祖母 8 封 vs 鎮民 4 封分離） | — |
| 9 | `memory_garden` 信件解鎖鏈 | **成立**（`building_owned`）；`mailFlavor` 無 runtime 行為 | P2 |
| 10 | emoji-only 作物相容 | **成立**（UI／atlas validator／圖鑑／助手皆有後備路徑） | — |
| 11 | 舊檔 migrate 新 config | **主路徑安全**（`seasonEventsClaimed` 等欄位補齊） | — |
| 12 | NPC `postscript` | **postscript 可達**；**`ch5done` 台詞永不顯示** | **P1** |

**Top 殘留（建議下一輪優先）**

1. **P1** 離線／一次 tick 跨過 ≥2 季時，中間季節的 `SEASON_EVENTS` **無法補領**（只暴露落地當季）— 與「每季一次」體驗承諾衝突。
2. **P1** `npcPhase()` 在「已讀完祖母 8 封、尚未回信」時仍回 `ch4done`，**永不回 `ch5done`** → 四名 NPC 的 `lines.ch5done` 成死文案；回信後直接跳 `postscript`。
3. **P2** `spring_seed_swap` 文案寫「換豌豆播種」但獎勵無 pea 種子；`mailFlavor` 未接日常走過台詞。

---

## 1. 經濟安全（P0 承諾）

### 1.1 SEASON_ORDER_BIAS 是否改 base sellValue？

| 檢查點 | 位置 | 結果 |
|--------|------|------|
| 偏壓表只有 preferred／weight／toast | `src/config.js:53-86` | 無 sell 欄位 |
| 抽選 | `src/game.js:266-298` `seasonOrderBias`／`seasonBiasItems`／`weightedSeasonPick`／`forcedSeasonPick` | 只改 item 機率 |
| 訂單底價 | `src/game.js:591-602` | `baseValue += def.sellValue * qty`（**非** `sellUnitValue`） |
| 合約結算 | `src/game.js:626-634` `orderPayout` | 吃 sellBonus／成就／連單，**不**吃天氣 `sellMul` |

**結論：成立。** 偏壓只改變「點什麼」，不改作物表 `sellValue`，也不給訂單套當季 ×1.15。

**最小重現**

```js
const C = require("./src/config.js"), G = require("./src/game.js"), S = require("./src/state.js");
const T0 = 1_700_000_000_000, pea = C.CROPS.pea.sellValue;
const st = S.defaultState(T0); st.level = 8; st.xp = C.LEVEL_XP[7];
st.season = { id: "春", untilMs: T0 + 1e12 }; st.weather = { id: "clear", untilMs: T0 + 1e12 };
const o = G.makeOrder(st, T0, () => 0, "bias");
// wants 含 pea；C.CROPS.pea.sellValue === pea（不變）
// 切 sunny 後 G.orderPayout(st, o).coins 與 clear 相同
```

### 1.2 radish／sunflower vs strawberry

| 作物 | 設定 | 單次毛利 `yield×sellValue` | 淨利金／分（扣種子） |
|------|------|---------------------------:|---------------------:|
| strawberry | `config.js:30` | 110 | 16.0 |
| radish | `config.js:33` emojiOnly 春 Lv5 90s | 20 | 6.67 |
| sunflower | `config.js:36` emojiOnly 夏 Lv6，`orderXp:40` | 78 | 4.29 |

**結論：成立。** 兩者單次期望金與金／分鐘皆低於草莓；向日葵依計畫走「訂單 XP 偏高」而非金幣爆發。

**注意（P2，非破局）**：`orderXp:40` × 數量再 × `memory_garden` 的 +5% 訂單 XP，會略加快等級曲線，但仍不直接抬金幣上限斜率。

### 1.3 memory_garden 無成長光環

| 檢查點 | 位置 | 結果 |
|--------|------|------|
| effect | `config.js:424-427` | `orderXpBonus: 0.05`, `mailFlavor: true`；**無** `growthAura`／`seasonalSellBonus` |
| maxCount | 同上 | 1 |
| 成長 | `game.js:78-85` | 不讀 orderXpBonus |
| 直售 | `game.js:87-93`, `404-408` | 不吃花圃 |
| 訂單 | `game.js:94-100`, `596-602` | 只抬 `rewardXp`，`rewardCoins` 不變 |

**結論：成立。** Node：`buildingGrowthAura===1`、`sellUnitValue(pea)` 有無花圃相同、`rewardCoins` 相同且 `rewardXp` 較高。

### 1.4 SEASON_EVENTS 獎勵不疊 sellMul

| 事件 | 獎勵鍵 | 金幣路徑 |
|------|--------|----------|
| spring_seed_swap | xp, collectible | 無幣 |
| summer_well_bless | xp, waterAll, collectible | 無幣 |
| autumn_share_basket | coins:12, xp, collectible | **固定 +12**（`claimSeasonEvent` 直加，不經 `sellUnitValue`） |
| winter_hearth_soup | xp, collectible | 無幣 |

實作：`game.js:374-397`。滿級 `sellBonus` + 豔陽下領秋收分籃仍只 +12。

**結論：成立。** 無 `sellMul`／永久售價欄位；收藏品描述亦聲明不產收益（`config.js:331-358`）。

### 1.5 neighborLetters noBonus

| 檢查點 | 位置 | 結果 |
|--------|------|------|
| 成就定義 | `config.js:228-229` | `noBonus: true` |
| 結算 | `game.js:171-178` | `def.noBonus` → 不累加 |
| 解鎖 | `game.js:196` | 讀完 `TOWNSFOLK_LETTERS` |
| letterKeeper | `game.js:195`, `config.js:228` | 仍只綁 `CHAPTER5_LETTERS` 八封祖母信 |

**結論：成立。** 讀四封鎮民附箋：`neighborLetters===true` 且 `letterKeeper` 仍 false；`achievementBonus` 前後相同。另讀祖母八封才 +0.02。

---

## 2. 交互邊界與正確性

### 2.1 季節偏壓 × ORDER_QTY × availableOrderItems

**管線**

1. `availableOrderItems` = 已解鎖作物 ∪ 已收集動物產品 ∪ 已發現採集（`game.js:56-57`）
2. `seasonBiasItems` = `preferredItems.filter(id ∈ pool)`（`game.js:275-279`）
3. 首槽 `forcedSeasonPick`：有交集才強制偏好，否則退回加權／均勻（`game.js:295-297`）
4. 次槽 `weightedSeasonPick`：偏好 weight=4 複寫進 weighted 陣列（`game.js:281-293`）
5. 數量：`ORDER_QTY[itemId] || [2,5]`（`game.js:481-495, 588-589`）— radish／sunflower／季節作物／採集皆有列舉

**未解鎖作物會被偏壓選中？**

- **否。** 偏壓只從 `pool` 交集挑選；`pea` 在 Lv5 不在 pool（unlockLevel 6），100 次 `makeOrder` 0 次出現 pea。
- 季節偏壓本體亦要求 `level >= SEASON_UNLOCK_LEVEL`（6）（`game.js:267`），與季節系統同門檻。
- 採集偏好（如 `river_mint`）未發現時自動自交集剔除，不會出現「訂單要沒採過的貨」。

**NPC 委託**：`npcRequestPool` = 白名單 ∩ `availableOrderItems`（`game.js:1616-1619`），再 `forcedSeasonPick`（`game.js:1641`）。市長池無 pea 時春季會落到 radish／potato 等交集項。

**結論：邊界正確，無「幽靈作物訂單」路徑。**

### 2.2 季節事件去重 × 離線多季 catch-up

**去重鍵**：`seasonCycleId = season + ":" + (untilMs - duration)`（`game.js:306-316`）  
**領取**：`flags.seasonEventsClaimed[cycleId]`（`game.js:344-345, 394`）  
**離線**：`applyOffline` → `advanceSeasonState(offlineNow)`（`game.js:2120-2121`），離線時長仍受 8h 封頂。

| 情境 | 行為 | 判定 |
|------|------|------|
| 同 cycle 連點兩次 | 第二次 `reason: "claimed"` | **不重複領** ✅ |
| 跨完整四季回到同名季 | 新 `cycleId`，可再領 | 設計上「每季循環一次」✅ |
| **一次跨 2 季**（春→秋，跳過夏） | 只暴露 `autumn_share_basket`；夏事件 **無補領 API** | **漏領 P1** |
| 離線 8h（約 24 季） | `seasonsAdvanced=24`，只剩落地季事件可做 | 中間最多 23 次事件蒸發 |

**最小重現（漏領）**

```js
const C = require("./src/config.js"), G = require("./src/game.js"), S = require("./src/state.js");
const T0 = 1_700_000_000_000, D = C.SEASON_DURATION_MS;
const st = S.defaultState(T0); st.level = 8; st.xp = C.LEVEL_XP[7];
st.lastSeenAt = T0; st.season = { id: "春", untilMs: T0 + D };
const now = T0 + D * 2 + 1;
G.applyOffline(st, now);
// st.season.id === "秋"
// seasonEventStatus → autumn_share_basket
// claimSeasonEvent(..., "summer_well_bless") → not_available
// flags.seasonEventsClaimed 不含任何「夏:…」鍵
```

**結論**

- **重複領：安全。**
- **漏領：成立且可穩定重現。** 與內容計畫「每 20 分鐘換季有第一件事／每季一次」在重度離線或跨季掛機下會打折。非金幣破局，屬內容到達率缺口（**P1**）。

### 2.3 四封鎮民附箋 unlock × letterKeeper

| 項目 | 位置 | 結果 |
|------|------|------|
| 四封 unlock | `config.js:870-916` `side_quest_done` + npcId | |
| 滿足條件 | `game.js:1098-1101` → `npcSideQuestStatus.completed` | 需 **3/3 步**（`1572`） |
| 列表 | `config.js:941-946` `TOWNSFOLK_LETTERS` | |
| 成就分離 | `letterKeeper` 只用 `CHAPTER5_LETTERS`（`931-940, 195`） | 舊語意「八封季節信」保留 |

**舊 R15 支線 `status:"done"` 無 `completedSteps`**：`sideQuestCompletedSteps` 視為 1 步（`game.js:1557-1558`）→ **不會**自動解鎖鎮民信，需再完成第 2–3 步。符合「3/3 後亮信」計畫，但舊進度玩家需再跑兩段支線（**P2 溝通／預期**）。

**結論：letterKeeper 語意未遭破壞；四鄰來信獨立且 noBonus。**

### 2.4 memory_garden 信件鏈

| 步驟 | 位置 | 結果 |
|------|------|------|
| 興建 | `game.js:785+` + maxCount | 可蓋 1 座 |
| 解鎖信 | `config.js:918-929` `building_owned` / `memory_garden` | `evaluateLetters` 會加入 `letter_memory_garden` |
| 不進 neighborLetters／letterKeeper | 不在兩陣列內 | 讀信不 unlock 售價成就 |
| `mailFlavor: true` | 僅 config 標記 | **runtime 無引用**（無每日走過台詞） |

**結論：解鎖鏈正確；計畫中「每日第一次走過短台詞」未落地（P2）。**

### 2.5 emoji-only 作物相容

| 層 | 位置 | 結果 |
|----|------|------|
| 農地 HUD | `ui.js:286-295` | `emojiOnly` 走 emoji 階段縮放 |
| 地圖 RPG | `ui.js:1699-1704` | `!emojiOnly && getFrame` 失敗則 emoji 物件 |
| v3 validator | `scripts/validate-v3-atlas.js:101` | skip emojiOnly |
| v4 validator | `scripts/validate-v4-atlas.js:202` | skip emojiOnly |
| 圖鑑 | `game.js:1765-1777` | 全 `CROPS` 含 emoji 欄 |
| 助手 | `game.js:2061-2083` | 以 id／sellUnitValue 評分，不依 atlas |
| 幫手自動種收 | `game.js:719-737` | 純 id／seedCost |

**結論：相容成立**；不會因缺 frame 導致 validator 紅燈或空圖崩潰。

### 2.6 NPC postscript（P0-6）與 ch5done 死區

| 檢查點 | 位置 | 結果 |
|--------|------|------|
| 台詞資料 | `config.js:552,561,570,579` | 四人皆有 `postscript` 2 句 |
| phase | `game.js:1499-1506` | `chapter5Done` → `postscript` |
| chapter5Done | `game.js:1291-1293` | **八封全讀且已回信** |
| 回退順序 | `game.js:1512-1518` | postscript → ch5done → ch4done → … |

**致命缺口**：`npcPhase` **沒有**「已讀八封但未回信 → `ch5done`」分支。

| 狀態 | 實際 phase | 預期（依 phase 表語意） |
|------|------------|------------------------|
| Ch4 完成、信未讀完 | `ch4done` | ch4done |
| 八封已讀、**未回信** | **`ch4done`**（仍） | 應為 **ch5done** |
| 已回信 | `postscript` | postscript ✅ |

因此 **`NPCS.*.lines.ch5done` 四組台詞在正常流程下永不顯示**；玩家從 ch4 氛圍台詞直接跳到 postscript。  
postscript 本身在回信後 **可達且可用**（測試與 Node 皆確認）。

**最小重現**

```js
// 完成 Ch1–4 任務 + 讀完 CHAPTER5_LETTERS、replied=false
// → G.npcPhase(st) === "ch4done"（不是 "ch5done"）
// replied=true → "postscript"
```

**嚴重度：P1**（敘事正確性／內容死碼；非經濟破局）。r51 新增 postscript 建立在「ch5done 之後」的敘事假設上，但中間態 phase 從未接通。

### 2.7 其他交互觀察

- **夏井雙重澆水**：`ui.js:2170-2188` 先井邊全田澆水，再 `claimSeasonEvent` 的 `waterAll`；首段已濕則第二段 `watered=0`，無雙倍收益，僅邏輯冗餘（P2）。
- **春播文案**：`config.js:93-97` 寫「換豌豆播種貼紙」— 獎勵為 XP+收藏，**無 pea 入庫**（P2 文案／獎勵落差）。

---

## 3. 存檔 migrate 與舊檔載入新 config

| 欄位 | migrate 行為 | 位置 |
|------|--------------|------|
| `flags.seasonEventsClaimed` | 預設 `{}` 並合併舊值 | `state.js:317, 371-373` |
| `mail`／`collections`／`discoveries` | 補齊巢狀 | `state.js:352-355, 397-410` |
| `npcSideQuests` | 合併 | `state.js:358` |
| 新作物／建築／信件 | **資料表驅動**，無需 bump `GAME.version`（仍為 1） | `config.js:10` |
| 倉庫未知 id（如手動 `ghost_crop`） | **不剔除**；直售 `getItemDef` 空仍 `Math.max(1, …)` | `state.js:367-370`, `game.js:404-408` |

**舊檔安全主路徑**

1. 缺 `seasonEventsClaimed` → 空物件，季節事件從頭可領。  
2. 已有 `letterKeeper` 的舊進度 → 成就鍵保留；新 `neighborLetters` 需另讀四封。  
3. 新作物進入 `allCrops`／`fullPantry` 條件：等級達標即解鎖列表變長；**已解鎖成就不會被撤銷**（只增不減）。  
4. `memory_garden`／新信／新收藏：未擁有則單純不可見／未解鎖，不崩檔。

**結論：舊檔載入 r51 config 主路徑安全。**  
殘留 P2：倉庫不校驗 item 白名單；非正常遊玩路徑可塞未知 id 以 ≥1 金賣掉（需改存檔）。

**最小重現**

```js
const m = S.migrate({ version: 1, coins: 5, flags: { bridgeRepaired: true } });
// m.flags.seasonEventsClaimed && m.mail && m.collections
const m2 = S.migrate({
  version: 1, coins: 3,
  flags: { seasonEventsClaimed: { "春:1": { eventId: "spring_seed_swap" } } },
});
// m2.flags.seasonEventsClaimed["春:1"] 保留
```

---

## 4. P0 落地對照表（計畫 → 實作）

| 計畫項 | 落地 | 經濟／安全 |
|--------|------|-----------|
| P0-1 季節訂單偏壓 | `SEASON_ORDER_BIAS` + makeOrder／NPC | 不改 base sellValue ✅ |
| P0-2 四封鎮民附箋 + 四鄰來信 | LETTERS + side_quest_done + noBonus 成就 | letterKeeper 分離 ✅ |
| P0-3 radish／sunflower | CROPS + ORDER_QTY + emojiOnly | EV < strawberry ✅ |
| P0-4 memory_garden | 建築 maxCount1 + orderXp + 信 | 無光環／無售價 ✅ |
| P0-5 SEASON_EVENTS | 四事件 + cycleId 去重 | 不疊 sellMul ✅；跨季漏領 ⚠️ |
| P0-6 postscript | 四人 2 句 + phase | postscript ✅；ch5done 死區 ⚠️ |

---

## 5. 建議修復優先（只審不改 — 供下一輪）

1. **P1 季節事件 catch-up**：離線 `advance` 時對每個跨過的 `cycleId` 標記「可補領」或至少在回到該季前保留 missed queue；或 UI 明確「離線跳過的季節活動不補發」。
2. **P1 npcPhase**：在 `chapter5Done` 之前插入  
   `if (allChapter5LettersRead(state)) return "ch5done"`  
   使八封讀完、回信前能播 ch5done，回信後再 postscript。
3. **P2** 春播獎勵與文案對齊；`mailFlavor` 接短台詞或刪除死欄位。
4. **P2** migrate 可選剔除未知 `storage.items` key（防禦性）。

---

## 6. 審查方法備註

- 靜態對讀：`config.js`／`game.js`／`state.js`／`ui.js`／`validate-v3|v4-atlas.js`
- Node 最小重現：直接 `require("./src/{config,game,state}.js")`（與 CI 測試同模組）
- 既有守門：`scripts/test-economy.js`、`scripts/test-systems.js` 已覆蓋多數 P0 正向案例；本覆核刻意補強 **跨兩季漏領**、**ch5done 不可達**、**偏壓×解鎖邊界** 等對抗案例
- **未改任何遊戲碼**；本檔為唯讀稽核產出

---

*Grok R3 · 對抗性覆核 · 2026-07-10 · 只審不改*
