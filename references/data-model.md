# Data Model

Keep game state serializable and versioned. The UI should render from state and config; timers should be derived from timestamps.

## Save Shape

```js
const SAVE_KEY = "pixel_idle_farm_save_v1";

const state = {
  version: 1,
  now: 0,
  lastSeenAt: Date.now(),
  coins: 12,
  xp: 0,
  level: 1,
  selectedSeed: "wheat",
  storage: {
    capacity: 30,
    items: { wheat: 0, carrot: 0, tomato: 0 }
  },
  plots: [
    { id: "p01", cropId: null, plantedAt: 0, wateredAt: 0, autoHarvestedAt: 0 }
  ],
  upgrades: {
    plotCount: 6,
    growthSpeed: 0,
    sellBonus: 0,
    storageLevel: 0,
    helperLevel: 0
  },
  orders: [],
  stats: {
    harvested: {},
    fulfilledOrders: 0,
    totalCoinsEarned: 0
  }
};
```

## Config Shape

```js
const CROPS = {
  wheat: {
    name: "Wheat",
    growMs: 15000,
    seedCost: 1,
    yield: 2,
    sellValue: 1,
    xp: 1,
    unlockLevel: 1,
    spriteRow: 0
  }
};

const UPGRADES = {
  growthSpeed: [
    { level: 1, cost: 30, multiplier: 0.95 },
    { level: 2, cost: 120, multiplier: 0.9 }
  ]
};
```

## Growth Calculation

```js
function getCropProgress(plot, crop, now, upgrades) {
  if (!plot.cropId) return { ready: false, ratio: 0, remainingMs: 0 };
  const speed = getGrowthMultiplier(upgrades);
  const growMs = Math.max(1000, Math.floor(crop.growMs * speed));
  const elapsed = Math.max(0, now - plot.plantedAt);
  return {
    ready: elapsed >= growMs,
    ratio: Math.min(1, elapsed / growMs),
    remainingMs: Math.max(0, growMs - elapsed)
  };
}
```

## Offline Progress

On load:

1. Read save.
2. Compute `offlineMs = min(Date.now() - state.lastSeenAt, OFFLINE_CAP_MS)`.
3. Apply growth readiness for each plot.
4. If helper can auto-harvest, harvest ready crops until storage is full.
5. Store losses separately for the offline summary.
6. Set `lastSeenAt = Date.now()` and save.

Do not simulate every second. For MVP, calculate each plot once based on timestamps. For advanced auto-planting, calculate cycles with integer division:

```js
const cycles = Math.floor((now - plot.plantedAt) / crop.growMs);
```

Cap cycles per plot to prevent runaway saves after long absences.

## Orders

Orders should be generated from unlocked crops and available storage.

```js
const order = {
  id: "order_001",
  wants: { wheat: 8, carrot: 3 },
  rewards: { coins: 42, xp: 12 },
  expiresAt: Date.now() + 10 * 60 * 1000,
  rarity: "common"
};
```

Use direct sell as fallback, but make orders the better strategic outlet.

## Asset Mapping

Use `assets/manifest.json` as the source of available generated sheets.

Suggested CSS:

```css
.pixel-art {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

Suggested JS mapping:

```js
const ASSETS = {
  crops: "assets/generated/crop-growth.png",
  terrain: "assets/generated/terrain-tileset.png",
  actorsBuildings: "assets/generated/farm-actors-buildings.png",
  icons: "assets/generated/ui-icons.png",
  characterWalk: "assets/generated/characters/miri-rowan-walk-cycle.png",
  characterActions: "assets/generated/characters/miri-rowan-farm-actions.png"
};
```

## Map, Animals, And Buildings

When using the generated map and animal/building sheets, extend state instead of hard-coding visuals in the DOM. See `references/asset-gameplay-integration.md` for required gameplay behavior.

```js
state.map = {
  width: 8,
  height: 6,
  tiles: [
    { id: "t00", x: 0, y: 0, terrain: "grass", object: null, unlocked: true },
    { id: "t01", x: 1, y: 0, terrain: "soil", moisture: 0, unlocked: true },
    { id: "t02", x: 2, y: 0, terrain: "grass", object: "rock", unlocked: true }
  ]
};

state.materials = { wood: 0, stone: 0, compost: 0 };

state.animals = [
  { id: "chicken_001", type: "chicken", homeId: "coop_001", fedAt: 0, productReadyAt: 0, happiness: 1 }
];

state.buildings = [
  { id: "coop_001", type: "chickenCoop", x: 4, y: 2, builtAt: Date.now(), level: 1 }
];

state.interaction = {
  tool: "hand",
  buildType: null,
  selectedTileId: null,
  characterAction: "idle",
  actionEndsAt: 0
};
```

Suggested product ids for storage and orders:

```js
const PRODUCTS = {
  egg: { name: "Egg", sellValue: 6, source: "chicken" },
  milk: { name: "Milk", sellValue: 18, source: "cow" },
  wool: { name: "Wool", sellValue: 24, source: "sheep" },
  honey: { name: "Honey", sellValue: 15, source: "beeBox" },
  wood: { name: "Wood", source: "stump" },
  stone: { name: "Stone", source: "rock" }
};
```

Orders should support crop and product requirements in the same `wants` object:

```js
{ wants: { wheat: 8, egg: 3 }, rewards: { coins: 70, xp: 14 } }
```

Use `state.interaction` for tool routing and animation hooks. Do not scatter tool-mode booleans across UI components. The full interaction roadmap is in `references/gameplay-interactions-roadmap.md`.
