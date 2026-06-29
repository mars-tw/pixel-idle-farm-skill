# Asset Gameplay Integration Requirements

This is a mandatory production requirement. Generated map, animal, building, character, and icon assets must become gameplay systems, not unused decoration.

## Rule

Every generated asset sheet needs at least one gameplay responsibility:

- It changes a player decision.
- It produces, consumes, blocks, boosts, unlocks, or signals something.
- It appears in a testable UI state, order, upgrade, map tile, or offline summary.

Do not ship a version where `terrain-tileset.png`, `farm-actors-buildings.png`, `ui-icons.png`, or character sheets are only stored in the repo but not represented in gameplay.

## Asset To Gameplay Matrix

| Asset | Required Gameplay Use | Minimum Acceptance |
|---|---|---|
| `terrain-tileset.png` | Farm map tiles, paths, water, obstacles, utility objects | At least 4 tile types have rules, not only visuals |
| `farm-actors-buildings.png` | Animals and buildings | At least 3 animals and 4 buildings affect economy or progression |
| `crop-growth.png` | Crop growth stages | Already required for crop progress rendering |
| `ui-icons.png` | Resource/action buttons | Use icons for coins, storage, orders, upgrades, animal products |
| `miri-rowan-walk-cycle.png` | Player movement feedback | Walking or task animation changes by action context |
| `miri-rowan-farm-actions.png` | Farm tool actions | Hoe, water, sow, harvest, carry trigger visible action states |

## Terrain Systems

Use generated terrain as a map, not a flat background.

Required terrain rules:

- `grass`: buildable base tile for unlocked farm structures.
- `soil`: crop plot tile. Dry and wet soil must have different growth behavior.
- `water`: blocks walking/building until bridged; adjacent crops or bee boxes can get small boosts.
- `path`: improves player/helper movement or reduces action cooldown.
- `fence`: blocks placement and defines animal pen boundaries.
- `rock`, `stump`, `bush`: clearable obstacles that cost coins or stamina-like actions and reward wood/stone/compost.
- `well`: unlocks or boosts watering.
- `compost`: boosts growth speed for nearby plots.
- `bridge`: unlocks expansion across water.

Minimum MVP2:

1. Render a farm map from tile data.
2. Let locked/blocked tiles explain why they cannot be used.
3. Add at least one clearable obstacle.
4. Add at least one utility tile with a numeric effect.

## Animal Systems

Animals must create a second loop beyond crops.

Required animal loop:

1. Build or unlock the animal home.
2. Feed or wait through a timestamp-based timer.
3. Collect product into storage.
4. Use products in orders, upgrades, or direct sale.
5. Apply offline progress with the same cap rules as crops.

Suggested animals:

| Animal | Unlock Building | Product | Timer | Gameplay Hook |
|---|---|---|---:|---|
| Chicken | chicken coop | egg | 6 min | early order variety |
| Cow | barn | milk | 20 min | mid-game high-value orders |
| Sheep | barn | wool | 30 min | upgrade/crafting material |
| Bee box | bee box | honey | 15 min | crop pollination aura |

Animal care should not become click spam. Use collect-all and offline collection once the relevant helper upgrade is available.

## Building Systems

Buildings are production modules.

Required buildings:

- `barn`: unlocks cow/sheep, increases animal capacity.
- `chicken coop`: unlocks chickens and egg orders.
- `silo`: increases storage and can extend offline product handling.
- `seed shop stall`: unlocks seed bundles or seed discounts.
- `mailbox`: daily crate or returning-player message.
- `order board`: visible market orders and animal-product orders.
- `scarecrow`: reduces pest/weather penalties or protects nearby plots.
- `bee box`: produces honey and speeds nearby crop growth.

Every building should have:

```js
{
  id: "chickenCoop",
  name: "Chicken Coop",
  unlockLevel: 2,
  cost: { coins: 120, wood: 8 },
  footprint: [[0, 0], [1, 0]],
  effect: { unlockAnimals: ["chicken"], animalCapacity: 3 },
  sprite: { sheet: "farm-actors-buildings", frame: "chicken-coop" }
}
```

## Data Model Additions

Add these shapes when moving beyond crop-only MVP:

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
  {
    id: "chicken_001",
    type: "chicken",
    homeId: "coop_001",
    fedAt: 0,
    productReadyAt: 0,
    happiness: 1
  }
];

state.buildings = [
  {
    id: "coop_001",
    type: "chickenCoop",
    x: 4,
    y: 2,
    builtAt: Date.now(),
    level: 1
  }
];

state.storage.items = {
  wheat: 0,
  egg: 0,
  milk: 0,
  wool: 0,
  honey: 0,
  wood: 0,
  stone: 0
};
```

## Orders Must Use New Products

Once animals are unlocked, market orders must include animal products. Do not leave eggs, milk, wool, or honey as collectibles without an outlet.

Examples:

- Bakery order: wheat + egg.
- Breakfast crate: egg + milk.
- Textile request: wool + coins reward.
- Festival sweets: strawberry + honey.

## UI Requirements

- Map tile hover/tap shows terrain name and effect.
- Animal homes show product timers and collect buttons.
- Orders show crop and animal product requirements with icons.
- Offline summary includes animal products collected and overflow losses.
- Character action animation changes when hoeing, watering, sowing, harvesting, carrying, or collecting animal products.

## Tests Required

Add tests when implementing these systems:

- Asset manifest entries used by UI/config are valid paths.
- At least one map tile effect modifies crop growth or placement.
- Obstacle clearing changes tile state and grants material.
- Animal product timer works online and offline.
- Animal products can satisfy orders.
- Building unlocks animal or storage behavior.
- Character action state switches when a gameplay action is triggered.

## Production Acceptance

The feature is not accepted until a tester can:

1. See the generated map tiles in the farm view.
2. Clear or use at least one map object.
3. Build or unlock at least one animal home.
4. Collect at least one animal product.
5. Complete an order that uses a non-crop product.
6. See Miri Rowan perform an action animation tied to the clicked gameplay action.
