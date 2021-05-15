import { AvailableMoves } from "./available-moves";
import { LogItem } from "./log";
import { Move } from "./move";

export interface GameOptions {
    beginner?: boolean;
}

export enum ContainerColor {
    Orange = "orange",
    Brown = "brown",
    White = "white",
    Black = "darkslategray",
    Tan = "tan"
}

export interface ContainerValue {
    containerColor: ContainerColor;
    baseValue: number;
    specialValue: number;
}

export interface PointCard {
    containerValues: ContainerValue[];
}

export interface ContainerOnStore {
    containerColor: ContainerColor;
    price: number;
}

export enum ShipPosition {
    OpenSea = "sea",
    Player0 = "player0",
    Player1 = "player1",
    Player2 = "player2",
    Player3 = "player3",
    Player4 = "player4",
    Island = "island"
}

export interface Ship {
    shipPosition: ShipPosition;
    containers: ContainerColor[];
}

export interface Player {
    id: number;
    pointCard: PointCard | null;
    factories: ContainerColor[];
    warehouses: number;
    ship: Ship;
    containersOnFactoryStore: ContainerOnStore[];
    containersOnWarehouseStore: ContainerOnStore[];
    money: number;
    loans: number;
    produced: ContainerColor[];
    name?: string;
    availableMoves: AvailableMoves | null;
    lastMove: Move | null;
    actions: number;
    isDropped: boolean;
    bid: number;
    additionalBid: number;
    containersOnIsland: ContainerColor[];
}

export enum Phase {
    Move = "move",
    Bid = "bid",
    AcceptDecline = "acceptDecline"
}

export interface GameState {
    players: Player[];
    currentPlayer: number;
    containersLeft: ContainerColor[];
    factoriesLeft: ContainerColor[];
    warehousesLeft: number;
    auctioningPlayer: number;
    highestBidders: number[];
    phase: Phase;
    options: GameOptions;
    log: LogItem[];
    seed: string;
    round: number;
}
