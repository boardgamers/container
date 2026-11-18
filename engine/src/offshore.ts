import assert from 'assert';
import { AvailableMoves } from './available-moves';
import { BankAuction, ContainerPiece, GameState, Phase, Player, ShipPosition } from './gamestate';
import { GameEventName } from './log';
import { Move, MoveName } from './move';

export function payBankCash(G: GameState, amount: number) {
    const b = G.offshoreBank;
    if (!b) return;
    const lots = [0, 1, 2].filter((i) => !b.auctions.some((a) => a.type === 'cash' && a.lot === i));
    for (let i = 0; i < amount; i++) b.cashLots[lots[i % lots.length]]++;
}
export function reserved(G: GameState, player: Player, district: 'factory' | 'warehouse') {
    return (
        G.offshoreBank?.auctions
            .filter((a) => a.bidder === player.id)
            .reduce((n, a) => n + a.containers.filter((c) => c.district === district).length, 0) || 0
    );
}
export function seizureChoices(G: GameState, player: Player): ContainerPiece[] {
    return (
        [
            player.containersOnIsland,
            player.ship.containers,
            player.bankHolding || [],
            player.containersOnWarehouseStore.map((c) => c.piece),
            player.containersOnFactoryStore.map((c) => c.piece),
        ].find((a) => a.length > 0) || []
    );
}
export function bankMoves(G: GameState, player: Player): AvailableMoves {
    const b = G.offshoreBank!;
    const d = b.decision;
    if (d) {
        if (d.kind === 'return') return { [MoveName.ReturnBankContainer]: d.containers.map((c) => c.container.piece) };
        if (d.kind === 'seize') return { [MoveName.SeizeBankContainer]: seizureChoices(G, G.players[d.debtor!]) };
        return { [MoveName.DistributeBankContainer]: d.payment };
    }
    const moves: AvailableMoves = {};
    if (
        player.ship.shipPosition === ShipPosition.OffshoreBank &&
        player.ship.containers.length < 5 &&
        (player.lastMove?.name === MoveName.Sail || player.lastMove?.name === MoveName.LoadBankContainer) &&
        player.bankHolding!.length
    ) {
        moves[MoveName.LoadBankContainer] = player.bankHolding!.slice();
    }
    if (player.actions <= 0 || b.called || b.won || new Set(G.containersLeft.map((c) => c.color)).size < 4)
        return moves;
    const offers: { type: 'cash' | 'containers'; lot: number }[] = [];
    for (const type of ['cash', 'containers'] as const) {
        const active = b.auctions.find((a) => a.type === type);
        if (active?.bidder === player.id) continue;
        if (!active && b.auctions.length >= (G.players.length === 5 ? 2 : 1)) continue;
        const canBid =
            type === 'containers'
                ? player.money > (active?.cash || 0)
                : player.containersOnFactoryStore.length + player.containersOnWarehouseStore.length >
                  (active?.containers.length || 0);
        if (!canBid) continue;
        for (let lot = 0; lot < 3; lot++) {
            if (!active || active.lot === lot) offers.push({ type, lot });
        }
    }
    if (offers.length) moves[MoveName.CallBank] = offers;
    return moves;
}
function collect(G: GameState, a: BankAuction) {
    const b = G.offshoreBank!;
    const p = G.players[a.bidder];
    if (a.type === 'cash') {
        p.money += b.cashLots[a.lot];
        b.cashLots[a.lot] = 0;
        p.offshoreStats!.cashAuctionsWon++;
    } else {
        p.bankHolding!.push(...b.containerLots[a.lot]);
        b.containerLots[a.lot] = [];
        p.offshoreStats!.containerAuctionsWon++;
    }
    G.log.push({
        type: 'event',
        event: { name: GameEventName.Upkeep, interest: `${p.name} wins bank ${a.type} lot ${a.lot + 1}` },
    });
    const index = b.auctions.findIndex(
        (active) => active.type === a.type && active.lot === a.lot && active.bidder === a.bidder
    );
    assert(index >= 0, 'Bank settlement no longer matches an active auction');
    b.auctions.splice(index, 1);
    b.won = true;
}
/** Returns true while a player decision is pending. */
export function settleBank(G: GameState, ending = false): boolean {
    const b = G.offshoreBank!;
    const player = G.currentPlayers[0];
    for (const a of b.auctions.slice()) {
        if (!ending && a.bidder !== player) continue;
        if (a.type === 'containers') {
            payBankCash(G, a.cash);
            collect(G, a);
        } else {
            b.decision = {
                kind: 'distribute',
                player: a.bidder,
                resumePlayer: player,
                containers: [],
                payment: a.containers.map((c) => c.container.piece),
                cursor: 0,
                settlement: a,
                ending,
            };
            G.phase = Phase.BankDecision;
            G.currentPlayers = [a.bidder];
            return true;
        }
    }
    return false;
}
export function bankUpkeep(G: GameState) {
    const b = G.offshoreBank!;
    const p = G.players[G.currentPlayers[0]];
    b.called = b.won = false;
    const interest = p.loans.length;
    if (p.money < interest && p.loans.length < 2 && G.loansLeft.length) {
        p.loans.push(G.loansLeft.pop()!);
        p.money += 10;
    }
    const paid = Math.min(p.money, interest);
    p.money -= paid;
    payBankCash(G, paid);
    if (interest)
        G.log.push({
            type: 'event',
            event: { name: GameEventName.Upkeep, interest: `${p.name} pays $${paid} interest to the Off-Shore Bank` },
        });
    const remaining = interest - paid;
    if (remaining && seizureChoices(G, p).length) {
        const chooser = (p.id + G.players.length - 1) % G.players.length;
        b.decision = {
            kind: 'seize',
            player: chooser,
            resumePlayer: p.id,
            debtor: p.id,
            remaining,
            containers: [],
            payment: [],
            cursor: 0,
        };
        G.phase = Phase.BankDecision;
        G.currentPlayers = [chooser];
    } else settleBank(G);
}
export function applyBankMove(G: GameState, move: Move, p: Player): { handled: boolean; ending?: boolean } {
    const b = G.offshoreBank;
    if (!b) return { handled: false };
    if (move.name === MoveName.CallBank) {
        assert(
            move.extraData &&
                typeof move.extraData === 'object' &&
                Object.keys(move.extraData).every((k) => k === (move.data.type === 'cash' ? 'containers' : 'cash')),
            'Invalid bank bid fields'
        );
        const old = b.auctions.find((a) => a.type === move.data.type);
        const a: BankAuction = { ...move.data, bidder: p.id, cash: 0, containers: [] };
        if (a.type === 'containers') {
            const cash = move.extraData?.cash;
            assert(Number.isSafeInteger(cash) && cash! > (old?.cash || 0) && cash! <= p.money, 'Invalid bank cash bid');
            assert(!move.extraData.containers?.length, 'Unexpected containers');
            a.cash = cash!;
        } else {
            const ids = move.extraData?.containers;
            assert(
                Array.isArray(ids) && ids.length > (old?.containers.length || 0) && new Set(ids).size === ids.length,
                'Invalid bank container bid'
            );
            assert(!move.extraData.cash, 'Unexpected cash');
            for (const id of ids!) {
                const factory = p.containersOnFactoryStore.find((c) => c.piece.id === id);
                const container = factory || p.containersOnWarehouseStore.find((c) => c.piece.id === id);
                assert(container, 'Only stored containers can be bid');
                a.containers.push({ container: container!, district: factory ? 'factory' : 'warehouse' });
            }
        }
        p.money -= a.cash;
        for (const c of a.containers) {
            const store = c.district === 'factory' ? p.containersOnFactoryStore : p.containersOnWarehouseStore;
            store.splice(store.indexOf(c.container), 1);
        }
        if (old) {
            b.auctions.splice(b.auctions.indexOf(old), 1);
            G.players[old.bidder].money += old.cash;
            if (old.containers.length) {
                b.decision = {
                    kind: 'return',
                    player: old.bidder,
                    resumePlayer: p.id,
                    containers: old.containers,
                    payment: [],
                    cursor: 0,
                };
                G.phase = Phase.BankDecision;
                G.currentPlayers = [old.bidder];
            }
        }
        b.auctions.push(a);
        b.called = true;
        p.actions--;
    } else if (move.name === MoveName.LoadBankContainer) {
        const i = p.bankHolding!.findIndex((c) => c.id === move.data.id);
        p.ship.containers.push(p.bankHolding!.splice(i, 1)[0]);
    } else if (
        [MoveName.ReturnBankContainer, MoveName.DistributeBankContainer, MoveName.SeizeBankContainer].includes(
            move.name
        )
    ) {
        const d = b.decision!;
        const piece = (move as { data: ContainerPiece }).data;
        if (move.name === MoveName.ReturnBankContainer) {
            const i = d.containers.findIndex((c) => c.container.piece.id === piece.id);
            const c = d.containers[i];
            assert(move.extraData && Object.keys(move.extraData).every((k) => k === 'price'), 'Invalid return fields');
            const price = (move as { extraData?: { price: number } }).extraData?.price;
            assert(
                Number.isInteger(price) &&
                    price! >= (c.district === 'factory' ? 1 : 2) &&
                    price! <= (c.district === 'factory' ? 4 : 6),
                'Invalid return price'
            );
            c.container.price = price!;
            (c.district === 'factory' ? p.containersOnFactoryStore : p.containersOnWarehouseStore).push(c.container);
            d.containers.splice(i, 1);
            if (d.containers.length) return { handled: true };
        } else if (move.name === MoveName.SeizeBankContainer) {
            const debtor = G.players[d.debtor!];
            for (const arr of [debtor.containersOnIsland, debtor.ship.containers, debtor.bankHolding!]) {
                const i = arr.findIndex((c) => c.id === piece.id);
                if (i >= 0) arr.splice(i, 1);
            }
            for (const arr of [debtor.containersOnFactoryStore, debtor.containersOnWarehouseStore]) {
                const i = arr.findIndex((c) => c.piece.id === piece.id);
                if (i >= 0) arr.splice(i, 1);
            }
            d.payment.push(piece);
            d.remaining!--;
            if (d.remaining! > 0 && seizureChoices(G, debtor).length) return { handled: true };
            d.kind = 'distribute';
            return { handled: true };
        } else {
            const lots = [0, 1, 2].filter((i) => !b.auctions.some((a) => a.type === 'containers' && a.lot === i));
            b.containerLots[lots[d.cursor++ % lots.length]].push(piece);
            d.payment.splice(
                d.payment.findIndex((c) => c.id === piece.id),
                1
            );
            if (d.payment.length) return { handled: true };
            if (d.settlement) collect(G, d.settlement);
        }
        delete b.decision;
        G.phase = Phase.Move;
        G.currentPlayers = [d.resumePlayer];
        if (d.kind !== 'return' && settleBank(G, d.ending)) return { handled: true };
        return { handled: true, ending: d.ending };
    } else return { handled: false };
    return { handled: true };
}

/** Mandatory production must be finishable without triggering game end after Call Bank. */
export function bankProductionAllowed(G: GameState, p: Player, first: ContainerPiece['color']): boolean {
    if (!G.offshoreBank?.called) return true;
    const colors = p.factories
        .map((f) => f.color)
        .filter((c) => !p.produced.includes(c) && G.containersLeft.some((x) => x.color === c));
    const slots = p.factories.length * 2 - p.containersOnFactoryStore.length - reserved(G, p, 'factory');
    const required = Math.min(slots, colors.length);
    for (let mask = 0; mask < 1 << colors.length; mask++) {
        const selected = colors.filter((_, i) => mask & (1 << i));
        if (selected.length !== required || !selected.includes(first)) continue;
        const remaining = G.containersLeft.slice();
        for (const color of selected)
            remaining.splice(
                remaining.findIndex((c) => c.color === color),
                1
            );
        if (new Set(remaining.map((c) => c.color)).size >= 4) return true;
    }
    return false;
}
