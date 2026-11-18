import { GameState, Move, move } from 'container-engine';

/** Parameterised bank bids/prices are checked by the engine, never a second viewer ruleset. */
export function legalBankAction(state: GameState, player: number | undefined, action: Move): boolean {
    if (player == null || !state.currentPlayers.includes(player)) return false;
    try {
        move(JSON.parse(JSON.stringify(state)), action, player, true);
        return true;
    } catch (_) {
        return false;
    }
}
