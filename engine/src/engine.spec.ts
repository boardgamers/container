import { expect } from 'chai';
import { ended, move, setup } from './engine';
import AbstractJudge from './fixtures/Abstract-judge-7215.json';
import type { Move } from './move';

describe('Engine', () => {
    it('should setup a game correctly', () => {
        const G = setup(5, { beginner: false }, 'test');

        expect(G.factoriesLeft[0].id).to.equal('F1');
        expect(G.factoriesLeft).to.have.length(20);
        expect(G.players[0].factories[0].id).to.equal('F5');
        expect(G.players[1].factories[0].id).to.equal('F15');
        expect(G.players[2].factories[0].id).to.equal('F10');
        expect(G.players[3].factories[0].id).to.equal('F20');
        expect(G.players[4].factories[0].id).to.equal('F0');
    });

    it('should play full game', () => {
        let G = setup(5, { beginner: AbstractJudge.options.beginner }, AbstractJudge.seed);

        for (const item of AbstractJudge.log) {
            if (item.type === 'move') {
                G = move(G, item.move! as Move, item.player!);
            }
        }

        expect(G.currentPlayers).to.deep.equal([0]);
        expect(ended(G)).to.be.false;
    });
});
