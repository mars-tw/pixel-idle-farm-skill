# Claude Handoff

This folder is intended to be usable by Claude Code or Codex as an open-source game design skill.

## Start Here

1. Read `SKILL.md` for the workflow.
2. Read `references/game-design.md` before changing mechanics.
3. Read `references/data-model.md` before implementing save data or timers.
4. Read `references/art-generation.md` before regenerating assets.
5. Read `assets/manifest.json` before wiring image paths.
6. Read `references/asset-gameplay-integration.md` before adding the next playable milestone; generated map, animal, building, icon, and character assets must become gameplay systems.
7. Read `references/gameplay-interactions-roadmap.md` before adding new player interactions, tool modes, map actions, animal loops, events, or character animation hooks.
8. Read `references/playable-map-movement-acceptance.md` before claiming the game has a walkable map or Harvest-Moon-like movement.
9. Read `references/rpg-quality-rework-brief.md`, `references/asset-production-spec-v2.md`, and `references/production-directive-rpg-rework.md` before improving desktop visual quality or replacing preview assets.
10. Read `references/rpg-action-map-gate.md`, `references/sprite-cutting-method-v3.md`, and `references/production-directive-stage3-rpg-actions.md` before changing character sprites, map terrain, watering/hoeing/harvesting actions, or RPG station interactions.
11. Read `references/production-directive-stage4-game-audit.md` before the next production pass; the current blocker is game quality, larger RPG world structure, story-driven map interaction, and validated v4 assets.

## Build Target

Create a static browser game:

```text
index.html
src/config.js
src/state.js
src/game.js
src/ui.js
assets/generated/*.png
```

No build step is required for the default implementation. Use localStorage for saves.

## Implementation Priorities

1. Playable farm grid with planting and harvesting.
2. Timestamp-based crop growth.
3. Storage and direct sell.
4. Market orders.
5. Upgrades and plot unlocks.
6. Offline progress summary.
7. Asset sheets wired through CSS background-position or canvas drawImage.
8. Map, animal, building, and character assets wired to actual gameplay, not decoration-only rendering.
9. Tool-mode interactions, tile inspection, and mixed crop/animal/material orders as described in `references/gameplay-interactions-roadmap.md`.
10. Walkable farm scene acceptance as described in `references/playable-map-movement-acceptance.md`.
11. RPG-quality desktop/mobile scene rework as described in `references/rpg-quality-rework-brief.md`.
12. Stage 3 RPG actions, organic terrain, corrected Miri proportions, and station interactions as described in `references/rpg-action-map-gate.md`.
13. Stage 4 game-quality rework as described in `references/production-directive-stage4-game-audit.md`.

## Mandatory Asset Gameplay

The next production pass must use generated assets this way:

- `terrain-tileset.png`: map tiles with placement, clearing, water/path/fence/utility behavior.
- `farm-actors-buildings.png`: animals and buildings that unlock products, storage, orders, or bonuses.
- `ui-icons.png`: resource/action/product icons.
- `miri-rowan-walk-cycle.png`: movement feedback.
- `miri-rowan-farm-actions.png`: hoe, water, sow, harvest, carry, collect feedback.

Acceptance details are in `references/asset-gameplay-integration.md`.
Interaction sequencing and test expectations are in `references/gameplay-interactions-roadmap.md`.
Walkable map and character movement gates are in `references/playable-map-movement-acceptance.md`.
RPG visual-quality and v2 asset-production requirements are in `references/rpg-quality-rework-brief.md` and `references/asset-production-spec-v2.md`.
Stage 3 character/action/map-station requirements and exact slicing rules are in `references/rpg-action-map-gate.md` and `references/sprite-cutting-method-v3.md`.
Stage 4 game audit, large-world requirements, story gates, and v4 asset rejection conditions are in `references/production-directive-stage4-game-audit.md`.

## Asset Files

Expected files:

- `assets/generated/terrain-tileset.png`
- `assets/generated/crop-growth.png`
- `assets/generated/farm-actors-buildings.png`
- `assets/generated/ui-icons.png`
- `assets/generated/characters/miri-rowan-turnaround.png`
- `assets/generated/characters/miri-rowan-walk-cycle.png`
- `assets/generated/characters/miri-rowan-farm-actions.png`

If files are missing, run:

```powershell
.\scripts\gen-art-openai.ps1 -DryRun
```

Then generate with OpenAI after setting `OPENAI_API_KEY`, or use the dry-run prompts in another image tool and save the output to the expected paths.

For character slicing and animation naming, read `references/character-animation.md`.

## Validation

Before considering the game complete:

- Plant and harvest every unlocked crop.
- Reload after planting and confirm timers remain correct.
- Simulate offline progress by editing `lastSeenAt` backward in localStorage.
- Fill storage and confirm overflow is explained.
- Fulfill and refresh market orders.
- Buy each MVP upgrade and confirm numbers change.
- Test at desktop width and mobile width.
- Confirm Console has no runtime errors.
