import type { AchievementManifest, SeatAchievements } from '@boardgamers/protocol/engine';
import { ended } from './engine';
import type { GameState, Player } from './gamestate';

// Final holdings only: neither lastMove nor the current auction proves lifetime feats.
const definitions = [
    ['win', 'Shipping Magnate', 'Win a completed game of Container.'],
    ['win-three-player', 'Three-Company Champion', 'Win a completed three-player game.'],
    ['win-four-player', 'Four-Company Champion', 'Win a completed four-player game.'],
    ['win-five-player', 'Five-Company Champion', 'Win a completed five-player game.'],
    ['debt-free-win', 'Solvent Champion', 'Win a completed game with no outstanding loans.'],
    ['score-100', 'Healthy Balance Sheet', 'Finish with a final score of at least 100.'],
    ['score-150', 'Economic Powerhouse', 'Finish with a final score of at least 150.'],
    ['debt-free', 'Books Balanced', 'Finish with no outstanding loans.'],
    ['three-factories', 'Industrial Expansion', 'Finish owning at least three factories.'],
    ['four-factories', 'Factory Network', 'Finish owning four factories.'],
    ['three-warehouses', 'Distribution Network', 'Finish owning at least three warehouses.'],
    ['five-warehouses', 'Warehouse Empire', 'Finish owning five warehouses.'],
    ['island-five', 'Island Investor', 'Finish with at least five containers on your island.'],
    ['island-ten', 'Island Portfolio', 'Finish with at least ten containers on your island.'],
    ['island-diversity', 'A Colorful Portfolio', 'Finish with all five container colors on your island.'],
    ['full-ship', 'Loaded Freighter', 'Finish with five containers aboard your ship.'],
    ['warehouse-five', 'Stocked for Trade', 'Finish with five containers in your warehouse store.'],
];

export function achievementDefinitions(): AchievementManifest {
    return {
        revision: 1,
        achievements: definitions.map(([id, name, description]) => ({ id, name, description })),
    };
}

/** Money is already the settled score after GameEnd; do not score it again. */
function compare(a: Player, b: Player): number {
    return a.money - b.money || a.containersOnIsland.length - b.containersOnIsland.length;
}

export function achievements(G: GameState): SeatAchievements[] {
    // Container supports 3–5 seats. There is no solo victory or engine cancellation
    // flag. Platform cancellation/account eligibility must be checked by BGS;
    // this state cannot establish general practice or analysis provenance.
    if (!ended(G) || G.newTurn === false || G.players.length < 3 || G.players.length > 5) return [];
    if (G.currentPlayers.length || G.players.some((p) => !Number.isFinite(p.money))) return [];
    const best = G.players.reduce((a, b) => (compare(a, b) >= 0 ? a : b));
    const tied = G.players.filter((p) => compare(p, best) === 0).length > 1;
    return G.players
        .map((p, seat): SeatAchievements => {
            const outcome = compare(p, best) !== 0 ? 'loss' : tied ? 'draw' : 'win';
            const win = outcome === 'win';
            const earned = [
                ['win', win],
                ['win-three-player', win && G.players.length === 3],
                ['win-four-player', win && G.players.length === 4],
                ['win-five-player', win && G.players.length === 5],
                ['debt-free-win', win && p.loans.length === 0],
                ['score-100', p.money >= 100],
                ['score-150', p.money >= 150],
                ['debt-free', p.loans.length === 0],
                ['three-factories', p.factories.length >= 3],
                ['four-factories', p.factories.length === 4],
                ['three-warehouses', p.warehouses.length >= 3],
                ['five-warehouses', p.warehouses.length === 5],
                ['island-five', p.containersOnIsland.length >= 5],
                ['island-ten', p.containersOnIsland.length >= 10],
                ['island-diversity', new Set(p.containersOnIsland.map((c) => c.color)).size === 5],
                ['full-ship', p.ship.containers.length === 5],
                ['warehouse-five', p.containersOnWarehouseStore.length === 5],
            ] as const;
            return { seat, earned: earned.filter(([, met]) => met).map(([id]) => id), outcome };
        })
        .filter(({ seat }) => !G.players[seat].isAI && !G.players[seat].isDropped);
}
