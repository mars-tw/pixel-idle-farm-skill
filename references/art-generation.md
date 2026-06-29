# Art Generation

Use `art-config.json` as the single source for image prompts. The default script uses OpenAI Images generation with `model: gpt-image-2`, but it supports `-DryRun` so Claude can inspect or copy prompts without an API key.

## Commands

```powershell
cd pixel-idle-farm
.\scripts\gen-art-openai.ps1 -DryRun
.\scripts\gen-art-openai.ps1 -Only terrain-tileset
.\scripts\gen-art-openai.ps1 -Only terrain-tileset,crop-growth
```

Requirements for live generation:

- `OPENAI_API_KEY` set in the environment.
- Network access to `https://api.openai.com/v1/images/generations`.
- Enough budget for high quality image generation.

## Prompt Rules

- Ask for spritesheets, not final UI screenshots.
- Say "no text, no logo, no watermark" for every sheet.
- Keep sprites separated with padding so Claude or a human can crop them later.
- Prefer `1024x1024` square sheets for MVP speed and consistent packing.
- Avoid true transparency assumptions for `gpt-image-2`; use opaque sheets or post-process separately if a transparent PNG is required.
- Keep style language stable across all sheets: cozy, crisp, top-down pixel art, browser game readable.

## Planned Sheets

| ID | Purpose | Consumer |
|---|---|---|
| terrain-tileset | farm grid, paths, fence, water, decoration | map renderer |
| crop-growth | crop growth stages | plot renderer |
| farm-actors-buildings | player, animals, buildings | farm scene and unlocks |
| ui-icons | resource and action icons | HUD, buttons, order board |

## Acceptance Checklist

- Sprites are visually separated and can be cropped.
- Pixel style is consistent across sheets.
- No readable text is embedded in the image.
- Crops have clear growth progression.
- UI icons are recognizable at small sizes.
- Terrain tiles include enough path, soil, water, and fence variety for a first playable map.

## If A Sheet Fails

Iterate one sheet at a time. Keep the same style suffix and change only the defect:

- Too painterly: "make edges blockier, lower anti-aliasing, more classic pixel sprite style."
- Too crowded: "increase padding between sprites and reduce sprite count."
- Wrong perspective: "use strict top-down orthographic tile view."
- Text artifacts: "remove all letters, signs, labels, numbers, and UI text."
