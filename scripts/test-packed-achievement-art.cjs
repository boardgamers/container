// Usage: node scripts/test-packed-achievement-art.cjs /absolute/path/to/extracted/package
// The extracted package needs its installed runtime dependencies resolvable.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const packed = path.resolve(process.argv[2]);
const hooks = require(path.join(packed, 'dist/wrapper.js'));
const { setup } = require(path.join(packed, 'dist/index.js'));
const manifest = require(path.join(root, 'docs/achievement-art/manifest.json'));
assert.equal(require(path.join(packed, 'package.json')).version, manifest.engineVersion);
const definitions = hooks.achievementDefinitions();
assert.equal(definitions.revision, manifest.revision);
assert.deepEqual(
    definitions.achievements.map((a) => a.id),
    manifest.assets.map((a) => a.id)
);
for (const a of definitions.achievements) {
    assert.deepEqual(a.icon, { type: 'asset', key: `achievement-${a.id}` });
    assert.ok(fs.existsSync(path.join(root, 'docs/achievement-art', `${a.icon.key}.png`)));
}
const seedrandom = require(path.join(root, 'engine/node_modules/seedrandom'));
for (const n of [3, 4, 5]) {
    const previous = Math.random;
    Math.random = seedrandom(`art-packed-${n}`);
    try {
        let game = setup(n, {}, `art-packed-${n}`);
        for (let i = 0; i < 20000 && !hooks.ended(game); i++) {
            game = hooks.moveAI(game, game.currentPlayers[0]);
        }
        assert.ok(hooks.ended(game));
        const serialized = JSON.stringify(game);
        const awards = hooks.achievements(JSON.parse(serialized));
        assert.equal(awards.length, n);
        assert.deepEqual(hooks.achievements(hooks.replay(game)), awards);
        assert.equal(JSON.stringify(game), serialized);
        for (const row of awards) {
            for (const id of row.earned) assert.ok(manifest.assets.some((a) => a.id === id));
        }
    } finally {
        Math.random = previous;
    }
}
console.log(
    'PASS: exact extracted 2.1.10 package, revision 3, all 17 asset refs, legal 3/4/5-player completion and replay'
);
