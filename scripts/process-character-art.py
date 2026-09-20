#!/usr/bin/env python3
"""Key green character clips, crop a shared box, export engine frames."""

from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SESSION = Path(
    "/home/miles/.grok/sessions/%2Fdata%2Fprojects%2Ffrostfire-sanctum/"
    "01a0bf3d-e35c-78c1-a216-0c026d42a7be"
)
SCRATCH = ROOT / ".scratch" / "characters"
OUT = ROOT / "public" / "assets" / "characters"


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


def bbox(im: Image.Image, pad: int = 10) -> tuple[int, int, int, int]:
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


def union_box(boxes: list[tuple[int, int, int, int]]) -> tuple[int, int, int, int]:
    return (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )


def fit_height(im: Image.Image, max_h: int) -> Image.Image:
    if im.height <= max_h:
        return im
    w = max(1, round(im.width * max_h / im.height))
    return im.resize((w, max_h), Image.Resampling.LANCZOS)


def extract(video: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("*.png"):
        old.unlink()
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", str(video), "-vf", "fps=12", str(dest / "%03d.png")],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def load_keyed(src: Path) -> list[Image.Image]:
    frames = []
    for p in sorted(src.glob("*.png")):
        frames.append(key_green(Image.open(p)))
    return frames


def pack_foot(
    frames: list[Image.Image],
    indices: list[int],
    dest: Path,
    canvas: tuple[int, int],
) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    cw, ch = canvas
    for n, idx in enumerate(indices):
        i = min(max(idx, 0), len(frames) - 1)
        im = frames[i]
        box = bbox(im, pad=8)
        crop = im.crop(box)
        scale = min(cw / max(crop.width, 1), ch / max(crop.height, 1))
        w = max(1, round(crop.width * scale))
        h = max(1, round(crop.height * scale))
        crop = crop.resize((w, h), Image.Resampling.LANCZOS)
        canvas_im = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        canvas_im.paste(crop, ((cw - w) // 2, ch - h), crop)
        canvas_im.save(dest / f"{n:02d}.png", "PNG", optimize=True, compress_level=9)
    print(f"  {dest.relative_to(ROOT)} {len(indices)} frames {cw}x{ch}")


def still_to_idle(src: Path, dest: Path) -> Image.Image:
    keyed = key_green(Image.open(src))
    dest.parent.mkdir(parents=True, exist_ok=True)
    return keyed


def main() -> None:
    SCRATCH.mkdir(parents=True, exist_ok=True)
    clips = {
        "frost-walk": SESSION / "videos" / "1.mp4",
        "ember-walk": SESSION / "videos" / "2.mp4",
        "frost-death": SESSION / "videos" / "3.mp4",
        "ember-death": SESSION / "videos" / "4.mp4",
        "frost-jump": SESSION / "videos" / "5.mp4",
        "ember-jump": SESSION / "videos" / "6.mp4",
    }
    for name, path in clips.items():
        print("extract", name)
        extract(path, SCRATCH / name)

    idle_src = {
        "ember": SESSION / "images" / "1.jpg",
        "frost": SESSION / "images" / "2.jpg",
    }

    for who in ("ember", "frost"):
        idle = key_green(Image.open(idle_src[who]))
        walk = load_keyed(SCRATCH / f"{who}-walk")
        jump = load_keyed(SCRATCH / f"{who}-jump")
        death = load_keyed(SCRATCH / f"{who}-death")
        samples = [idle] + walk[4:40:3] + jump[4:28:4] + death[2:32:4]
        widths = []
        heights = []
        for im in samples:
            x0, y0, x1, y1 = bbox(im, pad=8)
            widths.append(x1 - x0)
            heights.append(y1 - y0)
        scale = 320 / max(heights)
        canvas = (max(8, round(max(widths) * scale)), 320)
        idle_dir = OUT / who / "idle"
        pack_foot([idle] * 8, list(range(8)), idle_dir, canvas)
        pack_foot(walk, [6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39], OUT / who / "walk", canvas)
        pack_foot(jump, [4, 8, 12, 16, 20, 24], OUT / who / "jump", canvas)
        pack_foot(death, [2, 5, 8, 11, 14, 17], OUT / who / "hurt", canvas)
        pack_foot(death, [20, 24, 28, 32], OUT / who / "downed", canvas)


if __name__ == "__main__":
    main()
