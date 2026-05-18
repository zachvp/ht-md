#!/usr/bin/env python3
"""Generate extension icons as <#> — HTML angle brackets in teal, Markdown # in orange."""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

SIZES = [16, 48, 128]
OUT_DIR = Path(__file__).parent.parent / 'icons'

FONT_PATHS = [
    '/System/Library/Fonts/Menlo.ttc',
    '/System/Library/Fonts/Courier New.ttf',
    '/Library/Fonts/Courier New.ttf',
]

BG     = (20, 20, 32, 0)
TEAL   = (77, 208, 225)   # < >  HTML
ORANGE = (255, 153, 0)    # #    Markdown

def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_PATHS:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()

def fit_font(draw: ImageDraw.ImageDraw, text: str, canvas: int) -> tuple[ImageFont.FreeTypeFont, tuple]:
    """Find the largest font where text fits within canvas, return font and tight bbox."""
    for fs in range(canvas * 2, 1, -1):
        font  = load_font(fs)
        tight = draw.textbbox((0, 0), text, font=font)
        w = tight[2] - tight[0]
        h = tight[3] - tight[1]
        if w <= canvas and h <= canvas:
            return font, tight
    return load_font(1), (0, 0, 1, 1)

def make_icon(size: int) -> Image.Image:
    img  = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    font, tight = fit_font(draw, '<#', size)
    parts   = [('<', TEAL), ('#', ORANGE)]
    total_w = tight[2] - tight[0]
    text_h  = tight[3] - tight[1]

    x = (size - total_w) / 2 - tight[0]
    y = (size - text_h) / 2 - tight[1]

    for ch, color in parts:
        draw.text((x, y), ch, font=font, fill=color)
        x += draw.textlength(ch, font=font)

    return img

if __name__ == '__main__':
    OUT_DIR.mkdir(exist_ok=True)
    for size in SIZES:
        path = OUT_DIR / f'icon{size}.png'
        make_icon(size).save(path)
        print(f'  {path}')
