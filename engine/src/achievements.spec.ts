import type { Engine } from '@boardgamers/protocol/engine';
import { expect } from 'chai';
import { cloneDeep } from 'lodash';
import seedrandom from 'seedrandom';
import * as wrapper from '../wrapper';
import { move, moveAI, setup } from './engine';
import { containerColors, GameState, Phase } from './gamestate';
import { MoveName } from './move';

// Compile against the published optional hooks, not a local protocol imitation.
const hooks: Pick<Engine<GameState>, 'achievementDefinitions' | 'achievements'> = wrapper;

function complete(players: number, seed = `achievements-${players}`): GameState {
    const random = Math.random;
    Math.random = seedrandom(seed);
    try {
        let G = setup(players, {}, seed);
        for (let i = 0; i < 20000 && !wrapper.ended(G); i++) {
            G = wrapper.moveAI(G, G.currentPlayers[0]);
        }
        expect(wrapper.ended(G), 'legal moves reach completion').to.equal(true);
        return JSON.parse(JSON.stringify(G));
    } finally {
        Math.random = random;
    }
}

function freeze<T>(value: T): T {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}

describe('per-game achievements', function () {
    this.timeout(60000);
    const completed: GameState[] = [];
    before(() => {
        for (const count of [3, 4, 5]) completed.push(complete(count));
    });

    it('publishes a fresh, stable, secret-free revision-three manifest', () => {
        expect(hooks.achievementDefinitions).to.be.a('function');
        const manifest = wrapper.achievementDefinitions();
        expect(manifest.revision).to.equal(3);
        expect(manifest.achievements.map((d) => d.id)).not.to.include('island-five');
        expect(manifest.achievements.find((d) => d.id === 'island-fifteen')).to.deep.equal({
            id: 'island-fifteen',
            name: 'Island Magnate',
            description: 'Finish with at least fifteen containers on your island.',
            icon: { type: 'asset', key: 'achievement-island-fifteen' },
        });
        expect(manifest.achievements).to.have.length(17);
        expect(new Set(manifest.achievements.map((d) => d.id)).size).to.equal(17);
        for (const definition of manifest.achievements) {
            expect(definition.icon).to.deep.equal({ type: 'asset', key: `achievement-${definition.id}` });
            expect(definition.id).to.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
            expect(definition.id.length).to.be.at.most(64);
            expect(definition.name).not.to.equal('');
            expect(definition.description).not.to.equal('');
        }
        manifest.achievements[0].id = 'changed';
        expect(wrapper.achievementDefinitions().achievements[0].id).to.equal('win');
    });

    it('evaluates legally completed serialized 3/4/5-player games without mutation', () => {
        const ids = wrapper.achievementDefinitions().achievements.map((d) => d.id);
        for (const G of completed) {
            const before = JSON.stringify(G);
            const result = wrapper.achievements(freeze(G));
            expect(result).to.have.length(G.players.length);
            expect(wrapper.achievements(G)).to.deep.equal(result);
            expect(JSON.stringify(G)).to.equal(before);
            const best = [...G.players].sort(
                (a, b) => b.money - a.money || b.containersOnIsland.length - a.containersOnIsland.length
            )[0];
            for (const row of result) {
                expect(Object.keys(row).sort()).to.deep.equal(['earned', 'outcome', 'seat']);
                row.earned.forEach((id) => expect(ids).to.include(id));
                if (row.outcome === 'win') {
                    expect(row.seat).to.equal(best.id);
                    expect(row.earned).to.include(
                        `win-${['', '', '', 'three', 'four', 'five'][G.players.length]}-player`
                    );
                }
            }
            // Replaying the legal log independently reaches exactly the same awards.
            expect(wrapper.achievements(wrapper.replay(G))).to.deep.equal(result);
        }
    });

    it('earns island-fifteen in a legal completed game and replay', () => {
        const G = complete(5, 'island-fifteen-11');
        expect(G.players[4].containersOnIsland).to.have.length(15);
        const result = wrapper.achievements(freeze(G));
        expect(result[4].earned).to.include('island-fifteen');
        expect(result[4].earned).to.include('island-ten');
        expect(result.every((row) => !row.earned.includes('island-five'))).to.equal(true);
        expect(wrapper.achievements(wrapper.replay(G))).to.deep.equal(result);
    });

    it('earns warehouse-five through legal purchases and completion, including replay', () => {
        const random = Math.random;
        Math.random = seedrandom('warehouse-1');
        let G = setup(3, {}, 'warehouse-1');
        let reachedCapacity = false;
        try {
            // The ordinary AI stops expanding at three warehouses. This legal policy
            // invests surplus cash in warehouses and fills them from offered stock.
            // No money, pieces, phase or available moves are injected into the state.
            for (let i = 0; i < 20000 && !wrapper.ended(G); i++) {
                const seat = G.currentPlayers[0];
                const p = G.players[seat];
                const available = p.availableMoves!;
                if (available[MoveName.BuyWarehouse] && p.money >= p.warehouses.length + 13) {
                    G = move(G, { name: MoveName.BuyWarehouse, data: true, extraData: G.warehousesLeft[0] }, seat);
                } else if (available[MoveName.BuyFromFactory] && p.warehouses.length === 5 && p.money > 10) {
                    G = move(
                        G,
                        {
                            name: MoveName.BuyFromFactory,
                            data: available[MoveName.BuyFromFactory]![0],
                            extraData: { price: 6 },
                        },
                        seat
                    );
                } else {
                    G = moveAI(G, seat);
                }
                for (const player of G.players) {
                    expect(player.factories.length).to.be.at.most(4);
                    expect(player.warehouses.length).to.be.at.most(5);
                    expect(player.ship.containers.length).to.be.at.most(5);
                    expect(player.containersOnWarehouseStore.length).to.be.at.most(player.warehouses.length);
                    if (player.containersOnWarehouseStore.length === 5) {
                        reachedCapacity = true;
                        expect(player.availableMoves?.[MoveName.BuyFromFactory]).to.equal(undefined);
                        expect(player.availableMoves?.[MoveName.BuyWarehouse]).to.equal(undefined);
                    }
                }
            }
        } finally {
            Math.random = random;
        }
        expect(reachedCapacity).to.equal(true);
        expect(wrapper.ended(G)).to.equal(true);
        const saved: GameState = JSON.parse(JSON.stringify(G));
        expect(saved.players[2].warehouses).to.have.length(5);
        expect(saved.players[2].containersOnWarehouseStore).to.have.length(5);
        const result = wrapper.achievements(freeze(saved));
        expect(result[2].earned).to.include('warehouse-five');
        expect(result[2].earned).to.include('five-warehouses');
        expect(wrapper.achievements(wrapper.replay(saved))).to.deep.equal(result);
        expect(wrapper.achievementDefinitions().achievements.map((d) => d.id)).not.to.include('warehouse-six');
        expect(result.every((row) => !row.earned.includes('warehouse-six'))).to.equal(true);
    });

    it('rejects ongoing, tentative, unsupported singleton, and unsettled states', () => {
        expect(wrapper.achievements(setup(3, {}, 'ongoing'))).to.deep.equal([]);
        for (const change of [
            (G: GameState) => (G.phase = Phase.Move),
            (G: GameState) => (G.newTurn = false),
            (G: GameState) => (G.players = G.players.slice(0, 1)),
            (G: GameState) => (G.currentPlayers = [0]),
            (G: GameState) => (G.players[0].money = NaN),
        ]) {
            const G = cloneDeep(completed[0]);
            change(G);
            expect(wrapper.achievements(G)).to.deep.equal([]);
        }
    });

    // These are isolated final-state boundary variations, not claimed legal replays.
    it('uses the island tiebreaker, draws exact ties, and never promotes humans over bots/drops', () => {
        const G = cloneDeep(completed[0]);
        G.players.forEach((p) => {
            p.money = 100;
            p.containersOnIsland = [];
        });
        expect(wrapper.achievements(G).map((r) => r.outcome)).to.deep.equal(['draw', 'draw', 'draw']);
        expect(wrapper.achievements(G).every((r) => !r.earned.includes('win'))).to.equal(true);
        G.players[0].containersOnIsland = [{ id: 'C0', color: containerColors[0] }];
        expect(wrapper.achievements(G).map((r) => r.outcome)).to.deep.equal(['win', 'loss', 'loss']);
        G.players[0].isAI = true;
        G.players[1].isDropped = true;
        expect(wrapper.achievements(G).map((r) => [r.seat, r.outcome])).to.deep.equal([[2, 'loss']]);
        expect(wrapper.achievements(G)[0].earned).to.include('score-100');
        G.players[2].isDropped = true;
        expect(wrapper.achievements(G)).to.deep.equal([]);
    });

    it('checks every numeric and diversity boundary independently of winning', () => {
        const G = cloneDeep(completed[0]);
        const p = G.players[0];
        G.players[1].money = 1000;
        G.players[2].money = 999;
        const earned = () => wrapper.achievements(G)[0].earned;
        const boundary = (id: string, threshold: number, set: (n: number) => void) => {
            set(threshold - 1);
            expect(earned(), `${id} below`).not.to.include(id);
            set(threshold);
            expect(earned(), `${id} at`).to.include(id);
            expect(earned()).not.to.include('win');
        };
        boundary('score-100', 100, (n) => (p.money = n));
        boundary('score-150', 150, (n) => (p.money = n));
        for (const [id, n] of [
            ['three-factories', 3],
            ['four-factories', 4],
        ] as const)
            boundary(
                id,
                n,
                (n) => (p.factories = Array.from({ length: n }, (_, i) => ({ id: `F${i}`, color: containerColors[i] })))
            );
        for (const [id, n] of [
            ['three-warehouses', 3],
            ['five-warehouses', 5],
        ] as const)
            boundary(id, n, (n) => (p.warehouses = Array.from({ length: n }, (_, i) => ({ id: `W${i}` }))));
        const containers = (n: number) =>
            Array.from({ length: n }, (_, i) => ({ id: `C${i}` as const, color: containerColors[i % 5] }));
        boundary('island-fifteen', 15, (n) => (p.containersOnIsland = containers(n)));
        expect(earned()).not.to.include('island-five');
        boundary('island-ten', 10, (n) => (p.containersOnIsland = containers(n)));
        p.containersOnIsland = containers(4);
        expect(earned()).not.to.include('island-diversity');
        p.containersOnIsland = containers(5);
        expect(earned()).to.include('island-diversity');
        boundary('full-ship', 5, (n) => (p.ship.containers = containers(n)));
        boundary(
            'warehouse-five',
            5,
            (n) => (p.containersOnWarehouseStore = containers(n).map((piece) => ({ piece, price: 2, moved: false })))
        );
        p.loans = [{ id: 'L0' }];
        expect(earned()).not.to.include('debt-free');
        p.loans = [];
        expect(earned()).to.include('debt-free');
        expect(earned()).not.to.include('debt-free-win');
        p.money = 1001;
        expect(earned()).to.include('debt-free-win');
        p.loans = [{ id: 'L0' }];
        expect(earned()).not.to.include('debt-free-win');
        expect(earned()).to.include('win');
        // Hidden objectives and history are not needed to evaluate any feat.
        const expected = earned();
        p.pointCard = null;
        delete p.finalScoreBreakdown;
        G.log = [];
        expect(earned()).to.deep.equal(expected);
    });
});
