import { ContainerPiece } from 'container-engine/src/gamestate';

export interface UIData {
    dragged?: Vue | null;
    waitingAnimations: number;
}

export interface Piece {
    id: string;
    x: number;
    y: number;
    owner?: number;
    color?: string;
    rotate?: number;
    state?: string;
}

export interface ShipType extends Piece {
    containers: ContainerPiece[];
}

export enum PieceType {
    Warehouse = "warehouse",
    Factory = "factory",
    Container = "container",
    Ship = "ship",
    Loan = "loan"
}

export enum DropZoneType {
    Ship = "ship",
    PlayerHarbour = "playerHarbor",
    Factory = "factory",
    FactoryStore = "factoryStore",
    Warehouse = "warehouse",
    WarehouseStore = "warehouseStore",
    OpenSea = "openSea",
    IslandHarbor = "islandHarbor",
    GetLoan = "getLoan",
    PayLoan = "payLoan",
    Supply = "supply"
}

export enum ContainerState {
    OnBoard = "onBoard",
    OnFactoryStore = "onFactoryStore",
    OnWarehouseStore = "onWarehouseStore",
    OnShip = "onShip",
    OnIsland = "onIsland"
}