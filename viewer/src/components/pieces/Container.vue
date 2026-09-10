<template>
    <g
        :id="elId"
        :class="['piece', { dragging, canDrag }]"
        :transform="`translate(${currentX}, ${currentY}) rotate(${rotate}, 10, 5)`"
    >
        <rect width="20" height="10" rx=".8" :fill="color" stroke="#21343b" />
        <path d="M4 2V8 M8 2V8 M12 2V8 M16 2V8" stroke="#10252b" stroke-opacity=".3" stroke-width=".7" />
        <path d="M1 1H19" stroke="white" stroke-opacity=".5" />

        <title>Container</title>
    </g>
</template>
<script lang="ts">
import { ContainerState, PieceType } from '@/types/ui-data';
import { Component, Mixins, Prop } from 'vue-property-decorator';
import Piece from './Piece.vue';

@Component({
    created(this: Container) {
        this.pieceType = PieceType.Container;
    },
})
export default class Container extends Mixins(Piece) {
    @Prop()
    color?: string;

    @Prop()
    owner?: number;

    @Prop()
    state?: ContainerState;
}
</script>
