#!/usr/bin/env python3
"""Key walk cycles, wrap-blend road tiles, copy level 01 midground."""

from __future__ import annotations

import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCR = ROOT / ".scratch"
OUT = ROOT / "public" / "assets"
SESS = Path(
    "/home/miles/.grok/sessions/%2Fdata%2Fprojects%2Ffrostfire-sanctum/01a0af03-c19b-7fb0-8da8-88b65488ebed/images"
)

EMBER_IDX = [1, 2, 4, 5, 7, 8, 10, 11, 13, 14, 16, 17]
FROST_IDX = [1, 2, 4, 5, 7, 8, 10, 11, 13, 14, 16, 17]


def key_green(im: Image.Image) -> Image.Image:
    rgba = np.asarray(im.convert("RGBA")).copy()
    rgb = rgba[:, :, :3].astype(np.float32)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    green = (g > 70) & (g > r * 1.18) & (g > b * 1.18)
    dist = (g - np.maximum(r, b)) / 255.0
    alpha = np.clip(1.0 - dist / 0.22, 0, 1)
    alpha = np.where(green, alpha, 1.0)
    g2 = np.minimum(g, np.maximum(r, b) + 12)
    rgb[:, :, 1] = np.where(green, g2, g)
    rgba[:, :, :3] = rgb.astype(np.uint8)
    rgba[:, :, 3] = (alpha * 255).astype(np.uint8)
    rgba[:, :, 3] = np.where(rgba[:, :, 3] < 24, 0, rgba[:, :, 3])
    return Image.fromarray(rgba, "RGBA")


def bbox(im: Image.Image, pad: int = 12) -> tuple[int, int, int, int]:
    a = np.asarray(im)[:, :, 3]
    ys, xs = np.where(a > 20)
    if len(xs) == 0:
        return (0, 0, im.width, im.height)
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    return (
        max(0, x0 - pad),
        max(0, y0 - pad),
        min(im.width, x1 + pad),
        min(im.height, y1 + pad),
    )


def fit_height(im: Image.Image, max_h: int) -> Image.Image:
    if im.height <= max_h:
        return im
    w = max(1, round(im.width * max_h / im.height))
    return im.resize((w, max_h), Image.Resampling.LANCZOS)


def export_seq(src_dir: Path, dest: Path, indices: list[int]) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    keyed: list[Image.Image] = []
    boxes: list[tuple[int, int, int, int]] = []
    for i in indices:
        p = src_dir / f"{i:03d}.png"
        im = key_green(Image.open(p))
        keyed.append(im)
        boxes.append(bbox(im, pad=16))
    box = (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )
    for n, im in enumerate(keyed):
        crop = fit_height(im.crop(box), 320)
        crop.save(dest / f"{n:02d}.png", "PNG", optimize=True, compress_level=9)
    print(f"  {dest.relative_to(ROOT)}  {len(keyed)} frames  crop={box}")


def wrap_h(im: Image.Image, blend: int = 72) -> Image.Image:
    arr = np.asarray(im.convert("RGB")).astype(np.float32)
    h, w, _ = arr.shape
    blend = min(blend, w // 4)
    out = arr.copy()
    for x in range(blend):
        t = x / blend
        left = arr[:, x]
        right = arr[:, w - blend + x]
        mixed = right * (1.0 - t) + left * t
        out[:, x] = mixed
        out[:, w - blend + x] = mixed
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def save_jpg(im: Image.Image, dest: Path, size: tuple[int, int]) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.resize(size, Image.Resampling.LANCZOS).save(dest, "JPEG", quality=86, optimize=True)
    print(f"  {dest.relative_to(ROOT)} {size}")


def tile_preview(im: Image.Image, dest: Path) -> None:
    w, h = im.size
    sheet = Image.new("RGB", (w * 2, h * 2))
    for y in range(2):
        for x in range(2):
            sheet.paste(im, (x * w, y * h))
    dest.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(dest, "JPEG", quality=80)
    print(f"  preview {dest.relative_to(ROOT)}")


def process_liquids() -> None:
    print("lava / river channels")
    lava_ch = wrap_h(Image.open(SESS / "16.jpg"), 96)
    water_ch = wrap_h(Image.open(SESS / "17.jpg"), 96)
    lava_s = wrap_h(Image.open(SESS / "12.jpg"), 64)
    water_s = wrap_h(Image.open(SESS / "10.jpg"), 64)
    save_jpg(lava_ch, OUT / "levels/01/lava-channel.jpg", (1024, 512))
    save_jpg(water_ch, OUT / "levels/01/water-channel.jpg", (1024, 512))
    save_jpg(lava_s, OUT / "levels/01/lava-surface.jpg", (512, 512))
    save_jpg(water_s, OUT / "levels/01/water-surface.jpg", (512, 512))
    tile_preview(lava_ch.resize((1024, 512), Image.Resampling.LANCZOS), SCR / "tiles/lava-channel-2x2.jpg")
    tile_preview(water_ch.resize((1024, 512), Image.Resampling.LANCZOS), SCR / "tiles/water-channel-2x2.jpg")
    tile_preview(lava_s.resize((512, 512), Image.Resampling.LANCZOS), SCR / "tiles/lava-surface-2x2.jpg")
    tile_preview(water_s.resize((512, 512), Image.Resampling.LANCZOS), SCR / "tiles/water-surface-2x2.jpg")


def main() -> None:
    import sys

    liquids_only = "--liquids-only" in sys.argv
    if not liquids_only:
        print("walk cycles")
        export_seq(SCR / "ember-walk", OUT / "characters/ember/walk", EMBER_IDX)
        export_seq(SCR / "frost-walk", OUT / "characters/frost/walk", FROST_IDX)

        print("roads / hall")
        ember = wrap_h(Image.open(SESS / "9.jpg"), 80)
        frost = wrap_h(Image.open(SESS / "8.jpg"), 80)
        wall = wrap_h(Image.open(SESS / "3.jpg"), 48)
        ceiling = wrap_h(Image.open(SESS / "4.jpg"), 64)
        save_jpg(ember, OUT / "levels/01/road-ember.jpg", (1024, 512))
        save_jpg(frost, OUT / "levels/01/road-frost.jpg", (1024, 512))
        save_jpg(wall, OUT / "levels/01/wall.jpg", (512, 512))
        save_jpg(ceiling, OUT / "levels/01/ceiling.jpg", (1024, 512))
        shutil.copyfile(SESS / "2.jpg", OUT / "levels/01/bg-mid.jpg")
        print("  copy levels/01/bg-mid.jpg")
        tile_preview(ember.resize((1024, 512), Image.Resampling.LANCZOS), SCR / "tiles/road-ember-2x2.jpg")
        tile_preview(frost.resize((1024, 512), Image.Resampling.LANCZOS), SCR / "tiles/road-frost-2x2.jpg")
        tile_preview(wall.resize((512, 512), Image.Resampling.LANCZOS), SCR / "tiles/wall-2x2.jpg")

    process_liquids()


if __name__ == "__main__":
    main()
