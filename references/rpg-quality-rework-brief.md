# RPG Quality Rework Brief

This is the next production direction after the walkable-map gate passed. The current game is functional, but the desktop version does not yet feel like a polished RPG farming game.

## Current Problems

### 1. Desktop Composition Still Reads As A Tool Panel

The player can move, but the screen still looks like a web dashboard:

- Large bordered panels dominate the first viewport.
- The right column is useful but visually heavy.
- The map is inside a panel instead of feeling like the world.
- Buttons and resource chips compete with the scene for attention.

Target: the first desktop viewport must look like a playable farm map with a compact HUD, not like a spreadsheet of controls.

Reference: `references/visual-targets/rpg-desktop-scene-target.png`.

### 2. Assets Are Preview-Quality And Not Sliced Deterministically

Current generated files are `1254x1254`, which causes fractional frame sizes:

- 4-column sheets: `1254 / 4 = 313.5px`
- 5-column crop sheet: `1254 / 5 = 250.8px`
- 6-row action sheet: `1254 / 6 = 209px`

The game is using percentage background positioning against sheets that are not aligned to exact cells. This is why sprites can look cropped, offset, blurry, or inconsistent.

Target: every runtime spritesheet must use exact integer frame dimensions or a JSON frame map. No runtime sprite can depend on guessed percentage math against a concept image.

### 3. Terrain Is Not Truly Using The Asset Language

The map has gameplay rules, but much of the visual map is still CSS color blocks and emoji-like object rendering. That makes it feel like a prototype, not an RPG field.

Target: grass, soil, wet soil, path, water, bridge, obstacle, building, crop, and animal must all come from image assets or a real atlas renderer.

### 4. Map Gameplay Exists But Feels Thin

The current map proves movement and interactions. It still needs RPG-style reasons to move:

- Named places: farmhouse, crop field, coop, barn, pond, order board, storage.
- Object-specific interaction: collect from this coop, inspect this crop, clear this stump.
- Visual changes: cleared stump becomes a clean tile, built coop occupies footprint, wet soil looks wet, ready crop pulses.
- Routes: paths matter, water blocks, bridge connects, fences shape animal areas.

Target: every map object needs visible state and a gameplay reason.

## New Product Target

Build a browser RPG idle farm:

- Desktop: world-first layout with compact HUD.
- Mobile: the same map remains playable without horizontal scroll.
- Interaction: tap/click/keyboard movement, then action.
- Idle layer: crops and animals progress over time even when away.
- RPG layer: the farm is a place with paths, buildings, animals, props, and named stations.

## Layout Direction

### Desktop

Use a world-first layout:

- Main scene takes 70-75% of width.
- Side panel takes 25-30% and can switch tabs: Tile, Orders, Upgrades, Collection.
- HUD is compact and overlays or sits above the scene.
- Bottom action bar is icon-first and short.
- Avoid large beige cards dominating the screen.

Required first viewport:

- Miri visible on map.
- Farmhouse or order board visible.
- Crop beds visible.
- At least one animal/building area visible.
- A water/path/bridge or obstacle area visible.

### Mobile

Keep one-column layout, but do not bury the map:

- Resource HUD wraps above.
- Tool row stays compact.
- Map appears before orders/upgrades.
- Side panel becomes tabs below the map.
- No horizontal overflow at `390px`.

## Interaction Direction

Move toward RPG verbs:

- Hand: collect, harvest, talk/use station.
- Hoe: turn eligible grass/field into soil.
- Water: wet planted dry soil.
- Axe/Pick: clear stump/rock/bush.
- Build: place building blueprint, then confirm footprint.
- Inspect: show tile/object details.

Do not resolve an action from a detached panel if the clicked object is on the map. The character should walk to the target or adjacent tile first.

## Required Map Systems

### Scene Layers

Use explicit visual layers:

1. Ground terrain
2. Paths/soil/water edges
3. Props and obstacles
4. Crops and wet/ready overlays
5. Buildings and animals
6. Character
7. Effects, selection rings, action previews
8. HUD

### Footprints

Support footprints instead of one icon per tile:

- Small prop: `1x1`
- Coop / well / order board: `1x1` or `1x2`
- Barn / farmhouse: `2x2` or larger
- Crop plot: `1x1`
- Animal pen: multiple tiles bounded by fence

### Anchors

Every sprite frame needs an anchor:

```js
anchor: { x: 0.5, y: 0.9 }
```

Use the anchor to align character feet, buildings, animals, and props to tile centers.

## Definition Of Done

This rework is not complete until:

- Runtime assets use exact frame sizes or `atlas.json`.
- No gameplay object depends on emoji in the main map.
- Desktop first viewport visually reads as an RPG farm.
- Mobile `390x844` has no horizontal overflow and the map is first.
- Clicking a crop/building/animal visibly moves Miri before action resolution.
- At least five map object types have unique gameplay: crop soil, stump/rock, water/bridge, coop/chicken, order board/storage.
- Playwright screenshots are saved for desktop and mobile and reviewed.
- E2E tests verify movement, action routing, no horizontal overflow, and no console errors.
