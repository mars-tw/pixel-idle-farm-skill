# 資料模型與數值索引

本文件對齊目前 `src/config.js`、`src/state.js` 與 `src/game.js`。遊戲狀態必須可序列化、可遷移，UI 只從 state/config 讀取資料。

## 存檔

```js
const SAVE_KEY = "pixel_idle_farm_save_v1";

state = {
  version: 1,
  lastSeenAt: Date.now(),
  coins: 16,
  xp: 0,
  level: 1,
  selectedSeed: "wheat",
  storage: { capacity: 30, items: {} },
  plots: [{ id: "plot_0", cropId: null, plantedAt: 0, wateredAt: 0 }],
  upgrades: {
    plotCount: 6,
    growthSpeed: 0,
    sellBonus: 0,
    storageLevel: 0,
    helperLevel: 0
  },
  orders: [],
  ordersSeededAt: 0,
  orderStreak: 0,
  weather: { current: "clear", startedAt: 0 },
  map: { width: 22, height: 12, tiles: [] },
  player: { tileId: "", x: 0, y: 0, facing: "down", moving: false },
  camera: { x: 0, y: 0, followPlayer: true, focusTileId: null, focusUntil: 0 },
  story: { questId: "intro_reopen_farm", completed: {}, dialogueSeen: {}, markers: [] },
  flags: {
    bridgeRepaired: false,
    eventsClaimed: {},
    forageNodes: {},
    eastForageDiscovered: false,
    eastForageReported: false
  },
  materials: { wood: 0, stone: 0, compost: 0 },
  animals: [],
  buildings: [],
  npcRequests: {},
  npcRequestLog: {},
  stats: {
    harvested: {},
    fulfilledOrders: 0,
    totalCoinsEarned: 0,
    plantCount: 0,
    cleared: 0,
    collected: {},
    qualitySold: 0,
    npcRequestsCompleted: 0
  }
};
```

## 作物與升級

| 作物 | 解鎖 | 成長 | 種子 | 產量 | 直售 | XP |
|---|---:|---:|---:|---:|---:|---:|
| wheat | Lv.1 | 15 秒 | 1 | 2 | 1 | 1 |
| carrot | Lv.2 | 45 秒 | 4 | 3 | 3 | 3 |
| tomato | Lv.3 | 120 秒 | 12 | 4 | 8 | 8 |
| strawberry | Lv.4 | 300 秒 | 30 | 5 | 22 | 18 |
| pumpkin | Lv.5 | 900 秒 | 85 | 3 | 80 | 55 |

| 升級 | 等級數 | 效果 |
|---|---:|---|
| `plotCount` | 3 | 田地 8 / 10 / 12 |
| `growthSpeed` | 4 | 成長倍率 0.9 / 0.8 / 0.7 / 0.6 |
| `sellBonus` | 4 | 直售與訂單收益 +15% / +30% / +50% / +80% |
| `storageLevel` | 4 | 倉庫額外 +40 / +90 / +160 / +280 |
| `helperLevel` | 2 | 自動收成，第二級自動補種 |

## 訂單

```js
order = {
  id: "order_...",
  wants: { wheat: 2 },
  rewardCoins: 8,
  rewardXp: 2,
  expiresAt: now + 12 * 60 * 1000,
  rarity: "common",
  npcId: "merchant",
  flavor: "...",
  thanks: "..."
};
```

- 同時 3 張訂單，過期後補單。
- 稀有度：`common` 1.35 倍、`good` 1.7 倍、`premium` 2.2 倍。
- `orderStreak` 每完成一張 +1，獎金每層 +5%，最高 +100%；丟棄訂單會歸零。
- `tutorial_first_delivery` 是新手任務保底訂單，需求固定為 2 小麥。
- 東林採集品只有在 `flags.eastForageReported` 後才會進入可用訂單/NPC 委託池。

## 地圖、橋與東林

| 常數 | 值 |
|---|---|
| `MAP_W` / `MAP_H` | 22 / 12 |
| `TILE_PX` | 48 |
| `EAST_REGION_MIN_X` | 17 |
| `BRIDGE_COST` | `{ wood: 6, stone: 4 }` |
| `PLAYER_START` | `{ x: 7, y: 5 }` |

`state.map.tiles[]` 重要欄位：

```js
{
  id: "t_16_4",
  x: 16,
  y: 4,
  terrain: "water",
  obstacle: null,
  station: null,
  bridge: true,
  event: null,
  forage: null,
  region: null,
  unlocked: true
}
```

東林採集：

| 節點 | itemId | 位置 | 產量 | 冷卻 |
|---|---|---:|---:|---:|
| `east_herb_patch` | `forest_herb` | 18,5 | 1 | 10 分鐘 |
| `east_mushroom_log` | `glow_mushroom` | 21,4 | 1 | 10 分鐘 |

回報商人需求 `forest_herb: 1`、`glow_mushroom: 1`，獎勵 18 金幣與 6 XP，並把 `eastForageReported` 設為 true。

## 任務鏈

| 章節 | 任務 |
|---|---|
| 序章 `PROLOGUE_QUESTS` | `intro_reopen_farm`、`plant_wheat`、`first_water`、`first_harvest`、`first_delivery`、`clear_old_path` |
| 東林 `CHAPTER2_QUESTS` | `repair_bridge`、`explore_new_area`、`discover_east_forage`、`collect_east_forage`、`report_east_forage` |
| 動物 `CHAPTER3_QUESTS` | `learn_animal_care`、`feed_care_animal`、`raise_affinity_happy`、`collect_quality_product`、`deliver_quality_order` |

任務 UI 依 `questMarkerTile(state, now)` 取得目標 tile。`state.camera.focusTileId` 用於「前往」與鏡頭導引，不應被規則函式直接操作 DOM。

## 動物、品質與委託

- 動物：`chicken`、`cow`、`sheep`、`bee`。
- 產物：`egg`、`milk`、`wool`、`honey`，品質後綴為 `_good`、`_premium`。
- 親密度上限 100，每小時衰退 6；35 以上產出優質，70 以上產出頂級。
- 照護增益：餵食 +22、補水 +16、梳理 +18；照護冷卻 20 秒。
- NPC 委託保存在 `npcRequests[npcId]`，完成後寫入 `npcRequestLog[npcId].lastRequestAt` 與 `fulfilledCount`，冷卻 8 分鐘。

## 測試契約

| 指令 | 覆蓋 |
|---|---|
| `node scripts/test-economy.js` | 作物、訂單、離線與經濟公式 |
| `node scripts/test-systems.js` | 任務、橋、東林、NPC、動物與品質系統 |
| `node scripts/test-ui-smoke.js` | mock DOM UI smoke |
| `node scripts/validate-v3-atlas.js` | v3 atlas 驗證 |
| `node scripts/validate-v4-atlas.js` | v4 atlas 驗證 |
