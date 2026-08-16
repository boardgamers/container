import { cloneDeep } from 'lodash';
import type { GameState } from './index';
import * as engine from './src/engine';
import type { LogMove } from './src/log';
import { Move } from './src/move';
import { asserts } from './src/utils';

export async function init(nbPlayers: number, expansions: string[], options: {}, seed?: string): Promise<GameState> {
    return engine.setup(nbPlayers, options, seed);
}

export function setPlayerMetaData(G: GameState, player: number, metaData: { name: string }) {
    G.players[player].name = metaData.name;

    return G;
}

/**
 * Execute the current turn of `player` so far.
 *
 * The payload is the **whole turn buffer**: an array of atomic moves accumulated by the
 * viewer since the last committed state. `G` is always a committed state (tentative
 * states are never persisted by the platform), so the buffer is replayed from it in
 * order. A bare move object is also accepted and treated as a one-element buffer.
 *
 * While the resulting state is still tentative (the mover could undo, i.e.
 * `G.newTurn === false`), `toSave` returns `undefined`: the platform then sends the
 * tentative state back to the acting player without persisting it or granting a time
 * increment. Undo is implemented by the viewer replaying a shortened buffer — or, when
 * the buffer empties, by doing nothing at all, since the saved state *is* the turn start.
 */
export async function move(G: GameState, move: Move | Move[] | null | undefined, player: number) {
    const moves: Move[] = move == null ? [] : Array.isArray(move) ? move : [move];

    if (moves.length === 0) {
        // Nothing to apply — flag the result as tentative so nothing gets persisted
        // and no time increment is granted.
        return { ...G, newTurn: false };
    }

    for (let i = 0; i < moves.length; i++) {
        G = engine.move(G, moves[i], player);

        // The buffer must describe at most ONE turn: committing is what grants the
        // mover their per-turn time increment. Without this guard a buffer like
        // `[..., Pass, ...more]` — legal in the degenerate case where the same player
        // is up again because everyone else dropped — would replay across the turn
        // boundary and commit several turns for a single increment.
        if (G.newTurn !== false && i < moves.length - 1) {
            throw new Error('The turn buffer continues past a turn boundary: only one turn may be played per call');
        }
    }

    return G;
}

/**
 * Only committed states are persisted. Tentative states (mid-turn, still undoable)
 * return `undefined` so the platform neither saves them nor grants a time increment.
 */
export function toSave(G: GameState): GameState | undefined {
    return G.newTurn === false ? undefined : G;
}

export function factions(G: GameState) {
    return G.players.map((pl) => engine.playerColors[pl.id]);
}

export { ended, scores, stripSecret } from './src/engine';

/**
 * Play a full turn for `player`. The engine's own `moveAI` plays one atomic move at a
 * time, which can leave the state tentative (`toSave` would refuse to persist it); the
 * platform's bot driver and `dropPlayer` auto-play both require committed states, so we
 * keep playing until the turn commits.
 */
export function moveAI(G: GameState, player: number): GameState {
    for (let i = 0; i < 500 && !engine.ended(G) && G.currentPlayers.includes(player); i++) {
        G = engine.moveAI(G, player);

        if (G.newTurn !== false) {
            return G;
        }
    }

    // Safety net — should be unreachable (Pass is always available in the move phase
    // and commits the turn). The state is consistent (every atomic move was legal and
    // logged), it just did not reach a turn boundary; persisting it keeps the game
    // going instead of wedging it. Shout so a would-be livelock is visible in the
    // server logs instead of being silently masked.
    console.error(
        `moveAI: force-committing after 500 moves without reaching a turn boundary (player ${player}, phase ${G.phase}, round ${G.round})`
    );
    G.newTurn = true;

    return G;
}

export function rankings(G: GameState) {
    const sortedPlayers = cloneDeep(G.players)
        .sort((p1, p2) => {
            if (p1.money == p2.money) {
                return p1.containersOnIsland.length - p2.containersOnIsland.length;
            } else {
                return p1.money - p2.money;
            }
        })
        .map((pl) => pl.id)
        .reverse();

    return G.players.map((pl) => sortedPlayers.indexOf(pl.id) + 1);
}

export function replay(G: GameState) {
    const oldPlayers = G.players;

    const oldG = G;

    G = engine.setup(G.players.length, G.options, G.seed);

    for (let i = 0; i < oldPlayers.length && i < G.players.length; i++) {
        G.players[i].name = oldPlayers[i].name;
    }

    for (const move of oldG.log.filter((event) => event.type === 'move')) {
        asserts<LogMove>(move);

        G = engine.move(G, move.move, move.player);
    }

    return G;
}

export function round(G: GameState) {
    return G.round;
}

export async function dropPlayer(G: GameState, player: number) {
    G.players[player].isDropped = true;

    engine.nextPlayer(G);

    // Dropping a player always yields a committed state: tentative states are never
    // persisted, so `G` was committed to begin with and the drop simply advances the turn.
    G.newTurn = true;

    return G;
}

export function currentPlayer(G: GameState) {
    return G.currentPlayers;
}

export function messages(G: GameState) {
    return {
        messages: [],
        data: G,
    };
}

export function logLength(G: GameState, _player?: number) {
    return G.log.length;
}

export function logSlice(G: GameState, options?: { player?: number; start?: number; end?: number }) {
    const stripped = engine.stripSecret(G, options?.player);
    return {
        // The full (stripped) state. This is how the acting player's viewer receives
        // tentative states: they are never persisted or broadcast, only returned in the
        // move response's log slice.
        state: stripped,
        log: stripped.log.slice(options?.start, options?.end),
        availableMoves:
            options?.end === undefined
                ? stripped.players.map((pl) => pl.availableMoves)
                : engine
                      .stripSecret(replay({ ...G, log: G.log.slice(0, options!.end) }), options!.player)
                      .players.map((pl) => pl.availableMoves),
    };
}
