import { ContainerColor, ContainerPiece, FactoryPiece, ShipPosition, WarehousePiece } from "./gamestate";

export declare namespace Moves {
    export interface MoveBuyFromFactory {
        name: MoveName.BuyFromFactory;
        data: {
            player: number;
            piece: ContainerPiece;
        };
        extraData: { price: number };
    }

    export interface MoveBuyFromWarehouse {
        name: MoveName.BuyFromWarehouse;
        data: {
            player: number;
            piece: ContainerPiece;
        };
    }

    export interface MoveBuyFactory {
        name: MoveName.BuyFactory;
        data: ContainerColor;
        extraData: FactoryPiece;
    }

    export interface MoveBuyWarehouse {
        name: MoveName.BuyWarehouse;
        data: boolean;
        extraData: WarehousePiece;
    }

    export interface MoveGetLoan {
        name: MoveName.GetLoan;
        data: boolean;
    }

    export interface MovePayLoan {
        name: MoveName.PayLoan;
        data: boolean;
    }

    export interface MoveProduce {
        name: MoveName.Produce;
        data: ContainerColor;
        extraData: { piece: ContainerPiece; price: number };
    }

    export interface MoveSail {
        name: MoveName.Sail;
        data: ShipPosition;
    }

    export interface MoveArrangeFactory {
        name: MoveName.ArrangeFactory;
        data: ContainerPiece;
        extraData: { price: number };
    }

    export interface MoveArrangeWarehouse {
        name: MoveName.ArrangeWarehouse;
        data: ContainerPiece;
        extraData: { price: number };
    }

    export interface MoveBid {
        name: MoveName.Bid;
        data: boolean;
        extraData: { price: number };
    }

    export interface MoveDecline {
        name: MoveName.Decline;
        data: boolean;
    }

    export interface MoveAccept {
        name: MoveName.Accept;
        data: number;
    }

    export interface MovePass {
        name: MoveName.Pass;
        data: boolean;
    }

    export interface MoveUndo {
        name: MoveName.Undo;
        data: boolean;
    }
}

export type Move =
    Moves.MoveBuyFromFactory | Moves.MoveBuyFromWarehouse |
    Moves.MoveBuyFactory | Moves.MoveBuyWarehouse |
    Moves.MoveGetLoan | Moves.MovePayLoan |
    Moves.MoveProduce | Moves.MoveSail |
    Moves.MoveArrangeFactory | Moves.MoveArrangeWarehouse |
    Moves.MoveBid | Moves.MoveAccept | Moves.MoveDecline |
    Moves.MovePass | Moves.MoveUndo;

export enum MoveName {
    BuyWarehouse = "buyWarehouse",
    BuyFactory = "buyFactory",
    BuyFromFactory = "buyFromFactory",
    BuyFromWarehouse = "buyFromWarehouse",
    GetLoan = "getLoan",
    PayLoan = "payLoan",
    Produce = "produce",
    Sail = "sail",
    ArrangeFactory = "arrangeFactory",
    ArrangeWarehouse = "arrangeWarehouse",
    Bid = "bid",
    Accept = "accept",
    Decline = "decline",
    Pass = "pass",
    Undo = "undo"
}
