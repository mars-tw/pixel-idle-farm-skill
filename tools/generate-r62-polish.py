"""farm R62 deterministic pixel-art polish pass.

Rebuilds the 32 px terrain atlas at native resolution and grades every runtime
sprite sheet into one finite, shared palette.  Frame sizes, alpha coverage,
atlas coordinates, filenames, and metadata are intentionally untouched.
"""

from __future__ import annotations

import colorsys
import json
import math
import random
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs" / "evidence" / "R62_polish"
BACKUP = ROOT / "tmp" / "r62-polish-before"
TERRAIN = ROOT / "assets" / "generated" / "v4" / "terrain-organic-32.png"
TERRAIN_MAP = TERRAIN.with_suffix(".json")


# One shared 66-colour runtime palette.  Each material family moves from a
# cool/violet shadow to a warmer highlight in at least four discrete steps.
PALETTE_FAMILIES: dict[str, list[str]] = {
    "outline": ["#251d35", "#352941", "#49364b", "#5b4758"],
    "foliage": [
        "#344657", "#3f584b", "#4c6c48", "#5d8447",
        "#72a04b", "#8abb52", "#a8d263", "#d0e47a",
    ],
    "earth": [
        "#483044", "#5a3a42", "#70473f", "#895641",
        "#a96d47", "#c78a52", "#e0ac65", "#f0d082",
    ],
    "water": [
        "#2f3450", "#34465f", "#355e74", "#397b8b",
        "#4397a6", "#5db3bc", "#83ced0", "#b7e5d4",
    ],
    "red": [
        "#522d43", "#71313f", "#93383e", "#b9483f",
        "#d65e42", "#eb794a", "#f49a56", "#f7c56a",
    ],
    "gold": [
        "#5b423c", "#7a5a3b", "#9a783b", "#b9983f",
        "#d5b747", "#e8d255", "#f5e678", "#fff0a3",
    ],
    "violet": [
        "#423047", "#573750", "#70405c", "#8e4b6c",
        "#ae5d7d", "#cf7895", "#e9a0ad", "#f5c8bd",
    ],
    "neutral": [
        "#32303e", "#464754", "#5c5f69", "#777b7e",
        "#969991", "#b5b5a4", "#d4cfb5", "#eee3c8",
        "#fff4d8",
    ],
    "sky": ["#385878", "#4d78a0", "#6b9fc1", "#94c6db", "#c7e7e5"],
}


def rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


MASTER_HEX = list(dict.fromkeys(c for family in PALETTE_FAMILIES.values() for c in family))
MASTER_RGB = np.asarray([rgb(c) for c in MASTER_HEX], dtype=np.float32)
MASTER_PACKED = np.asarray(
    [(r << 16) | (g << 8) | b for r, g, b in MASTER_RGB.astype(np.int32)],
    dtype=np.int32,
)


RUNTIME_SHEETS = [
    "assets/generated/v4/crops-48.png",
    "assets/generated/v4/miri-walk-48x64.png",
    "assets/generated/v4/miri-actions-48x64.png",
    "assets/generated/v4/animals-48.png",
    "assets/generated/v4/buildings.png",
    "assets/generated/v4/structures-nature.png",
    "assets/generated/v4/max-walk-48x64.png",
    "assets/generated/v4/max-actions-48x64.png",
    "assets/generated/v4/npcs-48x64.png",
    "assets/generated/v4/animal-care-props-64.png",
    "assets/generated/v4/animal-products-quality-32.png",
    "assets/generated/v4/animal-care-vfx-32.png",
    "assets/generated/v4/animal-status-icons-32.png",
    "assets/generated/v4/animals-care-48.png",
    "assets/generated/v4/crops2-48.png",
    "assets/generated/v4/crops3-48.png",
    "assets/generated/v4/crops4-48.png",
    "assets/generated/v4/animals-duck-48.png",
    "assets/generated/v4/duck-egg-quality-32.png",
    "assets/generated/v3/props-stations.png",
    "assets/generated/v3/action-vfx-32.png",
]


# Terrain-specific ramps are all drawn from the shared palette.
OUTLINE = list(map(rgb, PALETTE_FAMILIES["outline"]))
GRASS = list(map(rgb, PALETTE_FAMILIES["foliage"]))
EARTH = list(map(rgb, PALETTE_FAMILIES["earth"]))
WATER = list(map(rgb, PALETTE_FAMILIES["water"]))
NEUTRAL = list(map(rgb, PALETTE_FAMILIES["neutral"]))
GOLD = list(map(rgb, PALETTE_FAMILIES["gold"]))
RED = list(map(rgb, PALETTE_FAMILIES["red"]))
VIOLET = list(map(rgb, PALETTE_FAMILIES["violet"]))

BAYER_4 = (
    (0, 8, 2, 10),
    (12, 4, 14, 6),
    (3, 11, 1, 9),
    (15, 7, 13, 5),
)


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    names = ["arialbd.ttf" if bold else "arial.ttf", "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"]
    for name in names:
        for base in (Path("C:/Windows/Fonts"), Path("/usr/share/fonts/truetype/dejavu")):
            path = base / name
            if path.exists():
                return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def tile_image(fill: tuple[int, int, int] | None = None) -> Image.Image:
    if fill is None:
        return Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    return Image.new("RGBA", (32, 32), (*fill, 255))


def pixel(img: Image.Image, x: int, y: int, colour: tuple[int, int, int], alpha: int = 255) -> None:
    if 0 <= x < 32 and 0 <= y < 32:
        img.putpixel((x, y), (*colour, alpha))


def rect(
    img: Image.Image,
    xy: tuple[int, int, int, int],
    colour: tuple[int, int, int],
    alpha: int = 255,
) -> None:
    ImageDraw.Draw(img).rectangle(xy, fill=(*colour, alpha))


def low_frequency_dither(
    img: Image.Image,
    base: tuple[int, int, int],
    shadow: tuple[int, int, int],
    light: tuple[int, int, int],
    seed: int,
) -> None:
    """Ordered 4x4 dither only inside selected broad 8px patches."""
    rng = random.Random(seed)
    patches: list[tuple[int, int, int, tuple[int, int, int]]] = []
    for _ in range(3):
        patches.append((rng.randrange(2, 25), rng.randrange(2, 25), rng.choice((4, 5, 7)), rng.choice((shadow, light))))
    for y in range(32):
        for x in range(32):
            chosen = base
            for px0, py0, radius, colour in patches:
                distance = abs(x - px0) + abs(y - py0)
                if distance <= radius:
                    limit = max(1, min(6, radius - distance + 1))
                    if BAYER_4[y & 3][x & 3] < limit:
                        chosen = colour
                    break
            img.putpixel((x, y), (*chosen, 255))


def grass_tile(seed: int, detail: str = "normal") -> Image.Image:
    img = tile_image(GRASS[4])
    low_frequency_dither(img, GRASS[4], GRASS[3], GRASS[5], seed)
    rng = random.Random(seed * 7919)
    count = {"normal": 8, "flower": 9, "clump": 18}.get(detail, 8)
    for _ in range(count):
        x = rng.randrange(2, 30)
        y = rng.randrange(3, 30)
        height = rng.choice((2, 3, 3, 4))
        pixel(img, x, y, GRASS[2])
        pixel(img, x, y - 1, GRASS[5])
        if height >= 3:
            pixel(img, x + (1 if rng.random() > 0.5 else -1), y - 2, GRASS[6])
        if detail == "clump" and height >= 4:
            pixel(img, x, y - 3, GRASS[7])
    return img


def add_flowers(img: Image.Image, seed: int, white: bool = False) -> None:
    rng = random.Random(seed)
    colours = [RED[5], GOLD[6], VIOLET[5], NEUTRAL[8]]
    for _ in range(5 if not white else 7):
        x, y = rng.randrange(4, 28), rng.randrange(5, 27)
        petal = NEUTRAL[8] if white else rng.choice(colours)
        pixel(img, x, y, OUTLINE[1])
        pixel(img, x - 1, y - 1, petal)
        pixel(img, x + 1, y - 1, petal)
        pixel(img, x, y - 2, NEUTRAL[8] if white else petal)
        pixel(img, x, y - 1, GOLD[6])


def path_tile(seed: int) -> Image.Image:
    img = tile_image(EARTH[5])
    low_frequency_dither(img, EARTH[5], EARTH[4], EARTH[6], seed)
    rng = random.Random(seed * 1237)
    for _ in range(12):
        x, y = rng.randrange(1, 31), rng.randrange(1, 31)
        colour = rng.choice((EARTH[3], EARTH[4], EARTH[6], GOLD[3]))
        pixel(img, x, y, colour)
        if rng.random() < 0.28:
            pixel(img, x + 1, y, EARTH[7] if colour == EARTH[6] else EARTH[2])
    for _ in range(3):
        x, y = rng.randrange(4, 27), rng.randrange(4, 27)
        pixel(img, x, y, OUTLINE[2])
        pixel(img, x + 1, y, NEUTRAL[4])
        pixel(img, x, y - 1, NEUTRAL[6])
    return img


def organic_grass_edge(img: Image.Image, sides: list[str], seed: int) -> None:
    for side_index, side in enumerate(sides):
        for q in range(32):
            depth = 3 + ((q * 5 + seed * 3 + side_index * 7) % 4 == 0) + ((q + seed) % 11 == 0)
            for p in range(depth):
                colour = GRASS[4 + ((q + p + seed) & 1)]
                if side == "n": x, y = q, p
                elif side == "s": x, y = q, 31 - p
                elif side == "w": x, y = p, q
                else: x, y = 31 - p, q
                pixel(img, x, y, colour)
            if side == "n": outline_xy, rim_xy = (q, depth), (q, depth - 1)
            elif side == "s": outline_xy, rim_xy = (q, 31 - depth), (q, 32 - depth)
            elif side == "w": outline_xy, rim_xy = (depth, q), (depth - 1, q)
            else: outline_xy, rim_xy = (31 - depth, q), (32 - depth, q)
            pixel(img, *outline_xy, OUTLINE[2])
            if (q + seed) % 3 != 0:
                pixel(img, *rim_xy, GRASS[6])


def soil_tile(seed: int, wet: bool = False) -> Image.Image:
    ramp = [OUTLINE[1], VIOLET[1], EARTH[0], EARTH[2], EARTH[3]] if wet else EARTH
    base = ramp[3] if wet else EARTH[3]
    shadow = ramp[2] if wet else EARTH[2]
    light = ramp[4] if wet else EARTH[4]
    img = tile_image(base)
    low_frequency_dither(img, base, shadow, light, seed)
    rng = random.Random(seed * 3571)
    # Furrows use cool shadows, warm lower rims, broken ends, and no repeated ruler-straight bands.
    for row_index, y0 in enumerate((5, 12, 19, 26)):
        y = y0 + ((seed + row_index) & 1)
        for x in range(2, 30):
            if (x + row_index * 5 + seed) % 9 == 0:
                continue
            pixel(img, x, y, ramp[1] if wet else EARTH[1])
            if (x + seed) % 3 != 0:
                pixel(img, x, y + 1, ramp[4] if wet else EARTH[5])
    for _ in range(13):
        x, y = rng.randrange(2, 30), rng.randrange(2, 30)
        pixel(img, x, y, rng.choice((ramp[1], ramp[2], ramp[4])))
        if rng.random() < 0.3:
            pixel(img, x + 1, y - 1, EARTH[6] if not wet else NEUTRAL[4])
    return img


def water_tile(seed: int) -> Image.Image:
    img = tile_image(WATER[3])
    rng = random.Random(seed * 4567)
    # Low-frequency ordered dither avoids horizontal colour bands on the broad surface.
    for y in range(32):
        for x in range(32):
            wave = math.sin((x + seed * 3) / 7.0) + math.cos((y - seed) / 8.0)
            colour = WATER[3]
            if wave > 0.8 and BAYER_4[y & 3][x & 3] < 5:
                colour = WATER[4]
            elif wave < -0.8 and BAYER_4[y & 3][x & 3] < 4:
                colour = WATER[2]
            pixel(img, x, y, colour)
    for _ in range(9):
        x, y = rng.randrange(2, 26), rng.randrange(2, 30)
        length = rng.randrange(3, 7)
        colour = rng.choice((WATER[1], WATER[5], WATER[6]))
        for dx in range(length):
            if x + dx < 31 and (dx != 1 or length < 5):
                pixel(img, x + dx, y, colour)
        if colour in (WATER[5], WATER[6]) and y > 0:
            pixel(img, x + 1, y - 1, WATER[7])
    return img


def organic_bank(img: Image.Image, sides: list[str], seed: int) -> None:
    for side_index, side in enumerate(sides):
        for q in range(32):
            depth = 4 + ((q * 3 + seed + side_index) % 7 == 0)
            for p in range(depth):
                colour = EARTH[3] if (q + p + seed) % 4 else EARTH[4]
                if side == "n": x, y = q, p
                elif side == "s": x, y = q, 31 - p
                elif side == "w": x, y = p, q
                else: x, y = 31 - p, q
                pixel(img, x, y, colour)
            if side == "n": water_edge, rim = (q, depth), (q, depth - 1)
            elif side == "s": water_edge, rim = (q, 31 - depth), (q, 32 - depth)
            elif side == "w": water_edge, rim = (depth, q), (depth - 1, q)
            else: water_edge, rim = (31 - depth, q), (32 - depth, q)
            pixel(img, *water_edge, OUTLINE[2])
            if (q + seed) % 3:
                pixel(img, *rim, GOLD[3])
        # A sparse grass lip unifies the bank with neighbouring terrain.
        for q in range((seed + side_index) % 4, 32, 7):
            if side == "n": pixel(img, q, 0, GRASS[5])
            elif side == "s": pixel(img, q, 31, GRASS[3])
            elif side == "w": pixel(img, 0, q, GRASS[5])
            else: pixel(img, 31, q, GRASS[3])


def bridge_tile(vertical: bool) -> Image.Image:
    img = tile_image(EARTH[3])
    draw = ImageDraw.Draw(img)
    step = 5
    if vertical:
        for x in range(0, 32, step):
            draw.rectangle((x, 0, min(31, x + step - 1), 31), fill=(*EARTH[4 + ((x // step) & 1)], 255))
            draw.line((x, 0, x, 31), fill=(*OUTLINE[2], 255))
            if x + 1 < 32: draw.line((x + 1, 1, x + 1, 30), fill=(*EARTH[6], 255))
        draw.line((1, 0, 1, 31), fill=(*GOLD[4], 255))
        draw.line((30, 0, 30, 31), fill=(*OUTLINE[1], 255))
        nails = [(5, 4), (25, 9), (10, 25), (20, 18)]
    else:
        for y in range(0, 32, step):
            draw.rectangle((0, y, 31, min(31, y + step - 1)), fill=(*EARTH[4 + ((y // step) & 1)], 255))
            draw.line((0, y, 31, y), fill=(*OUTLINE[2], 255))
            if y + 1 < 32: draw.line((1, y + 1, 30, y + 1), fill=(*EARTH[6], 255))
        draw.line((0, 1, 31, 1), fill=(*GOLD[4], 255))
        draw.line((0, 30, 31, 30), fill=(*OUTLINE[1], 255))
        nails = [(4, 5), (9, 25), (25, 10), (18, 20)]
    for x, y in nails:
        pixel(img, x, y, OUTLINE[0])
        pixel(img, x, y - 1, NEUTRAL[6])
    return img


def overlay_tile(kind: str, seed: int) -> Image.Image:
    img = tile_image()
    rng = random.Random(seed)
    if kind == "flowers":
        for _ in range(6):
            x, y = rng.randrange(4, 28), rng.randrange(5, 27)
            c = rng.choice((RED[5], GOLD[6], VIOLET[5]))
            pixel(img, x, y, OUTLINE[1])
            pixel(img, x - 1, y - 1, c)
            pixel(img, x + 1, y - 1, c)
            pixel(img, x, y - 2, NEUTRAL[8])
            pixel(img, x, y - 1, GOLD[6])
    elif kind == "pebbles":
        for _ in range(5):
            x, y = rng.randrange(4, 27), rng.randrange(4, 27)
            pixel(img, x, y, OUTLINE[1])
            pixel(img, x + 1, y, NEUTRAL[4])
            pixel(img, x + 2, y, NEUTRAL[3])
            pixel(img, x + 1, y - 1, NEUTRAL[6])
            pixel(img, x + 1, y + 1, OUTLINE[2])
    else:
        for x in range(8, 25, 2):
            h = 4 + ((x * 5 + seed) % 7)
            for dy in range(h):
                pixel(img, x + (dy // 4), 27 - dy, GRASS[2 + (dy > h // 2)])
            pixel(img, x, 27 - h, GRASS[7])
    return img


def shadow_tile() -> Image.Image:
    img = tile_image()
    cx, cy = 15.5, 23.0
    for y in range(7, 32):
        for x in range(1, 31):
            d = ((x - cx) / 14.0) ** 2 + ((y - cy) / 7.0) ** 2
            if d >= 1:
                continue
            level = 88 if d < 0.33 else 60 if d < 0.68 else 36
            threshold = 15 if d < 0.68 else 9
            if BAYER_4[y & 3][x & 3] < threshold:
                pixel(img, x, y, OUTLINE[0], level)
    return img


def suffix_sides(frame_name: str) -> list[str]:
    suffix = frame_name.rsplit("_", 1)[-1]
    if suffix == "c":
        return []
    return list(suffix)


def build_terrain_frame(name: str, index: int) -> Image.Image:
    if name.startswith("grass_center"):
        return grass_tile(100 + index)
    if name == "grass_flower_01":
        img = grass_tile(210, "flower"); add_flowers(img, 211); return img
    if name == "grass_flower_02":
        img = grass_tile(220, "flower"); add_flowers(img, 221, white=True); return img
    if name == "grass_clump_01":
        return grass_tile(230, "clump")
    if name.startswith("path_"):
        img = path_tile(300 + index); organic_grass_edge(img, suffix_sides(name), 300 + index); return img
    if name.startswith("soil_dry_"):
        img = soil_tile(400 + index); organic_grass_edge(img, suffix_sides(name), 400 + index); return img
    if name.startswith("soil_wet_"):
        img = soil_tile(500 + index, wet=True); organic_grass_edge(img, suffix_sides(name), 500 + index); return img
    if name.startswith("water_"):
        img = water_tile(600 + index); organic_bank(img, suffix_sides(name), 600 + index); return img
    if name == "bridge_h":
        return bridge_tile(False)
    if name == "bridge_v":
        return bridge_tile(True)
    if name == "overlay_flowers_01":
        return overlay_tile("flowers", 701)
    if name == "overlay_pebbles_01":
        return overlay_tile("pebbles", 702)
    if name == "overlay_grass_clump_01":
        return overlay_tile("clump", 703)
    if name == "shadow_soft":
        return shadow_tile()
    raise KeyError(f"Unhandled terrain frame: {name}")


def rebuild_terrain() -> None:
    data = json.loads(TERRAIN_MAP.read_text(encoding="utf-8"))
    atlas = Image.new("RGBA", (data["meta"]["w"], data["meta"]["h"]), (0, 0, 0, 0))
    for index, (name, frame) in enumerate(data["frames"].items()):
        tile = build_terrain_frame(name, index)
        assert tile.size == (frame["w"], frame["h"]) == (32, 32)
        atlas.alpha_composite(tile, (frame["x"], frame["y"]))
    atlas.save(TERRAIN, optimize=True)
    shutil.copy2(TERRAIN, EVIDENCE / "terrain-after-atlas.png")


def grade_to_master_palette(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    array = np.asarray(image, dtype=np.uint8).copy()
    source_rgb = array[:, :, :3]
    alpha = array[:, :, 3]
    opaque = alpha > 0
    if not np.any(opaque):
        return

    packed = (
        (source_rgb[:, :, 0].astype(np.int32) << 16)
        | (source_rgb[:, :, 1].astype(np.int32) << 8)
        | source_rgb[:, :, 2].astype(np.int32)
    )
    exact_master = np.isin(packed, MASTER_PACKED) & opaque
    graded = source_rgb.astype(np.float32)
    luma = graded[:, :, 0] * 0.2126 + graded[:, :, 1] * 0.7152 + graded[:, :, 2] * 0.0722

    shadow = opaque & (luma < 92) & ~exact_master
    graded[shadow, 0] = graded[shadow, 0] * 0.92 + 7
    graded[shadow, 1] = graded[shadow, 1] * 0.86 + 2
    graded[shadow, 2] = graded[shadow, 2] * 0.95 + 12
    highlight = opaque & (luma > 172) & ~exact_master
    graded[highlight, 0] = graded[highlight, 0] * 1.02 + 8
    graded[highlight, 1] = graded[highlight, 1] * 1.00 + 5
    graded[highlight, 2] = graded[highlight, 2] * 0.92

    transparent = alpha == 0
    transparent_up = np.zeros_like(transparent); transparent_up[1:, :] = transparent[:-1, :]
    transparent_left = np.zeros_like(transparent); transparent_left[:, 1:] = transparent[:, :-1]
    transparent_down = np.zeros_like(transparent); transparent_down[:-1, :] = transparent[1:, :]
    transparent_right = np.zeros_like(transparent); transparent_right[:, :-1] = transparent[:, 1:]
    warm_rim = opaque & (transparent_up | transparent_left) & (luma > 72) & ~exact_master
    cool_outline = opaque & (transparent_down | transparent_right) & (luma < 182) & ~exact_master
    graded[warm_rim, 0] += 12; graded[warm_rim, 1] += 7; graded[warm_rim, 2] -= 3
    graded[cool_outline, 0] = graded[cool_outline, 0] * 0.79 + 4
    graded[cool_outline, 1] = graded[cool_outline, 1] * 0.73 + 2
    graded[cool_outline, 2] = graded[cool_outline, 2] * 0.86 + 10
    graded = np.clip(graded, 0, 255).astype(np.uint8)

    values = graded[opaque]
    unique, inverse = np.unique(values, axis=0, return_inverse=True)
    # Perceptual-ish distance: green contributes more to perceived value, and
    # the cool/warm family distinction remains visible after quantisation.
    delta = unique[:, None, :].astype(np.float32) - MASTER_RGB[None, :, :]
    distance = delta[:, :, 0] ** 2 * 0.30 + delta[:, :, 1] ** 2 * 0.52 + delta[:, :, 2] ** 2 * 0.24
    nearest = MASTER_RGB[np.argmin(distance, axis=1)].astype(np.uint8)
    array[:, :, :3][opaque] = nearest[inverse]
    array[:, :, :3][~opaque] = 0
    Image.fromarray(array, "RGBA").save(path, optimize=True)


def backup_and_grade_runtime() -> None:
    BACKUP.mkdir(parents=True, exist_ok=True)
    for relative in RUNTIME_SHEETS:
        path = ROOT / relative
        backup = BACKUP / relative
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            shutil.copy2(path, backup)
        grade_to_master_palette(path)


def terrain_comparison() -> None:
    before = Image.open(EVIDENCE / "terrain-before-atlas.png").convert("RGBA").crop((0, 0, 512, 128))
    after = Image.open(EVIDENCE / "terrain-after-atlas.png").convert("RGBA").crop((0, 0, 512, 128))
    scale = 2
    before = before.resize((before.width * scale, before.height * scale), Image.Resampling.NEAREST)
    after = after.resize((after.width * scale, after.height * scale), Image.Resampling.NEAREST)
    margin, gap, header = 32, 32, 82
    canvas = Image.new("RGB", (margin * 2 + before.width + after.width + gap, header + before.height + margin), "#171322")
    draw = ImageDraw.Draw(canvas)
    draw.text((margin, 14), "TERRAIN BEFORE", font=font(28, True), fill="#f5e678")
    draw.text((margin + before.width + gap, 14), "TERRAIN AFTER — R62", font=font(28, True), fill="#d0e47a")
    draw.text((margin, 50), "Flat blocks / repeated seams", font=font(17), fill="#b5b5a4")
    draw.text((margin + before.width + gap, 50), "4-step ramps / ordered dither / organic rims", font=font(17), fill="#b7e5d4")
    checker = Image.new("RGB", before.size, "#282235")
    cdraw = ImageDraw.Draw(checker)
    for y in range(0, checker.height, 16):
        for x in range(0, checker.width, 16):
            if (x // 16 + y // 16) & 1:
                cdraw.rectangle((x, y, x + 15, y + 15), fill="#342b43")
    canvas.paste(checker, (margin, header)); canvas.paste(before, (margin, header), before)
    x2 = margin + before.width + gap
    canvas.paste(checker, (x2, header)); canvas.paste(after, (x2, header), after)
    canvas.save(EVIDENCE / "terrain-before-after.png", optimize=True)


def fit_preview(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    copy = image.convert("RGBA")
    copy.thumbnail(size, Image.Resampling.NEAREST)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.alpha_composite(copy, ((size[0] - copy.width) // 2, (size[1] - copy.height) // 2))
    return out


def asset_comparison() -> None:
    samples = [
        ("BUILDING", "assets/generated/v4/buildings.png", (0, 0, 256, 256)),
        ("CROPS", "assets/generated/v4/crops-48.png", (0, 0, 240, 288)),
        ("ANIMALS", "assets/generated/v4/animals-48.png", (0, 0, 192, 192)),
        ("UI ICONS", "assets/generated/v4/animal-status-icons-32.png", (0, 0, 128, 128)),
    ]
    panel = (272, 224)
    margin, label_w, gap, header = 24, 124, 18, 70
    width = margin * 2 + label_w + panel[0] * 2 + gap
    height = header + len(samples) * (panel[1] + gap) + margin
    canvas = Image.new("RGB", (width, height), "#171322")
    draw = ImageDraw.Draw(canvas)
    draw.text((margin + label_w, 15), "BEFORE", font=font(28, True), fill="#e0ac65")
    draw.text((margin + label_w + panel[0] + gap, 15), "AFTER — R62 PALETTE", font=font(25, True), fill="#a8d263")
    for row, (label, relative, box) in enumerate(samples):
        y = header + row * (panel[1] + gap)
        before = Image.open(BACKUP / relative).convert("RGBA").crop(box)
        after = Image.open(ROOT / relative).convert("RGBA").crop(box)
        before = fit_preview(before, panel); after = fit_preview(after, panel)
        draw.text((margin, y + panel[1] // 2 - 12), label, font=font(18, True), fill="#eee3c8")
        for x in (margin + label_w, margin + label_w + panel[0] + gap):
            draw.rounded_rectangle((x, y, x + panel[0] - 1, y + panel[1] - 1), radius=8, fill="#2b2437", outline="#5b4758", width=1)
        canvas.paste(before, (margin + label_w, y), before)
        canvas.paste(after, (margin + label_w + panel[0] + gap, y), after)
    canvas.save(EVIDENCE / "assets-before-after.png", optimize=True)


def palette_evidence() -> None:
    block_w, block_h, label_w = 88, 46, 118
    rows = list(PALETTE_FAMILIES.items())
    max_colours = max(len(colours) for _, colours in rows)
    canvas = Image.new("RGB", (label_w + max_colours * block_w + 24, 54 + len(rows) * block_h + 22), "#171322")
    draw = ImageDraw.Draw(canvas)
    draw.text((18, 12), f"R62 SHARED PALETTE — {len(MASTER_HEX)} COLOURS", font=font(24, True), fill="#fff0a3")
    for row, (name, colours) in enumerate(rows):
        y = 54 + row * block_h
        draw.text((16, y + 13), name.upper(), font=font(14, True), fill="#eee3c8")
        for col, colour in enumerate(colours):
            x = label_w + col * block_w
            draw.rectangle((x, y, x + block_w - 3, y + block_h - 4), fill=colour)
            r, g, b = rgb(colour)
            ink = "#171322" if r * 0.3 + g * 0.59 + b * 0.11 > 150 else "#fff4d8"
            draw.text((x + 9, y + 14), colour.upper(), font=font(12, True), fill=ink)
    canvas.save(EVIDENCE / "palette-r62.png", optimize=True)


def overall_comparison() -> None:
    before_path = EVIDENCE / "overall-before.png"
    after_path = EVIDENCE / "overall-after.png"
    if not before_path.exists() or not after_path.exists():
        return
    before = Image.open(before_path).convert("RGB")
    after = Image.open(after_path).convert("RGB")
    if after.size != before.size:
        after = after.resize(before.size, Image.Resampling.LANCZOS)
    margin, gap, header = 24, 24, 68
    canvas = Image.new("RGB", (margin * 2 + before.width * 2 + gap, header + before.height + margin), "#171322")
    draw = ImageDraw.Draw(canvas)
    draw.text((margin, 17), "OVERALL BEFORE — R61", font=font(27, True), fill="#e0ac65")
    draw.text((margin + before.width + gap, 17), "OVERALL AFTER — R62 POLISH", font=font(27, True), fill="#a8d263")
    canvas.paste(before, (margin, header))
    canvas.paste(after, (margin + before.width + gap, header))
    canvas.save(EVIDENCE / "overall-before-after.png", optimize=True)


def assert_layout_invariants() -> None:
    palette_set = {tuple(int(v) for v in colour) for colour in MASTER_RGB}
    for relative in ["assets/generated/v4/terrain-organic-32.png", *RUNTIME_SHEETS]:
        current = Image.open(ROOT / relative).convert("RGBA")
        if relative == "assets/generated/v4/terrain-organic-32.png":
            data = json.loads(TERRAIN_MAP.read_text(encoding="utf-8"))
            expected = (data["meta"]["w"], data["meta"]["h"])
        else:
            before = Image.open(BACKUP / relative).convert("RGBA")
            expected = before.size
            if not np.array_equal(np.asarray(current)[:, :, 3], np.asarray(before)[:, :, 3]):
                raise AssertionError(f"Alpha coverage changed for {relative}")
        if current.size != expected:
            raise AssertionError(f"Atlas size changed for {relative}: {current.size} != {expected}")
        current_array = np.asarray(current)
        used = {
            tuple(int(v) for v in colour)
            for colour in np.unique(current_array[current_array[:, :, 3] > 0, :3], axis=0)
        }
        outside = used - palette_set
        if outside:
            raise AssertionError(f"Colours outside the R62 palette in {relative}: {sorted(outside)[:4]}")


def main() -> None:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    if not (EVIDENCE / "terrain-before-atlas.png").exists():
        shutil.copy2(TERRAIN, EVIDENCE / "terrain-before-atlas.png")
    backup_and_grade_runtime()
    rebuild_terrain()
    assert_layout_invariants()
    terrain_comparison()
    asset_comparison()
    palette_evidence()
    overall_comparison()
    print(f"R62 polish complete: terrain rebuilt, {len(RUNTIME_SHEETS)} runtime sheets palette-graded.")
    print(f"Shared palette: {len(MASTER_HEX)} colours; evidence: {EVIDENCE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
