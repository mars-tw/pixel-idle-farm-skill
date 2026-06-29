# Sprite Cutting Method V3

This is the required slicing method for the next RPG-quality production pass.

Do not use freehand cropping from concept art. Do not use percentage background positioning against arbitrary image sizes.

## Runtime Principle

All runtime art must use exact frame metadata:

```json
{
  "image": "assets/generated/v3/miri-rpg-actions-48x64.png",
  "meta": { "w": 288, "h": 768, "frameW": 48, "frameH": 64 },
  "frames": {
    "water_side_00": { "x": 0, "y": 384, "w": 48, "h": 64, "anchor": [0.5, 0.86] }
  }
}
```

Renderer must use `x/y/w/h`, not guessed percentages.

## Folder

Use:

```text
assets/generated/v3/
```

V3 may be generated from hand-cleaned art, gpt-image output, or deterministic placeholders, but the runtime files must follow these dimensions.

## Character Sheets

### Miri Walk

```text
file: assets/generated/v3/miri-walk-48x64.png
json: assets/generated/v3/miri-walk-48x64.json
cell: 48x64
columns: 6
rows: 4
sheet: 288x256
anchor: [0.5, 0.86]
```

Rows:

```text
0 walk_down
1 walk_left
2 walk_right
3 walk_up
```

Columns:

```text
0 idle
1 step_a
2 passing_a
3 idle
4 step_b
5 passing_b
```

Frame ids:

```text
walk_down_00 ... walk_down_05
walk_left_00 ... walk_left_05
walk_right_00 ... walk_right_05
walk_up_00 ... walk_up_05
```

### Miri Actions

```text
file: assets/generated/v3/miri-actions-48x64.png
json: assets/generated/v3/miri-actions-48x64.json
cell: 48x64
columns: 6
rows: 12
sheet: 288x768
anchor: [0.5, 0.86]
```

Rows:

```text
0 idle_down
1 idle_left
2 idle_right
3 idle_up
4 hoe_side
5 water_side
6 sow_down
7 harvest_down
8 carry_down
9 collect_down
10 use_station_down
11 hurt_or_invalid
```

Columns:

```text
0 anticipation
1 windup
2 action
3 contact
4 recovery
5 settle
```

Required frame ids:

```text
water_side_00 ... water_side_05
hoe_side_00 ... hoe_side_05
sow_down_00 ... sow_down_05
harvest_down_00 ... harvest_down_05
collect_down_00 ... collect_down_05
use_station_down_00 ... use_station_down_05
```

## Action VFX Sheet

```text
file: assets/generated/v3/action-vfx-32.png
json: assets/generated/v3/action-vfx-32.json
cell: 32x32
columns: 6
rows: 8
sheet: 192x256
anchor: [0.5, 0.5]
```

Rows:

```text
0 water_droplets
1 soil_dust
2 seed_scatter
3 harvest_pop
4 material_pop
5 product_pop
6 valid_target_ring
7 invalid_target_ring
```

Use this sheet for visible map feedback. Do not represent watering only with a text toast.

## Terrain V3

```text
file: assets/generated/v3/terrain-organic-32.png
json: assets/generated/v3/terrain-organic-32.json
cell: 32x32
columns: 16
rows: 16
sheet: 512x512
```

Required frame groups:

```text
grass_center_01..08
grass_flower_01..04
grass_shadow_01..04
path_center, path_n, path_s, path_e, path_w
path_ne, path_nw, path_se, path_sw
path_t_n, path_t_s, path_t_e, path_t_w, path_cross
soil_dry_01, soil_dry_edge_n/s/e/w, soil_dry_corner_ne/nw/se/sw
soil_wet_01, soil_wet_edge_n/s/e/w, soil_wet_corner_ne/nw/se/sw
water_center_01..04
water_edge_n/s/e/w
water_corner_ne/nw/se/sw
bridge_horizontal_01, bridge_vertical_01
overlay_pebbles_01..04
overlay_flowers_01..04
overlay_grass_clump_01..04
```

The renderer should choose center, edge, corner, and overlay frames based on neighbor terrain. This is how we remove the boring square-card look while keeping tile logic.

## Props And Stations

Use variable frame atlas:

```text
file: assets/generated/v3/props-stations.png
json: assets/generated/v3/props-stations.json
```

Frame metadata example:

```json
{
  "order_board": {
    "x": 0,
    "y": 0,
    "w": 64,
    "h": 80,
    "footprint": [1, 1],
    "anchor": [0.5, 0.92],
    "blocksMovement": true,
    "interaction": "open_orders"
  }
}
```

Required frames:

```text
order_board
storage_crate
mailbox
well
bridge_horizontal
bridge_vertical
farmhouse
chicken_coop
barn
pond_edge_decoration
stump
rock
bush
wood_stack
stone_stack
compost_heap
```

## Crops

```text
file: assets/generated/v3/crops-32.png
json: assets/generated/v3/crops-32.json
cell: 32x32
columns: 5
rows: 6
sheet: 160x192
anchor: [0.5, 0.9]
```

Rows:

```text
wheat, carrot, tomato, strawberry, corn, pumpkin
```

Columns:

```text
seed, sprout, young, mature, ready
```

Do not include soil background inside crop frames.

## Automated Validation

Production must add a script that checks:

- PNG dimensions match JSON `meta`.
- Grid sheets are divisible by cell size.
- Every required frame id exists.
- Character frame anchors are present.
- No frame has negative or out-of-bounds coordinates.
- Main renderer can resolve every frame used by `src/ui.js`.

Required command:

```bash
node scripts/validate-v3-atlas.js
```

## Manual QA

Reject if:

- Miri's head/body scale changes between rows.
- Feet drift more than 2px between frames in the same row.
- Water arc is cropped.
- Hoe or basket is cropped.
- Terrain forms visible monotonous square blocks.
- Crops float above soil or sink below baseline.
- Object shadows disagree with the anchor.
