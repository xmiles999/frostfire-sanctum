#!/usr/bin/env python3
"""Resize character/FX sprites to on-screen size. Source frames are ~1000px tall; the game draws ~160px."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CHAR = ROOT / "public" / "assets" / "characters"
FX = ROOT / "public" / "assets" / "fx"
MAX_H = 320


def fit(path: Path, max_h: int = MAX_H) -> None:
    im = Image.open(path)
    im = im.convert("RGBA") if path.suffix.lower() == ".png" else im.convert("RGB")
    if im.height > max_h:
        w = max(1, round(im.width * max_h / im.height))
        im = im.resize((w, max_h), Image.Resampling.LANCZOS)
    if path.suffix.lower() == ".png":
        im.save(path, "PNG", optimize=True, compress_level=9)
    else:
        im.save(path, "JPEG", quality=82, optimize=True)


def main() -> None:
    n = 0
    before = 0
    after = 0
    for folder in (CHAR, FX):
        for p in folder.rglob("*"):
            if p.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
                continue
            before += p.stat().st_size
            fit(p)
            after += p.stat().st_size
            n += 1
            print(f"  {p.relative_to(ROOT)} {p.stat().st_size}")
    print(f"resized {n} files  {before/1e6:.1f}MB -> {after/1e6:.1f}MB")


if __name__ == "__main__":
    main()
