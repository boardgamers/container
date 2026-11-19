#!/usr/bin/env python3
"""Verify artwork bytes, dimensions, coverage, and unchanged authoritative rules."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/achievement-art'
manifest = json.loads((OUT / 'manifest.json').read_text())
source = (ROOT / 'engine/src/achievements.ts').read_text()
baseline = subprocess.check_output(['git', 'show', manifest['baseline']+':engine/src/achievements.ts'], cwd=ROOT, text=True)
# Historical definitions stay byte-for-byte; strip only the two additive expansion rules
# before comparing the full historical evaluator. Artwork provenance remains revision 3.
assert source.split('export function achievementDefinitions')[0] == baseline.split('export function achievementDefinitions')[0]
historical_evaluator = re.sub(
    r"                \['offshore-win',.*?\n                \],\n",
    '', source.split('/** Money is already')[1], flags=re.S)
assert historical_evaluator == baseline.split('/** Money is already')[1]
ids = re.findall(r"^    \['([^']+)',", source, re.M)
assert [a['id'] for a in manifest['assets']] == ids
assert len(ids) == len(set(ids)) == 17
assert 'island-fifteen' in ids and not {'island-five', 'warehouse-six'} & set(ids)
assert manifest['revision'] == 3 and manifest['engineVersion'] == '2.1.10'
# This manifest attests the historical artwork release, not the current engine version.
assert hashlib.sha256((ROOT/manifest['generator']).read_bytes()).hexdigest() == manifest['generatorSha256']
hashes = set()
for a in manifest['assets']:
    assert a['key'] == 'achievement-'+a['id']
    for ext in ('svg', 'png'):
        file = OUT / a[ext]
        assert file.name == a['key']+'.'+ext
        assert hashlib.sha256(file.read_bytes()).hexdigest() == a[ext+'Sha256']
    with Image.open(OUT/a['png']) as im:
        im.load()
        assert im.size == (256, 256) and im.mode == 'RGBA'
        assert im.getpixel((0,0))[3] == 0
        hashes.add(hashlib.sha256(im.tobytes()).hexdigest())
assert len(hashes) == 17
for size in (32,48,64):
    with Image.open(OUT/f'contact-sheet-{size}.png') as im:
        im.load()
        assert im.width == 880
print('PASS: 17 historical IDs and base evaluator unchanged; refs, source hashes, unique decoded 256px assets, 32/48/64px sheets')
