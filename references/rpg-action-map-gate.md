# RPG Action And Organic Map Gate

This gate responds to the current quality problem: the game can move, but the character and map still do not feel like a high-quality RPG farm.

## Current Rejection

Reject the build if any of these are true:

- Miri looks stretched, malformed, oversized, or visually unrelated to the map scale.
- Character feet do not stay anchored to the ground tile during movement or actions.
- The map reads as fixed square blocks instead of an organic RPG farm scene.
- Watering, hoeing, sowing, harvesting, collecting, and station-use actions are missing visible animation/VFX.
- Main map interactions resolve as numbers or panel changes without visible on-map feedback.
- Map stations exist only as decoration and do not open or affect gameplay.
- Any production map object relies on emoji fallback.

## Visual Targets

Use these references:

- `references/visual-targets/rpg-organic-interaction-map-target.png`
  - Target for organic map density, curved paths, water edges, station placement, object variety, and visible watering interaction.

- `references/visual-targets/miri-corrected-action-sheet-target.png`
  - Target for corrected Miri proportions, action readability, foot anchoring, and farm tool animation.

These are direction references. Do not directly slice them into runtime assets.

## Required Character Fixes

Miri must be rebuilt around a stable RPG sprite spec:

- Source frame: `48x64`
- Runtime display: `48-72px` depending on tile size and viewport
- Head height: about `1/4` of body height, not giant or stretched
- Foot anchor: `{ x: 0.5, y: 0.86 }`
- Feet remain on baseline in all idle/action frames
- Tool motion stays inside frame bounds
- No frame may crop hair, boots, tool, water arc, crop, or basket

Required action rows:

```text
idle_down
walk_down
walk_left
walk_right
walk_up
hoe_side
water_side
sow_down
harvest_down
carry_down
collect_down
use_station_down
```

Every row needs at least 4 frames. Watering and hoeing should use 6 frames if possible.

## Required RPG Interactions

Every interaction below must visibly happen on the map:

| Interaction | Required Map Behavior | Required Animation |
|---|---|---|
| Walk | path/destination highlight, Miri walks to tile | walk row by facing |
| Water crop | Miri walks adjacent, turns to crop, water arc appears, soil becomes wet | `water_side` + water droplets |
| Hoe/prepare soil | Miri walks to eligible tile, hoe swing, grass/path becomes soil | `hoe_side` + dust pixels |
| Sow seed | Miri crouches/throws seed, seed/sprout appears | `sow_down` + seed pixels |
| Harvest crop | Miri pulls crop, item pops into basket/storage | `harvest_down` + crop pop |
| Clear obstacle | Miri uses hoe/pick/axe, obstacle shakes, material pops | `hoe_side` or `clear_side` |
| Collect animal product | Miri walks to coop/barn/pen, product icon pops | `collect_down` or `carry_down` |
| Order board | Miri walks to board, side panel switches to orders | `use_station_down` |
| Storage crate | Miri walks to crate, inventory/sell panel opens | `use_station_down` |
| Well/pond | Miri walks to well/pond, watering boost/refill appears | `water_side` or `use_station_down` |
| Bridge/water | bridge changes pathing; water blocks without bridge | walk only when passable |

## Organic Map Requirements

The map may still use a logical tile grid, but the visual presentation must not look like isolated square cards.

Required:

- Terrain edges must blend: grass-to-path, grass-to-soil, grass-to-water.
- Use edge/corner/overlay frames, not only `grass_center` and `path_center`.
- Add decorative overlays: flowers, grass clumps, pebbles, shadows.
- Paths should curve or branch visually even if pathfinding is grid-based.
- Water must have edge/corner frames and at least one bridge route.
- Crop beds can be rectangular, but fences, shadows, grass, and path edges must break the plain square look.
- Buildings and props need anchors and shadows.
- The selected destination should show a ring/marker, not only tile border glow.

## Map Stations Required For Stage 3

Add these station objects to state and map:

```text
order_board
storage_crate
mailbox
well
bridge
coop
barn
pond
farmhouse
```

Minimum gameplay:

- `order_board`: opens orders tab and highlights missing goods.
- `storage_crate`: opens storage/sell tab.
- `mailbox`: shows offline summary or daily crate.
- `well`: adds watering charge or temporary wet-soil bonus.
- `bridge`: unlocks path across water.
- `coop`: collects only chicken/egg products for that building.
- `barn`: collects only barn products for that building.
- `pond`: water source and fishing/event hook later.
- `farmhouse`: sleep/save/settings or farm naming later.

## Stage 3 Definition Of Done

Stage 3 is complete only when:

- Miri uses corrected proportions from the new action target.
- Watering/hoeing/sowing/harvesting all show animation and map VFX.
- Main map no longer feels like a set of fixed square cards.
- At least five stations have map-specific interactions.
- Coop/barn collection is per building, not `collectAllAnimals`.
- E2E verifies order board, storage, well, bridge, crop action, and per-building collection.
- Desktop and mobile screenshots are reviewed against the new visual targets.
