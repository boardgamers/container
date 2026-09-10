<template>
    <g :id="elId" :class="['piece', { dragging, canDrag }]" :transform="`translate(${currentX}, ${currentY})`">
        <circle r="10" :fill="color" stroke="#233b43" />
        <path d="M-6 6 V-2 L-1 0 V-4 L4 -1 V-7 H7 V6Z" fill="#172d34" fill-opacity=".85" />
        <path d="M-4 2 V4 M0 2 V4 M4 2 V4" stroke="#f4eed6" stroke-width="1.3" />

        <title>Factory</title>
    </g>
</template>
<script lang="ts">
import { PieceType } from '@/types/ui-data';
import { Component, Mixins, Prop } from 'vue-property-decorator';
import Piece from './Piece.vue';

@Component({
    created(this: Factory) {
        this.pieceType = PieceType.Factory;
    },
})
export default class Factory extends Mixins(Piece) {
    @Prop()
    color?: string;
}
</script>
