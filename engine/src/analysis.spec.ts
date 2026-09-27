import { expect } from 'chai';
import { cloneDeep } from 'lodash';
import * as wrapper from '../wrapper';
import { setup } from './engine';
import { Phase } from './gamestate';

describe('safe ongoing analysis', () => {
    it('depends only on observation and the simulation seed', () => {
        const original = setup(3, {}, 'source-secret');
        const before = cloneDeep(original);
        const other = cloneDeep(original);
        other.seed = 'different';
        other.hiddenLog = [{ type: 'move', player: 1, move: { name: 'secret' } } as any];
        other.players.slice(1).forEach((p) => {
            p.money = 99999;
            p.pointCard = null;
            p.bid = 987;
            p.additionalBid = 654;
            p.lastMove = { name: 'secret' } as any;
        });
        const a = wrapper.createAnalysisScenario(original, { player: 0, seed: 'simulation' });
        expect(a).to.deep.equal(wrapper.createAnalysisScenario(other, { player: 0, seed: 'simulation' }));
        expect(original).to.deep.equal(before);
        expect(a.players[0].pointCard).to.deep.equal(original.players[0].pointCard);
        expect(a.players[0].money).to.equal(original.players[0].money);
        expect(JSON.stringify(a)).not.to.contain('source-secret');
        expect(a).not.to.deep.equal(wrapper.createAnalysisScenario(original, { player: 0, seed: 'another' }));
        for (let i = 0; i < 50 && !wrapper.ended(a); i++) wrapper.moveAI(a, a.currentPlayers[0]);
        expect(a.round).to.be.greaterThan(1);
    });
});

describe('observer and pending auctions', () => {
    it('does not use hidden bids, cash, objectives, or logs', () => {
        const original = setup(3, {}, 'private');
        original.phase = Phase.Bid;
        original.auctioningPlayer = 0;
        original.currentPlayers = [2];
        original.players[1].bid = 10;
        const other = cloneDeep(original);
        other.players.forEach((p) => {
            p.pointCard = null;
            p.money = 999;
            p.bid = 999;
            p.additionalBid = 999;
        });
        const a = wrapper.createAnalysisScenario(original, { seed: 'same' });
        expect(a).to.deep.equal(wrapper.createAnalysisScenario(other, { seed: 'same' }));
        expect(a.players.every((p) => p.money >= p.bid + p.additionalBid)).to.equal(true);
        const b = wrapper.createAnalysisScenario(a, { seed: 'new' });
        expect(b.analysisCash).to.deep.equal(a.analysisCash);
        wrapper.moveAI(b, 2);
        expect(b.currentPlayers.length).to.be.greaterThan(0);
    });
});
