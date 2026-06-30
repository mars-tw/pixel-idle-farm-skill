# Production Directive: RPG Quality Farm Rework

Copy this instruction to the production agent.

## Mission

Rework 阿軒割割陽光農場開源遊戲世界 from a functional walkable-map prototype into a high-quality RPG-style browser farming game.

The current walkable-map gate passed, but visual quality is not acceptable yet. Do not add more economy features until the scene, assets, and map interaction quality are upgraded.

## Read First

1. `references/rpg-quality-rework-brief.md`
2. `references/asset-production-spec-v2.md`
3. `references/visual-targets/README.md`
4. `art-config-rpg-v2.json`
5. `references/playable-map-movement-acceptance.md`

## Non-Negotiable Direction

The desktop version must look like a playable RPG farm scene, not a web dashboard.

Do not:

- Do not make the map a card inside a UI dashboard.
- Do not use emoji as main map objects.
- Do not use CSS color blocks as final terrain.
- Do not use percentage slicing from `1254x1254` concept sheets.
- Do not add more panels before improving the world scene.
- Do not claim completion without screenshots and browser checks.

Do:

- Make the world scene the visual priority.
- Use v2 image assets or exact-frame placeholder atlases.
- Render objects through a frame map or exact sprite grid.
- Add scene layers: terrain, paths, props, crops, buildings, animals, character, effects, HUD.
- Use compact RPG HUD and tabbed side panel.
- Keep mobile playable at `390x844`.

## Implementation Order

### Step 1: Renderer Cleanup

Replace ad-hoc DOM/emoji rendering with a small atlas renderer.

Required:

- `src/assets.js` or equivalent frame registry.
- `drawFrame(frameId, targetElement)` or a CSS background helper using exact pixel frame metadata.
- Load `assets/generated/v2/manifest.json`.
- Fallback debug mode may show emoji, but production mode must use images.

### Step 2: V2 Temporary Atlas

If final generated v2 assets are not ready, create simple clean placeholder PNG atlases with exact dimensions.

Do not wait on perfect art to fix the renderer. The renderer must prove exact slicing first.

Required placeholder dimensions:

- Terrain: `512x512`, 32px grid.
- Crops: `160x192`, 32px frames.
- Miri walk: `192x256`, 48x64 frames.
- Miri actions: `192x384`, 48x64 frames.
- Animals: `192x192`, 48px frames.
- UI icons: `512x512`, 32px grid.

### Step 3: RPG Desktop Layout

Change the desktop composition:

- Map scene: 70-75% of width.
- Side panel: 25-30%, tabbed.
- HUD: compact, not large card chips.
- Bottom action bar: compact icon-first.
- First viewport must show farm world: crops, path, water/bridge or obstacle, animal/building area, Miri.

### Step 4: Real Map Utility

Add map reasons to move:

- Order board opens orders.
- Mailbox gives returning-player/offline message.
- Storage crate opens inventory/sell.
- Well or pond can refill/boost watering.
- Coop collects only coop products.
- Barn collects only barn products.
- Stump/rock/bush block placement and routes until cleared.
- Bridge makes water crossing useful.

### Step 5: Visual State

Every state change must be visible on the map:

- Dry vs wet soil.
- Growing vs ready crop.
- Cleared obstacle.
- Building footprint.
- Animal product ready.
- Invalid target highlight.
- Selected route or destination.

### Step 6: Tests And Screenshots

Add or update E2E tests:

- Desktop first viewport has no dashboard dominance.
- Mobile `390x844` has no horizontal overflow.
- `#mapScene` uses image-backed tiles/objects, not emoji glyphs.
- Click crop -> Miri walks -> action resolves.
- Click coop -> Miri walks -> only coop products collect.
- Order board opens order panel.
- Storage opens storage/sell panel.
- Console has no errors.

Save audit screenshots:

```text
artifacts/rpg-rework-desktop.png
artifacts/rpg-rework-mobile.png
```

## Acceptance Criteria

The rework is accepted only if:

- Desktop screenshot resembles `references/visual-targets/rpg-desktop-scene-target.png` in scene priority, not exact art.
- All runtime sheets use integer frame dimensions or JSON frame maps.
- The main scene contains no emoji map objects in production mode.
- Miri, buildings, crops, animals, terrain, and props share one coherent pixel-art scale.
- Map objects have gameplay, not just decoration.
- `npm test` passes.
- `npm run test:e2e` passes.
- New visual/RWD E2E checks pass.

## Suggested Production Prompt

```text
Implement the RPG quality rework. The walkable-map gate already passed, but visual quality is not acceptable. Follow references/rpg-quality-rework-brief.md and references/asset-production-spec-v2.md. Replace preview 1254x1254 percentage-sliced assets and emoji/CSS map rendering with exact-frame v2 atlas rendering. Make the desktop first viewport world-first, not dashboard-first. Use references/visual-targets/rpg-desktop-scene-target.png as composition target and references/visual-targets/rpg-asset-atlas-direction.png as style target. Add map utility objects: order board, mailbox, storage, well/pond, coop, barn, bridge, obstacles. Every object must have gameplay and visible state. Keep mobile 390x844 playable without horizontal overflow. Add Playwright checks for image-backed map rendering, no console errors, movement/action routing, no horizontal overflow, and per-building animal collection.
```
