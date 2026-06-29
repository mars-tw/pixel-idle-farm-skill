# Character Animation Production Spec

## Original Character

Name: Miri Rowan

Role: main playable farmer for Sunrise Sprout Farm.

Design lock:

- Warm tan skin, short auburn hair.
- Teal kerchief with small tied tail.
- Cream work shirt, moss green overalls, brass buttons.
- Red neck scarf, tan work boots.
- Hip seed pouch and small leaf brooch.
- Friendly, compact silhouette for cozy farming gameplay.

Do not copy any existing farming game, anime, manga, or franchise character. Keep Miri Rowan as an original project-owned character.

## Delivered Preview Sheets

| Asset | Path | Purpose |
|---|---|---|
| Turnaround | `assets/generated/characters/miri-rowan-turnaround.png` | front / side / back reference |
| Walk cycle | `assets/generated/characters/miri-rowan-walk-cycle.png` | four-direction movement |
| Farm actions | `assets/generated/characters/miri-rowan-farm-actions.png` | idle, hoe, water, sow, harvest, carry |

These files are preview production sheets. They have light backgrounds; crop and remove the background before direct in-game use, or regenerate with a transparent/chroma-key workflow.

## Walk Cycle Sheet

Grid: 4 rows x 4 columns.

Rows:

1. `walk-down`
2. `walk-left`
3. `walk-right`
4. `walk-up`

Frames:

1. `idle-step`
2. `left-foot`
3. `idle-step`
4. `right-foot`

Recommended playback:

- 8 fps for normal walk.
- Loop frames `0,1,2,3`.
- Use `walk-left` mirrored only as fallback; prefer the generated `walk-right` row because pouch and kerchief asymmetry make the character more alive.

## Farm Action Sheet

Grid: 6 rows x 4 columns.

Rows:

1. `idle-down`
2. `hoe-side`
3. `water-side`
4. `sow-down`
5. `harvest-down`
6. `carry-down`

Frames:

1. `anticipation`
2. `action`
3. `contact-or-peak`
4. `recovery`

Recommended playback:

- 6 fps for tool actions.
- Trigger the gameplay effect on frame 2 or frame 3.
- For hoe/water, attach soil or water particles at the tool contact point.
- For sow/harvest, spawn seeds or crop pickup on `contact-or-peak`.
- For carry, loop frames 0-3 at 5 fps while moving.

## Implementation Notes

- Use CSS `image-rendering: pixelated` for all sprite rendering.
- Start with a logical frame box of `64x64` when slicing the generated sheets, then crop transparent margins to the game's target size.
- Keep a stable foot anchor so the sprite does not bounce vertically unless the animation intentionally bobs.
- Suggested in-game hitbox: `18x14` at the feet, not the full sprite rectangle.
- Suggested render anchor: bottom center.

## JSON Naming Contract

```js
const CHARACTER_SHEETS = {
  miri: {
    turnaround: "assets/generated/characters/miri-rowan-turnaround.png",
    walk: "assets/generated/characters/miri-rowan-walk-cycle.png",
    actions: "assets/generated/characters/miri-rowan-farm-actions.png",
    walkRows: ["down", "left", "right", "up"],
    actionRows: ["idle", "hoe", "water", "sow", "harvest", "carry"],
    frameCount: 4,
    fps: { walk: 8, action: 6 }
  }
};
```

## Acceptance Checklist

- Front, side, and back views preserve the same outfit details.
- Walk rows include readable alternating foot motion.
- Farm actions communicate the tool or task before any VFX is added.
- No labels, logos, numbers, or franchise references appear in the source image.
- Background is removed or blended before the sprite is shipped in the playable game.
