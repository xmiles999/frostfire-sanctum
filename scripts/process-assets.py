#!/usr/bin/env python3
"""Chromakey green, crop with a shared box, export animation frames."""

from __future__ import annotations

import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCRATCH = ROOT / ".scratch" / "frames"
IMG = Path(
    "/home/miles/.grok/sessions/%2Fdata%2Fprojects/01a0ae09-aaed-7920-9889-ab029a327e6c/images"
)
OUT = ROOT / "public" / "assets"


def key_green(im: Image.Image) -> Image.Image:
    rgba = np.asarray(im.convert("RGBA")).copy()
    rgb = rgba[:, :, :3].astype(np.float32)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    green = (g > 70) & (g > r * 1.18) & (g > b * 1.18)
    dist = (g - np.maximum(r, b)) / 255.0
    alpha = np.clip(1.0 - dist / 0.22, 0, 1)
    alpha = np.where(green, alpha, 1.0)
    # despill
    g2 = np.minimum(g, np.maximum(r, b) + 12)
    rgb[:, :, 1] = np.where(green, g2, g)
    rgba[:, :, :3] = rgb.astype(np.uint8)
    rgba[:, :, 3] = (alpha * 255).astype(np.uint8)
    # harden near-zero
    rgba[:, :, 3] = np.where(rgba[:, :, 3] < 24, 0, rgba[:, :, 3])
    return Image.fromarray(rgba, "RGBA")


def bbox(im: Image.Image, pad: int = 12) -> tuple[int, int, int, int]:
    a = np.asarray(im)[:, :, 3]
    ys, xs = np.where(a > 20)
    if len(xs) == 0:
        return (0, 0, im.width, im.height)
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(im.width, x1 + pad)
    y1 = min(im.height, y1 + pad)
    return (x0, y0, x1, y1)


def fit_height(im: Image.Image, max_h: int) -> Image.Image:
    if im.height <= max_h:
        return im
    w = max(1, round(im.width * max_h / im.height))
    return im.resize((w, max_h), Image.Resampling.LANCZOS)


def union_box(boxes: list[tuple[int, int, int, int]]) -> tuple[int, int, int, int]:
    return (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )


def export_seq(src_dir: Path, dest: Path, indices: list[int]) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    keyed: list[Image.Image] = []
    boxes: list[tuple[int, int, int, int]] = []
    for i in indices:
        p = src_dir / f"{i:03d}.png"
        im = key_green(Image.open(p))
        keyed.append(im)
        boxes.append(bbox(im))
    box = union_box(boxes)
    for n, im in enumerate(keyed):
        crop = fit_height(im.crop(box), 320)
        crop.save(dest / f"{n:02d}.png", "PNG", optimize=True, compress_level=9)
    print(f"  {dest.relative_to(ROOT)}  {len(keyed)} frames  crop={box}")


def export_still(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    keyed = key_green(Image.open(src))
    im = fit_height(keyed.crop(bbox(keyed, pad=16)), 320)
    im.save(dest, "PNG", optimize=True, compress_level=9)
    print(f"  {dest.relative_to(ROOT)}")


def copy_scene(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dest)
    print(f"  copy {dest.relative_to(ROOT)}")


def main() -> None:
    if OUT.exists():
        pass
    print("characters")
    export_seq(SCRATCH / "ember-idle", OUT / "characters/ember/idle", [1, 6, 12, 18, 24, 30, 36, 42])
    export_seq(
        SCRATCH / "ember-walk",
        OUT / "characters/ember/walk",
        [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23],
    )
    export_seq(SCRATCH / "ember-jump", OUT / "characters/ember/jump", [6, 10, 14, 18, 22, 28])
    export_seq(SCRATCH / "frost-idle", OUT / "characters/frost/idle", [1, 6, 12, 18, 24, 30, 36, 42])
    export_seq(
        SCRATCH / "frost-walk",
        OUT / "characters/frost/walk",
        [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23],
    )
    if (SCRATCH / "frost-jump" / "001.png").exists():
        export_seq(SCRATCH / "frost-jump", OUT / "characters/frost/jump", [6, 10, 14, 18, 22, 28])

    export_still(IMG / "14.jpg", OUT / "characters/ember/downed/00.png")
    export_still(IMG / "17.jpg", OUT / "characters/frost/downed/00.png")

    print("fx / ui / levels")
    export_still(IMG / "5.jpg", OUT / "fx/wisp.png")
    export_still(IMG / "11.jpg", OUT / "ui/pressure-plate.png")
    export_still(IMG / "15.jpg", OUT / "levels/01/stone.png")
    export_still(IMG / "9.jpg", OUT / "levels/01/fg.png")
    copy_scene(IMG / "4.jpg", OUT / "levels/01/bg-far.jpg")
    copy_scene(IMG / "2.jpg", OUT / "levels/01/bg-mid.jpg")
    copy_scene(IMG / "7.jpg", OUT / "levels/01/lava.jpg")
    copy_scene(IMG / "6.jpg", OUT / "levels/01/water.jpg")


if __name__ == "__main__":
    main()
