"""R68 deterministic visual pipeline and provenance gate.

The five inputs are immutable built-in imagegen masters. This script verifies the
embedded C2PA softwareAgent, then creates fixed-palette pixel-art runtime tiers,
evidence boards, hashes, contrast measurements, and manifests.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import statistics
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, __version__ as PILLOW_VERSION


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs" / "evidence" / "R68"
MASTERS = EVIDENCE / "masters"
OUT = ROOT / "assets" / "generated" / "r68"
GENERATED_AT = "2026-07-17T00:00:00Z"

PALETTE = [
    "#251D35", "#352941", "#49364B", "#5B4758",
    "#344657", "#3F584B", "#4C6C48", "#5D8447", "#72A04B", "#8ABB52", "#A8D263", "#D0E47A",
    "#483044", "#5A3A42", "#70473F", "#895641", "#A96D47", "#C78A52", "#E0AC65", "#F0D082",
    "#2F3450", "#34465F", "#355E74", "#397B8B", "#4397A6", "#5DB3BC", "#83CED0", "#B7E5D4",
    "#522D43", "#71313F", "#93383E", "#B9483F", "#D65E42", "#EB794A", "#F49A56", "#F7C56A",
    "#5B423C", "#7A5A3B", "#9A783B", "#B9983F", "#D5B747", "#E8D255", "#F5E678", "#FFF0A3",
    "#423047", "#573750", "#70405C", "#8E4B6C", "#AE5D7D", "#CE7895", "#E9A0AD", "#F5C8BD",
    "#32303E", "#464754", "#5C5F69", "#777B7E", "#969991", "#B5B5A4", "#D4CFB5", "#EEE3C8", "#FFF4D8",
    "#385878", "#4D78A0", "#6B9FC1", "#94C6DB", "#C7E7E5",
]
assert len(PALETTE) == 66

MASTER_SPECS = {
    "loading-spring": {"file": "loading-spring-master.png", "shadow": "#49364B", "kind": "loading", "prompt": "loading-spring"},
    "loading-summer": {"file": "loading-summer-master.png", "shadow": "#2F3450", "kind": "loading", "prompt": "loading-summer"},
    "loading-autumn": {"file": "loading-autumn-master.png", "shadow": "#573750", "kind": "loading", "prompt": "loading-autumn"},
    "loading-winter": {"file": "loading-winter-master.png", "shadow": "#423047", "kind": "loading", "prompt": "loading-winter"},
    "activity-panel": {"file": "activity-panel-master.png", "shadow": "#49364B", "kind": "panel", "prompt": "activity-panel"},
}
LOADING_TIERS = {"low": (256, 256), "med": (384, 384), "high": (512, 512)}
PANEL_TIERS = {"low": (320, 160), "med": (512, 256), "high": (768, 384)}
REFERENCE_FILES = [
    ROOT / "docs" / "evidence" / "R62_polish" / "overall-after.png",
    ROOT / "assets" / "generated" / "v4" / "terrain-organic-32.png",
    ROOT / "assets" / "generated" / "r66" / "ui-icons-32.png",
    ROOT / "docs" / "evidence" / "R62_polish" / "palette-r62.png",
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def flat_pixels(image: Image.Image):
    getter = getattr(image, "get_flattened_data", None)
    return getter() if getter else image.getdata()


def verify_c2pa(path: Path) -> dict:
    data = path.read_bytes()
    marker = data.find(b"softwareAgent")
    if marker < 0:
        raise RuntimeError(f"{path.name}: C2PA softwareAgent missing")
    segment = data[marker:marker + 256]
    if b"gpt-image" not in segment:
        raise RuntimeError(f"{path.name}: softwareAgent is not gpt-image")
    version_match = re.search(rb"version.{0,4}([0-9]+\.[0-9]+)", segment, re.DOTALL)
    if not version_match:
        raise RuntimeError(f"{path.name}: softwareAgent version missing")
    version = version_match.group(1).decode("ascii")
    if not version.startswith("2."):
        raise RuntimeError(f"{path.name}: expected gpt-image 2.x, got {version}")
    return {
        "pass": True,
        "softwareAgent": {"name": "gpt-image", "version": version, "display": f"gpt-image {version}"},
        "markerOffset": marker,
        "c2paActionsV2Present": b"c2pa.actions.v2" in data,
        "trainedAlgorithmicMediaPresent": b"trainedAlgorithmicMedia" in data,
    }


def palette_image() -> Image.Image:
    image = Image.new("P", (1, 1))
    values = [channel for color in PALETTE for channel in hex_rgb(color)]
    # Pillow requires 256 palette slots. Repeat an in-palette outline colour so
    # unused indices can never introduce synthetic black into a runtime image.
    values.extend(list(hex_rgb(PALETTE[0])) * (256 - len(PALETTE)))
    image.putpalette(values)
    return image


def shadow_tint(image: Image.Image, tint_hex: str, strength: float = 0.22) -> Image.Image:
    image = image.convert("RGB")
    tint = hex_rgb(tint_hex)
    pixels = list(flat_pixels(image))
    out = []
    for r, g, b in pixels:
        luma = (54 * r + 183 * g + 19 * b) / 256
        amount = max(0.0, min(1.0, (132 - luma) / 132)) * strength
        out.append((
            round(r * (1 - amount) + tint[0] * amount),
            round(g * (1 - amount) + tint[1] * amount),
            round(b * (1 - amount) + tint[2] * amount),
        ))
    tinted = Image.new("RGB", image.size)
    tinted.putdata(out)
    return tinted


def normalize_panel_text_zone(image: Image.Image) -> Image.Image:
    """Lock the actual text zone to a pale multi-value parchment ramp."""
    image = image.convert("RGB")
    x0, y0 = round(image.width * 0.075), round(image.height * 0.17)
    x1, y1 = round(image.width * 0.755), round(image.height * 0.84)
    region = image.crop((x0, y0, x1, y1))
    cream = Image.new("RGB", region.size, hex_rgb("#FFF4D8"))
    region = Image.blend(region, cream, 0.82)
    image.paste(region, (x0, y0))
    return image


def resize_source(master: Image.Image, kind: str, size: tuple[int, int]) -> Image.Image:
    master = master.convert("RGB")
    if kind == "panel":
        # Deterministic crop removes only the generated green safety margin.
        w, h = master.size
        master = master.crop((round(w * 0.02), round(h * 0.12), round(w * 0.98), round(h * 0.88)))
    return master.resize(size, Image.Resampling.BOX)


def dither_mask(size: tuple[int, int], kind: str) -> Image.Image:
    w, h = size
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    if kind == "loading":
        # Sky/distant foliage only, plus thin outer atmosphere strips.
        draw.rectangle((0, 0, w - 1, round(h * 0.34)), fill=255)
        draw.rectangle((0, round(h * 0.34), round(w * 0.08), round(h * 0.64)), fill=255)
        draw.rectangle((round(w * 0.92), round(h * 0.34), w - 1, round(h * 0.64)), fill=255)
    else:
        border_x, border_y = round(w * 0.075), round(h * 0.16)
        draw.rectangle((0, 0, w - 1, border_y), fill=255)
        draw.rectangle((0, h - border_y, w - 1, h - 1), fill=255)
        draw.rectangle((0, border_y, border_x, h - border_y), fill=255)
        draw.rectangle((w - border_x, border_y, w - 1, h - border_y), fill=255)
    return mask


def fixed_palette_pixelize(image: Image.Image, kind: str) -> Image.Image:
    pal = palette_image()
    plain = image.quantize(palette=pal, dither=Image.Dither.NONE).convert("RGB")
    dithered = image.quantize(palette=pal, dither=Image.Dither.FLOYDSTEINBERG).convert("RGB")
    return Image.composite(dithered, plain, dither_mask(image.size, kind))


def srgb_luminance(rgb: tuple[int, int, int]) -> float:
    values = []
    for channel in rgb:
        value = channel / 255
        values.append(value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4)
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]


def contrast_ratio(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    la, lb = srgb_luminance(a), srgb_luminance(b)
    light, dark = max(la, lb), min(la, lb)
    return (light + 0.05) / (dark + 0.05)


def runtime_metrics(path: Path, kind: str) -> dict:
    image = Image.open(path).convert("RGB")
    colours = image.getcolors(maxcolors=image.width * image.height) or []
    palette_set = {hex_rgb(value) for value in PALETTE}
    used = {color for _, color in colours}
    outline_colours = {hex_rgb(value) for value in ("#251D35", "#352941", "#49364B", "#32303E")}
    luma_steps = {round(srgb_luminance(color), 3) for color in used}
    metrics = {
        "width": image.width,
        "height": image.height,
        "decodedBytesRGBA": image.width * image.height * 4,
        "fileBytes": path.stat().st_size,
        "uniqueColours": len(used),
        "outOfPalettePixels": sum(count for count, color in colours if color not in palette_set),
        "luminanceSteps": len(luma_steps),
        "outlinePixels": sum(count for count, color in colours if color in outline_colours),
    }
    if kind == "panel":
        x0, y0 = round(image.width * 0.075), round(image.height * 0.17)
        x1, y1 = round(image.width * 0.755), round(image.height * 0.84)
        backgrounds = set(flat_pixels(image.crop((x0, y0, x1, y1))))
        luminances = [srgb_luminance(pixel) for pixel in flat_pixels(image.crop((x0, y0, x1, y1)))]
        noise_stddev = statistics.pstdev(luminances)
        text_colours = {"title": hex_rgb("#4B3512"), "body": hex_rgb("#3A2C1A"), "meta": hex_rgb("#49364B")}
        ratios = {name: min(contrast_ratio(text, bg) for bg in backgrounds) for name, text in text_colours.items()}
        metrics["textZone"] = {
            "normalizedBox": [0.075, 0.17, 0.755, 0.84],
            "minimumContrast": ratios,
            "pass45": all(v >= 4.5 for v in ratios.values()),
            "luminanceStdDev": noise_stddev,
            "readabilityNoiseLimit": 0.12,
            "readabilityNoisePass": noise_stddev <= 0.12,
        }
    return metrics


def loading_copy_contrast(path: Path) -> dict:
    image = Image.open(path).convert("RGB")
    overlay = hex_rgb("#251D35")
    composite_backgrounds = set()
    for pixel in flat_pixels(image):
        composite_backgrounds.add(tuple(round(overlay[i] * 0.94 + pixel[i] * 0.06) for i in range(3)))
    ratios = {
        "title": min(contrast_ratio(hex_rgb("#FFF0A3"), bg) for bg in composite_backgrounds),
        "body": min(contrast_ratio(hex_rgb("#FFF4D8"), bg) for bg in composite_backgrounds),
    }
    return {"overlay": "#251D35 at 94%", "minimumContrast": ratios, "pass45": all(value >= 4.5 for value in ratios.values())}


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True, compress_level=9)


def font(size: int) -> ImageFont.ImageFont:
    candidates = [Path("C:/Windows/Fonts/segoeuib.ttf"), Path("C:/Windows/Fonts/msjhbd.ttc")]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def evidence_boards(runtime: dict) -> None:
    board = Image.new("RGB", (1600, 940), hex_rgb("#251D35"))
    draw = ImageDraw.Draw(board)
    draw.text((36, 24), "R68 SUNRISE FARM VISUAL SYSTEM", fill=hex_rgb("#FFF0A3"), font=font(34))
    draw.text((36, 70), "gpt-image-2 masters -> deterministic 66-colour pixel pipeline", fill=hex_rgb("#EEE3C8"), font=font(20))
    seasons = ["spring", "summer", "autumn", "winter"]
    labels = ["SPRING", "SUMMER", "AUTUMN", "WINTER"]
    for index, (season, label) in enumerate(zip(seasons, labels)):
        image = Image.open(OUT / f"loading-{season}-high.png").convert("RGB").resize((336, 336), Image.Resampling.NEAREST)
        x = 36 + index * 382
        board.paste(image, (x, 122))
        draw.text((x, 470), label, fill=hex_rgb("#FFF4D8"), font=font(22))
    panel = Image.open(OUT / "activity-panel-high.png").convert("RGB").resize((960, 480), Image.Resampling.NEAREST)
    board.paste(panel, (36, 520))
    swatch_x, swatch_y, swatch = 1040, 535, 52
    for index, value in enumerate(PALETTE):
        x = swatch_x + (index % 11) * swatch
        y = swatch_y + (index // 11) * swatch
        draw.rectangle((x, y, x + swatch - 3, y + swatch - 3), fill=hex_rgb(value))
    draw.text((1040, 864), "66-COLOUR SHARED PALETTE", fill=hex_rgb("#FFF4D8"), font=font(18))
    save_png(board, EVIDENCE / "style-board.png")

    palette_board = Image.new("RGB", (11 * 72, 6 * 72 + 54), hex_rgb("#251D35"))
    palette_draw = ImageDraw.Draw(palette_board)
    palette_draw.text((14, 12), "R68 / R62 SHARED PALETTE - 66 COLOURS", fill=hex_rgb("#FFF0A3"), font=font(18))
    for index, value in enumerate(PALETTE):
        x = (index % 11) * 72
        y = 54 + (index // 11) * 72
        palette_draw.rectangle((x, y, x + 71, y + 71), fill=hex_rgb(value))
    save_png(palette_board, EVIDENCE / "palette-r68.png")

    quality = Image.new("RGB", (1536, 570), hex_rgb("#251D35"))
    quality_draw = ImageDraw.Draw(quality)
    quality_draw.text((24, 16), "SPRING LOADING / LOW - MED - HIGH", fill=hex_rgb("#FFF0A3"), font=font(26))
    for index, tier in enumerate(("low", "med", "high")):
        item = Image.open(OUT / f"loading-spring-{tier}.png").convert("RGB").resize((480, 480), Image.Resampling.NEAREST)
        x = 24 + index * 504
        quality.paste(item, (x, 66))
        quality_draw.text((x + 8, 510), f"{tier.upper()} / REAL GENERATED ASSET", fill=hex_rgb("#FFF4D8"), font=font(18))
    save_png(quality, EVIDENCE / "quality-low-med-high.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    prompt_file = EVIDENCE / "prompts.json"
    if not prompt_file.exists():
        raise RuntimeError("docs/evidence/R68/prompts.json is required")
    prompts = json.loads(prompt_file.read_text(encoding="utf-8"))

    c2pa = {"release": "R68", "verifier": "tools/process-r68-visuals.py", "assets": {}}
    source_assets = {}
    runtime_assets = {}
    decoded_total = 0
    for asset_id, spec in MASTER_SPECS.items():
        master_path = MASTERS / spec["file"]
        if not master_path.exists():
            raise RuntimeError(f"missing master: {master_path}")
        verification = verify_c2pa(master_path)
        master_hash = sha256(master_path)
        c2pa["assets"][asset_id] = {"file": master_path.relative_to(ROOT).as_posix(), "sha256": master_hash, **verification}
        source_assets[asset_id] = {
            "modelSlug": "gpt-image-2",
            "generationMode": "Codex built-in imagegen",
            "promptId": spec["prompt"],
            "prompt": prompts[spec["prompt"]],
            "master": master_path.relative_to(ROOT).as_posix(),
            "masterSha256": master_hash,
            "c2pa": verification,
        }

        master = Image.open(master_path).convert("RGB")
        tiers = LOADING_TIERS if spec["kind"] == "loading" else PANEL_TIERS
        asset_runtime = {}
        for tier, size in tiers.items():
            image = resize_source(master, spec["kind"], size)
            image = shadow_tint(image, spec["shadow"])
            if spec["kind"] == "panel":
                image = normalize_panel_text_zone(image)
            image = fixed_palette_pixelize(image, spec["kind"])
            path = OUT / f"{asset_id}-{tier}.png"
            save_png(image, path)
            metrics = runtime_metrics(path, spec["kind"])
            if metrics["outOfPalettePixels"] != 0 or metrics["luminanceSteps"] < 6 or metrics["outlinePixels"] < 16:
                raise RuntimeError(f"{path.name}: pixel-style gate failed: {metrics}")
            if spec["kind"] == "panel" and (not metrics["textZone"]["pass45"] or not metrics["textZone"]["readabilityNoisePass"]):
                raise RuntimeError(f"{path.name}: contrast gate failed: {metrics['textZone']}")
            decoded_total += metrics["decodedBytesRGBA"]
            asset_runtime[tier] = {
                "file": path.relative_to(ROOT).as_posix(),
                "sha256": sha256(path),
                "contentHashQuery": sha256(path)[:8],
                "metrics": metrics,
            }
        runtime_assets[asset_id] = asset_runtime

    c2pa["pass"] = all(item["pass"] for item in c2pa["assets"].values())
    (EVIDENCE / "c2pa-verification.json").write_text(json.dumps(c2pa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    references = [{"file": path.relative_to(ROOT).as_posix(), "sha256": sha256(path)} for path in REFERENCE_FILES]
    source_manifest = {
        "release": "R68",
        "generatedAt": GENERATED_AT,
        "actualModel": "gpt-image-2",
        "references": references,
        "assets": source_assets,
    }
    (EVIDENCE / "source-manifest.json").write_text(json.dumps(source_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    runtime_manifest = {
        "release": "R68",
        "version": "r68-20260717-1",
        "modelSlug": "gpt-image-2",
        "palette": PALETTE,
        "referenceHashes": references,
        "pipeline": {
            "tool": "tools/process-r68-visuals.py",
            "pillowVersion": PILLOW_VERSION,
            "steps": [
                "verify embedded C2PA softwareAgent name=gpt-image and version=2.x",
                "BOX resize to fixed low/med/high native pixel grids",
                "hue-shift shadows toward the per-season violet/blue shadow ramp at <=22%",
                "normalize activity-panel text zone with 82% #FFF4D8 blend",
                "quantize to the fixed R62 66-colour palette without global dithering",
                "apply Floyd-Steinberg dithering only to declared sky/distant-foliage or panel-border masks",
                "write optimized PNG deterministically and calculate SHA-256",
            ],
            "selectiveDitherMasks": {
                "loading": "top 34% sky plus outer 8% atmosphere strips through 64% height",
                "activityPanel": "outer 7.5% x / 16% y border only",
            },
            "focalBoxNormalized": [0.35, 0.32, 0.65, 0.68],
            "safeAreaViewportInset": 0.08,
        },
        "assets": runtime_assets,
        "decodedTextureBytesAllTiers": decoded_total,
        "decodedTextureMiBAllTiers": round(decoded_total / 1024 / 1024, 3),
        "budgetDesktopMiB": 64,
        "budgetMobileMiB": 32,
        "budgetPass": decoded_total <= 32 * 1024 * 1024,
    }
    (OUT / "manifest.json").write_text(json.dumps(runtime_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    memory = {
        "formula": "width x height x 4 bytes RGBA",
        "assets": {asset: {tier: data["metrics"]["decodedBytesRGBA"] for tier, data in tiers.items()} for asset, tiers in runtime_assets.items()},
        "allTiersBytes": decoded_total,
        "allTiersMiB": round(decoded_total / 1024 / 1024, 3),
        "desktopBudgetMiB": 64,
        "mobileBudgetMiB": 32,
        "pass": decoded_total <= 32 * 1024 * 1024,
    }
    (EVIDENCE / "texture-memory.json").write_text(json.dumps(memory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    contrast = {
        "release": "R68",
        "threshold": 4.5,
        "sampling": "Every runtime background pixel in normalized text zone [0.075, 0.17, 0.755, 0.84] against intended title/body/meta colours.",
        "tiers": {tier: data["metrics"]["textZone"] for tier, data in runtime_assets["activity-panel"].items()},
        "loadingCopy": {
            asset: {tier: loading_copy_contrast(ROOT / data["file"]) for tier, data in tiers.items()}
            for asset, tiers in runtime_assets.items() if asset.startswith("loading-")
        },
    }
    contrast["pass"] = (
        all(item["pass45"] and item["readabilityNoisePass"] for item in contrast["tiers"].values())
        and all(item["pass45"] for tiers in contrast["loadingCopy"].values() for item in tiers.values())
    )
    (EVIDENCE / "contrast-gate.json").write_text(json.dumps(contrast, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    evidence_boards(runtime_assets)
    print(json.dumps({"c2paPass": c2pa["pass"], "decodedMiB": runtime_manifest["decodedTextureMiBAllTiers"], "budgetPass": runtime_manifest["budgetPass"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
