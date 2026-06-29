# Gameplay And Interaction Roadmap

This roadmap turns Sunrise Sprout Farm from a crop timer into a richer interactive farm. Use it after reading `game-design.md` and `asset-gameplay-integration.md`.

For the current implementation audit and the exact walkable-map acceptance gate, read `playable-map-movement-acceptance.md`. As of 2026-06-29 the project has map systems and action animation, but it is not yet a walkable map game because Miri is fixed in the farm panel and no player coordinates are saved.

## Design Goals

- Every 30-second visit should offer a useful action.
- Every 5-minute session should create a visible farm change.
- Every unlocked asset should become a playable choice.
- Idle systems should reduce repetition, not remove decisions.
- Interactions must stay mobile-friendly: one-tap primary actions, no hover-only rules.

## Priority Milestones

### Milestone A: Tactile Farm

Purpose: make the map feel like a place, not a grid of timers.

Required interactions:

| Interaction | Player Action | Gameplay Result | Acceptance |
|---|---|---|---|
| Tool mode | choose hand / hoe / water / clear / build | click behavior changes by mode | active tool is visible and remembered |
| Tile inspect | tap a tile | show terrain, object, effect, blocked reason | every terrain/object has readable feedback |
| Clear obstacle | tap rock/stump/bush with clear tool | spends coins or actions, gives stone/wood/compost | tile changes state and material increases |
| Water soil | tap dry soil with watering can | wet soil grows faster for one cycle | progress timer visibly improves |
| Path movement | tap destination | Miri walks or snaps with path feedback | player coordinate and DOM position both change |

Implementation note: start with simple queued action states before full pathfinding. A short movement tween is enough for MVP2. The player sprite must be rendered inside the map layer, not fixed in a dashboard panel.

### Milestone B: Animal Products

Purpose: create a second idle loop that uses animal/building art.

Required interactions:

| Interaction | Player Action | Gameplay Result | Acceptance |
|---|---|---|---|
| Build coop | place chicken coop on grass | unlocks chicken product loop | coop occupies map tile and persists |
| Collect eggs | tap coop/chicken when ready | eggs enter storage | eggs appear in storage and orders |
| Build barn | place barn | unlocks cow/sheep | at least one long-timer product exists |
| Collect milk/wool | tap barn animal | product enters storage | products can be sold and ordered |
| Bee box aura | place bee box near crops | honey timer plus nearby crop boost | affected plots show boost indicator |

Animals should use timestamp timers and offline progress like crops.

### Milestone C: Meaningful Orders

Purpose: make production choices matter.

Required interactions:

| Order Type | Wants | Reward Style | Why It Matters |
|---|---|---|---|
| Bakery | wheat + egg | coins + XP | links crops and chickens |
| Breakfast crate | egg + milk | high coins | links coop and barn |
| Festival sweets | strawberry + honey | rare reward | creates bee box value |
| Textile request | wool + coins/material | building upgrade material | gives sheep a non-cash role |
| Builder order | wood + stone + crop | expansion unlock | uses cleared map objects |

Orders should explain missing items directly in the card.

### Milestone D: Farm Identity

Purpose: make the farm feel personalized.

Required interactions:

- Place buildings on map instead of only buying abstract upgrades.
- Add visible decorations that provide small passive bonuses.
- Add a collection book for crops, products, animals, and buildings.
- Add farm name in save data and show it in the header.
- Add achievement badges tied to real systems, not only totals.

### Milestone E: Events And Surprises

Purpose: add variety without overwhelming the idle loop.

Add only after the core loops are stable:

- Weather events: rain, sunny, windy, misty. Each changes a clear number.
- Pest event: unprotected plots grow slower until scarecrow is built.
- Traveling merchant: limited-time trade, no real money.
- Harvest festival: temporary orders with mixed crop/animal products.
- Lost package: mailbox gives a choice between seeds, materials, or coins.

## Interaction State Model

Add a small interaction layer instead of scattering mode flags in UI code:

```js
state.interaction = {
  tool: "hand", // hand | hoe | water | clear | build | inspect
  buildType: null,
  selectedTileId: null,
  characterAction: "idle", // idle | walk | hoe | water | sow | harvest | carry | collect
  actionEndsAt: 0
};
```

Suggested action result:

```js
{
  ok: true,
  action: "clearObstacle",
  characterAction: "hoe",
  tileChanges: [{ tileId: "t02", object: null }],
  rewards: { stone: 2 },
  toast: "+2 stone"
}
```

This lets the UI trigger animation, toast, state changes, and save in one consistent path.

## Map Interaction Rules

Recommended tool behavior:

| Tool | Valid Targets | Invalid Feedback |
|---|---|---|
| hand | ready crops, ready animal homes, buildings | "Nothing to collect yet" |
| hoe | grass/soil plot zones | "This tile cannot become soil" |
| water | dry soil with crop | "Only planted dry soil needs water" |
| clear | rock/stump/bush | "No obstacle here" |
| build | grass/path-compatible footprint | "Needs clear grass" |
| inspect | any tile | always shows info panel |

Do not make players guess why an action failed.

## Character Animation Hooks

Map gameplay should call Miri's animation states:

| Gameplay Event | Character Sheet Row | Trigger |
|---|---|---|
| move to tile | walk direction row | before action resolves or while tweening |
| plant seed | sow-down | when seed is placed |
| harvest crop | harvest-down | before crop enters storage |
| water crop | water-side | before wet state applies |
| clear obstacle | hoe-side | before material reward |
| collect animal product | carry-down | when product enters storage |

Animation is part of acceptance. A system is not done if it changes numbers but does not show player feedback.

## Optional Depth Systems

Use these only after Milestones A-C:

- Soil quality: compost upgrades individual plots for several cycles.
- Crop traits: fast, bulky, premium, weather-loving.
- Animal happiness: increases product yield if fed with matching crops.
- Cooking/crafting: turn crop + animal product into higher-value goods.
- Helper routes: assign helper to crops, animals, or clearing instead of generic automation.
- Farm layout bonuses: scarecrow radius, bee pollination radius, path adjacency.
- NPC requests: repeatable characters prefer certain products and unlock cosmetics.

## UX Acceptance

Before shipping any interaction milestone:

- A new player can understand the selected tool without reading docs.
- Every failed action has an explanation.
- Every new product has at least one use.
- Offline summary includes crop, animal, and helper actions separately.
- All controls work at 390px mobile width.
- No required information depends on hover.

## Test Plan

Add or extend tests for:

- Tool mode changes action routing.
- Clear obstacle grants material and changes tile object.
- Watered plot grows faster than dry plot.
- Building placement validates footprint and blocked tiles.
- Animal product timer works online and offline.
- Orders can include crop + animal + material requirements.
- Character action state changes for each core action.
- Save migration fills `interaction`, `map`, `animals`, `buildings`, and `materials`.

## Recommended Build Order

1. Add `state.interaction`, tool mode UI, and tile inspect.
2. Add map tile data and render terrain tiles.
3. Add clearable obstacles and materials.
4. Add watering and wet soil growth bonus.
5. Add building placement for coop and barn.
6. Add chicken egg loop and mixed orders.
7. Add Miri action state hooks for sow, harvest, water, clear, collect.
8. Add bee box aura and honey.
9. Add collection book and milestone achievements.
