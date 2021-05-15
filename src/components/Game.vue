<template>
    <div class="game">
        <svg viewBox="0 0 1250 650" height="700" id="scene">
            <defs>
                <filter id="shadow">
                    <feGaussianBlur stdDeviation="0.5 0.5" result="shadow" />
                    <feOffset dx="1" dy="1" />
                </filter>
            </defs>

            <rect width="100%" height="100%" x="0" y="0" fill="lightblue" stroke="#000077"></rect>
            <rect width="100%" height="100" x="0" y="0" fill="gray"></rect>
            <rect width="390" height="220" x="860" y="430" fill="gray"></rect>

            <template v-if="G">
                <template v-for="(player, i) in G.players">
                    <PlayerBoard :key="'B' + i" :name="player.name" :color="['dodgerblue', 'red', 'yellow', 'limegreen', 'mediumorchid'][i]" :transform="`translate(${250 * i}, 100)`" />
                    <rect :key="'I' + i" width="390" height="41" x="860" :y="430 + i * 44" fill="none" stroke-width="3" :stroke="['dodgerblue', 'red', 'yellow', 'limegreen', 'mediumorchid'][i]"></rect>
                </template>
            </template>

            <template v-for="ship in ships">
                <Ship :key="'S' + ship.id" :rotate="ship.rotate" :color="ship.color" :transform="`translate(${ship.x}, ${ship.y})`" />
            </template>

            <template v-for="container in containers">
                <Container :key="'C' + container.id" :rotate="container.rotate" :transform="`translate(${container.x}, ${container.y})`" :color="container.color" />
            </template>

            <template v-for="factory in factories">
                <Factory :key="'F' + factory.id" :transform="`translate(${factory.x}, ${factory.y})`" :color="factory.color" />
            </template>

            <template v-for="warehouse in warehouses">
                <Warehouse :key="'W' + warehouse.id" :transform="`translate(${warehouse.x}, ${warehouse.y})`" />
            </template>

            <template v-for="loanCard in loanCards">
                <LoanCard :key="'L' + loanCard.id" :transform="`translate(${loanCard.x}, ${loanCard.y})`" />
            </template>

            <template v-if="G">
                <PointCard :pointCard="G.players[player].pointCard" transform="translate(20, 440)" />
                <text x="20" y="620">Money: ${{ G.players[player].money }}</text>
            </template>

            <!-- Game Info
            <GameInfo :round="round" transform="translate(-190, -240)" />
            Players
            <PlayerLabel :player="G.players[player || 0]" :playerIndex=player :main=true :points=G.players[player||0].points transform="translate(-150, 120)" v-if="G" />
            <PlaceHolder :player="player || 0" transform="translate(-220, 170)" :playerTurn="canPlayerMove(player||0)" :enabled="canPlayerMove(player||0) && !G.players[player||0].faceDownCard" v-if="G" @cardDrop="onCardDrop" />

            <template v-for="(player, i) in otherPlayers">
                <PlayerLabel :player="G.players[player]" :playerIndex=player :points=G.players[player].points :transform="`translate(${i <= 5 ? 173 + 115 * (i % 2) : -300}, ${i <= 5 ? -218 + 110 * Math.floor(i /2) : -218 + 110 * (i - 6)})`" :key="'label-'+player" />
                <PlaceHolder :player="player" :playerTurn="canPlayerMove(player)" :key="'placehold-player-' + player" :transform="`translate(${i <= 5 ? 173 + 115 * (i % 2) : -300}, ${i <= 5 ? -163 + 110 * Math.floor(i /2) : -163 + 110 * (i - 6)})`" />
            </template>

            Board
            <template v-for="row in 4">
                <template v-for="rowPos in 6">
                <PlaceHolder
                    :key="`board-${row-1}-${rowPos-1}`"
                    :row=row-1
                    :rowPos=rowPos-1
                    :danger="rowPos===6"
                    :transform="`translate(${-203 + (rowPos-1) * 55}, ${((row - 1) - 1.5) * 80 - 75})`"
                    :enabled="isPlaceholderEnabled(row-1, rowPos-1)"
                    @cardDrop="onCardDrop"
                />
                </template>
            </template>

            All the cards
            <Card v-for="(card, i) in [...sortedHandCards].reverse()" :card="card" :key="card.number || `hand-${i}`" :targetState="handTargetState(handCards.length - 1 - i)" @fastClick="onCardDrop(card, {player})" />

            <template v-if="G">
                <template v-for="(player, i) in G.players">
                <Card v-if="player.faceDownCard" :card="player.faceDownCard" :key="player.faceDownCard.number || 'player-'+i" :targetState="facedownTargetState(i)" @fastClick="onCardDrop(player.faceDownCard, {player: i, autoChooseRow: true})" />
                </template>
            </template>

            <template v-for="row in 4">
                <template v-for="rowPos in 6">
                <Card v-if="G && G.rows[row-1][rowPos-1]" :card="G.rows[row-1][rowPos-1]" :key="G.rows[row-1][rowPos-1].number || 'board-card-'+row+'-'+rowPos" :targetState="boardTargetState(row-1, rowPos-1)" />
                </template>
            </template> -->

            <use xlink:href="#dragged" />
        </svg>
    </div>
</template>
<script lang="ts">
import { Vue, Component, Prop, Watch, Provide, ProvideReactive, } from "vue-property-decorator";
import { LogItem, AvailableMoves, Phase, reconstructState, } from "container-engine";
import type { GameState } from "container-engine";
import { EventEmitter } from "events";
import { range, isEqual, groupBy } from "lodash";
import { Piece, UIData } from "../types/ui-data";
import { logToText } from "../utils/log-to-text";
import { ContainerColor, ShipPosition } from "container-engine/src/gamestate";
import PlayerBoard from "./PlayerBoard.vue";
import Container from "./Container.vue";
import Factory from "./Factory.vue";
import Warehouse from "./Warehouse.vue";
import LoanCard from "./LoanCard.vue";
import PointCard from "./PointCard.vue";
import Ship from "./Ship.vue";

@Component({
    created(this: Game) {
        this.emitter.on("addLog", this.addLog.bind(this));

        this.emitter.on("replayStart", () => {
            this.emitter.emit("replay:info", {
                start: 1,
                current: this.G!.log.length,
                end: this._futureState!.log.length,
            });
            this.paused = true;
        });

        this.emitter.on("replayTo", (to: number) => {
            if (to < this.G!.log.length) {
                const baseState = {
                    players: this.G!.players.map((player, i) => ({
                        id: i,
                        pointCard: player.pointCard,
                        factories: player.factories,
                        warehouses: player.warehouses,
                        ship: { containers: [], shipPosition: ShipPosition.OpenSea },
                        containersOnFactoryStore: player.containersOnFactoryStore,
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
                    })),
                    currentPlayer: this.G!.currentPlayer,
                    containersLeft: this.G!.containersLeft,
                    factoriesLeft: this.G!.factoriesLeft,
                    warehousesLeft: this.G!.warehousesLeft,
                    auctioningPlayer: -1,
                    highestBidders: [],
                    phase: Phase.Move,
                    options: this.G!.options,
                    log: [],
                    seed: "",
                    round: 1
                };

                this.replaceState(
                    reconstructState(
                        baseState,
                        this._futureState!.log.slice(0, to)
                    ),
                    false
                );
            }

            if (this.G!.log.length + 1 === to) {
                this.advanceLog();
            } else if (this.G!.log.length + 1 < to) {
                this.replaceState(
                    reconstructState(
                        this.G!,
                        this._futureState!.log.slice(this.G!.log.length, to)
                    ),
                    false
                );
            }

            this.emitter.emit("replay:info", {
                start: 1,
                current: this.G!.log.length,
                end: this._futureState!.log.length,
            });
        });

        this.emitter.on("replayEnd", () => {
            this.paused = false;
            this.emitter.emit("fetchState");
        });
    },
    components: {
        PlayerBoard,
        Container,
        Factory,
        Warehouse,
        LoanCard,
        PointCard,
        Ship
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
        cards: {},
        placeholders: { rows: [], players: [] },
        waitingAnimations: 0,
    };

    @Provide()
    communicator: EventEmitter = new EventEmitter();

    @ProvideReactive()
    G?: GameState | null = null;
    _futureState?: GameState;

    containers: Piece[] = [];
    factories: Piece[] = [];
    warehouses: Piece[] = [];
    loanCards: Piece[] = [];
    ships: Piece[] = [];

    addLog({ log, availableMoves, start }: { log: LogItem[]; start: number; availableMoves: AvailableMoves[] }) {
        console.log("adding log...");

        this._pendingAvailableMoves = null;
        if (start > this._futureState!.log.length) {
            this.emitter.emit("fetchState");
            return;
        }

        if (log.length === 0) {
            this.loadAvailableMoves(availableMoves);
            return;
        }

        // edge case when we do a move and another player just did a move
        if (
            start === this._futureState!.log.length &&
            start > 0 &&
            isEqual(log[0], this._futureState!.log.slice(-1)[0])
        ) {
            this.emitter.emit("fetchState");
            return;
        }

        this._futureState!.log = [
            ...this._futureState!.log.slice(0, start),
            ...log,
        ];
        this._pendingAvailableMoves = {
            index: start + log.length,
            availableMoves: availableMoves,
        };
        this.updateUI();
    }

    @Watch("state", { immediate: true })
    onStateChanged(state: GameState) {
        this.replaceState(state);
    }

    replaceState(state: GameState, replaceFuture = true) {
        console.log("replace state", state, replaceFuture);
        if (replaceFuture) {
            this._futureState = state;
        }

        this.G = JSON.parse(JSON.stringify(state));

        if (this.G) {
            this.emitter.emit(
                "uplink:replaceLog",
                [
                    ...this.G!.log.map((x: LogItem) => logToText(this.G!, x)),
                ].flat(1)
            );
        }

        this.createComponents();
    }

    createComponents() {
        let pieceId = 0;

        // if (this.G) {
        //     let player = this.G.players[0];
        //     player.ship.shipPosition = ShipPosition.Island;
        //     player.ship.containers = [ContainerColor.White, ContainerColor.Black, ContainerColor.Orange, ContainerColor.Tan, ContainerColor.Brown];
        //     player.containersOnIsland.push(ContainerColor.Tan);
        //     player.containersOnFactoryStore.push({ containerColor: ContainerColor.Black, price: 2 });
        //     player.containersOnFactoryStore.push({ containerColor: ContainerColor.Black, price: 2 });
        //     player.containersOnFactoryStore.push({ containerColor: ContainerColor.Black, price: 2 });
        //     player.containersOnFactoryStore.push({ containerColor: ContainerColor.Black, price: 2 });
        //     player.containersOnFactoryStore.push({ containerColor: ContainerColor.Tan, price: 2 });

        //     player = this.G.players[1];
        //     player.ship.shipPosition = ShipPosition.Island;
        //     player.ship.containers = [ContainerColor.White, ContainerColor.Black, ContainerColor.Orange, ContainerColor.Tan, ContainerColor.Brown];
        //     player.containersOnIsland.push(ContainerColor.Tan);
        //     player.containersOnIsland.push(ContainerColor.Orange);
        //     player.containersOnIsland.push(ContainerColor.Black);
        //     player.containersOnIsland.push(ContainerColor.White);
        //     player.containersOnIsland.push(ContainerColor.Brown);

        //     player = this.G.players[2];
        //     player.ship.shipPosition = ShipPosition.Island;
        //     player.ship.containers = [ContainerColor.White, ContainerColor.Black, ContainerColor.Orange, ContainerColor.Tan, ContainerColor.Brown];
        //     player.containersOnIsland.push(ContainerColor.Orange);
        //     player.containersOnIsland.push(ContainerColor.Orange);
        //     player.containersOnIsland.push(ContainerColor.Orange);
        //     player.containersOnIsland.push(ContainerColor.White);
        //     player.containersOnIsland.push(ContainerColor.Brown);

        //     player = this.G.players[3];
        //     player.ship.shipPosition = ShipPosition.Island;
        //     player.ship.containers = [ContainerColor.White, ContainerColor.Black, ContainerColor.Orange, ContainerColor.Tan, ContainerColor.Brown];
        //     player.containersOnIsland.push(ContainerColor.Tan);
        //     player.containersOnIsland.push(ContainerColor.Tan);
        //     player.containersOnIsland.push(ContainerColor.Tan);
        //     player.containersOnIsland.push(ContainerColor.Tan);
        //     player.containersOnIsland.push(ContainerColor.Tan);
        //     player.containersOnIsland.push(ContainerColor.Tan);
        //     player.containersOnIsland.push(ContainerColor.Tan);

        //     player = this.G.players[4];
        //     player.ship.shipPosition = ShipPosition.Island;
        //     player.ship.containers = [ContainerColor.White, ContainerColor.Black, ContainerColor.Orange, ContainerColor.Tan, ContainerColor.Brown];
        //     player.containersOnWarehouseStore.push({ containerColor: ContainerColor.Brown, price: 4 });
        //     player.containersOnWarehouseStore.push({ containerColor: ContainerColor.Brown, price: 5 });
        //     player.containersOnIsland.push(ContainerColor.Tan);
        //     player.containersOnIsland.push(ContainerColor.Tan);
        //     player.containersOnIsland.push(ContainerColor.Tan);
        //     player.containersOnIsland.push(ContainerColor.Tan);
        //     player.containersOnIsland.push(ContainerColor.Black);
        //     player.containersOnIsland.push(ContainerColor.Black);
        //     player.containersOnIsland.push(ContainerColor.White);
        // }

        // Containers
        this.containers = [];
        this.G?.players.forEach((player, pi) => {
            let grouped = groupBy(player.containersOnFactoryStore, c => c.price);
            Object.keys(grouped).forEach(price => {
                grouped[price].forEach((container, ci) => {
                    this.containers.push({
                        id: pieceId++,
                        x: 8 + pi * 250 + (container.price - 1) * 48 + (ci % 2) * 20,
                        y: 160 + Math.floor(ci / 2) * 10,
                        rotate: 0,
                        color: container.containerColor.toString() });
                });
            });

            grouped = groupBy(player.containersOnWarehouseStore, c => c.price);
            Object.keys(grouped).forEach(price => {
                grouped[price].forEach((container, ci) => {
                    this.containers.push({
                        id: pieceId++,
                        x: 8 + pi * 250 + (container.price - 2) * 48 + (ci % 2) * 20,
                        y: 250 + Math.floor(ci / 2) * 10,
                        rotate: 0,
                        color: container.containerColor.toString() });
                });
            });

            let lastColor;
            let offset = 0;
            player.containersOnIsland.sort().forEach((containerColor, ci) => {
                if (containerColor !== lastColor)
                    offset += 10;

                this.containers.push({ id: pieceId++, x: 860 + offset + 12 * ci, y: 445 + 44 * pi, rotate: 90, color: containerColor.toString() });
                lastColor = containerColor;
            });

            player.ship.containers.forEach((containerColor, ci) => {
                switch (player.ship.shipPosition) {
                    case ShipPosition.OpenSea:
                        this.containers.push({ id: pieceId++, x: 525 - 12 * ci, y: 445 + pi * 44, rotate: 90, color: containerColor.toString() });
                        break;
                    case ShipPosition.Island:
                        this.containers.push({ id: pieceId++, x: 825 - 12 * ci, y: 445 + pi * 44, rotate: 90, color: containerColor.toString() });
                        break;
                    case ShipPosition.Player0:
                        this.containers.push({ id: pieceId++, x: 31 + 62 * (pi - 1), y: 320 + 12 * ci, rotate: 0, color: containerColor.toString() });
                        break;
                    case ShipPosition.Player1:
                        this.containers.push({ id: pieceId++, x: 281 + 62 * (pi > 1 ? pi - 1 : pi), y: 320 + 12 * ci, rotate: 0, color: containerColor.toString() });
                        break;
                    case ShipPosition.Player2:
                        this.containers.push({ id: pieceId++, x: 531 + 62 * (pi > 2 ? pi - 1 : pi), y: 320 + 12 * ci, rotate: 0, color: containerColor.toString() });
                        break;
                    case ShipPosition.Player3:
                        this.containers.push({ id: pieceId++, x: 781 + 62 * (pi > 3 ? pi - 1 : pi), y: 320 + 12 * ci, rotate: 0, color: containerColor.toString() });
                        break;
                    case ShipPosition.Player4:
                        this.containers.push({ id: pieceId++, x: 1031 + 62 * (pi > 4 ? pi - 1 : pi), y: 320 + 12 * ci, rotate: 0, color: containerColor.toString() });
                        break;
                }
            });
        });

        if (this.G?.containersLeft) {
            let c = 0;
            let lastColor;
            this.G?.containersLeft.sort().forEach(containerColor => {
                if (lastColor !== containerColor) {
                    c = 0;
                }

                const offset = 120 * Object.values(ContainerColor).indexOf(containerColor);
                this.containers.push({ id: pieceId++, x: 10 + offset + 22 * (c % 5), y: 40 + Math.floor(c / 5) * 12, rotate: 0, color: containerColor.toString() });
                lastColor = containerColor;
                c++
            });
        }

        // Factories
        this.factories = [];
        this.G?.players.forEach((player, pi) => {
            player.factories.forEach((factory, i) => {
                this.factories.push({ id: pieceId++, x: 28 + pi * 250 + i * 48, y: 140, color: factory.toString() });
            });
        });

        if (this.G?.factoriesLeft) {
            let c = 0;
            let lastColor;
            this.G?.factoriesLeft.sort().forEach(containerColor => {
                if (lastColor !== containerColor) {
                    c = 0;
                }

                const offset = 120 * Object.values(ContainerColor).indexOf(containerColor);
                this.factories.push({ id: pieceId++, x: 20 + offset + 22 * (c % 5), y: 20 + Math.floor(c / 5) * 12, color: containerColor.toString() });
                lastColor = containerColor;
                c++
            });
        }

        // Warehouses
        this.warehouses = [];
        this.G?.players.forEach((player, pi) => {
            for (let c = 0; c < player.warehouses; c++) {
                this.warehouses.push({ id: pieceId++, x: 13 + pi * 250 + c * 48, y: 210 });
            }
        });

        if (this.G?.warehousesLeft) {
            for (let c = 0; c < this.G.warehousesLeft; c++) {
                this.warehouses.push({ id: pieceId++, x: 620 + 32 * (c % 13), y: 15 + Math.floor(c / 13) * 32 });
            }
        }

        // Loan Cards
        this.loanCards = [];
        this.G?.players.forEach((player, pi) => {
            for (let c = 0; c < player.loans; c++) {
                this.loanCards.push({ id: pieceId++, x: 205 + pi * 250 + c * 5, y: 130 - c * 15 });
            }
        });

        this.loanCards.push({ id: pieceId++, x: 1050, y: 15 });

        // Ships
        this.ships = [];
        this.G?.players.forEach((player, pi) => {
            const color = ["dodgerblue", "red", "yellow", "limegreen", "mediumorchid"][pi];
            switch (player.ship.shipPosition) {
                case ShipPosition.OpenSea:
                    this.ships.push({ id: pieceId++, x: 500, y: 410 + pi * 44, rotate: 90, color });
                    break;

                case ShipPosition.Island:
                    this.ships.push({ id: pieceId++, x: 800, y: 410 + pi * 44, rotate: 90, color });
                    break;

                case ShipPosition.Player0:
                    this.ships.push({ id: pieceId++, x: 26 + 62 * (pi - 1), y: 305, rotate: 0, color });
                    break;

                case ShipPosition.Player1:
                    this.ships.push({ id: pieceId++, x: 276 + 62 * (pi > 1 ? pi - 1 : pi), y: 305, rotate: 0, color });
                    break;

                case ShipPosition.Player2:
                    this.ships.push({ id: pieceId++, x: 526 + 62 * (pi > 2 ? pi - 1 : pi), y: 305, rotate: 0, color });
                    break;

                case ShipPosition.Player3:
                    this.ships.push({ id: pieceId++, x: 776 + 62 * (pi > 3 ? pi - 1 : pi), y: 305, rotate: 0, color });
                    break;

                case ShipPosition.Player4:
                    this.ships.push({ id: pieceId++, x: 1026 + 62 * (pi > 4 ? pi - 1 : pi), y: 305, rotate: 0, color });
                    break;
            }
        });
    }

    get round() {
        return this.G?.round;
    }

    get otherPlayers() {
        if (!this.G) {
            return [];
        }
        return range(0, this.G.players.length).filter(pl => pl !== (this.player || 0));
    }

    canPlayerMove(player: number) {
        return !!this.G?.players[player]?.availableMoves;
    }

    onContainerDrop(container: ContainerColor, { player, row, rowPos, autoChooseRow }: { player?: number; row?: number; rowPos?: number; autoChooseRow?: boolean }) {
        console.log("card drop");
        if (this.player === undefined || (player !== undefined && player !== this.player)) {
            return;
        }

        const commands = this.G!.players[this.player].availableMoves!;

        if (!commands) {
            return;
        }

        if (this.G!.log.length !== this._futureState!.log.length) {
            return;
        }

        this.G!.players[this.player].availableMoves = null;

        console.log(player, row, rowPos, autoChooseRow);

        // if (player !== undefined && !autoChooseRow) {
        //     this._futureState!.log.push({
        //         player: this.player!,
        //         type: "move",
        //         move: { name: MoveName.ChooseCard, data: card },
        //     });
        //     this.emitter.emit("move", {
        //         name: MoveName.ChooseCard,
        //         data: card,
        //     });
        // } else {
        //     this._futureState!.log.push({
        //         player: this.player!,
        //         type: "move",
        //         move: {
        //             name: MoveName.PlaceCard,
        //             data: commands.placeCard!.find((item) => item.row === row)!,
        //         },
        //     });
        //     this.emitter.emit("move", {
        //         name: MoveName.PlaceCard,
        //         data: commands.placeCard!.find((item) => item.row === row),
        //     });
        // }

        this.updateUI();
    }

    loadAvailableMoves(availableMoves: AvailableMoves[]) {
        for (let i = 0; i < availableMoves.length; i++) {
            this.G!.players[i].availableMoves = availableMoves[i];
        }
        this._pendingAvailableMoves = null;
    }

    @Watch("ui.waitingAnimations")
    updateUI() {
        if (this.ui.waitingAnimations > 0) {
            return;
        }

        if (this.animationQueue.length > 0) {
            this.animationQueue.shift()!();
            setTimeout(() => this.updateUI());
            return;
        }

        if (this.paused) {
            return;
        }

        if (this.G!.log.length < this._futureState!.log.length) {
            this.advanceLog();
            setTimeout(() => this.updateUI());
            return;
        }

        if (this._pendingAvailableMoves && this._pendingAvailableMoves.index === this.G!.log.length) {
            console.log("loading available moves", JSON.stringify(this._pendingAvailableMoves));
            this.loadAvailableMoves(this._pendingAvailableMoves.availableMoves);
        }
    }

    advanceLog() {
        console.log("advancing log", this.G!.log.length, this._futureState!.log.length);
        const logItem = this._futureState!.log[this.G!.log.length];
        this.G!.log.push(logItem);
        this.emitter.emit("uplink:addLog", logToText(this.G!, logItem));

        this.delay(1);

        switch (logItem.type) {
            case "phase":
                return;
            case "move": {
                const { player, move } = logItem;

                switch (move.name) {
                    // case MoveName.ChooseCard: {
                    //     console.log("choosing card", player);
                    //     this.G!.players[player].faceDownCard = move.data;

                    //     this.delay(200);

                    //     if (player === (this.player || 0)) {
                    //         this.G!.players[this.player!].hand = this.handCards!.filter(card => card.number !== move.data.number);
                    //     } else {
                    //         this.G!.players[player].hand.shift();
                    //     }
                    //     return;
                    // }
                    // case MoveName.PlaceCard: {
                    //     console.log("placing card", player);
                    //     const card = this.G!.players[player].faceDownCard!;
                    //     this.G!.players[player].faceDownCard = null;

                    //     if (move.data.replace) {
                    //         // put new card on 6th spot
                    //         this.G!.rows[move.data.row][5] = card;
                    //         this.G!.rows = [...this.G!.rows];

                    //         this.queueAnimation(() => {
                    //             console.log("delaying before taking row");
                    //             this.delay(200);
                    //         });
                    //         this.queueAnimation(() => {
                    //             console.log("Taking row");
                    //             this.G!.players[player].points += sumBy(
                    //                 this.G!.rows[move.data.row].slice(0, 5),
                    //                 "points"
                    //             );
                    //             this.G!.rows[move.data.row] = [];
                    //             this.G!.rows[move.data.row][5] = card;
                    //             this.G!.rows = [...this.G!.rows];

                    //             console.log("delaying after taking row");
                    //             this.delay(300);
                    //         });
                    //         // Then move card to correct spot
                    //         this.queueAnimation(() => {
                    //             this.G!.rows[move.data.row] = [card];
                    //             this.G!.rows = [...this.G!.rows];
                    //         });
                    //     } else {
                    //         this.G!.rows[move.data.row].push(card);
                    //         this.G!.rows = [...this.G!.rows];
                    //     }

                    //     return;
                    // }
                    default:
                        return;
                }
            }
            case "event": {
                const { event } = logItem;
                switch (event.name) {
                    // case GameEventName.RevealCards: {
                    //     const cards = event.cards;

                    //     for (let player = 0; player < cards.length; player++) {
                    //         this.G!.players[player].faceDownCard =
                    //             cards[player];
                    //     }

                    //     this.delay(200);

                    //     return;
                    // }
                    // case GameEventName.RoundStart: {
                    //     console.log(JSON.parse(JSON.stringify(event)));
                    //     this.G!.rows = event.cards.board.map((card) => [
                    //         card,
                    //     ]) as [ICard[], ICard[], ICard[], ICard[]];

                    //     for (let i = 0; i < this.G!.players.length; i++) {
                    //         this.G!.players[i].hand = event.cards.players[i];
                    //     }

                    //     return;
                    // }
                    default:
                        return;
                }
            }
        }
    }

    delay(ms: number) {
        this.ui.waitingAnimations += 1;
        setTimeout(() => { this.ui.waitingAnimations = Math.max(this.ui.waitingAnimations - 1, 0); }, ms);
    }

    @Watch("ui.waitingAnimations")
    onAnimationNumberChanged() {
        console.log("waiting animations", this.ui.waitingAnimations, this._futureState!.log.length, this.state!.log.length);
    }

    queueAnimation(anim: Function) {
        this.animationQueue.push(anim);
    }

    _pendingAvailableMoves: { index: number; availableMoves: AvailableMoves[]; } | null = null;
    animationQueue: Array<Function> = [];
}
</script>
<style lang="scss">
.game {
    background-color: white;
    display: flex;
    align-items: center;
    flex-direction: column;
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
}
</style>
