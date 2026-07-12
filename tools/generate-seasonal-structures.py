#!/usr/bin/env python3
"""Derive deterministic seasonal landmark frames from structures-nature.

The original loose atlas remains the source of truth.  This script copies its
base frames and appends pixel-safe spring/autumn/winter variants without
resampling, so anchors and the painterly pixel language stay intact.
"""

from pathlib import Path
import colorsys
import json

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "generated" / "v4"
PNG = OUT / "structures-nature.png"
MAP = OUT / "structures-nature.json"
MANIFEST = OUT / "manifest.json"
BASE_NAMES = ("oak", "pine", "fruit_tree", "bush_big", "market_stall", "windmill",
              "signpost", "hay_bale", "flower_bed", "lamp_post")
VARIANTS = (
    ("oak", "spring"), ("oak", "autumn"), ("oak", "winter"),
    ("bush_big", "spring"), ("bush_big", "autumn"), ("bush_big", "winter"),
)


def is_green(r, g, b):
    return g > 44 and g > r * 1.06 and g > b * 1.05


def seasonalize(src, season):
    out = src.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not a:
                continue
            if is_green(r, g, b):
                value = max(r, g, b) / 255
                if season == "spring":
                    # Clustered blossom flecks, not a full pink filter: green
                    # foliage still reads beneath the flowers.
                    flower = ((x * 17 + y * 31 + (x // 5) * 13) % 97) < 43 and value > .34
                    if flower:
                        px[x, y] = (244, 151 + ((x + y) % 35), 174 + ((x * 3 + y) % 46), a)
                    else:
                        px[x, y] = (min(255, int(r * 1.04 + 5)), min(255, int(g * 1.08 + 8)), b, a)
                elif season == "autumn":
                    lum = (r + g * 2 + b) // 4
                    red_leaf = ((x * 11 + y * 7) % 9) < 3
                    px[x, y] = ((min(226, lum + (72 if red_leaf else 48))),
                                min(151, int(lum * (.66 if red_leaf else .88))),
                                min(73, int(lum * .34)), a)
                elif season == "winter":
                    lum = (r + g * 2 + b) // 4
                    px[x, y] = (min(164, int(lum * .68 + 42)),
                                min(178, int(lum * .72 + 48)),
                                min(181, int(lum * .75 + 55)), a)
    if season == "winter":
        # Snow catches only upward-facing opaque pixels.  No blur/resampling,
        # so the cap remains crisp at native atlas resolution.
        base = out.copy()
        bp = base.load()
        for y in range(1, h):
            for x in range(w):
                if bp[x, y][3] and not bp[x, y - 1][3] and ((x * 5 + y * 3) % 7) < 5:
                    px[x, y] = (225, 237, 239, bp[x, y][3])
                    if y + 1 < h and bp[x, y + 1][3] and (x + y) % 3:
                        px[x, y + 1] = (194, 214, 220, bp[x, y + 1][3])
    return out


payload = json.loads(MAP.read_text(encoding="utf-8"))
base_frames = {name: payload["frames"][name] for name in BASE_NAMES}
base_h = max(f["y"] + f["h"] for f in base_frames.values()) + 4
source = Image.open(PNG).convert("RGBA").crop((0, 0, payload["meta"]["w"], base_h))

# Shelf-pack appended variants into the existing 1024px atlas width.
placements = []
x, y, shelf_h = 4, base_h + 4, 0
for base_name, season in VARIANTS:
    frame = base_frames[base_name]
    if x + frame["w"] + 4 > source.width:
        x, y, shelf_h = 4, y + shelf_h + 4, 0
    placements.append((base_name, season, x, y))
    x += frame["w"] + 4
    shelf_h = max(shelf_h, frame["h"])

atlas_h = y + shelf_h + 4
atlas = Image.new("RGBA", (source.width, atlas_h), (0, 0, 0, 0))
atlas.paste(source, (0, 0))
frames = dict(base_frames)
for base_name, season, dx, dy in placements:
    frame = base_frames[base_name]
    crop = source.crop((frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]))
    variant = seasonalize(crop, season)
    atlas.alpha_composite(variant, (dx, dy))
    frames[f"{base_name}_{season}"] = {
        "x": dx, "y": dy, "w": frame["w"], "h": frame["h"], "anchor": frame["anchor"]
    }

payload["meta"].update({"w": atlas.width, "h": atlas.height, "rows": 6})
payload["frames"] = frames
atlas.save(PNG, format="PNG", optimize=True)
MAP.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
manifest["sheets"]["structures"]["meta"] = payload["meta"]
manifest["sheets"]["structures"]["frameCount"] = len(frames)
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"generated {PNG.relative_to(ROOT)} with {len(frames)} frames")
