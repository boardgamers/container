import type { GameState } from "./index";
import { Move } from "./src/move";
import * as engine from "./src/engine";
import { GameEventName } from "./src/log";
import { asserts } from "./src/utils";
import type { LogEvent, LogMove, GameEvents } from './src/log';

export async function init(nbPlayers: number, expansions: string[], options: {}, seed?: string): Promise<GameState> {
    return engine.setup(nbPlayers, options, seed);
}

export function setPlayerMetaData(G: GameState, player: number, metaData: { name: string }) {
    G.players[player].name = metaData.name;

    return G;
}

export async function move(G: GameState, move: Move, player: number) {
    const index = G.log.length;

    G = engine.move(G, move, player);

    for (const roundEvent of G.log.slice(index).filter(item => item.type === "event" && item.event.name === GameEventName.RoundStart)) {
        asserts<LogEvent>(roundEvent);
        const eventData = roundEvent.event;
        asserts<GameEvents.RoundStart>(eventData);
        (G as any).messages = [...((G as any).messages || []), `Round ${eventData.round}`];
    }

    return G;
}

export { ended, scores } from './src/engine';

export function rankings(G: GameState) {
    const sortedPlayers = G.players
        .sort((p1, p2) => {
            if (p1.money == p2.money) {
                return p1.containersOnIsland.length - p2.containersOnIsland.length;
            } else {
                return p1.money - p2.money;
            }
        }).map(pl => pl.id);

    return G.players.map(pl => sortedPlayers.indexOf(pl.id) + 1);
}

export function replay(G: GameState) {
    const oldPlayers = G.players;

    const oldG = G;

    G = engine.setup(G.players.length, G.options, G.seed);

    for (let i = 0; i < oldPlayers.length && i < G.players.length; i++) {
        G.players[i].name = oldPlayers[i].name;
    }

    for (const move of oldG.log.filter(event => event.type === "move")) {
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

    return G;
}

export function currentPlayer(G: GameState) {
    return G.currentPlayer;
}

export { stripSecret } from './src/engine';

export function messages(G: GameState) {
    const messages = (G as any).messages || [];
    delete (G as any).messages;

    return {
        messages,
        data: G
    };
}

export function logLength(G: GameState, player?: number) {
    return G.log.length;
}

export function logSlice(G: GameState, options?: { player?: number; start?: number; end?: number }) {
    const stripped = engine.stripSecret(G, options?.player);
    return {
        log: stripped.log.slice(options?.start, options?.end),
        availableMoves: options?.end === undefined ?
            stripped.players.map(pl => pl.availableMoves) :
            engine.stripSecret(replay({ ...G, log: G.log.slice(0, options!.end) }), options!.player).players.map(pl => pl.availableMoves)
    };
}
