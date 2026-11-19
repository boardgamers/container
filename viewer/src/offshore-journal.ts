import { playerColors } from 'container-engine/src/engine';
import { ContainerColor, containerColors, GameState, ShipPosition } from 'container-engine/src/gamestate';
import { LogMove } from 'container-engine/src/log';
import { MoveName } from 'container-engine/src/move';
import { journalContainerIcon } from './journal-pieces';

/** Public bank moves carry enough information for useful prose without exposing secrets. */
export function offshoreJournal(
    entry: LogMove,
    state: GameState,
    rich = false,
    colorBlind = false
): string | undefined {
    const text = (value: unknown) => (rich ? escapeJournal(String(value)) : String(value));
    const name = state.players?.[entry.player]?.name || String(entry.player + 1);
    const player = rich ? playerBadge(name, entry.player) : name;
    const container = (color: unknown) =>
        rich && containerColors.includes(color as ContainerColor)
            ? journalContainerIcon(color as ContainerColor, colorBlind)
            : text(color === 'darkslategray' ? 'dark green' : color);
    const move = entry.move;
    if (move.name === MoveName.CallBank) {
        return move.data.type === 'cash'
            ? `${player} calls bank for cash lot ${text(move.data.lot + 1)}: ${
                  rich ? escrowIcons(entry, state, colorBlind) : move.extraData.containers?.length || 0
              } containers in escrow.`
            : `${player} calls bank for container lot ${text(move.data.lot + 1)}: $${text(
                  move.extraData.cash
              )} in escrow.`;
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
        const color = container(action.data.color || historicalColor(action.data.id, entry, state) || 'unknown');
        if (action.name === MoveName.ReturnBankContainer)
            return `${player} returns a ${color} container at $${text(action.extraData?.price)}.`;
        if (action.name === MoveName.DistributeBankContainer)
            return `${player} distributes a ${color} container to the bank.`;
        if (action.name === MoveName.SeizeBankContainer)
            return `${player} seizes a ${color} container for unpaid interest.`;
        return `${player} loads a ${color} container from the holding area.`;
    }
}

/** Bank settlements are legacy Upkeep strings, not moves with a player ID.
 * Match the complete public name and suffix rather than replacing name substrings.
 * Ambiguous or unknown names keep their original prose without guessing a seat.
 */
export function offshoreWinJournal(message: string, state: GameState): string | undefined {
    const match = /^(.*)( wins bank (?:containers|cash) lot [1-3])$/.exec(message);
    if (!match) return undefined;
    const players = state.players.filter((player) => player.name === match[1]);
    if (players.length !== 1) return escapeJournal(message);
    return playerBadge(match[1], players[0].id) + match[2];
}

function playerBadge(name: string, seat: number): string {
    // Match the ordinary engine badge; journalPieces applies the user's seat colors.
    const badge = document.createElement('span');
    badge.style.backgroundColor = playerColors[seat] || '';
    badge.style.fontWeight = 'bold';
    badge.style.padding = '0 3px';
    badge.textContent = name;
    return badge.outerHTML;
}

export function escapeJournal(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Resolve immutable public piece identity, never a live escrow/decision (which may be gone).
 * Historical payloads normally include color; ID-only wire payloads use setup's stable
 * C<n> color blocks, four containers per seat per color. No bids or secret state are read.
 */
function historicalColor(id: string, entry: LogMove, state: GameState): ContainerColor | undefined {
    const history = state.log || [];
    // If the entry is detached from this replay snapshot, use only the stable ID,
    // rather than accidentally consulting later actions.
    for (const item of history.slice(0, Math.max(0, history.indexOf(entry)))) {
        if (item.type !== 'move') continue;
        const data = item.move.data as {
            id?: string;
            color?: ContainerColor;
            piece?: { id: string; color: ContainerColor };
        };
        const piece = data?.piece || data;
        if (piece?.id === id && containerColors.includes(piece.color!)) return piece.color;
    }
    const match = /^C(0|[1-9]\d*)$/.exec(id);
    const perColor = state.players.length * 4;
    return match && perColor ? containerColors[Math.floor(Number(match[1]) / perColor)] : undefined;
}

function escrowIcons(entry: LogMove, state: GameState, colorBlind: boolean): string {
    if (entry.move.name !== MoveName.CallBank) return '';
    const ids = entry.move.extraData.containers || [];
    if (!ids.length) return '0';
    // One opaque localization slot for the entire list, including unknown-ID fallback.
    const list = document.createElement('span');
    ids.forEach((id, index) => {
        if (index) list.append(document.createTextNode(' '));
        const color = historicalColor(id, entry, state);
        if (color) list.insertAdjacentHTML('beforeend', journalContainerIcon(color, colorBlind));
        else list.append(document.createTextNode('?'));
    });
    return list.outerHTML;
}
