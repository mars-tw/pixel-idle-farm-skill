# Production Directive: Stage 3 RPG Actions And Organic Map

Copy this to the production agent.

## Mission

Fix the two remaining quality failures:

1. Miri does not yet look like a natural, high-quality RPG player character in the game.
2. The map still reads as fixed square blocks instead of an organic RPG farm with meaningful interactions.

Do not add more economy content until character actions, VFX, map stations, and organic terrain rendering are in place.

## Required Reading

1. `references/rpg-action-map-gate.md`
2. `references/sprite-cutting-method-v3.md`
3. `art-config-rpg-v3.json`
4. `references/visual-targets/rpg-organic-interaction-map-target.png`
5. `references/visual-targets/miri-corrected-action-sheet-target.png`

## Required Asset Work

Create or regenerate:

```text
assets/generated/v3/miri-walk-48x64.png
assets/generated/v3/miri-walk-48x64.json
assets/generated/v3/miri-actions-48x64.png
assets/generated/v3/miri-actions-48x64.json
assets/generated/v3/action-vfx-32.png
assets/generated/v3/action-vfx-32.json
assets/generated/v3/terrain-organic-32.png
assets/generated/v3/terrain-organic-32.json
assets/generated/v3/props-stations.png
assets/generated/v3/props-stations.json
assets/generated/v3/crops-32.png
assets/generated/v3/crops-32.json
assets/generated/v3/manifest.json
```

Use exact frame metadata from `references/sprite-cutting-method-v3.md`.

## Required Renderer Work

Extend `src/atlas.js` and `src/ui.js` so the map can render:

- Character walk/action rows from v3 sheets.
- VFX overlays from `action-vfx-32`.
- Terrain center/edge/corner/overlay frames.
- Prop/station frames with anchors and footprints.
- Crop frames without emoji fallback in production mode.

Do not render production map objects as text or emoji.

## Required Map Interaction Work

Add map station behavior:

- `order_board`: Miri walks to board, plays `use_station_down`, opens Orders tab.
- `storage_crate`: Miri walks to crate, plays `use_station_down`, opens storage/sell panel.
- `mailbox`: Miri walks to mailbox, opens offline/daily crate message.
- `well`: Miri walks to well, plays use/water action, gives watering charge or temporary wet-soil bonus.
- `bridge`: unlocks/permits crossing water route.
- `coop`: Miri walks to coop, collects only products from that coop.
- `barn`: Miri walks to barn, collects only products from that barn.

Fix current behavior where building collection uses `collectAllAnimals`.

## Required Crop Action Work

Every crop action must be visible:

- Plant: Miri walks to soil, plays `sow_down`, seed scatter VFX, seed/sprout appears.
- Water: Miri walks adjacent, faces crop, plays `water_side`, water droplet VFX, soil changes to wet frame.
- Harvest: Miri walks to crop, plays `harvest_down`, harvest pop VFX, crop enters storage.
- Hoe/prepare: Miri plays `hoe_side`, dust VFX, grass/field becomes soil where allowed.

No crop action is accepted if it only changes numbers and shows a toast.

## Required Organic Map Work

Replace plain terrain selection with neighbor-aware frame selection:

- Path edges/corners/T/cross.
- Soil edges/corners.
- Water edges/corners.
- Bridge route over water.
- Decorative overlays: flowers, grass clumps, pebbles, shadows.

The logical grid may remain, but visible terrain must blend like an RPG map.

## Required Tests

Add or extend Playwright E2E:

```text
scripts/test-rpg-actions-e2e.js
```

Required assertions:

- No visible emoji text in `#mapScene .t-obj`, crop object layer, station object layer, or animal layer.
- V3 atlas manifest loads.
- `miri-actions-48x64` frames resolve for water/hoe/sow/harvest/collect/use_station.
- Watering a crop triggers action state `water` or `water_side` and displays a VFX element.
- Harvesting a ready crop triggers action state and harvest VFX before storage changes.
- Order board click switches side panel to Orders after Miri moves.
- Storage crate click opens storage/sell panel after Miri moves.
- Well click grants watering effect or charge after Miri moves.
- Coop click collects only that coop's product.
- Bridge changes pathing across water or permits a previously blocked route.
- Desktop and mobile have no console errors.
- Mobile `390x844` has no horizontal overflow.

Required commands:

```bash
npm test
npm run test:e2e
node scripts/test-rpg-actions-e2e.js
node scripts/validate-v3-atlas.js
```

## Acceptance Screenshots

Save:

```text
artifacts/stage3-rpg-desktop.png
artifacts/stage3-rpg-mobile.png
artifacts/stage3-water-action.png
artifacts/stage3-station-order-board.png
```

## Rejection Conditions

Reject if:

- Miri still looks distorted, too large, or badly anchored.
- The map is still visually dominated by identical square tiles.
- Watering/hoeing/sowing/harvesting have no visible sprite animation and VFX.
- Station clicks only open panels without character movement/action.
- Animal collection still collects all animals globally.
- Main map uses emoji fallback in production mode.
- E2E does not explicitly test RPG actions and station interactions.

## Production Prompt

```text
Implement Stage 3 RPG Actions And Organic Map. Fix the abnormal character and square-block map feel. Follow references/rpg-action-map-gate.md and references/sprite-cutting-method-v3.md. Generate or create v3 assets using art-config-rpg-v3.json, then slice into exact frame sheets and atlas JSON. Replace boring center-only terrain with organic edge/corner/overlay rendering. Add visible action animations and VFX for watering, hoeing, sowing, harvesting, collecting, and station use. Add map stations: order board, storage crate, mailbox, well, bridge, coop, barn. Every station must require Miri to walk there and play an action before the panel or effect resolves. Add Playwright E2E for no map emoji, v3 atlas frames, crop actions, station interactions, per-building animal collection, bridge pathing, no console errors, and 390px no overflow.
```
