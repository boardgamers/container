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
    piece: ContainerPiece;
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
    piece: ShipPiece;
    shipPosition: ShipPosition;
    containers: ContainerPiece[];
}

export interface Player {
    id: number;
    pointCard: PointCard | null;
    factories: FactoryPiece[];
    warehouses: WarehousePiece[];
    ship: Ship;
    containersOnFactoryStore: ContainerOnStore[];
    containersOnWarehouseStore: ContainerOnStore[];
    money: number;
    loans: LoanPiece[];
    produced: ContainerColor[];
    name?: string;
    availableMoves: AvailableMoves | null;
    lastMove: Move | null;
    actions: number;
    isDropped: boolean;
    bid: number;
    additionalBid: number;
    showBid: boolean;
    showAdditionalBid: boolean;
    containersOnIsland: ContainerPiece[];
}

export enum Phase {
    Move = "move",
    Bid = "bid",
    AcceptDecline = "acceptDecline",
    Setup = "setup"
}

export interface ContainerPiece {
    id: string;
    color: ContainerColor;
}

export interface FactoryPiece {
    id: string;
    color: ContainerColor;
}

export interface WarehousePiece {
    id: string;
}

export interface LoanPiece {
    id: string;
}

export interface ShipPiece {
    id: string;
}

export interface GameState {
    players: Player[];
    currentPlayer: number | undefined;
    containersLeft: ContainerPiece[];
    factoriesLeft: FactoryPiece[];
    warehousesLeft: WarehousePiece[];
    loansLeft: LoanPiece[];
    auctioningPlayer: number | undefined;
    highestBidders: number[];
    phase: Phase;
    options: GameOptions;
    log: LogItem[];
    seed: string;
    round: number;
}
