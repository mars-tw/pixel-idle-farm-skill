# Playable Map Movement Acceptance

This file is a production gate. Do not treat the game as a Harvest-Moon-like pixel farm until the player can move on the farm map and actions resolve through that map.

## Audit Result: 2026-06-29 Gate Recheck

Status: passed for the walkable farm-map milestone.

Verified build:

- Local `main` and `origin/main` point to `4227f17 feat(walkable-map): 主畫面改為可走動 tile map，Miri 在地圖上移動`.
- Latest GitHub Actions `CI & Deploy Pages` run for `4227f17` completed with `success`.
- Local `npm test` passed.
- Local `npm run test:e2e` passed in Chromium at `1280x900` and `390x844`.
- Deployed GitHub Pages was manually verified in Chromium at `1280x900` and `390x844`.

Gate checks passed:

- The first gameplay surface is now an 8x6 tile map scene, not the old crop-dashboard grid.
- `#player` is a child of `.map-scene-wrap`, so Miri is rendered in the map layer.
- `state.player` stores tile position, facing, action, target, and action end time.
- `state.interaction` stores tool, build type, selected tile, pending path, and last invalid reason.
- Clicking a walkable tile changes both `state.player.tileId` and the `#player` DOM position.
- Walk movement uses the walk-cycle sheet while moving.
- Tool actions route through map targets: plant, water, harvest, clear, build, and collect.
- Clear tool moves Miri first, then clears the obstacle and grants materials.
- Chicken coop can be built on a map tile and produces an egg.
- The deployed page loads required JS and image assets with HTTP 200 and no console errors.
- Mobile viewport has no horizontal overflow and keeps the map visible in the first gameplay viewport.

Remaining non-blocking polish:

- Clicking one animal building currently uses `collectAllAnimals`, so it collects all mature animal products instead of only that building's products.
- The old hidden `.farm` and `.farmer` compatibility/debug DOM can be removed after another stable release.
- Later milestones should add stronger farm identity: named NPC orders, collection book, decorations, events, and per-building/animal interactions.

Conclusion: the old rejection case is resolved. The project is now a walkable tile-map idle farming game and passes this gate.

## Maintained Gate For Future Changes

Future production passes must preserve the walkable farm scene and must not regress to a data-only or panel-only feature.

Required result:

- The first playable surface is a tile map.
- Miri Rowan is visible on that tile map.
- Tap/click a walkable tile and Miri moves to that tile.
- Crop plots, obstacles, buildings, and animal homes exist on the map layer.
- Tool actions resolve through map targets: plant, water, harvest, clear, build, collect.
- The generated terrain, building, animal, and character assets are visible in the playable scene.

The old crop grid may remain temporarily as a compatibility/debug view, but it must not be the main game surface after this milestone.

## Required State Model

Add explicit player state:

```js
state.player = {
  tileId: "t0_2",
  x: 0,
  y: 2,
  facing: "down", // down | left | right | up
  action: "idle", // idle | walk | hoe | water | sow | harvest | carry | collect
  actionTargetTileId: null,
  actionEndsAt: 0
};
```

Extend interaction state:

```js
state.interaction = {
  tool: "hand",
  buildType: null,
  selectedTileId: null,
  pendingPath: [],
  lastInvalidReason: null
};
```

Every save migration must fill these fields for older saves.

## Required Controls

Mobile first:

- Tap a walkable destination tile to move Miri.
- Tap a target with the selected tool to move Miri next to the target, play the action, then resolve the state change.
- Invalid targets show the reason directly: water blocked, obstacle blocks movement, not enough coins, locked building, full storage.

Desktop additions:

- Arrow keys or WASD may move Miri one tile at a time.
- Pointer click must still work; keyboard cannot be the only control.

MVP movement can be simple:

- No full A* pathfinding is required at first.
- Manhattan movement with blocked-tile checks is enough.
- A short 150-250ms tween per tile is enough.
- If tweening is too much for the first pass, snap movement is acceptable only if the walk animation and target highlight still make movement visible.

## Map Gameplay Rules

The map is no longer only an expansion menu. The map must own core gameplay objects.

Minimum tile/object behavior:

- `soil`: plant, water, harvest crops.
- `grass`: place buildings and decorations.
- `water`: blocks movement/building until bridge support is added.
- `path`: walkable and can reduce action cooldown or movement time.
- `rock`, `stump`, `bush`: block building; clear tool removes them and grants materials.
- `chickenCoop`, `barn`, `beeBox`: map buildings that contain animals or production loops.

Minimum action sequence:

1. Player selects a tool.
2. Player taps a map target.
3. Miri walks to the target or adjacent actionable tile.
4. Miri plays the matching animation row.
5. The game state changes.
6. Toast/resource UI/offline summary reflects the result.

## Acceptance Tests

Add browser-level tests. Mock DOM smoke tests are not enough for this milestone.

Required E2E checks:

- Clear localStorage and load the game.
- Assert `#mapGrid` or the new map surface is visible in the first gameplay viewport.
- Assert `#player` or `#farmer` is a child of the map scene/layer.
- Record `state.player.tileId` and the player's DOM transform/document position.
- Click a different walkable tile.
- Assert `state.player.tileId` changes.
- Assert the player's DOM transform/document position changes.
- Assert the sprite uses the walk row during movement.
- Select clear tool, click an obstacle, and assert the player moves/actions before the obstacle disappears.
- Build a chicken coop on the map, wait or fast-forward product time, collect an egg from the coop.
- Run at 1280x900 and 390x844.

Minimum command expectation:

```bash
npm test
node scripts/test-map-movement-e2e.js
```

## Screenshot Gate

Every production handoff for this milestone must include screenshots or saved artifacts showing:

- Desktop first viewport with visible map and Miri on the map.
- Mobile first viewport with visible map and Miri on the map.
- Before/after clicking a destination tile.
- At least one map action: clear obstacle, plant/water/harvest, build coop, or collect animal product.

## Rejection Conditions

Reject the build if any of these are true:

- The player character remains fixed in a panel corner.
- The map is below the main dashboard and not the primary play surface.
- Clicking/tapping a map tile only opens a context panel and does not move Miri.
- The state has map tiles but no player coordinates.
- Animal/building systems are only numbers in panels and not visible map objects.
- Tests pass only at logic/mock-DOM level without browser movement verification.
- Generated map/animal/character assets remain unused or emoji-only in the main playable scene.

## Production Prompt

Use this exact instruction when assigning the next implementation:

```text
Implement the walkable farm-scene milestone.

Do not add more dashboard-only systems. Convert the game so the primary play surface is a tile map with Miri Rowan standing on it. Add state.player with tile coordinates, facing, action, and target fields. Render Miri inside the map layer. On tap/click of a walkable tile, move Miri to that tile with visible walk feedback. Route plant, water, harvest, clear, build, and animal collection through map tiles. Keep the idle timers, orders, upgrades, offline progress, and existing economy, but make the visible interaction happen on the map. Add Playwright/browser E2E tests that fail if the character does not move on tile click.
```
