---
name: pixel-idle-farm
description: 維護「阿軒割割陽光農場」時使用。這是一款原生 HTML/CSS/JS 像素農場 RPG，包含可走動地圖、種植、訂單、修橋、東林採集、NPC 委託、動物照護、品質產物與 localStorage 存檔。
---

# Pixel Idle Farm Skill

## 使用情境

在修改或檢查 `pixel-idle-farm-skill` 時，請先理解它不是單純 idle 農場，而是地圖驅動的像素 RPG 農場。核心玩家流程是：

1. 序章 6 步教學：讀告示、種小麥、澆水、收成、交付保底訂單、清舊路。
2. 修橋：完成序章後收集木材 6、石頭 4，修復東橋。
3. 東林：探索古樹、辨認採集點、採集東林藥草與螢光菇、回報商人。
4. 動物照護：解鎖雞舍/畜棚/蜂箱，透過餵食、補水、梳理提升親密度與品質。
5. 長期經營：市集訂單、NPC 委託、直售與升級形成循環。

## 重要檔案

| 檔案 | 責任 |
|---|---|
| `src/config.js` | 所有數值與資料：作物、升級、訂單、地圖、橋、東林、NPC、任務、動物與品質 |
| `src/state.js` | `pixel_idle_farm_save_v1` 存檔 shape、遷移與初始地圖 |
| `src/game.js` | 純規則與可測試流程：訂單、修橋、採集、NPC 委託、任務推進 |
| `src/ui.js` | DOM UI、任務 Dock、camera、地圖與互動面板 |
| `references/data-model.md` | 存檔與數值契約，改資料結構時同步更新 |

## 現況契約

- 地圖是 22 x 12，tile 48px；`state.camera` 支援跟隨玩家與任務目標 focus。
- 東林鎖在 `x >= EAST_REGION_MIN_X`，需 `flags.bridgeRepaired === true` 才可進入。
- 修橋成本為 `BRIDGE_COST = { wood: 6, stone: 4 }`，且需序章 `PROLOGUE_QUESTS` 全完成。
- 任務分章：序章 6、東林 5、動物照護 5；UI 會依章節顯示進度。
- 訂單同時 3 張、12 分鐘期限；第一張交付任務會插入 `tutorial_first_delivery`。
- NPC 委託走 `npcRequests` / `npcRequestLog`，回報東林樣品後才開放東林採集品進委託池。
- 動物品質以親密度決定：一般、優質、頂級；商品 id 會用 `egg_good`、`egg_premium` 這類後綴。

## 修改原則

- 平衡數值優先改 `src/config.js`，不要把數值散落在 UI。
- 遊戲規則保持可在 Node 測試，不要讓核心函式直接依賴 DOM 或 `Date.now()`。
- 新任務需同時補：`QUESTS`、章節陣列、`questSatisfied()`、`questMarkerTile()` 與 UI 行動文案。
- 新物品需能被 `getItemDef()` 查到，才能安全進入倉庫、訂單與 NPC 委託。
- 改存檔 shape 時同步更新 `references/data-model.md` 與相關測試。

## 驗證

```bash
npm test
npm run test:e2e
```

文件-only 修改通常只需 `npm test`；若變更任務、地圖、互動或 atlas，需加跑 E2E。
