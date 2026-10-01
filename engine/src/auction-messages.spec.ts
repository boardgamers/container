import { expect } from 'chai';
import { cloneDeep } from 'lodash';
import * as wrapper from '../wrapper';
import { availableMoves } from './available-moves';
import { setup } from './engine';
import { Phase, ShipPosition } from './gamestate';
import { LogMove } from './log';
import { MoveName } from './move';

function auction(bid = 7, additionalBid = 3) {
    const state = setup(3, {}, 'auction-messages');
    state.phase = Phase.AcceptDecline;
    state.currentPlayers = [0];
    state.auctioningPlayer = 0;
    state.highestBidders = [1];
    state.players[0].name = 'slim_shagen';
    state.players[1].name = 'coyotte508';
    state.players[0].ship.shipPosition = ShipPosition.Island;
    state.players[0].ship.containers = [state.containersLeft.pop()!];
    state.players[1].bid = bid;
    state.players[1].additionalBid = additionalBid;
    state.players.forEach((player) => (player.availableMoves = availableMoves(state, player)));
    return state;
}

describe('Auction results in journal and chat', () => {
    for (const [bid, additionalBid] of [
        [7, 3],
        [7, 0],
        [0, 0],
    ]) {
        it(`reports the accepted total ${bid + additionalBid} before clearing bids`, async () => {
            const state = await wrapper.move(auction(bid, additionalBid), { name: MoveName.Accept, data: 1 }, 0);
            const entry = state.log[state.log.length - 1] as LogMove;
            expect(entry.simple).to.equal(
                `slim_shagen accepts coyotte508's bid of $${bid + additionalBid} and receives $${
                    2 * (bid + additionalBid)
                }`
            );
            expect(entry.pretty).to.contain(`bid of $${bid + additionalBid}`);
            expect(state.players[1].bid).to.equal(0);
            expect(state.players[1].additionalBid).to.equal(0);
            const result = wrapper.messages(state);
            expect(result.messages).to.deep.equal([entry.simple]);
            expect(wrapper.messages(result.data).messages).to.deep.equal([]);
            expect(state.pendingMessages).to.deep.equal([entry.simple]);
        });
    }

    it('announces a self-purchase and its cost', async () => {
        const state = await wrapper.move(auction(), { name: MoveName.Decline, data: true }, 0);
        expect(wrapper.messages(state).messages).to.deep.equal([
            'slim_shagen declines all bids and buys the cargo for $10',
        ]);
    });

    it('does not backfill old auctions or expose an unresolved bid', () => {
        const state = auction();
        expect(wrapper.messages(state).messages).to.deep.equal([]);
        state.log.push({
            type: 'move',
            player: 0,
            move: { name: MoveName.Accept, data: 1 },
            simple: 'Old auction',
            pretty: 'Old auction',
        });
        expect(wrapper.messages(state).messages).to.deep.equal([]);
        state.pendingMessages = ['Pending'];
        state.newTurn = false;
        expect(wrapper.messages(state)).to.deep.equal({ messages: [], data: state });
    });

    it('does not manufacture announcements when replaying history', () => {
        const state = setup(3, {}, 'auction-replay');
        state.pendingMessages = ['Still pending'];
        expect(wrapper.replay(cloneDeep(state)).pendingMessages).to.deep.equal(['Still pending']);
        const acknowledged = wrapper.messages(state).data;
        expect(wrapper.messages(wrapper.replay(acknowledged)).messages).to.deep.equal([]);
    });
});
