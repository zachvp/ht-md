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

BG     = (20, 20, 32, 255)
TEAL   = (77, 208, 225)   # < >  HTML
ORANGE = (255, 153, 0)    # #    Markdown

def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_PATHS:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()

def make_icon(size: int) -> Image.Image:
    img  = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = max(2, size // 7)
    draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=BG)

    font    = load_font(int(size * 0.48))
    parts   = [('<', TEAL), ('#', ORANGE), ('>', TEAL)]
    total_w = sum(draw.textlength(ch, font=font) for ch, _ in parts)
    bbox    = draw.textbbox((0, 0), '<#>', font=font)
    text_h  = bbox[3] - bbox[1]

    x = (size - total_w) / 2
    y = (size - text_h) / 2 - bbox[1]

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
