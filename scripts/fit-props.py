#!/usr/bin/env python3
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path("/data/projects/frostfire-sanctum")
IMG = Path("/home/miles/.grok/sessions/%2Fdata%2Fprojects/01a0ae09-aaed-7920-9889-ab029a327e6c/images")
OUT = ROOT / "public" / "assets"


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
    rgba[:, :, 3] = np.where(alpha * 255 < 24, 0, (alpha * 255).astype(np.uint8))
    return Image.fromarray(rgba, "RGBA")


def crop_key(im: Image.Image, pad: int = 8) -> Image.Image:
    a = np.asarray(im)[:, :, 3]
    ys, xs = np.where(a > 20)
    if len(xs) == 0:
        return im
    x0, x1 = max(0, int(xs.min()) - pad), min(im.width, int(xs.max()) + 1 + pad)
    y0, y1 = max(0, int(ys.min()) - pad), min(im.height, int(ys.max()) + 1 + pad)
    return im.crop((x0, y0, x1, y1))


def fit_h(im: Image.Image, max_h: int) -> Image.Image:
    if im.height <= max_h:
        return im
    w = max(1, round(im.width * max_h / im.height))
    return im.resize((w, max_h), Image.Resampling.LANCZOS)


def save_png(im: Image.Image, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "PNG", optimize=True, compress_level=9)
    print(dest, im.size, dest.stat().st_size)


def shrink_existing(rel: str, max_h: int) -> None:
    p = OUT / rel
    im = Image.open(p).convert("RGBA")
    save_png(fit_h(im, max_h), p)


shrink_existing("levels/01/stone.png", 256)
shrink_existing("ui/pressure-plate.png", 220)
shrink_existing("fx/wisp.png", 160)

save_png(fit_h(crop_key(key_green(Image.open(IMG / "18.jpg"))), 420), OUT / "levels/01/door.png")
save_png(fit_h(crop_key(key_green(Image.open(IMG / "19.jpg"))), 220), OUT / "levels/01/altar.png")
