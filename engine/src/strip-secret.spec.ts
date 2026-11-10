import { expect } from 'chai';
import { cloneDeep } from 'lodash';
import { logSlice } from '../wrapper';
import { availableMoves } from './available-moves';
import { bidRevision } from './choice-revisions';
import { move, setup, stripSecret } from './engine';
import { GameState, Phase } from './gamestate';
import { Move, MoveName } from './move';

const bid = (price: number, revision?: string): Move => ({
    name: MoveName.Bid,
    data: true,
    extraData: { price },
    ...(revision ? { revision } : {}),
});

function auction() {
    const state = setup(3, {}, 'strip-secret');
    state.phase = Phase.Bid;
    state.auctioningPlayer = 0;
    state.currentPlayers = [1, 2];
    state.players.forEach((player) => (player.availableMoves = availableMoves(state, player)));
    return state;
}

function assertSealed(state: GameState, price: number, additional: boolean) {
    const before = cloneDeep(state);
    // Auctioneer, competing bidder, and spectator; also exercise serialized log responses.
    for (const viewer of [0, 2, undefined]) {
        for (const view of [stripSecret(state, viewer), logSlice(state, { player: viewer }).state]) {
            const serialized = JSON.parse(JSON.stringify(view)) as GameState;
            expect(serialized.players[1].lastMove).to.equal(null);
            expect(serialized.players[1][additional ? 'additionalBid' : 'bid']).to.equal(0);
            expect(serialized.hiddenLog).to.deep.equal([]);
            expect(serialized.log.some((entry) => entry.type === 'move' && entry.move.name === MoveName.Bid)).to.equal(
                false
            );
            if (additional) expect(serialized.players[1].bid).to.equal(7);
        }
    }
    expect(stripSecret(state, 1).players[1].lastMove).to.deep.equal(bid(price));
    expect(stripSecret(state, 1).players[1][additional ? 'additionalBid' : 'bid']).to.equal(price);
    expect(state).to.deep.equal(before);
}

describe('stripSecret sealed bids', () => {
    it('hides initial and revised bids from opponents and spectators', () => {
        const state = auction();
        move(state, bid(6), 1);
        assertSealed(state, 6, false);
        move(state, bid(7, bidRevision(state, 1)), 1);
        assertSealed(state, 7, false);
    });

    it('hides additional and revised tie-break bids even after initial bids are public', () => {
        const state = auction();
        move(state, bid(7), 1);
        move(state, bid(7), 2);
        expect(state.players[1].showBid).to.equal(true);
        move(state, bid(3), 1);
        assertSealed(state, 3, true);
        move(state, bid(4, bidRevision(state, 1)), 1);
        assertSealed(state, 4, true);
        move(state, bid(2), 2);
        for (const viewer of [0, 2, undefined]) {
            const view = stripSecret(state, viewer);
            expect(view.players[1].bid).to.equal(7);
            expect(view.players[1].additionalBid).to.equal(4);
            expect(view.log).to.deep.equal(state.log);
            expect(
                view.log.filter((entry) => entry.type === 'move' && entry.move.name === MoveName.Bid)
            ).to.have.length(4);
        }
    });

    it('preserves non-bid last moves', () => {
        const state = setup(3, {}, 'strip-secret-public');
        state.players[1].lastMove = { name: MoveName.Pass, data: true };
        expect(stripSecret(state).players[1].lastMove).to.deep.equal(state.players[1].lastMove);
    });
});
