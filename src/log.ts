import { Phase } from "./gamestate";
import { Move } from "./move";

export enum GameEventName {
    GameStart = "start",
    GameEnd = "end",
    RoundStart = "round"
}

export declare namespace GameEvents {
    export interface GameStart {
        name: GameEventName.GameStart;
    }

    export interface GameEnd {
        name: GameEventName.GameEnd;
    }

    export interface RoundStart {
        name: GameEventName.RoundStart;
        round: number;
    }
}

type GameEvent = GameEvents.GameStart | GameEvents.GameEnd | GameEvents.RoundStart;

export type LogPhase = {
    type: "phase";
    phase: Phase;
};

export type LogEvent = {
    type: "event";
    event: GameEvent;
}

export type LogMove = {
    type: "move";
    player: number;
    move: Move;
}

export type LogItem = LogPhase | LogEvent | LogMove;
