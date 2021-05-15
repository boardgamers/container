import { ContainerColor, ContainerOnStore, GameState, Phase, Player, ShipPosition } from "./gamestate";
import { MoveName } from "./move";

export interface AvailableMoves {
    [MoveName.BuyFromFactory]?: Array<{ player: number; container: ContainerOnStore }>;
    [MoveName.BuyFromWarehouse]?: Array<{ player: number; container: ContainerOnStore }>;
    [MoveName.BuyFactory]?: ContainerColor[];
    [MoveName.BuyWarehouse]?: boolean[];
    [MoveName.GetLoan]?: boolean[];
    [MoveName.PayLoan]?: boolean[];
    [MoveName.Produce]?: ContainerColor[];
    [MoveName.Sail]?: ShipPosition[];
    [MoveName.ArrangeFactory]?: ContainerOnStore[];
    [MoveName.ArrangeWarehouse]?: ContainerOnStore[];
    [MoveName.Bid]?: boolean[];
    [MoveName.Accept]?: number[];
    [MoveName.Decline]?: boolean[];
    [MoveName.Pass]?: boolean[];
    [MoveName.Undo]?: boolean[];
}

export function availableMoves(G: GameState, player: Player): AvailableMoves {
    switch (G.phase) {
        case Phase.Bid: {
            return { [MoveName.GetLoan]: [true], [MoveName.Bid]: [true] };
        }

        case Phase.AcceptDecline: {
            return { [MoveName.GetLoan]: [true], [MoveName.Accept]: G.highestBidders, [MoveName.Decline]: [true] };
        }

        case Phase.Move: {
            const moves: AvailableMoves = {};

            // BuyFromFactory
            if (player.actions > 0 || player.lastMove?.name === MoveName.BuyFromFactory) {
                if (player.containersOnWarehouseStore.length < player.warehouses) {
                    const containersAvailable: { player: number; container: ContainerOnStore }[] = [];
                    const playersToBuy: Player[] = player.actions === 0 && player.lastMove?.name === MoveName.BuyFromFactory ?
                        [G.players[player.lastMove.data.player]] : G.players.filter(p => p.id !== player.id);
                    playersToBuy.forEach(p => {
                        containersAvailable.push(...p.containersOnFactoryStore.map(c => ({ player: p.id, container: c })));
                    });
                    moves[MoveName.BuyFromFactory] = containersAvailable.filter(c => c.container.price <= player.money);
                }
            }

            // ArrangeWarehouse
            if (player.actions > 0 || player.lastMove?.name === MoveName.BuyFromFactory) {
                if (player.containersOnWarehouseStore.length > 0) {
                    moves[MoveName.ArrangeWarehouse] = player.containersOnWarehouseStore;
                }
            }

            // BuyFromWarehouse
            if (player.actions > 0 || player.lastMove?.name === MoveName.Sail) {
                if (player.ship.shipPosition !== ShipPosition.Island && player.ship.shipPosition !== ShipPosition.OpenSea) {
                    let otherPlayer: Player;
                    switch (player.ship.shipPosition) {
                        case ShipPosition.Player0: otherPlayer = G.players[0]; break;
                        case ShipPosition.Player1: otherPlayer = G.players[1]; break;
                        case ShipPosition.Player2: otherPlayer = G.players[2]; break;
                        case ShipPosition.Player3: otherPlayer = G.players[3]; break;
                        case ShipPosition.Player4: otherPlayer = G.players[4]; break;
                    }

                    if (otherPlayer.containersOnWarehouseStore.length > 0) {
                        const buyable: { player: number; container: ContainerOnStore }[] = [];
                        otherPlayer.containersOnWarehouseStore.forEach(c => {
                            if (c.price <= player.money)
                                buyable.push({ player: otherPlayer.id, container: c });
                        });
                        moves[MoveName.BuyFromWarehouse] = buyable;
                    }
                }
            }

            // BuyFactory
            if (player.actions > 0) {
                const factoriesLeft: ContainerColor[] = [];
                Object.values(ContainerColor).forEach(color => {
                    if (G.factoriesLeft.filter(f => f.toString() === color).length > 0)
                        factoriesLeft.push(color);
                });
                // G.factoriesLeft.forEach((v, k) => {
                //     if (v > 0 && player.factories.indexOf(k) === -1) factoriesLeft.push(k);
                // });

                if (factoriesLeft.length > 0)
                    moves[MoveName.BuyFactory] = factoriesLeft;
            }

            // BuyWarehouse
            if (player.actions > 0) {
                if (player.warehouses < 5 && player.money >= player.warehouses + 3)
                    moves[MoveName.BuyWarehouse] = [true];
            }

            // GetLoan
            if (player.loans < 2)
                moves[MoveName.GetLoan] = [true];

            // PayLoan
            if (player.money >= 10)
                moves[MoveName.PayLoan] = [true];

            // Produce
            const containersLeft: ContainerColor[] = [];
            // G.containersLeft.forEach((v, k) => {
            //     if (v > 0) containersLeft.push(k);
            // });
            Object.keys(ContainerColor).forEach(key => {
                if (G.containersLeft.filter(f => f.toString() === key).length > 0)
                    containersLeft.push(ContainerColor[key]);
            });

            if ((player.produced.length === 0 && player.money >= 1) || (player.lastMove?.name === MoveName.Produce)) {
                if (player.containersOnFactoryStore.length < player.factories.length * 2) {
                    const canProduce: ContainerColor[] = [];
                    player.factories.forEach(color => {
                        if (canProduce.indexOf(color) === -1) {
                            const totalFactories = player.factories.filter(factoryColor => factoryColor === color).length;
                            const producedContainers = player.produced.filter(producedColor => producedColor === color).length;

                            if (totalFactories > producedContainers)
                                canProduce.push(color);
                        }
                    });

                    if (canProduce.length > 0)
                        moves[MoveName.Produce] = canProduce;
                }
            }

            // ArrangeFactory
            if (player.actions > 0 || player.lastMove?.name === MoveName.Produce) {
                if (player.containersOnFactoryStore.length > 0) {
                    moves[MoveName.ArrangeFactory] = player.containersOnFactoryStore;
                }
            }

            // Sail
            const positions: ShipPosition[] = [];
            if (player.ship.shipPosition === ShipPosition.OpenSea) {
                positions.push(...G.players.filter(p => p !== player).map(p => ShipPosition["Player" + p.id as keyof ShipPosition]));

                if (player.ship.containers.length > 0) {
                    positions.push(ShipPosition.Island);
                }
            } else {
                positions.push(ShipPosition.OpenSea);
            }

            moves[MoveName.Sail] = positions;

            moves[MoveName.Pass] = [true];
            moves[MoveName.Undo] = [true];

            return moves;
        }

        default: {
            return {};
        }
    }
}
