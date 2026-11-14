#!/usr/bin/env python3
"""Original Container industrial geometry. Python 3.12, CairoSVG 2.8.2, Pillow 11.3.0.
Run from any directory; SVGs are the editable sources, PNGs the upload inputs.
No network inputs, fonts, randomness, or third-party artwork.
"""
import hashlib
import io
import json
import math
import re
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/achievement-art'
INK, PAPER, GOLD, TEAL = '#132e3b', '#f5e8ce', '#f4b34a', '#58bab4'
COLORS = ['#e98437', '#976444', '#f5e8ce', '#31414a', '#c7a16c']


def path(d, fill=INK, stroke=None, width=3):
    return f'<path d="{d}" fill="{fill}"' + (f' stroke="{stroke}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"' if stroke else '') + '/>'


def rect(x, y, w, h, fill, stroke=INK, width=2):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>'


def group(content, x=0, y=0, scale=1):
    return f'<g transform="translate({x} {y}) scale({scale})">{content}</g>'


def cargo(x, y, color=0, w=15, h=13, pattern=False):
    s = rect(x, y, w, h, COLORS[color], PAPER if color == 3 else INK, 1.5)
    if pattern:
        # Distinct redundant patterns for the five actual game colors.
        d = [f'M{x+3} {y+h-3} L{x+w-3} {y+3}', f'M{x+3} {y+3} L{x+w-3} {y+h-3}', f'M{x+w/2} {y+2} V{y+h-2}', f'M{x+3} {y+h/2} H{x+w-3}', f'M{x+3} {y+3} L{x+w/2} {y+h-3} L{x+w-3} {y+3}'][color]
        s += path(d, 'none', PAPER if color in (1, 3) else INK, 2)
    else:
        s += path(f'M{x+w/3} {y+3} V{y+h-3} M{x+2*w/3} {y+3} V{y+h-3}', 'none', PAPER if color == 3 else INK, 1)
    return s


def flag(x, y):
    return path(f'M{x} {y+25} V{y}', 'none', PAPER, 3) + path(f'M{x+2} {y} H{x+24} L{x+17} {y+7} L{x+24} {y+14} H{x+2} Z', GOLD)


def ship(full=False):
    s = path('M20 75 H109 L96 91 H34 Z', PAPER, INK, 2)
    s += rect(24, 52, 15, 22, TEAL) + rect(27, 46, 6, 6, PAPER)
    s += rect(27, 57, 8, 6, INK, INK, 0)
    if full:
        s += ''.join(cargo(41+i*13, 60, i, 12, 14) for i in range(5))
    else:
        s += cargo(43, 59, 0, 22, 15) + cargo(67, 59, 4, 22, 15)
    return s + path('M28 99 H48 L54 95 H75 L81 99 H101', 'none', TEAL, 3)


def factory(x, y, scale=1):
    s = rect(3, 0, 6, 23, GOLD) + path('M0 17 L12 9 V17 L24 9 V33 H0 Z', PAPER, INK, 2)
    s += rect(5, 23, 5, 10, TEAL) + rect(15, 23, 5, 10, TEAL)
    return group(s, x, y, scale)


def warehouse(x, y, scale=1):
    return group(path('M0 12 L14 0 L28 12 V34 H0 Z', PAPER, INK, 2) + rect(6, 16, 16, 18, TEAL) + path('M9 22 H19 M9 27 H19', 'none', INK, 2), x, y, scale)


def check(x, y, scale=1):
    return group(path('M0 10 L8 18 L25 0', 'none', TEAL, 6), x, y, scale)


def ledger():
    return rect(35, 28, 58, 70, PAPER, GOLD, 3) + path('M45 43 H81 M45 53 H74 M45 63 H68', 'none', INK, 4) + check(53, 73)


def number(n, x, y, scale=1):
    # Hand-drawn geometric digits; never dependent on installed fonts.
    digits = {'0': 'M0 0 H8 V14 H0 Z', '1': 'M1 3 L5 0 V14 M1 14 H9', '5': 'M9 0 H0 V7 H8 V14 H0'}
    return group(''.join(group(path(digits[c], 'none', PAPER, 2.5), i*14) for i, c in enumerate(str(n))), x, y, scale)


def composition(id):
    if id == 'win':
        return flag(57, 23) + ship()
    if id.startswith('win-'):
        n = {'win-three-player': 3, 'win-four-player': 4, 'win-five-player': 5}[id]
        s = ''
        # Separate company quay-and-office units; exactly n, not cargo counters.
        for i in range(n):
            a = -math.pi/2 + i*2*math.pi/n
            x, y = 64+39*math.cos(a), 62+37*math.sin(a)
            s += group(rect(-10, -9, 20, 18, PAPER) + rect(-6, -5, 4, 5, INK) + rect(2, -5, 4, 5, INK) + rect(-8, 9, 16, 8, GOLD), round(x, 2), round(y, 2))
        return s + group(ship(), 29, 16, .55) + group(flag(0, 0), 76, 35, .65)
    if id == 'debt-free-win':
        return group(ledger(), 49, 0, .68) + flag(27, 28) + group(ship(), 0, 23, .90)
    if id == 'debt-free':
        return ledger() + path('M26 37 H20 V103 H81 V107', 'none', TEAL, 3)
    if id.startswith('score-'):
        high = id == 'score-150'
        s = ''
        if high:
            s += factory(28, 20, .8) + factory(53, 14, .9) + factory(82, 24, .7)
        else:
            s += cargo(40, 26, 0, 22, 17) + rect(70, 26, 20, 17, GOLD) + path('M75 34 H85', 'none', INK)
        s += path('M22 52 L61 47 L64 52 L67 47 L106 52 V88 L67 83 L64 88 L61 83 L22 88 Z', PAPER, INK, 3)
        s += path('M64 54 V81 M30 61 H52 M30 71 H52 M76 61 H97 M76 71 H97', 'none', TEAL, 4)
        if high:
            s += rect(22, 87, 17, 7, GOLD) + rect(89, 87, 17, 7, GOLD)
        return s + number(150 if high else 100, 45, 96, .95)
    if id.endswith('factories'):
        n = 3 if id.startswith('three') else 4
        if n == 3:
            return path('M39 73 L64 40 L90 73 Z', 'none', TEAL, 5) + factory(52, 21) + factory(22, 69) + factory(82, 69)
        return path('M41 43 H86 V87 H41 Z', 'none', TEAL, 5) + ''.join(factory(x, y, .95) for x, y in [(26, 22), (78, 22), (26, 73), (78, 73)])
    if id.endswith('warehouses'):
        if id.startswith('three'):
            return path('M23 94 H106', 'none', GOLD, 5) + ''.join(warehouse(x, 48) for x in (20, 50, 80))
        return path('M39 41 H88 V90 H39 Z', 'none', GOLD, 5) + ''.join(warehouse(x, y, .75) for x, y in [(28, 26), (53, 21), (78, 26), (29, 76), (78, 76)])
    if id.startswith('island-'):
        s = path('M17 70 L27 40 L63 29 L101 44 L111 76 L95 96 L37 99 Z', TEAL, PAPER, 3)
        s += path('M21 104 H43 M85 104 H104', 'none', TEAL, 3)
        if id == 'island-diversity':
            for i, (x,y) in enumerate([(36,43), (67,43), (24,68), (54,68), (84,68)]):
                s += cargo(x,y,i,21,19,True)
        else:
            n = 15 if id == 'island-fifteen' else 10
            for i in range(n):
                s += cargo(27+(i%5)*15, 43+(i//5)*17, i%5, 13, 14)
            s += rect(47, 96, 35, 20, INK, INK, 0) + number(n, 51, 98)
        return s
    if id == 'full-ship':
        return ship(True) + path('M43 47 H104 M43 43 V51 M104 43 V51', 'none', GOLD, 3)
    if id == 'warehouse-five':
        s = path('M17 49 L64 24 L111 49 V99 H17 Z', PAPER, INK, 3)
        s += path('M25 49 H103 M24 93 H104', 'none', TEAL, 4)
        s += ''.join(cargo(24+i*16, 67, i, 15, 21) for i in range(5))
        return s
    raise ValueError(id)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    source = (ROOT / 'engine/src/achievements.ts').read_text()
    ids = re.findall(r"^    \['([^']+)',", source, re.M)
    assert len(ids) == 17 and len(set(ids)) == 17
    entries = []
    for id in ids:
        key = f'achievement-{id}'
        svg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 128 128">'
        svg += '<circle cx="64" cy="64" r="62" fill="'+INK+'" stroke="'+GOLD+'" stroke-width="3"/>'
        svg += composition(id) + '</svg>\n'
        (OUT / f'{key}.svg').write_text(svg)
        png = cairosvg.svg2png(bytestring=svg.encode(), output_width=256, output_height=256)
        (OUT / f'{key}.png').write_bytes(png)
        entries.append({'id': id, 'key': key, 'svg': f'{key}.svg', 'png': f'{key}.png', 'svgSha256': hashlib.sha256(svg.encode()).hexdigest(), 'pngSha256': hashlib.sha256(png).hexdigest()})
    manifest = {'game': 'container', 'engineVersion': '2.1.10', 'revision': 3, 'baseline': '99e60d5e8f4111f0435d9ea911e2431ec8ef2f7f', 'issue': 'https://codeberg.org/boardgamers/boardgamers/issues/595', 'license': 'MIT', 'provenance': 'Original programmatic geometric compositions; no external artwork or fonts. Palette follows the five ContainerColor identities in engine/src/gamestate.ts, not commercial artwork.', 'generator': 'scripts/generate-achievement-art.py', 'generatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'assets': entries}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=4)+'\n')
    for size in (32, 48, 64):
        row_h = max(58, size+12)
        sheet = Image.new('RGB', (880, row_h*len(entries)+34), '#c8cdd0')
        draw = ImageDraw.Draw(sheet)
        draw.text((12, 10), f'CONTAINER / {size}px actual size / light + dark circular badges', fill=INK)
        for i, entry in enumerate(entries):
            y = 34+i*row_h
            draw.rectangle((0,y,439,y+row_h), fill='#faf7ee')
            draw.rectangle((440,y,879,y+row_h), fill='#111a22')
            icon = Image.open(OUT/entry['png']).convert('RGBA').resize((size,size), Image.Resampling.LANCZOS)
            for x, textcolor in [(12,INK), (452,'#f5e8ce')]:
                sheet.paste(icon, (x,y+6), icon)
                draw.text((x+size+16,y+size//2), entry['id'], fill=textcolor)
        sheet.save(OUT / f'contact-sheet-{size}.png')
    print(f'Generated {len(entries)} original SVG + PNG pairs and 32/48/64px sheets in {OUT}')


if __name__ == '__main__':
    main()
