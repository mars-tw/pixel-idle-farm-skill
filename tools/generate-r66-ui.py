#!/usr/bin/env python3
"""Build and verify the farm R66 UI icon/assistant production assets.

The approved image model produces opaque 512px concept masters on #ff00ff.
This deterministic pass extracts and decontaminates alpha, reduces the result
to the R62 runtime palette, adds a one-pixel outline, and assembles the 8x4
native 32px icon atlas. Assistant skins are exported as native 64px RGBA.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
R66 = ROOT / "assets" / "generated" / "r66"
SOURCE = R66 / "source"
EVIDENCE = ROOT / "docs" / "evidence" / "R66_art"
MATTE = np.asarray((255, 0, 255), dtype=np.float32)

PALETTE_FAMILIES: dict[str, list[str]] = {
    "outline": ["#251d35", "#352941", "#49364b", "#5b4758"],
    "foliage": ["#344657", "#3f584b", "#4c6c48", "#5d8447", "#72a04b", "#8abb52", "#a8d263", "#d0e47a"],
    "earth": ["#483044", "#5a3a42", "#70473f", "#895641", "#a96d47", "#c78a52", "#e0ac65", "#f0d082"],
    "water": ["#2f3450", "#34465f", "#355e74", "#397b8b", "#4397a6", "#5db3bc", "#83ced0", "#b7e5d4"],
    "red": ["#522d43", "#71313f", "#93383e", "#b9483f", "#d65e42", "#eb794a", "#f49a56", "#f7c56a"],
    "gold": ["#5b423c", "#7a5a3b", "#9a783b", "#b9983f", "#d5b747", "#e8d255", "#f5e678", "#fff0a3"],
    "violet": ["#423047", "#573750", "#70405c", "#8e4b6c", "#ae5d7d", "#cf7895", "#e9a0ad", "#f5c8bd"],
    "neutral": ["#32303e", "#464754", "#5c5f69", "#777b7e", "#969991", "#b5b5a4", "#d4cfb5", "#eee3c8", "#fff4d8"],
    "sky": ["#385878", "#4d78a0", "#6b9fc1", "#94c6db", "#c7e7e5"],
}


def rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


PALETTE_HEX = list(dict.fromkeys(c for family in PALETTE_FAMILIES.values() for c in family))
PALETTE_RGB = np.asarray([rgb(c) for c in PALETTE_HEX], dtype=np.float32)
PALETTE_SET = {tuple(map(int, colour)) for colour in PALETTE_RGB}
OUTLINE = rgb(PALETTE_FAMILIES["outline"][0])

CROPS = [
    ("crop_wheat", "小麥", "a ripe tied sheaf of golden wheat with three grain heads"),
    ("crop_carrot", "胡蘿蔔", "one bright orange carrot with a compact leafy green crown"),
    ("crop_tomato", "番茄", "one ripe red tomato with a crisp five-point green calyx"),
    ("crop_strawberry", "草莓", "one ripe heart-shaped strawberry with green leaves and chunky cream seeds"),
    ("crop_corn", "玉米", "one golden ear of corn partly wrapped by two green husk leaves"),
    ("crop_pumpkin", "南瓜", "one isolated ripe golden pumpkin with two broad green leaves, a curled vine, and one tiny cream blossom"),
    ("crop_radish", "蘿蔔", "one round red radish with a white root tip and three green leaves"),
    ("crop_bell_pepper", "甜椒", "one glossy red bell pepper with a short green stem"),
    ("crop_potato", "馬鈴薯", "one warm brown potato with a few readable eye dimples"),
    ("crop_sunflower", "向日葵", "one cheerful sunflower head with gold petals and a dark seed center"),
    ("crop_grapes", "葡萄", "one compact bunch of violet grapes with one broad green leaf"),
    ("crop_melon", "香瓜", "one round striped green melon with a short curled vine"),
    ("crop_pea", "豌豆", "one open green pea pod showing three round peas and one tiny leaf"),
    ("crop_sweet_potato", "地瓜", "one reddish-purple sweet potato with a cut golden end and a small green leaf"),
    ("crop_winter_kale", "冬羽甘藍", "one compact winter kale rosette with layered blue-green leaves"),
]

TOOLS = [
    ("tool_plant", "種植", "a seed pouch with one seed and a fresh sprout"),
    ("tool_harvest", "收成", "a small curved harvest sickle crossing one wheat head"),
    ("tool_water", "澆水", "a compact blue-green watering can with three water drops"),
    ("tool_clear", "清理", "a sturdy farm hoe with one loosened soil clod"),
    ("tool_build", "建造", "a wood-handled hammer crossing one short fence plank"),
    ("tool_inspect", "檢視", "a brass-rimmed magnifying glass over one green leaf"),
]

TABS = [
    ("tab_tile", "地塊", "a compact tilled-soil plot with one fresh sprout"),
    ("tab_orders", "訂單", "a cream farm order clipboard with two abstract check marks and no writing"),
    ("tab_upgrades", "升級", "a small timber barn with an upward gold arrow and no writing"),
    ("tab_story", "故事", "an open cream storybook with a tiny sunrise symbol and no writing"),
    ("tab_journal", "圖鑑", "a closed green field journal with a pressed leaf emblem and no writing"),
]

SYSTEMS = [
    ("system_coin", "金幣", "one embossed gold farm coin with a simple sprout emblem"),
    ("system_xp", "經驗", "one warm gold five-point experience star with a tiny green leaf accent"),
    ("system_storage", "倉庫", "a compact wood-and-brass storage crate with one cream sack"),
    ("system_settings", "設定", "one brass gear around a small green leaf hub"),
    ("system_help", "說明", "one warm brass farm lantern with a tiny cream question-shaped glow that is symbolic, not typography"),
    ("system_reset", "重置", "one green circular sprout arrow wrapping around a small cream ledger with no writing"),
]

ASSISTANTS = [
    ("assistant_idle", "助理待機", "idle: neutral friendly expression, leaf antenna resting naturally, no accessory"),
    ("assistant_tip", "助理提示", "helpful tip: attentive expression, leaf antenna tilted, tiny cream note-tab with green sprout badge"),
    ("assistant_alert", "助理提醒", "gentle alert: focused friendly expression, upright leaf antenna, amber forehead indicator and tiny gold spark"),
]


def standard_prompt(category: str, subject: str) -> str:
    return (
        "Use case: stylized-concept. Asset type: 512x512 opaque game UI icon concept master for native 32px export. "
        f"Primary request: one isolated {subject}. Category: {category}. "
        "Scene/backdrop: perfectly flat solid #ff00ff chroma-key background. "
        "Style/medium: cozy Morninglight Farm pixel RPG; R62 controlled palette; stepped hard-edged pixel clusters; "
        "1px-equivalent deep plum-brown contour; no antialias blur. Composition: centered 62% fill, generous safe padding, "
        "readable at 32px. Lighting: warm top-left key light and restrained cool lower-right shadow. "
        "Constraints: no magenta in subject; uniform matte without shadow, gradient, texture, glow spill, reflection, floor, "
        "checkerboard, transparency, UI frame, emoji, text, logo, watermark, duplicate subject, or scenery."
    )


def assistant_prompt(state: str) -> str:
    return (
        "Create one 512x512 opaque concept master for the same Morninglight Farm smart-assistant mascot: preserve the "
        "acorn-shaped brass and forest-green head, pale blue square eyes, single leaf antenna, warm cream neckerchief, "
        f"compact bust silhouette and exact proportions. State variant: {state}. Match the R62 controlled warm gold, brown, "
        "forest-green, cream and cool-shadow palette; 1px-equivalent deep plum-brown contour; top-left warm key light; "
        "crisp hard-edged pixel clusters. Center with generous safe margin on perfectly flat solid #ff00ff matte. No matte "
        "gradient, shadow, text, letters, numbers, logo, border, UI panel, scenery, extra character, transparency, or checkerboard. "
        "Concept master for deterministic native 64px RGBA cleanup."
    )


def definitions() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for category, entries in (("crop", CROPS), ("tool", TOOLS), ("tab", TABS), ("system", SYSTEMS)):
        for slug, label, subject in entries:
            prompt = standard_prompt(category, subject)
            source_mode = "generated_r66"
            if slug == "crop_pumpkin":
                source_mode = "reused_wave0_calibration"
                prompt = (
                    "Use case: stylized-concept. Asset type: 512x512 game UI icon concept master for 128/64/32 export. "
                    "Primary request: one isolated ripe golden pumpkin crop icon with two broad green leaves, short curled vine, "
                    "and one tiny white blossom; no soil tile. Scene/backdrop: perfectly flat solid #ff00ff chroma-key background. "
                    "Style/medium: cozy pixel farm RPG sprite concept; autumn Morninglight Farm palette; stepped pixel clusters. "
                    "Composition: centered, about 62% fill, readable at 48x48, generous padding. Lighting: consistent warm top-left "
                    "light. Constraints: no magenta in subject; uniform background; no shadow, gradient, texture, floor, glow, "
                    "reflection, anti-aliased vector edge, UI frame, emoji, text, logo, or watermark."
                )
            rows.append({"slug": slug, "label": label, "category": category, "native_size": 32, "prompt": prompt, "source_mode": source_mode})
    for slug, label, state in ASSISTANTS:
        rows.append({"slug": slug, "label": label, "category": "assistant", "native_size": 64, "prompt": assistant_prompt(state), "source_mode": "generated_r66"})
    return rows


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def border_key(source: np.ndarray) -> np.ndarray:
    strip = max(2, round(min(source.shape[:2]) * .025))
    border = np.concatenate((source[:strip].reshape(-1, 3), source[-strip:].reshape(-1, 3), source[:, :strip].reshape(-1, 3), source[:, -strip:].reshape(-1, 3)))
    estimate = np.median(border.astype(np.float32), axis=0)
    spread = float(np.median(np.linalg.norm(border - estimate, axis=1)))
    if spread > 28 or float(np.linalg.norm(estimate - MATTE)) > 90:
        return MATTE.copy()
    return estimate


def extract_alpha(source: Image.Image) -> tuple[Image.Image, Image.Image, str]:
    data = np.asarray(source.convert("RGB"), dtype=np.uint8)
    key = border_key(data)
    distance = np.linalg.norm(data.astype(np.float32) - key.reshape(1, 1, 3), axis=2)
    t = np.clip((distance - 10.0) / 205.0, 0, 1)
    alpha = t * t * (3 - 2 * t)
    alpha[distance <= 10] = 0
    alpha[distance >= 215] = 1
    alpha[alpha < 20 / 255] = 0
    a = np.rint(alpha * 255).astype(np.uint8)
    safe = np.maximum(alpha[..., None], 1 / 255)
    recovered = (data.astype(np.float32) - (1 - alpha[..., None]) * key.reshape(1, 1, 3)) / safe
    recovered = np.clip(recovered, 0, 255)
    recovered[a == 0] = 0
    rgba = np.dstack((np.rint(recovered).astype(np.uint8), a))
    key_hex = "#" + "".join(f"{round(v):02x}" for v in key)
    return Image.fromarray(a, "L"), Image.fromarray(rgba, "RGBA"), key_hex


def nearest_palette(pixels: np.ndarray) -> np.ndarray:
    flat = pixels.reshape(-1, 3).astype(np.float32)
    # Perceptual-ish channel weighting keeps warm highlights and foliage distinct.
    weights = np.asarray((0.30, 0.59, 0.11), dtype=np.float32)
    distances = np.sum((flat[:, None, :] - PALETTE_RGB[None, :, :]) ** 2 * weights, axis=2)
    return PALETTE_RGB[np.argmin(distances, axis=1)].astype(np.uint8).reshape(pixels.shape)


def native_cleanup(rgba: Image.Image, size: int) -> Image.Image:
    alpha = np.asarray(rgba.getchannel("A"))
    visible = alpha > 48
    if not visible.any():
        raise ValueError("empty cutout")
    yy, xx = np.where(visible)
    crop = rgba.crop((int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1))
    margin = 3 if size == 32 else 4
    available = size - 2 * margin
    scale = min(available / crop.width, available / crop.height)
    dims = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    reduced = crop.resize(dims, Image.Resampling.BOX)
    raw = np.asarray(reduced, dtype=np.uint8)
    subject = raw[..., 3] >= 76
    subject_mask = Image.fromarray((subject * 255).astype(np.uint8), "L")
    dilated = subject_mask.filter(ImageFilter.MaxFilter(3))
    outline_mask = np.asarray(dilated, dtype=np.uint8) > np.asarray(subject_mask, dtype=np.uint8)

    out = np.zeros((dims[1], dims[0], 4), dtype=np.uint8)
    out[outline_mask, :3] = OUTLINE
    out[outline_mask, 3] = 255
    if subject.any():
        quantized = nearest_palette(raw[..., :3])
        out[subject, :3] = quantized[subject]
        out[subject, 3] = 255
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(Image.fromarray(out, "RGBA"), ((size - dims[0]) // 2, (size - dims[1]) // 2))
    return canvas


def font(size: int) -> ImageFont.ImageFont:
    for candidate in (Path("C:/Windows/Fonts/msjh.ttc"), Path("C:/Windows/Fonts/arial.ttf")):
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def checker(size: tuple[int, int], cell: int = 8) -> Image.Image:
    image = Image.new("RGB", size, (55, 50, 61))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(82, 75, 84))
    return image


def build_contact_sheets(items: list[dict[str, Any]]) -> None:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    icons = [item for item in items if item["category"] != "assistant"]
    cell_w, cell_h = 112, 128
    sheet = Image.new("RGB", (cell_w * 8, cell_h * 4), (37, 29, 53))
    draw = ImageDraw.Draw(sheet)
    label_font = font(13)
    for index, item in enumerate(icons):
        x, y = index % 8 * cell_w, index // 8 * cell_h
        tile = checker((96, 96), 12)
        native = Image.open(R66 / item["outputs"]["native"]).convert("RGBA").resize((96, 96), Image.Resampling.NEAREST)
        tile.paste(native, (0, 0), native)
        sheet.paste(tile, (x + 8, y + 4))
        draw.text((x + 7, y + 104), item["slug"].replace("_", " "), font=label_font, fill=(255, 240, 163))
    sheet.save(EVIDENCE / "icon-contact-sheet-native.png", "PNG", optimize=True)

    assistant_sheet = Image.new("RGB", (3 * 224, 254), (37, 29, 53))
    draw = ImageDraw.Draw(assistant_sheet)
    for index, item in enumerate(item for item in items if item["category"] == "assistant"):
        tile = checker((192, 192), 16)
        native = Image.open(R66 / item["outputs"]["native"]).convert("RGBA").resize((192, 192), Image.Resampling.NEAREST)
        tile.paste(native, (0, 0), native)
        x = index * 224 + 16
        assistant_sheet.paste(tile, (x, 12))
        draw.text((x, 215), item["label"], font=font(18), fill=(255, 240, 163))
    assistant_sheet.save(EVIDENCE / "assistant-skins-native.png", "PNG", optimize=True)


def validate_native(path: Path, size: int) -> dict[str, Any]:
    image = Image.open(path).convert("RGBA")
    data = np.asarray(image, dtype=np.uint8)
    alpha = data[..., 3]
    visible = alpha > 0
    transparent_rgb = int(np.count_nonzero(np.any(data[~visible, :3] != 0, axis=1))) if (~visible).any() else 0
    colours = {tuple(map(int, colour)) for colour in data[visible, :3]}
    invalid_colours = sorted(colours - PALETTE_SET)
    corners_clear = all(int(alpha[y, x]) == 0 for x, y in ((0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1)))
    occupancy = float(np.mean(visible))
    passed = image.size == (size, size) and image.mode == "RGBA" and corners_clear and transparent_rgb == 0 and not invalid_colours and .03 <= occupancy <= .88
    return {
        "pass": passed,
        "size": list(image.size),
        "mode": image.mode,
        "alpha_occupancy": round(occupancy, 6),
        "corners_clear": corners_clear,
        "transparent_rgb_pixels": transparent_rgb,
        "palette_colours": len(colours),
        "invalid_palette_colours": [list(c) for c in invalid_colours[:12]],
    }


def build() -> dict[str, Any]:
    for name in ("masters_opaque", "masks", "rgba", "native"):
        (R66 / name).mkdir(parents=True, exist_ok=True)
    records: list[dict[str, Any]] = []
    for definition in definitions():
        slug, size = definition["slug"], definition["native_size"]
        source_path = SOURCE / f"{slug}.png"
        if not source_path.is_file():
            raise FileNotFoundError(source_path)
        with Image.open(source_path) as opened:
            original = opened.convert("RGB")
        master = ImageOps.fit(original, (512, 512), method=Image.Resampling.NEAREST, centering=(.5, .5))
        master_path = R66 / "masters_opaque" / f"{slug}.png"
        master.save(master_path, "PNG", optimize=True)
        mask, rgba, key = extract_alpha(master)
        mask_path = R66 / "masks" / f"{slug}-mask.png"
        rgba_path = R66 / "rgba" / f"{slug}.png"
        native_path = R66 / "native" / f"{slug}-{size}.png"
        mask.save(mask_path, "PNG", optimize=True)
        rgba.save(rgba_path, "PNG", optimize=True)
        native = native_cleanup(rgba, size)
        native.save(native_path, "PNG", optimize=True)
        outputs = {
            "master": master_path.relative_to(R66).as_posix(),
            "mask": mask_path.relative_to(R66).as_posix(),
            "rgba": rgba_path.relative_to(R66).as_posix(),
            "native": native_path.relative_to(R66).as_posix(),
        }
        record = dict(definition)
        record.update({
            "source": source_path.relative_to(ROOT).as_posix(),
            "requested_model": "gpt-image-2",
            "actual_model": "gpt-image-2",
            "generation_interface": "Codex built-in image_gen",
            "source_c2pa_gpt_image_2_0": b"gpt-image" in source_path.read_bytes(),
            "matte": "#ff00ff",
            "estimated_matte": key,
            "outputs": outputs,
            "sha256": {"source": sha256(source_path), **{key_name: sha256(R66 / rel) for key_name, rel in outputs.items()}},
            "alpha_gate": validate_native(native_path, size),
        })
        records.append(record)

    icons = [record for record in records if record["category"] != "assistant"]
    if len(icons) != 32:
        raise AssertionError(f"expected 32 icons, got {len(icons)}")
    atlas = Image.new("RGBA", (256, 128), (0, 0, 0, 0))
    frames: dict[str, Any] = {}
    for index, item in enumerate(icons):
        x, y = index % 8 * 32, index // 8 * 32
        atlas.alpha_composite(Image.open(R66 / item["outputs"]["native"]).convert("RGBA"), (x, y))
        frames[item["slug"]] = {"frame": {"x": x, "y": y, "w": 32, "h": 32}, "sourceSize": {"w": 32, "h": 32}, "anchor": [0.5, 0.5]}
    atlas_path = R66 / "ui-icons-32.png"
    frames_path = R66 / "ui-icons-32.json"
    atlas.save(atlas_path, "PNG", optimize=True)
    frames_path.write_text(json.dumps({"meta": {"image": atlas_path.name, "size": {"w": 256, "h": 128}, "grid": [8, 4], "native_size": 32}, "frames": frames}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    overall_pass = all(item["alpha_gate"]["pass"] for item in records)
    manifest = {
        "schema_version": "farm-r66-ui.v1",
        "release": "R66",
        "prompt_version": "farm-r66-ui-v1.0",
        "generated_at": str(date.today()),
        "requested_model": "gpt-image-2",
        "actual_model": "gpt-image-2",
        "generation_interface": "Codex built-in image_gen",
        "style_contract": {"palette": "R62", "outline": "1px #251d35", "light": "warm top-left", "matte": "#ff00ff"},
        "counts": {"crops": 15, "tools": 6, "tabs": 5, "systems": 6, "icons": 32, "assistant_skins": 3},
        "runtime": {
            "atlas": atlas_path.relative_to(R66).as_posix(),
            "frames": frames_path.relative_to(R66).as_posix(),
            "sha256": {"atlas": sha256(atlas_path), "frames": sha256(frames_path)},
        },
        "alpha_gate": {"status": "PASS" if overall_pass else "FAIL", "passed": sum(item["alpha_gate"]["pass"] for item in records), "total": len(records)},
        "assets": records,
    }
    manifest_path = R66 / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build_contact_sheets(records)
    gate_path = EVIDENCE / "alpha-gate.json"
    gate_path.write_text(json.dumps({"release": "R66", "status": manifest["alpha_gate"]["status"], "assets": [{"slug": r["slug"], **r["alpha_gate"]} for r in records]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not overall_pass:
        raise SystemExit("R66 alpha/palette gate failed")
    return manifest


def check() -> dict[str, Any]:
    manifest_path = R66 / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit("missing R66 manifest; run without --check first")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    failures: list[str] = []
    assets = manifest.get("assets", [])
    if manifest.get("counts") != {"crops": 15, "tools": 6, "tabs": 5, "systems": 6, "icons": 32, "assistant_skins": 3}:
        failures.append("count contract")
    for item in assets:
        path = R66 / item["outputs"]["native"]
        if not path.is_file() or sha256(path) != item["sha256"]["native"]:
            failures.append(f"{item['slug']}: missing/hash")
            continue
        gate = validate_native(path, int(item["native_size"]))
        if not gate["pass"]:
            failures.append(f"{item['slug']}: alpha/palette")
        if not item.get("slug") or not item.get("prompt") or len(item.get("sha256", {})) != 5:
            failures.append(f"{item.get('slug', '?')}: manifest metadata")
    atlas_path = R66 / manifest["runtime"]["atlas"]
    frames_path = R66 / manifest["runtime"]["frames"]
    if Image.open(atlas_path).size != (256, 128) or len(json.loads(frames_path.read_text(encoding="utf-8"))["frames"]) != 32:
        failures.append("atlas contract")
    if failures:
        raise SystemExit("R66 art check failed: " + ", ".join(failures))
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify existing outputs without rebuilding")
    args = parser.parse_args()
    manifest = check() if args.check else build()
    print(json.dumps({"release": manifest["release"], "counts": manifest["counts"], "alpha_gate": manifest["alpha_gate"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
