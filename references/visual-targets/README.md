# Visual Targets

These images are production references, not final sliced runtime sprites.

## Files

- `rpg-desktop-scene-target.png`
  - Purpose: desktop-first quality target for the main gameplay scene.
  - Use this to judge composition, visual density, map layering, object variety, and how much of the first viewport should feel like an RPG farm instead of a dashboard.

- `rpg-asset-atlas-direction.png`
  - Purpose: style and asset coverage reference for the v2 sprite set.
  - Use this to align tile language, object scale, baseline, color palette, and material richness.

## Production Rule

Do not use these images directly as runtime atlases. The production sprite sheets must be regenerated or manually cleaned into exact frame sizes with transparent backgrounds and a companion frame map.

Required follow-up specs:

- `references/rpg-quality-rework-brief.md`
- `references/asset-production-spec-v2.md`
- `art-config-rpg-v2.json`
