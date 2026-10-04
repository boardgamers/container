import type { GameState } from './gamestate';
import { Phase } from './gamestate';
import { Move, MoveName } from './move';

export function bidRevision(G: GameState, seat: number): string | undefined {
    const p = G.players[seat];
    if (
        !p ||
        p.isDropped ||
        G.phase !== Phase.Bid ||
        G.currentPlayers.length === 0 ||
        G.currentPlayers.includes(seat) ||
        seat === G.auctioningPlayer ||
        (G.highestBidders.length > 0 && !G.highestBidders.includes(seat))
    )
        return undefined;
    return `${G.round}:${G.log.length}:${G.auctioningPlayer}:${G.highestBidders.length ? 'extra' : 'initial'}`;
}
export function canReviseBid(G: GameState, payload: unknown, seat: number): boolean {
    const moves = Array.isArray(payload) ? payload : [payload];
    if (moves.length !== 1) return false;
    const move = moves[0] as Move;
    const key = bidRevision(G, seat);
    return !!key && !!move && move.name === MoveName.Bid && move.revision === key;
}
