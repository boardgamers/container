import Game from '@/components/Game.vue';
import { expect } from 'chai';
const options = (Game as any).options;
describe('bid revision controls', () => {
    it('prefills the additional amount during a tied auction', () => {
        const context = { player: 0, G: { highestBidders: [0, 1], players: [{ bid: 5, additionalBid: 2 }] } };
        expect(options.computed.submittedBid.get.call(context)).to.equal(2);
    });
    it('keeps the total-bid confirmation when revising an additional bid', () => {
        const sent: any[] = [];
        const context: any = {
            player: 0,
            G: { highestBidders: [0, 1], players: [{ bid: 5 }] },
            changingBid: true,
            editingBid: 'tie-1',
            revisableBid: 'tie-1',
            sendMove: (move: any) => sent.push(move),
        };
        options.methods.bid.call(context, 3);
        expect(context.confirmBidVisible).to.equal(true);
        expect(context.totalBid).to.equal(8);
        expect(sent).to.have.length(0);
        options.methods.confirmBid.call(context);
        expect(sent[0]).to.include({ revision: 'tie-1' });
        expect(sent[0].extraData.price).to.equal(3);
        expect(context.editingBid).to.equal(null);
    });
    it('does not send a revision if the auction changes during confirmation', () => {
        const context = {
            confirmBidRevision: 'old',
            revisableBid: 'new',
            sendMove: () => {
                throw new Error('stale revision');
            },
        };
        options.methods.confirmBid.call(context);
    });
});
