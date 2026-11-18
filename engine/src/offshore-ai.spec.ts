import { expect } from 'chai';
import seedrandom from 'seedrandom';
import * as wrapper from '../wrapper';
import { MoveName } from './move';

const json = (value: unknown) => JSON.parse(JSON.stringify(value));

describe('Off-Shore Bank bots', () => {
    for (const seats of [3, 4, 5]) {
        it(`completes and replays a serialized ${seats}-seat game with bank participation`, async function () {
            this.timeout(30000);
            const random = Math.random;
            const seed = `offshore-ai-${seats}`;
            Math.random = seedrandom(seed);
            try {
                let state = await wrapper.init(seats, [], { offshoreIsland: true }, seed);
                let turns = 0;
                while (!wrapper.ended(state) && turns++ < 3000) {
                    state = wrapper.moveAI(state, state.currentPlayers[0]);
                    const saved = wrapper.toSave(state);
                    expect(saved, 'every bot turn commits').not.equal(undefined);
                    state = json(saved);
                }
                expect(wrapper.ended(state), `finished after ${turns} turns`).equal(true);
                const calls = state.log.filter((l) => l.type === 'move' && l.move.name === MoveName.CallBank);
                expect(calls.length, 'bots start and compete in auctions').greaterThan(2);
                expect(
                    state.log.some((l) => l.type === 'move' && l.move.name === MoveName.LoadBankContainer),
                    'collect won cargo'
                ).equal(true);
                expect(state.players.reduce((sum, p) => sum + p.offshoreStats!.containerAuctionsWon, 0)).greaterThan(0);
                expect(state.players.reduce((sum, p) => sum + p.offshoreStats!.cashAuctionsWon, 0)).greaterThan(0);
                expect(
                    state.log.some(
                        (l) =>
                            l.type === 'move' && l.move.name === MoveName.CallBank && (l.move.extraData.cash || 0) > 1
                    ),
                    'raises a public cash bid'
                ).equal(true);
                expect(json(wrapper.replay(json(state)))).deep.equal(state);
            } finally {
                Math.random = random;
            }
        });
    }
});
