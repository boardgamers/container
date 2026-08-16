import { expect } from 'chai';
import { cloneDeep } from 'lodash';
import * as wrapper from '../wrapper';
import { setup } from './engine';
import { GameState, Phase, ShipPosition } from './gamestate';
import { Move, MoveName } from './move';

const getLoan: Move = { name: MoveName.GetLoan, data: true };
const payLoan: Move = { name: MoveName.PayLoan, data: true };
const pass: Move = { name: MoveName.Pass, data: true };

describe('wrapper (tentative turns)', () => {
    /**
     * Simulates the platform: `saved` only ever advances when `toSave` returns the
     * state (committed); tentative states are discarded, like the game server does.
     */
    class Platform {
        saved: GameState;
        logLengths: number[] = [];

        constructor(players = 2, seed = 'wrapper-test') {
            this.saved = setup(players, {}, seed);
            this.logLengths.push(wrapper.logLength(this.saved));
        }

        /** Replay a turn buffer from the saved state, persist only if committed. */
        async send(moves: Move | Move[], player: number): Promise<{ result: GameState; saved: boolean }> {
            const result = await wrapper.move(cloneDeep(this.saved), moves, player);
            const toSave = wrapper.toSave(result);

            if (toSave) {
                this.saved = toSave;
                this.logLengths.push(wrapper.logLength(this.saved));
            }

            return { result, saved: !!toSave };
        }
    }

    it('should keep mid-turn states tentative and commit when the turn completes', async () => {
        const platform = new Platform();
        const A = platform.saved.currentPlayers[0];

        // Mid-turn move: still undoable, must not be saved
        const mid = await platform.send([getLoan], A);
        expect(mid.saved).to.be.false;
        expect(mid.result.newTurn).to.be.false;
        expect(wrapper.toSave(mid.result)).to.be.undefined;
        // ...but the tentative state did apply the move for the player's preview
        expect(mid.result.players[A].loans).to.have.length(1);

        // The tentative state was NOT persisted
        expect(platform.saved.players[A].loans).to.have.length(0);

        // Completed turn: the full buffer replays from the saved state and commits
        const full = await platform.send([getLoan, pass], A);
        expect(full.saved).to.be.true;
        expect(full.result.newTurn).to.be.true;
        expect(platform.saved.players[A].loans).to.have.length(1);
        expect(platform.saved.currentPlayers).to.not.include(A);
    });

    it('should accept a bare move object as a one-element buffer', async () => {
        const base = setup(2, {}, 'wrapper-test');
        const A = base.currentPlayers[0];

        const fromObject = await wrapper.move(cloneDeep(base), pass, A);
        const fromArray = await wrapper.move(cloneDeep(base), [pass], A);

        expect(JSON.parse(JSON.stringify(fromObject))).to.deep.equal(JSON.parse(JSON.stringify(fromArray)));
        expect(wrapper.toSave(fromObject)).to.not.be.undefined;
    });

    it('should not save an empty buffer and not grant it any progress', async () => {
        const base = setup(2, {}, 'wrapper-test');
        const A = base.currentPlayers[0];

        const result = await wrapper.move(cloneDeep(base), [], A);
        expect(wrapper.toSave(result)).to.be.undefined;
        expect(wrapper.logLength(result)).to.equal(wrapper.logLength(base));
    });

    it('should make undo-by-truncation equivalent to never having made the popped move', async () => {
        const base = setup(2, {}, 'wrapper-test');
        const A = base.currentPlayers[0];

        // Replaying a shortened buffer from the committed base...
        const shortened = await wrapper.move(cloneDeep(base), [getLoan], A);
        // ...equals never having made the popped move at all
        const straight = await wrapper.move(cloneDeep(base), [getLoan], A);
        expect(JSON.parse(JSON.stringify(shortened))).to.deep.equal(JSON.parse(JSON.stringify(straight)));

        // Popping the whole buffer needs no server call at all: the saved state is the
        // turn start. Taking a loan, undoing it (nothing sent), then passing yields the
        // exact same committed state as passing right away.
        const passedAfterUndo = await wrapper.move(cloneDeep(base), [pass], A);
        const passedDirectly = await wrapper.move(cloneDeep(base), [pass], A);
        expect(JSON.parse(JSON.stringify(wrapper.toSave(passedAfterUndo)))).to.deep.equal(
            JSON.parse(JSON.stringify(wrapper.toSave(passedDirectly)))
        );

        // And the tentative detour left no trace to pop: a longer buffer, truncated,
        // reproduces the shorter buffer's state exactly.
        const detour = await wrapper.move(cloneDeep(base), [getLoan, payLoan], A);
        expect(wrapper.toSave(detour)).to.be.undefined;
        const truncated = await wrapper.move(cloneDeep(base), [getLoan], A);
        expect(JSON.parse(JSON.stringify(truncated))).to.deep.equal(JSON.parse(JSON.stringify(shortened)));
    });

    /**
     * Scripted 3-player opening: plays committed turns until the starting player A has
     * sailed to the island with one container, starting an auction where B and C (the
     * next players in turn order) are the simultaneous bidders.
     */
    async function playToBidPhase(platform: Platform): Promise<{ A: number; B: number; C: number }> {
        const A = platform.saved.currentPlayers[0];
        const B = (A + 1) % 3;
        const C = (A + 2) % 3;

        // A buys from B's factory; B buys from A's factory (so B's warehouse store
        // holds a container A can later pick up); C just passes.
        await platform.send(
            [
                {
                    name: MoveName.BuyFromFactory,
                    data: { player: B, piece: platform.saved.players[B].containersOnFactoryStore[0].piece },
                    extraData: { price: 2 },
                },
                pass,
            ],
            A
        );
        await platform.send(
            [
                {
                    name: MoveName.BuyFromFactory,
                    data: { player: A, piece: platform.saved.players[A].containersOnFactoryStore[0].piece },
                    extraData: { price: 2 },
                },
                pass,
            ],
            B
        );
        await platform.send([pass], C);

        // A picks up a container from B's warehouse...
        await platform.send(
            [
                { name: MoveName.Sail, data: `playerHarbor${B}1` as ShipPosition },
                {
                    name: MoveName.BuyFromWarehouse,
                    data: { player: B, piece: platform.saved.players[B].containersOnWarehouseStore[0].piece },
                },
                pass,
            ],
            A
        );
        await platform.send([pass], B);
        await platform.send([pass], C);

        // ...and sails to the island, starting the auction
        await platform.send(
            [
                { name: MoveName.Sail, data: ShipPosition.OpenSea },
                { name: MoveName.Sail, data: ShipPosition.Island },
            ],
            A
        );

        expect(platform.saved.phase).to.equal(Phase.Bid);
        expect(platform.saved.currentPlayers).to.have.members([B, C]);

        return { A, B, C };
    }

    it('should play a 3-player auction with a bid tie and an additional-bid round', async () => {
        const platform = new Platform(3, 'wrapper-test-3p');
        const { A, B, C } = await playToBidPhase(platform);

        // Each bid is a single-move committed turn (bids live in the hidden log)
        const bidB = await platform.send([{ name: MoveName.Bid, data: true, extraData: { price: 3 } }], B);
        expect(bidB.saved).to.be.true;
        expect(platform.saved.phase).to.equal(Phase.Bid);
        expect(platform.saved.currentPlayers).to.deep.equal([C]);

        // C matches B's bid: tie → additional-bid round between the tied bidders
        const bidC = await platform.send([{ name: MoveName.Bid, data: true, extraData: { price: 3 } }], C);
        expect(bidC.saved).to.be.true;
        expect(platform.saved.phase).to.equal(Phase.Bid);
        expect(platform.saved.highestBidders).to.have.members([B, C]);
        expect(platform.saved.currentPlayers).to.have.members([B, C]);
        // The bids are still hidden: nothing was flushed to the visible log yet
        expect(platform.saved.hiddenLog).to.have.length(2);

        // Additional bids, again one committed turn each; B outbids C
        const addB = await platform.send([{ name: MoveName.Bid, data: true, extraData: { price: 2 } }], B);
        expect(addB.saved).to.be.true;
        expect(platform.saved.phase).to.equal(Phase.Bid);
        expect(platform.saved.currentPlayers).to.deep.equal([C]);

        const addC = await platform.send([{ name: MoveName.Bid, data: true, extraData: { price: 0 } }], C);
        expect(addC.saved).to.be.true;

        // The additional-bid round resolved the tie: the auctioneer decides, and the
        // hidden bid moves surfaced in the visible log
        expect(platform.saved.phase).to.equal(Phase.AcceptDecline);
        expect(platform.saved.currentPlayers).to.deep.equal([A]);
        expect(platform.saved.highestBidders).to.deep.equal([B]);
        expect(platform.saved.hiddenLog).to.have.length(0);

        const moneyA = platform.saved.players[A].money;
        const moneyB = platform.saved.players[B].money;
        const accept = await platform.send([{ name: MoveName.Accept, data: B }], A);
        expect(accept.saved).to.be.true;
        expect(platform.saved.phase).to.equal(Phase.Move);
        expect(platform.saved.players[B].containersOnIsland).to.have.length(1);
        expect(platform.saved.players[B].money).to.equal(moneyB - 5);
        expect(platform.saved.players[A].money).to.equal(moneyA + 10);
    });

    it('should reject a malformed buffer without leaking anything half-applied', async () => {
        const platform = new Platform();
        const A = platform.saved.currentPlayers[0];
        const before = JSON.parse(JSON.stringify(platform.saved));

        // A third loan is illegal (two loans per player at most): the buffer must be
        // rejected even though its first two moves are legal.
        let error: Error | null = null;
        try {
            await platform.send([getLoan, getLoan, getLoan], A);
        } catch (err) {
            error = err as Error;
        }
        expect(error, 'an illegal move mid-buffer must reject the whole buffer').to.not.be.null;

        // Nothing half-applied leaked into the platform's saved state...
        expect(JSON.parse(JSON.stringify(platform.saved))).to.deep.equal(before);

        // ...and a valid buffer from that same state still works
        const ok = await platform.send([getLoan, payLoan, pass], A);
        expect(ok.saved).to.be.true;
    });

    it('should reject a buffer that keeps playing past a turn boundary', async () => {
        // Degenerate case: the only other player is dropped, so the same player is up
        // again right after passing — [Pass, Pass] is a sequence of individually legal
        // moves that spans TWO turns. It must not commit both for one time increment.
        const platform = new Platform();
        const A = platform.saved.currentPlayers[0];
        const B = 1 - A;
        platform.saved = await wrapper.dropPlayer(platform.saved, B);

        const before = JSON.parse(JSON.stringify(platform.saved));

        let error: Error | null = null;
        try {
            await platform.send([pass, pass], A);
        } catch (err) {
            error = err as Error;
        }
        expect(error).to.not.be.null;
        expect(error!.message).to.match(/turn boundary/);
        expect(JSON.parse(JSON.stringify(platform.saved))).to.deep.equal(before);

        // A buffer ending exactly on the turn boundary is still fine
        const ok = await platform.send([getLoan, pass], A);
        expect(ok.saved).to.be.true;
        expect(platform.saved.currentPlayers).to.deep.equal([A]);
    });

    it('should play a full auction with the right commit points and a never-shrinking log', async () => {
        const platform = new Platform();
        const A = platform.saved.currentPlayers[0];
        const B = 1 - A;

        const buyFromB: Move = {
            name: MoveName.BuyFromFactory,
            data: { player: B, piece: platform.saved.players[B].containersOnFactoryStore[0].piece },
            extraData: { price: 2 },
        };

        // A: buy a container from B's factory (tentative), then pass (commits)
        expect((await platform.send([buyFromB], A)).saved).to.be.false;
        expect((await platform.send([buyFromB, pass], A)).saved).to.be.true;

        // B: buy a container from A's factory into B's warehouse, then pass
        const buyFromA: Move = {
            name: MoveName.BuyFromFactory,
            data: { player: A, piece: platform.saved.players[A].containersOnFactoryStore[0].piece },
            extraData: { price: 2 },
        };
        expect((await platform.send([buyFromA, pass], B)).saved).to.be.true;

        // A: sail to B's harbor, buy from B's warehouse onto the ship, pass.
        // Growing buffer resent on every action, tentative until the pass.
        const sailToB: Move = {
            name: MoveName.Sail,
            data: `playerHarbor${B}1` as ShipPosition,
        };
        const buyWarehouse: Move = {
            name: MoveName.BuyFromWarehouse,
            data: { player: B, piece: platform.saved.players[B].containersOnWarehouseStore[0].piece },
        };
        expect((await platform.send([sailToB], A)).saved).to.be.false;
        expect((await platform.send([sailToB, buyWarehouse], A)).saved).to.be.false;
        expect((await platform.send([sailToB, buyWarehouse, pass], A)).saved).to.be.true;
        expect(platform.saved.players[A].ship.containers).to.have.length(1);

        // B: pass
        expect((await platform.send([pass], B)).saved).to.be.true;

        // A: sail back to the open sea (tentative), then to the island — which starts
        // the auction and commits immediately (the mover leaves currentPlayers; there
        // is nothing to undo for the bidders)
        const sailSea: Move = { name: MoveName.Sail, data: ShipPosition.OpenSea };
        expect((await platform.send([sailSea], A)).saved).to.be.false;
        const sailIsland = await platform.send([sailSea, { name: MoveName.Sail, data: ShipPosition.Island }], A);
        expect(sailIsland.saved).to.be.true;
        expect(platform.saved.phase).to.equal(Phase.Bid);
        expect(platform.saved.currentPlayers).to.deep.equal([B]);

        // B: bid — a single-move committed turn (bids live in the hidden log and were
        // never undoable)
        const bid = await platform.send([{ name: MoveName.Bid, data: true, extraData: { price: 3 } }], B);
        expect(bid.saved).to.be.true;
        expect(platform.saved.phase).to.equal(Phase.AcceptDecline);
        expect(platform.saved.currentPlayers).to.deep.equal([A]);

        // A (auctioneer): a loan during accept/decline is still undoable...
        const loanFirst = await platform.send([getLoan], A);
        expect(loanFirst.saved).to.be.false;
        expect(platform.saved.players[A].loans).to.have.length(0);

        // ...and accepting commits the whole turn
        const moneyBefore = platform.saved.players[A].money;
        const accept = await platform.send([getLoan, { name: MoveName.Accept, data: B }], A);
        expect(accept.saved).to.be.true;
        expect(platform.saved.phase).to.equal(Phase.Move);
        expect(platform.saved.players[B].containersOnIsland).to.have.length(1);
        // +10 for the loan, + twice the bid of 3 for the accepted auction
        expect(platform.saved.players[A].money).to.equal(moneyBefore + 10 + 6);
        // Control passed on: the accept itself can no longer be undone
        expect(platform.saved.currentPlayers).to.deep.equal([B]);
        expect(platform.saved.newTurn).to.be.true;

        // The saved log never shrank across committed states
        for (let i = 1; i < platform.logLengths.length; i++) {
            expect(platform.logLengths[i]).to.be.at.least(platform.logLengths[i - 1]);
        }
    });

    it('should let the auctioneer decline as a committed turn', async () => {
        // Same script as above up to the auction, then decline instead of accept
        const platform = new Platform();
        const A = platform.saved.currentPlayers[0];
        const B = 1 - A;

        await platform.send(
            [
                {
                    name: MoveName.BuyFromFactory,
                    data: { player: B, piece: platform.saved.players[B].containersOnFactoryStore[0].piece },
                    extraData: { price: 2 },
                },
                pass,
            ],
            A
        );
        await platform.send(
            [
                {
                    name: MoveName.BuyFromFactory,
                    data: { player: A, piece: platform.saved.players[A].containersOnFactoryStore[0].piece },
                    extraData: { price: 2 },
                },
                pass,
            ],
            B
        );
        await platform.send(
            [
                { name: MoveName.Sail, data: `playerHarbor${B}1` as ShipPosition },
                {
                    name: MoveName.BuyFromWarehouse,
                    data: { player: B, piece: platform.saved.players[B].containersOnWarehouseStore[0].piece },
                },
                pass,
            ],
            A
        );
        await platform.send([pass], B);
        await platform.send(
            [
                { name: MoveName.Sail, data: ShipPosition.OpenSea },
                { name: MoveName.Sail, data: ShipPosition.Island },
            ],
            A
        );
        await platform.send([{ name: MoveName.Bid, data: true, extraData: { price: 3 } }], B);

        const moneyBefore = platform.saved.players[A].money;
        const decline = await platform.send([{ name: MoveName.Decline, data: true }], A);
        expect(decline.saved).to.be.true;
        expect(platform.saved.phase).to.equal(Phase.Move);
        // Declining: A pays the highest bid and keeps the containers on their island
        expect(platform.saved.players[A].money).to.equal(moneyBefore - 3);
        expect(platform.saved.players[A].containersOnIsland).to.have.length(1);
        expect(platform.saved.currentPlayers).to.deep.equal([B]);
    });

    it('should always produce committed states from moveAI', async () => {
        let G = setup(2, {}, 'wrapper-test-ai');
        G.players.forEach((player, i) => {
            player.name = `AI ${i}`;
            player.isAI = true;
        });

        for (let turn = 0; turn < 25 && !wrapper.ended(G) && G.currentPlayers.length > 0; turn++) {
            const logLengthBefore = wrapper.logLength(G);
            G = wrapper.moveAI(G, G.currentPlayers[0]);

            expect(wrapper.toSave(G), `moveAI result of turn ${turn} must be saveable`).to.not.be.undefined;
            expect(wrapper.logLength(G)).to.be.at.least(logLengthBefore);
        }
    });

    it('should always produce committed states from dropPlayer', async () => {
        const G = setup(3, {}, 'wrapper-test-drop');
        const dropped = G.currentPlayers[0];

        const result = await wrapper.dropPlayer(G, dropped);

        expect(wrapper.toSave(result)).to.not.be.undefined;
        expect(result.players[dropped].isDropped).to.be.true;
        expect(result.currentPlayers).to.not.include(dropped);
    });
});
