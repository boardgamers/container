import { expect } from 'chai';
import { cloneDeep } from 'lodash';
import seedrandom from 'seedrandom';
import * as wrapper from '../wrapper';
import { bidRevision } from './choice-revisions';
import { setup } from './engine';
import { GameState, Phase } from './gamestate';
import { Move, MoveName } from './move';

const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const bid = (price: number): Move => ({ name: MoveName.Bid, data: true, extraData: { price } });
const getLoan: Move = { name: MoveName.GetLoan, data: true };

/** Run `play` with a seeded Math.random, so that the AI's choices are reproducible. */
function seeded<T>(seed: string, play: () => T): T {
    const random = Math.random;
    Math.random = seedrandom(seed);
    try {
        return play();
    } finally {
        Math.random = random;
    }
}

/**
 * A game against bots, saved like BGS saves it: committed states only, as JSON, with their
 * announcements posted. Each saved move of the human records an undo point (the log length
 * before it). `positions` keeps the first saved state reaching each visible log length with
 * no sealed bid pending: the state that this much of the log describes.
 */
class BotGame {
    saved!: GameState;
    positions = new Map<number, GameState>();
    undoPoints: number[] = [];

    constructor(players: number, seed: string, readonly human = 0) {
        const G = setup(players, {}, seed);
        G.players.forEach((player) => (player.name = player.id === human ? 'Human' : `Bot ${player.id}`));
        this.save(G);
    }

    save(state: GameState | undefined) {
        expect(state, 'a committed state').to.not.equal(undefined);
        this.saved = json(wrapper.messages(state!).data);
        const length = wrapper.logLength(this.saved);
        if (this.saved.hiddenLog.length === 0 && !this.positions.has(length)) this.positions.set(length, this.saved);
    }

    /** A saved move of the human. */
    async play(moves: Move | Move[]) {
        const before = wrapper.logLength(this.saved);
        this.save(wrapper.toSave(await wrapper.move(cloneDeep(this.saved), moves, this.human)));
        this.undoPoints.push(before);
    }

    /** One saved move, by the AI: for the human when they are due, else for a bot. */
    step() {
        const seat = this.saved.currentPlayers.includes(this.human) ? this.human : this.saved.currentPlayers[0];
        const before = wrapper.logLength(this.saved);
        this.save(wrapper.toSave(wrapper.moveAI(cloneDeep(this.saved), seat)));
        if (seat === this.human) this.undoPoints.push(before);
    }

    /** A bot plays until it is no longer due, e.g. until it has placed its sealed bid. */
    bot(seat: number) {
        expect(seat).to.not.equal(this.human);
        for (let i = 0; i < 10 && this.saved.currentPlayers.includes(seat); i++) {
            this.save(wrapper.toSave(wrapper.moveAI(cloneDeep(this.saved), seat)));
        }
        expect(this.saved.currentPlayers).to.not.include(seat);
    }

    /** Play on until an auction opens in which the human bids along with two bots. */
    untilAuction() {
        for (let i = 0; i < 2000; i++) {
            const G = this.saved;
            if (G.phase === Phase.Bid && !G.hiddenLog.length && G.currentPlayers.includes(this.human)) {
                expect(G.currentPlayers).to.have.length(3);
                return G.currentPlayers.filter((seat) => seat !== this.human);
            }
            expect(wrapper.ended(G), 'an auction comes up first').to.equal(false);
            this.step();
        }
        throw new Error('No auction came up');
    }

    /** BGS's undo route: back to the last undo point, saved as a regular turn. */
    undo() {
        const to = this.undoPoints.pop()!;
        const state = wrapper.replay(this.saved, { to });
        expect(wrapper.logLength(state)).to.equal(to);
        expect(wrapper.isLiveUpdate(state), 'a turn: BGS then lets the bots due play').to.equal(false);
        this.save(wrapper.toSave(state));
        this.undoPoints = this.undoPoints.filter((point) => point < to);
        return this.saved;
    }
}

describe('replay to an earlier position (undo against bots)', () => {
    it('rebuilds each saved position, `to` entries long, without touching the game', () => {
        const game = seeded('replay-positions', () => {
            const game = new BotGame(4, 'replay-positions');
            for (let i = 0; i < 400 && !wrapper.ended(game.saved); i++) game.step();
            return game;
        });
        const saved = [...game.positions.values()];
        expect(saved.length).to.be.greaterThan(80);
        expect(saved.some((G) => G.phase === Phase.Bid)).to.equal(true, 'auction openings');
        expect(saved.some((G) => G.phase === Phase.AcceptDecline)).to.equal(true, 'bids revealed');
        expect(saved.some((G) => G.round > 5)).to.equal(true, 'later rounds');

        const final = game.saved;
        const before = json(final);
        for (const [to, position] of game.positions) {
            const replayed = wrapper.replay(final, { to });
            expect(wrapper.logLength(replayed)).to.equal(to);
            expect(json(replayed), `position ${to}`).to.deep.equal(position);
        }
        expect(json(final)).to.deep.equal(before);

        const replayed = wrapper.replay(final, { to: final.log.length });
        for (const entry of replayed.log) if (entry.type === 'move') entry.move.name = 'changed' as never;
        expect(json(final), 'the result shares nothing with the input').to.deep.equal(before);
    });

    it('reopens a running auction without its sealed bids and bid-phase loans, playable by all', async () => {
        const game = new BotGame(4, 'replay-auction');
        const [first, second] = seeded('replay-auction', () => game.untilAuction());
        const opening = game.saved;
        const length = wrapper.logLength(opening);
        const human = opening.players[game.human];

        seeded('replay-auction-bot', () => game.bot(first));
        expect(game.saved.players[game.human].availableMoves).to.have.property(MoveName.GetLoan);
        await game.play(getLoan);
        await game.play(bid(3));
        expect(game.saved.phase).to.equal(Phase.Bid);
        expect(game.saved.currentPlayers).to.deep.equal([second]);
        expect(game.saved.hiddenLog.length).to.be.at.least(3);
        expect(wrapper.logLength(game.saved), 'sealed bids stay out of the visible log').to.equal(length);
        const undoPoints = game.undoPoints.slice();

        const reopened = game.undo();
        expect(reopened).to.deep.equal(opening);
        expect(reopened.hiddenLog).to.deep.equal([]);
        expect(reopened.currentPlayers).to.have.members([game.human, first, second]);
        expect(reopened.players.map((p) => [p.bid, p.additionalBid, p.showBid])).to.deep.equal(
            reopened.players.map(() => [0, 0, false])
        );
        expect(reopened.players[game.human].loans).to.deep.equal(human.loans);
        expect(reopened.players[game.human].money).to.equal(human.money);
        expect(game.undoPoints, 'the loan is taken back with the bid').to.deep.equal(undoPoints.slice(0, -2));

        // The human bids again, the bots bid again and the auctioneer decides: play goes on.
        expect(reopened.players[game.human].availableMoves).to.have.property(MoveName.Bid);
        await game.play(bid(2));
        seeded('replay-auction-after', () => {
            for (const seat of [first, second]) game.bot(seat);
            for (let i = 0; i < 60 && !wrapper.ended(game.saved); i++) game.step();
        });
        const settled = game.saved.log
            .slice(length)
            .filter((entry) => entry.type === 'move' && [MoveName.Accept, MoveName.Decline].includes(entry.move.name));
        expect(settled.length, 'the reopened auction and later ones are settled').to.be.at.least(2);
        expect(wrapper.logLength(game.saved)).to.be.greaterThan(length + 20);
    });

    it('takes back a replaced sealed bid as a regular turn', async () => {
        const game = new BotGame(4, 'replay-revision');
        const [first, second] = seeded('replay-revision', () => game.untilAuction());
        await game.play(bid(3));
        await game.play({ ...bid(1), revision: bidRevision(game.saved, game.human) });
        expect(wrapper.isLiveUpdate(game.saved)).to.equal(true);
        expect(wrapper.replay(game.saved).liveUpdate, 'a full replay keeps the live update').to.equal(true);

        const reopened = game.undo();
        expect(reopened.players[game.human].bid).to.equal(0);
        expect(reopened.currentPlayers).to.have.members([game.human, first, second]);
        expect(game.undoPoints.every((point) => point < wrapper.logLength(reopened))).to.equal(true);
    });

    it('rejects positions outside the visible log', () => {
        const G = setup(3, {}, 'replay-bounds');
        expect(G.log).to.have.length(1);
        for (const to of [-1, 2, 0.5, NaN, Infinity]) {
            expect(() => wrapper.replay(G, { to }), String(to)).to.throw('Invalid history position');
        }
        // The initial position: its log already holds the game start.
        expect(json(wrapper.replay(G, { to: 0 }))).to.deep.equal(json(G));
        expect(json(wrapper.replay(G, { to: 1 }))).to.deep.equal(json(G));
    });

    it('keeps the full replay, sealed bids, live update and announcements included, without `to`', async () => {
        const game = new BotGame(4, 'replay-full');
        seeded('replay-full', () => game.untilAuction());
        await game.play(bid(3));
        await game.play({ ...bid(2), revision: bidRevision(game.saved, game.human) });
        const G = { ...game.saved, pendingMessages: ['Bot 1 accepts Bot 2’s bid of $4 and receives $8'] };
        expect(json(wrapper.replay(G))).to.deep.equal(json(G));
        for (const options of [undefined, {}, { to: undefined }]) {
            expect(json(wrapper.replay(G, options))).to.deep.equal(json(wrapper.replay(G)));
        }
        // An earlier position, even at the same visible length, has neither of them.
        const earlier = wrapper.replay(G, { to: wrapper.logLength(G) });
        expect(earlier).to.not.have.property('pendingMessages');
        expect(earlier.liveUpdate).to.equal(false);
    });
});
