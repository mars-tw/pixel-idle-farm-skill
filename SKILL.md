---
name: pixel-idle-farm
description: 維護「阿軒割割陽光農場」時使用。這是一款原生 HTML/CSS/JS 像素農場 RPG，包含可走動地圖、種植、訂單、修橋、東林採集、NPC 委託、動物照護、品質產物與 localStorage 存檔。
---

# Pixel Idle Farm Skill

## 使用情境

在修改或檢查 `pixel-idle-farm-skill` 時，請先理解它不是單純 idle 農場，而是地圖驅動的像素 RPG 農場。核心玩家流程是：

1. R75 第一章：和葛瑞交談、種三格作物並澆水、收成、帶食材給班伯、在農舍做麥餅。
2. 第二章：修釣台、釣魚、修橋、採薄荷，再和蘿拉修好河畔餐桌。
3. 第三章：照顧動物、交訂單、修花園、做料理，帶去和圖圖完成野餐。
4. 主線後：河畔餐籃、四季作物、NPC 委託、品質動物產物與農場升級。
5. 舊版序章、東林／動物章節保留為農務紀錄，不能再把舊序章當成 R75 新主線唯一入口。

## 重要檔案

| 檔案 | 責任 |
|---|---|
| `src/config.js` | 所有數值與資料：作物、升級、訂單、地圖、橋、東林、NPC、任務、動物與品質 |
| `src/state.js` | `pixel_idle_farm_save_v1` 存檔 shape、遷移與初始地圖 |
| `src/game.js` | 純規則與可測試流程：訂單、修橋、採集、NPC 委託、任務推進 |
| `src/ui.js` | DOM UI、任務 Dock、camera、地圖與互動面板 |
| `src/adventure.js` | R75 主線、料理、釣魚、修復、餐籃委託、建材交易；Node/browser 同 API |
| `src/world-ui.js` / `src/world.css` | 世界主畫面、地圖行動、RWD、居民反應與主線呈現 |
| `docs/r75-world-rework.md` | 重製目的、完整任務驗收、素材來源與尚未交付項目 |
| `references/data-model.md` | 存檔與數值契約，改資料結構時同步更新 |

## 現況契約

- 邏輯地圖是 22 x 12，基準 tile 48px；R75 畫面預設 natural，圖磚至少 64px，依視口整數縮放。鏡頭周邊的草地不是可探索地圖。
- 東林鎖在 `x >= EAST_REGION_MIN_X`，需 `flags.bridgeRepaired === true` 才可進入。
- 修橋成本為 `BRIDGE_COST = { wood: 6, stone: 4 }`；R75 領取 `c1_first_meal` 獎勵或完成舊序章即可開始修橋。
- 任務分章：序章 6、東林 5、動物照護 5；UI 會依章節顯示進度。
- 訂單同時 3 張、12 分鐘期限；第一張交付任務會插入 `tutorial_first_delivery`。
- NPC 委託走 `npcRequests` / `npcRequestLog`，回報東林樣品後才開放東林採集品進委託池。
- 動物品質以親密度決定：一般、優質、頂級；商品 id 會用 `egg_good`、`egg_premium` 這類後綴。
- 新主線只寫入 `state.adventure`，保留舊金幣、作物、動物和故事。交付／料理／釣魚必須逐筆核對資源，獎勵不能重領；先做過的行動要保留進度。
- 新修復物件需有地圖站位及碰撞；人物先走近，在動作作用階段才消耗與結算。不要讓點擊遠處動物就立即餵食。
- R76 釣台／餐桌使用 `world_projects` 的損壞／修復圖，不再借用橋梁／攤位。處理與來源見 `docs/r76-art-release.md`，精確生成模型版本未揭露，不假稱 API 模型版本。
- `configureWorld()` 是復興場址與野餐 NPC 綁定的共用入口；先保留舊建物與動物，再選空地，不可在 UI 把場址硬壓到已占用的格子。

## 修改原則

- 平衡數值集中在 `src/config.js` 或 R75 對應的 `src/adventure.js` 純規則，不要把結算數值散落在 UI。
- 遊戲規則保持可在 Node 測試，不要讓核心函式直接依賴 DOM 或 `Date.now()`。
- 新主線任務需同時補 AdventureAPI 的 descriptor、目標計數、交付檢查、地圖入口與 E2E。舊故事任務才走 `QUESTS`／`questSatisfied()`。
- 新物品需能被 `getItemDef()` 查到，才能安全進入倉庫、訂單與 NPC 委託。
- 改存檔 shape 時同步更新 `references/data-model.md` 與相關測試。

## 驗證

```bash
npm test
npm run test:e2e
```

若變更任務、地圖、互動或 atlas，需加跑 E2E。R75 新守門取代依賴已移除常駐側欄布局的歷史瀏覽器腳本，歷史腳本保留供讀取；不能把它們說成仍是現版已通過的 Gate。
