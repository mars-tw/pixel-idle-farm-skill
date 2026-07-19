# -*- coding: utf-8 -*-
"""
r72_pixel_polish.py — R72 程序化像素階調精緻化（生成工具未連線期的合規美術輪）

目標（OPTIM_PLAN_R72 C-1）：
  作物/建物 sprite 的「hue-shift 陰影」——陰影往冷色相偏移並微增飽和、
  亮部往暖色相微偏，讓像素階調更有手繪感；不動 alpha、不動尺寸、不動構圖、
  明度（HSV V 通道）完全保留 → 不會過暗、64px 縮圖身分辨識不變。

保證：
  * 每個 frame 以自己的明度範圍分層（frame-local threshold），跨 frame 不互染。
  * mean luminance 變化 ≤ 3%（僅色相/飽和微調的副作用），超標即中止不寫檔。
  * 只處理 alpha>0 像素；透明區 bit-exact 不變。

用法：
  python tools/r72_pixel_polish.py            # 就地處理 + 產出 metrics/評比條
  python tools/r72_pixel_polish.py --dry-run  # 只算 metrics 不寫檔
"""
import colorsys
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V4 = os.path.join(ROOT, "assets", "generated", "v4")
EVIDENCE = os.path.join(ROOT, "docs", "evidence", "r72")

# 只碰作物/建物/自然建物；角色、動物、UI 不在本輪範圍
SHEETS = ["crops-48", "crops2-48", "crops3-48", "crops4-48", "buildings", "structures-nature"]

SHADOW_BAND = 0.35      # frame 明度範圍下 35% 視為陰影
HILITE_BAND = 0.85      # 上 15% 視為亮部
SHADOW_HUE_SHIFT = -10.0 / 360.0   # 陰影往冷色（紫藍）偏 10°
SHADOW_SAT_GAIN = 1.06             # 陰影微增飽和，避免髒灰
HILITE_HUE_SHIFT = +6.0 / 360.0    # 亮部往暖色偏 6°
MAX_MEAN_LUMA_DRIFT = 0.03         # 全 sheet 平均亮度漂移上限（3%）

SHOWCASE = [
    ("crops-48", ["wheat_ready", "tomato_ready", "pumpkin_ready"]),
    ("buildings", ["farmhouse", "barn"]),
    ("structures-nature", ["oak", "windmill"]),
]


def luma(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


def frame_boxes(map_path):
    with open(map_path, encoding="utf-8") as fh:
        data = json.load(fh)
    return {fid: (f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]) for fid, f in data["frames"].items()}


def sheet_stats(px, box):
    """回傳 (opaque 數, 平均亮度, 明度階數/32 量化)。"""
    x0, y0, x1, y1 = box
    total, count = 0.0, 0
    levels = set()
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = luma(r, g, b)
            total += lum
            count += 1
            levels.add(int(lum) >> 3)  # 32 階量化
    return count, (total / count if count else 0.0), len(levels)


def polish_frame(px, box):
    x0, y0, x1, y1 = box
    lo, hi = 255.0, 0.0
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = luma(r, g, b)
            lo, hi = min(lo, lum), max(hi, lum)
    if hi <= lo:
        return 0
    span = hi - lo
    shadow_cut = lo + span * SHADOW_BAND
    hilite_cut = lo + span * HILITE_BAND
    touched = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = luma(r, g, b)
            if lum <= shadow_cut:
                dh, sg = SHADOW_HUE_SHIFT, SHADOW_SAT_GAIN
            elif lum >= hilite_cut:
                dh, sg = HILITE_HUE_SHIFT, 1.0
            else:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
            if s < 0.04:  # 近灰不轉色，避免石材變色
                continue
            h = (h + dh) % 1.0
            s = min(1.0, s * sg)
            nr, ng, nb = colorsys.hsv_to_rgb(h, s, v)
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
            touched += 1
    return touched


def build_showcase(before_imgs, after_imgs, boxes_by_sheet, out_path):
    """代表 frame before/after 對照條（上排 before、下排 after，4x 放大）。"""
    cells = []
    for sheet, fids in SHOWCASE:
        for fid in fids:
            box = boxes_by_sheet[sheet].get(fid)
            if not box:
                continue
            b = before_imgs[sheet].crop(box)
            a = after_imgs[sheet].crop(box)
            size = (64, 64)
            cells.append((b.resize(size, Image.NEAREST), a.resize(size, Image.NEAREST)))
    if not cells:
        return
    w = len(cells) * 68 + 4
    strip = Image.new("RGBA", (w, 140), (37, 29, 53, 255))
    for i, (b, a) in enumerate(cells):
        strip.paste(b, (4 + i * 68, 4), b)
        strip.paste(a, (4 + i * 68, 72), a)
    strip.save(out_path)


def main():
    dry = "--dry-run" in sys.argv
    os.makedirs(EVIDENCE, exist_ok=True)
    report = {"release": "R72", "mode": "hue-shift shadow polish", "sheets": {}}
    before_imgs, after_imgs, boxes_by_sheet = {}, {}, {}
    ok = True
    for sheet in SHEETS:
        png = os.path.join(V4, sheet + ".png")
        jsn = os.path.join(V4, sheet + ".json")
        img = Image.open(png).convert("RGBA")
        boxes = frame_boxes(jsn)
        boxes_by_sheet[sheet] = boxes
        before_imgs[sheet] = img.copy()
        px = img.load()
        pre = {fid: sheet_stats(px, box) for fid, box in boxes.items()}
        touched = sum(polish_frame(px, box) for box in boxes.values())
        post = {fid: sheet_stats(px, box) for fid, box in boxes.items()}
        pre_mean = sum(c * m for c, m, _ in pre.values()) / max(1, sum(c for c, _, _ in pre.values()))
        post_mean = sum(c * m for c, m, _ in post.values()) / max(1, sum(c for c, _, _ in post.values()))
        drift = abs(post_mean - pre_mean) / max(1.0, pre_mean)
        min_levels = min((lv for c, _, lv in post.values() if c >= 24), default=0)
        alpha_same = before_imgs[sheet].getchannel("A").tobytes() == img.getchannel("A").tobytes()
        report["sheets"][sheet] = {
            "frames": len(boxes),
            "touchedPixels": touched,
            "meanLumaBefore": round(pre_mean, 2),
            "meanLumaAfter": round(post_mean, 2),
            "meanLumaDrift": round(drift, 4),
            "minLuminanceSteps32": min_levels,
            "alphaUnchanged": alpha_same,
        }
        if drift > MAX_MEAN_LUMA_DRIFT or not alpha_same:
            print(f"  ✗ {sheet}: 亮度漂移 {drift:.4f} 或 alpha 變動 — 中止，不寫檔")
            ok = False
            continue
        after_imgs[sheet] = img
        if not dry:
            img.save(png)
        print(f"  ✓ {sheet}: {len(boxes)} frames, {touched} px 微調, "
              f"meanLuma {pre_mean:.1f}→{post_mean:.1f} (drift {drift:.2%}), 最少明度階 {min_levels}")
    report["pass"] = ok
    with open(os.path.join(EVIDENCE, "art-metrics.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    if ok and not dry:
        build_showcase(before_imgs, after_imgs, boxes_by_sheet,
                       os.path.join(EVIDENCE, "art-before-after-strip.png"))
    print(("✅" if ok else "❌") + " R72 pixel polish " + ("(dry-run)" if dry else "") +
          f" — metrics: docs/evidence/r72/art-metrics.json")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
