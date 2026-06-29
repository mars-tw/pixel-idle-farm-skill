# Visual Targets

These images are production references, not final sliced runtime sprites.

## Files

- `rpg-desktop-scene-target.png`
  - Purpose: desktop-first quality target for the main gameplay scene.
  - Use this to judge composition, visual density, map layering, object variety, and how much of the first viewport should feel like an RPG farm instead of a dashboard.

- `rpg-asset-atlas-direction.png`
  - Purpose: style and asset coverage reference for the v2 sprite set.
  - Use this to align tile language, object scale, baseline, color palette, and material richness.

- `rpg-organic-interaction-map-target.png`
  - Purpose: Stage 3 target for an organic RPG farm map with visible watering interaction, curved paths, blended terrain, water/bridge, stations, animals, and crop beds.
  - Use this to reject maps that still look like fixed square cards.

- `miri-corrected-action-sheet-target.png`
  - Purpose: Stage 3 target for corrected Miri proportions and readable farming actions.
  - Use this to reject distorted characters, drifting feet, and missing action poses.

## Production Rule

Do not use these images directly as runtime atlases. The production sprite sheets must be regenerated or manually cleaned into exact frame sizes with transparent backgrounds and a companion frame map.

Required follow-up specs:

- `references/rpg-quality-rework-brief.md`
- `references/asset-production-spec-v2.md`
- `art-config-rpg-v2.json`
- `references/rpg-action-map-gate.md`
- `references/sprite-cutting-method-v3.md`
- `art-config-rpg-v3.json`
