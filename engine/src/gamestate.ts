import { AvailableMoves } from './available-moves';
import { LogItem } from './log';
import { Move } from './move';

export interface GameOptions {
    beginner?: boolean;
}

export enum ContainerColor {
    Orange = 'orange',
    Brown = 'brown',
    White = 'white',
    Black = 'darkslategray',
    Tan = 'tan',
}

export const containerColors = Object.values(ContainerColor);

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
    moved: boolean;
}

export enum ShipPosition {
    OpenSea = 'sea',
    PlayerHarbor01 = 'playerHarbor01',
    PlayerHarbor02 = 'playerHarbor02',
    PlayerHarbor03 = 'playerHarbor03',
    PlayerHarbor04 = 'playerHarbor04',
    PlayerHarbor11 = 'playerHarbor11',
    PlayerHarbor12 = 'playerHarbor12',
    PlayerHarbor13 = 'playerHarbor13',
    PlayerHarbor14 = 'playerHarbor14',
    PlayerHarbor21 = 'playerHarbor21',
    PlayerHarbor22 = 'playerHarbor22',
    PlayerHarbor23 = 'playerHarbor23',
    PlayerHarbor24 = 'playerHarbor24',
    PlayerHarbor31 = 'playerHarbor31',
    PlayerHarbor32 = 'playerHarbor32',
    PlayerHarbor33 = 'playerHarbor33',
    PlayerHarbor34 = 'playerHarbor34',
    PlayerHarbor41 = 'playerHarbor41',
    PlayerHarbor42 = 'playerHarbor42',
    PlayerHarbor43 = 'playerHarbor43',
    PlayerHarbor44 = 'playerHarbor44',
    Island = 'island',
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
    isAI: boolean;
    finalScoreBreakdown?: string[];
}

export enum Phase {
    Move = 'move',
    Bid = 'bid',
    AcceptDecline = 'acceptDecline',
    Setup = 'setup',
    GameEnd = 'gameEnd',
}

export interface ContainerPiece {
    id: `C${number}`;
    color: ContainerColor;
}

export interface FactoryPiece {
    id: `F${number}`;
    color: ContainerColor;
}

export interface WarehousePiece {
    id: `W${number}`;
}

export interface LoanPiece {
    id: string;
}

export interface ShipPiece {
    id: `S${number}`;
}

export interface GameState {
    players: Player[];
    startingPlayer: number;
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
    hiddenLog: LogItem[];
    seed: string;
    round: number;
}
