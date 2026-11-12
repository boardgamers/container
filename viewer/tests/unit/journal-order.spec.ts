import Game from '@/components/Game.vue';
import { journalOrder } from '@/journal-order';
import { expect } from 'chai';
import { LogItem, LogMove } from 'container-engine/src/log';
import { MoveName } from 'container-engine/src/move';

const bid = (player: number, amount: number, additional = false): LogMove => ({
    type: 'move',
    player,
    move: { name: MoveName.Bid, data: true, extraData: { price: amount } },
    simple: `${player} bids ${additional ? 'additional ' : ''}$${amount}`,
    pretty: `${player} bids ${additional ? 'additional ' : ''}$${amount}`,
});

describe('sealed bid journal order', () => {
    it('sorts by seat rather than submission or amount without mutating replay history', () => {
        const log = [bid(3, 0), bid(2, 8), bid(0, 4)];
        const before = JSON.stringify(log);
        expect(journalOrder(log)).to.deep.equal([log[2], log[1], log[0]]);
        expect(JSON.stringify(log)).to.equal(before);
    });

    it('keeps initial and additional rounds separate and loans in their original slots', () => {
        const loan: LogMove = {
            type: 'move',
            player: 2,
            move: { name: MoveName.GetLoan, data: true },
            simple: 'loan',
            pretty: 'loan',
        };
        const log = [bid(3, 5), loan, bid(2, 5), bid(0, 0), bid(3, 0, true), bid(2, 2, true)];
        expect(journalOrder(log)).to.deep.equal([log[3], loan, log[2], log[0], log[5], log[4]]);
    });

    it('does not mix successive auctions or other actions', () => {
        const accept: LogMove = {
            type: 'move',
            player: 0,
            move: { name: MoveName.Accept, data: 1 },
            simple: 'accept',
            pretty: 'accept',
        };
        const log: LogItem[] = [bid(2, 4), bid(1, 8), accept, bid(2, 3), bid(1, 2)];
        expect(journalOrder(log)).to.deep.equal([log[1], log[0], accept, log[4], log[3]]);
        expect(journalOrder([])).to.deep.equal([]);
    });

    it('uses seat order in both the inline journal and plain-text platform log', () => {
        const options = (Game as any).options;
        const log = [bid(2, 0), bid(1, 7)];
        const context = { G: { log }, preferences: { colorBlind: false }, playerColors: [] };
        for (const name of ['logReversed', 'logReversedSimple']) {
            const entries = options.computed[name].get.call(context).reverse();
            expect(entries).to.have.length(2);
            expect(entries[0]).to.contain(log[1].simple);
            expect(entries[1]).to.contain(log[0].simple);
        }
    });
});
