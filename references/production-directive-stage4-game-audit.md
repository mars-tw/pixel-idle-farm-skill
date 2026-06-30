# Stage 4 Game Audit And Production Directive

Copy this to the production agent before the next implementation pass.

## Audit Source

- Date: 2026-06-30
- Live URL: https://mars-tw.github.io/pixel-idle-farm-skill/
- Baseline commit: `5a64311 fix(rpg-polish): remove map grid and keep Miri visible`
- Verified viewports: desktop `1280x900`, mobile `390x844`
- Current pass results: no console errors, no horizontal overflow, planting/watering/order-board/story tab work.

## Current Verdict

The game is now a functional walkable farm prototype, but it is not yet a high-quality RPG farming game.

Do not spend the next pass adding more economy numbers or side-panel content. The next pass must make the player feel like they are standing inside a living farm map.

## Evidence From The Audit

- Map model is only `8x6` (`48` tiles).
- Initial map has `12` soil tiles, `4` stations, and `4` obstacles.
- The desktop map occupies only about `35.6%` of the viewport area.
- The mobile map occupies only about `27.0%` of the viewport area.
- There are `11` visible buttons on first screen, including four global bottom buttons.
- Bottom global buttons still bypass the RPG fiction: `全部收成`, `全部賣出`, `澆水`, `收產物`.
- Story exists as a side tab, but it is passive text. It is not yet driven by map characters, quest markers, dialogue, or location-specific interactions.
- Current v3 assets are usable for prototype validation, but not final-quality:
  - `miri-actions-48x64.png` has bad/blank rows and cannot be trusted for idle frames.
  - `crops-32.png` still has inconsistent crop scale and noisy mature frames.
  - Buildings are still effectively single-tile props, not RPG scene structures with footprint and occlusion.

## Required Stage 4 Outcome

The first screen must feel like an RPG farm scene, not a dashboard with a map widget.

Required result:

1. The world is larger than the viewport.
   - Replace the fixed `8x6` map with at least `16x12` logical tiles.
   - Add a camera/viewport that follows Miri instead of showing the entire world as one small board.
   - Keep mobile playable at `390x844`.

2. The map is the primary interface.
   - Desktop first viewport: the map scene should visually dominate the screen.
   - Tool and resource UI must become HUD overlays or compact controls.
   - Side panels should be secondary and collapsible on mobile.

3. Remove global action bypasses from the early game.
   - `全部收成`, `全部賣出`, `澆水`, `收產物` must not be always-on first-session shortcuts.
   - These actions should route through map stations, or unlock later as helper/automation conveniences.
   - Early game actions must be: choose tool -> click target -> Miri walks -> action animation -> result.

4. Story must be playable, not just readable.
   - Add `state.story` with current quest, completed objectives, and seen dialogue flags.
   - Add at least one map-based story source: mailbox, NPC visitor, or town notice.
   - The intro quest must guide: inspect mailbox/sign -> plant wheat -> water wheat -> harvest -> deliver first order.
   - Quest markers must appear on map targets, not only in the side panel.

5. Buildings and nature must become RPG scene objects.
   - Add multi-tile footprints for at least: farmhouse/shed, coop, barn, large tree.
   - Add z-layer/foreground occlusion so Miri can walk behind tall objects.
   - Buildings must have interaction hotspots and states.

6. Animals must be visible game entities.
   - Do not represent animals only as product markers.
   - Add animal sprites or simple roaming/idling entities near their home.
   - Collection remains per-building or per-animal, not global.

7. Replace bad prototype sheets with a Stage 4 asset pass.
   - Use exact-frame runtime sheets and JSON frame maps.
   - Character walk and action sheets must share the same model, outfit, scale, palette, and baseline.
   - Crop frames must not touch frame edges and must leave transparent safety padding.
   - Do not use action rows that include blank frames or body parts cut into other cells.

## Implementation Steps

### Step 1: World And Camera

Change the map data model first.

Suggested model:

```js
state.map = {
  width: 16,
  height: 12,
  tiles: [
    {
      id: "t4_7",
      x: 4,
      y: 7,
      terrain: "grass",
      plotIndex: null,
      object: null,
      station: null,
      buildingId: null,
      blockedBy: null,
      foregroundId: null
    }
  ]
}
```

Add a camera viewport in UI:

```js
state.camera = {
  x: 0,
  y: 0,
  followPlayer: true
}
```

The camera may be derived instead of saved, but E2E must prove the world is larger than the visible viewport and Miri can move across more than one screenful.

### Step 2: Layered Scene Renderer

Render these layers in order:

1. terrain
2. ground overlays: furrows, flowers, shadows
3. crops and small objects
4. buildings / tall objects
5. player and animals
6. foreground occluders
7. VFX and quest markers

Do not put all objects inside one clipped tile div. Large objects must be allowed to cover multiple tiles and occlude the player.

### Step 3: Story Loop

Add a small quest system:

```js
state.story = {
  questId: "intro_reopen_farm",
  completed: {},
  dialogueSeen: {},
  markers: []
}
```

Minimum quests:

1. `intro_reopen_farm`
   - Trigger: mailbox/sign interaction.
   - Objective: plant wheat.
2. `first_water`
   - Objective: water the planted wheat.
3. `first_harvest`
   - Objective: harvest the wheat.
4. `first_delivery`
   - Objective: walk to order board and complete/deliver a simple first order.
5. `clear_old_path`
   - Objective: clear a rock/stump to open the next farm area.

Story should unlock or highlight map destinations. It should not be hidden behind a purely textual tab.

### Step 4: Replace Global Shortcuts

Initial first session:

- Keep tool buttons.
- Keep seed selector.
- Remove or disable always-on global `全部收成`, `全部賣出`, `澆水`, `收產物`.

Allowed replacements:

- A compact HUD hint.
- Station-specific actions after Miri walks there.
- Automation buttons unlocked only after helper upgrades.

### Step 5: Stage 4 Asset Quality

Generate or clean these sheets:

```text
assets/generated/v4/miri-walk-48x64.png
assets/generated/v4/miri-actions-48x64.png
assets/generated/v4/crops-40x40.png or crops-48x48.png
assets/generated/v4/terrain-32.png
assets/generated/v4/structures-nature.png
assets/generated/v4/animals-32x32.png
```

Required asset gates:

- Every frame has non-empty alpha.
- No frame has visible content touching the outer 2px border.
- Character feet stay on the same baseline per row.
- Walk/action sheets use the same character scale and palette.
- Crop mature/ready stages fit inside the frame without being cropped.
- No checkerboard background baked into RGB.
- No text or labels in sprite frames.

Add a validator similar to `scripts/validate-v3-atlas.js`:

```text
scripts/validate-v4-atlas.js
```

It must fail on blank frames, edge-touching sprites, missing frames, wrong dimensions, or mismatched JSON metadata.

## Required E2E Gates

Add or extend Playwright E2E to cover:

1. Large world:
   - map model is at least `16x12`
   - visible viewport is smaller than the full world
   - player can walk to an off-screen target and camera follows

2. RPG action routing:
   - planting, watering, harvesting, clearing, building, collecting all require Miri to move first
   - early global buttons cannot bypass map interactions

3. Story:
   - mailbox/sign starts intro quest
   - quest marker appears on the correct map target
   - planting/watering/harvesting updates quest state
   - order board delivery advances story

4. Visual quality:
   - no CSS tile grid lines
   - no production emoji objects on the map
   - no blank character frames during idle/walk/action
   - crop sprites are not clipped by tile overflow or frame edge
   - desktop and mobile screenshots are saved for audit

5. RWD:
   - `390x844` no horizontal overflow
   - map remains visible in first viewport
   - side panels can collapse or move below without blocking play

## Rejection Conditions

Reject the next pass if any of these are true:

- The map is still only `8x6`.
- The map still looks like a small board inside a dashboard.
- Global buttons remain the primary way to harvest/sell/water/collect in the first session.
- Story is only a side-panel text checklist.
- Buildings are still single-tile icons with no footprint or occlusion.
- Animals are still invisible except for product markers.
- Any character action uses a known-bad blank frame.
- Crops are visibly cropped, oversized, or inconsistent in scale.
- E2E passes but no desktop/mobile screenshots are reviewed.

## Production Prompt

Implement Stage 4 Game Quality. The current game is functional, but the game itself still feels like a small management panel, not a polished RPG farm. Follow `references/production-directive-stage4-game-audit.md`. Expand the world to at least 16x12 with camera follow, make the map the primary interface, remove early global action shortcuts, make story quest objectives map-driven, add multi-tile buildings with occlusion, show animals as entities, and replace bad v3 crop/action frames with validated v4 assets. Add Playwright gates for large world, camera movement, map-routed actions, story progression, no grid lines, no map emoji, no blank frames, no clipped crops, no console errors, and 390px mobile no overflow.
