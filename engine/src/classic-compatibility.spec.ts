import { expect } from 'chai';
import { createHash } from 'crypto';
import seedrandom from 'seedrandom';
import * as wrapper from '../wrapper';

// Captured by running unmodified commit 93194c8 in isolation, before this expansion.
// Hash the complete serialized state, including logs and deterministic piece IDs.
const baselines = [
    [
        3,
        102,
        '1a0a53979c32085df8942e94dce769464772f8653050920f58b8a031360ad890',
        'd6e2d9344f775d813ffd33ba3a9ed0f6e781c37aa7f7153da5912cfee89d95ed',
    ],
    [
        4,
        187,
        'e958f1b8bdbe051a77a8440ae8c34384cf640ecf5c6c07ef1e398269acab6ef8',
        'bc2afe3eafcf6c38e433c5ee24abb9417b0c1bf56ac5110759c50f6ddc3451ca',
    ],
    [
        5,
        293,
        '5f74b35334a567ace31e59eaf988b01c374b4a74de244a631ef4d9afae91d44c',
        'b46c3c6e18635c10b5c68f5d7af1373bebab7f0de415f0d85a0995aa02e19cc5',
    ],
] as const;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('classic compatibility with pre-expansion release', () => {
    for (const [players, expectedTurns, initialHash, finalHash] of baselines) {
        it(`preserves the full seeded ${players}-player setup, game and replay`, async () => {
            const seed = `achievements-${players}`;
            const random = Math.random;
            Math.random = seedrandom(seed);
            try {
                let state = await wrapper.init(players, [], {}, seed);
                expect(digest(state)).to.equal(initialHash);
                let turns = 0;
                while (!wrapper.ended(state) && turns++ < 20000) {
                    state = wrapper.moveAI(state, state.currentPlayers[0]);
                }
                expect(wrapper.ended(state)).to.equal(true);
                expect(turns).to.equal(expectedTurns);
                expect(digest(state)).to.equal(finalHash);
                expect(digest(wrapper.replay(JSON.parse(JSON.stringify(state))))).to.equal(finalHash);
            } finally {
                Math.random = random;
            }
        });
    }
});
