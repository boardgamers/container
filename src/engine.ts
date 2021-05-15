import assert from "assert";
import seedrandom from "seedrandom";
import { GameOptions, Phase, GameState, Player, ContainerColor, ShipPosition } from "./gamestate";
import { availableMoves } from "./available-moves";
import { Move, MoveName, Moves } from "./move";
import { asserts, shuffle } from "./utils";
import { GameEventName, LogItem } from "./log";
import pointCards from "./cards";
import { cloneDeep, isEqual } from "lodash";

export function setup(numPlayers: number, { beginner = true }: GameOptions, seed?: string): GameState {
    const rng = seedrandom(seed || Math.random().toString());

    const cards = shuffle(pointCards, rng() + '');
    const factories = shuffle([ContainerColor.Black, ContainerColor.Orange, ContainerColor.Tan, ContainerColor.White, ContainerColor.Brown], rng() + '');

    let id = 0;
    const players: Player[] = new Array(numPlayers).fill(0).map(() => ({
        id: id++,
        pointCard: cards.shift()!,
        factories: [factories[0]],
        warehouses: 1,
        ship: { containers: [], shipPosition: ShipPosition.OpenSea },
        containersOnFactoryStore: [{ containerColor: factories.shift()!, price: 2 }],
        containersOnWarehouseStore: [],
        containersOnIsland: [],
        money: 20,
        loans: 0,
        produced: [],
        availableMoves: null,
        lastMove: null,
        actions: 0,
        isDropped: false,
        bid: 0,
        additionalBid: 0,
    }));

    const totalContainers = players.length * 4 - 1;
    const containersLeft: ContainerColor[] = [];
    containersLeft.push(...new Array(totalContainers).fill(ContainerColor.Brown));
    containersLeft.push(...new Array(totalContainers).fill(ContainerColor.White));
    containersLeft.push(...new Array(totalContainers).fill(ContainerColor.Black));
    containersLeft.push(...new Array(totalContainers).fill(ContainerColor.Orange));
    containersLeft.push(...new Array(totalContainers).fill(ContainerColor.Tan));

    const factoriesLeft: ContainerColor[] = [];
    factoriesLeft.push(...new Array(4).fill(ContainerColor.Brown));
    factoriesLeft.push(...new Array(4).fill(ContainerColor.White));
    factoriesLeft.push(...new Array(4).fill(ContainerColor.Black));
    factoriesLeft.push(...new Array(4).fill(ContainerColor.Orange));
    factoriesLeft.push(...new Array(4).fill(ContainerColor.Tan));

    factories.forEach(f => {
        containersLeft.push(f);
        factoriesLeft.push(f);
    });

    const warehousesLeft = players.length * 4;

    const G: GameState = {
        players,
        currentPlayer: Math.abs(rng.int32()) % players.length,
        containersLeft,
        factoriesLeft,
        warehousesLeft,
        auctioningPlayer: -1,
        highestBidders: [],
        phase: Phase.Move,
        options: { beginner },
        log: [],
        seed,
        round: 1
    } as GameState;

    G.players[G.currentPlayer].actions = 2;
    G.players[G.currentPlayer].availableMoves = availableMoves(G, G.players[G.currentPlayer]);

    G.log.push({ type: "event", event: { name: GameEventName.GameStart } });

    addRoundStart(G);

    return G;
}

function addRoundStart(G: GameState) {
    G.log.push({
        type: "event",
        event: {
            name: GameEventName.RoundStart,
            round: G.round
        }
    });
}

export function stripSecret(G: GameState, player?: number): GameState {
    return {
        ...G,
        seed: "secret",
        players: G.players.map((pl, i) => {
            if (player === i) {
                return pl;
            } else {
                return {
                    ...pl,
                    pointCard: null,
                    availableMoves: pl.availableMoves ? {} : null
                };
            }
        }),
        log: G.log
    };
}

export function currentPlayers(G: GameState): number[] {
    switch (G.phase) {
        case Phase.Move:
        default: {
            return [G.currentPlayer];
        }
    }
}

export function move(G: GameState, move: Move, playerNumber: number): GameState {
    const player = G.players[playerNumber];
    const available = player.availableMoves?.[move.name];

    // eslint-disable-next-line no-useless-catch
    try {
        assert(G.currentPlayer === playerNumber, "It is not your turn!");
        assert(available, "You are not allowed to run the command " + move.name);
        assert(available.some(x => isEqual(x, move.data)), "Wrong argument for the command " + move.name);
    } catch (e) {
        throw e;
    }

    G.log.push({ type: "move", player: playerNumber, move });

    switch (move.name) {
        case MoveName.BuyFactory: {
            asserts<Moves.MoveBuyFactory>(move);
            remove(G.factoriesLeft, move.data);
            player.factories.push(move.data);
            player.money -= player.factories.length * 3;

            player.lastMove = move;
            player.actions--;

            break;
        }

        case MoveName.BuyWarehouse: {
            asserts<Moves.MoveBuyWarehouse>(move);
            G.warehousesLeft -= 1;
            player.warehouses += 1;
            player.money -= player.warehouses + 2;
            break;
        }

        case MoveName.BuyFromFactory: {
            asserts<Moves.MoveBuyFromFactory>(move);
            const otherPlayer = G.players[move.data.player];
            remove(otherPlayer.containersOnFactoryStore, move.data.container);
            player.containersOnWarehouseStore.push({ containerColor: move.data.container.containerColor, price: move.extraData.price });
            player.money -= move.data.container.price;
            otherPlayer.money += move.data.container.price;
            break;
        }

        case MoveName.BuyFromWarehouse: {
            asserts<Moves.MoveBuyFromWarehouse>(move);
            const otherPlayer = G.players[move.data.player];
            remove(otherPlayer.containersOnWarehouseStore, move.data.container);
            player.ship.containers.push(move.data.container.containerColor);
            player.money -= move.data.container.price;
            otherPlayer.money += move.data.container.price;
            break;
        }

        case MoveName.GetLoan: {
            asserts<Moves.MoveGetLoan>(move);
            player.loans += 1;
            player.money += 10;
            break;
        }

        case MoveName.PayLoan: {
            asserts<Moves.MovePayLoan>(move);
            player.loans -= 1;
            player.money -= 10;
            break;
        }

        case MoveName.Produce: {
            asserts<Moves.MoveProduce>(move);
            remove(G.containersLeft, move.data);
            player.containersOnFactoryStore.push({ containerColor: move.data, price: move.extraData.price });
            if (player.lastMove?.name !== MoveName.Produce) {
                player.money -= 1;
                playerBefore(player, G).money += 1;
            }

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
            }

            break;
        }

        case MoveName.ArrangeFactory: {
            asserts<Moves.MoveArrangeFactory>(move);
            remove(player.containersOnFactoryStore, move.data);
            player.containersOnFactoryStore.push({ containerColor: move.data.containerColor, price: move.extraData.price });
            break;
        }

        case MoveName.ArrangeWarehouse: {
            asserts<Moves.MoveArrangeWarehouse>(move);
            remove(player.containersOnWarehouseStore, move.data);
            player.containersOnWarehouseStore.push({ containerColor: move.data.containerColor, price: move.extraData.price });
            break;
        }

        case MoveName.Bid: {
            asserts<Moves.MoveBid>(move);

            if (G.highestBidders.length === 0) {
                player.bid = move.extraData.price;
                nextPlayer(G);
            } else {
                player.additionalBid = move.extraData.price;
                while (G.highestBidders.indexOf(G.currentPlayer) === -1 && G.auctioningPlayer === G.currentPlayer) { nextPlayer(G); }
            }

            if (G.auctioningPlayer === G.currentPlayer) {
                if (G.highestBidders.length === 0) {
                    const highestBid = Math.max(...G.players.map(p => p.bid));
                    const highestBidders = G.players.filter(p => p.bid === highestBid).map(p => p.id);
                    G.highestBidders = highestBidders;
                    if (highestBidders.length > 1) {
                        while (highestBidders.indexOf(G.currentPlayer) === -1) { nextPlayer(G); }
                    } else {
                        G.phase = Phase.AcceptDecline;
                    }
                } else {
                    const highestBid = Math.max(...G.players.map(p => p.bid + p.additionalBid));
                    const highestBidders = G.players.filter(p => p.bid + p.additionalBid === highestBid).map(p => p.id);
                    G.highestBidders = highestBidders;
                    G.phase = Phase.AcceptDecline;
                }
            }

            break;
        }

        case MoveName.Accept: {
            const otherPlayer = G.players[move.data];
            otherPlayer.containersOnIsland.push(...player.ship.containers);
            player.ship.containers = [];
            otherPlayer.money -= otherPlayer.bid + otherPlayer.additionalBid;
            player.money += (otherPlayer.bid + otherPlayer.additionalBid) * 2;
            G.players.forEach(p => { p.bid = p.additionalBid = 0; });
            G.auctioningPlayer = -1;
            G.highestBidders = [];
            G.phase = Phase.Move;

            if (!ended(G)) {
                nextPlayer(G);
                G.players[G.currentPlayer].money -= G.players[G.currentPlayer].loans;
                G.players[G.currentPlayer].actions = 2;
            } else {
                G.currentPlayer = -1;
                // TODO: calculate scores
            }

            break;
        }

        case MoveName.Decline: {
            player.containersOnIsland.push(...player.ship.containers);
            player.ship.containers = [];
            const bid = G.players[G.highestBidders[0]].bid + G.players[G.highestBidders[0]].additionalBid;
            player.money -= bid;
            G.players.forEach(p => { p.bid = p.additionalBid = 0; });
            G.auctioningPlayer = -1;
            G.highestBidders = [];
            G.phase = Phase.Move;

            if (!ended(G)) {
                nextPlayer(G);
                G.players[G.currentPlayer].money -= G.players[G.currentPlayer].loans;
                G.players[G.currentPlayer].actions = 2;
            } else {
                G.currentPlayer = -1;
                // TODO: calculate scores
            }

            break;
        }

        case MoveName.Pass: {
            asserts<Moves.MovePass>(move);
            if (!ended(G)) {
                nextPlayer(G);
                G.players[G.currentPlayer].money -= G.players[G.currentPlayer].loans;
                G.players[G.currentPlayer].actions = 2;
            } else {
                G.currentPlayer = -1;
                // TODO: calculate scores
            }

            break;
        }

        // case MoveName.ChooseCard: {
        //     // Should not be needed, typescript should make the distinction itself
        //     asserts<Moves.MoveChooseCard>(move);
        //     player.faceDownCard = move.data;
        //     player.hand.splice(player.hand.findIndex(c => isEqual(c, move.data)), 1);
        //     delete player.availableMoves;

        //     if (G.players.every(pl => pl.faceDownCard)) {
        //         G.phase = Phase.PlaceCard;

        //         G.log.push({ type: "event", event: { name: GameEventName.RevealCards, cards: G.players.map(pl => pl.faceDownCard!) } });

        //         G = switchToNextPlayer(G);
        //     }

        //     return G;
        // }

        // case MoveName.PlaceCard: {
        //     delete player.availableMoves;

        //     if (move.data.replace) {
        //         player.discard.push(...G.rows[move.data.row]);
        //         player.points = sumBy(player.discard, "points");
        //         G.rows[move.data.row] = [player.faceDownCard!];
        //     } else {
        //         G.rows[move.data.row].push(player.faceDownCard!);
        //     }

        //     delete player.faceDownCard;

        //     return switchToNextPlayer(G);
        // }
    }

    player.lastMove = move;

    G.players[G.currentPlayer].availableMoves = availableMoves(G, G.players[G.currentPlayer]);

    return G;
}

export function ended(G: GameState): boolean {
    return G.containersLeft.filter((c, i) => G.containersLeft.indexOf(c) !== i).length <= 3;
}

export function scores(G: GameState): number[] {
    return G.players.map(pl => pl.money);
}

export function reconstructState(initialState: GameState, log: LogItem[]): GameState {
    const G = cloneDeep(initialState);

    for (const item of log) {
        G.log.push(item);

        switch (item.type) {
            case "event": {
                // switch (item.event.name) {
                //     case GameEventName.GameStart: {
                //         break;
                //     }

                //     case GameEventName.GameEnd: {
                //         break;
                //     }

                //     case GameEventName.RevealCards: {
                //         let i = 0;
                //         for (const pl of G.players) {
                //             pl.faceDownCard = item.event.cards[i];
                //             i++;
                //         }

                //         break;
                //     }

                //     case GameEventName.RoundStart: {
                //         G.round = item.event.round;

                //         G.rows = item.event.cards.board.map(card => [card]) as [Card[], Card[], Card[], Card[]];

                //         for (let i = 0; i < item.event.cards.players.length; i++) {
                //             G.players[i].hand = item.event.cards.players[i];
                //         }

                //         break;
                //     }
                // }

                break;
            }

            case "phase": {
                G.phase = item.phase;
                break;
            }

            case "move": {
                // switch (item.move.name) {
                //     case MoveName.ChooseCard: {
                //         G.players[item.player].faceDownCard = item.move.data;
                //         break;
                //     }

                //     case MoveName.PlaceCard: {
                //         if (item.move.data.replace) {
                //             G.players[item.player].points += sumBy(G.rows[item.move.data.row], "points");
                //             G.players[item.player].discard.push(...(G.rows[item.move.data.row]));
                //             G.rows[item.move.data.row] = [];
                //         }

                //         G.rows[item.move.data.row].push(G.players[item.player].faceDownCard!);
                //         G.players[item.player].faceDownCard = null;
                //         break;
                //     }
                // }
            }
        }
    }

    return G;
}

function playerBefore(player: Player, G: GameState) {
    if (player.id === 0) {
        return G.players[G.players.length - 1];
    } else {
        return G.players[player.id - 1];
    }
}

function nextPlayer(G: GameState) {
    G.currentPlayer = (G.currentPlayer + 1) % G.players.length;
}

function remove(array, value) {
    const aux = array.find(x => isEqual(x, value));
    array.splice(array.indexOf(aux), 1);
}