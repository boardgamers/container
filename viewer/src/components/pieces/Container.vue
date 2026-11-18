<template>
    <g
        :id="elId"
        :class="['piece', { dragging, canDrag, 'bid-eligible': bidEligible, 'bid-selected': bidSelected }]"
        :data-piece-id="pieceId"
        :role="bidEligible ? 'button' : undefined"
        :tabindex="bidEligible ? 0 : undefined"
        :aria-label="bidEligible ? `${color} container` : undefined"
        :aria-pressed="bidEligible ? String(bidSelected) : undefined"
        @click.stop="selectBid"
        @keydown.enter.prevent="selectBid"
        @keydown.space.prevent="selectBid"
        :transform="`translate(${currentX}, ${currentY}) rotate(${rotate}, 10, 5)`"
    >
        <rect width="20" height="10" rx=".8" :fill="color" stroke="#21343b" />
        <path d="M4 2V8 M8 2V8 M12 2V8 M16 2V8" stroke="#10252b" stroke-opacity=".3" stroke-width=".7" />
        <path d="M1 1H19" stroke="white" stroke-opacity=".5" />

        <ColorMark :color="color" transform="translate(10 5) scale(.8)" />
        <title>Container</title>
    </g>
</template>
<script lang="ts">
import { ContainerState, PieceType } from '@/types/ui-data';
import { Component, Mixins, Prop } from 'vue-property-decorator';
import Piece from './Piece.vue';
import ColorMark from '../ColorMark.vue';

@Component({
    components: { ColorMark },
    created(this: Container) {
        this.pieceType = PieceType.Container;
    },
})
export default class Container extends Mixins(Piece) {
    @Prop({ default: false })
    bidEligible!: boolean;

    @Prop({ default: false })
    bidSelected!: boolean;

    selectBid() {
        if (this.bidEligible) this.$emit('bid-select');
    }

    @Prop()
    color?: string;

    @Prop()
    owner?: number;

    @Prop()
    state?: ContainerState;
}
</script>

<style scoped>
.bid-eligible {
    cursor: pointer;
}
.bid-selected > rect {
    stroke: #ffe154;
    stroke-width: 2.5;
    filter: drop-shadow(0 0 1px #142f69);
}
.bid-eligible:focus-visible {
    outline: 2px solid blue;
    outline-offset: 3px;
}
</style>
