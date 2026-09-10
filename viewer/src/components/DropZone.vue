<template>
    <g
        :class="['placeholder', { showDrop, canClick: ui.selected && canDrop }]"
        @click.stop="clickDestination"
        @mousedown="prepareClick"
        @touchstart="prepareClick"
    >
        <rect :width="width" :height="height" fill="black" />
        <title v-if="data && data.type == 'playerHarbor'">Harbor</title>
        <title v-else-if="data && data.type == 'factoryStore'">Factory Store</title>
        <title v-else-if="data && data.type == 'warehouseStore'">Harbor Store</title>
        <title v-else-if="data && data.type == 'factory'">Factory Slot</title>
        <title v-else-if="data && data.type == 'warehouse'">Warehouse Slot</title>
        <title v-else-if="data && data.type == 'supply'">Supply</title>
        <title v-else-if="data && data.type == 'openSea'">Open Sea</title>
        <title v-else-if="data && data.type == 'islandHarbor'">Island Harbor</title>
    </g>
</template>
<script lang="ts">
import { Vue, Component, Prop, Watch, Inject, InjectReactive } from 'vue-property-decorator';
import { ContainerState, DropZoneType, PieceType, UIData, Preferences } from '../types/ui-data';
import { EventEmitter, Listener } from 'events';
import Piece from './pieces/Piece.vue';
import { Ship, Container, LoanCard } from './pieces';
import { ShipPosition } from 'container-engine/src/gamestate';
import { MoveName } from 'container-engine';

@Component
export default class DropZone extends Vue {
    @Inject()
    readonly ui!: UIData;

    @InjectReactive()
    readonly preferences!: Preferences;

    @InjectReactive()
    readonly player!: number;

    @Inject()
    readonly communicator!: EventEmitter;

    @Prop({ default: true })
    enabled!: boolean;

    @Prop()
    width!: number;

    @Prop()
    height!: number;

    @Prop()
    accepts?: string;

    @Prop()
    data?: any;

    @Prop()
    availableMoves?: any;

    listener?: Listener;
    overlapping = false;

    updateOverlapping(piece: Piece) {
        if (!this.enabled) {
            this.overlapping = false;
            return;
        }

        if (!this.ui.dragged) {
            if (this.overlapping) {
                if (this.accepts?.indexOf(piece.pieceType) != -1) {
                    this.communicator.emit('pieceDrop', piece, this.data);
                }
            }

            this.overlapping = false;
            return;
        }

        if (!this.canDrop) {
            this.overlapping = false;
            return;
        }

        const rect1 = this.$el.getBoundingClientRect();
        const rect2 = this.ui.dragged!.$el.getBoundingClientRect();

        this.overlapping =
            rect1.bottom >= rect2.top &&
            rect1.right >= rect2.left &&
            rect1.top <= rect2.bottom &&
            rect1.left <= rect2.right;
    }

    @Watch('enabled', { immediate: true })
    onEnabledChanged() {
        if (!this.listener) {
            this.listener = (piece) => this.updateOverlapping(piece);
            this.$on('hook:beforeDestroy', () => this.communicator.off('draggedPosChanged', this.listener!));
        }

        if (this.enabled) {
            if (this.communicator.listenerCount('draggedPosChanged') + 1 > this.communicator.getMaxListeners()) {
                this.communicator.setMaxListeners(this.communicator.getMaxListeners() + 10);
            }

            this.communicator.on('draggedPosChanged', this.listener!);
        } else {
            this.communicator.off('draggedPosChanged', this.listener!);
        }
    }

    get activePiece() {
        return this.ui.dragged || (this.ui.selected?.canDrag ? this.ui.selected : null);
    }

    prepareClick(event: Event) {
        if (this.ui.selected && this.canDrop) event.stopPropagation();
    }

    clickDestination() {
        if (this.ui.selected && this.canDrop) {
            this.communicator.emit('pieceDrop', this.ui.selected, this.data);
            this.ui.selected = null;
        }
    }

    get canDrop() {
        if (!this.enabled || !this.activePiece || this.accepts?.indexOf(this.activePiece.pieceType) == -1) return false;

        if (this.activePiece.pieceType == PieceType.Loan) {
            const loan = this.activePiece as LoanCard;
            if (loan.owner == this.player) {
                if (this.data.type == DropZoneType.GetLoan) return false;
            } else {
                if (this.data.type == DropZoneType.PayLoan) return false;
            }
        } else if (this.activePiece.pieceType == PieceType.Ship) {
            const ship = this.activePiece as Ship;
            if (ship.position == ShipPosition.OpenSea) {
                if (this.data.type == DropZoneType.OpenSea) return false;

                if (this.data.type == DropZoneType.IslandHarbor && ship.containers?.length == 0) return false;

                if (this.data.owner == this.player) return false;
            } else {
                if (this.data.type != DropZoneType.OpenSea) return false;
            }
        } else if (this.activePiece.pieceType == PieceType.Container) {
            const container = this.activePiece as Container;
            if (container.state == ContainerState.OnBoard) {
                if (this.data.type != DropZoneType.FactoryStore) return false;
            } else if (container.state == ContainerState.OnFactoryStore) {
                if (container.owner == this.player) {
                    if (this.data.type == DropZoneType.Supply) {
                        if (!this.availableMoves[MoveName.DomesticSale]?.find((c) => c.id === container.pieceId)) {
                            return false;
                        }
                    } else if (this.data.type != DropZoneType.FactoryStore) {
                        return false;
                    }
                } else {
                    if (this.data.type != DropZoneType.WarehouseStore) return false;
                }
            } else if (container.state == ContainerState.OnWarehouseStore) {
                if (container.owner == this.player) {
                    if (this.data.type == DropZoneType.Supply) {
                        if (!this.availableMoves[MoveName.DomesticSale]?.find((c) => c.id === container.pieceId)) {
                            return false;
                        }
                    } else if (this.data.type != DropZoneType.WarehouseStore) {
                        return false;
                    }
                } else {
                    if (this.data.type != DropZoneType.Ship) return false;
                }
            }
        }

        return true;
    }

    get showDrop() {
        return (!!this.ui.selected || !this.preferences.disableHelp) && this.canDrop;
    }
}
</script>
<style lang="scss">
g.placeholder {
    rect {
        stroke: none;
        fill: transparent;
    }

    &.showDrop {
        rect {
            stroke: #1b6c87;
            stroke-width: 1.3px;
            rx: 3px;
        }
    }

    &.canClick {
        cursor: pointer;
    }
}
</style>

<style>
.piece.click-selected {
    filter: drop-shadow(0 0 3px #fff) drop-shadow(0 0 2px #203a45);
}
g.placeholder.canClick rect {
    fill: #1b6c8722;
    stroke-dasharray: 4 3;
}
</style>
