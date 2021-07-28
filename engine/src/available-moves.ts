import { remove } from 'lodash';
import { ContainerColor, ContainerOnStore, ContainerPiece, GameState, Phase, Player, ShipPosition } from './gamestate';
import { MoveName } from './move';

export interface AvailableMoves {
    [MoveName.DomesticSale]?: ContainerPiece[];
    [MoveName.BuyFromFactory]?: Array<{
        player: number;
        piece: ContainerPiece;
    }>;
    [MoveName.BuyFromWarehouse]?: Array<{
        player: number;
        piece: ContainerPiece;
    }>;
    [MoveName.BuyFactory]?: ContainerColor[];
    [MoveName.BuyWarehouse]?: boolean[];
    [MoveName.GetLoan]?: boolean[];
    [MoveName.PayLoan]?: boolean[];
    [MoveName.Produce]?: ContainerColor[];
    [MoveName.Sail]?: ShipPosition[];
    [MoveName.ArrangeFactory]?: ContainerPiece[];
    [MoveName.ArrangeWarehouse]?: ContainerPiece[];
    [MoveName.Bid]?: boolean[];
    [MoveName.Accept]?: number[];
    [MoveName.Decline]?: boolean[];
    [MoveName.Pass]?: boolean[];
    [MoveName.Undo]?: boolean[];
}

export function availableMoves(G: GameState, player: Player): AvailableMoves {
    switch (G.phase) {
        case Phase.Bid: {
            const moves = {
                [MoveName.Bid]: [true],
            };

            if (player.loans.length < 2) moves[MoveName.GetLoan] = [true];

            // Undo
            const lastLog = G.log[G.log.length - 1];
            if (lastLog.type == 'move' && lastLog.player == G.currentPlayer) moves[MoveName.Undo] = [true];

            return moves;
        }

        case Phase.AcceptDecline: {
            const moves: AvailableMoves = {
                [MoveName.Accept]: G.highestBidders,
            };

            if (player.loans.length < 2) moves[MoveName.GetLoan] = [true];

            const highestBidder = G.players[G.highestBidders[0]];
            if (player.money >= highestBidder.bid + highestBidder.additionalBid) moves[MoveName.Decline] = [true];

            // Undo
            const lastLog = G.log[G.log.length - 1];
            if (lastLog.type == 'move' && lastLog.player == G.currentPlayer) moves[MoveName.Undo] = [true];

            return moves;
        }

        case Phase.Move: {
            let moves: AvailableMoves = {};

            // DomesticSale
            if (player.actions == 2 && !player.didDomesticSale && G.round > 1) {
                if (player.containersOnFactoryStore.length > 0) {
                    moves[MoveName.DomesticSale] = player.containersOnFactoryStore.map((c) => c.piece);
                } else if (player.containersOnWarehouseStore.length > 0) {
                    moves[MoveName.DomesticSale] = player.containersOnWarehouseStore.map((c) => c.piece);
                }
            }

            // BuyFromFactory
            if (player.actions > 0 || player.lastMove?.name === MoveName.BuyFromFactory) {
                if (player.containersOnWarehouseStore.length < player.warehouses.length) {
                    const containersAvailable: {
                        player: number;
                        container: ContainerOnStore;
                    }[] = [];
                    const playersToBuy: Player[] =
                        player.actions === 0 && player.lastMove?.name === MoveName.BuyFromFactory
                            ? [G.players[player.lastMove.data.player]]
                            : G.players.filter((p) => p.id !== player.id);
                    playersToBuy.forEach((p) => {
                        containersAvailable.push(
                            ...p.containersOnFactoryStore.map((c) => ({
                                player: p.id,
                                container: c,
                            }))
                        );
                    });

                    const buyable = containersAvailable
                        .filter((c) => c.container.price <= player.money)
                        .map((c) => ({
                            player: c.player,
                            piece: c.container.piece,
                        }));

                    if (buyable.length > 0) moves[MoveName.BuyFromFactory] = buyable;
                }
            }

            // BuyFromWarehouse
            if (
                player.actions > 0 ||
                player.lastMove?.name === MoveName.Sail ||
                player.lastMove?.name === MoveName.BuyFromWarehouse
            ) {
                if (
                    player.ship.shipPosition !== ShipPosition.Island &&
                    player.ship.shipPosition !== ShipPosition.OpenSea &&
                    player.ship.containers.length < 5
                ) {
                    let otherPlayer: Player;
                    switch (player.ship.shipPosition) {
                        case ShipPosition.PlayerHarbor01:
                        case ShipPosition.PlayerHarbor02:
                        case ShipPosition.PlayerHarbor03:
                        case ShipPosition.PlayerHarbor04:
                            otherPlayer = G.players[0];
                            break;

                        case ShipPosition.PlayerHarbor11:
                        case ShipPosition.PlayerHarbor12:
                        case ShipPosition.PlayerHarbor13:
                        case ShipPosition.PlayerHarbor14:
                            otherPlayer = G.players[1];
                            break;

                        case ShipPosition.PlayerHarbor21:
                        case ShipPosition.PlayerHarbor22:
                        case ShipPosition.PlayerHarbor23:
                        case ShipPosition.PlayerHarbor24:
                            otherPlayer = G.players[2];
                            break;

                        case ShipPosition.PlayerHarbor31:
                        case ShipPosition.PlayerHarbor32:
                        case ShipPosition.PlayerHarbor33:
                        case ShipPosition.PlayerHarbor34:
                            otherPlayer = G.players[3];
                            break;

                        case ShipPosition.PlayerHarbor41:
                        case ShipPosition.PlayerHarbor42:
                        case ShipPosition.PlayerHarbor43:
                        case ShipPosition.PlayerHarbor44:
                            otherPlayer = G.players[4];
                            break;
                    }

                    if (otherPlayer.containersOnWarehouseStore.length > 0) {
                        const buyable: {
                            player: number;
                            piece: ContainerPiece;
                        }[] = [];
                        otherPlayer.containersOnWarehouseStore.forEach((c) => {
                            if (c.price <= player.money)
                                buyable.push({
                                    player: otherPlayer.id,
                                    piece: c.piece,
                                });
                        });

                        if (buyable.length > 0) moves[MoveName.BuyFromWarehouse] = buyable;
                    }
                }
            }

            // BuyFactory
            if (player.actions > 0 && player.money >= (player.factories.length + 1) * 3) {
                const factoriesLeft: ContainerColor[] = [];
                Object.values(ContainerColor).forEach((color) => {
                    if (
                        G.factoriesLeft.filter((f) => f.color.toString() === color).length > 0 &&
                        player.factories.map((f) => f.color).indexOf(color) == -1
                    )
                        factoriesLeft.push(color);
                });

                if (factoriesLeft.length > 0) moves[MoveName.BuyFactory] = factoriesLeft;
            }

            // BuyWarehouse
            if (player.actions > 0) {
                if (player.warehouses.length < 5 && player.money >= player.warehouses.length + 3)
                    moves[MoveName.BuyWarehouse] = [true];
            }

            // GetLoan
            if (player.loans.length < 2) moves[MoveName.GetLoan] = [true];

            // PayLoan
            if (player.loans.length > 0 && player.money >= 10) moves[MoveName.PayLoan] = [true];

            // ArrangeFactory
            if (
                player.actions > 0 ||
                player.lastMove?.name === MoveName.Produce ||
                player.lastMove?.name === MoveName.ArrangeFactory
            ) {
                const notMoved = player.containersOnFactoryStore.filter((c) => !c.moved);
                if (notMoved.length > 0) {
                    moves[MoveName.ArrangeFactory] = notMoved.map((c) => c.piece);
                }
            }

            // ArrangeWarehouse
            if (
                player.actions > 0 ||
                player.lastMove?.name === MoveName.BuyFromFactory ||
                player.lastMove?.name === MoveName.ArrangeWarehouse
            ) {
                const notMoved = player.containersOnWarehouseStore.filter((c) => !c.moved);
                if (notMoved.length > 0) {
                    moves[MoveName.ArrangeWarehouse] = notMoved.map((c) => c.piece);
                }
            }

            // Sail
            if (player.actions > 0) {
                const positions: ShipPosition[] = [];
                if (player.ship.shipPosition === ShipPosition.OpenSea) {
                    positions.push(
                        ...G.players
                            .filter((p) => p !== player)
                            .map((p) => ShipPosition[('PlayerHarbor' + p.id + '1') as keyof ShipPosition])
                    );
                    positions.push(
                        ...G.players
                            .filter((p) => p !== player)
                            .map((p) => ShipPosition[('PlayerHarbor' + p.id + '2') as keyof ShipPosition])
                    );
                    positions.push(
                        ...G.players
                            .filter((p) => p !== player)
                            .map((p) => ShipPosition[('PlayerHarbor' + p.id + '3') as keyof ShipPosition])
                    );
                    positions.push(
                        ...G.players
                            .filter((p) => p !== player)
                            .map((p) => ShipPosition[('PlayerHarbor' + p.id + '4') as keyof ShipPosition])
                    );

                    remove(positions, (pos) => G.players.map((p) => p.ship.shipPosition).indexOf(pos) != -1);

                    if (player.ship.containers.length > 0) {
                        positions.push(ShipPosition.Island);
                    }
                } else {
                    positions.push(ShipPosition.OpenSea);
                }

                moves[MoveName.Sail] = positions;
            }

            moves[MoveName.Pass] = [true];

            // Produce
            const containersLeft: ContainerColor[] = [];
            Object.keys(ContainerColor).forEach((key) => {
                if (G.containersLeft.filter((f) => f.color.toString() === ContainerColor[key]).length > 0)
                    containersLeft.push(ContainerColor[key]);
            });

            if (
                (player.produced.length === 0 && player.money >= 1 && player.actions > 0) ||
                player.lastMove?.name === MoveName.Produce
            ) {
                if (
                    player.containersOnFactoryStore.length < player.factories.length * 2 &&
                    player.produced.length < player.factories.length
                ) {
                    const canProduce: ContainerColor[] = [];
                    player.factories.forEach((factory) => {
                        if (canProduce.indexOf(factory.color) === -1) {
                            const totalFactories = player.factories.filter(
                                (factoryColor) => factoryColor === factory
                            ).length;
                            const producedContainers = player.produced.filter(
                                (producedColor) => producedColor === factory.color
                            ).length;

                            if (totalFactories > producedContainers && containersLeft.indexOf(factory.color) !== -1)
                                canProduce.push(factory.color);
                        }
                    });

                    if (canProduce.length > 0) {
                        if (player.lastMove?.name === MoveName.Produce) moves = {};

                        moves[MoveName.Produce] = canProduce;
                    }
                }
            }

            // Undo
            const lastLog = G.log[G.log.length - 1];
            if (lastLog.type == 'move' && lastLog.player == G.currentPlayer) moves[MoveName.Undo] = [true];

            return moves;
        }

        default: {
            return {};
        }
    }
}
