# Claude Handoff

This folder is intended to be usable by Claude Code or Codex as an open-source game design skill.

## Start Here

1. Read `SKILL.md` for the workflow.
2. Read `references/game-design.md` before changing mechanics.
3. Read `references/data-model.md` before implementing save data or timers.
4. Read `references/art-generation.md` before regenerating assets.
5. Read `assets/manifest.json` before wiring image paths.

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
