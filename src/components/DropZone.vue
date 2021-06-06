<template>
    <g :class="['placeholder', { enabled, overlapping }]">
        <rect :width="width" :height="height" />
    </g>
</template>
<script lang="ts">
import { Vue, Component, Prop, Watch, Inject } from "vue-property-decorator";
import { UIData } from '../types/ui-data';
import { EventEmitter, Listener } from 'events';
import Piece from "./pieces/Piece.vue";

@Component
export default class DropZone extends Vue {
    @Inject()
    readonly ui!: UIData;

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

    listener?: Listener;
    overlapping = false;

    updateOverlapping(piece: Piece) {
        if (!this.enabled || !this.ui.dragged) {
            if (this.overlapping && this.enabled && !this.ui.dragged) {
                if (this.accepts?.indexOf(piece.pieceType) != -1) {
                    this.communicator.emit("pieceDrop", piece, this.data);
                }
            }

            this.overlapping = false;
            return;
        }

        const rect1 = this.$el.getBoundingClientRect();
        const rect2 = this.ui.dragged!.$el.getBoundingClientRect();

        this.overlapping = rect1.bottom >= rect2.top && rect1.right >= rect2.left && rect1.top <= rect2.bottom && rect1.left <= rect2.right;
    }

    @Watch("enabled", { immediate: true })
    onEnabledChanged() {
        if (!this.listener) {
            this.listener = (piece) => this.updateOverlapping(piece);
            this.$on("hook:beforeDestroy", () => this.communicator.off("draggedPosChanged", this.listener!));
        }

        if (this.enabled) {
            if (this.communicator.listenerCount("draggedPosChanged") + 1 > this.communicator.getMaxListeners()) {
                this.communicator.setMaxListeners(this.communicator.getMaxListeners() + 10);
            }

            this.communicator.on("draggedPosChanged", this.listener!);
        } else {
            this.communicator.off("draggedPosChanged", this.listener!);
        }
    }
}

</script>
<style lang="scss">
g.placeholder {
    rect {
        stroke: none;
        fill: none;
    }

    &.canClick {
        cursor: pointer;
    }
}

</style>