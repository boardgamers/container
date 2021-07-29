import assert from 'assert';
import { chunk, cloneDeep, groupBy, isEqual, range, zip } from 'lodash';
import seedrandom from 'seedrandom';
import { availableMoves } from './available-moves';
import pointCards from './cards';
import {
    ContainerColor,
    containerColors,
    ContainerPiece,
    FactoryPiece,
    GameOptions,
    GameState,
    Phase,
    Player,
    ShipPosition,
} from './gamestate';
import { GameEventName, LogItem } from './log';
import { Move, MoveName, Moves } from './move';
import { asserts, shuffle } from './utils';

const playerColors = ['dodgerblue', 'red', 'yellow', 'limegreen', 'mediumorchid'];

export function setup(numPlayers: number, { beginner = true }: GameOptions, seed?: string): GameState {
    seed = seed ?? Math.random().toString();
    const rng = seedrandom(seed);

    const cards = shuffle(pointCards, rng() + '');

    const players: Player[] = range(numPlayers).map((id) => ({
        id,
        pointCard: cards.shift()!,
        factories: [],
        warehouses: [],
        ship: {
            piece: { id: `S${id}` },
            containers: [],
            shipPosition: ShipPosition.OpenSea,
        },
        containersOnFactoryStore: [],
        containersOnWarehouseStore: [],
        containersOnIsland: [],
        money: 20,
        loans: [],
        produced: [],
        availableMoves: null,
        lastMove: null,
        actions: 0,
        isDropped: false,
        bid: 0,
        additionalBid: 0,
        showBid: false,
        showAdditionalBid: false,
        isAI: false,
        didDomesticSale: false,
    }));

    const totalContainers = players.length * 4;
    const containersLeft: ContainerPiece[] = [];
    for (const [containerIds, color] of zip(chunk(range(0, totalContainers * 5), totalContainers), containerColors)) {
        containersLeft.push(...containerIds!.map((i) => ({ id: `C${i}` as const, color: color! })));
    }

    const factoriesLeft: FactoryPiece[] = [];
    for (const [factoryIds, color] of zip(chunk(range(0, containerColors.length * 5), 5), containerColors)) {
        factoriesLeft.push(...factoryIds!.map((i) => ({ id: `F${i}` as const, color: color! })));
    }

    const warehousesLeft = range(players.length * 5).map((i) => ({ id: `W${i}` }));
    const loansLeft = range(players.length * 2).map((i) => ({ id: `L${i}` }));

    const startingPlayer = Math.abs(rng.int32()) % players.length;
    const G: GameState = {
        players,
        startingPlayer,
        currentPlayer: startingPlayer,
        containersLeft,
        factoriesLeft,
        warehousesLeft,
        loansLeft,
        auctioningPlayer: -1,
        highestBidders: [],
        phase: Phase.Move,
        options: { beginner },
        log: [],
        hiddenLog: [],
        seed,
        round: 1,
    } as GameState;

    const colors = shuffle(containerColors, rng() + '');

    G.players.forEach((player, i) => {
        const color = colors[i];
        let index = G.factoriesLeft.findIndex((f) => f.color == color);
        const factory = G.factoriesLeft.splice(index, 1)[0];
        player.factories.push(factory);

        index = G.containersLeft.findIndex((c) => c.color == color);
        const container = G.containersLeft.splice(index, 1)[0];
        player.containersOnFactoryStore.push({ piece: container, price: 2, moved: false });

        player.warehouses.push(G.warehousesLeft.pop()!);
    });

    G.log.push({ type: 'event', event: { name: GameEventName.GameStart } });

    G.players[G.currentPlayer!].actions = 2;
    G.players[G.currentPlayer!].availableMoves = availableMoves(G, G.players[G.currentPlayer!]);

    return G;
}

export function stripSecret(G: GameState, player?: number): GameState {
    return {
        ...G,
        seed: 'secret',
        hiddenLog: [],
        players: G.players.map((pl, i) => {
            if (player === i) {
                return pl;
            } else {
                return {
                    ...pl,
                    pointCard: null,
                    availableMoves: pl.availableMoves ? {} : null,
                    money: ended(G) ? pl.money : 0,
                    bid: pl.showBid ? pl.bid : 0,
                    additionalBid: pl.showAdditionalBid ? pl.additionalBid : 0,
                };
            }
        }),
        log: G.log,
    };
}

export function currentPlayers(G: GameState): number[] {
    return [G.currentPlayer!];
}

export function move(G: GameState, move: Move, playerNumber: number, fake?: boolean): GameState {
    const player = G.players[playerNumber];
    const available = player.availableMoves?.[move.name];

    assert(G.currentPlayer === playerNumber, 'It is not your turn!');
    assert(available, 'You are not allowed to run the command ' + move.name);
    assert(
        available.some((x) => isEqual(x, move.data)),
        'Wrong argument for the command ' + move.name
    );
    assert(
        move.name != MoveName.Bid || move.extraData.price + player.bid <= player.money,
        "Can't bid more money than you have!"
    );

    switch (move.name) {
        case MoveName.DomesticSale: {
            asserts<Moves.MoveDomesticSale>(move);
            if (player.containersOnFactoryStore.length > 0) {
                const aux = player.containersOnFactoryStore.find((x) => isEqual(x.piece, move.data))!;
                player.containersOnFactoryStore.splice(player.containersOnFactoryStore.indexOf(aux), 1);
            } else {
                const aux = player.containersOnWarehouseStore.find((x) => isEqual(x.piece, move.data))!;
                player.containersOnWarehouseStore.splice(player.containersOnWarehouseStore.indexOf(aux), 1);
            }

            G.containersLeft.push(move.data);

            player.money += 2;
            player.didDomesticSale = true;

            G.log.push({
                type: 'move',
                player: playerNumber,
                move,
                simple: `${player.name} sells a ${move.data.color} container back to the supply for $2`,
                pretty: `${playerNameHTML(player)} sells a ${containerColorHTML(
                    move.data.color
                )} container back to the supply for $2`,
            });

            break;
        }

        case MoveName.BuyFactory: {
            asserts<Moves.MoveBuyFactory>(move);
            remove(G.factoriesLeft, move.extraData);
            player.factories.push(move.extraData);
            player.money -= player.factories.length * 3;
            player.actions--;

            G.log.push({
                type: 'move',
                player: playerNumber,
                move,
                simple: `${player.name} buys a ${move.data} factory for $${player.factories.length * 3}`,
                pretty: `${playerNameHTML(player)} buys a ${containerColorHTML(move.data)} factory for $${
                    player.factories.length * 3
                }`,
            });

            break;
        }

        case MoveName.BuyWarehouse: {
            asserts<Moves.MoveBuyWarehouse>(move);
            remove(G.warehousesLeft, move.extraData);
            player.warehouses.push(move.extraData);
            player.money -= player.warehouses.length + 2;
            player.actions--;

            G.log.push({
                type: 'move',
                player: playerNumber,
                move,
                simple: `${player.name} buys a warehouse for $${player.warehouses.length + 2}`,
                pretty: `${playerNameHTML(player)} buys a warehouse for $${player.warehouses.length + 2}`,
            });

            break;
        }

        case MoveName.BuyFromFactory: {
            asserts<Moves.MoveBuyFromFactory>(move);
            const otherPlayer = G.players[move.data.player];
            const aux = otherPlayer.containersOnFactoryStore.find((x) => isEqual(x.piece, move.data.piece))!;
            otherPlayer.containersOnFactoryStore.splice(otherPlayer.containersOnFactoryStore.indexOf(aux), 1);
            player.containersOnWarehouseStore.push({
                piece: move.data.piece,
                price: move.extraData.price,
                moved: false,
            });

            player.money -= aux.price;
            otherPlayer.money += aux.price;

            if (
                player.lastMove?.name !== MoveName.BuyFromFactory ||
                player.lastMove?.data.player !== move.data.player
            ) {
                player.actions -= 1;
            }

            G.log.push({
                type: 'move',
                player: playerNumber,
                move,
                simple: `${player.name} buys a ${move.data.piece.color} container from ${otherPlayer.name} for $${aux.price}, new price is $${move.extraData.price}`,
                pretty: `${playerNameHTML(player)} buys a ${containerColorHTML(
                    move.data.piece.color
                )} container from ${playerNameHTML(otherPlayer)} for $${aux.price}, new price is $${
                    move.extraData.price
                }`,
            });

            break;
        }

        case MoveName.BuyFromWarehouse: {
            asserts<Moves.MoveBuyFromWarehouse>(move);
            const otherPlayer = G.players[move.data.player];
            const aux = otherPlayer.containersOnWarehouseStore.find((x) => isEqual(x.piece, move.data.piece))!;
            otherPlayer.containersOnWarehouseStore.splice(otherPlayer.containersOnWarehouseStore.indexOf(aux), 1);
            player.ship.containers.push(move.data.piece);

            player.money -= aux.price;
            otherPlayer.money += aux.price;

            if (
                (player.lastMove?.name !== MoveName.BuyFromWarehouse ||
                    player.lastMove?.data.player !== move.data.player) &&
                player.lastMove?.name !== MoveName.Sail
            ) {
                player.actions -= 1;
            }

            G.log.push({
                type: 'move',
                player: playerNumber,
                move,
                simple: `${player.name} buys a ${move.data.piece.color} container from ${otherPlayer.name} for $${aux.price}`,
                pretty: `${playerNameHTML(player)} buys a ${containerColorHTML(
                    move.data.piece.color
                )} container from ${playerNameHTML(otherPlayer)} for $${aux.price}`,
            });

            break;
        }

        case MoveName.GetLoan: {
            asserts<Moves.MoveGetLoan>(move);
            const loan = G.loansLeft.pop()!;
            player.loans.push(loan);
            player.money += 10;

            const log: LogItem = {
                type: 'move',
                player: playerNumber,
                move,
                simple: `${player.name} takes a loan`,
                pretty: `${playerNameHTML(player)} takes a loan`,
            };

            if (G.phase == Phase.Bid) {
                G.hiddenLog.push(log);
            } else {
                G.log.push(log);
            }

            break;
        }

        case MoveName.PayLoan: {
            asserts<Moves.MovePayLoan>(move);
            const loan = player.loans.pop()!;
            G.loansLeft.push(loan);
            player.money -= 10;

            const log: LogItem = {
                type: 'move',
                player: playerNumber,
                move,
                simple: `${player.name} pays a loan`,
                pretty: `${playerNameHTML(player)} pays a loan`,
            };

            if (G.phase == Phase.Bid) {
                G.hiddenLog.push(log);
            } else {
                G.log.push(log);
            }

            break;
        }

        case MoveName.Produce: {
            asserts<Moves.MoveProduce>(move);
            remove(G.containersLeft, move.extraData.piece);
            player.containersOnFactoryStore.push({
                piece: move.extraData.piece,
                price: move.extraData.price,
                moved: false,
            });
            player.produced.push(move.extraData.piece.color);
            if (player.lastMove?.name !== MoveName.Produce) {
                player.actions -= 1;
                player.money -= 1;
                playerBefore(player, G).money += 1;
            }

            G.log.push({
                type: 'move',
                player: playerNumber,
                move,
                simple: `${player.name} produces a ${move.extraData.piece.color} container, price is $${move.extraData.price}`,
                pretty: `${playerNameHTML(player)} produces a ${containerColorHTML(
                    move.extraData.piece.color
                )} container, price is $${move.extraData.price}`,
            });

            break;
        }

        case MoveName.Sail: {
            asserts<Moves.MoveSail>(move);
            player.ship.shipPosition = move.data;
            if (move.data === ShipPosition.Island) {
                player.actions = 0;
                G.auctioningPlayer = G.currentPlayer;
                G.phase = Phase.Bid;
                nextPlayer(G);
            } else {
                player.actions--;
            }

            G.log.push({
                type: 'move',
                player: playerNumber,
                move,
                simple: `${player.name} sails to ${prettyShipPosition(G, move.data, true)}`,
                pretty: `${playerNameHTML(player)} sails to ${prettyShipPosition(G, move.data)}`,
            });

            break;
        }

        case MoveName.ArrangeFactory: {
            asserts<Moves.MoveArrangeFactory>(move);
            const aux = player.containersOnFactoryStore.find((x) => isEqual(x.piece, move.data))!;
            player.containersOnFactoryStore.splice(player.containersOnFactoryStore.indexOf(aux), 1);
            player.containersOnFactoryStore.push({
                piece: move.data,
                price: move.extraData.price,
                moved: true,
            });

            if (player.lastMove?.name !== MoveName.Produce && player.lastMove?.name !== MoveName.ArrangeFactory) {
                player.actions--;
            }

            G.log.push({
                type: 'move',
                player: playerNumber,
                move,
                simple: `${player.name} changes the price of a ${move.data.color} factory container from $${aux.price} to $${move.extraData.price}`,
                pretty: `${playerNameHTML(player)} changes the price of a ${containerColorHTML(
                    move.data.color
                )} factory container from $${aux.price} to $${move.extraData.price}`,
            });

            break;
        }

        case MoveName.ArrangeWarehouse: {
            asserts<Moves.MoveArrangeWarehouse>(move);
            const aux = player.containersOnWarehouseStore.find((x) => isEqual(x.piece, move.data))!;
            player.containersOnWarehouseStore.splice(player.containersOnWarehouseStore.indexOf(aux), 1);
            player.containersOnWarehouseStore.push({
                piece: move.data,
                price: move.extraData.price,
                moved: true,
            });

            if (
                player.lastMove?.name !== MoveName.BuyFromFactory &&
                player.lastMove?.name !== MoveName.ArrangeWarehouse
            ) {
                player.actions--;
            }

            G.log.push({
                type: 'move',
                player: playerNumber,
                move,
                simple: `${player.name} changes the price of a ${move.data.color} warehouse container from $${aux.price} to $${move.extraData.price}`,
                pretty: `${playerNameHTML(player)} changes the price of a ${containerColorHTML(
                    move.data.color
                )} warehouse container from $${aux.price} to $${move.extraData.price}`,
            });

            break;
        }

        case MoveName.Bid: {
            asserts<Moves.MoveBid>(move);

            if (G.highestBidders.length === 0) {
                G.hiddenLog.push({
                    type: 'move',
                    player: playerNumber,
                    move,
                    simple: `${player.name} bids $${move.extraData.price}`,
                    pretty: `${playerNameHTML(player)} bids $${move.extraData.price}`,
                });
                player.bid = move.extraData.price;
                nextPlayer(G);
            } else {
                G.hiddenLog.push({
                    type: 'move',
                    player: playerNumber,
                    move,
                    simple: `${player.name} bids additional $${move.extraData.price}`,
                    pretty: `${playerNameHTML(player)} bids additional $${move.extraData.price}`,
                });
                player.additionalBid = move.extraData.price;
                do {
                    nextPlayer(G);
                } while (G.highestBidders.indexOf(G.currentPlayer) === -1 && G.auctioningPlayer !== G.currentPlayer);
            }

            if (G.auctioningPlayer === G.currentPlayer) {
                if (G.highestBidders.length === 0) {
                    G.players
                        .filter((p) => p.id !== G.currentPlayer)
                        .forEach((p) => {
                            p.showBid = true;
                        });
                    const highestBid = Math.max(...G.players.map((p) => p.bid));
                    const highestBidders = G.players
                        .filter((p) => p.id != G.currentPlayer && p.bid === highestBid)
                        .map((p) => p.id);
                    G.highestBidders = highestBidders;
                    if (highestBidders.length > 1) {
                        while (highestBidders.indexOf(G.currentPlayer) === -1) {
                            nextPlayer(G);
                        }
                    } else {
                        G.phase = Phase.AcceptDecline;
                    }
                } else {
                    const highestBid = Math.max(...G.players.map((p) => p.bid + p.additionalBid));
                    const highestBidders = G.players
                        .filter((p) => p.id != G.currentPlayer && p.bid + p.additionalBid === highestBid)
                        .map((p) => p.id);
                    G.highestBidders = highestBidders;
                    G.players.forEach((p) => {
                        p.showAdditionalBid = true;
                    });
                    G.phase = Phase.AcceptDecline;
                }
            }

            if (G.phase == Phase.AcceptDecline) {
                G.log.push(...G.hiddenLog);
                G.hiddenLog = [];
            }

            break;
        }

        case MoveName.Accept: {
            const otherPlayer = G.players[move.data];
            otherPlayer.containersOnIsland.push(...player.ship.containers);
            player.ship.containers = [];
            otherPlayer.money -= otherPlayer.bid + otherPlayer.additionalBid;
            player.money += (otherPlayer.bid + otherPlayer.additionalBid) * 2;
            G.players.forEach((p) => {
                p.bid = p.additionalBid = 0;
            });
            G.players.forEach((p) => {
                p.showBid = p.showAdditionalBid = false;
            });
            G.auctioningPlayer = undefined;
            G.highestBidders = [];
            G.phase = Phase.Move;

            nextPlayer(G);
            if (!fake) {
                if ([...new Set(G.containersLeft.map((c) => c.color))].length >= 4) {
                    doUpkeep(G);
                } else {
                    G.phase = Phase.GameEnd;
                    G.currentPlayer = undefined;
                    calculateEndScore(G);
                }
            }

            G.log.push({
                type: 'move',
                player: playerNumber,
                move,
                simple: `${player.name} accepts ${otherPlayer.name}'s bid`,
                pretty: `${playerNameHTML(player)} accepts ${playerNameHTML(otherPlayer)}'s bid`,
            });

            break;
        }

        case MoveName.Decline: {
            player.containersOnIsland.push(...player.ship.containers);
            player.ship.containers = [];
            const bid = G.players[G.highestBidders[0]].bid + G.players[G.highestBidders[0]].additionalBid;
            player.money -= bid;
            G.players.forEach((p) => {
                p.bid = p.additionalBid = 0;
            });
            G.players.forEach((p) => {
                p.showBid = p.showAdditionalBid = false;
            });
            G.auctioningPlayer = undefined;
            G.highestBidders = [];
            G.phase = Phase.Move;

            nextPlayer(G);
            if (!fake) {
                if ([...new Set(G.containersLeft.map((c) => c.color))].length >= 4) {
                    doUpkeep(G);
                } else {
                    G.phase = Phase.GameEnd;
                    G.currentPlayer = undefined;
                    calculateEndScore(G);
                }
            }

            G.log.push({
                type: 'move',
                player: playerNumber,
                move,
                simple: `${player.name} declines all bids`,
                pretty: `${playerNameHTML(player)} declines all bids`,
            });

            break;
        }

        case MoveName.Pass: {
            asserts<Moves.MovePass>(move);

            G.log.push({
                type: 'move',
                player: playerNumber,
                move,
                simple: `${player.name} passes`,
                pretty: `${playerNameHTML(player)} passes`,
            });

            nextPlayer(G);
            if (!fake) {
                if ([...new Set(G.containersLeft.map((c) => c.color))].length >= 4) {
                    doUpkeep(G);
                } else {
                    G.phase = Phase.GameEnd;
                    G.currentPlayer = undefined;
                    calculateEndScore(G);
                }
            }

            break;
        }

        case MoveName.Undo: {
            asserts<Moves.MoveUndo>(move);

            const lastLog = G.log[G.log.length - 1];
            if (lastLog.type == 'move' && lastLog.player == G.currentPlayer && !fake) {
                G.log.pop();
                G = reconstructState(getBaseState(G), G.log);
            }

            return G;
        }
    }

    player.availableMoves = null;

    if (move.name != MoveName.GetLoan && move.name != MoveName.PayLoan) player.lastMove = move;

    if (G.currentPlayer !== undefined)
        G.players[G.currentPlayer].availableMoves = availableMoves(G, G.players[G.currentPlayer]);

    return G;
}

export function moveAI(G: GameState, playerNumber: number): GameState {
    const player = G.players[playerNumber];
    let moveName, data;
    let retry = 0;
    do {
        if (player.actions > 0 && player.money < 5 && player.loans.length < 2 && player.availableMoves!.getLoan) {
            moveName = MoveName.GetLoan;
            const dataArr = player.availableMoves![moveName];
            data = dataArr[Math.floor(Math.random() * dataArr.length)];
        } else if (player.money > 15 && player.loans.length > 0 && player.availableMoves!.payLoan) {
            moveName = MoveName.PayLoan;
            const dataArr = player.availableMoves![moveName];
            data = dataArr[Math.floor(Math.random() * dataArr.length)];
        } else if (
            G.phase == Phase.Move &&
            player.actions > 0 &&
            player.ship.containers.length > 0 &&
            player.lastMove?.name != MoveName.BuyFromWarehouse
        ) {
            moveName = MoveName.Sail;
            data = player.ship.shipPosition == ShipPosition.OpenSea ? ShipPosition.Island : ShipPosition.OpenSea;
        } else {
            const moves = Object.keys(player.availableMoves!);

            if (
                player.lastMove?.name == MoveName.Sail &&
                player.ship.containers.length < 5 &&
                ((player.lastMove?.data.startsWith('playerHarbor0') &&
                    G.players[0].containersOnWarehouseStore.length > 0) ||
                    (player.lastMove?.data.startsWith('playerHarbor1') &&
                        G.players[1].containersOnWarehouseStore.length > 0) ||
                    (player.lastMove?.data.startsWith('playerHarbor2') &&
                        G.players[2].containersOnWarehouseStore.length > 0) ||
                    (player.lastMove?.data.startsWith('playerHarbor3') &&
                        G.players[3].containersOnWarehouseStore.length > 0) ||
                    (player.lastMove?.data.startsWith('playerHarbor4') &&
                        G.players[4].containersOnWarehouseStore.length > 0))
            ) {
                moveName = MoveName.BuyFromWarehouse;
            } else {
                moveName = moves[Math.floor(Math.random() * moves.length)];
            }

            let dataArr = player.availableMoves![moveName];
            if (!dataArr) {
                moveName = moves[Math.floor(Math.random() * moves.length)];
                dataArr = player.availableMoves![moveName];
            }

            data = dataArr[Math.floor(Math.random() * dataArr.length)];

            if (moveName == MoveName.Undo || moveName == MoveName.GetLoan || moveName == MoveName.PayLoan) {
                moveName = null;
            } else if (moveName == MoveName.Sail) {
                if (data == ShipPosition.Island) {
                    if (player.ship.containers.length == 0) moveName = null;
                } else if (data.startsWith('playerHarbor0')) {
                    if (G.players[0].containersOnWarehouseStore.length == 0) moveName = null;
                } else if (data.startsWith('playerHarbor1')) {
                    if (G.players[1].containersOnWarehouseStore.length == 0) moveName = null;
                } else if (data.startsWith('playerHarbor2')) {
                    if (G.players[2].containersOnWarehouseStore.length == 0) moveName = null;
                } else if (data.startsWith('playerHarbor3')) {
                    if (G.players[3].containersOnWarehouseStore.length == 0) moveName = null;
                } else if (data.startsWith('playerHarbor4')) {
                    if (G.players[4].containersOnWarehouseStore.length == 0) moveName = null;
                } else {
                    if (player.lastMove?.name == MoveName.Sail) moveName = null;
                }
            } else if (moveName == MoveName.ArrangeFactory) {
                if (player.lastMove?.name != MoveName.Produce) moveName = null;
            } else if (moveName == MoveName.ArrangeWarehouse) {
                if (player.lastMove?.name != MoveName.BuyFromFactory) moveName = null;
            } else if (moveName == MoveName.GetLoan) {
                moveName = null;
            } else if (moveName == MoveName.Produce) {
                if (player.factories.length < 2) {
                    moveName = null;
                }
            } else if (moveName == MoveName.BuyFromFactory) {
                if (player.warehouses.length < 2) {
                    moveName = null;
                }
            } else if (moveName == MoveName.Pass) {
                if (retry < 10 && player.actions > 0 && Object.keys(player.availableMoves!).length > 3) {
                    moveName = null;
                }
            } else if (moveName == MoveName.BuyFactory) {
                if (player.factories.length == 3 || player.money < 15) moveName = null;
            } else if (moveName == MoveName.BuyWarehouse) {
                if (player.warehouses.length == 3 || player.money < 17) moveName = null;
            } else if (moveName == MoveName.DomesticSale) {
                if (player.money > 5) moveName = null;
            }
        }

        retry++;
    } while (!moveName);

    let playerMove: Move;
    switch (moveName) {
        case MoveName.BuyFromFactory:
            playerMove = {
                name: moveName,
                data,
                extraData: { price: Math.floor(Math.random() * 3) + 2 },
            };
            break;

        case MoveName.BuyFactory:
            playerMove = {
                name: moveName,
                data,
                extraData: G.factoriesLeft.find((p) => p.color == data),
            };
            break;

        case MoveName.BuyWarehouse:
            playerMove = {
                name: moveName,
                data,
                extraData: G.warehousesLeft[0],
            };
            break;

        case MoveName.Produce:
            playerMove = {
                name: moveName,
                data,
                extraData: {
                    piece: G.containersLeft.find((p) => p.color == data),
                    price: Math.floor(Math.random() * 3) + 1,
                },
            };
            break;

        case MoveName.ArrangeFactory:
            playerMove = {
                name: moveName,
                data,
                extraData: { price: Math.floor(Math.random() * 3) + 1 },
            };
            break;

        case MoveName.ArrangeWarehouse:
            playerMove = {
                name: moveName,
                data,
                extraData: { price: Math.floor(Math.random() * 3) + 2 },
            };
            break;

        case MoveName.Bid: {
            const bid = Math.floor(Math.random() * (player.money - player.bid));
            playerMove = {
                name: moveName,
                data,
                extraData: { price: bid > 10 ? Math.ceil(bid / 2) : bid },
            };
            break;
        }

        default:
            playerMove = { name: moveName, data };
            break;
    }

    return move(G, playerMove, playerNumber);
}

export function ended(G: GameState): boolean {
    return G.phase == Phase.GameEnd;
}

function calculateEndScore(G: GameState) {
    G.players.forEach((player) => {
        player.finalScoreBreakdown = [];
        player.finalScoreBreakdown.push('$' + player.money);

        if (player.containersOnIsland.length > 0) {
            const hasOneOfEach = [...new Set(player.containersOnIsland.map((c) => c.color))].length == 5;

            const grouped = groupBy(player.containersOnIsland, (piece) => piece.color);
            const most = Object.keys(grouped).reduce((a, b) => {
                if (grouped[a].length == grouped[b].length) {
                    if (a == player.pointCard!.containerValues[1].containerColor) {
                        return a;
                    } else if (b == player.pointCard!.containerValues[1].containerColor) {
                        return b;
                    } else {
                        const aValue = player.pointCard!.containerValues.find(
                            (cv) => cv.containerColor == a
                        )!.baseValue;
                        const bValue = player.pointCard!.containerValues.find(
                            (cv) => cv.containerColor == b
                        )!.baseValue;
                        return aValue > bValue ? b : a;
                    }
                }

                return grouped[a].length > grouped[b].length ? a : b;
            });

            const points = player.pointCard!.containerValues.map((cv) => {
                if (grouped[cv.containerColor]) {
                    player.finalScoreBreakdown!.push(
                        `$${grouped[cv.containerColor].length * (hasOneOfEach ? cv.specialValue : cv.baseValue)} (${
                            cv.containerColor
                        } x ${grouped[cv.containerColor].length})`
                    );
                    return grouped[cv.containerColor].length * (hasOneOfEach ? cv.specialValue : cv.baseValue);
                } else {
                    player.finalScoreBreakdown!.push(`$0 (${cv.containerColor} x 0)`);
                    return 0;
                }
            });

            player.money += points.reduce((a, b) => a + b, 0);

            const mostValue = player.pointCard!.containerValues.find((cv) => cv.containerColor === most)!;
            player.finalScoreBreakdown!.push(
                '-$' + grouped[most].length * (hasOneOfEach ? mostValue.specialValue : mostValue.baseValue)
            );
            player.money -= grouped[most].length * (hasOneOfEach ? mostValue.specialValue : mostValue.baseValue);
        } else {
            player.finalScoreBreakdown.push('-');
            player.finalScoreBreakdown.push('-');
            player.finalScoreBreakdown.push('-');
            player.finalScoreBreakdown.push('-');
            player.finalScoreBreakdown.push('-');
            player.finalScoreBreakdown.push('-');
        }

        player.finalScoreBreakdown.push('$' + player.containersOnWarehouseStore.length * 2);
        player.money += player.containersOnWarehouseStore.length * 2;
        player.finalScoreBreakdown.push('$' + player.ship.containers.length * 3);
        player.money += player.ship.containers.length * 3;
        player.finalScoreBreakdown.push('-$' + player.loans.length * 11);
        player.money += player.loans.length * -11;
    });
}

export function scores(G: GameState): number[] {
    return G.players.map((_) => 0);
}

export function reconstructState(initialState: GameState, log: LogItem[]): GameState {
    const G = cloneDeep(initialState);

    for (const item of log) {
        switch (item.type) {
            case 'event': {
                break;
            }

            case 'phase': {
                break;
            }

            case 'move': {
                move(G, item.move, item.player);
                break;
            }
        }
    }

    return G;
}

function playerBefore(player: Player, G: GameState) {
    return player.id === 0 ? G.players[G.players.length - 1] : G.players[player.id - 1];
}

function nextPlayer(G: GameState) {
    G.currentPlayer = (G.currentPlayer! + 1) % G.players.length;
}

function doUpkeep(G: GameState) {
    const player = G.players[G.currentPlayer!];
    const loanCount = player.loans.length;
    const interest: string[] = [];
    for (let i = 0; i < loanCount; i++) {
        if (player.money > 0) {
            player.money--;
            interest.push('money');
        } else if (player.containersOnIsland.length > 0) {
            const container = removeRandom(player.containersOnIsland);
            G.log.push({
                type: 'event',
                event: {
                    name: GameEventName.Upkeep,
                    interest: `The bank seizes a ${containerColorHTML(container.color)} container from ${playerNameHTML(
                        player
                    )}'s island`,
                },
            });
        } else if (player.containersOnWarehouseStore.length + player.containersOnFactoryStore.length > 0) {
            if (player.containersOnWarehouseStore.length >= 2) {
                const c1 = removeRandom(player.containersOnWarehouseStore);
                const c2 = removeRandom(player.containersOnWarehouseStore);
                G.log.push({
                    type: 'event',
                    event: {
                        name: GameEventName.Upkeep,
                        interest: `The bank seizes a ${containerColorHTML(
                            c1.color
                        )} container and a ${containerColorHTML(c2.color)} container from ${playerNameHTML(
                            player
                        )}'s warehouses`,
                    },
                });
            } else if (player.containersOnWarehouseStore.length == 1) {
                const c1 = removeRandom(player.containersOnWarehouseStore);
                if (player.containersOnFactoryStore.length >= 1) {
                    const c2 = removeRandom(player.containersOnFactoryStore);
                    G.log.push({
                        type: 'event',
                        event: {
                            name: GameEventName.Upkeep,
                            interest: `The bank seizes a ${containerColorHTML(
                                c1.color
                            )} container from ${playerNameHTML(player)}'s warehouses and a ${
                                c2.color
                            } container from ${playerNameHTML(player)}'s factory`,
                        },
                    });
                } else {
                    G.log.push({
                        type: 'event',
                        event: {
                            name: GameEventName.Upkeep,
                            interest: `The bank seizes a ${containerColorHTML(
                                c1.color
                            )} container from ${playerNameHTML(player)}'s warehouses`,
                        },
                    });
                }
            } else {
                const c1 = removeRandom(player.containersOnFactoryStore);
                if (player.containersOnFactoryStore.length >= 1) {
                    const c2 = removeRandom(player.containersOnFactoryStore);
                    G.log.push({
                        type: 'event',
                        event: {
                            name: GameEventName.Upkeep,
                            interest: `The bank seizes a ${containerColorHTML(
                                c1.color
                            )} container and a ${containerColorHTML(c2.color)} container from ${playerNameHTML(
                                player
                            )}'s factory`,
                        },
                    });
                } else {
                    G.log.push({
                        type: 'event',
                        event: {
                            name: GameEventName.Upkeep,
                            interest: `The bank seizes a ${containerColorHTML(
                                c1.color
                            )} container from ${playerNameHTML(player)}'s factory`,
                        },
                    });
                }
            }
        } else if (player.warehouses.length > 2) {
            player.warehouses.pop();
            const loan = player.loans.pop()!;
            G.loansLeft.push(loan);
            G.log.push({
                type: 'event',
                event: {
                    name: GameEventName.Upkeep,
                    interest: `The bank seizes a warehouse from ${playerNameHTML(player)}`,
                },
            });
        } else if (player.factories.length > 2) {
            player.factories.pop();
            const loan = player.loans.pop()!;
            G.loansLeft.push(loan);
            G.log.push({
                type: 'event',
                event: {
                    name: GameEventName.Upkeep,
                    interest: `The bank seizes a factory from ${playerNameHTML(player)}`,
                },
            });
        }
    }

    G.players[G.currentPlayer!].actions = 2;
    G.players[G.currentPlayer!].produced = [];
    G.players[G.currentPlayer!].containersOnFactoryStore.forEach((c) => (c.moved = false));
    G.players[G.currentPlayer!].containersOnWarehouseStore.forEach((c) => (c.moved = false));
    G.players[G.currentPlayer!].didDomesticSale = false;

    if (G.currentPlayer == G.startingPlayer) {
        G.round++;
    }
}

function remove(array, value) {
    const aux = array.find((x) => isEqual(x, value));
    return array.splice(array.indexOf(aux), 1);
}

function removeRandom(array) {
    return array.splice(Math.floor(Math.random() * array.length), 1)[0];
}

function getBaseState(G: GameState): GameState {
    const baseState = setup(G.players.length, G.options, G.seed);
    baseState.players.forEach((player, i) => {
        player.name = G.players[i].name;
        player.isAI = G.players[i].isAI;
    });

    return baseState;
}

function prettyShipPosition(G: GameState, data: ShipPosition, simple = false): string {
    switch (data) {
        case ShipPosition.Island:
            return 'the island harbor';
        case ShipPosition.OpenSea:
            return 'the open sea';
        default: {
            const index = data[12];
            return simple ? `${G.players[index].name}'s harbor` : `${playerNameHTML(G.players[index])}'s harbor`;
        }
    }
}

function playerNameHTML(player) {
    return `<span style="background-color: ${playerColors[player.id]}; font-weight: bold; padding: 0 3px;">${
        player.name
    }</span>`;
}

function containerColorHTML(containerColor: ContainerColor) {
    switch (containerColor) {
        case ContainerColor.Brown:
        case ContainerColor.Orange:
        case ContainerColor.Tan:
        case ContainerColor.White:
            return `<span style="background-color: ${containerColor}; font-weight: bold; border: 1px solid black; padding: 0 3px;">${containerColor}</span>`;
        case ContainerColor.Black:
            return '<span style="background-color: #2F4F4F; font-weight: bold; border: 1px solid black; padding: 0 3px;">darkslategray</span>';
    }
}
