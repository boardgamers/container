import { GameState, ShipPosition } from 'container-engine/src/gamestate';
import { LogMove } from 'container-engine/src/log';
import { MoveName } from 'container-engine/src/move';

/** Public bank moves carry enough information for useful prose without exposing secrets. */
export function offshoreJournal(entry: LogMove, state: GameState): string | undefined {
    const player = state.players?.[entry.player]?.name || String(entry.player + 1);
    const move = entry.move;
    if (move.name === MoveName.CallBank) {
        return move.data.type === 'cash'
            ? `${player} calls bank for cash lot ${move.data.lot + 1}: ${
                  move.extraData.containers?.length || 0
              } containers in escrow.`
            : `${player} calls bank for container lot ${move.data.lot + 1}: $${move.extraData.cash} in escrow.`;
    }
    if (move.name === MoveName.Sail && move.data === ShipPosition.OffshoreBank)
        return `${player} sails to the offshore bank.`;
    if (
        [
            MoveName.ReturnBankContainer,
            MoveName.DistributeBankContainer,
            MoveName.SeizeBankContainer,
            MoveName.LoadBankContainer,
        ].includes(move.name)
    ) {
        const action = move as import('container-engine/src/move').Moves.MoveBankContainer;
        const color = action.data.color === 'darkslategray' ? 'dark green' : action.data.color;
        if (action.name === MoveName.ReturnBankContainer)
            return `${player} returns a ${color} container at $${action.extraData?.price}.`;
        if (action.name === MoveName.DistributeBankContainer)
            return `${player} distributes a ${color} container to the bank.`;
        if (action.name === MoveName.SeizeBankContainer)
            return `${player} seizes a ${color} container for unpaid interest.`;
        return `${player} loads a ${color} container from the holding area.`;
    }
}

export function escapeJournal(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
