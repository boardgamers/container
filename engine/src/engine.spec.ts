import { expect } from 'chai';
import { cloneDeep, range } from 'lodash';
import { ended, move, setup } from './engine';
import AbstractJudge from './fixtures/Abstract-judge-7215.json';
import { GameEventName } from './log';
import type { Move } from './move';
import { MoveName } from './move';

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

    it('should seize upkeep containers deterministically from the game seed', () => {
        const base = setup(2, {}, 'upkeep-seed-test');
        const A = base.currentPlayers[0];
        const B = 1 - A;

        // Force B into upkeep debt: two loans, no money, and a pile of island
        // containers for the bank to pick from
        base.players[B].loans = base.loansLeft.splice(0, 2);
        base.players[B].money = 0;
        base.players[B].containersOnIsland = base.containersLeft.splice(0, 12);

        // A's pass hands the turn to B and runs B's upkeep, seizing two random
        // containers. Same seed + same history ⇒ the same containers, every time.
        const results = range(5).map(() => move(cloneDeep(base), { name: MoveName.Pass, data: true }, A));

        expect(results[0].players[B].containersOnIsland).to.have.length(10);
        expect(
            results[0].log.filter((item) => item.type === 'event' && item.event.name === GameEventName.Upkeep)
        ).to.have.length(2);

        for (const result of results.slice(1)) {
            expect(JSON.parse(JSON.stringify(result))).to.deep.equal(JSON.parse(JSON.stringify(results[0])));
        }
    });
});
