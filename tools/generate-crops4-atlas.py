#!/usr/bin/env python3
"""Generate the 48x48 five-stage radish/sunflower pixel atlas with Pillow."""

from pathlib import Path
import json

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "generated" / "v4"
FRAME = 48
ROWS = ("radish", "sunflower")
STAGES = ("seed", "sprout", "young", "mature", "ready")

P = {
    "outline": "#362c1c",
    "soil_dark": "#432d18",
    "soil": "#84552f",
    "soil_hi": "#bc8248",
    "stem_dark": "#2a5327",
    "stem": "#477730",
    "leaf": "#4f9b43",
    "leaf_hi": "#91cf58",
    "radish_dark": "#9c3047",
    "radish": "#d94b58",
    "radish_hi": "#f27a76",
    "petal_dark": "#c88720",
    "petal": "#f0bd35",
    "petal_hi": "#ffe36a",
    "disk_dark": "#5d351c",
    "disk": "#895124",
    "disk_hi": "#c6802b",
}


image = Image.new("RGBA", (FRAME * len(STAGES), FRAME * len(ROWS)), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)


def xy(row, col, box):
    ox, oy = col * FRAME, row * FRAME
    if len(box) == 2:
        return box[0] + ox, box[1] + oy
    return box[0] + ox, box[1] + oy, box[2] + ox, box[3] + oy


def rect(row, col, box, fill):
    draw.rectangle(xy(row, col, box), fill=fill)


def line(row, col, points, fill, width=1):
    draw.line([xy(row, col, p) for p in points], fill=fill, width=width)


def outlined_ellipse(row, col, box, fill, outline=None, inset=1):
    outline = outline or P["outline"]
    draw.ellipse(xy(row, col, box), fill=outline)
    x0, y0, x1, y1 = box
    draw.ellipse(xy(row, col, (x0 + inset, y0 + inset, x1 - inset, y1 - inset)), fill=fill)


def soil(row, col, x=18, width=13):
    rect(row, col, (x, 38, x + width, 41), P["outline"])
    rect(row, col, (x + 1, 38, x + width - 1, 40), P["soil"])
    rect(row, col, (x + 4, 38, x + width - 3, 38), P["soil_hi"])
    rect(row, col, (x + 2, 41, x + width - 2, 41), P["soil_dark"])


def leaf(row, col, cx, cy, direction=1, scale=1):
    rx, ry = 5 * scale, 3 * scale
    outlined_ellipse(row, col, (cx - rx, cy - ry, cx + rx, cy + ry), P["leaf"], P["stem_dark"])
    line(row, col, ((cx - direction * rx + 1, cy + 1), (cx + direction * rx - 1, cy - 1)), P["stem_dark"])
    rect(row, col, (cx - 1, cy - ry + 1, cx, cy - ry + 2), P["leaf_hi"])


def radish_root(row, col, cx, cy, rx, ry, ready=False):
    outlined_ellipse(row, col, (cx - rx, cy - ry, cx + rx, cy + ry), P["radish"])
    rect(row, col, (cx - rx + 2, cy - ry + 2, cx - rx + 3, cy - ry + 3), P["radish_hi"])
    rect(row, col, (cx + rx - 2, cy + 1, cx + rx - 1, cy + 3), P["radish_dark"])
    line(row, col, ((cx, cy + ry), (cx - 1, cy + ry + (3 if ready else 2))), P["outline"])


def radish_stage(stage):
    row, col = 0, stage
    soil(row, col, 17 if stage >= 3 else 19, 15 if stage >= 3 else 11)
    if stage == 0:
        outlined_ellipse(row, col, (21, 33, 27, 38), P["radish_dark"])
        rect(row, col, (22, 34, 23, 35), P["radish_hi"])
    elif stage == 1:
        radish_root(row, col, 24, 36, 3, 3)
        line(row, col, ((24, 34), (24, 28)), P["stem_dark"], 2)
        leaf(row, col, 20, 29, -1)
        leaf(row, col, 28, 28, 1)
    elif stage == 2:
        radish_root(row, col, 24, 36, 5, 4)
        line(row, col, ((24, 33), (24, 22)), P["stem_dark"], 2)
        leaf(row, col, 18, 27, -1)
        leaf(row, col, 30, 25, 1)
        leaf(row, col, 23, 22, -1)
    elif stage == 3:
        radish_root(row, col, 24, 35, 7, 7, True)
        line(row, col, ((24, 30), (24, 17)), P["stem_dark"], 2)
        leaf(row, col, 16, 24, -1)
        leaf(row, col, 32, 22, 1)
        leaf(row, col, 20, 18, -1)
        leaf(row, col, 28, 17, 1)
    else:
        radish_root(row, col, 24, 34, 9, 8, True)
        line(row, col, ((24, 28), (24, 13)), P["stem_dark"], 2)
        leaf(row, col, 14, 22, -1)
        leaf(row, col, 34, 20, 1)
        leaf(row, col, 19, 15, -1)
        leaf(row, col, 29, 14, 1)
        leaf(row, col, 24, 20, -1)


def sunflower_head(row, col, cx, cy, radius, open_flower=True):
    if not open_flower:
        outlined_ellipse(row, col, (cx - radius, cy - radius, cx + radius, cy + radius), P["petal_dark"], P["stem_dark"])
        rect(row, col, (cx - 1, cy - radius + 1, cx, cy - radius + 2), P["petal_hi"])
        return
    for dx, dy in ((0, -radius - 2), (radius + 2, 0), (0, radius + 2), (-radius - 2, 0),
                   (radius, -radius), (radius, radius), (-radius, radius), (-radius, -radius)):
        outlined_ellipse(row, col, (cx + dx - 3, cy + dy - 3, cx + dx + 3, cy + dy + 3), P["petal"], P["petal_dark"])
    outlined_ellipse(row, col, (cx - radius, cy - radius, cx + radius, cy + radius), P["disk"], P["outline"])
    rect(row, col, (cx - 2, cy - 2, cx, cy), P["disk_hi"])
    rect(row, col, (cx + 2, cy + 2, cx + 3, cy + 3), P["disk_dark"])


def sunflower_stage(stage):
    row, col = 1, stage
    soil(row, col, 18, 13)
    if stage == 0:
        outlined_ellipse(row, col, (21, 33, 27, 38), P["disk"])
        rect(row, col, (22, 34, 23, 35), P["disk_hi"])
    elif stage == 1:
        line(row, col, ((24, 38), (24, 28)), P["stem_dark"], 3)
        line(row, col, ((24, 37), (24, 28)), P["stem"], 1)
        leaf(row, col, 19, 31, -1)
        leaf(row, col, 29, 29, 1)
    elif stage == 2:
        line(row, col, ((24, 39), (24, 19)), P["stem_dark"], 3)
        line(row, col, ((24, 38), (24, 20)), P["stem"], 1)
        leaf(row, col, 17, 32, -1)
        leaf(row, col, 31, 27, 1)
        leaf(row, col, 19, 23, -1)
        sunflower_head(row, col, 24, 18, 4, False)
    elif stage == 3:
        line(row, col, ((24, 40), (24, 16)), P["stem_dark"], 3)
        line(row, col, ((24, 39), (24, 17)), P["stem"], 1)
        leaf(row, col, 16, 32, -1)
        leaf(row, col, 32, 27, 1)
        leaf(row, col, 18, 22, -1)
        sunflower_head(row, col, 24, 14, 4, True)
    else:
        line(row, col, ((24, 41), (24, 17)), P["stem_dark"], 4)
        line(row, col, ((24, 40), (24, 18)), P["stem"], 2)
        leaf(row, col, 14, 33, -1)
        leaf(row, col, 34, 29, 1)
        leaf(row, col, 16, 24, -1)
        leaf(row, col, 32, 21, 1)
        sunflower_head(row, col, 24, 13, 6, True)


for index in range(len(STAGES)):
    radish_stage(index)
    sunflower_stage(index)

OUT.mkdir(parents=True, exist_ok=True)
png_path = OUT / "crops4-48.png"
json_path = OUT / "crops4-48.json"
image.save(png_path, format="PNG", optimize=True)

frames = {}
for row, crop in enumerate(ROWS):
    for col, stage in enumerate(STAGES):
        frames[f"{crop}_{stage}"] = {
            "x": col * FRAME,
            "y": row * FRAME,
            "w": FRAME,
            "h": FRAME,
            "anchor": [0.5, 0.9],
        }

payload = {
    "image": "assets/generated/v4/crops4-48.png",
    "meta": {"w": image.width, "h": image.height, "frameW": FRAME, "frameH": FRAME, "cols": 5, "rows": 2},
    "frames": frames,
}
json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"generated {png_path.relative_to(ROOT)} and {json_path.relative_to(ROOT)}")
