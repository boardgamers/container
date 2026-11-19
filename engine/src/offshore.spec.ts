import { expect } from 'chai';
import { cloneDeep } from 'lodash';
import * as wrapper from '../wrapper';
import { availableMoves } from './available-moves';
import { move, setup, stripSecret } from './engine';
import { GameState, Phase, ShipPosition } from './gamestate';
import { Move, MoveName } from './move';
import { bankProductionAllowed, payBankCash, reserved } from './offshore';

function game(n = 3) {
    const g = setup(n, { offshoreIsland: true }, 'bank-tests');
    g.players.forEach((p) => (p.name = `Player ${p.id}`));
    return g;
}
function act(g: GameState, m: Move) {
    return move(g, m, g.currentPlayers[0]);
}
function pass(g: GameState) {
    return act(g, { name: MoveName.Pass, data: true });
}
function refresh(g: GameState) {
    for (const p of g.players) p.availableMoves = g.currentPlayers.includes(p.id) ? availableMoves(g, p) : null;
}
function cashBid(g: GameState, cash = 1, lot = 0) {
    return act(g, { name: MoveName.CallBank, data: { type: 'containers', lot }, extraData: { cash } });
}
function containerBid(g: GameState, ids: string[], lot = 2) {
    return act(g, { name: MoveName.CallBank, data: { type: 'cash', lot }, extraData: { containers: ids } });
}
function decisions(g: GameState) {
    while (g.phase === Phase.BankDecision) {
        const p = g.players[g.currentPlayers[0]];
        const name = Object.keys(p.availableMoves!)[0] as MoveName;
        const data = p.availableMoves![name]![0];
        act(g, { name, data, extraData: { price: 2 } } as Move);
    }
}
describe('optional Off-Shore Bank', () => {
    it('does not change absent/false expansion setup or ordinary seeded player setup', () => {
        const base = setup(3, {}, 'bank-tests');
        expect(setup(3, { offshoreIsland: false }, 'bank-tests')).deep.equal(base);
        const g = game();
        expect(g.players.map((p) => p.factories)).deep.equal(base.players.map((p) => p.factories));
        expect(g.offshoreBank!.cashLots).deep.equal([1, 2, 3]);
        expect(g.offshoreBank!.containerLots.map((l) => l.length)).deep.equal([2, 1, 0]);
        const seeded = g.offshoreBank!.containerLots.reduce((a, l) => a.concat(l), [] as typeof g.containersLeft);
        expect(new Set(seeded.map((c) => c.color)).size).equal(3);
        expect(g.containersLeft.length).equal(base.containersLeft.length - 3);
        expect(game()).deep.equal(g);
    });
    it('enables via expansion ID and persists the option', async () => {
        expect((await wrapper.init(3, ['offshore-island'], {}, 'seed')).options.offshoreIsland).equal(true);
        expect((await wrapper.init(3, [], {}, 'seed')).offshoreBank).equal(undefined);
    });
    it('escrows cash, limits one call per turn, settles at next own start, and replays', () => {
        const g = game();
        const id = g.currentPlayers[0];
        cashBid(g, 4);
        expect(g.players[id].money).equal(16);
        expect(g.players[id].actions).equal(1);
        expect(g.players[id].availableMoves!.callBank).equal(undefined);
        const publicG = stripSecret(g, (id + 1) % 3);
        expect(publicG.players[id].money).equal(0);
        expect(publicG.offshoreBank!.auctions[0].cash).equal(4);
        pass(g);
        pass(g);
        pass(g);
        expect(g.players[id].bankHolding!.length).equal(2);
        expect(g.players[id].offshoreStats!.containerAuctionsWon).equal(1);
        expect(g.offshoreBank!.cashLots).deep.equal([3, 3, 4]);
        expect(g.players[id].availableMoves!.callBank).equal(undefined);
        expect(wrapper.replay(g)).deep.equal(g);
    });
    it('returns outbid cash and rejects malformed or unaffordable bids without mutating escrow', () => {
        const g = game();
        const id = g.currentPlayers[0];
        cashBid(g, 2);
        pass(g);
        const before = cloneDeep(g.offshoreBank);
        expect(() => cashBid(g, 1)).throw();
        expect(() => cashBid(g, 1.5)).throw();
        expect(() => cashBid(g, 100)).throw();
        expect(g.offshoreBank).deep.equal(before);
        cashBid(g, 3);
        expect(g.players[id].money).equal(20);
    });
    it('reserves original districts and interrupts for owner-only returned-container repricing', () => {
        const g = game();
        const id = g.currentPlayers[0];
        const p = g.players[id];
        const piece = p.containersOnFactoryStore[0].piece;
        containerBid(g, [piece.id]);
        expect(p.containersOnFactoryStore.length).equal(0);
        expect(reserved(g, p, 'factory')).equal(1);
        pass(g);
        const bidder = g.players[g.currentPlayers[0]];
        bidder.containersOnFactoryStore.push({ piece: g.containersLeft.pop()!, price: 3, moved: false });
        refresh(g);
        const resume = bidder.id;
        containerBid(
            g,
            bidder.containersOnFactoryStore.map((c) => c.piece.id)
        );
        expect(g.phase).equal(Phase.BankDecision);
        expect(g.currentPlayers).deep.equal([id]);
        expect(p.availableMoves!.returnBankContainer).deep.equal([piece]);
        expect(() => act(g, { name: MoveName.ReturnBankContainer, data: piece, extraData: { price: 5 } })).throw();
        act(g, { name: MoveName.ReturnBankContainer, data: piece, extraData: { price: 1 } });
        expect(p.containersOnFactoryStore[0].price).equal(1);
        expect(g.currentPlayers).deep.equal([resume]);
        expect(g.newTurn).equal(true);
    });
    it('automatically distributes a single payment and skips frozen lots', () => {
        const g = game(5);
        const first = g.players[g.currentPlayers[0]];
        const piece = first.containersOnFactoryStore[0].piece;
        containerBid(g, [piece.id]);
        pass(g);
        cashBid(g, 2, 0);
        payBankCash(g, 3);
        expect(g.offshoreBank!.cashLots).deep.equal([3, 3, 3]);
        pass(g);
        pass(g);
        pass(g);
        pass(g);
        expect(g.phase).equal(Phase.Move);
        expect(g.offshoreBank!.decision).equal(undefined);
        expect(g.offshoreBank!.containerLots[1].some((c) => c.id === piece.id)).equal(true);
        expect(first.offshoreStats!.cashAuctionsWon).equal(1);
        expect(first.money).equal(23);
    });
    it('pays interest before bank settlement using spendable cash only; right chooses default priority', () => {
        const g = game();
        const p = g.players[g.currentPlayers[0]];
        p.loans.push(g.loansLeft.pop()!, g.loansLeft.pop()!);
        p.ship.containers.push(g.containersLeft.pop()!);
        cashBid(g, 20);
        pass(g);
        pass(g);
        pass(g);
        expect(g.phase).equal(Phase.BankDecision);
        expect(g.currentPlayers[0]).equal((p.id + 2) % 3);
        expect(g.players[g.currentPlayers[0]].availableMoves!.seizeBankContainer).deep.equal(p.ship.containers);
        expect(p.bankHolding!.length).equal(0);
        decisions(g);
        expect(p.ship.containers.length).equal(0);
        expect(p.containersOnFactoryStore.length).equal(0);
        expect(p.bankHolding!.length).equal(2);
        expect(p.loans.length).equal(2);
    });
    it('automatically drains same-color payments in persisted order and conserves cash and pieces', () => {
        const g = game();
        const p = g.players[g.currentPlayers[0]];
        const color = p.containersOnFactoryStore[0].piece.color;
        for (let n = 0; n < 4; n++) {
            const i = g.containersLeft.findIndex((c) => c.color === color);
            p.containersOnFactoryStore.push({ piece: g.containersLeft.splice(i, 1)[0], price: 2, moved: false });
        }
        const payment = p.containersOnFactoryStore.map((c) => c.piece);
        const inventory = () =>
            [
                ...g.containersLeft,
                ...g.offshoreBank!.containerLots.reduce((all, lot) => all.concat(lot), [] as typeof g.containersLeft),
                ...g.players.reduce(
                    (all, p) =>
                        all.concat([
                            ...p.bankHolding!,
                            ...p.ship.containers,
                            ...p.containersOnIsland,
                            ...p.containersOnFactoryStore.map((c) => c.piece),
                            ...p.containersOnWarehouseStore.map((c) => c.piece),
                        ]),
                    [] as typeof g.containersLeft
                ),
            ]
                .map((c) => c.id)
                .sort();
        const before = inventory();
        const cash = () =>
            g.players.reduce((n, p) => n + p.money, 0) + g.offshoreBank!.cashLots.reduce((a, b) => a + b, 0);
        const money = cash();
        refresh(g);
        containerBid(
            g,
            payment.map((c) => c.id)
        );
        pass(g);
        pass(g);
        pass(g);
        expect(g.phase).equal(Phase.Move);
        expect(g.offshoreBank!.decision).equal(undefined);
        payment.forEach((piece, i) => expect(g.offshoreBank!.containerLots[i % 3]).deep.include(piece));
        expect(inventory()).deep.equal(before);
        expect(new Set(inventory()).size).equal(before.length);
        expect(cash()).equal(money);
        expect(g.log.some((e) => e.type === 'move' && e.move.name === MoveName.DistributeBankContainer)).equal(false);
    });
    it('pauses for multiple colors, then automatically drains the final color after an explicit choice', () => {
        let g = game();
        const p = g.players[g.currentPlayers[0]];
        const first = p.containersOnFactoryStore[0].piece;
        const color = g.containersLeft.find((c) => c.color !== first.color)!.color;
        for (let n = 0; n < 3; n++) {
            const i = g.containersLeft.findIndex((c) => c.color === color);
            p.containersOnFactoryStore.push({ piece: g.containersLeft.splice(i, 1)[0], price: 2, moved: false });
        }
        refresh(g);
        containerBid(
            g,
            p.containersOnFactoryStore.map((c) => c.piece.id)
        );
        pass(g);
        pass(g);
        pass(g);
        expect(g.phase).equal(Phase.BankDecision);
        expect(g.offshoreBank!.decision!.payment.length).equal(4);
        g = JSON.parse(JSON.stringify(g));
        act(g, { name: MoveName.DistributeBankContainer, data: first });
        expect(g.phase).equal(Phase.Move);
        expect(g.offshoreBank!.decision).equal(undefined);
        expect(g.players[p.id].offshoreStats!.cashAuctionsWon).equal(1);
        expect(g.currentPlayers).deep.equal([p.id]);
    });
    it('keeps seizure explicit but automatically distributes its final single payment', () => {
        const g = game();
        const debtor = g.players[g.currentPlayers[0]];
        const piece = debtor.containersOnFactoryStore[0].piece;
        debtor.money = 0;
        debtor.loans.push(g.loansLeft.pop()!, g.loansLeft.pop()!);
        pass(g);
        pass(g);
        pass(g);
        expect(g.offshoreBank!.decision!.kind).equal('seize');
        act(g, { name: MoveName.SeizeBankContainer, data: piece });
        expect(g.offshoreBank!.decision).equal(undefined);
        expect(g.offshoreBank!.containerLots[0]).deep.include(piece);
        expect(g.phase).equal(Phase.Move);
        expect(g.currentPlayers).deep.equal([debtor.id]);
        expect(debtor.containersOnFactoryStore).deep.equal([]);
    });
    it('accepts a legacy saved single-payment decision and resumes its interrupted player', () => {
        let g = game();
        const id = g.currentPlayers[0];
        const piece = g.containersLeft.pop()!;
        g.offshoreBank!.decision = {
            kind: 'distribute',
            player: id,
            resumePlayer: (id + 1) % 3,
            payment: [piece],
            containers: [],
            cursor: 2,
        };
        g.phase = Phase.BankDecision;
        refresh(g);
        g = JSON.parse(JSON.stringify(g));
        act(g, { name: MoveName.DistributeBankContainer, data: piece });
        expect(g.offshoreBank!.containerLots[2]).deep.include(piece);
        expect(g.phase).equal(Phase.Move);
        expect(g.currentPlayers).deep.equal([(id + 1) % 3]);
    });
    it('loads only on arrival for free, obeys capacity and requires leaving/reentering next turn', () => {
        const g = game();
        const p = g.players[g.currentPlayers[0]];
        p.bankHolding!.push(...g.containersLeft.splice(0, 6));
        refresh(g);
        act(g, { name: MoveName.Sail, data: ShipPosition.OffshoreBank });
        for (let i = 0; i < 5; i++) act(g, { name: MoveName.LoadBankContainer, data: p.bankHolding![0] });
        expect(p.actions).equal(1);
        expect(p.ship.containers.length).equal(5);
        expect(p.availableMoves!.loadBankContainer).equal(undefined);
        p.ship.containers = [];
        pass(g);
        pass(g);
        pass(g);
        expect(p.availableMoves!.loadBankContainer).equal(undefined);
    });
    it('forbids a mandatory production run that would end the game after Call Bank', () => {
        const g = game();
        const p = g.players[g.currentPlayers[0]];
        const second = g.factoriesLeft.find((f) => f.color !== p.factories[0].color)!;
        p.factories.push(second);
        const colors = p.factories.map((f) => f.color);
        g.containersLeft = g.containersLeft.filter(
            (c, i, all) => !colors.includes(c.color) || i === all.findIndex((x) => x.color === c.color)
        );
        cashBid(g);
        expect(bankProductionAllowed(g, p, colors[0])).equal(false);
        expect(p.availableMoves!.produce).equal(undefined);
    });
    it('resolves end-game pending auctions with payer decisions and scores holdings at $3', () => {
        const g = game();
        const winner = g.players[g.currentPlayers[0]];
        containerBid(g, [winner.containersOnFactoryStore[0].piece.id]);
        pass(g);
        g.containersLeft = g.containersLeft.filter((c) =>
            [g.containersLeft[0].color, g.containersLeft[15].color].includes(c.color)
        );
        refresh(g);
        pass(g);
        expect(g.phase).equal(Phase.GameEnd);
        expect(winner.offshoreStats!.cashAuctionsWon).equal(1);
        expect(g.offshoreBank!.auctions.length).equal(0);
        expect(winner.finalScoreBreakdown!.length).equal(10);
    });
    it('reconstructs public analysis cash and holdings with an unrelated scenario seed', () => {
        const g = game();
        cashBid(g, 4);
        pass(g);
        pass(g);
        pass(g);
        const analysis = wrapper.createAnalysisScenario(stripSecret(g, g.currentPlayers[0]), {
            player: g.currentPlayers[0],
            seed: 'different',
        });
        expect(analysis.players.map((p) => p.money)).deep.equal(g.players.map((p) => p.money));
        expect(analysis.offshoreBank).deep.equal(g.offshoreBank);
    });
    it('replays automatic payments from JSON without synthetic distribution moves', async () => {
        const g = game();
        const p = g.players[g.currentPlayers[0]];
        containerBid(g, [p.containersOnFactoryStore[0].piece.id]);
        pass(g);
        pass(g);
        pass(g);
        expect(g.phase).equal(Phase.Move);
        expect(wrapper.replay(JSON.parse(JSON.stringify(g)))).deep.equal(g);
        const copy = cloneDeep(g);
        await wrapper.dropPlayer(copy, p.id);
        expect(copy.phase).equal(Phase.Move);
        decisions(g);
        expect(wrapper.replay(g)).deep.equal(g);
    });
    it('sends delivery self-buyout cash to bank, not supply', () => {
        const g = game();
        const p = g.players[g.currentPlayers[0]];
        p.ship.containers.push(g.containersLeft.pop()!);
        refresh(g);
        act(g, { name: MoveName.Sail, data: ShipPosition.Island });
        for (const bidder of g.currentPlayers.slice())
            move(
                g,
                { name: MoveName.Bid, data: true, extraData: { price: bidder === g.currentPlayers[0] ? 3 : 1 } },
                bidder
            );
        while (g.phase === Phase.Bid)
            move(g, { name: MoveName.Bid, data: true, extraData: { price: 0 } }, g.currentPlayers[0]);
        const amount = g.players[g.highestBidders[0]].bid + g.players[g.highestBidders[0]].additionalBid;
        const before = g.offshoreBank!.cashLots.reduce((a, b) => a + b, 0);
        act(g, { name: MoveName.Decline, data: true });
        expect(g.offshoreBank!.cashLots.reduce((a, b) => a + b, 0)).equal(before + amount);
    });
    it('settles pending cash bids at game end and values holding containers in existing ship row', () => {
        const g = game();
        const p = g.players[g.currentPlayers[0]];
        cashBid(g, 1);
        pass(g);
        g.containersLeft = g.containersLeft.filter((c) => c.color === g.containersLeft[0].color);
        refresh(g);
        pass(g);
        expect(g.phase).equal(Phase.GameEnd);
        expect(p.bankHolding!.length).equal(2);
        expect(p.finalScoreBreakdown![8]).equal('$6');
        expect(p.money).equal(25);
    });
    it('keeps returned-container reserve capacity unavailable to warehouse purchases and production', () => {
        const g = game();
        const p = g.players[g.currentPlayers[0]];
        const extra = g.containersLeft.pop()!;
        p.containersOnFactoryStore.push({ piece: extra, price: 2, moved: false });
        p.containersOnWarehouseStore.push({ piece: g.containersLeft.pop()!, price: 2, moved: false });
        refresh(g);
        containerBid(g, [extra.id, p.containersOnWarehouseStore[0].piece.id]);
        expect(reserved(g, p, 'factory')).equal(1);
        expect(reserved(g, p, 'warehouse')).equal(1);
        expect(p.availableMoves!.produce).equal(undefined);
        expect(p.availableMoves!.buyFromFactory).equal(undefined);
        expect(
            g.players
                .filter((x) => x.id !== p.id)
                .every((x) => !x.containersOnFactoryStore.some((c) => c.piece.id === extra.id))
        ).equal(true);
    });

    it('settles two end-game auctions exactly once across JSON persistence at every decision', () => {
        let g = game(5);
        const first = g.players[g.currentPlayers[0]];
        first.containersOnFactoryStore.push({ piece: g.containersLeft.pop()!, price: 2, moved: false });
        refresh(g);
        containerBid(
            g,
            first.containersOnFactoryStore.map((c) => c.piece.id)
        );
        pass(g);
        const second = g.players[g.currentPlayers[0]];
        cashBid(g, 2);
        pass(g);
        g.containersLeft = g.containersLeft.filter((c) => c.color === g.containersLeft[0].color);
        refresh(g);
        pass(g);
        expect(g.offshoreBank!.auctions.length).equal(2);
        let count = 0;
        while (g.phase === Phase.BankDecision && count++ < 10) {
            g = JSON.parse(JSON.stringify(g));
            const piece = g.offshoreBank!.decision!.payment[0];
            act(g, { name: MoveName.DistributeBankContainer, data: piece });
        }
        expect(count).equal(1);
        expect(g.phase).equal(Phase.GameEnd);
        expect(g.offshoreBank!.auctions).deep.equal([]);
        expect(g.players[first.id].offshoreStats!.cashAuctionsWon).equal(1);
        expect(g.players[second.id].offshoreStats!.containerAuctionsWon).equal(1);
        expect(g.players[second.id].bankHolding!.length).equal(2);
    });
    it('optimistically completes final bank decisions without scoring secret point cards', () => {
        const g = game();
        const p = g.players[g.currentPlayers[0]];
        const i = g.containersLeft.findIndex((c) => c.color !== p.containersOnFactoryStore[0].piece.color);
        p.containersOnFactoryStore.push({ piece: g.containersLeft.splice(i, 1)[0], price: 2, moved: false });
        refresh(g);
        containerBid(
            g,
            p.containersOnFactoryStore.map((c) => c.piece.id)
        );
        pass(g);
        g.players[g.currentPlayers[0]].containersOnIsland.push(g.containersLeft.pop()!);
        g.containersLeft = g.containersLeft.filter((c) => c.color === g.containersLeft[0].color);
        refresh(g);
        pass(g);
        const stripped = cloneDeep(stripSecret(g, p.id));
        expect(() =>
            move(
                stripped,
                { name: MoveName.DistributeBankContainer, data: stripped.offshoreBank!.decision!.payment[0] },
                p.id,
                true
            )
        ).not.throw();
        expect(stripped.players.some((p) => p.finalScoreBreakdown !== undefined)).equal(false);
    });
});
