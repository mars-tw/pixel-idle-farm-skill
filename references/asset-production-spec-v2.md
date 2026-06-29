# Asset Production Spec V2

This spec replaces the preview-art assumptions. The goal is to produce runtime-safe RPG farming assets that do not drift, crop, blur, or misalign.

## Core Rule

Every runtime asset must have one of these:

- Exact grid math: sheet dimensions are perfectly divisible by columns and rows.
- A companion frame map: each frame has `{ x, y, w, h, anchorX, anchorY }`.

Do not ship concept art as a runtime spritesheet.

## Required Output Folder

Use a new folder so v2 assets do not overwrite working preview assets:

```text
assets/generated/v2/
```

## Runtime Asset List

### 1. Terrain Tiles

File:

```text
assets/generated/v2/terrain-tiles-32.png
assets/generated/v2/terrain-tiles-32.json
```

Format:

- Tile size: `32x32`
- Sheet size: `512x512`
- Grid: `16 columns x 16 rows`
- Background: transparent
- No padding inside runtime grid

Required frames:

```text
grass_01, grass_02, grass_flower_01, grass_tall
soil_dry, soil_wet, soil_seeded, soil_ready_shadow
path_center, path_horizontal, path_vertical, path_corner_ne, path_corner_nw, path_corner_se, path_corner_sw
water_center, water_edge_n, water_edge_s, water_edge_e, water_edge_w, water_corner_ne, water_corner_nw, water_corner_se, water_corner_sw
bridge_horizontal, bridge_vertical
fence_horizontal, fence_vertical, fence_corner
selection_valid, selection_invalid, ready_glow
```

Gameplay use:

- Terrain rules must map to these frames.
- Water and bridge must be visually distinct.
- Wet soil must be visibly different from dry soil.

### 2. Crop Growth Sheet

File:

```text
assets/generated/v2/crops-32.png
assets/generated/v2/crops-32.json
```

Format:

- Frame size: `32x32`
- Grid: `5 columns x 6 rows`
- Sheet size: `160x192`
- Rows: wheat, carrot, tomato, strawberry, corn, pumpkin
- Columns: seed, sprout, young, mature, ready
- Background: transparent

Required:

- Crop base sits on the same ground baseline.
- Ready stage must be readable at `32px`.
- No beige backing card or background tile in the crop frame.

### 3. Character Miri Rowan

Walk:

```text
assets/generated/v2/miri-walk-48x64.png
assets/generated/v2/miri-walk-48x64.json
```

Format:

- Frame size: `48x64`
- Grid: `4 columns x 4 rows`
- Sheet size: `192x256`
- Rows: down, left, right, up
- Columns: idle-step, step-a, idle-step, step-b
- Anchor: `{ x: 0.5, y: 0.86 }`

Actions:

```text
assets/generated/v2/miri-actions-48x64.png
assets/generated/v2/miri-actions-48x64.json
```

Format:

- Frame size: `48x64`
- Grid: `4 columns x 6 rows`
- Sheet size: `192x384`
- Rows: idle_down, hoe_side, water_side, sow_down, harvest_down, carry_down
- Columns: anticipation, action, contact, recovery
- Anchor: `{ x: 0.5, y: 0.86 }`

Required:

- Same outfit and proportions in every frame.
- Feet stay on the same baseline.
- Tools stay inside frame bounds.
- No background.

### 4. Buildings And Props Atlas

Files:

```text
assets/generated/v2/buildings-props.png
assets/generated/v2/buildings-props.json
```

Use JSON frame map, not a fixed grid, because buildings have different footprints.

Required frames:

```text
farmhouse_3x3
order_board_1x1
mailbox_1x1
well_1x1
chicken_coop_1x1
barn_2x2
silo_1x2
bee_box_1x1
scarecrow_1x1
stump_1x1
rock_1x1
bush_1x1
wood_stack_1x1
stone_stack_1x1
compost_heap_1x1
```

Frame metadata example:

```json
{
  "chicken_coop_1x1": {
    "x": 0,
    "y": 0,
    "w": 64,
    "h": 64,
    "footprint": [1, 1],
    "anchor": [0.5, 0.9],
    "blocksMovement": true
  }
}
```

### 5. Animals

File:

```text
assets/generated/v2/animals-48.png
assets/generated/v2/animals-48.json
```

Format:

- Frame size: `48x48`
- Grid: `4 columns x 4 rows`
- Rows: chicken, cow, sheep, bee
- Columns: idle_a, idle_b, product_ready, sleep_or_rest
- Anchor: `{ x: 0.5, y: 0.82 }`

Gameplay use:

- Ready product state must be visible without opening a panel.
- Animals should face or idle near their home tile.

### 6. UI Icons

File:

```text
assets/generated/v2/ui-icons-32.png
assets/generated/v2/ui-icons-32.json
```

Format:

- Frame size: `32x32`
- Sheet size: `512x512`
- Background: transparent

Required icons:

```text
coin, xp_star, storage, order, upgrade
hand, water, clear, build, inspect
wheat, carrot, tomato, strawberry, corn, pumpkin
egg, milk, wool, honey
wood, stone, compost
weather_sun, weather_rain, helper, settings
```

## Visual QA Checklist

Reject generated assets if any of these occur:

- Sheet dimension is not divisible by grid.
- Background is not transparent or cleanly removable.
- Sprite contains letters, labels, numbers, watermark, or UI text.
- Character feet drift vertically between frames.
- Building footprint does not match gameplay size.
- Crop frame includes soil background unless explicitly part of the crop layer.
- Objects are cropped by frame edges.
- Pixel art is blurred, over-rendered, or inconsistent between sheets.

## Implementation Instructions

1. Add an `assets/generated/v2/manifest.json` with every sheet, frame size, and JSON map path.
2. Replace percentage-only CSS slicing with a `drawSprite(frameId, x, y)` or `background-position` helper based on exact frame metadata.
3. Keep emoji fallback only for debug mode. Main gameplay must render v2 images.
4. Update Playwright visual checks to fail if main map contains emoji object glyphs for rock/stump/building/animal.
5. Keep the old assets until the v2 renderer is stable, then remove unused preview references.
