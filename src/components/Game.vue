<template>
    <div class="game">
        <div class="statusBar">
            {{ getStatusMessage() }}
        </div>
        <svg id="scene" viewBox="0 0 1250 650" height="650">
            <rect width="100%" height="100%" x="0" y="0" fill="lightblue" />
            <rect width="100%" height="100" x="0" y="0" fill="gray" />
            <rect width="390" height="220" x="860" y="430" fill="gray" />

            <template v-if="isCurrentPlayer(player)">
                <PassButton transform="translate(1130, 15)" @click="pass()" />
                <UndoButton transform="translate(1130, 55)" @click="undo()" />
            </template>

            <DropZone transform="translate(5, 5)" :width="600" :height="90" :enabled="true" :accepts="'container'" :data="{ type: 'supply' }" />

            <template v-if="G">
                <template v-for="(p, i) in G.players">
                    <PlayerBoard :key="'B' + i"
                        :player="p"
                        :color="playerColors[i]"
                        :transform="`translate(${250 * i}, 100)`"
                        :owner="i"
                        :currentPlayer="isCurrentPlayer(i)"
                        :ended="gameEnded(G)"
                        @pieceDrop="onPieceDrop" />
                    <rect :key="'I' + i" width="390" height="41" x="860" :y="430 + i * 44" fill="none" stroke-width="3" :stroke="playerColors[i]" />
                </template>
            </template>

            <template v-for="ship in ships">
                <Ship :key="ship.id"
                    :pieceId="ship.id"
                    :targetState="{ x: ship.x, y: ship.y, rotate: ship.rotate }"
                    :canDrag="canDragShip(ship)"
                    :containers="ship.containers"
                    :color="ship.color" />
            </template>

            <template v-for="container in containers">
                <Container :key="container.id"
                    :pieceId="container.id"
                    :targetState="{ x: container.x, y: container.y, rotate: container.rotate }"
                    :canDrag="canDragContainer(container)"
                    :color="container.color"
                    :owner="container.owner"
                    :state="container.state" />
            </template>

            <template v-for="factory in factories">
                <Factory :key="factory.id"
                    :pieceId="factory.id"
                    :targetState="{ x: factory.x, y: factory.y}"
                    :color="factory.color"
                    :canDrag="canDragFactory(factory)" />
            </template>

            <template v-for="warehouse in warehouses">
                <Warehouse :key="warehouse.id"
                    :pieceId="warehouse.id"
                    :targetState="{ x: warehouse.x, y: warehouse.y}"
                    :canDrag="canDragWarehouse(warehouse)" />
            </template>

            <template v-for="loanCard in loanCards">
                <LoanCard :key="loanCard.id"
                    :targetState="{ x: loanCard.x, y: loanCard.y }"
                    :owner="loanCard.owner"
                    :player="player"
                    :canDrag="canDragLoan(loanCard)"
                    @fastClick="loan($event)" />
            </template>

            <template v-if="G">
                <PointCard :pointCard="G.players[player].pointCard" transform="translate(20, 440)" />
                <text x="20" y="620">Money: ${{ G.players[player].money }}</text>
            </template>

            <DropZone :transform="`translate(280, 425)`" :width="400" :height="225" :enabled="true" :accepts="'ship'" :data="{ type: 'openSea' }" />
            <DropZone :transform="`translate(770, 425)`" :width="480" :height="225" :enabled="true" :accepts="'ship'" :data="{ type: 'islandHarbor' }" />

            <DropZone :transform="`translate(1045, 10)`" :width="40" :height="70" :enabled="true" :accepts="'loan'" :data="{ type: 'payLoan' }" />

            <template v-if="isCurrentPlayer(player)">
                <Calculator v-if="G.phase == 'bid'" transform="translate(140, 430)" @bid="bid($event)" />
                <template v-if="player == G.auctioningPlayer">
                    <template v-for="(bidder, i) in G.highestBidders">
                        <Button :key="bidder" :transform="`translate(140, ${450 + 40 * i})`" :width="130" :text="'Accept ' + getName(bidder)" @click="accept(bidder)" />
                    </template>
                    <Button :transform="`translate(140, ${450 + 40 * G.highestBidders.length})`" :width="130" :text="'Decline'" @click="decline()" />
                </template>
            </template>

            <use xlink:href="#moving" />
            <use xlink:href="#dragged" />
        </svg>
    </div>
</template>
<script lang="ts">
import { Vue, Component, Prop, Watch, Provide, ProvideReactive, } from 'vue-property-decorator';
import { MoveName, ended, move as engineMove } from 'container-engine';
import type { GameState } from 'container-engine';
import { EventEmitter } from 'events';
import { groupBy } from 'lodash';
import { ContainerState, DropZoneType, Piece, PieceType, ShipType, UIData } from '../types/ui-data';
import { ContainerColor, ShipPosition } from 'container-engine/src/gamestate';
import PlayerBoard from './PlayerBoard.vue';
import Container from './pieces/Container.vue';
import Factory from './pieces/Factory.vue';
import Warehouse from './pieces/Warehouse.vue';
import LoanCard from './pieces/LoanCard.vue';
import PointCard from './PointCard.vue';
import Ship from './pieces/Ship.vue';
import Button from './buttons/Button.vue';
import PassButton from './buttons/PassButton.vue';
import UndoButton from './buttons/UndoButton.vue';
import PieceComponent from './pieces/Piece.vue';
import DropZone from './DropZone.vue';
import Calculator from './Calculator.vue';

@Component({
    created(this: Game) {
        this.communicator.on('pieceDrop', this.onPieceDrop);
        this.$on('hook:beforeDestroy', () => this.communicator.off('pieceDrop', this.onPieceDrop));
    },
    components: {
        PlayerBoard,
        Container,
        Factory,
        Warehouse,
        LoanCard,
        PointCard,
        Ship,
        PassButton,
        UndoButton,
        DropZone,
        Calculator,
        Button
    },
})
export default class Game extends Vue {
    @Prop()
    private state?: GameState;

    @Prop()
    @ProvideReactive()
    player?: number;

    @Prop()
    emitter!: EventEmitter;

    paused = false;

    @Provide()
    ui: UIData = {
        waitingAnimations: 0
    };

    @Provide()
    communicator: EventEmitter = new EventEmitter();

    @ProvideReactive()
    G?: GameState | null = null;

    // Pieces
    containers: Piece[] = [];
    factories: Piece[] = [];
    warehouses: Piece[] = [];
    warehousesBuilt: Piece[] = [];
    loanCards: Piece[] = [];
    ships: ShipType[] = [];

    playerColors = ['dodgerblue', 'red', 'yellow', 'limegreen', 'mediumorchid'];

    animationQueue: Array<Function> = [];

    @Watch('state', { immediate: true })
    onStateChanged(state: GameState) {
        this.replaceState(state);
    }

    replaceState(state: GameState) {
        this.G = JSON.parse(JSON.stringify(state));

        this.createPieces();
    }

    createPieces() {
        // Containers
        this.containers = [];
        this.G?.players.forEach((player, pi) => {
            let grouped = groupBy(player.containersOnFactoryStore, c => c.price);
            Object.keys(grouped).forEach(price => {
                grouped[price].forEach((container, ci) => {
                    this.containers.push({
                        id: container.piece.id,
                        x: 8 + pi * 250 + (container.price - 1) * 48 + (ci % 2) * 20,
                        y: 160 + Math.floor(ci / 2) * 10,
                        rotate: 0,
                        color: container.piece.color.toString(),
                        owner: pi,
                        state: ContainerState.OnFactoryStore
                    });
                });
            });

            grouped = groupBy(player.containersOnWarehouseStore, c => c.price);
            Object.keys(grouped).forEach(price => {
                grouped[price].forEach((container, ci) => {
                    this.containers.push({
                        id: container.piece.id,
                        x: 8 + pi * 250 + (container.price - 2) * 48 + (ci % 2) * 20,
                        y: 250 + Math.floor(ci / 2) * 10,
                        rotate: 0,
                        color: container.piece.color.toString(),
                        owner: pi,
                        state: ContainerState.OnWarehouseStore
                    });
                });
            });

            let lastColor;
            let offset = 0;
            player.containersOnIsland.sort((a, b) => a.color.localeCompare(b.color)).forEach((container, ci) => {
                if (container.color !== lastColor)
                    offset += 10;

                this.containers.push({
                    id: container.id,
                    x: 860 + offset + 12 * ci,
                    y: 445 + 44 * pi,
                    rotate: 90,
                    color: container.color.toString(),
                    owner: pi,
                    state: ContainerState.OnIsland
                });

                lastColor = container.color;
            });
        });

        if (this.G?.containersLeft) {
            let c = {};
            this.G?.containersLeft.sort().forEach(container => {
                if (!c[container.color]) {
                    c[container.color] = 0;
                }

                const offset = 120 * Object.values(ContainerColor).indexOf(container.color);
                this.containers.push({
                    id: container.id,
                    x: 10 + offset + 22 * (c[container.color] % 5),
                    y: 40 + Math.floor(c[container.color] / 5) * 12,
                    rotate: 0,
                    color: container.color.toString(),
                    owner: -1,
                    state: ContainerState.OnBoard
                });

                c[container.color]++
            });
        }

        // Factories
        this.factories = [];
        this.G?.players.forEach((player, pi) => {
            player.factories.forEach((factory, i) => {
                this.factories.push({ id: factory.id, x: 28 + pi * 250 + i * 48, y: 140, owner: player.id, color: factory.color.toString() });
            });
        });

        if (this.G?.factoriesLeft) {
            let c = 0;
            let lastColor;
            this.G?.factoriesLeft.sort().forEach(factory => {
                if (lastColor !== factory.color) {
                    c = 0;
                }

                const offset = 120 * Object.values(ContainerColor).indexOf(factory.color);
                this.factories.push({ id: factory.id, x: 20 + offset + 22 * (c % 5), y: 20 + Math.floor(c / 5) * 12, owner: -1, color: factory.color.toString() });
                lastColor = factory.color;
                c++
            });
        }

        // Warehouses
        this.warehouses = [];
        this.G?.players.forEach((player, pi) => {
            for (let c = 0; c < player.warehouses.length; c++) {
                this.warehouses.push({ id: player.warehouses[c].id, x: 13 + pi * 250 + c * 48, y: 210, owner: player.id });
            }
        });

        if (this.G?.warehousesLeft) {
            for (let c = 0; c < this.G.warehousesLeft.length; c++) {
                this.warehouses.push({ id: this.G.warehousesLeft[c].id, x: 620 + 32 * (c % 13), y: 15 + Math.floor(c / 13) * 32, owner: -1 });
            }
        }

        // Loan Cards
        this.loanCards = [];
        this.G?.loansLeft.forEach(loan => {
            this.loanCards.push({ id: loan.id, x: 1050, y: 15, owner: -1 });
        });

        this.G?.players.forEach((player, pi) => {
            player.loans.forEach((loan, c) => {
                this.loanCards.push({ id: loan.id, x: 205 + pi * 250 + c * 7, y: 135 - c * 7, owner: player.id });
            });
        });

        // Ships
        this.ships = [];
        this.G?.players.forEach((player, pi) => {
            const color = ['dodgerblue', 'red', 'yellow', 'limegreen', 'mediumorchid'][pi];
            switch (player.ship.shipPosition) {
                case ShipPosition.OpenSea:
                    this.ships.push({ id: player.ship.piece.id, x: 380 + pi * 44, y: 480, rotate: 0, color, containers: player.ship.containers, owner: pi });
                    break;

                case ShipPosition.Island:
                    this.ships.push({ id: player.ship.piece.id, x: 800, y: 410 + pi * 44, rotate: 90, color, containers: player.ship.containers, owner: pi });
                    break;

                case ShipPosition.Player0:
                    this.ships.push({ id: player.ship.piece.id, x: 26 + 62 * (pi - 1), y: 305, rotate: 0, color, containers: player.ship.containers, owner: pi });
                    break;

                case ShipPosition.Player1:
                    this.ships.push({ id: player.ship.piece.id, x: 276 + 62 * (pi > 1 ? pi - 1 : pi), y: 305, rotate: 0, color, containers: player.ship.containers, owner: pi });
                    break;

                case ShipPosition.Player2:
                    this.ships.push({ id: player.ship.piece.id, x: 526 + 62 * (pi > 2 ? pi - 1 : pi), y: 305, rotate: 0, color, containers: player.ship.containers, owner: pi });
                    break;

                case ShipPosition.Player3:
                    this.ships.push({ id: player.ship.piece.id, x: 776 + 62 * (pi > 3 ? pi - 1 : pi), y: 305, rotate: 0, color, containers: player.ship.containers, owner: pi });
                    break;

                case ShipPosition.Player4:
                    this.ships.push({ id: player.ship.piece.id, x: 1026 + 62 * (pi > 4 ? pi - 1 : pi), y: 305, rotate: 0, color, containers: player.ship.containers, owner: pi });
                    break;
            }
        });
    }

    @Watch('ui.waitingAnimations')
    updateUI() {
        if (this.ui.waitingAnimations > 0) {
            return;
        }

        if (this.animationQueue.length > 0) {
            this.animationQueue.shift()!();
            setTimeout(() => this.updateUI());
            return;
        }
    }

    onPieceDrop(e: PieceComponent, d: any) {
        switch (e.pieceType) {
            case PieceType.Warehouse:
                this.sendMove({ name: MoveName.BuyWarehouse, data: true, extraData: { id: e.pieceId } });
                break;

            case PieceType.Factory:
                const factory = e as Factory;
                this.sendMove({ name: MoveName.BuyFactory, data: factory.color, extraData: { id: factory.pieceId, color: factory.color } });
                break;

            case PieceType.Container:
                const container = e as Container;
                if (container.state == ContainerState.OnBoard) {
                    if (d.type == DropZoneType.FactoryStore) {
                        this.sendMove({ name: MoveName.Produce, data: container.color, extraData: { piece: { id: container.pieceId, color: container.color }, price: d.price } });
                    }
                } else if (container.state == ContainerState.OnFactoryStore) {
                    if (d.type == DropZoneType.FactoryStore) {
                        const player = this.G!.players[this.G!.currentPlayer!];
                        if (player.containersOnFactoryStore.find(c => c.piece.id == e.pieceId)!.price !== d.price)
                            this.sendMove({ name: MoveName.ArrangeFactory, data: { id: container.pieceId, color: container.color }, extraData: { price: d.price } });
                    } else if (d.type == DropZoneType.WarehouseStore) {
                        this.sendMove({ name: MoveName.BuyFromFactory, data: { player: container.owner, piece: { id: container.pieceId, color: container.color } }, extraData: { price: d.price } });
                    } else if (d.type == DropZoneType.Supply) {
                        this.sendMove({ name: MoveName.DomesticSale, data: { id: container.pieceId, color: container.color } });
                    }
                } else if (container.state == ContainerState.OnWarehouseStore) {
                    if (d.type == DropZoneType.WarehouseStore) {
                        this.sendMove({ name: MoveName.ArrangeWarehouse, data: { id: container.pieceId, color: container.color }, extraData: { price: d.price } });
                    } else if (d.type == DropZoneType.Ship) {
                        this.sendMove({ name: MoveName.BuyFromWarehouse, data: { player: container.owner, piece: { id: container.pieceId, color: container.color } } });
                    } else if (d.type == DropZoneType.Supply) {
                        this.sendMove({ name: MoveName.DomesticSale, data: { id: container.pieceId, color: container.color } });
                    }
                }

                break;

            case PieceType.Ship:
                const player = this.G!.players[this.G!.currentPlayer!];
                if (d.type === DropZoneType.PlayerHarbour) {
                    if (player.ship.shipPosition !== 'player' + d.owner)
                        this.sendMove({ name: MoveName.Sail, data: 'player' + d.owner });
                } else if (d.type === DropZoneType.OpenSea) {
                    if (player.ship.shipPosition !== ShipPosition.OpenSea)
                        this.sendMove({ name: MoveName.Sail, data: ShipPosition.OpenSea });
                } else if (d.type === DropZoneType.IslandHarbor) {
                    if (player.ship.shipPosition !== ShipPosition.Island)
                        this.sendMove({ name: MoveName.Sail, data: ShipPosition.Island });
                }

                break;

            case PieceType.Loan:
                const loan = e as LoanCard;
                if (loan.owner == -1 && d.type == DropZoneType.GetLoan) {
                    this.sendMove({ name: MoveName.GetLoan, data: true });
                } else if (loan.owner !== -1 && d.type == DropZoneType.PayLoan) {
                    this.sendMove({ name: MoveName.PayLoan, data: true });
                }

                break;
        }

        this.updateUI();
    }

    getName(bidder) {
        return this.G!.players[bidder].name!.length > 8 ? this.G!.players[bidder].name?.substring(0, 5).concat('...') : this.G!.players[bidder].name;
    }

    pass() {
        this.sendMove({ name: MoveName.Pass, data: true });
    }

    undo() {
        this.sendMove({ name: MoveName.Undo, data: true });
    }

    loan(event) {
        const loan = event as LoanCard;
        if (loan.owner == -1) {
            this.sendMove({ name: MoveName.GetLoan, data: true });
        } else if (loan.owner == this.G?.currentPlayer) {
            this.sendMove({ name: MoveName.PayLoan, data: true });
        }
    }

    bid(event) {
        this.sendMove({ name: MoveName.Bid, data: true, extraData: { price: event } });
    }

    accept(bidder) {
        this.sendMove({ name: MoveName.Accept, data: bidder });
    }

    decline() {
        this.sendMove({ name: MoveName.Decline, data: true });
    }

    sendMove(move) {
        this.emitter.emit('move', move);

        this.replaceState(engineMove(this.G!, move, this.player!, true));
    }

    gameEnded(G: GameState) {
        return ended(G);
    }

    canDrag() {
        return this.G?.currentPlayer == this.player! && this.G.players[this.player!] && this.G.players[this.player!].availableMoves;
    }

    canDragContainer(container: Piece) {
        if (!this.canDrag())
            return false;

        const currentPlayer = this.G!.players[this.G!.currentPlayer!];
        const availableMoves = currentPlayer.availableMoves!;

        switch (container.state) {
            case ContainerState.OnBoard: {
                const available = availableMoves[MoveName.Produce];
                return available && available.indexOf(container.color as ContainerColor) != -1 && currentPlayer.produced.indexOf(container.color as ContainerColor) == -1;
            }

            case ContainerState.OnFactoryStore: {
                if (container.owner == currentPlayer.id) {
                    return availableMoves[MoveName.ArrangeFactory] != undefined || availableMoves[MoveName.DomesticSale] != undefined;
                } else {
                    const available = availableMoves[MoveName.BuyFromFactory];
                    return available && available.find(a => a.piece.id == container.id);
                }
            }

            case ContainerState.OnWarehouseStore: {
                if (container.owner == currentPlayer.id) {
                    return availableMoves[MoveName.ArrangeWarehouse] != undefined || availableMoves[MoveName.DomesticSale] != undefined;
                } else {
                    const available = availableMoves[MoveName.BuyFromWarehouse];
                    return available && available.find(a => a.piece.id == container.id);
                }
            }

            case ContainerState.OnShip:
            case ContainerState.OnIsland:
            default:
                return false;
        }
    }

    canDragFactory(factory: Piece) {
        if (!this.canDrag())
            return false;

        const currentPlayer = this.G!.players[this.G!.currentPlayer!];
        const availableMoves = currentPlayer.availableMoves!;

        if (factory.owner !== -1)
            return false;

        const available = availableMoves[MoveName.BuyFactory];
        return available && available.find(a => a == factory.color);
    }

    canDragWarehouse(warehouse: Piece) {
        if (!this.canDrag())
            return false;

        const currentPlayer = this.G!.players[this.G!.currentPlayer!];
        const availableMoves = currentPlayer.availableMoves!;

        if (warehouse.owner !== -1)
            return false;

        return availableMoves[MoveName.BuyWarehouse] != undefined;
    }

    canDragLoan(loanCard: Piece) {
        if (!this.canDrag())
            return false;

        const currentPlayer = this.G!.players[this.G!.currentPlayer!];
        const availableMoves = currentPlayer.availableMoves!;

        if (loanCard.owner == -1) {
            return availableMoves[MoveName.GetLoan] != undefined;
        } else if (loanCard.owner == currentPlayer.id) {
            return availableMoves[MoveName.PayLoan] != undefined;
        }

        return false;
    }

    canDragShip(ship: Piece) {
        if (!this.canDrag())
            return false;

        const currentPlayer = this.G!.players[this.G!.currentPlayer!];
        const availableMoves = currentPlayer.availableMoves!;

        return availableMoves[MoveName.Sail] && this.isCurrentPlayer(ship.owner);
    }

    getStatusMessage() {
        if (this.G?.currentPlayer == undefined) {
            return 'Game ended!';
        } else if (this.G?.currentPlayer == this.player) {
            return 'It\'s your turn!';
        } else {
            return `Waiting for ${this.G?.players[this.G!.currentPlayer].name} to play...`;
        }
    }

    isCurrentPlayer(player) {
        return this.G && this.G.currentPlayer === player;
    }
}

</script>
<style lang="scss">
.game {
    height: 100%;
    background-color: lightblue;
    display: flex;
    align-items: center;
    flex-direction: column;
}

.statusBar {
    height: 40px;
    width: 100%;
    background-color: black;
    color: #fff;
    text-align: center;
    line-height: 40px;
    font-size: 20px;
}

#scene {
    max-height: 100%;
    flex-grow: 1;
}

body,
html {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
}

text {
    font-family: "Arial";
    pointer-events: none;
    dominant-baseline: central;

    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
}

.piece {
    &:not(.dragging) {
        transition: transform 0.8s ease-in-out;
    }

    &.canDrag {
        cursor: pointer;

        & > circle,
        & > rect,
        & > path {
            &:hover {
                stroke: white;
            }
        }
    }
}
</style>
